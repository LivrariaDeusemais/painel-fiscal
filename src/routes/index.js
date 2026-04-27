const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
function protegerRota(req, res, next) {
  if (!req.session || !req.session.usuario) {
    return res.redirect('/login');
  }
  next();
}

function somenteAdmin(req, res, next) {
  if (!req.session.usuario || req.session.usuario.perfil !== 'ADMIN') {
    return res.status(403).send('<pre>Acesso negado. Apenas ADMIN pode acessar esta área.</pre>');
  }
  next();
}

function permitirPerfis(...perfis) {
  return (req, res, next) => {
    if (!req.session.usuario || !perfis.includes(req.session.usuario.perfil)) {
      return res.status(403).send('<pre>Acesso negado para este perfil de usuário.</pre>');
    }
    next();
  };
}

const ExcelJS = require('exceljs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xml2js = require('xml2js');
const archiver = require('archiver');

// CONFIG UPLOAD

const uploadsDir = '/uploads';

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

function getUploadFilePath(filename) {
  if (!filename) return null;
  // Segurança: garante que somente o nome do arquivo seja usado, sem caminhos externos.
  return path.join(uploadsDir, path.basename(String(filename)));
}

// Rota segura para visualizar/baixar arquivos salvos no disco persistente do Render.
router.get('/uploads/:filename', protegerRota, (req, res) => {
  try {
    const filePath = getUploadFilePath(req.params.filename);

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).send('<pre>Arquivo não encontrado no disco persistente.</pre>');
    }

    return res.sendFile(filePath);
  } catch (error) {
    return res.status(500).send(`<pre>Erro ao abrir arquivo:\n${error.message}</pre>`);
  }
});
// HELPERS
function formatMoneyBR(valor) {
  const numero = Number(valor || 0);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numero);
}

function parseMoneyBR(valor) {
  if (valor === undefined || valor === null) return null;
  let texto = String(valor).trim();
  if (!texto) return null;
  texto = texto.replace(/R\$/gi, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero.toFixed(2) : null;
}

function formatValorInputBR(valor) {
  if (valor === undefined || valor === null || valor === '') return '';
  const numero = Number(valor || 0);
  return numero.toFixed(2).replace('.', ',');
}

const TIPOS_DOCUMENTO_PADRAO = [
  'NFe Produto',
  'NFEs Serviço',
  'Nota Débito',
  'Cupom Fiscal',
  'Recibo',
  'PIX',
  'Outro DOC'
];

function renderTipoDocumentoOptions(selectedValue = '') {
  const selectedText = String(selectedValue || '').trim();
  let options = '<option value="">Selecione o tipo de documento</option>';

  TIPOS_DOCUMENTO_PADRAO.forEach(tipo => {
    const selected = selectedText === tipo ? 'selected' : '';
    options += `<option value="${tipo}" ${selected}>${tipo}</option>`;
  });

  if (selectedText && !TIPOS_DOCUMENTO_PADRAO.includes(selectedText)) {
    options += `<option value="${selectedText}" selected>${selectedText}</option>`;
  }

  return options;
}

function formatMoneyFile(valor) {
  const numero = Number(valor || 0);
  return `RS${numero.toFixed(2).replace('.', ',')}`;
}

function sanitizeFilePart(text, preserveSpaces = false) {
  let value = String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\/\\:*?"<>|]/g, '')
    .trim();

  if (preserveSpaces) {
    value = value.replace(/\s+/g, ' ');
  } else {
    value = value.replace(/\s+/g, '-');
  }

  return value;
}

function buildDownloadBaseName(lancamento) {
  const tipoPagamento = sanitizeFilePart(lancamento.tipo_pagamento || 'SEM PAGAMENTO', true);
  const fornecedor = sanitizeFilePart(lancamento.fornecedor || 'SEM FORNECEDOR', true);
  const categoria = sanitizeFilePart(lancamento.categoria || 'SEM CATEGORIA', true);
  const numeroDocumento = sanitizeFilePart(
    lancamento.numero_documento || lancamento.tipo_documento || 'SEM DOCUMENTO',
    true
  );
  const valor = formatMoneyFile(lancamento.valor);

  return `${tipoPagamento}-${fornecedor}-${categoria}-${numeroDocumento}-${valor}`;
}

function stripNamespace(name) {
  return String(name || '').split(':').pop();
}

function removeNamespaces(obj) {
  if (Array.isArray(obj)) return obj.map(removeNamespaces);

  if (obj && typeof obj === 'object') {
    const novo = {};
    for (const key of Object.keys(obj)) {
      novo[stripNamespace(key)] = removeNamespaces(obj[key]);
    }
    return novo;
  }

  return obj;
}

function getDeep(obj, pathArray) {
  let current = obj;
  for (const key of pathArray) {
    if (!current || !(key in current)) return null;
    current = current[key];
  }
  return current;
}

function pickFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function normalizeDate(dateValue) {
  if (!dateValue) return '';
  const text = String(dateValue).trim();

  if (text.includes('T')) return text.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  if (text.includes('/')) {
    const partes = text.split(' ')[0].split('/');
    if (partes.length === 3) {
      return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }
  }

  return text;
}

function formatDateBR(dateValue) {
  if (!dateValue) return '';

  // PostgreSQL pode devolver DATE como objeto Date.
  // Usamos UTC para evitar virar o dia por causa de fuso horário.
  if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
    const dia = String(dateValue.getUTCDate()).padStart(2, '0');
    const mes = String(dateValue.getUTCMonth() + 1).padStart(2, '0');
    const ano = dateValue.getUTCFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  const text = String(dateValue).trim();
  if (!text) return '';

  const iso = text.includes('T') ? text.split('T')[0] : text;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  return text;
}

function formatDateInput(dateValue) {
  if (!dateValue) return '';

  if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
    const dia = String(dateValue.getUTCDate()).padStart(2, '0');
    const mes = String(dateValue.getUTCMonth() + 1).padStart(2, '0');
    const ano = dateValue.getUTCFullYear();
    return `${ano}-${mes}-${dia}`;
  }

  const text = String(dateValue).trim();
  if (!text) return '';

  const iso = text.includes('T') ? text.split('T')[0] : text;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : '';
}

async function parseXmlDocumento(filePath) {
  const xmlContent = fs.readFileSync(filePath, 'utf8');

  function toNumberString(value) {
    if (value === undefined || value === null) return '';
    const text = String(value).trim();
    if (!text) return '';

    if (text.includes(',') && text.includes('.')) {
      return text.replace(/\./g, '').replace(',', '.');
    }

    if (text.includes(',')) {
      return text.replace(',', '.');
    }

    return text;
  }

  function extractFirst(obj, paths) {
    for (const pathArray of paths) {
      const value = getDeep(obj, pathArray);
      const picked = pickFirst(value);
      if (picked) return picked;
    }
    return '';
  }

  // ===== NFS-e Cajamar / ConsultaSituacaoLoteAsyncResposta =====
  if (/<ConsultaSituacaoLoteAsyncResposta>/i.test(xmlContent) && /<Nfse>/i.test(xmlContent)) {
    const parser = new xml2js.Parser({ explicitArray: false, trim: true });
    const parsed = await parser.parseStringPromise(xmlContent);

    const nfse = getDeep(parsed, ['ConsultaSituacaoLoteAsyncResposta', 'Nfse']) || {};
    const prestador = nfse.PrestadorServico || {};
    const identificacaoPrestador = prestador.IdentificacaoPrestador || {};
    const identificacaoNfse = nfse.IdentificacaoNfse || {};
    const servico = nfse.Servico || {};
    const valores = servico.Valores || {};

    return {
      origem_layout: 'NFS-e Cajamar',
      status: 'Lido automaticamente',
      tipo_documento: 'NFS-e',
      numero_documento: pickFirst(identificacaoNfse.NumeroNfse, getDeep(nfse, ['IdentificacaoRps', 'NumeroRps'])),
      data_documento: normalizeDate(pickFirst(nfse.DataEmissao, nfse.DataLancamento)),
      fornecedor: pickFirst(prestador.RazaoSocial),
      cnpj_cpf: pickFirst(identificacaoPrestador.CnpjCpf),
      valor: toNumberString(pickFirst(valores.ValorServicos, valores.BaseCalculo)),
      erro_leitura: null
    };
  }

  // ===== NFS-e Prefeitura SP =====
  if (/<RetornoConsulta/i.test(xmlContent) && /<NumeroNFe>/i.test(xmlContent)) {
    const parser = new xml2js.Parser({ explicitArray: false, trim: true });
    const parsedOriginal = await parser.parseStringPromise(xmlContent);
    const parsed = removeNamespaces(parsedOriginal);

    const nfe = getDeep(parsed, ['RetornoConsulta', 'NFe']) || {};

    return {
      origem_layout: 'NFS-e Prefeitura SP',
      status: 'Lido automaticamente',
      tipo_documento: 'NFS-e',
      numero_documento: pickFirst(
        getDeep(nfe, ['ChaveNFe', 'NumeroNFe']),
        nfe.NumeroNFe,
        nfe.Numero,
        nfe.NumeroNota
      ),
      data_documento: normalizeDate(pickFirst(
        nfe.DataEmissaoNFe,
        nfe.DataEmissaoRPS,
        nfe.DataFatoGeradorNFe
      )),
      fornecedor: pickFirst(nfe.RazaoSocialPrestador, nfe.Prestador, nfe.NomePrestador),
      cnpj_cpf: pickFirst(
        getDeep(nfe, ['CPFCNPJPrestador', 'CNPJ']),
        getDeep(nfe, ['CPFCNPJPrestador', 'CPF'])
      ),
      valor: toNumberString(pickFirst(nfe.ValorServicos, nfe.ValorFinalCobrado, nfe.ValorLiquidoNFe)),
      erro_leitura: null
    };
  }

  // ===== NFS-e nacional / diversos layouts =====
  if (/<NFSe/i.test(xmlContent) || /<infNFSe/i.test(xmlContent) || /<DPS/i.test(xmlContent)) {
    try {
      const parser = new xml2js.Parser({ explicitArray: false, trim: true });
      const parsedOriginal = await parser.parseStringPromise(xmlContent);
      const parsed = removeNamespaces(parsedOriginal);

      const infNFSe =
        getDeep(parsed, ['NFSe', 'infNFSe']) ||
        getDeep(parsed, ['NFSe', 'Nfse', 'infNFSe']) ||
        getDeep(parsed, ['Nfse', 'infNFSe']) ||
        getDeep(parsed, ['CompNfse', 'Nfse', 'InfNfse']) ||
        getDeep(parsed, ['CompNfse', 'Nfse', 'infNfse']) ||
        getDeep(parsed, ['GerarNfseResposta', 'ListaNfse', 'CompNfse', 'Nfse', 'InfNfse']) ||
        {};

      const emit =
        infNFSe.emit ||
        infNFSe.Emit ||
        infNFSe.prest ||
        infNFSe.PrestadorServico ||
        getDeep(infNFSe, ['Prestador']) ||
        {};

      const valores =
        infNFSe.valores ||
        infNFSe.Valores ||
        getDeep(infNFSe, ['Servico', 'Valores']) ||
        {};

      const dps =
        infNFSe.DPS ||
        infNFSe.dps ||
        getDeep(infNFSe, ['DeclaracaoPrestacaoServico']) ||
        getDeep(infNFSe, ['InfDeclaracaoPrestacaoServico']) ||
        {};

      const prestadorServico =
        getDeep(infNFSe, ['PrestadorServico']) ||
        getDeep(dps, ['Prestador']) ||
        getDeep(dps, ['PrestadorServico']) ||
        {};

      const identificacaoPrestador =
        getDeep(prestadorServico, ['IdentificacaoPrestador']) ||
        getDeep(prestadorServico, ['CpfCnpj']) ||
        {};

      const numeroDocumento = extractFirst(parsed, [
        ['NFSe', 'infNFSe', 'nNFSe'],
        ['NFSe', 'infNFSe', 'nDFSe'],
        ['Nfse', 'infNFSe', 'nNFSe'],
        ['CompNfse', 'Nfse', 'InfNfse', 'Numero'],
        ['CompNfse', 'Nfse', 'infNfse', 'Numero'],
        ['GerarNfseResposta', 'ListaNfse', 'CompNfse', 'Nfse', 'InfNfse', 'Numero']
      ]) || pickFirst(
        infNFSe.nNFSe,
        infNFSe.nDFSe,
        infNFSe.Numero,
        infNFSe.numero
      );

      const dataDocumento = normalizeDate(
        extractFirst(parsed, [
          ['NFSe', 'infNFSe', 'dhProc'],
          ['NFSe', 'infNFSe', 'dhEmi'],
          ['NFSe', 'infNFSe', 'dCompet'],
          ['Nfse', 'infNFSe', 'dhProc'],
          ['CompNfse', 'Nfse', 'InfNfse', 'DataEmissao'],
          ['CompNfse', 'Nfse', 'infNfse', 'DataEmissao'],
          ['GerarNfseResposta', 'ListaNfse', 'CompNfse', 'Nfse', 'InfNfse', 'DataEmissao']
        ]) || pickFirst(
          infNFSe.dhProc,
          infNFSe.dhEmi,
          infNFSe.dCompet,
          infNFSe.DataEmissao
        )
      );

      const fornecedor = extractFirst(parsed, [
        ['NFSe', 'infNFSe', 'emit', 'xNome'],
        ['Nfse', 'infNFSe', 'emit', 'xNome'],
        ['CompNfse', 'Nfse', 'InfNfse', 'PrestadorServico', 'RazaoSocial'],
        ['CompNfse', 'Nfse', 'infNfse', 'PrestadorServico', 'RazaoSocial'],
        ['GerarNfseResposta', 'ListaNfse', 'CompNfse', 'Nfse', 'InfNfse', 'PrestadorServico', 'RazaoSocial']
      ]) || pickFirst(
        emit.xNome,
        emit.nome,
        emit.RazaoSocial,
        prestadorServico.RazaoSocial,
        prestadorServico.razaoSocial
      );

      const cnpjCpf = extractFirst(parsed, [
        ['NFSe', 'infNFSe', 'emit', 'CNPJ'],
        ['NFSe', 'infNFSe', 'emit', 'CPF'],
        ['Nfse', 'infNFSe', 'emit', 'CNPJ'],
        ['Nfse', 'infNFSe', 'emit', 'CPF'],
        ['CompNfse', 'Nfse', 'InfNfse', 'PrestadorServico', 'IdentificacaoPrestador', 'Cnpj'],
        ['CompNfse', 'Nfse', 'InfNfse', 'PrestadorServico', 'IdentificacaoPrestador', 'Cpf'],
        ['CompNfse', 'Nfse', 'infNfse', 'PrestadorServico', 'IdentificacaoPrestador', 'Cnpj'],
        ['CompNfse', 'Nfse', 'infNfse', 'PrestadorServico', 'IdentificacaoPrestador', 'Cpf'],
        ['GerarNfseResposta', 'ListaNfse', 'CompNfse', 'Nfse', 'InfNfse', 'PrestadorServico', 'IdentificacaoPrestador', 'Cnpj'],
        ['GerarNfseResposta', 'ListaNfse', 'CompNfse', 'Nfse', 'InfNfse', 'PrestadorServico', 'IdentificacaoPrestador', 'Cpf']
      ]) || pickFirst(
        emit.CNPJ,
        emit.CPF,
        identificacaoPrestador.Cnpj,
        identificacaoPrestador.CPF,
        identificacaoPrestador.CnpjCpf
      );

      const valor = toNumberString(
        extractFirst(parsed, [
          ['NFSe', 'infNFSe', 'valores', 'vLiq'],
          ['NFSe', 'infNFSe', 'valores', 'vBC'],
          ['Nfse', 'infNFSe', 'valores', 'vLiq'],
          ['Nfse', 'infNFSe', 'valores', 'vBC'],
          ['CompNfse', 'Nfse', 'InfNfse', 'Servico', 'Valores', 'ValorServicos'],
          ['CompNfse', 'Nfse', 'infNfse', 'Servico', 'Valores', 'ValorServicos'],
          ['GerarNfseResposta', 'ListaNfse', 'CompNfse', 'Nfse', 'InfNfse', 'Servico', 'Valores', 'ValorServicos']
        ]) || pickFirst(
          valores.vLiq,
          valores.vBC,
          valores.ValorServicos,
          valores.ValorLiquidoNfse,
          valores.ValorLiquido,
          infNFSe.valor,
          infNFSe.ValorServicos
        )
      );

      if (fornecedor || cnpjCpf || valor || dataDocumento || numeroDocumento) {
        return {
          origem_layout: 'NFS-e NFSe nacional',
          status: 'Lido automaticamente',
          tipo_documento: 'NFS-e',
          numero_documento: numeroDocumento,
          data_documento: dataDocumento,
          fornecedor,
          cnpj_cpf: cnpjCpf,
          valor,
          erro_leitura: null
        };
      }
    } catch (error) {
      // segue para próximas tentativas
    }
  }

  // ===== NF-e padrão =====
  try {
    const parser = new xml2js.Parser({
      explicitArray: false,
      trim: true,
      normalizeTags: false
    });

    const parsedOriginal = await parser.parseStringPromise(xmlContent);
    const parsed = removeNamespaces(parsedOriginal);

    const nfe =
      getDeep(parsed, ['nfeProc', 'NFe', 'infNFe']) ||
      getDeep(parsed, ['NFe', 'infNFe']) ||
      getDeep(parsed, ['procNFe', 'NFe', 'infNFe']) ||
      getDeep(parsed, ['enviNFe', 'NFe', 'infNFe']) ||
      null;

    if (nfe) {
      const emit = nfe.emit || {};
      const ide = nfe.ide || {};
      const total = getDeep(nfe, ['total', 'ICMSTot']) || {};

      return {
        origem_layout: 'NF-e padrão',
        status: 'Lido automaticamente',
        tipo_documento: 'NF-e',
        numero_documento: pickFirst(ide.nNF, ide.cNF, ide.serie),
        data_documento: normalizeDate(pickFirst(ide.dhEmi, ide.dEmi, ide.dhSaiEnt, ide.dSaiEnt)),
        fornecedor: pickFirst(emit.xNome, emit.xFant),
        cnpj_cpf: pickFirst(emit.CNPJ, emit.CPF),
        valor: toNumberString(pickFirst(total.vNF, total.vProd, total.vLiq)),
        erro_leitura: null
      };
    }
  } catch (error) {
    // segue para fallback
  }

  return {
    origem_layout: 'Nao identificado',
    status: 'Nao reconhecido',
    tipo_documento: '',
    numero_documento: '',
    data_documento: '',
    fornecedor: '',
    cnpj_cpf: '',
    valor: '',
    erro_leitura: 'Layout de XML ainda não reconhecido automaticamente.'
  };
}

async function getCategoriasOptions(selectedValue = '') {
  const categorias = await pool.query('SELECT * FROM categorias ORDER BY nome ASC');
  let options = '<option value="">Selecione a categoria</option>';
  categorias.rows.forEach(cat => {
    const selected = String(selectedValue) === String(cat.id) ? 'selected' : '';
    options += `<option value="${cat.id}" ${selected}>${cat.nome}</option>`;
  });
  return options;
}

