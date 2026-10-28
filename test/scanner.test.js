const test=require('node:test'),assert=require('node:assert/strict');
const service=require('../src/scanner');
const jpeg=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCACMAGQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP//Z','base64');
const geometry=require('../src/assets/scanner-image');
test('scanner exige liberação explícita e acesso ao envio de Arquivos',()=>{
 assert.equal(service.canScan({perfil:'ADMIN'}),true);
 assert.equal(service.canScan({perfil:'USUARIO',functionAccess:{arquivo:{view:true,edit:true}}}),false);
 assert.equal(service.canScan({perfil:'USUARIO',functionAccess:{scanner:{view:true,edit:true},arquivo:{view:true,edit:true}}}),true);
 assert.equal(service.canScan({perfil:'USUARIO',functionAccess:{scanner:{view:true,edit:true},arquivo:{view:true,download:true}}}),false);
 const {capability,actionFor}=require('../src/access/catalog');assert.equal(capability('/arquivo/escanear').id,'scanner');assert.equal(actionFor({originalUrl:'/arquivo/escanear',method:'POST'}),'edit');
});
test('nome seguro e PDF multipágina real, sem copiar texto do documento como instrução',async()=>{
 assert.equal(service.filename('../Comprovante: frete.pdf'),'..Comprovante frete.pdf');
 assert.throws(()=>service.filename(' / '));
 assert.equal(service.jpegSize(jpeg).w,100);
 const pdf=await service.buildPdf([{buffer:jpeg},{buffer:jpeg}]);
 assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length,2);
 await assert.rejects(service.buildPdf([]),/páginas/);await assert.rejects(service.buildPdf([{buffer:Buffer.from('falso JPEG')}]),/JPEG/);
});
test('correção de perspectiva mapeia quatro cantos e rejeita recorte cruzado',()=>{
 const points=[{x:10,y:5},{x:90,y:15},{x:80,y:130},{x:5,y:110}];assert.equal(geometry.valid(points,100,140),true);
 const map=geometry.project(points);for(const [u,v,i] of [[0,0,0],[1,0,1],[1,1,2],[0,1,3]]){const p=map(u,v);assert.ok(Math.abs(p.x-points[i].x)<1e-6);assert.ok(Math.abs(p.y-points[i].y)<1e-6);}
 assert.equal(geometry.valid([points[0],points[2],points[1],points[3]],100,140),false);
});
test('detecção sugere bordas em fundo contrastante e mantém imagem inteira sem contraste',()=>{
 const w=100,h=140,data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,v=x>=15&&x<=85&&y>=20&&y<=120?240:25;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;}
 const corners=geometry.detect(data,w,h);for(const [i,p] of [{x:15,y:20},{x:85,y:20},{x:85,y:120},{x:15,y:120}].entries()){assert.ok(Math.abs(corners[i].x-p.x)<=2);assert.ok(Math.abs(corners[i].y-p.y)<=2);}
 data.fill(255);assert.deepEqual(geometry.detect(data,w,h),geometry.full(w,h));
});
test('botão e escâner aparecem somente com autorização; mantém calculadora no mesmo documento',()=>{
 const app=require('../src/tabela-precos/calculator-app');assert.doesNotMatch(app.render('<form>Dados</form>'),/id="scan-app"/);
 const html=app.render('<form>Dados preservados</form>',{scanner:true,csrf:'abc'});assert.match(html,/id="scan-app"/);assert.match(html,/id="scanner-dialog" data-csrf="abc"/);assert.match(html,/Dados preservados/);assert.match(html,/capture="environment"/);
});
test('HTTP exige sessão, permissão e CSRF; envio vai à fila e repetição não duplica',async()=>{
 const express=require('express'),fs=require('fs/promises'),os=require('os'),path=require('path');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'plennatec-scanner-'));let inserted=0,analyzed=0,existing=null;const events=[];
 const db={query:async(sql,args)=>{events.push({sql,args});if(sql.startsWith('SELECT id,metadados'))return {rows:existing?[existing]:[]};if(sql.startsWith('INSERT INTO')){inserted++;existing={id:7,metadados:JSON.parse(args[5])};return {rows:[existing]};}return {rows:[]};},release(){}};
 const app=express();app.use((req,res,next)=>{req.session=req.get('X-Test-User')==='admin'?{usuario:{id:1,perfil:'ADMIN'},scannerCsrf:'abc'}:req.get('X-Test-User')==='user'?{usuario:{id:2,perfil:'USUARIO'},scannerCsrf:'abc'}:{};next();});
 app.use(service.createRouter({pool:{connect:async()=>db},uploadsDir:dir,ensureTable:async()=>{},analyze:async()=>{analyzed++;}}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const url='http://127.0.0.1:'+server.address().port+'/arquivo/escanear';
 try{
  assert.equal((await fetch(url,{method:'POST'})).status,401);
  assert.equal((await fetch(url,{method:'POST',headers:{'X-Test-User':'user','X-Scanner-CSRF':'abc'}})).status,403);
  assert.equal((await fetch(url,{method:'POST',headers:{'X-Test-User':'admin'}})).status,403);
  const send=()=>{const body=new FormData();body.append('nome','Comprovante frete');body.append('envio','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');body.append('paginas',new Blob([jpeg],{type:'image/jpeg'}),'pagina.jpg');return fetch(url,{method:'POST',headers:{'X-Test-User':'admin','X-Scanner-CSRF':'abc'},body});};
  const result=await (await send()).json();assert.equal(result.ok,true);assert.equal(result.name,'Comprovante frete.pdf');assert.equal(analyzed,1);
  assert.equal((await (await send()).json()).ok,true);assert.equal(inserted,1);assert.equal((await fs.readdir(dir)).length,1);
  const record=events.find(e=>e.sql.startsWith('INSERT INTO'));assert.equal(record.args[0],'Comprovante frete.pdf');assert.match(record.sql,/'DISPONIVEL','APP_SCANNER'/);
 }finally{await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});}
});
test('fluxo simplificado mostra comandos por etapa e confirmação final solicitada',()=>{
 const html=require('../src/scanner/view').dialog('csrf');
 assert.match(html,/>Escanear<\/button>/);assert.match(html,/>Usar Foto<\/button>/);assert.match(html,/>\+ Substituir foto<\/button>/);
 assert.match(html,/>Salvar e enviar<\/button>/);assert.match(html,/Documento enviado com Sucesso para Plennatec! 👍/);
 assert.match(html,/>Escanear novo documento<\/button>/);assert.match(html,/>Voltar Calculadora<\/button>/);
 assert.doesNotMatch(html,/scanner-corners|data-move|scanner-enhance|Câmera do celular|Fotografar|Escanear outro documento/);
});
test('papel cinza em fundo claro mantém o texto completo dentro do contorno automático',()=>{
 const w=180,h=260,data=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=220+x/15;if(x>=40&&x<=140&&y>=20&&y<=240)v=185+y/30;if(x>=48&&x<=132&&y>=30&&y<=230&&y%12<2)v=40;const i=(y*w+x)*4;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;}
 const corners=geometry.detect(data,w,h);assert.ok(geometry.valid(corners,w,h));
 assert.ok(corners[0].x<48&&corners[0].y<30);assert.ok(corners[2].x>132&&corners[2].y>230);
 assert.ok(corners[0].x>5&&corners[2].x<w-5);
});
test('câmera ativa mostra somente Escanear e restaura opções ao interromper',async()=>{
 const vm=require('node:vm'),fs=require('node:fs'),elements=new Map(),handlers={};let stopped=0;
 const el=id=>{if(!elements.has(id))elements.set(id,{hidden:false,open:true,dataset:{},textContent:'',value:'',getContext:()=>({}),addEventListener(){},querySelectorAll:()=>[],play:async()=>{},getTracks:()=>[],focus(){},replaceChildren(){},close(){this.open=false;}});return elements.get(id);};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/assets/scanner'),'utf8'),{document:{getElementById:el,addEventListener:(name,fn)=>handlers[name]=fn},window:{ScannerImage:geometry,addEventListener(){}},crypto:{randomUUID:()=> 'test'},navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){stopped++;}}]})}},confirm:()=>true});
 await el('scanner-start').onclick();assert.equal(el('scanner-start').hidden,true);assert.equal(el('scanner-gallery-label').hidden,true);assert.equal(el('scanner-shutter').hidden,false);assert.match(el('scanner-status').textContent,/toque em Escanear/);
 el('scanner-close').onclick();assert.equal(stopped,1);assert.equal(el('scanner-shutter').hidden,true);assert.equal(el('scanner-start').hidden,false);
});
