const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { criarRelatorioDespesasMensal, periodoRelatorio } = require('../src/services/despesas-mensal');
const JSZip = require('jszip');
const { parseStringPromise } = require('xml2js');

test('título identifica mês, intervalo e filtros abertos sem inventar período', () => {
  assert.equal(periodoRelatorio({ data_inicio: '2026-09-01', data_fim: '2026-09-30' }), 'setembro de 2026');
  assert.equal(periodoRelatorio({ data_inicio: '2026-08-01', data_fim: '2026-09-30' }), '01/08/2026 a 30/09/2026');
  assert.equal(periodoRelatorio({}), 'Todos os períodos');
});

test('exportação mensal preserva a lista completa, documentos, categorias e total filtrado', async () => {
  const rows = [
    { id: 1, fornecedor: 'FILIPE SALES', valor: '100.25', numero_documento: '0001', cnpj_cpf: '001234', data_despesa: '2026-09-03', categoria: 'ADS', categoria_principal: 'Vendas', categoria_pai_id: 1, subcategoria: 'ADS' },
    { id: 2, fornecedor: 'Filipe Sales', valor: '50.50', categoria: 'Vendas' },
    { id: 3, fornecedor: 'Outra', valor: '10', categoria: 'Geral' }
  ];
  const w = criarRelatorioDespesasMensal(rows, { data_inicio: '2026-09-01', data_fim: '2026-09-30' });
  assert.equal(w.worksheets.length, 1);
  const s = w.getWorksheet('Despesas');
  assert.equal(s.getCell('C8').value, '0001');
  assert.equal(s.getCell('F8').value, '001234');
  assert.equal(s.getCell('E8').value, 'FILIPE SALES');
  assert.equal(s.getCell('E9').value, 'Filipe Sales');
  assert.equal(s.getCell('J8').value, 'Vendas');
  assert.equal(s.getCell('K8').value, 'ADS');
  assert.match(s.getCell('A1').value, /setembro de 2026/);
  assert.match(s.getCell('A4').value, /3 despesas/);
  assert.equal(s.getCell('H12').result, 160.75);
  const roundTrip = new ExcelJS.Workbook();
  await roundTrip.xlsx.load(await w.xlsx.writeBuffer());
  assert.equal(roundTrip.worksheets.length, 1);
  assert.equal(roundTrip.worksheets[0].getCell('H12').result, 160.75);
  assert.equal(roundTrip.worksheets[0].autoFilter, 'A7:M10');
});

test('relatório vazio produz uma aba com total zerado', async () => {
  const w = criarRelatorioDespesasMensal([]);
  assert.equal(w.worksheets.length, 1);
  assert.equal(w.worksheets[0].getCell('H9').result, 0);
  assert.ok((await w.xlsx.writeBuffer()).length > 0);
});

test('exportação mensal contém somente a lista formatada, sem partes nem vínculos de dinâmicas', async () => {
  const w = criarRelatorioDespesasMensal([{ id: 1, valor: 10, fornecedor: 'Teste', categoria: 'Geral' }]);
  const zip = await JSZip.loadAsync(await w.xlsx.writeBuffer());
  assert.equal(Object.keys(zip.files).filter(p => /pivotTable|pivotCache/i.test(p)).length, 0);
  for (const path of Object.keys(zip.files).filter(p => p.endsWith('.xml') || p.endsWith('.rels'))) {
    const xml = await zip.file(path).async('string');
    await parseStringPromise(xml);
    assert.doesNotMatch(xml, /pivotTable|pivotCache/);
  }
  const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(sheet, /mergeCell ref="A1:M2"/);
  assert.match(sheet, /autoFilter ref="A7:M8"/);
  assert.equal(zip.file('xl/worksheets/sheet2.xml'), null);
});
