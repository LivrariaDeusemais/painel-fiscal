const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');
const Excel = require('exceljs');
const { mount } = require('../src/empresas/routes');
const { requireInternalSession } = require('../src/access/internal');
const { allowed, permissions } = require('../src/empresas/service');
const { actionFor } = require('../src/access/catalog');

const expense = 'cliente-despesas';
const access = {
  module: [expense, 'cliente-categorias', 'cliente-fornecedores', 'cliente-empresa'],
  edit: [expense, 'cliente-categorias', 'cliente-fornecedores', 'cliente-empresa'],
  download: [expense]
};

test('o acesso efetivo do cliente combina módulos da empresa e permissões independentes', () => {
  const { enabled: modulos, grants: permissoes } = permissions({
    module: expense, edit: [expense, 'cliente-empresa', 'backup'],
    download: ['cliente-categorias']
  });
  const user = { modulos, permissoes };
  assert.equal(allowed(user, expense), true);
  assert.equal(allowed(user, expense, 'edit'), true);
  assert.equal(allowed(user, expense, 'download'), false);
  assert.equal(allowed(user, 'cliente-empresa', 'edit'), false);
  assert.equal(allowed(user, 'backup', 'edit'), false);
  assert.equal(permissoes['cliente-categorias'].download, false);
  assert.equal(actionFor({ method: 'HEAD', path: '/clientes/despesas/download/id' }), 'download');
  assert.equal(actionFor({ method: 'GET', path: '/clientes/despesas/exportar' }), 'download');
});

