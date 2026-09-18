const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('../db');
const { consultarPaginaNfPaulistana, obterConfigNfPaulistana } = require('../integrations/nfpaulistana');
const { consultarDistribuicao, consultarPorChave, manifestarCiencia, obterConfigSefaz } = require('../integrations/sefaz-dfe');

const router = express.Router();
const uploadsDir = process.env.UPLOADS_DIR || '/uploads';

function protegerIntegracao(req, res, next) {
  if (!req.session?.usuario) return res.redirect('/login');
  if (!['ADMIN', 'USUARIO'].includes(req.session.usuario.perfil)) {
    return res.status(403).send('<pre>Acesso negado para este perfil de usuário.</pre>');
  }
  next();
}

function escapeHtml(valor = '') {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function dataPadrao(offsetDias = 0) {
  const data = new Date();
  data.setDate(data.getDate() + offsetDias);
  return data.toISOString().slice(0, 10);
}

function nomeSeguro(valor = '') {
  return String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\/\\:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function ensureArquivoFila() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS arquivo_fila (
      id SERIAL PRIMARY KEY,
      nome_original TEXT,
      nome_arquivo TEXT NOT NULL,
      tipo VARCHAR(10) NOT NULL,
      caminho TEXT NOT NULL,
      tamanho_bytes BIGINT DEFAULT 0,
      status VARCHAR(20) DEFAULT 'DISPONIVEL',
      criado_em TIMESTAMP DEFAULT NOW(),
      origem VARCHAR(40) DEFAULT 'UPLOAD_MANUAL',
      chave_origem TEXT,
      metadados JSONB
    )
  `);
  await pool.query(`ALTER TABLE arquivo_fila ADD COLUMN IF NOT EXISTS documento_classe VARCHAR(20)`);
  await pool.query(`ALTER TABLE arquivo_fila ADD COLUMN IF NOT EXISTS chave_fiscal TEXT`);
  await pool.query(`ALTER TABLE arquivo_fila ADD COLUMN IF NOT EXISTS cnpj_cpf TEXT`);
  await pool.query(`ALTER TABLE arquivo_fila ADD COLUMN IF NOT EXISTS fornecedor TEXT`);
  await pool.query(`ALTER TABLE arquivo_fila ADD COLUMN IF NOT EXISTS numero_documento TEXT`);
  await pool.query(`ALTER TABLE arquivo_fila ADD COLUMN IF NOT EXISTS tipo_documento_detectado TEXT`);
  await pool.query(`ALTER TABLE arquivo_fila ADD COLUMN IF NOT EXISTS data_documento DATE`);
  await pool.query(`ALTER TABLE arquivo_fila ADD COLUMN IF NOT EXISTS valor_documento NUMERIC(15,2)`);
  await pool.query(`ALTER TABLE arquivo_fila ADD COLUMN IF NOT EXISTS hash_sha256 TEXT`);
  await pool.query(`ALTER TABLE arquivo_fila ADD COLUMN IF NOT EXISTS analise_status VARCHAR(30)`);
  await pool.query(`ALTER TABLE arquivo_fila ADD COLUMN IF NOT EXISTS analisado_em TIMESTAMP`);
}

async function ensureSefazTables() {
  await ensureArquivoFila();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fiscal_integracao_estado (
      fonte VARCHAR(40) PRIMARY KEY,
      ultimo_nsu TEXT NOT NULL DEFAULT '0',
      atualizado_em TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sefaz_candidatas (
      chave VARCHAR(44) PRIMARY KEY,
      nsu TEXT,
      fornecedor TEXT,
      cnpj_fornecedor TEXT,
      data_emissao TIMESTAMP,
      numero TEXT,
      serie TEXT,
      valor NUMERIC(15,2),
      natureza TEXT,
      classificacao VARCHAR(30) NOT NULL DEFAULT 'REVISAO',
      status VARCHAR(30) NOT NULL DEFAULT 'AGUARDANDO_XML',
      itens JSONB DEFAULT '[]'::jsonb,
      criado_em TIMESTAMP DEFAULT NOW(),
      atualizado_em TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS sefaz_candidatas_classificacao_idx ON sefaz_candidatas (classificacao)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fiscal_documentos_processados (
      chave TEXT PRIMARY KEY,
      tipo VARCHAR(20) NOT NULL,
      origem VARCHAR(40) NOT NULL,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    INSERT INTO fiscal_documentos_processados (chave, tipo, origem)
    SELECT DISTINCT chave_fiscal, COALESCE(tipo_documento_detectado, 'FISCAL'), COALESCE(origem, 'ARQUIVO')
    FROM arquivo_fila
    WHERE chave_fiscal IS NOT NULL AND chave_fiscal <> ''
    ON CONFLICT (chave) DO NOTHING
  `);
}

