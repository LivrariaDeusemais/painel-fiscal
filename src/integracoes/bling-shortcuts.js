const crypto = require('crypto');
const service = require('./bling');
const ROOT = '/ferramentas-ia/tabela-precos/bling';
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function state(pool,req) {
  if(req.session.usuario?.perfil!=='ADMIN')return null;
  if(!req.session.blingCsrf)req.session.blingCsrf=crypto.randomBytes(32).toString('hex');
  try {
    await service.ensureTables(pool);
    const job=(await pool.query('SELECT id,status,etapa FROM bling_sincronizacoes ORDER BY id DESC LIMIT 1')).rows[0];
    return {csrf:req.session.blingCsrf,active:job?.status==='executando',jobId:job?.id};
  } catch {return null;}
}
function render(req,model,module,marketplace='') {
  if(!model)return '';
  const label=module==='links'?'Atualizar vínculos e preços brutos':'Atualizar cadastro, custos e estoques';
  return `<form method="post" action="${ROOT}/atalho" class="bling-shortcut" style="display:inline-flex;align-items:center;gap:8px"><input type="hidden" name="csrf" value="${escape(model.csrf)}"><input type="hidden" name="modulo" value="${module}"><input type="hidden" name="marketplace" value="${escape(marketplace)}"><input type="hidden" name="return_to" value="${escape(req.originalUrl)}"><button type="submit" class="${module==='links'?'tpt-btn':'tprod-btn'}" ${model.active?'disabled':''} title="${module==='links'?escape(marketplace || 'Todos os marketplaces configurados'):'Atualiza a base de produtos pelo Bling'}">${model.active?'Em andamento — aguarde':label}</button></form><script>(()=>{const form=document.currentScript.previousElementSibling;const button=form.querySelector('button');let started=${model.active?'true':'false'};form.addEventListener('submit',()=>{button.disabled=true;button.textContent='Em andamento — aguarde';});const timer=setInterval(async()=>{try{const response=await fetch('${ROOT}/andamento',{headers:{Accept:'application/json'}});if(!response.ok)return;const job=await response.json();if(job.active){started=true;button.disabled=true;button.textContent='Em andamento — aguarde';}else if(started){clearInterval(timer);location.reload();}}catch{}},5000);})();</script>`;
}
function safeReturn(value) {
  const url=String(value || '');
  return /^\/ferramentas-ia\/tabela-precos\/(?:tabela|produtos)(?:\?|$)/.test(url) && !/[\r\n]/.test(url)?url:'/ferramentas-ia/tabela-precos/tabela';
}
module.exports={state,render,safeReturn};
