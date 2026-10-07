const crypto = require('crypto');
const pricing = require('../tabela-precos/service');
const API = 'https://api.bling.com.br/Api/v3';
const OAUTH = 'https://www.bling.com.br/Api/v3/oauth';
const CALLBACK = '/ferramentas-ia/tabela-precos/bling/callback';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function config() {
  return {
    clientId: process.env.BLING_CLIENT_ID || '', clientSecret: process.env.BLING_CLIENT_SECRET || '',
    key: process.env.BLING_TOKEN_ENCRYPTION_KEY || '',
    callback: (process.env.APP_BASE_URL || 'https://app.plennatecsistemas.com.br').replace(/\/$/, '') + CALLBACK
  };
}
function missingConfig() {
  const c = config();
  return [['BLING_CLIENT_ID', c.clientId], ['BLING_CLIENT_SECRET', c.clientSecret], ['BLING_TOKEN_ENCRYPTION_KEY', c.key]].filter(([name, value]) => !value || (name === 'BLING_TOKEN_ENCRYPTION_KEY' && value.length < 32)).map(([name]) => name);
}
function tokenKey() {
  if (!config().key || config().key.length < 32) throw new Error('Configure BLING_TOKEN_ENCRYPTION_KEY com pelo menos 32 caracteres.');
  return crypto.createHash('sha256').update(config().key).digest();
}
function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', tokenKey(), iv);
  const body = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map(v => v.toString('base64')).join(':');
}
function decrypt(value) {
  const [iv, tag, body] = String(value).split(':').map(v => Buffer.from(v, 'base64'));
  const cipher = crypto.createDecipheriv('aes-256-gcm', tokenKey(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(body), cipher.final()]).toString('utf8');
}
async function ensureTables(pool) {
  await pricing.ensureTables(pool);
  await pool.query(`ALTER TABLE tabela_preco_produtos ADD COLUMN IF NOT EXISTS custo_bling_em TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS custo_bling_fornecedor_id TEXT, ADD COLUMN IF NOT EXISTS custo_origem TEXT`);
  await pool.query(`CREATE TABLE IF NOT EXISTS bling_integracao (
    id INTEGER PRIMARY KEY CHECK (id = 1), access_token TEXT, refresh_token TEXT, expira_em TIMESTAMPTZ,
    conectado_em TIMESTAMPTZ, configuracao JSONB NOT NULL DEFAULT '{}', depositos JSONB NOT NULL DEFAULT '[]',
    ultima_sincronizacao TIMESTAMPTZ
  ); INSERT INTO bling_integracao(id) VALUES(1) ON CONFLICT DO NOTHING;
  CREATE TABLE IF NOT EXISTS bling_sincronizacoes (
    id BIGSERIAL PRIMARY KEY, status TEXT NOT NULL, etapa TEXT, processados INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0, falhas INTEGER NOT NULL DEFAULT 0, mensagem TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), finalizado_em TIMESTAMPTZ
  )`);
  await pool.query(`ALTER TABLE bling_sincronizacoes ADD COLUMN IF NOT EXISTS divergencias JSONB, ADD COLUMN IF NOT EXISTS diagnostico JSONB`);
  await pool.query(`ALTER TABLE bling_integracao ADD COLUMN IF NOT EXISTS lojas JSONB NOT NULL DEFAULT '[]'`);
}
async function requestToken(params) {
  const c = config();
  const response = await fetch(OAUTH + '/token', {
    method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(c.clientId + ':' + c.clientSecret).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded', 'enable-jwt': '1' },
    body: new URLSearchParams(params), signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error('Não foi possível autorizar o Bling. Confira as credenciais ou conecte novamente.');
  const token = await response.json();
  if (!token.access_token || !token.refresh_token || !(Number(token.expires_in) > 0)) throw new Error('O Bling retornou uma autorização incompleta.');
  return token;
}
async function storeToken(client, token) {
  await client.query(`UPDATE bling_integracao SET access_token=$1, refresh_token=$2,
    expira_em=NOW()+($3::int * INTERVAL '1 second'), conectado_em=COALESCE(conectado_em,NOW()) WHERE id=1`,
  [encrypt(token.access_token), encrypt(token.refresh_token), Number(token.expires_in)]);
}
async function connect(pool, code) {
  if (missingConfig().length) throw new Error('Configure as credenciais do Bling no Render.');
  await storeToken(pool, await requestToken({ grant_type: 'authorization_code', code }));
}
async function accessToken(pool) {
  // A single database lock serializes refreshes across processes and requests.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const row = (await client.query('SELECT * FROM bling_integracao WHERE id=1 FOR UPDATE')).rows[0];
    if (!row?.refresh_token) throw new Error('Conecte sua conta Bling antes de atualizar.');
    let value;
    if (row.access_token && new Date(row.expira_em).getTime() > Date.now() + 60000) value = decrypt(row.access_token);
    else {
      const token = await requestToken({ grant_type: 'refresh_token', refresh_token: decrypt(row.refresh_token) });
      await storeToken(client, token);
      value = token.access_token;
    }
    await client.query('COMMIT');
    return value;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
class BlingClient {
  constructor(pool, transport = fetch, sleep = delay) { this.pool = pool; this.transport = transport; this.sleep = sleep; this.lastRequest = 0; }
  async get(path, params = {}) {
    if (!/^\/(produtos(?:\/\d+|\/fornecedores|\/lojas)?|anuncios(?:\/\d+)?|canais-venda|estoques\/saldos|depositos)$/.test(path)) throw new Error('Consulta Bling não permitida.');
    const url = new URL(API + path);
    for (const [key, value] of Object.entries(params)) {
      for (const item of Array.isArray(value) ? value : [value]) url.searchParams.append(key, item);
    }
    for (let attempt = 0; attempt < 4; attempt++) {
      await this.sleep(Math.max(0, 400 - (Date.now() - this.lastRequest)));
      const token = await accessToken(this.pool);
      this.lastRequest = Date.now();
      const response = await this.transport(url, { headers: { Authorization: 'Bearer ' + token, 'enable-jwt': '1' }, signal: AbortSignal.timeout(30000) });
      if (response.status === 429 || response.status >= 500) {
        if (attempt === 3) throw new Error('O Bling está indisponível ou limitou as consultas. Tente novamente em alguns minutos.');
        await this.sleep(Math.min(30000, Math.max(1000 * 2 ** attempt, Number(response.headers.get('retry-after')) * 1000 || 0)));
        continue;
      }
      if (response.status === 401) throw new Error('A autorização do Bling expirou. Conecte novamente.');
      if (response.status === 403) throw new Error('O aplicativo Bling não tem permissão para esta consulta. Confira os escopos.');
      if (!response.ok) throw new Error(`Consulta ao Bling falhou (HTTP ${response.status}). Os dados anteriores foram preservados.`);
      const body = await response.json();
      if (!('data' in body)) throw new Error('Resposta incompleta do Bling.');
      return body.data;
    }
  }
  async all(path, params = {}) {
    const result = [];
    for (let page = 1; page <= 1000; page++) {
      const rows = await this.get(path, { ...params, pagina: page, limite: 100 });
      if (!Array.isArray(rows)) throw new Error('Lista inválida retornada pelo Bling.');
      result.push(...rows);
      if (rows.length < 100) return result;
    }
    throw new Error('A consulta excedeu o limite de páginas.');
  }
}
function normalizedProduct(product) {
  const sku = String(product.codigo || '').trim();
  if (!sku || !product.id || !product.nome) throw new Error('Produto sem SKU, identificação ou descrição.');
  const number = value => value !== null && value !== '' && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  return { sku, id: String(product.id), name: product.nome, brand: product.marca || '', status: product.situacao || '',
    weight: number(product.pesoLiquido), grossWeight: number(product.pesoBruto), price: number(product.preco), ean: product.gtin || '' };
}
function defaultSupplierCost(rows) {
  const defaults = rows.filter(row => row.padrao === true);
  if (defaults.length !== 1) throw new Error(defaults.length ? 'Mais de um fornecedor padrão. Custo anterior preservado.' : 'Fornecedor padrão não encontrado. Custo anterior preservado.');
  const supplier = defaults[0];
  const value = supplier.precoCusto;
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) <= 0) throw new Error('Preço de custo do fornecedor padrão inválido. Custo anterior preservado.');
  return { cost: Number(value), supplierId: String(supplier.id || '') };
}
function balancesByMarketplace(stock, settings, marketplace) {
  const deposits = new Map((stock?.depositos || []).map(d => [String(d.id), d]));
  const balance = id => {
    const value = deposits.get(String(id))?.saldoFisico;
    return value !== undefined && value !== null && Number.isFinite(Number(value)) ? Number(value) : null;
  };
  return { matrix: settings.matriz ? balance(settings.matriz) : null,
    full: settings.full?.[marketplace] ? balance(settings.full[marketplace]) : 0 };
}
async function state(pool) {
  const client = await pool.connect();
  try {
    const locked = (await client.query("SELECT pg_try_advisory_lock(hashtext('bling-sincronizacao')) AS locked")).rows[0]?.locked;
    if (locked) {
      try { await client.query("UPDATE bling_sincronizacoes SET status='interrompida',mensagem='A atualização foi interrompida. Os dados anteriores foram preservados. Inicie novamente.',finalizado_em=NOW() WHERE status='executando'"); }
      finally { await client.query("SELECT pg_advisory_unlock(hashtext('bling-sincronizacao'))"); }
    }
  } finally { client.release(); }
  const [result, jobs, rules] = await Promise.all([
    pool.query('SELECT configuracao, depositos, lojas, conectado_em, ultima_sincronizacao, refresh_token IS NOT NULL AS conectado FROM bling_integracao WHERE id=1'),
    pool.query('SELECT * FROM bling_sincronizacoes ORDER BY id DESC LIMIT 5'),
    pool.query("SELECT marketplace FROM tabela_preco_regras WHERE marketplace <> 'Bling' ORDER BY marketplace")
  ]);
  return { ...result.rows[0], jobs: jobs.rows, marketplaces: rules.rows.map(r => r.marketplace), missing: missingConfig(), callback: config().callback };
}
async function saveSettings(pool, input) {
  const row = (await pool.query('SELECT depositos FROM bling_integracao WHERE id=1')).rows[0];
  const available = new Set((row?.depositos || []).map(d => String(d.id)));
  if (!input.matriz || !available.has(String(input.matriz))) throw new Error('Selecione o depósito da Matriz.');
  const full = {};
  for (const [marketplace, id] of Object.entries(input.full || {})) {
    if (!id) continue;
    if (!available.has(String(id)) || String(id) === String(input.matriz)) throw new Error('Selecione um depósito Full diferente da Matriz.');
    full[marketplace] = String(id);
  }
  await pool.query('UPDATE bling_integracao SET configuracao=$1::jsonb WHERE id=1', [JSON.stringify({ ...((await pool.query('SELECT configuracao FROM bling_integracao WHERE id=1')).rows[0]?.configuracao || {}), matriz: String(input.matriz), full })]);
}
async function loadDeposits(pool) {
  const deposits = await new BlingClient(pool).all('/depositos', { situacao: 1 });
  await pool.query('UPDATE bling_integracao SET depositos=$1::jsonb WHERE id=1', [JSON.stringify(deposits)]);
}
async function loadStores(pool) {
  const stores = await new BlingClient(pool).all('/canais-venda');
  await pool.query('UPDATE bling_integracao SET lojas=$1::jsonb WHERE id=1', [JSON.stringify(stores)]);
}
async function saveStores(pool, stores) {
  const model = (await pool.query('SELECT lojas,configuracao FROM bling_integracao WHERE id=1')).rows[0];
  const available = new Set((model.lojas || []).map(row => String(row.id)));
  const used = new Set();
  for (const value of Object.values(stores)) {
    if (!available.has(value) || used.has(value)) throw new Error('Escolha uma loja válida e diferente para cada marketplace.');
    used.add(value);
  }
  await pool.query('UPDATE bling_integracao SET configuracao=$1::jsonb WHERE id=1', [JSON.stringify({...model.configuracao,lojas:stores})]);
}
function grossLink(row, product, storeId, isAd = false) {
  const code = String(isAd ? row.anuncioLoja?.id || '' : row.codigo || '').trim();
  const price = isAd ? row.preco?.valor : row.preco;
  if (!code || /^0+$/.test(code) || (typeof price !== 'number' && typeof price !== 'string') || String(price).trim()==='' || !Number.isFinite(Number(price)) || Number(price)<=0) throw new Error('Anúncio sem identificação ou preço bruto válido.');
  if (String(row.produto?.id)!==product.id) throw new Error('Produto do vínculo divergente.');
  return {sku:product.sku,product_id:product.id,store_id:code,name:product.name,current_price:Number(price),raw:{bling_loja_id:String(storeId),bling_vinculo_id:String(row.id || ''),bruto_origem:'Bling',bruto_bling_em:new Date().toISOString()}};
}
async function saveGrossLinks(pool, marketplace, links) {
  if (!links.length) return 0;
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`tabela-precos-vinculos:${marketplace}`]);
    const existing = (await db.query('SELECT id,id_loja,id_produto,sku FROM tabela_preco_vinculos WHERE marketplace=$1 FOR UPDATE',[marketplace])).rows;
    const plan = pricing.planLinkImport(existing,links);
    for (const row of plan.updates) {
      const target = existing.find(item=>item.id===row.id);
      if (target.sku.toUpperCase()!==row.sku.toUpperCase() || (target.id_produto && String(target.id_produto)!==row.product_id)) throw new Error('Vínculo '+row.store_id+' pertence a outro produto. Dados preservados.');
      await db.query(`UPDATE tabela_preco_vinculos SET preco_atual=$2,id_produto=$3,id_loja=$4,
        dados=dados || $5::jsonb,importado_em=NOW() WHERE id=$1`,[row.id,row.current_price,row.product_id,row.store_id,JSON.stringify(row.raw)]);
    }
    for (const row of plan.inserts) await db.query(`INSERT INTO tabela_preco_vinculos(marketplace,sku,id_produto,id_loja,nome,preco_atual,dados)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,[marketplace,row.sku,row.product_id,row.store_id,row.name,row.current_price,JSON.stringify(row.raw)]);
    await db.query('COMMIT');
    return links.length;
  } catch(error) { await db.query('ROLLBACK');throw error; }
  finally { db.release(); }
}
async function startSync(pool, filter='', module='all', marketplaces=null) {
  const selectedSkus = require('./mercado-livre').syncSelectors(filter);
  await ensureTables(pool);
  const settings = (await pool.query('SELECT configuracao, refresh_token IS NOT NULL AS conectado FROM bling_integracao WHERE id=1')).rows[0];
  if (!settings?.conectado) throw new Error('Conecte sua conta Bling.');
  if (module !== 'links' && !settings.configuracao.matriz) throw new Error('Configure os depósitos antes de atualizar.');
  const client = await pool.connect();
  let locked = false;
  try {
    locked = (await client.query("SELECT pg_try_advisory_lock(hashtext('bling-sincronizacao')) AS locked")).rows[0].locked;
    if (!locked) throw new Error('Uma atualização do Bling já está em andamento.');
    await client.query("UPDATE bling_sincronizacoes SET status='interrompida', mensagem='A execução anterior foi interrompida. Os dados já atualizados foram preservados.', finalizado_em=NOW() WHERE status='executando'");
    const job = (await client.query("INSERT INTO bling_sincronizacoes(status,etapa) VALUES('executando','Consultando produtos') RETURNING id")).rows[0];
    // All progress is persisted; the HTTP response can return while the work continues.
    runSync(pool, client, job.id, {...settings.configuracao, selectedSkus, module, marketplaces}).catch(() => {}).finally(async () => {
      try { await client.query("SELECT pg_advisory_unlock(hashtext('bling-sincronizacao'))"); } finally { client.release(); }
    }).catch(() => {});
    return job.id;
  } catch (error) {
    if (locked) await client.query("SELECT pg_advisory_unlock(hashtext('bling-sincronizacao'))");
    client.release(); throw error;
  }
}
async function runSync(pool, client, id, settings, api = new BlingClient(pool)) {
  let processed = 0, failures = 0, costsUpdated = 0, grossUpdated = 0;
  const issues = [], divergences = [], diagnostic = [];
  const productsForReport = new Map();
  const record = (module, status, product={}, detail='') => diagnostic.push({modulo:module,status,sku:product.sku || product.codigo || '',produto_id:String(product.id || ''),nome:product.name || product.nome || '',anuncio_id:String(product.store_id || product.anuncio_id || ''),detalhe:detail});

  const issue = (stage, marketplace, sku, productId, adId, reason) => {
    issues.push([marketplace, sku || productId, reason].filter(Boolean).join(': '));
    const product = productsForReport.get(String(productId)) || {};
    record(stage==='Preços brutos' && marketplace ? 'Vínculos: '+marketplace : stage,'pendente',{...product,sku:sku || product.sku,id:productId,anuncio_id:adId},reason);
    divergences.push({etapa:stage, marketplace:marketplace || '', sku:sku || '', produto_id:String(productId || ''), anuncio_id:String(adId || ''), motivo:reason, acao:'Dados anteriores preservados'});
  };
  const persistIssues = () => client.query('UPDATE bling_sincronizacoes SET divergencias=$2::jsonb,diagnostico=$3::jsonb WHERE id=$1',[id,JSON.stringify(divergences),JSON.stringify(diagnostic)]);
  const progress = async (stage, total = null) => client.query(`UPDATE bling_sincronizacoes SET etapa=$2,processados=$3,falhas=$4,total=COALESCE($5,total),atualizado_em=NOW() WHERE id=$1`, [id, stage, processed, failures, total]);
  try {
    const selected = new Set(settings.selectedSkus || []);
    const allProducts = await api.all('/produtos', {criterio:2});
    // Only positively identified inactive/deleted IDs are removed, never absent IDs.
    const inactive = [...await api.all('/produtos',{criterio:3}), ...await api.all('/produtos',{criterio:4})];
    const activeIds = new Set(allProducts.map(p=>String(p.id)));
    const inactiveIds = [...new Set(inactive.filter(p=>!activeIds.has(String(p.id)) && /^\d+$/.test(String(p.id))).map(p=>String(p.id)))];
    const activeSkus = new Set(allProducts.map(p=>String(p.codigo || '').trim().toUpperCase()));
    const inactiveSkus = inactive.filter(p=>inactiveIds.includes(String(p.id)) && p.codigo && !activeSkus.has(String(p.codigo).trim().toUpperCase())).map(p=>String(p.codigo).trim().toUpperCase());
    if (inactiveIds.length) {
      await client.query('BEGIN');
      try {
        const removed = await client.query("DELETE FROM tabela_preco_produtos WHERE bling_id = ANY($1::text[]) OR (NULLIF(bling_id,'') IS NULL AND UPPER(sku) = ANY($2::text[])) RETURNING sku,bling_id", [inactiveIds,inactiveSkus]);
        if (removed.rows.length) await client.query('DELETE FROM tabela_preco_vinculos WHERE sku = ANY($1::text[])', [removed.rows.map(p=>p.sku)]);
        await client.query('COMMIT');
        for(const p of removed.rows) {record('Limpeza','verificado',{sku:p.sku,id:p.bling_id});record('Limpeza','atualizado',{sku:p.sku,id:p.bling_id},'Produto inativo/excluído e vínculos removidos do Plennatec');}
      } catch(error) {await client.query('ROLLBACK');throw error;}
    }
    const updateData = settings.module !== 'links';
    const updateLinks = settings.module !== 'data';
    const products = selected.size ? allProducts.filter(p=>selected.has(String(p.codigo || '').trim().toUpperCase())) : allProducts;
    for(const sku of selected) {if(!products.some(p=>String(p.codigo || '').trim().toUpperCase()===sku) && !inactiveSkus.includes(sku)){failures++;issue('Cadastro','',sku,'','','SKU não encontrado no Bling.');}}
    const seen = new Set();
    for (const item of products) {
      const sku = String(item.codigo || '').trim().toUpperCase();
      if (sku && seen.has(sku)) throw new Error(`Mais de um produto do Bling usa o SKU ${sku}. Revise o cadastro antes de sincronizar.`);
      if (sku) seen.add(sku);
    }
    await progress(updateData ? 'Atualizando cadastro' : 'Preparando vínculos dos produtos ativos', products.length);
    const valid = [];
    for (const item of products) {
      try {
        if (!updateData) {
          const stored = (await client.query('SELECT sku,nome,bling_id FROM tabela_preco_produtos WHERE bling_id=$1', [String(item.id)])).rows[0];
          valid.push({sku:stored?.sku || String(item.codigo || '').trim(),id:String(item.id),name:stored?.nome || item.nome || ''});
          processed++;
          continue;
        }
        record('Cadastro','verificado',item);
        const p = normalizedProduct(await api.get('/produtos/' + item.id));
        const existing = (await client.query('SELECT sku,bling_id FROM tabela_preco_produtos WHERE UPPER(sku)=UPPER($1)', [p.sku])).rows;
        if (existing.length > 1 || (existing[0]?.bling_id && existing[0].bling_id !== p.id)) throw new Error('Identificação do produto divergente.');
        p.isNew = existing.length === 0;
        p.sku = existing[0]?.sku || p.sku;
        await client.query(`INSERT INTO tabela_preco_produtos(sku,bling_id,nome,marca,situacao,peso,peso_bruto,preco_bling,ean,status_validacao,bling_atualizado_em)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'Novo',NOW()) ON CONFLICT(sku) DO UPDATE SET
          bling_id=EXCLUDED.bling_id,nome=EXCLUDED.nome,marca=EXCLUDED.marca,situacao=EXCLUDED.situacao,
          peso=COALESCE(EXCLUDED.peso,tabela_preco_produtos.peso),peso_bruto=COALESCE(EXCLUDED.peso_bruto,tabela_preco_produtos.peso_bruto),
          preco_bling=COALESCE(EXCLUDED.preco_bling,tabela_preco_produtos.preco_bling),ean=EXCLUDED.ean,bling_atualizado_em=NOW()`,
        [p.sku,p.id,p.name,p.brand,p.status,p.weight,p.grossWeight,p.price,p.ean]);
        valid.push(p);
        record('Cadastro','atualizado',p);
      } catch (error) {
        if (/autorização|permissão|indisponível|limitou/.test(error.message)) throw error;
        failures++; issue('Cadastro','',item.codigo,item.id,'',error.message);
      }
      processed++;
      await progress('Atualizando cadastro');
    }
    const stockIssues = [];
    if (updateData) {
    await progress('Consultando custos dos fornecedores padrão');
    let suppliers;
    try { suppliers = await api.all('/produtos/fornecedores'); }
    catch (error) { failures++; issue('Custos','','','','',error.message); }
    if (suppliers) {
      const byProduct = new Map();
      for (const supplier of suppliers) {
        const key = String(supplier.produto?.id || '');
        if (!byProduct.has(key)) byProduct.set(key, []);
        byProduct.get(key).push(supplier);
      }
      for (const p of valid) {
        record('Custos','verificado',p);
        try {
          const cost = defaultSupplierCost(byProduct.get(p.id) || []);
          await client.query(`UPDATE tabela_preco_produtos SET custo=$2,custo_origem='Bling: fornecedor padrão',
            status_validacao=CASE WHEN NOT $4::boolean AND custo IS DISTINCT FROM $2::numeric THEN 'Reajustar' ELSE status_validacao END,
            custo_bling_fornecedor_id=$3,custo_bling_em=NOW() WHERE sku=$1`, [p.sku,cost.cost,cost.supplierId,p.isNew]);
          costsUpdated++;
          record('Custos','atualizado',p);
        } catch (error) { failures++; issue('Custos','',p.sku,p.id,'',error.message); }
      }
    }
    await progress('Atualizando saldos por depósito');
    for (let i=0; i<valid.length; i+=100) {
      const batch = valid.slice(i,i+100);
      const stocks = await api.get('/estoques/saldos', { 'idsProdutos[]': batch.map(p => p.id) });
      if (!Array.isArray(stocks)) throw new Error('Saldos inválidos retornados pelo Bling.');
      const map = new Map(stocks.map(s => [String(s.produto?.id), s]));
      for (const p of batch) {
        record('Estoque','verificado',p);
        const stock = map.get(p.id);
        if (!stock) { failures++; stockIssues.push(p.sku); issue('Estoque','',p.sku,p.id,'','Saldo ausente ou inválido para os depósitos configurados.'); continue; }
        const balance = balancesByMarketplace(stock, settings, '');
        const missingFull = Object.values(settings.full || {}).some(depositId => !(stock.depositos || []).some(d => String(d.id) === depositId && Number.isFinite(Number(d.saldoFisico)) && d.saldoFisico != null));
        if (balance.matrix == null || missingFull) { failures++; stockIssues.push(p.sku); issue('Estoque','',p.sku,p.id,'','Saldo ausente ou inválido para os depósitos configurados.'); continue; }
        const full = Object.fromEntries(Object.keys(settings.full || {}).map(channel => [channel, balancesByMarketplace(stock,settings,channel).full]));
        await client.query(`UPDATE tabela_preco_produtos SET estoque=$2,estoque_matriz=$2,estoque_full=$3::jsonb,
          estoque_bling_em=NOW() WHERE sku=$1`, [p.sku,balance.matrix,JSON.stringify(full)]);
        record('Estoque','atualizado',p);
      }
      await progress('Atualizando saldos por depósito');
    }
    }
    const productsById = new Map(valid.map(p=>[p.id,p]));
    for (const p of valid) productsForReport.set(p.id,p);
    for (const [marketplace,storeId] of Object.entries(updateLinks ? settings.lojas || {} : {})) {
      if (Array.isArray(settings.marketplaces) && !settings.marketplaces.includes(marketplace)) continue;
      await persistIssues();
      await progress('Consultando preços brutos: '+marketplace);
      try {
        const isML = marketplace === 'Mercado Livre';
        const rows = await api.all(isML ? '/anuncios' : '/produtos/lojas', isML ? {idLoja:storeId,tipoIntegracao:'MercadoLivre',situacao:1} : {idLoja:storeId});
        const links = [];
        for (const source of rows) {
          if(source.produto?.id && !activeIds.has(String(source.produto.id))) continue;
          if(selected.size && source.produto?.id && !productsById.has(String(source.produto.id))) continue;
          const row = isML ? await api.get('/anuncios/'+source.id,{idLoja:storeId,tipoIntegracao:'MercadoLivre'}) : source;
          if (!isML && String(row.loja?.id)!==String(storeId)) throw new Error('Loja do vínculo divergente.');
          if (row.produto?.id && !activeIds.has(String(row.produto.id))) continue;
          const product = productsById.get(String(row.produto?.id));
          if (!product && selected.size) continue;
          if (!product) { failures++;issue('Preços brutos',marketplace,'',row.produto?.id,isML?row.anuncioLoja?.id:row.codigo,'Produto não identificado na base consultada; vínculo preservado.');continue; }
          record('Vínculos: '+marketplace,'verificado',{...product,anuncio_id:isML?row.anuncioLoja?.id:row.codigo});
          try { links.push(grossLink(row,product,storeId,isML)); }
          catch(error) { failures++;issue('Preços brutos',marketplace,product.sku,product.id,isML?row.anuncioLoja?.id:row.codigo,error.message); }
        }
        const counts = new Map();
        for (const link of links) counts.set(link.store_id,(counts.get(link.store_id) || 0)+1);
        const unique = links.filter(link=>{
          if (counts.get(link.store_id)===1) return true;
          failures++;issue('Preços brutos',marketplace,link.sku,link.product_id,link.store_id,'Código de anúncio repetido nos vínculos retornados pelo Bling. Vínculo preservado.');return false;
        });
        try {
          grossUpdated += await saveGrossLinks(pool,marketplace,unique);
          for(const link of unique) record('Vínculos: '+marketplace,'atualizado',{sku:link.sku,id:link.product_id,name:link.name,store_id:link.store_id});
        } catch(error) {
          // A rejected batch is rolled back. Retry individually to identify the affected links.
          for(const link of unique) {
            try {grossUpdated += await saveGrossLinks(pool,marketplace,[link]);record('Vínculos: '+marketplace,'atualizado',{sku:link.sku,id:link.product_id,name:link.name,store_id:link.store_id});}
            catch(itemError) {failures++;issue('Preços brutos',marketplace,link.sku,link.product_id,link.store_id,itemError.message);}
          }
        }
      } catch(error) { failures++;issue('Preços brutos',marketplace,'','','',error.message); }
    }
    await persistIssues();
    await client.query('UPDATE bling_integracao SET ultima_sincronizacao=NOW() WHERE id=1');
    await client.query(`UPDATE bling_sincronizacoes SET status=$2,etapa='Concluído',falhas=$3,mensagem=$4,finalizado_em=NOW(),atualizado_em=NOW() WHERE id=$1`,
    [id,failures?'parcial':'concluida',failures, `${valid.length} produtos consultados. ${issues.slice(0,10).join('; ')}. ${costsUpdated} custos atualizados pelo fornecedor padrão. ${grossUpdated} preços brutos atualizados. Preços líquidos preservados.${Object.keys(settings.lojas || {}).length ? "" : " Configure as lojas para consultar preços brutos."} ${failures} pendência(s).${stockIssues.length ? ' Saldos não atualizados: '+stockIssues.slice(0,20).join(', ') : ''}`]);
  } catch(error) {
    issue('Execução','','','','',error.message);
    await persistIssues();
    await client.query("UPDATE bling_sincronizacoes SET status='falhou', mensagem=$2,finalizado_em=NOW(),atualizado_em=NOW() WHERE id=$1", [id,error.message]);
  }
}
module.exports = { ensureTables, state, connect, loadDeposits, loadStores, saveStores, grossLink, saveGrossLinks, saveSettings, startSync, config, normalizedProduct, defaultSupplierCost, balancesByMarketplace, encrypt, decrypt, BlingClient, runSync };