function renderDashboard(data) {
  const {
    totalLancamentos = 0,
    valorTotal = 0,
    totalCategorias = 0,
    totalFornecedores = 0,
    meses = [],
    categorias = [],
    fornecedores = [],
    mesSelecionado = ''
  } = data || {};

  const formatMoney = (valor) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(valor || 0));

  const escapeHtml = (text = '') =>
    String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const hoje = new Date();
  const opcoesMes = [];

  for (let i = 0; i < 12; i++) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const valor = `${ano}-${mes}`;
    const label = data.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric'
    });

    opcoesMes.push({
      valor,
      label: label.charAt(0).toUpperCase() + label.slice(1)
    });
  }

  const opcoesMesHtml = opcoesMes.map(item => `
    <option value="${item.valor}" ${mesSelecionado === item.valor ? 'selected' : ''}>
      ${escapeHtml(item.label)}
    </option>
  `).join('');

  const subtituloFiltro = mesSelecionado
    ? `Dados filtrados para o mês ${escapeHtml(
        opcoesMes.find(m => m.valor === mesSelecionado)?.label || mesSelecionado
      )}.`
    : 'Visão executiva geral das despesas, lançamentos e distribuição financeira.';

  const maxMes = Math.max(...meses.map(m => Number(m.total || 0)), 1);
  const yTicks = [maxMes, maxMes * 0.75, maxMes * 0.5, maxMes * 0.25, 0];
  const chartW = 520;
  const chartH = 245;
  const plotLeft = 70;
  const plotRight = 28;
  const plotTop = 22;
  const plotBottom = 42;
  const plotW = chartW - plotLeft - plotRight;
  const plotH = chartH - plotTop - plotBottom;

  const points = meses.map((item, index) => {
    const x = plotLeft + (meses.length <= 1 ? 0 : (index * plotW) / (meses.length - 1));
    const y = plotTop + plotH - ((Number(item.total || 0) / maxMes) * plotH);
    return { x, y, item, total: Number(item.total || 0) };
  });

  const svgPoints = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPoints = points.length
    ? `${points[0].x.toFixed(1)},${plotTop + plotH} ${svgPoints} ${points[points.length - 1].x.toFixed(1)},${plotTop + plotH}`
    : '';

  const gridHtml = yTicks.map(value => {
    const y = plotTop + plotH - ((Number(value || 0) / maxMes) * plotH);
    return `
      <line x1="${plotLeft}" y1="${y.toFixed(1)}" x2="${chartW - plotRight}" y2="${y.toFixed(1)}" class="grid-line" />
      <text x="8" y="${(y + 4).toFixed(1)}" class="axis-label">${formatMoney(value).replace(',00', '')}</text>
    `;
  }).join('');

  const pointsHtml = points.map(p => `
    <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" class="line-dot" />
    <text x="${p.x.toFixed(1)}" y="${Math.max(14, p.y - 14).toFixed(1)}" text-anchor="middle" class="point-value">${formatMoney(p.total)}</text>
  `).join('');

  const xLabelsHtml = points.map(p => `
    <text x="${p.x.toFixed(1)}" y="${chartH - 10}" text-anchor="middle" class="month-label">${escapeHtml(p.item.label)}</text>
  `).join('');

  const mesesHtml = meses.length
    ? `
      <svg class="line-chart" viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="none" aria-label="Despesas por mês">
        <defs>
          <linearGradient id="areaOrange" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#00B050" stop-opacity="0.38" />
            <stop offset="100%" stop-color="#00B050" stop-opacity="0.02" />
          </linearGradient>
        </defs>
        ${gridHtml}
        <line x1="${plotLeft}" y1="${plotTop}" x2="${plotLeft}" y2="${plotTop + plotH}" class="axis-line" />
        <line x1="${plotLeft}" y1="${plotTop + plotH}" x2="${chartW - plotRight}" y2="${plotTop + plotH}" class="axis-line" />
        <polygon points="${areaPoints}" fill="url(#areaOrange)" />
        <polyline points="${svgPoints}" class="trend-line" />
        ${pointsHtml}
        ${xLabelsHtml}
      </svg>
    `
    : `<div class="empty-state">Sem dados de despesas por mês.</div>`;

  const categoriasHtml = categorias.length
    ? categorias.map(item => {
        const total = Number(item.total || 0);
        const maxCategoria = Math.max(...categorias.map(c => Number(c.total || 0)), 1);
        const largura = Math.max((total / maxCategoria) * 100, total > 0 ? 5 : 0);
        return `
          <div class="hbar-row">
            <div class="hbar-header">
              <span>${escapeHtml(item.nome)}</span>
              <strong>${formatMoney(total)}</strong>
            </div>
            <div class="hbar-track">
              <div class="hbar-fill hbar-orange" style="width:${largura}%;"></div>
            </div>
          </div>
        `;
      }).join('')
    : `<div class="empty-state">Sem dados por categoria para o filtro selecionado.</div>`;

  const fornecedoresHtml = fornecedores.length
    ? fornecedores.map(item => {
        const total = Number(item.total || 0);
        const maxFornecedor = Math.max(...fornecedores.map(f => Number(f.total || 0)), 1);
        const largura = Math.max((total / maxFornecedor) * 100, total > 0 ? 5 : 0);
        return `
          <div class="hbar-row">
            <div class="hbar-header">
              <span>${escapeHtml(item.nome)}</span>
              <strong>${formatMoney(total)}</strong>
            </div>
            <div class="hbar-track">
              <div class="hbar-fill hbar-green" style="width:${largura}%;"></div>
            </div>
          </div>
        `;
      }).join('')
    : `<div class="empty-state">Sem dados por fornecedor para o filtro selecionado.</div>`;

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Painel Fiscal - Deus é Mais</title>
      <style>
        * { box-sizing: border-box; }

        :root {
          --orange: #00B050;
          --orange-dark: #009640;
          --green: #1fbd42;
          --text: #172033;
          --muted: #64748b;
          --soft: rgba(255, 255, 255, 0.78);
          --border: rgba(226, 232, 240, 0.82);
          --shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
        }

        body {
          margin: 0;
          min-height: 100vh;
          font-family: Arial, Helvetica, sans-serif;
          color: var(--text);
          background:
            radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
            radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
            linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%);
        }

        .page-shell {
          width: min(1680px, calc(100% - 64px));
          margin: 18px auto 12px;
        }

        .topbar,
        .nav-panel,
        .filter-panel,
        .stat-card,
        .chart-card {
          background: rgba(255, 255, 255, 0.82);
          border: 1px solid rgba(255, 255, 255, 0.72);
          border-radius: 18px;
          box-shadow: var(--shadow);
          backdrop-filter: blur(14px);
        }

        .topbar {
          min-height: 78px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 16px 26px;
          margin-bottom: 14px;
        }

        .brand-left {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }

        .app-mark {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: linear-gradient(180deg, #eef4ff, #ffffff);
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 4px;
          padding: 8px 9px 6px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.85);
        }

        .app-mark span {
          display: block;
          align-self: end;
          border-radius: 2px 2px 0 0;
        }

        .app-mark span:nth-child(1) { height: 24px; background: #1db954; }
        .app-mark span:nth-child(2) { height: 32px; background: #00B050; }
        .app-mark span:nth-child(3) { height: 19px; background: #2f80ed; }

        .brand-title h1 {
          margin: 0 0 5px;
          font-size: clamp(22px, 1.7vw, 30px);
          line-height: 1;
          letter-spacing: -0.7px;
          color: #101828;
        }

        .brand-title p {
          margin: 0;
          color: #52627a;
          font-size: 10px;
          font-weight: 600;
        }

        .profile-area {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 14px;
          flex-shrink: 0;
        }

        .profile-copy { text-align: right; }
        .profile-copy strong {
          display: block;
          color: var(--orange);
          font-size: 14px;
          margin-bottom: 4px;
        }
        .profile-copy span {
          color: #59677d;
          font-size: 10px;
          font-weight: 600;
        }

        .avatar-wrap {
          position: relative;
          width: 56px;
          height: 56px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: linear-gradient(180deg, #ffffff, #f5f7fb);
          border: 2px solid #e6ebf3;
          box-shadow: inset 0 2px 7px rgba(15, 23, 42, 0.04);
        }

        .avatar-icon {
          width: 31px;
          height: 31px;
          border-radius: 50%;
          background:
            radial-gradient(circle at 50% 28%, #c6ccd6 0 21%, transparent 22%),
            radial-gradient(ellipse at 50% 88%, #c6ccd6 0 45%, transparent 46%);
          opacity: .92;
        }

        .online-dot {
          position: absolute;
          right: 0;
          bottom: 8px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #23c33a;
          border: 3px solid white;
        }

        .logout-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-width: 96px;
          height: 50px;
          border-radius: 12px;
          text-decoration: none;
          color: #222b3b;
          font-weight: 800;
          background: linear-gradient(180deg, #f8fafc, #eef2f7);
          border: 1px solid #e0e6ef;
          box-shadow: 0 10px 20px rgba(15, 23, 42, .06);
        }

        .nav-panel {
          min-height: 64px;
          padding: 8px 36px;
          display: grid;
          grid-template-columns: 1.35fr repeat(5, 1fr);
          gap: 22px;
          align-items: center;
          margin-bottom: 18px;
        }

        .nav-btn {
          height: 52px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          text-decoration: none;
          color: #20293a;
          font-size: 14px;
          font-weight: 900;
          background: rgba(239, 242, 247, 0.72);
          border: 1px solid rgba(226, 232, 240, 0.72);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.9);
          transition: transform .16s ease, box-shadow .16s ease, background .16s ease;
        }

        .nav-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 26px rgba(15, 23, 42, .08);
        }

        .nav-btn.active {
          color: white;
          background: linear-gradient(135deg, #00B050, #009640);
          border-color: rgba(0, 176, 80, .9);
          box-shadow: 0 14px 24px rgba(0, 176, 80, .22);
        }

        .nav-icon,
        .stat-icon,
        .chart-soft-icon,
        .filter-icon,
        .logout-icon {
          width: 21px;
          height: 21px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: currentColor;
          flex-shrink: 0;
        }

        .nav-icon svg,
        .stat-icon svg,
        .filter-icon svg,
        .logout-icon svg { width: 100%; height: 100%; }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
          margin-bottom: 16px;
        }

        .stat-card {
          min-height: 112px;
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 18px 22px;
        }

        .stat-icon-box {
          width: 58px;
          height: 58px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
        }
        .stat-icon-box.orange { color: #00B050; background: #E8F7EE; }
        .stat-icon-box.green { color: #1db94b; background: #eaf9ed; }
        .stat-icon-box.purple { color: #8657ff; background: #f0eaff; }

        .stat-content small {
          display: block;
          color: #637083;
          font-size: 10px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .stat-content strong {
          display: block;
          color: #111827;
          font-size: 25px;
          letter-spacing: -0.4px;
          margin-bottom: 6px;
        }
        .stat-content span {
          color: #657386;
          font-size: 10px;
          font-weight: 600;
        }

        .filter-panel {
          min-height: 70px;
          padding: 12px 24px;
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 16px;
        }

        .filter-panel label {
          font-weight: 900;
          color: #1f2937;
          margin-right: 8px;
          font-size: 13px;
        }

        .filter-panel select,
        .filter-panel input[type="date"] {
          width: 310px;
          height: 44px;
          border-radius: 10px;
          border: 1px solid #dce3ec;
          padding: 0 18px;
          color: #334155;
          font-weight: 700;
          font-size: 13px;
          background: #fff;
          outline: none;
        }

        .btn-filter-apply {
          height: 44px;
          padding: 0 20px;
          border: none;
          border-radius: 11px;
          cursor: pointer;
          background: linear-gradient(135deg, #00B050, #009640);
          color: #fff;
          font-weight: 900;
          box-shadow: 0 12px 22px rgba(0, 176, 80, .22);
        }

        .btn-filter-clear {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 44px;
          padding: 0 16px;
          border-radius: 11px;
          text-decoration: none;
          color: #667085;
          font-weight: 800;
          background: #eef2f7;
        }

        .charts-grid {
          display: grid;
          grid-template-columns: 1.05fr .96fr 1.05fr;
          gap: 18px;
        }

        .chart-card {
          min-height: 310px;
          padding: 18px 22px 16px;
          position: relative;
          overflow: hidden;
        }

        .chart-card::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 86% 88%, rgba(226, 232, 240, .55), transparent 23%);
          pointer-events: none;
        }

        .chart-heading {
          position: relative;
          z-index: 1;
          padding-left: 14px;
          margin-bottom: 14px;
        }
        .chart-heading::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          width: 3px;
          height: 20px;
          border-radius: 999px;
          background: #94a3b8;
        }
        .chart-heading h2 {
          margin: 0 0 6px;
          font-size: 18px;
          color: #171f31;
          letter-spacing: -0.3px;
        }
        .chart-heading p {
          margin: 0;
          color: #59677d;
          font-size: 10px;
          font-weight: 600;
        }

        .line-chart {
          position: relative;
          z-index: 1;
          display: block;
          width: 100%;
          height: 210px;
          overflow: visible;
        }
        .grid-line { stroke: #dfe5ee; stroke-width: 1; stroke-dasharray: 4 4; }
        .axis-line { stroke: #cfd7e3; stroke-width: 1.2; }
        .trend-line { fill: none; stroke: #00B050; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
        .line-dot { fill: #00B050; stroke: #00B050; stroke-width: 2; }
        .axis-label, .month-label, .point-value { fill: #52627a; font-weight: 800; font-size: 10px; }
        .point-value { fill: #111827; font-size: 10px; }

        .hbar-list {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 6px 8px 0 4px;
        }
        .hbar-row { display: flex; flex-direction: column; gap: 8px; }
        .hbar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          color: #52627a;
          font-weight: 800;
          font-size: 12px;
        }
        .hbar-header strong { color: #111827; white-space: nowrap; }
        .hbar-track {
          width: 100%;
          height: 10px;
          background: #e9edf4;
          border-radius: 999px;
          overflow: hidden;
        }
        .hbar-fill {
          height: 100%;
          border-radius: 999px;
        }
        .hbar-orange { background: linear-gradient(90deg, #00B050, #00B050); }
        .hbar-green { background: linear-gradient(90deg, #23c33a, #16a634); }

        .chart-soft-icon {
          position: absolute;
          left: 50%;
          bottom: 16px;
          transform: translateX(-50%);
          width: 52px;
          height: 52px;
          border-radius: 14px;
          color: #667085;
          background: linear-gradient(180deg, #e7ebf1, #d8dde6);
          opacity: .95;
        }
        .chart-soft-icon svg { width: 34px; height: 24px; }

        .empty-state {
          color: #94a3b8;
          font-size: 14px;
          padding: 26px 0;
          font-weight: 700;
        }

        .footer-note {
          margin-top: 14px;
          text-align: center;
          color: #69778d;
          font-size: 10px;
          font-weight: 600;
        }

        /* Mantém o Dashboard estável em monitores Windows com escala 125%/150%.
           Antes, abaixo de 1300px o painel quebrava para 1 coluna e ficava gigante. */
        @media (max-width: 980px) {
          .page-shell { width: min(100% - 28px, 1200px); }
          .topbar { padding: 14px 18px; }
          .nav-panel { grid-template-columns: repeat(3, 1fr); padding: 10px 18px; gap: 12px; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .charts-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 720px) {
          .page-shell { width: min(100% - 22px, 680px); margin-top: 16px; }
          .topbar, .profile-area, .filter-panel { flex-direction: column; align-items: flex-start; }
          .profile-copy { text-align: left; }
          .nav-panel, .stats-grid { grid-template-columns: 1fr; padding: 12px; gap: 8px; }
          .brand-title h1 { font-size: 25px; }
          .filter-panel select, .filter-panel input[type="date"] { width: 100%; }
          .stat-card { min-height: auto; }
        }
      

/* ===== PADRÃO VISUAL DEUS É MAIS - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL DEUS É MAIS ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */

</style>
    </head>
    <body>
      <main class="page-shell">
        <header class="topbar">
          <div class="brand-left">
            <div class="app-mark" aria-hidden="true"><span></span><span></span><span></span></div>
            <div class="brand-title">
              <h1>Painel Fiscal - Deus é Mais</h1>
              <p>${subtituloFiltro}</p>
            </div>
          </div>

          <div class="profile-area">
            <div class="profile-copy">
              <strong>Deus é Mais</strong>
              <span>Dashboard gerencial interno</span>
            </div>
            <div class="avatar-wrap" aria-hidden="true"><div class="avatar-icon"></div><span class="online-dot"></span></div>
            <a class="logout-btn" href="/logout" title="Sair">
              <span class="logout-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg></span>
              Sair
            </a>
          </div>
        </header>

        <nav class="nav-panel" aria-label="Menu principal">
          <a class="nav-btn active" href="/rotina-despesas"><span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/></svg></span>Lançamentos Mensais</a>
          <a class="nav-btn" href="/lancamentos"><span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 16h8"/></svg></span>Ver Lançamentos</a>
          <a class="nav-btn" href="/categorias"><span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h5l2 3h11v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7V5a2 2 0 0 1 2-2h4l2 4"/></svg></span>Categorias</a>
          <a class="nav-btn" href="/documentos"><span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 12h8"/><path d="M8 17h5"/></svg></span>Documentos Fiscais</a>
          <a class="nav-btn" href="/espaco-contador"><span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v7"/><circle cx="12" cy="11" r="3"/><path d="M5 22h14"/><path d="M8 22v-5a4 4 0 0 1 8 0v5"/></svg></span>Espaço do Contador</a>
          <a class="nav-btn" href="/usuarios"><span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>Usuários</a>
        </nav>

        <section class="stats-grid" aria-label="Indicadores principais">
          <div class="stat-card">
            <div class="stat-icon-box orange"><span class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h4"/></svg></span></div>
            <div class="stat-content"><small>Lançamentos cadastrados</small><strong>${totalLancamentos}</strong><span>Total de registros no filtro atual</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon-box green"><span class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/></svg></span></div>
            <div class="stat-content"><small>Valor total lançado</small><strong>${formatMoney(valorTotal)}</strong><span>Soma geral das despesas no filtro atual</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon-box purple"><span class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3H4a1 1 0 0 0-1 1v5.59A2 2 0 0 0 3.59 11l9.59 9.59a2 2 0 0 0 2.82 0l4.59-4.59a2 2 0 0 0 0-2.59z"/><circle cx="7.5" cy="7.5" r="1"/></svg></span></div>
            <div class="stat-content"><small>Categorias utilizadas</small><strong>${totalCategorias}</strong><span>Categorias com movimentação</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon-box orange"><span class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span></div>
            <div class="stat-content"><small>Fornecedores lançados</small><strong>${totalFornecedores}</strong><span>Fornecedores com despesas</span></div>
          </div>
        </section>

        <form method="GET" action="/dashboard" class="filter-panel">
          <label for="mes">Filtrar mês</label>
          <select id="mes" name="mes">
            <option value="">Todos os meses</option>
            ${opcoesMesHtml}
          </select>
          <button type="submit" class="btn-filter-apply">Aplicar filtro&nbsp;⌁</button>
          <a href="/dashboard" class="btn-filter-clear">Limpar</a>
        </form>

        <section class="charts-grid">
          <article class="chart-card">
            <div class="chart-heading"><h2>Despesas por mês</h2><p>Últimos 6 meses lançados</p></div>
            ${mesesHtml}
          </article>

          <article class="chart-card">
            <div class="chart-heading"><h2>Despesas por categoria</h2><p>Top categorias por valor no filtro atual</p></div>
            <div class="hbar-list">${categoriasHtml}</div>
            <div class="chart-soft-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg></div>
          </article>

          <article class="chart-card">
            <div class="chart-heading"><h2>Despesas por fornecedor</h2><p>Top fornecedores por valor no filtro atual</p></div>
            <div class="hbar-list">${fornecedoresHtml}</div>
            <div class="chart-soft-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
          </article>
        </section>

        <div class="footer-note">© 2024 Deus é Mais. Todos os direitos reservados.</div>
      </main>
    </body>
    </html>
  `;
}


router.get('/login', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Login - Painel Contábil Deus é Mais</title>
  <style>
    * {
      box-sizing: border-box;
      font-family: Arial, sans-serif;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background: linear-gradient(135deg, #f4f7fb, #e8eef7);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      color: #0f172a;
    }

    .login-page {
      width: 100%;
      max-width: 460px;
      text-align: center;
    }

    .logo {
      max-width: 320px;
      width: 85%;
      margin-bottom: 20px;
    }

    h1 {
      font-size: 28px;
      margin: 0 0 8px;
      color: #003f7d;
    }

    .subtitle {
      color: #64748b;
      margin-bottom: 16px;
      font-size: 15px;
    }

    .card {
      background: #fff;
      border-radius: 18px;
      padding: 30px;
      box-shadow: 0 20px 45px rgba(15, 23, 42, 0.12);
      text-align: left;
    }

    label {
      display: block;
      font-weight: 700;
      margin-bottom: 8px;
      color: #1e293b;
    }

    input[type="email"],
    input[type="password"],
    input[type="text"] {
      width: 100%;
      height: 48px;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 0 14px;
      font-size: 16px;
      margin-bottom: 18px;
      outline: none;
    }

    input:focus {
      border-color: #0057a8;
      box-shadow: 0 0 0 3px rgba(0, 87, 168, 0.12);
    }

    .options {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 22px;
      font-size: 14px;
      color: #475569;
    }

    .options label {
      margin: 0;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }

    button {
      width: 100%;
      height: 50px;
      border: none;
      border-radius: 14px;
      background: linear-gradient(135deg, #0057a8, #003f7d);
      color: white;
      font-size: 17px;
      font-weight: 800;
      cursor: pointer;
    }

    button:hover {
      filter: brightness(1.05);
    }

    .footer {
      text-align: center;
      margin-top: 18px;
      font-size: 13px;
      color: #64748b;
    }
  

/* ===== PADRÃO VISUAL DEUS É MAIS - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL DEUS É MAIS ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */

</style>
</head>

<body>
  <div class="login-page">
    <img src="/assets/logo-deus-e-mais.png" class="logo" alt="Livraria Cristã Deus é Mais" />

    <h1>Seja bem-vindo ao Painel Contábil Deus é Mais</h1>
    <p class="subtitle">Acesse sua área administrativa com segurança.</p>

    <div class="card">
      <form method="POST" action="/login">
        <label for="email">E-mail</label>
        <input type="email" id="email" name="email" autocomplete="email" required />

        <label for="senha">Senha</label>
        <input type="password" id="senha" name="senha" autocomplete="current-password" required />

        <div class="options">
          <label>
            <input type="checkbox" id="lembrarLogin" />
            Salvar login
          </label>

          <label>
            <input type="checkbox" id="mostrarSenha" />
            Mostrar senha
          </label>
        </div>

        <button type="submit">Entrar no Painel</button>
      </form>
    </div>

    <div class="footer">
      Deus é Mais Comércio e Negócios
    </div>
  </div>

  <script>
    const emailInput = document.getElementById('email');
    const lembrarLogin = document.getElementById('lembrarLogin');
    const mostrarSenha = document.getElementById('mostrarSenha');
    const senhaInput = document.getElementById('senha');

    const emailSalvo = localStorage.getItem('painel_email');

    if (emailSalvo) {
      emailInput.value = emailSalvo;
      lembrarLogin.checked = true;
    }

    lembrarLogin.addEventListener('change', () => {
      if (!lembrarLogin.checked) {
        localStorage.removeItem('painel_email');
      }
    });

    document.querySelector('form').addEventListener('submit', () => {
      if (lembrarLogin.checked) {
        localStorage.setItem('painel_email', emailInput.value);
      }
    });

    mostrarSenha.addEventListener('change', () => {
      senhaInput.type = mostrarSenha.checked ? 'text' : 'password';
    });
  </script>
</body>
</html>
  `);
});

router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    const user = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email]
    );

    let usuario;

if (!user.rows.length) {
  usuario = {
    id: 1,
    nome: 'Genivaldo',
    email: email,
    perfil: 'ADMIN'
  };
} else {
  usuario = user.rows[0];
}
    const senhaDigitada = String(senha || '');
    const hashBanco = String(usuario.senha_hash || '');
    const senhaValida = await bcrypt.compare(senhaDigitada, hashBanco);

    if (!senhaValida) {
      return res.send(`
        <pre>
Senha inválida

Email recebido: ${email}
Senha digitada: ${senhaDigitada}
Hash banco: ${hashBanco}
Tamanho do hash: ${hashBanco.length}
        </pre>
      `);
    }

    req.session.usuario = {
      id: usuario.id,
      nome: usuario.nome,
      perfil: String(usuario.perfil || '').toUpperCase()
    };

    return res.redirect('/dashboard');
  } catch (error) {
    return res.send(`<pre>Erro no login:\n${error.message}</pre>`);
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// =============================
// GESTÃO DE USUÁRIOS
// =============================

function escapeUsuarioHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

router.get('/usuarios', protegerRota, somenteAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nome, email, perfil, criado_em
      FROM usuarios
      ORDER BY nome
    `);

    const usuarioLogadoId = req.session.usuario.id;

    const linhas = result.rows.map(user => {
      const perfilClass =
        user.perfil === 'ADMIN' ? 'perfil-admin' :
        user.perfil === 'CONTADOR' ? 'perfil-contador' :
        'perfil-usuario';

      const podeExcluir = Number(user.id) !== Number(usuarioLogadoId);

      return `
        <tr>
          <td>${escapeUsuarioHtml(user.nome)}</td>
          <td>${escapeUsuarioHtml(user.email)}</td>
          <td>
            <span class="perfil-badge ${perfilClass}">
              ${escapeUsuarioHtml(user.perfil)}
            </span>
          </td>
          <td>${user.criado_em ? new Date(user.criado_em).toLocaleDateString('pt-BR') : ''}</td>
          <td class="col-acoes">
            ${
              podeExcluir
                ? `
                  <div class="acoes-user">
  <a class="btn-icon-edit" href="/usuarios/editar/${user.id}" title="Editar">✏️</a>
  <a class="btn-icon-key" href="/usuarios/resetar-senha/${user.id}" title="Resetar senha">🔑</a>

  <form method="POST" action="/usuarios/excluir/${user.id}" onsubmit="return confirm('Tem certeza que deseja excluir este usuário?');">
    <button type="submit" class="btn-icon-danger" title="Excluir">🗑️</button>
  </form>
</div>
                `
                : `<span class="meu-usuario">Você</span>`
            }
          </td>
        </tr>
      `;
    }).join('');

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Usuários - Deus é Mais</title>
        <style>
          * { box-sizing: border-box; }

          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: radial-gradient(circle at top left, #eef4ff 0%, #f7f9fc 35%, #eef2f7 100%);
            color: #111827;
          }

          .container {
            max-width: 1200px;
            margin: 32px auto;
            padding: 0 20px 40px;
          }

          .hero {
            background: linear-gradient(135deg, #ffffff 0%, #f8fbff 100%);
            border: 1px solid #e5e7eb;
            border-radius: 24px;
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
            padding: 28px;
            margin-bottom: 24px;
          }

          .hero-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 20px;
            flex-wrap: wrap;
            margin-bottom: 22px;
          }

          h1 {
            margin: 0 0 8px 0;
            font-size: 30px;
            color: #0f172a;
          }

          .subtitle {
            margin: 0;
            color: #64748b;
            font-size: 15px;
          }

          .actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            text-decoration: none;
            padding: 12px 18px;
            border-radius: 14px;
            font-weight: 700;
            font-size: 14px;
            border: none;
            cursor: pointer;
            box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
          }

          .btn-blue {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: white;
          }

          .btn-dark {
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: white;
          }

          .btn-green {
            background: linear-gradient(135deg, #2e7d32, #1b5e20);
            color: white;
          }

          .grid {
            display: grid;
            grid-template-columns: 380px 1fr;
            gap: 20px;
          }

          .card {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 18px;
            padding: 22px;
            box-shadow: 0 14px 28px rgba(15, 23, 42, 0.05);
          }

          .card h2 {
            margin: 0 0 16px 0;
            font-size: 18px;
            color: #1e293b;
          }

          label {
            display: block;
            font-size: 13px;
            font-weight: 700;
            color: #334155;
            margin-bottom: 6px;
          }

          input, select {
            width: 100%;
            padding: 12px 14px;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            font-size: 14px;
            background: white;
            color: #0f172a;
            margin-bottom: 14px;
          }

          .hint {
            font-size: 10px;
            color: #64748b;
            margin-top: -8px;
            margin-bottom: 14px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th, td {
            padding: 13px 12px;
            border-bottom: 1px solid #e5e7eb;
            text-align: left;
            vertical-align: middle;
            font-size: 14px;
          }

          th {
            background: #f8fafc;
            color: #334155;
            font-size: 13px;
          }

          tr:hover {
            background: #f9fafb;
          }

          .perfil-badge {
            display: inline-block;
            padding: 6px 11px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 700;
          }

          .perfil-admin {
            background: #fee2e2;
            color: #991b1b;
            border: 1px solid #fecaca;
          }

          .perfil-usuario {
            background: #dbeafe;
            color: #1e40af;
            border: 1px solid #bfdbfe;
          }

          .perfil-contador {
            background: #dcfce7;
            color: #166534;
            border: 1px solid #86efac;
          }

          .col-acoes {
            width: 90px;
            text-align: center;
          }

          .btn-icon-danger {
            border: none;
            background: transparent;
            cursor: pointer;
            font-size: 16px;
          }
.acoes-user {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.btn-icon-edit,
.btn-icon-key {
  text-decoration: none;
  font-size: 16px;
  cursor: pointer;
}

.btn-icon-edit:hover,
.btn-icon-key:hover {
  transform: scale(1.12);
}

          .btn-icon-danger:hover {
            transform: scale(1.12);
          }

          .meu-usuario {
            display: inline-block;
            padding: 5px 9px;
            border-radius: 999px;
            background: #f3f4f6;
            color: #6b7280;
            font-size: 10px;
            font-weight: 700;
          }

          @media (max-width: 950px) {
            .grid {
              grid-template-columns: 1fr;
            }
          }
        

/* ===== PADRÃO VISUAL DEUS É MAIS - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL DEUS É MAIS ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */

</style>
      </head>

      <body>
        <div class="container">
          <section class="hero">
            <div class="hero-top">
              <div>
                <h1>👥 Gestão de Usuários</h1>
                <p class="subtitle">Controle de acesso do sistema Deus é Mais.</p>
              </div>

              <div class="actions">
                <a class="btn btn-dark" href="/dashboard">Voltar ao Painel</a>
                <a class="btn btn-dark" href="/logout">🚪 Sair</a>
              </div>
            </div>

            <div class="grid">
              <div class="card">
                <h2>Novo usuário</h2>

                <form method="POST" action="/usuarios/novo">
                  <label for="nome">Nome</label>
                  <input id="nome" name="nome" placeholder="Nome do usuário" required />

                  <label for="email">E-mail</label>
                  <input id="email" name="email" type="email" placeholder="email@empresa.com" required />

                  <label for="senha">Senha inicial</label>
                  <input id="senha" name="senha" type="password" placeholder="Senha inicial" required />
                  <div class="hint">Depois o usuário poderá receber uma nova senha se necessário.</div>

                  <label for="perfil">Perfil</label>
                  <select id="perfil" name="perfil" required>
                    <option value="USUARIO">Usuário padrão</option>
                    <option value="CONTADOR">Contador</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>

                  <button class="btn btn-green" type="submit">➕ Criar usuário</button>
                </form>
              </div>

              <div class="card">
                <h2>Usuários cadastrados</h2>

                <table>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>E-mail</th>
                      <th>Perfil</th>
                      <th>Criado em</th>
                      <th class="col-acoes">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${linhas || '<tr><td colspan="5">Nenhum usuário cadastrado.</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao carregar usuários:\n${error.message}</pre>`);
  }
});

router.post('/usuarios/novo', protegerRota, somenteAdmin, async (req, res) => {
  try {
    const { nome, email, senha, perfil } = req.body;

    const perfilPermitido = ['ADMIN', 'USUARIO', 'CONTADOR'].includes(String(perfil || '').toUpperCase())
      ? String(perfil).toUpperCase()
      : 'USUARIO';

    const senhaHash = await bcrypt.hash(String(senha || ''), 10);

    await pool.query(`
      INSERT INTO usuarios (nome, email, senha_hash, perfil)
      VALUES ($1, $2, $3, $4)
    `, [
      nome,
      String(email || '').trim().toLowerCase(),
      senhaHash,
      perfilPermitido
    ]);

    res.redirect('/usuarios');
  } catch (error) {
    if (error.code === '23505') {
      return res.send('<pre>Já existe um usuário cadastrado com este e-mail.</pre>');
    }

    res.send(`<pre>Erro ao criar usuário:\n${error.message}</pre>`);
  }
});

router.post('/usuarios/excluir/:id', protegerRota, somenteAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (Number(id) === Number(req.session.usuario.id)) {
      return res.send('<pre>Você não pode excluir o próprio usuário logado.</pre>');
    }

    await pool.query(`
      DELETE FROM usuarios
      WHERE id = $1
    `, [id]);

    res.redirect('/usuarios');
  } catch (error) {
    res.send(`<pre>Erro ao excluir usuário:\n${error.message}</pre>`);
  }
});

router.get('/usuarios/editar/:id', protegerRota, somenteAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT id, nome, email, perfil
      FROM usuarios
      WHERE id = $1
    `, [id]);

    if (!result.rows.length) {
      return res.send('<pre>Usuário não encontrado.</pre>');
    }

    const user = result.rows[0];

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Editar Usuário</title>
        <style>
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #f6f8fb;
            color: #111827;
          }

          .container {
            max-width: 620px;
            margin: 50px auto;
            padding: 0 20px;
          }

          .card {
            background: white;
            border-radius: 18px;
            padding: 28px;
            box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
            border: 1px solid #e5e7eb;
          }

          h1 {
            margin-top: 0;
            font-size: 28px;
          }

          label {
            display: block;
            font-weight: 700;
            margin-bottom: 6px;
            color: #334155;
          }

          input, select {
            width: 100%;
            padding: 12px 14px;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            font-size: 14px;
            margin-bottom: 16px;
          }

          .actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .btn {
            border: none;
            text-decoration: none;
            padding: 12px 18px;
            border-radius: 14px;
            font-weight: 700;
            cursor: pointer;
            font-size: 14px;
          }

          .btn-green {
            background: #1b5e20;
            color: white;
          }

          .btn-dark {
            background: #111827;
            color: white;
          }
        

/* ===== PADRÃO VISUAL DEUS É MAIS - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL DEUS É MAIS ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */

</style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <h1>✏️ Editar Usuário</h1>

            <form method="POST" action="/usuarios/editar/${user.id}">
              <label>Nome</label>
              <input name="nome" value="${user.nome || ''}" required />

              <label>E-mail</label>
              <input name="email" type="email" value="${user.email || ''}" required />

              <label>Perfil</label>
              <select name="perfil" required>
                <option value="USUARIO" ${user.perfil === 'USUARIO' ? 'selected' : ''}>Usuário padrão</option>
                <option value="CONTADOR" ${user.perfil === 'CONTADOR' ? 'selected' : ''}>Contador</option>
                <option value="ADMIN" ${user.perfil === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
              </select>

              <div class="actions">
                <button class="btn btn-green" type="submit">Salvar alterações</button>
                <a class="btn btn-dark" href="/usuarios">Voltar</a>
              </div>
            </form>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao abrir edição de usuário:\n${error.message}</pre>`);
  }
});

router.post('/usuarios/editar/:id', protegerRota, somenteAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, perfil } = req.body;

    const perfilPermitido = ['ADMIN', 'USUARIO', 'CONTADOR'].includes(String(perfil || '').toUpperCase())
      ? String(perfil).toUpperCase()
      : 'USUARIO';

    await pool.query(`
      UPDATE usuarios
      SET nome = $1,
          email = $2,
          perfil = $3
      WHERE id = $4
    `, [
      nome,
      String(email || '').trim().toLowerCase(),
      perfilPermitido,
      id
    ]);

    res.redirect('/usuarios');
  } catch (error) {
    res.send(`<pre>Erro ao salvar usuário:\n${error.message}</pre>`);
  }
});

router.get('/usuarios/resetar-senha/:id', protegerRota, somenteAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT id, nome, email
      FROM usuarios
      WHERE id = $1
    `, [id]);

    if (!result.rows.length) {
      return res.send('<pre>Usuário não encontrado.</pre>');
    }

    const user = result.rows[0];

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Resetar Senha</title>
        <style>
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #f6f8fb;
            color: #111827;
          }

          .container {
            max-width: 620px;
            margin: 50px auto;
            padding: 0 20px;
          }

          .card {
            background: white;
            border-radius: 18px;
            padding: 28px;
            box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
            border: 1px solid #e5e7eb;
          }

          h1 {
            margin-top: 0;
            font-size: 28px;
          }

          .info {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 14px;
            margin-bottom: 18px;
            color: #334155;
          }

          label {
            display: block;
            font-weight: 700;
            margin-bottom: 6px;
            color: #334155;
          }

          input {
            width: 100%;
            padding: 12px 14px;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            font-size: 14px;
            margin-bottom: 16px;
          }

          .actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .btn {
            border: none;
            text-decoration: none;
            padding: 12px 18px;
            border-radius: 14px;
            font-weight: 700;
            cursor: pointer;
            font-size: 14px;
          }

          .btn-blue {
            background: #2563eb;
            color: white;
          }

          .btn-dark {
            background: #111827;
            color: white;
          }
        

/* ===== PADRÃO VISUAL DEUS É MAIS - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== PADRÃO DEFINITIVO BOTÕES (CINZA + LARANJA ESTRATÉGICO) ===== */

.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

/* 🔘 BOTÃO PADRÃO (CINZA) */
.actions .btn,
.actions a,
.actions button,
.filter-buttons a,
.top-bar .filters a,
button,
.btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

/* 🟠 BOTÕES PRINCIPAIS (AÇÃO) */
.actions .btn-primary,
button.btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"] {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

/* REMOVE herança de laranja global */
.btn:not(.btn-primary):not(.btn-danger):not(.btn-icon-danger) {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
}

/* FORM inline (não quebrar layout) */
.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}

/* ===== FIM PADRÃO ===== */

/* ===== FIM PADRÃO VISUAL DEUS É MAIS ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */

</style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <h1>🔑 Resetar Senha</h1>

            <div class="info">
              <strong>${user.nome}</strong><br>
              ${user.email}
            </div>

            <form method="POST" action="/usuarios/resetar-senha/${user.id}">
              <label>Nova senha</label>
              <input name="nova_senha" type="password" placeholder="Digite a nova senha" required />

              <div class="actions">
                <button class="btn btn-dark" type="submit">Salvar nova senha</button>
                <a class="btn btn-dark" href="/usuarios">Voltar</a>
              </div>
            </form>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao abrir reset de senha:\n${error.message}</pre>`);
  }
});

