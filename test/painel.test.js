const {test}=require('node:test'),assert=require('node:assert/strict');
const s=require('../src/painel/service'),downloads=require('../src/painel/downloads'),{pages}=require('../src/painel/routes'),ui=require('../src/services/ui-executivo');
test('rotinas mensais mantêm o dia de origem ao atravessar fevereiro e anos bissextos',()=>{
 assert.deepEqual(s.dates({inicio:'2026-01-31',repeticao:'mensal'},'2026-01-01','2026-04-30'),['2026-01-31','2026-02-28','2026-03-31','2026-04-30']);
 assert.equal(s.occurrence('2024-02-29','anual',1),'2025-02-28');assert.equal(s.occurrence('2024-02-29','anual',4),'2028-02-29');
 assert.equal(s.occurrence('2026-01-31','trimestral',1),'2026-04-30');
});
test('rotinas diárias, semanais e únicas respeitam limites e dias úteis sem duplicar datas',()=>{
 assert.deepEqual(s.dates({inicio:'2026-10-23',repeticao:'diaria',dias_uteis:true},'2026-10-23','2026-10-27'),['2026-10-23','2026-10-26','2026-10-27']);
 assert.deepEqual(s.dates({inicio:'2026-10-21',repeticao:'semanal'},'2026-10-22','2026-11-05'),['2026-10-28','2026-11-04']);
 assert.deepEqual(s.dates({inicio:'2026-10-21',repeticao:'unica'},'2026-10-01','2026-12-01'),['2026-10-21']);
});
test('períodos usam segunda-feira, trimestre calendário e data de São Paulo',()=>{
 assert.equal(s.period('semanal','2026-10-25').start,'2026-10-19');assert.equal(s.period('semanal','2026-10-25').end,'2026-10-25');
 assert.equal(s.period('trimestral','2026-11-01').start,'2026-10-01');assert.equal(s.period('trimestral','2026-11-01').end,'2026-12-31');
 assert.equal(s.today(new Date('2026-10-22T01:00:00Z')),'2026-10-21');
 for(const d of ['2026-13-01','2026-02-30','nada'])assert.equal(s.validDate(d),false);
});
test('progresso separa pendências antigas de execuções realizadas no período',()=>{
 const value=s.summarize([{status:'aberta',prazo:'2026-10-20'},{status:'aberta',prazo:'2026-10-21'},{status:'concluida',prazo:'2026-10-01',concluido_dia:'2026-10-21'},{status:'concluida',prazo:'2026-10-21',concluido_dia:'2026-10-20'},{status:'cancelada',prazo:'2026-10-21'}],s.period('diario','2026-10-21'));
 assert.equal(value.total,2);assert.equal(value.percent,50);assert.equal(value.overdue.length,1);
});
test('criador e participantes anteriores acompanham mas só responsável atual e admin alteram',()=>{
 const t={criador:'1',responsavel:'3',participantes:['1','2','3']};
 for(const id of [1,2,3])assert.equal(s.canRead({id,perfil:'USUARIO'},t),true);
 assert.equal(s.canRead({id:4,perfil:'USUARIO'},t),false);assert.equal(s.canWork({id:1,perfil:'USUARIO'},t),false);assert.equal(s.canWork({id:3,perfil:'CONTADOR'},t),true);assert.equal(s.canWork({id:4,perfil:'ADMIN'},t),true);
});
test('avisos usam Data Download, liberação, existência de arquivos e tipos ocultos da central',()=>{
 const base=[{key:'xml',label:'XML',auto:true,countKey:'xml',statusColumn:'status_xml',downloadAtColumn:'download_xml_at'},{key:'pdf',label:'PDF',auto:true,countKey:'pdf',statusColumn:'status_pdf',downloadAtColumn:'download_pdf_at'}];
 const input={base,statuses:[{mes_ref:'2026-09',status_xml:'Liberado para Baixar',download_xml_status:'Baixado',download_xml_at:null,status_pdf:'Em andamento'}],custom:[{mes_ref:'2026-09',tipo_key:'custom_8',status_pronto:'Liberado para baixar',download_at:'2026-10-21T12:00:00Z'}],types:[{id:8,label:'Extrato',titulo:'Extrato',mes_ref:'2026-09'}],hidden:[],extras:[{mes_ref:'2026-09',titulo:'EXTRATO',total:2}],counts:[{mes_ref:'2026-09',xml:3,pdf:2}]};
 let list=downloads.records(input);assert.equal(list.length,2);assert.equal(list.filter(x=>!x.downloadedAt).length,1,'texto Baixado sem data não esconde a pendência');
 input.statuses[0].download_xml_at='2026-10-21';assert.equal(downloads.records(input).filter(x=>!x.downloadedAt).length,0);
 input.hidden=['2026-09_xml'];assert.equal(downloads.records(input).length,1);input.extras=[];assert.equal(downloads.records(input).length,0);
});
test('favoritos são restritos às telas permitidas ao perfil',()=>{
 assert.ok(pages('ADMIN').some(p=>p.url==='/usuarios'));assert.ok(!pages('USUARIO').some(p=>p.url==='/usuarios'));assert.ok(!pages('CONTADOR').some(p=>p.url==='/rotina-despesas'));assert.ok(pages('CONTADOR').some(p=>p.url==='/painel/agenda'));
 const req={originalUrl:'/visao-geral',session:{usuario:{id:1,nome:'Gestor',perfil:'ADMIN'}}};const header=ui.header(req);assert.match(header,/★ FAVORITOS/);assert.match(header,/aria-label="Definir favoritos"/);assert.ok(req.session.aparenciaToken);assert.equal(ui.areaFor('/painel/agenda'),'inicio');
});
