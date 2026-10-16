const express=require('express');
const multer=require('multer');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const s=require('./service');
const views=require('./views');
const ui=require('../services/ui-executivo');
function createRouter({pool,protect,renderShell,uploadsDir}){
 const router=express.Router();const directory=path.join(uploadsDir,'fechamentos');
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:15*1024*1024,files:4,fields:10}});
 let schema;const ensure=()=>schema ||= s.ensure(pool).catch(e=>{schema=null;throw e;});
 const actor=req=>`${req.session.usuario.id} • ${req.session.usuario.nome||req.session.usuario.perfil}`;
 const run=fn=>async(req,res,next)=>{try{await ensure();await fn(req,res,next);}catch(e){console.error('[Fechamento]',e.message);const status=e.status||400;if(req.path.includes('/importar')||req.path.includes('/salvar'))return res.status(status).json({error:e.message});return res.status(status).send(renderShell(req,{titulo:'Fechamento mensal',navegacaoSuperior:true},views.base('Não foi possível concluir',`<div class="fx-notice error">${ui.esc(e.message)}</div><a href="/contabil">Voltar ao Contábil</a>`)));}};
 router.use(protect,(req,res,next)=>['ADMIN','USUARIO','CONTADOR'].includes(req.session.usuario?.perfil)?next():res.sendStatus(403));
 router.use(['/contabil/fechamento','/contabil/historico'],(req,res,next)=>['ADMIN','CONTADOR'].includes(req.session.usuario.perfil)?next():res.status(403).send('Acesso restrito a administradores e contador.'));
 const operator=(req,res,next)=>req.session.usuario.perfil==='CONTADOR'?res.status(403).json({error:'Acesso somente para consulta.'}):next();
 const csrf=(req,res,next)=>{if(!req.session.fechamentoToken||req.headers['x-fechamento-token']!==req.session.fechamentoToken)return res.status(403).json({error:'Atualize a página antes de salvar.'});next();};
 const month=req=>{const m=req.query.mes||req.body?.month||s.lastClosedMonth();if(!s.monthValid(m))throw new Error('Competência inválida.');return m;};
 const row=async m=>(await pool.query('SELECT * FROM fechamentos_mensais WHERE mes=$1',[m])).rows[0];
 const allowed=async req=>{const m=month(req),r=await row(m);if(req.session.usuario.perfil==='CONTADOR'&&r?.status!=='fechado')return {m,r:null};return {m,r};};
 function html(req,res,title,body){return res.send(renderShell(req,{titulo:title,paginaAtual:'espaco-contador',navegacaoSuperior:true},body));}
 async function exists(table){return !!(await pool.query('SELECT to_regclass($1) AS name',[table])).rows[0]?.name;}
 async function overview(req,res,area){
 const profile=req.session.usuario.perfil;if(profile==='CONTADOR'&&!['inicio','contabil'].includes(area))return res.sendStatus(403);
 if(area==='admin'&&profile!=='ADMIN')return res.sendStatus(403);
 const canSeeClosing=['ADMIN','CONTADOR'].includes(profile);
 const latest=canSeeClosing?(await pool.query("SELECT mes FROM fechamentos_mensais WHERE status='fechado' ORDER BY mes DESC LIMIT 1")).rows[0]?.mes:null;
 const m=req.query.mes||latest||s.lastClosedMonth();if(!s.monthValid(m))throw new Error('Competência inválida.');
 const year=String(req.query.ano||m.slice(0,4));if(!/^20\d{2}$/.test(year))throw new Error('Ano inválido.');
 const mode=['anual','personalizado'].includes(req.query.visao)?req.query.visao:'mensal';
 const selectedMonths=s.period({mode,month:m,year,months:req.query.meses||[]});
 const closedRows=canSeeClosing?(await pool.query("SELECT * FROM fechamentos_mensais WHERE status='fechado' AND mes=ANY($1::text[]) ORDER BY mes",[selectedMonths])).rows:[];
 const data=s.aggregate(closedRows),closed={data,count:closedRows.length,through:data.through,rows:closedRows};

 let categories=[],suppliers=[],live={};
 if(canSeeClosing&&['inicio','financeiro','contabil'].includes(area)){
 categories=(await pool.query(`SELECT COALESCE(p.nome,c.nome,'Sem categoria') AS nome,COUNT(*)::int AS quantidade,COALESCE(SUM(l.valor),0) AS total FROM lancamentos l LEFT JOIN categorias c ON c.id=l.categoria_id LEFT JOIN categorias p ON p.id=c.categoria_pai_id WHERE to_char(l.data_despesa,'YYYY-MM')=ANY($1::text[]) GROUP BY COALESCE(p.nome,c.nome,'Sem categoria') ORDER BY total DESC`,[selectedMonths])).rows;
 suppliers=(await pool.query(`SELECT COALESCE(NULLIF(TRIM(fornecedor),''),'Sem fornecedor') AS nome,COUNT(*)::int AS quantidade,COALESCE(SUM(valor),0) AS total FROM lancamentos WHERE to_char(data_despesa,'YYYY-MM')=ANY($1::text[]) GROUP BY fornecedor ORDER BY total DESC LIMIT 10`,[selectedMonths])).rows;
 }
 if(area==='compras'&&await exists('compras_estoque_nf')){const r=(await pool.query("SELECT COUNT(*)::int AS count,COALESCE(SUM((dados->>'total')::numeric),0) AS total FROM compras_estoque_nf WHERE LEFT(dados->>'date',7)=ANY($1::text[])",[selectedMonths])).rows[0];live.invoiceCount=r.count;live.invoiceTotal=Number(r.total);}
 if(area==='precos'){if(await exists('tabela_preco_produtos'))live.products=(await pool.query('SELECT COUNT(*)::int AS total FROM tabela_preco_produtos')).rows[0].total;if(await exists('tabela_preco_vinculos'))live.links=(await pool.query('SELECT COUNT(*)::int AS total FROM tabela_preco_vinculos')).rows[0].total;}
 if(area==='integracoes'&&await exists('bling_integracao')){const r=(await pool.query('SELECT ultima_sincronizacao, refresh_token IS NOT NULL AS conectado FROM bling_integracao WHERE id=1')).rows[0];live.blingDate=r?.ultima_sincronizacao;live.blingConnected=r?.conectado;}
 if(area==='admin'){live.users=(await pool.query('SELECT COUNT(*)::int AS total FROM usuarios')).rows[0].total;live.categories=(await pool.query('SELECT COUNT(*)::int AS total FROM categorias')).rows[0].total;}
 return html(req,res,'Visão geral',views.dashboard({area,month:m,year,mode,selectedMonths,canSeeClosing,closed,categories,suppliers,live,action:req.path}));
 }
 for(const [url,area] of [['/visao-geral','inicio'],['/financeiro','financeiro'],['/contabil','contabil'],['/compras','compras'],['/precos','precos'],['/integracoes','integracoes'],['/administracao','admin']])router.get(url,run((req,res)=>overview(req,res,area)));
 router.get('/contabil/fechamento',run(async(req,res)=>{
 const {m,r}=await allowed(req);req.session.fechamentoToken ||= crypto.randomBytes(24).toString('hex');
 let files=(await pool.query('SELECT * FROM fechamento_arquivos WHERE mes=$1 ORDER BY criado_em DESC',[m])).rows;
 let events=(await pool.query('SELECT acao,usuario,criado_em,dados FROM fechamento_eventos WHERE mes=$1 ORDER BY criado_em DESC LIMIT 100',[m])).rows;
 if(req.session.usuario.perfil==='CONTADOR'){const ids=Object.values(r?.dados?.sourceFiles||{});files=files.filter(f=>ids.includes(f.id));events=r?events.filter(e=>!['importar'].includes(e.acao)):[];}
 const expense=(await pool.query('SELECT COALESCE(SUM(valor),0) AS total FROM lancamentos WHERE data_despesa >= $1::date AND data_despesa < $1::date + INTERVAL \'1 month\'',[m+'-01'])).rows[0]?.total||0;
 html(req,res,'Fechamento mensal',views.editor({month:m,row:r,files,events,expenses:s.cents(Number(expense)),token:req.session.fechamentoToken,readonly:req.session.usuario.perfil==='CONTADOR'}));
 }));
 router.post('/contabil/fechamento/importar',operator,csrf,(req,res,next)=>upload.fields(['dre',...Object.keys(s.DEPOSITS)].map(name=>({name,maxCount:1})))(req,res,e=>e?res.status(400).json({error:'Envie até quatro planilhas Excel, com no máximo 15 MB cada.'}):next()),run(async(req,res)=>{
 const m=String(req.body.month||'');if(!s.monthValid(m)||m>s.lastClosedMonth())throw new Error('Selecione um mês já encerrado.');if(req.files?.dre?.length&&req.body.completeDre!=='true')throw new Error('Confirme o ano e o período completo do DRE.');if(Object.keys(s.DEPOSITS).some(k=>req.files?.[k]?.length)&&req.body.confirmed!=='true')throw new Error('Confirme a data e o critério dos arquivos de estoque enviados.');
 const entries=Object.entries(req.files||{});if(!entries.length)throw new Error('Escolha pelo menos uma planilha.');fs.mkdirSync(directory,{recursive:true});const parsed=[],created=[];
 try{
 for(const [type,list] of entries){const f=list[0],ext=path.extname(f.originalname).toLowerCase();if(!['.xls','.xlsx'].includes(ext))throw new Error('Use arquivos .xls ou .xlsx.');
 const id=crypto.randomUUID(),name=id+ext,filePath=path.join(directory,name);fs.writeFileSync(filePath,f.buffer,{flag:'wx'});created.push(filePath);
 const sheets=await s.readSpreadsheet(filePath),extracted=type==='dre'?s.parseDre(sheets,m,{confirmedYear:m.slice(0,4)}):s.parseStock(sheets);parsed.push({id,type,name,original:path.basename(f.originalname).slice(0,250),sha:crypto.createHash('sha256').update(f.buffer).digest('hex'),extracted});}
 const db=await pool.connect();try{await db.query('BEGIN');for(const f of parsed)await db.query('INSERT INTO fechamento_arquivos (id,mes,tipo,nome_original,nome_arquivo,sha256,extraido,usuario) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)',[f.id,m,f.type,f.original,f.name,f.sha,JSON.stringify(f.extracted),actor(req)]);await db.query('INSERT INTO fechamento_eventos (mes,acao,usuario,dados) VALUES ($1,$2,$3,$4::jsonb)',[m,'importar',actor(req),JSON.stringify({files:parsed.map(f=>({id:f.id,type:f.type,name:f.original}))})]);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 res.json({files:parsed.map(f=>({id:f.id,type:f.type,name:f.original,extracted:f.extracted}))});
 }catch(e){for(const f of created)try{fs.unlinkSync(f);}catch{}throw e;}
 }));
 router.post('/contabil/fechamento/salvar',operator,csrf,run(async(req,res)=>{
 const input=req.body,m=input.month;const data=s.validate(input.data||{});const ids=input.sourceFiles||{};const refs={};const originals={};
 if(Object.keys(ids).some(k=>!['dre',...Object.keys(s.DEPOSITS)].includes(k)))throw new Error('Fonte inválida.');
 for(const [type,id] of Object.entries(ids)){if(!id)continue;const f=(await pool.query('SELECT * FROM fechamento_arquivos WHERE id=$1 AND mes=$2 AND tipo=$3',[id,m,type])).rows[0];if(!f)throw new Error('Arquivo original não corresponde ao mês/depósito.');refs[type]=id;originals[type]=f.extraido;}
 data.sourceFiles=refs;data.sourceNotes=originals;
 const result=await s.save(pool,{month:m,data,status:input.status,version:input.version,user:actor(req),reason:input.reason});res.json({version:result.versao,status:result.status});
 }));
 router.get('/contabil/historico',run(async(req,res)=>{const year=String(req.query.ano||new Date().getFullYear());if(!/^20\d{2}$/.test(year))throw new Error('Ano inválido.');const rows=(await pool.query(`SELECT * FROM fechamentos_mensais WHERE mes LIKE $1 ${req.session.usuario.perfil==='CONTADOR'?"AND status='fechado'":''} ORDER BY mes DESC`,[year+'-%'])).rows;html(req,res,'Histórico mensal',views.history(rows,year));}));
 router.get('/contabil/fechamento/arquivo/:id',run(async(req,res)=>{const f=(await pool.query('SELECT * FROM fechamento_arquivos WHERE id=$1',[req.params.id])).rows[0];if(!f)return res.sendStatus(404);if(req.session.usuario.perfil==='CONTADOR'){const r=await row(f.mes);if(r?.status!=='fechado'||!Object.values(r.dados.sourceFiles||{}).includes(f.id))return res.sendStatus(403);}const file=path.join(directory,path.basename(f.nome_arquivo));if(!fs.existsSync(file))return res.sendStatus(404);res.download(file,f.nome_original,error=>{if(!error)pool.query('INSERT INTO fechamento_eventos (mes,acao,usuario,dados) VALUES ($1,$2,$3,$4::jsonb)',[f.mes,'download original',actor(req),JSON.stringify({fileId:f.id})]).catch(e=>console.error('[Download fechamento]',e.message));});}));
 router.get('/contabil/fechamento/exportar',run(async(req,res)=>{const year=String(req.query.ano||new Date().getFullYear());if(!/^20\d{2}$/.test(year))throw new Error('Ano inválido.');const rows=(await pool.query(`SELECT * FROM fechamentos_mensais WHERE mes LIKE $1 ${req.session.usuario.perfil==='CONTADOR'?"AND status='fechado'":''} ORDER BY mes`,[year+'-%'])).rows;const wb=s.workbook(rows),buffer=await wb.xlsx.writeBuffer();for(const r of rows)await pool.query('INSERT INTO fechamento_eventos (mes,acao,usuario,dados) VALUES ($1,$2,$3,$4::jsonb)',[r.mes,'download fechamento anual',actor(req),JSON.stringify({year,months:rows.map(r=>r.mes)})]);res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.set('Content-Disposition',`attachment; filename="Fechamentos-${year}.xlsx"`);res.send(Buffer.from(buffer));}));
 return router;
}
module.exports={createRouter};
