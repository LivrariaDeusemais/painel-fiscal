const { modules, allowed } = require('./service');
const { esc } = require('../services/ui-executivo');

const hidden = (key, value) => `<input type="hidden" name="${key}" value="${esc(value)}">`;
const csrf = req => hidden('csrf', req.session.clientCsrf);
const entry = (label, name, attrs = '') => `<label>${label}<input name="${name}" ${attrs}></label>`;

function page(title, body, header = '') {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} | Plennatec</title><link rel="stylesheet" href="/assets/clientes.css"></head>
  <body><header><div><img class="brand" src="/assets/logo-plennatec-perfil.png" alt="Plennatec">${header}</div></header>
  <main><h1>${esc(title)}</h1>${body}</main></body></html>`;
}

function portal(req, title, body) {
  const user = req.client;
  const logo = user.tem_logo ? '<img class="tenant-logo" src="/clientes/logomarca" alt="">' : '';
  const links = modules.filter(m => allowed(user, m.id)).map(m => `<a href="${m.paths[0]}">${m.id === 'cliente-despesas' ? 'Despesas' : esc(m.label)}</a>`).join('');
  return page(title, body, `<a class="tenant" href="/clientes">${logo}${esc(user.empresa)}</a>
  <nav>${links}</nav><form method="post" action="/clientes/sair">${csrf(req)}<button class="secondary">Sair</button></form>`);
}

function login(req, message = '') {
  return page('Acesso de clientes', `<section class="auth"><form method="post" action="/clientes/login">
    ${csrf(req)}${message ? `<p class="error" role="alert">${esc(message)}</p>` : ''}
    ${entry('E-mail', 'email', 'type="email" autocomplete="username" required maxlength="254"')}
    ${entry('Senha', 'senha', 'type="password" autocomplete="current-password" required')}
    <button>Entrar</button></form></section>`);
}

function companyFields(company = {}) {
  return `${entry('Razão social', 'razao', `required maxlength="150" value="${esc(company.razao_social || '')}"`)}
    ${entry('Nome fantasia', 'empresa', `required maxlength="150" value="${esc(company.nome || '')}"`)}
    ${entry('CNPJ', 'cnpj', `required maxlength="18" value="${esc(company.cnpj || '')}"`)}
    ${entry('Logomarca (PNG ou JPEG, até 2 MB)', 'logo', 'type="file" accept="image/png,image/jpeg"')}`;
}

function permissionsTable(enabled = {}, grants = {}) {
  const cols = [['view', 'Ver'], ['download', 'Baixar'], ['edit', 'Gerenciar']];
  return `<fieldset data-access-module><legend>Controle de despesas</legend>
    <div class="table-wrap"><table><thead><tr>
      <th><label><input type="checkbox" data-company-all> Módulos da empresa</label></th>
      ${cols.map(([key, label]) => `<th><label><input type="checkbox" data-column="${key}"> ${label}</label></th>`).join('')}
    </tr></thead><tbody>${modules.map(m => `<tr>
      <th><label><input type="checkbox" name="module" value="${m.id}" ${enabled[m.id] ? 'checked' : ''}> ${esc(m.label)}</label></th>
      ${cols.map(([key, label]) => `<td>${key === 'download' && !m.downloadable ? '—' :
        `<input type="checkbox" name="${key}" value="${m.id}" aria-label="${esc(m.label)} — ${label}" ${grants[m.id]?.[key] ? 'checked' : ''}>`}</td>`).join('')}
    </tr>`).join('')}</tbody></table></div></fieldset>`;
}

function admin(req, rows) {
  return page('Empresas clientes', `<details class="panel" open><summary>Novo convite</summary>
    <form action="/empresas-clientes/convites" method="post">${csrf(req)}
    <div class="fields">${entry('Nome da empresa', 'empresa', 'required maxlength="150"')}
    ${entry('E-mail do responsável', 'email', 'type="email" required maxlength="254"')}</div>
    <p>Selecione os módulos da empresa e as permissões do responsável.</p>
    ${permissionsTable()}<button>Enviar convite</button></form>
    </details><h2>Empresas cadastradas</h2>
    ${rows.length ? rows.map(row => {
      const url = `/empresas-clientes/${row.id}`;
      const pending = !row.aceito_em;
      const status = row.aceito_em ? 'Ativa' : row.revogado_em ? 'Convite revogado' : row.expirado ? 'Convite expirado' : 'Convite pendente';
      const send = { enviando: 'Envio em andamento ou interrompido', enviado: 'E-mail enviado', falhou: 'Falha no envio do e-mail' };
      return `<details class="panel" ${row.envio === 'falhou' && pending ? 'open' : ''}><summary>
        ${esc(row.nome)} · ${status}</summary><p>${esc(row.email)}${pending ? ` · ${send[row.envio]}` : ''}</p>
        <form action="${url}/acessos" method="post">${csrf(req)}${hidden('version', row.versao)}
        ${permissionsTable(row.modulos, row.permissoes)}<button>Salvar acessos</button></form>
        ${pending ? `<div class="actions"><form action="${url}/reenviar" method="post">${csrf(req)}${hidden('version', row.convite_versao)}<button class="secondary">Reenviar convite</button></form>
        ${row.revogado_em ? '' : `<form action="${url}/revogar" method="post">${csrf(req)}${hidden('version', row.convite_versao)}<button class="secondary">Revogar convite</button></form>`}</div>` : ''}
      </details>`;
    }).join('') : '<p>Nenhuma empresa cliente cadastrada.</p>'}
    <script src="/assets/clientes-acessos.js" defer></script><script src="/assets/access.js" defer></script>`,
    '<a href="/usuarios">Voltar à administração</a>');
}

module.exports = { page, portal, admin, login, csrf, hidden, entry, companyFields };
