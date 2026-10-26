(function(scope){
 const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const link=(url,text)=>`<a href="${esc(url)}">${esc(text)}</a>`;
 const table=(title,headers,rows)=>`<section class="pn-indicator"><h4>${esc(title)}</h4><div class="pn-indicator-scroll"><table class="pn-indicator-table"><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
 function render(entries,{menu,closing=false}={}){
  let html='';const used=new Set();
  if(menu==='financeiro'){
   const due=entries.find(e=>e.key==='vencimentos-hoje');if(due){used.add(due);html+=Number.isFinite(due.amount)?table('Contas a vencer',['Qtde Contas','Valor estimado'],`<tr><td>${link(due.url,due.count)}</td><td>${link(due.url,due.amount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}))}</td></tr>`)+(due.unknown?`<p class="pn-note">${esc(due.unknown)} conta(s) sem valor informado.</p>`:''):`<section class="pn-indicator"><h4>Contas a vencer</h4><p>${link(due.url,due.label)}</p></section>`;}
   const archive=entries.find(e=>e.key==='arquivo');if(archive){used.add(archive);html+=table('Arquivos para lançar',['Qtde Arquivos'],`<tr><td>${link(archive.url,archive.count)}</td></tr>`);}
  }
  if(menu==='contabil'&&closing){
   const rows=entries.filter(e=>e.key.startsWith('fechamento:')&&e.month);rows.forEach(e=>used.add(e));
   html+=table('Fechamento de despesas',['Competência','Tipo de arquivo','Status'],rows.map(e=>`<tr><td>${link(e.url,e.month?e.month.split('-').reverse().join('/'):'—')}</td><td>${link(e.url,e.fileType||e.label)}</td><td>${esc(e.status||'—')}</td></tr>`).join('')||`<tr><td colspan="3" class="pn-indicator-empty">${entries.some(e=>e.key==='fechamento:erro')?'Consulta indisponível.':'Nenhuma pendência.'}</td></tr>`);
  }
  html+=entries.filter(e=>!used.has(e)).map(e=>`<a class="pn-auto-item" href="${esc(e.url)}">${esc(e.label)}</a>`).join('');return html;
 }
 if(typeof module==='object'&&module.exports)module.exports={render};else scope.PlennatecIndicators={render};
})(typeof window==='object'?window:this);
