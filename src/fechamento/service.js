const { spawn } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const ExcelJS = require('exceljs');
const norm = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const MONTHS=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const MONEY_FIELDS=['revenue','deductions','netRevenue','cmv','expenses','originalResult'];
const DEPOSITS={matriz:'Santo André — Matriz',mercadoLivre:'Full Mercado Livre',shopee:'Full Shopee'};
function monthValid(v){return /^\d{4}-(0[1-9]|1[0-2])$/.test(v||'') && Number(v.slice(0,4))>=2000 && Number(v.slice(0,4))<=2100;}
function lastClosedMonth(now=new Date()) {const y=Number(now.toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric'})), m=Number(now.toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo',month:'2-digit'}));return m===1?`${y-1}-12`:`${y}-${String(m-1).padStart(2,'0')}`;}
function period({mode='mensal',month,year,months=[]}){
 if(!monthValid(month)||!/^20\d{2}$/.test(String(year)))throw new Error('Período inválido.');
 const selected=mode==='anual'?Array.from({length:12},(_,i)=>`${year}-${String(i+1).padStart(2,'0')}`):mode==='personalizado'?[...new Set((Array.isArray(months)?months:[months]).map(String))].sort():[month];
 if(!selected.length||selected.length>12||selected.some(m=>!monthValid(m)||(mode==='personalizado'&&m.slice(0,4)!==String(year))))throw new Error('Marque pelo menos um mês do ano selecionado.');
 return selected;
}
function cents(v){
 if(typeof v==='number'){if(!Number.isFinite(v))throw new Error('Valor inválido.');return Math.round(v*100);}
 let s=String(v??'').trim().replace(/R\$/gi,'').replace(/\s/g,'');if(!s||s==='—'||s==='-')return 0;
 let neg=false;if(/^\(.*\)$/.test(s)){neg=true;s=s.slice(1,-1);}
 if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
 if(!/^-?\d+(\.\d{1,8})?$/.test(s))throw new Error('Valor monetário inválido: '+String(v).slice(0,30));
 const result=Math.round(Number(s)*100)*(neg?-1:1);if(!Number.isSafeInteger(result)||Math.abs(result)>1e14)throw new Error('Valor fora do limite.');return result;
}
function blank(){return {revenue:0,deductions:0,netRevenue:0,cmv:0,expenses:0,originalResult:0,publishers:[],stocks:Object.fromEntries(Object.keys(DEPOSITS).map(k=>[k,{quantity:0,value:0}])),notes:'',sourceNotes:{}};}
function derive(data){const d={...blank(),...data};d.purchases=(d.publishers||[]).reduce((s,p)=>s+p.value,0);d.stockTotal=Object.values(d.stocks||{}).reduce((s,p)=>s+p.value,0);d.stockQuantity=Object.values(d.stocks||{}).reduce((s,p)=>s+p.quantity,0);d.result=d.netRevenue-d.cmv-d.expenses;d.margin=d.netRevenue?d.result/d.netRevenue:0;return d;}
function validate(input){
 const d=blank();for(const k of MONEY_FIELDS){const v=Number(input[k]??0);if(!Number.isSafeInteger(v)||Math.abs(v)>1e14)throw new Error('Valor inválido em '+k);if(!['originalResult','netRevenue'].includes(k)&&v<0)throw new Error('Valores negativos somente no resultado ou receita líquida.');d[k]=v;}
 d.netRevenue=d.revenue-d.deductions;
 if(!Array.isArray(input.publishers)||input.publishers.length>150)throw new Error('Editoras inválidas.');
 const seen=new Set();d.publishers=input.publishers.map(p=>{const name=String(p.name||'').trim().slice(0,200),value=Number(p.value);if(!name||seen.has(norm(name))||!Number.isSafeInteger(value)||Math.abs(value)>1e14)throw new Error('Confira nomes e valores das editoras.');seen.add(norm(name));return {name,value};});
 for(const k of Object.keys(DEPOSITS)){const p=input.stocks?.[k]||{};const quantity=Number(p.quantity??0),value=Number(p.value??0);if(!Number.isFinite(quantity)||Math.abs(quantity)>1e9||!Number.isSafeInteger(value)||Math.abs(value)>1e14)throw new Error('Estoque inválido.');d.stocks[k]={quantity,value};}
 d.notes=String(input.notes||'').slice(0,5000);d.sourceFiles=input.sourceFiles||{};d.sourceNotes=input.sourceNotes||{};return d;
}
function parseDre(sheets,month,{confirmedYear}={}){
 if(!monthValid(month))throw new Error('Selecione mês e ano válidos.');
 const idx=Number(month.slice(5))-1,year=month.slice(0,4);let chosen;
 for(const sheet of sheets){for(let r=0;r<Math.min(sheet.rows.length,40);r++){const row=sheet.rows[r];const c=row.findIndex(v=>{const s=norm(v);return s.includes(MONTHS[idx])&&(s.includes(year)||s.includes('/'+year.slice(2))||s.includes('-'+year.slice(2)));});if(c>=0){chosen={rows:sheet.rows,start:r+1,col:c};break;}}if(chosen)break;}
 // Cabeçalho anual sem ano exige confirmação explícita da competência.
 if(!chosen&&String(confirmedYear)===year){for(const sheet of sheets){for(let r=0;r<Math.min(sheet.rows.length,40);r++){const headers=sheet.rows[r].map(norm),start=headers.indexOf('jan');if(start>=0&&MONTHS.every((m,i)=>headers[start+i]===m)){chosen={rows:sheet.rows,start:r+1,col:start+idx};break;}}if(chosen)break;}}
 if(!chosen)throw new Error('Não foi encontrada a coluna do mês/ano selecionado no DRE. Exporte o DRE com os meses nas colunas e confirme o ano.');
 const out={},publishers=[];let buying=false,found=new Set();
 for(const row of chosen.rows.slice(chosen.start)){
  const label=norm(row.slice(0,chosen.col).filter(v=>typeof v==='string').join(' ')).replace(/[()+−=\-]/g,'').replace(/\s+/g,' ').trim();if(!label)continue;
  const raw=row[chosen.col];
  const mapping=[['receita operacional bruta','revenue'],['deducoes da receita bruta','deductions'],['receita operacional liquida','netRevenue'],['custos das mercadorias','cmv'],['custo das mercadorias','cmv'],['resultado liquido','originalResult']];
  const item=mapping.find(([l])=>label===l||label.startsWith(l+' '));
  if(item){out[item[1]]=cents(raw);found.add(item[1]);}
  if(label.includes('compras de estoque')){buying=true;out.purchaseTotal=cents(raw);continue;}
  if(buying){if(/^(receita financeira|despesa financeira|outras receitas|outras despesas|resultado|irpj|imposto|contribuicao)/.test(label))buying=false;else if(raw!==''&&raw!=null){publishers.push({name:String(row.slice(0,chosen.col).find(v=>typeof v==='string'&&v.trim())||'').replace(/^[\s(+−=)]+/, '').trim(),value:cents(raw)});}}
 }
 if(!['revenue','deductions','netRevenue','cmv'].every(k=>found.has(k)))throw new Error('DRE incompleto: faturamento, deduções, receita líquida ou CMV não encontrados.');
 if(Math.abs(out.revenue-out.deductions-out.netRevenue)>1)throw new Error('Receita líquida não corresponde ao faturamento menos deduções. Confira o relatório.');
 if(out.purchaseTotal!=null&&Math.abs(publishers.reduce((s,p)=>s+p.value,0)-out.purchaseTotal)>1)throw new Error('A soma das editoras difere do total de compras. Confira as linhas do DRE.');
 return {...out,publishers};
}
function parseStock(sheets){
 for(const sheet of sheets){for(let h=0;h<Math.min(sheet.rows.length,60);h++){
 const headers=sheet.rows[h].map(norm),q=headers.findIndex(v=>v==='quantidade'||v==='qtd'||v==='qtde'),v=headers.findIndex(v=>v==='valor total'||v==='total');
 if(q<0||v<0||!headers.some(x=>x==='produto'||x==='descricao'))continue;
 let quantity=0,value=0,count=0,footer=null;
 for(const row of sheet.rows.slice(h+1)){const label=norm(row.slice(0,Math.min(q,v)).join(' '));if(/^(total|totais)\b/.test(label)){footer={quantity:typeof row[q]==='number'?row[q]:Number(String(row[q]).replace(/\./g,'').replace(',','.')),value:cents(row[v])};break;}if(!label||row[q]===''||row[q]==null)continue;
 const qty=typeof row[q]==='number'?row[q]:Number(String(row[q]).replace(/\./g,'').replace(',','.'));if(!Number.isFinite(qty))throw new Error('Quantidade inválida no estoque.');if(qty!==0&&(row[v]==null||row[v]===''))throw new Error('Produto com saldo e valor total ausente. Confira o relatório.');
 quantity+=qty;value+=cents(row[v]);count++;
 }
 if(!count)throw new Error('Nenhum produto encontrado no relatório de estoque.');
 // Totais do Bling usam precisão interna superior ao valor unitário exibido.
 if(footer){if(Math.abs(footer.quantity-quantity)>0.001||Math.abs(footer.value-value)>Math.max(2,count))throw new Error('Totais do estoque divergem das linhas; confira o arquivo.');value=footer.value;}
 return {quantity:Math.round(quantity*1000)/1000,value,products:count};
 }}throw new Error('Colunas Produto, Quantidade e Valor total não encontradas. Exporte a Visão Financeira do Estoque do Bling.');
}
async function readSpreadsheet(file){return new Promise((resolve,reject)=>{const proc=spawn(process.env.CODIFICADOR_PYTHON||'python3',[path.join(__dirname,'planilhas.py'),file],{env:{...process.env,PYTHONPATH:[path.resolve(__dirname,'../../.python-packages'),process.env.PYTHONPATH].filter(Boolean).join(path.delimiter)}});let out='',err='';const timer=setTimeout(()=>{proc.kill();reject(new Error('Tempo excedido ao ler planilha.'));},30000);proc.stdout.on('data',x=>{out+=x;if(out.length>20e6)proc.kill();});proc.stderr.on('data',x=>err+=x);proc.on('error',e=>{clearTimeout(timer);reject(e);});proc.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(new Error('Não foi possível ler a planilha. '+err.slice(-300)));try{resolve(JSON.parse(out));}catch{reject(new Error('Planilha inválida.'));}});});}
async function ensure(db){await db.query(`CREATE TABLE IF NOT EXISTS fechamentos_mensais (mes TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'rascunho', versao INTEGER NOT NULL DEFAULT 1, dados JSONB NOT NULL, atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), atualizado_por TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS fechamento_eventos (id BIGSERIAL PRIMARY KEY, mes TEXT NOT NULL, acao TEXT NOT NULL, usuario TEXT NOT NULL, criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), dados JSONB NOT NULL);
 CREATE TABLE IF NOT EXISTS fechamento_arquivos (id TEXT PRIMARY KEY, mes TEXT NOT NULL, tipo TEXT NOT NULL, nome_original TEXT NOT NULL, nome_arquivo TEXT NOT NULL, sha256 TEXT NOT NULL, extraido JSONB NOT NULL, criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), usuario TEXT NOT NULL);`);}
