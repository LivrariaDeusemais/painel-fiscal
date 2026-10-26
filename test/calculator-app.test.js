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

test('aplicativo mantém seu cabeçalho compacto mesmo com layout executivo',()=>{
 const ui=require('../src/services/ui-executivo');const html=app.render('<p>Calculadora</p>');assert.equal(ui.decorate({path:'/ferramentas-ia/tabela-precos/promocoes',session:{usuario:{id:1,perfil:'ADMIN'}}},html),html);
});
test('compartilhamento envia só o endereço de acesso e permite copiar sem compartilhamento nativo',async()=>{
 const vm=require('node:vm'),fs=require('node:fs'),code=fs.readFileSync(require.resolve('../src/assets/calculator-app.js'),'utf8');
 function setup(navigator){const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',addEventListener(event,fn){this[event]=fn;},showModal(){this.open=true},select(){},focus(){}});return elements.get(id)};vm.runInNewContext(code,{document:{querySelectorAll:()=>[],getElementById:element},window:{addEventListener(){}},navigator,location:{origin:'https://app.plennatecsistemas.com.br',search:'?custo=100&sku=privado'},URL});return element;}
 let shared;const native=setup({share:async data=>{shared=data}});await native('share-app').click();assert.equal(shared.url,'https://app.plennatecsistemas.com.br/ferramentas-ia/tabela-precos/promocoes?app=1');assert.doesNotMatch(shared.url,/custo|sku/);
 let copied;const fallback=setup({clipboard:{writeText:async value=>{copied=value}}});await fallback('share-app').click();assert.equal(fallback('share-dialog').open,true);await fallback('copy-share-link').click();assert.equal(copied,shared.url);
 const canceled=setup({share:async()=>{throw Object.assign(new Error(),{name:'AbortError'})}});await canceled('share-app').click();assert.notEqual(canceled('share-dialog').open,true);
});
test('SKU carrega ao sair pelo Próximo sem keydown e não duplica Enter/blur',()=>{
 const vm=require('node:vm'),fs=require('node:fs'),source=fs.readFileSync(require.resolve('../src/routes/index'),'utf8');
 const start=source.indexOf("<script>(()=>{const form=document.getElementById('price-calculator-form')");const fragment=source.slice(start+'<script>'.length,source.indexOf('const manual=',start))+'})();';
 function setup(value,loaded='',market='Mercado Livre'){let calls=0;const handlers={},timers=[];const sku={value,dataset:{loadedSku:loaded},addEventListener:(name,fn)=>handlers[name]=fn};const elements={'price-calculator-form':{dataset:{loadedMarketplace:market},requestSubmit:()=>calls++},'price-calculator-sku':sku,'price-calculator-marketplace':{value:market,addEventListener(){}},'price-calculator-load':{}};vm.runInNewContext(fragment,{document:{getElementById:id=>elements[id]},setTimeout:fn=>timers.push(fn)});return {handlers,timers,calls:()=>calls};}
 const android=setup('B1253');android.handlers.blur();assert.equal(android.calls(),1);
 const desktop=setup('B1253');desktop.handlers.keydown({key:'Enter',preventDefault(){}});desktop.handlers.blur();desktop.timers.forEach(fn=>fn());assert.equal(desktop.calls(),1);
 const unchanged=setup(' b1253 ','B1253');unchanged.handlers.blur();assert.equal(unchanged.calls(),0);
 for(const args of [[''],['B1253','','']]){const missing=setup(...args);missing.handlers.blur();assert.equal(missing.calls(),0);}
});