router.post('/usuarios/resetar-senha/:id', protegerRota, somenteAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const novaSenha = String(
      req.body.nova_senha || req.body.senha || req.body.password || ''
    ).trim();

    if (!novaSenha) {
      return res.send('<pre>Informe uma nova senha válida.</pre>');
    }

    const senhaHash = await bcrypt.hash(novaSenha, 10);

    await pool.query(`
      UPDATE usuarios
      SET senha_hash = $1
      WHERE id = $2
    `, [senhaHash, id]);

    res.redirect('/usuarios');
  } catch (error) {
    res.send(`<pre>Erro ao resetar senha:\n${error.message}</pre>`);
  }
});

// DASHBOARD
router.get('/dashboard', protegerRota, async (req, res) => {
  try {
    const { mes = '' } = req.query;

    let whereFiltro = '';
    let valuesFiltro = [];

    if (mes) {
      valuesFiltro.push(`${mes}-01`);
      whereFiltro = `
        WHERE data_despesa >= DATE_TRUNC('month', $1::date)
          AND data_despesa < DATE_TRUNC('month', $1::date) + INTERVAL '1 month'
      `;
    }

    const [
      totalResult,
      valorTotalResult,
      categoriasResult,
      fornecedoresResult,
      categoriasGraficoResult,
      fornecedoresGraficoResult,
      mesesGraficoResult
    ] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM lancamentos
        ${whereFiltro}
      `, valuesFiltro),

      pool.query(`
        SELECT COALESCE(SUM(valor), 0)::numeric AS total
        FROM lancamentos
        ${whereFiltro}
      `, valuesFiltro),

      pool.query(`
        SELECT COUNT(DISTINCT categoria_id)::int AS total
        FROM lancamentos
        ${whereFiltro ? whereFiltro + ' AND categoria_id IS NOT NULL' : 'WHERE categoria_id IS NOT NULL'}
      `, valuesFiltro),

      pool.query(`
        SELECT COUNT(DISTINCT fornecedor)::int AS total
        FROM lancamentos
        ${whereFiltro ? whereFiltro + " AND fornecedor IS NOT NULL AND TRIM(fornecedor) <> ''" : "WHERE fornecedor IS NOT NULL AND TRIM(fornecedor) <> ''"}
      `, valuesFiltro),

      pool.query(`
        SELECT
          COALESCE(c.nome, 'Sem categoria') AS nome,
          COALESCE(SUM(l.valor), 0)::numeric AS total
        FROM lancamentos l
        LEFT JOIN categorias c ON c.id = l.categoria_id
        ${whereFiltro ? whereFiltro.replace(/data_despesa/g, 'l.data_despesa') : ''}
        GROUP BY COALESCE(c.nome, 'Sem categoria')
        ORDER BY total DESC
        LIMIT 6
      `, valuesFiltro),

      pool.query(`
        SELECT
          COALESCE(NULLIF(TRIM(fornecedor), ''), 'Sem fornecedor') AS nome,
          COALESCE(SUM(valor), 0)::numeric AS total
        FROM lancamentos
        ${whereFiltro}
        GROUP BY COALESCE(NULLIF(TRIM(fornecedor), ''), 'Sem fornecedor')
        ORDER BY total DESC
        LIMIT 6
      `, valuesFiltro),

      pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', data_despesa), 'YYYY-MM') AS mes_ref,
          COALESCE(SUM(valor), 0)::numeric AS total
        FROM lancamentos
        WHERE data_despesa IS NOT NULL
          AND data_despesa >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
        GROUP BY DATE_TRUNC('month', data_despesa)
        ORDER BY DATE_TRUNC('month', data_despesa)
      `)
    ]);

    const hoje = new Date();
    const mesesBase = [];

    for (let i = 5; i >= 0; i--) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);

      const ano = data.getFullYear();
      const mesNum = String(data.getMonth() + 1).padStart(2, '0');
      const mesRef = `${ano}-${mesNum}`;

      const label = data.toLocaleDateString('pt-BR', {
        month: 'short',
        year: '2-digit'
      });

      mesesBase.push({
        mes_ref: mesRef,
        label: label.replace('.', ''),
        total: 0
      });
    }

    const mesesMap = new Map(
      mesesGraficoResult.rows.map(item => [item.mes_ref, Number(item.total || 0)])
    );

    const meses = mesesBase.map(item => ({
      label: item.label,
      total: mesesMap.get(item.mes_ref) || 0
    }));

    res.send(renderDashboard({
      totalLancamentos: totalResult.rows[0]?.total || 0,
      valorTotal: valorTotalResult.rows[0]?.total || 0,
      totalCategorias: categoriasResult.rows[0]?.total || 0,
      totalFornecedores: fornecedoresResult.rows[0]?.total || 0,
      meses,
      categorias: categoriasGraficoResult.rows.map(item => ({
        nome: item.nome,
        total: Number(item.total || 0)
      })),
      fornecedores: fornecedoresGraficoResult.rows.map(item => ({
        nome: item.nome,
        total: Number(item.total || 0)
      })),
      mesSelecionado: mes
    }));
  } catch (error) {
    res.send(`<pre>Erro ao carregar dashboard:\n${error.message}</pre>`);
  }
});

