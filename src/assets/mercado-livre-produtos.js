(()=>{
 const $=id=>document.getElementById(id),form=$('productAnalysis'),rows=[...form.querySelectorAll('tr[data-index]')],root=form.action.replace(/\/salvar$/,''),notice=$('productsNotice');let busy=false,editing=null,credit=null,dirty=false;
 const field=(r,n)=>form.elements.namedItem(n+'['+r.dataset.index+']'),checkbox=r=>r.querySelector('input[name=selected]');
 const eligible=r=>!checkbox(r).disabled&&field(r,'decision').value==='Participar'&&r.dataset.own!=='yes';
 function markState(cb,list){const n=list.filter(r=>checkbox(r).checked).length;cb.checked=list.length>0&&n===list.length;cb.indeterminate=n>0&&n<list.length;cb.disabled=busy||!list.length;}
 function selection(){
  const chosen=rows.filter(r=>checkbox(r).checked),products=new Set(chosen.map(r=>r.dataset.group));$('productsSelected').textContent=chosen.length+' oferta(s) em '+products.size+' anúncio(s) selecionado(s)';$('productsIntegrate').disabled=busy||!chosen.length;
  markState($('productsAll'),rows.filter(eligible));markState($('productsHeaderAll'),rows.filter(eligible));for(const cb of form.querySelectorAll('[data-product-select]'))markState(cb,rows.filter(r=>r.dataset.group===cb.dataset.productSelect&&eligible(r)));
  $('productsCount').textContent=rows.filter(eligible).length+' oferta(s) Participar disponíveis para seleção em grupo';
 }
 function lock(value){busy=value;for(const id of ['productsSave','productsRules','productsRefresh'])$(id).disabled=value||!rows.some(r=>r.dataset.valid==='yes');selection();}
 function message(text){notice.hidden=false;notice.textContent=text;}
 function show(id,anchor){const menu=$(id),rect=anchor.getBoundingClientRect();menu.style.margin='0';menu.style.left=Math.max(8,Math.min(rect.left,innerWidth-320))+'px';menu.style.top=Math.max(8,Math.min(rect.bottom+8,innerHeight-370))+'px';menu.showModal();}
 function decision(r,value,manual){field(r,'decision').value=value;field(r,'manual').value=manual?'yes':'';r.dataset.decision=value;const b=r.querySelector('[data-decision-edit]');b.textContent=value+' ▾';b.className='decision-pill decision-'+(value==='Participar'?'yes':value==='Não participar'?'no':'review');if(value!=='Participar')checkbox(r).checked=false;dirty=true;selection();}
 $('productsAll').onchange=$('productsHeaderAll').onchange=e=>{for(const r of rows.filter(eligible))checkbox(r).checked=e.target.checked;selection();};
 form.addEventListener('change',e=>{const group=e.target.closest('[data-product-select]');if(group){for(const r of rows.filter(r=>r.dataset.group===group.dataset.productSelect&&eligible(r)))checkbox(r).checked=group.checked;selection();}else if(e.target.name==='selected')selection();else dirty=true;});
 $('productsRules').onclick=()=>{for(const r of rows)if(r.dataset.valid==='yes')decision(r,r.querySelector('[data-decision-edit]').dataset.suggested,false);};
 document.querySelector('.mp').addEventListener('click',e=>{
  const filter=e.target.closest('[data-product-filter]');if(filter){const name=filter.dataset.productFilter,select=$('productsFilter').elements.namedItem(name),options=$('productsFilterOptions');$('productsFilterTitle').textContent='Filtrar '+(name==='decisao'?'Decisão':'Participação');options.replaceChildren();for(const option of select.options){const b=document.createElement('button');b.type='button';b.textContent=option.textContent+(option.value===select.value?' ✓':'');b.className=option.value===select.value?'selected':'';b.onclick=()=>{select.value=option.value;$('productsFilterMenu').close();$('productsFilter').requestSubmit();};options.append(b);}show('productsFilterMenu',filter);return;}
  const close=e.target.closest('[data-close]');if(close){$(close.dataset.close).close();return;}
  const reset=e.target.closest('[data-reset-price]');if(reset){reset.closest('td').querySelector('input').value=Number(reset.dataset.resetPrice).toFixed(2).replace('.',',');dirty=true;return;}
  const edit=e.target.closest('[data-decision-edit]');if(edit){editing=edit.closest('tr');show('productsDecision',edit);return;}
  const choice=e.target.closest('[data-decision-value]');if(choice&&editing){decision(editing,choice.dataset.decisionValue,true);$('productsDecision').close();return;}
  const bonus=e.target.closest('[data-credit-edit]');if(bonus){credit=bonus.closest('tr');$('productsCreditValue').value=field(credit,'credit').value.replace('.',',');show('productsCredit',bonus);}
 });
 $('productsDecisionRule').onclick=()=>{if(editing)decision(editing,editing.querySelector('[data-decision-edit]').dataset.suggested,false);$('productsDecision').close();};
 $('productsCreditValue').oninput=()=>$('productsCreditValue').setCustomValidity('');
 $('productsCreditApply').onclick=()=>{if(!credit)return;const text=$('productsCreditValue').value.trim(),value=Number(text.replace(',','.'));if(!text||!Number.isFinite(value)||value<0){$('productsCreditValue').setCustomValidity('Informe um bônus válido, maior ou igual a zero.');$('productsCreditValue').reportValidity();return;}field(credit,'credit').value=value.toFixed(2);credit.querySelector('[data-credit-display]').textContent=value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});dirty=true;$('productsCredit').close();};
 $('productsCreditClear').onclick=()=>{if(credit){field(credit,'credit').value='';credit.querySelector('[data-credit-display]').textContent='Recalcular *';dirty=true;}$('productsCredit').close();};
 function serialize(chosen){const data={csrf:form.elements.csrf.value,return_query:form.elements.return_query.value,basis:{},price:{},quantity:{},credit:{},creditBasis:{},decision:{},manual:{},selected:chosen.map(r=>r.dataset.index)};for(const r of chosen)for(const n of ['basis','price','quantity','credit','creditBasis','decision','manual']){const f=field(r,n);if(f)data[n][r.dataset.index]=f.value;}return data;}
 async function failure(response){const parsed=new DOMParser().parseFromString(await response.text(),'text/html');throw Error(parsed.querySelector('.mp .warn')?.textContent||'Não foi possível processar. Atualize a análise.');}
 function participation(items){for(const item of items){const r=rows.find(r=>r.dataset.offerKey===item.key);if(r){const b=r.querySelector('[data-participation-status]');b.textContent=item.label+' ⓘ';b.title=item.note;}}}
 async function watch(operation){
  try{const response=await fetch(root+'/participacao?'+new URLSearchParams({operation}),{headers:{Accept:'application/json'}});if(!response.ok)await failure(response);const data=await response.json();participation(data.items);const result=data.operation,final=result.results.filter(r=>r.final);message('Processando '+final.length+' / '+result.total+' ofertas.');if(result.status==='executando'){setTimeout(()=>watch(operation),3000);return;}
   const count=status=>final.filter(r=>r.status===status).length;message((result.status==='concluida'?'Concluído. ':'Finalizado com pendências. ')+count('Participando')+' participando · '+count('Não participando')+' não participando · '+count('Pendente de confirmação')+' pendentes de confirmação.');
   for(const r of rows)checkbox(r).checked=false;const report=document.createElement('a');report.href=root.replace(/\/central-promocoes\/por-produto$/,'')+'/relatorio/'+operation;report.textContent='Ver relatório por campanha';notice.append(report);for(const item of final.filter(r=>r.motivo)){const line=document.createElement('p');line.textContent=(item.sku||item.anuncio)+' · '+(item.nome_campanha||item.campanha||'')+' · '+item.motivo;notice.append(line);}lock(false);
  }catch(e){message(e.message+' Nenhum reenvio automático será feito.');lock(false);}
 }
 async function start(path,chosen){lock(true);message('Conferindo ofertas e condições no Mercado Livre…');try{const response=await fetch(root+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(serialize(chosen))});if(!response.ok)await failure(response);const result=await response.json();const url=new URL(location.href);url.searchParams.set('operation',result.operation);history.replaceState(null,'',url);watch(result.operation);}catch(e){message(e.message);lock(false);}}
 $('productsRefresh').onclick=()=>{if(rows.length)start('/consultar-participacao',rows);};
 form.addEventListener('submit',async e=>{e.preventDefault();if(busy)return;if(e.submitter?.id==='productsIntegrate'){const chosen=rows.filter(r=>checkbox(r).checked);if(chosen.some(r=>field(r,'decision').value!=='Participar')){message('Marque somente ofertas com decisão Participar.');return;}if(chosen.length)start('/integrar',chosen);return;}
  lock(true);try{const response=await fetch(form.action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(serialize(rows.filter(r=>r.dataset.valid==='yes')))});if(!response.ok)await failure(response);dirty=false;location.href=response.url;}catch(error){message(error.message);lock(false);}
 });
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
 if(document.querySelector('[data-sync-active]')){const refresh=()=>{if(!dirty&&!busy)location.reload();else setTimeout(refresh,10000);};setTimeout(refresh,10000);}
 selection();if(notice.dataset.operation){lock(true);watch(notice.dataset.operation);}
})();
