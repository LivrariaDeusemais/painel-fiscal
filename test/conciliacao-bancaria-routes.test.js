const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createRouter } = require('../src/routes/conciliacao-bancaria');

test('fluxo HTTP autentica, importa, revisa, vincula, salva observação e exporta sem acessar banco real', async t => {
  const stored = new Map(), sql = [];
  const candidate = { id: 1, fornecedor: 'Fornecedor Exemplo', cnpj_cpf: '12345678901', valor: '100', numero_documento: 'S/N', data_despesa: '2026-09-03', tipo_pagamento: 'DOP', categoria: 'Serviços', anexo_pdf: null };
  const bianca = { ...candidate, id: 2, numero_documento: 'REC-02', fornecedor: 'Bianca Macedo', data_despesa: '2026-08-15', subcategoria: 'Salários' };
  const invoice = { id: 'nf', number: '0050252', supplier: 'Sociedade Bíblica do Brasil', document: '12345678000299',
    total: 60000, date: '2026-09-05', plan: { parts: [
      { method: 'PIX', bank: 'caixa', installments: [{ id: 'pix:0', date: '2026-09-05', amount: 20000 }] },
      { method: 'Cartão', card: 'Caixa VISA', installments: [{ id: 'cartao:0', date: '2026-09-10', amount: 20000 }, { id: 'cartao:1', date: '2026-10-10', amount: 20000 }] }
    ] } };
  const pool = {
    async query(query, args = []) {
      sql.push(query);
      if (query.startsWith('SELECT dados')) return { rows: stored.has(args.slice(0, 2).join(':')) ? [{ dados: JSON.parse(JSON.stringify(stored.get(args.slice(0, 2).join(':')))) }] : [] };
      if (query.startsWith('INSERT INTO conciliacoes')) stored.set(args.slice(0, 2).join(':'), JSON.parse(args[2]));
      if (query.startsWith('SELECT DISTINCT movimento')) return { rows: [...stored.entries()].filter(([key]) => key !== args.slice(0,2).join(':')).flatMap(([,state]) => state.rows.filter(r => r.linkedId).map(r => ({ id: r.linkedId }))) };
      if (query.startsWith('SELECT banco, mes, dados')) return { rows: [...stored.entries()].map(([key,dados]) => ({ banco:key.split(':')[0], mes:key.split(':')[1], dados })) };
      if (query.includes('FROM compras_estoque_nf')) return { rows: query.includes('ANY') ? [{ id: invoice.id, number: invoice.number }] : [{ id: invoice.id, dados: invoice }] };
      if (query.startsWith('SELECT banco, mes')) return { rows: [...stored.entries()].flatMap(([key,state]) => state.rows.filter(r => r.linkedId).map(r => ({ banco:key.split(':')[0], mes:key.split(':')[1], movimento_id:r.id, lancamento_id:String(r.linkedId) }))) };
      if (query.includes('FROM lancamentos')) {
        args.forEach((_,i) => assert.match(query,new RegExp('\\$'+(i+1)+'\\b'),'não deve haver parâmetro sem uso na consulta'));
        if (query.includes('l.id=ANY($1)')) return { rows: [candidate,bianca].filter(c => args[0].map(String).includes(String(c.id))).map(c => ({ id: c.id, number: c.numero_documento })) };
        if (query.includes('l.id=$1')) return { rows: [candidate,bianca].filter(c => String(c.id) === String(args[0])) };
        if (query.includes('ILIKE')) return { rows: [candidate,bianca].filter(c => c.fornecedor.toLowerCase().includes(String(args[0]).replace(/%/g,'').toLowerCase())) };
        return { rows: [candidate] };
      }
      return { rows: [] };
    },
    async connect() { return { query: pool.query, release() {} }; }
  };
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-routes-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const session = { usuario: { id: 1, perfil: 'ADMIN' } };
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { req.session = req.headers['x-no-session'] ? {} : session; next(); });
  app.use('/conciliacao-bancaria', createRouter({ pool, uploadsDir: directory, renderShell: (_req, _config, html) => html, protect: (req, res, next) => req.session.usuario ? next() : res.redirect('/login') }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/conciliacao-bancaria`;
  const get = (url, options) => fetch(base + url, options);
  assert.equal((await get('/', { headers: { 'x-no-session': '1' }, redirect: 'manual' })).status, 302);
  assert.equal((await get('/')).status, 200);
  assert.equal((await get('/dados')).status, 400);
  assert.ok(session.conciliacaoToken);
  assert.equal((await get('/conciliar?banco=inter&mes=2026-09', { method: 'POST' })).status, 403);
  const headers = { 'x-conciliacao-token': session.conciliacaoToken };
  const body = () => {
    const form = new FormData();
    form.set('banco','inter'); form.set('mes','2026-09'); form.set('tipo','corrente');
    form.set('extrato', new Blob(['Conta ;12345\nData Lançamento;Descrição;Valor;Saldo\n03/09/2026;Pix enviado: Fornecedor Exemplo;-100,00;500,00\n']), 'inter.csv');
    return form;
  };
  const imported = await (await get('/importar', { method: 'POST', headers, body: body() })).json();
  assert.equal(imported.state.rows.length, 1);
  assert.equal(imported.state.rows[0].clientStatus, 'Somar Conta Cliente');
  assert.equal(imported.state.rows[0].documentNumber, 'S/N');
  const again = await (await get('/importar', { method: 'POST', headers, body: body() })).json(); assert.equal(again.duplicate, true);
  const original = await get(`/original/${imported.state.sources[0].fileHash}?banco=inter&mes=2026-09`); assert.equal(original.status, 200); assert.match(await original.text(), /Fornecedor Exemplo/);
  const id = imported.state.rows[0].id;
  const post = body => get(`/salvar/${id}?banco=inter&mes=2026-09`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const saved = await (await post({ linkedId: 1, status: 'Conciliado', observation: 'Conferido manualmente' })).json(); assert.equal(saved.state.rows[0].manual, true);
  const observed = await (await post({ onlyObservation: true, observation: 'Texto revisado' })).json(); assert.equal(observed.state.rows[0].observation, 'Texto revisado');
  const found = await get('/comprovantes?banco=inter&mes=2026-09&busca=Bianca');
  assert.equal(found.status,200);
  const matches = await found.json(); assert.deepEqual(matches.map(c => c.id),[2]); assert.equal(matches[0].subcategoria,'Salários'); assert.deepEqual(matches[0].linkedTo,[]);
  const linked = await (await get('/comprovantes?banco=inter&mes=2026-09&busca=Fornecedor')).json();
  assert.deepEqual(linked[0].linkedTo,[{bank:'inter',month:'2026-09',movementId:id}]);
  const excel = await get('/exportar?banco=inter&mes=2026-09'); assert.equal(excel.status, 200); assert.match(excel.headers.get('content-disposition'), /Extrato%20conciliado/); assert.ok((await excel.arrayBuffer()).byteLength > 1000);
  const october = new FormData();
  october.set('banco','caixa'); october.set('mes','2026-10'); october.set('tipo','corrente');
  october.set('extrato',new Blob(['Data Lançamento;Descrição;Valor;Saldo\n03/10/2026;Pix enviado: Fornecedor Exemplo;-100,00;500,00\n']),'outubro.csv');
  const later = await (await get('/importar',{method:'POST',headers,body:october})).json();
  const duplicateLink = await get(`/salvar/${later.state.rows[0].id}?banco=caixa&mes=2026-10`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({linkedId:1,status:'Conciliado'})});
  assert.equal(duplicateLink.status,400); assert.match((await duplicateLink.json()).error,/outro banco ou mês/);
  const uploadStatement = async (bank, type, csv) => {
    const form = new FormData();
    form.set('banco',bank); form.set('mes','2026-10'); form.set('tipo',type);
    form.set('extrato',new Blob([csv]),type+'.csv');
    const response = await get('/importar',{method:'POST',headers,body:form});
    assert.equal(response.status,200);
    return response.json();
  };
  const card = await uploadStatement('caixa-visa','cartao',
    'Data;Descrição;Valor;Parcela\n01/09/2026;Sociedade Bíblica do Brasil;200,00;2/2\n01/10/2026;Pagamento da fatura;-200,00;\n');
  assert.equal(card.state.rows.length,1);
  assert.equal(card.state.rows[0].purchasePartId,'cartao:1');
  assert.equal(card.state.rows[0].documentNumber,'0050252');
  const current = await uploadStatement('caixa','corrente',
    'Data;Descrição;Valor\n10/10/2026;Pagamento fatura cartão Sociedade Bíblica do Brasil;-200,00\n');
  assert.equal(current.state.rows.find(r => /fatura/.test(r.description)).documentNumber,'');
  const readCard = await (await get('/dados?banco=caixa-visa&mes=2026-10')).json();
  assert.equal(readCard.rows[0].documentNumber,'0050252');
  assert.equal((await get('/exportar?banco=caixa-visa&mes=2026-10&filtros='+encodeURIComponent(JSON.stringify({documentNumber:'0050252'})))).status,200);
  assert.ok(sql.some(q => q.includes('pg_advisory_xact_lock')));
  session.usuario.perfil = 'CONTADOR'; assert.equal((await post({ status: 'Conciliado' })).status, 403);
});
