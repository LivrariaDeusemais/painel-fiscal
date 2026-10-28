const test=require('node:test');
const assert=require('node:assert/strict');
const ExcelJS=require('exceljs');
const {HEADERS,buildWorkbook}=require('../src/tabela-precos/mercado-livre-bling');
const item=(id='MLB123',type)=>({row:{marketplace:'Mercado Livre',id_loja:id,sku:'001A',nome:'Título do anúncio',produto_nome:'Cadastro',dados:{listing_type_id:type}},result:{status:'OK',grossPrice:123.456789}});
test('XLSX usa exatamente as seis colunas do modelo Bling, tipos e modalidades reais',async()=>{
 let calls=0;const w=await buildWorkbook([item(),item('MLB456','gold_pro')],async()=>{calls++;return {listing_type_id:'gold_special'};});
 const saved=new ExcelJS.Workbook();await saved.xlsx.load(await w.xlsx.writeBuffer());const s=saved.getWorksheet('ag-grid');
 assert.deepEqual(s.getRow(1).values.slice(1),HEADERS);assert.equal(s.columnCount,6);assert.equal(s.rowCount,3);
 assert.deepEqual(s.getRow(2).values.slice(1),['Título do anúncio','Mercado Livre','MLB123','001A',123.4568,'Clássico']);
 assert.equal(s.getCell('F3').value,'Premium');assert.equal(calls,1);
});
test('não inventa modalidade nem exporta identificação ou preço inválidos',async()=>{
 await assert.rejects(buildWorkbook([item()],async()=>({listing_type_id:'free'})),/Modalidade/);
 await assert.rejects(buildWorkbook([item('123')],async()=>({})),/Revise/);
 const bad=item();bad.result.grossPrice=0;await assert.rejects(buildWorkbook([bad],async()=>({})),/Revise/);
});
