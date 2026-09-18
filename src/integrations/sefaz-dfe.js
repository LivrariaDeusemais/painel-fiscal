const zlib = require('zlib');
const xml2js = require('xml2js');
const { obterCredenciaisA1 } = require('./certificado-a1');
const { assinarElementoPorId } = require('./xml-assinatura');
const { requisitarHttps } = require('./https-certificado');

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';
const DIST_NS = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe';
const EVENTO_NS = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4';

function somenteDigitos(valor = '') {
  return String(valor).replace(/\D/g, '');
}

function escaparXml(valor = '') {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function obterConfigSefaz(env = process.env) {
  return {
    endpointDistribuicao: env.SEFAZ_DFE_ENDPOINT || 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
    endpointEvento: env.SEFAZ_EVENTO_ENDPOINT || 'https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
    certPath: env.SEFAZ_CERT_PATH || env.NFSE_CERT_PATH || '/etc/secrets/certificado-deusemais.pfx',
    certPassword: env.SEFAZ_CERT_PASSWORD || env.NFSE_CERT_PASSWORD || '',
    cnpj: somenteDigitos(env.SEFAZ_CNPJ || env.NFSE_CNPJ || ''),
    cUfAutor: somenteDigitos(env.SEFAZ_CUF_AUTOR || '35') || '35',
    ambiente: String(env.SEFAZ_AMBIENTE || '1') === '2' ? '2' : '1'
  };
}

function padNsu(valor) {
  return somenteDigitos(valor || '0').padStart(15, '0').slice(-15);
}

function montarEnvelopeDistribuicao({ cnpj, ultimoNsu = '0', cUfAutor = '35', ambiente = '1' }) {
  const pedido = `<distDFeInt versao="1.01" xmlns="${NFE_NS}">` +
    `<tpAmb>${ambiente}</tpAmb>` +
    `<cUFAutor>${cUfAutor}</cUFAutor>` +
    `<CNPJ>${cnpj}</CNPJ>` +
    `<distNSU><ultNSU>${padNsu(ultimoNsu)}</ultNSU></distNSU>` +
    `</distDFeInt>`;
  return `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap12:Body><nfeDistDFeInteresse xmlns="${DIST_NS}"><nfeDadosMsg>${pedido}</nfeDadosMsg></nfeDistDFeInteresse></soap12:Body>` +
    `</soap12:Envelope>`;
}

function montarEnvelopeConsultaChave({ cnpj, chave, cUfAutor = '35', ambiente = '1' }) {
  const pedido = `<distDFeInt versao="1.01" xmlns="${NFE_NS}">` +
    `<tpAmb>${ambiente}</tpAmb>` +
    `<cUFAutor>${cUfAutor}</cUFAutor>` +
    `<CNPJ>${cnpj}</CNPJ>` +
    `<consChNFe><chNFe>${escaparXml(chave)}</chNFe></consChNFe>` +
    `</distDFeInt>`;
  return `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap12:Body><nfeDistDFeInteresse xmlns="${DIST_NS}"><nfeDadosMsg>${pedido}</nfeDadosMsg></nfeDistDFeInteresse></soap12:Body>` +
    `</soap12:Envelope>`;
}

function agoraIsoBrasil() {
  const data = new Date(Date.now() - (3 * 60 * 60 * 1000));
  return `${data.toISOString().slice(0, 19)}-03:00`;
}

function montarEventoCiencia({ cnpj, chave, ambiente = '1' }) {
  const id = `ID210210${chave}01`;
  const evento = `<?xml version="1.0" encoding="utf-8"?>` +
    `<envEvento versao="1.00" xmlns="${NFE_NS}"><idLote>${Date.now()}</idLote>` +
    `<evento versao="1.00"><infEvento Id="${id}">` +
    `<cOrgao>91</cOrgao><tpAmb>${ambiente}</tpAmb><CNPJ>${cnpj}</CNPJ>` +
    `<chNFe>${chave}</chNFe><dhEvento>${agoraIsoBrasil()}</dhEvento>` +
    `<tpEvento>210210</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento>` +
    `<detEvento versao="1.00"><descEvento>Ciencia da Operacao</descEvento></detEvento>` +
    `</infEvento></evento></envEvento>`;
  return { id, evento };
}

function montarEnvelopeEvento(xmlAssinado) {
  return `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap12:Body><nfeRecepcaoEvento xmlns="${EVENTO_NS}"><nfeDadosMsg>${xmlAssinado}</nfeDadosMsg></nfeRecepcaoEvento></soap12:Body>` +
    `</soap12:Envelope>`;
}

function obterValorRecursivo(objeto, nome) {
  if (!objeto || typeof objeto !== 'object') return null;
  for (const [chave, valor] of Object.entries(objeto)) {
    if (chave.split(':').pop() === nome) return valor;
    const encontrado = obterValorRecursivo(valor, nome);
    if (encontrado != null) return encontrado;
  }
  return null;
}

function array(valor) {
  if (valor == null) return [];
  return Array.isArray(valor) ? valor : [valor];
}

function primeiro(valor) {
  return Array.isArray(valor) ? valor[0] : valor;
}

function texto(valor) {
  const item = primeiro(valor);
  if (item == null) return '';
  if (typeof item === 'object' && '_' in item) return String(item._ || '');
  return String(item);
}

function campo(objeto, nome) {
  if (!objeto || typeof objeto !== 'object') return '';
  const chave = Object.keys(objeto).find(item => item.split(':').pop() === nome);
  return chave ? texto(objeto[chave]) : '';
}

function grupo(objeto, nome) {
  if (!objeto || typeof objeto !== 'object') return {};
  const chave = Object.keys(objeto).find(item => item.split(':').pop() === nome);
  return chave ? primeiro(objeto[chave]) || {} : {};
}

function normalizarTexto(valor = '') {
  return String(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

function classificarNfeCompleta({ natureza = '', itens = [] }) {
  const textoItens = normalizarTexto(itens.map(item => item.descricao).join(' '));
  const operacao = normalizarTexto(natureza);
  const cfops = itens.map(item => somenteDigitos(item.cfop));

  if (/RETORNO|DEVOLUCAO|REMESSA|ARMAZEM|DEPOSITO FECHADO|FULFILLMENT/.test(`${operacao} ${textoItens}`) ||
      cfops.some(cfop => /^(1202|1208|1209|1410|1411|1414|1415|1904|1906|1907|1908|1909|2202|2208|2209|2410|2411|2414|2415|2904|2906|2907|2908|2909)$/.test(cfop))) {
    return 'RETORNO_REMESSA';
  }
  if (/BIBLIA|HARPA|LIVRO|DEVOCIONAL|LITERATURA/.test(textoItens)) return 'ESTOQUE';
  if (/ETIQUETA|EMBALAGEM|PAPELAO|PAPEL SULFITE|BOBINA|FITA ADESIVA|TONER|MATERIAL DE ESCRITORIO/.test(textoItens)) return 'CONSUMO';
  return 'REVISAO';
}

async function mapearDocumentoZip(docZip) {
  const base64 = typeof docZip === 'object' ? texto(docZip) : String(docZip || '');
  const attrs = typeof docZip === 'object' ? (docZip.$ || {}) : {};
  const compactado = Buffer.from(base64.replace(/\s+/g, ''), 'base64');
  const xml = zlib.gunzipSync(compactado).toString('utf8');
  const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false, trim: true });
  const resumo = primeiro(obterValorRecursivo(parsed, 'resNFe'));
  const proc = primeiro(obterValorRecursivo(parsed, 'nfeProc')) || primeiro(obterValorRecursivo(parsed, 'NFe'));

  if (resumo) {
    return {
      tipo: 'RESUMO',
      schema: attrs.schema || '',
      nsu: attrs.NSU || attrs.nsu || '',
      chave: campo(resumo, 'chNFe'),
      fornecedor: campo(resumo, 'xNome'),
      cnpjFornecedor: campo(resumo, 'CNPJ') || campo(resumo, 'CPF'),
      dataEmissao: campo(resumo, 'dhEmi'),
      valor: Number(campo(resumo, 'vNF') || 0),
      classificacao: 'PENDENTE_ANALISE',
      itens: [],
      xml: ''
    };
  }

  if (proc) {
    const nfe = primeiro(obterValorRecursivo(proc, 'NFe')) || proc;
    const inf = primeiro(obterValorRecursivo(nfe, 'infNFe')) || {};
    const ide = grupo(inf, 'ide');
    const emit = grupo(inf, 'emit');
    const total = grupo(grupo(inf, 'total'), 'ICMSTot');
    const dets = array(obterValorRecursivo(inf, 'det'));
    const itens = dets.map(det => {
      const prod = grupo(det, 'prod');
      return {
        codigo: campo(prod, 'cProd'),
        descricao: campo(prod, 'xProd'),
        ncm: campo(prod, 'NCM'),
        cfop: campo(prod, 'CFOP'),
        quantidade: Number(campo(prod, 'qCom') || 0),
        valor: Number(campo(prod, 'vProd') || 0)
      };
    });
    const chave = String(inf.$?.Id || '').replace(/^NFe/, '') || campo(proc, 'chNFe');
    const natureza = campo(ide, 'natOp');
    return {
      tipo: 'XML_COMPLETO',
      schema: attrs.schema || '',
      nsu: attrs.NSU || attrs.nsu || '',
      chave,
      fornecedor: campo(emit, 'xNome'),
      cnpjFornecedor: campo(emit, 'CNPJ') || campo(emit, 'CPF'),
      dataEmissao: campo(ide, 'dhEmi') || campo(ide, 'dEmi'),
      numero: campo(ide, 'nNF'),
      serie: campo(ide, 'serie'),
      natureza,
      valor: Number(campo(total, 'vNF') || 0),
      classificacao: classificarNfeCompleta({ natureza, itens }),
      itens,
      xml
    };
  }

  return { tipo: 'OUTRO', schema: attrs.schema || '', nsu: attrs.NSU || attrs.nsu || '', xml: '' };
}

async function executarConsultaDistribuicao(envelope, config) {
  if (!config.cnpj || config.cnpj.length !== 14) throw new Error('CNPJ da SEFAZ não configurado.');
  const credenciais = obterCredenciaisA1(config.certPath, config.certPassword);
  const resposta = await requisitarHttps({
    url: config.endpointDistribuicao,
    pfx: credenciais.pfx,
    passphrase: config.certPassword,
    body: envelope,
    headers: { 'Content-Type': `application/soap+xml; charset=utf-8; action="${DIST_NS}/nfeDistDFeInteresse"` }
  });
  if (!resposta.ok) throw new Error(`SEFAZ retornou HTTP ${resposta.statusCode}.`);
  const soap = await xml2js.parseStringPromise(resposta.body, { explicitArray: false, trim: true });
  const retorno = primeiro(obterValorRecursivo(soap, 'retDistDFeInt'));
  if (!retorno) throw new Error('A SEFAZ não retornou a estrutura de distribuição esperada.');
  const codigo = campo(retorno, 'cStat');
  const motivo = campo(retorno, 'xMotivo');
  if (!['137', '138'].includes(codigo)) {
    throw new Error(`SEFAZ ${codigo || 'sem código'}: ${motivo || 'resposta não reconhecida'}.`);
  }
  const lote = primeiro(obterValorRecursivo(retorno, 'loteDistDFeInt')) || {};
  const docs = array(obterValorRecursivo(lote, 'docZip'));
  const documentos = [];
  for (const doc of docs) documentos.push(await mapearDocumentoZip(doc));
  return {
    codigo,
    motivo,
    ultimoNsu: campo(retorno, 'ultNSU'),
    maxNsu: campo(retorno, 'maxNSU'),
    documentos
  };
}

async function consultarDistribuicao({ ultimoNsu = '0', config = obterConfigSefaz() } = {}) {
  const envelope = montarEnvelopeDistribuicao({ ...config, ultimoNsu });
  return executarConsultaDistribuicao(envelope, config);
}

async function consultarPorChave({ chave, config = obterConfigSefaz() }) {
  if (!/^\d{44}$/.test(String(chave || ''))) throw new Error('Chave de acesso da NF-e inválida.');
  const envelope = montarEnvelopeConsultaChave({ ...config, chave });
  return executarConsultaDistribuicao(envelope, config);
}

async function manifestarCiencia({ chave, config = obterConfigSefaz() }) {
  if (!/^\d{44}$/.test(String(chave || ''))) throw new Error('Chave de acesso da NF-e inválida.');
  const credenciais = obterCredenciaisA1(config.certPath, config.certPassword);
  const { id, evento } = montarEventoCiencia({ cnpj: config.cnpj, chave, ambiente: config.ambiente });
  const assinado = assinarElementoPorId(evento, credenciais, id);
  const envelope = montarEnvelopeEvento(assinado);
  const resposta = await requisitarHttps({
    url: config.endpointEvento,
    pfx: credenciais.pfx,
    passphrase: config.certPassword,
    body: envelope,
    headers: { 'Content-Type': `application/soap+xml; charset=utf-8; action="${EVENTO_NS}/nfeRecepcaoEvento"` }
  });
  if (!resposta.ok) throw new Error(`SEFAZ retornou HTTP ${resposta.statusCode} ao registrar Ciência da Emissão.`);
  const soap = await xml2js.parseStringPromise(resposta.body, { explicitArray: false, trim: true });
  const retorno = primeiro(obterValorRecursivo(soap, 'retEnvEvento'));
  const eventoRetorno = primeiro(obterValorRecursivo(retorno, 'retEvento')) || {};
  const infEvento = primeiro(obterValorRecursivo(eventoRetorno, 'infEvento')) || eventoRetorno;
  const codigo = campo(infEvento, 'cStat') || campo(retorno, 'cStat');
  return {
    ok: ['135', '136', '573'].includes(codigo),
    codigo,
    motivo: campo(infEvento, 'xMotivo') || campo(retorno, 'xMotivo'),
    protocolo: campo(infEvento, 'nProt')
  };
}

module.exports = {
  obterConfigSefaz,
  montarEnvelopeDistribuicao,
  montarEnvelopeConsultaChave,
  montarEventoCiencia,
  classificarNfeCompleta,
  mapearDocumentoZip,
  consultarDistribuicao,
  consultarPorChave,
  manifestarCiencia
};