// =============================
// DOCUMENTOS FISCAIS
// =============================
router.get('/documentos', protegerRota, async (req, res) => {
  try {
    const docs = await pool.query(`
      SELECT
        d.*,
        l.id AS lancamento_relacionado
      FROM documentos_fiscais d
      LEFT JOIN lancamentos l ON l.id = d.lancamento_id
      ORDER BY d.id DESC
    `);

    let linhas = '';
    docs.rows.forEach(d => {
      const dataFormatada = d.data_documento
        ? new Date(d.data_documento).toISOString().split('T')[0]
        : '';

      const pdfHtml = d.anexo_pdf
  ? `
    <a class="icon-btn" href="/uploads/${d.anexo_pdf}" target="_blank" title="Ver PDF">👁</a>
    <a class="icon-btn" href="/uploads/${d.anexo_pdf}" download title="Baixar PDF">⬇</a>
  `
  : '<span style="color:#6b7280;">—</span>';

      const xmlHtml = d.anexo_xml
  ? `
    <a class="icon-btn" href="/uploads/${d.anexo_xml}" target="_blank" title="Ver XML">👁</a>
    <a class="icon-btn" href="/uploads/${d.anexo_xml}" download title="Baixar XML">⬇</a>
  `
  : '<span style="color:#6b7280;">—</span>';
      const acaoLancamento = d.lancamento_id
  ? `<span style="color:#166534; font-weight:bold;">Lançado #${d.lancamento_id}</span>`
  : `<a class="icon-btn" href="/documentos/gerar-lancamento/${d.id}" title="Gerar lançamento">🧾</a>`;

      linhas += `
        <tr>
          <td>${d.id}</td>
          <td>${d.tipo_documento || ''}</td>
          <td>${d.numero_documento || ''}</td>
          <td>${dataFormatada}</td>
          <td>${d.fornecedor || ''}</td>
          <td>${d.cnpj_cpf || ''}</td>
          <td style="text-align:right;">${formatMoneyBR(d.valor || 0)}</td>
          <td>${d.status}</td>
          <td>${d.origem_layout || ''}</td>
          <td>${pdfHtml}</td>
          <td>${xmlHtml}</td>
          <td>${acaoLancamento}</td>
        </tr>
      `;
    });

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Documentos Fiscais</title>
        <style>
          * { box-sizing: border-box; }
          body {
  margin: 0;
  font-family: Arial, sans-serif;
  font-size: 13px;
  background: #f4f6f8;
  color: #111827;
}
          .container { max-width: 1800px; margin: 40px auto; padding: 0 20px; }
          .card { background: white; border-radius: 14px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); padding: 24px; margin-bottom: 20px; }
          h1 { margin-top: 0; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
          .full { grid-column: 1 / -1; }
          label { display: block; margin-bottom: 6px; font-weight: bold; font-size: 14px; }
          input, select { width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 15px; }
          .actions { margin-top: 20px; display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
          button, a {
            text-decoration: none;
            padding: 12px 18px;
            border-radius: 10px;
            font-weight: bold;
            border: none;
            cursor: pointer;
            display: inline-block;
          }
          button { background: #2563eb; color: white; }
          .btn-primary { background: #2563eb; color: white; }
          .btn-secondary { background: #e5e7eb; color: #111827; }
          table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 12px; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
          th { background: #2563eb; color: white; }
         tr:nth-child(even) td {
  background: #fbfcfe;
}

tr:hover td {
  background: #f3f7ff;
}
          .icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-right: 4px;
  border-radius: 8px;
  text-decoration: none;
  font-size: 10px;
  background: transparent;
  color: #334155;
  border: none;
}

.icon-btn:hover {
  background: #eef2ff;
}
          .hint { font-size: 13px; color: #6b7280; margin-top: 6px; }
/* ===== REFINO VISUAL DOCUMENTOS ===== */

/* fundo mais suave */
body {
  background: #f8fafc;
}

/* tabela mais leve */
th {
  background: #f1f5f9;
  color: #334155;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

/* linhas mais suaves */
td {
  border-bottom: 1px solid #f1f5f9;
}

/* hover mais elegante */
tr:hover td {
  background: #f9fafb;
}

/* remover peso dos ícones */
.icon-btn {
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  border: none !important;
  padding: 0 !important;
  width: 18px;
  height: 18px;
  color: #64748b;
}

.icon-btn:hover {
  background: transparent !important;
  color: #1d4ed8;
  transform: scale(1.08);
}
        

/* ===== PADRÃO VISUAL DEUS É MAIS - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL DEUS É MAIS ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */

</style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <h1>📁 Documentos Fiscais</h1>

            <form method="POST" action="/documentos/importar" enctype="multipart/form-data">
              <div class="grid">
                <div>
                  <label for="anexo_xml">XML</label>
                  <input id="anexo_xml" type="file" name="anexo_xml" accept=".xml,text/xml,application/xml" />
                </div>

                <div>
                  <label for="anexo_pdf">PDF</label>
                  <input id="anexo_pdf" type="file" name="anexo_pdf" accept=".pdf" />
                </div>

                <div class="full">
                  <div class="hint">Você pode subir só XML, só PDF, ou os dois. Mesmo quando o XML não for reconhecido, o documento será guardado.</div>
                </div>
              </div>

              <div class="actions">
                <button type="submit">Importar documento</button>
                <a class="btn-secondary" href="/dashboard">Voltar ao Painel</a>
              </div>
            </form>
          </div>

          <div class="card">
            <table>
              <tr>
                <th>ID</th>
                <th>Tipo</th>
                <th>Número</th>
                <th>Data</th>
                <th>Fornecedor</th>
                <th>CNPJ/CPF</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Layout</th>
                <th>PDF</th>
                <th>XML</th>
                <th>Ação</th>
              </tr>
              ${linhas || '<tr><td colspan="12">Nenhum documento importado.</td></tr>'}
            </table>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao carregar documentos:\n${error.message}</pre>`);
  }
});

router.post(
  '/documentos/importar',
  upload.fields([
    { name: 'anexo_pdf', maxCount: 1 },
    { name: 'anexo_xml', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const anexoPdf = req.files && req.files.anexo_pdf ? req.files.anexo_pdf[0].filename : null;
      const anexoXml = req.files && req.files.anexo_xml ? req.files.anexo_xml[0].filename : null;

      let dados = {
        tipo_documento: '',
        numero_documento: '',
        data_documento: '',
        fornecedor: '',
        cnpj_cpf: '',
        valor: '',
        status: 'Nao reconhecido',
        origem_layout: '',
        erro_leitura: null
      };

      if (req.files && req.files.anexo_xml) {
        try {
          const filePath = req.files.anexo_xml[0].path;
          dados = await parseXmlDocumento(filePath);
        } catch (error) {
          dados.status = 'Nao reconhecido';
          dados.origem_layout = 'Erro na leitura';
          dados.erro_leitura = error.message;
        }
      }

      if (!anexoXml && !anexoPdf) {
        return res.send('<pre>Nenhum arquivo foi enviado.</pre>');
      }

      await pool.query(
        `INSERT INTO documentos_fiscais
        (tipo_documento, numero_documento, data_documento, fornecedor, cnpj_cpf, valor, anexo_pdf, anexo_xml, status, origem_layout, erro_leitura)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          dados.tipo_documento || null,
          dados.numero_documento || null,
          dados.data_documento || null,
          dados.fornecedor || null,
          dados.cnpj_cpf || null,
          dados.valor || null,
          anexoPdf,
          anexoXml,
          dados.status || 'Nao reconhecido',
          dados.origem_layout || null,
          dados.erro_leitura || null
        ]
      );

      res.redirect('/documentos');
    } catch (error) {
      res.send(`<pre>Erro ao importar documento:\n${error.message}</pre>`);
    }
  }
);

router.get('/documentos/gerar-lancamento/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const docResult = await pool.query(
      'SELECT * FROM documentos_fiscais WHERE id = $1',
      [id]
    );

    if (!docResult.rows.length) {
      return res.send('<pre>Documento não encontrado.</pre>');
    }

    const doc = docResult.rows[0];
    const optionsCategorias = await getCategoriasOptions();

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Gerar lançamento</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; font-family: Arial, sans-serif; background: #f4f6f8; color: #111827; }
          .container { max-width: 900px; margin: 40px auto; padding: 0 20px; }
          .card { background: white; border-radius: 14px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); padding: 24px; }
          h1 { margin-top: 0; margin-bottom: 20px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
          .full { grid-column: 1 / -1; }
          label { display: block; margin-bottom: 6px; font-weight: bold; font-size: 14px; }
          input, select { width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 15px; }
          .actions { margin-top: 20px; display: flex; gap: 8px; flex-wrap: wrap; }
          button, a {
            text-decoration: none;
            padding: 12px 18px;
            border-radius: 10px;
            font-weight: bold;
            border: none;
            cursor: pointer;
            display: inline-block;
          }
          button { background: #2563eb; color: white; }
          .btn-secondary { background: #e5e7eb; color: #111827; }
/* ===== VISUAL PREMIUM /DOCUMENTOS ===== */
body {
  background: #f8fafc;
  color: #1f2937;
  font-size: 13px;
}

.card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 4px 12px rgba(0,0,0,0.04);
}

h1 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

label {
  font-size: 10px;
  font-weight: 600;
  color: #374151;
}

input, select {
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: #fff;
}

input:focus, select:focus {
  outline: none;
  border-color: #2563eb;
}

button, .btn {
  font-size: 13px;
  padding: 8px 14px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

table {
  font-size: 13px;
  border-collapse: collapse;
  width: 100%;
}

th {
  background: #f1f5f9;
  color: #334155;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  text-align: left;
}

th, td {
  padding: 8px 10px;
  border-bottom: 1px solid #f1f5f9;
}

tr:hover {
  background: #f9fafb;
}

/* ===== ÍCONES LEVES ===== */
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin: 0 3px;
  border: none !important;
  background: transparent !important;
  font-size: 14px;
  color: #64748b;
  cursor: pointer;
}

.icon-btn:hover {
  color: #1d4ed8;
  transform: scale(1.08);
}
        

/* ===== PADRÃO VISUAL DEUS É MAIS - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL DEUS É MAIS ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */

</style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <h1>🧾 Gerar lançamento a partir do documento #${doc.id}</h1>

            <form method="POST" action="/documentos/gerar-lancamento/${doc.id}">
              <div class="grid">
                <div>
                  <label for="tipo_documento">Tipo do documento</label>
                  <select id="tipo_documento" name="tipo_documento" required>
                    ${renderTipoDocumentoOptions(doc.tipo_documento)}
                  </select>
                </div>

                <div>
                  <label for="numero_documento">Número do documento</label>
                  <input id="numero_documento" name="numero_documento" value="${doc.numero_documento || ''}" />
                </div>

                <div>
                  <label for="data_despesa">Data</label>
                  <input id="data_despesa" type="date" name="data_despesa" value="${doc.data_documento ? new Date(doc.data_documento).toISOString().split('T')[0] : ''}" required />
                </div>

                <div>
                  <label for="valor">Valor</label>
                  <input id="valor" name="valor" type="text" inputmode="decimal" value="${formatValorInputBR(doc.valor)}" placeholder="R$ 0,00" required />
                </div>

                <div class="full">
                  <label for="fornecedor">Fornecedor</label>
                  <input id="fornecedor" name="fornecedor" value="${doc.fornecedor || ''}" required />
                </div>

                <div>
                  <label for="cnpj_cpf">CNPJ/CPF</label>
                  <input id="cnpj_cpf" name="cnpj_cpf" value="${doc.cnpj_cpf || ''}" />
                </div>

                <div>
                  <label for="codigo_pagamento">Código de pagamento</label>
                  <input id="codigo_pagamento" name="codigo_pagamento" />
                </div>

                <div>
                  <label for="tipo_pagamento">Tipo de pagamento</label>
                  <select id="tipo_pagamento" name="tipo_pagamento" required>
                    <option value="">Selecione o pagamento</option>
                    <option value="PIX">PIX</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Guia">Guia</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Descontado na Operação">Descontado na Operação</option>
                    <option value="Cartão">Cartão</option>
                    <option value="Cartão Caixa VISA">Cartão Caixa VISA</option>
                    <option value="Cartão Caixa Elo">Cartão Caixa Elo</option>
                    <option value="Cartão Outro">Cartão Outro</option>
                  </select>
                </div>

                <div>
                  <label for="categoria_id">Categoria</label>
                  <select id="categoria_id" name="categoria_id" required>
                    ${optionsCategorias}
                  </select>
                </div>
              </div>

              <div class="actions">
                <button type="submit">Criar lançamento</button>
                <a class="btn-secondary" href="/documentos">Cancelar</a>
              </div>
            </form>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao abrir geração de lançamento:\n${error.message}</pre>`);
  }
});

router.post('/documentos/gerar-lancamento/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const docResult = await pool.query(
      'SELECT * FROM documentos_fiscais WHERE id = $1',
      [id]
    );

    if (!docResult.rows.length) {
      return res.send('<pre>Documento não encontrado.</pre>');
    }

    const doc = docResult.rows[0];

    const {
      tipo_documento,
      numero_documento,
      data_despesa,
      fornecedor,
      cnpj_cpf,
      codigo_pagamento,
      valor,
      tipo_pagamento,
      categoria_id
    } = req.body;

    const lancamentoResult = await pool.query(
      `INSERT INTO lancamentos
      (tipo_documento, numero_documento, data_despesa, fornecedor, cnpj_cpf, codigo_pagamento, categoria_id, valor, tipo_pagamento, anexo_pdf, anexo_xml)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id`,
      [
        tipo_documento,
        numero_documento || null,
        data_despesa,
        fornecedor,
        cnpj_cpf || null,
        codigo_pagamento || null,
        categoria_id,
        valor,
        tipo_pagamento,
        doc.anexo_pdf || null,
        doc.anexo_xml || null
      ]
    );

    const lancamentoId = lancamentoResult.rows[0].id;

    await pool.query(
      `UPDATE documentos_fiscais
       SET status = 'Lancado',
           lancamento_id = $1
       WHERE id = $2`,
      [lancamentoId, id]
    );

    res.redirect('/documentos');
  } catch (error) {
    res.send(`<pre>Erro ao gerar lançamento:\n${error.message}</pre>`);
  }
});

// =============================
// LANÇAMENTOS
// =============================
    
router.get('/novo', async (req, res) => {
  try {
    const { rotina_id = '' } = req.query;

    const categoriasResult = await pool.query(`
      SELECT
        c.id,
        c.nome,
        c.categoria_pai_id,
        p.nome AS categoria_pai_nome
      FROM categorias c
      LEFT JOIN categorias p ON p.id = c.categoria_pai_id
      ORDER BY
        COALESCE(p.nome, c.nome),
        c.categoria_pai_id NULLS FIRST,
        c.nome
    `);

    const categorias = categoriasResult.rows;

    let rotinaPadrao = null;

    if (rotina_id) {
      const rotinaResult = await pool.query(`
        SELECT
          r.*,
          cp.nome AS categoria_principal_nome,
          cs.nome AS subcategoria_nome
        FROM rotina_despesas r
        LEFT JOIN categorias cp ON cp.id = r.categoria_principal_id
        LEFT JOIN categorias cs ON cs.id = r.subcategoria_id
        WHERE r.id = $1
        LIMIT 1
      `, [rotina_id]);

      if (rotinaResult.rows.length) {
        rotinaPadrao = rotinaResult.rows[0];
      }
    }

    const categoriaSelecionada = rotinaPadrao?.subcategoria_id || rotinaPadrao?.categoria_principal_id || '';

    let optionsCategorias = '<option value="">Selecione a categoria</option>';
    categorias.forEach(cat => {
      const selected = String(categoriaSelecionada) === String(cat.id) ? 'selected' : '';
      const nomeExibicao = cat.categoria_pai_nome
        ? `${cat.categoria_pai_nome} > ${cat.nome}`
        : cat.nome;

      optionsCategorias += `<option value="${cat.id}" ${selected}>${nomeExibicao}</option>`;
    });

    const fornecedorPadrao = rotinaPadrao?.fornecedor || '';
    const cnpjCpfPadrao = rotinaPadrao?.cnpj_cpf || '';
    const tipoPagamentoPadrao = rotinaPadrao?.tipo_pagamento_padrao || '';

    const origemInfo = rotinaPadrao
      ? `
        <div style="
          margin-bottom: 16px;
          padding: 12px 14px;
          border-radius: 10px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1e3a8a;
          font-size: 13px;
        ">
          Lançamento iniciado a partir da rotina:
          <strong>${rotinaPadrao.fornecedor || 'Sem fornecedor'}</strong>
          ${rotinaPadrao.categoria_principal_nome ? ` | Categoria principal: <strong>${rotinaPadrao.categoria_principal_nome}</strong>` : ''}
          ${rotinaPadrao.subcategoria_nome ? ` | Subcategoria: <strong>${rotinaPadrao.subcategoria_nome}</strong>` : ''}
          ${rotinaPadrao.tipo_pagamento_padrao ? ` | Pagamento padrão: <strong>${rotinaPadrao.tipo_pagamento_padrao}</strong>` : ''}
        </div>
      `
      : '';

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Novo lançamento</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: linear-gradient(180deg, #f8fbff 0%, #f3f6fb 100%);
            color: #111827;
          }
          .container {
            max-width: 900px;
            margin: 24px auto;
            padding: 0 16px;
          }
          .card {
            background: rgba(255,255,255,0.95);
            border-radius: 18px;
            box-shadow: 0 8px 30px rgba(15, 23, 42, 0.06);
            padding: 24px;
            border: 1px solid #e8eef7;
          }
          h1 {
            margin-top: 0;
            margin-bottom: 20px;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
          }
          .full {
            grid-column: 1 / -1;
          }
          label {
            display: block;
            margin-bottom: 6px;
            font-weight: bold;
            font-size: 14px;
          }
          input, select {
            width: 100%;
            padding: 12px;
            border: 1px solid #d1d5db;
            border-radius: 10px;
            font-size: 15px;
          }
          .actions {
            margin-top: 20px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }
          button, a {
            text-decoration: none;
            padding: 12px 18px;
            border-radius: 10px;
            font-weight: bold;
            border: none;
            cursor: pointer;
            display: inline-block;
          }
          button {
            background: #2563eb;
            color: white;
          }
          .btn-secondary {
            background: #e5e7eb;
            color: #111827;
          }
          .field-hint {
            margin-top: 6px;
            font-size: 10px;
            color: #6b7280;
          }
        

/* ===== PADRÃO VISUAL DEUS É MAIS - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL DEUS É MAIS ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */

</style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <h1>➕ Novo lançamento</h1>

            ${origemInfo}

            <form method="POST" action="/novo" enctype="multipart/form-data">
              <input type="hidden" name="rotina_id" value="${rotinaPadrao?.id || ''}">

              <div class="grid">
                <div>
                  <label for="tipo_documento">Tipo do documento</label>
                  <select id="tipo_documento" name="tipo_documento" required>
                    ${renderTipoDocumentoOptions()}
                  </select>
                </div>

                <div>
                  <label for="numero_documento">Número do documento</label>
                  <input id="numero_documento" name="numero_documento" placeholder="Ex.: NF12341" />
                </div>

                <div>
                  <label for="data_despesa">Data</label>
                  <input id="data_despesa" type="date" name="data_despesa" required />
                </div>

                <div>
                  <label for="valor">Valor</label>
                  <input id="valor" name="valor" type="text" inputmode="decimal" placeholder="R$ 0,00" required />
                </div>

                <div class="full">
                  <label for="fornecedor">Fornecedor</label>
                  <input
                    id="fornecedor"
                    name="fornecedor"
                    placeholder="Nome do fornecedor"
                    value="${fornecedorPadrao}"
                    required
                  />
                </div>

                <div>
                  <label for="cnpj_cpf">CNPJ/CPF</label>
                  <input id="cnpj_cpf" name="cnpj_cpf" placeholder="Informe o CNPJ ou CPF" value="${cnpjCpfPadrao}" />
                </div>

                <div>
                  <label for="codigo_pagamento">Código de pagamento</label>
                  <input id="codigo_pagamento" name="codigo_pagamento" placeholder="Ex.: NSU, referência" />
                </div>

                <div>
                  <label for="tipo_pagamento">Tipo de pagamento</label>
                  <select id="tipo_pagamento" name="tipo_pagamento" required>
                    <option value="">Selecione o pagamento</option>
                    <option value="PIX" ${tipoPagamentoPadrao === 'PIX' ? 'selected' : ''}>PIX</option>
                    <option value="Boleto" ${tipoPagamentoPadrao === 'Boleto' ? 'selected' : ''}>Boleto</option>
                    <option value="Guia" ${tipoPagamentoPadrao === 'Guia' ? 'selected' : ''}>Guia</option>
                    <option value="Dinheiro" ${tipoPagamentoPadrao === 'Dinheiro' ? 'selected' : ''}>Dinheiro</option>
                    <option value="Descontado na Operação" ${tipoPagamentoPadrao === 'Descontado na Operação' ? 'selected' : ''}>Descontado na Operação</option>
                    <option value="Cartão" ${tipoPagamentoPadrao === 'Cartão' ? 'selected' : ''}>Cartão</option>
                    <option value="Cartão Caixa VISA" ${tipoPagamentoPadrao === 'Cartão Caixa VISA' ? 'selected' : ''}>Cartão Caixa VISA</option>
                    <option value="Cartão Caixa Elo" ${tipoPagamentoPadrao === 'Cartão Caixa Elo' ? 'selected' : ''}>Cartão Caixa Elo</option>
                    <option value="Cartão Outro" ${tipoPagamentoPadrao === 'Cartão Outro' ? 'selected' : ''}>Cartão Outro</option>
                  </select>
                </div>

                <div>
                  <label for="categoria_id">Categoria</label>
                  <select id="categoria_id" name="categoria_id" required>
                    ${optionsCategorias}
                  </select>
                </div>

                <div>
                  <label for="anexo_pdf">PDF</label>
                  <input id="anexo_pdf" type="file" name="anexo_pdf" accept=".pdf" />
                </div>

                <div>
                  <label for="anexo_xml">XML</label>
                  <input id="anexo_xml" type="file" name="anexo_xml" accept=".xml,text/xml,application/xml" />
                  <div class="field-hint">Anexe o XML para salvar junto com o lançamento e disponibilizar para download depois.</div>
                </div>
              </div>

              <div class="actions">
                <button type="submit">Salvar</button>
                <a class="btn-secondary" href="/rotina-despesas">Voltar para Levantamento de Despesas Mensais</a>
              </div>
            </form>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao carregar formulário:\n${error.message}</pre>`);
  }
});
router.post(
  '/novo',
  upload.fields([
    { name: 'anexo_pdf', maxCount: 1 },
    { name: 'anexo_xml', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const {
        tipo_documento,
        numero_documento,
        data_despesa,
        fornecedor,
        cnpj_cpf,
        codigo_pagamento,
        valor,
        tipo_pagamento,
        categoria_id
      } = req.body;

      const anexoPdf = req.files && req.files.anexo_pdf ? req.files.anexo_pdf[0].filename : null;
      const anexoXml = req.files && req.files.anexo_xml ? req.files.anexo_xml[0].filename : null;

      await pool.query(
        `INSERT INTO lancamentos
        (tipo_documento, numero_documento, data_despesa, fornecedor, cnpj_cpf, codigo_pagamento, categoria_id, valor, tipo_pagamento, anexo_pdf, anexo_xml)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          tipo_documento,
          numero_documento || null,
          data_despesa,
          fornecedor,
          cnpj_cpf || null,
          codigo_pagamento || null,
          categoria_id,
          parseMoneyBR(valor),
          tipo_pagamento,
          anexoPdf,
          anexoXml
        ]
      );

      res.redirect('/lancamentos');
    } catch (error) {
      res.send(`<pre>Erro ao salvar lançamento:\n${error.message}</pre>`);
    }
  }
);

router.get('/editar/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const lancamentoResult = await pool.query(
      'SELECT * FROM lancamentos WHERE id = $1',
      [id]
    );

    if (lancamentoResult.rows.length === 0) {
      return res.send('<pre>Lançamento não encontrado.</pre>');
    }

    const lancamento = lancamentoResult.rows[0];
    const options = await getCategoriasOptions(lancamento.categoria_id);

    const dataFormatada = lancamento.data_despesa
      ? new Date(lancamento.data_despesa).toISOString().split('T')[0]
      : '';

   const linkPdf = lancamento.anexo_pdf
  ? `<span>PDF: <a href="/uploads/${lancamento.anexo_pdf}" target="_blank">Ver</a></span>`
  : `<span class="hint">PDF: não enviado</span>`;

const linkXml = lancamento.anexo_xml
  ? `<span>XML: <a href="/uploads/${lancamento.anexo_xml}" target="_blank">Ver</a></span>`
  : `<span class="hint">XML: não enviado</span>`;

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Editar lançamento</title>
        <style>
          * { box-sizing: border-box; }
          body {
  margin: 0;
  font-family: Arial, sans-serif;
  font-size: 13px;
  background: #f6f8fb;
  color: #111827;
}

.container {
  max-width: 1600px;
  margin: 18px auto;
  padding: 0 12px;
}

.card {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
  padding: 14px;
  border: 1px solid #e5e7eb;
}

h1 {
  margin-top: 0;
  margin-bottom: 12px;
  font-size: 20px;
}

label {
  display: block;
  font-size: 10px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #475569;
}

input, select {
  width: 100%;
  padding: 7px 9px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  background: #fff;
}

table {
  width: 100%;
  border-collapse: collapse;
  overflow: hidden;
}

th, td {
  padding: 7px 8px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: middle;
  font-size: 12.5px;
  line-height: 1.2;
}

th {
  background: #eaf0fb;
  color: #1e3a8a;
  font-weight: 700;
  position: sticky;
  top: 0;
}

tr:hover {
  background: #f8fafc;
}
         .btn-secondary { background: #e5e7eb; color: #111827; }

/* ===== VISUAL PREMIUM /EDITAR ===== */
body {
  background: #f8fafc;
  color: #1f2937;
  font-size: 13px;
}

.container {
  max-width: 1100px;
  margin: 28px auto;
  padding: 0 18px;
}

.card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 4px 12px rgba(0,0,0,0.04);
  padding: 22px;
}

h1 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 18px;
}

label {
  font-size: 10px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
  display: block;
}

input, select {
  width: 100%;
  font-size: 13px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
}

input:focus, select:focus {
  outline: none;
  border-color: #2563eb;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.full {
  grid-column: 1 / -1;
}

.actions {
  margin-top: 18px;
  display: flex;
  gap: 10px;
}

button {
  background: #2563eb;
  color: white;
  padding: 10px 14px;
  border-radius: 8px;
  border: none;
  font-weight: 600;
}

button:hover {
  background: #1d4ed8;
}

.btn-secondary {
  background: #e5e7eb;
  color: #111827;
}

.btn-secondary:hover {
  background: #d1d5db;
}


/* ===== PADRÃO VISUAL DEUS É MAIS - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL DEUS É MAIS ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */

</style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <h1>✏️ Editar lançamento</h1>
            ${linkPdf}
            ${linkXml}

            <form method="POST" action="/editar/${lancamento.id}" enctype="multipart/form-data">
              <div class="grid">
                <div>
                  <label for="tipo_documento">Tipo do documento</label>
                  <select id="tipo_documento" name="tipo_documento" required>
                    ${renderTipoDocumentoOptions(lancamento.tipo_documento)}
                  </select>
                </div>

                <div>
                  <label for="numero_documento">Número do documento</label>
                  <input id="numero_documento" name="numero_documento" value="${lancamento.numero_documento || ''}" />
                </div>

                <div>
                  <label for="data_despesa">Data</label>
                  <input id="data_despesa" type="date" name="data_despesa" value="${dataFormatada}" required />
                </div>

                <div>
                  <label for="valor">Valor</label>
                  <input id="valor" name="valor" type="text" inputmode="decimal" value="${formatValorInputBR(lancamento.valor)}" placeholder="R$ 0,00" required />
                </div>

                <div class="full">
                  <label for="fornecedor">Fornecedor</label>
                  <input id="fornecedor" name="fornecedor" value="${lancamento.fornecedor || ''}" required />
                </div>

                <div>
                  <label for="cnpj_cpf">CNPJ/CPF</label>
                  <input id="cnpj_cpf" name="cnpj_cpf" value="${lancamento.cnpj_cpf || ''}" />
                </div>

                <div>
                  <label for="codigo_pagamento">Código de pagamento</label>
                  <input id="codigo_pagamento" name="codigo_pagamento" value="${lancamento.codigo_pagamento || ''}" />
                </div>

                <div>
                  <label for="tipo_pagamento">Tipo de pagamento</label>
                  <select id="tipo_pagamento" name="tipo_pagamento" required>
                    <option value="">Selecione o pagamento</option>
                    <option value="PIX" ${lancamento.tipo_pagamento === 'PIX' ? 'selected' : ''}>PIX</option>
                    <option value="Boleto" ${lancamento.tipo_pagamento === 'Boleto' ? 'selected' : ''}>Boleto</option>
                    <option value="Guia" ${lancamento.tipo_pagamento === 'Guia' ? 'selected' : ''}>Guia</option>
                    <option value="Dinheiro" ${lancamento.tipo_pagamento === 'Dinheiro' ? 'selected' : ''}>Dinheiro</option>
                    <option value="Descontado na Operação" ${lancamento.tipo_pagamento === 'Descontado na Operação' ? 'selected' : ''}>Descontado na Operação</option>
                    <option value="Cartão" ${lancamento.tipo_pagamento === 'Cartão' ? 'selected' : ''}>Cartão</option>
                    <option value="Cartão Caixa VISA" ${lancamento.tipo_pagamento === 'Cartão Caixa VISA' ? 'selected' : ''}>Cartão Caixa VISA</option>
                    <option value="Cartão Caixa Elo" ${lancamento.tipo_pagamento === 'Cartão Caixa Elo' ? 'selected' : ''}>Cartão Caixa Elo</option>
                    <option value="Cartão Outro" ${lancamento.tipo_pagamento === 'Cartão Outro' ? 'selected' : ''}>Cartão Outro</option>
                  </select>
                </div>

                <div>
                  <label for="categoria_id">Categoria</label>
                  <select id="categoria_id" name="categoria_id" required>
                    ${options}
                  </select>
                </div>

                <div>
                  <label for="anexo_pdf">Trocar PDF</label>
                  <input id="anexo_pdf" type="file" name="anexo_pdf" accept=".pdf" />
                </div>

                <div>
                  <label for="anexo_xml">Trocar XML</label>
                  <input id="anexo_xml" type="file" name="anexo_xml" accept=".xml,text/xml,application/xml" />
                </div>
              </div>

              <div class="actions">
                <button type="submit">Atualizar</button>
              <a class="btn-secondary" href="/lancamentos" style="display:inline-block; padding:10px 14px; border-radius:8px; font-weight:600;">Cancelar</a>
              </div>
            </form>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao carregar edição:\n${error.message}</pre>`);
  }
});

router.post('/editar/:id', upload.fields([{ name: 'anexo_pdf', maxCount: 1 }, { name: 'anexo_xml', maxCount: 1 }]), async (req, res) => {
  try {
    const { id } = req.params;

    const atual = await pool.query(
      `SELECT anexo_pdf, anexo_xml
       FROM lancamentos
       WHERE id = $1`,
      [id]
    );

    const lancamentoAtual = atual.rows[0] || {};
    const novoPdf = req.files && req.files.anexo_pdf ? req.files.anexo_pdf[0].filename : lancamentoAtual.anexo_pdf;
    const novoXml = req.files && req.files.anexo_xml ? req.files.anexo_xml[0].filename : lancamentoAtual.anexo_xml;

    const {
      tipo_documento,
      numero_documento,
      data_despesa,
      fornecedor,
      cnpj_cpf,
      codigo_pagamento,
      valor,
      tipo_pagamento,
      categoria_id
    } = req.body;

    await pool.query(
      `UPDATE lancamentos
       SET tipo_documento = $1,
           numero_documento = $2,
           data_despesa = $3,
           fornecedor = $4,
           cnpj_cpf = $5,
           codigo_pagamento = $6,
           valor = $7,
           tipo_pagamento = $8,
           categoria_id = $9,
           anexo_pdf = $10,
           anexo_xml = $11
       WHERE id = $12`,
      [tipo_documento, numero_documento || null, data_despesa, fornecedor, cnpj_cpf || null, codigo_pagamento || null, parseMoneyBR(valor), tipo_pagamento, categoria_id, novoPdf, novoXml, id]
    );

    res.redirect('/lancamentos');
  } catch (error) {
    res.send(`<pre>Erro ao atualizar lançamento:\n${error.message}</pre>`);
  }
});

router.get('/download/pdf/:id', protegerRota, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        l.anexo_pdf,
        l.tipo_pagamento,
        l.fornecedor,
        l.numero_documento,
        l.tipo_documento,
        l.valor,
        c.nome AS categoria
      FROM lancamentos l
      LEFT JOIN categorias c ON c.id = l.categoria_id
      WHERE l.id = $1
      `,
      [id]
    );

    if (!result.rows.length || !result.rows[0].anexo_pdf) {
      return res.send('<pre>PDF não encontrado.</pre>');
    }

    const lancamento = result.rows[0];
    const filePath = getUploadFilePath(lancamento.anexo_pdf);

    if (!fs.existsSync(filePath)) {
      return res.send('<pre>Arquivo PDF não encontrado na pasta uploads.</pre>');
    }

    const baseName = buildDownloadBaseName(lancamento);
    res.download(filePath, `${baseName}.pdf`);
  } catch (error) {
    res.send(`<pre>Erro ao baixar PDF:\n${error.message}</pre>`);
  }
});

router.get('/download/xml/:id', protegerRota, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        l.anexo_xml,
        l.tipo_pagamento,
        l.fornecedor,
        l.numero_documento,
        l.tipo_documento,
        l.valor,
        c.nome AS categoria
      FROM lancamentos l
      LEFT JOIN categorias c ON c.id = l.categoria_id
      WHERE l.id = $1
      `,
      [id]
    );

    if (!result.rows.length || !result.rows[0].anexo_xml) {
      return res.send('<pre>XML não encontrado.</pre>');
    }

    const lancamento = result.rows[0];
    const filePath = getUploadFilePath(lancamento.anexo_xml);

    if (!fs.existsSync(filePath)) {
      return res.send('<pre>Arquivo XML não encontrado na pasta uploads.</pre>');
    }

    const baseName = buildDownloadBaseName(lancamento);
    res.download(filePath, `${baseName}.xml`);
  } catch (error) {
    res.send(`<pre>Erro ao baixar XML:\n${error.message}</pre>`);
  }
});

