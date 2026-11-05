const date=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
function period(q={}){const mode=q.mode||'trimestral',year=Number(q.year||new Date().getFullYear());if(!Number.isInteger(year)||year<2000||year>2100)throw Error('Ano inválido.');let start,end;
 const last=(y,m)=>new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);
 if(mode==='personalizada'){start=q.start;end=q.end;}else if(mode==='anual'){start=`${year}-01-01`;end=`${year}-12-31`;}else{let m=mode==='mensal'?Number(q.month||1):(Number(q.quarter||1)-1)*3+1;if(!Number.isInteger(m)||m<1||m>12)throw Error('Período inválido.');start=`${year}-${String(m).padStart(2,'0')}-01`;end=last(year,mode==='mensal'?m:m+2);}
 if(!['mensal','trimestral','anual','personalizada'].includes(mode)||!date(start)||!date(end)||start>end)throw Error('Selecione um período válido.');return {mode,year,start,end};}
// Só agrega documentos de períodos inteiros, contíguos e sem sobreposição.
function coverage(reports,p){let next=p.start,chosen=[];const rows=reports.filter(r=>r.start>=p.start&&r.end<=p.end).sort((a,b)=>a.start.localeCompare(b.start)||b.end.localeCompare(a.end));while(next<=p.end){const r=rows.find(r=>r.start===next);if(!r)return {complete:false,reports:chosen};chosen.push(r);next=new Date(Date.parse(r.end+'T00:00:00Z')+86400000).toISOString().slice(0,10);}return {complete:true,reports:chosen};}
function aggregate(reports,kind){const map=new Map();for(const r of reports)for(const l of r.data.lines){let x=map.get(l.code);if(!x){x={...l,value:0,debit:0,credit:0};map.set(l.code,x);}x.value=kind==='dre'?x.value+l.value:l.value;x.debit+=l.debit||0;x.credit+=l.credit||0;}return [...map.values()];}
async function ensure(db){await db.query(`CREATE TABLE IF NOT EXISTS conferencia_documentos(id UUID PRIMARY KEY,tipo TEXT NOT NULL,inicio TEXT NOT NULL,fim TEXT NOT NULL,nome TEXT NOT NULL,hash TEXT NOT NULL,arquivo BYTEA NOT NULL,dados JSONB NOT NULL,criado_em TIMESTAMPTZ DEFAULT now(),usuario TEXT NOT NULL);CREATE TABLE IF NOT EXISTS conferencia_revisoes(chave TEXT PRIMARY KEY,dados JSONB NOT NULL,atualizado_em TIMESTAMPTZ DEFAULT now());CREATE TABLE IF NOT EXISTS conferencia_mapas(chave TEXT PRIMARY KEY,categorias INTEGER[] NOT NULL,atualizado_em TIMESTAMPTZ DEFAULT now());`);}
// Recover contiguous account groups from the original accounting totals. Reduced
// account codes are identifiers, not hierarchy paths. Require all four balances
// to reconcile before treating a bold row as a parent (also works for old PDFs).
function rollup(lines,kind){
 const children=new Map(),ends=new Map();
 const vector=l=>kind==='balancete'?[l.previous,l.debit,l.credit,l.value]:[l.value];
 const equal=(a,b)=>a.every((v,i)=>Number.isFinite(v)&&Number.isFinite(b[i])&&Math.abs(v-b[i])<=1);
 for(let i=lines.length-1;i>=0;i--){
  const row=lines[i];if(kind!=='dre'&&!row.bold)continue;
  const target=vector(row);if(!target.some(v=>v!==0)||target.some(v=>!Number.isFinite(v)))continue;
  const sum=target.map(()=>0),ids=[];
  for(let j=i+1;j<lines.length;){
   // DRE section headings delimit sections; cumulative DRE results are not
   // inferred from adjacency because their formulas can have different signs.
   if(kind==='dre'&&lines[j].bold)break;
   ids.push(j);vector(lines[j]).forEach((v,k)=>sum[k]+=v);
   const end=ends.get(j)||j;
   if(equal(sum,target)){children.set(i,ids.slice());ends.set(i,end);break;}
   j=end+1;
  }
 }
 // DRE cumulative results use signed section totals, only when the original
 // document confirms the formula. Never add both a section and its details.
 if(kind==='dre'){
  const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  const index=new Map(lines.map((l,i)=>[norm(l.label),i]));
  const formulas=[
   ['RECEITA LIQUIDA',['RECEITA BRUTA','DEDUCOES DA RECEITA BRUTA']],
   ['LUCRO BRUTO',['RECEITA LIQUIDA','CUSTOS']],
   ['RESULTADO OPERACIONAL',['LUCRO BRUTO','DESPESAS OPERACIONAIS','RECEITAS FINANCEIRAS']],
   ['RESULTADO ANTES DO IR E CSL',['RESULTADO OPERACIONAL']],
   ['LUCRO LIQUIDO DO EXERCICIO',['RESULTADO ANTES DO IR E CSL']]
  ];
  for(const [name,parts] of formulas){
   const i=index.get(name),ids=parts.map(p=>index.get(p));
   if(i!==undefined&&ids.every(j=>j!==undefined&&j<i)&&equal([ids.reduce((n,j)=>n+lines[j].value,0)],[lines[i].value]))children.set(i,ids);
  }
 }
 const resolved=new Map();
 const resolve=i=>{
  if(resolved.has(i))return resolved.get(i);
  const row=lines[i],ids=children.get(i);
  if(!ids){const state={available:Number.isFinite(row.actual),partial:false};resolved.set(i,state);return state;}
  const states=ids.map(resolve),available=ids.filter((_,k)=>states[k].available);
  // A parent always uses children when any child is comparable, never both
  // its own mapped total and the child subtotal.
  if(available.length){
   row.actual=available.reduce((sum,j)=>sum+lines[j].actual,0);
   row.partial=states.some(x=>!x.available||x.partial);
   row.source=row.partial?'Comparação parcial · soma das contas com fonte':'Soma das contas com fonte';
  }
  const state={available:Number.isFinite(row.actual),partial:!!row.partial};resolved.set(i,state);return state;
 };
 // Resolve intermediate groups first; memoize to avoid
 // repeatedly traversing deeply nested statements.
 for(let i=lines.length-1;i>=0;i--){resolve(i);}
 for(const row of lines)row.diff=Number.isFinite(row.actual)?row.actual-row.reference:null;
 return lines;
}
module.exports={period,coverage,aggregate,ensure,rollup};
