(() => {
 const $=id=>document.getElementById('scanner-'+id),dialog=$('dialog');if(!dialog)return;
 const geometry=window.ScannerImage,canvas=$('canvas'),context=canvas.getContext('2d');
 let stream=null,source=null,points=[],pages=[],corner=0,dragging=false,busy=false,eventId=crypto.randomUUID(),cameraVersion=0;
 const status=message=>{$('status').textContent=message;};
 function stop(){cameraVersion++;stream?.getTracks().forEach(track=>track.stop());stream=null;$('video').srcObject=null;$('video').hidden=true;$('shutter').hidden=true;}
 function reset(){stop();pages.forEach(p=>URL.revokeObjectURL(p.url));pages=[];source=null;eventId=crypto.randomUUID();$('name').value='';$('pages').replaceChildren();$('editor').hidden=true;$('review').hidden=true;$('success').hidden=true;$('camera').hidden=false;status('Fotografe uma página por vez, com boa iluminação.');}
 function close(){if(busy)return;if((pages.length||source)&&!confirm('Descartar o documento ainda não enviado?'))return;reset();dialog.close();}
 document.getElementById('scan-app').addEventListener('click',()=>dialog.showModal());
 $('close').onclick=close;$('back').onclick=close;
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 window.addEventListener('pagehide',stop);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 window.addEventListener('beforeunload',event=>{if(pages.length||source){event.preventDefault();event.returnValue='';}});
 $('start').onclick=async()=>{
  stop();const version=cameraVersion;
  status('Permita o acesso à câmera. Posicione o documento inteiro no enquadramento.');
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Câmera não disponível neste navegador.');
   const opened=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:2560},height:{ideal:1920}},audio:false});
   if(!dialog.open||version!==cameraVersion){opened.getTracks().forEach(t=>t.stop());return;}
   stream=opened;$('video').srcObject=stream;$('video').hidden=false;await $('video').play();$('shutter').hidden=false;status('Enquadre a página inteira e toque em Fotografar.');
  }catch{if(dialog.open)status('Não foi possível abrir a câmera. Use “Câmera do celular” ou escolha uma foto.');}
 };
 const makeCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 function load(image){
  if(pages.length>=20){status('Limite de 20 páginas por documento. Envie este PDF antes de continuar.');return;}
  const width=image.videoWidth||image.naturalWidth||image.width,height=image.videoHeight||image.naturalHeight||image.height;
  if(!width||!height)throw Error('A câmera ainda está preparando a imagem. Tente novamente.');
  const scale=Math.min(1,2000/Math.max(width,height));source=makeCanvas(Math.round(width*scale),Math.round(height*scale));source.getContext('2d').drawImage(image,0,0,source.width,source.height);
  stop();autoCorners();$('editor').hidden=false;status('Confira o recorte sugerido. Ajuste os cantos se necessário e adicione a página.');draw();
 }
 function autoCorners(){const ratio=Math.min(1,320/source.width,320/source.height),small=makeCanvas(Math.round(source.width*ratio),Math.round(source.height*ratio)),ctx=small.getContext('2d');ctx.drawImage(source,0,0,small.width,small.height);points=geometry.detect(ctx.getImageData(0,0,small.width,small.height).data,small.width,small.height).map(p=>({x:p.x/(small.width-1)*(source.width-1),y:p.y/(small.height-1)*(source.height-1)}));corner=0;}
 $('shutter').onclick=()=>{try{load($('video'));}catch(e){status(e.message);}};
 for(const id of ['file','gallery'])$(id).onchange=async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  if(file.size>25*1024*1024){status('Foto muito grande. Escolha uma imagem de até 25 MB.');return;}
  const url=URL.createObjectURL(file);try{const image=new Image();image.src=url;await image.decode();if(dialog.open)load(image);}catch{status('Não foi possível ler essa imagem. Fotografe novamente ou escolha JPEG/PNG.');}finally{URL.revokeObjectURL(url);}
 };
 function draw(){if(!source)return;canvas.width=source.width;canvas.height=source.height;context.drawImage(source,0,0);const scale=canvas.width/(canvas.getBoundingClientRect().width||320);context.strokeStyle='#ffab32';context.lineWidth=3*scale;context.beginPath();points.forEach((p,i)=>i?context.lineTo(p.x,p.y):context.moveTo(p.x,p.y));context.closePath();context.stroke();points.forEach((p,i)=>{context.beginPath();context.arc(p.x,p.y,12*scale,0,Math.PI*2);context.fillStyle=i===corner?'#ffab32':'#fff';context.fill();context.strokeStyle='#07543d';context.stroke();context.fillStyle='#07543d';context.textAlign='center';context.textBaseline='middle';context.font=`bold ${12*scale}px Arial`;context.fillText(String(i+1),p.x,p.y);});$('corners').querySelectorAll('[data-corner]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.corner)===corner)));}
 const position=event=>{const rect=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(canvas.width-1,(event.clientX-rect.left)*canvas.width/rect.width)),y:Math.max(0,Math.min(canvas.height-1,(event.clientY-rect.top)*canvas.height/rect.height))};};
 canvas.onpointerdown=event=>{if(!source)return;const p=position(event);corner=points.map(q=>geometry.distance(p,q)).reduce((best,d,i,ds)=>d<ds[best]?i:best,0);dragging=true;canvas.setPointerCapture(event.pointerId);points[corner]=p;draw();};
 canvas.onpointermove=event=>{if(dragging){points[corner]=position(event);draw();}};canvas.onpointerup=canvas.onpointercancel=()=>{dragging=false;};
 $('corners').onclick=event=>{const b=event.target.closest('button');if(!b||!source)return;if(b.dataset.corner!=null)corner=Number(b.dataset.corner);else{const [x,y]=b.dataset.move.split(',').map(Number);points[corner]={x:Math.max(0,Math.min(source.width-1,points[corner].x+x*2)),y:Math.max(0,Math.min(source.height-1,points[corner].y+y*2))};}draw();};
 $('full').onclick=()=>{if(source){points=geometry.full(source.width,source.height);draw();}};
 $('rotate').onclick=()=>{if(!source)return;const rotated=makeCanvas(source.height,source.width),ctx=rotated.getContext('2d');ctx.translate(rotated.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(source,0,0);source=rotated;autoCorners();draw();};
 function lock(value){busy=value;dialog.querySelectorAll('button,input').forEach(el=>{if(value){el.dataset.scannerDisabled=String(el.disabled);el.disabled=true;}else if(el.dataset.scannerDisabled!=null){el.disabled=el.dataset.scannerDisabled==='true';delete el.dataset.scannerDisabled;}});}
 $('add').onclick=async()=>{
  if(!source||busy)return;if(!geometry.valid(points,source.width,source.height)){status('Os cantos precisam formar um documento sem cruzamentos. Ajuste os quatro pontos.');return;}
  if(pages.length>=20){status('Limite de 20 páginas por documento.');return;}
  lock(true);status('Corrigindo perspectiva e preparando a página…');
  try{
   await new Promise(r=>requestAnimationFrame(r));
   const w=Math.max(1,Math.round(Math.max(geometry.distance(points[0],points[1]),geometry.distance(points[3],points[2])))),h=Math.max(1,Math.round(Math.max(geometry.distance(points[0],points[3]),geometry.distance(points[1],points[2]))));
   const scale=Math.min(1,2000/Math.max(w,h)),out=makeCanvas(Math.round(w*scale),Math.round(h*scale)),ctx=out.getContext('2d'),pixels=source.getContext('2d').getImageData(0,0,source.width,source.height),result=ctx.createImageData(out.width,out.height),map=geometry.project(points),enhance=$('enhance').checked;
   for(let y=0;y<out.height;y++){
    for(let x=0;x<out.width;x++){const p=map(x/Math.max(1,out.width-1),y/Math.max(1,out.height-1)),px=Math.max(0,Math.min(source.width-1,p.x)),py=Math.max(0,Math.min(source.height-1,p.y)),ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy,offset=(y*out.width+x)*4;
     for(let c=0;c<3;c++){const at=(xx,yy)=>pixels.data[(Math.min(source.height-1,yy)*source.width+Math.min(source.width-1,xx))*4+c];const v=at(ix,iy)*(1-fx)*(1-fy)+at(ix+1,iy)*fx*(1-fy)+at(ix,iy+1)*(1-fx)*fy+at(ix+1,iy+1)*fx*fy;result.data[offset+c]=enhance?Math.max(0,Math.min(255,(v-128)*1.12+138)):v;}result.data[offset+3]=255;
    }
    if(y%200===0)await new Promise(r=>setTimeout(r,0));
   }
   ctx.putImageData(result,0,0);const blob=await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(Error('Não foi possível preparar a página.')),'image/jpeg',.9));
   if(pages.reduce((n,p)=>n+p.blob.size,blob.size)>20*1024*1024)throw Error('O documento ultrapassou 20 MB. Envie menos páginas por PDF.');
   pages.push({blob,url:URL.createObjectURL(blob)});source=null;$('editor').hidden=true;renderPages();status('Página adicionada. Fotografe outra ou renomeie e envie o documento.');
  }catch(e){status(e.message);}finally{lock(false);}
 };
 function renderPages(){
  $('review').hidden=!pages.length;$('count').textContent=String(pages.length);$('pages').replaceChildren();
  pages.forEach((page,index)=>{const card=document.createElement('article'),image=document.createElement('img');image.src=page.url;image.alt='Página '+(index+1)+' — toque para ampliar';image.tabIndex=0;const zoom=()=>image.classList.toggle('expanded');image.onclick=zoom;image.onkeydown=e=>{if(e.key==='Enter')zoom();};card.append(image);const label=document.createElement('p');label.textContent='Página '+(index+1);card.append(label);const controls=document.createElement('div');controls.className='scanner-toolbar';
   for(const [text,title,action,disabled] of [['↑','Mover página para antes',()=>{[pages[index-1],pages[index]]=[pages[index],pages[index-1]];renderPages();},index===0],['↓','Mover página para depois',()=>{[pages[index+1],pages[index]]=[pages[index],pages[index+1]];renderPages();},index===pages.length-1],['Excluir','Excluir página',()=>{URL.revokeObjectURL(page.url);pages.splice(index,1);renderPages();},false]]){const button=document.createElement('button');button.type='button';button.textContent=text;button.setAttribute('aria-label',title);button.disabled=disabled;button.onclick=action;controls.append(button);}card.append(controls);$('pages').append(card);
  });
 }
 $('send').onclick=async()=>{
  if(busy||!pages.length)return;
  if(source){status('Adicione ou descarte a página em edição antes de enviar.');return;}
  const name=$('name').value.trim().replace(/\.pdf$/i,'');if(!name){status('Informe o nome do documento.');$('name').focus();return;}
  if(!navigator.onLine){status('Sem internet. As páginas continuam aqui; reconecte e envie novamente.');return;}
  const body=new FormData();body.append('nome',name);body.append('envio',eventId);pages.forEach((p,i)=>body.append('paginas',p.blob,'pagina-'+(i+1)+'.jpg'));
  lock(true);stop();status('Enviando PDF para Arquivos…');
  try{const response=await fetch('/arquivo/escanear',{method:'POST',headers:{'X-Scanner-CSRF':dialog.dataset.csrf},body});const data=await response.json().catch(()=>({error:'Não foi possível confirmar o envio. Verifique a conexão e sua sessão; as páginas foram preservadas.'}));if(!response.ok||!data.ok)throw Error(data.error||'Falha no envio.');reset();$('camera').hidden=true;$('review').hidden=true;$('success').hidden=false;$('result').textContent=data.message+' '+data.name;status('PDF recebido. Você pode voltar à calculadora.');}
  catch(e){status(e.message||'Envio não confirmado. Tente novamente; não será criada uma cópia duplicada.');}finally{lock(false);renderPages();}
 };
 $('new').onclick=()=>{if(!busy&&confirm('Descartar estas páginas e começar outro documento?'))reset();};$('again').onclick=reset;
})();