async function save(db,{month,data,status,version,user,reason}){
 if(!monthValid(month)||month>lastClosedMonth())throw new Error('Use uma competência de mês já encerrado.');if(!['rascunho','fechado'].includes(status))throw new Error('Situação inválida.');
 const d=validate(data);if(!String(reason||'').trim())throw new Error('Informe a observação ou motivo deste fechamento.');
 const client=await db.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['fechamento:'+month]);const old=(await client.query('SELECT * FROM fechamentos_mensais WHERE mes=$1 FOR UPDATE',[month])).rows[0];if(Number(old?.versao||0)!==Number(version))throw Object.assign(new Error('O fechamento foi alterado por outra pessoa. Recarregue antes de salvar.'),{status:409});const result=await client.query(`INSERT INTO fechamentos_mensais (mes,status,versao,dados,atualizado_por) VALUES ($1,$2,1,$3::jsonb,$4) ON CONFLICT (mes) DO UPDATE SET status=EXCLUDED.status,versao=fechamentos_mensais.versao+1,dados=EXCLUDED.dados,atualizado_por=EXCLUDED.atualizado_por,atualizado_em=NOW() RETURNING *`,[month,status,JSON.stringify(d),user]);await client.query('INSERT INTO fechamento_eventos (mes,acao,usuario,dados) VALUES ($1,$2,$3,$4::jsonb)',[month,'salvar',user,JSON.stringify({reason:String(reason).slice(0,5000),before:old||null,after:result.rows[0]})]);await client.query('COMMIT');return result.rows[0];}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
