const path = require('path');
const { spawn } = require('child_process');
const {
  DEFAULT_DYNAMIC_RULES,
  MARKETPLACE_RULES,
  calculateAtPrice,
  calculateMarketplace,
  standardizeEqualProducts
} = require('./pricing');

const CSV_HEADERS = [
  'IdProduto', 'ID na Loja', 'Nome', 'Código', 'Preco',
  'Preco Promocional', 'ID do Fornecedor', 'ID da Marca',
  'Link Externo', 'Nome Loja (Multilojas)'
];

function pythonCommand() {
  return process.env.CODIFICADOR_PYTHON || 'python3';
}

function runParser(command, file) {
  const cli = path.join(__dirname, 'cli.py');
  const pythonPackages = path.join(__dirname, '..', '..', '.python-packages');
  return new Promise((resolve, reject) => {
    const child = spawn(pythonCommand(), [cli, command, '--file', file], {
      cwd: __dirname,
      env: {
        ...process.env,
        PYTHONPATH: [pythonPackages, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter)
      }
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), 120000);
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      clearTimeout(timer);
      let data;
      try { data = JSON.parse(stdout); } catch { data = null; }
      if (code !== 0 || !data) return reject(new Error(data?.error || stderr.trim() || 'Não foi possível ler o arquivo.'));
      resolve(data);
    });
  });
}

let tablesReady = null;

