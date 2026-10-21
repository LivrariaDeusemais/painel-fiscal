const crypto=require('crypto');
const CADENCES=['unica','diaria','semanal','mensal','trimestral','anual'];
function today(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
function validDate(value){if(!/^20\d{2}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;}
const iso=d=>d.toISOString().slice(0,10),day=d=>new Date(d+'T12:00:00Z');
function addDays(d,n){const x=day(d);x.setUTCDate(x.getUTCDate()+n);return iso(x);}
function period(mode,date=today()){
 if(!validDate(date))throw Error('Data de referência inválida.');
 const first=day(date),last=day(date);mode=['diario','semanal','mensal','trimestral','anual'].includes(mode)?mode:'diario';
 if(mode==='semanal'){first.setUTCDate(first.getUTCDate()-(first.getUTCDay()+6)%7);last.setTime(first.getTime());last.setUTCDate(last.getUTCDate()+6);}
 if(mode==='mensal'){first.setUTCDate(1);last.setUTCMonth(last.getUTCMonth()+1,0);}
 if(mode==='trimestral'){first.setUTCMonth(Math.floor(first.getUTCMonth()/3)*3,1);last.setUTCMonth(first.getUTCMonth()+3,0);}
 if(mode==='anual'){first.setUTCMonth(0,1);last.setUTCMonth(11,31);}
 return {mode,date,start:iso(first),end:iso(last)};
}
function occurrence(anchor,cadence,index){
 if(index===0)return anchor;
 if(cadence==='unica')return null;
 if(['diaria','semanal'].includes(cadence))return addDays(anchor,index*(cadence==='diaria'?1:7));
 const d=day(anchor),step={mensal:1,trimestral:3,anual:12}[cadence];if(!step)throw Error('Repetição inválida.');
 const target=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+step*index,1,12));
 target.setUTCDate(Math.min(d.getUTCDate(),new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate()));return iso(target);
}
function dates(schedule,from,to){const out=[];for(let n=0;n<40000;n++){const d=occurrence(schedule.inicio,schedule.repeticao,n);if(!d||d>to)break;if(d>=from&&(!schedule.dias_uteis||![0,6].includes(day(d).getUTCDay())))out.push(d);}return out;}
function canRead(user,t){return user.perfil==='ADMIN'||[t.criador,t.responsavel,...(t.participantes||[])].map(String).includes(String(user.id));}
function canWork(user,t){return user.perfil==='ADMIN'||String(t.responsavel)===String(user.id);}
function summarize(tasks,p){
 const completed=tasks.filter(t=>t.status==='concluida'&&t.concluido_dia>=p.start&&t.concluido_dia<=p.end);
 const open=tasks.filter(t=>t.status==='aberta'&&t.prazo>=p.start&&t.prazo<=p.end);
 const overdue=tasks.filter(t=>t.status==='aberta'&&t.prazo<p.start);
 const total=completed.length+open.length;return {completed,open,overdue,total,percent:total?Math.round(completed.length/total*100):0};
}
async function ensure(pool){await pool.query(`
 CREATE TABLE IF NOT EXISTS painel_rotinas(id UUID PRIMARY KEY,titulo TEXT NOT NULL,descricao TEXT NOT NULL DEFAULT '',criador TEXT NOT NULL,responsavel TEXT NOT NULL,inicio TEXT NOT NULL,repeticao TEXT NOT NULL,dias_uteis BOOLEAN NOT NULL DEFAULT false,atalho TEXT NOT NULL DEFAULT '',ativa BOOLEAN NOT NULL DEFAULT true,gerado_ate TEXT,criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS painel_tarefas(id UUID PRIMARY KEY,rotina UUID NOT NULL REFERENCES painel_rotinas(id),titulo TEXT NOT NULL,descricao TEXT NOT NULL DEFAULT '',criador TEXT NOT NULL,responsavel TEXT NOT NULL,participantes TEXT[] NOT NULL,prazo TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'aberta',versao INTEGER NOT NULL DEFAULT 1,concluido_em TIMESTAMPTZ,concluido_por TEXT,atalho TEXT NOT NULL DEFAULT '',criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(rotina,prazo));
 CREATE INDEX IF NOT EXISTS painel_tarefas_responsavel ON painel_tarefas(responsavel,prazo);
 CREATE INDEX IF NOT EXISTS painel_tarefas_participantes ON painel_tarefas USING GIN(participantes);
 CREATE TABLE IF NOT EXISTS painel_eventos(id BIGSERIAL PRIMARY KEY,tarefa UUID NOT NULL REFERENCES painel_tarefas(id),usuario TEXT NOT NULL,nome TEXT NOT NULL,acao TEXT NOT NULL,dados JSONB NOT NULL DEFAULT '{}',criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS painel_favoritos(usuario TEXT PRIMARY KEY,urls JSONB NOT NULL DEFAULT '[]',atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW());
 `);}
