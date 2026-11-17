const express = require('express');
const multer = require('multer');
const bcrypt = require('bcrypt');
const { randomUUID } = require('node:crypto');
const { ensure, transaction } = require('./schema');
const s = require('./service');
const v = require('./views');
const { capability, actionFor } = require('../access/catalog');
const { esc } = require('../services/ui-executivo');
const { expenses } = require('./expenses');

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const validToken = /^[A-Za-z0-9_-]{43}$/;
const logoUpload = multer({ limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 8, fieldSize: 2048 } }).single('logo');
const dummyHash = bcrypt.hashSync('plennatec-client-login-placeholder', 10);

function headers(req, res, next) {
  res.set({
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
  });
  next();
}

function prepare(req, res, next) {
  req.session.clientCsrf ||= s.token();
  next();
}

function csrf(req, res, next) {
  if (req.body?.csrf !== req.session.clientCsrf || !req.session.clientCsrf) return res.sendStatus(403);
  next();
}

function errorPage(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.status || 503;
  let message = 'Não foi possível concluir a operação. Tente novamente.';
  if (error instanceof s.InputError) message = error.message;
  if (error instanceof multer.MulterError) {
    status = 400;
    message = 'Arquivo ou formulário acima do limite ou em formato inválido.';
  }
  if (error.code === '23505') {
    status = 409;
    message = 'Já existe um cadastro com esse e-mail, CNPJ ou nome.';
  }
  if (error.code === '23503') {
    status = 409;
    message = 'Selecione uma categoria e um fornecedor disponíveis. Cadastros usados por despesas precisam ser desvinculados antes da exclusão.';
  }
  if (status >= 500) console.error('[Empresas clientes]', error.code || error.name);
  const back = req.baseUrl === '/empresas-clientes' ? '/empresas-clientes' : '/clientes';
  res.status(status).send(v.page('Não foi possível continuar', `<p role="alert">${esc(message)}</p><a href="${back}">Voltar</a>`));
}

function throttle() {
  const attempts = new Map();
  let reset = 0;
  return (req, res, next) => {
    const now = Date.now();
    if (now >= reset) {
      attempts.clear();
      reset = now + 15 * 60 * 1000;
    }
    const ip = req.ip;
    const count = attempts.get(ip) || 0;
    if (count >= 40 || (!attempts.has(ip) && attempts.size >= 10000)) {
      return res.status(429).set('Retry-After', String(Math.ceil((reset - now) / 1000))).send('Aguarde antes de tentar novamente.');
    }
    attempts.set(ip, count + 1);
    next();
  };
}

function renew(req) {
  return new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
}

function validateId(id) {
  if (!UUID.test(id)) throw new s.InputError('Registro não encontrado.', 404);
  return id;
}

