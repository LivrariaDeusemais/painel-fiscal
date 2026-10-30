const {test}=require('node:test');
const assert=require('node:assert/strict');
const s=require('../src/services/reposicao');
function storage(){
 let global={version:0,dados:{overrides:{B1:{quantity:8}},suppliers:{Editora:{lead:7,coverage:40}},shipments:[{channel:'meli',status:'Pendente',rows:[{sku:'B1',quantity:3}]}],giro:{days:30,quantities:{B1:15}}}},analyses=[],orders=[{id:11,version:0,dados:{supplier:'Editora',status:'Rascunho',lines:[{sku:'B1',quantity:8,price:10}]}}],saved;
 const products=[{sku:'B1',nome:'Livro',marca:'Editora',custo:10,estoque_matriz:4,estoque_full:{'Mercado Livre':2,Shopee:0}}];
 const clone=v=>structuredClone(v),db={release(){},connect:async()=>db,async query(sql,args=[]){
  if(sql==='BEGIN'){saved=clone({global,analyses,orders});return {rows:[]}}
  if(sql==='COMMIT')return {rows:[]};
  if(sql==='ROLLBACK'){({global,analyses,orders}=saved);return {rows:[]}}
  if(sql.startsWith('SELECT version,dados FROM estoque_planejamento'))return {rows:[clone(global)]};
  if(sql==='SELECT dados FROM estoque_planejamento WHERE id=1')return {rows:[clone(global)]};
  if(sql.startsWith('SELECT sku,nome,marca,custo,ean'))return {rows:clone(products)};
  if(sql.startsWith('INSERT INTO estoque_analises')){const id=analyses.length+1;analyses.push({id,version:0,dados:JSON.parse(args[0]),criado_em:'2026-10-30T12:00:00Z'});return {rows:[{id}]}}
  if(sql.startsWith('UPDATE estoque_planejamento SET dados=$1')){global={version:global.version+1,dados:JSON.parse(args[0])};return {rows:[]}}
  if(sql.startsWith('UPDATE estoque_pedidos SET dados=jsonb_set')){for(const o of orders)if(!o.dados.analysisId){o.dados.analysisId=String(args[0]);o.version++}return {rows:[]}}
  if(sql.startsWith('SELECT id,version,dados,criado_em FROM estoque_pedidos'))return {rows:clone(orders)};
  if(sql.startsWith('SELECT id,version,dados,criado_em FROM estoque_analises WHERE'))return {rows:clone(analyses.filter(a=>String(a.id)===String(args[0])))};
  if(sql.startsWith('SELECT id,version,dados,criado_em FROM estoque_analises ORDER'))return {rows:clone([...analyses].reverse())};
  if(sql.startsWith('SELECT version,dados FROM estoque_analises'))return {rows:clone(analyses.filter(a=>String(a.id)===String(args[0])))};
  if(sql.startsWith('UPDATE estoque_analises SET dados=jsonb_set')){const a=analyses.find(a=>String(a.id)===String(args[0]));if(a.dados.status==='Em análise'&&['Pendente','Atualizando','Falha'].includes(a.dados.refresh?.status)){a.dados.products=JSON.parse(args[1]);a.dados.refresh=JSON.parse(args[2]);a.dados.ordersSnapshot=JSON.parse(args[3]);a.version++}return {rows:[]}}
  if(sql.startsWith('UPDATE estoque_analises SET dados=$1')){const a=analyses.find(a=>String(a.id)===String(args[1]));a.dados=JSON.parse(args[0]);a.version++;return {rows:[]}}
  return {rows:[]};
 }};return {db,products,orders};
}
test('migração conserva planejamento e pedidos, ocorre uma vez e nova análise começa limpa',async()=>{
 const {db}=storage();let history=await s.analyses(db);assert.equal(history.length,1);assert.equal(history[0].legacy,true);
 const old=await s.scope('1',()=>s.load(db));assert.equal(old.dados.overrides.B1.quantity,8);assert.equal(old.dados.giro.quantities.B1,15);assert.equal(old.dados.shipments[0].rows[0].quantity,3);assert.equal(old.orders[0].id,'11');assert.equal(old.orders[0].analysisId,'1');
 assert.equal((await s.analyses(db)).length,1);
 const id=await s.createAnalysis(db,1);assert.equal(id,'2');
 const fresh=await s.scope(id,()=>s.load(db));assert.deepEqual(fresh.dados.overrides,{});assert.equal(fresh.dados.giro,null);assert.deepEqual(fresh.dados.shipments,[]);assert.deepEqual(fresh.dados.imports,{});assert.equal(fresh.dados.suppliers.Editora.lead,7);assert.equal(fresh.products.length,0);
});
test('snapshot e quantidades de uma análise ficam isolados das próximas cargas e análises',async()=>{
 const {db,products}=storage();const id=await s.createAnalysis(db,1);
 await s.snapshot(db,id,{status:'Atualizado'});let model=await s.scope(id,()=>s.load(db));assert.equal(model.products[0].estoque_matriz,4);
 await s.scope(id,()=>s.mutate(db,model.version,async data=>{data.overrides.B1={quantity:12};data.giro={days:30,quantities:{B1:45}};data.imports.giro=true}));
 products[0].estoque_matriz=99;const next=await s.createAnalysis(db,1);await s.snapshot(db,next,{status:'Atualizado'});
 model=await s.scope(id,()=>s.load(db));const newer=await s.scope(next,()=>s.load(db));assert.equal(model.products[0].estoque_matriz,4);assert.equal(newer.products[0].estoque_matriz,99);assert.equal(s.derive(model)[0].quantity,12);assert.equal(s.derive(newer)[0].quantity,null);assert.equal(model.dados.giro.quantities.B1,45);assert.equal(newer.dados.giro,null);
 products[0].estoque_matriz=200;await s.snapshot(db,id,{status:'Atualizado'});assert.equal((await s.scope(id,()=>s.load(db))).products[0].estoque_matriz,4);
});