async function initializeTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tabela_preco_produtos (
      sku TEXT PRIMARY KEY,
      bling_id TEXT,
      nome TEXT NOT NULL,
      marca TEXT,
      situacao TEXT,
      estoque NUMERIC(15,4),
      custo NUMERIC(15,4),
      preco_compra NUMERIC(15,4),
      peso NUMERIC(15,4),
      peso_bruto NUMERIC(15,4),
      preco_bling NUMERIC(15,4),
      ean TEXT,
      importado_em TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tabela_preco_vinculos (
      id BIGSERIAL PRIMARY KEY,
      marketplace TEXT NOT NULL,
      id_produto TEXT,
      id_loja TEXT,
      sku TEXT NOT NULL,
      nome TEXT,
      preco_atual NUMERIC(15,4),
      preco_promocional NUMERIC(15,4),
      dados JSONB NOT NULL DEFAULT '{}'::jsonb,
      confirmado_em TIMESTAMP,
      confirmado_por TEXT,
      importado_em TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS tabela_preco_vinculos_marketplace_sku_idx ON tabela_preco_vinculos (marketplace, sku)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tabela_preco_regras (
      marketplace TEXT PRIMARY KEY,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      comissao NUMERIC(12,8) NOT NULL DEFAULT 0,
      imposto NUMERIC(12,8) NOT NULL DEFAULT 0,
      adm NUMERIC(12,8) NOT NULL DEFAULT 0,
      ads NUMERIC(12,8) NOT NULL DEFAULT 0,
      cartao NUMERIC(12,8) NOT NULL DEFAULT 0,
      frete_percentual NUMERIC(12,8) NOT NULL DEFAULT 0,
      taxa_fixa NUMERIC(15,4) NOT NULL DEFAULT 0,
      frete_fixo NUMERIC(15,4) NOT NULL DEFAULT 0,
      desconto NUMERIC(12,8) NOT NULL DEFAULT 0,
      margem_minima NUMERIC(12,8) NOT NULL DEFAULT 0,
      saldo_minimo NUMERIC(15,4) NOT NULL DEFAULT 0,
      atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tabela_preco_fretes (
      id BIGSERIAL PRIMARY KEY,
      marketplace TEXT NOT NULL,
      tipo TEXT NOT NULL,
      ordem INTEGER NOT NULL,
      faixa TEXT,
      peso_min NUMERIC(15,6),
      peso_max NUMERIC(15,6),
      preco_min NUMERIC(15,4),
      preco_max NUMERIC(15,4),
      valor NUMERIC(15,4) NOT NULL DEFAULT 0,
      comissao NUMERIC(12,8) NOT NULL DEFAULT 0,
      ads NUMERIC(12,8) NOT NULL DEFAULT 0,
      frete_percentual NUMERIC(12,8) NOT NULL DEFAULT 0,
      taxa_fixa NUMERIC(15,4) NOT NULL DEFAULT 0,
      atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (marketplace, tipo, ordem)
    )
  `);
  await pool.query(`
    INSERT INTO tabela_preco_regras
      (marketplace, comissao, imposto, adm, ads, cartao, frete_percentual, taxa_fixa, frete_fixo, desconto, margem_minima, saldo_minimo)
    SELECT marketplace, commission, tax, admin, ads, card, freight_percent, fixed_fee,
      fixed_freight, discount, min_margin, min_profit
    FROM jsonb_to_recordset($1::jsonb) AS item(
      marketplace TEXT, commission NUMERIC, tax NUMERIC, admin NUMERIC, ads NUMERIC,
      card NUMERIC, freight_percent NUMERIC, fixed_fee NUMERIC, fixed_freight NUMERIC,
      discount NUMERIC, min_margin NUMERIC, min_profit NUMERIC
    )
    ON CONFLICT (marketplace) DO NOTHING
  `, [JSON.stringify(MARKETPLACE_RULES.map(rule => ({
    marketplace: rule.marketplace,
    commission: rule.commission,
    tax: rule.tax,
    admin: rule.admin,
    ads: rule.ads,
    card: rule.card,
    freight_percent: rule.freightPercent,
    fixed_fee: rule.fixedFee,
    fixed_freight: rule.fixedFreight,
    discount: rule.discount,
    min_margin: rule.minMargin,
    min_profit: rule.minProfit
  })))]);
  const freightDefaults = DEFAULT_DYNAMIC_RULES.map((row, index) => ({
    marketplace: row.marketplace,
    type: row.type,
    order: index,
    label: row.label || '',
    weightMin: row.weightMin ?? null,
    weightMax: row.weightMax ?? null,
    priceMin: row.priceMin ?? null,
    priceMax: row.priceMax ?? null,
    value: row.value || 0,
    commission: row.commission || 0,
    ads: row.ads || 0,
    freightPercent: row.freightPercent || 0,
    fixedFee: row.fixedFee || 0
  }));
  await pool.query(`
    INSERT INTO tabela_preco_fretes
      (marketplace, tipo, ordem, faixa, peso_min, peso_max, preco_min, preco_max, valor, comissao, ads, frete_percentual, taxa_fixa)
    SELECT marketplace, type, sort_order, label, weight_min, weight_max, price_min, price_max,
      value, commission, ads, freight_percent, fixed_fee
    FROM jsonb_to_recordset($1::jsonb) AS item(
      marketplace TEXT, type TEXT, sort_order INTEGER, label TEXT,
      weight_min NUMERIC, weight_max NUMERIC, price_min NUMERIC, price_max NUMERIC,
      value NUMERIC, commission NUMERIC, ads NUMERIC, freight_percent NUMERIC, fixed_fee NUMERIC
    )
    ON CONFLICT (marketplace, tipo, ordem) DO NOTHING
  `, [JSON.stringify(freightDefaults.map(row => ({
    marketplace: row.marketplace,
    type: row.type,
    sort_order: row.order,
    label: row.label,
    weight_min: row.weightMin,
    weight_max: row.weightMax,
    price_min: row.priceMin,
    price_max: row.priceMax,
    value: row.value,
    commission: row.commission,
    ads: row.ads,
    freight_percent: row.freightPercent,
    fixed_fee: row.fixedFee
  })))]);
}

function ensureTables(pool) {
  if (!tablesReady) {
    tablesReady = initializeTables(pool).catch(error => {
      tablesReady = null;
      throw error;
    });
  }
  return tablesReady;
}

async function importProducts(pool, products) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM tabela_preco_produtos');
    await client.query(`
      INSERT INTO tabela_preco_produtos
        (sku, bling_id, nome, marca, situacao, estoque, custo, preco_compra, peso, peso_bruto, preco_bling, ean)
      SELECT sku, bling_id, name, brand, status, stock, cost, purchase_price, weight, gross_weight, bling_price, ean
      FROM jsonb_to_recordset($1::jsonb) AS item(
        sku TEXT, bling_id TEXT, name TEXT, brand TEXT, status TEXT, stock NUMERIC,
        cost NUMERIC, purchase_price NUMERIC, weight NUMERIC, gross_weight NUMERIC,
        bling_price NUMERIC, ean TEXT
      )
    `, [JSON.stringify(products)]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function importLinks(pool, marketplace, links) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM tabela_preco_vinculos WHERE marketplace = $1', [marketplace]);
    await client.query(`
      INSERT INTO tabela_preco_vinculos
        (marketplace, id_produto, id_loja, sku, nome, preco_atual, preco_promocional, dados)
      SELECT $1, product_id, store_id, sku, name, current_price, promotional_price, raw
      FROM jsonb_to_recordset($2::jsonb) AS item(
        product_id TEXT, store_id TEXT, sku TEXT, name TEXT,
        current_price NUMERIC, promotional_price NUMERIC, raw JSONB
      )
    `, [marketplace, JSON.stringify(links)]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function databaseRule(row) {
  return {
    marketplace: row.marketplace,
    commission: Number(row.comissao),
    tax: Number(row.imposto),
    admin: Number(row.adm),
    ads: Number(row.ads),
    card: Number(row.cartao),
    freightPercent: Number(row.frete_percentual),
    fixedFee: Number(row.taxa_fixa),
    fixedFreight: Number(row.frete_fixo),
    discount: Number(row.desconto),
    minMargin: Number(row.margem_minima),
    minProfit: Number(row.saldo_minimo)
  };
}

async function overview(pool) {
  const [products, links, rules] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total, MAX(importado_em) AS atualizado_em FROM tabela_preco_produtos`),
    pool.query(`SELECT marketplace, COUNT(*)::int AS total, COUNT(DISTINCT sku)::int AS skus, MAX(importado_em) AS atualizado_em FROM tabela_preco_vinculos GROUP BY marketplace ORDER BY marketplace`),
    pool.query(`SELECT * FROM tabela_preco_regras ORDER BY marketplace`)
  ]);
  return { products: products.rows[0], links: links.rows, rules: rules.rows };
}