async function users(pool){return (await pool.query("SELECT id::text AS id,nome,perfil FROM usuarios WHERE UPPER(perfil) IN ('ADMIN','USUARIO','CONTADOR') ORDER BY nome,id")).rows.map(u=>({...u,perfil:u.perfil.toUpperCase()}));}
async function transaction(pool,fn){const db=await pool.connect();try{await db.query('BEGIN');const value=await fn(db);await db.query('COMMIT');return value;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}
async function event(db,id,user,action,data={}){await db.query('INSERT INTO painel_eventos(tarefa,usuario,nome,acao,dados) VALUES($1,$2,$3,$4,$5)',[id,String(user.id),user.nome||'Usuário',action,JSON.stringify(data)]);}
async function generate(pool,until){
 const list=(await pool.query('SELECT id FROM painel_rotinas WHERE ativa=true AND (gerado_ate IS NULL OR gerado_ate<$1) AND inicio<=$1',[until])).rows;
 for(const row of list)await transaction(pool,async db=>{
  const r=(await db.query('SELECT * FROM painel_rotinas WHERE id=$1 FOR UPDATE',[row.id])).rows[0];if(!r?.ativa||r.gerado_ate>=until)return;
  const list=dates(r,r.gerado_ate?addDays(r.gerado_ate,1):r.inicio,until);if(list.length){const ids=list.map(()=>crypto.randomUUID());await db.query(`INSERT INTO painel_tarefas(id,rotina,titulo,descricao,criador,responsavel,participantes,prazo,atalho) SELECT id,$2,$3,$4,$5,$6,ARRAY[$5,$6]::text[],prazo,$7 FROM unnest($1::uuid[],$8::text[]) AS x(id,prazo) ON CONFLICT(rotina,prazo) DO NOTHING`,[ids,r.id,r.titulo,r.descricao,r.criador,r.responsavel,r.atalho,list]);}
  await db.query('UPDATE painel_rotinas SET gerado_ate=$2 WHERE id=$1',[r.id,until]);
 });
}
async function create(pool,user,input,allowedUrls){
 const title=String(input.titulo||'').trim(),description=String(input.descricao||'').trim(),owner=String(input.responsavel||''),start=String(input.inicio||''),cadence=input.repeticao;
 if(!title||title.length>160||description.length>4000)throw Error('Informe um título de até 160 caracteres e descrição de até 4.000.');
 if(!validDate(start)||start<'2025-01-01'||start>addDays(today(),730))throw Error('Escolha uma data entre 2025 e os próximos dois anos.');
 if(!CADENCES.includes(cadence))throw Error('Repetição inválida.');
 const recipient=(await users(pool)).find(u=>u.id===owner);if(!recipient)throw Error('Responsável não encontrado.');
 const shortcut=String(input.atalho||'');if(shortcut&&!allowedUrls(recipient.perfil).includes(shortcut))throw Error('O atalho não está disponível ao responsável.');
 const id=crypto.randomUUID();await pool.query('INSERT INTO painel_rotinas(id,titulo,descricao,criador,responsavel,inicio,repeticao,dias_uteis,atalho) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,title,description,String(user.id),owner,start,cadence,input.dias_uteis===true||input.dias_uteis==='on',shortcut]);return id;
}
async function load(pool,user){
 return (await pool.query(`SELECT t.*,r.repeticao,r.ativa AS rotina_ativa,r.responsavel AS rotina_responsavel,(t.concluido_em AT TIME ZONE 'America/Sao_Paulo')::date::text AS concluido_dia FROM painel_tarefas t JOIN painel_rotinas r ON r.id=t.rotina WHERE ($1::boolean OR t.criador=$2 OR t.responsavel=$2 OR $2=ANY(t.participantes)) ORDER BY t.prazo,t.criado_em,t.id`,[user.perfil==='ADMIN',String(user.id)])).rows;
}
async function change(pool,user,id,input){
 if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('Tarefa inválida.');
 return transaction(pool,async db=>{
  const t=(await db.query('SELECT * FROM painel_tarefas WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!t||!canRead(user,t))throw Object.assign(Error('Tarefa não encontrada.'),{status:404});
  if(!canWork(user,t))throw Object.assign(Error('Somente o responsável atual ou o administrador pode alterar a tarefa.'),{status:403});
  if(Number(input.versao)!==t.versao)throw Object.assign(Error('A tarefa mudou. Atualize a página antes de continuar.'),{status:409});
  if(input.acao==='delegar'){
   if(t.status!=='aberta')throw Error('Reabra a tarefa antes de delegar.');const to=String(input.responsavel||''),reason=String(input.motivo||'').trim();if(!reason||reason.length>1000)throw Error('Informe um motivo de até 1.000 caracteres.');
   if(to===t.responsavel||!(await users(db)).some(u=>u.id===to))throw Error('Escolha outro responsável válido.');
   await db.query('UPDATE painel_tarefas SET responsavel=$2,participantes=array_append(participantes,$2),versao=versao+1 WHERE id=$1',[id,to]);await event(db,id,user,'delegada',{de:t.responsavel,para:to,motivo:reason});
  }else if(['concluir','reabrir'].includes(input.acao)){
   const completed=input.acao==='concluir';if(t.status==='cancelada')throw Error('Esta execução foi cancelada ao pausar a rotina.');
   await db.query(`UPDATE painel_tarefas SET status=$2,concluido_em=${completed?'NOW()':'NULL'},concluido_por=$3,versao=versao+1 WHERE id=$1`,[id,completed?'concluida':'aberta',completed?String(user.id):null]);await event(db,id,user,completed?'concluida':'reaberta');
  }else throw Error('Ação inválida.');
 });
}
async function pause(pool,user,routine){return transaction(pool,async db=>{const r=(await db.query('SELECT * FROM painel_rotinas WHERE id=$1 FOR UPDATE',[routine])).rows[0];if(!r||!(user.perfil==='ADMIN'||r.criador===String(user.id)))throw Object.assign(Error('Somente o criador ou administrador pode pausar a rotina.'),{status:403});await db.query('UPDATE painel_rotinas SET ativa=false WHERE id=$1',[routine]);const future=(await db.query("UPDATE painel_tarefas SET status='cancelada',versao=versao+1 WHERE rotina=$1 AND prazo>$2 AND status='aberta' RETURNING id",[routine,today()])).rows;for(const t of future)await event(db,t.id,user,'rotina pausada');});}
module.exports={CADENCES,today,validDate,addDays,period,occurrence,dates,canRead,canWork,summarize,ensure,users,generate,create,load,change,pause};
