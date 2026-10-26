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
