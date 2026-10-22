const TZ='America/Sao_Paulo';
function parts(date){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));}
function nextRun(now=new Date()){
  const p=parts(now),day=new Date(Date.UTC(+p.year,+p.month-1,+p.day+(+p.hour>=3?1:0),3));
  // Convert local 03:00 using the IANA zone, independently of the host timezone.
  let instant=+day;
  for(let i=0;i<3;i++){const q=parts(new Date(instant)),local=Date.UTC(+q.year,+q.month-1,+q.day,+q.hour,+q.minute,+q.second);instant+=+day-local;}
  return new Date(instant);
}
const ensurePromises=new WeakMap();
async function ensure(pool){
  if(!ensurePromises.has(pool))ensurePromises.set(pool,(async()=>{
    await pool.query(`CREATE TABLE IF NOT EXISTS integracao_agenda(id INTEGER PRIMARY KEY CHECK(id=1),proxima_em TIMESTAMPTZ NOT NULL);
      CREATE TABLE IF NOT EXISTS integracao_agenda_execucoes(dia TEXT PRIMARY KEY,status TEXT NOT NULL,tentativas INTEGER NOT NULL DEFAULT 0,resultados JSONB NOT NULL DEFAULT '{}',inicio_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await pool.query('INSERT INTO integracao_agenda(id,proxima_em) VALUES(1,$1) ON CONFLICT DO NOTHING',[nextRun()]);
  })().catch(e=>{ensurePromises.delete(pool);throw e;}));
  return ensurePromises.get(pool);
}
async function blingWorker(pool){
  const b=require('./bling');
  const id=await b.startSync(pool,'','all',null,{wait:true});
  const job=(await pool.query('SELECT status,mensagem FROM bling_sincronizacoes WHERE id=$1',[id])).rows[0];
  if(!['concluida','parcial'].includes(job?.status))throw Error(job?.mensagem||'Atualização Bling não concluída.');
  return {status:job.status,job:String(id),mensagem:job.mensagem};
}
async function meliWorker(pool){
  const ml=require('./mercado-livre'),promos=require('./mercado-livre-promocoes');
  await promos.ensure(pool);await ml.recoverInterrupted(pool);
  const op=await ml.beginOperation(pool,'consulta-promocoes','automatico-03h',{progress:0,origem:'Agendamento diário 03h — Brasília'});
  await ml.runLocked(pool,op,()=>promos.refresh(pool,op));
  const job=(await pool.query('SELECT status,dados FROM ml_operacoes WHERE id=$1',[op.id])).rows[0];
  if(!['concluida','parcial'].includes(job?.status))throw Error('Consulta automática Mercado Livre '+(job?.status||'não concluída')+'. Consulte o histórico.');
  return {status:job.status,job:op.id,mensagem:job.dados?.errors?.length?job.dados.errors.length+' pendência(s).':'Campanhas e ofertas atualizadas.'};
}
async function meliPricesWorker(pool){
  const ml=require('./mercado-livre');
  await ml.ensureTables(pool);await ml.recoverInterrupted(pool);
  const op=await ml.beginOperation(pool,'consulta','automatico-03h',{filter:'',origem:'Agendamento diário 03h — preços atuais'});
  await ml.runLocked(pool,op,()=>ml.runSync(pool,op));
  const job=(await pool.query('SELECT status FROM ml_operacoes WHERE id=$1',[op.id])).rows[0];
  if(!['concluida','parcial'].includes(job?.status))throw Error('Consulta de preços atuais não concluída. Consulte o histórico.');
  return {status:job.status,job:op.id,mensagem:job.status==='parcial'?'Consulta de preços atuais com pendências; consulte o histórico.':'Preços brutos e preços ao cliente consultados no Mercado Livre.'};
}
async function tick(pool,{now=new Date(),workers={bling:blingWorker,meli:meliWorker,meliPrecos:meliPricesWorker}}={}){
  await ensure(pool);
  const client=await pool.connect();let locked=false;
  try{
    locked=(await client.query("SELECT pg_try_advisory_lock(hashtext('integracoes-agenda-03h')) AS locked")).rows[0]?.locked;
    if(!locked)return;
    const agenda=(await client.query('SELECT proxima_em FROM integracao_agenda WHERE id=1')).rows[0];
    if(new Date(agenda.proxima_em)>now)return;
    // Retry the same day after interruption; do not replay a backlog of old days.
    let run=(await client.query("SELECT * FROM integracao_agenda_execucoes WHERE status='executando' ORDER BY inicio_em DESC LIMIT 1")).rows[0];
    const p=parts(new Date(agenda.proxima_em)),day=run?.dia||`${p.year}-${p.month}-${p.day}`;
    if(!run)run=(await client.query("INSERT INTO integracao_agenda_execucoes(dia,status,tentativas) VALUES($1,'executando',0) ON CONFLICT(dia) DO UPDATE SET status='executando' RETURNING *",[day])).rows[0];
    const results=run.resultados||{};
    await client.query("UPDATE integracao_agenda_execucoes SET tentativas=tentativas+1,status='executando',atualizado_em=NOW() WHERE dia=$1",[day]);
    for(const [name,worker] of Object.entries(workers)){
      if(['concluida','parcial'].includes(results[name]?.status))continue;
      try{results[name]={...await worker(pool),at:new Date().toISOString()};}
      catch(e){results[name]={status:'falhou',mensagem:String(e.message).slice(0,500),at:new Date().toISOString()};}
      await client.query('UPDATE integracao_agenda_execucoes SET resultados=$2,atualizado_em=NOW() WHERE dia=$1',[day,JSON.stringify(results)]);
    }
    const failed=Object.values(results).some(r=>r.status==='falhou'),retry=failed&&run.tentativas+1<3;
    const status=retry?'executando':failed?'falhou':Object.values(results).some(r=>r.status==='parcial')?'parcial':'concluida';
    await client.query('UPDATE integracao_agenda_execucoes SET status=$2,atualizado_em=NOW() WHERE dia=$1',[day,status]);
    await client.query('UPDATE integracao_agenda SET proxima_em=$1 WHERE id=1',[retry?new Date(+now+15*60000):nextRun(new Date(Math.max(+now,Date.now())))]);
  }finally{if(locked)await client.query("SELECT pg_advisory_unlock(hashtext('integracoes-agenda-03h'))");client.release();}
}
function start(pool){
  let busy=false;
  const run=async()=>{if(busy)return;busy=true;try{await tick(pool);}catch(e){console.error('[Atualizações 03h]',e.message);}finally{busy=false;}};
  run();const timer=setInterval(run,30000);timer.unref();return ()=>clearInterval(timer);
}
async function summary(pool){
  await ensure(pool);
  const [agenda,last]=await Promise.all([pool.query('SELECT proxima_em FROM integracao_agenda WHERE id=1'),pool.query('SELECT * FROM integracao_agenda_execucoes ORDER BY inicio_em DESC LIMIT 1')]);
  const escape=require('../services/ui-executivo').esc;
  const date=d=>new Date(d).toLocaleString('pt-BR',{timeZone:TZ});
  return `<section class="panel bling-card ml-card"><strong>Atualização automática diária · 03h (Brasília)</strong><p>Produtos, custos, estoques, vínculos e preços brutos do Bling; campanhas, ofertas e preços atuais ao cliente do Mercado Livre. A participação em promoções continua por comando manual.</p><p>Próxima execução: ${escape(date(agenda.rows[0].proxima_em))}.</p>${last.rows.length?`<p>Última execução: ${escape(date(last.rows[0].inicio_em))} · ${escape(({concluida:'Concluída',parcial:'Com pendências',falhou:'Falhou',executando:'Em andamento / aguardando nova tentativa'})[last.rows[0].status])}</p>${Object.entries(last.rows[0].resultados).map(([k,r])=>`<p>${k==='bling'?'Bling':k==='meliPrecos'?'Mercado Livre — preços atuais':'Mercado Livre'}: ${escape(r.mensagem||r.status)}</p>`).join('')}`:'<p>Aguardando a primeira execução automática.</p>'}</section>`;
}
module.exports={nextRun,parts,ensure,tick,start,summary};
