const express=require('express');
const crypto=require('crypto');
const archiver=require('archiver');
const esc=require('escape-html');
const service=require('./shopee-nfe');
const client=require('./shopee-nfe-client');
const {permitted,actionFor}=require('../access/catalog');
const {ROOT}=client;
const validId=id=>/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id);
function allowed(user,action='view'){return permitted(user,'shopee-nfe','view')===true&&(action==='view'||permitted(user,'shopee-nfe',action)===true);}
function render(req,model) {
  const user=req.session.usuario,c=client.config(),edit=allowed(user,'edit'),download=allowed(user,'download');
  const csrf=`<input type="hidden" name="csrf" value="${esc(req.session.shopeeNfeCsrf)}">`;
  const active=model.jobs.some(j=>j.status==='executando');
  const states={executando:'Em andamento',concluida:'Consulta concluída',parcial:'Com pendências',falhou:'Falha na consulta'};
  const status=job=>`${esc(states[job.status]||job.status)} · ${esc(job.etapa)}`;
  return `<style>.sn-wrap{max-width:1200px;margin:auto;display:grid;gap:18px;color:#334155}.sn-card{background:#fff;border:1px solid #d9e5df;border-radius:12px;padding:20px;min-width:0}.sn-card h2{margin:0 0 16px;color:#184e3c}.sn-card p{line-height:1.5}.sn-card form,.sn-actions{display:flex;align-items:end;gap:12px;flex-wrap:wrap}.sn-card label{display:grid;gap:6px}.sn-card input,.sn-btn{min-height:40px;border:1px solid #cbdad2;border-radius:7px;padding:9px 13px;font:inherit}.sn-btn{display:inline-block;background:#07543d;color:white;cursor:pointer;text-decoration:none}.sn-btn:disabled{opacity:.45;cursor:default}.sn-soft{background:#e8f2ed;color:#184e3c}.sn-note{background:#fff7e6;padding:12px;border-radius:7px}.sn-scroll{overflow:auto}.sn-card table{width:100%;border-collapse:collapse;font-size:13px}.sn-card th{background:#e8f2ed;text-align:left}.sn-card td,.sn-card th{padding:10px;border-bottom:1px solid #dce5e1;vertical-align:top}.sn-error{color:#b42318}.sn-card small{display:block;margin:8px 0;color:#64748b}</style>
  <div class="sn-wrap"><h1>Shopee Full · NF-e série 5</h1>
  ${model.feedback?`<div class="sn-card" role="status">${esc(model.feedback)}</div>`:''}
  <section class="sn-card"><h2>Conexão com a Shopee</h2><p>${model.connection?'Loja autorizada: '+esc(model.connection.shop_id):'Loja ainda não conectada.'}</p>
  <p>Busca dos XMLs autorizados de entrada e saída emitidos pela Deus é Mais, CNPJ 18.862.388/0001-03, série 5. A consulta inclui remessas e retornos do Full.</p>
  ${c.missing.length?`<p class="sn-note">Configuração necessária no servidor: ${c.missing.map(v=>`<code>${esc(v)}</code>`).join(', ')}.</p>`:''}
  ${user.perfil==='ADMIN'?`<details><summary>Configurar aplicativo existente</summary><p>No servidor, configure SHOPEE_PARTNER_ID, SHOPEE_PARTNER_KEY e SHOPEE_TOKEN_ENCRYPTION_KEY (segredo aleatório com pelo menos 32 caracteres). As chaves não são exibidas nesta tela.</p><p>Cadastre no aplicativo da Shopee o retorno: <code>${esc(c.callback)}</code>. O aplicativo precisa ter acesso às APIs fiscais FBS da loja brasileira. A disponibilidade será confirmada pela primeira consulta.</p></details><form method="post" action="${ROOT}/conectar">${csrf}<button class="sn-btn" ${c.missing.length||active?'disabled':''}>${model.connection?'Reconectar loja':'Conectar Shopee'}</button></form>`:''}
  </section><section class="sn-card"><h2>Buscar notas da competência</h2>
  <p>A competência atual é consultada até hoje. Notas repetidas ficam uma única vez em cada pacote. A situação de cancelamento posterior e a presença no Bling ainda não são conciliadas nesta etapa.</p>
  ${edit?`<form method="post" action="${ROOT}/buscar">${csrf}<label>Competência<input type="month" name="mes" required value="${esc(model.month)}" max="${esc(service.today().slice(0,7))}"></label><button class="sn-btn" ${!model.connection||c.missing.length||active?'disabled':''}>Buscar NF-es</button></form>`:''}
  <small>Esta etapa arquiva documentos; não emite NF-e, não lança estoque/contas e não envia ao Bling.</small></section>
  <section class="sn-card"><h2>Consultas e pacotes para o Bling</h2><div class="sn-scroll"><table><thead><tr><th>Competência</th><th>Resultado</th><th>XMLs / ações</th></tr></thead><tbody>${model.jobs.map(j=>`<tr><td>${esc(j.competencia)}</td><td>${status(j)}<small>Novos: ${Number(j.resumo?.novo||0)} · Repetidos: ${Number(j.resumo?.repetido||0)} · Fora do escopo: ${Number(j.resumo?.ignorado||0)} · Pendências: ${Number(j.resumo?.pendente||0)}</small>
  ${j.diagnostico?.length?`<details><summary>Conferir detalhes</summary><ul>${j.diagnostico.map(d=>`<li>${esc(d.arquivo)}: ${esc(d.motivo)}</li>`).join('')}</ul></details>`:''}</td><td><div class="sn-actions"><a href="${ROOT}?carga=${esc(j.id)}&mes=${esc(j.competencia)}">Ver notas</a>
  ${download?['entrada','saida'].map(t=>`<a class="sn-btn sn-soft" href="${ROOT}/download/${esc(j.id)}/${t}">XMLs de ${t==='entrada'?'entrada':'saída'}</a>`).join(''):''}
  ${edit&&['falhou','executando'].includes(j.status)?`<form method="post" action="${ROOT}/retomar/${esc(j.id)}">${csrf}<button class="sn-btn sn-soft">Retomar consulta</button></form>`:''}</div></td></tr>`).join('')||'<tr><td colspan="3">Nenhuma consulta iniciada.</td></tr>'}</tbody></table></div><p><a href="${ROOT}">Atualizar andamento</a></p>
  <details><summary>Como importar no Bling</summary><p>Baixe e extraia o ZIP. Selecione os arquivos XML originais na importação de XML NF-e da tela correspondente do Bling: entradas em Notas fiscais de entrada; saídas na área de notas de saída. Confira a prévia e as duplicidades do Bling antes de confirmar. Para somente arquivar os documentos, não selecione lançamento de estoque nem de contas.</p><p>O ZIP organiza os arquivos para extração; não depende de o Bling aceitar um ZIP diretamente. Cada pacote inclui um LEIA-ME com o resultado da consulta.</p></details></section>
  ${model.selected?`<section class="sn-card"><h2>Notas de ${esc(model.selected.competencia)}</h2><p>${status(model.selected)}</p><div class="sn-scroll"><table><thead><tr><th>Tipo</th><th>Número</th><th>Emissão</th><th>Natureza</th><th>Valor</th><th>Chave</th></tr></thead><tbody>${model.docs.map(d=>`<tr><td>${esc(d.tipo)}</td><td>${esc(d.numero)}</td><td>${esc(d.emissao.slice(0,10))}</td><td>${esc(d.natureza)}</td><td>${Number(d.valor).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td><td>${esc(d.chave)}</td></tr>`).join('')||'<tr><td colspan="6">Nenhum XML arquivado nesta consulta.</td></tr>'}</tbody></table></div></section>`:''}</div>`;
}
function createRouter(pool,shell) {
  const router=express.Router();let ready;
  router.use(async(req,res,next)=>{
    if(!req.session?.usuario)return res.redirect('/login');
    const action=req.path==='/callback'?'edit':actionFor(req);
    if(!allowed(req.session.usuario,action))return res.status(403).send('Acesso à integração fiscal Shopee não autorizado pela função.');
    if(['/conectar','/callback'].includes(req.path)&&req.session.usuario.perfil!=='ADMIN')return res.status(403).send('Conexão restrita ao administrador.');
    res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');
    req.session.shopeeNfeCsrf ||=crypto.randomBytes(32).toString('hex');
    if(req.method==='POST'&&req.body.csrf!==req.session.shopeeNfeCsrf)return res.status(403).send('Sessão inválida. Atualize a página.');
    try{await(ready ||=service.ensure(pool).catch(e=>{ready=null;throw e;}));next();}catch{res.status(503).send('Integração Shopee indisponível. Tente novamente.');}
  });
  router.get('/',async(req,res)=>{
    try {
      const connection=(await pool.query('SELECT shop_id,atualizado_em FROM shopee_nfe_conexao WHERE id=1')).rows[0];
      const jobs=(await pool.query('SELECT * FROM shopee_nfe_cargas ORDER BY criado_em DESC LIMIT 30')).rows;
      let selected;if(req.query.carga){if(!validId(req.query.carga))return res.status(400).send('Consulta inválida.');selected=(await pool.query('SELECT * FROM shopee_nfe_cargas WHERE id=$1',[req.query.carga])).rows[0];}
      const feedback=req.session.shopeeNfeFeedback;delete req.session.shopeeNfeFeedback;
      let month=service.today().slice(0,7);if(req.query.mes){service.period(req.query.mes);month=req.query.mes;}
      const html=render(req,{connection,jobs,month,selected,docs:selected?await service.documents(pool,selected.id):[],feedback});
      res.send(shell(req,html,{title:'Shopee Full · NF-e',subtitle:'Consulta de XMLs originais da série 5'}));
    }catch{res.status(503).send('Não foi possível consultar as notas da Shopee. Tente novamente.');}
  });
  router.post('/conectar',(req,res)=>{
    try {
      const c=client.config(),state=crypto.randomBytes(32).toString('hex');
      req.session.shopeeNfeAuth={state,at:Date.now(),user:String(req.session.usuario.id)};
      const url=client.authUrl(c,state);req.session.save(err=>err?res.status(503).send('Não foi possível iniciar a conexão.'):res.redirect(url));
    }catch(e){req.session.shopeeNfeFeedback=e.message;res.redirect(ROOT);}
  });
  router.get('/callback',async(req,res)=>{
    const auth=req.session.shopeeNfeAuth;delete req.session.shopeeNfeAuth;
    const state=String(req.query.state||'');
    if(!auth||Date.now()-auth.at>600000||auth.user!==String(req.session.usuario.id)||! /^[a-f0-9]{64}$/.test(state)||state.length!==auth.state.length||!crypto.timingSafeEqual(Buffer.from(state),Buffer.from(auth.state)))return res.status(403).send('Autorização inválida ou expirada. Conecte novamente.');
    try {
      const c=client.config(),shop=client.numericId(req.query.shop_id),code=String(req.query.code||'');
      if(!code||code.length>4096)throw new Error('Código de autorização ausente ou inválido.');
      const data=await new client.Client(c).call('/api/v2/auth/token/get',{code,shop_id:shop,partner_id:client.numericId(c.partnerId)});
      await client.storeTokens(pool,data,shop,c);req.session.shopeeNfeFeedback='Loja Shopee conectada. Inicie a consulta da competência para validar o acesso às NF-es do Full.';
    }catch(e){req.session.shopeeNfeFeedback=e.message;}
    res.redirect(ROOT);
  });
  router.post('/buscar',async(req,res)=>{
    try {const c=client.config();if(c.missing.length)throw new Error('Configure a conexão antes de buscar as notas.');await service.start(pool,req.body.mes,req.session.usuario.id);req.session.shopeeNfeFeedback='Consulta iniciada. Acompanhe o resultado abaixo.';}
    catch(e){req.session.shopeeNfeFeedback=e.message;}res.redirect(ROOT);
  });
  router.post('/retomar/:id',async(req,res)=>{
    if(!validId(req.params.id))return res.status(400).send('Consulta inválida.');
    try {
      const job=(await pool.query('SELECT status FROM shopee_nfe_cargas WHERE id=$1',[req.params.id])).rows[0];
      if(!job)return res.status(404).send('Consulta não encontrada.');
      if(!['falhou','executando'].includes(job.status))throw new Error('Para renovar os XMLs, inicie uma nova consulta da competência.');
      if(client.config().missing.length)throw new Error('Configure a conexão antes de retomar.');
      service.launch(pool,req.params.id);req.session.shopeeNfeFeedback='Consulta retomada; atualize o andamento. Se já estiver em execução, o processamento atual será preservado.';
    }catch(e){req.session.shopeeNfeFeedback=e.message;}res.redirect(ROOT);
  });
  router.get('/download/:id/:tipo',async(req,res)=>{
    if(!validId(req.params.id)||!['entrada','saida'].includes(req.params.tipo))return res.status(400).send('Pacote inválido.');
    try {
      const job=(await pool.query('SELECT * FROM shopee_nfe_cargas WHERE id=$1',[req.params.id])).rows[0];
      if(!job)return res.status(404).send('Consulta não encontrada.');
      if(job.status==='executando')return res.status(409).send('Aguarde o término da consulta antes de baixar.');
      const docs=(await service.documents(pool,job.id)).filter(d=>d.tipo===req.params.tipo);
      if(!docs.length)return res.status(404).send('Nenhum XML desse tipo arquivado nesta consulta. Confira o resultado e as pendências.');
      // Validar todos os arquivos antes de iniciar a resposta, sem gerar ZIP aparentemente completo se faltar um XML.
      const buffers=[];let size=0;
      for(const d of docs){const b=await service.xmlFor(d);size+=b.length;if(size>250*1024*1024)throw new Error('Pacote excede o limite de download.');buffers.push(b);}
      const zip=archiver('zip',{zlib:{level:6}});zip.on('error',()=>res.destroy());
      res.attachment(`shopee-serie5-${job.competencia}-${req.params.tipo}.zip`);zip.pipe(res);
      zip.append(`Plennatec - Shopee Full - Série 5\nCompetência: ${job.competencia}\nResultado: ${job.status}\n${job.etapa}\n${docs.length} XML(s) originais.\nExtrair o ZIP e importar os XMLs na tela de notas de ${req.params.tipo} do Bling.\nNão foram enviados ao Bling nem conciliados com suas notas existentes.\nConfira as duplicidades antes de confirmar. Para somente arquivar, não lançar estoque/contas.\nA busca solicitou documentos autorizados; cancelamentos posteriores não são conciliados nesta etapa.\n`,{name:'LEIA-ME.txt'});
      docs.forEach((d,i)=>zip.append(buffers[i],{name:`${req.params.tipo}/${d.chave}-nfe.xml`}));
      await zip.finalize();
    }catch{if(res.headersSent)res.destroy();else res.status(503).send('Não foi possível preparar todos os XMLs. O pacote não foi gerado; confira a consulta.');}
  });
  return router;
}
module.exports={createRouter,render,allowed};