function databaseDynamicRule(row) {
  return {
    id: row.id,
    marketplace: row.marketplace,
    type: row.tipo,
    order: Number(row.ordem),
    label: row.faixa || '',
    weightMin: row.peso_min == null ? null : Number(row.peso_min),
    weightMax: row.peso_max == null ? null : Number(row.peso_max),
    priceMin: row.preco_min == null ? null : Number(row.preco_min),
    priceMax: row.preco_max == null ? null : Number(row.preco_max),
    value: Number(row.valor),
    commission: Number(row.comissao),
    ads: Number(row.ads),
    freightPercent: Number(row.frete_percentual),
    fixedFee: Number(row.taxa_fixa)
  };
}

async function freightRules(pool) {
  const result = await pool.query(`SELECT * FROM tabela_preco_fretes ORDER BY marketplace, ordem`);
  return result.rows.map(databaseDynamicRule);
}

async function marketplaceRows(pool, filters = {}) {
  const values = [];
  const conditions = [];
  if (filters.marketplace) {
    values.push(filters.marketplace);
    conditions.push(`v.marketplace = $${values.length}`);
  }
  if (filters.search) {
    values.push(`%${String(filters.search).trim()}%`);
    conditions.push(`(v.sku ILIKE $${values.length} OR p.nome ILIKE $${values.length} OR v.nome ILIKE $${values.length})`);
  }
  if (filters.stock === 'positive') conditions.push(`COALESCE(p.estoque, 0) > 0`);
  if (filters.stock === 'nonpositive') conditions.push(`COALESCE(p.estoque, 0) <= 0`);
  const [ruleResult, dynamicRules, result] = await Promise.all([
    pool.query(`SELECT * FROM tabela_preco_regras WHERE ativo = TRUE`),
    freightRules(pool),
    pool.query(`
    SELECT v.*, p.nome AS produto_nome, p.custo, p.peso, p.estoque, p.preco_bling
    FROM tabela_preco_vinculos v
    LEFT JOIN tabela_preco_produtos p ON p.sku = v.sku
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY v.sku, v.marketplace, v.id
  `, values)
  ]);
  const rules = new Map(ruleResult.rows.map(row => [row.marketplace, databaseRule(row)]));
  const calculated = result.rows.map(row => {
    const rule = rules.get(row.marketplace);
    const product = { sku: row.sku, cost: Number(row.custo), weight: Number(row.peso) };
    return {
      row, product, rule,
      result: rule ? calculateMarketplace(product, rule, dynamicRules) : { status: 'Revisar', reason: 'Marketplace sem regra ativa.' }
    };
  });
  return standardizeEqualProducts(calculated, dynamicRules).map(item => {
    const grossPublished = Number(item.row.preco_atual) || 0;
    const promotionalPublished = Number(item.row.preco_promocional) || 0;
    const liquidPublished = promotionalPublished > 0 ? promotionalPublished : grossPublished;
    return {
      ...item,
      published: {
        grossPrice: grossPublished,
        discount: grossPublished > 0 ? Math.max(0, 1 - (liquidPublished / grossPublished)) : 0,
        liquidPrice: liquidPublished,
        details: item.rule && liquidPublished > 0 && item.product.cost > 0 && item.product.weight > 0
          ? calculateAtPrice(item.product, item.rule, liquidPublished, dynamicRules)
          : null
      }
    };
  });
}

