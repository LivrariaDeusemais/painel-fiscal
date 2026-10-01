const path = require('path');
const { spawn } = require('child_process');
const {
  DEFAULT_DYNAMIC_RULES,
  MARKETPLACE_RULES,
  calculateAtPrice,
  calculatePriceSimulation,
  calculateMarketplace,
  priceSimulationStatus,
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
      status_validacao TEXT NOT NULL DEFAULT 'Validado',
      importado_em TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE tabela_preco_produtos ADD COLUMN IF NOT EXISTS status_validacao TEXT NOT NULL DEFAULT 'Validado'`);
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
    const existing = await client.query(`SELECT COUNT(*)::int AS total FROM tabela_preco_produtos WHERE sku = ANY($1::text[])`, [products.map(item => item.sku)]);
    await client.query(`
      INSERT INTO tabela_preco_produtos
        (sku, bling_id, nome, marca, situacao, estoque, custo, preco_compra, peso, peso_bruto, preco_bling, ean, status_validacao, importado_em)
      SELECT sku, bling_id, name, brand, status, stock, cost, purchase_price, weight, gross_weight, bling_price, ean, 'Novo', NOW()
      FROM jsonb_to_recordset($1::jsonb) AS item(
        sku TEXT, bling_id TEXT, name TEXT, brand TEXT, status TEXT, stock NUMERIC,
        cost NUMERIC, purchase_price NUMERIC, weight NUMERIC, gross_weight NUMERIC,
        bling_price NUMERIC, ean TEXT
      )
      ON CONFLICT (sku) DO UPDATE SET
        bling_id=EXCLUDED.bling_id, nome=EXCLUDED.nome, marca=EXCLUDED.marca,
        situacao=EXCLUDED.situacao, estoque=EXCLUDED.estoque, custo=EXCLUDED.custo,
        preco_compra=EXCLUDED.preco_compra, peso=EXCLUDED.peso,
        peso_bruto=EXCLUDED.peso_bruto, preco_bling=EXCLUDED.preco_bling,
        ean=EXCLUDED.ean, importado_em=NOW()
    `, [JSON.stringify(products)]);
    await client.query(`DELETE FROM tabela_preco_produtos WHERE NOT (sku = ANY($1::text[]))`, [products.map(item => item.sku)]);
    await client.query('COMMIT');
    return {
      imported: products.length,
      newProducts: Math.max(0, products.length - Number(existing.rows[0]?.total || 0))
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function weightRange(weight) {
  const value = Number(weight);
  if (!Number.isFinite(value) || value <= 0) return '-';
  if (value <= 0.3) return 'ate 300g';
  if (value <= 0.5) return '300g-500g';
  if (value <= 1) return '500g-1kg';
  if (value <= 2) return '1kg-2kg';
  if (value <= 3) return '2kg-3kg';
  return 'acima de 3kg';
}

function costWeightGroup(cost, weight) {
  const value = Number(cost);
  const range = weightRange(weight);
  if (!Number.isFinite(value) || value <= 0 || range === '-') return '-';
  return `${String(Math.round(value)).padStart(3, '0')}|${range}`;
}

async function productRows(pool, filters = {}) {
  const values = [];
  const conditions = [];
  if (filters.search) {
    values.push(`%${String(filters.search).trim()}%`);
    conditions.push(`(sku ILIKE $${values.length} OR nome ILIKE $${values.length} OR marca ILIKE $${values.length})`);
  }
  if (['Novo', 'Validado'].includes(filters.status)) {
    values.push(filters.status);
    conditions.push(`status_validacao = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const pageSize = Math.min(200, Math.max(20, Number(filters.pageSize) || 100));
  const page = Math.max(1, Number(filters.page) || 1);
  const offset = (page - 1) * pageSize;
  const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM tabela_preco_produtos ${where}`, values);
  const result = await pool.query(`
    SELECT sku, nome, marca, peso, custo, estoque, preco_bling, status_validacao
    FROM tabela_preco_produtos
    ${where}
    ORDER BY sku
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}
  `, [...values, pageSize, offset]);
  return {
    rows: result.rows.map(row => ({
      ...row,
      faixa_peso: weightRange(row.peso),
      grupo_custo_peso: costWeightGroup(row.custo, row.peso)
    })),
    total: Number(countResult.rows[0]?.total || 0),
    page,
    pageSize
  };
}

async function updateProductCost(pool, sku, cost) {
  const result = await pool.query(`
    UPDATE tabela_preco_produtos SET custo=$2, importado_em=NOW()
    WHERE sku=$1 RETURNING sku
  `, [sku, cost]);
  if (!result.rows[0]) throw new Error('Produto não encontrado.');
}

async function updateProductStatuses(pool, skus, status) {
  const normalized = [...new Set((Array.isArray(skus) ? skus : [skus]).map(String).map(item => item.trim()).filter(Boolean))];
  if (!normalized.length) throw new Error('Selecione pelo menos um produto.');
  if (!['Novo', 'Validado'].includes(status)) throw new Error('Status inválido.');
  const result = await pool.query(`
    UPDATE tabela_preco_produtos SET status_validacao=$2
    WHERE sku = ANY($1::text[])
  `, [normalized, status]);
  return result.rowCount;
}

function planLinkImport(existing, links) {
  const clean = value => String(value || '').trim();
  const byStore = new Map();
  const bySku = new Map();
  for (const row of existing) {
    const store = clean(row.id_loja);
    const sku = clean(row.sku).toUpperCase();
    if (store) byStore.set(store, [...(byStore.get(store) || []), row]);
    bySku.set(sku, [...(bySku.get(sku) || []), row]);
  }
  const seen = new Set();
  const matched = new Set();
  const updates = [];
  const inserts = [];
  for (const source of links) {
    const link = { ...source, sku: clean(source.sku), store_id: clean(source.store_id), product_id: clean(source.product_id) };
    if (!link.sku) throw new Error('Todos os itens devem informar o Código (SKU).');
    const key = link.store_id ? `anuncio:${link.store_id}` : `sku:${link.sku.toUpperCase()}`;
    if (seen.has(key)) throw new Error(`Item repetido na planilha: ${link.store_id || link.sku}.`);
    seen.add(key);
    const skuRows = bySku.get(link.sku.toUpperCase()) || [];
    let candidates;
    if (link.store_id) {
      candidates = byStore.get(link.store_id) || skuRows.filter(row => !clean(row.id_loja));
    } else {
      const productRows = link.product_id ? skuRows.filter(row => clean(row.id_produto) === link.product_id) : [];
      candidates = productRows.length ? productRows : skuRows;
    }
    if (candidates.length > 1) throw new Error(`Mais de um vínculo corresponde ao SKU ${link.sku}. Informe o ID na Loja para identificar o anúncio.`);
    const target = candidates[0];
    if (target) {
      if (matched.has(target.id)) throw new Error(`Duas linhas correspondem ao mesmo vínculo do SKU ${link.sku}.`);
      matched.add(target.id);
      const productId = link.product_id || clean(target.id_produto);
      const storeId = link.store_id || clean(target.id_loja);
      updates.push({ ...link, product_id: productId, store_id: storeId, id: target.id,
        raw: { ...(link.raw || {}), IdProduto: productId, 'ID na Loja': storeId } });
    } else {
      inserts.push(link);
    }
  }
  return { updates, inserts };
}

async function importLinks(pool, marketplace, links) {
  if (!Array.isArray(links) || !links.length) throw new Error('Nenhum vínculo foi encontrado na planilha.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`tabela-precos-vinculos:${marketplace}`]);
    const existing = await client.query('SELECT id, id_loja, id_produto, sku FROM tabela_preco_vinculos WHERE marketplace = $1 FOR UPDATE', [marketplace]);
    const { updates, inserts } = planLinkImport(existing.rows, links);
    if (updates.length) await client.query(`
      UPDATE tabela_preco_vinculos v SET id_produto = item.product_id, id_loja = item.store_id,
        sku = item.sku, nome = item.name, preco_atual = item.current_price,
        preco_promocional = item.promotional_price, dados = item.raw,
        importado_em = NOW(), confirmado_em = NULL, confirmado_por = NULL
      FROM jsonb_to_recordset($2::jsonb) AS item(
        id BIGINT, product_id TEXT, store_id TEXT, sku TEXT, name TEXT,
        current_price NUMERIC, promotional_price NUMERIC, raw JSONB
      )
      WHERE v.marketplace = $1 AND v.id = item.id
    `, [marketplace, JSON.stringify(updates)]);
    if (inserts.length) await client.query(`
      INSERT INTO tabela_preco_vinculos
        (marketplace, id_produto, id_loja, sku, nome, preco_atual, preco_promocional, dados)
      SELECT $1, product_id, store_id, sku, name, current_price, promotional_price, raw
      FROM jsonb_to_recordset($2::jsonb) AS item(
        product_id TEXT, store_id TEXT, sku TEXT, name TEXT,
        current_price NUMERIC, promotional_price NUMERIC, raw JSONB
      )
    `, [marketplace, JSON.stringify(inserts)]);
    await client.query('COMMIT');
    return { updated: updates.length, inserted: inserts.length };
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

function publishedPrices(row, rule) {
  const grossPrice = Number(row.preco_atual) || 0;
  const promotionalPrice = Number(row.preco_promocional) || 0;
  const configuredDiscount = Math.max(0, Math.min(0.99, Number(rule?.discount) || 0));
  const discount = promotionalPrice > 0 && grossPrice > 0
    ? Math.max(0, 1 - (promotionalPrice / grossPrice))
    : configuredDiscount;
  return {
    grossPrice,
    discount,
    liquidPrice: promotionalPrice > 0 ? promotionalPrice : grossPrice * (1 - discount)
  };
}

async function overview(pool) {
  const [products, links, rules, issues] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total, MAX(importado_em) AS atualizado_em FROM tabela_preco_produtos`),
    pool.query(`SELECT marketplace, COUNT(*)::int AS total, COUNT(DISTINCT sku)::int AS skus, MAX(importado_em) AS atualizado_em FROM tabela_preco_vinculos GROUP BY marketplace ORDER BY marketplace`),
    pool.query(`SELECT * FROM tabela_preco_regras ORDER BY marketplace`),
    pool.query(`
      SELECT NULL::int AS row, sku, nome AS name,
        CONCAT_WS('; ',
          CASE WHEN COALESCE(custo, 0) <= 0 THEN 'Preço de custo ausente ou igual a zero' END,
          CASE WHEN COALESCE(peso, 0) <= 0 THEN 'Peso líquido ausente ou igual a zero' END
        ) || '.' AS reason
      FROM tabela_preco_produtos
      WHERE COALESCE(custo, 0) <= 0 OR COALESCE(peso, 0) <= 0
      UNION ALL
      SELECT NULL::int, v.sku, MAX(v.nome),
        'SKU vinculado em ' || STRING_AGG(DISTINCT v.marketplace, ', ' ORDER BY v.marketplace) || ' não localizado no cadastro geral.'
      FROM tabela_preco_vinculos v
      LEFT JOIN tabela_preco_produtos p ON p.sku = v.sku
      WHERE p.sku IS NULL
      GROUP BY v.sku
      ORDER BY sku
    `)
  ]);
  return { products: products.rows[0], links: links.rows, rules: rules.rows, issues: issues.rows };
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
    conditions.push(`v.canal = $${values.length}`);
  }
  if (filters.search) {
    values.push(`%${String(filters.search).trim()}%`);
    conditions.push(`(v.produto_sku ILIKE $${values.length} OR p.nome ILIKE $${values.length} OR v.nome ILIKE $${values.length})`);
  }
  if (filters.stock === 'positive') conditions.push(`COALESCE(p.estoque, 0) > 0`);
  if (filters.stock === 'nonpositive') conditions.push(`COALESCE(p.estoque, 0) <= 0`);
  const [ruleResult, dynamicRules, result] = await Promise.all([
    pool.query(`SELECT * FROM tabela_preco_regras WHERE ativo = TRUE`),
    freightRules(pool),
    pool.query(`
    WITH canais AS (
      SELECT p.sku, r.marketplace
      FROM tabela_preco_produtos p
      CROSS JOIN tabela_preco_regras r
      WHERE r.ativo = TRUE AND r.marketplace <> 'Bling'
    ), v AS (
      SELECT l.*, COALESCE(l.sku, c.sku) AS produto_sku,
             COALESCE(l.marketplace, c.marketplace) AS canal,
             (l.id IS NULL OR COALESCE(l.dados->>'preco_manual_sem_vinculo', 'false') = 'true') AS sem_vinculo
      FROM canais c
      FULL JOIN tabela_preco_vinculos l ON l.sku = c.sku AND l.marketplace = c.marketplace
    )
    SELECT v.*, v.produto_sku AS sku, v.canal AS marketplace,
           p.nome AS produto_nome, p.custo, p.peso, p.estoque, p.preco_bling,
           p.status_validacao
    FROM v
    LEFT JOIN tabela_preco_produtos p ON p.sku = v.produto_sku
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY v.produto_sku, v.canal, v.id
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
    const published = item.row.sem_vinculo && !(Number(item.row.preco_promocional) > 0)
      ? { grossPrice: null, discount: null, liquidPrice: null }
      : publishedPrices(item.row, item.rule);
    return {
      ...item,
      published: {
        ...published,
        details: item.rule && published.liquidPrice > 0 && item.product.cost > 0 && item.product.weight > 0
          ? calculateAtPrice(item.product, item.rule, published.liquidPrice, dynamicRules)
          : null
      }
    };
  });
}

async function calculatorContext(pool, marketplace, sku) {
  const cleanMarketplace = String(marketplace || '').trim();
  const cleanSku = String(sku || '').trim();
  const [ruleResult, dynamicRules, productResult, linkResult] = await Promise.all([
    pool.query(`SELECT * FROM tabela_preco_regras WHERE marketplace = $1 AND ativo = TRUE`, [cleanMarketplace]),
    freightRules(pool),
    cleanSku
      ? pool.query(`SELECT sku, nome, marca, custo, peso, estoque, preco_bling FROM tabela_preco_produtos WHERE UPPER(sku) = UPPER($1) LIMIT 1`, [cleanSku])
      : Promise.resolve({ rows: [] }),
    cleanSku && cleanMarketplace
      ? pool.query(`SELECT * FROM tabela_preco_vinculos WHERE marketplace = $1 AND UPPER(sku) = UPPER($2) ORDER BY id LIMIT 1`, [cleanMarketplace, cleanSku])
      : Promise.resolve({ rows: [] })
  ]);
  const rule = ruleResult.rows[0] ? databaseRule(ruleResult.rows[0]) : null;
  const product = productResult.rows[0] || null;
  const link = linkResult.rows[0] || null;
  return {
    rule,
    dynamicRules,
    product,
    link,
    published: link && rule ? publishedPrices(link, rule) : null
  };
}

async function saveCalculatorPrice(pool, marketplace, sku, price) {
  if (!Number.isFinite(price) || price <= 0 || price > 99999999999) {
    throw new Error('Informe um preço válido maior que zero.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`tabela-precos-vinculos:${marketplace}`]);
    const product = (await client.query(
      'SELECT sku, nome FROM tabela_preco_produtos WHERE UPPER(sku) = UPPER($1) FOR UPDATE', [String(sku).trim()]
    )).rows[0];
    if (!product) throw new Error('Selecione um SKU cadastrado para salvar o preço.');
    const rule = (await client.query(
      "SELECT desconto FROM tabela_preco_regras WHERE marketplace = $1 AND ativo = TRUE AND marketplace <> 'Bling'", [marketplace]
    )).rows[0];
    if (!rule) throw new Error('Selecione um marketplace com regra ativa.');
    const link = (await client.query(
      'SELECT * FROM tabela_preco_vinculos WHERE marketplace = $1 AND sku = $2 ORDER BY id LIMIT 1 FOR UPDATE', [marketplace, product.sku]
    )).rows[0];
    const liquid = Math.round(price * 100) / 100;
    if (!(liquid > 0)) throw new Error('Informe um preço de pelo menos R$ 0,01.');
    const discount = Math.max(0, Math.min(0.99, Number(rule.desconto) || 0));
    const gross = Math.max(liquid, Number(link?.preco_atual) || liquid / (1 - discount));
    if (gross > 99999999999) throw new Error('Preço acima do limite permitido.');
    const data = { ...(link?.dados || {}), Preco: gross, 'Preco Promocional': liquid };
    if (link) {
      await client.query('UPDATE tabela_preco_vinculos SET preco_atual = $1, preco_promocional = $2, dados = $3::jsonb WHERE id = $4',
        [gross, liquid, JSON.stringify(data), link.id]);
    } else {
      data.preco_manual_sem_vinculo = true;
      await client.query(`INSERT INTO tabela_preco_vinculos (marketplace, sku, nome, preco_atual, preco_promocional, dados)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)`, [marketplace, product.sku, product.nome, gross, liquid, JSON.stringify(data)]);
    }
    await client.query('COMMIT');
    return liquid;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function priceReviewStatus(validationStatus, calculationStatus, difference) {
  if (validationStatus === 'Novo') return 'Novo';
  if (calculationStatus !== 'OK' || !Number.isFinite(Number(difference))) return 'Revisar';

  const differenceInCents = Math.round(Number(difference) * 100);
  if (differenceInCents === 0) return 'Manter preço';
  if (differenceInCents > 100) return 'Reajustar';
  if (differenceInCents < -100) return 'Abaixou';
  return 'Analisar';
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
    if (item.row.sem_vinculo || item.result?.status !== 'OK') continue;
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
  calculatorContext,
  saveCalculatorPrice,
  calculateMarketplace,
  calculatePriceSimulation,
  costWeightGroup,
  ensureTables,
  importProducts,
  importLinks,
  planLinkImport,
  freightRules,
  marketplaceCsv,
  marketplaceRows,
  mercadoLivreCsv,
  mercadoLivreRows,
  overview,
  priceReviewStatus,
  priceSimulationStatus,
  productRows,
  publishedPrices,
  runParser,
  updateProductCost,
  updateProductStatuses,
  updateFreight,
  updateRule,
  weightRange
};
