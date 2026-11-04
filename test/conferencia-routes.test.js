const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {createRouter}=require('../src/conferencia/routes');
test('HTTP: consulta, período incompleto, revisão CSRF e permissão independente de download',async t=>{
 const doc={id:'123',tipo:'dre',inicio:'2026-07-01',fim:'2026-09-30',nome:'DRE.pdf',criado_em:new Date(),dados:{lines:[{code:'1',label:'RECEITA BRUTA',value:30000}]}};
 let inserted;const pool={async query(sql,args){if(sql.startsWith('INSERT INTO conferencia_documentos'))inserted=args;if(sql.includes('SELECT id,tipo'))return {rows:[doc]};if(sql.includes('SELECT mes,dados'))return {rows:['07','08','09'].map(m=>({mes:'2026-'+m,dados:{revenue:10000,deductions:0,cmv:5000}}))};return {rows:[]};}};
 let user={id:1,perfil:'ADMIN'};const session={};const app=express();app.use(express.urlencoded({extended:true}));app.use((req,res,next)=>{session.usuario=user;req.session=session;next();});app.use(createRouter({pool,protect:(req,res,next)=>next(),renderShell:(req,opts,body)=>body}));
 const server=app.listen(0,'127.0.0.1');await new Promise((ok,no)=>{server.once('listening',ok);server.once('error',no);});t.after(()=>server.close());const base='http://127.0.0.1:'+server.address().port;
 const a=await fetch(base+'/contabil/conferencia?year=2026&quarter=3');const html=await a.text();assert.equal(a.status,200);assert.match(html,/300,00/);assert.match(html,/RECEITA BRUTA/);
 const PDF=require('pdfkit');const pdf=new PDF();const chunks=[];pdf.on('data',x=>chunks.push(x));const done=new Promise(ok=>pdf.on('end',ok));pdf.text('C.N.P.J.: 18.862.388/0001-03');pdf.text('Período: 01/07/2026 - 30/09/2026');pdf.text('DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO');pdf.text('RECEITA BRUTA 300,00');pdf.end();await done;
 const form=new FormData();form.set('token',session.conferenciaToken);form.set('document',new Blob([Buffer.concat(chunks)],{type:'application/pdf'}),'dre.pdf');const imported=await fetch(base+'/contabil/conferencia/importar',{method:'POST',body:form,redirect:'manual'});assert.equal(imported.status,302);assert.equal(inserted[1],'dre');assert.equal(inserted[7].lines[0].value,30000);
 const b=await fetch(base+'/contabil/conferencia?year=2026&mode=mensal&month=8');assert.match(await b.text(),/não são repartidos/);
 const post=await fetch(base+'/contabil/conferencia/revisar',{method:'POST',body:new URLSearchParams({key:'a'.repeat(64),status:'Conferido'})});assert.equal(post.status,403);
 user={id:2,perfil:'CONTADOR',functionAccess:{'conferencia-contabil':{view:true}}};assert.equal((await fetch(base+'/contabil/conferencia?year=2026&quarter=3')).status,200);assert.equal((await fetch(base+'/contabil/conferencia/relatorio?year=2026&quarter=3')).status,403);
 user={id:3,perfil:'USUARIO',functionAccess:{'conferencia-contabil':{view:true,edit:true,download:true}}};assert.equal((await fetch(base+'/contabil/conferencia')).status,403);
});