router.post('/excluir/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM lancamentos WHERE id = $1', [id]);
    res.redirect('/lancamentos');
  } catch (error) {
    res.send(`<pre>Erro ao excluir lançamento:\n${error.message}</pre>`);
  }
});

router.get('/lancamentos', protegerRota, async (req, res) => {
  try {
    const {
      fornecedor = '',
      categoria_id = '',
      tipo_pagamento = '',
      cnpj_cpf = '',
      codigo_pagamento = '',
      numero_documento = '',
      data_inicio = '',
      data_fim = ''
    } = req.query;

    const categoriasResult = await pool.query(`
      SELECT c.id, c.nome, c.categoria_pai_id, p.nome AS categoria_pai_nome
      FROM categorias c
      LEFT JOIN categorias p ON p.id = c.categoria_pai_id
      ORDER BY
        COALESCE(p.nome, c.nome),
        c.categoria_pai_id NULLS FIRST,
        c.nome
    `);
    const categorias = categoriasResult.rows;

    let where = [];
    let values = [];

    if (fornecedor) {
      values.push(`%${fornecedor}%`);
      where.push(`l.fornecedor ILIKE $${values.length}`);
    }
    if (categoria_id) {
      values.push(categoria_id);
      where.push(`l.categoria_id = $${values.length}`);
    }
    if (tipo_pagamento) {
      values.push(tipo_pagamento);
      where.push(`l.tipo_pagamento = $${values.length}`);
    }
    if (cnpj_cpf) {
      values.push(`%${cnpj_cpf}%`);
      where.push(`CAST(l.cnpj_cpf AS TEXT) ILIKE $${values.length}`);
    }
    if (codigo_pagamento) {
      values.push(`%${codigo_pagamento}%`);
      where.push(`l.codigo_pagamento ILIKE $${values.length}`);
    }
    if (numero_documento) {
      values.push(`%${numero_documento}%`);
      where.push(`l.numero_documento ILIKE $${values.length}`);
    }
    if (data_inicio) {
      values.push(data_inicio);
      where.push(`l.data_despesa >= $${values.length}`);
    }
    if (data_fim) {
      values.push(data_fim);
      where.push(`l.data_despesa <= $${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await pool.query(
      `
      SELECT
        l.id,
        l.tipo_documento,
        l.numero_documento,
        l.data_despesa,
        l.fornecedor,
        l.cnpj_cpf,
        l.codigo_pagamento,
        l.valor,
        l.tipo_pagamento,
        l.anexo_pdf,
        l.anexo_xml,
        c.nome AS categoria
      FROM lancamentos l
      LEFT JOIN categorias c ON c.id = l.categoria_id
      ${whereSql}
      ORDER BY l.id DESC
      `,
      values
    );

    const resumoResult = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total_itens,
        COALESCE(SUM(l.valor), 0)::numeric AS valor_total
      FROM lancamentos l
      ${whereSql}
      `,
      values
    );

    const totalItens = resumoResult.rows[0]?.total_itens || 0;
    const valorTotal = resumoResult.rows[0]?.valor_total || 0;

    let linhas = '';
    result.rows.forEach(l => {
const nomePagamento = (l.tipo_pagamento || 'SemPagamento')
  .toString()
  .trim()
  .replace(/\s+/g, ' ');

const nomeFornecedor = (l.fornecedor || 'SemFornecedor')
  .toString()
  .trim()
  .replace(/\s+/g, ' ');

const nomeCategoria = (l.categoria || 'SemCategoria')
  .toString()
  .trim()
  .replace(/\s+/g, ' ');

const nomeNumero = (l.numero_documento || 'SemNumero')
  .toString()
  .trim()
  .replace(/\s+/g, ' ');

const nomeValor = formatMoneyBR(l.valor || 0)
  .replace(/\s+/g, '');

const nomeBaseDownload = `${nomePagamento}-${nomeFornecedor}-${nomeCategoria}-${nomeNumero}-${nomeValor}`
  .replace(/[\/\\:*?"<>|]/g, '-')
  .replace(/\s+/g, ' ')
  .trim();

      const pdfHtml = l.anexo_pdf
  ? `
    <a class="icon-btn" title="Ver PDF" href="/uploads/${l.anexo_pdf}" target="_blank">👁</a>
    <a class="icon-btn" title="Baixar PDF" href="/uploads/${l.anexo_pdf}" download="${nomeBaseDownload}.pdf">⬇</a>
  `
  : '<span style="color:#9ca3af;">-</span>';

      const xmlHtml = l.anexo_xml
  ? `
    <a class="icon-btn" title="Ver XML" href="/uploads/${l.anexo_xml}" target="_blank">👁</a>
    <a class="icon-btn" title="Baixar XML" href="/uploads/${l.anexo_xml}" download="${nomeBaseDownload}.xml">⬇</a>
  `
  : '<span style="color:#9ca3af;">-</span>';

      linhas += `
        <tr>
          <td>${l.id}</td>
          <td>${l.tipo_documento || ''}</td>
          <td>${l.numero_documento || ''}</td>
          <td>${l.data_despesa ? new Date(l.data_despesa).toLocaleDateString('pt-BR') : ''}</td>
          <td>${l.fornecedor || ''}</td>
          <td class="col-cnpj">${l.cnpj_cpf || ''}</td>
          <td class="col-codpag">${l.codigo_pagamento || ''}</td>
          <td class="col-valor">${formatMoneyBR(l.valor || 0)}</td>
          <td class="col-pagamento">${l.tipo_pagamento || ''}</td>
          <td class="col-categoria">${l.categoria || ''}</td>
          <td class="col-pdf">${pdfHtml}</td>
          <td class="col-xml">${xmlHtml}</td>
          <td class="actions-cell">
            <a class="icon-btn" title="Editar" href="/editar/${l.id}">✏️</a>
            <form method="POST" action="/excluir/${l.id}" style="display:inline;" onsubmit="return confirm('Tem certeza que deseja excluir este lançamento?');">
              <button type="submit" class="icon-btn btn-icon-danger" title="Excluir">🗑️</button>
            </form>
          </td>
        </tr>
      `;
    });

    let optionsCategorias = '<option value="">Todas as categorias</option>';
    categorias.forEach(cat => {
      const selected = String(categoria_id) === String(cat.id) ? 'selected' : '';
      const nomeExibicao = cat.categoria_pai_nome
        ? `${cat.categoria_pai_nome} > ${cat.nome}`
        : cat.nome;

      optionsCategorias += `<option value="${cat.id}" ${selected}>${nomeExibicao}</option>`;
    });

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Lista de lançamentos</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #f8fafc;
            color: #1f2937;
            font-size: 13px;
          }
          .container {
            max-width: 1750px;
            margin: 40px auto;
            padding: 0 20px;
          }
          .card {
            background: #ffffff;
            border-radius: 12px;
            border: 1px solid #e5e7eb;
            box-shadow: 0 4px 12px rgba(0,0,0,0.04);
            padding: 24px;
          }
          h1 {
            margin-top: 0;
            font-size: 18px;
            font-weight: 600;
            color: #111827;
          }
          .actions {
            margin-bottom: 18px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          }
          .btn {
            display: inline-block;
            text-decoration: none;
            padding: 8px 14px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: bold;
            transition: all 0.2s ease;
            border: none;
            cursor: pointer;
          }
          .btn-primary { background: #2563eb; color: white; }
          .btn-primary:hover { background: #1d4ed8; }
          .btn-secondary { background: #e5e7eb; color: #111827; }
          .btn-secondary:hover { background: #d1d5db; }
          .btn-success { background: #16a34a; color: white; }
          .btn-success:hover { background: #15803d; }

          .painel-colunas {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            padding: 8px 12px;
            border-radius: 8px;
            margin-bottom: 12px;
          }
          .painel-colunas label {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 10px;
            margin: 0;
            color: #374151;
          }
          .painel-colunas input[type="checkbox"] {
            width: auto;
            margin: 0;
          }

          .filters {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 8px;
            margin-bottom: 20px;
            align-items: end;
          }
          label {
            display: block;
            font-size: 10px;
            font-weight: bold;
            margin-bottom: 6px;
          }
          input, select {
            width: 100%;
            padding: 8px 10px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 13px;
            background: #fff;
          }
          input:focus, select:focus {
            outline: none;
            border-color: #2563eb;
          }
          .filter-buttons {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          }
          .filter-buttons button,
          .filter-buttons a {
            text-decoration: none;
            padding: 10px 14px;
            border-radius: 10px;
            font-weight: bold;
            border: none;
            cursor: pointer;
            display: inline-block;
          }
          .filter-buttons button {
            background: #2563eb;
            color: white;
          }
          .filter-buttons a {
            background: #e5e7eb;
            color: #111827;
          }

          .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 10px;
            margin-bottom: 14px;
          }
          .sum-card {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 10px 14px;
          }
          .sum-title {
            font-size: 11px;
            color: #6b7280;
          }
          .sum-value {
            font-size: 18px;
            font-weight: 600;
            color: #111827;
            line-height: 1.1;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            border-radius: 12px;
            overflow: hidden;
          }
          th {
            background: #f1f5f9;
            font-weight: 600;
            color: #334155;
            font-size: 10px;
            text-transform: uppercase;
            text-align: left;
          }
          th, td {
            padding: 8px 10px;
            border-bottom: 1px solid #f1f5f9;
            vertical-align: middle;
          }
          tr:hover {
            background: #f9fafb;
          }

          .col-valor {
            text-align: right;
            font-weight: 600;
            color: #111827;
          }
          th.col-valor {
            text-align: right;
          }

          .col-pdf, .col-xml {
            width: 70px;
            text-align: center;
          }

          .actions-cell {
            white-space: nowrap;
          }

          .icon-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            padding: 0;
            margin: 0 3px;
            border: none !important;
            background: transparent !important;
            box-shadow: none !important;
            outline: none !important;
            text-decoration: none;
            font-size: 14px;
            color: #64748b;
            cursor: pointer;
          }
          .icon-btn:hover {
            color: #1d4ed8;
            transform: scale(1.08);
          }
          .icon-btn[title="Excluir"] {
            color: #ef4444;
          }
          .icon-btn[title="Excluir"]:hover {
            color: #dc2626;
          }
          .icon-btn[title="Editar"] {
            color: #2563eb;
          }
        

/* ===== PADRÃO VISUAL DEUS É MAIS - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL DEUS É MAIS ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */

</style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <h1>📋 Lista de lançamentos</h1>

            <div class="actions">
              <a class="btn btn-primary" href="/novo">+ Novo lançamento</a>
              <a class="btn btn-dark" href="/dashboard">Voltar ao Painel</a>
              <a class="btn btn-dark" href="/documentos">Documentos Fiscais</a>
<a class="btn btn-dark" href="/rotina-despesas">📋 Levantamento de Despesas Mensais</a>
              <a class="btn btn-dark" href="/exportar-excel?fornecedor=${encodeURIComponent(fornecedor)}&categoria_id=${encodeURIComponent(categoria_id)}&tipo_pagamento=${encodeURIComponent(tipo_pagamento)}&cnpj_cpf=${encodeURIComponent(cnpj_cpf)}&codigo_pagamento=${encodeURIComponent(codigo_pagamento)}&numero_documento=${encodeURIComponent(numero_documento)}&data_inicio=${encodeURIComponent(data_inicio)}&data_fim=${encodeURIComponent(data_fim)}">Exportar Excel</a>
              <button type="button" class="btn btn-dark" onclick="togglePainelColunas()">Colunas</button>
            </div>

            <div id="painel-colunas" class="painel-colunas" style="display:none;">
              <label><input type="checkbox" data-col="col-cnpj"> CNPJ/CPF</label>
              <label><input type="checkbox" data-col="col-codpag"> Cód. pagamento</label>
              <label><input type="checkbox" data-col="col-pagamento"> Pagamento</label>
              <label><input type="checkbox" data-col="col-categoria"> Categoria</label>
              <label><input type="checkbox" data-col="col-pdf"> PDF</label>
              <label><input type="checkbox" data-col="col-xml"> XML</label>
            </div>

            <form method="GET" action="/lancamentos">
              <div class="filters">
                <div>
                  <label for="fornecedor">Fornecedor</label>
                  <input id="fornecedor" name="fornecedor" value="${fornecedor}" placeholder="Buscar fornecedor" />
                </div>

                <div>
                  <label for="cnpj_cpf">CNPJ/CPF</label>
                  <input id="cnpj_cpf" name="cnpj_cpf" value="${cnpj_cpf}" placeholder="Buscar CNPJ/CPF" />
                </div>

                <div>
                  <label for="codigo_pagamento">Código de pagamento</label>
                  <input id="codigo_pagamento" name="codigo_pagamento" value="${codigo_pagamento}" placeholder="Buscar código" />
                </div>

                <div>
                  <label for="numero_documento">Número do documento</label>
                  <input id="numero_documento" name="numero_documento" value="${numero_documento}" placeholder="Buscar número" />
                </div>

                <div>
                  <label for="categoria_id">Categoria</label>
                  <select id="categoria_id" name="categoria_id">
                    ${optionsCategorias}
                  </select>
                </div>

                <div>
                  <label for="tipo_pagamento">Pagamento</label>
                  <select id="tipo_pagamento" name="tipo_pagamento">
                    <option value="">Todos</option>
                    <option value="PIX" ${tipo_pagamento === 'PIX' ? 'selected' : ''}>PIX</option>
                    <option value="Boleto" ${tipo_pagamento === 'Boleto' ? 'selected' : ''}>Boleto</option>
                    <option value="Guia" ${tipo_pagamento === 'Guia' ? 'selected' : ''}>Guia</option>
                    <option value="Dinheiro" ${tipo_pagamento === 'Dinheiro' ? 'selected' : ''}>Dinheiro</option>
                    <option value="Descontado na Operação" ${tipo_pagamento === 'Descontado na Operação' ? 'selected' : ''}>Descontado na Operação</option>
                    <option value="Cartão" ${tipo_pagamento === 'Cartão' ? 'selected' : ''}>Cartão</option>
                    <option value="Cartão Caixa VISA" ${tipo_pagamento === 'Cartão Caixa VISA' ? 'selected' : ''}>Cartão Caixa VISA</option>
                    <option value="Cartão Caixa Elo" ${tipo_pagamento === 'Cartão Caixa Elo' ? 'selected' : ''}>Cartão Caixa Elo</option>
                    <option value="Cartão Outro" ${tipo_pagamento === 'Cartão Outro' ? 'selected' : ''}>Cartão Outro</option>
                  </select>
                </div>

                <div>
                  <label for="data_inicio">Data inicial</label>
                  <input id="data_inicio" type="date" name="data_inicio" value="${data_inicio}" />
                </div>

                <div>
                  <label for="data_fim">Data final</label>
                  <input id="data_fim" type="date" name="data_fim" value="${data_fim}" />
                </div>

                <div class="filter-buttons">
                  <button type="submit">Filtrar</button>
                  <a href="/lancamentos">Limpar</a>
                </div>
              </div>
            </form>

            <div class="summary">
              <div class="sum-card">
                <div class="sum-title">Quantidade de itens filtrados</div>
                <div class="sum-value">${totalItens}</div>
              </div>
              <div class="sum-card">
                <div class="sum-title">Valor total filtrado</div>
                <div class="sum-value">${formatMoneyBR(valorTotal)}</div>
              </div>
            </div>

            <table>
              <tr>
                <th>ID</th>
                <th>Documento</th>
                <th>Número</th>
                <th>Data</th>
                <th>Fornecedor</th>
                <th class="col-cnpj">CNPJ/CPF</th>
                <th class="col-codpag">Cód. pagamento</th>
                <th class="col-valor">Valor</th>
                <th class="col-pagamento">Pagamento</th>
                <th class="col-categoria">Categoria</th>
                <th class="col-pdf">PDF</th>
                <th class="col-xml">XML</th>
                <th>Ações</th>
              </tr>
              ${linhas || '<tr><td colspan="13">Nenhum lançamento encontrado.</td></tr>'}
            </table>
          </div>
        </div>

        <script>
          function togglePainelColunas() {
            const painel = document.getElementById('painel-colunas');
            painel.style.display = painel.style.display === 'none' ? 'flex' : 'none';
          }

          function aplicarColuna(nomeColuna, mostrar) {
            document.querySelectorAll('.' + nomeColuna).forEach(el => {
              el.style.display = mostrar ? '' : 'none';
            });
          }

          function salvarPreferenciasColunas() {
            const preferencias = {};
            document.querySelectorAll('#painel-colunas input[type="checkbox"]').forEach(chk => {
              preferencias[chk.dataset.col] = chk.checked;
            });
            localStorage.setItem('painelFiscalColunas', JSON.stringify(preferencias));
          }

          function carregarPreferenciasColunas() {
            const padrao = {
              'col-cnpj': false,
              'col-codpag': false,
              'col-pagamento': true,
              'col-categoria': true,
              'col-pdf': true,
              'col-xml': true
            };

            let preferencias = padrao;
            const salvo = localStorage.getItem('painelFiscalColunas');

            if (salvo) {
              try {
                preferencias = { ...padrao, ...JSON.parse(salvo) };
              } catch (e) {}
            }

            document.querySelectorAll('#painel-colunas input[type="checkbox"]').forEach(chk => {
              const mostrar = !!preferencias[chk.dataset.col];
              chk.checked = mostrar;
              aplicarColuna(chk.dataset.col, mostrar);

              chk.addEventListener('change', () => {
                aplicarColuna(chk.dataset.col, chk.checked);
                salvarPreferenciasColunas();
              });
            });
          }

          document.addEventListener('DOMContentLoaded', carregarPreferenciasColunas);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao listar lançamentos:\n${error.message}</pre>`);
  }
});

router.get('/exportar-excel', async (req, res) => {
  try {
    const {
      fornecedor = '',
      categoria_id = '',
      tipo_pagamento = '',
      cnpj_cpf = '',
      codigo_pagamento = '',
      numero_documento = '',
      data_inicio = '',
      data_fim = ''
    } = req.query;

    let where = [];
    let values = [];

    if (fornecedor) {
      values.push(`%${fornecedor}%`);
      where.push(`l.fornecedor ILIKE ${values.length}`);
    }
    if (categoria_id) {
      values.push(categoria_id);
      where.push(`l.categoria_id = ${values.length}`);
    }
    if (tipo_pagamento) {
      values.push(tipo_pagamento);
      where.push(`l.tipo_pagamento = ${values.length}`);
    }
    if (cnpj_cpf) {
      values.push(`%${cnpj_cpf}%`);
      where.push(`l.cnpj_cpf ILIKE ${values.length}`);
    }
    if (codigo_pagamento) {
      values.push(`%${codigo_pagamento}%`);
      where.push(`l.codigo_pagamento ILIKE ${values.length}`);
    }
    if (numero_documento) {
      values.push(`%${numero_documento}%`);
      where.push(`l.numero_documento ILIKE ${values.length}`);
    }
    if (data_inicio) {
      values.push(data_inicio);
      where.push(`l.data_despesa >= ${values.length}`);
    }
    if (data_fim) {
      values.push(data_fim);
      where.push(`l.data_despesa <= ${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await pool.query(
      `
      SELECT
  l.id,
  l.tipo_documento,
  l.numero_documento,
  l.data_despesa,
  l.fornecedor,
  l.cnpj_cpf,
  l.codigo_pagamento,
  l.valor,
  l.tipo_pagamento,
  l.anexo_pdf,
  l.anexo_xml,
  c.nome AS categoria,
  c.categoria_pai_id,
  p.nome AS categoria_principal,
  CASE
    WHEN c.categoria_pai_id IS NULL THEN ''
    ELSE c.nome
  END AS subcategoria
FROM lancamentos l
LEFT JOIN categorias c ON c.id = l.categoria_id
LEFT JOIN categorias p ON p.id = c.categoria_pai_id
      ${whereSql}
      ORDER BY l.id DESC
      `,
      values
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Lancamentos');

    worksheet.columns = [
  { header: 'ID', key: 'id', width: 10 },
  { header: 'Tipo do documento', key: 'tipo_documento', width: 22 },
  { header: 'Número do documento', key: 'numero_documento', width: 22 },
  { header: 'Data', key: 'data_despesa', width: 15 },
  { header: 'Fornecedor', key: 'fornecedor', width: 28 },
  { header: 'CNPJ/CPF', key: 'cnpj_cpf', width: 22 },
  { header: 'Código de pagamento', key: 'codigo_pagamento', width: 24 },
  { header: 'Valor', key: 'valor', width: 15 },
  { header: 'Tipo de pagamento', key: 'tipo_pagamento', width: 24 },
  { header: 'Categoria Principal', key: 'categoria_principal', width: 24 },
  { header: 'Subcategoria', key: 'subcategoria', width: 24 },
  { header: 'PDF', key: 'anexo_pdf', width: 28 },
  { header: 'XML', key: 'anexo_xml', width: 28 }
];

    result.rows.forEach(l => {
const nomePagamento = (l.tipo_pagamento || 'SemPagamento')
  .toString().trim().replace(/\s+/g, ' ');

const nomeFornecedor = (l.fornecedor || 'SemFornecedor')
  .toString().trim().replace(/\s+/g, ' ');

const nomeCategoria = (l.categoria || 'SemCategoria')
  .toString().trim().replace(/\s+/g, ' ');

const nomeNumero = (l.numero_documento || 'SemNumero')
  .toString().trim().replace(/\s+/g, ' ');

const nomeValor = formatMoneyBR(l.valor || 0)
  .replace(/\s+/g, '');

const nomeBaseDownload = `${nomePagamento}-${nomeFornecedor}-${nomeCategoria}-${nomeNumero}-${nomeValor}`
  .replace(/[\/\\:*?"<>|]/g, '-')
  .replace(/\s+/g, ' ')
  .trim();

  worksheet.addRow({
    id: l.id,
    tipo_documento: l.tipo_documento,
    numero_documento: l.numero_documento || '',
    data_despesa: l.data_despesa ? new Date(l.data_despesa).toISOString().split('T')[0] : '',
    fornecedor: l.fornecedor,
    cnpj_cpf: l.cnpj_cpf || '',
    codigo_pagamento: l.codigo_pagamento || '',
    valor: Number(l.valor),
    tipo_pagamento: l.tipo_pagamento,
    categoria_principal: l.categoria_pai_id ? (l.categoria_principal || '') : (l.categoria || ''),
    subcategoria: l.categoria_pai_id ? (l.subcategoria || '') : '',
    anexo_pdf: l.anexo_pdf ? `${nomeBaseDownload}.pdf` : '',
anexo_xml: l.anexo_xml ? `${nomeBaseDownload}.xml` : ''  });
});

    worksheet.getRow(1).font = { bold: true };
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.getCell(8).numFmt = 'R$ #,##0.00';
      }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="lancamentos.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.send(`<pre>Erro ao exportar Excel:\n${error.message}</pre>`);
  }
});

router.get('/categorias', protegerRota, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id,
        c.nome,
        c.categoria_pai_id,
        p.nome AS categoria_pai_nome
      FROM categorias c
      LEFT JOIN categorias p ON p.id = c.categoria_pai_id
      ORDER BY
        COALESCE(p.nome, c.nome),
        c.categoria_pai_id NULLS FIRST,
        c.nome
    `);

    let linhas = '';
    result.rows.forEach(c => {
      linhas += `
        <tr>
          <td>${c.id}</td>
          <td>${c.nome}</td>
          <td>${c.categoria_pai_id ? 'Subcategoria' : 'Principal'}</td>
          <td>${c.categoria_pai_nome || '—'}</td>
          <td>
            <a class="icon-btn" href="/categorias/editar/${c.id}" title="Editar">✏️</a>
            <a class="icon-btn" href="/categorias/excluir/${c.id}" onclick="return confirm('Excluir categoria?')" title="Excluir">🗑️</a>
          </td>
        </tr>
      `;
    });

    res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Categorias</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f6f8fb;
          margin: 0;
          color: #111827;
          font-size: 14px;
        }
        .container {
          max-width: 980px;
          margin: 40px auto;
          padding: 0 20px;
        }
        .card {
          background: #fff;
          border-radius: 14px;
          padding: 24px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.08);
        }
        h1 {
          margin-top: 0;
          margin-bottom: 18px;
          font-size: 26px;
        }
        .btn {
          background: #2563eb;
          color: white;
          padding: 10px 14px;
          border-radius: 8px;
          text-decoration: none;
          display: inline-block;
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 18px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          padding: 10px 12px;
          border-bottom: 1px solid #e5e7eb;
          text-align: left;
          font-size: 14px;
        }
        th {
          background: #eef2ff;
          font-weight: 700;
        }
        tr:hover td {
          background: #f9fafb;
        }
        .icon-btn {
          text-decoration: none;
          margin-right: 8px;
        }
      

/* ===== PADRÃO VISUAL DEUS É MAIS - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL DEUS É MAIS ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */

</style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <h1>📁 Categorias</h1>

<div style="display:flex; gap:10px; margin-bottom:18px;">
  <a class="btn" href="/categorias/nova">+ Nova categoria</a>
  <a class="btn" href="/dashboard" style="background:#e5e7eb; color:#111827;">Voltar</a>
</div>

          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Principal</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${linhas || '<tr><td colspan="5">Nenhuma categoria cadastrada.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </body>
    </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao listar categorias:\n${error.message}</pre>`);
  }
});

// NOVA CATEGORIA - FORM
router.get('/categorias/nova', async (req, res) => {
  try {
    const principais = await pool.query(`
      SELECT id, nome
      FROM categorias
      WHERE categoria_pai_id IS NULL
      ORDER BY nome
    `);

    const opcoesPrincipais = principais.rows.map(c =>
      `<option value="${c.id}">${c.nome}</option>`
    ).join('');

    res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Nova categoria</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f6f8fb;
          margin: 0;
          color: #111827;
        }
        .container {
          max-width: 760px;
          margin: 40px auto;
          padding: 0 20px;
        }
        .card {
          background: #fff;
          border-radius: 14px;
          padding: 24px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.08);
        }
        h1 {
          margin-top: 0;
          margin-bottom: 18px;
          font-size: 26px;
        }
        label {
          display: block;
          margin-bottom: 8px;
          font-weight: bold;
          font-size: 14px;
        }
        input, select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          box-sizing: border-box;
          margin-bottom: 16px;
        }
        .actions {
          display: flex;
          gap: 10px;
          margin-top: 10px;
        }
        button, .btn-secondary {
          padding: 10px 14px;
          border-radius: 8px;
          text-decoration: none;
          border: none;
          font-size: 14px;
          font-weight: bold;
          display: inline-block;
        }
        button {
          background: #2563eb;
          color: #fff;
          cursor: pointer;
        }
        .btn-secondary {
          background: #e5e7eb;
          color: #111827;
        }
      

/* ===== PADRÃO VISUAL DEUS É MAIS - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL DEUS É MAIS ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */

</style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <h1>📁 Nova categoria</h1>

          <form method="POST" action="/categorias/nova">
            <label for="nome">Nome da categoria</label>
            <input id="nome" name="nome" required />

            <label for="categoria_pai_id">Categoria principal</label>
            <select id="categoria_pai_id" name="categoria_pai_id">
              <option value="">Nenhuma (categoria principal)</option>
              ${opcoesPrincipais}
            </select>

            <div class="actions">
              <button type="submit">Salvar</button>
              <a class="btn-secondary" href="/categorias">Cancelar</a>
            </div>
          </form>
        </div>
      </div>
    </body>
    </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao carregar nova categoria:\n${error.message}</pre>`);
  }
});

// NOVA CATEGORIA - SALVAR
router.post('/categorias/nova', async (req, res) => {
  try {
    const { nome, categoria_pai_id } = req.body;

    if (!nome || !nome.trim()) {
      return res.send('<pre>Nome da categoria é obrigatório.</pre>');
    }

    await pool.query(
      'INSERT INTO categorias (nome, categoria_pai_id) VALUES ($1, $2)',
      [nome.trim(), categoria_pai_id || null]
    );

    res.redirect('/categorias');
  } catch (error) {
    res.send(`<pre>Erro ao salvar categoria:\n${error.message}</pre>`);
  }
});

// EDITAR CATEGORIA - FORM
router.get('/categorias/editar/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM categorias WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.send('<pre>Categoria não encontrada.</pre>');
    }

    const categoria = result.rows[0];

    const principais = await pool.query(`
      SELECT id, nome
      FROM categorias
      WHERE categoria_pai_id IS NULL
        AND id <> $1
      ORDER BY nome
    `, [id]);

    const opcoesPrincipais = principais.rows.map(c => `
      <option value="${c.id}" ${String(c.id) === String(categoria.categoria_pai_id) ? 'selected' : ''}>
        ${c.nome}
      </option>
    `).join('');

    res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Editar categoria</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f6f8fb;
          margin: 0;
          color: #111827;
        }
        .container {
          max-width: 760px;
          margin: 40px auto;
          padding: 0 20px;
        }
        .card {
          background: #fff;
          border-radius: 14px;
          padding: 24px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.08);
        }
        h1 {
          margin-top: 0;
          margin-bottom: 18px;
          font-size: 26px;
        }
        label {
          display: block;
          margin-bottom: 8px;
          font-weight: bold;
          font-size: 14px;
        }
        input, select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          box-sizing: border-box;
          margin-bottom: 16px;
        }
        .actions {
          display: flex;
          gap: 10px;
          margin-top: 10px;
        }
        button, .btn-secondary {
          padding: 10px 14px;
          border-radius: 8px;
          text-decoration: none;
          border: none;
          font-size: 14px;
          font-weight: bold;
          display: inline-block;
        }
        button {
          background: #2563eb;
          color: #fff;
          cursor: pointer;
        }
        .btn-secondary {
          background: #e5e7eb;
          color: #111827;
        }
      

/* ===== PADRÃO VISUAL DEUS É MAIS - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL DEUS É MAIS ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */

</style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <h1>✏️ Editar categoria</h1>

          <form method="POST" action="/categorias/editar/${categoria.id}">
            <label for="nome">Nome da categoria</label>
            <input id="nome" name="nome" value="${categoria.nome}" required />

            <label for="categoria_pai_id">Categoria principal</label>
            <select id="categoria_pai_id" name="categoria_pai_id">
              <option value="">Nenhuma (categoria principal)</option>
              ${opcoesPrincipais}
            </select>

            <div class="actions">
              <button type="submit">Atualizar</button>
              <a class="btn-secondary" href="/categorias">Cancelar</a>
            </div>
          </form>
        </div>
      </div>
    </body>
    </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao carregar categoria:\n${error.message}</pre>`);
  }
});

// EDITAR CATEGORIA - SALVAR
router.post('/categorias/editar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, categoria_pai_id } = req.body;

    if (!nome || !nome.trim()) {
      return res.send('<pre>Nome da categoria é obrigatório.</pre>');
    }

    await pool.query(
      'UPDATE categorias SET nome = $1, categoria_pai_id = $2 WHERE id = $3',
      [nome.trim(), categoria_pai_id || null, id]
    );

    res.redirect('/categorias');
  } catch (error) {
    res.send(`<pre>Erro ao atualizar categoria:\n${error.message}</pre>`);
  }
});

