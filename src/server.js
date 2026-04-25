const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const routes = require('./routes');


const app = express();
const PORT = process.env.PORT || 10000;

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'deus-e-mais-segredo',
  resave: false,
  saveUninitialized: false
}));

// 🔧 GARANTIR QUE A PASTA UPLOADS EXISTA (ESSENCIAL NO RENDER)
const uploadsDir = path.join(__dirname, '../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Servir arquivos estáticos
app.use('/uploads', express.static(uploadsDir));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Rota inicial inteligente
app.get('/', (req, res) => {
  if (!req.session || !req.session.usuario) {
    return res.redirect('/login');
  }
  return res.redirect('/dashboard');
});

// Rotas do sistema
app.use('/', routes);

// Start servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});