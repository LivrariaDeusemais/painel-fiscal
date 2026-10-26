const {test}=require('node:test'),assert=require('node:assert/strict'),{catalog,capability,permitted,operationalGrant}=require('../src/access/catalog'),views=require('../src/painel/views'),s=require('../src/painel/service');
test('catálogo distingue telas operacionais de gestão administrativa e nega blocos novos por padrão',()=>{
 const u={perfil:'USUARIO',functionAccess:{arquivo:{view:true,edit:false},meli:{view:true,edit:true}}};
 assert.equal(capability('/ferramentas-ia/tabela-precos/mercado-livre/central-promocoes').id,'meli');assert.equal(capability('/arquivo/importar').id,'arquivo');
 assert.equal(permitted(u,'arquivo'),true);assert.equal(permitted(u,'arquivo',true),false);assert.equal(permitted(u,'bloco-futuro'),false);assert.equal(permitted({perfil:'ADMIN'},'bloco-futuro'),true);
 assert.equal(operationalGrant({originalUrl:'/usuarios/novo',session:{usuario:u}}),false);assert.equal(operationalGrant({originalUrl:'/arquivo/importar',session:{usuario:u}}),false);assert.equal(operationalGrant({originalUrl:'/ferramentas-ia/tabela-precos/mercado-livre/precos',session:{usuario:u}}),true);
 assert.equal(new Set(catalog.map(c=>c.id)).size,catalog.length);
});
test('painel mantém mensagens, minhas tarefas e equipe no mesmo primeiro bloco e respeita blocos revogados',()=>{
 const user={id:'1',nome:'Gestor',perfil:'USUARIO',team:['1','2'],functionAccess:{tarefas:{view:true},alertas:{view:true},'alertas-precos':{view:true},tabela:{view:true}}},people=[user,{id:'2',nome:'Filipe',perfil:'USUARIO'}],m={user,people,recipients:people,tasks:[],notices:[],period:s.period('diario'),pages:[],files:[],priceSummary:[{status:'Novo',count:5}],automaticByUser:{'2':[{label:'7 documentos para lançar',url:'/arquivo'}]}};
 const html=views.panel(m),first=html.indexOf('pn-dash-module'),end=html.indexOf('</article>',first),card=html.slice(first,end);
 assert.ok(card.indexOf('Mensagens não lidas')<card.indexOf('Minhas Tarefas'));assert.ok(card.indexOf('Minhas Tarefas')<card.indexOf('Tarefas da Equipe'));assert.match(html,/7 documentos para lançar/);assert.ok(html.indexOf('<h2>Preços</h2>')>end);
 const restricted=views.panel({...m,user:{...user,functionAccess:{tarefas:{view:true}}}});assert.doesNotMatch(restricted,/<h2>Preços<\/h2>|7 documentos para lançar/);
});
test('download é independente de gestão e identifica arquivos e planilhas',()=>{
 const {actionFor,downloadGrant}=require('../src/access/catalog');
 const paths=['/download/pdf/1','/arquivo/ver/1','/uploads/a.pdf','/espaco-contador/download/xml','/espaco-contador/download-extra-grupo/1','/dashboard/exportar-anual','/ferramentas-ia/tabela-precos/exportar-completa','/ferramentas-ia/tabela-precos/bling/divergencias/1','/ferramentas-ia/tabela-precos/bling/diagnostico/1','/ferramentas-ia/tabela-precos/mercado-livre/relatorio/1','/contabil/fechamento/arquivo/1','/conciliacao-bancaria/original/abc','/compras/arquivo/abc/pdf','/ferramentas-ia/codificador/modelo'];
 for(const path of paths)assert.equal(actionFor({method:'GET',originalUrl:path+'?mes=2026-10'}),'download',path);
 assert.equal(actionFor({method:'POST',path:'/espaco-contador/limpar-download/xml'}),'edit');
 assert.equal(actionFor({method:'GET',path:'/arquivo/usar/1'}),'edit');
 assert.equal(actionFor({method:'GET',path:'/arquivo/espelho/1'}),'view');
 const user={perfil:'USUARIO',functionAccess:{tabela:{view:true,download:true,edit:false},arquivo:{view:true,edit:true,download:false}}};
 assert.equal(permitted(user,'tabela','download'),true);assert.equal(permitted(user,'tabela',true),false);
 assert.equal(permitted(user,'arquivo','download'),false);assert.equal(permitted(user,'arquivo',true),true);
 assert.equal(downloadGrant({method:'GET',originalUrl:'/ferramentas-ia/tabela-precos/exportar-completa',session:{usuario:user}}),true);
 assert.equal(downloadGrant({method:'POST',originalUrl:'/ferramentas-ia/tabela-precos/publicar-marketplace',session:{usuario:user}}),false);
 assert.equal(require('../src/integracoes/access').canDownload(user,'tabela'),true);
 assert.equal(require('../src/integracoes/access').canOperate(user),false);
});
test('títulos do painel abrem consultas de mensagens, próprias e equipe com o período',()=>{
 const user={id:'1',nome:'Usuário',perfil:'USUARIO',team:['1','2']},m={user,people:[user,{id:'2',nome:'Equipe'}],recipients:[],tasks:[],notices:[],period:s.period('mensal','2026-10-26'),pages:[],files:[]};
 const html=views.panel(m);assert.match(html,/href="\/painel\/mensagens\?periodo=mensal/);assert.match(html,/href="\/painel\/agenda\?[^"<>]+&pessoa=1">Minhas Tarefas/);assert.match(html,/href="\/painel\/agenda\?[^"<>]+&escopo=equipe">Tarefas da Equipe/);
});
