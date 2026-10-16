(function(){
 document.querySelectorAll('.fx-period').forEach(form=>{
  const mode=form.elements.visao,year=form.elements.ano,months=form.querySelector('.fx-months'),monthField=form.querySelector('[data-month-field]');
  function sync(){months.hidden=mode.value!=='personalizado';monthField.hidden=mode.value!=='mensal';for(const input of months.querySelectorAll('input')){input.disabled=months.hidden;input.value=year.value+'-'+input.value.slice(-2);}}
  mode.addEventListener('change',sync);year.addEventListener('input',sync);
  form.addEventListener('submit',e=>{if(mode.value==='personalizado'&&!months.querySelector('input:checked')){e.preventDefault();months.querySelector('input').focus();months.querySelector('input').setCustomValidity('Marque pelo menos um mês.');months.querySelector('input').reportValidity();}});
  months.addEventListener('change',()=>months.querySelector('input').setCustomValidity(''));sync();
 });
})();
