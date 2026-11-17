// Entrada pública do aplicativo interno. As rotas de negócio exigem a sessão da Deus é Mais.
const calculator = '/ferramentas-ia/tabela-precos/promocoes';
const publicReads = new Set(['/', '/login', '/logout', '/favicon.ico', calculator,
  calculator + '/manifest.webmanifest', calculator + '/sw.js']);

function requireInternalSession(req, res, next) {
  if (req.session?.usuario) return next();
  const path = req.path.toLowerCase().replace(/\/+$/, '') || '/';
  if (['GET', 'HEAD'].includes(req.method) && (publicReads.has(path) || path.startsWith('/assets/'))) return next();
  if (req.method === 'POST' && path === '/login') return next();
  res.redirect(303, '/login');
}

module.exports = { requireInternalSession };
