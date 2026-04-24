const express = require('express');
const session = require('express-session');
const path = require('path');
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

// Pasta de uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rotas
app.use('/', routes);

// Rota inicial
app.get('/', (req, res) => {
  res.redirect('/login');
});

// Start servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});