async function reservarChaveFiscal(chave, tipo, origem) {
  const result = await pool.query(`
    INSERT INTO fiscal_documentos_processados (chave, tipo, origem)
    VALUES ($1, $2, $3)
    ON CONFLICT (chave) DO NOTHING
    RETURNING chave
  `, [chave, tipo, origem]);
  return !!result.rows[0];
}

async function liberarReservaFiscal(chave) {
  await pool.query(`DELETE FROM fiscal_documentos_processados WHERE chave = $1`, [chave]);
}

async function obterUltimoNsuSefaz() {
  await ensureSefazTables();
  const result = await pool.query(`SELECT ultimo_nsu FROM fiscal_integracao_estado WHERE fonte = 'SEFAZ_NFE'`);
  return result.rows[0]?.ultimo_nsu || '0';
}

async function salvarUltimoNsuSefaz(ultimoNsu) {
  await pool.query(`
    INSERT INTO fiscal_integracao_estado (fonte, ultimo_nsu, atualizado_em)
    VALUES ('SEFAZ_NFE', $1, NOW())
    ON CONFLICT (fonte) DO UPDATE SET ultimo_nsu = EXCLUDED.ultimo_nsu, atualizado_em = NOW()
  `, [String(ultimoNsu || '0')]);
}

async function chaveFiscalJaExiste(chave) {
  const result = await pool.query(`
    SELECT id FROM arquivo_fila
    WHERE COALESCE(status, 'DISPONIVEL') <> 'EXCLUIDO'
      AND (chave_origem = $1 OR chave_fiscal = $1)
    LIMIT 1
  `, [chave]);
  return !!result.rows[0];
}

async function salvarCandidataSefaz(documento, status = '') {
  await pool.query(`
    INSERT INTO sefaz_candidatas (
      chave, nsu, fornecedor, cnpj_fornecedor, data_emissao, numero, serie,
      valor, natureza, classificacao, status, itens, atualizado_em
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
    ON CONFLICT (chave) DO UPDATE SET
      nsu = EXCLUDED.nsu,
      fornecedor = EXCLUDED.fornecedor,
      cnpj_fornecedor = EXCLUDED.cnpj_fornecedor,
      data_emissao = EXCLUDED.data_emissao,
      numero = COALESCE(EXCLUDED.numero, sefaz_candidatas.numero),
      serie = COALESCE(EXCLUDED.serie, sefaz_candidatas.serie),
      valor = EXCLUDED.valor,
      natureza = COALESCE(EXCLUDED.natureza, sefaz_candidatas.natureza),
      classificacao = EXCLUDED.classificacao,
      status = EXCLUDED.status,
      itens = EXCLUDED.itens,
      atualizado_em = NOW()
  `, [
    documento.chave,
    documento.nsu || null,
    documento.fornecedor || null,
    documento.cnpjFornecedor || null,
    documento.dataEmissao || null,
    documento.numero || null,
    documento.serie || null,
    documento.valor || 0,
    documento.natureza || null,
    documento.classificacao === 'PENDENTE_ANALISE' ? 'REVISAO' : (documento.classificacao || 'REVISAO'),
    status || (documento.tipo === 'XML_COMPLETO' ? 'PRONTO' : 'AGUARDANDO_XML'),
    JSON.stringify(documento.itens || [])
  ]);
}

async function listarCandidatasSefaz() {
  await ensureSefazTables();
  const result = await pool.query(`
    SELECT * FROM sefaz_candidatas
    ORDER BY CASE classificacao WHEN 'CONSUMO' THEN 1 WHEN 'REVISAO' THEN 2 WHEN 'ESTOQUE' THEN 3 ELSE 4 END,
             data_emissao DESC NULLS LAST, criado_em DESC
    LIMIT 500
  `);
  return result.rows;
}

async function notaPaulistanaJaExiste(nota) {
  const data = String(nota.dataEmissao || '').slice(0, 10) || null;
  const result = await pool.query(`
    SELECT id
    FROM arquivo_fila
    WHERE tipo = 'XML'
      AND COALESCE(status, 'DISPONIVEL') <> 'EXCLUIDO'
      AND (
        chave_origem = $1
        OR (
          REGEXP_REPLACE(COALESCE(cnpj_cpf, ''), '[^0-9]', '', 'g') = $2
          AND COALESCE(numero_documento, '') = $3
          AND data_documento = $4
          AND valor_documento = $5
        )
      )
    LIMIT 1
  `, [nota.chaveMunicipal, nota.cnpjPrestador, nota.numero, data, nota.valor]);
  return !!result.rows[0];
}