function adminRouter(pool, ready, send) {
  const r = express.Router({ caseSensitive: true });
  r.use(headers, async (req, res, next) => {
    const user = req.session.usuario;
    if (!user) return res.redirect('/login');
    if (user.perfil !== 'ADMIN') return res.sendStatus(403);
    const admin = await pool.query("SELECT id FROM usuarios WHERE id=$1 AND UPPER(perfil)='ADMIN'", [user.id]);
    if (!admin.rowCount) return res.sendStatus(403);
    await ready();
    next();
  }, prepare);

  r.get('/', async (req, res) => {
    const { rows } = await pool.query(`
      SELECT e.id,e.nome,e.modulos,e.versao,c.email,c.aceito_em,c.revogado_em,c.envio,c.versao AS convite_versao,
             c.expira_em<=NOW() AS expirado,COALESCE(u.permissoes,c.permissoes) AS permissoes
      FROM cliente_empresas e JOIN cliente_convites c ON c.empresa_id=e.id
      LEFT JOIN cliente_usuarios u ON u.empresa_id=e.id AND u.email=c.email ORDER BY e.criada_em DESC`);
    res.send(v.admin(req, rows));
  });

  r.post('/convites', csrf, async (req, res) => {
    await s.createInvite(pool, req.body, req.session.usuario.id, send);
    res.redirect(303, '/empresas-clientes');
  });

  for (const action of ['reenviar', 'revogar']) {
    r.post(`/:id/${action}`, csrf, async (req, res) => {
      await s.changeInvite(pool, validateId(req.params.id), req.body.version, req.session.usuario.id, action === 'reenviar', send);
      res.redirect(303, '/empresas-clientes');
    });
  }

  r.post('/:id/acessos', csrf, async (req, res) => {
    const id = validateId(req.params.id);
    const { enabled, grants } = s.permissions(req.body);
    await transaction(pool, async db => {
      const updated = await db.query('UPDATE cliente_empresas SET modulos=$2,versao=versao+1 WHERE id=$1 AND versao=$3',
        [id, enabled, req.body.version]);
      if (!updated.rowCount) throw new s.InputError('Os acessos mudaram. Atualize a página.', 409);
      const { rows: [invite] } = await db.query('UPDATE cliente_convites SET permissoes=$2 WHERE empresa_id=$1 RETURNING email', [id, grants]);
      await db.query('UPDATE cliente_usuarios SET permissoes=$3 WHERE empresa_id=$1 AND email=$2', [id, invite.email, grants]);
      await s.audit(db, id, req.session.usuario.id, 'acessos_atualizados', { enabled, grants });
    });
    res.redirect(303, '/empresas-clientes');
  });
  r.use(errorPage);
  return r;
}

