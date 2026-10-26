const express=require('express'),s=require('./service'),views=require('./views'),ui=require('../services/ui-executivo');
const uuid=v=>/^[a-f0-9-]{36}$/i.test(String(v));
function pages(profile){return ui.visible(profile).flatMap(a=>a.pages.map(p=>({url:p[1],label:p[0]==='Visão geral'?a.name+' — Visão geral':p[0]}))).filter((p,i,list)=>list.findIndex(x=>x.url===p.url)===i);}
function createRouter({pool,protect,renderShell,downloads}){
 const router=express.Router();let schema;
 const ensure=()=>schema ||= s.ensure(pool).catch(e=>{schema=null;throw e;});
 router.use(['/visao-geral','/painel'],protect,(req,res,next)=>['ADMIN','USUARIO','CONTADOR'].includes(req.session.usuario?.perfil)?next():res.sendStatus(403));
 const run=fn=>async(req,res)=>{try{await ensure();res.set('Cache-Control','no-store');await fn(req,res);}catch(e){console.error('[Painel]',e.message);if(req.method==='GET')return res.status(e.status||400).send(renderShell(req,{titulo:'Painel',navegacaoSuperior:true},views.error(e.message)));res.status(e.status||400).json({error:e.code==='23505'?'Já existe um registro com estes dados. Atualize a página antes de continuar.':e.message});}};
 const csrf=(req,res,next)=>req.session.aparenciaToken&&(req.headers['x-painel-token']||req.body.token)===req.session.aparenciaToken?next():res.status(403).json({error:'Atualize a página antes de salvar.'});
 async function data(req){
  const user=await s.context(pool,req.session.usuario),p=s.period(req.query.periodo,req.query.data||s.today()),max=s.addDays(s.today(),366);if(p.end>max)throw Error('Consulte até um ano à frente.');
  await s.generate(pool,p.end>s.today()?p.end:s.today());
  const [directory,tasks,files,notices]=await Promise.all([s.users(pool),s.load(pool,user),downloads(),s.notices(pool,user)]);
  const recipients=directory.filter(p=>user.team.includes(p.id)),related=new Set(tasks.flatMap(t=>[String(t.criador),String(t.responsavel)])),people=directory.filter(p=>user.team.includes(p.id)||related.has(p.id));
  let priceSummary=null,priceError=false;
  if(req.path==='/visao-geral'&&['ADMIN','USUARIO'].includes(user.perfil))try{const pricing=require('../tabela-precos/service');priceSummary=pricing.reviewSummary(await pricing.marketplaceRows(pool,{}));}catch(error){priceError=true;console.error('[Painel preços]',error.message);}
  let task=null,events=[];
  if(req.query.tarefa){task=tasks.find(t=>t.id===req.query.tarefa);if(!task||!s.canRead(user,task))throw Object.assign(Error('Tarefa não encontrada.'),{status:404});events=(await pool.query('SELECT * FROM painel_eventos WHERE tarefa=$1 ORDER BY criado_em,id',[task.id])).rows;}
  const personId=String(req.query.pessoa||task?.responsavel||user.id);
  const permitted=user.perfil==='ADMIN'&&user.team.includes(personId)||personId===String(user.id)||tasks.some(t=>String(t.criador)===String(user.id)&&String(t.responsavel)===personId);
  if(!permitted)throw Object.assign(Error('Acesso não autorizado às tarefas desta pessoa.'),{status:403});
  const person=people.find(p=>p.id===personId);if(!person)throw Object.assign(Error('Pessoa não encontrada.'),{status:404});
  if(task&&String(task.responsavel)!==personId)throw Object.assign(Error('Tarefa não pertence a esta pessoa.'),{status:404});
  return {user,people,recipients,tasks,files,notices,priceSummary,priceError,task,events,person,scope:req.query.escopo==='acompanho'?'acompanho':'minhas',period:p,token:ui.token(req),pages:pages(user)};
 }
 router.get('/visao-geral',run(async(req,res)=>res.send(renderShell(req,{titulo:'Painel',navegacaoSuperior:true},views.panel(await data(req))))));
 router.get('/painel/usuario/:id',run(async(req,res)=>{const m=await data(req);if(!(m.user.perfil==='ADMIN'&&m.user.team.includes(req.params.id))&&String(m.user.id)!==req.params.id&&!m.tasks.some(t=>String(t.criador)===String(m.user.id)&&t.responsavel===req.params.id))return res.sendStatus(403);res.redirect('/painel/agenda?pessoa='+encodeURIComponent(req.params.id)+'&periodo='+m.period.mode+'&data='+m.period.date);}));
 router.get('/painel/avisos/:id',run(async(req,res)=>{const m=await data(req);if(!(m.user.perfil==='ADMIN'&&m.user.team.includes(req.params.id))&&String(m.user.id)!==req.params.id)return res.sendStatus(403);const person=m.people.find(x=>x.id===req.params.id);if(!person)return res.sendStatus(404);res.send(renderShell(req,{titulo:'Avisos',navegacaoSuperior:true},views.alerts({...m,person})));}));
 router.get('/painel/tarefa/:id',run(async(req,res)=>{if(!uuid(req.params.id))return res.sendStatus(404);const m=await data(req),t=m.tasks.find(x=>x.id===req.params.id);if(!t||!s.canRead(m.user,t))return res.sendStatus(404);res.redirect('/painel/agenda?pessoa='+encodeURIComponent(t.responsavel)+'&tarefa='+t.id+'&periodo='+m.period.mode+'&data='+m.period.date);}));
 router.get('/painel/agenda',run(async(req,res)=>res.send(renderShell(req,{titulo:'Agenda e tarefas',navegacaoSuperior:true},views.agenda(await data(req))))));
 router.post('/painel/tarefas',csrf,run(async(req,res)=>{const id=await s.create(pool,req.session.usuario,req.body,p=>pages(p).map(x=>x.url));await s.generate(pool,req.body.inicio>s.today()?req.body.inicio:s.today());const task=(await pool.query('SELECT id FROM painel_tarefas WHERE rotina=$1 ORDER BY prazo LIMIT 1',[id])).rows[0];res.json({ok:true,url:task?'/painel/tarefa/'+task.id:'/painel/agenda'});}));
 router.post('/painel/tarefa/:id',csrf,run(async(req,res)=>{await s.change(pool,req.session.usuario,req.params.id,req.body);res.json({ok:true,...(['excluir','delegar'].includes(req.body.acao)?{url:'/painel/agenda'}:{})});}));
 router.get('/painel/equipes',run(async(req,res)=>{if(req.session.usuario.perfil!=='ADMIN')return res.sendStatus(403);const m=await data(req);res.send(renderShell(req,{titulo:'Equipes',navegacaoSuperior:true},views.teams({...m,settings:await s.teamSettings(pool,req.session.usuario)})));}));
 router.post('/painel/equipes',csrf,run(async(req,res)=>{await s.saveTeam(pool,req.session.usuario,req.body);res.json({ok:true});}));
 router.get('/painel/notificacoes',run(async(req,res)=>res.json({items:await s.notices(pool,req.session.usuario)})));
 router.post('/painel/notificacao/:id/lida',csrf,run(async(req,res)=>{if(!uuid(req.params.id))return res.sendStatus(404);const result=await pool.query('UPDATE painel_notificacoes SET lida_em=NOW() WHERE id=$1 AND usuario=$2 RETURNING id',[req.params.id,String(req.session.usuario.id)]);if(!result.rowCount)return res.sendStatus(404);res.json({ok:true});}));
 router.post('/painel/rotina/:id/pausar',csrf,run(async(req,res)=>{if(!uuid(req.params.id))return res.sendStatus(404);await s.pause(pool,req.session.usuario,req.params.id);res.json({ok:true});}));
 router.get('/painel/favoritos',run(async(req,res)=>{const options=pages(req.session.usuario);const r=(await pool.query('SELECT urls FROM painel_favoritos WHERE usuario=$1',[String(req.session.usuario.id)])).rows[0];res.json({options,selected:(r?.urls||[]).filter(url=>options.some(p=>p.url===url))});}));
 router.post('/painel/favoritos',csrf,run(async(req,res)=>{const options=pages(req.session.usuario),urls=req.body.urls;if(!Array.isArray(urls)||urls.length>30||urls.some(url=>typeof url!=='string'||!options.some(p=>p.url===url)))throw Error('Escolha até 30 telas disponíveis para seu perfil.');await pool.query('INSERT INTO painel_favoritos(usuario,urls) VALUES($1,$2) ON CONFLICT(usuario) DO UPDATE SET urls=EXCLUDED.urls,atualizado_em=NOW()',[String(req.session.usuario.id),JSON.stringify([...new Set(urls)])]);res.json({ok:true});}));
 return router;
}
module.exports={createRouter,pages};