async function importarNotaPaulistana(nota) {
  if (!nota.xml || !nota.numero || !nota.cnpjPrestador) return { importada: false, ignorada: true };
  if (await notaPaulistanaJaExiste(nota)) return { importada: false, duplicada: true };
  if (!await reservarChaveFiscal(nota.chaveMunicipal, 'NFSE', 'NFSE_PAULISTANA')) return { importada: false, duplicada: true };

  const data = String(nota.dataEmissao || '').slice(0, 10) || null;
  const base = nomeSeguro(`XML NFSe ${nota.fornecedor || nota.cnpjPrestador} Emissao ${data || 'sem-data'} Doc ${nota.numero}`);
  const nome = `${base || 'XML NFSe Paulistana'}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.xml`;
  const caminho = path.join(uploadsDir, nome);
  const hash = crypto.createHash('sha256').update(nota.xml).digest('hex');
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(caminho, nota.xml, 'utf8');

  try {
    await pool.query(`
      INSERT INTO arquivo_fila (
        nome_original, nome_arquivo, tipo, caminho, tamanho_bytes, status, origem,
        chave_origem, metadados, documento_classe, cnpj_cpf, fornecedor,
        numero_documento, tipo_documento_detectado, data_documento,
        valor_documento, hash_sha256, analise_status, analisado_em
      ) VALUES (
        $1, $2, 'XML', $3, $4, 'DISPONIVEL', 'NFSE_PAULISTANA',
        $5, $6, 'FISCAL', $7, $8, $9, 'NFSE', $10, $11, $12,
        'AGUARDANDO_PDF', NOW()
      )
    `, [
      `NFS-e Paulistana ${nota.numero}`,
      nome,
      caminho,
      Buffer.byteLength(nota.xml, 'utf8'),
      nota.chaveMunicipal,
      {
        numero: nota.numero,
        codigoVerificacao: nota.codigoVerificacao,
        inscricaoPrestador: nota.inscricaoPrestador,
        discriminacao: nota.discriminacao
      },
      nota.cnpjPrestador,
      nota.fornecedor,
      nota.numero,
      data,
      nota.valor,
      hash
    ]);
  } catch (error) {
    try { fs.unlinkSync(caminho); } catch (unlinkError) {}
    await liberarReservaFiscal(nota.chaveMunicipal);
    throw error;
  }
  return { importada: true };
}

