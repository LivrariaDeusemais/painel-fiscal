const {test}=require('node:test'),assert=require('node:assert/strict'),w=require('../src/painel/workflow'),automatic=require('../src/painel/automatic');
const base=[{key:'xml',label:'XML',statusColumn:'status_xml'},{key:'pdf',label:'PDF',statusColumn:'status_pdf'}];
const input={base,statuses:[{mes_ref:'2026-08',status_xml:'Liberado para baixar',status_pdf:'Em andamento'}],custom:[],types:[{id:1,label:'Distribuição',mes_ref:'2026-09'},{id:2,label:'Global',mes_ref:null},{id:3,label:'Futuro',mes_ref:'2026-11'}],hidden:['2026-09_pdf']};
test('contabilização começa em agosto e só acrescenta outubro após virar o mês',()=>{assert.deepEqual(w.closedMonths('2026-10-26'),['2026-08','2026-09']);assert.deepEqual(w.closedMonths('2026-11-01'),['2026-08','2026-09','2026-10']);assert.deepEqual(w.closedMonths('2026-08-31'),[]);assert.deepEqual(w.closedMonths('2027-01-01').slice(-2),['2026-11','2026-12']);});
test('fechamento persiste até liberação, incluindo tipos sem arquivos e meses não visitados',()=>{
 const rows=w.closingRecords(input,'2026-10-26');assert.equal(rows.length,5);assert.ok(rows.some(r=>r.month==='2026-08'&&r.label.includes('Em andamento')));assert.ok(rows.some(r=>r.label.includes('Distribuição')));assert.ok(!rows.some(r=>r.key==='fechamento:2026-08:xml'));assert.ok(!rows.some(r=>r.key==='fechamento:2026-09:pdf'));assert.ok(!rows.some(r=>r.label.includes('Futuro')));
 assert.ok(rows.every(r=>r.url.includes('mes='+r.month)));const released={...input,statuses:[{mes_ref:'2026-08',status_xml:'Liberado para baixar',status_pdf:'Liberado para baixar'}]};assert.equal(w.closingRecords(released,'2026-10-30').length,4);assert.equal(w.closingRecords(input,'2026-10-30').length,5);
});
test('soma em centavos as estimativas e explicita valores desconhecidos',async()=>{
 const row=await w.dueToday({query:async(sql,args)=>{assert.deepEqual(args,['2026-10','2026-10-26']);return {rows:[{valor_estimado_editado:true,valor_estimado_mes:'12.30'},{valor_estimado:'10.10'},{valor_historico:'5.50'},{}]};}},'2026-10-26');assert.equal(row.count,4);assert.equal(row.amount,27.90);assert.equal(row.unknown,1);assert.match(row.url,/vencimento_inicio=2026-10-26/);assert.match(row.label,/sem valor informado/);
});
test('permissões novas negam consultas e permitem gestores autorizados sem conceder download',async()=>{
 let calls=0;const workflow={dueToday:async()=>{calls++;return {key:'dia'}},closing:async()=>{calls++;return [{key:'fechamento'}]}},pool={query:async()=>({rows:[]})};
 const denied={perfil:'USUARIO',functionAccess:{arquivo:{view:true},downloads:{view:true,edit:true}}};assert.deepEqual(await automatic.alerts(pool,denied,[],null,workflow),[]);assert.equal(calls,0);
 const allowed={...denied,functionAccess:{...denied.functionAccess,'fechamento-despesas':{view:true}}};assert.deepEqual(await automatic.alerts(pool,allowed,[],null,workflow),[{key:'fechamento'}]);assert.equal(calls,1);
});
test('separa os totais de hoje dos atrasados sem misturar estimativas',async()=>{
 const row=await w.dueToday({query:async()=>({rows:[{valor_estimado:'100.10',atrasada:false},{valor_estimado_mes:'12.30',valor_estimado_editado:true,atrasada:true},{valor_historico:'5.50',atrasada:true},{atrasada:true}]})},'2026-10-27');
 assert.equal(row.count,1);assert.equal(row.amount,100.10);assert.equal(row.overdue.count,3);assert.equal(row.overdue.amount,17.80);assert.equal(row.overdue.unknown,1);
 assert.match(row.overdue.url,/vencimento_inicio=2026-10-01/);assert.match(row.overdue.url,/vencimento_fim=2026-10-26/);assert.match(row.url,/vencimento_inicio=2026-10-27/);
});
