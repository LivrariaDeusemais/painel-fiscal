const express = require('express');
const multer = require('multer');
const Excel = require('exceljs');
const { randomUUID } = require('node:crypto');
const { esc } = require('../services/ui-executivo');
const { InputError, allowed, field, fileType } = require('./service');
const { portal, entry, csrf } = require('./views');

const upload = multer({ limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 8, fieldSize: 2048 } }).single('anexo');
const base = '/clientes/despesas';
const expenseModule = 'cliente-despesas';
const currentMonth = () => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit'
}).format();
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function month(value = currentMonth()) {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new InputError('Selecione um mês válido.');
  }
  return value;
}

function amount(value) {
  if (typeof value !== 'string' || !/^\d{1,12}(?:[.,]\d{1,2})?$/.test(value) || Number(value.replace(',', '.')) <= 0) {
    throw new InputError('Informe um valor positivo com até duas casas decimais.');
  }
  return value.replace(',', '.');
}

function date(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) throw new InputError('Informe uma data válida.');
  const parsed = new Date(value);
  if (Number.isNaN(+parsed) || parsed.toISOString().slice(0, 10) !== value) throw new InputError('Informe uma data válida.');
  return value;
}

function dictionary(r, pool, csrfCheck, idOf, table, path, title, singular) {
  const url = '/clientes/' + path;
  r.get('/' + path, async (req, res) => {
    const editable = allowed(req.client, 'cliente-' + path, 'edit');
    const { rows } = await pool.query(`SELECT id,nome FROM ${table} WHERE empresa_id=$1 ORDER BY nome`, [req.client.empresa_id]);
    const input = (value = '') => entry(singular, 'nome', `required maxlength="100" value="${esc(value)}"`);
    const add = editable ? `<form class="panel" method="post" action="${url}">${csrf(req)}<div class="fields">${input()}</div><button>Adicionar</button></form>` : '';
    const rowsHtml = rows.map(row => editable
      ? `<li><div class="actions"><form method="post" action="${url}/${row.id}">${csrf(req)}<div class="fields">${input(row.nome)}</div>
        <button class="secondary">Salvar</button></form><form method="post" action="${url}/${row.id}/excluir">
        ${csrf(req)}<button class="secondary">Excluir</button></form></div></li>`
      : `<li>${esc(row.nome)}</li>`).join('');
    res.send(portal(req, title, `${add}<section class="panel">${rows.length ? `<ul>${rowsHtml}</ul>` : '<p>Nenhum cadastro.</p>'}</section>`));
  });
  r.post('/' + path, csrfCheck, async (req, res) => {
    await pool.query(`INSERT INTO ${table}(empresa_id,id,nome) VALUES($1,$2,$3)`,
      [req.client.empresa_id, randomUUID(), field(req.body.nome, 100, 'o nome')]);
    res.redirect(303, url);
  });
  r.post('/' + path + '/:id', csrfCheck, async (req, res) => {
    const result = await pool.query(`UPDATE ${table} SET nome=$3 WHERE empresa_id=$1 AND id=$2`,
      [req.client.empresa_id, idOf(req.params.id), field(req.body.nome, 100, 'o nome')]);
    if (!result.rowCount) return res.sendStatus(404);
    res.redirect(303, url);
  });
  r.post('/' + path + '/:id/excluir', csrfCheck, async (req, res) => {
    const result = await pool.query(`DELETE FROM ${table} WHERE empresa_id=$1 AND id=$2`, [req.client.empresa_id, idOf(req.params.id)]);
    if (!result.rowCount) return res.sendStatus(404);
    res.redirect(303, url);
  });
}

const selectExpenses = `SELECT d.id,to_char(d.data,'YYYY-MM-DD') AS data,d.descricao,d.valor,d.anexo IS NOT NULL AS comprovante,
  c.nome AS categoria,f.nome AS fornecedor FROM cliente_despesas d
  JOIN cliente_categorias c ON c.empresa_id=d.empresa_id AND c.id=d.categoria_id
  JOIN cliente_fornecedores f ON f.empresa_id=d.empresa_id AND f.id=d.fornecedor_id
  WHERE d.empresa_id=$1 AND d.data>=($2||'-01')::date AND d.data<($2||'-01')::date+INTERVAL '1 month'
  ORDER BY d.data DESC,d.id`;

function pageNumber(input) {
  if (typeof input !== 'string' || !/^[1-9]\d{0,6}$/.test(input)) return 1;
  return Number(input);
}

