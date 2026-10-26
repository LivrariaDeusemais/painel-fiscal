const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('leitura automática exige mensagem visível em aba ativa e envia somente IDs renderizados',async()=>{
 const calls=[],listeners={},element={dataset:{pnVisibleNotices:'["notificacao-renderizada"]'}},opened={dataset:{pnOpenTask:'tarefa'}},list={dataset:{},closest:()=>null,replaceChildren(){}},node=()=>({append(){},dataset:{}});let observe;
 const root={dataset:{token:'csrf'},querySelector(selector){return selector==='[data-pn-notices]'?list:selector==='[data-pn-open-task]'?opened:null},querySelectorAll(selector){return selector==='[data-pn-visible-notices]'?[element]:[]},addEventListener(){}};
 const document={hidden:true,hasFocus:()=>true,querySelector:()=>root,createDocumentFragment:node,createElement:node,addEventListener(name,fn){listeners[name]=fn}};
 class IntersectionObserver{constructor(cb){observe=cb}observe(){}}
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/assets/painel.js'),'utf8'),{document,window:{IntersectionObserver,addEventListener(name,fn){listeners[name]=fn}},IntersectionObserver,setInterval(){},fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({items:[]})}}});
 observe([{target:element,isIntersecting:true,intersectionRatio:0.5}]);await new Promise(setImmediate);assert.equal(calls.length,0,'aba oculta não lê');
 document.hidden=false;observe([{target:element,isIntersecting:true,intersectionRatio:0.1}]);await new Promise(setImmediate);assert.equal(calls.length,0,'mensagem praticamente fora da tela não lê');
 observe([{target:element,isIntersecting:true,intersectionRatio:0.5}]);await new Promise(setImmediate);
 const reads=calls.filter(c=>c.options?.method==='POST');assert.equal(reads.length,1);assert.deepEqual(JSON.parse(reads[0].options.body),{ids:['notificacao-renderizada']});
 listeners.focus();await new Promise(setImmediate);assert.equal(calls.filter(c=>c.options?.method==='POST').length,1,'mensagens futuras não são baixadas por estar com a tarefa aberta');
});