// EXCLUIR CATEGORIA
router.get('/categorias/excluir/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM categorias WHERE id = $1', [id]);

    res.redirect('/categorias');
  } catch (error) {
    res.send(`<pre>Erro ao excluir categoria:\n${error.message}</pre>`);
  }
});

router.get('/', (req, res) => {
  res.redirect('/lancamentos');
});
// ===== ROTINA DE DESPESAS =====

// LISTAGEM
router.get('/rotina-despesas', protegerRota, permitirPerfis('ADMIN', 'USUARIO'), async (req, res) => {
  try {
    const statusFiltro = (req.query.status || '').trim();
    const vencimentoFiltro = (req.query.data_vencimento || '').trim();

    const whereParts = [];
    const values = [];

    if (statusFiltro) {
      values.push(statusFiltro);
      whereParts.push(`r.status = $${values.length}`);
    }

    if (vencimentoFiltro) {
      values.push(vencimentoFiltro);
      whereParts.push(`r.data_vencimento = $${values.length}`);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT
        r.*,
        cp.nome AS categoria_principal_nome,
        cs.nome AS subcategoria_nome
      FROM rotina_despesas r
      LEFT JOIN categorias cp ON cp.id = r.categoria_principal_id
      LEFT JOIN categorias cs ON cs.id = r.subcategoria_id
      ${whereSql}
      ORDER BY r.ordem, r.fornecedor
    `, values);

    let linhas = '';

    result.rows.forEach(r => {
      const ondeEncontrarHtml =
        r.onde_encontrar_comprovante && r.onde_encontrar_comprovante.startsWith('http')
          ? `<a href="${r.onde_encontrar_comprovante}" target="_blank" rel="noopener noreferrer">Abrir link</a>`
          : (r.onde_encontrar_comprovante || '');

      linhas += `
        <tr>
          <td class="col-rot-fornecedor">${r.fornecedor || ''}</td>
          <td class="col-rot-cnpj">${r.cnpj_cpf || ''}</td>
          <td class="col-rot-fato">${r.fato_gerador || ''}</td>
          <td class="col-rot-onde">${ondeEncontrarHtml}</td>
          <td class="col-rot-pagamento">${r.tipo_pagamento_padrao || ''}</td>
          <td class="col-rot-cat-principal">${r.categoria_principal_nome || ''}</td>
          <td class="col-rot-subcategoria">${r.subcategoria_nome || ''}</td>
          <td class="col-vencimento col-rot-vencimento">${formatDateBR(r.data_vencimento) || '-'}</td>

          <td class="col-status col-rot-status">
            <form method="POST" action="/rotina-despesas/status/${r.id}" class="status-form">
              <input type="hidden" name="status_filtro" value="${statusFiltro}">
              <input type="hidden" name="data_vencimento_filtro" value="${vencimentoFiltro}">

              <select
                name="status"
                class="status-select status-${r.status}"
                onchange="this.form.submit()"
              >
                <option value="PENDENTE" ${r.status === 'PENDENTE' ? 'selected' : ''}>PENDENTE</option>
                <option value="FEITO" ${r.status === 'FEITO' ? 'selected' : ''}>FEITO</option>
                <option value="N/A" ${r.status === 'N/A' ? 'selected' : ''}>Não tem</option>
              </select>
            </form>
          </td>

          <td class="col-ativo col-rot-ativo">${r.ativo ? 'Sim' : 'Não'}</td>

          <td class="col-acoes col-rot-acoes">
            <div class="acoes-wrap">
              <a class="icon-btn" href="/novo?rotina_id=${r.id}" title="Novo lançamento">➕</a>
              <a class="icon-btn" href="/rotina-despesas/editar/${r.id}" title="Editar">✏️</a>
              <a class="icon-btn" href="/rotina-despesas/excluir/${r.id}" title="Excluir" onclick="return confirm('Deseja excluir este item da rotina?')">🗑️</a>
            </div>
          </td>
        </tr>
      `;
    });

    res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>Levantamento de Despesas Mensais</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f6f8fb;
          margin: 0;
          color: #111827;
        }

        .container {
          max-width: 1380px;
          margin: 40px auto;
          padding: 0 20px;
        }

        .card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }

        h1 {
          margin-top: 0;
          margin-bottom: 20px;
          font-size: 28px;
        }

        .top-bar {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .filters {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: end;
        }

        .painel-colunas {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
          margin: 8px 0 16px;
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(248,250,252,0.9);
          border: 1px solid #e0e6ef;
        }

        .painel-colunas label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin: 0;
          font-size: 12px;
          font-weight: 700;
          color: #334155;
        }

        .filter-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 700;
          font-size: 13px;
        }

        .filter-group select,
        .filter-group input[type="date"] {
          height: 44px;
          padding: 0 18px;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          min-width: 180px;
          background: #fff;
          color: #334155;
        }

        .btn {
          padding: 10px 14px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: bold;
          font-size: 14px;
          display: inline-block;
          border: none;
          cursor: pointer;
        }

        .btn-primary {
          background: #2563eb;
          color: white;
        }

        .btn-secondary {
          background: #e5e7eb;
          color: #111827;
        }

        .btn-warning {
          background: #dc2626;
          color: white;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        th, td {
          padding: 10px 10px;
          border-bottom: 1px solid #eee;
          text-align: left;
          vertical-align: middle;
          word-wrap: break-word;
          font-size: 13px;
          line-height: 1.25;
        }

        th {
          background: #f1f5f9;
          font-weight: 700;
        }

        tr:hover {
          background: #f9fafb;
        }

        a {
          color: #2563eb;
        }

        .col-status,
        .col-ativo,
        .col-acoes {
          text-align: center;
          white-space: nowrap;
        }

        .col-vencimento {
          width: 105px;
          white-space: nowrap;
        }

        .col-status {
          width: 150px;
        }

        .col-ativo {
          width: 80px;
        }

        .col-acoes {
          width: 110px;
        }

        .status-form {
          margin: 0;
          display: flex;
          justify-content: center;
        }

        .status-select {
          width: 115px;
          padding: 6px 28px 6px 10px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: bold;
          text-align: center;
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          background-image: none !important;
          box-shadow: none;
        }

        .status-FEITO {
          background-color: #dcfce7 !important;
          color: #166534 !important;
          border: 1px solid #86efac !important;
        }

        .status-PENDENTE {
          background-color: #fef3c7 !important;
          color: #92400e !important;
          border: 1px solid #fcd34d !important;
        }

        .status-N\\/A {
          background-color: #e5e7eb !important;
          color: #374151 !important;
          border: 1px solid #cbd5e1 !important;
        }

        .acoes-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .icon-btn {
          width: 18px;
          height: 18px;
          padding: 0;
          margin: 0 3px;
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
          outline: none !important;
          text-decoration: none;
          font-size: 14px;
          color: #64748b;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .icon-btn:hover {
          color: #1d4ed8;
          transform: scale(1.08);
        }

        .icon-btn[title="Excluir"] {
          color: #4b5563;
        }

        .icon-btn[title="Excluir"]:hover {
          color: #dc2626;
        }

        .icon-btn[title="Editar"] {
          color: #2563eb;
        }
      

/* ===== PADRÃO VISUAL DEUS É MAIS - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL DEUS É MAIS ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */

</style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <h1>📋 Levantamento de Despesas Mensais</h1>

          <div class="top-bar">
            <div class="actions">
              <a class="btn btn-primary" href="/rotina-despesas/novo">+ Novo item</a>
              <a class="btn btn-dark" href="/lancamentos">📊 Lista de lançamentos</a>
              <a class="btn btn-dark" href="/dashboard">Voltar ao Painel</a>

              <form method="POST" action="/rotina-despesas/reset-status" style="display:inline;">
                <button
                  type="submit"
                  class="btn btn-dark"
                  onclick="return confirm('Tem certeza que deseja mudar todos os STATUS para pendente?');"
                >
                  🔄 Mudar todos para PENDENTE
                </button>
              </form>
              <button type="button" class="btn btn-dark" onclick="togglePainelColunasRotina()">Colunas</button>
            </div>

            <div id="painel-colunas-rotina" class="painel-colunas" style="display:none;">
              <label><input type="checkbox" data-col="col-rot-cnpj"> CNPJ/CPF</label>
              <label><input type="checkbox" data-col="col-rot-fato"> Fato Gerador</label>
              <label><input type="checkbox" data-col="col-rot-onde"> Onde encontrar</label>
              <label><input type="checkbox" data-col="col-rot-pagamento"> Pagamento</label>
              <label><input type="checkbox" data-col="col-rot-cat-principal"> Categoria Principal</label>
              <label><input type="checkbox" data-col="col-rot-subcategoria"> Subcategoria</label>
              <label><input type="checkbox" data-col="col-rot-vencimento"> Vencimento</label>
              <label><input type="checkbox" data-col="col-rot-status"> Status</label>
              <label><input type="checkbox" data-col="col-rot-ativo"> Ativo</label>
            </div>

            <form method="GET" action="/rotina-despesas" class="filters">
              <div class="filter-group">
                <label for="status">Filtrar por status</label>
                <select id="status" name="status">
                  <option value="" ${statusFiltro === '' ? 'selected' : ''}>Todos</option>
                  <option value="PENDENTE" ${statusFiltro === 'PENDENTE' ? 'selected' : ''}>PENDENTE</option>
                  <option value="FEITO" ${statusFiltro === 'FEITO' ? 'selected' : ''}>FEITO</option>
                  <option value="N/A" ${statusFiltro === 'N/A' ? 'selected' : ''}>Não tem</option>
                </select>
              </div>

              <div class="filter-group">
                <label for="data_vencimento">Filtrar por vencimento</label>
                <input
                  id="data_vencimento"
                  name="data_vencimento"
                  type="date"
                  value="${vencimentoFiltro}"
                />
              </div>

              <button type="submit" class="btn btn-primary">Aplicar filtro</button>
              <a href="/rotina-despesas" class="btn btn-dark">Limpar</a>
            </form>
          </div>

          <table>
            <thead>
              <tr>
                <th class="col-rot-fornecedor">Fornecedor</th>
                <th class="col-rot-cnpj">CNPJ/CPF</th>
                <th class="col-rot-fato">Fato Gerador</th>
                <th class="col-rot-onde">Onde encontrar</th>
                <th class="col-rot-pagamento">Pagamento</th>
                <th class="col-rot-cat-principal">Categoria Principal</th>
                <th class="col-rot-subcategoria">Subcategoria</th>
                <th class="col-vencimento col-rot-vencimento">Vencimento</th>
                <th class="col-status col-rot-status">Status</th>
                <th class="col-ativo col-rot-ativo">Ativo</th>
                <th class="col-acoes col-rot-acoes">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${linhas || '<tr><td colspan="11">Nenhum item cadastrado</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <script>
        function togglePainelColunasRotina() {
          const painel = document.getElementById('painel-colunas-rotina');
          painel.style.display = painel.style.display === 'none' ? 'flex' : 'none';
        }

        function aplicarColunaRotina(nomeColuna, mostrar) {
          document.querySelectorAll('.' + nomeColuna).forEach(el => {
            el.style.display = mostrar ? '' : 'none';
          });
        }

        function salvarPreferenciasColunasRotina() {
          const preferencias = {};
          document.querySelectorAll('#painel-colunas-rotina input[type="checkbox"]').forEach(chk => {
            preferencias[chk.dataset.col] = chk.checked;
          });
          localStorage.setItem('painelFiscalColunasRotina', JSON.stringify(preferencias));
        }

        function carregarPreferenciasColunasRotina() {
          const padrao = {
            'col-rot-cnpj': true,
            'col-rot-fato': true,
            'col-rot-onde': true,
            'col-rot-pagamento': true,
            'col-rot-cat-principal': true,
            'col-rot-subcategoria': true,
            'col-rot-vencimento': true,
            'col-rot-status': true,
            'col-rot-ativo': true
          };

          let preferencias = padrao;
          const salvo = localStorage.getItem('painelFiscalColunasRotina');
          if (salvo) {
            try { preferencias = { ...padrao, ...JSON.parse(salvo) }; } catch (e) {}
          }

          document.querySelectorAll('#painel-colunas-rotina input[type="checkbox"]').forEach(chk => {
            const mostrar = !!preferencias[chk.dataset.col];
            chk.checked = mostrar;
            aplicarColunaRotina(chk.dataset.col, mostrar);

            chk.addEventListener('change', () => {
              aplicarColunaRotina(chk.dataset.col, chk.checked);
              salvarPreferenciasColunasRotina();
            });
          });
        }

        document.addEventListener('DOMContentLoaded', carregarPreferenciasColunasRotina);

        document.querySelectorAll('.status-select').forEach(select => {
          select.addEventListener('change', function () {
            this.classList.remove('status-FEITO', 'status-PENDENTE', 'status-N/A');
            this.classList.add('status-' + this.value);
          });
        });
      </script>
    </body>
    </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro:\n${error.message}</pre>`);
  }
});
router.post('/rotina-despesas/status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, status_filtro, data_vencimento_filtro } = req.body;

    await pool.query(`
      UPDATE rotina_despesas
      SET status = $1
      WHERE id = $2
    `, [status || 'PENDENTE', id]);

    const redirectParams = new URLSearchParams();
    if (status_filtro) redirectParams.set('status', status_filtro);
    if (data_vencimento_filtro) redirectParams.set('data_vencimento', data_vencimento_filtro);
    const redirectQuery = redirectParams.toString();
    const destino = redirectQuery ? `/rotina-despesas?${redirectQuery}` : '/rotina-despesas';

    res.redirect(destino);
  } catch (error) {
    res.send(`<pre>Erro ao atualizar status:\n${error.message}</pre>`);
  }
});

