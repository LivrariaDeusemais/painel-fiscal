const path = require('path');
const { spawn } = require('child_process');
const {
  MARKETPLACE_RULES,
  calculateMercadoLivre,
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

async function ensureTables(pool) {
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
  for (const rule of MARKETPLACE_RULES) {
    await pool.query(`
      INSERT INTO tabela_preco_regras
        (marketplace, comissao, imposto, adm, ads, cartao, frete_percentual, taxa_fixa, frete_fixo, desconto, margem_minima, saldo_minimo)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (marketplace) DO NOTHING
    `, [rule.marketplace, rule.commission, rule.tax, rule.admin, rule.ads, rule.card, rule.freightPercent,
      rule.fixedFee, rule.fixedFreight, rule.discount, rule.minMargin, rule.minProfit]);
  }
}

async function importProducts(pool, products) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM tabela_preco_produtos');
    for (const item of products) {
      await client.query(`
        INSERT INTO tabela_preco_produtos
          (sku, bling_id, nome, marca, situacao, estoque, custo, preco_compra, peso, peso_bruto, preco_bling, ean)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `, [item.sku, item.bling_id, item.name, item.brand, item.status, item.stock, item.cost,
        item.purchase_price, item.weight, item.gross_weight, item.bling_price, item.ean]);
    }
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
    for (const item of links) {
      await client.query(`
        INSERT INTO tabela_preco_vinculos
          (marketplace, id_produto, id_loja, sku, nome, preco_atual, preco_promocional, dados)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [marketplace, item.product_id, item.store_id, item.sku, item.name,
        item.current_price, item.promotional_price, item.raw]);
    }
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

async function mercadoLivreRows(pool) {
  const ruleResult = await pool.query(`SELECT * FROM tabela_preco_regras WHERE marketplace = 'Mercado Livre' LIMIT 1`);
  const rule = ruleResult.rows[0] ? databaseRule(ruleResult.rows[0]) : MARKETPLACE_RULES[2];
  const result = await pool.query(`
    SELECT v.*, p.nome AS produto_nome, p.custo, p.peso, p.estoque, p.preco_bling
    FROM tabela_preco_vinculos v
    LEFT JOIN tabela_preco_produtos p ON p.sku = v.sku
    WHERE v.marketplace = 'Mercado Livre'
    ORDER BY v.sku, v.id
  `);
  const calculated = result.rows.map(row => {
    const product = { sku: row.sku, cost: Number(row.custo), weight: Number(row.peso) };
    return { row, product, rule, result: row.custo && row.peso ? calculateMercadoLivre(product, rule) : { status: 'Revisar', reason: 'Produto sem custo ou peso.' } };
  });
  return standardizeEqualProducts(calculated);
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatCsvNumber(value) {
  return Number(value).toFixed(4).replace('.', ',');
}

function mercadoLivreCsv(items) {
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

module.exports = {
  ensureTables,
  importProducts,
  importLinks,
  mercadoLivreCsv,
  mercadoLivreRows,
  overview,
  runParser,
  updateRule
};
