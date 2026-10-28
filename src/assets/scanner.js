(() => {
 const $=id=>document.getElementById('scanner-'+id),dialog=$('dialog');if(!dialog)return;
 const geometry=window.ScannerImage,live=window.ScannerLive,tracker=live.createTracker(),canvas=$('canvas'),context=canvas.getContext('2d');
 let stream=null,source=null,points=[],pages=[],corner=0,dragging=false,busy=false,eventId=crypto.randomUUID(),cameraVersion=0,nativeCamera=false,padding=0,grabOffset={x:0,y:0},liveTimer=null,capturePending=false,editing=-1,selectedPage=-1,originalBlob=null,currentFingerprint=null;
 const status=message=>{$('status').textContent=message;};
 function cameraUI(active=false){$('start').hidden=active;$('gallery-label').hidden=active;$('shutter').hidden=!active;}
 function step(name){$('camera').hidden=name!=='camera';$('editor').hidden=name!=='editor';$('review').hidden=name!=='review';$('success').hidden=name!=='success';$('page').hidden=name!=='page';$('title').textContent=name==='success'?'Documento enviado':'Escanear documento';dialog.scrollTop=0;}
 function stop(){cameraVersion++;if(liveTimer!==null)clearTimeout(liveTimer);liveTimer=null;tracker.reset();$('live-outline').hidden=true;stream?.getTracks().forEach(track=>track.stop());stream=null;$('video').srcObject=null;$('video').hidden=true;cameraUI(false);}
 function reset(){stop();pages.forEach(p=>URL.revokeObjectURL(p.url));pages=[];source=null;editing=-1;selectedPage=-1;originalBlob=null;currentFingerprint=null;eventId=crypto.randomUUID();$('name').value='';$('pages').replaceChildren();step('camera');status('Abra a câmera ou escolha uma foto do documento.');}
 function close(){if(busy)return;if((pages.length||source)&&!confirm('Descartar o documento ainda não enviado?'))return;reset();dialog.close();}
 document.getElementById('scan-app').addEventListener('click',()=>dialog.showModal());
 $('close').onclick=close;$('back').onclick=close;
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 window.addEventListener('pagehide',stop);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 window.addEventListener('beforeunload',event=>{if(pages.length||source){event.preventDefault();event.returnValue='';}});
 async function openCamera(){
  if(busy)return;step('camera');
  if(nativeCamera){$('file').click();return;}
  stop();const version=cameraVersion;
  status('Permita o acesso à câmera. Posicione o documento inteiro no enquadramento.');
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Câmera não disponível neste navegador.');
   const opened=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:2560},height:{ideal:1920}},audio:false});
   if(!dialog.open||version!==cameraVersion){opened.getTracks().forEach(t=>t.stop());return;}
   stream=opened;$('video').srcObject=stream;$('video').hidden=false;await $('video').play();cameraUI(true);status('Aponte para o documento. A captura será automática quando estiver estável; Escanear também permite capturar manualmente.');startLive(version);
  }catch{stop();nativeCamera=true;if(dialog.open)status('Não foi possível abrir a câmera ao vivo. Toque em Abrir câmera para usar a captura do celular, ou escolha uma foto.');}
 }
 $('start').onclick=openCamera;
 $('replace').onclick=()=>{source=null;originalBlob=null;openCamera();};
 const makeCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 function startLive(version){
  const sample=makeCanvas(1,1),ctx=sample.getContext('2d',{willReadFrequently:true}),overlay=$('live-outline'),drawOverlay=overlay.getContext('2d');
  function tick(){
   liveTimer=null;if(version!==cameraVersion||!stream||document.hidden||!dialog.open||busy||capturePending)return;
   const video=$('video'),began=Date.now();
   if(video.readyState>=2&&video.videoWidth&&video.videoHeight){
    try{
     const ratio=320/Math.max(video.videoWidth,video.videoHeight);sample.width=Math.round(video.videoWidth*ratio);sample.height=Math.round(video.videoHeight*ratio);ctx.drawImage(video,0,0,sample.width,sample.height);
     const pixels=ctx.getImageData(0,0,sample.width,sample.height),detection=geometry.detect(pixels.data,sample.width,sample.height,true),quality=live.quality(pixels.data,sample.width,sample.height,detection.points);
     const frame={...detection,...quality,w:sample.width,h:sample.height,fingerprint:live.signature(pixels.data,sample.width,sample.height,detection.points)};
     const action=tracker.update(frame,began,pages.at(-1)?.fingerprint);
     overlay.width=sample.width;overlay.height=sample.height;overlay.hidden=false;drawOverlay.clearRect(0,0,overlay.width,overlay.height);
     if(['edges','region'].includes(frame.method)){
      drawOverlay.fillStyle=action==='steady'||action==='capture'?'#00b85a30':'#ffab3225';drawOverlay.strokeStyle=action==='steady'||action==='capture'?'#00b85a':'#ffab32';drawOverlay.lineWidth=2;drawOverlay.beginPath();frame.points.forEach((p,i)=>i?drawOverlay.lineTo(p.x,p.y):drawOverlay.moveTo(p.x,p.y));drawOverlay.closePath();drawOverlay.fill();drawOverlay.stroke();
     }
     const messages={align:'Enquadre o documento inteiro, deixando uma pequena margem ao redor.',light:'Melhore a iluminação para escanear automaticamente.',focus:'Aguarde o foco ou aproxime o documento. Escanear permite capturar manualmente.',duplicate:'Esta página já foi capturada. Posicione a próxima ou use Escanear para repetir.',steady:'Documento identificado. Mantenha o celular parado…',capture:'Capturando documento…'};
     status(messages[action]);
     if(action==='capture'){void load(video,frame);return;}
    }catch{tracker.reset();overlay.hidden=true;status('Use Escanear para capturar manualmente este documento.');}
   }
   if(version===cameraVersion&&stream)liveTimer=setTimeout(tick,Math.max(100,650-(Date.now()-began)));
  }
  liveTimer=setTimeout(tick,100);
 }
 async function load(image,liveFrame=null){
  if(busy||capturePending)return;
  if(editing<0&&pages.length>=20){status('Limite de 20 páginas por documento. Envie este PDF antes de continuar.');return;}
  const width=image.videoWidth||image.naturalWidth||image.width,height=image.videoHeight||image.naturalHeight||image.height;
  if(!width||!height){status('A câmera ainda está preparando a imagem. Tente novamente.');return;}
  capturePending=true;
  try{
   const scale=Math.min(1,2000/Math.max(width,height));source=makeCanvas(Math.round(width*scale),Math.round(height*scale));source.getContext('2d').drawImage(image,0,0,source.width,source.height);originalBlob=null;
   stop();
   if(liveFrame){points=liveFrame.points.map(p=>({x:p.x/(liveFrame.w-1)*(source.width-1),y:p.y/(liveFrame.h-1)*(source.height-1)}));currentFingerprint=liveFrame.fingerprint;}
   else autoCorners();
   await savePage();
  }catch(e){step('editor');status(e.message);draw();}finally{capturePending=false;}
 }
 function autoCorners(){const ratio=Math.min(1,320/source.width,320/source.height),small=makeCanvas(Math.round(source.width*ratio),Math.round(source.height*ratio)),ctx=small.getContext('2d');ctx.drawImage(source,0,0,small.width,small.height);const pixels=ctx.getImageData(0,0,small.width,small.height);points=geometry.detect(pixels.data,small.width,small.height).map(p=>({x:p.x/(small.width-1)*(source.width-1),y:p.y/(small.height-1)*(source.height-1)}));currentFingerprint=live.signature(pixels.data,small.width,small.height,points.map(p=>({x:p.x/(source.width-1)*(small.width-1),y:p.y/(source.height-1)*(small.height-1)})));corner=0;}
 $('shutter').onclick=()=>{void load($('video'));};
 for(const id of ['file','gallery'])$(id).onchange=async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  if(file.size>25*1024*1024){status('Foto muito grande. Escolha uma imagem de até 25 MB.');return;}
  const url=URL.createObjectURL(file);try{const image=new Image();image.src=url;await image.decode();if(dialog.open)await load(image);}catch{status('Não foi possível ler essa imagem. Fotografe novamente ou escolha JPEG/PNG.');}finally{URL.revokeObjectURL(url);}
 };
 function draw(){
  if(!source)return;
  padding=Math.round(Math.max(source.width,source.height)*.09);canvas.width=source.width+padding*2;canvas.height=source.height+padding*2;
  context.fillStyle='#dce8e1';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(source,padding,padding);
  const scale=canvas.width/(canvas.getBoundingClientRect().width||320);context.strokeStyle='#ffab32';context.lineWidth=3*scale;context.beginPath();points.forEach((p,i)=>i?context.lineTo(p.x+padding,p.y+padding):context.moveTo(p.x+padding,p.y+padding));context.closePath();context.stroke();
  points.forEach((p,i)=>{context.beginPath();context.arc(p.x+padding,p.y+padding,11*scale,0,Math.PI*2);context.fillStyle=dragging&&i===corner?'#ffab32':'#fff';context.fill();context.strokeStyle='#07543d';context.stroke();});
  if(dragging){const p=points[corner],size=72*scale,r=40*scale,x=canvas.width-r-8*scale,y=r+8*scale;context.save();context.beginPath();context.arc(x,y,r,0,Math.PI*2);context.clip();context.fillStyle='#fff';context.fillRect(x-r,y-r,r*2,r*2);context.drawImage(source,Math.max(0,p.x-size/2),Math.max(0,p.y-size/2),size,size,x-r,y-r,r*2,r*2);context.strokeStyle='#ffab32';context.lineWidth=2*scale;context.beginPath();context.moveTo(x-8*scale,y);context.lineTo(x+8*scale,y);context.moveTo(x,y-8*scale);context.lineTo(x,y+8*scale);context.stroke();context.restore();}
 }
 const position=event=>{const rect=canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)*canvas.width/rect.width-padding,y:(event.clientY-rect.top)*canvas.height/rect.height-padding};};
 canvas.onpointerdown=event=>{if(!source||busy)return;const p=position(event);corner=points.map(q=>geometry.distance(p,q)).reduce((best,d,i,ds)=>d<ds[best]?i:best,0);const scale=canvas.width/canvas.getBoundingClientRect().width;if(geometry.distance(p,points[corner])>32*scale)return;grabOffset={x:points[corner].x-p.x,y:points[corner].y-p.y};dragging=true;canvas.setPointerCapture(event.pointerId);draw();};
 canvas.onpointermove=event=>{if(dragging){const p=position(event);points[corner]={x:Math.max(0,Math.min(source.width-1,p.x+grabOffset.x)),y:Math.max(0,Math.min(source.height-1,p.y+grabOffset.y))};draw();}};
 canvas.onpointerup=canvas.onpointercancel=()=>{dragging=false;draw();};
 $('full').onclick=()=>{if(source&&!busy){points=geometry.full(source.width,source.height);$('add').click();}};
 $('rotate').onclick=()=>{if(!source)return;const rotated=makeCanvas(source.height,source.width),ctx=rotated.getContext('2d');ctx.translate(rotated.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(source,0,0);const turned=points.map(p=>({x:source.height-1-p.y,y:p.x}));points=[turned[3],turned[0],turned[1],turned[2]];source=rotated;originalBlob=null;draw();};
 function lock(value){busy=value;dialog.querySelectorAll('button,input').forEach(el=>{if(value){el.dataset.scannerDisabled=String(el.disabled);el.disabled=true;}else if(el.dataset.scannerDisabled!=null){el.disabled=el.dataset.scannerDisabled==='true';delete el.dataset.scannerDisabled;}});}
 async function savePage(){
  if(!source||busy)return;if(!geometry.valid(points,source.width,source.height))throw Error('Os cantos precisam formar um documento sem cruzamentos. Ajuste os quatro pontos.');
  if(editing<0&&pages.length>=20){status('Limite de 20 páginas por documento.');return;}
  lock(true);status('Corrigindo perspectiva e preparando a página…');
  try{
   await new Promise(r=>requestAnimationFrame(r));
   const w=Math.max(1,Math.round(Math.max(geometry.distance(points[0],points[1]),geometry.distance(points[3],points[2])))),h=Math.max(1,Math.round(Math.max(geometry.distance(points[0],points[3]),geometry.distance(points[1],points[2]))));
   const scale=Math.min(1,2000/Math.max(w,h)),out=makeCanvas(Math.round(w*scale),Math.round(h*scale)),ctx=out.getContext('2d'),pixels=source.getContext('2d').getImageData(0,0,source.width,source.height),result=ctx.createImageData(out.width,out.height),map=geometry.project(points),enhance=true;
   for(let y=0;y<out.height;y++){
    for(let x=0;x<out.width;x++){const p=map(x/Math.max(1,out.width-1),y/Math.max(1,out.height-1)),px=Math.max(0,Math.min(source.width-1,p.x)),py=Math.max(0,Math.min(source.height-1,p.y)),ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy,offset=(y*out.width+x)*4;
     for(let c=0;c<3;c++){const at=(xx,yy)=>pixels.data[(Math.min(source.height-1,yy)*source.width+Math.min(source.width-1,xx))*4+c];const v=at(ix,iy)*(1-fx)*(1-fy)+at(ix+1,iy)*fx*(1-fy)+at(ix,iy+1)*(1-fx)*fy+at(ix+1,iy+1)*fx*fy;result.data[offset+c]=enhance?Math.max(0,Math.min(255,(v-128)*1.12+138)):v;}result.data[offset+3]=255;
    }
    if(y%200===0)await new Promise(r=>setTimeout(r,0));
   }
   ctx.putImageData(result,0,0);const blob=await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(Error('Não foi possível preparar a página.')),'image/jpeg',.9));
   if(pages.reduce((n,p,i)=>i===editing?n:n+p.blob.size,blob.size)>20*1024*1024)throw Error('O documento ultrapassou 20 MB. Envie menos páginas por PDF.');
   const original=originalBlob||await new Promise((resolve,reject)=>source.toBlob(b=>b?resolve(b):reject(Error('Não foi possível guardar a foto original.')),'image/jpeg',.94));
   if(pages.reduce((n,p,i)=>i===editing?n:n+p.original.size+p.blob.size,original.size+blob.size)>40*1024*1024)throw Error('O documento ocupa muita memória. Salve este PDF antes de continuar.');
   const page={blob,url:URL.createObjectURL(blob),original,width:source.width,height:source.height,points:points.map(p=>({...p})),fingerprint:currentFingerprint};
   if(editing>=0){URL.revokeObjectURL(pages[editing].url);pages[editing]=page;}else pages.push(page);editing=-1;originalBlob=null;source=null;renderPages();step('review');status('Página adicionada. Use + Adicionar página ou informe o nome e toque em Salvar e enviar.');
  }catch(e){step('editor');status(e.message);draw();}finally{lock(false);}
 }
 $('add').onclick=()=>{void savePage().catch(e=>status(e.message));};
 function renderPages(){
  $('review').hidden=!pages.length;$('count').textContent=String(pages.length);$('pages').replaceChildren();
  pages.forEach((page,index)=>{const card=document.createElement('article'),image=document.createElement('img');image.src=page.url;image.alt='Página '+(index+1)+' — toque para ampliar e ajustar';image.tabIndex=0;image.setAttribute('role','button');image.onclick=()=>showPage(index);image.onkeydown=e=>{if(e.key==='Enter')showPage(index);};card.append(image);const label=document.createElement('p');label.textContent='Página '+(index+1);card.append(label);const controls=document.createElement('div');controls.className='scanner-toolbar';
   for(const [text,title,action,disabled] of [['↑','Mover página para antes',()=>{[pages[index-1],pages[index]]=[pages[index],pages[index-1]];renderPages();},index===0],['↓','Mover página para depois',()=>{[pages[index+1],pages[index]]=[pages[index],pages[index+1]];renderPages();},index===pages.length-1],['+ Adicionar página','Adicionar outra página ao documento',()=>{editing=-1;selectedPage=-1;source=null;originalBlob=null;openCamera();},pages.length>=20],['Excluir','Excluir página',()=>{URL.revokeObjectURL(page.url);pages.splice(index,1);renderPages();if(!pages.length){step('camera');status('Nenhuma página no documento. Abra a câmera ou escolha uma foto.');}},false]]){const button=document.createElement('button');button.type='button';button.textContent=text;button.setAttribute('aria-label',title);button.disabled=disabled;button.onclick=action;controls.append(button);}card.append(controls);$('pages').append(card);
  });
 }
 function showPage(index){
  if(busy||capturePending||!pages[index])return;selectedPage=index;step('page');$('page-title').textContent='Página '+(index+1);$('page-image').src=pages[index].url;status('Confira a página ou ajuste o recorte usando a foto original.');
 }
 async function editPage(){
  if(busy||!pages[selectedPage])return;editing=selectedPage;const page=pages[editing],url=URL.createObjectURL(page.original);lock(true);
  try{const image=new Image();image.src=url;await image.decode();source=makeCanvas(page.width,page.height);source.getContext('2d').drawImage(image,0,0,source.width,source.height);originalBlob=page.original;points=page.points.map(p=>({...p}));currentFingerprint=page.fingerprint;step('editor');draw();status('Ajuste os cantos e toque em Continuar para atualizar esta página.');}
  catch{status('Não foi possível abrir a foto original. Tente novamente.');editing=-1;}finally{URL.revokeObjectURL(url);lock(false);}
 }
 $('page-adjust').onclick=editPage;
 $('page-rotate').onclick=async()=>{await editPage();if(source){$('rotate').click();$('add').click();}};
 $('page-replace').onclick=()=>{if(!busy&&pages[selectedPage]){editing=selectedPage;originalBlob=null;source=null;openCamera();}};
 $('page-delete').onclick=()=>{if(busy||!pages[selectedPage])return;URL.revokeObjectURL(pages[selectedPage].url);pages.splice(selectedPage,1);selectedPage=-1;editing=-1;renderPages();step(pages.length?'review':'camera');status(pages.length?'Página excluída.':'Abra a câmera ou escolha uma foto.');};
 $('page-back').onclick=()=>{selectedPage=-1;renderPages();step('review');status('Informe o nome e toque em Salvar e enviar.');};
 $('send').onclick=async()=>{
  if(busy||!pages.length)return;
  if(source){status('Adicione ou descarte a página em edição antes de enviar.');return;}
  const name=$('name').value.trim().replace(/\.pdf$/i,'');if(!name){status('Informe o nome do documento.');$('name').focus();return;}
  if(!navigator.onLine){status('Sem internet. As páginas continuam aqui; reconecte e envie novamente.');return;}
  const body=new FormData();body.append('nome',name);body.append('envio',eventId);pages.forEach((p,i)=>body.append('paginas',p.blob,'pagina-'+(i+1)+'.jpg'));
  lock(true);stop();status('Enviando PDF para Arquivos…');
  try{const response=await fetch('/arquivo/escanear',{method:'POST',headers:{'X-Scanner-CSRF':dialog.dataset.csrf},body});const data=await response.json().catch(()=>({error:'Não foi possível confirmar o envio. Verifique a conexão e sua sessão; as páginas foram preservadas.'}));if(!response.ok||!data.ok)throw Error(data.error||'Falha no envio.');reset();step('success');$('result').textContent=data.name+(data.message.includes('pendente')?' — '+data.message:'');status('');$('success-title').focus();}
  catch(e){status(e.message||'Envio não confirmado. Tente novamente; não será criada uma cópia duplicada.');}finally{lock(false);renderPages();}
 };
 $('again').onclick=reset;
})();
