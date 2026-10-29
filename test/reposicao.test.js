const {test}=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const s=require('../src/services/reposicao'),{capability,actionFor}=require('../src/access/catalog'),{printOrder}=require('../src/views/reposicao');
test('reposição cobre prazo + estoque sem duplicar reserva Full e desconta compras confirmadas',()=>{
 const base={giro:30,periodDays:30,coverage:30,lead:5,matrix:5,meli:10,shopee:5,pending:0,full:8};
 assert.equal(s.suggestion(base),15);assert.equal(s.suggestion({...base,pending:10}),5);
 assert.equal(s.suggestion({...base,full:50}),45);assert.equal(s.suggestion({...base,matrix:null}),null);
 assert.equal(s.suggestion({...base,giro:null}),null);assert.equal(s.suggestion({...base,giro:0}),3);
});
test('quantidade e preço orçados são independentes e custo fica congelado',()=>{
 const l={sku:'B1',quantity:10,price:12,referenceCost:10};
 assert.deepEqual([s.compare(l,{quantity:8,price:11}).quantityStatus,s.compare(l,{quantity:8,price:11}).priceStatus],['Orçou parcial','Aumentou preço']);
 assert.equal(s.compare(l).quantityStatus,'NT');assert.equal(s.compare(l).quotedPrice,null);
 assert.equal(s.compare(l,{quantity:11,price:9}).quantityStatus,'Orçou a mais');
 assert.equal(s.compare(l,{quantity:10,price:10}).priceStatus,'Manteve preço');assert.equal(l.referenceCost,10);
 assert.equal(s.total([{quantity:3,price:13.255},{quantity:2,price:10}]),59.77);
});
test('datas reais, zero manual e quantidades inválidas',()=>{
 assert.equal(s.period('2026-10-01','2026-10-30').days,30);
 assert.throws(()=>s.period('2026-02-30','2026-03-03'));assert.throws(()=>s.period('2026-10-30','2026-10-01'));
 for(const n of [-1,1.5,'',NaN,Infinity,null])assert.throws(()=>s.quantity(n));assert.equal(s.quantity(0),0);
});
test('EAN ambíguo exige escolha e mappings não aceitam SKU inexistente',()=>{
 const base=[{sku:'B1',ean:'123'},{sku:'B2',ean:'123'},{sku:'B3',codigo_fornecedor:'F3'}];
 assert.deepEqual(s.resolveRows([{sku:'alias',ean:'123'}],base).unknown,[0]);
 assert.equal(s.resolveRows([{sku:'alias',ean:'123'}],base,{0:'B2'}).rows[0].sku,'B2');
 assert.deepEqual(s.resolveRows([{sku:'B1'}],base,{0:'OUTRO'}).unknown,[0]);
 assert.equal(s.resolveRows([{code:'F3'}],base).rows[0].sku,'B3');
});
test('histórico de pedidos não multiplica por anúncios e só confirmado entra a receber',()=>{
 const m={dados:{overrides:{B1:{quantity:0}},suppliers:{},giro:{days:30,quantities:{B1:30}},shipments:[{channel:'meli',status:'Pendente',rows:[{sku:'B1',quantity:4}]}]},products:[{sku:'B1',nome:'Teste',marca:'Editora',custo:'10',estoque_matriz:'5',estoque_full:{'Mercado Livre':2,Shopee:3}}],orders:[{status:'Rascunho',lines:[{sku:'B1',quantity:100}]},{status:'Confirmado',lines:[{sku:'B1',quantity:10,quotedQuantity:8,received:2}]}]};
 const r=s.derive(m)[0];assert.equal(r.pending,6);assert.equal(r.quantity,0);assert.equal(r.suggested,19);assert.equal(r.afterFull,1);
});
test('nova capacidade e impressão exigem autorização própria de download',()=>{
 assert.equal(capability('/compras/reposicao/pedidos/1/relatorio').id,s.ID);
 assert.equal(actionFor({method:'GET',path:'/compras/reposicao/pedidos/1/relatorio'}),'download');
 assert.equal(actionFor({method:'GET',path:'/compras/reposicao/exportar'}),'download');
 const html=printOrder({id:'1',supplier:'<script>',status:'Rascunho',createdAt:'2026-10-29',terms:{lead:5},lines:[{sku:'B1',code:'F1',ean:'123',name:'Livro',quantity:2,price:10}]},null);
 assert.match(html,/Deus é Mais/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/R\$\s*20,00/);
});
function fakePool(){let state={version:0,dados:{overrides:{},suppliers:{},shipments:[],giro:null}},orders=[],saved,next=1;const products=['B1','B2'].map((sku,i)=>({sku,nome:'Livro '+i,marca:'Editora',custo:10,ean:'123'+i,estoque_matriz:0,estoque_full:{'Mercado Livre':0,Shopee:0}}));const db={release(){},connect:async()=>db,async query(sql,args=[]){
 if(sql==='BEGIN'){saved=structuredClone({state,orders,next});return {rows:[]}}if(sql==='ROLLBACK'){({state,orders,next}=saved);return {rows:[]}}if(sql==='COMMIT')return {rows:[]};
 if(sql.startsWith('SELECT version,dados FROM estoque_planejamento'))return {rows:[structuredClone(state)]};
 if(sql.startsWith('SELECT sku,nome,marca,custo,ean'))return {rows:products};
 if(sql.startsWith('SELECT id,version,dados,criado_em FROM estoque_pedidos'))return {rows:structuredClone(orders)};
 if(sql.startsWith('UPDATE estoque_planejamento')){state.dados=JSON.parse(args[0]);state.version++;return {rows:[]}}
 if(sql.startsWith('INSERT INTO estoque_pedidos(')){const id=next++;orders.push({id,version:0,dados:JSON.parse(args[0])});return {rows:[{id}]}}
 if(sql.startsWith('SELECT version,dados FROM estoque_pedidos'))return {rows:structuredClone(orders.filter(o=>String(o.id)===String(args[0])))};
 if(sql.startsWith('UPDATE estoque_pedidos SET dados')){const o=orders.find(o=>String(o.id)===String(args[0]));o.dados=JSON.parse(args[1]);o.version++;return {rows:[]}}
 return {rows:[]};}};return db}
