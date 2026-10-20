const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {PassThrough}=require('node:stream');const unzipper=require('unzipper');
const source=fs.readFileSync(require.resolve('../src/routes/index'),'utf8');
test('download do par contém PDF codificado e XML original byte a byte e exige sessão proprietária',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cod-par-'));fs.mkdirSync(path.join(temp,'outputs'));
 try{
  const pdf=path.join(temp,'outputs','codificado.pdf'),xml=path.join(temp,'outputs','original.xml');
  const original=Buffer.from('\uFEFF<?xml version="1.0"?>\r\n<NFe>  conteúdo original assinado </NFe>\r\n');fs.writeFileSync(pdf,'%PDF-1.4 codificado');fs.writeFileSync(xml,original);
  let handler;const ctx=vm.createContext({router:{get:(...args)=>handler=args.at(-1)},protegerRota:()=>{},permitirPerfis:()=>()=>{},path,fs,codificadorStorageDir:temp,archiver:require('archiver'),console});
  const start=source.indexOf("router.get('/ferramentas-ia/codificador/download/:id/:tipo'");vm.runInContext(source.slice(start,source.indexOf("router.use('/ferramentas-ia/tabela-precos/bling'",start)),ctx);
  const res=new PassThrough(),chunks=[];res.attachment=name=>{assert.equal(name,'PDF-codificado-e-XML-original.zip')};res.on('data',chunk=>chunks.push(chunk));const ended=new Promise(resolve=>res.on('end',resolve));
  handler({params:{id:'a',tipo:'par'},session:{codificadorResultados:{a:{pdf,xml}}}},res);await ended;
  const archive=await unzipper.Open.buffer(Buffer.concat(chunks));assert.equal(archive.files.length,2);assert.deepEqual(await archive.files.find(f=>f.path==='XML-original.xml').buffer(),original);assert.equal((await archive.files.find(f=>f.path==='codificado.pdf').buffer()).toString(),'%PDF-1.4 codificado');
  let status;handler({params:{id:'a',tipo:'par'},session:{}},{status:s=>{status=s;return {send:()=>{}}}});assert.equal(status,404);
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
});
