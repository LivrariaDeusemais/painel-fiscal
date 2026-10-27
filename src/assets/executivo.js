(function(){
 const root=document.getElementById('exec-header');if(!root)return;
 const favorites=root.querySelector('.exec-favorites');
 if(favorites){
  let selected=[],options=[];const linkLists=document.querySelectorAll('.exec-favorites-links'),dialog=favorites.querySelector('dialog'),message=favorites.querySelector('.exec-favorites-message');
  const showText=text=>{for(const links of linkLists){links.replaceChildren();const label=document.createElement('span');label.textContent=text;links.append(label);}};
  const render=()=>{for(const links of linkLists){links.replaceChildren();let count=0;for(const url of selected){const p=options.find(p=>p.url===url);if(!p)continue;const a=document.createElement('a');a.href=p.url;a.textContent=p.label;links.append(a);count++;}if(!count){const label=document.createElement('span');label.textContent='Defina seus atalhos no lápis';links.append(label);}}};
  const load=async()=>{const response=await fetch('/painel/favoritos',{headers:{Accept:'application/json'}});if(!response.ok)throw Error('Não foi possível carregar favoritos. Atualize a página.');const data=await response.json();options=data.options;selected=data.selected;render();};
  showText('Carregando atalhos…');load().catch(e=>{message.textContent=e.message;showText(e.message);});
  favorites.querySelector('[data-favorites-open]')?.addEventListener('click',e=>{const open=favorites.classList.toggle('is-open');e.currentTarget.setAttribute('aria-expanded',String(open));});
  document.querySelectorAll('[data-favorites-edit]').forEach(b=>b.addEventListener('click',async()=>{try{await load();message.textContent='';const list=favorites.querySelector('.exec-favorites-options');list.replaceChildren();for(const p of options){const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.name='url';check.value=p.url;check.checked=selected.includes(p.url);label.append(check,document.createTextNode(p.label));list.append(label);}favorites.classList.remove('is-open');favorites.querySelector('[data-favorites-open]').setAttribute('aria-expanded','false');dialog.showModal();}catch(e){message.textContent=e.message;dialog.showModal();}}));
  favorites.querySelector('[data-favorites-close]').addEventListener('click',()=>dialog.close());
  favorites.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const button=e.target.querySelector('[type=submit]');button.disabled=true;try{const urls=Array.from(new FormData(e.target).getAll('url'));const response=await fetch('/painel/favoritos',{method:'POST',headers:{'Content-Type':'application/json','X-Painel-Token':favorites.dataset.token},body:JSON.stringify({urls})});const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível salvar.');selected=urls;render();dialog.close();}catch(error){message.textContent=error.message;}finally{button.disabled=false;}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){favorites.classList.remove('is-open');favorites.querySelector('[data-favorites-open]').setAttribute('aria-expanded','false');}});
  document.addEventListener('click',e=>{if(!favorites.contains(e.target)){favorites.classList.remove('is-open');favorites.querySelector('[data-favorites-open]')?.setAttribute('aria-expanded','false');}});
 }
 const input=document.getElementById('exec-search-input'),results=document.getElementById('exec-search-results');
 const pages=JSON.parse(document.getElementById('exec-search-data').textContent);
 const norm=v=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 input.addEventListener('input',()=>{const q=norm(input.value.trim());results.replaceChildren();results.hidden=!q;if(!q)return;const matches=pages.filter(p=>norm(p.label).includes(q)).slice(0,12);for(const p of matches){const a=document.createElement('a');a.href=p.url;a.textContent=p.label;results.appendChild(a);}if(!matches.length)results.textContent='Nenhuma tela encontrada';});
 input.addEventListener('keydown',e=>{if(e.key==='Escape')results.hidden=true;if(e.key==='Enter'&&results.querySelector('a'))location.href=results.querySelector('a').href;});
 document.addEventListener('click',e=>{if(!root.querySelector('.exec-search').contains(e.target))results.hidden=true;});
 // Mantém os controles locais dos menus antigos (Colunas, Nova conta, filtros etc.).
 const globalPaths=new Set(pages.map(p=>p.url.split('?')[0]).concat(['/usuarios','/categorias','/backup','/administracao','/alertas-vencimentos','/contabil/fechamento','/contabil/historico','/ferramentas-ia','/dashboard','/logout','/espaco-contador','/conciliacao-bancaria']));
 document.querySelectorAll('.dm-global-nav,.plennatec-top-nav,.nav-card,.nav-panel,main.shell > .nav').forEach(nav=>{
  if(nav.closest('#exec-header'))return;
  const actions=[];
  Array.from(nav.children).forEach(el=>{const href=el.getAttribute('href');if(el.tagName==='A'&&globalPaths.has((href||'').split('?')[0]))return;if(el.matches('span.dm-menu-extra-separator'))return;if(el.matches('button,form,a')||el.querySelector('button,input,select'))actions.push(el);});
  if(actions.length){const toolbar=document.createElement('div');toolbar.className='exec-local-actions';nav.parentNode.insertBefore(toolbar,nav);actions.forEach(el=>toolbar.appendChild(el));}
  nav.classList.add('exec-hidden-nav');
 });
 // Reúne os botões originais junto aos totais, mantendo IDs, handlers e filtros.
 const total=document.querySelector('.rotina-total') || (document.querySelector('.ml-table') && document.querySelector('.summary'));
 if(total){
  const bars=Array.from(document.querySelectorAll('.exec-local-actions'));
  if(bars.length){
   const row=document.createElement('div');row.className='exec-summary-row';
   total.parentNode.insertBefore(row,total);row.appendChild(total);
   const actions=document.createElement('div');actions.className='exec-summary-actions';
   bars.forEach(bar=>{while(bar.firstChild)actions.appendChild(bar.firstChild);bar.remove();});
   row.appendChild(actions);
  }
 }
})();
