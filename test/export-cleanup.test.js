const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('limpeza global de exportação preserva conteúdo aria-busy e remove overlay',()=>{
  const source=fs.readFileSync(require.resolve('../src/routes/index.js'),'utf8');
  const start=source.indexOf('function renderPlennaTecExportarExcelV2Assets()');
  const end=source.indexOf('\nrouter.use(',start);
  const html=vm.runInNewContext(source.slice(start,end)+'\nrenderPlennaTecExportarExcelV2Assets()');
  const script=html.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
  const element=cls=>({className:cls,innerText:'',style:{setProperty(k,v){this[k]=v},removeProperty(){}},classList:{remove(){}},removeAttribute(){}});
  const page=element(''),overlay=element('loading-overlay');
  const events={};
  const document={readyState:'complete',body:{style:{removeProperty(){}},classList:{add(){},remove(){}}},documentElement:{style:{removeProperty(){}},classList:{remove(){}}},
    addEventListener(){},querySelectorAll(sel){
      if(sel==='body *')return [page,overlay];
      if(sel==='[aria-busy="true"]')return [page];
      if(sel==='.loading-overlay')return [overlay];
      return [];
    }};
  const window={addEventListener(name,fn){events[name]=fn}};
  vm.runInNewContext(script,{document,window,setTimeout(){}});
  events.pageshow();events.focus();
  assert.equal(page.style.display,undefined);
  assert.equal(page.style.visibility,undefined);
  assert.equal(overlay.style.display,'none');
});
