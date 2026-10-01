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
    if (!/^\/(produtos(?:\/\d+)?|estoques\/saldos|depositos)$/.test(path)) throw new Error('Consulta Bling não permitida.');
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
    pool.query('SELECT configuracao, depositos, conectado_em, ultima_sincronizacao, refresh_token IS NOT NULL AS conectado FROM bling_integracao WHERE id=1'),
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
  await pool.query('UPDATE bling_integracao SET configuracao=$1::jsonb WHERE id=1', [JSON.stringify({ matriz: String(input.matriz), full })]);
}
async function loadDeposits(pool) {
  const deposits = await new BlingClient(pool).all('/depositos', { situacao: 1 });
  await pool.query('UPDATE bling_integracao SET depositos=$1::jsonb WHERE id=1', [JSON.stringify(deposits)]);
}
async function startSync(pool) {
  await ensureTables(pool);
  const settings = (await pool.query('SELECT configuracao, refresh_token IS NOT NULL AS conectado FROM bling_integracao WHERE id=1')).rows[0];
  if (!settings?.conectado) throw new Error('Conecte sua conta Bling.');
  if (!settings.configuracao.matriz) throw new Error('Configure os depósitos antes de atualizar.');
  const client = await pool.connect();
  let locked = false;
  try {
    locked = (await client.query("SELECT pg_try_advisory_lock(hashtext('bling-sincronizacao')) AS locked")).rows[0].locked;
    if (!locked) throw new Error('Uma atualização do Bling já está em andamento.');
    await client.query("UPDATE bling_sincronizacoes SET status='interrompida', mensagem='A execução anterior foi interrompida. Os dados já atualizados foram preservados.', finalizado_em=NOW() WHERE status='executando'");
    const job = (await client.query("INSERT INTO bling_sincronizacoes(status,etapa) VALUES('executando','Consultando produtos') RETURNING id")).rows[0];
    // All progress is persisted; the HTTP response can return while the work continues.
    runSync(pool, client, job.id, settings.configuracao).catch(() => {}).finally(async () => {
      try { await client.query("SELECT pg_advisory_unlock(hashtext('bling-sincronizacao'))"); } finally { client.release(); }
    });
    return job.id;
  } catch (error) {
    if (locked) await client.query("SELECT pg_advisory_unlock(hashtext('bling-sincronizacao'))");
    client.release(); throw error;
  }
}
async function runSync(pool, client, id, settings, api = new BlingClient(pool)) {
  let processed = 0, failures = 0;
  const issues = [];
  const progress = async (stage, total = null) => client.query(`UPDATE bling_sincronizacoes SET etapa=$2,processados=$3,falhas=$4,total=COALESCE($5,total),atualizado_em=NOW() WHERE id=$1`, [id, stage, processed, failures, total]);
  try {
    const products = await api.all('/produtos');
    const seen = new Set();
    for (const item of products) {
      const sku = String(item.codigo || '').trim().toUpperCase();
      if (sku && seen.has(sku)) throw new Error(`Mais de um produto do Bling usa o SKU ${sku}. Revise o cadastro antes de sincronizar.`);
      if (sku) seen.add(sku);
    }
    await progress('Atualizando cadastro (custos preservados)', products.length);
    const valid = [];
    for (const item of products) {
      try {
        const p = normalizedProduct(await api.get('/produtos/' + item.id));
        const existing = (await client.query('SELECT sku,bling_id FROM tabela_preco_produtos WHERE UPPER(sku)=UPPER($1)', [p.sku])).rows;
        if (existing.length > 1 || (existing[0]?.bling_id && existing[0].bling_id !== p.id)) throw new Error('Identificação do produto divergente.');
        p.sku = existing[0]?.sku || p.sku;
        await client.query(`INSERT INTO tabela_preco_produtos(sku,bling_id,nome,marca,situacao,peso,peso_bruto,preco_bling,ean,status_validacao,bling_atualizado_em)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'Novo',NOW()) ON CONFLICT(sku) DO UPDATE SET
          bling_id=EXCLUDED.bling_id,nome=EXCLUDED.nome,marca=EXCLUDED.marca,situacao=EXCLUDED.situacao,
          peso=COALESCE(EXCLUDED.peso,tabela_preco_produtos.peso),peso_bruto=COALESCE(EXCLUDED.peso_bruto,tabela_preco_produtos.peso_bruto),
          preco_bling=COALESCE(EXCLUDED.preco_bling,tabela_preco_produtos.preco_bling),ean=EXCLUDED.ean,bling_atualizado_em=NOW()`,
        [p.sku,p.id,p.name,p.brand,p.status,p.weight,p.grossWeight,p.price,p.ean]);
        valid.push(p);
      } catch (error) {
        if (/autorização|permissão|indisponível|limitou/.test(error.message)) throw error;
        failures++; issues.push(String(item.codigo || item.id)+': '+error.message);
      }
      processed++;
      await progress('Atualizando cadastro (custos preservados)');
    }
    await progress('Atualizando saldos por depósito');
    const stockIssues = [];
    for (let i=0; i<valid.length; i+=100) {
      const batch = valid.slice(i,i+100);
      const stocks = await api.get('/estoques/saldos', { 'idsProdutos[]': batch.map(p => p.id) });
      if (!Array.isArray(stocks)) throw new Error('Saldos inválidos retornados pelo Bling.');
      const map = new Map(stocks.map(s => [String(s.produto?.id), s]));
      for (const p of batch) {
        const stock = map.get(p.id);
        if (!stock) { failures++; stockIssues.push(p.sku); continue; }
        const balance = balancesByMarketplace(stock, settings, '');
        const missingFull = Object.values(settings.full || {}).some(depositId => !(stock.depositos || []).some(d => String(d.id) === depositId && Number.isFinite(Number(d.saldoFisico)) && d.saldoFisico != null));
        if (balance.matrix == null || missingFull) { failures++; stockIssues.push(p.sku); continue; }
        const full = Object.fromEntries(Object.keys(settings.full || {}).map(channel => [channel, balancesByMarketplace(stock,settings,channel).full]));
        await client.query(`UPDATE tabela_preco_produtos SET estoque=$2,estoque_matriz=$2,estoque_full=$3::jsonb,
          estoque_bling_em=NOW() WHERE sku=$1`, [p.sku,balance.matrix,JSON.stringify(full)]);
      }
      await progress('Atualizando saldos por depósito');
    }
    await client.query('UPDATE bling_integracao SET ultima_sincronizacao=NOW() WHERE id=1');
    await client.query(`UPDATE bling_sincronizacoes SET status=$2,etapa='Concluído',falhas=$3,mensagem=$4,finalizado_em=NOW(),atualizado_em=NOW() WHERE id=$1`,
    [id,failures?'parcial':'concluida',failures, `${valid.length} produtos consultados. ${issues.slice(0,10).join('; ')}. Custos e preços dos vínculos preservados. ${failures} pendência(s).${stockIssues.length ? ' Saldos não atualizados: '+stockIssues.slice(0,20).join(', ') : ''}`]);
  } catch(error) {
    await client.query("UPDATE bling_sincronizacoes SET status='falhou', mensagem=$2,finalizado_em=NOW(),atualizado_em=NOW() WHERE id=$1", [id,error.message]);
  }
}
module.exports = { ensureTables, state, connect, loadDeposits, saveSettings, startSync, config, normalizedProduct, balancesByMarketplace, encrypt, decrypt, BlingClient, runSync };
