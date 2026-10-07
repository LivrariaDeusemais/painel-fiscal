const {test}=require('node:test');
const assert=require('node:assert/strict');
const {productRows,updateProductStatuses}=require('../src/tabela-precos/service');
test('Novo custo filtra a contagem e preserva os saldos Full por canal',async()=>{
 const calls=[];const pool={async query(sql,args){calls.push({sql,args});return sql.includes('COUNT(*)')?{rows:[{total:3}]}:{rows:[{sku:'B1514',status_validacao:'Novo custo',estoque_full:{'Mercado Livre':7,Shopee:4},peso:1,custo:20}]};}};
 const result=await productRows(pool,{status:'Novo custo'});
 assert.equal(result.total,3);assert.equal(result.rows[0].estoque_full.Shopee,4);
 for(const call of calls){assert.match(call.sql,/status_validacao = \$1/);assert.equal(call.args[0],'Novo custo');}
});
test('Novo custo pode ser aplicado aos produtos selecionados',async()=>{
 let params;const pool={async query(sql,args){params=args;return {rowCount:2,rows:[]};}};
 await updateProductStatuses(pool,['B1514','B1607'],'Novo custo');
 assert.deepEqual(params,[['B1514','B1607'],'Novo custo']);
 await assert.rejects(updateProductStatuses(pool,['B1514'],'Inválido'),/Status inválido/);
});
test('Novo custo aparece na revisão de cada marketplace sem alterar a regra Reajustar',()=>{
 const {marketplaceReviewStatus,priceReviewStatus}=require('../src/tabela-precos/service');
 const item={row:{status_validacao:'Novo custo'},result:{status:'OK'},published:{details:{margin:0.2,netProfit:20}},rule:{minMargin:0.1,minProfit:4}};
 assert.equal(marketplaceReviewStatus(item),'Novo custo');
 assert.equal(priceReviewStatus('Novo custo','OK',20),'Novo custo');
 item.row.status_validacao='Validado';assert.equal(marketplaceReviewStatus(item),'Manter preço');
 item.published.details.margin=0.01;assert.equal(marketplaceReviewStatus(item),'Reajustar');
});
