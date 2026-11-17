document.querySelectorAll('[data-company-all]').forEach(master => {
  const inputs = [...master.closest('fieldset').querySelectorAll('[name="module"]')];
  const sync = () => {
    master.checked = inputs.every(input => input.checked);
    master.indeterminate = !master.checked && inputs.some(input => input.checked);
  };
  master.addEventListener('change', () => inputs.forEach(input => { input.checked = master.checked; }));
  inputs.forEach(input => input.addEventListener('change', sync));
  sync();
});
