const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const chave = '35503081214338304000178000000012352326093531034075';

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
