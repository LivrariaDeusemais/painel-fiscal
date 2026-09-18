const xml2js = require('xml2js');
const { obterCredenciaisA1 } = require('./certificado-a1');
const { assinarDocumentoInteiro } = require('./xml-assinatura');
const { requisitarHttps } = require('./https-certificado');

const NAMESPACE = 'http://www.prefeitura.sp.gov.br/nfe';
const SOAP_ACTION_CONSULTA_RECEBIDAS = `${NAMESPACE}/ws/consultaNFeRecebidas`;

function escaparXml(valor = '') {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function somenteDigitos(valor = '') {
  return String(valor).replace(/\D/g, '');
}

function obterConfigNfPaulistana(env = process.env) {
  return {
    endpoint: env.NFPAULISTANA_ENDPOINT || 'https://nfews.prefeitura.sp.gov.br/lotenfe.asmx',
    certPath: env.NFPAULISTANA_CERT_PATH || env.NFSE_CERT_PATH || '/etc/secrets/certificado-deusemais.pfx',
    certPassword: env.NFPAULISTANA_CERT_PASSWORD || env.NFSE_CERT_PASSWORD || '',
    cnpj: somenteDigitos(env.NFPAULISTANA_CNPJ || env.NFSE_CNPJ || ''),
    versaoSchema: String(env.NFPAULISTANA_SCHEMA_VERSION || '2') === '1' ? '1' : '2'
  };
}

function montarPedidoConsulta({ cnpj, dataInicial, dataFinal, pagina = 1, versaoSchema = '2' }) {
  return `<?xml version="1.0" encoding="utf-8"?>` +
    `<PedidoConsultaNFePeriodo xmlns="${NAMESPACE}">` +
    `<Cabecalho xmlns="" Versao="${versaoSchema}">` +
    `<CPFCNPJRemetente><CNPJ>${escaparXml(cnpj)}</CNPJ></CPFCNPJRemetente>` +
    `<CPFCNPJ><CNPJ>${escaparXml(cnpj)}</CNPJ></CPFCNPJ>` +
    `<dtInicio>${escaparXml(dataInicial)}</dtInicio>` +
    `<dtFim>${escaparXml(dataFinal)}</dtFim>` +
    `<NumeroPagina>${Math.max(Number(pagina) || 1, 1)}</NumeroPagina>` +
    `</Cabecalho>` +
    `</PedidoConsultaNFePeriodo>`;
}

function montarEnvelopeSoap(xmlAssinado) {
  return `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soap:Body>` +
    `<ConsultaNFeRecebidasRequest xmlns="${NAMESPACE}">` +
    `<VersaoSchema>${xmlAssinado.versaoSchema}</VersaoSchema>` +
    `<MensagemXML><![CDATA[${xmlAssinado.xml}]]></MensagemXML>` +
    `</ConsultaNFeRecebidasRequest>` +
    `</soap:Body>` +
    `</soap:Envelope>`;
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

async function extrairFalhaSoap(xml) {
  try {
    const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false, trim: true });
    return texto(obterValorRecursivo(parsed, 'faultstring')) ||
      texto(obterValorRecursivo(parsed, 'Text')) ||
      texto(obterValorRecursivo(parsed, 'Message')) || '';
  } catch (error) {
    return '';
  }
}

function mapearNota(nota) {
  const chaveNfe = grupo(nota, 'ChaveNFe');
  const prestador = grupo(nota, 'CPFCNPJPrestador');
  const cnpjPrestador = campo(prestador, 'CNPJ') || campo(prestador, 'CPF');
  const numero = campo(chaveNfe, 'NumeroNFe');
  const codigoVerificacao = campo(chaveNfe, 'CodigoVerificacao');
  const inscricaoPrestador = campo(chaveNfe, 'InscricaoPrestador');
  const valorServicos = Number(campo(nota, 'ValorServicos') || 0);
  const chaveMunicipal = [cnpjPrestador, inscricaoPrestador, numero, codigoVerificacao].filter(Boolean).join(':');

  return {
    chaveMunicipal,
    cnpjPrestador,
    inscricaoPrestador,
    numero,
    codigoVerificacao,
    fornecedor: campo(nota, 'RazaoSocialPrestador'),
    dataEmissao: campo(nota, 'DataEmissaoNFe'),
    valor: Number.isFinite(valorServicos) ? valorServicos : 0,
    discriminacao: campo(nota, 'Discriminacao'),
    status: campo(nota, 'StatusNFe'),
    dados: nota
  };
}

async function consultarPaginaNfPaulistana({ dataInicial, dataFinal, pagina = 1, config = obterConfigNfPaulistana() }) {
  if (!config.cnpj || config.cnpj.length !== 14) throw new Error('CNPJ da Nota Fiscal Paulistana não configurado.');
  const credenciais = obterCredenciaisA1(config.certPath, config.certPassword);
  const pedido = montarPedidoConsulta({ cnpj: config.cnpj, dataInicial, dataFinal, pagina, versaoSchema: config.versaoSchema });
  const assinado = assinarDocumentoInteiro(pedido, credenciais, 'Cabecalho');
  const envelope = montarEnvelopeSoap({ xml: assinado, versaoSchema: config.versaoSchema });
  const resposta = await requisitarHttps({
    url: config.endpoint,
    pfx: credenciais.pfx,
    passphrase: config.certPassword,
    body: envelope,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `"${SOAP_ACTION_CONSULTA_RECEBIDAS}"`
    }
  });

  if (!resposta.ok) {
    const falha = await extrairFalhaSoap(resposta.body);
    throw new Error(`Nota Fiscal Paulistana retornou HTTP ${resposta.statusCode}${falha ? `: ${falha}` : ''}.`);
  }
  const soap = await xml2js.parseStringPromise(resposta.body, { explicitArray: false, trim: true });
  const retornoXml = texto(obterValorRecursivo(soap, 'RetornoXML'));
  if (!retornoXml) throw new Error('A Prefeitura não retornou o XML da consulta.');
  const retorno = await xml2js.parseStringPromise(retornoXml, { explicitArray: false, trim: true });
  const raiz = primeiro(obterValorRecursivo(retorno, 'RetornoConsulta')) || retorno;
  const cabecalho = grupo(raiz, 'Cabecalho');
  const sucesso = campo(cabecalho, 'Sucesso').toLowerCase() === 'true';
  const erros = array(obterValorRecursivo(raiz, 'Erro')).map(item => ({
    codigo: campo(item, 'Codigo'),
    descricao: campo(item, 'Descricao')
  }));
  const notasBrutas = array(obterValorRecursivo(raiz, 'NFe'));
  const fragmentosXml = retornoXml.match(/<(?:[A-Za-z0-9_]+:)?NFe\b[\s\S]*?<\/(?:[A-Za-z0-9_]+:)?NFe>/g) || [];

  return {
    sucesso,
    erros,
    notas: notasBrutas.map((nota, index) => ({
      ...mapearNota(nota),
      xml: `<?xml version="1.0" encoding="utf-8"?>${fragmentosXml[index] || ''}`
    })),
    temProximaPagina: notasBrutas.length === 50,
    retornoXml
  };
}

module.exports = {
  SOAP_ACTION_CONSULTA_RECEBIDAS,
  obterConfigNfPaulistana,
  montarPedidoConsulta,
  montarEnvelopeSoap,
  mapearNota,
  consultarPaginaNfPaulistana
};
