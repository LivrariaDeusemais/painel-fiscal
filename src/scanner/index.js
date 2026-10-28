const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const PDFDocument = require('pdfkit');
const {permitted} = require('../access/catalog');
function canScan(user) {
  return !!user && permitted(user,'scanner',true)===true && permitted(user,'scanner')===true && permitted(user,'arquivo',true)===true && permitted(user,'arquivo')===true;
}
function filename(value) {
  const name=String(value||'').normalize('NFC').replace(/\.pdf$/i,'').replace(/[\x00-\x1f/\\:*?"<>|]/g,'').trim().slice(0,100);
  if(!name || name==='.' || name==='..') throw Error('Informe um nome para o documento.');
  return name+'.pdf';
}
function jpegSize(buffer) {
  if(buffer.length<4||buffer[0]!==255||buffer[1]!==216)throw Error('Imagem JPEG inválida.');
  let offset=2;
  while(offset+4<buffer.length){
    if(buffer[offset++]!==255)throw Error('Imagem JPEG inválida.');
    while(buffer[offset]===255)offset++;
    const marker=buffer[offset++];
    if(marker===217||marker===218)break;
    if(marker===1||marker>=208&&marker<=215)continue;
    const length=buffer.readUInt16BE(offset);if(length<2||offset+length>buffer.length)break;
    if([192,193,194].includes(marker)){
      if(length<8)break;
      const h=buffer.readUInt16BE(offset+3),w=buffer.readUInt16BE(offset+5);
      if(w<10||h<10||w>6000||h>6000||w*h>16000000)throw Error('Dimensões da página inválidas ou muito grandes.');
      return {w,h};
    }
    offset+=length;
  }
  throw Error('Imagem JPEG incompleta.');
}
async function buildPdf(files) {
  if(!files?.length || files.length>20) throw Error('Inclua de 1 a 20 páginas.');
  if(files.reduce((total,file)=>total+file.buffer.length,0)>20*1024*1024)throw Error('Documento acima de 20 MB.');
  files.forEach(file=>jpegSize(file.buffer));
  const doc=new PDFDocument({autoFirstPage:false,info:{Creator:'Plennatec — Escâner'}});
  const chunks=[];
  const completion=new Promise((resolve,reject)=>{doc.on('data',c=>chunks.push(c));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));});
  try {
    for(const file of files) {
      if(file.buffer[0]!==255 || file.buffer[1]!==216) throw Error('Página inválida. Capture novamente como imagem.');
      doc.addPage({size:'A4',margin:18});
      doc.image(file.buffer,18,18,{fit:[559.28,805.89],align:'center',valign:'center'});
    }
    doc.end();
  } catch(error) { doc.destroy(); throw Error('Não foi possível gerar o PDF: '+error.message); }
  return completion;
}
function createRouter({pool,uploadsDir,ensureTable,analyze}) {
  const router=express.Router();
  const upload=multer({storage:multer.memoryStorage(),limits:{files:20,fileSize:3*1024*1024,fields:3,fieldSize:400},fileFilter:(req,file,cb)=>cb(null,file.mimetype==='image/jpeg')}).array('paginas',20);
  router.post('/arquivo/escanear',(req,res,next)=>{
    if(!req.session?.usuario) return res.status(401).json({error:'Sua sessão expirou. Entre novamente antes de enviar.'});
    if(!canScan(req.session.usuario)) return res.status(403).json({error:'Sem permissão para escanear e enviar arquivos.'});
    if(!req.session.scannerCsrf || req.get('X-Scanner-CSRF')!==req.session.scannerCsrf) return res.status(403).json({error:'Sessão inválida. Reabra o aplicativo.'});
    upload(req,res,error=>error?res.status(400).json({error:'Limite excedido ou imagem inválida. Use até 20 páginas de 3 MB cada.'}):next());
  },async(req,res)=>{
    let db,stored,committed=false;
    try {
      const name=filename(req.body.nome);
      const event=String(req.body.envio||'');
      if(!/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(event)) throw Error('Identificação de envio inválida.');
      const key=String(req.session.usuario.id)+':'+event;
      const pdf=await buildPdf(req.files);
      const fingerprint=crypto.createHash('sha256').update(name);for(const file of req.files)fingerprint.update(String(file.buffer.length)+':').update(file.buffer);const hash=fingerprint.digest('hex');
      await ensureTable(); db=await pool.connect();await db.query('BEGIN');
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['scanner:'+key]);
      const previous=(await db.query("SELECT id,metadados,nome_original FROM arquivo_fila WHERE origem='APP_SCANNER' AND chave_origem=$1 AND COALESCE(status,'DISPONIVEL')<>'EXCLUIDO'",[key])).rows[0];
      if(previous){if(previous.metadados?.envio_hash!==hash)throw Error('Este envio já foi recebido com outro conteúdo. Confira Arquivos antes de começar um novo documento.');await db.query('COMMIT');committed=true;return res.json({ok:true,id:previous.id,name,message:'Documento já recebido em Arquivos.'});}
      const physical=crypto.randomUUID()+'.pdf'; stored=path.join(uploadsDir,physical);
      await fs.mkdir(uploadsDir,{recursive:true});await fs.writeFile(stored,pdf,{flag:'wx'});
      const record=(await db.query(`INSERT INTO arquivo_fila(nome_original,nome_arquivo,tipo,caminho,tamanho_bytes,status,origem,chave_origem,metadados)
        VALUES($1,$2,'PDF',$3,$4,'DISPONIVEL','APP_SCANNER',$5,$6::jsonb) RETURNING id`,[name,physical,stored,pdf.length,key,JSON.stringify({usuario:String(req.session.usuario.id),nome_escolhido:name,paginas:req.files.length,envio_hash:hash})])).rows[0];
      await db.query('COMMIT');committed=true;db.release();db=null;
      let warning='';try{await analyze(record.id);}catch{warning='Documento salvo; a análise automática ficou pendente.';}
      res.json({ok:true,id:record.id,name,message:warning||'Documento enviado para Arquivos.'});
    }catch(error){if(db&&!committed)await db.query('ROLLBACK').catch(()=>{});if(stored&&!committed)await fs.unlink(stored).catch(()=>{});res.status(400).json({error:error.message});}
    finally{db?.release();}
  });
  return router;
}
module.exports={canScan,filename,jpegSize,buildPdf,createRouter};
