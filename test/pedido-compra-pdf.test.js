const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PDFParse}=require('pdf-parse');
const {orderPdf}=require('../src/services/pedido-compra-pdf');
const {lineCents}=require('../src/services/reposicao');
test('pedido PDF repete cabeçalhos, preserva solicitação e inclui logo e totais sem páginas vazias',async()=>{
 const lines=Array.from({length:45},(_,i)=>({sku:'B'+i,code:'9788531117312',name:'Bíblia de estudo com descrição completa para compra',brand:'SBB',quantity:3,price:1.005,quotedQuantity:1,quotedPrice:99}));
 const buffer=await orderPdf({id:'1000',supplier:'Editora exemplo',createdAt:'2026-10-30T12:00:00Z',lines});
 assert.equal(buffer.subarray(0,5).toString(),'%PDF-');
 const parser=new PDFParse({data:buffer});
 try{const result=await parser.getText();assert.ok(result.total>1);for(const page of result.pages){assert.match(page.text,/PEDIDO DE COMPRA/);assert.match(page.text,/Fornecedor/);assert.match(page.text,/Página/)}assert.match(result.text,/135/);assert.match(result.text,/135,90/);assert.doesNotMatch(result.text,/99,00/);assert.match(result.text,/Favor realizar o orçamento/)}finally{await parser.destroy()}
});
test('arredondamento monetário considera custo de quatro casas e quantidade',()=>{assert.equal(lineCents({quantity:3,price:1.005}),302);assert.equal(lineCents({quantity:5,price:114.705}),57353)});