async function mercadoLivreRows(pool) {
  return marketplaceRows(pool, { marketplace: 'Mercado Livre' });
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatCsvNumber(value) {
  return Number(value).toFixed(4).replace('.', ',');
}

function marketplaceCsv(items) {
  const lines = [CSV_HEADERS.map(csvEscape).join(';')];
  for (const item of items) {
    if (item.result?.status !== 'OK') continue;
    const data = { ...(item.row.dados || {}) };
    data.Preco = formatCsvNumber(item.result.grossPrice);
    data['Preco Promocional'] = '0';
    lines.push(CSV_HEADERS.map(header => csvEscape(data[header])).join(';'));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

const mercadoLivreCsv = marketplaceCsv;

async function updateRule(pool, marketplace, values) {
  const percent = key => (Number(String(values[key] || 0).replace(',', '.')) || 0) / 100;
  const money = key => Number(String(values[key] || 0).replace(',', '.')) || 0;
  await pool.query(`
    UPDATE tabela_preco_regras SET
      ativo=$2, comissao=$3, imposto=$4, adm=$5, ads=$6, cartao=$7,
      frete_percentual=$8, taxa_fixa=$9, frete_fixo=$10, desconto=$11,
      margem_minima=$12, saldo_minimo=$13, atualizado_em=NOW()
    WHERE marketplace=$1
  `, [marketplace, values.ativo === 'on', percent('comissao'), percent('imposto'), percent('adm'),
    percent('ads'), percent('cartao'), percent('frete_percentual'), money('taxa_fixa'),
    money('frete_fixo'), percent('desconto'), percent('margem_minima'), money('saldo_minimo')]);
}

async function updateFreight(pool, id, values) {
  const decimal = key => {
    const raw = String(values[key] ?? '').trim();
    if (!raw) return null;
    const parsed = Number(raw.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  };
  const percent = key => (decimal(key) || 0) / 100;
  await pool.query(`
    UPDATE tabela_preco_fretes SET
      faixa=$2, peso_min=$3, peso_max=$4, preco_min=$5, preco_max=$6,
      valor=$7, comissao=$8, ads=$9, frete_percentual=$10, taxa_fixa=$11,
      atualizado_em=NOW()
    WHERE id=$1
  `, [id, values.faixa || '', decimal('peso_min'), decimal('peso_max'), decimal('preco_min'),
    decimal('preco_max'), decimal('valor') || 0, percent('comissao'), percent('ads'),
    percent('frete_percentual'), decimal('taxa_fixa') || 0]);
}

module.exports = {
  ensureTables,
  importProducts,
  importLinks,
  freightRules,
  marketplaceCsv,
  marketplaceRows,
  mercadoLivreCsv,
  mercadoLivreRows,
  overview,
  runParser,
  updateFreight,
  updateRule
};