async function importarNfeSefaz(documento) {
  if (!documento.xml || !/^\d{44}$/.test(documento.chave || '')) return { importada: false, indisponivel: true };
  if (await chaveFiscalJaExiste(documento.chave)) return { importada: false, duplicada: true };
  if (!await reservarChaveFiscal(documento.chave, 'NFE', 'SEFAZ_NFE')) return { importada: false, duplicada: true };

  const data = String(documento.dataEmissao || '').slice(0, 10) || null;
  const base = nomeSeguro(`XML NFe ${documento.fornecedor || documento.cnpjFornecedor} Emissao ${data || 'sem-data'} Doc ${documento.numero || documento.chave.slice(-9)}`);
  const nome = `${base || 'XML NFe SEFAZ'}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.xml`;
  const caminho = path.join(uploadsDir, nome);
  const hash = crypto.createHash('sha256').update(documento.xml).digest('hex');
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(caminho, documento.xml, 'utf8');

  try {
    await pool.query(`
      INSERT INTO arquivo_fila (
        nome_original, nome_arquivo, tipo, caminho, tamanho_bytes, status, origem,
        chave_origem, metadados, documento_classe, chave_fiscal, cnpj_cpf,
        fornecedor, numero_documento, tipo_documento_detectado, data_documento,
        valor_documento, hash_sha256, analise_status, analisado_em
      ) VALUES (
        $1,$2,'XML',$3,$4,'DISPONIVEL','SEFAZ_NFE',$5,$6,'FISCAL',$5,$7,$8,$9,
        'NFE',$10,$11,$12,'AGUARDANDO_PDF',NOW()
      )
    `, [
      `NF-e SEFAZ ${documento.chave}`,
      nome,
      caminho,
      Buffer.byteLength(documento.xml, 'utf8'),
      documento.chave,
      {
        nsu: documento.nsu,
        serie: documento.serie,
        natureza: documento.natureza,
        classificacao: documento.classificacao,
        itens: documento.itens || []
      },
      documento.cnpjFornecedor,
      documento.fornecedor,
      documento.numero,
      data,
      documento.valor || 0,
      hash
    ]);
  } catch (error) {
    try { fs.unlinkSync(caminho); } catch (unlinkError) {}
    await liberarReservaFiscal(documento.chave);
    throw error;
  }
  return { importada: true };
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function normalizarLista(valor) {
  if (valor == null) return [];
  return Array.isArray(valor) ? valor : [valor];
}

function renderPagina(req, { ok = '', erro = '', dataInicial = '', dataFinal = '' } = {}) {
  const cfg = obterConfigNfPaulistana();
  const disponivel = !!cfg.certPath && !!cfg.certPassword && cfg.cnpj.length === 14;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Nota Fiscal Paulistana - PlennaTec</title>
  <style>
    *{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#172033;background:linear-gradient(135deg,#baf2cf 0%,#f8fafc 42%,#eef2f7 100%);min-height:100vh}.shell{width:min(1450px,calc(100vw - 48px));margin:18px auto 28px}.top,.nav,.card{background:rgba(255,255,255,.92);border:1px solid #e2e8f0;border-radius:22px;box-shadow:0 18px 45px rgba(15,23,42,.08)}.top{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:18px 24px;margin-bottom:14px}.top h1{margin:0 0 6px;font-size:30px}.top p,.intro{margin:0;color:#52627a;font-weight:700;line-height:1.42}.user{font-weight:900;color:#00b050;text-align:right}.user span{display:block;font-size:11px;color:#64748b;text-transform:uppercase;margin-top:4px}.nav{display:flex;gap:10px;flex-wrap:wrap;padding:10px 14px;margin-bottom:16px}.nav a{height:40px;padding:0 14px;border-radius:11px;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;background:linear-gradient(180deg,#f8fafc,#eef2f7);color:#009640;border:1px solid #d7eadf}.card{max-width:920px;margin:0 auto;padding:26px}.card h2{margin:0 0 8px;font-size:22px}.intro{margin-bottom:22px}.form-row{display:grid;grid-template-columns:repeat(2,minmax(0,210px));gap:14px;margin-bottom:20px}label{display:block;font-weight:900;margin-bottom:7px;color:#334155}input{width:100%;height:46px;border:1px solid #dbe7df;border-radius:12px;padding:0 12px;font:800 14px Arial}.btn{min-height:46px;border:0;border-radius:12px;background:linear-gradient(135deg,#00b050,#009640);color:#fff;font:900 14px Arial;padding:0 20px;cursor:pointer;box-shadow:0 12px 22px rgba(0,176,80,.18)}.btn:disabled{background:#94a3b8;box-shadow:none}.alert{padding:14px 16px;border-radius:14px;margin:0 0 14px;font-weight:800;line-height:1.4}.ok{background:#dcfce7;color:#166534;border:1px solid #86efac}.err{background:#fee2e2;color:#991b1b;border:1px solid #fecaca}.warn{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}.note{margin-top:20px;padding:14px 16px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:14px;color:#166534;font-size:13px;font-weight:800;line-height:1.4}@media(max-width:760px){.shell{width:calc(100vw - 24px)}.top{align-items:flex-start;flex-direction:column}.user{text-align:left}.form-row{grid-template-columns:1fr}.btn{width:100%}}
  </style>
</head>
<body><main class="shell">
  <section class="top"><div><h1>Nota Fiscal Paulistana</h1><p>Importe NFS-e recebidas diretamente do sistema da Prefeitura de São Paulo.</p></div><div class="user">${escapeHtml(req.session.usuario.nome)}<span>${escapeHtml(req.session.usuario.perfil)}</span></div></section>
  <nav class="nav"><a href="/dashboard">Voltar para o Painel</a><a href="/arquivo">Arquivo</a><a href="/nfse-nacional">Portal Contribuinte</a><a href="/sefaz">SEFAZ</a><a href="/logout">Sair</a></nav>
  ${ok ? `<div class="alert ok">${escapeHtml(ok)}</div>` : ''}${erro ? `<div class="alert err">${escapeHtml(erro)}</div>` : ''}
  <section class="card"><h2>Período da consulta</h2><p class="intro">As notas já existentes no PlennaTec serão identificadas e não serão importadas novamente.</p>
    ${!disponivel ? '<div class="alert warn">A integração ainda precisa ser configurada pelo administrador.</div>' : ''}
    <form method="post" action="/nfpaulistana/importar"><div class="form-row"><div><label for="dataInicial">Data inicial</label><input id="dataInicial" name="dataInicial" type="date" value="${escapeHtml(dataInicial || dataPadrao(-30))}" required></div><div><label for="dataFinal">Data final</label><input id="dataFinal" name="dataFinal" type="date" value="${escapeHtml(dataFinal || dataPadrao())}" required></div></div><button class="btn" type="submit" ${disponivel ? '' : 'disabled'}>Buscar e importar XMLs</button></form>
    <div class="note">A consulta percorre todas as páginas do período. Apenas XMLs novos são enviados para a tela Arquivo.</div>
  </section>
</main></body></html>`;
}

router.get('/nfpaulistana', protegerIntegracao, (req, res) => res.send(renderPagina(req)));

router.post('/nfpaulistana/importar', protegerIntegracao, async (req, res) => {
  const dataInicial = String(req.body.dataInicial || '');
  const dataFinal = String(req.body.dataFinal || '');
  try {
    await ensureArquivoFila();
    await ensureSefazTables();
    let pagina = 1;
    let importadas = 0;
    let duplicadas = 0;
    let ignoradas = 0;

    while (pagina <= 200) {
      const resultado = await consultarPaginaNfPaulistana({ dataInicial, dataFinal, pagina });
      if (!resultado.sucesso) {
        const detalhe = resultado.erros.map(item => item.descricao || item.codigo).filter(Boolean).join(' | ');
        throw new Error(detalhe || 'A Prefeitura não concluiu a consulta.');
      }
      for (const nota of resultado.notas) {
        const item = await importarNotaPaulistana(nota);
        if (item.importada) importadas += 1;
        else if (item.duplicada) duplicadas += 1;
        else ignoradas += 1;
      }
      if (!resultado.temProximaPagina) break;
      pagina += 1;
    }

    const ok = `${importadas} XML(s) novo(s) importado(s) para Arquivo. ${duplicadas} nota(s) já existente(s) ignorada(s). ${ignoradas} documento(s) sem dados suficientes.`;
    res.send(renderPagina(req, { ok, dataInicial, dataFinal }));
  } catch (error) {
    console.error('Erro na integração Nota Fiscal Paulistana:', error);
    res.status(502).send(renderPagina(req, {
      erro: 'Não foi possível concluir a consulta à Nota Fiscal Paulistana. Tente novamente ou contate o administrador.',
      dataInicial,
      dataFinal
    }));
  }
});

function renderSefazPage(req, { candidatas = [], ok = '', erro = '', consulta = null } = {}) {
  const cfg = obterConfigSefaz();
  const disponivel = !!cfg.certPath && !!cfg.certPassword && cfg.cnpj.length === 14;
  const resumos = consulta?.documentos || [];
  const linhasResumos = resumos.map((item, index) => `
    <tr>
      <td><input class="check" type="checkbox" name="chaves" value="${escapeHtml(item.chave)}" id="resumo-${index}"></td>
      <td><label class="row-label" for="resumo-${index}">${escapeHtml(item.fornecedor || 'Fornecedor não informado')}</label><small>${escapeHtml(item.cnpjFornecedor || '')}</small></td>
      <td>${escapeHtml(String(item.dataEmissao || '').slice(0, 10) || '-')}</td>
      <td>${formatarMoeda(item.valor)}</td>
      <td class="chave">${escapeHtml(item.chave)}</td>
    </tr>
  `).join('');
  const linhasCandidatas = candidatas.map((item, index) => {
    const itens = Array.isArray(item.itens) ? item.itens : [];
    const resumoItens = itens.slice(0, 3).map(produto => produto.descricao).filter(Boolean).join(' | ');
    const marcada = item.classificacao === 'CONSUMO' ? 'checked' : '';
    return `<tr>
      <td><input class="check" type="checkbox" name="chaves" value="${escapeHtml(item.chave)}" id="candidata-${index}" ${marcada}></td>
      <td><label class="row-label" for="candidata-${index}">${escapeHtml(item.fornecedor || 'Fornecedor não informado')}</label><small>${escapeHtml(item.cnpj_fornecedor || '')}</small></td>
      <td>${escapeHtml(String(item.data_emissao || '').slice(0, 10) || '-')}</td>
      <td>${formatarMoeda(item.valor)}</td>
      <td><span class="badge ${String(item.classificacao || '').toLowerCase()}">${escapeHtml(item.classificacao || 'REVISAO')}</span><small>${escapeHtml(resumoItens || item.natureza || '')}</small></td>
      <td>${item.status === 'PRONTO' ? 'XML disponível' : 'Aguardando XML'}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Caixa SEFAZ - PlennaTec</title><style>
  *{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:#172033;background:linear-gradient(135deg,#baf2cf 0%,#f8fafc 42%,#eef2f7 100%);min-height:100vh}.shell{width:min(1500px,calc(100vw - 48px));margin:18px auto 28px}.top,.nav,.card{background:rgba(255,255,255,.94);border:1px solid #e2e8f0;border-radius:22px;box-shadow:0 18px 45px rgba(15,23,42,.08)}.top{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:18px 24px;margin-bottom:14px}.top h1{margin:0 0 6px;font-size:30px}.top p{margin:0;color:#52627a;font-weight:700}.user{font-weight:900;color:#00b050;text-align:right}.user span{display:block;font-size:11px;color:#64748b;text-transform:uppercase;margin-top:4px}.nav{display:flex;gap:10px;flex-wrap:wrap;padding:10px 14px;margin-bottom:16px}.nav a{height:40px;padding:0 14px;border-radius:11px;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;background:linear-gradient(180deg,#f8fafc,#eef2f7);color:#009640;border:1px solid #d7eadf}.card{padding:22px;margin-bottom:16px}.card h2{margin:0 0 7px;font-size:20px}.card p{margin:0 0 16px;color:#52627a;font-weight:700;line-height:1.4}.actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.btn{min-height:42px;border:0;border-radius:12px;background:linear-gradient(135deg,#00b050,#009640);color:#fff;font:900 13px Arial;padding:0 18px;cursor:pointer;box-shadow:0 12px 22px rgba(0,176,80,.18)}.btn.secondary{background:linear-gradient(180deg,#f8fafc,#eef2f7);color:#172033;border:1px solid #dbe7df;box-shadow:none}.btn:disabled{background:#94a3b8;box-shadow:none}.alert{padding:14px 16px;border-radius:14px;margin-bottom:14px;font-weight:800}.ok{background:#dcfce7;color:#166534;border:1px solid #86efac}.err{background:#fee2e2;color:#991b1b;border:1px solid #fecaca}.warn{background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}.table-wrap{overflow:auto;border:1px solid #e2e8f0;border-radius:14px;margin-bottom:16px}table{width:100%;border-collapse:collapse;background:#fff}th,td{padding:11px 12px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:13px;vertical-align:middle}th{background:#f8fafc;color:#475569;font-size:11px;text-transform:uppercase}small{display:block;color:#64748b;margin-top:4px;max-width:520px}.check{width:18px;height:18px}.row-label{font-weight:900;cursor:pointer}.chave{font-size:10px;color:#64748b;max-width:240px;overflow-wrap:anywhere}.badge{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:10px;font-weight:900;background:#f1f5f9}.badge.consumo{background:#dcfce7;color:#166534}.badge.estoque{background:#dbeafe;color:#1d4ed8}.badge.revisao{background:#fef3c7;color:#92400e}@media(max-width:760px){.shell{width:calc(100vw - 24px)}.top{flex-direction:column;align-items:flex-start}.user{text-align:left}.btn{width:100%}}
  </style></head><body><main class="shell">
  <section class="top"><div><h1>Caixa de Entrada SEFAZ</h1><p>Consulte NF-e destinadas à empresa e importe somente as despesas aprovadas.</p></div><div class="user">${escapeHtml(req.session.usuario.nome)}<span>${escapeHtml(req.session.usuario.perfil)}</span></div></section>
  <nav class="nav"><a href="/dashboard">Voltar para o Painel</a><a href="/arquivo">Arquivo</a><a href="/nfpaulistana">Nota Fiscal Paulistana</a><a href="/logout">Sair</a></nav>
  ${ok ? `<div class="alert ok">${escapeHtml(ok)}</div>` : ''}${erro ? `<div class="alert err">${escapeHtml(erro)}</div>` : ''}${!disponivel ? '<div class="alert warn">A integração ainda precisa ser configurada pelo administrador.</div>' : ''}
  <section class="card"><h2>Consultar próximo lote</h2><p>Cada consulta apresenta até 50 resumos sem armazenar XMLs. O NSU só avança quando você concluir a análise do lote.</p><form method="post" action="/sefaz/consultar"><button class="btn" type="submit" ${disponivel ? '' : 'disabled'}>Consultar próximo lote</button></form></section>
  ${consulta ? `<section class="card"><h2>Lote consultado</h2><p>Marque somente as notas que deseja analisar. Ao concluir, as não selecionadas serão descartadas sem ocupar armazenamento.</p><form method="post" action="/sefaz/processar-lote"><div class="table-wrap"><table><thead><tr><th></th><th>Fornecedor</th><th>Emissão</th><th>Valor</th><th>Chave</th></tr></thead><tbody>${linhasResumos || '<tr><td colspan="5">Nenhum resumo novo neste lote.</td></tr>'}</tbody></table></div><div class="actions"><button class="btn" type="submit">Analisar selecionadas e concluir lote</button><button class="btn secondary" name="descartarTudo" value="1" type="submit">Descartar lote sem importar</button></div></form></section>` : ''}
  <section class="card"><h2>Notas classificadas</h2><p>Somente notas marcadas abaixo serão enviadas para a tela Arquivo. Consumo vem pré-selecionado; estoque e revisão exigem decisão manual.</p><form method="post" action="/sefaz/importar"><div class="table-wrap"><table><thead><tr><th></th><th>Fornecedor</th><th>Emissão</th><th>Valor</th><th>Classificação</th><th>Situação</th></tr></thead><tbody>${linhasCandidatas || '<tr><td colspan="6">Nenhuma nota aguardando decisão.</td></tr>'}</tbody></table></div><div class="actions"><button class="btn" type="submit" ${candidatas.length ? '' : 'disabled'}>Importar selecionadas para Arquivo</button><button class="btn secondary" formaction="/sefaz/reanalisar" type="submit" ${candidatas.length ? '' : 'disabled'}>Atualizar XMLs pendentes</button><button class="btn secondary" formaction="/sefaz/ignorar" type="submit" ${candidatas.length ? '' : 'disabled'} onclick="return confirm('Descartar as notas selecionadas sem guardar arquivos?')">Ignorar selecionadas</button></div></form></section>
  </main></body></html>`;
}

async function responderSefaz(req, res, extras = {}) {
  const candidatas = await listarCandidatasSefaz();
  res.send(renderSefazPage(req, { candidatas, consulta: req.session.sefazConsultaAtual || null, ...extras }));
}

router.get('/sefaz', protegerIntegracao, async (req, res) => {
  try { await responderSefaz(req, res); }
  catch (error) { console.error('Erro ao abrir Caixa SEFAZ:', error); res.status(500).send('<pre>Não foi possível abrir a Caixa SEFAZ.</pre>'); }
});

router.post('/sefaz/consultar', protegerIntegracao, async (req, res) => {
  try {
    await ensureArquivoFila();
    await ensureSefazTables();
    const ultimoNsu = await obterUltimoNsuSefaz();
    const resultado = await consultarDistribuicao({ ultimoNsu });
    const resumos = [];
    let descartadas = 0;
    let duplicadas = 0;

    for (const documento of resultado.documentos) {
      if (!documento.chave || await chaveFiscalJaExiste(documento.chave)) {
        duplicadas += 1;
        continue;
      }
      if (documento.tipo === 'XML_COMPLETO') {
        if (documento.classificacao === 'RETORNO_REMESSA') descartadas += 1;
        else await salvarCandidataSefaz(documento, 'PRONTO');
      } else if (documento.tipo === 'RESUMO') {
        resumos.push(documento);
      } else {
        descartadas += 1;
      }
    }

    req.session.sefazConsultaAtual = {
      ultimoNsuAnterior: ultimoNsu,
      ultimoNsuNovo: resultado.ultimoNsu || ultimoNsu,
      maxNsu: resultado.maxNsu || '',
      documentos: resumos
    };
    await responderSefaz(req, res, { ok: `${resumos.length} resumo(s) aguardando seleção. ${duplicadas} já existente(s) e ${descartadas} retorno(s) ou documento(s) não aplicável(is) foram ignorados.` });
  } catch (error) {
    console.error('Erro ao consultar SEFAZ:', error);
    await responderSefaz(req, res, { erro: 'Não foi possível consultar a SEFAZ. Tente novamente ou contate o administrador.' });
  }
});

router.post('/sefaz/processar-lote', protegerIntegracao, async (req, res) => {
  const consulta = req.session.sefazConsultaAtual;
  if (!consulta) return res.redirect('/sefaz');
  try {
    const selecionadas = req.body.descartarTudo ? [] : normalizarLista(req.body.chaves);
    const porChave = new Map((consulta.documentos || []).map(item => [item.chave, item]));
    let analisadas = 0;
    let descartadas = (consulta.documentos || []).length - selecionadas.length;
    let pendentes = 0;

    for (const chave of selecionadas.slice(0, 50)) {
      const resumo = porChave.get(chave);
      if (!resumo || await chaveFiscalJaExiste(chave)) continue;
      const ciencia = await manifestarCiencia({ chave });
      if (!ciencia.ok) {
        await salvarCandidataSefaz(resumo, 'AGUARDANDO_XML');
        pendentes += 1;
        continue;
      }
      const consultaChave = await consultarPorChave({ chave });
      const completa = consultaChave.documentos.find(item => item.tipo === 'XML_COMPLETO');
      if (!completa) {
        await salvarCandidataSefaz(resumo, 'AGUARDANDO_XML');
        pendentes += 1;
      } else if (completa.classificacao === 'RETORNO_REMESSA') {
        descartadas += 1;
      } else {
        await salvarCandidataSefaz(completa, 'PRONTO');
        analisadas += 1;
      }
    }

    await salvarUltimoNsuSefaz(consulta.ultimoNsuNovo);
    req.session.sefazConsultaAtual = null;
    await responderSefaz(req, res, { ok: `${analisadas} nota(s) classificada(s). ${pendentes} aguardando liberação do XML. ${descartadas} descartada(s) sem armazenar arquivo.` });
  } catch (error) {
    console.error('Erro ao processar lote SEFAZ:', error);
    await responderSefaz(req, res, { erro: 'Não foi possível concluir a análise do lote. O NSU não foi avançado; tente novamente.' });
  }
});

router.post('/sefaz/reanalisar', protegerIntegracao, async (req, res) => {
  try {
    const chaves = normalizarLista(req.body.chaves);
    let atualizadas = 0;
    for (const chave of chaves.slice(0, 50)) {
      const consulta = await consultarPorChave({ chave });
      const completa = consulta.documentos.find(item => item.tipo === 'XML_COMPLETO');
      if (!completa) continue;
      if (completa.classificacao === 'RETORNO_REMESSA') await pool.query(`DELETE FROM sefaz_candidatas WHERE chave = $1`, [chave]);
      else await salvarCandidataSefaz(completa, 'PRONTO');
      atualizadas += 1;
    }
    await responderSefaz(req, res, { ok: `${atualizadas} nota(s) atualizada(s).` });
  } catch (error) {
    console.error('Erro ao atualizar XMLs da SEFAZ:', error);
    await responderSefaz(req, res, { erro: 'Não foi possível atualizar os XMLs selecionados.' });
  }
});

router.post('/sefaz/importar', protegerIntegracao, async (req, res) => {
  try {
    await ensureArquivoFila();
    await ensureSefazTables();
    const chaves = normalizarLista(req.body.chaves);
    let importadas = 0;
    let duplicadas = 0;
    let pendentes = 0;
    for (const chave of chaves.slice(0, 100)) {
      if (await chaveFiscalJaExiste(chave)) {
        duplicadas += 1;
        await pool.query(`DELETE FROM sefaz_candidatas WHERE chave = $1`, [chave]);
        continue;
      }
      const consulta = await consultarPorChave({ chave });
      const completa = consulta.documentos.find(item => item.tipo === 'XML_COMPLETO');
      if (!completa) { pendentes += 1; continue; }
      const resultado = await importarNfeSefaz(completa);
      if (resultado.importada) importadas += 1;
      else if (resultado.duplicada) duplicadas += 1;
      else pendentes += 1;
      if (resultado.importada || resultado.duplicada) await pool.query(`DELETE FROM sefaz_candidatas WHERE chave = $1`, [chave]);
    }
    await responderSefaz(req, res, { ok: `${importadas} XML(s) importado(s) para Arquivo. ${duplicadas} já existente(s) ignorado(s). ${pendentes} ainda aguardando XML completo.` });
  } catch (error) {
    console.error('Erro ao importar XMLs da SEFAZ:', error);
    await responderSefaz(req, res, { erro: 'Não foi possível importar todas as notas selecionadas.' });
  }
});

router.post('/sefaz/ignorar', protegerIntegracao, async (req, res) => {
  try {
    await ensureSefazTables();
    const chaves = normalizarLista(req.body.chaves).filter(chave => /^\d{44}$/.test(chave));
    let ignoradas = 0;
    for (const chave of chaves.slice(0, 100)) {
      const result = await pool.query(`DELETE FROM sefaz_candidatas WHERE chave = $1`, [chave]);
      ignoradas += result.rowCount;
    }
    await responderSefaz(req, res, { ok: `${ignoradas} nota(s) ignorada(s) sem armazenar arquivo.` });
  } catch (error) {
    console.error('Erro ao ignorar candidatas da SEFAZ:', error);
    await responderSefaz(req, res, { erro: 'Não foi possível ignorar as notas selecionadas.' });
  }
});

module.exports = router;
