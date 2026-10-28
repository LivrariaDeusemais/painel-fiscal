const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../src/assets/product-selection.js'), 'utf8');
function page(storage, skus, clear = '') {
 const handlers = {}, events = {}, hidden = [];
 const boxes = skus.map(value => ({value, addEventListener(type, fn) {this[type] = fn;}}));
 const form = {dataset:{owner:'1',clearSelection:clear},elements:{status:{value:'Validado'}},addEventListener(t,f){handlers[t]=f;},querySelectorAll(){return hidden;},append(x){hidden.push(x);}};
 const all = {addEventListener(t,f){this[t]=f;}};
 const count = {};
 let accepted = false;
 const context = {document:{getElementById(id){return id==='bulk-products'?form:id==='select-all-products'?all:count;},querySelectorAll(){return boxes;},addEventListener(t,f){events[t]=f;},createElement(){return {dataset:{}};}},window:{addEventListener(t,f){events[t]=f;}},sessionStorage:{getItem(k){return storage[k];},setItem(k,v){storage[k]=v;}},location:{href:'https://example.com/ferramentas-ia/tabela-precos/produtos',origin:'https://example.com',search:''},URL,confirm(){return accepted;},alert(){}};
 vm.runInNewContext(source,context);
 return {boxes,form,count,all,hidden,select(i){boxes[i].checked=true;boxes[i].change();},navigate(){events.submit({target:{action:context.location.href}});events.pagehide();},leave(){events.pagehide();},submit(ok){accepted=ok;let prevented=false;handlers.submit({preventDefault(){prevented=true;}});return prevented;}};
}
test('accumulates across searches, confirms every selected SKU and clears only on success',()=>{
 const storage={};const a=page(storage,['A']);a.select(0);a.navigate();
 const b=page(storage,['B']);b.select(0);assert.match(b.count.textContent,/2 selecionado/);
 assert.equal(b.submit(false),true);assert.equal(b.hidden.length,0);assert.equal(b.boxes[0].checked,true);
 assert.equal(b.submit(true),false);assert.deepEqual(b.hidden.map(x=>x.value),['A','B']);
 b.navigate();const done=page(storage,['A','B'],'1');assert.match(done.count.textContent,/0 selecionado/);
});
test('leaving the screen resets accumulated selection',()=>{
 const storage={};const a=page(storage,['A']);a.select(0);a.leave();
 assert.match(page(storage,['A']).count.textContent,/0 selecionado/);
});
test('select all changes visible rows only and failed batches retain selections',()=>{
 const storage={};const a=page(storage,['A']);a.select(0);a.navigate();
 const b=page(storage,['B','C']);b.all.checked=true;b.all.change();assert.match(b.count.textContent,/3 selecionado/);
 b.all.checked=false;b.all.change();assert.match(b.count.textContent,/1 selecionado/);
 b.submit(true);b.navigate();assert.match(page(storage,['A']).count.textContent,/1 selecionado/);
});
