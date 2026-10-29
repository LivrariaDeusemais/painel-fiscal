const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('crypto');
const fs=require('fs/promises');
const os=require('os');
const path=require('path');
const JSZip=require('jszip');
const unzipper=require('unzipper');
const service=require('../src/integracoes/shopee-nfe');
const transport=require('../src/integracoes/shopee-nfe-client');
const page=require('../src/integracoes/shopee-nfe-page');
const access=require('../src/access/catalog');
const env={SHOPEE_PARTNER_ID:'123',SHOPEE_PARTNER_KEY:'test-key',SHOPEE_TOKEN_ENCRYPTION_KEY:'x'.repeat(32),APP_BASE_URL:'https://app.example.com'};
const prefix='3526101886238800010355005000003650167119621';
let sum=0,w=2;for(let i=42;i>=0;i--){sum+=Number(prefix[i])*w;w=w===9?2:w+1;}const dv=11-sum%11;
const key=prefix+(dv>=10?0:dv);
function xml(type='0',change='') {return Buffer.from(`<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${key}"><ide><mod>55</mod><serie>5</serie><nNF>3650</nNF><tpNF>${type}</tpNF><tpAmb>1</tpAmb><dhEmi>2026-10-15T08:13:44-03:00</dhEmi><natOp>Retorno simbolico ${change}</natOp></ide><emit><CNPJ>18862388000103</CNPJ></emit><total><ICMSTot><vNF>103.40</vNF></ICMSTot></total></infNFe><Signature><SignatureValue>fixture</SignatureValue></Signature></NFe><protNFe><infProt><chNFe>${key}</chNFe><tpAmb>1</tpAmb><cStat>100</cStat></infProt></protNFe></nfeProc>`);}

test('competência de outubro consulta somente até hoje em São Paulo e fecha meses anteriores',()=>{
  assert.deepEqual(service.period('2026-10',new Date('2026-10-29T12:00:00Z')),{month:'2026-10',start:20261001,end:20261029});
  assert.equal(service.period('2026-09',new Date('2026-10-29T12:00:00Z')).end,20260930);
  assert.throws(()=>service.period('2026-11',new Date('2026-10-29T12:00:00Z')),/futuro/);
  assert.throws(()=>service.period('2026-99'),/válida/);
});
test('autenticação assina caminho e loja, cifra tokens e preserva estado no redirect',()=>{
  const c=transport.config(env),s=transport.sign(c,'/api/v2/order/download_fbs_invoices',1,'token','9');
  assert.equal(s,crypto.createHmac('sha256','test-key').update('123/api/v2/order/download_fbs_invoices1token9').digest('hex'));
  const encrypted=transport.seal('secret',c);assert.notEqual(encrypted,'secret');assert.equal(transport.unseal(encrypted,c),'secret');
  assert.throws(()=>transport.unseal(encrypted,transport.config({...env,SHOPEE_TOKEN_ENCRYPTION_KEY:'z'.repeat(32)})));
  const u=new URL(transport.authUrl(c,'state',1000));assert.equal(new URL(u.searchParams.get('redirect')).searchParams.get('state'),'state');assert.equal(u.hostname,'partner.shopeemobile.com');
  assert.throws(()=>transport.numericId('9999999999999999999'),/inválido/);
});
test('cliente fiscal só permite endpoints de autorização e download; erros não expõem segredos',async()=>{
  let request;
  const c=new transport.Client(transport.config(env),async(url,init)=>{request={url,init};return new Response(JSON.stringify({result_list:[{request_id:42}]}));});
  assert.deepEqual(await c.call('/api/v2/order/generate_fbs_invoices',{batch_download:{}},'access','9'),{result_list:[{request_id:42}]});
  assert.equal(new URL(request.url).searchParams.get('shop_id'),'9');assert.equal(request.init.redirect,'error');
  await assert.rejects(c.call('/api/v2/order/cancel_order',{}),/não permitida/);
  c.fetcher=async()=>new Response(JSON.stringify({error:'error_permission',message:'access_token=secret'}));
  await assert.rejects(c.call('/api/v2/order/generate_fbs_invoices',{}),e=>e.message.includes('error_permission')&&!e.message.includes('secret'));
});
test('NF de retorno usa emitente próprio e tpNF; exclui outras séries, períodos e protocolos inválidos',async()=>{
  const note=await service.parseXml(xml(),'2026-10');assert.equal(note.type,'entrada');assert.equal(note.key,key);assert.equal(note.value,'103.40');
  assert.equal((await service.parseXml(xml('1'),'2026-10')).type,'saida');
  assert.match((await service.parseXml(Buffer.from(xml().toString().replace('<serie>5','<serie>1')),'2026-10')).ignored,/Série/);
  assert.match((await service.parseXml(xml(),'2026-09')).ignored,/competência/);
  await assert.rejects(service.parseXml(Buffer.from(xml().toString().replace('<cStat>100','<cStat>101')),'2026-10'),/cancelamento/);
  await assert.rejects(service.parseXml(Buffer.from('<!DOCTYPE test>'+xml()),'2026-10'),/não permitida/);
  await assert.rejects(service.parseXml(Buffer.from(xml().toString().replace(`<chNFe>${key}`,`<chNFe>${'1'.repeat(44)}`)),'2026-10'),/não conferem/);
});
test('ZIP preserva bytes XML e limita nomes e conteúdos indevidos',async()=>{
  const zip=new JSZip();zip.file('folder/nfe.xml',xml());zip.file('extra.pdf','pdf');
  const files=[];await service.collect(await zip.generateAsync({type:'nodebuffer'}),async(name,b)=>files.push([name,b]));
  assert.deepEqual(files[0][1],xml());assert.equal(files[1][1],null);
  const bad=new JSZip();bad.file('../nfe.xml',xml());
  await assert.rejects(service.collect(await bad.generateAsync({type:'nodebuffer'}),()=>{}),/Caminho inválido/);
  await assert.rejects(service.parseXml(Buffer.alloc(5*1024*1024+1),'2026-10'),/5 MB/);
});