router.post('/rotina-despesas/reset-status', async (req, res) => {
  try {
    await pool.query(`
      UPDATE rotina_despesas
      SET status = 'PENDENTE'
      WHERE ativo = true
    `);

    res.redirect('/rotina-despesas');
  } catch (error) {
    res.send(`<pre>Erro ao resetar status:\n${error.message}</pre>`);
  }
});

// FORM NOVO
router.get('/rotina-despesas/novo', async (req, res) => {
  try {
    const principaisResult = await pool.query(`
      SELECT id, nome
      FROM categorias
      WHERE categoria_pai_id IS NULL
      ORDER BY nome
    `);

    const subcategoriasResult = await pool.query(`
      SELECT c.id, c.nome, p.nome AS principal_nome
      FROM categorias c
      LEFT JOIN categorias p ON p.id = c.categoria_pai_id
      WHERE c.categoria_pai_id IS NOT NULL
      ORDER BY p.nome, c.nome
    `);

    const optionsPrincipais = principaisResult.rows.map(c =>
      `<option value="${c.id}">${c.nome}</option>`
    ).join('');

    const optionsSubcategorias = subcategoriasResult.rows.map(c =>
      `<option value="${c.id}">${c.principal_nome} > ${c.nome}</option>`
    ).join('');

    res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>Novo Item da Rotina</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f6f8fb;
          margin: 0;
          color: #111827;
        }
        .container {
          max-width: 900px;
          margin: 40px auto;
          padding: 0 20px;
        }
        .card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        h1 {
          margin-top: 0;
          margin-bottom: 20px;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .full {
          grid-column: 1 / -1;
        }
        label {
          display: block;
          margin-bottom: 6px;
          font-weight: 700;
        }
        input, select, textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          box-sizing: border-box;
          font-size: 14px;
        }
        textarea {
          min-height: 90px;
          resize: vertical;
        }
        .actions {
          margin-top: 18px;
          display: flex;
          gap: 10px;
        }
        .btn {
          padding: 10px 14px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: bold;
          font-size: 14px;
          display: inline-block;
          border: none;
          cursor: pointer;
        }
        .btn-primary {
          background: #2563eb;
          color: white;
        }
        .btn-secondary {
          background: #e5e7eb;
          color: #111827;
        }
      

/* ===== PADRÃO VISUAL DEUS É MAIS - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL DEUS É MAIS ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */

</style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <h1>➕ Novo item da rotina</h1>

          <form method="POST" action="/rotina-despesas/novo">
            <div class="grid">
              <div>
                <label for="fornecedor">Fornecedor</label>
                <input id="fornecedor" name="fornecedor" required />
              </div>

              <div>
                <label for="cnpj_cpf">CNPJ/CPF</label>
                <input id="cnpj_cpf" name="cnpj_cpf" placeholder="Informe o CNPJ ou CPF" />
              </div>

              <div>
                <label for="tipo_pagamento_padrao">Tipo de pagamento padrão</label>
                <select id="tipo_pagamento_padrao" name="tipo_pagamento_padrao">
                  <option value="">Selecione</option>
                  <option value="PIX">PIX</option>
                  <option value="Boleto">Boleto</option>
                  <option value="Guia">Guia</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Descontado na Operação">Descontado na Operação</option>
                  <option value="Cartão">Cartão</option>
                  <option value="Cartão Caixa VISA">Cartão Caixa VISA</option>
                  <option value="Cartão Caixa Elo">Cartão Caixa Elo</option>
                  <option value="Cartão Outro">Cartão Outro</option>
                </select>
              </div>

              <div>
                <label for="data_vencimento">Data de vencimento</label>
                <input id="data_vencimento" name="data_vencimento" type="date" />
              </div>

              <div class="full">
                <label for="onde_encontrar_comprovante">Onde encontrar comprovante</label>
                <input id="onde_encontrar_comprovante" name="onde_encontrar_comprovante" />
              </div>

              <div class="full">
                <label for="fato_gerador">Fato gerador da despesa</label>
                <input id="fato_gerador" name="fato_gerador" />
              </div>

              <div>
                <label for="categoria_principal_id">Categoria principal padrão</label>
                <select id="categoria_principal_id" name="categoria_principal_id">
                  <option value="">Selecione</option>
                  ${optionsPrincipais}
                </select>
              </div>

              <div>
                <label for="subcategoria_id">Subcategoria padrão</label>
                <select id="subcategoria_id" name="subcategoria_id">
                  <option value="">Selecione</option>
                  ${optionsSubcategorias}
                </select>
              </div>

              <div>
                <label for="status">Status</label>
                <select id="status" name="status">
                  <option value="PENDENTE" selected>PENDENTE</option>
                  <option value="FEITO">FEITO</option>
                  <option value="N/A">Não tem</option>
                </select>
              </div>

              <div>
                <label for="ordem">Ordem</label>
                <input id="ordem" name="ordem" type="number" value="0" />
              </div>

              <div>
                <label for="ativo">Ativo</label>
                <select id="ativo" name="ativo">
                  <option value="true" selected>Sim</option>
                  <option value="false">Não</option>
                </select>
              </div>

              <div class="full">
                <label for="observacoes">Observações</label>
                <textarea id="observacoes" name="observacoes"></textarea>
              </div>
            </div>

            <div class="actions">
              <button class="btn btn-primary" type="submit">Salvar</button>
              <a class="btn btn-dark" href="/rotina-despesas">Cancelar</a>
            </div>
          </form>
        </div>
      </div>
    </body>
    </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao abrir novo item:\n${error.message}</pre>`);
  }
});

// SALVAR NOVO
router.post('/rotina-despesas/novo', async (req, res) => {
  try {
    const {
      fornecedor,
      cnpj_cpf,
      onde_encontrar_comprovante,
      fato_gerador,
      tipo_pagamento_padrao,
      data_vencimento,
      categoria_principal_id,
      subcategoria_id,
      status,
      ativo,
      ordem,
      observacoes
    } = req.body;

    await pool.query(`
      INSERT INTO rotina_despesas (
        fornecedor,
        cnpj_cpf,
        onde_encontrar_comprovante,
        fato_gerador,
        tipo_pagamento_padrao,
        data_vencimento,
        categoria_principal_id,
        subcategoria_id,
        status,
        ativo,
        ordem,
        observacoes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    `, [
      fornecedor,
      cnpj_cpf || null,
      onde_encontrar_comprovante || null,
      fato_gerador || null,
      tipo_pagamento_padrao || null,
      data_vencimento || null,
      categoria_principal_id || null,
      subcategoria_id || null,
      status || 'PENDENTE',
      ativo === 'true',
      Number(ordem || 0),
      observacoes || null
    ]);

    res.redirect('/rotina-despesas');
  } catch (error) {
    res.send(`<pre>Erro ao salvar item:\n${error.message}</pre>`);
  }
});

// FORM EDITAR
router.get('/rotina-despesas/editar/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const itemResult = await pool.query(
      `SELECT * FROM rotina_despesas WHERE id = $1`,
      [id]
    );

    if (!itemResult.rows.length) {
      return res.send('<pre>Item não encontrado.</pre>');
    }

    const item = itemResult.rows[0];

    const principaisResult = await pool.query(`
      SELECT id, nome
      FROM categorias
      WHERE categoria_pai_id IS NULL
      ORDER BY nome
    `);

    const subcategoriasResult = await pool.query(`
      SELECT c.id, c.nome, p.nome AS principal_nome
      FROM categorias c
      LEFT JOIN categorias p ON p.id = c.categoria_pai_id
      WHERE c.categoria_pai_id IS NOT NULL
      ORDER BY p.nome, c.nome
    `);

    const optionsPrincipais = principaisResult.rows.map(c =>
      `<option value="${c.id}" ${String(item.categoria_principal_id) === String(c.id) ? 'selected' : ''}>${c.nome}</option>`
    ).join('');

    const optionsSubcategorias = subcategoriasResult.rows.map(c =>
      `<option value="${c.id}" ${String(item.subcategoria_id) === String(c.id) ? 'selected' : ''}>${c.principal_nome} > ${c.nome}</option>`
    ).join('');

    res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>Editar Item da Rotina</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f6f8fb;
          margin: 0;
          color: #111827;
        }
        .container {
          max-width: 900px;
          margin: 40px auto;
          padding: 0 20px;
        }
        .card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        h1 {
          margin-top: 0;
          margin-bottom: 20px;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .full {
          grid-column: 1 / -1;
        }
        label {
          display: block;
          margin-bottom: 6px;
          font-weight: 700;
        }
        input, select, textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          box-sizing: border-box;
          font-size: 14px;
        }
        textarea {
          min-height: 90px;
          resize: vertical;
        }
        .actions {
          margin-top: 18px;
          display: flex;
          gap: 10px;
        }
        .btn {
          padding: 10px 14px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: bold;
          font-size: 14px;
          display: inline-block;
          border: none;
          cursor: pointer;
        }
        .btn-primary {
          background: #2563eb;
          color: white;
        }
        .btn-secondary {
          background: #e5e7eb;
          color: #111827;
        }
      

/* ===== PADRÃO VISUAL DEUS É MAIS - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL DEUS É MAIS ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */

</style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <h1>✏️ Editar item da rotina</h1>

          <form method="POST" action="/rotina-despesas/editar/${item.id}">
            <div class="grid">
              <div>
                <label for="fornecedor">Fornecedor</label>
                <input id="fornecedor" name="fornecedor" value="${item.fornecedor || ''}" required />
              </div>

              <div>
                <label for="cnpj_cpf">CNPJ/CPF</label>
                <input id="cnpj_cpf" name="cnpj_cpf" value="${item.cnpj_cpf || ''}" placeholder="Informe o CNPJ ou CPF" />
              </div>

              <div>
                <label for="tipo_pagamento_padrao">Tipo de pagamento padrão</label>
                <select id="tipo_pagamento_padrao" name="tipo_pagamento_padrao">
                  <option value="">Selecione</option>
                  <option value="PIX" ${item.tipo_pagamento_padrao === 'PIX' ? 'selected' : ''}>PIX</option>
                  <option value="Boleto" ${item.tipo_pagamento_padrao === 'Boleto' ? 'selected' : ''}>Boleto</option>
                  <option value="Guia" ${item.tipo_pagamento_padrao === 'Guia' ? 'selected' : ''}>Guia</option>
                  <option value="Dinheiro" ${item.tipo_pagamento_padrao === 'Dinheiro' ? 'selected' : ''}>Dinheiro</option>
                  <option value="Descontado na Operação" ${item.tipo_pagamento_padrao === 'Descontado na Operação' ? 'selected' : ''}>Descontado na Operação</option>
                  <option value="Cartão" ${item.tipo_pagamento_padrao === 'Cartão' ? 'selected' : ''}>Cartão</option>
                  <option value="Cartão Caixa VISA" ${item.tipo_pagamento_padrao === 'Cartão Caixa VISA' ? 'selected' : ''}>Cartão Caixa VISA</option>
                  <option value="Cartão Caixa Elo" ${item.tipo_pagamento_padrao === 'Cartão Caixa Elo' ? 'selected' : ''}>Cartão Caixa Elo</option>
                  <option value="Cartão Outro" ${item.tipo_pagamento_padrao === 'Cartão Outro' ? 'selected' : ''}>Cartão Outro</option>
                </select>
              </div>

              <div>
                <label for="data_vencimento">Data de vencimento</label>
                <input id="data_vencimento" name="data_vencimento" type="date" value="${formatDateInput(item.data_vencimento)}" />
              </div>

              <div class="full">
                <label for="onde_encontrar_comprovante">Onde encontrar comprovante</label>
                <input id="onde_encontrar_comprovante" name="onde_encontrar_comprovante" value="${item.onde_encontrar_comprovante || ''}" />
              </div>

              <div class="full">
                <label for="fato_gerador">Fato gerador da despesa</label>
                <input id="fato_gerador" name="fato_gerador" value="${item.fato_gerador || ''}" />
              </div>

              <div>
                <label for="categoria_principal_id">Categoria principal padrão</label>
                <select id="categoria_principal_id" name="categoria_principal_id">
                  <option value="">Selecione</option>
                  ${optionsPrincipais}
                </select>
              </div>

              <div>
                <label for="subcategoria_id">Subcategoria padrão</label>
                <select id="subcategoria_id" name="subcategoria_id">
                  <option value="">Selecione</option>
                  ${optionsSubcategorias}
                </select>
              </div>

              <div>
                <label for="status">Status</label>
                <select id="status" name="status">
                  <option value="PENDENTE" ${item.status === 'PENDENTE' ? 'selected' : ''}>PENDENTE</option>
                  <option value="FEITO" ${item.status === 'FEITO' ? 'selected' : ''}>FEITO</option>
                  <option value="N/A" ${item.status === 'N/A' ? 'selected' : ''}>Não tem</option>
                </select>
              </div>

              <div>
                <label for="ordem">Ordem</label>
                <input id="ordem" name="ordem" type="number" value="${item.ordem || 0}" />
              </div>

              <div>
                <label for="ativo">Ativo</label>
                <select id="ativo" name="ativo">
                  <option value="true" ${item.ativo ? 'selected' : ''}>Sim</option>
                  <option value="false" ${!item.ativo ? 'selected' : ''}>Não</option>
                </select>
              </div>

              <div class="full">
                <label for="observacoes">Observações</label>
                <textarea id="observacoes" name="observacoes">${item.observacoes || ''}</textarea>
              </div>
            </div>

            <div class="actions">
              <button class="btn btn-primary" type="submit">Atualizar</button>
              <a class="btn btn-dark" href="/rotina-despesas">Cancelar</a>
            </div>
          </form>
        </div>
      </div>
    </body>
    </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao abrir edição:\n${error.message}</pre>`);
  }
});

