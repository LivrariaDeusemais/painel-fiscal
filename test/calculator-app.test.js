const {test}=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const app=require('../src/tabela-precos/calculator-app');
test('app preserva modo celular e recolhe custos sem perder resultado',()=>{
 const html=app.render('<form><section class="tpc-section"><h2 class="tpc-section-title">Cenário</h2></section></form><section><div class="tpc-breakdown"><table><tr class="receive"><td>R$ 123,45</td></tr></table></div></section><a href="/ferramentas-ia/tabela-precos/promocoes">Limpar</a>');
 assert.match(html,/name="app" value="1"/);assert.match(html,/<details class="app-details">/);assert.match(html,/R\$ 123,45/);assert.match(html,/promocoes\?app=1/);assert.match(html,/viewport-fit=cover/);
});
test('manifesto tem ícones e início independente; worker não armazena preços nem sessão',()=>{
 const routes=new Map();app.mount({get:(path,handler)=>routes.set(path,handler)});let manifest,worker;
 routes.get('/ferramentas-ia/tabela-precos/promocoes/manifest.webmanifest')({}, {type(){return this},send(value){manifest=value}});
 assert.equal(manifest.display,'standalone');assert.match(manifest.start_url,/app=1/);assert.deepEqual(manifest.icons.map(i=>i.sizes),['192x192','512x512']);
 routes.get('/ferramentas-ia/tabela-precos/promocoes/sw.js')({}, {set(){return this},type(){return this},send(value){worker=value}});
 assert.match(worker,/Sem conexão/);assert.doesNotMatch(worker,/caches\./);new Function(worker);
});