function memoryPool() {
  const db={job:{id:crypto.randomUUID(),shop_id:'9',competencia:'2026-10',status:'executando',tarefas:[],diagnostico:[],resumo:{}},docs:[],links:new Set(),query:async function(sql,args=[]) {
    if(sql.includes('pg_try_advisory_lock'))return {rows:[{locked:true}]};
    if(sql.startsWith('SELECT * FROM shopee_nfe_cargas'))return {rows:[this.job]};
    if(sql.startsWith('SELECT * FROM shopee_nfe_documentos'))return {rows:this.docs.filter(d=>d.shop_id===args[0]&&d.chave===args[1])};
    if(sql.startsWith('INSERT INTO shopee_nfe_documentos')){const [id,shop_id,chave,hash,numero,emissao,tipo,natureza,valor]=args;this.docs.push({id,shop_id,chave,hash,numero,emissao,tipo,natureza,valor});}
    if(sql.startsWith('INSERT INTO shopee_nfe_carga_documentos')){const k=args.join(':');if(this.links.has(k))return {rows:[]};this.links.add(k);return {rows:[{documento:args[1]}]};}
    if(sql.includes('SET tarefas=$2,diagnostico'))Object.assign(this.job,{tarefas:JSON.parse(args[1]),diagnostico:JSON.parse(args[2]),resumo:JSON.parse(args[3])});
    else if(sql.includes('SET tarefas=$2'))this.job.tarefas=JSON.parse(args[1]);
    if(sql.includes("SET status='falhou'"))Object.assign(this.job,{status:'falhou',etapa:args[1]});
    if(sql.includes('SET status=$2,etapa=$3'))Object.assign(this.job,{status:args[1],etapa:args[2]});
    if(sql.includes('SELECT COUNT(*) AS n'))return {rows:[{n:this.links.size}]};
    return {rows:[]};
  },release(){},async connect(){return this;}};return db;
}
test('arquiva original, deduplica pela chave e não sobrescreve XML diferente',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'shopee-nfe-')),pool=memoryPool();
  try {
    const b=xml(),meta=await service.parseXml(b,'2026-10');
    assert.equal(await service.saveDocument(pool,pool.job,meta,b,root),'novo');
    assert.equal(await service.saveDocument(pool,pool.job,meta,b,root),'repetido');
    assert.equal(pool.docs.length,1);assert.equal(pool.links.size,1);
    assert.deepEqual(await service.xmlFor(pool.docs[0],root),b);
    const changed=xml('0','alterado');await assert.rejects(service.saveDocument(pool,pool.job,await service.parseXml(changed,'2026-10'),changed,root),/conteúdo diferente/);
    assert.deepEqual(await service.xmlFor(pool.docs[0],root),b);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('workflow gera lote fiscal, aguarda READY, separa válidos e deixa falha de XML visível',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'shopee-flow-')),pool=memoryPool(),calls=[];let polls=0;
  const zip=new JSZip();zip.file('a.xml',xml());zip.file('duplicado.xml',xml());zip.file('invalido.xml','<bad/>');
  const fake={call:async(endpoint,body)=>{
    calls.push({endpoint,body});
    if(endpoint.endsWith('generate_fbs_invoices'))return {result_list:[{request_id:42}]};
    if(endpoint.endsWith('get_fbs_invoices_result'))return {result_list:[{request_id:42,status:++polls===1?'PROCESSING':'READY'}]};
    return {response:{request_id:42,file_link:'https://down-br.img.susercontent.com/a.zip'}};
  }};
  try {
    await service.run(pool,pool.job.id,{directory:root,client:fake,accessToken:async()=>({token:'test',shop:'9'}),wait:async()=>{},download:async()=>zip.generateAsync({type:'nodebuffer'})});
    assert.equal(pool.job.status,'parcial');assert.equal(pool.docs.length,1);assert.equal(pool.job.resumo.novo,1);assert.equal(pool.job.resumo.repetido,1);assert.equal(pool.job.resumo.pendente,1);
    assert.equal(calls[0].body.batch_download.document_type,7);assert.equal(calls[0].body.batch_download.file_type,1);assert.equal(calls[0].body.batch_download.document_status,1);
    assert.deepEqual(calls[1].body,{request_id_list:{request_id:[42]}});
    assert.equal(calls.some(c=>c.endpoint.includes('bling')),false);
    assert.equal(pool.job.tarefas[0].done,true);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('retoma ID persistido sem gerar nova tarefa e falha explicitamente se Shopee negar o lote',async()=>{
  const pool=memoryPool();pool.job.tarefas=[{id:42,done:false}];
  await service.run(pool,pool.job.id,{client:{call:async(endpoint)=>{assert.ok(!endpoint.includes('generate_fbs'));throw new Error('Shopee recusou a consulta (error_permission).');}},accessToken:async()=>({token:'t',shop:'9'})});
  assert.equal(pool.job.status,'falhou');assert.match(pool.job.etapa,/error_permission/);assert.equal(pool.job.tarefas[0].id,42);
});
test('download não segue host estranho ou redirect privado, nem envia credenciais',async()=>{
  assert.throws(()=>transport.downloadUrl('http://down-br.img.susercontent.com/a.zip'),/não autorizado/);
  assert.throws(()=>transport.downloadUrl('https://localhost/x'),/não autorizado/);
  let init;
  const b=await transport.download('https://down-br.img.susercontent.com/a.zip',async(u,i)=>{init=i;return new Response('xml');});assert.equal(b.toString(),'xml');assert.equal(init.headers,undefined);
  await assert.rejects(transport.download('https://down-br.img.susercontent.com/a.zip',async()=>new Response(null,{status:302,headers:{location:'https://127.0.0.1/private'}})),/não autorizado/);
});
test('permissões novas são explícitas; ver não baixa, gerenciar não baixa e callback exige editar',()=>{
  const u={perfil:'USUARIO',functionAccess:{'shopee-nfe':{view:true,edit:true,download:false}}};
  assert.equal(access.capability('/integracoes/shopee-nfe/download/id/entrada').id,'shopee-nfe');
  assert.equal(access.actionFor({method:'GET',path:'/integracoes/shopee-nfe/download/id/entrada'}),'download');
  assert.equal(access.actionFor({method:'GET',path:'/integracoes/shopee-nfe/callback'}),'edit');
  assert.equal(page.allowed(u,'edit'),true);assert.equal(page.allowed(u,'download'),false);
  assert.equal(page.allowed({perfil:'USUARIO'}),false);
  assert.equal(page.allowed({perfil:'USUARIO',functionAccess:{'shopee-nfe':{view:false,download:true}}},'download'),false);
  const ui=require('../src/services/ui-executivo');
  assert.equal(ui.visible({perfil:'USUARIO'}).flatMap(a=>a.pages).some(p=>p[1]==='/integracoes/shopee-nfe'),false);
  assert.equal(ui.visible({perfil:'ADMIN'}).flatMap(a=>a.pages).some(p=>p[1]==='/integracoes/shopee-nfe'),true);
});

test('rotas HTTP bloqueiam sem sessão, sem download, sem Ver e sem CSRF; retorno inválido não autoriza loja',async t=>{
  const express=require('express'),pool=memoryPool(),session={};
  const query=pool.query.bind(pool);pool.query=async(sql,args)=>{
    if(sql.startsWith('SELECT shop_id,atualizado_em'))return {rows:[]};
    if(sql.startsWith('SELECT * FROM shopee_nfe_cargas ORDER BY'))return {rows:[]};
    return query(sql,args);
  };
  const app=express();app.use(express.urlencoded({extended:false}));app.use((req,res,next)=>{req.session=session;next();});
  app.use(transport.ROOT,page.createRouter(pool,(_req,body)=>body));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port+transport.ROOT;
  let r=await fetch(base,{redirect:'manual'});assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/login');
  session.usuario={id:3,perfil:'USUARIO'};assert.equal((await fetch(base)).status,403);
  session.usuario.functionAccess={'shopee-nfe':{view:true,edit:false,download:false}};
  r=await fetch(base);assert.equal(r.status,200);const html=await r.text();assert.match(html,/Shopee Full/);assert.ok(!html.includes('/buscar"'));assert.ok(!html.includes('type="password"'));
  assert.equal((await fetch(base+'/download/'+pool.job.id+'/entrada')).status,403);
  assert.equal((await fetch(base+'/buscar',{method:'POST',body:new URLSearchParams({mes:'2026-10',csrf:session.shopeeNfeCsrf})})).status,403);
  session.usuario.functionAccess['shopee-nfe'].edit=true;
  assert.equal((await fetch(base+'/buscar',{method:'POST',body:new URLSearchParams({mes:'2026-10'})})).status,403);
  assert.equal((await fetch(base+'/callback?code=x&shop_id=9')).status,403);
  session.usuario={id:1,perfil:'ADMIN'};
  assert.equal((await fetch(base+'/callback?code=x&shop_id=9')).status,403);
  session.shopeeNfeAuth={state:'a'.repeat(64),at:Date.now(),user:'1'};
  assert.equal((await fetch(base+'/callback?state='+encodeURIComponent('é'.repeat(64))+'&code=x&shop_id=9')).status,403);
});

test('pacote HTTP preserva XML, informa consulta parcial e não exporta arquivo adulterado ou carga ativa',async t=>{
  const express=require('express'),pool=memoryPool(),root=await fs.mkdtemp(path.join(os.tmpdir(),'shopee-package-'));
  const originalEnv=process.env.UPLOADS_DIR;process.env.UPLOADS_DIR=root;
  t.after(async()=>{if(originalEnv===undefined)delete process.env.UPLOADS_DIR;else process.env.UPLOADS_DIR=originalEnv;await fs.rm(root,{recursive:true,force:true});});
  await service.saveDocument(pool,pool.job,await service.parseXml(xml(),'2026-10'),xml());pool.job.status='parcial';pool.job.etapa='1 XML; 1 pendência.';
  const query=pool.query.bind(pool);pool.query=async(sql,args)=>sql.startsWith('SELECT d.*')?{rows:pool.docs}:query(sql,args);
  const app=express();app.use((req,res,next)=>{req.session={usuario:{id:1,perfil:'USUARIO',functionAccess:{'shopee-nfe':{view:true,edit:false,download:true}}}};next();});
  app.use(transport.ROOT,page.createRouter(pool,(_r,body)=>body));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url='http://127.0.0.1:'+server.address().port+transport.ROOT+'/download/'+pool.job.id+'/entrada';
  let response=await fetch(url);assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/entrada.zip/);
  const z=await unzipper.Open.buffer(Buffer.from(await response.arrayBuffer()));
  assert.deepEqual(await z.files.find(f=>f.path.endsWith('-nfe.xml')).buffer(),xml());
  assert.match((await z.files.find(f=>f.path==='LEIA-ME.txt').buffer()).toString(),/parcial/);
  const d=pool.docs[0];await fs.writeFile(path.join(root,'.shopee-nfe',d.chave+'-'+d.hash+'.xml'),'alterado');
  assert.equal((await fetch(url)).status,503);
  pool.job.status='executando';assert.equal((await fetch(url)).status,409);
});