function expenses({ pool, csrf: csrfCheck, validateId: idOf }) {
  const r = express.Router({ caseSensitive: true });
  dictionary(r, pool, csrfCheck, idOf, 'cliente_categorias', 'categorias', 'Categorias', 'Nome da categoria');
  dictionary(r, pool, csrfCheck, idOf, 'cliente_fornecedores', 'fornecedores', 'Fornecedores', 'Nome do fornecedor');

  r.get('/despesas', async (req, res) => {
    const period = month(req.query.mes);
    const page = pageNumber(req.query.pagina);
    const size = 50;
    const { rows } = await pool.query(selectExpenses + ' LIMIT $3 OFFSET $4', [req.client.empresa_id, period, size + 1, (page - 1) * size]);
    const editable = allowed(req.client, expenseModule, 'edit');
    const downloadable = allowed(req.client, expenseModule, 'download');
    const link = (index, label) => `<a href="${base}?mes=${period}&amp;pagina=${index}">${label}</a>`;
    res.send(portal(req, 'Despesas', `<section class="panel"><form method="get" action="${base}">
      <div class="fields">${entry('Mês', 'mes', `type="month" value="${period}" required`)}</div><button class="secondary">Filtrar</button></form>
      <div class="actions">
      ${editable ? `<a class="button" href="${base}/novo">Nova despesa</a>` : ''}
      ${downloadable ? `<a class="button secondary" href="${base}/exportar?mes=${period}">Baixar Excel</a>` : ''}</div></section>
      <section class="panel">${rows.length ? `<div class="table-wrap"><table><thead>
        <tr><th scope="col">Data</th><th scope="col">Descrição</th><th scope="col">Categoria</th><th scope="col">Fornecedor</th>
        <th scope="col">Valor</th><th scope="col">Comprovante</th>${editable ? '<th scope="col">Ações</th>' : ''}</tr>
        </thead><tbody>${rows.slice(0, size).map(row => `<tr><td>${row.data.split('-').reverse().join('/')}</td><td>${esc(row.descricao)}</td>
        <td>${esc(row.categoria)}</td><td>${esc(row.fornecedor)}</td><td>${money.format(row.valor)}</td>
        <td>${row.comprovante ? downloadable ? `<a href="${base}/download/${row.id}">Baixar</a>` : 'Anexado' : '—'}</td>
        ${editable ? `<td><a href="${base}/editar/${row.id}">Editar</a></td>` : ''}</tr>`).join('')}</tbody></table></div>`
        : '<p>Nenhuma despesa nesta página.</p>'}
      <nav>${page > 1 ? link(page - 1, 'Anterior') : ''}${rows.length > size ? link(page + 1, 'Próxima') : ''}</nav></section>`));
  });

  async function showForm(req, res, row = {}) {
    const params = [req.client.empresa_id];
    const [categories, suppliers] = await Promise.all([
      pool.query('SELECT id,nome FROM cliente_categorias WHERE empresa_id=$1 ORDER BY nome', params),
      pool.query('SELECT id,nome FROM cliente_fornecedores WHERE empresa_id=$1 ORDER BY nome', params)
    ]);
    const select = (label, name, rows) => `<label>${label}<select name="${name}" required><option value="">Selecione</option>
      ${rows.map(item => `<option value="${item.id}" ${item.id === row[name] ? 'selected' : ''}>${esc(item.nome)}</option>`).join('')}</select></label>`;
    const missing = !categories.rowCount || !suppliers.rowCount;
    const title = row.id ? 'Editar despesa' : 'Nova despesa';
    const controls = missing ? '<p>Cadastre pelo menos uma categoria e um fornecedor para lançar despesas.</p>' : `
      <form method="post" action="${base}${row.id ? '/editar/' + row.id : '/novo'}" enctype="multipart/form-data">
      ${csrf(req)}<div class="fields">
      ${entry('Descrição', 'descricao', `required maxlength="240" value="${esc(row.descricao || '')}"`)}
      ${entry('Data', 'data', `type="date" required value="${row.data || ''}"`)}
      ${entry('Valor (R$)', 'valor', `required inputmode="decimal" value="${esc(row.valor || '')}"`)}
      ${select('Categoria', 'categoria_id', categories.rows)}${select('Fornecedor', 'fornecedor_id', suppliers.rows)}
      ${entry('Comprovante (PDF, PNG ou JPEG, até 8 MB)', 'anexo', 'type="file" accept="application/pdf,image/png,image/jpeg"')}</div>
      ${row.comprovante ? '<p><label><input type="checkbox" name="remover_anexo" value="1"> Remover comprovante atual</label></p>' : ''}
      <button>Salvar despesa</button></form>
      ${row.id ? `<details class="actions"><summary>Excluir despesa</summary><form action="${base}/excluir/${row.id}" method="post">
        ${csrf(req)}<p>A exclusão também remove o comprovante.</p><button class="secondary">Confirmar exclusão</button></form></details>` : ''}`;
    res.send(portal(req, title, `<section class="panel">${controls}<p><a href="${base}">Voltar às despesas</a></p></section>`));
  }

  // A abertura do formulário exige gerenciamento, assim como a gravação.
  function editOnly(req, res, next) {
    if (!allowed(req.client, expenseModule, 'edit')) return res.sendStatus(403);
    next();
  }

  r.get('/despesas/novo', editOnly, (req, res) => showForm(req, res));
  r.get('/despesas/editar/:id', editOnly, async (req, res) => {
    const { rows: [row] } = await pool.query(`SELECT id,categoria_id,fornecedor_id,descricao,valor,
      to_char(data,'YYYY-MM-DD') AS data,anexo IS NOT NULL AS comprovante FROM cliente_despesas
      WHERE empresa_id=$1 AND id=$2`, [req.client.empresa_id, idOf(req.params.id)]);
    if (!row) return res.sendStatus(404);
    await showForm(req, res, row);
  });

  async function save(req, res) {
    const { body, file } = req;
    const type = fileType(file, true);
    const params = [req.client.empresa_id, req.params.id ? idOf(req.params.id) : randomUUID(), idOf(body.categoria_id),
      idOf(body.fornecedor_id), field(body.descricao, 240, 'a descrição'), date(body.data), amount(body.valor),
      file?.buffer || null, type];
    if (req.params.id) {
      const changed = await pool.query(`UPDATE cliente_despesas SET categoria_id=$3,fornecedor_id=$4,descricao=$5,data=$6,valor=$7,
        anexo=CASE WHEN $10 THEN $8 ELSE anexo END,anexo_tipo=CASE WHEN $10 THEN $9 ELSE anexo_tipo END
        WHERE empresa_id=$1 AND id=$2`, [...params, !!file || body.remover_anexo === '1']);
      if (!changed.rowCount) return res.sendStatus(404);
    } else {
      await pool.query(`INSERT INTO cliente_despesas(empresa_id,id,categoria_id,fornecedor_id,descricao,data,valor,anexo,anexo_tipo)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, params);
    }
    res.redirect(303, `${base}?mes=${params[5].slice(0, 7)}`);
  }

  r.post('/despesas/novo', upload, csrfCheck, save);
  r.post('/despesas/editar/:id', upload, csrfCheck, save);
  r.post('/despesas/excluir/:id', csrfCheck, async (req, res) => {
    const result = await pool.query('DELETE FROM cliente_despesas WHERE empresa_id=$1 AND id=$2',
      [req.client.empresa_id, idOf(req.params.id)]);
    if (!result.rowCount) return res.sendStatus(404);
    res.redirect(303, base);
  });

  r.get('/despesas/download/:id', async (req, res) => {
    const { rows: [row] } = await pool.query('SELECT anexo,anexo_tipo FROM cliente_despesas WHERE empresa_id=$1 AND id=$2',
      [req.client.empresa_id, idOf(req.params.id)]);
    if (!row?.anexo) return res.sendStatus(404);
    const ext = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' }[row.anexo_tipo];
    res.attachment('comprovante.' + ext).send(row.anexo);
  });

  r.get('/despesas/exportar', async (req, res) => {
    const period = month(req.query.mes);
    const { rows } = await pool.query(selectExpenses, [req.client.empresa_id, period]);
    const workbook = new Excel.Workbook();
    const sheet = workbook.addWorksheet('Despesas');
    sheet.columns = [
      { header: 'Data', key: 'data', width: 15 },
      { header: 'Descrição', key: 'descricao', width: 45 },
      { header: 'Categoria', key: 'categoria', width: 25 },
      { header: 'Fornecedor', key: 'fornecedor', width: 30 },
      { header: 'Valor (R$)', key: 'valor', width: 18, style: { numFmt: '#,##0.00' } }
    ];
    sheet.addRows(rows.map(row => ({ ...row, valor: Number(row.valor) })));
    res.attachment(`despesas-${period}.xlsx`).send(Buffer.from(await workbook.xlsx.writeBuffer()));
  });
  return r;
}

module.exports = { expenses };
