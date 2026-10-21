const {test}=require('node:test'),assert=require('node:assert/strict');
const {nextRun}=require('../src/integracoes/scheduled-sync'),{canOperate}=require('../src/integracoes/access'),ui=require('../src/services/ui-executivo'),{pages}=require('../src/painel/routes');
test('agenda diária usa 03h Brasília e independe do fuso do servidor',()=>{
  for(const [now,expected] of [
    ['2026-10-21T05:59:59Z','2026-10-21T06:00:00.000Z'],
    ['2026-10-21T06:00:00Z','2026-10-22T06:00:00.000Z'],
    ['2026-12-31T23:59:00Z','2027-01-01T06:00:00.000Z'],
    ['2028-02-28T07:00:00Z','2028-02-29T06:00:00.000Z']])assert.equal(nextRun(new Date(now)).toISOString(),expected);
});
test('Filipe recebe acesso operacional específico sem ampliar o perfil nem outros usuários',()=>{
 const filipe={id:3,nome:'Filipe',perfil:'USUARIO'};
 assert.equal(canOperate(filipe),true);assert.equal(canOperate({id:4,nome:'Filipe',perfil:'USUARIO'}),false);assert.equal(canOperate({id:3,nome:'Outro',perfil:'USUARIO'}),false);assert.equal(canOperate({...filipe,perfil:'CONTADOR'}),false);assert.equal(canOperate({perfil:'ADMIN'}),true);assert.equal(canOperate(null),false);
 const urls=pages(filipe).map(p=>p.url);
 for(const end of ['bling','mercado-livre','mercado-livre/central-promocoes'])assert.ok(urls.includes('/ferramentas-ia/tabela-precos/'+end));
 assert.ok(!urls.includes('/usuarios'));assert.ok(!pages('USUARIO').some(p=>p.url.includes('/mercado-livre')));
 const header=ui.header({originalUrl:'/ferramentas-ia/tabela-precos/mercado-livre/central-promocoes',session:{usuario:filipe}});assert.match(header,/Promoção Mercado Livre/);assert.match(header,/Integração Bling/);
});