function aggregate(rows){const sorted=rows.filter(r=>r.status==='fechado').sort((a,b)=>a.mes.localeCompare(b.mes));const d=blank(),publishers=new Map();for(const r of sorted){for(const k of MONEY_FIELDS)d[k]+=Number(r.dados[k]||0);for(const p of r.dados.publishers||[])publishers.set(p.name,(publishers.get(p.name)||0)+p.value);}d.publishers=[...publishers].map(([name,value])=>({name,value}));if(sorted.length)d.stocks=sorted.at(-1).dados.stocks;return {...derive(d),through:sorted.at(-1)?.mes||null,months:sorted.length};}
function workbook(rows){const wb=new ExcelJS.Workbook();wb.creator='Plennatec';for(const [name,headers,list] of [
 ['Fechamentos',['Competência','Situação','Faturamento bruto','Deduções','Faturamento líquido','CMV','Despesas','Resultado líquido gerencial','Margem líquida','Estoque final','Atualizado em','Atualizado por'],rows.map(r=>{const d=derive(r.dados);return [r.mes,r.status,d.revenue/100,d.deductions/100,d.netRevenue/100,d.cmv/100,d.expenses/100,d.result/100,d.margin,d.stockTotal/100,r.atualizado_em,r.atualizado_por];})],
 ['Editoras',['Competência','Editora','Valor'],rows.flatMap(r=>r.dados.publishers.map(p=>[r.mes,p.name,p.value/100]))],
 ['Estoques',['Competência','Depósito','Unidades','Valor'],rows.flatMap(r=>Object.entries(r.dados.stocks).map(([k,p])=>[r.mes,DEPOSITS[k],p.quantity,p.value/100]))]
 ]){const ws=wb.addWorksheet(name,{views:[{state:'frozen',ySplit:1}]});ws.addRow(headers);list.forEach(r=>ws.addRow(r));ws.autoFilter={from:'A1',to:{row:1,column:headers.length}};ws.columns.forEach((c,i)=>{c.width=i===0?16:24;});ws.getRow(1).eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'075438'}};c.font={bold:true,color:{argb:'FFFFFF'}};c.alignment={wrapText:true};});ws.eachRow((r,i)=>{if(i===1)return;r.eachCell((c,col)=>{if(typeof c.value==='number')c.numFmt=name==='Fechamentos'&&col===9?'0.00%':'#,##0.00;[Red]-#,##0.00';});});}
 return wb;
}
module.exports={period,norm,cents,monthValid,lastClosedMonth,blank,derive,validate,parseDre,parseStock,readSpreadsheet,ensure,save,aggregate,workbook,DEPOSITS,MONEY_FIELDS};
