const express=require('express'),s=require('./service'),views=require('./views'),ui=require('../services/ui-executivo');
const uuid=v=>/^[a-f0-9-]{36}$/i.test(String(v));
function pages(profile){return ui.visible(profile).flatMap(a=>a.pages.map(p=>({url:p[1],label:p[0]==='Visão geral'?a.name+' — Visão geral':p[0]}))).filter((p,i,list)=>list.findIndex(x=>x.url===p.url)===i);}
function createRouter({pool,protect,renderShell,downloads}){
 const router=express.Router();let schema;
 const ensure=()=>schema ||= s.ensure(pool).catch(e=>{schema=null;throw e;});
 router.use(['/visao-geral','/painel'],protect,(req,res,next)=>['ADMIN','USUARIO','CONTADOR'].includes(req.session.usuario?.perfil)?next():res.sendStatus(403));
 const run=fn=>async(req,res)=>{try{await ensure();res.set('Cache-Control','no-store');await fn(req,res);}catch(e){console.error('[Painel]',e.message);if(req.path==='/visao-geral')return res.status(e.status||400).send(renderShell(req,{titulo:'Painel',navegacaoSuperior:true},views.error(e.message)));res.status(e.status||400).json({error:e.message});}};
 const csrf=(req,res,next)=>req.session.aparenciaToken&&(req.headers['x-painel-token']||req.body.token)===req.session.aparenciaToken?next():res.status(403).json({error:'Atualize a página antes de salvar.'});
 async function data(req){
  const user=req.session.usuario,p=s.period(req.query.periodo,req.query.data||s.today()),max=s.addDays(s.today(),366);if(p.end>max)throw Error('Consulte até um ano à frente.');
  await s.generate(pool,p.end>s.today()?p.end:s.today());
  const [people,tasks,files]=await Promise.all([s.users(pool),s.load(pool,user),downloads()]);
  return {user,people,tasks,files,scope:req.query.escopo==='acompanho'?'acompanho':'minhas',period:p,token:ui.token(req),pages:pages(user.perfil)};
 }
 router.get('/visao-geral',run(async(req,res)=>res.send(renderShell(req,{titulo:'Painel',navegacaoSuperior:true},views.panel(await data(req))))));
 router.get('/painel/usuario/:id',run(async(req,res)=>{const m=await data(req);if(m.user.perfil!=='ADMIN'&&String(m.user.id)!==req.params.id)return res.sendStatus(403);const person=m.people.find(x=>x.id===req.params.id);if(!person)return res.sendStatus(404);res.send(renderShell(req,{titulo:'Tarefas de '+person.nome,navegacaoSuperior:true},views.person({...m,person})));}));
 router.get('/painel/avisos/:id',run(async(req,res)=>{const m=await data(req);if(m.user.perfil!=='ADMIN'&&String(m.user.id)!==req.params.id)return res.sendStatus(403);const person=m.people.find(x=>x.id===req.params.id);if(!person)return res.sendStatus(404);res.send(renderShell(req,{titulo:'Avisos',navegacaoSuperior:true},views.alerts({...m,person})));}));
 router.get('/painel/tarefa/:id',run(async(req,res)=>{if(!uuid(req.params.id))return res.sendStatus(404);const m=await data(req),t=m.tasks.find(x=>x.id===req.params.id);if(!t||!s.canRead(m.user,t))return res.sendStatus(404);const events=(await pool.query('SELECT * FROM painel_eventos WHERE tarefa=$1 ORDER BY criado_em,id',[t.id])).rows;res.send(renderShell(req,{titulo:t.titulo,navegacaoSuperior:true},views.detail({...m,task:t,events})));}));
 router.get('/painel/agenda',run(async(req,res)=>res.send(renderShell(req,{titulo:'Agenda e tarefas',navegacaoSuperior:true},views.agenda(await data(req))))));
 router.post('/painel/tarefas',csrf,run(async(req,res)=>{const id=await s.create(pool,req.session.usuario,req.body,p=>pages(p).map(x=>x.url));await s.generate(pool,req.body.inicio>s.today()?req.body.inicio:s.today());const task=(await pool.query('SELECT id FROM painel_tarefas WHERE rotina=$1 ORDER BY prazo LIMIT 1',[id])).rows[0];res.json({ok:true,url:task?'/painel/tarefa/'+task.id:'/painel/agenda'});}));
 router.post('/painel/tarefa/:id',csrf,run(async(req,res)=>{await s.change(pool,req.session.usuario,req.params.id,req.body);res.json({ok:true});}));
 router.post('/painel/rotina/:id/pausar',csrf,run(async(req,res)=>{if(!uuid(req.params.id))return res.sendStatus(404);await s.pause(pool,req.session.usuario,req.params.id);res.json({ok:true});}));
 router.get('/painel/favoritos',run(async(req,res)=>{const options=pages(req.session.usuario.perfil);const r=(await pool.query('SELECT urls FROM painel_favoritos WHERE usuario=$1',[String(req.session.usuario.id)])).rows[0];res.json({options,selected:(r?.urls||[]).filter(url=>options.some(p=>p.url===url))});}));
 router.post('/painel/favoritos',csrf,run(async(req,res)=>{const options=pages(req.session.usuario.perfil),urls=req.body.urls;if(!Array.isArray(urls)||urls.length>30||urls.some(url=>typeof url!=='string'||!options.some(p=>p.url===url)))throw Error('Escolha até 30 telas disponíveis para seu perfil.');await pool.query('INSERT INTO painel_favoritos(usuario,urls) VALUES($1,$2) ON CONFLICT(usuario) DO UPDATE SET urls=EXCLUDED.urls,atualizado_em=NOW()',[String(req.session.usuario.id),JSON.stringify([...new Set(urls)])]);res.json({ok:true});}));
 return router;
}
module.exports={createRouter,pages};
