const {test}=require('node:test');
const assert=require('node:assert/strict');
const {productRows,updateProductStatuses}=require('../src/tabela-precos/service');
test('Reajustar filtra a contagem e preserva os saldos Full por canal',async()=>{
 const calls=[];const pool={async query(sql,args){calls.push({sql,args});return sql.includes('COUNT(*)')?{rows:[{total:3}]}:{rows:[{sku:'B1514',status_validacao:'Reajustar',estoque_full:{'Mercado Livre':7,Shopee:4},peso:1,custo:20}]};}};
 const result=await productRows(pool,{status:'Reajustar'});
 assert.equal(result.total,3);assert.equal(result.rows[0].estoque_full.Shopee,4);
 for(const call of calls){assert.match(call.sql,/status_validacao = \$1/);assert.equal(call.args[0],'Reajustar');}
});
test('Reajustar pode ser aplicado aos produtos selecionados',async()=>{
 let params;const pool={async query(sql,args){params=args;return {rowCount:2,rows:[]};}};
 await updateProductStatuses(pool,['B1514','B1607'],'Reajustar');
 assert.deepEqual(params,[['B1514','B1607'],'Reajustar']);
 await assert.rejects(updateProductStatuses(pool,['B1514'],'Inválido'),/Status inválido/);
});
