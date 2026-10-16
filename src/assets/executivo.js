(function(){
 const root=document.getElementById('exec-header');if(!root)return;
 const input=document.getElementById('exec-search-input'),results=document.getElementById('exec-search-results');
 const pages=JSON.parse(document.getElementById('exec-search-data').textContent);
 const norm=v=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 input.addEventListener('input',()=>{const q=norm(input.value.trim());results.replaceChildren();results.hidden=!q;if(!q)return;const matches=pages.filter(p=>norm(p.label).includes(q)).slice(0,12);for(const p of matches){const a=document.createElement('a');a.href=p.url;a.textContent=p.label;results.appendChild(a);}if(!matches.length)results.textContent='Nenhuma tela encontrada';});
 input.addEventListener('keydown',e=>{if(e.key==='Escape')results.hidden=true;if(e.key==='Enter'&&results.querySelector('a'))location.href=results.querySelector('a').href;});
 document.addEventListener('click',e=>{if(!root.querySelector('.exec-search').contains(e.target))results.hidden=true;});
 // Mantém os controles locais dos menus antigos (Colunas, Nova conta, filtros etc.).
 const globalPaths=new Set(pages.map(p=>p.url.split('?')[0]).concat(['/dashboard','/logout','/espaco-contador','/conciliacao-bancaria']));
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
