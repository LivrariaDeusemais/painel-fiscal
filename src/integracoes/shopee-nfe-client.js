const crypto = require('crypto');
const HOST = 'https://partner.shopeemobile.com';
const ROOT = '/integracoes/shopee-nfe';

function config(env = process.env) {
  const missing = ['SHOPEE_PARTNER_ID','SHOPEE_PARTNER_KEY','SHOPEE_TOKEN_ENCRYPTION_KEY'].filter(k => !env[k]);
  if (env.SHOPEE_PARTNER_ID && !/^\d+$/.test(env.SHOPEE_PARTNER_ID)) missing.push('SHOPEE_PARTNER_ID válido');
  if (env.SHOPEE_TOKEN_ENCRYPTION_KEY && env.SHOPEE_TOKEN_ENCRYPTION_KEY.length < 32) missing.push('SHOPEE_TOKEN_ENCRYPTION_KEY (mínimo 32 caracteres)');
  const base = env.APP_BASE_URL || 'https://app.plennatecsistemas.com.br';
  const callback = new URL(ROOT + '/callback', base).href;
  if (!callback.startsWith('https://')) missing.push('APP_BASE_URL com HTTPS');
  return { partnerId: env.SHOPEE_PARTNER_ID, partnerKey: env.SHOPEE_PARTNER_KEY, encryptionKey: env.SHOPEE_TOKEN_ENCRYPTION_KEY, callback, missing };
}
function requireConfig(c) { if(c.missing.length) throw new Error('Configure a conexão da Shopee antes de continuar.'); }
function sign(c, path, timestamp, token = '', shop = '') {
  return crypto.createHmac('sha256',c.partnerKey).update(`${c.partnerId}${path}${timestamp}${token}${shop}`).digest('hex');
}
function seal(value, c) {
  requireConfig(c);
  const iv=crypto.randomBytes(12), key=crypto.createHash('sha256').update(c.encryptionKey).digest();
  const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return [iv,cipher.getAuthTag(),data].map(b=>b.toString('base64')).join(':');
}
function unseal(value,c) {
  requireConfig(c);
  const [iv,tag,data]=value.split(':').map(v=>Buffer.from(v,'base64'));
  const decipher=crypto.createDecipheriv('aes-256-gcm',crypto.createHash('sha256').update(c.encryptionKey).digest(),iv);
  decipher.setAuthTag(tag); return Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8');
}
function numericId(value) {
  const s=String(value ?? '');
  if (!/^\d+$/.test(s) || !Number.isSafeInteger(Number(s)) || Number(s)<=0) throw new Error('Identificador inválido retornado pela Shopee.');
  return Number(s);
}
function authUrl(c,state,now=Date.now()) {
  requireConfig(c);
  const path='/api/v2/shop/auth_partner', timestamp=Math.floor(now/1000);
  const redirect=new URL(c.callback); redirect.searchParams.set('state',state);
  return HOST+path+'?'+new URLSearchParams({partner_id:c.partnerId,timestamp:String(timestamp),sign:sign(c,path,timestamp),redirect:redirect.href});
}
async function boundedBody(response, max) {
  if(Number(response.headers?.get('content-length'))>max) throw new Error('Arquivo da Shopee excede o limite permitido.');
  const chunks=[]; let size=0;
  for await(const chunk of response.body) {size+=chunk.length;if(size>max){await response.body.cancel?.().catch(()=>{});throw new Error('Arquivo da Shopee excede o limite permitido.');}chunks.push(Buffer.from(chunk));}
  return Buffer.concat(chunks);
}
class Client {
  constructor(c=config(),fetcher=fetch) { requireConfig(c);this.c=c;this.fetcher=fetcher; }
  async call(path,body,token='',shop='') {
    // Apenas os endpoints fiscais de consulta e autorização: nunca emitir notas.
    if(!['/api/v2/auth/token/get','/api/v2/auth/access_token/get','/api/v2/order/generate_fbs_invoices','/api/v2/order/get_fbs_invoices_result','/api/v2/order/download_fbs_invoices'].includes(path)) throw new Error('Operação Shopee não permitida.');
    const timestamp=Math.floor(Date.now()/1000),params={partner_id:this.c.partnerId,timestamp:String(timestamp),sign:sign(this.c,path,timestamp,token,shop)};
    if(token){params.access_token=token;params.shop_id=String(shop);}
    let r;
    try {r=await this.fetcher(HOST+path+'?'+new URLSearchParams(params),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000),redirect:'error'});}
    catch {throw new Error('Não foi possível consultar a Shopee. Tente novamente.');}
    if(!r.ok)throw new Error(`Shopee: HTTP ${r.status}. A carga não foi concluída.`);
    let data;try{data=JSON.parse((await boundedBody(r,2*1024*1024)).toString('utf8'));}catch{throw new Error('Resposta da Shopee inválida ou acima do limite.');}
    if(data.error || data.error_msg || data.response?.error_msg) {
      // Não propagar mensagens/URLs que possam carregar credenciais.
      const code=String(data.error || 'consulta_recusada').replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,100);
      throw new Error(`Shopee recusou a consulta (${code}). Confira as permissões FBS do aplicativo e a autorização da loja.`);
    }
    return data;
  }
}
async function storeTokens(pool,data,shop,c=config()) {
  const t=data.response || data;
  if(!t.access_token || !t.refresh_token || !Number.isFinite(Number(t.expire_in)) || Number(t.expire_in)<=0) throw new Error('A Shopee não retornou uma autorização válida.');
  await pool.query(`INSERT INTO shopee_nfe_conexao(id,shop_id,access_token,refresh_token,expira_em) VALUES(1,$1,$2,$3,NOW()+$4*INTERVAL '1 second') ON CONFLICT(id) DO UPDATE SET shop_id=EXCLUDED.shop_id,access_token=EXCLUDED.access_token,refresh_token=EXCLUDED.refresh_token,expira_em=EXCLUDED.expira_em,atualizado_em=NOW()`,[String(numericId(shop)),seal(t.access_token,c),seal(t.refresh_token,c),Math.min(Number(t.expire_in),86400)]);
}
async function accessToken(pool,client=new Client()) {
  const db=await pool.connect();
  try {
    await db.query('BEGIN');
    let row=(await db.query('SELECT * FROM shopee_nfe_conexao WHERE id=1 FOR UPDATE')).rows[0];
    if(!row) throw new Error('Conecte a loja Shopee antes de buscar as notas.');
    if(new Date(row.expira_em).getTime()<Date.now()+120000) {
      const data=await client.call('/api/v2/auth/access_token/get',{partner_id:numericId(client.c.partnerId),shop_id:numericId(row.shop_id),refresh_token:unseal(row.refresh_token,client.c)});
      await storeTokens(db,data,row.shop_id,client.c);
      row=(await db.query('SELECT * FROM shopee_nfe_conexao WHERE id=1')).rows[0];
    }
    await db.query('COMMIT');return {token:unseal(row.access_token,client.c),shop:String(row.shop_id)};
  } catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;} finally {db.release();}
}
function downloadUrl(value,env=process.env) {
  let u;try{u=new URL(value);}catch{throw new Error('Link de XML ausente ou inválido na Shopee.');}
  const hosts=['down-br.img.susercontent.com','partner.shopeemobile.com','cf.shopee.com.br',...(env.SHOPEE_XML_DOWNLOAD_HOSTS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean)];
  if(u.protocol!=='https:'||u.username||u.password||u.port||!hosts.includes(u.hostname.toLowerCase())||/^(localhost|[\d.:]+)$/.test(u.hostname)) throw new Error(`Servidor de download não autorizado: ${u.hostname}. O administrador precisa validar o domínio oficial antes de liberá-lo.`);
  return u;
}
async function download(value,fetcher=fetch,env=process.env) {
  for(let i=0;i<4;i++) {
    const u=downloadUrl(value,env);let r;
    try{r=await fetcher(u.href,{signal:AbortSignal.timeout(60000),redirect:'manual'});}catch{throw new Error('Falha no download do XML da Shopee.');}
    if([301,302,303,307,308].includes(r.status)) {value=new URL(r.headers.get('location'),u).href;await r.body?.cancel();continue;}
    if(!r.ok)throw new Error(`Falha no download Shopee: HTTP ${r.status}.`);
    return boundedBody(r,100*1024*1024);
  }
  throw new Error('Redirecionamentos demais no download da Shopee.');
}
module.exports={config,sign,seal,unseal,numericId,authUrl,Client,accessToken,storeTokens,downloadUrl,download,boundedBody,ROOT};
