const test=require('node:test'),assert=require('node:assert/strict');const express=require('express'),fs=require('fs'),os=require('os'),path=require('path'),ExcelJS=require('exceljs');
const {createRouter}=require('../src/fechamento/routes');const s=require('../src/fechamento/service');
test('HTTP: importar relatório, corrigir, fechar, consultar como contador, baixar e preservar auditoria',async t=>{
 const months=new Map(),files=new Map(),events=[],queries=[];
 const pool={async query(q,a=[]){queries.push(q);if(q.startsWith('SELECT * FROM fechamentos_mensais WHERE mes=$1'))return {rows:months.has(a[0])?[months.get(a[0])]:[]};
 if(q.startsWith('INSERT INTO fechamentos_mensais')){const prev=months.get(a[0]),r={mes:a[0],status:a[1],versao:(prev?.versao||0)+1,dados:JSON.parse(a[2]),atualizado_por:a[3],atualizado_em:new Date()};months.set(a[0],r);return {rows:[r]};}
 if(q.startsWith('INSERT INTO fechamento_arquivos')){files.set(a[0],{id:a[0],mes:a[1],tipo:a[2],nome_original:a[3],nome_arquivo:a[4],sha256:a[5],extraido:JSON.parse(a[6]),usuario:a[7],criado_em:new Date()});}
 if(q.startsWith('INSERT INTO fechamento_eventos'))events.push({mes:a[0],acao:a[1],usuario:a[2],dados:JSON.parse(a[3]),criado_em:new Date()});
 if(q.startsWith('SELECT * FROM fechamento_arquivos WHERE id=$1'))return {rows:[...files.values()].filter(f=>f.id===a[0]&&(!a[1]||f.mes===a[1])&&(!a[2]||f.tipo===a[2]))};
 if(q.startsWith('SELECT * FROM fechamento_arquivos WHERE mes'))return {rows:[...files.values()].filter(f=>f.mes===a[0])};
 if(q.startsWith('SELECT acao,usuario'))return {rows:events.filter(e=>e.mes===a[0]).toReversed()};
 if(q.startsWith('SELECT * FROM fechamentos_mensais WHERE mes LIKE'))return {rows:[...months.values()].filter(r=>r.mes.startsWith(a[0].slice(0,4))&&(!q.includes("status='fechado'")||r.status==='fechado'))};
 if(q.includes('SUM(valor)'))return {rows:[{total:'100.00'}]};
 return {rows:[]};},async connect(){return {query:pool.query,release(){}};}};
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'fx-routes-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const session={usuario:{id:1,nome:'Operador',perfil:'ADMIN'}};
 const app=express();app.use(express.json());app.use((req,res,next)=>{req.session=req.headers['x-no-session']?{}:session;next();});app.use(createRouter({pool,uploadsDir:directory,renderShell:(_req,_cfg,html)=>html,protect:(req,res,next)=>req.session.usuario?next():res.redirect('/login')}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 const get=(url,init)=>fetch(base+url,init);
 assert.equal((await get('/contabil/fechamento',{headers:{'x-no-session':'1'},redirect:'manual'})).status,302);
 const page=await get('/contabil/fechamento?mes=2026-01');assert.equal(page.status,200);assert.ok(session.fechamentoToken);
 const b=new ExcelJS.Workbook(),ws=b.addWorksheet('Estoque');ws.addRow(['Código','Produto','Un','Quantidade','Valor unitário','Valor total']);ws.addRow(['L1','Livro','Pç',2,15,30]);ws.addRow(['Totais (1 item)','','',2,'',30]);const buffer=await b.xlsx.writeBuffer();
 const fd=()=>{const f=new FormData();f.set('month','2026-01');f.set('confirmed','true');f.set('completeDre','true');f.set('matriz',new Blob([buffer]),'estoque.xlsx');return f;};
 assert.equal((await get('/contabil/fechamento/importar',{method:'POST',body:fd()})).status,403);
 const headers={'x-fechamento-token':session.fechamentoToken};const imported=await get('/contabil/fechamento/importar',{method:'POST',headers,body:fd()});assert.equal(imported.status,200);const f=(await imported.json()).files[0];assert.equal(f.extracted.value,3000);assert.equal(months.size,0,'importar não fecha nem substitui dados salvos');
 const data={...s.blank(),revenue:100000,deductions:10000,cmv:30000,expenses:20000,notes:'Conferido',publishers:[{name:'Editora',value:30000}]};data.stocks.matriz={quantity:2,value:2800};
 const body={month:'2026-01',data,sourceFiles:{matriz:f.id},status:'fechado',version:0,reason:'Ajuste conforme conferência'};
 const post=body=>get('/contabil/fechamento/salvar',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const saved=await post(body);assert.equal(saved.status,200);assert.equal(months.get('2026-01').dados.stocks.matriz.value,2800);assert.equal(months.get('2026-01').dados.sourceNotes.matriz.value,3000);assert.equal((await post(body)).status,409);
 session.usuario={id:2,nome:'Contadora',perfil:'CONTADOR'};
 assert.equal((await post({...body,version:1})).status,403);
 const read=await get('/contabil/fechamento?mes=2026-01');assert.equal(read.status,200);assert.match(await read.text(),/<fieldset disabled>/);
 assert.equal((await get('/contabil/fechamento/arquivo/'+f.id)).status,200);
 await get('/contabil/fechamento?mes=2026-01');assert.ok(events.some(e=>e.acao==='download original'&&e.usuario.includes('Contadora')));
 const exported=await get('/contabil/fechamento/exportar?ano=2026');assert.equal(exported.status,200);const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await exported.arrayBuffer());assert.deepEqual(workbook.worksheets.map(w=>w.name),['Fechamentos','Editoras','Estoques']);assert.equal(workbook.worksheets[0].getRow(2).getCell(5).value,900);assert.equal(workbook.worksheets[0].views[0].ySplit,1);assert.ok(!workbook.worksheets[0].views[0].xSplit);
 session.usuario.perfil='ADMIN';await post({...body,status:'rascunho',version:1});session.usuario.perfil='CONTADOR';assert.equal((await get('/contabil/fechamento/arquivo/'+f.id)).status,403);assert.doesNotMatch(await (await get('/contabil/historico?ano=2026')).text(),/Ajuste conforme/);
 assert.equal((await get('/administracao')).status,403);assert.ok(queries.some(q=>q.includes('pg_advisory_xact_lock')));
});
