const { randomBytes, randomUUID, createHash } = require('node:crypto');
const { catalog } = require('../access/catalog');
const { transaction } = require('./schema');

const modules = catalog.filter(item => item.restriction === 'client');
const hash = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');

class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function field(value, max, label) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result || result.length > max || result.includes('\0')) {
    throw new InputError(`Informe ${label} com até ${max} caracteres.`);
  }
  return result;
}

function emailAddress(value) {
  const email = field(value, 254, 'o e-mail').toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new InputError('Informe um e-mail válido.');
  return email;
}

function cnpjNumber(value) {
  const cnpj = field(value, 18, 'o CNPJ').replace(/[.\/-]/g, '').toUpperCase();
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) {
    throw new InputError('Informe um CNPJ válido.');
  }
  const digit = size => {
    const sum = [...cnpj.slice(0, size)].reduce((acc, char, index) =>
      acc + (char.charCodeAt(0) - 48) * ((size - 1 - index) % 8 + 2), 0);
    return (11 - sum % 11) % 11 % 10;
  };
  if (digit(12) !== Number(cnpj[12]) || digit(13) !== Number(cnpj[13])) {
    throw new InputError('Informe um CNPJ válido.');
  }
  return cnpj;
}

function permissions(body) {
  const has = (field, id) => [body[field]].flat().includes(id);
  const enabled = {};
  const grants = {};
  for (const item of modules) {
    const id = item.id;
    enabled[id] = has('module', id);
    const download = item.downloadable && has('download', id);
    const edit = item.editable && has('edit', id);
    grants[id] = { view: has('view', id) || download || edit, download, edit };
  }
  return { enabled, grants };
}

function allowed(user, id, action = 'view') {
  const grant = user?.permissoes?.[id];
  return user?.modulos?.[id] === true && grant?.view === true && grant[action] === true;
}

function fileType(file, pdf = false) {
  if (!file) return null;
  const b = file.buffer;
  if (b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png';
  if (b.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))) return 'image/jpeg';
  if (pdf && b.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  throw new InputError(pdf ? 'Anexe um PDF, PNG ou JPEG.' : 'Envie uma logomarca PNG ou JPEG.');
}

async function audit(db, empresa, author, action, data = {}) {
  await db.query('INSERT INTO cliente_acesso_historico(empresa_id,autor,acao,dados) VALUES($1,$2,$3,$4)',
    [empresa, String(author), action, data]);
}

async function deliver(pool, invite, raw, send) {
  let status = 'enviado';
  try {
    await send({ ...invite, raw });
  } catch {
    status = 'falhou';
  }
  await pool.query('UPDATE cliente_convites SET envio=$1 WHERE empresa_id=$2 AND token_hash=$3',
    [status, invite.empresa_id, hash(raw)]);
}

async function createInvite(pool, body, author, send) {
  const raw = token();
  const id = randomUUID();
  const name = field(body.empresa, 150, 'o nome da empresa');
  const email = emailAddress(body.email);
  const { enabled, grants } = permissions(body);
  await transaction(pool, async db => {
    await db.query('INSERT INTO cliente_empresas(id,nome,modulos) VALUES($1,$2,$3)', [id, name, enabled]);
    await db.query(`INSERT INTO cliente_convites(empresa_id,email,token_hash,expira_em,envio,criado_por,permissoes)
      VALUES($1,$2,$3,NOW()+INTERVAL '48 hours','enviando',$4,$5)`, [id, email, hash(raw), String(author), grants]);
    await audit(db, id, author, 'convite_criado', { enabled, grants });
  });
  await deliver(pool, { empresa_id: id, nome: name, email }, raw, send);
}

async function changeInvite(pool, id, version, author, resend, send) {
  const raw = token();
  const invite = await transaction(pool, async db => {
    const args = [id, version];
    const update = resend
      ? "token_hash=$3,expira_em=NOW()+INTERVAL '48 hours',envio='enviando',revogado_em=NULL"
      : 'revogado_em=NOW()';
    if (resend) args.push(hash(raw));
    const { rows: [row] } = await db.query(`UPDATE cliente_convites c SET ${update},versao=c.versao+1
      FROM cliente_empresas e WHERE c.empresa_id=e.id AND e.id=$1 AND c.versao=$2 AND c.aceito_em IS NULL
      RETURNING c.empresa_id,c.email,e.nome`, args);
    if (!row) throw new InputError('O convite mudou. Atualize a página.', 409);
    await audit(db, id, author, resend ? 'convite_reenviado' : 'convite_revogado');
    return row;
  });
  if (resend) await deliver(pool, invite, raw, send);
}

function mailSender(env = process.env) {
  return async ({ empresa_id, nome, email, raw }) => {
    const url = new URL('/clientes/convite', env.PLENNATEC_CLIENTES_URL);
    if (url.protocol !== 'https:' || !env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
      throw new Error('Configure a URL HTTPS do portal e o SMTP.');
    }
    url.searchParams.set('token', raw);
    const transport = require('nodemailer').createTransport({
      host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587), secure: env.SMTP_SECURE === 'true',
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      connectionTimeout: 10000, socketTimeout: 20000
    });
    const result = await transport.sendMail({
      from: env.ALERTAS_EMAIL_FROM || env.SMTP_USER, to: email, subject: 'Seu convite para o Plennatec',
      text: `Você foi convidado para ativar a conta de ${nome} no Plennatec. Confirme o e-mail e conclua o cadastro em até 48 horas:\n\n${url.href}`,
      messageId: `<convite-${empresa_id}-${hash(raw).slice(0, 24)}@${url.hostname}>`
    });
    if (!result.accepted.length) throw new Error('Convite recusado pelo servidor de e-mail.');
  };
}

module.exports = { InputError, modules, allowed, permissions, field, emailAddress, cnpjNumber,
  hash, token, fileType, audit, createInvite, changeInvite, mailSender };
