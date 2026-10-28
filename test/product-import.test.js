const {test}=require('node:test');
const assert=require('node:assert/strict');
const {importProducts}=require('../src/tabela-precos/service');
function database(initial,{fail=false}={}){
 const rows=new Map(initial.map(p=>[p.sku,{...p}]));let snapshot,released=false;
 const client={async query(sql,args){
  if(sql==='BEGIN'){snapshot=structuredClone(rows);return {rows:[]};}
  if(sql==='ROLLBACK'){rows.clear();for(const [k,v] of snapshot)rows.set(k,v);return {rows:[]};}
  if(sql==='COMMIT')return {rows:[]};
  if(sql.includes('SELECT COUNT(*)'))return {rows:[{total:args[0].filter(sku=>rows.has(sku)).length}]};
  if(sql.includes('INSERT INTO tabela_preco_produtos')){
   if(fail)throw Error('Falha de gravação');
   for(const product of JSON.parse(args[0]))rows.set(product.sku,{...rows.get(product.sku),...product});
   return {rows:[]};
  }
  // Reproduz a exclusão antiga para detectar regressão pelo resultado final.
  if(sql.includes('DELETE FROM tabela_preco_produtos')){
   for(const sku of rows.keys())if(!args[0].includes(sku))rows.delete(sku);
   return {rows:[]};
  }
  throw Error('Consulta inesperada: '+sql);
 },release(){released=true;}};
 return {rows,pool:{connect:async()=>client},released:()=>released};
}
test('planilha parcial atualiza SKU existente, inclui novo e preserva os ausentes',async()=>{
 const untouched={sku:'B1000',cost:10,weight:.5,status:'Validado',name:'Preservar'};
 const db=database([untouched,{sku:'B1001',cost:20,weight:1}]);
 const result=await importProducts(db.pool,[{sku:'B1001',cost:25,weight:1.2},{sku:'B1002',cost:30,weight:2}]);
 assert.deepEqual(db.rows.get('B1000'),untouched);assert.equal(db.rows.size,3);
 assert.equal(db.rows.get('B1001').cost,25);assert.equal(db.rows.get('B1002').weight,2);
 assert.deepEqual(result,{imported:2,newProducts:1});assert.equal(db.released(),true);
});
test('planilha vazia não apaga a base',async()=>{
 const db=database([{sku:'B1000',cost:10}]);
 assert.deepEqual(await importProducts(db.pool,[]),{imported:0,newProducts:0});assert.equal(db.rows.size,1);
});
test('falha na importação preserva a base e libera a conexão',async()=>{
 const db=database([{sku:'B1000',cost:10}],{fail:true});
 await assert.rejects(importProducts(db.pool,[{sku:'B1000',cost:25}]),/Falha de gravação/);
 assert.equal(db.rows.get('B1000').cost,10);assert.equal(db.released(),true);
});