test('rotas: acesso, CSRF, versão concorrente, geração, recebimento e impressão',async()=>{
 const pool=fakePool(),session={usuario:{id:1,perfil:'ADMIN'},reposicaoToken:'token'},app=express();app.use(express.json());app.use((req,res,next)=>{req.session=session;next()});app.use('/compras/reposicao',require('../src/routes/reposicao').createRouter({pool,protect:(req,res,next)=>next(),renderShell:(req,opts,body)=>body}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url='http://127.0.0.1:'+server.address().port+'/compras/reposicao';const post=(path,body,token='token')=>fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json','x-reposicao-token':token},body:JSON.stringify(body)});
 try{
  assert.equal((await post('/salvar',{rows:[],version:0},'wrong')).status,403);
  assert.equal((await post('/salvar',{rows:[{sku:'B1',quantity:10,price:10,supplier:'Editora'}],version:0})).status,200);
  assert.equal((await post('/salvar',{rows:[],version:0})).status,400);
  assert.equal((await post('/pedidos',{skus:['B1'],version:1})).status,200);
  let m=await (await fetch(url+'/dados')).json();assert.equal(m.orders.length,1);assert.equal(m.rows[0].quantity,null);
  assert.equal((await post('/pedidos/1',{action:'receber',version:2,orderVersion:0,received:{B1:10}})).status,400);
  assert.equal((await post('/pedidos/1',{action:'confirmar',version:2,orderVersion:0})).status,200);
  m=await (await fetch(url+'/dados')).json();assert.equal(m.rows[0].pending,10);
  assert.equal((await post('/pedidos/1',{action:'receber',version:3,orderVersion:1,received:{B1:11}})).status,400);
  assert.equal((await post('/pedidos/1',{action:'receber',version:3,orderVersion:1,received:{B1:5}})).status,200);
  m=await (await fetch(url+'/dados')).json();assert.equal(m.rows[0].pending,5);
  session.usuario={perfil:'USUARIO',functionAccess:{[s.ID]:{view:true,edit:true,download:false}}};
  assert.equal((await fetch(url+'/pedidos/1/relatorio')).status,403);
  session.usuario.functionAccess[s.ID].download=true;assert.equal((await fetch(url+'/pedidos/1/relatorio')).status,200);
  session.usuario={perfil:'USUARIO'};assert.equal((await fetch(url+'/dados')).status,403);
 }finally{await new Promise(r=>server.close(r))}
});
test('importações aplicam em transação, consolidam giro, deduplicam Full e marcam orçamento ausente NT',async()=>{
 const pool=fakePool(),session={usuario:{id:1,perfil:'ADMIN'},reposicaoToken:'t'},app=express();app.use(express.json());app.use((req,res,next)=>{req.session=session;next()});app.use('/compras/reposicao',require('../src/routes/reposicao').createRouter({pool,protect:(req,res,next)=>next(),renderShell:()=>''}));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url='http://127.0.0.1:'+server.address().port+'/compras/reposicao',get=async()=>await (await fetch(url+'/dados')).json(),post=(p,b)=>fetch(url+p,{method:'POST',headers:{'Content-Type':'application/json','x-reposicao-token':'t'},body:JSON.stringify(b)});
 async function stage(kind,rows,extra={}){const m=await get();const st={kind,rows,hash:'hash-'+kind,filename:kind+'.xls',version:m.version,created:Date.now(),...extra};session.reposicaoPreview=st;return {token:s.hash(Buffer.from(st.hash+st.created)),confirm:true}}
 try{
  let body=await stage('giro',[{sku:'B1',quantity:249},{sku:'B1',quantity:73},{sku:'B1',quantity:6}],{period:s.period('2026-10-01','2026-10-30')});assert.equal((await post('/aplicar',body)).status,200);assert.equal((await get()).rows[0].giro,328);
  body=await stage('giro',[{sku:'NAOEXISTE',quantity:99}],{period:s.period('2026-10-01','2026-10-30')});assert.equal((await post('/aplicar',body)).status,400);assert.equal((await get()).rows[0].giro,328);
  body=await stage('meli',[{sku:'B1',quantity:10}],{shipment:'123',total:10});assert.equal((await post('/aplicar',body)).status,200);assert.equal((await get()).rows[0].fullMeli,10);
  body=await stage('meli',[{sku:'B1',quantity:10}],{shipment:'123',total:10});assert.equal((await post('/aplicar',body)).status,400);assert.equal((await get()).rows[0].fullMeli,10);
  let m=await get();assert.equal((await post('/salvar',{version:m.version,rows:['B1','B2'].map(sku=>({sku,quantity:10,price:10,supplier:'Editora'}))})).status,200);m=await get();assert.equal((await post('/pedidos',{version:m.version,skus:['B1','B2']})).status,200);
  m=await get();body=await stage('orcamento',[{sku:'B1',quantity:8,price:11}],{order:'1',orderVersion:m.orders[0].version});assert.equal((await post('/aplicar',body)).status,200);m=await get();const lines=m.orders[0].lines;assert.equal(lines[0].referenceCost,10);assert.equal(lines[0].price,10);assert.equal(lines[0].quotedPrice,11);assert.equal(lines[0].quantityStatus,'Orçou parcial');assert.equal(lines[1].quantityStatus,'NT');assert.equal(lines[1].quotedQuantity,0);
  assert.equal((await post('/pedidos/1',{version:m.version,orderVersion:m.orders[0].version,action:'confirmar'})).status,200);m=await get();assert.equal(m.rows[0].pending,8);assert.equal(m.rows[1].pending,0);
 }finally{await new Promise(r=>server.close(r))}
});
