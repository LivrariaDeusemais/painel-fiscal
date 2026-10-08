const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { criarRelatorioDespesasAnual } = require('../src/services/despesas-anual');

test('relatório anual reconcilia categorias, preserva meses e calcula crescimento sem duplicar filhos', async () => {
  const dados = [
    { mes_ref: '2026-01', principal_id: 1, categoria_id: 2, categoria_principal: 'Pessoal', subcategoria: 'Salários', total: '100.25' },
    { mes_ref: '2026-02', principal_id: 1, categoria_id: 2, categoria_principal: 'Pessoal', subcategoria: 'Salários', total: '200.50' },
    { mes_ref: '2026-02', principal_id: 1, categoria_id: 1, categoria_principal: 'Pessoal', subcategoria: 'Pessoal', total: '10' },
    { mes_ref: '2026-02', principal_id: null, categoria_id: null, total: '15' },
    { mes_ref: '2025-01', principal_id: 1, categoria_id: 2, total: '999' }
  ];
  const wb = criarRelatorioDespesasAnual(dados, 2026, new Date(2026, 9, 8));
  const values = wb.worksheets[0];
  const growth = wb.worksheets[1];
  assert.equal(values.getCell('B8').value, 100.25);
  assert.equal(values.getCell('C8').value, 225.50);
  assert.equal(values.getCell('N8').value.result, 325.75);
  assert.equal(growth.getCell('C8').value.result, (225.50 - 100.25) / 100.25);
  assert.equal(growth.getCell('L8').value, null);
  assert.equal(growth.getCell('B8').value, null);
  const uncategorized = values.getColumn(1).values.indexOf('Sem categoria');
  assert.equal(growth.getCell(uncategorized, 3).value.result, 'Sem base');
  const copy = new ExcelJS.Workbook();
  await copy.xlsx.load(await wb.xlsx.writeBuffer());
  assert.equal(copy.worksheets.length, 2);
  assert.equal(copy.worksheets[0].getCell('N8').value.result, 325.75);
  assert.equal(copy.worksheets[0].views[0].xSplit, 1);
});

test('relatório vazio exporta totais zerados sem erros de divisão', async () => {
  const wb = criarRelatorioDespesasAnual([], 2025, new Date(2026, 9, 8));
  assert.equal(wb.worksheets[0].getCell('O8').result, 0);
  assert.equal(wb.worksheets[1].getCell('C8').result, '');
  assert.ok((await wb.xlsx.writeBuffer()).length > 0);
});
