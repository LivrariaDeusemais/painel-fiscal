const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { criarRelatorioDespesasMensal, periodoRelatorio } = require('../src/services/despesas-mensal');
const { exportarComDinamicas } = require('../src/services/excel-pivots');
const JSZip = require('jszip');
const { parseStringPromise } = require('xml2js');

test('título identifica mês, intervalo e filtros abertos sem inventar período', () => {
  assert.equal(periodoRelatorio({data_inicio:'2026-09-01',data_fim:'2026-09-30'}), 'setembro de 2026');
  assert.equal(periodoRelatorio({data_inicio:'2026-08-01',data_fim:'2026-09-30'}), '01/08/2026 a 30/09/2026');
  assert.equal(periodoRelatorio({}), 'Todos os períodos');
});

test('exportação mensal mantém documentos como texto e resumos reconciliados por categoria e fornecedor', async () => {
  const rows = [
    {id:1,fornecedor:'Loja *',valor:'100.25',numero_documento:'0001',cnpj_cpf:'001234',data_despesa:'2026-09-03',categoria:'ADS',categoria_principal:'Vendas',categoria_pai_id:1,subcategoria:'ADS'},
    {id:2,fornecedor:'Loja *',valor:'50.50',categoria:'Vendas'},
    {id:3,fornecedor:'Outra',valor:'10',categoria:'Geral'}
  ];
  const w = criarRelatorioDespesasMensal(rows,{data_inicio:'2026-09-01',data_fim:'2026-09-30'});
  assert.equal(w.worksheets.length,3);
  assert.equal(w.worksheets[0].getCell('C8').value,'0001');
  assert.equal(w.worksheets[0].getCell('F8').value,'001234');
  assert.match(w.worksheets[0].getCell('A1').value,/setembro de 2026/);
  assert.equal(w.getWorksheet('Soma por Categorias').getCell('C8').result,150.75);
  assert.equal(w.getWorksheet('Soma por Fornecedores').getCell('B8').result,2);
  assert.match(w.getWorksheet('Soma por Fornecedores').getCell('C8').formula,/SUBSTITUTE/);
  const roundTrip = new ExcelJS.Workbook();
  await roundTrip.xlsx.load(await w.xlsx.writeBuffer());
  assert.equal(roundTrip.getWorksheet('Soma por Fornecedores').getCell('C8').result,150.75);
  assert.equal(roundTrip.worksheets[0].getCell('H12').result,160.75);
});

test('relatório vazio produz as três abas com totais zerados', async () => {
  const w = criarRelatorioDespesasMensal([]);
  assert.equal(w.worksheets[0].getCell('H9').result,0);
  assert.equal(w.worksheets[1].getCell('C9').result,0);
  assert.ok((await w.xlsx.writeBuffer()).length > 0);
});

test('exportação inclui duas tabelas dinâmicas nativas vinculadas à fonte e preserva totais', async () => {
  const w = criarRelatorioDespesasMensal([{id:1,valor:10,fornecedor:'Teste',categoria:'Geral'}]);
  const zip = await JSZip.loadAsync(await exportarComDinamicas(w,1));
  for (const path of Object.keys(zip.files).filter(p => p.endsWith('.xml') || p.endsWith('.rels'))) {
    await parseStringPromise(await zip.file(path).async('string'));
  }
  const cache = await zip.file('xl/pivotCache/pivotCacheDefinition1.xml').async('string');
  assert.match(cache,/ref="A7:M8"/);
  assert.match(await zip.file('xl/workbook.xml').async('string'), /pivotCache cacheId="1"/);
  const workbookXml = await zip.file('xl/workbook.xml').async('string');
  assert.ok(workbookXml.indexOf('<calcPr') < workbookXml.indexOf('<pivotCaches'));
  for (const i of [2,3]) {
    assert.doesNotMatch(await zip.file(`xl/worksheets/sheet${i}.xml`).async('string'), /pivotTableParts/);
    assert.match(await zip.file(`xl/worksheets/_rels/sheet${i}.xml.rels`).async('string'), /relationships\/pivotTable/);
  }
  for (const i of [1,2]) assert.match(await zip.file(`xl/pivotTables/pivotTable${i}.xml`).async('string'), /subtotal="sum"/);
});
