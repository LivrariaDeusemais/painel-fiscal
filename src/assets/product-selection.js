/* Selection lasts only while navigating within the Products workflow. */
(() => {
  const form = document.getElementById('bulk-products');
  if (!form) return;
  const base = '/ferramentas-ia/tabela-precos/produtos';
  const key = 'plennatec:product-selection:' + form.dataset.owner;
  const boxes = [...document.querySelectorAll('input[form="bulk-products"][name="skus"]')];
  const all = document.getElementById('select-all-products');
  const count = document.getElementById('product-selection-count');
  let selected = new Set(), continuing = false;
  const read = () => { try { return JSON.parse(sessionStorage.getItem(key)) || {}; } catch { return {}; } };
  const save = () => { try { sessionStorage.setItem(key, JSON.stringify({ skus: [...selected], continuing })); } catch {} };
  const restore = () => {
    const state = read();
    selected = new Set(state.continuing && !form.dataset.clearSelection ? state.skus || [] : []);
    continuing = false;
    save();
    render();
  };
  function render() {
    boxes.forEach(box => { box.disabled = false; box.checked = selected.has(box.value); });
    const checked = boxes.filter(box => box.checked).length;
    if (all) { all.checked = boxes.length > 0 && checked === boxes.length; all.indeterminate = checked > 0 && checked < boxes.length; }
    count.textContent = selected.size + ' selecionado(s)' + (selected.size > checked ? ' · ' + (selected.size - checked) + ' fora desta página' : '');
  }
  boxes.forEach(box => box.addEventListener('change', () => { if (box.checked) selected.add(box.value); else selected.delete(box.value); save(); render(); }));
  all?.addEventListener('change', () => { boxes.forEach(box => { if (all.checked) selected.add(box.value); else selected.delete(box.value); }); save(); render(); });
  const internal = url => { const target = new URL(url, location.href); return target.origin === location.origin && (target.pathname === base || target.pathname.startsWith(base + '/')); };
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.ctrlKey || event.metaKey || link.target === '_blank') return;
    if (link.hasAttribute('data-clear-products')) { selected.clear(); continuing = false; save(); render(); }
    else { continuing = internal(link.href); save(); }
  });
  document.addEventListener('submit', event => { if (event.target !== form) { continuing = internal(event.target.action); save(); } });
  // Navigation API also detects history traversal and programmatic form.submit().
  window.navigation?.addEventListener('navigate', event => { continuing = internal(event.destination.url); save(); });
  window.addEventListener('pagehide', () => { if (!continuing) selected.clear(); save(); });
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    if (!read().continuing && location.search) { location.replace(base); return; }
    restore();
  });
  form.addEventListener('submit', event => {
    if (!selected.size) { event.preventDefault(); alert('Selecione pelo menos um produto.'); return; }
    const deleting = event.submitter?.hasAttribute('formaction');
    const message = deleting
      ? 'Excluir do Plennatec os produtos e seus vínculos: ' + [...selected].join(', ') + '? Os cadastros no Bling e nos marketplaces permanecem. Uma nova importação ou sincronização pode trazer os produtos novamente.'
      : 'Tem certeza que deseja mudar o status de "' + selected.size + '" itens para ' + form.elements.status.value + '?';
    if (!confirm(message)) { event.preventDefault(); return; }
    form.querySelectorAll('[data-selected-sku]').forEach(input => input.remove());
    boxes.forEach(box => { box.disabled = true; });
    selected.forEach(sku => { const input = document.createElement('input'); input.type = 'hidden'; input.name = 'skus'; input.value = sku; input.dataset.selectedSku = ''; form.append(input); });
    continuing = true; save();
  });
  restore();
})();