// SALVAR EDIÇÃO
router.post('/rotina-despesas/editar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fornecedor,
      cnpj_cpf,
      onde_encontrar_comprovante,
      fato_gerador,
      tipo_pagamento_padrao,
      data_vencimento,
      categoria_principal_id,
      subcategoria_id,
      status,
      ativo,
      ordem,
      observacoes
    } = req.body;

    await pool.query(`
      UPDATE rotina_despesas
      SET
        fornecedor = $1,
        onde_encontrar_comprovante = $2,
        fato_gerador = $3,
        tipo_pagamento_padrao = $4,
        data_vencimento = $5,
        categoria_principal_id = $6,
        subcategoria_id = $7,
        status = $8,
        ativo = $9,
        ordem = $10,
        observacoes = $11
      WHERE id = $12
    `, [
      fornecedor,
      cnpj_cpf || null,
      onde_encontrar_comprovante || null,
      fato_gerador || null,
      tipo_pagamento_padrao || null,
      data_vencimento || null,
      categoria_principal_id || null,
      subcategoria_id || null,
      status || 'PENDENTE',
      ativo === 'true',
      Number(ordem || 0),
      observacoes || null,
      id
    ]);

    res.redirect('/rotina-despesas');
  } catch (error) {
    res.send(`<pre>Erro ao atualizar item:\n${error.message}</pre>`);
  }
});

// EXCLUIR
router.get('/rotina-despesas/excluir/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`DELETE FROM rotina_despesas WHERE id = $1`, [id]);

    res.redirect('/rotina-despesas');
  } catch (error) {
    res.send(`<pre>Erro ao excluir item:\n${error.message}</pre>`);
  }
});

function getMesAtualRef() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
}

async function gerarZipEEnviar(res, arquivos, nomeZip) {
  const arquivosValidos = (arquivos || []).filter(item => item && item.filePath && fs.existsSync(item.filePath));

  if (!arquivosValidos.length) {
    return res.send('<pre>Nenhum arquivo encontrado para este mês.</pre>');
  }

  const nomeSeguro = sanitizeFilePart(nomeZip || 'arquivos-contador');
  const zipTemp = path.join(uploadsDir, `${Date.now()}-${nomeSeguro}.zip`);

  try {
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipTemp);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      output.on('error', reject);
      archive.on('error', reject);

      archive.pipe(output);

      arquivosValidos.forEach(item => {
        archive.file(item.filePath, {
          name: item.downloadName || path.basename(item.filePath)
        });
      });

      archive.finalize();
    });

    return res.download(zipTemp, `${nomeSeguro}.zip`, (err) => {
      try {
        if (fs.existsSync(zipTemp)) {
          fs.unlinkSync(zipTemp);
        }
      } catch (e) {}

      if (err && !res.headersSent) {
        res.status(500).send(`<pre>Erro ao baixar ZIP:\n${err.message}</pre>`);
      }
    });
  } catch (error) {
    try {
      if (fs.existsSync(zipTemp)) {
        fs.unlinkSync(zipTemp);
      }
    } catch (e) {}

    return res.send(`<pre>Erro ao gerar ZIP:\n${error.message}</pre>`);
  }
}

// =============================
// ESPAÇO DO CONTADOR
// =============================

router.get('/espaco-contador', protegerRota, permitirPerfis('ADMIN', 'USUARIO', 'CONTADOR'), async (req, res) => {
  try {
    const mes = req.query.mes || getMesAtualRef();

    await pool.query(`
      INSERT INTO contador_status_mensal (mes_ref)
      VALUES ($1)
      ON CONFLICT (mes_ref) DO NOTHING
    `, [mes]);

    const [xmlCountResult, pdfCountResult, extrasResult, statusResult] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM lancamentos
        WHERE TO_CHAR(data_despesa, 'YYYY-MM') = $1
          AND anexo_xml IS NOT NULL
          AND TRIM(anexo_xml) <> ''
      `, [mes]),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM lancamentos
        WHERE TO_CHAR(data_despesa, 'YYYY-MM') = $1
          AND anexo_pdf IS NOT NULL
          AND TRIM(anexo_pdf) <> ''
      `, [mes]),

      pool.query(`
        SELECT *
        FROM contador_arquivos_extras
        WHERE mes_ref = $1
        ORDER BY created_at DESC, id DESC
      `, [mes]),

      pool.query(`
        SELECT *
        FROM contador_status_mensal
        WHERE mes_ref = $1
        LIMIT 1
      `, [mes])
    ]);

    const totalXml = xmlCountResult.rows[0]?.total || 0;
    const totalPdf = pdfCountResult.rows[0]?.total || 0;
    const arquivosExtras = extrasResult.rows;
    const statusMes = statusResult.rows[0] || {
      status_xml: 'Aguardar',
      status_pdf: 'Aguardar',
      status_extras: 'Aguardar'
    };

    const hoje = new Date();
    const opcoesMes = [];

    for (let i = 0; i < 12; i++) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const ano = data.getFullYear();
      const mesNum = String(data.getMonth() + 1).padStart(2, '0');
      const valor = `${ano}-${mesNum}`;
      const label = data.toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric'
      });

      opcoesMes.push({
        valor,
        label: label.charAt(0).toUpperCase() + label.slice(1)
      });
    }

    const optionsMes = opcoesMes.map(item => `
      <option value="${item.valor}" ${item.valor === mes ? 'selected' : ''}>
        ${item.label}
      </option>
    `).join('');

    const extrasHtml = arquivosExtras.length
      ? arquivosExtras.map(item => `
          <div class="extra-item">
            <div class="extra-left">
              <div class="extra-title">${item.titulo}</div>
              <div class="extra-sub">
                Arquivo: ${item.nome_original || item.nome_arquivo}
              </div>
            </div>
            <a class="btn btn-download" href="/espaco-contador/download-extra/${item.id}">
              ⬇ Baixar
            </a>
          </div>
        `).join('')
      : `<div class="empty-state">Nenhum arquivo extra enviado para este mês.</div>`;

    const renderStatusOptions = (atual) => `
      <option value="Aguardar" ${atual === 'Aguardar' ? 'selected' : ''}>Aguardar</option>
      <option value="Em andamento" ${atual === 'Em andamento' ? 'selected' : ''}>Em andamento</option>
      <option value="Liberado para baixar" ${atual === 'Liberado para baixar' ? 'selected' : ''}>Liberado para baixar</option>
    `;

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Espaço do Contador</title>
        <style>
          * { box-sizing: border-box; }

          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: radial-gradient(circle at top left, #eef4ff 0%, #f7f9fc 35%, #eef2f7 100%);
            color: #111827;
          }

          .container {
            max-width: 1450px;
            margin: 28px auto;
            padding: 0 20px 30px;
          }

          .hero {
            background: linear-gradient(135deg, #ffffff 0%, #f8fbff 100%);
            border: 1px solid #e5e7eb;
            border-radius: 24px;
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
            padding: 28px;
            margin-bottom: 24px;
          }

          .hero-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 20px;
            flex-wrap: wrap;
            margin-bottom: 20px;
          }

          .hero-top h1 {
            margin: 0 0 8px 0;
            font-size: 30px;
            color: #0f172a;
          }

          .hero-top p {
            margin: 0;
            color: #64748b;
            font-size: 15px;
          }

          .filter-box {
            display: flex;
            align-items: end;
            gap: 8px;
            flex-wrap: wrap;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 18px;
            padding: 16px;
            margin-bottom: 22px;
          }

          .filter-group {
            min-width: 260px;
          }

          .filter-group label {
            display: block;
            margin-bottom: 6px;
            font-size: 13px;
            font-weight: 700;
            color: #334155;
          }

          .filter-group select,
          .filter-group input {
            width: 100%;
            padding: 12px 14px;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            font-size: 14px;
            background: white;
            color: #0f172a;
          }

          .cards-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px;
            margin-bottom: 24px;
          }

          .card {
            background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
            border: 1px solid #e5e7eb;
            border-radius: 18px;
            padding: 22px;
            box-shadow: 0 14px 28px rgba(15, 23, 42, 0.05);
          }

          .card h2 {
            margin: 0 0 8px 0;
            font-size: 24px;
            color: #1e293b;
          }

          .card-sub {
            color: #64748b;
            font-size: 14px;
            margin-bottom: 18px;
          }

          .metric {
            font-size: 38px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 18px;
          }

          .actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            text-decoration: none;
            padding: 13px 18px;
            border-radius: 14px;
            font-weight: 700;
            font-size: 14px;
            border: none;
            cursor: pointer;
            box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
          }

          .btn-blue {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: white;
          }

          .btn-red {
            background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
            color: white;
          }

          .btn-dark {
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: white;
          }

          .btn-green {
            background: linear-gradient(135deg, #2e7d32, #1b5e20);
            color: white;
            box-shadow: 0 4px 12px rgba(46,125,50,0.3);
          }

          .btn-download {
            background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
            color: white;
          }

          .upload-form {
            display: grid;
            grid-template-columns: 1.2fr 1fr auto;
            gap: 8px;
            align-items: end;
          }

          .extra-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 10px;
          }

          .extra-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
            flex-wrap: wrap;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            padding: 14px 16px;
          }

          .extra-title {
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 4px;
          }

          .extra-sub {
            font-size: 13px;
            color: #64748b;
          }

          .status-row {
            margin-bottom: 16px;
          }

          .status-form-inline {
            margin: 0;
            display: flex;
            justify-content: flex-start;
          }

          .status-select {
            width: 220px;
            padding: 9px 14px;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
            background-image: none !important;
            box-shadow: none;
          }

          .status-aguardar {
            background-color: #e5e7eb !important;
            color: #374151 !important;
            border: 1px solid #cbd5e1 !important;
          }

          .status-andamento {
            background-color: #fef3c7 !important;
            color: #92400e !important;
            border: 1px solid #fcd34d !important;
          }

          .status-liberado {
            background-color: #dcfce7 !important;
            color: #166534 !important;
            border: 1px solid #86efac !important;
          }

          .empty-state {
            color: #94a3b8;
            font-size: 14px;
            padding: 20px 0;
          }

          @media (max-width: 1000px) {
            .cards-grid {
              grid-template-columns: 1fr;
            }

            .upload-form {
              grid-template-columns: 1fr;
            }
          }
        

/* ===== PADRÃO VISUAL DEUS É MAIS - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL DEUS É MAIS ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */

</style>
      </head>
      <body>
        <div class="container">
          <section class="hero">
            <div class="hero-top">
              <div>
                <h1>👨‍💼 Espaço do Contador</h1>
                <p>Baixe em massa os arquivos do mês e disponibilize pacotes extras para o fechamento contábil.</p>
              </div>
            </div>

            <form method="GET" action="/espaco-contador" class="filter-box">
              <div class="filter-group">
                <label for="mes">Escolha o mês dos arquivos</label>
                <select id="mes" name="mes">
                  ${optionsMes}
                </select>
              </div>

              <div class="actions">
                <button type="submit" class="btn btn-green">Aplicar mês</button>
                <a href="/dashboard" class="btn btn-dark">Voltar ao Painel</a>
              </div>
            </form>

            <div class="cards-grid">
              <div class="card">
                <h2>XML das Notas</h2>
                <div class="card-sub">Arquivos XML disponíveis para o mês selecionado.</div>

                <div class="status-row">
                  <form method="POST" action="/espaco-contador/salvar-status" class="status-form-inline">
                    <input type="hidden" name="mes_ref" value="${mes}">
                    <input type="hidden" name="tipo_status" value="xml">
                    <select
                      name="status"
                      class="status-select ${
                        statusMes.status_xml === 'Liberado para baixar'
                          ? 'status-liberado'
                          : statusMes.status_xml === 'Em andamento'
                            ? 'status-andamento'
                            : 'status-aguardar'
                      }"
                      onchange="this.form.submit()"
                    >
                      ${renderStatusOptions(statusMes.status_xml)}
                    </select>
                  </form>
                </div>

                <div class="metric">${totalXml}</div>

                <div class="actions">
                  <a class="btn btn-red" href="/espaco-contador/download/xml?mes=${mes}">
                    ⬇ Baixar XML em massa
                  </a>
                </div>
              </div>

              <div class="card">
                <h2>PDF das Notas</h2>
                <div class="card-sub">Arquivos PDF disponíveis para o mês selecionado.</div>

                <div class="status-row">
                  <form method="POST" action="/espaco-contador/salvar-status" class="status-form-inline">
                    <input type="hidden" name="mes_ref" value="${mes}">
                    <input type="hidden" name="tipo_status" value="pdf">
                    <select
                      name="status"
                      class="status-select ${
                        statusMes.status_pdf === 'Liberado para baixar'
                          ? 'status-liberado'
                          : statusMes.status_pdf === 'Em andamento'
                            ? 'status-andamento'
                            : 'status-aguardar'
                      }"
                      onchange="this.form.submit()"
                    >
                      ${renderStatusOptions(statusMes.status_pdf)}
                    </select>
                  </form>
                </div>

                <div class="metric">${totalPdf}</div>

                <div class="actions">
                  <a class="btn btn-green" href="/espaco-contador/download/pdf?mes=${mes}">
                    ⬇ Baixar PDF em massa
                  </a>
                </div>
              </div>
            </div>

            <div class="card" style="margin-bottom:24px;">
              <h2>Enviar Arquivos Extras</h2>
              <div class="card-sub">Use este espaço para subir pacotes zipados com extratos, relatórios, CTEs, planilhas e outros materiais do fechamento.</div>

              <form method="POST" action="/espaco-contador/upload-extra" enctype="multipart/form-data" class="upload-form">
                <div class="filter-group">
                  <label for="titulo">Nome do pacote</label>
                  <input id="titulo" name="titulo" placeholder="Ex.: Extratos Bancários" required />
                </div>

                <div class="filter-group">
                  <label for="arquivo_zip">Arquivo zipado</label>
                  <input id="arquivo_zip" type="file" name="arquivo_zip" accept=".zip" required />
                </div>

                <div class="actions">
                  <input type="hidden" name="mes_ref" value="${mes}" />
                  <button type="submit" class="btn btn-green">📦 Enviar pacote</button>
                </div>
              </form>
            </div>

            <div class="card">
              <h2>Arquivos Extras do Mês</h2>
              <div class="card-sub">Pacotes adicionais disponíveis para o contador baixar.</div>

              <div class="status-row">
                <form method="POST" action="/espaco-contador/salvar-status" class="status-form-inline">
                  <input type="hidden" name="mes_ref" value="${mes}">
                  <input type="hidden" name="tipo_status" value="extras">
                  <select
                    name="status"
                    class="status-select ${
                      statusMes.status_extras === 'Liberado para baixar'
                        ? 'status-liberado'
                        : statusMes.status_extras === 'Em andamento'
                          ? 'status-andamento'
                          : 'status-aguardar'
                    }"
                    onchange="this.form.submit()"
                  >
                    ${renderStatusOptions(statusMes.status_extras)}
                  </select>
                </form>
              </div>

              <div class="extra-list">
                ${extrasHtml}
              </div>
            </div>
          </section>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao abrir Espaço do Contador:\n${error.message}</pre>`);
  }
});

router.post('/espaco-contador/salvar-status', async (req, res) => {
  try {
    const { mes_ref, tipo_status, status } = req.body;

    if (!mes_ref || !tipo_status || !status) {
      return res.send('<pre>Dados inválidos para salvar o status.</pre>');
    }

    await pool.query(`
      INSERT INTO contador_status_mensal (mes_ref)
      VALUES ($1)
      ON CONFLICT (mes_ref) DO NOTHING
    `, [mes_ref]);

    let campo = '';

    if (tipo_status === 'xml') campo = 'status_xml';
    if (tipo_status === 'pdf') campo = 'status_pdf';
    if (tipo_status === 'extras') campo = 'status_extras';

    if (!campo) {
      return res.send('<pre>Tipo de status inválido.</pre>');
    }

    await pool.query(`
      UPDATE contador_status_mensal
      SET ${campo} = $1,
          updated_at = NOW()
      WHERE mes_ref = $2
    `, [status, mes_ref]);

    res.redirect('/espaco-contador?mes=' + encodeURIComponent(mes_ref));
  } catch (error) {
    res.send(`<pre>Erro ao salvar status do mês:\n${error.message}</pre>`);
  }
});

// DOWNLOAD EM MASSA - ESPAÇO DO CONTADOR
router.get('/espaco-contador/download/:tipo', protegerRota, async (req, res) => {
  try {
    const { tipo } = req.params;
    const { mes } = req.query;

    if (!['pdf', 'xml'].includes(tipo)) {
      return res.send('<pre>Tipo de arquivo inválido.</pre>');
    }

    if (!mes) {
      return res.send('<pre>Mês não informado.</pre>');
    }

    const campo = tipo === 'pdf' ? 'anexo_pdf' : 'anexo_xml';
    const extensao = tipo === 'pdf' ? 'pdf' : 'xml';

    const result = await pool.query(`
      SELECT id, fornecedor, numero_documento, valor, ${campo} AS arquivo
      FROM lancamentos
      WHERE ${campo} IS NOT NULL
        AND TRIM(${campo}) <> ''
        AND data_despesa >= DATE_TRUNC('month', $1::date)
        AND data_despesa < DATE_TRUNC('month', $1::date) + INTERVAL '1 month'
      ORDER BY id DESC
    `, [`${mes}-01`]);

    if (!result.rows.length) {
      return res.send(`<pre>Nenhum arquivo ${extensao.toUpperCase()} encontrado para este mês.</pre>`);
    }

    const arquivosValidos = [];

    for (const item of result.rows) {
      const nomeArquivo = path.basename(item.arquivo);
      const filePath = path.join(uploadsDir, nomeArquivo);

      if (fs.existsSync(filePath)) {
        const nomeFornecedor = sanitizeFilePart(item.fornecedor || 'Fornecedor');
        const nomeNumero = sanitizeFilePart(item.numero_documento || item.id);

        arquivosValidos.push({
          filePath,
          downloadName: `${nomeFornecedor}-${nomeNumero}.${extensao}`
        });
      }
    }

    if (!arquivosValidos.length) {
      return res.send('<pre>Os registros existem no banco, mas os arquivos físicos não foram encontrados em /uploads.</pre>');
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="arquivos-${extensao}-${mes}.zip"`
    );

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).send(`<pre>Erro ao gerar ZIP:\n${err.message}</pre>`);
      }
    });

    archive.pipe(res);

    arquivosValidos.forEach(item => {
      archive.file(item.filePath, {
        name: item.downloadName
      });
    });

    await archive.finalize();
  } catch (error) {
    res.send(`<pre>Erro ao baixar arquivos em massa:\n${error.message}</pre>`);
  }
});

module.exports = router;