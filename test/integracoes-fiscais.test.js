const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');
const {
  SOAP_ACTION_CONSULTA_RECEBIDAS,
  obterConfigNfPaulistana,
  montarPedidoConsulta,
  montarEnvelopeSoap
} = require('../src/integrations/nfpaulistana');
const {
  montarEnvelopeDistribuicao,
  montarEnvelopeConsultaChave,
  montarEventoCiencia,
  classificarNfeCompleta,
  mapearDocumentoZip
} = require('../src/integrations/sefaz-dfe');

const CHAVE = '35260943686942000188550010000035581215083835';

function docZip(xml, schema = 'resNFe_v1.01.xsd', nsu = '123') {
  return {
    _: zlib.gzipSync(Buffer.from(xml, 'utf8')).toString('base64'),
    $: { schema, NSU: nsu }
  };
}

test('monta pedido da Nota Fiscal Paulistana por período', () => {
  const xml = montarPedidoConsulta({
    cnpj: '18862388000103',
    dataInicial: '2026-09-01',
    dataFinal: '2026-09-30',
    pagina: 2
  });
  assert.match(xml, /<PedidoConsultaNFePeriodo/);
  assert.match(xml, /<Cabecalho xmlns="" Versao="2">/);
  assert.match(xml, /<CNPJ>18862388000103<\/CNPJ>/);
  assert.match(xml, /<dtInicio>2026-09-01<\/dtInicio>/);
  assert.match(xml, /<NumeroPagina>2<\/NumeroPagina>/);
  const envelope = montarEnvelopeSoap({ xml, versaoSchema: '2' });
  assert.match(envelope, /<ConsultaNFeRecebidasRequest/);
  assert.match(envelope, /<VersaoSchema>2<\/VersaoSchema>/);
  assert.equal(SOAP_ACTION_CONSULTA_RECEBIDAS, 'http://www.prefeitura.sp.gov.br/nfe/ws/consultaNFeRecebidas');
  assert.equal(obterConfigNfPaulistana({}).endpoint, 'https://nfews.prefeitura.sp.gov.br/lotenfe.asmx');
});

test('monta consultas SEFAZ sem persistir documentos', () => {
  const lote = montarEnvelopeDistribuicao({ cnpj: '18862388000103', ultimoNsu: '27' });
  assert.match(lote, /<ultNSU>000000000000027<\/ultNSU>/);
  const chave = montarEnvelopeConsultaChave({ cnpj: '18862388000103', chave: CHAVE });
  assert.match(chave, new RegExp(`<chNFe>${CHAVE}<\\/chNFe>`));
  const evento = montarEventoCiencia({ cnpj: '18862388000103', chave: CHAVE });
  assert.equal(evento.id, `ID210210${CHAVE}01`);
  assert.match(evento.evento, /<descEvento>Ciencia da Operacao<\/descEvento>/);
});

test('classifica retornos antes de criar candidato', () => {
  assert.equal(classificarNfeCompleta({ natureza: 'Retorno de remessa full', itens: [] }), 'RETORNO_REMESSA');
  assert.equal(classificarNfeCompleta({ natureza: 'Entrada', itens: [{ descricao: 'Biblia de estudo', cfop: '1102' }] }), 'ESTOQUE');
  assert.equal(classificarNfeCompleta({ natureza: 'Compra', itens: [{ descricao: 'Bobina de papelão ondulado', cfop: '1556' }] }), 'CONSUMO');
  assert.equal(classificarNfeCompleta({ natureza: 'Compra', itens: [{ descricao: 'Produto sem regra', cfop: '1556' }] }), 'REVISAO');
});

test('lê resumo compactado distribuído pela SEFAZ', async () => {
  const xml = `<resNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><chNFe>${CHAVE}</chNFe><CNPJ>43686942000188</CNPJ><xNome>EVOPACK</xNome><dhEmi>2026-09-17T15:05:00-03:00</dhEmi><vNF>735.00</vNF></resNFe>`;
  const documento = await mapearDocumentoZip(docZip(xml));
  assert.equal(documento.tipo, 'RESUMO');
  assert.equal(documento.chave, CHAVE);
  assert.equal(documento.valor, 735);
});

test('lê e classifica XML completo compactado sem gravá-lo', async () => {
  const xml = `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${CHAVE}"><ide><natOp>VENDA</natOp><serie>1</serie><nNF>3558</nNF><dhEmi>2026-09-17T15:05:00-03:00</dhEmi></ide><emit><CNPJ>43686942000188</CNPJ><xNome>EVOPACK</xNome></emit><det nItem="1"><prod><cProd>1</cProd><xProd>BOBINA DE PAPELAO</xProd><NCM>48081000</NCM><CFOP>5102</CFOP><qCom>10</qCom><vProd>735.00</vProd></prod></det><total><ICMSTot><vNF>735.00</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`;
  const documento = await mapearDocumentoZip(docZip(xml, 'procNFe_v4.00.xsd'));
  assert.equal(documento.tipo, 'XML_COMPLETO');
  assert.equal(documento.classificacao, 'CONSUMO');
  assert.equal(documento.itens[0].ncm, '48081000');
  assert.equal(documento.xml, xml);
});
