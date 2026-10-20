const express=require('express'),multer=require('multer'),fs=require('fs/promises'),path=require('path'),crypto=require('crypto');
const service=require('../services/compras-estoque');
const {renderPage}=require('../views/compras-estoque');
function createRouter({pool,protect,renderShell,uploadsDir}) {
 const router=express.Router(),upload=multer({storage:multer.memoryStorage(),limits:{fileSize:15*1024*1024,files:2}}),root=path.resolve(uploadsDir,'.compras-estoque');
 const run=fn=>async(req,res)=>{try{await fn(req,res)}catch(e){console.error('Compras estoque:',e.message);res.status(e.code?500:400).json({error:e.code?'Não foi possível concluir a operação.':e.message})}};
 router.use(protect);
 const csrf=(req,res,next)=>{if(req.session.usuario?.perfil==='CONTADOR')return res.status(403).json({error:'Acesso somente para consulta.'});if(req.headers['x-compras-token']!==req.session.comprasToken||!req.session.comprasToken)return res.status(403).json({error:'Atualize a página antes de salvar.'});next()};
 router.get('/',(req,res)=>{req.session.comprasToken ||= crypto.randomBytes(24).toString('hex');res.send(renderShell(req,{titulo:'Gestão de Compras',subtitulo:'Arquivo NF de compras de estoque e planos de pagamento.',paginaAtual:'ferramentas-ia',navegacaoSuperior:true},renderPage(req.session.comprasToken,req.session.usuario?.perfil==='CONTADOR')))});
 router.get('/fornecedores',run(async(req,res)=>{
  await service.ensure(pool);
  const result=await pool.query(`SELECT DISTINCT ON (COALESCE(NULLIF(dados->>'document',''),dados->>'supplier')) id, COALESCE(NULLIF(dados->>'document',''),dados->>'supplier') AS key, dados->>'supplier' AS name FROM compras_estoque_nf ORDER BY COALESCE(NULLIF(dados->>'document',''),dados->>'supplier'), criado_em DESC`);
  const rows=await Promise.all(result.rows.map(async row=>{
   let xml;
   if(/sociedade b[ií]blica do brasil/i.test(row.name)&&/^[a-f0-9]{64}$/.test(row.id))try{xml=await fs.readFile(path.join(root,row.id+'.xml'));}catch{}
   try{return {key:row.key,name:await require('../services/codificador-fornecedor').supplierLabel(row.name,row.key,xml)}}catch{return {key:row.key,name:row.name+' - CNPJ '+row.key}}
  }));
  rows.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));res.json(rows);
 }));
 router.get('/buscar-nota',run(async(req,res)=>{await service.ensure(pool);const supplier=String(req.query.fornecedor||'').trim(),number=String(req.query.numero||'').trim();if(!supplier||supplier.length>200||!/^\d{1,9}$/.test(number))throw Error('Selecione o fornecedor e informe o número da NF, somente com dígitos.');const result=await pool.query(`SELECT id, dados->>'number' AS number, dados->>'supplier' AS supplier, dados->>'total' AS total FROM compras_estoque_nf WHERE COALESCE(NULLIF(dados->>'document',''),dados->>'supplier')=$1 AND COALESCE(NULLIF(regexp_replace(dados->>'number','^0+',''),''),'0')=$2 LIMIT 2`,[supplier,number.replace(/^0+/,'')||'0']);if(!result.rows.length)throw Error('NF não encontrada para esse fornecedor. Confira o número ou arquive o par PDF/XML.');if(result.rows.length>1)throw Error('Há mais de uma NF com esse número para o fornecedor. Confira as séries no Arquivo de Compras.');res.json({...result.rows[0],total:Number(result.rows[0].total)})}));
 router.get('/notas',run(async(req,res)=>res.json(await service.list(pool))));
 router.get('/arquivo/:id/:tipo',run(async(req,res)=>{if(!['pdf','xml'].includes(req.params.tipo)||!/^[a-f0-9]{64}$/.test(req.params.id))throw Error('Arquivo inválido.');await service.ensure(pool);const result=await pool.query('SELECT dados FROM compras_estoque_nf WHERE id=$1',[req.params.id]);if(!result.rows.length)return res.status(404).send('NF não encontrada.');res.type(req.params.tipo==='pdf'?'pdf':'application/xml');res.setHeader('Content-Disposition',`${req.params.tipo==='pdf'?'inline':'attachment'}; filename="NF-${result.rows[0].dados.number}.${req.params.tipo}"`);res.sendFile(path.join(root,req.params.id+'.'+req.params.tipo),{dotfiles:'allow'})}));
 router.post('/upload',csrf,(req,res,next)=>upload.fields([{name:'pdf',maxCount:1},{name:'xml',maxCount:1}])(req,res,e=>e?res.status(400).json({error:'Envie um PDF e um XML, até 15 MB cada.'}):next()),run(async(req,res)=>{
   const pdf=req.files?.pdf?.[0],xml=req.files?.xml?.[0];
   if(!pdf||!xml||!pdf.buffer.subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('Selecione o par: PDF válido e XML da NF-e.');
   const invoice=await service.parseInvoice(xml.buffer),plan=service.validatePlan(JSON.parse(req.body.plan||'{}'),invoice.total),id=crypto.createHash('sha256').update(invoice.key).digest('hex');
   await service.ensure(pool);await fs.mkdir(root,{recursive:true});
   const db=await pool.connect();let wrote=false;
   try {await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['conciliacao:vinculos']);const duplicate=await db.query('SELECT id FROM compras_estoque_nf WHERE chave=$1',[invoice.key]);if(duplicate.rows.length)throw Error('Esta NF já está arquivada. Abra o plano de pagamento para alterar.');await fs.writeFile(path.join(root,id+'.pdf'),pdf.buffer,{flag:'wx'});wrote=true;await fs.writeFile(path.join(root,id+'.xml'),xml.buffer,{flag:'wx'});await db.query('INSERT INTO compras_estoque_nf (id,chave,dados) VALUES ($1,$2,$3::jsonb)',[id,invoice.key,JSON.stringify({...invoice,plan,uploadedBy:req.session.usuario.id,uploadedAt:new Date().toISOString()})]);await db.query('COMMIT');res.json({message:'Par PDF/XML arquivado com plano de pagamento.'})}catch(e){await db.query('ROLLBACK');if(wrote){await fs.rm(path.join(root,id+'.pdf'),{force:true});await fs.rm(path.join(root,id+'.xml'),{force:true})}throw e}finally{db.release()}
 }));
 router.post('/plano/:id',csrf,run(async(req,res)=>{
  await service.ensure(pool);const db=await pool.connect();try{await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['conciliacao:vinculos']);const result=await db.query('SELECT dados FROM compras_estoque_nf WHERE id=$1 FOR UPDATE',[req.params.id]);if(!result.rows.length)throw Error('NF não encontrada.');const data=result.rows[0].dados,plan=service.validatePlan(req.body,data.total),invoices=await service.list(db),current=invoices.find(n=>n.id===req.params.id);
  for(const link of current.links){const part=plan.parts.flatMap(p=>p.method==='Cartão'?[]:p.installments).find(p=>p.id===link.partId);if(!part||current.links.filter(l=>l.partId===part.id).reduce((s,l)=>s+l.amount,0)>part.amount)throw Error('O plano não pode remover ou reduzir uma parcela com pagamentos vinculados. Desvincule na conciliação antes de alterar.');}
  await db.query('UPDATE compras_estoque_nf SET dados=$2::jsonb WHERE id=$1',[req.params.id,JSON.stringify({...data,plan})]);await db.query('COMMIT');res.json({message:'Plano atualizado.'})}catch(e){await db.query('ROLLBACK');throw e}finally{db.release()}
 }));
 return router;
}
module.exports={createRouter};
