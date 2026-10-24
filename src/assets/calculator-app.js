(()=>{
 const received=[...document.querySelectorAll('.tpc-breakdown tr')].find(row=>row.classList.contains('receive'));
 if(received){const box=document.createElement('div');box.className='app-receive';const label=document.createElement('span');label.textContent='Receber do Marketplace';const value=document.createElement('strong');value.textContent=received.querySelector('td').textContent;box.append(label,value);document.querySelector('.app-details').before(box);}
 let prompt;const install=document.getElementById('install-app');window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;install.hidden=false;});install.addEventListener('click',async()=>{if(!prompt)return;await prompt.prompt();await prompt.userChoice;prompt=null;install.hidden=true;});window.addEventListener('appinstalled',()=>{install.hidden=true;});document.getElementById('install-help').addEventListener('click',()=>{const guide=document.getElementById('install-guide');guide.hidden=!guide.hidden;document.body.classList.toggle("show-help",!guide.hidden);});
 const shareUrl=new URL('/ferramentas-ia/tabela-precos/promocoes?app=1',location.origin).href;
 const shareDialog=document.getElementById('share-dialog'),shareLink=document.getElementById('share-link'),shareStatus=document.getElementById('share-status');
 shareLink.value=shareUrl;
 document.getElementById('share-app').addEventListener('click',async()=>{
  if(navigator.share){try{await navigator.share({title:'Calculadora Plennatec',text:'Acesse a Calculadora Plennatec',url:shareUrl});return;}catch(error){if(error.name==='AbortError')return;}}
  shareStatus.textContent='';shareDialog.showModal();shareLink.select();
 });
 document.getElementById('copy-share-link').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(shareUrl);shareStatus.textContent='Link copiado! Agora cole na mensagem.';}catch(error){shareLink.focus();shareLink.select();shareStatus.textContent='Toque e segure o link para copiar.';}
 });
 if('serviceWorker'in navigator)navigator.serviceWorker.register('/ferramentas-ia/tabela-precos/promocoes/sw.js').catch(()=>{});
})();
