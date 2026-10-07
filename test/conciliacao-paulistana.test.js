const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const chave = '35503081214338304000178000000012352326093531034075';

function carregarConciliacao(pool) {
  const codigo = fs.readFileSync(require.resolve('../src/routes/index'), 'utf8');
  const contexto = vm.createContext({ pool, ensureArquivoFilaTable: async () => {} });
  vm.runInContext(codigo.slice(codigo.indexOf('function arquivoConciliacaoSomenteDigitos('),
    codigo.indexOf('async function arquivoConciliacaoTextoPdf(')), contexto);
  vm.runInContext(codigo.slice(codigo.indexOf('function arquivoAutoNormText('),
    codigo.indexOf('function arquivoAutoFindInBlock(')), contexto);
  vm.runInContext(codigo.slice(codigo.indexOf('async function conciliarArquivoFilaDisponiveis('),
    codigo.indexOf('async function reprocessarArquivoFila(')), contexto);
  return contexto;
}

test('chave nacional municipal tem prioridade sobre outro Id fiscal no XML', () => {
  const contexto = carregarConciliacao();
  assert.equal(contexto.arquivoConciliacaoExtrairChave(
    `<NFe Id="${'1'.repeat(44)}"><ns:ChaveNotaNacional> ${chave} </ns:ChaveNotaNacional></NFe>`), chave);
});

test('XML Paulistana mantém prestador e emissão mesmo com xNome do tomador', () => {
  const contexto = carregarConciliacao();
  const resultado = contexto.arquivoConciliacaoMetadadosXml(`<NFe>
    <ChaveNFe><NumeroNFe>4790567</NumeroNFe><ChaveNotaNacional>${chave}</ChaveNotaNacional></ChaveNFe>
    <CPFCNPJPrestador><CNPJ>27415911000136</CNPJ></CPFCNPJPrestador>
    <RazaoSocialPrestador>BYTEDANCE BRASIL TECNOLOGIA LTDA.</RazaoSocialPrestador>
    <DataEmissaoNFe>2026-09-18T02:40:47</DataEmissaoNFe><ValorServicos>1442.28</ValorServicos>
    <Adquirente><CNPJ>18862388000103</CNPJ><xNome>DEUS E MAIS</xNome></Adquirente></NFe>`);
  assert.equal(resultado.fornecedor, 'BYTEDANCE BRASIL TECNOLOGIA LTDA.');
  assert.equal(resultado.cnpjCpf, '27415911000136');
  assert.equal(resultado.numero, '4790567');
  assert.equal(resultado.data, '2026-09-18');
  assert.equal(resultado.valor, 1442.28);
});

test('concilia pela chave exata, ignora duplicados e preserva pares anteriores', async () => {
  const linhas = [
    { id: 1, tipo: 'PDF', chave_fiscal: chave, analise_status: 'AGUARDANDO_XML' },
    { id: 2, tipo: 'XML', chave_fiscal: chave, numero_documento: '123523', analise_status: 'AGUARDANDO_PDF' },
    { id: 3, tipo: 'PDF', chave_fiscal: chave, analise_status: 'DUPLICADO' },
    { id: 4, tipo: 'PDF', chave_fiscal: 'outra', par_id: 9 },
    { id: 5, tipo: 'XML', chave_fiscal: 'outra' },
    { id: 6, tipo: 'PDF', chave_fiscal: 'completo', par_id: 7, analise_status: 'COMPLETO' },
    { id: 7, tipo: 'XML', chave_fiscal: 'completo', par_id: 6, analise_status: 'COMPLETO' },
    { id: 8, tipo: 'XML', chave_fiscal: 'sem-pdf' }
  ];
  const gravacoes = [];
  const contexto = carregarConciliacao({ query: async (sql, valores) => {
    if (!valores) return { rows: linhas };
    gravacoes.push(valores);
    return { rowCount: 2 };
  } });
  assert.equal(await contexto.conciliarArquivoFilaDisponiveis(), 1);
  assert.equal(gravacoes.length, 1);
  assert.deepEqual(Array.from(gravacoes[0].slice(0, 2)), [1, 2]);
  assert.equal(gravacoes[0][4], '123523');
});

test('atualiza chave nacional do XML municipal e preserva quando ausente', async () => {
  const codigo = fs.readFileSync(require.resolve('../src/routes/integracoes-fiscais'), 'utf8');
  const chamadas = [];
  const contexto = vm.createContext({ pool: { query: async (sql, valores) => chamadas.push({ sql, valores }) } });
  vm.runInContext(codigo.slice(codigo.indexOf('async function atualizarNotaPaulistanaExistente('),
    codigo.indexOf('async function importarNotaPaulistana(')), contexto);
  const nota = { dataEmissao: '2026-09-02', numero: '123523', valor: 5.97,
    xml: `<NFe><ChaveNFe><ChaveNotaNacional>${chave}</ChaveNotaNacional></ChaveNFe></NFe>` };
  await contexto.atualizarNotaPaulistanaExistente(539, nota);
  assert.equal(chamadas[0].valores[7], chave);
  assert.match(chamadas[0].sql, /chave_fiscal = COALESCE\(\$8, chave_fiscal\)/);
  await contexto.atualizarNotaPaulistanaExistente(539, { ...nota, xml: '<NFe/>' });
  assert.equal(chamadas[1].valores[7], null);
});
