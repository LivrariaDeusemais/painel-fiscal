const crypto = require('crypto');
const express = require('express');
const service = require('./bling');
const ROOT = '/ferramentas-ia/tabela-precos/bling';
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(model, feedback) {
  const settings = model.configuracao || {};
  const select = (name,value,empty) => `<select name="${escape(name)}"><option value="">${empty}</option>${(model.depositos || []).map(d=>`<option value="${escape(d.id)}" ${String(value)===String(d.id)?'selected':''}>${escape(d.descricao)}</option>`).join('')}</select>`;
  const active = model.jobs?.[0]?.status === 'executando';
  const statuses = {executando:'Em andamento',concluida:'Concluída',parcial:'Com pendências',interrompida:'Interrompida',falhou:'Falhou'};
  const jobs = (model.jobs || []).map(j=>`<tr><td>${new Date(j.criado_em).toLocaleString('pt-BR')}</td><td>${escape(statuses[j.status] || j.status)}</td><td>${escape(j.etapa)} (${j.processados}/${j.total})</td><td>${escape(j.mensagem || '')}</td></tr>`).join('');
  return `<style>.bling-wrap{max-width:1100px;margin:auto;display:grid;gap:16px}.bling-card{background:#fff;border:1px solid #dce7e1;border-radius:10px;padding:22px}.bling-card h2{font-size:20px;margin:0 0 12px}.bling-card p{color:#475569;line-height:1.5}.bling-card label{display:grid;gap:7px;margin:12px 0;font-weight:700}.bling-card select{padding:10px;border:1px solid #cbd5e1;border-radius:6px;max-width:480px}.bling-actions{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}.bling-btn{border:1px solid #009640;padding:10px 16px;border-radius:7px;background:#009640;color:white;text-decoration:none;font-weight:700;cursor:pointer}.bling-btn:disabled{opacity:.5;cursor:default}.bling-scroll{overflow:auto}.bling-scroll table{width:100%;border-collapse:collapse;font-size:12px}.bling-scroll td,.bling-scroll th{padding:12px;text-align:left;border-bottom:1px solid #e2e8f0}.bling-note{padding:12px;background:#fff7e8;border-left:4px solid #d97706}.bling-alert{padding:14px;border-radius:8px;background:${feedback?.ok?'#dcfce7':'#fff1f2'}}</style>
  <div class="bling-wrap">${feedback ? `<div class="bling-alert">${escape(feedback.message)}</div>`:''}
  <section class="bling-card"><h2>Conexão com o Bling</h2><p>Atualize o cadastro, o custo do fornecedor padrão, o peso, o preço geral do Bling e os saldos por depósito. A carga de preços brutos dos marketplaces continua sendo feita pelo arquivo exportado da tabela.</p>
  <p><strong>${model.conectado?'Conta autorizada':'Conta ainda não conectada'}</strong>${model.ultima_sincronizacao?' · Última atualização: '+new Date(model.ultima_sincronizacao).toLocaleString('pt-BR'):''}</p>
  ${model.missing.length ? `<p>Configure no Render as variáveis: <code>${model.missing.map(escape).join('</code>, <code>')}</code>.</p><details><summary>Como configurar a conexão</summary><ol><li>No Bling, acesse Central de Extensões → Área do Integrador e crie um aplicativo privado.</li><li>Cadastre este redirecionamento: <code>${escape(model.callback)}</code>.</li><li>Autorize apenas consultas de Produtos, Estoques e Depósitos.</li><li>Em Environment do Render, adicione BLING_CLIENT_ID e BLING_CLIENT_SECRET fornecidos pelo aplicativo.</li><li>Adicione BLING_TOKEN_ENCRYPTION_KEY com um segredo aleatório de pelo menos 32 caracteres. Pode gerar no Terminal com <code>openssl rand -hex 32</code>.</li><li>Salve, publique e volte aqui para conectar.</li></ol></details>`:''}
  <div class="bling-actions"><form method="post" action="${ROOT}/conectar"><button class="bling-btn" ${model.missing.length||active?'disabled':''}>${model.conectado?'Reconectar Bling':'Conectar Bling'}</button><input type="hidden" name="csrf" value="${escape(model.csrf)}"></form>
  <form method="post" action="${ROOT}/depositos"><input type="hidden" name="csrf" value="${escape(model.csrf)}"><button class="bling-btn" ${!model.conectado||active?'disabled':''}>Consultar depósitos</button></form></div></section>
  <section class="bling-card"><h2>Estoques por marketplace</h2><p>O saldo físico da Matriz aparece em todas as linhas. O Full mostra o depósito do marketplace daquela linha, inclusive com o filtro em Todos. Canais sem Full mostram zero.</p>
  <form method="post" action="${ROOT}/configuracao"><input type="hidden" name="csrf" value="${escape(model.csrf)}"><label>Depósito Matriz${select('matriz',settings.matriz,'Selecione a Matriz')}</label>
  ${model.marketplaces.map((m,i)=>`<label>Full ${escape(m)}${select('full_'+i,settings.full?.[m],'Sem Full (0)')}</label>`).join('')}
  <button class="bling-btn" ${!model.depositos?.length||active?'disabled':''}>Salvar depósitos</button></form></section>
  <section class="bling-card"><h2>Preços brutos por marketplace</h2><p>Selecione a loja do Bling correspondente a cada marketplace. A consulta atualiza os preços brutos e preserva os preços líquidos. O Mercado Livre consulta os anúncios publicados pelo código MLB. A importação por planilha continua disponível durante a validação.</p><p>Se o Bling negar a consulta, revise as permissões de consulta de Canais de Venda, Produtos/Lojas e Anúncios no aplicativo e reconecte a conta.</p>
  <form method="post" action="${ROOT}/lojas"><input type="hidden" name="csrf" value="${escape(model.csrf)}"><button class="bling-btn" ${!model.conectado||active?'disabled':''}>Consultar lojas do Bling</button></form>
  <form method="post" action="${ROOT}/lojas/configuracao"><input type="hidden" name="csrf" value="${escape(model.csrf)}">
  ${model.marketplaces.map((m,i)=>`<label>${escape(m)}<select name="loja_${i}"><option value="">Não consultar por integração</option>${(model.lojas || []).map(loja=>`<option value="${escape(loja.id)}" ${String(settings.lojas?.[m])===String(loja.id)?'selected':''}>${escape(loja.descricao)} (${escape(loja.tipo || '')})</option>`).join('')}</select></label>`).join('')}
  <button class="bling-btn" ${!model.lojas?.length||active?'disabled':''}>Salvar lojas</button></form>
  <p>Se uma consulta falhar ou não identificar o anúncio, os dados anteriores permanecem. O envio dos novos preços ao Bling continua pelo arquivo exportado da tabela.</p></section>
  <section class="bling-card"><h2>Atualizar dados</h2><div class="bling-note"><strong>Custo: Preço de custo do fornecedor padrão no Bling.</strong><p>A atualização usa somente o fornecedor marcado como padrão de cada produto. Custos ausentes, zerados ou inválidos e cadastros com mais de um padrão preservam o custo anterior e geram uma pendência. O preço de compra e fornecedores antigos não são usados como substitutos.</p></div>
  <form method="post" action="${ROOT}/atualizar"><input type="hidden" name="csrf" value="${escape(model.csrf)}"><div class="bling-actions"><button class="bling-btn" ${!model.conectado||!settings.matriz||active?'disabled':''}>${active?'Atualização em andamento':'Atualizar cadastro, custos, estoques e preços brutos'}</button><a href="${ROOT}">Consultar andamento</a></div></form>
  <p>Os preços brutos dos vínculos são consultados nas lojas configuradas. Os preços líquidos informados permanecem preservados. Os custos válidos do fornecedor padrão atualizam a tabela e as calculadoras. Falhas mantêm os últimos saldos conhecidos, com sua data de atualização.</p>
  <div class="bling-scroll"><table><thead><tr><th>Início</th><th>Status</th><th>Andamento</th><th>Resultado</th></tr></thead><tbody>${jobs || '<tr><td colspan="4">Nenhuma atualização iniciada.</td></tr>'}</tbody></table></div></section></div>${active?'<script>setTimeout(()=>location.reload(),5000)</script>':''}`;
}
function createRouter(pool, renderShell) {
  const router = express.Router();
  router.use((req,res,next)=>{
    if (!req.session.usuario) return res.redirect('/login');
    if (req.session.usuario.perfil !== 'ADMIN') return res.status(403).send('Acesso permitido apenas ao administrador.');
    res.set('Cache-Control','no-store'); res.set('Referrer-Policy','no-referrer');
    if (!req.session.blingCsrf) req.session.blingCsrf=crypto.randomBytes(32).toString('hex');
    if (req.method==='POST' && req.body.csrf !== req.session.blingCsrf) return res.status(403).send('Sessão inválida. Atualize a página e tente novamente.');
    next();
  });
  router.get('/',async(req,res)=>{
    try {
      await service.ensureTables(pool);
      const model = await service.state(pool); model.csrf=req.session.blingCsrf;
      const feedback=req.session.blingFeedback; delete req.session.blingFeedback;
      res.send(renderShell(req,render(model,feedback),{title:'Integração Bling',subtitle:'Cadastro e estoques por depósito'}));
    } catch(error) { res.status(503).send('Integração Bling indisponível. Tente novamente.'); }
  });
  router.post('/conectar',async(req,res)=>{
    const c=service.config();
    if (!c.clientId || !c.clientSecret || c.key.length<32) { req.session.blingFeedback={ok:false,message:'Configure as três variáveis da conexão no Render.'}; return res.redirect(ROOT); }
    const state=crypto.randomBytes(32).toString('hex');
    req.session.blingOAuth={state,expires:Date.now()+600000};
    req.session.save(()=>res.redirect('https://www.bling.com.br/Api/v3/oauth/authorize?'+new URLSearchParams({response_type:'code',client_id:c.clientId,state})));
  });
  router.get('/callback',async(req,res)=>{
    const auth=req.session.blingOAuth; delete req.session.blingOAuth;
    if (!auth || auth.expires<Date.now() || auth.state!==req.query.state || !req.query.code || req.query.error) {
      req.session.blingFeedback={ok:false,message:'Autorização inválida ou cancelada. Clique em Conectar Bling novamente.'}; return res.redirect(ROOT);
    }
    try { await service.ensureTables(pool); await service.connect(pool,String(req.query.code)); req.session.blingFeedback={ok:true,message:'Conta Bling conectada. Consulte os depósitos e configure a Matriz e os depósitos Full.'}; }
    catch(error){req.session.blingFeedback={ok:false,message:error.message};}
    res.redirect(ROOT);
  });
  const action=(path,fn)=>router.post(path,async(req,res)=>{
    try{await service.ensureTables(pool);req.session.blingFeedback={ok:true,message:await fn(req)};}
    catch(error){req.session.blingFeedback={ok:false,message:error.message};}
    res.redirect(ROOT);
  });
  action('/lojas',async()=>{await service.loadStores(pool);return 'Lojas consultadas. Selecione a loja de cada marketplace.';});
  action('/lojas/configuracao',async req=>{const model=await service.state(pool);await service.saveStores(pool,Object.fromEntries(model.marketplaces.map((m,i)=>[m,String(req.body['loja_'+i] || '')]).filter(([,value])=>value)));return 'Lojas salvas. A próxima atualização consultará os preços brutos.';});
  action('/depositos',async()=>{await service.loadDeposits(pool);return 'Depósitos consultados. Selecione a Matriz e o Full de cada canal.';});
  action('/configuracao',async req=>{
    const model=await service.state(pool);
    await service.saveSettings(pool,{matriz:req.body.matriz,full:Object.fromEntries(model.marketplaces.map((m,i)=>[m,req.body['full_'+i]]))});
    return 'Depósitos salvos. A próxima atualização usará esta configuração.';
  });
  action('/atualizar',async()=>{await service.startSync(pool);return 'Atualização iniciada. O andamento aparecerá abaixo.';});
  return router;
}
module.exports={createRouter,render};
