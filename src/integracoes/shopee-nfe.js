const crypto=require('crypto');
const fs=require('fs/promises');
const path=require('path');
const {parseStringPromise,processors}=require('xml2js');
const unzipper=require('unzipper');
const transport=require('./shopee-nfe-client');
const CNPJ='18862388000103', SERIES='5';
const directory=()=>path.join(process.env.UPLOADS_DIR||'/uploads','.shopee-nfe');
const MAX_XML=5*1024*1024, MAX_TOTAL=250*1024*1024;
function today(now=new Date()) {return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(now);}
function period(month,now=new Date()) {
  if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(String(month)))throw new Error('Escolha uma competência válida.');
  const current=today(now);if(month>current.slice(0,7))throw new Error('A competência não pode estar no futuro.');
  const [y,m]=month.split('-').map(Number),last=new Date(Date.UTC(y,m,0)).getUTCDate();
  return {month,start:Number(month.replace('-','')+'01'),end:Number((month===current.slice(0,7)?current:month+'-'+last).replaceAll('-',''))};
}
async function ensure(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS shopee_nfe_conexao(id INT PRIMARY KEY CHECK(id=1),shop_id TEXT NOT NULL,access_token TEXT NOT NULL,refresh_token TEXT NOT NULL,expira_em TIMESTAMPTZ NOT NULL,atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS shopee_nfe_cargas(id UUID PRIMARY KEY,shop_id TEXT NOT NULL,competencia TEXT NOT NULL,status TEXT NOT NULL,etapa TEXT NOT NULL DEFAULT '',tarefas JSONB NOT NULL DEFAULT '[]',diagnostico JSONB NOT NULL DEFAULT '[]',resumo JSONB NOT NULL DEFAULT '{}',autor TEXT NOT NULL,criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE UNIQUE INDEX IF NOT EXISTS shopee_nfe_uma_carga ON shopee_nfe_cargas((1)) WHERE status='executando';
    CREATE TABLE IF NOT EXISTS shopee_nfe_documentos(id UUID PRIMARY KEY,shop_id TEXT NOT NULL,chave TEXT NOT NULL,hash TEXT NOT NULL,numero TEXT NOT NULL,emissao TEXT NOT NULL,tipo TEXT NOT NULL,natureza TEXT NOT NULL,valor NUMERIC(15,2) NOT NULL,criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(shop_id,chave));
    CREATE TABLE IF NOT EXISTS shopee_nfe_carga_documentos(carga UUID NOT NULL REFERENCES shopee_nfe_cargas(id),documento UUID NOT NULL REFERENCES shopee_nfe_documentos(id),PRIMARY KEY(carga,documento));`);
}
async function parseXml(buffer,month) {
  if(buffer.length>MAX_XML)throw new Error('XML excede 5 MB.');
  const text=buffer.toString('utf8');if(/<!DOCTYPE|<!ENTITY/i.test(text))throw new Error('Declaração XML não permitida.');
  let root;try{root=await parseStringPromise(text,{explicitArray:false,tagNameProcessors:[processors.stripPrefix],strict:true});}catch{throw new Error('XML inválido.');}
  const proc=root.nfeProc, nfe=proc?.NFe, inf=nfe?.infNFe,prot=proc?.protNFe?.infProt;
  if(!inf||!prot)throw new Error('O arquivo não contém NF-e processada com protocolo de autorização.');
  const key=String(inf.$?.Id||'').replace(/^NFe/,'');
  if(!/^\d{44}$/.test(key)||String(prot.chNFe)!==key)throw new Error('Chave da NF-e e protocolo não conferem.');
  let sum=0,weight=2;for(let i=42;i>=0;i--){sum+=Number(key[i])*weight;weight=weight===9?2:weight+1;}
  const digit=11-sum%11;if(Number(key[43])!==(digit>=10?0:digit))throw new Error('Dígito verificador da chave de acesso inválido.');
  if(String(inf.emit?.CNPJ)!==CNPJ||key.slice(6,20)!==CNPJ) return {ignored:'Emitente diferente da Deus é Mais.'};
  if(String(inf.ide?.serie)!==SERIES||Number(key.slice(22,25))!==5) return {ignored:'Série diferente de 5.'};
  if(String(inf.ide?.mod)!=='55'||key.slice(20,22)!=='55')throw new Error('Modelo fiscal inválido para NF-e.');
  const emission=String(inf.ide.dhEmi||inf.ide.dEmi||'');
  if(!/^\d{4}-\d{2}-\d{2}/.test(emission)||emission.slice(0,7)!==month) return {ignored:'Emissão fora da competência consultada.'};
  const date=new Date(emission.slice(0,10)+'T12:00:00Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==emission.slice(0,10)||key.slice(2,6)!==emission.slice(2,7).replace('-',''))throw new Error('Data de emissão não confere com a chave da NF-e.');
  if(String(inf.ide.tpAmb)!=='1'||String(prot.tpAmb)!=='1')throw new Error('NF-e fora do ambiente de produção.');
  const number=String(inf.ide.nNF||'');
  if(!/^\d{1,9}$/.test(number)||number.padStart(9,'0')!==key.slice(25,34))throw new Error('Número da NF-e não confere com a chave de acesso.');
  if(String(prot.cStat)!=='100')throw new Error('NF-e sem autorização de uso vigente no XML. Conferir cancelamento/situação fiscal.');
  if(!nfe.Signature)throw new Error('XML sem assinatura original.');
  const type=String(inf.ide.tpNF);if(!['0','1'].includes(type))throw new Error('Tipo de entrada/saída inválido.');
  const value=String(inf.total?.ICMSTot?.vNF||'');if(!/^\d{1,13}(\.\d{1,2})?$/.test(value))throw new Error('Valor da NF-e inválido.');
  return {key,number,emission,type:type==='0'?'entrada':'saida',nature:String(inf.ide.natOp||''),value,hash:crypto.createHash('sha256').update(buffer).digest('hex')};
}
async function collect(buffer,visit) {
  if(buffer.length>100*1024*1024)throw new Error('Pacote excede 100 MB.');
  if(buffer.subarray(0,2).toString()!=='PK')return visit('documento.xml',buffer);
  let zip;try{zip=await unzipper.Open.buffer(buffer);}catch{throw new Error('Pacote ZIP da Shopee inválido.');}
  if(zip.files.length>10000)throw new Error('Pacote excede 10.000 arquivos.');
  let total=0;
  for(const file of zip.files) {
    if(file.type==='Directory')continue;
    if(file.path.includes('..')||path.isAbsolute(file.path)||file.path.includes('\\'))throw new Error('Caminho inválido dentro do ZIP.');
    if(!/\.xml$/i.test(file.path)) {await visit(file.path,null);continue;}
    if(file.uncompressedSize>MAX_XML)throw new Error('XML no ZIP excede 5 MB.');
    const chunks=[];let size=0;
    for await(const chunk of file.stream()) {size+=chunk.length;total+=chunk.length;if(size>MAX_XML||total>MAX_TOTAL)throw new Error('Conteúdo descompactado excede o limite.');chunks.push(chunk);}
    await visit(file.path,Buffer.concat(chunks));
  }
}
async function saveDocument(pool,job,meta,buffer,root=directory()) {
  const old=(await pool.query('SELECT * FROM shopee_nfe_documentos WHERE shop_id=$1 AND chave=$2',[job.shop_id,meta.key])).rows[0];
  if(old && old.hash!==meta.hash)throw new Error(`Chave ${meta.key}: conteúdo diferente do XML já arquivado. Conferência necessária.`);
  const filename=meta.key+'-'+meta.hash+'.xml';await fs.mkdir(root,{recursive:true,mode:0o700});
  // Caminho derivado exclusivamente de chave/hash validados; nunca usar o nome do ZIP.
  await fs.writeFile(path.join(root,filename),buffer,{mode:0o600});
  const id=old?.id||crypto.randomUUID();
  if(!old)await pool.query('INSERT INTO shopee_nfe_documentos(id,shop_id,chave,hash,numero,emissao,tipo,natureza,valor) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,job.shop_id,meta.key,meta.hash,meta.number,meta.emission,meta.type,meta.nature,meta.value]);
  const result=await pool.query('INSERT INTO shopee_nfe_carga_documentos(carga,documento) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING documento',[job.id,id]);
  return old||!result.rows.length?'repetido':'novo';
}
function responseData(data){return data.response || data;}
function taskIds(data) {
  const result=responseData(data).result_list;
  if(!Array.isArray(result)||!result.length)throw new Error('Shopee não retornou tarefas fiscais. Verifique a liberação da API FBS.');
  return result.map(r=>{
    if(r.fail_error||r.fail_message)throw new Error('Shopee recusou parte da geração do lote fiscal. Confira o acesso FBS do aplicativo.');
    return {id:transport.numericId(r.request_id),done:false};
  });
}
const requestIds=id=>({request_id_list:{request_id:[transport.numericId(id)]}});
const running=new Set();
async function run(pool,id,options={}) {
  if(running.has(id))return;
  running.add(id);let db,locked=false,job;
  const wait=options.wait||((ms)=>new Promise(resolve=>setTimeout(resolve,ms)));
  try {
    db=await pool.connect();locked=(await db.query('SELECT pg_try_advisory_lock(73429108) AS locked')).rows[0].locked;
    if(!locked)return;
    job=(await pool.query('SELECT * FROM shopee_nfe_cargas WHERE id=$1',[id])).rows[0];if(!job||job.status==='concluida')return;
    const client=options.client||new transport.Client();
    await pool.query("UPDATE shopee_nfe_cargas SET status='executando',etapa='Consultando documentos fiscais FBS',atualizado_em=NOW() WHERE id=$1",[id]);
    const auth=await (options.accessToken||transport.accessToken)(pool,client);
    if(auth.shop!==String(job.shop_id))throw new Error('A loja conectada mudou. Reconecte a loja desta carga antes de retomá-la.');
    const api=(endpoint,body)=>client.call('/api/v2/order/'+endpoint,body,auth.token,auth.shop);
    let tasks=job.tarefas||[];
    if(!tasks.length) {
      const p=period(job.competencia);
      tasks=taskIds(await api('generate_fbs_invoices',{batch_download:{start:p.start,end:p.end,document_type:7,file_type:1,document_status:1}}));
      await pool.query('UPDATE shopee_nfe_cargas SET tarefas=$2,atualizado_em=NOW() WHERE id=$1',[id,JSON.stringify(tasks)]);
    }
    const diagnostics=Array.isArray(job.diagnostico)?job.diagnostico:[];
    const counts={novo:0,repetido:0,ignorado:0,pendente:0,...job.resumo};
    function diagnostic(file,message,kind) {counts[kind]++;if(diagnostics.length<1000)diagnostics.push({arquivo:String(file).slice(0,200),motivo:message,tipo:kind});}
    for(const task of tasks) {
      if(task.done)continue;
      let ready=false;
      for(let attempt=0;attempt<120;attempt++) {
        const data=responseData(await api('get_fbs_invoices_result',requestIds(task.id)));
        const item=data.result_list?.find(r=>String(r.request_id)===String(task.id));
        if(!item)throw new Error('Shopee não retornou o andamento do lote solicitado.');
        const status=String(item.status||'').toUpperCase();
        if(status==='READY'){ready=true;break;}
        if(!['PROCESSING','PENDING','IN_PROGRESS','IN_QUEUE','GENERATING'].includes(status))throw new Error(`Lote fiscal não disponível (${status.replace(/[^A-Z_]/g,'').slice(0,40)}).`);
        await pool.query('UPDATE shopee_nfe_cargas SET etapa=$2,atualizado_em=NOW() WHERE id=$1',[id,'Aguardando a Shopee preparar o lote '+task.id]);
        await wait(5000);
      }
      if(!ready)throw new Error('A Shopee ainda não terminou o lote. Retome a consulta para continuar sem recriar a tarefa.');
      const link=responseData(await api('download_fbs_invoices',requestIds(task.id))).file_link;
      const buffer=await (options.download||transport.download)(link);
      await collect(buffer,async(file,xml)=>{
        if(!xml){diagnostic(file,'Arquivo não XML retornado no lote; confira o conteúdo na Shopee.','pendente');return;}
        try {
          const meta=await parseXml(xml,job.competencia);
          if(meta.ignored){diagnostic(file,meta.ignored,'ignorado');return;}
          counts[await saveDocument(pool,job,meta,xml,options.directory)]++;
        } catch(e){diagnostic(file,e.message,'pendente');}
      });
      task.done=true;
      await pool.query('UPDATE shopee_nfe_cargas SET tarefas=$2,diagnostico=$3,resumo=$4,atualizado_em=NOW() WHERE id=$1',[id,JSON.stringify(tasks),JSON.stringify(diagnostics),JSON.stringify(counts)]);
    }
    const total=Number((await pool.query('SELECT COUNT(*) AS n FROM shopee_nfe_carga_documentos WHERE carga=$1',[id])).rows[0].n);
    await pool.query('UPDATE shopee_nfe_cargas SET status=$2,etapa=$3,atualizado_em=NOW() WHERE id=$1',[id,counts.pendente?'parcial':'concluida',`${total} XML(s) da série 5 arquivados. ${counts.ignorado} fora do escopo; ${counts.pendente} pendência(s). Não enviados ao Bling.`]);
  } catch(e) {
    if(job)await pool.query("UPDATE shopee_nfe_cargas SET status='falhou',etapa=$2,atualizado_em=NOW() WHERE id=$1",[id,e.message]).catch(()=>{});
  } finally {
    if(locked)await db.query('SELECT pg_advisory_unlock(73429108)').catch(()=>{});
    db?.release();running.delete(id);
  }
}
async function start(pool,month,user) {
  period(month);await ensure(pool);
  const connection=(await pool.query('SELECT shop_id FROM shopee_nfe_conexao WHERE id=1')).rows[0];
  if(!connection)throw new Error('Conecte a loja Shopee antes de buscar as notas.');
  const id=crypto.randomUUID();
  try {await pool.query("INSERT INTO shopee_nfe_cargas(id,shop_id,competencia,status,autor) VALUES($1,$2,$3,'executando',$4)",[id,connection.shop_id,month,String(user)]);}
  catch(e){if(e.code==='23505')throw new Error('Já existe uma carga em andamento. Consulte ou retome essa carga.');throw e;}
  launch(pool,id);return id;
}
function launch(pool,id){void run(pool,id).catch(()=>{console.error('[Shopee NF-e] Não foi possível iniciar a consulta.');});}
async function documents(pool,id) {return (await pool.query('SELECT d.* FROM shopee_nfe_documentos d JOIN shopee_nfe_carga_documentos c ON c.documento=d.id WHERE c.carga=$1 ORDER BY d.tipo,d.emissao,d.numero',[id])).rows;}
async function xmlFor(doc,root=directory()) {
  if(!/^\d{44}$/.test(doc.chave)||!/^[a-f0-9]{64}$/.test(doc.hash))throw new Error('Referência de XML inválida.');
  const buffer=await fs.readFile(path.join(root,doc.chave+'-'+doc.hash+'.xml'));
  if(crypto.createHash('sha256').update(buffer).digest('hex')!==doc.hash)throw new Error('XML arquivado não confere com o original.');
  return buffer;
}
module.exports={ensure,period,today,parseXml,collect,saveDocument,taskIds,requestIds,run,start,launch,documents,xmlFor,CNPJ,SERIES};
