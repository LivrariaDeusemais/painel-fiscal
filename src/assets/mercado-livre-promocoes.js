(()=>{
 const $=id=>document.getElementById(id),form=$('mpAnalysis'),rows=[...form.querySelectorAll('tbody tr')],search=$('mpSearch'),stock=$('mpStock');
 const choices=['Participar','Revisar','Não participar'];let decisionFilter='',editingRow=null,creditRow=null;
 const field=(r,name)=>form.elements.namedItem(name+'['+r.dataset.index+']');
 function filter(){for(const r of rows){const text=r.innerText.toLocaleLowerCase('pt-BR'),decision=field(r,'decision').value,qty=(Number(r.cells[4].innerText)||0)+(Number(r.cells[5].innerText)||0);r.hidden=!(text.includes(search.value.toLocaleLowerCase('pt-BR'))&&(!decisionFilter||decision===decisionFilter)&&(stock.value==='all'||qty>0));}}
 function setDecision(row,value,manual){field(row,'decision').value=value;field(row,'manual').value=manual?'yes':'';row.dataset.decision=value;const button=row.querySelector('[data-decision-edit]');button.textContent=value+' ▾';button.className='decision-pill decision-'+(value==='Participar'?'yes':value==='Não participar'?'no':'review');button.title=manual?'Escolha manual: salve a análise para registrar.':'Decisão calculada pela regra de margem.';}
 $('mpApplyRules').onclick=()=>{for(const r of rows)if(!r.hidden)setDecision(r,r.querySelector('[data-decision-edit]').dataset.suggested,false);filter();};
 $('mpDecisionRule').onclick=()=>{if(editingRow)setDecision(editingRow,editingRow.querySelector('[data-decision-edit]').dataset.suggested,false);$('mpDecisionDialog').close();filter();};
 function showMenu(id,anchor){const menu=$(id),rect=anchor.getBoundingClientRect();menu.style.margin='0';menu.style.left=Math.max(8,Math.min(rect.left,innerWidth-308))+'px';menu.style.top=Math.max(8,Math.min(rect.bottom+8,innerHeight-410))+'px';menu.showModal();}
 function filterOptions(){const term=$('mpFilterSearch').value.toLocaleLowerCase('pt-BR');$('mpFilterOptions').replaceChildren();for(const value of ['',...choices]){const label=value||'Todos';if(value&&!label.toLocaleLowerCase('pt-BR').includes(term))continue;const button=document.createElement('button');button.type='button';button.textContent=label+(decisionFilter===value?' ✓':'');button.className=decisionFilter===value?'selected':'';button.onclick=()=>{decisionFilter=value;$('mpDecisionFilter').classList.toggle('active',!!value);$('mpFilterDialog').close();filter();};$('mpFilterOptions').append(button);}}
 $('mpDecisionFilter').onclick=e=>{$('mpFilterSearch').value='';filterOptions();showMenu('mpFilterDialog',e.currentTarget);};$('mpFilterSearch').oninput=filterOptions;
 search.oninput=filter;stock.onchange=filter;
 $('mpAll').onchange=e=>{for(const r of rows){const cb=r.querySelector('input[type=checkbox]');if(!r.hidden&&!cb.disabled)cb.checked=e.target.checked;}};
 document.querySelector('.mp').addEventListener('click',e=>{
  const close=e.target.closest('[data-close]');if(close){$(close.dataset.close).close();return;}
  const reset=e.target.closest('[data-reset-price]');if(reset){reset.closest('td').querySelector('input').value=Number(reset.dataset.resetPrice).toFixed(2).replace('.',',');return;}
  const decision=e.target.closest('[data-decision-edit]');if(decision){editingRow=decision.closest('tr');const current=field(editingRow,'decision').value;$('mpDecisionDialog').querySelectorAll('[data-decision-value]').forEach(b=>b.classList.toggle('selected',b.dataset.decisionValue===current));showMenu('mpDecisionDialog',decision);return;}
  const choice=e.target.closest('[data-decision-value]');if(choice&&editingRow){const value=choice.dataset.decisionValue;setDecision(editingRow,value,true);$('mpDecisionDialog').close();filter();return;}
  const credit=e.target.closest('[data-credit-edit]');if(credit){creditRow=credit.closest('tr');$('mpCreditValue').value=field(creditRow,'credit').value.replace('.',',');showMenu('mpCreditDialog',credit);}
 });
 $('mpCreditApply').onclick=()=>{if(!creditRow)return;const raw=$('mpCreditValue').value.trim(),value=Number(raw.replace(',','.'));if(!raw||!Number.isFinite(value)||value<0){$('mpCreditValue').setCustomValidity('Informe um valor em reais igual ou maior que zero.');$('mpCreditValue').reportValidity();return;}field(creditRow,'credit').value=value.toFixed(2);creditRow.querySelector('[data-credit-display]').textContent=value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});creditRow.querySelector('.credit-edit').title='Valor conferido: salve a análise para recalcular.';$('mpCreditDialog').close();};
 $('mpCreditValue').oninput=()=>$('mpCreditValue').setCustomValidity('');
 $('mpCreditClear').onclick=()=>{if(!creditRow)return;field(creditRow,'credit').value='';creditRow.querySelector('[data-credit-display]').textContent='Recalcular *';$('mpCreditDialog').close();};
 form.addEventListener('submit',async e=>{
  e.preventDefault();const data={csrf:form.elements.csrf.value,campaign:form.elements.campaign.value,basis:{},price:{},quantity:{},credit:{},creditBasis:{},decision:{},manual:{},selected:[],review:form.elements.review.checked?'yes':''};
  for(const [k,v] of new FormData(form)){const match=k.match(/^(basis|price|quantity|credit|creditBasis|decision|manual)\[(\d+)\]$/);if(match)data[match[1]][match[2]]=v;if(k==='selected')data.selected.push(v);}
  const button=e.submitter;button.disabled=true;try{const response=await fetch(button.getAttribute('formaction')||form.action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(!response.ok){document.open();document.write(await response.text());document.close();return;}location.href=response.url;}catch(error){alert('Não foi possível salvar. Atualize e confira o resultado antes de repetir.');button.disabled=false;}
 });
})();