const socket = process.env.PLENNATEC_TEST_PG_SOCKET;
test('dois clientes ativam convites, registram despesas e recebem apenas seus próprios dados e permissões', { skip: !socket }, async t => {
  assert.match(socket, /^\/(?:private\/)?tmp\/plennatec-pg\.[\w]+$/);
  const config = { host: socket, port: 55444, database: 'postgres', user: 'plennatec' };
  const db = new Pool(config);
  const schema = 'pilot_' + randomUUID().replaceAll('-', '');
  await db.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ ...config, options: `-c search_path=${schema}` });
  t.after(async () => {
    await pool.end();
    await db.query(`DROP SCHEMA ${schema} CASCADE`);
    await db.end();
  });
  await pool.query("CREATE TABLE usuarios(id INT PRIMARY KEY,perfil TEXT); INSERT INTO usuarios VALUES (1,'ADMIN'),(2,'USUARIO')");

  const app = express();
  const sent = [];
  let fail = true;
  app.use(express.urlencoded({ extended: true }));
  app.use(session({ secret: randomUUID(), saveUninitialized: false, resave: false }));
  app.get('/test-session/:id', (req, res) => {
    req.session.usuario = { id: req.params.id, perfil: req.params.id === '1' ? 'ADMIN' : 'USUARIO' };
    res.sendStatus(200);
  });
  mount(app, pool, async invite => {
    sent.push(invite);
    if (fail) throw new Error('SMTP simulado indisponível');
  });
  app.use(requireInternalSession);
  app.get('/dashboard', (req, res) => res.send('Dashboard Deus é Mais'));
  app.get('/uploads/legado.pdf', (req, res) => res.send('arquivo interno'));
  const server = await new Promise((resolve, reject) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    listening.once('error', reject);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;

  function browser() {
    let cookie = '';
    let csrf = '';
    function values(fields) {
      return Object.entries({ csrf, ...fields }).flatMap(([key, value]) => [value].flat().map(item => [key, item]));
    }
    async function request(path, body, method = 'GET') {
      const response = await fetch(origin + path, { redirect: 'manual', method, body, headers: { Cookie: cookie } });
      if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
      return response;
    }
    return {
      get: request,
      async html(path) {
        const response = await request(path);
        assert.equal(response.status, 200);
        const html = await response.text();
        csrf = html.match(/name="csrf" value="([^"]+)"/)?.[1] || csrf;
        return html;
      },
      post(path, fields) {
        return request(path, new URLSearchParams(values(fields)), 'POST');
      },
      upload(path, fields) {
        const form = new FormData();
        for (const [key, value] of values(fields)) form.append(key, value);
        return request(path, form, 'POST');
      }
    };
  }

  const admin = browser(), staff = browser(), alice = browser(), bob = browser();
  assert.equal((await alice.get('/uploads/legado.pdf')).headers.get('location'), '/login');
  assert.equal((await alice.post('/novo', {})).headers.get('location'), '/login');
  assert.equal((await staff.get('/empresas-clientes')).headers.get('location'), '/login');
  await staff.get('/test-session/2');
  assert.equal((await staff.get('/empresas-clientes')).status, 403);
  await admin.get('/test-session/1');
  assert.match(await admin.html('/empresas-clientes'), /Novo convite/);
  assert.equal((await admin.post('/empresas-clientes/convites', { csrf: 'errado' })).status, 403);

  const invite = { ...access, empresa: 'Empresa Alfa', email: 'alfa@example.test' };
  assert.equal((await admin.post('/empresas-clientes/convites', invite)).status, 303);
  assert.match(await admin.html('/empresas-clientes'), /Falha no envio do e-mail/);
  assert.equal((await admin.post('/empresas-clientes/convites', invite)).status, 409);
  assert.equal(sent.length, 1);
  const alfa = sent[0].empresa_id;
  const oldLink = '/clientes/convite?token=' + sent[0].raw;
  assert.equal((await admin.post(`/empresas-clientes/${alfa}/revogar`, { version: 1 })).status, 303);
  assert.equal((await alice.get(oldLink)).status, 404);
  fail = false;
  assert.equal((await admin.post(`/empresas-clientes/${alfa}/reenviar`, { version: 2 })).status, 303);
  assert.equal((await admin.post(`/empresas-clientes/${alfa}/reenviar`, { version: 2 })).status, 409);
  assert.equal(sent.length, 2);
  assert.equal((await alice.get(oldLink)).status, 404);
  assert.equal((await admin.post('/empresas-clientes/convites', { ...access, empresa: 'Empresa Beta', email: 'beta@example.test' })).status, 303);
  const invitePath = offer => '/clientes/convite?token=' + offer.raw;

  const logo = new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l2MAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' });
  async function activate(browser, offer, cnpj) {
    assert.equal((await browser.get('/clientes/ativar')).status, 400);
    const html = await browser.html(invitePath(offer));
    const digest = html.match(/name="invite" value="([^"]+)"/)[1];
    assert.equal((await browser.post('/clientes/confirmar', { invite: digest })).status, 303);
    await browser.html('/clientes/ativar');
    const response = await browser.upload('/clientes/ativar', { invite: digest, nome: 'Responsável',
      empresa: offer.nome, razao: offer.nome + ' LTDA', cnpj, senha: 'ficticia-senha31', repita: 'ficticia-senha31', logo });
    assert.equal(response.status, 303, response.status === 303 ? undefined : await response.text());
    assert.equal((await browser.get(invitePath(offer))).status, 404);
    assert.equal((await browser.get('/clientes/logomarca')).headers.get('content-type'), 'image/png');
    assert.match(await browser.html('/clientes'), new RegExp(offer.nome));
    assert.equal((await browser.get('/dashboard')).status, 403);
    assert.equal((await browser.get('/uploads/legado.pdf')).status, 403);
    assert.equal((await browser.get('/empresas-clientes')).status, 403);
    assert.equal((await browser.post('/clientes/sair', {})).status, 303);
    await browser.html('/clientes/login');
    assert.equal((await browser.post('/clientes/login', { email: offer.email, senha: 'senha errada' })).status, 401);
    assert.equal((await browser.post('/clientes/login', { email: offer.email, senha: 'ficticia-senha31' })).status, 303);
    await browser.html('/clientes');
  }
  await activate(alice, sent[1], '11.222.333/0001-81');
  await activate(bob, sent[2], '12.345.678/0001-95');
  assert.equal((await admin.get('/dashboard')).status, 200);
  const beta = sent[2].empresa_id;
  async function dictionaries(browser, tenant) {
    assert.equal((await browser.post('/clientes/categorias', { nome: 'Serviços' })).status, 303);
    assert.equal((await browser.post('/clientes/fornecedores', { nome: 'Fornecedor' })).status, 303);
    const { rows: [row] } = await pool.query(`SELECT c.id AS categoria_id,f.id AS fornecedor_id FROM cliente_categorias c
      JOIN cliente_fornecedores f ON c.empresa_id=f.empresa_id WHERE c.empresa_id=$1`, [tenant]);
    return row;
  }
  const a = await dictionaries(alice, alfa);
  const b = await dictionaries(bob, beta);
  const anexo = new Blob(['%PDF-1.7\nfixture'], { type: 'application/pdf' });
  const fields = { data: '2026-11-17', valor: '125,60', anexo };
  assert.equal((await alice.upload('/clientes/despesas/novo', { ...fields, ...b, descricao: 'Cruzada' })).status, 409);
  assert.equal((await alice.upload('/clientes/despesas/novo', { ...fields, ...a, descricao: 'Somente Alfa' })).status, 303);
  assert.equal((await bob.upload('/clientes/despesas/novo', { ...fields, ...b, descricao: 'Somente Beta' })).status, 303);
  const { rows: [own] } = await pool.query('SELECT id FROM cliente_despesas WHERE empresa_id=$1', [alfa]);
  assert.equal((await alice.get('/clientes/despesas/download/' + own.id)).status, 200);
  assert.equal((await bob.get('/clientes/despesas/download/' + own.id)).status, 404);
  assert.equal((await bob.get('/clientes/despesas/editar/' + own.id)).status, 404);
  assert.equal((await bob.post('/clientes/despesas/excluir/' + own.id, {})).status, 404);
  const list = await bob.html('/clientes/despesas?mes=2026-11');
  assert.match(list, /Somente Beta/);
  assert.doesNotMatch(list, /Somente Alfa/);

  const workbook = new Excel.Workbook();
  const exportResponse = await bob.get('/clientes/despesas/exportar?mes=2026-11');
  assert.equal(exportResponse.status, 200);
  await workbook.xlsx.load(Buffer.from(await exportResponse.arrayBuffer()));
  assert.equal(workbook.worksheets[0].rowCount, 2);
  assert.equal(workbook.worksheets[0].getCell('B2').value, 'Somente Beta');
  assert.equal(workbook.worksheets[0].getCell('E2').value, 125.60);

  assert.equal((await admin.post(`/empresas-clientes/${alfa}/acessos`, { ...access, download: [], version: 1 })).status, 303);
  assert.equal((await alice.get('/clientes/despesas/download/' + own.id)).status, 403);
  assert.equal((await alice.get('/clientes/despesas/DOWNLOAD/' + own.id)).status, 404);
  assert.equal((await alice.get('/clientes/despesas/exportar?mes=2026-11')).status, 403);
  assert.equal((await alice.get('/clientes/despesas/editar/' + own.id)).status, 200);
  assert.equal((await alice.upload('/clientes/despesas/editar/' + own.id, { ...a, ...fields, descricao: 'Alfa editada' })).status, 303);
  assert.equal((await admin.post(`/empresas-clientes/${alfa}/acessos`, { module: expense, download: expense, version: 2 })).status, 303);
  assert.equal((await alice.get('/clientes/despesas/download/' + own.id)).status, 200);
  assert.equal((await alice.get('/clientes/despesas/editar/' + own.id)).status, 403);
  assert.equal((await admin.post(`/empresas-clientes/${alfa}/acessos`, { view: expense, version: 3 })).status, 303);
  assert.equal((await alice.get('/clientes/despesas?mes=2026-11')).status, 403);
  assert.equal((await bob.get('/clientes/despesas?mes=2026-11')).status, 200);
});