function clientRouter(pool, ready) {
  const r = express.Router({ caseSensitive: true });
  const limited = throttle();
  const pendingInvite = 'aceito_em IS NULL AND revogado_em IS NULL AND expira_em > NOW()';
  r.use(headers, prepare);

  r.get('/login', (req, res) => req.session.cliente ? res.redirect('/clientes') : res.send(v.login(req)));
  r.post('/login', csrf, limited, async (req, res) => {
    await ready();
    const email = typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    const password = typeof req.body.senha === 'string' ? req.body.senha : '';
    const { rows: [user] } = await pool.query('SELECT id,senha_hash FROM cliente_usuarios WHERE email=$1', [email]);
    const valid = Buffer.byteLength(password) <= 72 && await bcrypt.compare(password, user?.senha_hash || dummyHash);
    if (!valid || !user) return res.status(401).send(v.login(req, 'E-mail ou senha inválidos.'));
    await renew(req);
    req.session.cliente = user.id;
    res.redirect(303, '/clientes');
  });

  r.post('/sair', csrf, (req, res, next) => {
    if (!req.session.cliente) return res.redirect('/clientes/login');
    req.session.destroy(error => error ? next(error) : res.redirect(303, '/clientes/login'));
  });

  r.get('/convite', async (req, res) => {
    const raw = req.query.token;
    if (typeof raw !== 'string' || !validToken.test(raw)) throw new s.InputError('Convite inválido ou expirado.', 404);
    await ready();
    const digest = s.hash(raw);
    const { rows: [offer] } = await pool.query(`
      SELECT e.nome,c.email FROM cliente_convites c JOIN cliente_empresas e ON e.id=c.empresa_id
      WHERE c.token_hash=$1 AND ${pendingInvite}`, [digest]);
    if (!offer) throw new s.InputError('Convite inválido, expirado ou já utilizado.', 404);
    req.session.clientInvite = { digest, confirmed: false };
    res.send(v.page('Confirme seu e-mail', `<section class="auth"><p>Convite para <strong>${esc(offer.nome)}</strong>.</p>
      <p>E-mail do responsável: <strong>${esc(offer.email)}</strong></p>
      <form method="post" action="/clientes/confirmar">${v.csrf(req)}${v.hidden('invite', digest)}<button>Confirmar e-mail</button></form></section>`));
  });

  r.post('/confirmar', csrf, (req, res) => {
    const invite = req.session.clientInvite;
    if (!invite || invite.digest !== req.body.invite) throw new s.InputError('Abra o link do convite novamente.');
    invite.confirmed = true;
    res.redirect(303, '/clientes/ativar');
  });

  r.get('/ativar', async (req, res) => {
    if (!req.session.clientInvite?.confirmed) throw new s.InputError('Confirme o e-mail pelo link do convite.');
    await ready();
    const { rows: [offer] } = await pool.query(`
      SELECT e.nome,c.email FROM cliente_convites c JOIN cliente_empresas e ON e.id=c.empresa_id
      WHERE c.token_hash=$1 AND ${pendingInvite}`, [req.session.clientInvite.digest]);
    if (!offer) throw new s.InputError('Convite inválido, expirado ou já utilizado.', 404);
    res.send(v.page('Ative sua conta', `<section class="auth"><p>${esc(offer.email)}</p>
      <form method="post" action="/clientes/ativar" enctype="multipart/form-data">${v.csrf(req)}${v.hidden('invite', req.session.clientInvite.digest)}
      ${v.entry('Seu nome', 'nome', 'required maxlength="150" autocomplete="name"')}
      ${v.entry('Crie uma senha', 'senha', 'type="password" required minlength="12" autocomplete="new-password"')}
      ${v.entry('Confirme a senha', 'repita', 'type="password" required minlength="12" autocomplete="new-password"')}
      ${v.companyFields(offer)}<button>Ativar e entrar</button></form></section>`));
  });

  r.post('/ativar', limited, logoUpload, csrf, async (req, res) => {
    const invitation = req.session.clientInvite;
    if (!invitation?.confirmed || invitation.digest !== req.body.invite) throw new s.InputError('Confirme o e-mail pelo link do convite.');
    const { senha, repita } = req.body;
    if (typeof senha !== 'string' || senha.length < 12 || Buffer.byteLength(senha) > 72 || senha !== repita) {
      throw new s.InputError('Informe duas senhas iguais, com pelo menos 12 caracteres e até 72 bytes.');
    }
    const logoType = s.fileType(req.file);
    const company = s.field(req.body.empresa, 150, 'o nome fantasia');
    const razao = s.field(req.body.razao, 150, 'a razão social');
    const cnpj = s.cnpjNumber(req.body.cnpj);
    const name = s.field(req.body.nome, 150, 'seu nome');
    const passwordHash = await bcrypt.hash(senha, 10);
    const id = randomUUID();
    await ready();
    await transaction(pool, async db => {
      const { rows: [companyRow] } = await db.query(`SELECT e.id FROM cliente_empresas e
        JOIN cliente_convites c ON c.empresa_id=e.id WHERE c.token_hash=$1 AND ${pendingInvite} FOR UPDATE OF e`, [invitation.digest]);
      if (!companyRow) throw new s.InputError('Convite inválido, expirado ou já utilizado.', 409);
      const { rows: [offer] } = await db.query(`UPDATE cliente_convites SET aceito_em=NOW()
        WHERE token_hash=$1 AND ${pendingInvite} RETURNING email,permissoes`, [invitation.digest]);
      if (!offer) throw new s.InputError('Convite inválido, expirado ou já utilizado.', 409);
      await db.query('UPDATE cliente_empresas SET nome=$2,razao_social=$3,cnpj=$4,logo=$5,logo_tipo=$6 WHERE id=$1',
        [companyRow.id, company, razao, cnpj, req.file?.buffer || null, logoType]);
      await db.query('INSERT INTO cliente_usuarios(id,empresa_id,email,nome,senha_hash,permissoes) VALUES($1,$2,$3,$4,$5,$6)',
        [id, companyRow.id, offer.email, name, passwordHash, offer.permissoes]);
      await s.audit(db, companyRow.id, id, 'convite_aceito');
    });
    await renew(req);
    req.session.cliente = id;
    res.redirect(303, '/clientes');
  });

  r.use(async (req, res, next) => {
    if (!req.session.cliente) return res.redirect('/clientes/login');
    await ready();
    const { rows: [user] } = await pool.query(`SELECT u.id,u.nome,u.empresa_id,u.permissoes,e.modulos,e.nome AS empresa,
      e.razao_social,e.cnpj,(e.logo IS NOT NULL) AS tem_logo FROM cliente_usuarios u
      JOIN cliente_empresas e ON e.id=u.empresa_id WHERE u.id=$1`, [req.session.cliente]);
    if (!user) {
      delete req.session.cliente;
      return res.redirect('/clientes/login');
    }
    req.client = user;
    const cap = capability(req.originalUrl.split('?')[0]);
    const publicToCompany = req.path === '/' || req.path === '/logomarca';
    if (!publicToCompany && (!cap || cap.restriction !== 'client' || !s.allowed(user, cap.id, actionFor(req)))) {
      return res.sendStatus(403);
    }
    next();
  });

  r.get('/', (req, res) => {
    const links = s.modules.filter(m => s.allowed(req.client, m.id)).map(m => `<li><a href="${m.paths[0]}">${esc(m.label)}</a></li>`).join('');
    res.send(v.portal(req, req.client.empresa, `<section class="panel"><p>Olá, ${esc(req.client.nome)}.</p>
      ${links ? `<ul>${links}</ul>` : '<p>A administração ainda não disponibilizou módulos para sua conta.</p>'}</section>`));
  });

  r.get('/logomarca', async (req, res) => {
    const { rows: [row] } = await pool.query('SELECT logo,logo_tipo FROM cliente_empresas WHERE id=$1', [req.client.empresa_id]);
    if (!row?.logo) return res.sendStatus(404);
    res.type(row.logo_tipo).send(row.logo);
  });

  r.get('/empresa', (req, res) => {
    if (!s.allowed(req.client, 'cliente-empresa')) return res.sendStatus(403);
    const editable = s.allowed(req.client, 'cliente-empresa', 'edit');
    const content = editable
      ? `<form action="/clientes/empresa" method="post" enctype="multipart/form-data">
          ${v.csrf(req)}<div class="fields">${v.companyFields({ ...req.client, nome: req.client.empresa })}</div>
          ${req.client.tem_logo ? '<p><label><input type="checkbox" name="remover_logo" value="1"> Remover logomarca atual</label></p>' : ''}
          <button>Salvar cadastro</button></form>`
      : `<p>${esc(req.client.empresa)} · ${esc(req.client.razao_social)} · ${esc(req.client.cnpj)}</p>`;
    res.send(v.portal(req, 'Perfil da empresa', `<section class="panel">${content}</section>`));
  });

  r.post('/empresa', logoUpload, csrf, async (req, res) => {
    const type = s.fileType(req.file);
    const name = s.field(req.body.empresa, 150, 'o nome fantasia');
    const razao = s.field(req.body.razao, 150, 'a razão social');
    const cnpj = s.cnpjNumber(req.body.cnpj);
    await pool.query(`UPDATE cliente_empresas SET nome=$2,razao_social=$3,cnpj=$4,
      logo=CASE WHEN $5 THEN $6 ELSE logo END,logo_tipo=CASE WHEN $5 THEN $7 ELSE logo_tipo END WHERE id=$1`,
    [req.client.empresa_id, name, razao, cnpj, !!req.file || req.body.remover_logo === '1', req.file?.buffer || null, type]);
    res.redirect(303, '/clientes/empresa');
  });

  r.use(expenses({ pool, csrf, validateId }));
  r.use((req, res) => res.sendStatus(404));
  r.use(errorPage);
  return r;
}

function mount(app, pool, send = s.mailSender()) {
  let schema;
  const ready = () => schema ||= ensure(pool).catch(error => { schema = null; throw error; });
  app.use('/clientes', clientRouter(pool, ready));
  app.use((req, res, next) => {
    if (!req.session.cliente || (['GET', 'HEAD'].includes(req.method) && req.path.startsWith('/assets/'))) return next();
    if (req.path === '/') return res.redirect('/clientes');
    res.sendStatus(403);
  });
  app.use('/empresas-clientes', adminRouter(pool, ready, send));
}

module.exports = { mount };
