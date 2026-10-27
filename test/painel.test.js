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
test('somente criador, responsável atual e admin leem; participantes anteriores não veem tarefas alheias',()=>{
 const t={criador:'1',responsavel:'3',participantes:['1','2','3']};
 for(const id of [1,3])assert.equal(s.canRead({id,perfil:'USUARIO'},t),true);
 assert.equal(s.canRead({id:2,perfil:'USUARIO'},t),false);assert.equal(s.canRead({id:4,perfil:'USUARIO'},t),false);assert.equal(s.canOwn({id:4,perfil:'ADMIN'},t),false);assert.equal(s.canOwn({id:1,perfil:'USUARIO'},t),true);assert.equal(s.canWork({id:1,perfil:'USUARIO'},t),false);assert.equal(s.canWork({id:3,perfil:'CONTADOR'},t),true);assert.equal(s.canWork({id:4,perfil:'ADMIN',team:['3']},t),true);
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
 const req={originalUrl:'/visao-geral',session:{usuario:{id:1,nome:'Gestor',perfil:'ADMIN'}}};const header=ui.header(req);assert.match(header,/exec-favorites-star/);assert.ok(header.indexOf('class="exec-favorites"')<header.indexOf('class="exec-subnav"'));assert.doesNotMatch(header,/★ FAVORITOS/);assert.match(header,/aria-label="Definir favoritos"/);assert.ok(req.session.aparenciaToken);assert.equal(ui.areaFor('/painel/agenda'),'inicio');
});
test('área de tarefas restringe as tarefas de outra pessoa e oferece edição somente ao criador',()=>{
 const views=require('../src/painel/views'),people=[{id:'1',nome:'Gestor',perfil:'ADMIN'},{id:'2',nome:'Ana',perfil:'USUARIO'},{id:'3',nome:'Beto',perfil:'USUARIO'}];
 const base={user:people[1],people,period:s.period('diario'),files:[],notices:[],pages:[],person:people[2],events:[],tasks:[{id:'a',criador:'2',responsavel:'3',titulo:'Criada pela Ana',descricao:'',prazo:s.today(),status:'aberta',repeticao:'unica',versao:1},{id:'b',criador:'1',responsavel:'3',titulo:'Assunto privado do Beto',prazo:s.today(),status:'aberta',repeticao:'unica',versao:1}]};
 let html=views.agenda(base);assert.match(html,/Criada pela Ana/);assert.doesNotMatch(html,/Assunto privado do Beto/);assert.match(html,/Somente as tarefas que você criou/);
 html=views.agenda({...base,task:base.tasks[0]});assert.match(html,/data-pn-edit/);assert.match(html,/data-pn-delete/);assert.match(html,/data-pn-message/);
 html=views.agenda({...base,user:people[2],task:base.tasks[0]});assert.doesNotMatch(html,/data-pn-delete/);assert.doesNotMatch(html,/data-pn-edit-form/);assert.match(html,/Registrar observação/);assert.match(html,/Responder Ana/);
 html=views.agenda({...base,user:people[0],task:base.tasks[0]});assert.doesNotMatch(html,/data-pn-delete/,'ADMIN que não criou não exclui');
});
test('permissões de edição/exclusão são impostas no servidor, com conflito de versão',async()=>{
 const t={id:'00000000-0000-4000-8000-000000000001',criador:'2',responsavel:'3',versao:2,status:'aberta',titulo:'Conferir preço',participantes:['2','3']},calls=[];
 const pool={async connect(){return {async query(sql,args){calls.push([sql,args]);return {rows:sql.startsWith('SELECT * FROM painel_tarefas')?[t]:sql.startsWith('SELECT usuario FROM painel_equipe_acessos')?[{usuario:'2'},{usuario:'3'}]:[]}},release(){}}}};
 await assert.rejects(s.change(pool,{id:3,perfil:'USUARIO'},t.id,{acao:'editar',versao:2}),e=>e.status===403);
 await assert.rejects(s.change(pool,{id:1,perfil:'ADMIN'},t.id,{acao:'excluir',versao:2}),e=>e.status===403);
 await assert.rejects(s.change(pool,{id:2,perfil:'USUARIO'},t.id,{acao:'excluir',versao:1}),e=>e.status===409);
 await s.change(pool,{id:3,nome:'Beto',perfil:'USUARIO'},t.id,{acao:'concluir',versao:2});
 const notice=calls.find(([sql])=>sql.startsWith('INSERT INTO painel_notificacoes'));assert.equal(notice[1][1],'2');assert.match(notice[1][3],/Beto concluiu/);assert.ok(calls.some(([sql])=>sql==='COMMIT'));
});
test('administradores só leem e executam tarefas da própria equipe; criador conserva seu acesso',()=>{
 const task={criador:'4',responsavel:'3'};
 assert.equal(s.canRead({id:1,perfil:'ADMIN',team:['1','2']},task),false);
 assert.equal(s.canWork({id:1,perfil:'ADMIN',team:['1','2']},task),false);
 assert.equal(s.canRead({id:5,perfil:'ADMIN',team:['5','3']},task),true);
 assert.equal(s.canWork({id:5,perfil:'ADMIN',team:['5','3']},task),true);
 assert.equal(s.canRead({id:4,perfil:'USUARIO'},task),true);
 assert.equal(s.canRead({id:5,perfil:'ADMIN'},task),false,'sem contexto de equipe não há acesso global implícito');
});
test('acompanhamento mapeado permite leitura ao usuário comum sem liberar execução nem autoria',()=>{
 const task={criador:'1',responsavel:'3'},viewer={id:2,perfil:'USUARIO',team:['2','3']};
 assert.equal(s.canRead(viewer,task),true);assert.equal(s.canWork(viewer,task),false);assert.equal(s.canOwn(viewer,task),false);
 assert.equal(s.canRead({...viewer,team:['2']},task),false);
 assert.equal(s.canRead(viewer,{criador:'2',responsavel:'1'}),true,'criação para superior conserva acesso à própria solicitação');
 assert.equal(s.canRead(viewer,{criador:'4',responsavel:'1'}),false,'solicitar tarefa não libera as outras do destinatário');
});
test('contexto não herda equipe por transitividade e criação permite destinatário fora da equipe',async()=>{
 const calls=[],pool={async query(sql,args){calls.push([sql,args]);return {rows:sql.startsWith('SELECT usuario FROM painel_equipe_acessos')?[{usuario:'3'}]:sql.startsWith('SELECT id::text')?[{id:'1',nome:'Gestor',perfil:'ADMIN'}]:[]}}};
 const actor=await s.context(pool,{id:2,perfil:'USUARIO'});assert.deepEqual(actor.team,['2','3']);assert.deepEqual(actor.workTeam,['2']);
 await s.create(pool,actor,{titulo:'Pagar pedido',responsavel:'1',inicio:s.today(),repeticao:'unica'},()=>[]);
 assert.ok(calls.some(([sql,args])=>sql.startsWith('INSERT INTO painel_rotinas')&&args[4]==='1'));
});
test('filtro de situação respeita o período e lista oferece lápis exclusivo do criador e mensagens por pessoa',()=>{
 const views=require('../src/painel/views'),people=[{id:'1',nome:'Gestor',perfil:'ADMIN'},{id:'2',nome:'Filipe',perfil:'USUARIO'}],p=s.period('diario','2026-10-26');
 const tasks=[{id:'a',criador:'1',responsavel:'2',titulo:'Pendente hoje',status:'aberta',prazo:p.start,repeticao:'unica'},{id:'b',criador:'1',responsavel:'2',titulo:'Concluída hoje',status:'concluida',concluido_dia:p.start,repeticao:'unica'},{id:'c',criador:'1',responsavel:'2',titulo:'Concluída fora',status:'concluida',concluido_dia:'2026-10-20',repeticao:'unica'},{id:'d',criador:'1',responsavel:'2',titulo:'Pendente anterior',status:'aberta',prazo:'2026-10-20',repeticao:'unica'}];
 const m={user:{...people[0],team:['1','2']},people,person:people[1],tasks,period:p,files:[],pages:[],notices:[{id:'n',responsavel:'2',tarefa:'a',texto:'Mensagem de Filipe',criado_em:new Date()}]};
 let html=views.agenda({...m,status:'aberta'});assert.match(html,/>Pendente hoje<\/a>/);assert.doesNotMatch(html,/>Concluída hoje<\/a>/);assert.match(html,/>Pendente anterior<\/a>/);assert.match(html,/aria-label="Editar tarefa Pendente hoje"/);assert.match(html,/data-pn-unread="2"/);assert.match(html,/Mensagem de Filipe/);
 html=views.agenda({...m,status:'concluida'});assert.match(html,/>Concluída hoje<\/a>/);assert.doesNotMatch(html,/>Concluída fora<\/a>|>Pendente hoje<\/a>/);
 html=views.agenda({...m,user:people[1],status:'aberta'});assert.doesNotMatch(html,/aria-label="Editar tarefa/);
});
test('contadores incluem atrasadas e conclusões do período, sem incluir equipe alheia ou canceladas',()=>{
 const views=require('../src/painel/views'),user={id:'1',nome:'Eu',perfil:'ADMIN',team:['1','2']},people=[user,{id:'2',nome:'Equipe',perfil:'USUARIO'}];
 const task=(responsavel,status,prazo,concluido_dia)=>({id:Math.random().toString(),responsavel,criador:'1',titulo:'Teste',status,prazo,concluido_dia,repeticao:'unica'});
 const m={user,people,period:s.period('diario','2026-10-27'),pages:[],files:[],notices:[],tasks:[task('1','aberta','2026-10-01'),task('1','concluida','2026-10-01','2026-10-27'),task('1','cancelada','2026-10-27'),task('1','concluida','2026-10-01','2026-10-26'),task('2','concluida','2026-10-27','2026-10-27'),task('3','aberta','2026-10-27')]};
 const html=views.panel(m);assert.match(html,/data-pn-task-total="mine">2</);assert.match(html,/data-pn-task-total="team">1</);
 const agenda=views.agenda({...m,automaticByUser:{'1':[{key:'arquivo',menu:'financeiro',count:4,url:'/arquivo',label:'Arquivos'}]}});
 assert.match(agenda,/class="pn-work-columns"/);assert.match(agenda,/class="pn-work-alerts"/);assert.match(agenda,/Qtde Arquivos/);assert.match(agenda,/data-indicator-layout="table"/);
});
test('consulta de compras permite mês corrente sem ampliar competência de fechamento financeiro',()=>{
 const views=require('../src/fechamento/views'),service=require('../src/fechamento/service'),current=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'}).slice(0,7);
 const model={area:'compras',month:current,year:Number(current.slice(0,4)),mode:'mensal',selectedMonths:[current],action:'/compras',closed:{count:0,data:service.blank()},live:{},categories:[],suppliers:[]};
 assert.match(views.dashboard(model),new RegExp('name="mes" value="'+current+'" max="'+current+'"'));
 assert.match(views.dashboard({...model,area:'financeiro',canSeeClosing:false}),new RegExp('name="mes" value="'+current+'" max="'+service.lastClosedMonth()+'"'));
});
