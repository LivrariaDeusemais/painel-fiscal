(()=>{
 document.querySelectorAll('[data-access-module]').forEach(module=>{
  const inputs=()=>[...module.querySelectorAll('input[name]:not(:disabled)')];
  const masters=[...module.querySelectorAll('[data-column], [data-module-all]')];
  const sync=()=>masters.forEach(master=>{
   const group=inputs().filter(input=>!master.dataset.column||input.name===master.dataset.column);
   master.disabled=!group.length;
   master.checked=!!group.length&&group.every(input=>input.checked);
   master.indeterminate=group.some(input=>input.checked)&&!master.checked;
  });
  module.addEventListener('change',event=>{
   const input=event.target;
   if(masters.includes(input))inputs().filter(i=>!input.dataset.column||i.name===input.dataset.column).forEach(i=>{i.checked=input.checked});
   if(input.name==='view'&&!input.checked)inputs().filter(i=>i.value===input.value).forEach(i=>{i.checked=false});
   if(input.dataset.column==='view'&&!input.checked)inputs().forEach(i=>{i.checked=false});
   inputs().filter(i=>i.checked&&i.name!=='view').forEach(i=>{const view=inputs().find(v=>v.name==='view'&&v.value===i.value);if(view)view.checked=true});
   sync();
  });
  sync();
 });
})();
