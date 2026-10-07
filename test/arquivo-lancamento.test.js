const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const codigo = fs.readFileSync(require.resolve('../src/routes/index'), 'utf8');
const contexto = vm.createContext({});
vm.runInContext(codigo.slice(codigo.indexOf('function escolherRotinaDoLancamento('), codigo.indexOf('async function buscarRotinasPorDocumento(')), contexto);
const escolher = contexto.escolherRotinaDoLancamento;
const contas = [
  {id:1, cnpj_cpf:'12.345.678/0001-90', categoria_principal_id:10, subcategoria_id:11},
  {id:2, cnpj_cpf:'12345678000190', categoria_principal_id:10, subcategoria_id:12},
  {id:3, cnpj_cpf:'98765432000100', categoria_principal_id:10, subcategoria_id:11}
];
test('identifica conta por documento normalizado e categoria exata', () => {
  assert.equal(escolher(contas, '12345678000190', '11', '').id, 1);
  assert.equal(escolher(contas, '12.345.678/0001-90', '12', '').id, 2);
});
test('não marca feito quando categoria, subcategoria ou documento divergem', () => {
  assert.equal(escolher(contas, '12345678000190', '10', '1'), null);
  assert.equal(escolher(contas, '12345678000190', '12', '1'), null);
  assert.equal(escolher(contas, '', '11', '1'), null);
  assert.equal(escolher(contas, '98765432000100', '11', '1'), null);
});
test('categoria principal vale quando não há subcategoria cadastrada', () => {
  assert.equal(escolher([{id:4,cnpj_cpf:'12345678901',categoria_principal_id:10}], '123.456.789-01',10,'').id,4);
});
test('duas contas na mesma categoria exigem conta escolhida', () => {
  const duplicadas = [contas[0], {...contas[0],id:5}];
  assert.equal(escolher(duplicadas,'12345678000190',11,''),null);
  assert.equal(escolher(duplicadas,'12345678000190',11,5).id,5);
});

test('formulário renderiza campos de revisão e scripts válidos', async () => {
  const mock = vm.createContext({
    router: { get: (_path, fn) => { mock.handler = fn; } },
    URLSearchParams, JSON, console,
    renderGlobalHeader: () => '', escapeHtmlGlobal: value => String(value || ''),
    normalizarDiaVencimento: () => '',
    pool: {query: async () => ({rows:[{id:10,nome:'Categoria principal',categoria_pai_id:null},{id:11,nome:'Subcategoria',categoria_pai_id:10}]})},
    renderTipoDocumentoOptions: () => '<option value="NF">NF</option>',
  });
  const inicio = codigo.indexOf("router.get('/novo', async");
  const fim = codigo.indexOf("router.post(\n  '/novo'",inicio);
  vm.runInContext(codigo.slice(inicio,fim),mock);
  let html;
  await mock.handler({query:{}},{send: body => {html=body;}});
  assert.ok(html.includes('id="pdf_tipo_pagamento"'), html.slice(0,300));
  assert.ok(html.includes('id="pdf_categoria_principal"'));
  assert.ok(html.includes('id="pdf_subcategoria"'));
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length);
  scripts.forEach((match) => new vm.Script(match[1]));
});
