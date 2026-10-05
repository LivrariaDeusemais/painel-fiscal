const crypto = require('crypto');
const pricing = require('../tabela-precos/service');
const API = 'https://api.mercadolibre.com';
const ROOT = '/ferramentas-ia/tabela-precos/mercado-livre';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function config() {
  return {clientId:process.env.ML_CLIENT_ID || '',clientSecret:process.env.ML_CLIENT_SECRET || '',key:process.env.ML_TOKEN_ENCRYPTION_KEY || '',
    callback:(process.env.APP_BASE_URL || 'https://app.plennatecsistemas.com.br').replace(/\/$/,'')+ROOT+'/callback'};
}
function missingConfig() { const c=config(); return [['ML_CLIENT_ID',c.clientId],['ML_CLIENT_SECRET',c.clientSecret],['ML_TOKEN_ENCRYPTION_KEY',c.key.length>=32?c.key:'']].filter(([,v])=>!v).map(([k])=>k); }
function crypt(value, decrypt=false) {
  if(config().key.length<32) throw new Error('Configure ML_TOKEN_ENCRYPTION_KEY com pelo menos 32 caracteres.');
  const key=crypto.createHash('sha256').update(config().key).digest();
  if(decrypt) { const [iv,tag,body]=String(value).split(':').map(v=>Buffer.from(v,'base64')); const c=crypto.createDecipheriv('aes-256-gcm',key,iv); c.setAuthTag(tag); return Buffer.concat([c.update(body),c.final()]).toString('utf8'); }
  const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv),body=Buffer.concat([c.update(String(value),'utf8'),c.final()]);
  return [iv,c.getAuthTag(),body].map(v=>v.toString('base64')).join(':');
}
async function ensureTables(pool) {
  await pricing.ensureTables(pool);
  await pool.query(`CREATE TABLE IF NOT EXISTS ml_integracao (
    id INTEGER PRIMARY KEY CHECK(id=1),seller_id TEXT,nickname TEXT,access_token TEXT,refresh_token TEXT,expira_em TIMESTAMPTZ,conectado_em TIMESTAMPTZ);
    INSERT INTO ml_integracao(id) VALUES(1) ON CONFLICT DO NOTHING;
    CREATE TABLE IF NOT EXISTS ml_operacoes (id UUID PRIMARY KEY,tipo TEXT NOT NULL,status TEXT NOT NULL,seller_id TEXT NOT NULL,
    usuario TEXT NOT NULL,dados JSONB NOT NULL DEFAULT '{}',resultados JSONB NOT NULL DEFAULT '[]',criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),expira_em TIMESTAMPTZ);`);
}
async function tokenRequest(params,transport=fetch) {
  const c=config();const response=await transport(API+'/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({...params,client_id:c.clientId,client_secret:c.clientSecret}),signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw new Error('Não foi possível autorizar o Mercado Livre. Confira o aplicativo e conecte novamente.');
  const token=await response.json();
  if(!token.access_token || !token.refresh_token || !(Number(token.expires_in)>0) || !token.user_id) throw new Error('Autorização incompleta do Mercado Livre.');
  return token;
}
async function storeToken(client,token) {
  await client.query(`UPDATE ml_integracao SET access_token=$1,refresh_token=$2,expira_em=NOW()+($3::int*INTERVAL '1 second'),seller_id=$4,conectado_em=NOW() WHERE id=1`,[crypt(token.access_token),crypt(token.refresh_token),token.expires_in,String(token.user_id)]);
}
async function connect(pool,code,verifier) {
  if(missingConfig().length) throw new Error('Configure o aplicativo Mercado Livre no Render.');
  const token=await tokenRequest({grant_type:'authorization_code',code,redirect_uri:config().callback,code_verifier:verifier});
  const response=await fetch(API+'/users/me',{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw new Error('Não foi possível identificar a conta autorizada.');
  const user=await response.json();
  if(String(user.id)!==String(token.user_id) || user.site_id!=='MLB') throw new Error('Autorize uma conta brasileira do Mercado Livre.');
  // Avoid switching accounts underneath a live operation.
  const client=await pool.connect();
  try { await client.query('BEGIN');const previous=(await client.query('SELECT seller_id FROM ml_integracao WHERE id=1 FOR UPDATE')).rows[0];
    if((await client.query("SELECT id FROM ml_operacoes WHERE status='executando' LIMIT 1")).rows.length) throw new Error('Aguarde a operação atual terminar antes de reconectar.');
    if(previous?.seller_id && previous.seller_id!==String(user.id)) await client.query("UPDATE tabela_preco_vinculos SET dados=dados-'mercado_livre_preco' WHERE marketplace='Mercado Livre'");
    await storeToken(client,token);await client.query('UPDATE ml_integracao SET nickname=$1 WHERE id=1',[user.nickname]);await client.query('COMMIT');
  } catch(e) {await client.query('ROLLBACK');throw e;} finally{client.release();}
}
async function accessToken(pool) {
  const client=await pool.connect();
  try {await client.query('BEGIN');const row=(await client.query('SELECT * FROM ml_integracao WHERE id=1 FOR UPDATE')).rows[0];
    if(!row?.refresh_token) throw new Error('Conecte a conta Mercado Livre primeiro.');
    let token;
    if(new Date(row.expira_em).getTime()>Date.now()+60000) token=crypt(row.access_token,true);
    else {const fresh=await tokenRequest({grant_type:'refresh_token',refresh_token:crypt(row.refresh_token,true)});
      if(String(fresh.user_id)!==String(row.seller_id)) throw new Error('Conta da autorização mudou. Reconecte o Mercado Livre.');
      await storeToken(client,fresh);token=fresh.access_token;}
    await client.query('COMMIT');return token;
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
function validatePath(path,method) {
  const reads=/^\/(?:users\/(?:me|\d+)|items\/MLB\d+(?:\/sale_price|\/prices)?|seller-promotions\/(?:users\/\d+|promotions\/[-\w]+(?:\/items)?|items\/MLB\d+))$/;
  const writes=/^\/(?:items\/MLB\d+(?:\/prices\/standard)?|seller-promotions\/(?:items\/MLB\d+|promotions))$/;
  if(!(method==='GET'?reads:writes).test(path) || !['GET','POST','PUT'].includes(method)) throw new Error('Operação Mercado Livre não permitida.');
}
class MeliClient {
  constructor(pool,transport=fetch,sleep=delay,getToken=accessToken){this.pool=pool;this.transport=transport;this.sleep=sleep;this.getToken=getToken;this.lastRequest=0;}
  async request(method,path,params={},body) {
    validatePath(path,method);const url=new URL(API+path);for(const [k,v]of Object.entries(params))if(v!=null)url.searchParams.set(k,String(v));
    for(let attempt=0;attempt<4;attempt++) {
      await this.sleep(Math.max(0,350-(Date.now()-this.lastRequest)));const token=await this.getToken(this.pool);this.lastRequest=Date.now();
      let response;try {response=await this.transport(url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});}
      catch(e){throw new Error(method==='GET'?'Consulta interrompida. Os dados anteriores foram preservados.':'Resposta de publicação não confirmada. Consulte o anúncio antes de tentar novamente.');}
      // Writes are never automatically replayed, including ambiguous 5xx responses.
      if(method==='GET' && (response.status===429 || response.status>=500) && attempt<3){await this.sleep(1000*2**attempt);continue;}
      const data=await response.json().catch(()=>({}));
      if(!response.ok) {const known={401:'Autorização expirou. Reconecte o Mercado Livre.',403:'O aplicativo não tem permissão para esta consulta. Revise os acessos do aplicativo.',429:'Mercado Livre limitou as requisições. Aguarde antes de tentar novamente.'};
        const causes=(data.cause || []).map(c=>c.code).filter(c=>typeof c==='string' && /^[\w.:-]+$/.test(c)).slice(0,4).join(', ');
        throw new Error(known[response.status] || `Mercado Livre recusou a operação (HTTP ${response.status})${causes?': '+causes:'.'}${method==='GET'?'':' Confira o anúncio antes de repetir.'}`);}
      return data;
    }
  }
  get(path,params){return this.request('GET',path,params);}
}
function itemId(value) {const id=String(value || '').trim().toUpperCase();if(!/^MLB\d+$/.test(id)) throw new Error('Vínculo sem código MLB exato. Corrija o vínculo antes de integrar.');return id;}
function assertOwned(item,id,seller) {
  if(item.id!==id || String(item.seller_id)!==String(seller) || item.site_id!=='MLB') throw new Error('Anúncio não pertence à conta Mercado Livre conectada.');
  if(item.currency_id!=='BRL') throw new Error('Anúncio com moeda diferente de BRL.');
}
function standardPrice(prices,id) {
  if(prices.id!==id || !Array.isArray(prices.prices)) throw new Error('Resposta incompleta dos preços do anúncio.');
  const valid=prices.prices.filter(p=>p.type==='standard' && p.currency_id==='BRL' && Number(p.amount)>0
    && !(Number(p.conditions?.min_purchase_unit)>1) && !p.conditions?.start_time && !p.conditions?.end_time
    && (p.conditions?.context_restrictions || []).every(c=>c==='channel_marketplace'));
  const exact=valid.filter(p=>(p.conditions?.context_restrictions || []).includes('channel_marketplace'));
  const chosen=exact.length?exact:valid;
  if(chosen.length!==1) throw new Error('Preço bruto padrão do canal Mercado Livre ausente ou ambíguo.');
  return Number(chosen[0].amount);
}
function activeBenefit(sale,promotions) {
  const pending=reason=>({status:'pending',amount:null,reason});
  if(!Array.isArray(promotions))return pending('Resposta de promoções inválida.');
  const meta=sale.metadata || {};
  if(!meta.promotion_id && !meta.campaign_id)return promotions.some(p=>p.status==='started')?pending('Preço vigente sem identificador de oferta ou campanha.'):{status:'none',amount:0};
  // sale_price identifies the winning offer, while seller-promotions identifies the campaign.
  // Their type names also differ (marketplace_campaign can correspond to SMART).
  const matches=promotions.filter(p=>{
    if(p.status!=='started')return false;
    const refs=[p.ref_id,p.offer_id].filter(Boolean).map(String);
    if(meta.campaign_id && String(p.id)!==String(meta.campaign_id))return false;
    if(meta.promotion_id && refs.length)return refs.includes(String(meta.promotion_id));
    return meta.campaign_id || String(p.id)===String(meta.promotion_id);
  });
  if(matches.length!==1)return pending('Oferta vigente não encontrada de forma única entre as promoções ativas.');
  const p=matches[0],effective=Number(p.boosted_offer?p.total_price_for_boosted_offer:p.price);
  if(!Number.isFinite(effective) || Math.abs(effective-Number(sale.amount))>0.005)return pending('Preço da promoção difere do preço vigente consultado.');
  const cofinanced=['MARKETPLACE_CAMPAIGN','SMART','PRICE_MATCHING','PRICE_MATCHING_MELI_ALL','PRE_NEGOTIATED','UNHEALTHY_STOCK'].includes(p.type);
  if(!cofinanced && !['DEAL','PRICE_DISCOUNT','SELLER_CAMPAIGN','LIGHTNING','DOD'].includes(p.type))return pending('Tipo de promoção sem cálculo de benefício validado: '+p.type);
  let amount=0;
  if(cofinanced) {
    const share=p.meli_percentage==null?NaN:Number(p.meli_percentage),original=Number(p.original_price);
    if(!Number.isFinite(share) || share<0 || share>100 || !(original>0))return pending('Participação do Meli ou preço original ausente ou inválido.');
    amount=original*share/100;
  }
  if(p.boosted_offer) {
    const boost=p.discount_meli_boost_amount==null?NaN:Number(p.discount_meli_boost_amount);
    if(!Number.isFinite(boost) || boost<0)return pending('Valor absoluto do benefício adicional ausente ou inválido.');
    amount+=boost;
  }
  if(!Number.isFinite(amount) || amount<0)return pending('Benefício calculado inválido.');
  return {status:'identified',amount:Math.round(amount*100)/100,promotionId:p.id,offerId:p.ref_id || p.offer_id || null,type:p.type,
    estimated:cofinanced && amount>0,reason:cofinanced && amount>0?'Estimado pelo percentual de participação retornado pelo Meli; pode diferir do valor exibido no portal.':null};
}
async function snapshot(api,id,seller) {
  const item=await api.get('/items/'+id);assertOwned(item,id,seller);
  const prices=await api.get('/items/'+id+'/prices');
  const sale=await api.get('/items/'+id+'/sale_price',{context:'channel_marketplace'});
  const price=readPrice(item,sale,seller,standardPrice(prices,id));
  try {price.benefit=activeBenefit(sale,await api.get('/seller-promotions/items/'+id,{app_version:'v2'}));}
  catch(e) {price.benefit={status:'pending',amount:null,reason:e.message};}
  return {item,sale,price};
}
function readPrice(item,sale,seller,gross) {
  assertOwned(item,itemId(item.id),seller);
  if(sale.currency_id!=='BRL' || !Number.isFinite(Number(sale.amount)) || !(Number(sale.amount)>0) || !(Number(gross)>0) || !Number.isFinite(Number(gross))) throw new Error('Preço do anúncio ausente ou inválido.');
  return {itemId:item.id,sellerId:String(seller),amount:Number(sale.amount),gross:Number(gross),currency:'BRL',catalogListing:item.catalog_listing === true,catalogProductId:item.catalog_product_id || null,observedAt:new Date().toISOString(),promotion:sale.metadata || {},priceId:sale.price_id || null};
}
async function runLocked(pool,op,worker) {
  const lock=await pool.connect();
  try {
    const acquired=(await lock.query('SELECT pg_try_advisory_lock(62401987) AS locked')).rows[0]?.locked;
    if(!acquired) throw new Error('Outra operação Mercado Livre está em andamento.');
    try {await worker();} finally {await lock.query('SELECT pg_advisory_unlock(62401987)');}
  } catch(e) {await appendResult(pool,op.id,{status:'Interrompida',motivo:e.message});await pool.query("UPDATE ml_operacoes SET status='interrompida',atualizado_em=NOW() WHERE id=$1 AND status='executando'",[op.id]);}
  finally {lock.release();}
}
async function recoverInterrupted(pool) {
  const client=await pool.connect();
  try {const free=(await client.query('SELECT pg_try_advisory_lock(62401987) AS locked')).rows[0]?.locked;
    if(free) {try {await client.query("UPDATE ml_operacoes SET status='interrompida',resultados=resultados || '[{\"status\":\"Interrompida\",\"motivo\":\"Processamento interrompido. Confira os envios iniciados no Mercado Livre antes de repetir.\"}]'::jsonb,atualizado_em=NOW() WHERE status='executando' AND atualizado_em<NOW()-INTERVAL '1 minute'");}finally {await client.query('SELECT pg_advisory_unlock(62401987)');}}
  }finally{client.release();}
}
async function state(pool) {
  await recoverInterrupted(pool);
  const account=(await pool.query('SELECT seller_id,nickname,conectado_em FROM ml_integracao WHERE id=1')).rows[0] || {};
  const jobs=(await pool.query('SELECT id,tipo,status,resultados,criado_em,atualizado_em FROM ml_operacoes ORDER BY criado_em DESC LIMIT 10')).rows;
  return {account,jobs,missing:missingConfig(),callback:config().callback};
}
async function savePrice(pool,row,price) {
  const result=await pool.query(`UPDATE tabela_preco_vinculos SET dados=COALESCE(dados,'{}'::jsonb)||jsonb_build_object('mercado_livre_preco',$1::jsonb) WHERE id=$2 AND marketplace='Mercado Livre' AND UPPER(TRIM(id_loja))=$3`,[JSON.stringify(price),row.id,price.itemId]);
  if(result.rowCount!==1)throw new Error('Vínculo mudou durante a consulta. O preço não foi gravado.');
}
async function operation(pool,type,user,data,status='previa') {
  const account=(await pool.query('SELECT seller_id FROM ml_integracao WHERE id=1')).rows[0];
  if(!account?.seller_id)throw new Error('Conecte o Mercado Livre primeiro.');
  const id=crypto.randomUUID();await pool.query(`INSERT INTO ml_operacoes(id,tipo,status,seller_id,usuario,dados,expira_em) VALUES($1,$2,$3,$4,$5,$6,NOW()+INTERVAL '20 minutes')`,[id,type,status,account.seller_id,String(user),JSON.stringify(data)]);return {id,seller:account.seller_id,dados:data};
}
async function beginOperation(pool,type,user,data) {
  const client=await pool.connect();
  try {await client.query('BEGIN');await client.query('SELECT id FROM ml_integracao WHERE id=1 FOR UPDATE');
    if((await client.query("SELECT id FROM ml_operacoes WHERE status='executando' LIMIT 1")).rows.length)throw new Error('Aguarde a operação atual terminar.');
    const op=await operation(client,type,user,data,'executando');await client.query('COMMIT');return op;
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
async function appendResult(pool,id,result) {await pool.query("UPDATE ml_operacoes SET resultados=resultados||$2::jsonb,atualizado_em=NOW() WHERE id=$1",[id,JSON.stringify([result])]);}
function syncSelectors(filter='') {
  const raw=String(filter).trim();
  if(raw.length>5000)throw new Error('Lista muito longa. Informe até 50 SKUs ou anúncios.');
  if(!raw)return [];
  const entries=raw.split(',').map(v=>v.trim().toUpperCase());
  if(entries.some(v=>!v || v.length>100))throw new Error('Informe os SKUs ou anúncios separados por vírgula, sem posições vazias.');
  const selectors=[...new Set(entries)];
  if(selectors.length>50)throw new Error('Informe até 50 SKUs ou anúncios por consulta.');
  return selectors;
}
async function syncRows(pool,filter) {
  const selectors=syncSelectors(filter);
  return (await pool.query("SELECT id,sku,id_loja FROM tabela_preco_vinculos WHERE marketplace='Mercado Livre' AND (cardinality($1::text[])=0 OR UPPER(TRIM(sku))=ANY($1::text[]) OR UPPER(TRIM(id_loja))=ANY($1::text[])) ORDER BY id",[selectors])).rows;
}
async function runSync(pool,op) {
  const api=new MeliClient(pool);let errors=0;const snapshots=new Map();
  try {const rows=await syncRows(pool,op.dados?.filter || '');
    for(const selector of syncSelectors(op.dados?.filter || '')) {if(!rows.some(row=>[row.sku,row.id_loja].some(v=>String(v || '').trim().toUpperCase()===selector))){errors++;await appendResult(pool,op.id,{sku:selector,status:'Pendente',motivo:'Nenhum vínculo encontrado para o código informado.'});}}
    if(!rows.length){errors++;await appendResult(pool,op.id,{status:'Pendente',motivo:'Nenhum vínculo encontrado para o SKU ou anúncio informado.'});}
    for(const row of rows) {let result={sku:row.sku,anuncio:row.id_loja};try {const id=itemId(row.id_loja);if(!snapshots.has(id))snapshots.set(id,await snapshot(api,id,op.seller));const {price}=snapshots.get(id);await savePrice(pool,row,price);result={...result,status:'Atualizado',bruto:price.gross,liquido:price.amount,beneficio:price.benefit?.amount,beneficioStatus:price.benefit?.estimated?'Estimado pela API':price.benefit?.status,motivo:price.benefit?.reason || null};if(price.benefit?.status==='pending'){errors++;result.motivo=price.benefit.reason || 'Benefício da promoção vigente pendente de identificação.';}
    }catch(e){errors++;result={...result,status:'Pendente',motivo:e.message};}await appendResult(pool,op.id,result);}
    await pool.query('UPDATE ml_operacoes SET status=$2,atualizado_em=NOW() WHERE id=$1',[op.id,errors?'parcial':'concluida']);
  }catch(e){await appendResult(pool,op.id,{status:'Falhou',motivo:e.message});await pool.query("UPDATE ml_operacoes SET status='falhou',atualizado_em=NOW() WHERE id=$1",[op.id]);}
}
async function startSync(pool,user,filter='') {
  filter=syncSelectors(filter).join(', ');
  const client=await pool.connect();
  try{await client.query('BEGIN');await client.query('SELECT id FROM ml_integracao WHERE id=1 FOR UPDATE');
    if((await client.query("SELECT id FROM ml_operacoes WHERE status='executando' LIMIT 1")).rows.length)throw new Error('Já existe uma operação em andamento. Consulte o resultado antes de iniciar outra.');
    const op=await operation(client,'consulta',user,{filter},'executando');await client.query('COMMIT');setImmediate(()=>runLocked(pool,op,()=>runSync(pool,op)).catch(()=>{}));return op.id;
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
module.exports={syncSelectors,syncRows,ROOT,config,missingConfig,crypt,ensureTables,tokenRequest,connect,accessToken,MeliClient,itemId,assertOwned,standardPrice,activeBenefit,snapshot,readPrice,state,savePrice,operation,beginOperation,appendResult,startSync,runLocked,recoverInterrupted};
