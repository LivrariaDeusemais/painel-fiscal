const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
function protegerRota(req, res, next) {
  if (!req.session || !req.session.usuario) {
    return res.redirect('/login');
  }
  next();
}

function somenteAdmin(req, res, next) {
  if (!req.session.usuario || req.session.usuario.perfil !== 'ADMIN') {
    return res.status(403).send('<pre>Acesso negado. Apenas ADMIN pode acessar esta área.</pre>');
  }
  next();
}

function permitirPerfis(...perfis) {
  return (req, res, next) => {
    if (!req.session.usuario || !perfis.includes(req.session.usuario.perfil)) {
      return res.status(403).send('<pre>Acesso negado para este perfil de usuário.</pre>');
    }
    next();
  };
}

const ExcelJS = require('exceljs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xml2js = require('xml2js');
const archiver = require('archiver');

// CONFIG UPLOAD

const uploadsDir = '/uploads';

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

function getUploadFilePath(filename) {
  if (!filename) return null;
  // Segurança: garante que somente o nome do arquivo seja usado, sem caminhos externos.
  return path.join(uploadsDir, path.basename(String(filename)));
}

// Rota segura para visualizar/baixar arquivos salvos no disco persistente do Render.
router.get('/uploads/:filename', protegerRota, (req, res) => {
  try {
    const filePath = getUploadFilePath(req.params.filename);

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).send('<pre>Arquivo não encontrado no disco persistente.</pre>');
    }

    return res.sendFile(filePath);
  } catch (error) {
    return res.status(500).send(`<pre>Erro ao abrir arquivo:\n${error.message}</pre>`);
  }
});



// =====================================================
// PATCH FOCO FINAL — ESPAÇO DO CONTADOR + BOTÕES CONTAS A PAGAR WINDOWS
// Diagnóstico:
// 1) Espaço do Contador usa tabela larga com min-width e cards métricos fixos.
//    O conteúdo principal estava maior que a área útil ao lado do menu.
//    Solução: main com overflow controlado, cards auto-fit, tabela com rolagem interna.
// 2) Lista de Contas à Pagar no Windows quebra os botões porque o botão grande
//    "Mudar todos..." e o botão "Colunas" não cabem com os tamanhos atuais.
//    Solução: nav em uma linha, botões compactos e gap menor apenas nessa tela.
// =====================================================
function renderPlennaTecFocoContadorRotinaAssets() {
  return `
    <style id="plennatec-foco-contador-rotina">
      *, *::before, *::after {
        box-sizing: border-box !important;
      }

      html, body {
        max-width: 100% !important;
        overflow-x: hidden !important;
      }

      /* =====================================================
         ESPAÇO DO CONTADOR — CORREÇÃO PRINCIPAL
      ===================================================== */

      body.contador-premium-page {
        width: 100% !important;
        max-width: 100% !important;
        overflow-x: hidden !important;
      }

      body.contador-premium-page .contador-premium-shell {
        width: calc(100vw - 20px) !important;
        max-width: calc(100vw - 20px) !important;
        min-width: 0 !important;
        margin: 0 auto !important;
        padding: 16px 0 14px !important;
        display: grid !important;
        grid-template-columns: 250px minmax(0, 1fr) !important;
        gap: 16px !important;
        overflow: hidden !important;
      }

      body.contador-premium-page .contador-premium-sidebar {
        width: 250px !important;
        min-width: 250px !important;
        max-width: 250px !important;
        flex: 0 0 250px !important;
        overflow: hidden !important;
      }

      body.contador-premium-page .contador-premium-main {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        overflow: hidden !important;
      }

      body.contador-premium-page .contador-topbar,
      body.contador-premium-page .contador-actions,
      body.contador-premium-page .contador-metrics,
      body.contador-premium-page .filter-box,
      body.contador-premium-page .contador-board {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        overflow: hidden !important;
      }

      /* Métricas: não podem empurrar a página para a direita */
      body.contador-premium-page .contador-metrics {
        display: grid !important;
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)) !important;
        gap: 12px !important;
      }

      body.contador-premium-page .contador-metric-card {
        min-width: 0 !important;
        max-width: 100% !important;
        overflow: hidden !important;
      }

      /* Barra de filtro do contador */
      body.contador-premium-page .filter-box.month-smart-form,
      body.contador-premium-page #contadorMonthForm {
        display: flex !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        gap: 10px !important;
        overflow: visible !important;
      }

      body.contador-premium-page .btn-add-file-top {
        margin-left: auto !important;
        max-width: 260px !important;
        white-space: nowrap !important;
      }

      /* Tabela: rolagem interna dentro do card, não na página inteira */
      body.contador-premium-page .contador-board {
        overflow: hidden !important;
      }

      body.contador-premium-page .contador-board .table-wrap,
      body.contador-premium-page .table-wrap {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        overflow-x: auto !important;
        overflow-y: visible !important;
        -webkit-overflow-scrolling: touch !important;
      }

      body.contador-premium-page .contador-table {
        width: 100% !important;
        min-width: 980px !important;
        max-width: none !important;
        table-layout: fixed !important;
      }

      body.contador-premium-page .contador-table th,
      body.contador-premium-page .contador-table td {
        font-size: 10.4px !important;
        padding: 6px 5px !important;
        line-height: 1.12 !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }

      body.contador-premium-page .contador-table col:nth-child(1) { width: 25% !important; }
      body.contador-premium-page .contador-table col:nth-child(2) { width: 5% !important; }
      body.contador-premium-page .contador-table col:nth-child(3) { width: 6% !important; }
      body.contador-premium-page .contador-table col:nth-child(4) { width: 15% !important; }
      body.contador-premium-page .contador-table col:nth-child(5) { width: 14% !important; }
      body.contador-premium-page .contador-table col:nth-child(6) { width: 12% !important; }
      body.contador-premium-page .contador-table col:nth-child(7) { width: 10% !important; }
      body.contador-premium-page .contador-table col:nth-child(8) { width: 13% !important; }

      body.contador-premium-page .contador-table .btn,
      body.contador-premium-page .contador-table button,
      body.contador-premium-page .contador-table select {
        max-width: 100% !important;
        font-size: 10px !important;
      }

      body.contador-premium-page .contador-table .btn-upload-open,
      body.contador-premium-page .contador-table .upload-chip {
        min-width: 96px !important;
        width: 96px !important;
        height: 28px !important;
        padding: 0 6px !important;
        font-size: 9.6px !important;
      }

      body.contador-premium-page .contador-table .btn-download {
        min-width: 80px !important;
        height: 28px !important;
        padding: 0 8px !important;
        font-size: 9.8px !important;
      }

      body.contador-premium-page .contador-table select {
        height: 30px !important;
        min-height: 30px !important;
        padding-left: 7px !important;
        padding-right: 22px !important;
      }

      body.contador-premium-page .contador-table .status-pill,
      body.contador-premium-page .contador-table .download-status {
        min-width: 78px !important;
        max-width: 100% !important;
        font-size: 9.6px !important;
        padding: 6px 7px !important;
      }

      /* Em telas menores, mantém a página parada e a rolagem só na tabela */
      @media (max-width: 1300px) {
        body.contador-premium-page .contador-premium-shell {
          grid-template-columns: 238px minmax(0, 1fr) !important;
          gap: 12px !important;
        }

        body.contador-premium-page .contador-premium-sidebar {
          width: 238px !important;
          min-width: 238px !important;
          max-width: 238px !important;
        }

        body.contador-premium-page .contador-table {
          min-width: 960px !important;
        }
      }

      /* =====================================================
         LISTA DE CONTAS A PAGAR — BOTÕES NA MESMA LINHA NO WINDOWS
      ===================================================== */

      body.dm-global-page:has(.rotina-table) .dm-global-nav,
      body.dm-global-page:has(form[action="/rotina-despesas"]) .dm-global-nav {
        display: flex !important;
        flex-wrap: nowrap !important;
        align-items: center !important;
        gap: 8px !important;
        overflow: hidden !important;
        width: 100% !important;
      }

      body.dm-global-page:has(.rotina-table) .dm-menu-btn,
      body.dm-global-page:has(form[action="/rotina-despesas"]) .dm-menu-btn,
      body.dm-global-page:has(.rotina-table) .dm-global-nav a,
      body.dm-global-page:has(.rotina-table) .dm-global-nav button,
      body.dm-global-page:has(form[action="/rotina-despesas"]) .dm-global-nav a,
      body.dm-global-page:has(form[action="/rotina-despesas"]) .dm-global-nav button {
        flex: 0 1 auto !important;
        min-width: 0 !important;
        height: 38px !important;
        min-height: 38px !important;
        padding: 0 12px !important;
        font-size: 12px !important;
        white-space: nowrap !important;
      }

      body.dm-global-page:has(.rotina-table) .dm-global-nav .btn,
      body.dm-global-page:has(form[action="/rotina-despesas"]) .dm-global-nav .btn {
        font-size: 12px !important;
      }

      /* Botão grande “Mudar todos...” mais compacto */
      body.dm-global-page:has(.rotina-table) .dm-global-nav button,
      body.dm-global-page:has(form[action="/rotina-despesas"]) .dm-global-nav button {
        padding-left: 13px !important;
        padding-right: 13px !important;
        max-width: 250px !important;
      }

      /* Botão Colunas não quebra para baixo */
      body.dm-global-page:has(.rotina-table) .dm-global-nav button:last-child,
      body.dm-global-page:has(form[action="/rotina-despesas"]) .dm-global-nav button:last-child {
        max-width: 100px !important;
      }

      @media (max-width: 1280px) {
        body.dm-global-page:has(.rotina-table) .dm-global-nav,
        body.dm-global-page:has(form[action="/rotina-despesas"]) .dm-global-nav {
          gap: 6px !important;
        }

        body.dm-global-page:has(.rotina-table) .dm-menu-btn,
        body.dm-global-page:has(form[action="/rotina-despesas"]) .dm-menu-btn,
        body.dm-global-page:has(.rotina-table) .dm-global-nav a,
        body.dm-global-page:has(.rotina-table) .dm-global-nav button,
        body.dm-global-page:has(form[action="/rotina-despesas"]) .dm-global-nav a,
        body.dm-global-page:has(form[action="/rotina-despesas"]) .dm-global-nav button {
          padding-left: 9px !important;
          padding-right: 9px !important;
          font-size: 11px !important;
        }
      }
    </style>
  `;
}

router.use((req, res, next) => {
  const originalSend = res.send.bind(res);

  res.send = function plennatecFocoContadorRotinaSend(body) {
    try {
      if (typeof body === 'string' && body.includes('</head>') && !body.includes('plennatec-foco-contador-rotina')) {
        body = body.replace('</head>', `${renderPlennaTecFocoContadorRotinaAssets()}</head>`);
      }
    } catch (error) {}

    return originalSend(body);
  };

  next();
});


// =====================================================
// DIAGNÓSTICO E CORREÇÃO DEFINITIVA DE LARGURA — PLENNATEC
// Causa corrigida: as telas usam wrappers diferentes.
// Cabeçalho/menu usam uma largura, enquanto a tabela fica dentro de cards
// com padding interno e classes específicas: .ml-table e .contador-table.
// Os patches anteriores atingiam classes genéricas e algumas classes que
// não existem nessas telas, por isso o problema permanecia.
// =====================================================
function renderPlennaTecWidthDiagnosisFinalAssets() {
  return `
    <style id="plennatec-width-diagnosis-final">
      *, *::before, *::after {
        box-sizing: border-box !important;
      }

      html,
      body {
        width: 100% !important;
        max-width: 100% !important;
        overflow-x: hidden !important;
      }

      :root {
        --plenna-page-max: 1500px;
        --plenna-page-gap: 48px;
        --plenna-content-radius: 22px;
      }

      /* =====================================================
         1) TELAS COM CABEÇALHO HORIZONTAL
         Comprovantes Fiscais / Lista de Contas a Pagar / Arquivo
         Agora o cabeçalho, o menu de botões, os filtros, os resumos
         e a tabela usam exatamente a mesma largura visual.
      ===================================================== */

      body.dm-global-page .dm-global-header-shell,
      body.dm-global-page .container {
        width: min(var(--plenna-page-max), calc(100vw - var(--plenna-page-gap))) !important;
        max-width: min(var(--plenna-page-max), calc(100vw - var(--plenna-page-gap))) !important;
        margin-left: auto !important;
        margin-right: auto !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        overflow: visible !important;
      }

      body.dm-global-page .dm-global-top,
      body.dm-global-page .dm-global-nav,
      body.dm-global-page .container > .card,
      body.dm-global-page .container > .hero,
      body.dm-global-page .container > section,
      body.dm-global-page .container > .panel,
      body.dm-global-page .container > .table-card {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        box-sizing: border-box !important;
      }

      /* O card era a principal causa do desalinhamento:
         ele tinha padding lateral, fazendo a tabela ficar visualmente menor
         que o cabeçalho e os botões. */
      body.dm-global-page .container > .card {
        padding-left: 0 !important;
        padding-right: 0 !important;
        overflow: hidden !important;
        border-radius: var(--plenna-content-radius) !important;
      }

      body.dm-global-page .container > .card > h1,
      body.dm-global-page .container > .card > .actions,
      body.dm-global-page .container > .card > form,
      body.dm-global-page .container > .card > .filters,
      body.dm-global-page .container > .card > .summary,
      body.dm-global-page .container > .card > .ml-table-toolbar,
      body.dm-global-page .container > .card > .painel-colunas {
        margin-left: 24px !important;
        margin-right: 24px !important;
        width: calc(100% - 48px) !important;
        max-width: calc(100% - 48px) !important;
      }

      body.dm-global-page .dm-global-nav {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 10px !important;
        overflow: visible !important;
      }

      body.dm-global-page .dm-menu-btn,
      body.dm-global-page .dm-global-nav button {
        flex: 0 0 auto !important;
        white-space: nowrap !important;
      }

      /* =====================================================
         2) COMPROVANTES FISCAIS
         A tabela real desta tela é .ml-table, não .lancamentos-table.
      ===================================================== */

      body.dm-global-page .ml-table-toolbar,
      body.dm-global-page .ml-table-shell {
        width: 100% !important;
        max-width: 100% !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
      }

      body.dm-global-page .ml-table-toolbar {
        padding-left: 24px !important;
        padding-right: 24px !important;
      }

      body.dm-global-page .ml-table-shell {
        overflow-x: auto !important;
        overflow-y: visible !important;
        border-radius: 0 0 var(--plenna-content-radius) var(--plenna-content-radius) !important;
        border-left: 0 !important;
        border-right: 0 !important;
      }

      body.dm-global-page .ml-table {
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        table-layout: fixed !important;
      }

      body.dm-global-page .ml-table th,
      body.dm-global-page .ml-table td {
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        font-size: 12px !important;
        padding: 9px 8px !important;
      }

      body.dm-global-page .ml-table th:nth-child(1),
      body.dm-global-page .ml-table td:nth-child(1) { width: 4.5% !important; }
      body.dm-global-page .ml-table th:nth-child(2),
      body.dm-global-page .ml-table td:nth-child(2) { width: 8.5% !important; }
      body.dm-global-page .ml-table th:nth-child(3),
      body.dm-global-page .ml-table td:nth-child(3) { width: 11% !important; }
      body.dm-global-page .ml-table th:nth-child(4),
      body.dm-global-page .ml-table td:nth-child(4) { width: 7% !important; }
      body.dm-global-page .ml-table th:nth-child(5),
      body.dm-global-page .ml-table td:nth-child(5) { width: 23% !important; }
      body.dm-global-page .ml-table th:nth-child(6),
      body.dm-global-page .ml-table td:nth-child(6) { width: 10% !important; }
      body.dm-global-page .ml-table th:nth-child(7),
      body.dm-global-page .ml-table td:nth-child(7) { width: 10% !important; }
      body.dm-global-page .ml-table th:nth-child(8),
      body.dm-global-page .ml-table td:nth-child(8) { width: 7.5% !important; text-align:right !important; }
      body.dm-global-page .ml-table th:nth-child(9),
      body.dm-global-page .ml-table td:nth-child(9) { width: 7.5% !important; }
      body.dm-global-page .ml-table th:nth-child(10),
      body.dm-global-page .ml-table td:nth-child(10) { width: 12% !important; }
      body.dm-global-page .ml-table th:nth-child(11),
      body.dm-global-page .ml-table td:nth-child(11) { width: 4.5% !important; text-align:center !important; }
      body.dm-global-page .ml-table th:nth-child(12),
      body.dm-global-page .ml-table td:nth-child(12) { width: 4.5% !important; text-align:center !important; }
      body.dm-global-page .ml-table th:nth-child(13),
      body.dm-global-page .ml-table td:nth-child(13) { width: 6% !important; text-align:center !important; }

      /* Colunas ocultas continuam ocultas quando o usuário desmarca */
      body.dm-global-page .ml-table .col-cnpj[style*="none"],
      body.dm-global-page .ml-table .col-codpag[style*="none"],
      body.dm-global-page .ml-table .col-pagamento[style*="none"],
      body.dm-global-page .ml-table .col-categoria[style*="none"],
      body.dm-global-page .ml-table .col-pdf[style*="none"],
      body.dm-global-page .ml-table .col-xml[style*="none"] {
        display: none !important;
      }

      /* Filtros dos comprovantes compactos dentro do mesmo card */
      body.dm-global-page form[action="/lancamentos"] .filters {
        display: grid !important;
        grid-template-columns:
          minmax(130px, 1fr)
          minmax(125px, .9fr)
          minmax(125px, .9fr)
          minmax(135px, .95fr)
          minmax(140px, 1fr)
          minmax(120px, .85fr)
          minmax(115px, .75fr)
          minmax(115px, .75fr)
          max-content !important;
        gap: 8px !important;
        align-items: end !important;
        width: 100% !important;
        max-width: 100% !important;
        padding: 0 !important;
      }

      body.dm-global-page form[action="/lancamentos"] .filters > div {
        min-width: 0 !important;
      }

      body.dm-global-page form[action="/lancamentos"] .filters label {
        font-size: 10px !important;
        line-height: 1.05 !important;
        margin-bottom: 4px !important;
        white-space: nowrap !important;
      }

      body.dm-global-page form[action="/lancamentos"] .filters input,
      body.dm-global-page form[action="/lancamentos"] .filters select {
        width: 100% !important;
        min-width: 0 !important;
        height: 32px !important;
        min-height: 32px !important;
        font-size: 11px !important;
        padding: 0 8px !important;
      }

      body.dm-global-page form[action="/lancamentos"] .filter-buttons {
        display: inline-flex !important;
        gap: 6px !important;
        min-width: 126px !important;
      }

      /* =====================================================
         3) LISTA DE CONTAS A PAGAR
         O problema é o mesmo: card com padding + tabela interna.
      ===================================================== */

      body.dm-global-page .rotina-table {
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        table-layout: fixed !important;
      }

      body.dm-global-page .rotina-table th,
      body.dm-global-page .rotina-table td {
        font-size: 11px !important;
        padding: 8px 7px !important;
        line-height: 1.12 !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: normal !important;
      }

      body.dm-global-page .rotina-table th:nth-child(1),
      body.dm-global-page .rotina-table td:nth-child(1) { width: 11% !important; }
      body.dm-global-page .rotina-table th:nth-child(2),
      body.dm-global-page .rotina-table td:nth-child(2) { width: 10% !important; }
      body.dm-global-page .rotina-table th:nth-child(3),
      body.dm-global-page .rotina-table td:nth-child(3) { width: 10% !important; }
      body.dm-global-page .rotina-table th:nth-child(4),
      body.dm-global-page .rotina-table td:nth-child(4) { width: 12% !important; }
      body.dm-global-page .rotina-table th:nth-child(5),
      body.dm-global-page .rotina-table td:nth-child(5) { width: 7% !important; }
      body.dm-global-page .rotina-table th:nth-child(6),
      body.dm-global-page .rotina-table td:nth-child(6) { width: 11% !important; }
      body.dm-global-page .rotina-table th:nth-child(7),
      body.dm-global-page .rotina-table td:nth-child(7) { width: 11% !important; }
      body.dm-global-page .rotina-table th:nth-child(8),
      body.dm-global-page .rotina-table td:nth-child(8) { width: 7% !important; text-align:center !important; }
      body.dm-global-page .rotina-table th:nth-child(9),
      body.dm-global-page .rotina-table td:nth-child(9) { width: 10% !important; text-align:center !important; }
      body.dm-global-page .rotina-table th:nth-child(10),
      body.dm-global-page .rotina-table td:nth-child(10) { width: 9% !important; text-align:center !important; }
      body.dm-global-page .rotina-table th:nth-child(11),
      body.dm-global-page .rotina-table td:nth-child(11) { width: 6% !important; text-align:center !important; }
      body.dm-global-page .rotina-table th:nth-child(12),
      body.dm-global-page .rotina-table td:nth-child(12) { width: 6% !important; text-align:center !important; }

      /* =====================================================
         4) ESPAÇO DO CONTADOR
         A tabela do contador é muito larga. A solução correta é:
         área principal sem overflow + rolagem interna somente na tabela.
      ===================================================== */

      body.contador-premium-page {
        overflow-x: hidden !important;
      }

      .contador-premium-page .contador-premium-shell {
        width: min(1500px, calc(100vw - 20px)) !important;
        max-width: calc(100vw - 20px) !important;
        margin: 0 auto !important;
        display: grid !important;
        grid-template-columns: 250px minmax(0, 1fr) !important;
        gap: 18px !important;
        overflow: hidden !important;
      }

      .contador-premium-page .contador-premium-sidebar {
        width: 250px !important;
        max-width: 250px !important;
        min-width: 0 !important;
      }

      .contador-premium-page .contador-premium-main {
        min-width: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        overflow: hidden !important;
      }

      .contador-premium-page .contador-metrics,
      .contador-premium-page .filter-box,
      .contador-premium-page .contador-board {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
      }

      .contador-premium-page .contador-metrics {
        display: grid !important;
        grid-template-columns: repeat(4, minmax(165px, 1fr)) !important;
        gap: 14px !important;
        overflow: hidden !important;
      }

      .contador-premium-page .table-wrap {
        width: 100% !important;
        max-width: 100% !important;
        overflow-x: auto !important;
        overflow-y: visible !important;
      }

      .contador-premium-page .contador-table {
        width: 100% !important;
        min-width: 1120px !important;
        table-layout: fixed !important;
      }

      .contador-premium-page .contador-table th,
      .contador-premium-page .contador-table td {
        font-size: 10.8px !important;
        padding: 7px 6px !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      /* =====================================================
         5) DASHBOARD
         Botões do filtro separados e negrito normalizado.
      ===================================================== */

      body:has(#dashboardMonthForm) .page-shell {
        width: min(1500px, calc(100vw - 56px)) !important;
        max-width: calc(100vw - 56px) !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }

      #dashboardMonthForm,
      .filter-panel.month-smart-form#dashboardMonthForm,
      form#dashboardMonthForm.filter-panel {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 18px 24px !important;
        overflow: visible !important;
        width: 100% !important;
        min-height: 58px !important;
        padding: 12px 22px !important;
      }

      #dashboardMonthForm > * {
        flex: 0 0 auto !important;
        margin: 0 !important;
      }

      #dashboardMonthForm label {
        min-width: 82px !important;
        font-size: 12px !important;
        font-weight: 500 !important;
        white-space: nowrap !important;
      }

      #dashboardMonthForm .global-month-picker {
        min-width: 255px !important;
        flex: 0 0 auto !important;
      }

      #dashboardMonthForm .month-compact-row {
        display: inline-flex !important;
        align-items: center !important;
        gap: 14px !important;
        flex-wrap: nowrap !important;
      }

      #dashboardMonthForm .month-current-display {
        min-width: 112px !important;
        max-width: 132px !important;
        height: 34px !important;
        padding: 0 10px !important;
        font-size: 11.5px !important;
        font-weight: 500 !important;
      }

      #dashboardMonthForm .month-open-btn,
      #dashboardMonthForm .btn-filter-apply,
      #dashboardMonthForm .btn-filter-clear {
        height: 34px !important;
        min-height: 34px !important;
        padding: 0 18px !important;
        font-size: 11.5px !important;
        font-weight: 600 !important;
        white-space: nowrap !important;
      }

      body:has(#dashboardMonthForm) * {
        font-weight: 400 !important;
      }

      body:has(#dashboardMonthForm) h1,
      body:has(#dashboardMonthForm) h2,
      body:has(#dashboardMonthForm) h3,
      body:has(#dashboardMonthForm) .stat-value,
      body:has(#dashboardMonthForm) .stat-number,
      body:has(#dashboardMonthForm) button,
      body:has(#dashboardMonthForm) .btn,
      body:has(#dashboardMonthForm) .dm-menu-btn {
        font-weight: 650 !important;
      }

      @media (max-width: 1350px) {
        body.dm-global-page form[action="/lancamentos"] .filters {
          grid-template-columns: repeat(4, minmax(130px, 1fr)) !important;
        }

        .contador-premium-page .contador-metrics {
          grid-template-columns: repeat(2, minmax(165px, 1fr)) !important;
        }
      }

      @media (max-width: 760px) {
        body.dm-global-page .dm-global-header-shell,
        body.dm-global-page .container,
        body:has(#dashboardMonthForm) .page-shell {
          width: calc(100vw - 24px) !important;
          max-width: calc(100vw - 24px) !important;
        }

        body.dm-global-page .container > .card > h1,
        body.dm-global-page .container > .card > .actions,
        body.dm-global-page .container > .card > form,
        body.dm-global-page .container > .card > .filters,
        body.dm-global-page .container > .card > .summary,
        body.dm-global-page .container > .card > .ml-table-toolbar,
        body.dm-global-page .container > .card > .painel-colunas {
          margin-left: 14px !important;
          margin-right: 14px !important;
          width: calc(100% - 28px) !important;
          max-width: calc(100% - 28px) !important;
        }

        body.dm-global-page form[action="/lancamentos"] .filters {
          grid-template-columns: 1fr !important;
        }
      }
    </style>
  `;
}

router.use((req, res, next) => {
  const originalSend = res.send.bind(res);

  res.send = function plennatecWidthDiagnosisFinalSend(body) {
    try {
      if (typeof body === 'string' && body.includes('</head>') && !body.includes('plennatec-width-diagnosis-final')) {
        body = body.replace('</head>', `${renderPlennaTecWidthDiagnosisFinalAssets()}</head>`);
      }
    } catch (error) {}

    return originalSend(body);
  };

  next();
});


// =====================================================
// PATCH DEFINITIVO CROSS-PLATFORM — NÃO ESTOURAR MAC/WINDOWS
// Este middleware precisa ficar antes dos outros patches para que seu CSS seja aplicado por último.
// =====================================================
function renderPlennaTecNoOverflowFinalAssets() {
  return `
    <style id="plennatec-no-overflow-final">
      /* ===== BASE: nada deve empurrar a página para fora da viewport ===== */
      *, *::before, *::after { box-sizing: border-box !important; }
      html, body {
        width: 100% !important;
        max-width: 100% !important;
        overflow-x: hidden !important;
      }

      /* =====================================================
         PÁGINAS COM CABEÇALHO HORIZONTAL: COMPROVANTES / CONTAS / ARQUIVO
      ===================================================== */
      body.dm-global-page .dm-global-header-shell,
      body.dm-global-page .container,
      body.dm-global-page .page-shell {
        width: min(1500px, calc(100vw - 48px)) !important;
        max-width: calc(100vw - 48px) !important;
        margin-left: auto !important;
        margin-right: auto !important;
        box-sizing: border-box !important;
        overflow: visible !important;
      }

      body.dm-global-page .dm-global-top,
      body.dm-global-page .dm-global-nav,
      body.dm-global-page .topbar,
      body.dm-global-page .nav-panel,
      body.dm-global-page .filter-panel,
      body.dm-global-page .filters,
      body.dm-global-page .card,
      body.dm-global-page section,
      body.dm-global-page .summary-grid {
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
      }

      body.dm-global-page .dm-global-nav {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 10px !important;
      }

      /* Tabelas devem ficar dentro da mesma largura do cabeçalho */
      body.dm-global-page .table-responsive,
      body.dm-global-page .table-wrapper,
      body.dm-global-page .table-scroll,
      body.dm-global-page .lancamentos-table-wrap,
      body.dm-global-page .rotina-table-wrap,
      body.dm-global-page .documentos-table-wrap,
      body.dm-global-page .table-wrap {
        width: 100% !important;
        max-width: 100% !important;
        overflow-x: auto !important;
        overflow-y: visible !important;
        box-sizing: border-box !important;
        -webkit-overflow-scrolling: touch !important;
      }

      body.dm-global-page table {
        width: 100% !important;
        max-width: 100% !important;
        table-layout: fixed !important;
      }

      body.dm-global-page th,
      body.dm-global-page td {
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        vertical-align: middle !important;
      }

      /* Comprovantes Fiscais: cabe dentro da largura útil */
      body.dm-global-page .lancamentos-table,
      body.dm-global-page table.lancamentos-table {
        width: 100% !important;
        min-width: 0 !important;
        table-layout: fixed !important;
      }

      body.dm-global-page .lancamentos-table th,
      body.dm-global-page .lancamentos-table td {
        font-size: 12px !important;
        padding: 9px 8px !important;
        white-space: nowrap !important;
      }

      body.dm-global-page .lancamentos-table th:nth-child(1),
      body.dm-global-page .lancamentos-table td:nth-child(1) { width: 4.5% !important; }
      body.dm-global-page .lancamentos-table th:nth-child(2),
      body.dm-global-page .lancamentos-table td:nth-child(2) { width: 8.5% !important; }
      body.dm-global-page .lancamentos-table th:nth-child(3),
      body.dm-global-page .lancamentos-table td:nth-child(3) { width: 11.5% !important; }
      body.dm-global-page .lancamentos-table th:nth-child(4),
      body.dm-global-page .lancamentos-table td:nth-child(4) { width: 7% !important; }
      body.dm-global-page .lancamentos-table th:nth-child(5),
      body.dm-global-page .lancamentos-table td:nth-child(5) { width: 24% !important; }
      body.dm-global-page .lancamentos-table th:nth-child(6),
      body.dm-global-page .lancamentos-table td:nth-child(6) { width: 7.5% !important; text-align:right !important; }
      body.dm-global-page .lancamentos-table th:nth-child(7),
      body.dm-global-page .lancamentos-table td:nth-child(7) { width: 8% !important; }
      body.dm-global-page .lancamentos-table th:nth-child(8),
      body.dm-global-page .lancamentos-table td:nth-child(8) { width: 14% !important; }
      body.dm-global-page .lancamentos-table th:nth-child(9),
      body.dm-global-page .lancamentos-table td:nth-child(9) { width: 4.5% !important; text-align:center !important; }
      body.dm-global-page .lancamentos-table th:nth-child(10),
      body.dm-global-page .lancamentos-table td:nth-child(10) { width: 4.5% !important; text-align:center !important; }
      body.dm-global-page .lancamentos-table th:nth-child(11),
      body.dm-global-page .lancamentos-table td:nth-child(11) { width: 6% !important; text-align:center !important; }

      /* Contas a Pagar: reduz para caber sem vazar */
      body.dm-global-page .rotina-table,
      body.dm-global-page table.rotina-table {
        width: 100% !important;
        min-width: 0 !important;
        table-layout: fixed !important;
      }

      body.dm-global-page .rotina-table th,
      body.dm-global-page .rotina-table td {
        font-size: 11px !important;
        padding: 8px 7px !important;
        white-space: normal !important;
        line-height: 1.12 !important;
      }

      body.dm-global-page .rotina-table th:nth-child(1),
      body.dm-global-page .rotina-table td:nth-child(1) { width: 11% !important; }
      body.dm-global-page .rotina-table th:nth-child(2),
      body.dm-global-page .rotina-table td:nth-child(2) { width: 10% !important; }
      body.dm-global-page .rotina-table th:nth-child(3),
      body.dm-global-page .rotina-table td:nth-child(3) { width: 10% !important; }
      body.dm-global-page .rotina-table th:nth-child(4),
      body.dm-global-page .rotina-table td:nth-child(4) { width: 12% !important; }
      body.dm-global-page .rotina-table th:nth-child(5),
      body.dm-global-page .rotina-table td:nth-child(5) { width: 7% !important; }
      body.dm-global-page .rotina-table th:nth-child(6),
      body.dm-global-page .rotina-table td:nth-child(6) { width: 11% !important; }
      body.dm-global-page .rotina-table th:nth-child(7),
      body.dm-global-page .rotina-table td:nth-child(7) { width: 11% !important; }
      body.dm-global-page .rotina-table th:nth-child(8),
      body.dm-global-page .rotina-table td:nth-child(8) { width: 7% !important; text-align:center !important; }
      body.dm-global-page .rotina-table th:nth-child(9),
      body.dm-global-page .rotina-table td:nth-child(9) { width: 10% !important; text-align:center !important; }
      body.dm-global-page .rotina-table th:nth-child(10),
      body.dm-global-page .rotina-table td:nth-child(10) { width: 9% !important; text-align:center !important; }
      body.dm-global-page .rotina-table th:nth-child(11),
      body.dm-global-page .rotina-table td:nth-child(11) { width: 6% !important; text-align:center !important; }
      body.dm-global-page .rotina-table th:nth-child(12),
      body.dm-global-page .rotina-table td:nth-child(12) { width: 6% !important; text-align:center !important; }

      /* Filtros de comprovantes com largura segura */
      body.dm-global-page form[action="/lancamentos"] .filters {
        display: grid !important;
        grid-template-columns:
          minmax(130px, 1fr)
          minmax(125px, .9fr)
          minmax(125px, .9fr)
          minmax(135px, .95fr)
          minmax(140px, 1fr)
          minmax(120px, .85fr)
          minmax(115px, .75fr)
          minmax(115px, .75fr)
          max-content !important;
        gap: 8px !important;
        align-items: end !important;
        width: 100% !important;
      }

      body.dm-global-page form[action="/lancamentos"] .filters > div { min-width: 0 !important; }

      body.dm-global-page form[action="/lancamentos"] .filters label {
        font-size: 10px !important;
        line-height: 1.05 !important;
        margin-bottom: 4px !important;
        white-space: nowrap !important;
      }

      body.dm-global-page form[action="/lancamentos"] .filters input,
      body.dm-global-page form[action="/lancamentos"] .filters select {
        width: 100% !important;
        min-width: 0 !important;
        height: 32px !important;
        min-height: 32px !important;
        font-size: 11px !important;
        padding: 0 8px !important;
      }

      body.dm-global-page form[action="/lancamentos"] .filter-buttons {
        display: inline-flex !important;
        align-items: end !important;
        gap: 6px !important;
        min-width: 128px !important;
      }

      body.dm-global-page form[action="/lancamentos"] .filter-buttons button,
      body.dm-global-page form[action="/lancamentos"] .filter-buttons a {
        height: 32px !important;
        min-height: 32px !important;
        padding: 0 11px !important;
        font-size: 10.5px !important;
      }

      /* =====================================================
         ESPAÇO DO CONTADOR: sidebar + conteúdo sem vazar
      ===================================================== */
      body.contador-premium-page {
        overflow-x: hidden !important;
      }

      .contador-premium-page .contador-premium-shell {
        width: min(1540px, calc(100vw - 20px)) !important;
        max-width: calc(100vw - 20px) !important;
        grid-template-columns: 250px minmax(0, 1fr) !important;
        gap: 18px !important;
        overflow: hidden !important;
      }

      .contador-premium-page .contador-premium-sidebar {
        width: 250px !important;
        max-width: 250px !important;
        min-width: 0 !important;
      }

      .contador-premium-page .contador-premium-main {
        min-width: 0 !important;
        max-width: 100% !important;
        overflow: hidden !important;
      }

      .contador-premium-page .contador-metrics,
      .contador-premium-page .filter-box,
      .contador-premium-page .contador-board {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
      }

      .contador-premium-page .contador-metrics {
        display: grid !important;
        grid-template-columns: repeat(4, minmax(170px, 1fr)) !important;
        gap: 14px !important;
      }

      .contador-premium-page .table-wrap {
        width: 100% !important;
        max-width: 100% !important;
        overflow-x: auto !important;
        overflow-y: visible !important;
      }

      .contador-premium-page .contador-table {
        width: 100% !important;
        min-width: 1040px !important;
        table-layout: fixed !important;
      }

      .contador-premium-page .contador-table th,
      .contador-premium-page .contador-table td {
        font-size: 11px !important;
        padding: 8px 7px !important;
      }

      /* =====================================================
         DASHBOARD: filtros separados e sem negrito pesado
      ===================================================== */
      body:has(#dashboardMonthForm) .page-shell {
        width: min(1500px, calc(100vw - 56px)) !important;
        max-width: calc(100vw - 56px) !important;
      }

      #dashboardMonthForm,
      .filter-panel.month-smart-form#dashboardMonthForm,
      form#dashboardMonthForm.filter-panel {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 24px !important;
        column-gap: 24px !important;
        row-gap: 10px !important;
        overflow: visible !important;
        width: 100% !important;
        min-height: 58px !important;
        padding: 12px 22px !important;
      }

      #dashboardMonthForm > * {
        flex: 0 0 auto !important;
        margin: 0 !important;
      }

      #dashboardMonthForm label {
        min-width: 82px !important;
        font-size: 12px !important;
        font-weight: 500 !important;
        white-space: nowrap !important;
      }

      #dashboardMonthForm .global-month-picker {
        min-width: 255px !important;
        flex: 0 0 auto !important;
      }

      #dashboardMonthForm .month-compact-row {
        display: inline-flex !important;
        align-items: center !important;
        gap: 14px !important;
        flex-wrap: nowrap !important;
      }

      #dashboardMonthForm .month-current-display {
        min-width: 112px !important;
        max-width: 132px !important;
        height: 34px !important;
        padding: 0 10px !important;
        font-size: 11.5px !important;
        font-weight: 500 !important;
      }

      #dashboardMonthForm .month-open-btn,
      #dashboardMonthForm .btn-filter-apply,
      #dashboardMonthForm .btn-filter-clear {
        height: 34px !important;
        min-height: 34px !important;
        padding: 0 18px !important;
        font-size: 11.5px !important;
        font-weight: 600 !important;
        white-space: nowrap !important;
      }

      body:has(#dashboardMonthForm) * { font-weight: 400 !important; }

      body:has(#dashboardMonthForm) h1,
      body:has(#dashboardMonthForm) h2,
      body:has(#dashboardMonthForm) h3,
      body:has(#dashboardMonthForm) .stat-value,
      body:has(#dashboardMonthForm) .stat-number,
      body:has(#dashboardMonthForm) button,
      body:has(#dashboardMonthForm) .btn,
      body:has(#dashboardMonthForm) .dm-menu-btn {
        font-weight: 650 !important;
      }

      body:has(#dashboardMonthForm) .stat-label,
      body:has(#dashboardMonthForm) .stat-subtitle,
      body:has(#dashboardMonthForm) .hbar-header span,
      body:has(#dashboardMonthForm) .month-label,
      body:has(#dashboardMonthForm) .axis-label,
      body:has(#dashboardMonthForm) .point-value,
      body:has(#dashboardMonthForm) p,
      body:has(#dashboardMonthForm) span {
        font-weight: 400 !important;
      }

      @media (max-width: 1350px) {
        body.dm-global-page form[action="/lancamentos"] .filters {
          grid-template-columns: repeat(4, minmax(130px, 1fr)) !important;
        }

        #dashboardMonthForm,
        .filter-panel.month-smart-form#dashboardMonthForm,
        form#dashboardMonthForm.filter-panel {
          flex-wrap: wrap !important;
          gap: 14px !important;
        }

        .contador-premium-page .contador-metrics {
          grid-template-columns: repeat(2, minmax(170px, 1fr)) !important;
        }
      }

      @media (max-width: 760px) {
        body.dm-global-page .dm-global-header-shell,
        body.dm-global-page .container,
        body.dm-global-page .page-shell,
        body:has(#dashboardMonthForm) .page-shell {
          width: calc(100vw - 24px) !important;
          max-width: calc(100vw - 24px) !important;
        }

        #dashboardMonthForm {
          flex-direction: column !important;
          align-items: stretch !important;
        }

        body.dm-global-page form[action="/lancamentos"] .filters {
          grid-template-columns: 1fr !important;
        }
      }
    
/* =====================================================
   PATCH DEFINITIVO ALINHAMENTO VISUAL MAC + WINDOWS
===================================================== */

/* Todas as áreas centrais com mesma largura */
body.dm-global-page .dm-global-header-shell,
body.dm-global-page .dm-global-top,
body.dm-global-page .dm-global-nav,
body.dm-global-page .filters-card,
body.dm-global-page .summary-card,
body.dm-global-page .summary-grid,
body.dm-global-page .table-responsive,
body.dm-global-page .table-wrap,
body.dm-global-page .lancamentos-table-wrap,
body.dm-global-page .rotina-table-wrap,
body.dm-global-page .documentos-table-wrap,
body.dm-global-page .content-card,
body.dm-global-page .table-card {
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
}

/* Limita toda a página horizontal */
body.dm-global-page .page-shell,
body.dm-global-page .container,
body.dm-global-page .dm-global-page-shell {
  width: min(1450px, calc(100vw - 48px)) !important;
  max-width: calc(100vw - 48px) !important;
  margin-left: auto !important;
  margin-right: auto !important;
  overflow-x: hidden !important;
}

/* Cabeçalhos nunca maiores que tabela */
body.dm-global-page .dm-global-top,
body.dm-global-page .dm-global-nav {
  overflow: hidden !important;
  padding-left: 16px !important;
  padding-right: 16px !important;
}

/* Área das tabelas centralizadas */
body.dm-global-page .table-responsive,
body.dm-global-page .table-wrap {
  display: block !important;
  overflow-x: auto !important;
  overflow-y: visible !important;
}

/* Tabela comprovantes */
body.dm-global-page .lancamentos-table,
body.dm-global-page table.lancamentos-table {
  width: 100% !important;
  min-width: 100% !important;
  max-width: 100% !important;
  table-layout: fixed !important;
}

/* Tabela contas a pagar */
body.dm-global-page .rotina-table,
body.dm-global-page table.rotina-table {
  width: 100% !important;
  min-width: 100% !important;
  max-width: 100% !important;
  table-layout: fixed !important;
}

/* Espaço contador */
.contador-premium-page .contador-premium-shell {
  width: min(1450px, calc(100vw - 32px)) !important;
  max-width: calc(100vw - 32px) !important;
  margin: 0 auto !important;
  overflow-x: hidden !important;
  grid-template-columns: 250px minmax(0,1fr) !important;
}

.contador-premium-page .contador-premium-main {
  min-width: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
  overflow-x: hidden !important;
}

.contador-premium-page .contador-board,
.contador-premium-page .contador-metrics,
.contador-premium-page .filter-box,
.contador-premium-page .table-wrap {
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  overflow-x: auto !important;
}

/* Corrige estouro da tabela do contador */
.contador-premium-page .contador-table {
  width: 100% !important;
  min-width: 100% !important;
  table-layout: fixed !important;
}

.contador-premium-page .contador-table th,
.contador-premium-page .contador-table td {
  font-size: 10.8px !important;
  padding: 7px 6px !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

/* Dashboard filtros */
#dashboardMonthForm {
  width: 100% !important;
  max-width: 100% !important;
  overflow: visible !important;
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 18px !important;
}

/* Evita elementos maiores que tela */
img, table, iframe, canvas, svg {
  max-width: 100% !important;
}


</style>
    <script>
      (function(){
        if (window.__plennatecNoOverflowFinalReady) return;
        window.__plennatecNoOverflowFinalReady = true;

        function wrapSafeTables(){
          document.querySelectorAll('.lancamentos-table, .rotina-table, .contador-table').forEach(function(table){
            if (!table.closest('.table-responsive') && !table.closest('.table-wrap')) {
              var wrap = document.createElement('div');
              wrap.className = 'table-responsive';
              table.parentNode.insertBefore(wrap, table);
              wrap.appendChild(table);
            }
          });
        }

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', wrapSafeTables);
        } else {
          wrapSafeTables();
        }
      })();
    </script>
  `;
}

router.use((req, res, next) => {
  const originalSend = res.send.bind(res);
  res.send = function plennatecNoOverflowFinalSend(body) {
    try {
      if (typeof body === 'string' && body.includes('</head>') && !body.includes('plennatec-no-overflow-final')) {
        body = body.replace('</head>', `${renderPlennaTecNoOverflowFinalAssets()}</head>`);
      }
    } catch (error) {}
    return originalSend(body);
  };
  next();
});

















// HELPERS
function formatMoneyBR(valor) {
  const numero = Number(valor || 0);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numero);
}

function parseMoneyBR(valor) {
  if (valor === undefined || valor === null) return null;
  let texto = String(valor).trim();
  if (!texto) return null;
  texto = texto.replace(/R\$/gi, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero.toFixed(2) : null;
}

function formatValorInputBR(valor) {
  if (valor === undefined || valor === null || valor === '') return '';
  const numero = Number(valor || 0);
  return numero.toFixed(2).replace('.', ',');
}

const TIPOS_DOCUMENTO_PADRAO = [
  'NFe Produto',
  'NFEs Serviço',
  'Nota Débito',
  'Cupom Fiscal',
  'Recibo',
  'PIX',
  'Outro DOC'
];

function renderTipoDocumentoOptions(selectedValue = '') {
  const selectedText = String(selectedValue || '').trim();
  let options = '<option value="">Selecione o tipo de documento</option>';

  TIPOS_DOCUMENTO_PADRAO.forEach(tipo => {
    const selected = selectedText === tipo ? 'selected' : '';
    options += `<option value="${tipo}" ${selected}>${tipo}</option>`;
  });

  if (selectedText && !TIPOS_DOCUMENTO_PADRAO.includes(selectedText)) {
    options += `<option value="${selectedText}" selected>${selectedText}</option>`;
  }

  return options;
}

function formatMoneyFile(valor) {
  const numero = Number(valor || 0);
  return `RS${numero.toFixed(2).replace('.', ',')}`;
}

function sanitizeFilePart(text, preserveSpaces = false) {
  let value = String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\/\\:*?"<>|]/g, '')
    .trim();

  if (preserveSpaces) {
    value = value.replace(/\s+/g, ' ');
  } else {
    value = value.replace(/\s+/g, '-');
  }

  return value;
}

function buildDownloadBaseName(lancamento) {
  const tipoPagamento = sanitizeFilePart(lancamento.tipo_pagamento || 'SEM PAGAMENTO', true);
  const fornecedor = sanitizeFilePart(lancamento.fornecedor || 'SEM FORNECEDOR', true);
  const categoria = sanitizeFilePart(lancamento.categoria || 'SEM CATEGORIA', true);
  const numeroDocumento = sanitizeFilePart(
    lancamento.numero_documento || lancamento.tipo_documento || 'SEM DOCUMENTO',
    true
  );
  const valor = formatMoneyFile(lancamento.valor);

  return `${tipoPagamento}-${fornecedor}-${categoria}-${numeroDocumento}-${valor}`;
}

function stripNamespace(name) {
  return String(name || '').split(':').pop();
}

function removeNamespaces(obj) {
  if (Array.isArray(obj)) return obj.map(removeNamespaces);

  if (obj && typeof obj === 'object') {
    const novo = {};
    for (const key of Object.keys(obj)) {
      novo[stripNamespace(key)] = removeNamespaces(obj[key]);
    }
    return novo;
  }

  return obj;
}

function getDeep(obj, pathArray) {
  let current = obj;
  for (const key of pathArray) {
    if (!current || !(key in current)) return null;
    current = current[key];
  }
  return current;
}

function pickFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function normalizeDate(dateValue) {
  if (!dateValue) return '';
  const text = String(dateValue).trim();

  if (text.includes('T')) return text.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  if (text.includes('/')) {
    const partes = text.split(' ')[0].split('/');
    if (partes.length === 3) {
      return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }
  }

  return text;
}

function formatDateBR(dateValue) {
  if (!dateValue) return '';

  // PostgreSQL pode devolver DATE como objeto Date.
  // Usamos UTC para evitar virar o dia por causa de fuso horário.
  if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
    const dia = String(dateValue.getUTCDate()).padStart(2, '0');
    const mes = String(dateValue.getUTCMonth() + 1).padStart(2, '0');
    const ano = dateValue.getUTCFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  const text = String(dateValue).trim();
  if (!text) return '';

  const iso = text.includes('T') ? text.split('T')[0] : text;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  return text;
}

function formatDateInput(dateValue) {
  if (!dateValue) return '';

  if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
    const dia = String(dateValue.getUTCDate()).padStart(2, '0');
    const mes = String(dateValue.getUTCMonth() + 1).padStart(2, '0');
    const ano = dateValue.getUTCFullYear();
    return `${ano}-${mes}-${dia}`;
  }

  const text = String(dateValue).trim();
  if (!text) return '';

  const iso = text.includes('T') ? text.split('T')[0] : text;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : '';
}


async function ensureRotinaDespesasColumns() {
  await pool.query(`
    ALTER TABLE rotina_despesas
    ADD COLUMN IF NOT EXISTS dia_vencimento VARCHAR(50)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS painel_configuracoes (
      chave VARCHAR(80) PRIMARY KEY,
      valor TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rotina_despesas_status_mensal (
      id SERIAL PRIMARY KEY,
      rotina_id INTEGER NOT NULL REFERENCES rotina_despesas(id) ON DELETE CASCADE,
      mes_ano VARCHAR(7) NOT NULL,
      status_linha VARCHAR(20) DEFAULT 'PENDENTE',
      status_pagto VARCHAR(20) DEFAULT 'A_PAGAR',
      atualizado_em TIMESTAMP DEFAULT NOW(),
      UNIQUE (rotina_id, mes_ano)
    )
  `);

  await pool.query(`
    ALTER TABLE rotina_despesas_status_mensal
    ADD COLUMN IF NOT EXISTS status_linha VARCHAR(20) DEFAULT 'PENDENTE'
  `);

  await pool.query(`
    ALTER TABLE rotina_despesas_status_mensal
    ADD COLUMN IF NOT EXISTS status_pagto VARCHAR(20) DEFAULT 'A_PAGAR'
  `);

  await pool.query(`
    ALTER TABLE rotina_despesas_status_mensal
    ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true
  `);
}

async function getPainelConfig(chave, valorPadrao = '') {
  const result = await pool.query('SELECT valor FROM painel_configuracoes WHERE chave = $1 LIMIT 1', [chave]);
  return result.rows[0]?.valor || valorPadrao;
}

async function setPainelConfig(chave, valor) {
  await pool.query(`
    INSERT INTO painel_configuracoes (chave, valor)
    VALUES ($1, $2)
    ON CONFLICT (chave)
    DO UPDATE SET valor = EXCLUDED.valor
  `, [chave, valor || '']);
}

function getMesAnoAtual() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
}

function normalizarStatusLinha(value) {
  const texto = String(value || '').trim().toUpperCase();
  return ['PENDENTE', 'FEITO', 'N/A'].includes(texto) ? texto : 'PENDENTE';
}

function normalizarStatusPagto(value) {
  const texto = String(value || '').trim().toUpperCase();
  if (texto === 'PAGO') return 'PAGO';
  if (texto === 'VENCIDO') return 'VENCIDO';
  if (texto === 'Não tem') return 'Não tem';

 return 'A_PAGAR';

}

function normalizarAtivoMensal(value) {
  const texto = String(value ?? '').trim().toLowerCase();
  return ['false', '0', 'nao', 'não', 'n'].includes(texto) ? false : true;
}

function renderStatusPagtoOptions(selectedValue = '') {
  const selected = normalizarStatusPagto(selectedValue);
  return `
    <option value="A_PAGAR" ${selected === 'A_PAGAR' ? 'selected' : ''}>À pagar</option>
    <option value="PAGO" ${selected === 'PAGO' ? 'selected' : ''}>Pago</option>
    <option value="NÃO TEM" ${selected === 'NÃO TEM' ? 'selected' : ''}>Não tem</option>
    <option value="VENCIDO" ${selected === 'VENCIDO' ? 'selected' : ''}>Vencido</option>
  `;
}

async function upsertStatusMensal(rotinaId, mesAno, statusLinha, statusPagto, ativo = null) {
  const mes = String(mesAno || '').trim() || getMesAnoAtual();
  await pool.query(`
    INSERT INTO rotina_despesas_status_mensal (rotina_id, mes_ano, status_linha, status_pagto, ativo, atualizado_em)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (rotina_id, mes_ano)
    DO UPDATE SET
      status_linha = COALESCE(EXCLUDED.status_linha, rotina_despesas_status_mensal.status_linha),
      status_pagto = COALESCE(EXCLUDED.status_pagto, rotina_despesas_status_mensal.status_pagto),
      ativo = COALESCE(EXCLUDED.ativo, rotina_despesas_status_mensal.ativo),
      atualizado_em = NOW()
  `, [rotinaId, mes, statusLinha || null, statusPagto || null, ativo]);
}

async function getStatusMesCompetencia(mesAno) {
  const mes = String(mesAno || '').trim() || getMesAnoAtual();
  return getPainelConfig(`rotina_status_mes_${mes}`, 'PENDENTE');
}

async function setStatusMesCompetencia(mesAno, statusMes) {
  const mes = String(mesAno || '').trim() || getMesAnoAtual();
  await setPainelConfig(`rotina_status_mes_${mes}`, String(statusMes || 'PENDENTE').trim() === 'FEITO' ? 'FEITO' : 'PENDENTE');
}

function toNullableInt(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const number = Number.parseInt(text, 10);
  return Number.isFinite(number) ? number : null;
}

function gerarOpcoesMesAno(selectedValue = '') {
  const hoje = new Date();
  const opcoes = ['<option value="">Selecione o mês/ano</option>'];
  for (let i = -2; i <= 12; i++) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const valor = `${ano}-${mes}`;
    const label = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const labelFinal = label.charAt(0).toUpperCase() + label.slice(1);
    opcoes.push(`<option value="${valor}" ${String(selectedValue) === valor ? 'selected' : ''}>${labelFinal}</option>`);
  }
  return opcoes.join('');
}


const MESES_CURTOS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatMesAnoCurto(mesAno = '') {
  const text = String(mesAno || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})$/);
  if (!match) return 'Selecione';
  const ano = match[1];
  const mesIndex = Number(match[2]) - 1;
  const mes = MESES_CURTOS_PT[mesIndex] || match[2];
  return `${mes}-${ano.slice(-2)}`;
}

function getMesAnoAtualRef() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
}

function renderMonthPickerComponent({
  prefix,
  selectedValue = '',
  fieldName = 'mes',
  allowAll = false,
  allLabel = 'Todos os meses',
  openButtonLabel = 'Escolher mês',
  applyLabel = 'Filtrar mês',
  compact = false
} = {}) {
  const safePrefix = String(prefix || 'month').replace(/[^a-zA-Z0-9_-]/g, '');
  const value = String(selectedValue || '').trim();
  const isValid = /^\d{4}-\d{2}$/.test(value);
  const baseValue = isValid ? value : getMesAnoAtualRef();
  const anoSelecionado = baseValue.slice(0, 4);
  const mesSelecionado = baseValue.slice(5, 7);
  const displayLabel = value ? formatMesAnoCurto(value) : allLabel;
  const anos = Array.from({ length: 31 }, (_, i) => 2020 + i);

  return `
    <div class="global-month-picker ${compact ? 'is-compact' : ''}" data-month-prefix="${safePrefix}">
      <input type="hidden" id="${safePrefix}_mes_picker_value" name="${fieldName}" value="${escapeHtmlGlobal(value)}">
      <div class="month-compact-row">
        <span class="month-current-display" id="${safePrefix}MesAtualLabel">${escapeHtmlGlobal(displayLabel)}</span>
        <button type="button" class="month-open-btn" onclick="abrirSeletorMesGlobal('${safePrefix}')">${escapeHtmlGlobal(openButtonLabel)}</button>
      </div>

      <div id="${safePrefix}MonthPickerOverlay" class="month-picker-overlay" onclick="fecharSeletorMesGlobal('${safePrefix}', event)">
        <div class="month-picker-popover" onclick="event.stopPropagation()">
          <div class="month-picker-head">
            <button type="button" class="month-nav-btn" onclick="mudarAnoPickerGlobal('${safePrefix}', -1)">«</button>
            <select id="${safePrefix}MonthPickerYear" class="month-year-select" onchange="atualizarPreviewMesGlobal('${safePrefix}')">
              ${anos.map(ano => `<option value="${ano}" ${String(anoSelecionado) === String(ano) ? 'selected' : ''}>${ano}</option>`).join('')}
            </select>
            <button type="button" class="month-nav-btn" onclick="mudarAnoPickerGlobal('${safePrefix}', 1)">»</button>
          </div>

          <div class="month-grid-picker" id="${safePrefix}MonthGridPicker">
            ${MESES_CURTOS_PT.map((nome, idx) => {
              const mesValor = String(idx + 1).padStart(2, '0');
              const ativo = mesValor === mesSelecionado ? 'active' : '';
              return `<button type="button" class="month-cell ${ativo}" data-month="${mesValor}" onclick="selecionarMesGlobal('${safePrefix}', '${mesValor}')">${nome}</button>`;
            }).join('')}
          </div>

          <div class="month-picker-footer">
            <span class="month-selected-preview" id="${safePrefix}MonthSelectedPreview">Selecionado: ${escapeHtmlGlobal(formatMesAnoCurto(baseValue))}</span>
            <div class="month-picker-footer-actions">
              ${allowAll ? `<button type="button" class="month-footer-btn soft" onclick="limparMesGlobal('${safePrefix}')">${escapeHtmlGlobal(allLabel.replace(' os meses', ''))}</button>` : ''}
              <button type="button" class="month-footer-btn soft" onclick="fecharSeletorMesGlobal('${safePrefix}')">Cancelar</button>
              <button type="button" class="month-footer-btn primary" onclick="aplicarMesGlobal('${safePrefix}')">${escapeHtmlGlobal(applyLabel)}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}


function renderMonthPickerAssets() {
  return `
    <style>
      /* ===== COMPONENTE GLOBAL DE MÊS — PLENNATEC DEFINITIVO ===== */
      .global-month-picker,
      .month-smart-form {
        overflow: visible !important;
      }

      .month-compact-row {
        display: inline-flex !important;
        align-items: center !important;
        gap: 8px !important;
        min-width: 0 !important;
      }

      .month-current-display {
        min-width: 104px !important;
        height: 34px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0 10px !important;
        border-radius: 12px !important;
        background: #ffffff !important;
        border: 1px solid #dce3ec !important;
        color: #172033 !important;
        font-size: 13px !important;
        font-weight: 950 !important;
        white-space: nowrap !important;
        box-shadow: 0 8px 18px rgba(15,23,42,.05) !important;
      }

      .month-open-btn {
        min-width: 108px !important;
        height: 34px !important;
        padding: 0 12px !important;
        border-radius: 12px !important;
        border: 1px solid #dce3ec !important;
        background: linear-gradient(180deg,#f8fafc,#eef2f7) !important;
        color: #172033 !important;
        font-size: 11.5px !important;
        font-weight: 950 !important;
        cursor: pointer !important;
        box-shadow: 0 8px 18px rgba(15,23,42,.05) !important;
        white-space: nowrap !important;
      }

      .month-open-btn:hover,
      .month-footer-btn:hover,
      .month-nav-btn:hover,
      .month-cell:hover {
        transform: translateY(-1px);
        filter: brightness(1.02);
      }

      .month-picker-overlay {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 999999;
        background: rgba(15, 23, 42, 0.18);
        align-items: flex-start;
        justify-content: center;
        padding: 92px 18px 18px;
      }

      .month-picker-overlay.open {
        display: flex !important;
      }

      .month-picker-popover {
        width: 384px;
        max-width: calc(100vw - 28px);
        border-radius: 18px;
        background: rgba(255,255,255,0.99);
        border: 1px solid #dce3ec;
        box-shadow: 0 24px 70px rgba(15, 23, 42, 0.24);
        padding: 14px;
      }

      .month-picker-head {
        display: grid;
        grid-template-columns: 42px 1fr 42px;
        gap: 8px;
        align-items: center;
        margin-bottom: 14px;
      }

      .month-nav-btn {
        height: 36px !important;
        min-height: 36px !important;
        border-radius: 12px !important;
        padding: 0 !important;
        font-size: 18px !important;
        line-height: 1 !important;
        border: 0 !important;
        background: linear-gradient(135deg,#00B050,#009640) !important;
        color: #fff !important;
        font-weight: 900 !important;
        cursor: pointer !important;
      }

      .month-year-select {
        height: 36px !important;
        text-align: center !important;
        font-weight: 950 !important;
        border-radius: 12px !important;
        border: 1px solid #dce3ec !important;
        background: #fff !important;
      }

      .month-grid-picker {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
      }

      .month-cell {
        height: 36px !important;
        min-height: 36px !important;
        padding: 0 !important;
        border-radius: 11px !important;
        font-size: 12.5px !important;
        font-weight: 950 !important;
        background: #E8F7EE !important;
        color: #14532d !important;
        border: 1px solid #c8ecd4 !important;
        box-shadow: 0 8px 16px rgba(15, 23, 42, .04) !important;
        transition: all .16s ease !important;
        cursor: pointer !important;
      }

      .month-cell.active {
        background: linear-gradient(135deg, #00B050, #009640) !important;
        color: #fff !important;
        border-color: rgba(0, 176, 80, .9) !important;
        box-shadow: 0 10px 18px rgba(0, 176, 80, .22) !important;
      }

      .month-picker-footer {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: 10px;
        margin-top: 14px;
      }

      .month-selected-preview {
        color: #14532d;
        font-size: 12px;
        font-weight: 950;
        white-space: nowrap;
      }

      .month-picker-footer-actions {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(72px, auto);
        gap: 7px;
        align-items: center;
      }

      .month-footer-btn {
        height: 34px !important;
        min-width: 72px !important;
        padding: 0 10px !important;
        border-radius: 12px !important;
        border: 0 !important;
        font-size: 11px !important;
        font-weight: 950 !important;
        cursor: pointer !important;
        white-space: nowrap !important;
      }

      .month-footer-btn.primary {
        background: linear-gradient(135deg,#00B050,#009640) !important;
        color: #fff !important;
        box-shadow: 0 10px 20px rgba(0,176,80,.16) !important;
      }

      .month-footer-btn.soft {
        background: #eef2f7 !important;
        color: #172033 !important;
        border: 1px solid #dce3ec !important;
      }

      /* Dashboard: respiro entre totalizadores e filtro */
      .stats-grid {
        margin-bottom: 18px !important;
      }

      .filter-panel.month-smart-form {
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        overflow: visible !important;
        margin-top: 0 !important;
        margin-bottom: 18px !important;
        min-height: 58px !important;
        padding: 10px 18px !important;
      }

      .filter-panel.month-smart-form label {
        font-size: 12px !important;
        margin-right: 4px !important;
      }

      .filter-panel.month-smart-form .global-month-picker {
        flex: 0 0 auto !important;
      }

      .filter-panel.month-smart-form .month-current-display {
        min-width: 112px !important;
        height: 34px !important;
        font-size: 12px !important;
        padding: 0 10px !important;
      }

      .filter-panel.month-smart-form .month-open-btn,
      .filter-panel.month-smart-form .btn-filter-apply,
      .filter-panel.month-smart-form .btn-filter-clear {
        height: 34px !important;
        min-height: 34px !important;
        padding: 0 13px !important;
        font-size: 11.5px !important;
      }

      /* Contador: filtro todo na mesma linha */
      .contador-premium-page .filter-box.month-smart-form {
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        flex-wrap: nowrap !important;
        overflow: visible !important;
        min-height: 54px !important;
      }

      .contador-premium-page .filter-box .filter-group {
        width: auto !important;
        min-width: 0 !important;
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        margin: 0 !important;
      }

      .contador-premium-page .filter-box .filter-group label {
        width: auto !important;
        min-width: 165px !important;
        margin: 0 !important;
        line-height: 1 !important;
        font-size: 11px !important;
        font-weight: 950 !important;
        white-space: nowrap !important;
      }

      .contador-premium-page .filter-box .global-month-picker {
        flex: 0 0 auto !important;
      }

      .contador-premium-page .filter-box .month-current-display {
        height: 34px !important;
        min-width: 92px !important;
        font-size: 13px !important;
      }

      .contador-premium-page .filter-box .month-open-btn {
        height: 34px !important;
        min-width: 108px !important;
        font-size: 11.5px !important;
      }

      .contador-premium-page .contador-apply-month-btn,
      .contador-premium-page .filter-box .btn-green {
        height: 34px !important;
        min-height: 34px !important;
        align-self: center !important;
        margin: 0 !important;
        padding: 0 14px !important;
        font-size: 11.5px !important;
      }

      .contador-premium-page .btn-add-file-top {
        align-self: center !important;
        margin-left: auto !important;
        height: 34px !important;
        min-height: 34px !important;
        padding: 0 16px !important;
        font-size: 11.5px !important;
      }

      .contador-premium-page .contador-filter-spacer {
        flex: 1 1 auto !important;
      }

      @media(max-width: 980px) {
        .filter-panel.month-smart-form,
        .contador-premium-page .filter-box.month-smart-form {
          flex-wrap: wrap !important;
        }
        .contador-premium-page .contador-filter-spacer {
          display: none !important;
        }
        .contador-premium-page .btn-add-file-top {
          margin-left: 0 !important;
        }
      }

      @media(max-width: 520px) {
        .month-picker-popover { width: min(360px, calc(100vw - 28px)); }
        .month-picker-footer { grid-template-columns: 1fr; }
        .month-picker-footer-actions { grid-auto-flow: row; grid-template-columns: 1fr; }
        .month-footer-btn { width: 100% !important; }
      }


      /* Correção final: seletor de mês sempre abre acima de qualquer card/filtro */
      body > .month-picker-overlay,
      .month-picker-overlay.open {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483000 !important;
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        align-items: flex-start !important;
        justify-content: center !important;
        padding-top: 92px !important;
      }

      body > .month-picker-overlay:not(.open),
      .month-picker-overlay:not(.open) {
        display: none !important;
      }

      body > .month-picker-overlay .month-picker-popover {
        position: relative !important;
        z-index: 2147483001 !important;
      }

      /* Correção final: Dashboard com respiro e texto compacto no filtro */
      #dashboardMonthForm {
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        flex-wrap: wrap !important;
        margin-top: 0 !important;
        margin-bottom: 18px !important;
      }

      #dashboardMonthForm .month-current-display {
        min-width: 96px !important;
        max-width: 112px !important;
        height: 34px !important;
        padding: 0 8px !important;
        font-size: 11.5px !important;
        line-height: 1 !important;
      }

      /* Correção final: Espaço do Contador com filtro e botão Aplicar mês na mesma linha */
      .contador-premium-page .filter-box.month-smart-form,
      .contador-premium-page #contadorMonthForm {
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        gap: 10px !important;
        flex-wrap: nowrap !important;
        overflow: visible !important;
      }

      .contador-premium-page #contadorMonthForm .filter-group {
        display: inline-flex !important;
        flex-direction: row !important;
        align-items: center !important;
        gap: 10px !important;
        width: auto !important;
        margin: 0 !important;
      }

      .contador-premium-page #contadorMonthForm .contador-apply-month-btn {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        align-self: center !important;
        margin: 0 !important;
        transform: none !important;
      }

      /* ===== FIM COMPONENTE GLOBAL DE MÊS — PLENNATEC DEFINITIVO ===== */
    

/* ===== AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */
/* Comprovantes Fiscais: filtros compactos para caberem em uma única linha em telas largas */
body.dm-global-page form[action="/lancamentos"] .filters {
  display: grid !important;
  grid-template-columns: 1.05fr 1.05fr 1.05fr 1.05fr 1.05fr 1fr .92fr .92fr auto !important;
  align-items: end !important;
  gap: 8px !important;
  padding: 12px 14px !important;
}

body.dm-global-page form[action="/lancamentos"] .filters > div {
  min-width: 0 !important;
}

body.dm-global-page form[action="/lancamentos"] .filters label {
  display: block !important;
  margin: 0 0 5px !important;
  font-size: 10px !important;
  line-height: 1.05 !important;
  font-weight: 900 !important;
  white-space: nowrap !important;
}

body.dm-global-page form[action="/lancamentos"] .filters input,
body.dm-global-page form[action="/lancamentos"] .filters select {
  width: 100% !important;
  min-width: 0 !important;
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 10px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons {
  display: inline-flex !important;
  align-items: end !important;
  justify-content: flex-start !important;
  gap: 7px !important;
  min-width: 142px !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons button,
body.dm-global-page form[action="/lancamentos"] .filter-buttons a {
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 13px !important;
  font-size: 11px !important;
  border-radius: 11px !important;
}

@media (max-width: 1280px) {
  body.dm-global-page form[action="/lancamentos"] .filters {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

/* Espaço do Contador: conteúdo interno da coluna Enviar Arquivo alinhado à esquerda */
.contador-premium-page .contador-table th:nth-child(4) {
  text-align: center !important;
}

.contador-premium-page .contador-table td:nth-child(4) {
  text-align: left !important;
  padding-left: 10px !important;
  padding-right: 8px !important;
}

.contador-premium-page .upload-cell-compact {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  flex-wrap: nowrap !important;
  max-width: 100% !important;
  margin-left: 0 !important;
}

.contador-premium-page .btn-upload-open {
  width: auto !important;
  min-width: 112px !important;
  height: 30px !important;
  min-height: 30px !important;
  padding: 0 12px !important;
  font-size: 10.8px !important;
  line-height: 1 !important;
  border-radius: 11px !important;
}

.contador-premium-page .upload-cell-compact .clip-indicator,
.contador-premium-page .upload-cell-compact .empty-inline,
.contador-premium-page .upload-cell-compact .attached-badge,
.contador-premium-page .upload-cell-compact .attached-empty {
  flex: 0 0 auto !important;
}
/* ===== FIM AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */

</style>
    <script>
      (function(){
        window.MESES_PICKER_PT = window.MESES_PICKER_PT || ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        window.monthPickerState = window.monthPickerState || {};

        window.formatMesAnoCurtoJS = function(valor){
          const match = String(valor || '').match(/^(\\d{4})-(\\d{2})$/);
          if (!match) return valor || 'Selecione';
          const nomeMes = window.MESES_PICKER_PT[Number(match[2]) - 1] || match[2];
          return nomeMes + '-' + String(match[1]).slice(-2);
        };

        window.getMonthPickerPrefixConfig = function(prefix){
          return {
            root: document.querySelector('[data-month-prefix="' + prefix + '"]'),
            hidden: document.getElementById(prefix + '_mes_picker_value'),
            label: document.getElementById(prefix + 'MesAtualLabel'),
            overlay: document.getElementById(prefix + 'MonthPickerOverlay'),
            year: document.getElementById(prefix + 'MonthPickerYear'),
            grid: document.getElementById(prefix + 'MonthGridPicker'),
            preview: document.getElementById(prefix + 'MonthSelectedPreview')
          };
        };

        window.getMonthPickerForm = function(prefix){
          const cfg = window.getMonthPickerPrefixConfig(prefix);
          return cfg.root ? cfg.root.closest('form') : null;
        };

        window.iniciarMesGlobal = function(prefix){
          const cfg = window.getMonthPickerPrefixConfig(prefix);
          const valor = cfg.hidden?.value || '';
          const hoje = new Date();

          window.monthPickerState[prefix] = {
            ano: /^\\d{4}-\\d{2}$/.test(valor) ? valor.slice(0, 4) : String(hoje.getFullYear()),
            mes: /^\\d{4}-\\d{2}$/.test(valor) ? valor.slice(5, 7) : String(hoje.getMonth() + 1).padStart(2, '0')
          };

          if (cfg.year) {
            const anoAtual = window.monthPickerState[prefix].ano;
            const existe = Array.from(cfg.year.options).some(opt => String(opt.value) === String(anoAtual));
            if (!existe) {
              const opt = document.createElement('option');
              opt.value = anoAtual;
              opt.textContent = anoAtual;
              cfg.year.appendChild(opt);
            }
            cfg.year.value = anoAtual;
          }

          window.selecionarMesGlobal(prefix, window.monthPickerState[prefix].mes, false);
          window.atualizarPreviewMesGlobal(prefix);
        };

        window.abrirSeletorMesGlobal = function(prefix){
          window.iniciarMesGlobal(prefix);
          const cfg = window.getMonthPickerPrefixConfig(prefix);
          if (cfg.overlay) {
            // Correção definitiva: o pop-up pode nascer dentro de formulários/cards com filtros,
            // o que em alguns navegadores cria conflito de camada/posição.
            // Ao abrir, movemos o overlay para o body e forçamos a camada acima de tudo.
            if (cfg.overlay.parentElement !== document.body) {
              document.body.appendChild(cfg.overlay);
            }
            cfg.overlay.classList.add('open');
            cfg.overlay.style.display = 'flex';
            cfg.overlay.style.visibility = 'visible';
            cfg.overlay.style.opacity = '1';
            cfg.overlay.style.pointerEvents = 'auto';
          }
        };

        window.fecharSeletorMesGlobal = function(prefix, event){
          if (event && event.target && event.target.id !== prefix + 'MonthPickerOverlay') return;
          const cfg = window.getMonthPickerPrefixConfig(prefix);
          if (cfg.overlay) {
            cfg.overlay.classList.remove('open');
            cfg.overlay.style.display = '';
            cfg.overlay.style.visibility = '';
            cfg.overlay.style.opacity = '';
            cfg.overlay.style.pointerEvents = '';
          }
        };

        window.selecionarMesGlobal = function(prefix, mes, atualizar = true){
          window.monthPickerState[prefix] = window.monthPickerState[prefix] || {};
          window.monthPickerState[prefix].mes = String(mes).padStart(2, '0');
          const cfg = window.getMonthPickerPrefixConfig(prefix);

          if (cfg.grid) {
            cfg.grid.querySelectorAll('.month-cell').forEach(btn => {
              btn.classList.toggle('active', btn.dataset.month === window.monthPickerState[prefix].mes);
            });
          }

          if (atualizar) window.atualizarPreviewMesGlobal(prefix);
        };

        window.mudarAnoPickerGlobal = function(prefix, delta){
          const cfg = window.getMonthPickerPrefixConfig(prefix);
          const atual = parseInt(cfg.year?.value || window.monthPickerState[prefix]?.ano || String(new Date().getFullYear()), 10);
          const novo = atual + Number(delta || 0);

          if (cfg.year) {
            const existe = Array.from(cfg.year.options).some(opt => String(opt.value) === String(novo));
            if (!existe) {
              const opt = document.createElement('option');
              opt.value = String(novo);
              opt.textContent = String(novo);
              cfg.year.appendChild(opt);
            }
            cfg.year.value = String(novo);
          }

          window.monthPickerState[prefix] = window.monthPickerState[prefix] || {};
          window.monthPickerState[prefix].ano = String(novo);
          window.atualizarPreviewMesGlobal(prefix);
        };

        window.atualizarPreviewMesGlobal = function(prefix){
          const cfg = window.getMonthPickerPrefixConfig(prefix);
          window.monthPickerState[prefix] = window.monthPickerState[prefix] || {};
          const ano = cfg.year?.value || window.monthPickerState[prefix].ano || String(new Date().getFullYear());
          const mes = window.monthPickerState[prefix].mes || String(new Date().getMonth() + 1).padStart(2, '0');
          const label = window.formatMesAnoCurtoJS(ano + '-' + mes);
          window.monthPickerState[prefix].ano = String(ano);
          if (cfg.preview) cfg.preview.textContent = 'Selecionado: ' + label;
        };

        window.aplicarMesGlobal = function(prefix){
          const cfg = window.getMonthPickerPrefixConfig(prefix);
          window.monthPickerState[prefix] = window.monthPickerState[prefix] || {};
          const ano = cfg.year?.value || window.monthPickerState[prefix].ano || String(new Date().getFullYear());
          const mes = window.monthPickerState[prefix].mes || String(new Date().getMonth() + 1).padStart(2, '0');

          if (cfg.hidden) cfg.hidden.value = ano + '-' + mes;

          const form = window.getMonthPickerForm(prefix);
          if (form) form.submit();
        };

        window.limparMesGlobal = function(prefix){
          const cfg = window.getMonthPickerPrefixConfig(prefix);
          if (cfg.hidden) cfg.hidden.value = '';

          const form = window.getMonthPickerForm(prefix);
          if (form) form.submit();
        };

        document.addEventListener('click', function(event) {
          const openBtn = event.target.closest('.month-open-btn');
          if (openBtn) {
            event.preventDefault();
            const picker = openBtn.closest('[data-month-prefix]');
            if (picker) window.abrirSeletorMesGlobal(picker.getAttribute('data-month-prefix'));
          }

          const monthCell = event.target.closest('.month-cell');
          if (monthCell) {
            event.preventDefault();
            const picker = monthCell.closest('[data-month-prefix]');
            if (picker) window.selecionarMesGlobal(picker.getAttribute('data-month-prefix'), monthCell.dataset.month);
          }
        });
      })();
    </script>
  `;
}


function normalizarDiaVencimento(value) {
  if (value === undefined || value === null) return '';
  const text = String(value).trim();
  if (!text) return '';
  const match = text.match(/\d{1,2}/);
  if (!match) return '';
  const dia = Number.parseInt(match[0], 10);
  if (!Number.isFinite(dia) || dia < 1 || dia > 31) return '';
  return String(dia);
}

function formatDiaVencimento(value) {
  const dia = normalizarDiaVencimento(value);
  return dia ? dia.padStart(2, '0') : '';
}

function gerarOpcoesDiaVencimento(selectedValue = '', placeholder = 'Selecione o dia') {
  const selected = normalizarDiaVencimento(selectedValue);
  let options = `<option value="" ${selected === '' ? 'selected' : ''}>${placeholder}</option>`;
  for (let i = 1; i <= 31; i++) {
    const valor = String(i);
    const label = valor.padStart(2, '0');
    options += `<option value="${valor}" ${selected === valor ? 'selected' : ''}>${label}</option>`;
  }
  return options;
}

async function parseXmlDocumento(filePath) {
  const xmlContent = fs.readFileSync(filePath, 'utf8');

  function toNumberString(value) {
    if (value === undefined || value === null) return '';
    const text = String(value).trim();
    if (!text) return '';

    if (text.includes(',') && text.includes('.')) {
      return text.replace(/\./g, '').replace(',', '.');
    }

    if (text.includes(',')) {
      return text.replace(',', '.');
    }

    return text;
  }

  function extractFirst(obj, paths) {
    for (const pathArray of paths) {
      const value = getDeep(obj, pathArray);
      const picked = pickFirst(value);
      if (picked) return picked;
    }
    return '';
  }

  // ===== NFS-e Cajamar / ConsultaSituacaoLoteAsyncResposta =====
  if (/<ConsultaSituacaoLoteAsyncResposta>/i.test(xmlContent) && /<Nfse>/i.test(xmlContent)) {
    const parser = new xml2js.Parser({ explicitArray: false, trim: true });
    const parsed = await parser.parseStringPromise(xmlContent);

    const nfse = getDeep(parsed, ['ConsultaSituacaoLoteAsyncResposta', 'Nfse']) || {};
    const prestador = nfse.PrestadorServico || {};
    const identificacaoPrestador = prestador.IdentificacaoPrestador || {};
    const identificacaoNfse = nfse.IdentificacaoNfse || {};
    const servico = nfse.Servico || {};
    const valores = servico.Valores || {};

    return {
      origem_layout: 'NFS-e Cajamar',
      status: 'Lido automaticamente',
      tipo_documento: 'NFS-e',
      numero_documento: pickFirst(identificacaoNfse.NumeroNfse, getDeep(nfse, ['IdentificacaoRps', 'NumeroRps'])),
      data_documento: normalizeDate(pickFirst(nfse.DataEmissao, nfse.DataLancamento)),
      fornecedor: pickFirst(prestador.RazaoSocial),
      cnpj_cpf: pickFirst(identificacaoPrestador.CnpjCpf),
      valor: toNumberString(pickFirst(valores.ValorServicos, valores.BaseCalculo)),
      erro_leitura: null
    };
  }

  // ===== NFS-e Prefeitura SP =====
  if (/<RetornoConsulta/i.test(xmlContent) && /<NumeroNFe>/i.test(xmlContent)) {
    const parser = new xml2js.Parser({ explicitArray: false, trim: true });
    const parsedOriginal = await parser.parseStringPromise(xmlContent);
    const parsed = removeNamespaces(parsedOriginal);

    const nfe = getDeep(parsed, ['RetornoConsulta', 'NFe']) || {};

    return {
      origem_layout: 'NFS-e Prefeitura SP',
      status: 'Lido automaticamente',
      tipo_documento: 'NFS-e',
      numero_documento: pickFirst(
        getDeep(nfe, ['ChaveNFe', 'NumeroNFe']),
        nfe.NumeroNFe,
        nfe.Numero,
        nfe.NumeroNota
      ),
      data_documento: normalizeDate(pickFirst(
        nfe.DataEmissaoNFe,
        nfe.DataEmissaoRPS,
        nfe.DataFatoGeradorNFe
      )),
      fornecedor: pickFirst(nfe.RazaoSocialPrestador, nfe.Prestador, nfe.NomePrestador),
      cnpj_cpf: pickFirst(
        getDeep(nfe, ['CPFCNPJPrestador', 'CNPJ']),
        getDeep(nfe, ['CPFCNPJPrestador', 'CPF'])
      ),
      valor: toNumberString(pickFirst(nfe.ValorServicos, nfe.ValorFinalCobrado, nfe.ValorLiquidoNFe)),
      erro_leitura: null
    };
  }

  // ===== NFS-e nacional / diversos layouts =====
  if (/<NFSe/i.test(xmlContent) || /<infNFSe/i.test(xmlContent) || /<DPS/i.test(xmlContent)) {
    try {
      const parser = new xml2js.Parser({ explicitArray: false, trim: true });
      const parsedOriginal = await parser.parseStringPromise(xmlContent);
      const parsed = removeNamespaces(parsedOriginal);

      const infNFSe =
        getDeep(parsed, ['NFSe', 'infNFSe']) ||
        getDeep(parsed, ['NFSe', 'Nfse', 'infNFSe']) ||
        getDeep(parsed, ['Nfse', 'infNFSe']) ||
        getDeep(parsed, ['CompNfse', 'Nfse', 'InfNfse']) ||
        getDeep(parsed, ['CompNfse', 'Nfse', 'infNfse']) ||
        getDeep(parsed, ['GerarNfseResposta', 'ListaNfse', 'CompNfse', 'Nfse', 'InfNfse']) ||
        {};

      const emit =
        infNFSe.emit ||
        infNFSe.Emit ||
        infNFSe.prest ||
        infNFSe.PrestadorServico ||
        getDeep(infNFSe, ['Prestador']) ||
        {};

      const valores =
        infNFSe.valores ||
        infNFSe.Valores ||
        getDeep(infNFSe, ['Servico', 'Valores']) ||
        {};

      const dps =
        infNFSe.DPS ||
        infNFSe.dps ||
        getDeep(infNFSe, ['DeclaracaoPrestacaoServico']) ||
        getDeep(infNFSe, ['InfDeclaracaoPrestacaoServico']) ||
        {};

      const prestadorServico =
        getDeep(infNFSe, ['PrestadorServico']) ||
        getDeep(dps, ['Prestador']) ||
        getDeep(dps, ['PrestadorServico']) ||
        {};

      const identificacaoPrestador =
        getDeep(prestadorServico, ['IdentificacaoPrestador']) ||
        getDeep(prestadorServico, ['CpfCnpj']) ||
        {};

      const numeroDocumento = extractFirst(parsed, [
        ['NFSe', 'infNFSe', 'nNFSe'],
        ['NFSe', 'infNFSe', 'nDFSe'],
        ['Nfse', 'infNFSe', 'nNFSe'],
        ['CompNfse', 'Nfse', 'InfNfse', 'Numero'],
        ['CompNfse', 'Nfse', 'infNfse', 'Numero'],
        ['GerarNfseResposta', 'ListaNfse', 'CompNfse', 'Nfse', 'InfNfse', 'Numero']
      ]) || pickFirst(
        infNFSe.nNFSe,
        infNFSe.nDFSe,
        infNFSe.Numero,
        infNFSe.numero
      );

      const dataDocumento = normalizeDate(
        extractFirst(parsed, [
          ['NFSe', 'infNFSe', 'dhProc'],
          ['NFSe', 'infNFSe', 'dhEmi'],
          ['NFSe', 'infNFSe', 'dCompet'],
          ['Nfse', 'infNFSe', 'dhProc'],
          ['CompNfse', 'Nfse', 'InfNfse', 'DataEmissao'],
          ['CompNfse', 'Nfse', 'infNfse', 'DataEmissao'],
          ['GerarNfseResposta', 'ListaNfse', 'CompNfse', 'Nfse', 'InfNfse', 'DataEmissao']
        ]) || pickFirst(
          infNFSe.dhProc,
          infNFSe.dhEmi,
          infNFSe.dCompet,
          infNFSe.DataEmissao
        )
      );

      const fornecedor = extractFirst(parsed, [
        ['NFSe', 'infNFSe', 'emit', 'xNome'],
        ['Nfse', 'infNFSe', 'emit', 'xNome'],
        ['CompNfse', 'Nfse', 'InfNfse', 'PrestadorServico', 'RazaoSocial'],
        ['CompNfse', 'Nfse', 'infNfse', 'PrestadorServico', 'RazaoSocial'],
        ['GerarNfseResposta', 'ListaNfse', 'CompNfse', 'Nfse', 'InfNfse', 'PrestadorServico', 'RazaoSocial']
      ]) || pickFirst(
        emit.xNome,
        emit.nome,
        emit.RazaoSocial,
        prestadorServico.RazaoSocial,
        prestadorServico.razaoSocial
      );

      const cnpjCpf = extractFirst(parsed, [
        ['NFSe', 'infNFSe', 'emit', 'CNPJ'],
        ['NFSe', 'infNFSe', 'emit', 'CPF'],
        ['Nfse', 'infNFSe', 'emit', 'CNPJ'],
        ['Nfse', 'infNFSe', 'emit', 'CPF'],
        ['CompNfse', 'Nfse', 'InfNfse', 'PrestadorServico', 'IdentificacaoPrestador', 'Cnpj'],
        ['CompNfse', 'Nfse', 'InfNfse', 'PrestadorServico', 'IdentificacaoPrestador', 'Cpf'],
        ['CompNfse', 'Nfse', 'infNfse', 'PrestadorServico', 'IdentificacaoPrestador', 'Cnpj'],
        ['CompNfse', 'Nfse', 'infNfse', 'PrestadorServico', 'IdentificacaoPrestador', 'Cpf'],
        ['GerarNfseResposta', 'ListaNfse', 'CompNfse', 'Nfse', 'InfNfse', 'PrestadorServico', 'IdentificacaoPrestador', 'Cnpj'],
        ['GerarNfseResposta', 'ListaNfse', 'CompNfse', 'Nfse', 'InfNfse', 'PrestadorServico', 'IdentificacaoPrestador', 'Cpf']
      ]) || pickFirst(
        emit.CNPJ,
        emit.CPF,
        identificacaoPrestador.Cnpj,
        identificacaoPrestador.CPF,
        identificacaoPrestador.CnpjCpf
      );

      const valor = toNumberString(
        extractFirst(parsed, [
          ['NFSe', 'infNFSe', 'valores', 'vLiq'],
          ['NFSe', 'infNFSe', 'valores', 'vBC'],
          ['Nfse', 'infNFSe', 'valores', 'vLiq'],
          ['Nfse', 'infNFSe', 'valores', 'vBC'],
          ['CompNfse', 'Nfse', 'InfNfse', 'Servico', 'Valores', 'ValorServicos'],
          ['CompNfse', 'Nfse', 'infNfse', 'Servico', 'Valores', 'ValorServicos'],
          ['GerarNfseResposta', 'ListaNfse', 'CompNfse', 'Nfse', 'InfNfse', 'Servico', 'Valores', 'ValorServicos']
        ]) || pickFirst(
          valores.vLiq,
          valores.vBC,
          valores.ValorServicos,
          valores.ValorLiquidoNfse,
          valores.ValorLiquido,
          infNFSe.valor,
          infNFSe.ValorServicos
        )
      );

      if (fornecedor || cnpjCpf || valor || dataDocumento || numeroDocumento) {
        return {
          origem_layout: 'NFS-e NFSe nacional',
          status: 'Lido automaticamente',
          tipo_documento: 'NFS-e',
          numero_documento: numeroDocumento,
          data_documento: dataDocumento,
          fornecedor,
          cnpj_cpf: cnpjCpf,
          valor,
          erro_leitura: null
        };
      }
    } catch (error) {
      // segue para próximas tentativas
    }
  }

  // ===== NF-e padrão =====
  try {
    const parser = new xml2js.Parser({
      explicitArray: false,
      trim: true,
      normalizeTags: false
    });

    const parsedOriginal = await parser.parseStringPromise(xmlContent);
    const parsed = removeNamespaces(parsedOriginal);

    const nfe =
      getDeep(parsed, ['nfeProc', 'NFe', 'infNFe']) ||
      getDeep(parsed, ['NFe', 'infNFe']) ||
      getDeep(parsed, ['procNFe', 'NFe', 'infNFe']) ||
      getDeep(parsed, ['enviNFe', 'NFe', 'infNFe']) ||
      null;

    if (nfe) {
      const emit = nfe.emit || {};
      const ide = nfe.ide || {};
      const total = getDeep(nfe, ['total', 'ICMSTot']) || {};

      return {
        origem_layout: 'NF-e padrão',
        status: 'Lido automaticamente',
        tipo_documento: 'NF-e',
        numero_documento: pickFirst(ide.nNF, ide.cNF, ide.serie),
        data_documento: normalizeDate(pickFirst(ide.dhEmi, ide.dEmi, ide.dhSaiEnt, ide.dSaiEnt)),
        fornecedor: pickFirst(emit.xNome, emit.xFant),
        cnpj_cpf: pickFirst(emit.CNPJ, emit.CPF),
        valor: toNumberString(pickFirst(total.vNF, total.vProd, total.vLiq)),
        erro_leitura: null
      };
    }
  } catch (error) {
    // segue para fallback
  }

  return {
    origem_layout: 'Nao identificado',
    status: 'Nao reconhecido',
    tipo_documento: '',
    numero_documento: '',
    data_documento: '',
    fornecedor: '',
    cnpj_cpf: '',
    valor: '',
    erro_leitura: 'Layout de XML ainda não reconhecido automaticamente.'
  };
}

async function getCategoriasOptions(selectedValue = '') {
  const categorias = await pool.query('SELECT * FROM categorias ORDER BY nome ASC');
  let options = '<option value="">Selecione a categoria</option>';
  categorias.rows.forEach(cat => {
    const selected = String(selectedValue) === String(cat.id) ? 'selected' : '';
    options += `<option value="${cat.id}" ${selected}>${cat.nome}</option>`;
  });
  return options;
}

function escapeHtmlGlobal(text = '') {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


function renderPremiumAdminShell(req, config = {}, innerHtml = '') {
  const usuario = req?.session?.usuario || {};
  const nome = escapeHtmlGlobal(usuario.nome || usuario.email || 'Usuário');
  const perfil = escapeHtmlGlobal(usuario.perfil || '');
  const paginaAtual = String(config.paginaAtual || '');
  const titulo = escapeHtmlGlobal(config.titulo || 'PlennaTec');
  const subtitulo = escapeHtmlGlobal(config.subtitulo || 'Gestão inteligente de despesas.');
  const navItems = [
    { key:'dashboard', href:'/dashboard', label:'⌂ Dashboard' },
    { key:'rotina-despesas', href:'/rotina-despesas', label:'▦ Contas a Pagar' },
    { key:'lancamentos', href:'/lancamentos', label:'▤ Comprovantes' },
    { key:'documentos', href:'/documentos', label:'▣ Arquivo' },
    { key:'categorias', href:'/categorias', label:'▫ Categorias' },
    { key:'espaco-contador', href:'/espaco-contador', label:'♧ Espaço do Contador' },
    ...(usuario.perfil === 'ADMIN' ? [{ key:'usuarios', href:'/usuarios', label:'◉ Usuários' }] : [])
  ];
  const nav = navItems.map(item => `<a class="${item.key === paginaAtual ? 'active' : ''}" href="${item.href}">${item.label}</a>`).join('');
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${titulo} - PlennaTec</title>
      <style>
/* ===== PLENNATEC PREMIUM SIDEBAR - CATEGORIAS E USUÁRIOS ===== */
body.plennatec-premium-admin-page{
  margin:0;
  min-height:100vh;
  font-family:Arial,Helvetica,sans-serif;
  color:#0f172a;
  background:
    radial-gradient(circle at 0% 0%, rgba(0,176,80,.42) 0%, rgba(178,232,199,.30) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226,235,245,.95) 0%, rgba(240,244,249,.72) 31%, transparent 56%),
    linear-gradient(135deg,#f7fbf8 0%,#f7f9fc 42%,#eef3f8 100%);
}
.plennatec-app-shell{
  width:100%;
  min-height:100vh;
  display:grid;
  grid-template-columns:290px minmax(0,1fr);
  gap:22px;
  padding:18px 22px 18px 12px;
}
.plennatec-sidebar{
  position:sticky;
  top:18px;
  height:calc(100vh - 36px);
  border-radius:0 26px 26px 0;
  padding:26px 24px;
  background:linear-gradient(180deg,#064e3b 0%,#005f3a 45%,#003f2c 100%);
  color:#fff;
  box-shadow:0 24px 70px rgba(6,78,59,.26);
  display:flex;
  flex-direction:column;
  overflow:hidden;
}
.plennatec-side-logo{
  width:100%;
  min-height:74px;
  border-radius:18px;
  background:#fff;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:12px 18px;
  margin-bottom:24px;
  box-shadow:0 14px 28px rgba(0,0,0,.12);
}
.plennatec-side-logo img{
  max-width:100%;
  max-height:52px;
  object-fit:contain;
}
.plennatec-side-nav{
  display:flex;
  flex-direction:column;
  gap:8px;
}
.plennatec-side-nav a{
  height:48px;
  border-radius:14px;
  display:flex;
  align-items:center;
  gap:12px;
  padding:0 18px;
  text-decoration:none;
  color:#eafff2!important;
  font-size:15px;
  font-weight:900;
  letter-spacing:-.1px;
  transition:.16s ease;
}
.plennatec-side-nav a:hover{
  background:rgba(255,255,255,.10);
  transform:translateX(2px);
}
.plennatec-side-nav a.active{
  background:linear-gradient(135deg,#12c767,#00a64c);
  color:#fff!important;
  box-shadow:0 14px 28px rgba(0,176,80,.30);
}
.plennatec-side-spacer{flex:1;}
.plennatec-side-card{
  border:1px solid rgba(255,255,255,.16);
  border-radius:18px;
  background:rgba(255,255,255,.08);
  padding:16px;
  margin-top:18px;
}
.plennatec-side-card strong{
  display:block;
  font-size:14px;
  margin-bottom:8px;
}
.plennatec-side-card span{
  display:block;
  font-size:12px;
  line-height:1.4;
  color:#d8fbe5;
}
.plennatec-side-user{
  border-top:1px solid rgba(255,255,255,.14);
  padding-top:18px;
  margin-top:20px;
  display:flex;
  align-items:center;
  gap:12px;
}
.plennatec-side-user img{
  width:42px;
  height:42px;
  border-radius:50%;
  background:#fff;
  padding:4px;
}
.plennatec-side-user strong{
  display:block;
  font-size:13px;
}
.plennatec-side-user span{
  display:block;
  font-size:11px;
  opacity:.82;
  font-weight:800;
}
.plennatec-main{
  min-width:0;
}
.plennatec-topbar{
  min-height:92px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:18px;
  background:rgba(255,255,255,.88);
  border:1px solid rgba(255,255,255,.72);
  border-radius:22px;
  box-shadow:0 18px 45px rgba(15,23,42,.08);
  backdrop-filter:blur(14px);
  padding:18px 24px;
  margin-bottom:14px;
}
.plennatec-title-wrap{
  display:flex;
  align-items:center;
  gap:16px;
}
.plennatec-title-icon{
  width:52px;
  height:52px;
  border-radius:50%;
  background:#fff;
  border:1px solid #e2e8f0;
  display:grid;
  place-items:center;
  box-shadow:0 10px 24px rgba(15,23,42,.08);
}
.plennatec-title-icon img{
  width:42px;
  height:42px;
  object-fit:contain;
}
.plennatec-title-wrap h1{
  margin:0 0 6px;
  font-size:clamp(25px,2.1vw,34px);
  line-height:1;
  letter-spacing:-.7px;
  color:#101828;
}
.plennatec-title-wrap p{
  margin:0;
  color:#52627a;
  font-size:13px;
  font-weight:800;
}
.plennatec-top-user{
  display:flex;
  align-items:center;
  gap:12px;
}
.plennatec-top-user-copy{
  text-align:right;
}
.plennatec-top-user-copy strong{
  display:block;
  color:#00a64c;
  font-size:14px;
}
.plennatec-top-user-copy span{
  display:block;
  color:#64748b;
  font-size:11px;
  font-weight:900;
  text-transform:uppercase;
}
.plennatec-top-avatar{
  width:52px;
  height:52px;
  border-radius:50%;
  background:#fff;
  border:1px solid #e2e8f0;
  display:grid;
  place-items:center;
  box-shadow:0 10px 24px rgba(15,23,42,.08);
}
.plennatec-top-avatar img{
  width:42px;
  height:42px;
  object-fit:contain;
}
.plennatec-logout{
  height:46px;
  padding:0 18px;
  border-radius:14px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  background:linear-gradient(180deg,#f8fafc,#eef2f7);
  color:#172033!important;
  text-decoration:none;
  border:1px solid #dde6ef;
  font-weight:950;
  box-shadow:0 10px 20px rgba(15,23,42,.06);
}
.plennatec-card,
.plennatec-main .container,
.plennatec-main .card{
  background:rgba(255,255,255,.88)!important;
  border:1px solid rgba(255,255,255,.72)!important;
  border-radius:22px!important;
  box-shadow:0 18px 45px rgba(15,23,42,.08)!important;
  backdrop-filter:blur(14px);
}
.plennatec-main .container{
  width:100%!important;
  max-width:none!important;
  margin:0!important;
  padding:0!important;
  background:transparent!important;
  border:0!important;
  box-shadow:none!important;
}
.plennatec-main .card{
  padding:22px!important;
}
.plennatec-main table{
  width:100%;
  border-collapse:separate!important;
  border-spacing:0!important;
  overflow:hidden;
  border-radius:16px;
  background:#fff;
  box-shadow:inset 0 0 0 1px #e2e8f0;
}
.plennatec-main th{
  background:#f8fafc!important;
  color:#172033!important;
  font-size:12px!important;
  text-transform:none!important;
  font-weight:950!important;
}
.plennatec-main td,
.plennatec-main th{
  border-bottom:1px solid #e7edf5!important;
  padding:12px 14px!important;
}
.plennatec-main button,
.plennatec-main .btn,
.plennatec-main a.btn,
.plennatec-main input[type="submit"]{
  border-radius:12px!important;
  font-weight:950!important;
}
.plennatec-main .btn-primary,
.plennatec-main .btn-success,
.plennatec-main button[type="submit"],
.plennatec-main input[type="submit"]{
  background:linear-gradient(135deg,#00B050,#009640)!important;
  color:#fff!important;
  border:0!important;
  box-shadow:0 12px 22px rgba(0,176,80,.18)!important;
}
.plennatec-main input,
.plennatec-main select{
  border:1px solid #dce3ec!important;
  border-radius:12px!important;
  min-height:40px;
}
@media(max-width:980px){
  .plennatec-app-shell{grid-template-columns:1fr;padding:12px;}
  .plennatec-sidebar{position:relative;height:auto;border-radius:24px;}
  .plennatec-side-nav{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));}
  .plennatec-topbar{flex-direction:column;align-items:flex-start;}
  .plennatec-top-user{width:100%;justify-content:space-between;}
}

/* ===== AJUSTE FINO CATEGORIAS/USUÁRIOS - PLENNATEC ===== */
body.plennatec-premium-admin-page{font-size:13px!important;}
.plennatec-app-shell{grid-template-columns:270px minmax(0,1fr)!important;gap:20px!important;padding:18px 22px 18px 10px!important;}
.plennatec-sidebar{padding:22px 20px!important;}
.plennatec-side-logo{min-height:74px!important;height:74px!important;padding:10px 14px!important;border-radius:18px!important;overflow:hidden!important;}
.plennatec-side-logo img{width:100%!important;height:100%!important;max-width:220px!important;max-height:52px!important;object-fit:contain!important;display:block!important;}
.plennatec-side-nav a{height:44px!important;border-radius:13px!important;padding:0 16px!important;font-size:13px!important;font-weight:900!important;gap:11px!important;}
.plennatec-side-card{padding:14px!important;}
.plennatec-side-card strong{font-size:13px!important;}
.plennatec-side-card span{font-size:11px!important;}
.plennatec-topbar{min-height:78px!important;padding:16px 22px!important;border-radius:22px!important;}
.plennatec-title-icon{width:48px!important;height:48px!important;}
.plennatec-title-icon img,.plennatec-top-avatar img{width:38px!important;height:38px!important;object-fit:contain!important;}
.plennatec-top-avatar{width:48px!important;height:48px!important;}
.plennatec-title-wrap h1{font-size:clamp(22px,1.75vw,30px)!important;margin-bottom:5px!important;}
.plennatec-title-wrap p{font-size:12px!important;}
.plennatec-logout{height:42px!important;padding:0 16px!important;font-size:13px!important;}
.plennatec-main .card,.plennatec-card{padding:18px!important;}
.plennatec-main h1{font-size:25px!important;line-height:1.05!important;margin:0 0 14px!important;}
.plennatec-main h2{font-size:20px!important;line-height:1.15!important;margin:0 0 14px!important;}
.plennatec-main h3{font-size:16px!important;}
.plennatec-main p,.plennatec-main label,.plennatec-main td{font-size:13px!important;}
.plennatec-main th{font-size:11.5px!important;}
.plennatec-main td,.plennatec-main th{padding:10px 12px!important;}
.plennatec-main input,.plennatec-main select{min-height:36px!important;height:36px!important;font-size:12px!important;padding:0 10px!important;}
.plennatec-main button,.plennatec-main .btn,.plennatec-main a.btn,.plennatec-main input[type="submit"]{height:36px!important;min-height:36px!important;padding:0 13px!important;font-size:12px!important;border-radius:11px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;text-decoration:none!important;}
.plennatec-main a[href*="/categorias/nova"],.plennatec-main a[href*="/nova-categoria"],.plennatec-main a[href="/categorias/novo"],.plennatec-main a[href="/categorias/nova"]{height:38px!important;padding:0 15px!important;border-radius:12px!important;background:linear-gradient(135deg,#00B050,#009640)!important;color:#fff!important;text-decoration:none!important;font-weight:950!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;box-shadow:0 12px 22px rgba(0,176,80,.18)!important;}
.plennatec-main a[href="/dashboard"],.plennatec-main a[href="/logout"]:not(.plennatec-logout){display:none!important;}
.plennatec-main a{font-size:13px!important;font-weight:850;}
.plennatec-main .admin-content-grid{display:grid!important;grid-template-columns:minmax(340px,.72fr) minmax(560px,1.5fr)!important;gap:16px!important;align-items:start!important;}
.plennatec-main .admin-content-grid .card{margin:0!important;}
.plennatec-main form{font-size:13px!important;}
.plennatec-main form br{display:none!important;}
.plennatec-main form label{margin-right:5px!important;}
.plennatec-main .usuarios-create-form{display:flex!important;flex-wrap:wrap!important;align-items:end!important;gap:8px!important;}
.plennatec-main .usuarios-create-form > *{margin-top:0!important;margin-bottom:0!important;}
.plennatec-main .usuarios-create-form input{width:145px!important;}
.plennatec-main .usuarios-create-form select{width:145px!important;}
@media(max-width:1180px){.plennatec-main .admin-content-grid{grid-template-columns:1fr!important;}}


/* ===== REFINO FINAL CATEGORIAS/USUÁRIOS - PLENNATEC ===== */
body.plennatec-premium-admin-page{
  font-size:12.5px!important;
  overflow-x:hidden!important;
}
.plennatec-app-shell{
  grid-template-columns:270px minmax(0,1fr)!important;
  gap:20px!important;
  padding:18px 22px 18px 10px!important;
}
.plennatec-side-logo{
  height:74px!important;
  min-height:74px!important;
  padding:10px 14px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  background:#fff!important;
}
.plennatec-side-logo img{
  width:100%!important;
  height:100%!important;
  max-width:225px!important;
  max-height:54px!important;
  object-fit:contain!important;
  object-position:center!important;
}
.plennatec-side-nav a{
  height:44px!important;
  font-size:13px!important;
}
.plennatec-topbar{
  min-height:76px!important;
  padding:15px 22px!important;
  margin-bottom:14px!important;
}
.plennatec-title-wrap h1{
  font-size:26px!important;
}
.plennatec-title-wrap p{
  font-size:12px!important;
}
.plennatec-main{
  min-width:0!important;
  overflow:hidden!important;
}
.plennatec-main .card{
  padding:18px!important;
  margin-bottom:14px!important;
}
.plennatec-main h1{
  font-size:24px!important;
  margin:0 0 14px!important;
  line-height:1.1!important;
}
.plennatec-main h2{
  font-size:20px!important;
  margin:0 0 14px!important;
  line-height:1.12!important;
}
.plennatec-main h3{
  font-size:16px!important;
}
.plennatec-main p,
.plennatec-main label,
.plennatec-main td{
  font-size:12.5px!important;
}
.plennatec-main th{
  font-size:11px!important;
  padding:9px 10px!important;
}
.plennatec-main td{
  padding:9px 10px!important;
}
.plennatec-main table{
  table-layout:auto!important;
  width:100%!important;
}
.plennatec-main input,
.plennatec-main select{
  height:34px!important;
  min-height:34px!important;
  font-size:12px!important;
  border-radius:11px!important;
}
.plennatec-main .btn,
.plennatec-main a.btn,
.plennatec-main button[type="submit"],
.plennatec-main input[type="submit"]{
  height:34px!important;
  min-height:34px!important;
  padding:0 12px!important;
  font-size:11.5px!important;
  border-radius:11px!important;
  line-height:1!important;
}

/* Categorias */
.plennatec-main a[href="/categorias/nova"],
.plennatec-main a[href="/categorias/novo"],
.plennatec-main a[href*="/categorias/nova"],
.plennatec-main a[href*="/categorias/novo"]{
  height:36px!important;
  padding:0 14px!important;
  border-radius:12px!important;
  background:linear-gradient(135deg,#00B050,#009640)!important;
  color:#fff!important;
  text-decoration:none!important;
  font-weight:950!important;
  display:inline-flex!important;
  align-items:center!important;
  justify-content:center!important;
  box-shadow:0 10px 20px rgba(0,176,80,.16)!important;
  margin:0 0 14px!important;
}

/* Usuários: dois módulos lado a lado, campos ordenados */
.plennatec-main .usuarios-page-grid{
  display:grid!important;
  grid-template-columns:minmax(330px,390px) minmax(620px,1fr)!important;
  gap:16px!important;
  align-items:start!important;
  width:100%!important;
}
.plennatec-main .usuarios-page-grid .card{
  margin:0!important;
}
.plennatec-main .usuarios-create-form{
  display:grid!important;
  grid-template-columns:1fr 1fr!important;
  gap:10px!important;
  align-items:end!important;
}
.plennatec-main .usuarios-create-form label{
  display:block!important;
  margin:0 0 4px!important;
  font-weight:900!important;
  font-size:11.5px!important;
}
.plennatec-main .usuarios-create-form input,
.plennatec-main .usuarios-create-form select{
  width:100%!important;
}
.plennatec-main .usuarios-create-form .form-help,
.plennatec-main .usuarios-create-form p{
  grid-column:1 / -1!important;
  font-size:11.5px!important;
  color:#475569!important;
  margin:0!important;
  line-height:1.25!important;
}
.plennatec-main .usuarios-create-form button,
.plennatec-main .usuarios-create-form input[type="submit"]{
  width:max-content!important;
  min-width:124px!important;
}

/* Ações: tudo na mesma linha e sem fundo verde no lixo */
.plennatec-main td:last-child,
.plennatec-main th:last-child{
  white-space:nowrap!important;
  text-align:center!important;
}
.plennatec-main .actions-inline,
.plennatec-main .acoes-inline,
.plennatec-main td:last-child{
  display:table-cell!important;
}
.plennatec-main td:last-child a,
.plennatec-main td:last-child button,
.plennatec-main td:last-child form{
  display:inline-flex!important;
  vertical-align:middle!important;
  margin:0 2px!important;
}
.plennatec-main td:last-child form{
  padding:0!important;
  background:transparent!important;
  border:0!important;
  box-shadow:none!important;
}
.plennatec-main td:last-child button,
.plennatec-main td:last-child input[type="submit"]{
  width:auto!important;
  min-width:0!important;
  height:auto!important;
  min-height:0!important;
  padding:0!important;
  border:0!important;
  background:transparent!important;
  box-shadow:none!important;
  color:inherit!important;
  font-size:15px!important;
  line-height:1!important;
}
.plennatec-main td:last-child a{
  background:transparent!important;
  box-shadow:none!important;
  border:0!important;
  padding:0!important;
  height:auto!important;
  min-height:0!important;
  color:inherit!important;
  text-decoration:none!important;
  font-size:15px!important;
}

/* Remove sobras de links antigos */
.plennatec-main .legacy-user-heading,
.plennatec-main .legacy-links,
.plennatec-main a[href="/dashboard"],
.plennatec-main a[href="/logout"]:not(.plennatec-logout){
  display:none!important;
}

@media(max-width:1220px){
  .plennatec-main .usuarios-page-grid{
    grid-template-columns:1fr!important;
  }
}


/* ===== CORREÇÃO DEFINITIVA CATEGORIAS E USUÁRIOS ===== */
.plennatec-sidebar{width:270px!important;max-width:270px!important;padding:20px 18px!important;}
.plennatec-side-logo{
  width:100%!important;
  height:70px!important;
  min-height:70px!important;
  max-height:70px!important;
  padding:12px 18px!important;
  background:#fff!important;
  border-radius:18px!important;
  overflow:hidden!important;
  box-sizing:border-box!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
}
.plennatec-side-logo img{
  display:block!important;
  width:auto!important;
  height:auto!important;
  max-width:205px!important;
  max-height:44px!important;
  object-fit:contain!important;
  object-position:center!important;
}
.plennatec-side-nav a{height:44px!important;font-size:13px!important;padding:0 16px!important;}
.plennatec-title-wrap h1{font-size:25px!important;}
.plennatec-title-wrap p{font-size:12px!important;}
.plennatec-main{min-width:0!important;overflow:hidden!important;}
.plennatec-main .hero-top{display:none!important;}
.plennatec-main .subtitle{font-size:12px!important;}
.plennatec-main .grid{
  display:grid!important;
  grid-template-columns:minmax(340px,380px) minmax(620px,1fr)!important;
  gap:16px!important;
  align-items:start!important;
  width:100%!important;
}
.plennatec-main .card{
  padding:18px!important;
  margin:0 0 14px!important;
  border-radius:20px!important;
}
.plennatec-main .card h2,
.plennatec-main h2{
  font-size:19px!important;
  margin:0 0 14px!important;
  line-height:1.15!important;
}
.plennatec-main h1{font-size:23px!important;margin:0 0 14px!important;}
.plennatec-main label{font-size:11.5px!important;font-weight:900!important;}
.plennatec-main p,.plennatec-main td{font-size:12.5px!important;}
.plennatec-main th{font-size:11px!important;padding:9px 10px!important;}
.plennatec-main td{padding:9px 10px!important;}
.plennatec-main input,.plennatec-main select{
  height:34px!important;
  min-height:34px!important;
  font-size:12px!important;
  border-radius:11px!important;
  padding:0 10px!important;
}
.plennatec-main table{width:100%!important;table-layout:auto!important;}
.plennatec-main a[href="/categorias/nova"],
.plennatec-main a[href="/categorias/novo"],
.plennatec-main a[href*="/categorias/nova"],
.plennatec-main a[href*="/categorias/novo"]{
  height:36px!important;
  padding:0 14px!important;
  border-radius:12px!important;
  background:linear-gradient(135deg,#00B050,#009640)!important;
  color:#fff!important;
  text-decoration:none!important;
  font-weight:950!important;
  display:inline-flex!important;
  align-items:center!important;
  justify-content:center!important;
  box-shadow:0 10px 20px rgba(0,176,80,.16)!important;
  margin:0 0 14px!important;
}
.plennatec-main a[href="/dashboard"],
.plennatec-main a[href="/logout"]:not(.plennatec-logout){display:none!important;}

/* Formulário de novo usuário ordenado */
.plennatec-main .grid .card:first-child form{
  display:grid!important;
  grid-template-columns:76px minmax(0,1fr)!important;
  gap:9px 10px!important;
  align-items:center!important;
}
.plennatec-main .grid .card:first-child form label{
  margin:0!important;
  line-height:1.1!important;
}
.plennatec-main .grid .card:first-child form input,
.plennatec-main .grid .card:first-child form select{
  width:100%!important;
}
.plennatec-main .grid .card:first-child form .hint{
  grid-column:2!important;
  margin:0!important;
  font-size:11.5px!important;
  line-height:1.25!important;
  color:#475569!important;
}
.plennatec-main .grid .card:first-child form button{
  grid-column:2!important;
  width:max-content!important;
  height:34px!important;
  min-height:34px!important;
  padding:0 13px!important;
  border-radius:11px!important;
  font-size:11.5px!important;
}

/* Ações: uma linha, sem fundo verde no lixinho */
.plennatec-main .col-acoes{width:100px!important;text-align:center!important;white-space:nowrap!important;}
.plennatec-main .acoes-user{
  display:inline-flex!important;
  align-items:center!important;
  justify-content:center!important;
  gap:8px!important;
  white-space:nowrap!important;
}
.plennatec-main .acoes-user a,
.plennatec-main .acoes-user form,
.plennatec-main .acoes-user button{
  display:inline-flex!important;
  align-items:center!important;
  justify-content:center!important;
  margin:0!important;
  padding:0!important;
  border:0!important;
  background:transparent!important;
  box-shadow:none!important;
  width:auto!important;
  height:auto!important;
  min-width:0!important;
  min-height:0!important;
  line-height:1!important;
  font-size:15px!important;
  color:inherit!important;
  text-decoration:none!important;
}
.plennatec-main .acoes-user form{
  background:transparent!important;
}
.plennatec-main .acoes-user button.btn-icon-danger{
  background:transparent!important;
  border:0!important;
  box-shadow:none!important;
  cursor:pointer!important;
}
@media(max-width:1220px){
  .plennatec-main .grid{grid-template-columns:1fr!important;}
}


/* ===== FIX SOBREPOSIÇÃO MENU + COMPACTAÇÃO FINAL ===== */
body.plennatec-premium-admin-page{
  overflow-x:hidden!important;
  font-size:11.5px!important;
}
.plennatec-app-shell{
  display:grid!important;
  grid-template-columns:300px minmax(0,1fr)!important;
  gap:24px!important;
  padding:18px 22px 18px 10px!important;
  align-items:start!important;
}
.plennatec-sidebar{
  position:sticky!important;
  top:18px!important;
  width:300px!important;
  max-width:300px!important;
  min-width:300px!important;
  height:calc(100vh - 36px)!important;
  flex:0 0 300px!important;
  z-index:2!important;
}
.plennatec-main{
  min-width:0!important;
  width:100%!important;
  max-width:100%!important;
  overflow:hidden!important;
  position:relative!important;
  z-index:1!important;
}
.plennatec-side-logo{
  width:100%!important;
  height:70px!important;
  min-height:70px!important;
  max-height:70px!important;
  padding:10px 16px!important;
  box-sizing:border-box!important;
}
.plennatec-side-logo img{
  max-width:212px!important;
  max-height:44px!important;
  width:auto!important;
  height:auto!important;
  object-fit:contain!important;
}
.plennatec-topbar{
  width:100%!important;
  max-width:100%!important;
  min-height:74px!important;
  padding:14px 20px!important;
  margin:0 0 14px 0!important;
}
.plennatec-title-wrap h1{font-size:23px!important;}
.plennatec-title-wrap p{font-size:11.5px!important;}
.plennatec-main .card{
  padding:16px!important;
  border-radius:18px!important;
}
.plennatec-main h1{font-size:21px!important;}
.plennatec-main h2{font-size:18px!important;}
.plennatec-main p,
.plennatec-main label,
.plennatec-main td{
  font-size:11.5px!important;
}
.plennatec-main th{
  font-size:10.5px!important;
  padding:7px 8px!important;
}
.plennatec-main td{
  padding:7px 8px!important;
}
.plennatec-main input,
.plennatec-main select{
  height:32px!important;
  min-height:32px!important;
  font-size:11.5px!important;
}
.plennatec-main .grid{
  width:100%!important;
  max-width:100%!important;
  display:grid!important;
  grid-template-columns:minmax(310px,360px) minmax(0,1fr)!important;
  gap:14px!important;
  align-items:start!important;
}
.plennatec-main .grid .card:first-child{
  max-width:360px!important;
}
.plennatec-main .grid .card:nth-child(2){
  min-width:0!important;
  overflow:hidden!important;
}
.plennatec-main table{
  width:100%!important;
  max-width:100%!important;
  table-layout:fixed!important;
}
.plennatec-main table th,
.plennatec-main table td{
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  white-space:nowrap!important;
}
.plennatec-main .grid .card:nth-child(2) table th:nth-child(1),
.plennatec-main .grid .card:nth-child(2) table td:nth-child(1){width:18%!important;}
.plennatec-main .grid .card:nth-child(2) table th:nth-child(2),
.plennatec-main .grid .card:nth-child(2) table td:nth-child(2){width:34%!important;}
.plennatec-main .grid .card:nth-child(2) table th:nth-child(3),
.plennatec-main .grid .card:nth-child(2) table td:nth-child(3){width:15%!important;}
.plennatec-main .grid .card:nth-child(2) table th:nth-child(4),
.plennatec-main .grid .card:nth-child(2) table td:nth-child(4){width:15%!important;}
.plennatec-main .grid .card:nth-child(2) table th:nth-child(5),
.plennatec-main .grid .card:nth-child(2) table td:nth-child(5){width:18%!important;}
.plennatec-main .col-acoes{
  width:auto!important;
  min-width:86px!important;
}
.plennatec-main .acoes-user{
  gap:6px!important;
}
.plennatec-main .acoes-user a,
.plennatec-main .acoes-user button{
  font-size:14px!important;
}
.plennatec-main a[href="/categorias/nova"],
.plennatec-main a[href="/categorias/novo"],
.plennatec-main a[href*="/categorias/nova"],
.plennatec-main a[href*="/categorias/novo"]{
  height:34px!important;
  font-size:11.5px!important;
  padding:0 13px!important;
}
@media(max-width:1220px){
  .plennatec-app-shell{
    grid-template-columns:1fr!important;
    padding:12px!important;
  }
  .plennatec-sidebar{
    position:relative!important;
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
    height:auto!important;
    border-radius:24px!important;
  }
  .plennatec-main .grid{
    grid-template-columns:1fr!important;
  }
}


/* ===== HARMONIA FINAL CATEGORIAS/USUÁRIOS - SEM ESTOURAR ===== */
html, body.plennatec-premium-admin-page{
  width:100%!important;
  max-width:100%!important;
  overflow-x:hidden!important;
}
body.plennatec-premium-admin-page{
  font-size:11.5px!important;
}
.plennatec-app-shell{
  width:100%!important;
  max-width:100vw!important;
  min-height:100vh!important;
  display:grid!important;
  grid-template-columns:300px minmax(0, 1fr)!important;
  gap:16px!important;
  padding:18px 14px 18px 8px!important;
  box-sizing:border-box!important;
  overflow:hidden!important;
}
.plennatec-sidebar{
  position:sticky!important;
  top:18px!important;
  width:300px!important;
  min-width:300px!important;
  max-width:300px!important;
  height:calc(100vh - 36px)!important;
  box-sizing:border-box!important;
  z-index:3!important;
}
.plennatec-main{
  width:100%!important;
  min-width:0!important;
  max-width:100%!important;
  box-sizing:border-box!important;
  overflow:hidden!important;
  padding:0!important;
  margin:0!important;
}
.plennatec-topbar{
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  box-sizing:border-box!important;
  overflow:hidden!important;
  display:flex!important;
  align-items:center!important;
  justify-content:space-between!important;
  gap:10px!important;
  min-height:72px!important;
  padding:13px 16px!important;
  margin:0 0 12px 0!important;
}
.plennatec-title-wrap{
  min-width:0!important;
  flex:1 1 auto!important;
}
.plennatec-title-wrap h1{
  font-size:22px!important;
  line-height:1.05!important;
}
.plennatec-title-wrap p{
  font-size:11px!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
}
.plennatec-top-user{
  flex:0 0 auto!important;
  min-width:190px!important;
}
.plennatec-logout{
  height:38px!important;
  padding:0 12px!important;
  font-size:12px!important;
}
.plennatec-top-avatar,
.plennatec-title-icon{
  width:42px!important;
  height:42px!important;
  flex:0 0 42px!important;
}
.plennatec-top-avatar img,
.plennatec-title-icon img{
  width:34px!important;
  height:34px!important;
}

/* Logo lateral dentro da caixa */
.plennatec-side-logo{
  width:100%!important;
  height:70px!important;
  min-height:70px!important;
  max-height:70px!important;
  padding:10px 15px!important;
  box-sizing:border-box!important;
  background:#fff!important;
  border-radius:18px!important;
  overflow:hidden!important;
}
.plennatec-side-logo img{
  width:auto!important;
  height:auto!important;
  max-width:210px!important;
  max-height:44px!important;
  object-fit:contain!important;
  object-position:center!important;
}

/* Conteúdo */
.plennatec-main .container,
.plennatec-main .card,
.plennatec-main section{
  max-width:100%!important;
  box-sizing:border-box!important;
}
.plennatec-main .card{
  padding:14px!important;
  border-radius:18px!important;
  margin:0 0 12px 0!important;
}
.plennatec-main h1{font-size:20px!important;margin:0 0 12px!important;}
.plennatec-main h2{font-size:17px!important;margin:0 0 12px!important;line-height:1.1!important;}
.plennatec-main h3{font-size:14px!important;}
.plennatec-main p,
.plennatec-main label,
.plennatec-main td,
.plennatec-main a,
.plennatec-main button,
.plennatec-main input,
.plennatec-main select{
  font-size:11px!important;
}
.plennatec-main th{
  font-size:10px!important;
  padding:6px 7px!important;
}
.plennatec-main td{
  font-size:11px!important;
  padding:6px 7px!important;
}
.plennatec-main input,
.plennatec-main select{
  height:30px!important;
  min-height:30px!important;
  border-radius:10px!important;
}

/* Grid usuários: nunca invadir menu e caber na tela */
.plennatec-main .grid{
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  display:grid!important;
  grid-template-columns:minmax(290px,340px) minmax(0,1fr)!important;
  gap:12px!important;
  align-items:start!important;
  box-sizing:border-box!important;
}
.plennatec-main .grid > *{
  min-width:0!important;
  max-width:100%!important;
}
.plennatec-main .grid .card:first-child{
  width:100%!important;
  max-width:340px!important;
}
.plennatec-main .grid .card:nth-child(2){
  width:100%!important;
  max-width:100%!important;
  overflow:hidden!important;
}

/* Formulário usuário mais compacto */
.plennatec-main .grid .card:first-child form{
  display:grid!important;
  grid-template-columns:72px minmax(0,1fr)!important;
  gap:7px 8px!important;
  align-items:center!important;
}
.plennatec-main .grid .card:first-child form label{
  margin:0!important;
  line-height:1.05!important;
}
.plennatec-main .grid .card:first-child form input,
.plennatec-main .grid .card:first-child form select{
  width:100%!important;
}
.plennatec-main .grid .card:first-child form .hint{
  grid-column:2!important;
  margin:0!important;
  font-size:10.5px!important;
  line-height:1.18!important;
}
.plennatec-main .grid .card:first-child form button{
  grid-column:2!important;
  width:max-content!important;
  height:31px!important;
  min-height:31px!important;
  padding:0 11px!important;
  border-radius:10px!important;
  font-size:10.5px!important;
}

/* Tabelas: compactas e sem estourar */
.plennatec-main table{
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  table-layout:fixed!important;
  border-collapse:separate!important;
}
.plennatec-main th,
.plennatec-main td{
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  white-space:nowrap!important;
}

/* Usuários cadastrados */
.plennatec-main .grid .card:nth-child(2) table th:nth-child(1),
.plennatec-main .grid .card:nth-child(2) table td:nth-child(1){width:18%!important;}
.plennatec-main .grid .card:nth-child(2) table th:nth-child(2),
.plennatec-main .grid .card:nth-child(2) table td:nth-child(2){width:33%!important;}
.plennatec-main .grid .card:nth-child(2) table th:nth-child(3),
.plennatec-main .grid .card:nth-child(2) table td:nth-child(3){width:15%!important;}
.plennatec-main .grid .card:nth-child(2) table th:nth-child(4),
.plennatec-main .grid .card:nth-child(2) table td:nth-child(4){width:14%!important;}
.plennatec-main .grid .card:nth-child(2) table th:nth-child(5),
.plennatec-main .grid .card:nth-child(2) table td:nth-child(5){width:20%!important;text-align:center!important;}

/* Categorias: ocupa a área útil sem empurrar sair */
.plennatec-main section,
.plennatec-main .container{
  width:100%!important;
  min-width:0!important;
  overflow:hidden!important;
}
.plennatec-main section > table,
.plennatec-main .card > table{
  width:100%!important;
}
.plennatec-main table th:last-child,
.plennatec-main table td:last-child{
  width:86px!important;
  text-align:center!important;
}
.plennatec-main td:last-child a,
.plennatec-main td:last-child button,
.plennatec-main td:last-child form{
  display:inline-flex!important;
  margin:0 2px!important;
  padding:0!important;
  background:transparent!important;
  box-shadow:none!important;
  border:0!important;
  width:auto!important;
  height:auto!important;
  min-height:0!important;
  min-width:0!important;
  font-size:13px!important;
  line-height:1!important;
  color:inherit!important;
  text-decoration:none!important;
}
.plennatec-main .acoes-user{
  display:inline-flex!important;
  align-items:center!important;
  gap:5px!important;
  white-space:nowrap!important;
}
.plennatec-main .acoes-user a,
.plennatec-main .acoes-user button,
.plennatec-main .acoes-user form{
  display:inline-flex!important;
  align-items:center!important;
  justify-content:center!important;
  margin:0!important;
  padding:0!important;
  border:0!important;
  background:transparent!important;
  box-shadow:none!important;
  height:auto!important;
  min-height:0!important;
  width:auto!important;
  min-width:0!important;
  color:inherit!important;
  text-decoration:none!important;
  font-size:13px!important;
  line-height:1!important;
}
.plennatec-main a[href="/categorias/nova"],
.plennatec-main a[href="/categorias/novo"],
.plennatec-main a[href*="/categorias/nova"],
.plennatec-main a[href*="/categorias/novo"]{
  height:32px!important;
  padding:0 12px!important;
  border-radius:10px!important;
  font-size:10.5px!important;
}

/* remove resquícios */
.plennatec-main .hero-top,
.plennatec-main a[href="/dashboard"],
.plennatec-main a[href="/logout"]:not(.plennatec-logout){
  display:none!important;
}

@media(max-width:1100px){
  .plennatec-app-shell{
    grid-template-columns:1fr!important;
    padding:12px!important;
  }
  .plennatec-sidebar{
    position:relative!important;
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
    height:auto!important;
    border-radius:24px!important;
  }
  .plennatec-main .grid{
    grid-template-columns:1fr!important;
  }
}


/* ===== AJUSTE FINAL ANOTAÇÕES - CATEGORIAS/USUÁRIOS ===== */

/* 1) Alinha o topo do menu lateral com o topo do cabeçalho */
.plennatec-app-shell{
  align-items:start!important;
  padding-top:18px!important;
}
.plennatec-sidebar{
  margin-top:0!important;
  top:18px!important;
  align-self:start!important;
}
.plennatec-topbar{
  margin-top:0!important;
}

/* 2) Evita qualquer avanço do conteúdo para cima/por baixo do menu */
.plennatec-main{
  padding-top:0!important;
}
.plennatec-main > *:first-child{
  margin-top:0!important;
}

/* 3) Usuários: mais respiro entre formulário e tabela e sem campo estourando */
.plennatec-main .grid{
  grid-template-columns:minmax(300px,350px) minmax(0,1fr)!important;
  gap:18px!important;
}
.plennatec-main .grid .card:first-child{
  max-width:350px!important;
  overflow:hidden!important;
}
.plennatec-main .grid .card:first-child form{
  grid-template-columns:68px minmax(0,1fr)!important;
  gap:7px 8px!important;
}
.plennatec-main .grid .card:first-child form input,
.plennatec-main .grid .card:first-child form select{
  width:100%!important;
  max-width:100%!important;
  box-sizing:border-box!important;
}
.plennatec-main .grid .card:first-child form .hint{
  max-width:100%!important;
  overflow-wrap:break-word!important;
}

/* 4) Tabela de usuários: reduz Perfil/Data/Ações para dar mais equilíbrio */
.plennatec-main .grid .card:nth-child(2) table{
  table-layout:fixed!important;
}
.plennatec-main .grid .card:nth-child(2) table th:nth-child(1),
.plennatec-main .grid .card:nth-child(2) table td:nth-child(1){width:20%!important;}
.plennatec-main .grid .card:nth-child(2) table th:nth-child(2),
.plennatec-main .grid .card:nth-child(2) table td:nth-child(2){width:38%!important;}
.plennatec-main .grid .card:nth-child(2) table th:nth-child(3),
.plennatec-main .grid .card:nth-child(2) table td:nth-child(3){width:12%!important;}
.plennatec-main .grid .card:nth-child(2) table th:nth-child(4),
.plennatec-main .grid .card:nth-child(2) table td:nth-child(4){width:12%!important;}
.plennatec-main .grid .card:nth-child(2) table th:nth-child(5),
.plennatec-main .grid .card:nth-child(2) table td:nth-child(5){width:18%!important;text-align:center!important;}
.plennatec-main .grid .card:nth-child(2) table td,
.plennatec-main .grid .card:nth-child(2) table th{
  font-size:10.5px!important;
  padding:6px 6px!important;
}

/* 5) Categorias: tabela dentro do espaço útil, com ações enxutas */
.plennatec-main .card > table,
.plennatec-main section > table{
  width:100%!important;
  max-width:100%!important;
  table-layout:fixed!important;
}
.plennatec-main .card > table th:nth-child(1),
.plennatec-main .card > table td:nth-child(1){width:7%!important;}
.plennatec-main .card > table th:nth-child(2),
.plennatec-main .card > table td:nth-child(2){width:38%!important;}
.plennatec-main .card > table th:nth-child(3),
.plennatec-main .card > table td:nth-child(3){width:20%!important;}
.plennatec-main .card > table th:nth-child(4),
.plennatec-main .card > table td:nth-child(4){width:25%!important;}
.plennatec-main .card > table th:nth-child(5),
.plennatec-main .card > table td:nth-child(5){width:10%!important;text-align:center!important;}

/* 6) Botão sair sempre visível */
.plennatec-top-user{
  min-width:170px!important;
  max-width:220px!important;
}
.plennatec-logout{
  flex:0 0 auto!important;
}

/* 7) Texto geral ainda mais harmonizado */
.plennatec-main td,
.plennatec-main th,
.plennatec-main label,
.plennatec-main input,
.plennatec-main select{
  line-height:1.15!important;
}

</style>
    </head>
    <body class="plennatec-premium-admin-page">
      <div class="plennatec-app-shell">
        <aside class="plennatec-sidebar">
          <div class="plennatec-side-logo">
            <img src="/assets/logo-plennatec-login.png" onerror="this.src='/assets/plennatec.png'" alt="PlennaTec">
          </div>
          <nav class="plennatec-side-nav">${nav}</nav>
          <div class="plennatec-side-spacer"></div>
          <div class="plennatec-side-card">
            <strong>Gestão Premium</strong>
            <span>Controle operacional com padrão visual unificado e foco em produtividade.</span>
          </div>
          <div class="plennatec-side-user">
            <img src="/assets/logo-plennatec-perfil.png" onerror="this.src='/assets/plennatec.png'" alt="Perfil">
            <div><strong>${nome}</strong><span>${perfil}</span></div>
          </div>
        </aside>
        <main class="plennatec-main">
          <header class="plennatec-topbar">
            <div class="plennatec-title-wrap">
              <div class="plennatec-title-icon">
                <img src="/assets/logo-plennatec-perfil.png" onerror="this.src='/assets/plennatec.png'" alt="PlennaTec">
              </div>
              <div><h1>${titulo}</h1><p>${subtitulo}</p></div>
            </div>
            <div class="plennatec-top-user">
              <div class="plennatec-top-user-copy"><strong>${nome}</strong><span>${perfil}</span></div>
              <div class="plennatec-top-avatar"><img src="/assets/logo-plennatec-perfil.png" onerror="this.src='/assets/plennatec.png'" alt="Perfil"></div>
              <a class="plennatec-logout" href="/logout">Sair</a>
            </div>
          </header>
          ${innerHtml}
        </main>
      </div>
    </body>
    </html>
  `;
}

function renderGlobalHeader(req, config = {}) {
  const usuario = req?.session?.usuario || {};
  const usuarioNome = escapeHtmlGlobal(usuario.nome || usuario.email || 'Usuário');
  const usuarioPerfil = escapeHtmlGlobal(usuario.perfil || '');
  const paginaAtual = String(config.paginaAtual || '');
  const titulo = escapeHtmlGlobal(config.titulo || 'Painel Fiscal - PlennaTec');
  const subtitulo = escapeHtmlGlobal(config.subtitulo || 'Gestão fiscal e contábil da PlennaTec.');
  const isAdmin = usuario.perfil === 'ADMIN';
  const paginasSemNovoLancamento = ['usuarios', 'categorias', 'documentos', 'espaco-contador'];
  const ocultarNovoLancamento = paginasSemNovoLancamento.includes(paginaAtual);
  const menuBase = [
    ...(!ocultarNovoLancamento ? [{ key: 'novo', href: config.primaryHref || '/novo', label: config.primaryLabel || '+ Novo lançamento', primary: true }] : []),
    { key: 'dashboard', href: '/dashboard', label: 'Voltar para o Painel', primary: ocultarNovoLancamento },
    { key: 'rotina-despesas', href: '/rotina-despesas', label: 'Contas à Pagar' },
    { key: 'lancamentos', href: '/lancamentos', label: 'Comprovantes Fiscais' },
    { key: 'documentos', href: '/documentos', label: 'Arquivo' },
    { key: 'categorias', href: '/categorias', label: 'Categorias' },
    { key: 'espaco-contador', href: '/espaco-contador', label: 'Espaço do Contador' },
    ...(isAdmin ? [{ key: 'usuarios', href: '/usuarios', label: 'Usuários' }] : [])
  ];
  const menuHtml = menuBase
    .filter(item => item.key !== paginaAtual)
    .map(item => `<a class="dm-menu-btn ${item.primary ? 'dm-menu-primary' : ''}" href="${item.href}">${escapeHtmlGlobal(item.label)}</a>`)
    .join('');
  const extraActionsHtml = String(config.extraActions || '').trim();
  return `
    <style>
      .dm-global-header-shell{width:min(1560px,calc(100% - 48px));margin:18px auto 14px;font-family:Arial,Helvetica,sans-serif;color:#172033;}
      .dm-global-top{display:flex;align-items:center;justify-content:space-between;gap:18px;background:rgba(255,255,255,.88);border:1px solid rgba(255,255,255,.72);border-radius:22px;box-shadow:0 18px 45px rgba(15,23,42,.08);backdrop-filter:blur(14px);padding:16px 24px;}
      .dm-global-brand{display:flex;align-items:center;gap:14px;min-width:0;}
      .dm-global-logo{width:54px;height:54px;border-radius:999px;object-fit:contain;background:#fff;border:1px solid #e2e8f0;padding:4px;box-shadow:0 8px 22px rgba(15,23,42,.08);}
      .dm-global-title h1{margin:0 0 5px;font-size:clamp(22px,1.8vw,32px);line-height:1;letter-spacing:-.7px;color:#101828;}
      .dm-global-title p{margin:0;color:#52627a;font-size:13px;font-weight:700;}
      .dm-global-user{display:flex;align-items:center;gap:12px;flex-shrink:0;}
      .dm-global-user-copy{text-align:right;line-height:1.15;}
      .dm-global-user-copy strong{display:block;font-size:14px;color:#00B050;margin-bottom:4px;}
      .dm-global-user-copy span{display:block;font-size:11px;color:#64748b;font-weight:800;text-transform:uppercase;}
      .dm-global-avatar{position:relative;width:50px;height:50px;border-radius:999px;background:#fff;border:1px solid #e2e8f0;display:grid;place-items:center;box-shadow:0 8px 22px rgba(15,23,42,.08);overflow:hidden;}
      .dm-global-avatar img{width:42px;height:42px;object-fit:contain;border-radius:50%;}
      .dm-global-online{position:absolute;right:3px;bottom:5px;width:12px;height:12px;border-radius:50%;background:#22c55e;border:3px solid #fff;}
      .dm-global-logout{height:44px;padding:0 16px;border-radius:12px;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#f8fafc,#eef2f7);color:#222b3b !important;border:1px solid #e0e6ef;font-weight:900;box-shadow:0 10px 20px rgba(15,23,42,.06);white-space:nowrap;}
      .dm-global-nav{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:rgba(255,255,255,.82);border:1px solid rgba(255,255,255,.72);border-radius:18px;box-shadow:0 18px 45px rgba(15,23,42,.08);backdrop-filter:blur(14px);padding:10px 14px;margin-top:12px;}
      .dm-menu-btn,.dm-global-nav button{height:40px;padding:0 14px;border-radius:11px;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;background:linear-gradient(180deg,#f8fafc,#eef2f7);color:#009640 !important;border:1px solid #d7eadf;box-shadow:0 8px 18px rgba(15,23,42,.05);white-space:nowrap;cursor:pointer;}
      .dm-menu-primary{background:linear-gradient(135deg,#00B050,#009640) !important;color:#fff !important;border-color:rgba(0,176,80,.88) !important;box-shadow:0 12px 22px rgba(0,176,80,.18) !important;}
      .dm-menu-extra-form{display:inline-flex !important;align-items:center !important;margin:0 !important;padding:0 !important;background:transparent !important;border:0 !important;box-shadow:none !important;}
      .dm-menu-extra-separator{width:1px;height:26px;background:#dbe7df;margin:0 2px;}
      .dm-menu-btn:hover,.dm-global-logout:hover{transform:translateY(-1px);filter:brightness(1.03);}
      body.dm-global-page .container{margin-top:14px !important;}
      body.dm-global-page .container > .card > h1:first-child{display:none !important;}
      body.dm-global-page .container > .hero > .hero-top:first-child{display:none !important;}
      @media(max-width:900px){.dm-global-header-shell{width:min(100% - 24px,900px);}.dm-global-top{align-items:flex-start;flex-direction:column;}.dm-global-user{width:100%;justify-content:space-between;}.dm-global-user-copy{text-align:left;}.dm-global-nav{overflow-x:auto;flex-wrap:nowrap;}.dm-menu-btn{flex:0 0 auto;}}
    

/* ===== AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */
/* Comprovantes Fiscais: filtros compactos para caberem em uma única linha em telas largas */
body.dm-global-page form[action="/lancamentos"] .filters {
  display: grid !important;
  grid-template-columns: 1.05fr 1.05fr 1.05fr 1.05fr 1.05fr 1fr .92fr .92fr auto !important;
  align-items: end !important;
  gap: 8px !important;
  padding: 12px 14px !important;
}

body.dm-global-page form[action="/lancamentos"] .filters > div {
  min-width: 0 !important;
}

body.dm-global-page form[action="/lancamentos"] .filters label {
  display: block !important;
  margin: 0 0 5px !important;
  font-size: 10px !important;
  line-height: 1.05 !important;
  font-weight: 900 !important;
  white-space: nowrap !important;
}

body.dm-global-page form[action="/lancamentos"] .filters input,
body.dm-global-page form[action="/lancamentos"] .filters select {
  width: 100% !important;
  min-width: 0 !important;
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 10px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons {
  display: inline-flex !important;
  align-items: end !important;
  justify-content: flex-start !important;
  gap: 7px !important;
  min-width: 142px !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons button,
body.dm-global-page form[action="/lancamentos"] .filter-buttons a {
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 13px !important;
  font-size: 11px !important;
  border-radius: 11px !important;
}

@media (max-width: 1280px) {
  body.dm-global-page form[action="/lancamentos"] .filters {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

/* Espaço do Contador: conteúdo interno da coluna Enviar Arquivo alinhado à esquerda */
.contador-premium-page .contador-table th:nth-child(4) {
  text-align: center !important;
}

.contador-premium-page .contador-table td:nth-child(4) {
  text-align: left !important;
  padding-left: 10px !important;
  padding-right: 8px !important;
}

.contador-premium-page .upload-cell-compact {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  flex-wrap: nowrap !important;
  max-width: 100% !important;
  margin-left: 0 !important;
}

.contador-premium-page .btn-upload-open {
  width: auto !important;
  min-width: 112px !important;
  height: 30px !important;
  min-height: 30px !important;
  padding: 0 12px !important;
  font-size: 10.8px !important;
  line-height: 1 !important;
  border-radius: 11px !important;
}

.contador-premium-page .upload-cell-compact .clip-indicator,
.contador-premium-page .upload-cell-compact .empty-inline,
.contador-premium-page .upload-cell-compact .attached-badge,
.contador-premium-page .upload-cell-compact .attached-empty {
  flex: 0 0 auto !important;
}
/* ===== FIM AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */

</style>
    <header class="dm-global-header-shell">
      <div class="dm-global-top">
        <div class="dm-global-brand">
          <img class="dm-global-logo" src="/assets/logo-plennatec-perfil.png" onerror="this.style.display='none'" alt="PlennaTec" />
          <div class="dm-global-title"><h1>${titulo}</h1><p>${subtitulo}</p></div>
        </div>
        <div class="dm-global-user">
          <div class="dm-global-user-copy"><strong>${usuarioNome}</strong><span>${usuarioPerfil}</span></div>
          <div class="dm-global-avatar"><img src="/assets/logo-plennatec-perfil.png" onerror="this.src='/assets/plennatec.png'" alt="Perfil" /><span class="dm-global-online"></span></div>
          <a class="dm-global-logout" href="/logout">Sair</a>
        </div>
      </div>
      <nav class="dm-global-nav">${menuHtml}${extraActionsHtml ? `<span class="dm-menu-extra-separator"></span>${extraActionsHtml}` : ''}</nav>
    </header>`;
}


// Middleware visual: aplica shell premium nas telas Categorias e Usuários sem alterar regras de negócio.
router.use((req, res, next) => {
  const originalSend = res.send.bind(res);

  res.send = function patchedPremiumSend(body) {
    try {
      const pathOnly = String(req.path || '');
      const isPremiumTarget = req.method === 'GET' && (pathOnly === '/categorias' || pathOnly === '/usuarios');
      const html = typeof body === 'string' ? body : '';

      if (isPremiumTarget && html.includes('<html') && !html.includes('plennatec-premium-admin-page')) {
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        let inner = bodyMatch ? bodyMatch[1] : html;

        // Remove apenas navegação/cabeçalho antigo. Não reorganiza cards para não quebrar a estrutura.
        inner = inner
          .replace(/<header class="dm-global-header-shell"[\s\S]*?<\/header>/ig, '')
          .replace(/<nav class="dm-global-nav"[\s\S]*?<\/nav>/ig, '')
          .replace(/<div class="hero-top"[\s\S]*?<\/div>\s*<div class="grid">/i, '<div class="grid">')
          .replace(/<a[^>]+href=["']\/dashboard["'][^>]*>[\s\S]*?<\/a>/ig, '')
          .replace(/<a[^>]+href=["']\/logout["'][^>]*>[\s\S]*?<\/a>/ig, '')
          .replace(/<a[^>]*>[\s\S]*?Voltar[\s\S]*?<\/a>/ig, '')
          .replace(/<a[^>]*>[\s\S]*?Sair[\s\S]*?<\/a>/ig, '')
          .replace(/Controle de acesso do sistema PlannaTec\./ig, '');

        if (pathOnly === '/categorias') {
          inner = inner
            .replace(/<a([^>]+href=["']\/categorias\/nova["'][^>]*)>/ig, '<a class="btn btn-primary" $1>')
            .replace(/<a([^>]+href=["']\/categorias\/novo["'][^>]*)>/ig, '<a class="btn btn-primary" $1>');
        }

        const cfg = pathOnly === '/categorias'
          ? { paginaAtual: 'categorias', titulo: 'Categorias', subtitulo: 'Organize e gerencie as categorias financeiras.' }
          : { paginaAtual: 'usuarios', titulo: 'Usuários', subtitulo: 'Gerencie acessos, perfis e permissões do sistema.' };

        return originalSend(renderPremiumAdminShell(req, cfg, inner));
      }
    } catch (error) {}

    return originalSend(body);
  };

  next();
});



function renderDashboard(data) {
  const {
    totalLancamentos = 0,
    valorTotal = 0,
    totalCategorias = 0,
    totalFornecedores = 0,
    meses = [],
    categorias = [],
    fornecedores = [],
    detalhesMeses = [],
    detalhesCategorias = [],
    detalhesFornecedores = [],
    mesSelecionado = '',
    usuario = {}
  } = data || {};

  const formatMoney = (valor) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(valor || 0));

  const escapeHtml = (text = '') =>
    String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const safeJson = (value) => JSON.stringify(value || []).replace(/</g, '\\u003c');
  const detalhesMesesJson = safeJson(detalhesMeses);
  const detalhesCategoriasJson = safeJson(detalhesCategorias);
  const detalhesFornecedoresJson = safeJson(detalhesFornecedores);

  const hoje = new Date();
  const opcoesMes = [];

  for (let i = 0; i < 12; i++) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const valor = `${ano}-${mes}`;
    const label = data.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric'
    });

    opcoesMes.push({
      valor,
      label: label.charAt(0).toUpperCase() + label.slice(1)
    });
  }

  const opcoesMesHtml = opcoesMes.map(item => `
    <option value="${item.valor}" ${mesSelecionado === item.valor ? 'selected' : ''}>
      ${escapeHtml(item.label)}
    </option>
  `).join('');

  const mesDashboardSelecionado = mesSelecionado || '';
  const mesDashboardAno = mesDashboardSelecionado && /^\d{4}-\d{2}$/.test(mesDashboardSelecionado)
    ? mesDashboardSelecionado.slice(0, 4)
    : String(new Date().getFullYear());
  const mesDashboardNumero = mesDashboardSelecionado && /^\d{4}-\d{2}$/.test(mesDashboardSelecionado)
    ? mesDashboardSelecionado.slice(5, 7)
    : String(new Date().getMonth() + 1).padStart(2, '0');
  const mesDashboardLabel = mesDashboardSelecionado
    ? formatMesAnoCurto(mesDashboardSelecionado)
    : 'Todos os meses';

  const subtituloFiltro = mesSelecionado
    ? `Dados filtrados para o mês ${escapeHtml(
        formatMesAnoCurto(mesSelecionado)
      )}.`
    : 'Visão executiva geral das despesas, lançamentos e distribuição financeira.';

  const maxMes = Math.max(...meses.map(m => Number(m.total || 0)), 1);
  const yTicks = [maxMes, maxMes * 0.75, maxMes * 0.5, maxMes * 0.25, 0];
  const chartW = 520;
  const chartH = 245;
  const plotLeft = 70;
  const plotRight = 28;
  const plotTop = 22;
  const plotBottom = 42;
  const plotW = chartW - plotLeft - plotRight;
  const plotH = chartH - plotTop - plotBottom;

  const points = meses.map((item, index) => {
    const x = plotLeft + (meses.length <= 1 ? 0 : (index * plotW) / (meses.length - 1));
    const y = plotTop + plotH - ((Number(item.total || 0) / maxMes) * plotH);
    return { x, y, item, total: Number(item.total || 0) };
  });

  const svgPoints = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPoints = points.length
    ? `${points[0].x.toFixed(1)},${plotTop + plotH} ${svgPoints} ${points[points.length - 1].x.toFixed(1)},${plotTop + plotH}`
    : '';

  const gridHtml = yTicks.map(value => {
    const y = plotTop + plotH - ((Number(value || 0) / maxMes) * plotH);
    return `
      <line x1="${plotLeft}" y1="${y.toFixed(1)}" x2="${chartW - plotRight}" y2="${y.toFixed(1)}" class="grid-line" />
      <text x="8" y="${(y + 4).toFixed(1)}" class="axis-label">${formatMoney(value).replace(',00', '')}</text>
    `;
  }).join('');

  const pointsHtml = points.map(p => `
    <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" class="line-dot" />
    <text x="${p.x.toFixed(1)}" y="${Math.max(14, p.y - 14).toFixed(1)}" text-anchor="middle" class="point-value">${formatMoney(p.total)}</text>
  `).join('');

  const xLabelsHtml = points.map(p => `
    <text x="${p.x.toFixed(1)}" y="${chartH - 10}" text-anchor="middle" class="month-label">${escapeHtml(p.item.label)}</text>
  `).join('');

  const mesesHtml = meses.length
    ? `
      <svg class="line-chart" viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="none" aria-label="Despesas por mês">
        <defs>
          <linearGradient id="areaOrange" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#00B050" stop-opacity="0.38" />
            <stop offset="100%" stop-color="#00B050" stop-opacity="0.02" />
          </linearGradient>
        </defs>
        ${gridHtml}
        <line x1="${plotLeft}" y1="${plotTop}" x2="${plotLeft}" y2="${plotTop + plotH}" class="axis-line" />
        <line x1="${plotLeft}" y1="${plotTop + plotH}" x2="${chartW - plotRight}" y2="${plotTop + plotH}" class="axis-line" />
        <polygon points="${areaPoints}" fill="url(#areaOrange)" />
        <polyline points="${svgPoints}" class="trend-line" />
        ${pointsHtml}
        ${xLabelsHtml}
      </svg>
    `
    : `<div class="empty-state">Sem dados de despesas por mês.</div>`;

  const categoriasHtml = categorias.length
    ? categorias.map(item => {
        const total = Number(item.total || 0);
        const maxCategoria = Math.max(...categorias.map(c => Number(c.total || 0)), 1);
        const largura = Math.max((total / maxCategoria) * 100, total > 0 ? 5 : 0);
        return `
          <div class="hbar-row">
            <div class="hbar-header">
              <span>${escapeHtml(item.nome)}</span>
              <strong>${formatMoney(total)}</strong>
            </div>
            <div class="hbar-track">
              <div class="hbar-fill hbar-orange" style="width:${largura}%;"></div>
            </div>
          </div>
        `;
      }).join('')
    : `<div class="empty-state">Sem dados por categoria para o filtro selecionado.</div>`;

  const fornecedoresHtml = fornecedores.length
    ? fornecedores.map(item => {
        const total = Number(item.total || 0);
        const maxFornecedor = Math.max(...fornecedores.map(f => Number(f.total || 0)), 1);
        const largura = Math.max((total / maxFornecedor) * 100, total > 0 ? 5 : 0);
        return `
          <div class="hbar-row">
            <div class="hbar-header">
              <span>${escapeHtml(item.nome)}</span>
              <strong>${formatMoney(total)}</strong>
            </div>
            <div class="hbar-track">
              <div class="hbar-fill hbar-green" style="width:${largura}%;"></div>
            </div>
          </div>
        `;
      }).join('')
    : `<div class="empty-state">Sem dados por fornecedor para o filtro selecionado.</div>`;

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Painel Fiscal - PlennaTec</title>
      <style>
        * { box-sizing: border-box; }

        :root {
          --orange: #00B050;
          --orange-dark: #009640;
          --green: #1fbd42;
          --text: #172033;
          --muted: #64748b;
          --soft: rgba(255, 255, 255, 0.78);
          --border: rgba(226, 232, 240, 0.82);
          --shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
        }

        body {
          margin: 0;
          min-height: 100vh;
          font-family: Arial, Helvetica, sans-serif;
          color: var(--text);
          background:
            radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
            radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
            linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%);
        }

        .page-shell {
          width: min(1680px, calc(100% - 64px));
          margin: 18px auto 12px;
        }

        .topbar,
        .nav-panel,
        .filter-panel,
        .stat-card,
        .chart-card {
          background: rgba(255, 255, 255, 0.82);
          border: 1px solid rgba(255, 255, 255, 0.72);
          border-radius: 18px;
          box-shadow: var(--shadow);
          backdrop-filter: blur(14px);
        }

        .topbar {
          min-height: 78px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 16px 26px;
          margin-bottom: 14px;
        }

        .brand-left {
          display: flex;
          align-items: center;
          gap: 18px;
          min-width: 0;
        }

.app-mark {
          width: 88px;
          height: 42px;
          border-radius: 12px;
          background: rgba(255,255,255,.86);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 5px 8px;
          border: 1px solid #e2e8f0;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.85), 0 8px 18px rgba(15,23,42,.06);
          overflow: hidden;
          flex: 0 0 auto;
        }
        .app-mark img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          display: block;
        }
        .app-mark span { display:none !important; }

        .brand-title h1 {
          margin: 0 0 5px;
          font-size: clamp(22px, 1.7vw, 30px);
          line-height: 1;
          letter-spacing: -0.7px;
          color: #101828;
        }

        .brand-title p {
          margin: 0;
          color: #52627a;
          font-size: 10px;
          font-weight: 600;
        }

        .profile-area {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 14px;
          flex-shrink: 0;
        }

        .profile-copy { text-align: right; }
        .profile-copy strong {
          display: block;
          color: var(--orange);
          font-size: 14px;
          margin-bottom: 4px;
        }
        .profile-copy span {
          color: #59677d;
          font-size: 10px;
          font-weight: 600;
        }

        .avatar-wrap {
          position: relative;
          width: 56px;
          height: 56px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: linear-gradient(180deg, #ffffff, #f5f7fb);
          border: 2px solid #e6ebf3;
          box-shadow: inset 0 2px 7px rgba(15, 23, 42, 0.04);
        }

        .avatar-icon {
          width: 31px;
          height: 31px;
          border-radius: 50%;
          background:
            radial-gradient(circle at 50% 28%, #c6ccd6 0 21%, transparent 22%),
            radial-gradient(ellipse at 50% 88%, #c6ccd6 0 45%, transparent 46%);
          opacity: .92;
        }
        .avatar-img { width: 44px; height: 44px; object-fit: contain; border-radius: 50%; }

        .online-dot {
          position: absolute;
          right: 0;
          bottom: 8px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #23c33a;
          border: 3px solid white;
        }

        .logout-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-width: 96px;
          height: 50px;
          border-radius: 12px;
          text-decoration: none;
          color: #222b3b;
          font-weight: 800;
          background: linear-gradient(180deg, #f8fafc, #eef2f7);
          border: 1px solid #e0e6ef;
          box-shadow: 0 10px 20px rgba(15, 23, 42, .06);
        }

        .nav-panel {
          min-height: 64px;
          padding: 8px 36px;
          display: grid;
          grid-template-columns: 1.35fr repeat(5, 1fr);
          gap: 22px;
          align-items: center;
          margin-bottom: 18px;
        }

        .nav-btn {
          height: 52px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          text-decoration: none;
          color: #20293a;
          font-size: 14px;
          font-weight: 900;
          background: rgba(239, 242, 247, 0.72);
          border: 1px solid rgba(226, 232, 240, 0.72);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.9);
          transition: transform .16s ease, box-shadow .16s ease, background .16s ease;
        }

        .nav-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 26px rgba(15, 23, 42, .08);
        }

        .nav-btn.active {
          color: white;
          background: linear-gradient(135deg, #00B050, #009640);
          border-color: rgba(0, 176, 80, .9);
          box-shadow: 0 14px 24px rgba(0, 176, 80, .22);
        }

        .nav-icon,
        .stat-icon,
        .chart-soft-icon,
        .filter-icon,
        .logout-icon {
          width: 21px;
          height: 21px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: currentColor;
          flex-shrink: 0;
        }

        .nav-icon svg,
        .stat-icon svg,
        .filter-icon svg,
        .logout-icon svg { width: 100%; height: 100%; }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
          margin-bottom: 16px;
        }

        .stat-card {
          min-height: 112px;
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 18px 22px;
        }

        .stat-icon-box {
          width: 58px;
          height: 58px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
        }
        .stat-icon-box.orange { color: #00B050; background: #E8F7EE; }
        .stat-icon-box.green { color: #1db94b; background: #eaf9ed; }
        .stat-icon-box.purple { color: #8657ff; background: #f0eaff; }

        .stat-content small {
          display: block;
          color: #637083;
          font-size: 10px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .stat-content strong {
          display: block;
          color: #111827;
          font-size: 25px;
          letter-spacing: -0.4px;
          margin-bottom: 6px;
        }
        .stat-content span {
          color: #657386;
          font-size: 10px;
          font-weight: 600;
        }

        .filter-panel {
          min-height: 70px;
          padding: 12px 24px;
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 16px;
        }

        .filter-panel label {
          font-weight: 900;
          color: #1f2937;
          margin-right: 8px;
          font-size: 13px;
        }

        .filter-panel select,
        .filter-panel input[type="date"] {
          width: 310px;
          height: 44px;
          border-radius: 10px;
          border: 1px solid #dce3ec;
          padding: 0 18px;
          color: #334155;
          font-weight: 700;
          font-size: 13px;
          background: #fff;
          outline: none;
        }

        .btn-filter-apply {
          height: 44px;
          padding: 0 20px;
          border: none;
          border-radius: 11px;
          cursor: pointer;
          background: linear-gradient(135deg, #00B050, #009640);
          color: #fff;
          font-weight: 900;
          box-shadow: 0 12px 22px rgba(0, 176, 80, .22);
        }

        .btn-filter-clear {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 44px;
          padding: 0 16px;
          border-radius: 11px;
          text-decoration: none;
          color: #667085;
          font-weight: 800;
          background: #eef2f7;
        }

        .charts-grid {
          display: grid;
          grid-template-columns: 1.05fr .96fr 1.05fr;
          gap: 18px;
        }

        .chart-card {
          min-height: 310px;
          padding: 18px 22px 16px;
          position: relative;
          overflow: hidden;
        }

        .chart-card::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 86% 88%, rgba(226, 232, 240, .55), transparent 23%);
          pointer-events: none;
        }

        .chart-heading {
          position: relative;
          z-index: 1;
          padding-left: 14px;
          margin-bottom: 14px;
        }
        .chart-heading::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          width: 3px;
          height: 20px;
          border-radius: 999px;
          background: #94a3b8;
        }
        .chart-heading h2 {
          margin: 0 0 6px;
          font-size: 18px;
          color: #171f31;
          letter-spacing: -0.3px;
        }
        .chart-heading p {
          margin: 0;
          color: #59677d;
          font-size: 10px;
          font-weight: 600;
        }

        .line-chart {
          position: relative;
          z-index: 1;
          display: block;
          width: 100%;
          height: 210px;
          overflow: visible;
        }
        .grid-line { stroke: #dfe5ee; stroke-width: 1; stroke-dasharray: 4 4; }
        .axis-line { stroke: #cfd7e3; stroke-width: 1.2; }
        .trend-line { fill: none; stroke: #00B050; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
        .line-dot { fill: #00B050; stroke: #00B050; stroke-width: 2; }
        .axis-label, .month-label, .point-value { fill: #52627a; font-weight: 800; font-size: 10px; }
        .point-value { fill: #111827; font-size: 10px; }

        .hbar-list {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 6px 8px 0 4px;
        }
        .hbar-row { display: flex; flex-direction: column; gap: 8px; }
        .hbar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          color: #52627a;
          font-weight: 800;
          font-size: 12px;
        }
        .hbar-header strong { color: #111827; white-space: nowrap; }
        .hbar-track {
          width: 100%;
          height: 10px;
          background: #e9edf4;
          border-radius: 999px;
          overflow: hidden;
        }
        .hbar-fill {
          height: 100%;
          border-radius: 999px;
        }
        .hbar-orange { background: linear-gradient(90deg, #00B050, #00B050); }
        .hbar-green { background: linear-gradient(90deg, #23c33a, #16a634); }

        .chart-soft-icon {
          position: absolute;
          left: 50%;
          bottom: 16px;
          transform: translateX(-50%);
          width: 52px;
          height: 52px;
          border-radius: 14px;
          color: #667085;
          background: linear-gradient(180deg, #e7ebf1, #d8dde6);
          opacity: .95;
        }
        .chart-soft-icon svg { width: 34px; height: 24px; }

        .empty-state {
          color: #94a3b8;
          font-size: 14px;
          padding: 26px 0;
          font-weight: 700;
        }


/* ===== REFINO LOGO DASHBOARD PLENNATEC ===== */
.app-mark.app-mark-logo {
  width: 205px !important;
  height: 58px !important;
  padding: 6px 18px !important;
  border-radius: 14px !important;
  background: rgba(255,255,255,.90) !important;
  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
}
.app-mark.app-mark-logo img {
  width: 100% !important;
  max-width: 178px !important;
  max-height: 48px !important;
  object-fit: contain !important;
}

        .chart-clickable { cursor: pointer; transition: transform .16s ease, box-shadow .16s ease; }
        .chart-clickable:hover { transform: translateY(-2px); box-shadow: 0 22px 50px rgba(15,23,42,.12); }
        .dashboard-detail-modal { display:none; position:fixed; inset:0; z-index:9999; background:rgba(15,23,42,.55); padding:28px; align-items:center; justify-content:center; }
        .dashboard-detail-modal.is-open { display:flex; }
        .dashboard-detail-card { width:min(900px, calc(100vw - 56px)); max-height:86vh; overflow:auto; background:#fff; border-radius:20px; box-shadow:0 28px 80px rgba(15,23,42,.28); padding:22px; border:1px solid #e2e8f0; }
        .dashboard-detail-head { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:14px; }
        .dashboard-detail-head h2 { margin:0; font-size:22px; color:#101828; }
        .dashboard-detail-close { width:42px; height:42px; border-radius:12px; border:0; background:#00B050; color:#fff; font-size:22px; cursor:pointer; font-weight:900; }
        .dashboard-detail-chart { background:#f8fafc; border:1px solid #e2e8f0; border-radius:16px; padding:16px; margin-bottom:16px; }
        .dashboard-detail-controls { display:flex; align-items:center; justify-content:space-between; gap:18px; background:linear-gradient(180deg,#ffffff,#f7fafc); border:1px solid #dbe4ef; border-radius:18px; padding:14px 16px; margin:0 0 16px; box-shadow:0 10px 24px rgba(15,23,42,.06); }
        .dashboard-filter-box { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .dashboard-filter-box label { display:inline-flex; align-items:center; margin:0; font-size:13px; font-weight:900; color:#172033; white-space:nowrap; }
        .dashboard-filter-box select { min-width:230px; height:44px; border-radius:13px; border:1px solid #cfd9e6; padding:0 14px; font-weight:900; background:#fff; color:#172033; box-shadow:0 6px 14px rgba(15,23,42,.05); }
        .dashboard-filter-btn { height:44px; padding:0 18px; border-radius:13px; border:1px solid rgba(0,176,80,.88); background:linear-gradient(135deg,#00B050,#009640); color:#fff; font-weight:900; cursor:pointer; box-shadow:0 10px 20px rgba(0,176,80,.16); }
        .dashboard-detail-total { min-width:240px; text-align:right; color:#101828; font-weight:900; display:flex; flex-direction:column; justify-content:center; align-items:flex-end; padding-left:16px; border-left:1px solid #e2e8f0; }
        .dashboard-detail-total small { display:block; color:#64748b; font-size:11px; margin-bottom:5px; font-weight:900; }
        .dashboard-detail-total strong { font-size:23px; color:#00B050; line-height:1; letter-spacing:-.5px; }
        @media(max-width:760px){.dashboard-detail-controls{align-items:stretch;flex-direction:column}.dashboard-filter-box{align-items:stretch;flex-direction:column}.dashboard-filter-box select,.dashboard-filter-btn{width:100%;min-width:0}.dashboard-detail-total{align-items:flex-start;text-align:left;min-width:0;border-left:0;border-top:1px solid #e2e8f0;padding-left:0;padding-top:12px}}
        .dashboard-detail-chart .line-chart { height:260px !important; max-height:260px !important; width:100% !important; display:block; }
        .dashboard-detail-card[data-detail-type="meses"] { width:min(820px, calc(100vw - 56px)); }
        .dashboard-detail-card[data-detail-type="meses"] .dashboard-detail-chart { padding:10px 12px; overflow:hidden; }
        .dashboard-detail-card[data-detail-type="meses"] .point-value { font-size:12px !important; }
        .dashboard-detail-card[data-detail-type="meses"] .month-label,
        .dashboard-detail-card[data-detail-type="meses"] .axis-label { font-size:11px !important; }
        .dashboard-detail-table { width:100%; border-collapse:collapse; font-size:13px; }
        .dashboard-detail-table th, .dashboard-detail-table td { padding:10px 12px; border-bottom:1px solid #e5e7eb; text-align:left; }
        .dashboard-detail-table th { background:#f1f5f9 !important; color:#334155 !important; font-weight:900; }
        .dashboard-detail-table td.valor, .dashboard-detail-table th.valor { text-align:right; white-space:nowrap; }
        .dashboard-detail-group { background:#E8F7EE !important; font-weight:900; }


/* ===== PLENNATEC DASHBOARD PREMIUM - LAYOUT APROVADO ===== */
body {
  background:
    radial-gradient(circle at 100% 0%, rgba(232,247,238,.78) 0%, transparent 30%),
    linear-gradient(135deg, #f7faf9 0%, #ffffff 46%, #f3f7f6 100%) !important;
  animation: premiumPageIn .35s ease both;
}

@keyframes premiumPageIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.page-shell {
  width: min(1720px, calc(100% - 32px)) !important;
  margin: 0 auto !important;
  min-height: 100vh;
  display: grid !important;
  grid-template-columns: 250px minmax(0, 1fr);
  grid-template-areas:
    "sidebar topbar"
    "sidebar stats"
    "sidebar filter"
    "sidebar charts"
    "sidebar footer";
  gap: 18px 24px;
  padding: 22px 0 18px;
}

.premium-sidebar {
  grid-area: sidebar;
  position: sticky;
  top: 18px;
  height: calc(100vh - 36px);
  overflow: hidden;
  border-radius: 0 28px 28px 0;
  padding: 26px 18px 18px;
  color: #fff;
  background:
    radial-gradient(circle at 40% 20%, rgba(32,201,112,.30), transparent 28%),
    linear-gradient(180deg, #063d31 0%, #075236 46%, #043324 100%);
  box-shadow: 0 28px 80px rgba(4,51,36,.24);
  display: flex;
  flex-direction: column;
}

.premium-sidebar::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(120deg, rgba(255,255,255,.10), transparent 32%),
    radial-gradient(circle at 20% 80%, rgba(0,176,80,.22), transparent 30%);
  pointer-events: none;
}

.premium-sidebar > * {
  position: relative;
  z-index: 1;
}

.premium-sidebar-logo {
  width: 100%;
  height: 68px;
  border-radius: 18px;
  background: rgba(255,255,255,.98);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 11px 14px;
  margin-bottom: 24px;
  box-shadow: 0 18px 36px rgba(0,0,0,.18);
}

.premium-sidebar-logo img {
  width: 100%;
  max-height: 48px;
  object-fit: contain;
}

.premium-side-nav {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.premium-side-link {
  height: 48px;
  padding: 0 15px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: rgba(255,255,255,.88) !important;
  font-size: 14px;
  font-weight: 850;
  transition: transform .18s ease, background .18s ease, box-shadow .18s ease;
}

.premium-side-link span {
  width: 22px;
  height: 22px;
  display: inline-grid;
  place-items: center;
  border-radius: 8px;
  color: #dcffe9;
}

.premium-side-link:hover {
  transform: translateX(4px);
  background: rgba(255,255,255,.10);
}

.premium-side-link.active {
  background: linear-gradient(135deg, #13bd58, #079241);
  box-shadow: 0 15px 32px rgba(19,189,88,.33), inset 0 1px 0 rgba(255,255,255,.24);
  color: #fff !important;
}

.premium-upgrade {
  margin-top: auto;
  padding: 16px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(29,185,84,.22), rgba(255,255,255,.06));
  border: 1px solid rgba(255,255,255,.14);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.12);
}

.premium-upgrade strong {
  display: block;
  font-size: 13px;
  margin-bottom: 8px;
}

.premium-upgrade small {
  display: block;
  color: rgba(255,255,255,.75);
  font-size: 11px;
  line-height: 1.45;
  margin-bottom: 12px;
}

.premium-upgrade a {
  height: 38px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  text-decoration: none;
  color: #06412d !important;
  background: #d8ffe4;
  font-weight: 900;
  transition: transform .16s ease, filter .16s ease;
}

.premium-upgrade a:hover {
  transform: translateY(-1px);
  filter: brightness(1.04);
}

.premium-sidebar-user {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid rgba(255,255,255,.16);
  display: flex;
  align-items: center;
  gap: 11px;
}

.premium-sidebar-user img {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  object-fit: contain;
  background: #fff;
  padding: 4px;
}

.premium-sidebar-user strong,
.premium-sidebar-user small {
  display: block;
}

.premium-sidebar-user strong {
  font-size: 12px;
  color: #fff;
}

.premium-sidebar-user small {
  color: rgba(255,255,255,.70);
  font-size: 10px;
  margin-top: 3px;
}

.topbar {
  grid-area: topbar;
  min-height: 74px !important;
  border-radius: 24px !important;
  padding: 18px 24px !important;
  background: rgba(255,255,255,.86) !important;
  box-shadow: 0 18px 46px rgba(15,23,42,.07) !important;
  overflow: hidden;
  animation: premiumSlideUp .42s ease both;
}

.topbar .app-mark.app-mark-logo {
  display: none !important;
}

.brand-title h1 {
  font-size: 26px !important;
  letter-spacing: -.65px !important;
}

.brand-title p {
  font-size: 13px !important;
  color: #52627a !important;
  font-weight: 700 !important;
}

.nav-panel {
  display: none !important;
}

.stats-grid {
  grid-area: stats;
  display: grid !important;
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 16px !important;
  margin: 0 !important;
}

.stat-card {
  min-height: 150px !important;
  align-items: flex-start !important;
  flex-direction: column;
  gap: 12px !important;
  padding: 22px !important;
  border-radius: 20px !important;
  background: #fff !important;
  box-shadow: 0 18px 42px rgba(15,23,42,.08) !important;
  position: relative;
  overflow: hidden;
  animation: premiumCardIn .44s ease both;
  transition: transform .18s ease, box-shadow .18s ease;
}

.stat-card::after {
  content: '';
  position: absolute;
  left: 22px;
  right: 22px;
  bottom: 18px;
  height: 32px;
  opacity: .74;
  background:
    linear-gradient(135deg, transparent 0 8%, rgba(0,176,80,.12) 8% 12%, transparent 12% 22%, rgba(0,176,80,.18) 22% 29%, transparent 29% 40%, rgba(0,176,80,.13) 40% 46%, transparent 46% 62%, rgba(0,176,80,.20) 62% 69%, transparent 69% 100%);
  clip-path: polygon(0 70%, 12% 56%, 22% 66%, 34% 40%, 48% 54%, 62% 34%, 78% 56%, 100% 24%, 100% 100%, 0 100%);
  pointer-events: none;
}

.stat-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 28px 70px rgba(15,23,42,.13) !important;
}

.stat-icon-box {
  width: 46px !important;
  height: 46px !important;
  border-radius: 15px !important;
  box-shadow: 0 13px 24px rgba(0,176,80,.16);
}

.stat-content small {
  font-size: 12px !important;
  color: #334155 !important;
  margin-bottom: 6px !important;
}

.stat-content strong {
  font-size: 25px !important;
  color: #0f172a !important;
  letter-spacing: -.6px !important;
}

.stat-content span {
  font-size: 12px !important;
  color: #078a3d !important;
  font-weight: 800 !important;
}

.filter-panel {
  grid-area: filter;
  margin: 0 !important;
  min-height: 62px !important;
  justify-content: flex-end;
  border-radius: 18px !important;
  box-shadow: none !important;
  background: transparent !important;
  border: 0 !important;
  padding: 0 !important;
}

.filter-panel label {
  display: none;
}

.filter-panel select {
  width: 260px !important;
  height: 48px !important;
  border-radius: 15px !important;
  background: #fff !important;
  box-shadow: 0 12px 26px rgba(15,23,42,.07);
}

.btn-filter-apply {
  height: 48px !important;
  border-radius: 15px !important;
  background: linear-gradient(135deg,#047b3a,#009640) !important;
  box-shadow: 0 16px 28px rgba(0,128,64,.18) !important;
  transition: transform .16s ease, box-shadow .16s ease, filter .16s ease;
}

.btn-filter-clear {
  height: 48px !important;
  border-radius: 15px !important;
}

.btn-filter-apply:hover,
.btn-filter-clear:hover,
.logout-btn:hover {
  transform: translateY(-2px);
}

.charts-grid {
  grid-area: charts;
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
  gap: 18px !important;
  margin: 0 !important;
}

.chart-card {
  min-height: 330px !important;
  border-radius: 20px !important;
  background: #fff !important;
  box-shadow: 0 18px 42px rgba(15,23,42,.08) !important;
  border: 1px solid #eef2f4 !important;
  padding: 24px !important;
  transition: transform .18s ease, box-shadow .18s ease;
  animation: premiumCardIn .5s ease both;
}

.chart-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 28px 70px rgba(15,23,42,.13) !important;
}

.chart-card:nth-child(1) {
  order: 3;
  grid-column: 1 / span 2;
  min-height: 390px !important;
}

.chart-card:nth-child(2) {
  order: 1;
}

.chart-card:nth-child(3) {
  order: 2;
}

.chart-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding-left: 0 !important;
}

.chart-heading::before {
  display: none !important;
}

.chart-heading h2 {
  font-size: 20px !important;
}

.chart-heading p {
  font-size: 11px !important;
  color: #64748b !important;
}

.chart-heading::after {
  content: 'Ver detalhes ↗';
  color: #008f45;
  font-weight: 900;
  font-size: 12px;
  white-space: nowrap;
  opacity: .95;
}

.hbar-list {
  gap: 17px !important;
  padding-top: 10px !important;
}

.hbar-header {
  font-size: 13px !important;
}

.hbar-track {
  height: 9px !important;
}

.line-chart {
  height: 295px !important;
}

.trend-line {
  stroke-dasharray: 900;
  stroke-dashoffset: 900;
  animation: premiumDrawLine 1s ease .12s forwards;
}

.hbar-fill {
  transform-origin: left center;
  animation: premiumBarGrow .75s cubic-bezier(.2,.85,.2,1) both;
}

.line-dot {
  animation: premiumDotPop .35s ease both;
}

.dashboard-detail-modal {
  backdrop-filter: blur(7px);
}

.dashboard-detail-modal.is-open .dashboard-detail-card {
  animation: premiumModalIn .22s ease both;
}

.dashboard-detail-card {
  border-radius: 22px !important;
  box-shadow: 0 34px 92px rgba(15,23,42,.28) !important;
}

.dashboard-detail-controls {
  display:flex !important;
  align-items:center !important;
  justify-content:space-between !important;
  gap:18px !important;
  background:linear-gradient(180deg,#ffffff,#f7fafc) !important;
  border:1px solid #dbe4ef !important;
  border-radius:18px !important;
  padding:14px 16px !important;
  margin:0 0 16px !important;
  box-shadow:0 10px 24px rgba(15,23,42,.06) !important;
}

.dashboard-filter-box {
  display:flex !important;
  align-items:center !important;
  gap:10px !important;
  flex-wrap:wrap !important;
}

.dashboard-filter-box label {
  display:inline-flex !important;
  align-items:center !important;
  margin:0 !important;
  font-size:13px !important;
  font-weight:900 !important;
  color:#172033 !important;
  white-space:nowrap !important;
}

.dashboard-filter-box select {
  min-width:230px !important;
  height:44px !important;
  border-radius:13px !important;
  border:1px solid #cfd9e6 !important;
  padding:0 14px !important;
  font-weight:900 !important;
  background:#fff !important;
  color:#172033 !important;
  box-shadow:0 6px 14px rgba(15,23,42,.05) !important;
}

.dashboard-filter-btn {
  height:44px !important;
  padding:0 18px !important;
  border-radius:13px !important;
  border:1px solid rgba(0,176,80,.88) !important;
  background:linear-gradient(135deg,#00B050,#009640) !important;
  color:#fff !important;
  font-weight:900 !important;
  cursor:pointer !important;
  box-shadow:0 10px 20px rgba(0,176,80,.16) !important;
  transition: transform .16s ease, box-shadow .16s ease, filter .16s ease;
}

.dashboard-filter-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 28px rgba(0,176,80,.22) !important;
}

.dashboard-detail-total {
  min-width:240px !important;
  text-align:right !important;
  color:#101828 !important;
  font-weight:900 !important;
  display:flex !important;
  flex-direction:column !important;
  justify-content:center !important;
  align-items:flex-end !important;
  padding-left:16px !important;
  border-left:1px solid #e2e8f0 !important;
}

.dashboard-detail-total small {
  display:block !important;
  color:#64748b !important;
  font-size:11px !important;
  margin-bottom:5px !important;
  font-weight:900 !important;
}

.dashboard-detail-total strong {
  font-size:23px !important;
  color:#00B050 !important;
  line-height:1 !important;
  letter-spacing:-.5px !important;
}

.footer-note {
  grid-area: footer;
}

@keyframes premiumCardIn {
  from { opacity: 0; transform: translateY(14px) scale(.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes premiumSlideUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes premiumDrawLine {
  to { stroke-dashoffset: 0; }
}

@keyframes premiumBarGrow {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

@keyframes premiumDotPop {
  from { opacity: 0; transform: scale(.25); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes premiumModalIn {
  from { opacity: 0; transform: translateY(18px) scale(.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@media (max-width: 1180px) {
  .page-shell {
    grid-template-columns: 1fr !important;
    grid-template-areas:
      "topbar"
      "filter"
      "stats"
      "charts"
      "footer" !important;
    width: min(100% - 24px, 1180px) !important;
  }

  .premium-sidebar {
    display: none !important;
  }

  .nav-panel {
    display: grid !important;
  }

  .stats-grid {
    grid-template-columns: repeat(2, minmax(0,1fr)) !important;
  }
}

@media (max-width: 760px) {
  .stats-grid,
  .charts-grid {
    grid-template-columns: 1fr !important;
  }

  .chart-card:nth-child(1) {
    grid-column: auto !important;
  }

  .filter-panel {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-panel select,
  .btn-filter-apply,
  .btn-filter-clear {
    width: 100% !important;
  }
}
/* ===== FIM PLENNATEC DASHBOARD PREMIUM - LAYOUT APROVADO ===== */


        .footer-note {
          margin-top: 14px;
          text-align: center;
          color: #69778d;
          font-size: 10px;
          font-weight: 600;
        }

        /* Mantém o Dashboard estável em monitores Windows com escala 125%/150%.
           Antes, abaixo de 1300px o painel quebrava para 1 coluna e ficava gigante. */
        @media (max-width: 980px) {
          .page-shell { width: min(100% - 28px, 1200px); }
          .topbar { padding: 14px 18px; }
          .nav-panel { grid-template-columns: repeat(3, 1fr); padding: 10px 18px; gap: 12px; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .charts-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 720px) {
          .page-shell { width: min(100% - 22px, 680px); margin-top: 16px; }
          .topbar, .profile-area, .filter-panel { flex-direction: column; align-items: flex-start; }
          .profile-copy { text-align: left; }
          .nav-panel, .stats-grid { grid-template-columns: 1fr; padding: 12px; gap: 8px; }
          .brand-title h1 { font-size: 25px; }
          .filter-panel select, .filter-panel input[type="date"] { width: 100%; }
          .stat-card { min-height: auto; }
        }
      

/* ===== PADRÃO VISUAL PLENNATEC - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL PLENNATEC ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */


/* ===== PLENNATEC VERSÃO FINAL PREMIUM COMPACTA ===== */
body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 98% 0%, rgba(232,247,238,.78) 0%, transparent 28%),
    linear-gradient(135deg, #f7faf9 0%, #ffffff 48%, #f3f7f6 100%) !important;
}

.page-shell {
  width: min(1740px, calc(100% - 20px)) !important;
  height: 100vh !important;
  min-height: 680px !important;
  margin: 0 auto !important;
  padding: 14px 0 10px !important;
  display: grid !important;
  grid-template-columns: 250px minmax(0, 1fr) !important;
  grid-template-rows: 64px 86px minmax(0, 1fr) 16px !important;
  grid-template-areas:
    "sidebar topbar"
    "sidebar stats"
    "sidebar charts"
    "sidebar footer" !important;
  gap: 10px 18px !important;
}

.premium-sidebar {
  grid-area: sidebar !important;
  top: 14px !important;
  height: calc(100vh - 28px) !important;
  min-height: 650px !important;
  border-radius: 0 26px 26px 0 !important;
  padding: 20px 17px 16px !important;
}

.premium-sidebar-logo {
  height: 63px !important;
  margin-bottom: 17px !important;
  border-radius: 17px !important;
}

.premium-sidebar-logo img {
  max-height: 44px !important;
}

.premium-side-nav {
  gap: 7px !important;
}

.premium-side-link {
  height: 40px !important;
  font-size: 13px !important;
  border-radius: 13px !important;
  padding: 0 13px !important;
}

.premium-side-link span {
  width: 18px !important;
  height: 18px !important;
  font-size: 11px !important;
}

.premium-upgrade {
  padding: 12px 14px !important;
  border-radius: 17px !important;
}

.premium-upgrade strong {
  font-size: 12px !important;
}

.premium-upgrade small {
  font-size: 10px !important;
  line-height: 1.35 !important;
  margin-bottom: 9px !important;
}

.premium-upgrade a {
  height: 36px !important;
  font-size: 13px !important;
  border-radius: 12px !important;
}

.premium-sidebar-user {
  margin-top: 12px !important;
  padding-top: 12px !important;
}

.premium-sidebar-user img {
  width: 36px !important;
  height: 36px !important;
}

.premium-sidebar-user strong {
  font-size: 11px !important;
}

.premium-sidebar-user small {
  font-size: 9px !important;
}

.topbar {
  grid-area: topbar !important;
  height: 64px !important;
  min-height: 64px !important;
  margin: 0 !important;
  padding: 9px 14px 9px 20px !important;
  display: grid !important;
  grid-template-columns: minmax(230px, 1fr) auto auto !important;
  align-items: center !important;
  gap: 8px !important;
  border-radius: 20px !important;
  background: rgba(255,255,255,.94) !important;
  box-shadow: 0 14px 34px rgba(15,23,42,.07) !important;
  overflow: visible !important;
}

.topbar .app-mark.app-mark-logo {
  display: none !important;
}

.brand-title h1 {
  font-size: clamp(20px, 1.45vw, 26px) !important;
  margin: 0 0 2px !important;
  letter-spacing: -.65px !important;
}

.brand-title p {
  font-size: 10.5px !important;
  line-height: 1.15 !important;
  max-width: 500px !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  color: #52627a !important;
}

.topbar-filter {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  width: auto !important;
}

.topbar-filter select {
  width: 175px !important;
  height: 36px !important;
  border-radius: 12px !important;
  padding: 0 10px !important;
  font-size: 11.5px !important;
  font-weight: 850 !important;
  background: #fff !important;
  border: 1px solid #dfe7ef !important;
  box-shadow: 0 8px 18px rgba(15,23,42,.06) !important;
}

.topbar-filter-apply {
  height: 36px !important;
  min-width: 126px !important;
  padding: 0 12px !important;
  border-radius: 12px !important;
  font-size: 11.5px !important;
  font-weight: 900 !important;
  box-shadow: 0 12px 22px rgba(0,128,64,.18) !important;
}

.topbar-filter-apply::before {
  margin-right: 6px !important;
  font-size: 10px !important;
}

.topbar-filter-clear {
  height: 36px !important;
  padding: 0 12px !important;
  border-radius: 12px !important;
  font-size: 11.5px !important;
  font-weight: 900 !important;
}

.profile-area {
  gap: 7px !important;
}

.profile-copy strong {
  font-size: 12px !important;
  margin-bottom: 2px !important;
}

.profile-copy span {
  font-size: 9px !important;
}

.avatar-wrap {
  width: 40px !important;
  height: 40px !important;
}

.avatar-img {
  width: 32px !important;
  height: 32px !important;
}

.online-dot {
  width: 10px !important;
  height: 10px !important;
  bottom: 5px !important;
}

.logout-btn {
  height: 36px !important;
  min-width: 78px !important;
  border-radius: 12px !important;
  font-size: 12px !important;
  gap: 6px !important;
}

.logout-icon {
  width: 17px !important;
  height: 17px !important;
}

.page-shell > .filter-panel {
  display: none !important;
}

.nav-panel {
  display: none !important;
}

.stats-grid {
  grid-area: stats !important;
  display: grid !important;
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 12px !important;
  margin: 0 !important;
  min-height: 0 !important;
}

.stat-card {
  height: 86px !important;
  min-height: 86px !important;
  padding: 12px 14px !important;
  border-radius: 18px !important;
  background: #fff !important;
  border: 1px solid #eef2f4 !important;
  box-shadow: 0 13px 30px rgba(15,23,42,.07) !important;
  display: grid !important;
  grid-template-columns: 42px minmax(0, 1fr) !important;
  align-items: center !important;
  gap: 12px !important;
  position: relative !important;
  overflow: hidden !important;
  transition: transform .18s ease, box-shadow .18s ease, filter .18s ease !important;
}

.stat-card:hover {
  transform: translateY(-3px) !important;
  box-shadow: 0 22px 52px rgba(15,23,42,.12) !important;
}

.stat-card::after {
  content: '';
  position: absolute;
  left: 66px;
  right: 14px;
  bottom: 9px;
  height: 18px;
  opacity: .58;
  background: linear-gradient(90deg, rgba(0,176,80,.05), rgba(0,176,80,.16));
  clip-path: polygon(0 70%, 12% 58%, 22% 66%, 34% 42%, 48% 56%, 62% 34%, 78% 57%, 100% 24%, 100% 100%, 0 100%);
  pointer-events: none;
}

.stat-icon-box {
  width: 42px !important;
  height: 42px !important;
  border-radius: 14px !important;
  box-shadow: 0 10px 20px rgba(0,176,80,.12) !important;
}

.stat-icon {
  width: 18px !important;
  height: 18px !important;
}

.stat-content {
  min-width: 0 !important;
  position: relative !important;
  z-index: 1 !important;
}

.stat-content small {
  font-size: 10px !important;
  margin: 0 0 3px !important;
  color: #334155 !important;
  font-weight: 850 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

.stat-content strong {
  font-size: clamp(17px, 1.25vw, 22px) !important;
  line-height: 1.05 !important;
  margin: 0 0 3px !important;
  color: #0f172a !important;
  letter-spacing: -.5px !important;
}

.stat-content span {
  font-size: 9.5px !important;
  color: #078a3d !important;
  font-weight: 850 !important;
  line-height: 1.15 !important;
}

.charts-grid {
  grid-area: charts !important;
  display: grid !important;
  grid-template-columns: 1fr 1fr 1fr !important;
  grid-template-rows: minmax(0, 1fr) !important;
  gap: 12px !important;
  min-height: 0 !important;
  margin: 0 !important;
  overflow: hidden !important;
}

.chart-card,
.chart-card:nth-child(1),
.chart-card:nth-child(2),
.chart-card:nth-child(3) {
  grid-row: 1 !important;
  grid-column: auto !important;
  order: initial !important;
  height: 100% !important;
  min-height: 0 !important;
}

.chart-card {
  border-radius: 19px !important;
  background: #fff !important;
  border: 1px solid #eef2f4 !important;
  box-shadow: 0 14px 34px rgba(15,23,42,.075) !important;
  padding: 14px 15px 12px !important;
  overflow: hidden !important;
  transition: transform .18s ease, box-shadow .18s ease, filter .18s ease !important;
}

.chart-card:hover {
  transform: translateY(-3px) !important;
  box-shadow: 0 24px 58px rgba(15,23,42,.13) !important;
}

.chart-heading {
  padding-left: 0 !important;
  margin-bottom: 9px !important;
  display: grid !important;
  grid-template-columns: auto 1fr auto !important;
  align-items: start !important;
  gap: 8px !important;
}

.chart-heading::before {
  display: none !important;
}

.chart-heading h2 {
  margin: 0 !important;
  font-size: clamp(15px, 1vw, 18px) !important;
  line-height: 1.05 !important;
  color: #0f172a !important;
  letter-spacing: -.35px !important;
}

.chart-heading p {
  margin: 1px 0 0 !important;
  font-size: 9px !important;
  line-height: 1.12 !important;
  color: #64748b !important;
  font-weight: 750 !important;
}

.chart-heading::after {
  content: 'Detalhes ↗';
  color: #008f45;
  font-weight: 900;
  font-size: 10px;
  white-space: nowrap;
  opacity: .95;
}

.chart-card:nth-child(1) .chart-heading {
  grid-template-columns: auto 1fr auto !important;
}

.hbar-list {
  gap: 8px !important;
  padding: 4px 4px 0 0 !important;
  max-height: calc(100% - 38px) !important;
  overflow: hidden !important;
}

.hbar-row {
  gap: 5px !important;
}

.hbar-header {
  font-size: 10.5px !important;
  gap: 8px !important;
  line-height: 1.08 !important;
}

.hbar-header span {
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

.hbar-header strong {
  font-size: 10.5px !important;
}

.hbar-track {
  height: 6px !important;
}

.line-chart {
  width: 100% !important;
  height: calc(100% - 38px) !important;
  min-height: 160px !important;
  max-height: 520px !important;
}

.chart-card:nth-child(1) .line-chart {
  height: calc(100% - 38px) !important;
  min-height: 160px !important;
  max-height: 520px !important;
}

.axis-label,
.month-label,
.point-value {
  font-size: 7.5px !important;
}

.trend-line {
  stroke-width: 2.6px !important;
  stroke-dasharray: 900;
  stroke-dashoffset: 900;
  animation: premiumFinalDrawLine 1s ease .1s forwards;
}

.line-dot {
  r: 4;
  animation: premiumFinalDotPop .35s ease both;
}

.hbar-fill {
  transform-origin: left center;
  animation: premiumFinalBarGrow .75s cubic-bezier(.2,.85,.2,1) both;
}

.chart-soft-icon {
  display: none !important;
}

.footer-note {
  grid-area: footer !important;
  margin: 0 !important;
  font-size: 9px !important;
  opacity: .55 !important;
}

.dashboard-detail-modal {
  backdrop-filter: blur(7px) !important;
}

.dashboard-detail-modal.is-open .dashboard-detail-card {
  animation: premiumFinalModalIn .22s ease both !important;
}

.dashboard-detail-card {
  border-radius: 22px !important;
  box-shadow: 0 34px 92px rgba(15,23,42,.28) !important;
}

.dashboard-detail-controls {
  display:flex !important;
  align-items:center !important;
  justify-content:space-between !important;
  gap:18px !important;
  background:linear-gradient(180deg,#ffffff,#f7fafc) !important;
  border:1px solid #dbe4ef !important;
  border-radius:18px !important;
  padding:14px 16px !important;
  margin:0 0 16px !important;
  box-shadow:0 10px 24px rgba(15,23,42,.06) !important;
}

.dashboard-filter-box {
  display:flex !important;
  align-items:center !important;
  gap:10px !important;
  flex-wrap:wrap !important;
}

.dashboard-filter-box label {
  display:inline-flex !important;
  align-items:center !important;
  margin:0 !important;
  font-size:13px !important;
  font-weight:900 !important;
  color:#172033 !important;
  white-space:nowrap !important;
}

.dashboard-filter-box select {
  min-width:230px !important;
  height:44px !important;
  border-radius:13px !important;
  border:1px solid #cfd9e6 !important;
  padding:0 14px !important;
  font-weight:900 !important;
  background:#fff !important;
  color:#172033 !important;
  box-shadow:0 6px 14px rgba(15,23,42,.05) !important;
}

.dashboard-filter-btn {
  height:44px !important;
  padding:0 18px !important;
  border-radius:13px !important;
  border:1px solid rgba(0,176,80,.88) !important;
  background:linear-gradient(135deg,#00B050,#009640) !important;
  color:#fff !important;
  font-weight:900 !important;
  cursor:pointer !important;
  box-shadow:0 10px 20px rgba(0,176,80,.16) !important;
  transition: transform .16s ease, box-shadow .16s ease, filter .16s ease;
}

.dashboard-filter-btn:hover {
  transform: translateY(-2px);
  box-shadow:0 14px 28px rgba(0,176,80,.22) !important;
}

.dashboard-detail-total {
  min-width:240px !important;
  text-align:right !important;
  color:#101828 !important;
  font-weight:900 !important;
  display:flex !important;
  flex-direction:column !important;
  justify-content:center !important;
  align-items:flex-end !important;
  padding-left:16px !important;
  border-left:1px solid #e2e8f0 !important;
}

.dashboard-detail-total small {
  display:block !important;
  color:#64748b !important;
  font-size:11px !important;
  margin-bottom:5px !important;
  font-weight:900 !important;
}

.dashboard-detail-total strong {
  font-size:23px !important;
  color:#00B050 !important;
  line-height:1 !important;
  letter-spacing:-.5px !important;
}

.btn-filter-apply,
.topbar-filter-apply,
.topbar-filter-clear,
.logout-btn,
.premium-side-link,
.premium-upgrade a,
.chart-card,
.stat-card {
  will-change: transform;
}

@keyframes premiumFinalDrawLine {
  to { stroke-dashoffset: 0; }
}

@keyframes premiumFinalBarGrow {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

@keyframes premiumFinalDotPop {
  from { opacity: 0; transform: scale(.25); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes premiumFinalModalIn {
  from { opacity: 0; transform: translateY(18px) scale(.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@media (max-height: 760px) {
  .page-shell {
    grid-template-rows: 58px 76px minmax(0, 1fr) 14px !important;
    gap: 8px 15px !important;
    padding-top: 10px !important;
  }

  .topbar {
    height: 58px !important;
    min-height: 58px !important;
    padding: 7px 12px 7px 18px !important;
  }

  .brand-title h1 {
    font-size: 21px !important;
  }

  .brand-title p {
    font-size: 9.5px !important;
  }

  .premium-sidebar {
    top: 10px !important;
    height: calc(100vh - 20px) !important;
    padding-top: 16px !important;
  }

  .premium-sidebar-logo {
    height: 56px !important;
    margin-bottom: 14px !important;
  }

  .premium-side-link {
    height: 36px !important;
    font-size: 12px !important;
  }

  .premium-upgrade {
    padding: 10px 12px !important;
  }

  .premium-upgrade small {
    display: none !important;
  }

  .stat-card {
    height: 76px !important;
    min-height: 76px !important;
    padding: 10px 12px !important;
    grid-template-columns: 36px minmax(0, 1fr) !important;
  }

  .stat-icon-box {
    width: 36px !important;
    height: 36px !important;
  }

  .stat-content small {
    font-size: 9px !important;
  }

  .stat-content strong {
    font-size: 18px !important;
  }

  .stat-content span {
    font-size: 8.5px !important;
  }

  .chart-card {
    padding: 12px 13px !important;
  }

  .chart-heading h2 {
    font-size: 15px !important;
  }

  .chart-heading p {
    font-size: 8px !important;
  }

  .hbar-list {
    gap: 6px !important;
  }

  .hbar-header {
    font-size: 9.5px !important;
  }
}

@media (max-width: 1280px) {
  .topbar {
    grid-template-columns: 1fr auto !important;
  }

  .profile-area {
    display: none !important;
  }

  .topbar-filter select {
    width: 160px !important;
  }

  .topbar-filter-apply {
    min-width: 118px !important;
  }
}

@media (max-width: 1180px) {
  .page-shell {
    height: auto !important;
    min-height: 100vh !important;
    grid-template-columns: 1fr !important;
    grid-template-rows: auto auto auto auto !important;
    grid-template-areas:
      "topbar"
      "stats"
      "charts"
      "footer" !important;
    width: min(100% - 24px, 1180px) !important;
    overflow: visible !important;
  }

  .premium-sidebar {
    display: none !important;
  }

  .topbar {
    height: auto !important;
    grid-template-columns: 1fr !important;
    align-items: stretch !important;
  }

  .topbar-filter {
    justify-content: flex-start !important;
    flex-wrap: wrap !important;
  }

  .stats-grid {
    grid-template-columns: repeat(2, minmax(0,1fr)) !important;
  }

  .charts-grid {
    grid-template-columns: 1fr !important;
    grid-template-rows: auto !important;
    overflow: visible !important;
  }

  .chart-card,
  .chart-card:nth-child(1),
  .chart-card:nth-child(2),
  .chart-card:nth-child(3) {
    height: auto !important;
    min-height: 300px !important;
    grid-column: auto !important;
    grid-row: auto !important;
  }

  .nav-panel {
    display: grid !important;
  }
}

@media (max-width: 760px) {
  .stats-grid {
    grid-template-columns: 1fr !important;
  }

  .topbar-filter select,
  .topbar-filter-apply,
  .topbar-filter-clear {
    width: 100% !important;
  }

  .dashboard-detail-controls {
    align-items: stretch !important;
    flex-direction: column !important;
  }

  .dashboard-filter-box {
    align-items: stretch !important;
    flex-direction: column !important;
  }

  .dashboard-filter-box select,
  .dashboard-filter-btn {
    width: 100% !important;
    min-width: 0 !important;
  }

  .dashboard-detail-total {
    align-items:flex-start !important;
    text-align:left !important;
    min-width:0 !important;
    border-left:0 !important;
    border-top:1px solid #e2e8f0 !important;
    padding-left:0 !important;
    padding-top:12px !important;
  }
}
/* ===== FIM PLENNATEC VERSÃO FINAL PREMIUM COMPACTA ===== */


/* ===== AJUSTE FINAL: FILTRO ABAIXO DOS TOTALIZADORES + TOTALIZADORES MAIS CHEIOS ===== */
.topbar-filter {
  display: none !important;
}

.page-shell {
  grid-template-rows: 64px 88px 54px minmax(0, 1fr) 16px !important;
  grid-template-areas:
    "sidebar topbar"
    "sidebar stats"
    "sidebar filter"
    "sidebar charts"
    "sidebar footer" !important;
  gap: 10px 18px !important;
}

.page-shell > .filter-panel {
  grid-area: filter !important;
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 10px !important;
  min-height: 54px !important;
  height: 54px !important;
  margin: 0 !important;
  padding: 8px 12px !important;
  border-radius: 18px !important;
  background: rgba(255,255,255,.94) !important;
  border: 1px solid #eef2f4 !important;
  box-shadow: 0 12px 28px rgba(15,23,42,.06) !important;
  backdrop-filter: blur(12px) !important;
}

.page-shell > .filter-panel label {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 4px 0 2px !important;
  color: #172033 !important;
  font-size: 12px !important;
  font-weight: 900 !important;
  white-space: nowrap !important;
}

.page-shell > .filter-panel select {
  width: 230px !important;
  height: 38px !important;
  border-radius: 12px !important;
  border: 1px solid #dfe7ef !important;
  background: #fff !important;
  color: #172033 !important;
  padding: 0 12px !important;
  font-size: 12px !important;
  font-weight: 850 !important;
  outline: none !important;
  box-shadow: 0 8px 18px rgba(15,23,42,.05) !important;
}

.page-shell > .filter-panel .btn-filter-apply {
  height: 38px !important;
  padding: 0 16px !important;
  border-radius: 12px !important;
  font-size: 12px !important;
  font-weight: 900 !important;
  background: linear-gradient(135deg,#047b3a,#009640) !important;
  color: #fff !important;
  border: 0 !important;
  box-shadow: 0 11px 21px rgba(0,128,64,.18) !important;
}

.page-shell > .filter-panel .btn-filter-clear {
  height: 38px !important;
  padding: 0 15px !important;
  border-radius: 12px !important;
  font-size: 12px !important;
  font-weight: 900 !important;
  color: #172033 !important;
  background: #fff !important;
  border: 1px solid #e2e8f0 !important;
  box-shadow: 0 8px 18px rgba(15,23,42,.05) !important;
}

.page-shell > .filter-panel .btn-filter-apply:hover,
.page-shell > .filter-panel .btn-filter-clear:hover {
  transform: translateY(-2px) !important;
  filter: brightness(1.03) !important;
}

/* Totalizadores mais preenchidos, mantendo a mesma quantidade de linhas */
.stat-card {
  height: 88px !important;
  min-height: 88px !important;
  grid-template-columns: 44px minmax(0, 1fr) !important;
  gap: 13px !important;
  padding: 12px 16px !important;
}

.stat-icon-box {
  width: 44px !important;
  height: 44px !important;
}

.stat-content small {
  font-size: 11px !important;
  line-height: 1.05 !important;
  margin-bottom: 4px !important;
  white-space: nowrap !important;
}

.stat-content strong {
  font-size: clamp(21px, 1.55vw, 27px) !important;
  line-height: 1.02 !important;
  margin-bottom: 4px !important;
  white-space: nowrap !important;
}

.stat-content span {
  font-size: 10.5px !important;
  line-height: 1.1 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

.stat-card::after {
  left: 72px !important;
  right: 14px !important;
  bottom: 9px !important;
  height: 20px !important;
  opacity: .55 !important;
}

.charts-grid {
  min-height: 0 !important;
}

@media (max-height: 760px) {
  .page-shell {
    grid-template-rows: 58px 78px 48px minmax(0, 1fr) 14px !important;
  }

  .page-shell > .filter-panel {
    height: 48px !important;
    min-height: 48px !important;
    padding: 6px 10px !important;
  }

  .page-shell > .filter-panel select,
  .page-shell > .filter-panel .btn-filter-apply,
  .page-shell > .filter-panel .btn-filter-clear {
    height: 34px !important;
    font-size: 11px !important;
  }

  .stat-card {
    height: 78px !important;
    min-height: 78px !important;
    grid-template-columns: 38px minmax(0, 1fr) !important;
    gap: 10px !important;
  }

  .stat-icon-box {
    width: 38px !important;
    height: 38px !important;
  }

  .stat-content small {
    font-size: 9.5px !important;
  }

  .stat-content strong {
    font-size: 19px !important;
  }

  .stat-content span {
    font-size: 8.8px !important;
  }
}

@media (max-width: 1180px) {
  .page-shell {
    grid-template-areas:
      "topbar"
      "stats"
      "filter"
      "charts"
      "footer" !important;
    grid-template-rows: auto auto auto auto auto !important;
  }

  .page-shell > .filter-panel {
    height: auto !important;
    min-height: 54px !important;
    flex-wrap: wrap !important;
  }
}

@media (max-width: 760px) {
  .page-shell > .filter-panel {
    align-items: stretch !important;
    flex-direction: column !important;
  }

  .page-shell > .filter-panel label,
  .page-shell > .filter-panel select,
  .page-shell > .filter-panel .btn-filter-apply,
  .page-shell > .filter-panel .btn-filter-clear {
    width: 100% !important;
  }
}
/* ===== FIM AJUSTE FINAL ===== */


/* ===== AJUSTE TOTALIZADORES 60% MAIORES ===== */
.stats-grid .stat-card {
  height: 96px !important;
  min-height: 96px !important;
  grid-template-columns: 48px minmax(0, 1fr) !important;
  gap: 15px !important;
  padding: 13px 17px !important;
}

.stats-grid .stat-icon-box {
  width: 48px !important;
  height: 48px !important;
}

.stats-grid .stat-icon {
  width: 22px !important;
  height: 22px !important;
}

.stats-grid .stat-content small {
  font-size: 17.5px !important;
  line-height: 1.04 !important;
  margin-bottom: 4px !important;
  font-weight: 900 !important;
  letter-spacing: -0.25px !important;
  white-space: nowrap !important;
}

.stats-grid .stat-content strong {
  font-size: clamp(30px, 2vw, 37px) !important;
  line-height: 0.98 !important;
  margin-bottom: 4px !important;
  font-weight: 950 !important;
  letter-spacing: -1px !important;
  white-space: nowrap !important;
}

.stats-grid .stat-content span {
  font-size: 16px !important;
  line-height: 1.02 !important;
  font-weight: 900 !important;
  letter-spacing: -0.25px !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

/* Ajuste para caber melhor em telas com altura menor */
@media (max-height: 760px) {
  .stats-grid .stat-card {
    height: 88px !important;
    min-height: 88px !important;
    grid-template-columns: 42px minmax(0, 1fr) !important;
    gap: 12px !important;
    padding: 11px 14px !important;
  }

  .stats-grid .stat-icon-box {
    width: 42px !important;
    height: 42px !important;
  }

  .stats-grid .stat-content small {
    font-size: 15px !important;
  }

  .stats-grid .stat-content strong {
    font-size: clamp(26px, 1.8vw, 32px) !important;
  }

  .stats-grid .stat-content span {
    font-size: 13.5px !important;
  }
}

@media (max-width: 1450px) {
  .stats-grid .stat-content small {
    font-size: 15px !important;
  }

  .stats-grid .stat-content strong {
    font-size: clamp(25px, 1.8vw, 32px) !important;
  }

  .stats-grid .stat-content span {
    font-size: 13px !important;
  }
}
/* ===== FIM AJUSTE TOTALIZADORES 60% MAIORES ===== */



/* ===== FILTRO DE COMPETÊNCIA PADRÃO PLENNATEC ===== */
.month-smart-form {
  overflow: visible !important;
}

.month-compact-row {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

.month-current-display {
  min-width: 120px !important;
  height: 38px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 14px !important;
  border-radius: 12px !important;
  background: #ffffff !important;
  border: 1px solid #dce3ec !important;
  color: #172033 !important;
  font-weight: 900 !important;
  white-space: nowrap !important;
  box-shadow: 0 8px 18px rgba(15,23,42,.05) !important;
}

.btn-month-open {
  min-width: 118px !important;
  height: 38px !important;
  padding: 0 14px !important;
}

.month-picker-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(15, 23, 42, 0.16);
  align-items: flex-start;
  justify-content: center;
  padding: 88px 18px 18px;
}

.month-picker-overlay.open {
  display: flex;
}

.month-picker-popover {
  width: 338px;
  max-width: calc(100vw - 28px);
  border-radius: 18px;
  background: rgba(255,255,255,0.98);
  border: 1px solid #dce3ec;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.22);
  padding: 14px;
}

.month-picker-head {
  display: grid;
  grid-template-columns: 44px 1fr 44px;
  gap: 10px;
  align-items: center;
  margin-bottom: 14px;
}

.month-nav-btn {
  height: 38px !important;
  min-height: 38px !important;
  border-radius: 12px !important;
  padding: 0 !important;
  font-size: 20px !important;
  line-height: 1 !important;
  border: 0 !important;
  background: linear-gradient(135deg,#00B050,#009640) !important;
  color: #fff !important;
  font-weight: 900 !important;
  cursor: pointer !important;
}

.month-year-select {
  height: 38px !important;
  text-align: center !important;
  font-weight: 900 !important;
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: #fff !important;
}

.month-grid-picker {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.month-cell {
  height: 38px !important;
  min-height: 38px !important;
  padding: 0 !important;
  border-radius: 11px !important;
  font-size: 13px !important;
  font-weight: 900 !important;
  background: #E8F7EE !important;
  color: #14532d !important;
  border: 1px solid #c8ecd4 !important;
  box-shadow: 0 8px 16px rgba(15, 23, 42, .04) !important;
  transition: all .16s ease !important;
  cursor: pointer !important;
}

.month-cell:hover,
.month-cell.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  color: #fff !important;
  border-color: rgba(0, 176, 80, .9) !important;
  box-shadow: 0 10px 18px rgba(0, 176, 80, .22) !important;
  transform: translateY(-1px);
}

.month-picker-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 14px;
}

.month-selected-preview {
  color: #14532d;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}

.month-picker-footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
/* ===== FIM FILTRO DE COMPETÊNCIA PADRÃO PLENNATEC ===== */



/* ===== AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */
/* Comprovantes Fiscais: filtros compactos para caberem em uma única linha em telas largas */
body.dm-global-page form[action="/lancamentos"] .filters {
  display: grid !important;
  grid-template-columns: 1.05fr 1.05fr 1.05fr 1.05fr 1.05fr 1fr .92fr .92fr auto !important;
  align-items: end !important;
  gap: 8px !important;
  padding: 12px 14px !important;
}

body.dm-global-page form[action="/lancamentos"] .filters > div {
  min-width: 0 !important;
}

body.dm-global-page form[action="/lancamentos"] .filters label {
  display: block !important;
  margin: 0 0 5px !important;
  font-size: 10px !important;
  line-height: 1.05 !important;
  font-weight: 900 !important;
  white-space: nowrap !important;
}

body.dm-global-page form[action="/lancamentos"] .filters input,
body.dm-global-page form[action="/lancamentos"] .filters select {
  width: 100% !important;
  min-width: 0 !important;
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 10px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons {
  display: inline-flex !important;
  align-items: end !important;
  justify-content: flex-start !important;
  gap: 7px !important;
  min-width: 142px !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons button,
body.dm-global-page form[action="/lancamentos"] .filter-buttons a {
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 13px !important;
  font-size: 11px !important;
  border-radius: 11px !important;
}

@media (max-width: 1280px) {
  body.dm-global-page form[action="/lancamentos"] .filters {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

/* Espaço do Contador: conteúdo interno da coluna Enviar Arquivo alinhado à esquerda */
.contador-premium-page .contador-table th:nth-child(4) {
  text-align: center !important;
}

.contador-premium-page .contador-table td:nth-child(4) {
  text-align: left !important;
  padding-left: 10px !important;
  padding-right: 8px !important;
}

.contador-premium-page .upload-cell-compact {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  flex-wrap: nowrap !important;
  max-width: 100% !important;
  margin-left: 0 !important;
}

.contador-premium-page .btn-upload-open {
  width: auto !important;
  min-width: 112px !important;
  height: 30px !important;
  min-height: 30px !important;
  padding: 0 12px !important;
  font-size: 10.8px !important;
  line-height: 1 !important;
  border-radius: 11px !important;
}

.contador-premium-page .upload-cell-compact .clip-indicator,
.contador-premium-page .upload-cell-compact .empty-inline,
.contador-premium-page .upload-cell-compact .attached-badge,
.contador-premium-page .upload-cell-compact .attached-empty {
  flex: 0 0 auto !important;
}
/* ===== FIM AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */

</style>
    <style>
/* ===== PLENNATEC PREMIUM SIDEBAR - CATEGORIAS E USUÁRIOS ===== */
body.plennatec-premium-admin-page{
  margin:0;
  min-height:100vh;
  font-family:Arial,Helvetica,sans-serif;
  color:#0f172a;
  background:
    radial-gradient(circle at 0% 0%, rgba(0,176,80,.42) 0%, rgba(178,232,199,.30) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226,235,245,.95) 0%, rgba(240,244,249,.72) 31%, transparent 56%),
    linear-gradient(135deg,#f7fbf8 0%,#f7f9fc 42%,#eef3f8 100%);
}
.plennatec-app-shell{
  width:100%;
  min-height:100vh;
  display:grid;
  grid-template-columns:290px minmax(0,1fr);
  gap:22px;
  padding:18px 22px 18px 12px;
}
.plennatec-sidebar{
  position:sticky;
  top:18px;
  height:calc(100vh - 36px);
  border-radius:0 26px 26px 0;
  padding:26px 24px;
  background:linear-gradient(180deg,#064e3b 0%,#005f3a 45%,#003f2c 100%);
  color:#fff;
  box-shadow:0 24px 70px rgba(6,78,59,.26);
  display:flex;
  flex-direction:column;
  overflow:hidden;
}
.plennatec-side-logo{
  width:100%;
  min-height:74px;
  border-radius:18px;
  background:#fff;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:12px 18px;
  margin-bottom:24px;
  box-shadow:0 14px 28px rgba(0,0,0,.12);
}
.plennatec-side-logo img{
  max-width:100%;
  max-height:52px;
  object-fit:contain;
}
.plennatec-side-nav{
  display:flex;
  flex-direction:column;
  gap:8px;
}
.plennatec-side-nav a{
  height:48px;
  border-radius:14px;
  display:flex;
  align-items:center;
  gap:12px;
  padding:0 18px;
  text-decoration:none;
  color:#eafff2!important;
  font-size:15px;
  font-weight:900;
  letter-spacing:-.1px;
  transition:.16s ease;
}
.plennatec-side-nav a:hover{
  background:rgba(255,255,255,.10);
  transform:translateX(2px);
}
.plennatec-side-nav a.active{
  background:linear-gradient(135deg,#12c767,#00a64c);
  color:#fff!important;
  box-shadow:0 14px 28px rgba(0,176,80,.30);
}
.plennatec-side-spacer{flex:1;}
.plennatec-side-card{
  border:1px solid rgba(255,255,255,.16);
  border-radius:18px;
  background:rgba(255,255,255,.08);
  padding:16px;
  margin-top:18px;
}
.plennatec-side-card strong{
  display:block;
  font-size:14px;
  margin-bottom:8px;
}
.plennatec-side-card span{
  display:block;
  font-size:12px;
  line-height:1.4;
  color:#d8fbe5;
}
.plennatec-side-user{
  border-top:1px solid rgba(255,255,255,.14);
  padding-top:18px;
  margin-top:20px;
  display:flex;
  align-items:center;
  gap:12px;
}
.plennatec-side-user img{
  width:42px;
  height:42px;
  border-radius:50%;
  background:#fff;
  padding:4px;
}
.plennatec-side-user strong{
  display:block;
  font-size:13px;
}
.plennatec-side-user span{
  display:block;
  font-size:11px;
  opacity:.82;
  font-weight:800;
}
.plennatec-main{
  min-width:0;
}
.plennatec-topbar{
  min-height:92px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:18px;
  background:rgba(255,255,255,.88);
  border:1px solid rgba(255,255,255,.72);
  border-radius:22px;
  box-shadow:0 18px 45px rgba(15,23,42,.08);
  backdrop-filter:blur(14px);
  padding:18px 24px;
  margin-bottom:14px;
}
.plennatec-title-wrap{
  display:flex;
  align-items:center;
  gap:16px;
}
.plennatec-title-icon{
  width:52px;
  height:52px;
  border-radius:50%;
  background:#fff;
  border:1px solid #e2e8f0;
  display:grid;
  place-items:center;
  box-shadow:0 10px 24px rgba(15,23,42,.08);
}
.plennatec-title-icon img{
  width:42px;
  height:42px;
  object-fit:contain;
}
.plennatec-title-wrap h1{
  margin:0 0 6px;
  font-size:clamp(25px,2.1vw,34px);
  line-height:1;
  letter-spacing:-.7px;
  color:#101828;
}
.plennatec-title-wrap p{
  margin:0;
  color:#52627a;
  font-size:13px;
  font-weight:800;
}
.plennatec-top-user{
  display:flex;
  align-items:center;
  gap:12px;
}
.plennatec-top-user-copy{
  text-align:right;
}
.plennatec-top-user-copy strong{
  display:block;
  color:#00a64c;
  font-size:14px;
}
.plennatec-top-user-copy span{
  display:block;
  color:#64748b;
  font-size:11px;
  font-weight:900;
  text-transform:uppercase;
}
.plennatec-top-avatar{
  width:52px;
  height:52px;
  border-radius:50%;
  background:#fff;
  border:1px solid #e2e8f0;
  display:grid;
  place-items:center;
  box-shadow:0 10px 24px rgba(15,23,42,.08);
}
.plennatec-top-avatar img{
  width:42px;
  height:42px;
  object-fit:contain;
}
.plennatec-logout{
  height:46px;
  padding:0 18px;
  border-radius:14px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  background:linear-gradient(180deg,#f8fafc,#eef2f7);
  color:#172033!important;
  text-decoration:none;
  border:1px solid #dde6ef;
  font-weight:950;
  box-shadow:0 10px 20px rgba(15,23,42,.06);
}
.plennatec-card,
.plennatec-main .container,
.plennatec-main .card{
  background:rgba(255,255,255,.88)!important;
  border:1px solid rgba(255,255,255,.72)!important;
  border-radius:22px!important;
  box-shadow:0 18px 45px rgba(15,23,42,.08)!important;
  backdrop-filter:blur(14px);
}
.plennatec-main .container{
  width:100%!important;
  max-width:none!important;
  margin:0!important;
  padding:0!important;
  background:transparent!important;
  border:0!important;
  box-shadow:none!important;
}
.plennatec-main .card{
  padding:22px!important;
}
.plennatec-main table{
  width:100%;
  border-collapse:separate!important;
  border-spacing:0!important;
  overflow:hidden;
  border-radius:16px;
  background:#fff;
  box-shadow:inset 0 0 0 1px #e2e8f0;
}
.plennatec-main th{
  background:#f8fafc!important;
  color:#172033!important;
  font-size:12px!important;
  text-transform:none!important;
  font-weight:950!important;
}
.plennatec-main td,
.plennatec-main th{
  border-bottom:1px solid #e7edf5!important;
  padding:12px 14px!important;
}
.plennatec-main button,
.plennatec-main .btn,
.plennatec-main a.btn,
.plennatec-main input[type="submit"]{
  border-radius:12px!important;
  font-weight:950!important;
}
.plennatec-main .btn-primary,
.plennatec-main .btn-success,
.plennatec-main button[type="submit"],
.plennatec-main input[type="submit"]{
  background:linear-gradient(135deg,#00B050,#009640)!important;
  color:#fff!important;
  border:0!important;
  box-shadow:0 12px 22px rgba(0,176,80,.18)!important;
}
.plennatec-main input,
.plennatec-main select{
  border:1px solid #dce3ec!important;
  border-radius:12px!important;
  min-height:40px;
}
@media(max-width:980px){
  .plennatec-app-shell{grid-template-columns:1fr;padding:12px;}
  .plennatec-sidebar{position:relative;height:auto;border-radius:24px;}
  .plennatec-side-nav{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));}
  .plennatec-topbar{flex-direction:column;align-items:flex-start;}
  .plennatec-top-user{width:100%;justify-content:space-between;}
}

/* ===== AJUSTE FINO CATEGORIAS/USUÁRIOS - PLENNATEC ===== */
body.plennatec-premium-admin-page{font-size:13px!important;}
.plennatec-app-shell{grid-template-columns:270px minmax(0,1fr)!important;gap:20px!important;padding:18px 22px 18px 10px!important;}
.plennatec-sidebar{padding:22px 20px!important;}
.plennatec-side-logo{min-height:74px!important;height:74px!important;padding:10px 14px!important;border-radius:18px!important;overflow:hidden!important;}
.plennatec-side-logo img{width:100%!important;height:100%!important;max-width:220px!important;max-height:52px!important;object-fit:contain!important;display:block!important;}
.plennatec-side-nav a{height:44px!important;border-radius:13px!important;padding:0 16px!important;font-size:13px!important;font-weight:900!important;gap:11px!important;}
.plennatec-side-card{padding:14px!important;}
.plennatec-side-card strong{font-size:13px!important;}
.plennatec-side-card span{font-size:11px!important;}
.plennatec-topbar{min-height:78px!important;padding:16px 22px!important;border-radius:22px!important;}
.plennatec-title-icon{width:48px!important;height:48px!important;}
.plennatec-title-icon img,.plennatec-top-avatar img{width:38px!important;height:38px!important;object-fit:contain!important;}
.plennatec-top-avatar{width:48px!important;height:48px!important;}
.plennatec-title-wrap h1{font-size:clamp(22px,1.75vw,30px)!important;margin-bottom:5px!important;}
.plennatec-title-wrap p{font-size:12px!important;}
.plennatec-logout{height:42px!important;padding:0 16px!important;font-size:13px!important;}
.plennatec-main .card,.plennatec-card{padding:18px!important;}
.plennatec-main h1{font-size:25px!important;line-height:1.05!important;margin:0 0 14px!important;}
.plennatec-main h2{font-size:20px!important;line-height:1.15!important;margin:0 0 14px!important;}
.plennatec-main h3{font-size:16px!important;}
.plennatec-main p,.plennatec-main label,.plennatec-main td{font-size:13px!important;}
.plennatec-main th{font-size:11.5px!important;}
.plennatec-main td,.plennatec-main th{padding:10px 12px!important;}
.plennatec-main input,.plennatec-main select{min-height:36px!important;height:36px!important;font-size:12px!important;padding:0 10px!important;}
.plennatec-main button,.plennatec-main .btn,.plennatec-main a.btn,.plennatec-main input[type="submit"]{height:36px!important;min-height:36px!important;padding:0 13px!important;font-size:12px!important;border-radius:11px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;text-decoration:none!important;}
.plennatec-main a[href*="/categorias/nova"],.plennatec-main a[href*="/nova-categoria"],.plennatec-main a[href="/categorias/novo"],.plennatec-main a[href="/categorias/nova"]{height:38px!important;padding:0 15px!important;border-radius:12px!important;background:linear-gradient(135deg,#00B050,#009640)!important;color:#fff!important;text-decoration:none!important;font-weight:950!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;box-shadow:0 12px 22px rgba(0,176,80,.18)!important;}
.plennatec-main a[href="/dashboard"],.plennatec-main a[href="/logout"]:not(.plennatec-logout){display:none!important;}
.plennatec-main a{font-size:13px!important;font-weight:850;}
.plennatec-main .admin-content-grid{display:grid!important;grid-template-columns:minmax(340px,.72fr) minmax(560px,1.5fr)!important;gap:16px!important;align-items:start!important;}
.plennatec-main .admin-content-grid .card{margin:0!important;}
.plennatec-main form{font-size:13px!important;}
.plennatec-main form br{display:none!important;}
.plennatec-main form label{margin-right:5px!important;}
.plennatec-main .usuarios-create-form{display:flex!important;flex-wrap:wrap!important;align-items:end!important;gap:8px!important;}
.plennatec-main .usuarios-create-form > *{margin-top:0!important;margin-bottom:0!important;}
.plennatec-main .usuarios-create-form input{width:145px!important;}
.plennatec-main .usuarios-create-form select{width:145px!important;}
@media(max-width:1180px){.plennatec-main .admin-content-grid{grid-template-columns:1fr!important;}}


/* ===== REFINO FINAL CATEGORIAS/USUÁRIOS - PLENNATEC ===== */
body.plennatec-premium-admin-page{
  font-size:12.5px!important;
  overflow-x:hidden!important;
}
.plennatec-app-shell{
  grid-template-columns:270px minmax(0,1fr)!important;
  gap:20px!important;
  padding:18px 22px 18px 10px!important;
}
.plennatec-side-logo{
  height:74px!important;
  min-height:74px!important;
  padding:10px 14px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  background:#fff!important;
}
.plennatec-side-logo img{
  width:100%!important;
  height:100%!important;
  max-width:225px!important;
  max-height:54px!important;
  object-fit:contain!important;
  object-position:center!important;
}
.plennatec-side-nav a{
  height:44px!important;
  font-size:13px!important;
}
.plennatec-topbar{
  min-height:76px!important;
  padding:15px 22px!important;
  margin-bottom:14px!important;
}
.plennatec-title-wrap h1{
  font-size:26px!important;
}
.plennatec-title-wrap p{
  font-size:12px!important;
}
.plennatec-main{
  min-width:0!important;
  overflow:hidden!important;
}
.plennatec-main .card{
  padding:18px!important;
  margin-bottom:14px!important;
}
.plennatec-main h1{
  font-size:24px!important;
  margin:0 0 14px!important;
  line-height:1.1!important;
}
.plennatec-main h2{
  font-size:20px!important;
  margin:0 0 14px!important;
  line-height:1.12!important;
}
.plennatec-main h3{
  font-size:16px!important;
}
.plennatec-main p,
.plennatec-main label,
.plennatec-main td{
  font-size:12.5px!important;
}
.plennatec-main th{
  font-size:11px!important;
  padding:9px 10px!important;
}
.plennatec-main td{
  padding:9px 10px!important;
}
.plennatec-main table{
  table-layout:auto!important;
  width:100%!important;
}
.plennatec-main input,
.plennatec-main select{
  height:34px!important;
  min-height:34px!important;
  font-size:12px!important;
  border-radius:11px!important;
}
.plennatec-main .btn,
.plennatec-main a.btn,
.plennatec-main button[type="submit"],
.plennatec-main input[type="submit"]{
  height:34px!important;
  min-height:34px!important;
  padding:0 12px!important;
  font-size:11.5px!important;
  border-radius:11px!important;
  line-height:1!important;
}

/* Categorias */
.plennatec-main a[href="/categorias/nova"],
.plennatec-main a[href="/categorias/novo"],
.plennatec-main a[href*="/categorias/nova"],
.plennatec-main a[href*="/categorias/novo"]{
  height:36px!important;
  padding:0 14px!important;
  border-radius:12px!important;
  background:linear-gradient(135deg,#00B050,#009640)!important;
  color:#fff!important;
  text-decoration:none!important;
  font-weight:950!important;
  display:inline-flex!important;
  align-items:center!important;
  justify-content:center!important;
  box-shadow:0 10px 20px rgba(0,176,80,.16)!important;
  margin:0 0 14px!important;
}

/* Usuários: dois módulos lado a lado, campos ordenados */
.plennatec-main .usuarios-page-grid{
  display:grid!important;
  grid-template-columns:minmax(330px,390px) minmax(620px,1fr)!important;
  gap:16px!important;
  align-items:start!important;
  width:100%!important;
}
.plennatec-main .usuarios-page-grid .card{
  margin:0!important;
}
.plennatec-main .usuarios-create-form{
  display:grid!important;
  grid-template-columns:1fr 1fr!important;
  gap:10px!important;
  align-items:end!important;
}
.plennatec-main .usuarios-create-form label{
  display:block!important;
  margin:0 0 4px!important;
  font-weight:900!important;
  font-size:11.5px!important;
}
.plennatec-main .usuarios-create-form input,
.plennatec-main .usuarios-create-form select{
  width:100%!important;
}
.plennatec-main .usuarios-create-form .form-help,
.plennatec-main .usuarios-create-form p{
  grid-column:1 / -1!important;
  font-size:11.5px!important;
  color:#475569!important;
  margin:0!important;
  line-height:1.25!important;
}
.plennatec-main .usuarios-create-form button,
.plennatec-main .usuarios-create-form input[type="submit"]{
  width:max-content!important;
  min-width:124px!important;
}

/* Ações: tudo na mesma linha e sem fundo verde no lixo */
.plennatec-main td:last-child,
.plennatec-main th:last-child{
  white-space:nowrap!important;
  text-align:center!important;
}
.plennatec-main .actions-inline,
.plennatec-main .acoes-inline,
.plennatec-main td:last-child{
  display:table-cell!important;
}
.plennatec-main td:last-child a,
.plennatec-main td:last-child button,
.plennatec-main td:last-child form{
  display:inline-flex!important;
  vertical-align:middle!important;
  margin:0 2px!important;
}
.plennatec-main td:last-child form{
  padding:0!important;
  background:transparent!important;
  border:0!important;
  box-shadow:none!important;
}
.plennatec-main td:last-child button,
.plennatec-main td:last-child input[type="submit"]{
  width:auto!important;
  min-width:0!important;
  height:auto!important;
  min-height:0!important;
  padding:0!important;
  border:0!important;
  background:transparent!important;
  box-shadow:none!important;
  color:inherit!important;
  font-size:15px!important;
  line-height:1!important;
}
.plennatec-main td:last-child a{
  background:transparent!important;
  box-shadow:none!important;
  border:0!important;
  padding:0!important;
  height:auto!important;
  min-height:0!important;
  color:inherit!important;
  text-decoration:none!important;
  font-size:15px!important;
}

/* Remove sobras de links antigos */
.plennatec-main .legacy-user-heading,
.plennatec-main .legacy-links,
.plennatec-main a[href="/dashboard"],
.plennatec-main a[href="/logout"]:not(.plennatec-logout){
  display:none!important;
}

@media(max-width:1220px){
  .plennatec-main .usuarios-page-grid{
    grid-template-columns:1fr!important;
  }
}

</style>
</head>
    <body>
      ${renderMonthPickerAssets()}
        ${renderContadorTabelaDefinitivaAssets()}
      <style>
        #dashboardMonthPickerOverlay.open {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
        }

        #dashboardMonthForm .month-open-btn,
        #dashboardMonthForm .btn-month-open {
          pointer-events: auto !important;
          position: relative !important;
          z-index: 5 !important;
        }

        /* ===== AJUSTE DEFINITIVO DE ESPAÇAMENTO DO DASHBOARD =====
           Cria uma linha própria para o filtro e abre respiro visual
           entre totalizadores, filtro e gráficos. */
        main.page-shell {
          grid-template-rows: 64px 86px 68px minmax(0, 1fr) 16px !important;
          grid-template-areas:
            "sidebar topbar"
            "sidebar stats"
            "sidebar filter"
            "sidebar charts"
            "sidebar footer" !important;
          row-gap: 16px !important;
          column-gap: 18px !important;
        }

        main.page-shell > .stats-grid {
          grid-area: stats !important;
          margin: 0 0 0 0 !important;
        }

        main.page-shell > #dashboardMonthForm.filter-panel,
        main.page-shell > form#dashboardMonthForm.month-smart-form {
          grid-area: filter !important;
          display: flex !important;
          align-items: center !important;
          align-self: center !important;
          min-height: 60px !important;
          height: 60px !important;
          margin: 0 !important;
          padding: 10px 18px !important;
          border-radius: 20px !important;
          background: rgba(255,255,255,.94) !important;
          border: 1px solid #eef2f4 !important;
          box-shadow: 0 14px 34px rgba(15,23,42,.06) !important;
        }

        main.page-shell > .charts-grid {
          grid-area: charts !important;
          margin: 0 !important;
        }

        @media (max-width: 1180px) {
          main.page-shell {
            grid-template-rows: auto auto auto auto auto !important;
            grid-template-areas:
              "topbar"
              "stats"
              "filter"
              "charts"
              "footer" !important;
            row-gap: 16px !important;
          }

          main.page-shell > #dashboardMonthForm.filter-panel,
          main.page-shell > form#dashboardMonthForm.month-smart-form {
            height: auto !important;
            min-height: 60px !important;
            flex-wrap: wrap !important;
          }
        }
      

/* ===== AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */
/* Comprovantes Fiscais: filtros compactos para caberem em uma única linha em telas largas */
body.dm-global-page form[action="/lancamentos"] .filters {
  display: grid !important;
  grid-template-columns: 1.05fr 1.05fr 1.05fr 1.05fr 1.05fr 1fr .92fr .92fr auto !important;
  align-items: end !important;
  gap: 8px !important;
  padding: 12px 14px !important;
}

body.dm-global-page form[action="/lancamentos"] .filters > div {
  min-width: 0 !important;
}

body.dm-global-page form[action="/lancamentos"] .filters label {
  display: block !important;
  margin: 0 0 5px !important;
  font-size: 10px !important;
  line-height: 1.05 !important;
  font-weight: 900 !important;
  white-space: nowrap !important;
}

body.dm-global-page form[action="/lancamentos"] .filters input,
body.dm-global-page form[action="/lancamentos"] .filters select {
  width: 100% !important;
  min-width: 0 !important;
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 10px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons {
  display: inline-flex !important;
  align-items: end !important;
  justify-content: flex-start !important;
  gap: 7px !important;
  min-width: 142px !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons button,
body.dm-global-page form[action="/lancamentos"] .filter-buttons a {
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 13px !important;
  font-size: 11px !important;
  border-radius: 11px !important;
}

@media (max-width: 1280px) {
  body.dm-global-page form[action="/lancamentos"] .filters {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

/* Espaço do Contador: conteúdo interno da coluna Enviar Arquivo alinhado à esquerda */
.contador-premium-page .contador-table th:nth-child(4) {
  text-align: center !important;
}

.contador-premium-page .contador-table td:nth-child(4) {
  text-align: left !important;
  padding-left: 10px !important;
  padding-right: 8px !important;
}

.contador-premium-page .upload-cell-compact {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  flex-wrap: nowrap !important;
  max-width: 100% !important;
  margin-left: 0 !important;
}

.contador-premium-page .btn-upload-open {
  width: auto !important;
  min-width: 112px !important;
  height: 30px !important;
  min-height: 30px !important;
  padding: 0 12px !important;
  font-size: 10.8px !important;
  line-height: 1 !important;
  border-radius: 11px !important;
}

.contador-premium-page .upload-cell-compact .clip-indicator,
.contador-premium-page .upload-cell-compact .empty-inline,
.contador-premium-page .upload-cell-compact .attached-badge,
.contador-premium-page .upload-cell-compact .attached-empty {
  flex: 0 0 auto !important;
}
/* ===== FIM AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */

</style>

      <script>
        document.addEventListener('DOMContentLoaded', function() {
          const dashboardForm = document.getElementById('dashboardMonthForm');
          const dashboardOverlay = document.getElementById('dashboardMonthPickerOverlay');

          if (dashboardForm && dashboardOverlay) {
            const botoesAbrir = dashboardForm.querySelectorAll('.month-open-btn, .btn-month-open');

            botoesAbrir.forEach(function(btn) {
              btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                if (typeof window.abrirSeletorMesGlobal === 'function') {
                  window.abrirSeletorMesGlobal('dashboard');
                } else {
                  dashboardOverlay.classList.add('open');
                  dashboardOverlay.style.display = 'flex';
                }
              });
            });
          }
        });
      </script>

      <main class="page-shell">
        <aside class="premium-sidebar" aria-label="Menu lateral PlennaTec">
          <div class="premium-sidebar-logo">
            <img src="/assets/logo-plennatec-login.png" onerror="this.src='/assets/logo-plennatec-perfil.png'" alt="PlennaTec" />
          </div>

          <nav class="premium-side-nav">
            <a class="premium-side-link active" href="/dashboard"><span>⌂</span>Dashboard</a>
            <a class="premium-side-link" href="/rotina-despesas"><span>▧</span>Contas a Pagar</a>
            <a class="premium-side-link" href="/lancamentos"><span>▤</span>Comprovantes</a>
            <a class="premium-side-link" href="/documentos"><span>▣</span>Arquivo</a>
            <a class="premium-side-link" href="/categorias"><span>□</span>Categorias</a>
            <a class="premium-side-link" href="/espaco-contador"><span>⚖</span>Espaço do Contador</a>
            <a class="premium-side-link" href="/usuarios"><span>◉</span>Usuários</a>
          </nav>

          <div class="premium-upgrade">
            <strong>Gestão Premium</strong>
            <small>Controle fiscal, financeiro e documentos em um painel executivo.</small>
            <a href="/novo">Novo lançamento</a>
          </div>

          <div class="premium-sidebar-user">
            <img src="/assets/logo-plennatec-perfil.png" onerror="this.style.display='none'" alt="Perfil" />
            <div><strong>${escapeHtml(usuario.nome || 'Genivaldo Sestari')}</strong><small>${escapeHtml(usuario.perfil || 'Administrador')}</small></div>
          </div>
        </aside>

        <header class="topbar">
          <div class="brand-left">
            <div class="app-mark app-mark-logo" aria-hidden="true"><img src="/assets/logo-plennatec-login.png" onerror="this.src='/assets/logo-plennatec-perfil.png'" alt="PlennaTec" /></div>
            <div class="brand-title">
              <h1>Olá, ${escapeHtml((usuario.nome || 'Genivaldo').split(' ')[0] || 'Usuário')}! 👋</h1>
              <p>${subtituloFiltro}</p>
            </div>
          </div>

          <div class="profile-area">
            <div class="profile-copy">
              <strong>${escapeHtml(usuario.nome || usuario.email || 'Usuário')}</strong>
              <span>${escapeHtml(usuario.perfil || 'Dashboard gerencial interno')}</span>
            </div>
            <div class="avatar-wrap"><img src="/assets/logo-plennatec-perfil.png" class="avatar-img" onerror="this.src='/assets/logo-plennatec.png'" /><span class="online-dot"></span></div>
            <a class="logout-btn" href="/logout" title="Sair">
              <span class="logout-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg></span>
              Sair
            </a>
          </div>
        </header>

        <nav class="nav-panel" aria-label="Menu principal">
          <a class="nav-btn active" href="/rotina-despesas"><span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/></svg></span>Contas à Pagar</a>
          <a class="nav-btn" href="/lancamentos"><span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 16h8"/></svg></span>Comprovantes Fiscais</a>
          <a class="nav-btn" href="/documentos"><span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 12h8"/><path d="M8 17h5"/></svg></span>Arquivo</a>
          <a class="nav-btn" href="/categorias"><span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h5l2 3h11v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7V5a2 2 0 0 1 2-2h4l2 4"/></svg></span>Categorias</a>
          <a class="nav-btn" href="/espaco-contador"><span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v7"/><circle cx="12" cy="11" r="3"/><path d="M5 22h14"/><path d="M8 22v-5a4 4 0 0 1 8 0v5"/></svg></span>Espaço do Contador</a>
          <a class="nav-btn" href="/usuarios"><span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>Usuários</a>
        </nav>

        <section class="stats-grid" aria-label="Indicadores principais">
          <div class="stat-card">
            <div class="stat-icon-box orange"><span class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h4"/></svg></span></div>
            <div class="stat-content"><small>Lançamentos cadastrados</small><strong>${totalLancamentos}</strong><span>Total de registros</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon-box green"><span class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/></svg></span></div>
            <div class="stat-content"><small>Valor total lançado</small><strong>${formatMoney(valorTotal)}</strong><span>Soma geral das despesas</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon-box purple"><span class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3H4a1 1 0 0 0-1 1v5.59A2 2 0 0 0 3.59 11l9.59 9.59a2 2 0 0 0 2.82 0l4.59-4.59a2 2 0 0 0 0-2.59z"/><circle cx="7.5" cy="7.5" r="1"/></svg></span></div>
            <div class="stat-content"><small>Categorias utilizadas</small><strong>${totalCategorias}</strong><span>Categorias com movimentação</span></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon-box orange"><span class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span></div>
            <div class="stat-content"><small>Fornecedores lançados</small><strong>${totalFornecedores}</strong><span>Fornecedores com despesas</span></div>
          </div>
        </section>

        <form method="GET" action="/dashboard" class="filter-panel month-smart-form" id="dashboardMonthForm">
          <label>Filtrar mês</label>
          ${renderMonthPickerComponent({
            prefix: 'dashboard',
            selectedValue: mesDashboardSelecionado,
            fieldName: 'mes',
            allowAll: true,
            allLabel: 'Todos os meses',
            openButtonLabel: 'Escolher mês',
            applyLabel: 'Filtrar mês',
            compact: true
          })}
          <button type="button" class="btn-filter-apply" onclick="aplicarMesGlobal('dashboard')">Aplicar filtro&nbsp;⌁</button>
          <a href="/dashboard" class="btn-filter-clear">Limpar</a>
        </form>

        <section class="charts-grid">
          <article class="chart-card chart-clickable" onclick="abrirDetalheDashboard('meses')">
            <div class="chart-heading"><h2>Despesas por mês</h2><p>Últimos 6 meses · clique para detalhes</p></div>
            <div id="chartBodyMeses">${mesesHtml}</div>
          </article>

          <article class="chart-card chart-clickable" onclick="abrirDetalheDashboard('categorias')">
            <div class="chart-heading"><h2>Despesas por categoria</h2><p>Top categorias · clique para detalhes</p></div>
            <div id="chartBodyCategorias"><div class="hbar-list">${categoriasHtml}</div></div>
            <div class="chart-soft-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg></div>
          </article>

          <article class="chart-card chart-clickable" onclick="abrirDetalheDashboard('fornecedores')">
            <div class="chart-heading"><h2>Despesas por fornecedor</h2><p>Top fornecedores · clique para detalhes</p></div>
            <div id="chartBodyFornecedores"><div class="hbar-list">${fornecedoresHtml}</div></div>
            <div class="chart-soft-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
          </article>
        </section>


        <div id="dashboardDetailModal" class="dashboard-detail-modal" onclick="fecharDetalheDashboard(event)">
          <div class="dashboard-detail-card" onclick="event.stopPropagation()">
            <div class="dashboard-detail-head">
              <h2 id="dashboardDetailTitle">Detalhes</h2>
              <button type="button" class="dashboard-detail-close" onclick="fecharDetalheDashboard()">×</button>
            </div>
            <div id="dashboardDetailChart" class="dashboard-detail-chart"></div>
            <div id="dashboardDetailControls"></div>
            <div id="dashboardDetailTable"></div>
          </div>
        </div>

        <script>

        const detalhesMeses = ${detalhesMesesJson};
          const detalhesCategorias = ${detalhesCategoriasJson};
          const detalhesFornecedores = ${detalhesFornecedoresJson};

          function fmtMoedaDashboard(valor) {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0));
          }

          function escDashboard(valor) {
            return String(valor ?? '').replace(/[&<>"']/g, function (m) {
              return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m];
            });
          }

          function abrirDetalheDashboard(tipo) {
            const modal = document.getElementById('dashboardDetailModal');
            const cardModal = modal ? modal.querySelector('.dashboard-detail-card') : null;
            if (cardModal) cardModal.setAttribute('data-detail-type', tipo);
            const title = document.getElementById('dashboardDetailTitle');
            const chart = document.getElementById('dashboardDetailChart');
            const controls = document.getElementById('dashboardDetailControls');
            const table = document.getElementById('dashboardDetailTable');
            if (controls) { controls.innerHTML = ''; controls.className = ''; }

            function getMesesDisponiveis(dados) {
              const set = new Set();
              (dados || []).forEach(item => { if (item.mes_ref) set.add(item.mes_ref); });
              return Array.from(set).sort();
            }

            function renderFiltroMes(tipoFiltro, dados, onChangeName) {
              const meses = getMesesDisponiveis(dados);
              if (!controls) return 'todos';

              const opcoes = ['<option value="todos">Todos os meses</option>'].concat(
                meses.map(m => '<option value="' + escDashboard(m) + '">' + escDashboard(m) + '</option>')
              ).join('');

              controls.className = 'dashboard-detail-controls';
              controls.innerHTML =
                '<div class="dashboard-filter-box">' +
                  '<label for="dashboardFiltroMes">Filtrar mês</label>' +
                  '<select id="dashboardFiltroMes">' + opcoes + '</select>' +
                  '<button type="button" id="dashboardFiltroMesBtn" class="dashboard-filter-btn">Aplicar</button>' +
                '</div>' +
                '<div class="dashboard-detail-total">' +
                  '<small>Total do período selecionado</small>' +
                  '<strong id="dashboardTotalFiltro">' + fmtMoedaDashboard(0) + '</strong>' +
                '</div>';

              const selectFiltro = document.getElementById('dashboardFiltroMes');
              const botaoFiltro = document.getElementById('dashboardFiltroMesBtn');

              function aplicarFiltro() {
                const valorSelecionado = selectFiltro ? selectFiltro.value : 'todos';

                if (onChangeName === 'atualizarDetalheCategorias') {
                  atualizarDetalheCategorias(valorSelecionado);
                  return;
                }

                if (onChangeName === 'atualizarDetalheFornecedores') {
                  atualizarDetalheFornecedores(valorSelecionado);
                }
              }

              if (selectFiltro) selectFiltro.addEventListener('change', aplicarFiltro);
              if (botaoFiltro) botaoFiltro.addEventListener('click', aplicarFiltro);

              return 'todos';
            }

            function filtrarPorMes(dados, mes) {
              if (!mes || mes === 'todos') return dados || [];
              return (dados || []).filter(item => item.mes_ref === mes);
            }

            if (tipo === 'meses') {
              title.textContent = 'Detalhes das despesas por mês';
              chart.innerHTML = document.getElementById('chartBodyMeses')?.innerHTML || '';
              const svgMes = chart.querySelector('svg.line-chart');
              if (svgMes) {
                svgMes.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                svgMes.style.height = '260px';
              }
              table.innerHTML = '<table class="dashboard-detail-table"><thead><tr><th>Mês</th><th>Quantidade de lançamentos</th><th class="valor">Valor total</th></tr></thead><tbody>' +
                detalhesMeses.map(item => '<tr><td>' + escDashboard(item.mes_ref) + '</td><td>' + escDashboard(item.quantidade) + '</td><td class="valor">' + fmtMoedaDashboard(item.total) + '</td></tr>').join('') +
                '</tbody></table>';
            }

            if (tipo === 'categorias') {
              title.textContent = 'Detalhes das despesas por categoria';
              chart.innerHTML = document.getElementById('chartBodyCategorias')?.innerHTML || '';
              renderFiltroMes('categorias', detalhesCategorias, 'atualizarDetalheCategorias');
              atualizarDetalheCategorias('todos');
            }

            if (tipo === 'fornecedores') {
              title.textContent = 'Detalhes das despesas por fornecedor';
              chart.innerHTML = document.getElementById('chartBodyFornecedores')?.innerHTML || '';
              renderFiltroMes('fornecedores', detalhesFornecedores, 'atualizarDetalheFornecedores');
              atualizarDetalheFornecedores('todos');
            }

            modal.classList.add('is-open');
          }

          function atualizarDetalheCategorias(mesSelecionadoDetalhe) {
            const table = document.getElementById('dashboardDetailTable');
            const totalEl = document.getElementById('dashboardTotalFiltro');
            const dadosFiltrados = (!mesSelecionadoDetalhe || mesSelecionadoDetalhe === 'todos')
              ? detalhesCategorias
              : detalhesCategorias.filter(item => item.mes_ref === mesSelecionadoDetalhe);

            const totalPeriodo = dadosFiltrados.reduce((acc, item) => acc + Number(item.total || 0), 0);
            if (totalEl) totalEl.textContent = fmtMoedaDashboard(totalPeriodo);

            const grupos = {};
            dadosFiltrados.forEach(item => {
              const principal = item.categoria_principal || 'Sem categoria';
              if (!grupos[principal]) grupos[principal] = { quantidade: 0, total: 0, itens: [] };
              grupos[principal].quantidade += Number(item.quantidade || 0);
              grupos[principal].total += Number(item.total || 0);
              grupos[principal].itens.push(item);
            });

            let linhas = '';
            Object.keys(grupos).forEach(principal => {
              const grupo = grupos[principal];
              linhas += '<tr class="dashboard-detail-group"><td>' + escDashboard(principal) + '</td><td>' + grupo.quantidade + '</td><td class="valor">' + fmtMoedaDashboard(grupo.total) + '</td></tr>';
              grupo.itens.forEach(item => {
                linhas += '<tr><td style="padding-left:28px;">↳ ' + escDashboard(item.subcategoria || 'Principal') + '</td><td>' + escDashboard(item.quantidade) + '</td><td class="valor">' + fmtMoedaDashboard(item.total) + '</td></tr>';
              });
            });

            if (!linhas) linhas = '<tr><td colspan="3">Nenhuma despesa encontrada para o mês selecionado.</td></tr>';
            table.innerHTML = '<table class="dashboard-detail-table"><thead><tr><th>Categoria / Subcategoria</th><th>Quantidade</th><th class="valor">Valor total</th></tr></thead><tbody>' + linhas + '</tbody></table>';
          }

          function atualizarDetalheFornecedores(mesSelecionadoDetalhe) {
            const table = document.getElementById('dashboardDetailTable');
            const totalEl = document.getElementById('dashboardTotalFiltro');
            const dadosFiltrados = (!mesSelecionadoDetalhe || mesSelecionadoDetalhe === 'todos')
              ? detalhesFornecedores
              : detalhesFornecedores.filter(item => item.mes_ref === mesSelecionadoDetalhe);

            const totalPeriodo = dadosFiltrados.reduce((acc, item) => acc + Number(item.total || 0), 0);
            if (totalEl) totalEl.textContent = fmtMoedaDashboard(totalPeriodo);

            table.innerHTML = '<table class="dashboard-detail-table"><thead><tr><th>Fornecedor</th><th>Quantidade de lançamentos</th><th class="valor">Valor total</th></tr></thead><tbody>' +
              (dadosFiltrados.length ? dadosFiltrados.map(item => '<tr><td>' + escDashboard(item.nome) + '</td><td>' + escDashboard(item.quantidade) + '</td><td class="valor">' + fmtMoedaDashboard(item.total) + '</td></tr>').join('') : '<tr><td colspan="3">Nenhuma despesa encontrada para o mês selecionado.</td></tr>') +
              '</tbody></table>';
          }

          function fecharDetalheDashboard(event) {
            if (event && event.target && event.target.id !== 'dashboardDetailModal') return;
            document.getElementById('dashboardDetailModal')?.classList.remove('is-open');
          }

          window.abrirDetalheDashboard = abrirDetalheDashboard;
          window.fecharDetalheDashboard = fecharDetalheDashboard;
          window.atualizarDetalheCategorias = atualizarDetalheCategorias;
          window.atualizarDetalheFornecedores = atualizarDetalheFornecedores;

          document.addEventListener('DOMContentLoaded', function () {
            document.querySelectorAll('.chart-card.chart-clickable').forEach(function (card) {
              if (card.dataset.popupBound === '1') return;
              card.dataset.popupBound = '1';

              const titulo = (card.querySelector('.chart-heading h2')?.textContent || '').toLowerCase();
              let tipo = '';
              if (titulo.includes('mês') || titulo.includes('mes')) tipo = 'meses';
              if (titulo.includes('categoria')) tipo = 'categorias';
              if (titulo.includes('fornecedor')) tipo = 'fornecedores';

              if (tipo) {
                card.addEventListener('click', function () {
                  abrirDetalheDashboard(tipo);
                });
              }
            });
          });
        </script>

        <div class="footer-note">© 2024 PlennaTec. Todos os direitos reservados.</div>
      </main>
    </body>
    </html>
  `;
}


router.get('/login', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Login - Painel Contábil PlennaTec</title>
  <style>
    * {
      box-sizing: border-box;
      font-family: Arial, sans-serif;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background: linear-gradient(135deg, #f4f7fb, #e8eef7);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      color: #0f172a;
    }

    .login-page {
      width: 100%;
      max-width: 460px;
      text-align: center;
    }

    .logo {
      max-width: 320px;
      width: 85%;
      margin-bottom: 20px;
    }

    h1 {
      font-size: 28px;
      margin: 0 0 8px;
      color: #003f7d;
    }

    .subtitle {
      color: #64748b;
      margin-bottom: 16px;
      font-size: 15px;
    }

    .card {
      background: #fff;
      border-radius: 18px;
      padding: 30px;
      box-shadow: 0 20px 45px rgba(15, 23, 42, 0.12);
      text-align: left;
    }

    label {
      display: block;
      font-weight: 700;
      margin-bottom: 8px;
      color: #1e293b;
    }

    input[type="email"],
    input[type="password"],
    input[type="text"] {
      width: 100%;
      height: 48px;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 0 14px;
      font-size: 16px;
      margin-bottom: 18px;
      outline: none;
    }

    input:focus {
      border-color: #0057a8;
      box-shadow: 0 0 0 3px rgba(0, 87, 168, 0.12);
    }

    .options {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 22px;
      font-size: 14px;
      color: #475569;
    }

    .options label {
      margin: 0;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }

    button {
      width: 100%;
      height: 50px;
      border: none;
      border-radius: 14px;
      background: linear-gradient(135deg, #0057a8, #003f7d);
      color: white;
      font-size: 17px;
      font-weight: 800;
      cursor: pointer;
    }

    button:hover {
      filter: brightness(1.05);
    }

    .footer {
      text-align: center;
      margin-top: 18px;
      font-size: 13px;
      color: #64748b;
    }
  

/* ===== PADRÃO VISUAL PLENNATEC - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL PLENNATEC ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */


/* ===== REFINO FINAL LOGIN PLENNATEC ===== */
body .login-page {
  max-width: 380px !important;
}
body .login-page .logo {
  width: 416px !important;
  max-width: 94% !important;
  height: auto !important;
  margin: 0 auto 34px !important;
  display: block !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  mix-blend-mode: multiply;
}
body .login-page .login-title {
  margin: 0 0 22px !important;
  line-height: 1.08 !important;
  color: #101828 !important;
  text-align: center !important;
}
body .login-page .login-title-main {
  display: block !important;
  font-size: 23px !important;
  font-weight: 900 !important;
  letter-spacing: -0.45px !important;
  color: #101828 !important;
}
body .login-page .login-title-sub {
  display: block !important;
  margin-top: 5px !important;
  font-size: 16px !important;
  font-weight: 900 !important;
  color: #00B050 !important;
}
body .login-page .subtitle {
  margin: 18px 0 14px !important;
  font-size: 13px !important;
  color: #334155 !important;
}
body .login-page .card {
  padding: 22px 24px !important;
  border-radius: 18px !important;
}
body .login-page label {
  font-size: 13px !important;
  margin-bottom: 6px !important;
}
body .login-page input[type="email"],
body .login-page input[type="password"],
body .login-page input[type="text"] {
  height: 42px !important;
  font-size: 14px !important;
  margin-bottom: 14px !important;
}
body .login-page .options {
  gap: 8px !important;
  margin-bottom: 16px !important;
  font-size: 12px !important;
}
body .login-page .options label {
  font-size: 12px !important;
  gap: 5px !important;
  white-space: nowrap !important;
}
body .login-page button[type="submit"] {
  height: 44px !important;
  font-size: 15px !important;
}
body .login-page .footer {
  margin-top: 14px !important;
  font-size: 12px !important;
}


/* ===== AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */
/* Comprovantes Fiscais: filtros compactos para caberem em uma única linha em telas largas */
body.dm-global-page form[action="/lancamentos"] .filters {
  display: grid !important;
  grid-template-columns: 1.05fr 1.05fr 1.05fr 1.05fr 1.05fr 1fr .92fr .92fr auto !important;
  align-items: end !important;
  gap: 8px !important;
  padding: 12px 14px !important;
}

body.dm-global-page form[action="/lancamentos"] .filters > div {
  min-width: 0 !important;
}

body.dm-global-page form[action="/lancamentos"] .filters label {
  display: block !important;
  margin: 0 0 5px !important;
  font-size: 10px !important;
  line-height: 1.05 !important;
  font-weight: 900 !important;
  white-space: nowrap !important;
}

body.dm-global-page form[action="/lancamentos"] .filters input,
body.dm-global-page form[action="/lancamentos"] .filters select {
  width: 100% !important;
  min-width: 0 !important;
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 10px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons {
  display: inline-flex !important;
  align-items: end !important;
  justify-content: flex-start !important;
  gap: 7px !important;
  min-width: 142px !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons button,
body.dm-global-page form[action="/lancamentos"] .filter-buttons a {
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 13px !important;
  font-size: 11px !important;
  border-radius: 11px !important;
}

@media (max-width: 1280px) {
  body.dm-global-page form[action="/lancamentos"] .filters {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

/* Espaço do Contador: conteúdo interno da coluna Enviar Arquivo alinhado à esquerda */
.contador-premium-page .contador-table th:nth-child(4) {
  text-align: center !important;
}

.contador-premium-page .contador-table td:nth-child(4) {
  text-align: left !important;
  padding-left: 10px !important;
  padding-right: 8px !important;
}

.contador-premium-page .upload-cell-compact {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  flex-wrap: nowrap !important;
  max-width: 100% !important;
  margin-left: 0 !important;
}

.contador-premium-page .btn-upload-open {
  width: auto !important;
  min-width: 112px !important;
  height: 30px !important;
  min-height: 30px !important;
  padding: 0 12px !important;
  font-size: 10.8px !important;
  line-height: 1 !important;
  border-radius: 11px !important;
}

.contador-premium-page .upload-cell-compact .clip-indicator,
.contador-premium-page .upload-cell-compact .empty-inline,
.contador-premium-page .upload-cell-compact .attached-badge,
.contador-premium-page .upload-cell-compact .attached-empty {
  flex: 0 0 auto !important;
}
/* ===== FIM AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */

</style>
</head>

<body>
  <div class="login-page">
    <img src="/assets/logo-plennatec-login.png" class="logo" alt="PlennaTec" />

    <h1 class="login-title">
      <span class="login-title-main">Painel Contábil PlennaTec</span>
      <span class="login-title-sub">Controle hoje - Economize sempre!</span>
    </h1>
    <p class="subtitle">Acesse sua área administrativa com segurança.</p>

    <div class="card">
      <form method="POST" action="/login">
        <label for="email">E-mail</label>
        <input type="email" id="email" name="email" autocomplete="email" required />

        <label for="senha">Senha</label>
        <input type="password" id="senha" name="senha" autocomplete="current-password" required />

        <div class="options">
          <label>
            <input type="checkbox" id="lembrarLogin" />
            Salvar login
          </label>

          <label>
            <input type="checkbox" id="salvarSenha" />
            Salvar senha
          </label>

          <label>
            <input type="checkbox" id="mostrarSenha" />
            Mostrar senha
          </label>
        </div>

        <button type="submit">Entrar no Painel</button>
      </form>
    </div>

    <div class="footer">
      Plennatec Soluções Digitais Ltda
    </div>
  </div>

  <script>
    const emailInput = document.getElementById('email');
    const lembrarLogin = document.getElementById('lembrarLogin');
    const mostrarSenha = document.getElementById('mostrarSenha');
    const salvarSenha = document.getElementById('salvarSenha');
    const senhaInput = document.getElementById('senha');

    const emailSalvo = localStorage.getItem('painel_email');
    const senhaSalva = localStorage.getItem('painel_senha');

    if (emailSalvo) {
      emailInput.value = emailSalvo;
      lembrarLogin.checked = true;
    }

    if (senhaSalva) {
      senhaInput.value = senhaSalva;
      salvarSenha.checked = true;
    }

    lembrarLogin.addEventListener('change', () => {
      if (!lembrarLogin.checked) {
        localStorage.removeItem('painel_email');
      }
    });

    salvarSenha.addEventListener('change', () => {
      if (!salvarSenha.checked) {
        localStorage.removeItem('painel_senha');
      }
    });

    document.querySelector('form').addEventListener('submit', () => {
      if (lembrarLogin.checked) {
        localStorage.setItem('painel_email', emailInput.value);
      }
      if (salvarSenha.checked) {
        localStorage.setItem('painel_senha', senhaInput.value);
      }
    });

    mostrarSenha.addEventListener('change', () => {
      senhaInput.type = mostrarSenha.checked ? 'text' : 'password';
    });
  </script>
</body>
</html>
  `);
});

router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    const user = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email]
    );

    let usuario;

if (!user.rows.length) {
  usuario = {
    id: 1,
    nome: 'Genivaldo',
    email: email,
    perfil: 'ADMIN'
  };
} else {
  usuario = user.rows[0];
}
    const senhaDigitada = String(senha || '');
    const hashBanco = String(usuario.senha_hash || '');
    const senhaValida = await bcrypt.compare(senhaDigitada, hashBanco);

    if (!senhaValida) {
      return res.send(`
        <pre>
Senha inválida

Email recebido: ${email}
Senha digitada: ${senhaDigitada}
Hash banco: ${hashBanco}
Tamanho do hash: ${hashBanco.length}
        </pre>
      `);
    }

    req.session.usuario = {
      id: usuario.id,
      nome: usuario.nome,
      perfil: String(usuario.perfil || '').toUpperCase()
    };

    return res.redirect('/dashboard');
  } catch (error) {
    return res.send(`<pre>Erro no login:\n${error.message}</pre>`);
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// =============================
// GESTÃO DE USUÁRIOS
// =============================

function escapeUsuarioHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

router.get('/usuarios', protegerRota, somenteAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nome, email, perfil, criado_em
      FROM usuarios
      ORDER BY nome
    `);

    const usuarioLogadoId = req.session.usuario.id;

    const linhas = result.rows.map(user => {
      const perfilClass =
        user.perfil === 'ADMIN' ? 'perfil-admin' :
        user.perfil === 'CONTADOR' ? 'perfil-contador' :
        'perfil-usuario';

      const podeExcluir = Number(user.id) !== Number(usuarioLogadoId);

      return `
        <tr>
          <td>${escapeUsuarioHtml(user.nome)}</td>
          <td>${escapeUsuarioHtml(user.email)}</td>
          <td>
            <span class="perfil-badge ${perfilClass}">
              ${escapeUsuarioHtml(user.perfil)}
            </span>
          </td>
          <td>${user.criado_em ? new Date(user.criado_em).toLocaleDateString('pt-BR') : ''}</td>
          <td class="col-acoes">
            ${
              podeExcluir
                ? `
                  <div class="acoes-user">
  <a class="btn-icon-edit" href="/usuarios/editar/${user.id}" title="Editar">✏️</a>
  <a class="btn-icon-key" href="/usuarios/resetar-senha/${user.id}" title="Resetar senha">🔑</a>

  <form method="POST" action="/usuarios/excluir/${user.id}" onsubmit="return confirm('Tem certeza que deseja excluir este usuário?');">
    <button type="submit" class="btn-icon-danger" title="Excluir">🗑️</button>
  </form>
</div>
                `
                : `<span class="meu-usuario">Você</span>`
            }
          </td>
        </tr>
      `;
    }).join('');

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Usuários - PlennaTec</title>
        <style>
          * { box-sizing: border-box; }

          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: radial-gradient(circle at top left, #eef4ff 0%, #f7f9fc 35%, #eef2f7 100%);
            color: #111827;
          }

          .container {
            max-width: 1200px;
            margin: 32px auto;
            padding: 0 20px 40px;
          }

          .hero {
            background: linear-gradient(135deg, #ffffff 0%, #f8fbff 100%);
            border: 1px solid #e5e7eb;
            border-radius: 24px;
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
            padding: 28px;
            margin-bottom: 24px;
          }

          .hero-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 20px;
            flex-wrap: wrap;
            margin-bottom: 22px;
          }

          h1 {
            margin: 0 0 8px 0;
            font-size: 30px;
            color: #0f172a;
          }

          .subtitle {
            margin: 0;
            color: #64748b;
            font-size: 15px;
          }

          .actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            text-decoration: none;
            padding: 12px 18px;
            border-radius: 14px;
            font-weight: 700;
            font-size: 14px;
            border: none;
            cursor: pointer;
            box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
          }

          .btn-blue {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: white;
          }

          .btn-dark {
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: white;
          }

          .btn-green {
            background: linear-gradient(135deg, #2e7d32, #1b5e20);
            color: white;
          }

          .grid {
            display: grid;
            grid-template-columns: 380px 1fr;
            gap: 20px;
          }

          .card {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 18px;
            padding: 22px;
            box-shadow: 0 14px 28px rgba(15, 23, 42, 0.05);
          }

          .card h2 {
            margin: 0 0 16px 0;
            font-size: 18px;
            color: #1e293b;
          }

          label {
            display: block;
            font-size: 13px;
            font-weight: 700;
            color: #334155;
            margin-bottom: 6px;
          }

          input, select {
            width: 100%;
            padding: 12px 14px;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            font-size: 14px;
            background: white;
            color: #0f172a;
            margin-bottom: 14px;
          }

          .hint {
            font-size: 10px;
            color: #64748b;
            margin-top: -8px;
            margin-bottom: 14px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th, td {
            padding: 13px 12px;
            border-bottom: 1px solid #e5e7eb;
            text-align: left;
            vertical-align: middle;
            font-size: 14px;
          }

          th {
            background: #f8fafc;
            color: #334155;
            font-size: 13px;
          }

          tr:hover {
            background: #f9fafb;
          }

          .perfil-badge {
            display: inline-block;
            padding: 6px 11px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 700;
          }

          .perfil-admin {
            background: #fee2e2;
            color: #991b1b;
            border: 1px solid #fecaca;
          }

          .perfil-usuario {
            background: #dbeafe;
            color: #1e40af;
            border: 1px solid #bfdbfe;
          }

          .perfil-contador {
            background: #dcfce7;
            color: #166534;
            border: 1px solid #86efac;
          }

          .col-acoes {
            width: 90px;
            text-align: center;
          }

          .btn-icon-danger {
            border: none;
            background: transparent;
            cursor: pointer;
            font-size: 16px;
          }
.acoes-user {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.btn-icon-edit,
.btn-icon-key {
  text-decoration: none;
  font-size: 16px;
  cursor: pointer;
}

.btn-icon-edit:hover,
.btn-icon-key:hover {
  transform: scale(1.12);
}

          .btn-icon-danger:hover {
            transform: scale(1.12);
          }

          .meu-usuario {
            display: inline-block;
            padding: 5px 9px;
            border-radius: 999px;
            background: #f3f4f6;
            color: #6b7280;
            font-size: 10px;
            font-weight: 700;
          }

          @media (max-width: 950px) {
            .grid {
              grid-template-columns: 1fr;
            }
          }
        

/* ===== PADRÃO VISUAL PLENNATEC - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL PLENNATEC ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */



/* ===== AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */
/* Comprovantes Fiscais: filtros compactos para caberem em uma única linha em telas largas */
body.dm-global-page form[action="/lancamentos"] .filters {
  display: grid !important;
  grid-template-columns: 1.05fr 1.05fr 1.05fr 1.05fr 1.05fr 1fr .92fr .92fr auto !important;
  align-items: end !important;
  gap: 8px !important;
  padding: 12px 14px !important;
}

body.dm-global-page form[action="/lancamentos"] .filters > div {
  min-width: 0 !important;
}

body.dm-global-page form[action="/lancamentos"] .filters label {
  display: block !important;
  margin: 0 0 5px !important;
  font-size: 10px !important;
  line-height: 1.05 !important;
  font-weight: 900 !important;
  white-space: nowrap !important;
}

body.dm-global-page form[action="/lancamentos"] .filters input,
body.dm-global-page form[action="/lancamentos"] .filters select {
  width: 100% !important;
  min-width: 0 !important;
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 10px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons {
  display: inline-flex !important;
  align-items: end !important;
  justify-content: flex-start !important;
  gap: 7px !important;
  min-width: 142px !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons button,
body.dm-global-page form[action="/lancamentos"] .filter-buttons a {
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 13px !important;
  font-size: 11px !important;
  border-radius: 11px !important;
}

@media (max-width: 1280px) {
  body.dm-global-page form[action="/lancamentos"] .filters {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

/* Espaço do Contador: conteúdo interno da coluna Enviar Arquivo alinhado à esquerda */
.contador-premium-page .contador-table th:nth-child(4) {
  text-align: center !important;
}

.contador-premium-page .contador-table td:nth-child(4) {
  text-align: left !important;
  padding-left: 10px !important;
  padding-right: 8px !important;
}

.contador-premium-page .upload-cell-compact {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  flex-wrap: nowrap !important;
  max-width: 100% !important;
  margin-left: 0 !important;
}

.contador-premium-page .btn-upload-open {
  width: auto !important;
  min-width: 112px !important;
  height: 30px !important;
  min-height: 30px !important;
  padding: 0 12px !important;
  font-size: 10.8px !important;
  line-height: 1 !important;
  border-radius: 11px !important;
}

.contador-premium-page .upload-cell-compact .clip-indicator,
.contador-premium-page .upload-cell-compact .empty-inline,
.contador-premium-page .upload-cell-compact .attached-badge,
.contador-premium-page .upload-cell-compact .attached-empty {
  flex: 0 0 auto !important;
}
/* ===== FIM AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */

</style>
      </head>

      <body class="dm-global-page">
        ${renderGlobalHeader(req, { titulo: 'Usuários', subtitulo: 'Gerencie perfis de acesso, permissões e usuários do sistema.', paginaAtual: 'usuarios' })}
        <div class="container">
          <section class="hero">
            <div class="hero-top">
              <div>
                <h1>👥 Gestão de Usuários</h1>
                <p class="subtitle">Controle de acesso do sistema PlannaTec.</p>
              </div>

              <div class="actions">
                <a class="btn btn-dark" href="/dashboard">Voltar ao Painel</a>
                <a class="btn btn-dark" href="/logout">🚪 Sair</a>
              </div>
            </div>

            <div class="grid">
              <div class="card">
                <h2>Novo usuário</h2>

                <form method="POST" action="/usuarios/novo">
                  <label for="nome">Nome</label>
                  <input id="nome" name="nome" placeholder="Nome do usuário" required />

                  <label for="email">E-mail</label>
                  <input id="email" name="email" type="email" placeholder="email@empresa.com" required />

                  <label for="senha">Senha inicial</label>
                  <input id="senha" name="senha" type="password" placeholder="Senha inicial" required />
                  <div class="hint">Depois o usuário poderá receber uma nova senha se necessário.</div>

                  <label for="perfil">Perfil</label>
                  <select id="perfil" name="perfil" required>
                    <option value="USUARIO">Usuário padrão</option>
                    <option value="CONTADOR">Contador</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>

                  <button class="btn btn-green" type="submit">➕ Criar usuário</button>
                </form>
              </div>

              <div class="card">
                <h2>Usuários cadastrados</h2>

                <table>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>E-mail</th>
                      <th>Perfil</th>
                      <th>Criado em</th>
                      <th class="col-acoes">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${linhas || '<tr><td colspan="5">Nenhum usuário cadastrado.</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

        </div>

      </body>
      </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao carregar usuários:\n${error.message}</pre>`);
  }
});

router.post('/usuarios/novo', protegerRota, somenteAdmin, async (req, res) => {
  try {
    const { nome, email, senha, perfil } = req.body;

    const perfilPermitido = ['ADMIN', 'USUARIO', 'CONTADOR'].includes(String(perfil || '').toUpperCase())
      ? String(perfil).toUpperCase()
      : 'USUARIO';

    const senhaHash = await bcrypt.hash(String(senha || ''), 10);

    await pool.query(`
      INSERT INTO usuarios (nome, email, senha_hash, perfil)
      VALUES ($1, $2, $3, $4)
    `, [
      nome,
      String(email || '').trim().toLowerCase(),
      senhaHash,
      perfilPermitido
    ]);

    res.redirect('/usuarios');
  } catch (error) {
    if (error.code === '23505') {
      return res.send('<pre>Já existe um usuário cadastrado com este e-mail.</pre>');
    }

    res.send(`<pre>Erro ao criar usuário:\n${error.message}</pre>`);
  }
});

router.post('/usuarios/excluir/:id', protegerRota, somenteAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (Number(id) === Number(req.session.usuario.id)) {
      return res.send('<pre>Você não pode excluir o próprio usuário logado.</pre>');
    }

    await pool.query(`
      DELETE FROM usuarios
      WHERE id = $1
    `, [id]);

    res.redirect('/usuarios');
  } catch (error) {
    res.send(`<pre>Erro ao excluir usuário:\n${error.message}</pre>`);
  }
});

router.get('/usuarios/editar/:id', protegerRota, somenteAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT id, nome, email, perfil
      FROM usuarios
      WHERE id = $1
    `, [id]);

    if (!result.rows.length) {
      return res.send('<pre>Usuário não encontrado.</pre>');
    }

    const user = result.rows[0];

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Editar Usuário</title>
        <style>
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #f6f8fb;
            color: #111827;
          }

          .container {
            max-width: 620px;
            margin: 50px auto;
            padding: 0 20px;
          }

          .card {
            background: white;
            border-radius: 18px;
            padding: 28px;
            box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
            border: 1px solid #e5e7eb;
          }

          h1 {
            margin-top: 0;
            font-size: 28px;
          }

          label {
            display: block;
            font-weight: 700;
            margin-bottom: 6px;
            color: #334155;
          }

          input, select {
            width: 100%;
            padding: 12px 14px;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            font-size: 14px;
            margin-bottom: 16px;
          }

          .actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .btn {
            border: none;
            text-decoration: none;
            padding: 12px 18px;
            border-radius: 14px;
            font-weight: 700;
            cursor: pointer;
            font-size: 14px;
          }

          .btn-green {
            background: #1b5e20;
            color: white;
          }

          .btn-dark {
            background: #111827;
            color: white;
          }
        

/* ===== PADRÃO VISUAL PLENNATEC - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL PLENNATEC ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */



/* ===== AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */
/* Comprovantes Fiscais: filtros compactos para caberem em uma única linha em telas largas */
body.dm-global-page form[action="/lancamentos"] .filters {
  display: grid !important;
  grid-template-columns: 1.05fr 1.05fr 1.05fr 1.05fr 1.05fr 1fr .92fr .92fr auto !important;
  align-items: end !important;
  gap: 8px !important;
  padding: 12px 14px !important;
}

body.dm-global-page form[action="/lancamentos"] .filters > div {
  min-width: 0 !important;
}

body.dm-global-page form[action="/lancamentos"] .filters label {
  display: block !important;
  margin: 0 0 5px !important;
  font-size: 10px !important;
  line-height: 1.05 !important;
  font-weight: 900 !important;
  white-space: nowrap !important;
}

body.dm-global-page form[action="/lancamentos"] .filters input,
body.dm-global-page form[action="/lancamentos"] .filters select {
  width: 100% !important;
  min-width: 0 !important;
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 10px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons {
  display: inline-flex !important;
  align-items: end !important;
  justify-content: flex-start !important;
  gap: 7px !important;
  min-width: 142px !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons button,
body.dm-global-page form[action="/lancamentos"] .filter-buttons a {
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 13px !important;
  font-size: 11px !important;
  border-radius: 11px !important;
}

@media (max-width: 1280px) {
  body.dm-global-page form[action="/lancamentos"] .filters {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

/* Espaço do Contador: conteúdo interno da coluna Enviar Arquivo alinhado à esquerda */
.contador-premium-page .contador-table th:nth-child(4) {
  text-align: center !important;
}

.contador-premium-page .contador-table td:nth-child(4) {
  text-align: left !important;
  padding-left: 10px !important;
  padding-right: 8px !important;
}

.contador-premium-page .upload-cell-compact {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  flex-wrap: nowrap !important;
  max-width: 100% !important;
  margin-left: 0 !important;
}

.contador-premium-page .btn-upload-open {
  width: auto !important;
  min-width: 112px !important;
  height: 30px !important;
  min-height: 30px !important;
  padding: 0 12px !important;
  font-size: 10.8px !important;
  line-height: 1 !important;
  border-radius: 11px !important;
}

.contador-premium-page .upload-cell-compact .clip-indicator,
.contador-premium-page .upload-cell-compact .empty-inline,
.contador-premium-page .upload-cell-compact .attached-badge,
.contador-premium-page .upload-cell-compact .attached-empty {
  flex: 0 0 auto !important;
}
/* ===== FIM AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */

</style>
      </head>
      <body class="dm-global-page">
        ${renderGlobalHeader(req, { titulo: 'Editar Usuário', subtitulo: 'Atualize nome, e-mail e perfil do usuário selecionado.', paginaAtual: 'usuarios' })}
        <div class="container">
          <div class="card">
            <h1>✏️ Editar Usuário</h1>

            <form method="POST" action="/usuarios/editar/${user.id}">
              <label>Nome</label>
              <input name="nome" value="${user.nome || ''}" required />

              <label>E-mail</label>
              <input name="email" type="email" value="${user.email || ''}" required />

              <label>Perfil</label>
              <select name="perfil" required>
                <option value="USUARIO" ${user.perfil === 'USUARIO' ? 'selected' : ''}>Usuário padrão</option>
                <option value="CONTADOR" ${user.perfil === 'CONTADOR' ? 'selected' : ''}>Contador</option>
                <option value="ADMIN" ${user.perfil === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
              </select>

              <div class="actions">
                <button class="btn btn-green" type="submit">Salvar alterações</button>
                <a class="btn btn-dark" href="/usuarios">Voltar</a>
              </div>
            </form>
          </div>
        </div>
        <script>
          function abrirModalUpload(id) {
            const modal = document.getElementById(id);
            if (modal) modal.classList.add('is-open');
          }

          function fecharModalUpload(id) {
            const modal = document.getElementById(id);
            if (!modal) return;
            modal.classList.remove('is-open');
            const input = modal.querySelector('input[type="file"]');
            const preview = modal.querySelector('[data-preview-list]');
            if (input) input.value = '';
            if (preview) preview.innerHTML = '<div class="modal-empty">Nenhum arquivo selecionado.</div>';
          }

          function atualizarPreviewArquivos(input) {
            const form = input.closest('form');
            const list = form ? form.querySelector('[data-preview-list]') : null;
            if (!list) return;

            const dt = new DataTransfer();
            Array.from(input.files || []).forEach(file => dt.items.add(file));
            input.files = dt.files;

            renderPreview(input, list);
          }

          function renderPreview(input, list) {
            const files = Array.from(input.files || []);
            if (!files.length) {
              list.innerHTML = '<div class="modal-empty">Nenhum arquivo selecionado.</div>';
              return;
            }

            list.innerHTML = '';
            files.forEach((file, index) => {
              const row = document.createElement('div');
              row.className = 'modal-file-row';

              const name = document.createElement('span');
              name.textContent = file.name;
              name.title = file.name;

              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'modal-delete';
              btn.title = 'Remover da seleção';
              btn.textContent = '🗑';
              btn.onclick = function () {
                const novo = new DataTransfer();
                Array.from(input.files || []).forEach((item, i) => {
                  if (i !== index) novo.items.add(item);
                });
                input.files = novo.files;
                renderPreview(input, list);
              };

              row.appendChild(name);
              row.appendChild(btn);
              list.appendChild(row);
            });
          }

          document.addEventListener('click', function(event) {
            if (event.target && event.target.classList && event.target.classList.contains('upload-modal-overlay')) {
              event.target.classList.remove('is-open');
            }
          });
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao abrir edição de usuário:\n${error.message}</pre>`);
  }
});

router.post('/usuarios/editar/:id', protegerRota, somenteAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, email, perfil } = req.body;

    const perfilPermitido = ['ADMIN', 'USUARIO', 'CONTADOR'].includes(String(perfil || '').toUpperCase())
      ? String(perfil).toUpperCase()
      : 'USUARIO';

    await pool.query(`
      UPDATE usuarios
      SET nome = $1,
          email = $2,
          perfil = $3
      WHERE id = $4
    `, [
      nome,
      String(email || '').trim().toLowerCase(),
      perfilPermitido,
      id
    ]);

    res.redirect('/usuarios');
  } catch (error) {
    res.send(`<pre>Erro ao salvar usuário:\n${error.message}</pre>`);
  }
});

router.get('/usuarios/resetar-senha/:id', protegerRota, somenteAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT id, nome, email
      FROM usuarios
      WHERE id = $1
    `, [id]);

    if (!result.rows.length) {
      return res.send('<pre>Usuário não encontrado.</pre>');
    }

    const user = result.rows[0];

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Resetar Senha</title>
        <style>
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #f6f8fb;
            color: #111827;
          }

          .container {
            max-width: 620px;
            margin: 50px auto;
            padding: 0 20px;
          }

          .card {
            background: white;
            border-radius: 18px;
            padding: 28px;
            box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
            border: 1px solid #e5e7eb;
          }

          h1 {
            margin-top: 0;
            font-size: 28px;
          }

          .info {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 14px;
            margin-bottom: 18px;
            color: #334155;
          }

          label {
            display: block;
            font-weight: 700;
            margin-bottom: 6px;
            color: #334155;
          }

          input {
            width: 100%;
            padding: 12px 14px;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            font-size: 14px;
            margin-bottom: 16px;
          }

          .actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .btn {
            border: none;
            text-decoration: none;
            padding: 12px 18px;
            border-radius: 14px;
            font-weight: 700;
            cursor: pointer;
            font-size: 14px;
          }

          .btn-blue {
            background: #2563eb;
            color: white;
          }

          .btn-dark {
            background: #111827;
            color: white;
          }
        

/* ===== PADRÃO VISUAL PLENNATEC - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== PADRÃO DEFINITIVO BOTÕES (CINZA + LARANJA ESTRATÉGICO) ===== */

.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

/* 🔘 BOTÃO PADRÃO (CINZA) */
.actions .btn,
.actions a,
.actions button,
.filter-buttons a,
.top-bar .filters a,
button,
.btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

/* 🟠 BOTÕES PRINCIPAIS (AÇÃO) */
.actions .btn-primary,
button.btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"] {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

/* REMOVE herança de laranja global */
.btn:not(.btn-primary):not(.btn-danger):not(.btn-icon-danger) {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
}

/* FORM inline (não quebrar layout) */
.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}

/* ===== FIM PADRÃO ===== */

/* ===== FIM PADRÃO VISUAL PLENNATEC ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */



/* ===== AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */
/* Comprovantes Fiscais: filtros compactos para caberem em uma única linha em telas largas */
body.dm-global-page form[action="/lancamentos"] .filters {
  display: grid !important;
  grid-template-columns: 1.05fr 1.05fr 1.05fr 1.05fr 1.05fr 1fr .92fr .92fr auto !important;
  align-items: end !important;
  gap: 8px !important;
  padding: 12px 14px !important;
}

body.dm-global-page form[action="/lancamentos"] .filters > div {
  min-width: 0 !important;
}

body.dm-global-page form[action="/lancamentos"] .filters label {
  display: block !important;
  margin: 0 0 5px !important;
  font-size: 10px !important;
  line-height: 1.05 !important;
  font-weight: 900 !important;
  white-space: nowrap !important;
}

body.dm-global-page form[action="/lancamentos"] .filters input,
body.dm-global-page form[action="/lancamentos"] .filters select {
  width: 100% !important;
  min-width: 0 !important;
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 10px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons {
  display: inline-flex !important;
  align-items: end !important;
  justify-content: flex-start !important;
  gap: 7px !important;
  min-width: 142px !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons button,
body.dm-global-page form[action="/lancamentos"] .filter-buttons a {
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 13px !important;
  font-size: 11px !important;
  border-radius: 11px !important;
}

@media (max-width: 1280px) {
  body.dm-global-page form[action="/lancamentos"] .filters {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

/* Espaço do Contador: conteúdo interno da coluna Enviar Arquivo alinhado à esquerda */
.contador-premium-page .contador-table th:nth-child(4) {
  text-align: center !important;
}

.contador-premium-page .contador-table td:nth-child(4) {
  text-align: left !important;
  padding-left: 10px !important;
  padding-right: 8px !important;
}

.contador-premium-page .upload-cell-compact {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  flex-wrap: nowrap !important;
  max-width: 100% !important;
  margin-left: 0 !important;
}

.contador-premium-page .btn-upload-open {
  width: auto !important;
  min-width: 112px !important;
  height: 30px !important;
  min-height: 30px !important;
  padding: 0 12px !important;
  font-size: 10.8px !important;
  line-height: 1 !important;
  border-radius: 11px !important;
}

.contador-premium-page .upload-cell-compact .clip-indicator,
.contador-premium-page .upload-cell-compact .empty-inline,
.contador-premium-page .upload-cell-compact .attached-badge,
.contador-premium-page .upload-cell-compact .attached-empty {
  flex: 0 0 auto !important;
}
/* ===== FIM AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */

</style>
      </head>
      <body class="dm-global-page">
        ${renderGlobalHeader(req, { titulo: 'Resetar Senha', subtitulo: 'Defina uma nova senha para o usuário selecionado.', paginaAtual: 'usuarios' })}
        <div class="container">
          <div class="card">
            <h1>🔑 Resetar Senha</h1>

            <div class="info">
              <strong>${user.nome}</strong><br>
              ${user.email}
            </div>

            <form method="POST" action="/usuarios/resetar-senha/${user.id}">
              <label>Nova senha</label>
              <input name="nova_senha" type="password" placeholder="Digite a nova senha" required />

              <div class="actions">
                <button class="btn btn-dark" type="submit">Salvar nova senha</button>
                <a class="btn btn-dark" href="/usuarios">Voltar</a>
              </div>
            </form>
          </div>
        </div>
        <script>
          function abrirModalUpload(id) {
            const modal = document.getElementById(id);
            if (modal) modal.classList.add('is-open');
          }

          function fecharModalUpload(id) {
            const modal = document.getElementById(id);
            if (!modal) return;
            modal.classList.remove('is-open');
            const input = modal.querySelector('input[type="file"]');
            const preview = modal.querySelector('[data-preview-list]');
            if (input) input.value = '';
            if (preview) preview.innerHTML = '<div class="modal-empty">Nenhum arquivo selecionado.</div>';
          }

          function atualizarPreviewArquivos(input) {
            const form = input.closest('form');
            const list = form ? form.querySelector('[data-preview-list]') : null;
            if (!list) return;

            const dt = new DataTransfer();
            Array.from(input.files || []).forEach(file => dt.items.add(file));
            input.files = dt.files;

            renderPreview(input, list);
          }

          function renderPreview(input, list) {
            const files = Array.from(input.files || []);
            if (!files.length) {
              list.innerHTML = '<div class="modal-empty">Nenhum arquivo selecionado.</div>';
              return;
            }

            list.innerHTML = '';
            files.forEach((file, index) => {
              const row = document.createElement('div');
              row.className = 'modal-file-row';

              const name = document.createElement('span');
              name.textContent = file.name;
              name.title = file.name;

              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'modal-delete';
              btn.title = 'Remover da seleção';
              btn.textContent = '🗑';
              btn.onclick = function () {
                const novo = new DataTransfer();
                Array.from(input.files || []).forEach((item, i) => {
                  if (i !== index) novo.items.add(item);
                });
                input.files = novo.files;
                renderPreview(input, list);
              };

              row.appendChild(name);
              row.appendChild(btn);
              list.appendChild(row);
            });
          }

          document.addEventListener('click', function(event) {
            if (event.target && event.target.classList && event.target.classList.contains('upload-modal-overlay')) {
              event.target.classList.remove('is-open');
            }
          });
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao abrir reset de senha:\n${error.message}</pre>`);
  }
});

router.post('/usuarios/resetar-senha/:id', protegerRota, somenteAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const novaSenha = String(
      req.body.nova_senha || req.body.senha || req.body.password || ''
    ).trim();

    if (!novaSenha) {
      return res.send('<pre>Informe uma nova senha válida.</pre>');
    }

    const senhaHash = await bcrypt.hash(novaSenha, 10);

    await pool.query(`
      UPDATE usuarios
      SET senha_hash = $1
      WHERE id = $2
    `, [senhaHash, id]);

    res.redirect('/usuarios');
  } catch (error) {
    res.send(`<pre>Erro ao resetar senha:\n${error.message}</pre>`);
  }
});

// DASHBOARD
router.get('/dashboard', protegerRota, async (req, res) => {
  try {
    const { mes = '' } = req.query;

    let whereFiltro = '';
    let valuesFiltro = [];

    if (mes) {
      valuesFiltro.push(`${mes}-01`);
      whereFiltro = `
        WHERE data_despesa >= DATE_TRUNC('month', $1::date)
          AND data_despesa < DATE_TRUNC('month', $1::date) + INTERVAL '1 month'
      `;
    }

    const [
      totalResult,
      valorTotalResult,
      categoriasResult,
      fornecedoresResult,
      categoriasGraficoResult,
      fornecedoresGraficoResult,
      mesesGraficoResult,
      detalhesMesesResult,
      detalhesCategoriasResult,
      detalhesFornecedoresResult
    ] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM lancamentos
        ${whereFiltro}
      `, valuesFiltro),

      pool.query(`
        SELECT COALESCE(SUM(valor), 0)::numeric AS total
        FROM lancamentos
        ${whereFiltro}
      `, valuesFiltro),

      pool.query(`
        SELECT COUNT(DISTINCT categoria_id)::int AS total
        FROM lancamentos
        ${whereFiltro ? whereFiltro + ' AND categoria_id IS NOT NULL' : 'WHERE categoria_id IS NOT NULL'}
      `, valuesFiltro),

      pool.query(`
        SELECT COUNT(DISTINCT fornecedor)::int AS total
        FROM lancamentos
        ${whereFiltro ? whereFiltro + " AND fornecedor IS NOT NULL AND TRIM(fornecedor) <> ''" : "WHERE fornecedor IS NOT NULL AND TRIM(fornecedor) <> ''"}
      `, valuesFiltro),

      pool.query(`
        SELECT
          COALESCE(c.nome, 'Sem categoria') AS nome,
          COALESCE(SUM(l.valor), 0)::numeric AS total
        FROM lancamentos l
        LEFT JOIN categorias c ON c.id = l.categoria_id
        ${whereFiltro ? whereFiltro.replace(/data_despesa/g, 'l.data_despesa') : ''}
        GROUP BY COALESCE(c.nome, 'Sem categoria')
        ORDER BY total DESC
        LIMIT 6
      `, valuesFiltro),

      pool.query(`
        SELECT
          COALESCE(NULLIF(TRIM(fornecedor), ''), 'Sem fornecedor') AS nome,
          COALESCE(SUM(valor), 0)::numeric AS total
        FROM lancamentos
        ${whereFiltro}
        GROUP BY COALESCE(NULLIF(TRIM(fornecedor), ''), 'Sem fornecedor')
        ORDER BY total DESC
        LIMIT 6
      `, valuesFiltro),

      pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', data_despesa), 'YYYY-MM') AS mes_ref,
          COUNT(*)::int AS quantidade,
          COALESCE(SUM(valor), 0)::numeric AS total
        FROM lancamentos
        WHERE data_despesa IS NOT NULL
          AND data_despesa >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
        GROUP BY DATE_TRUNC('month', data_despesa)
        ORDER BY DATE_TRUNC('month', data_despesa)
      `),

      pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', data_despesa), 'YYYY-MM') AS mes_ref,
          COUNT(*)::int AS quantidade,
          COALESCE(SUM(valor), 0)::numeric AS total
        FROM lancamentos
        WHERE data_despesa IS NOT NULL
          AND data_despesa >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
        GROUP BY DATE_TRUNC('month', data_despesa)
        ORDER BY DATE_TRUNC('month', data_despesa)
      `),

      pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', l.data_despesa), 'YYYY-MM') AS mes_ref,
          COALESCE(p.nome, c.nome, 'Sem categoria') AS categoria_principal,
          CASE
            WHEN p.nome IS NOT NULL THEN COALESCE(c.nome, 'Sem subcategoria')
            ELSE 'Principal'
          END AS subcategoria,
          COUNT(l.id)::int AS quantidade,
          COALESCE(SUM(l.valor), 0)::numeric AS total
        FROM lancamentos l
        LEFT JOIN categorias c ON c.id = l.categoria_id
        LEFT JOIN categorias p ON p.id = c.categoria_pai_id
        ${whereFiltro ? whereFiltro.replace(/data_despesa/g, 'l.data_despesa') : 'WHERE l.data_despesa IS NOT NULL'}
        GROUP BY
          DATE_TRUNC('month', l.data_despesa),
          COALESCE(p.nome, c.nome, 'Sem categoria'),
          CASE
            WHEN p.nome IS NOT NULL THEN COALESCE(c.nome, 'Sem subcategoria')
            ELSE 'Principal'
          END
        ORDER BY mes_ref DESC, categoria_principal ASC, total DESC
      `, valuesFiltro),

      pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', data_despesa), 'YYYY-MM') AS mes_ref,
          COALESCE(NULLIF(TRIM(fornecedor), ''), 'Sem fornecedor') AS nome,
          COUNT(*)::int AS quantidade,
          COALESCE(SUM(valor), 0)::numeric AS total
        FROM lancamentos
        ${whereFiltro || 'WHERE data_despesa IS NOT NULL'}
        GROUP BY DATE_TRUNC('month', data_despesa), COALESCE(NULLIF(TRIM(fornecedor), ''), 'Sem fornecedor')
        ORDER BY mes_ref DESC, total DESC
      `, valuesFiltro)
    ]);

    const hoje = new Date();
    const mesesBase = [];

    for (let i = 5; i >= 0; i--) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);

      const ano = data.getFullYear();
      const mesNum = String(data.getMonth() + 1).padStart(2, '0');
      const mesRef = `${ano}-${mesNum}`;

      const label = data.toLocaleDateString('pt-BR', {
        month: 'short',
        year: '2-digit'
      });

      mesesBase.push({
        mes_ref: mesRef,
        label: label.replace('.', ''),
        total: 0,
        quantidade: 0
      });
    }

    const mesesMap = new Map(
      mesesGraficoResult.rows.map(item => [item.mes_ref, {
        total: Number(item.total || 0),
        quantidade: Number(item.quantidade || 0)
      }])
    );

    const meses = mesesBase.map(item => {
      const atual = mesesMap.get(item.mes_ref) || { total: 0, quantidade: 0 };
      return {
        mes_ref: item.mes_ref,
        label: item.label,
        quantidade: atual.quantidade,
        total: atual.total
      };
    });

    res.send(renderDashboard({
      totalLancamentos: totalResult.rows[0]?.total || 0,
      valorTotal: valorTotalResult.rows[0]?.total || 0,
      totalCategorias: categoriasResult.rows[0]?.total || 0,
      totalFornecedores: fornecedoresResult.rows[0]?.total || 0,
      meses,
      categorias: categoriasGraficoResult.rows.map(item => ({
        nome: item.nome,
        total: Number(item.total || 0)
      })),
      fornecedores: fornecedoresGraficoResult.rows.map(item => ({
        nome: item.nome,
        total: Number(item.total || 0)
      })),
      detalhesMeses: detalhesMesesResult.rows.map(item => ({
        mes_ref: item.mes_ref,
        quantidade: Number(item.quantidade || 0),
        total: Number(item.total || 0)
      })),
      detalhesCategorias: detalhesCategoriasResult.rows.map(item => ({
        mes_ref: item.mes_ref,
        categoria_principal: item.categoria_principal,
        subcategoria: item.subcategoria,
        quantidade: Number(item.quantidade || 0),
        total: Number(item.total || 0)
      })),
      detalhesFornecedores: detalhesFornecedoresResult.rows.map(item => ({
        mes_ref: item.mes_ref,
        nome: item.nome,
        quantidade: Number(item.quantidade || 0),
        total: Number(item.total || 0)
      })),
      mesSelecionado: mes,
      usuario: req.session?.usuario || {}
    }));
  } catch (error) {
    res.send(`<pre>Erro ao carregar dashboard:\n${error.message}</pre>`);
  }
});

// =============================
// ARQUIVO
// =============================
router.get('/documentos', protegerRota, async (req, res) => {
  try {
    const docs = await pool.query(`
      SELECT
        d.*,
        l.id AS lancamento_relacionado
      FROM documentos_fiscais d
      LEFT JOIN lancamentos l ON l.id = d.lancamento_id
      ORDER BY d.id DESC
    `);

    let linhas = '';
    docs.rows.forEach(d => {
      const dataFormatada = d.data_documento
        ? new Date(d.data_documento).toISOString().split('T')[0]
        : '';

      const pdfHtml = d.anexo_pdf
  ? `
    <a class="icon-btn" href="/uploads/${d.anexo_pdf}" target="_blank" title="Ver PDF">👁</a>
    <a class="icon-btn" href="/uploads/${d.anexo_pdf}" download title="Baixar PDF">⬇</a>
  `
  : '<span style="color:#6b7280;">—</span>';

      const xmlHtml = d.anexo_xml
  ? `
    <a class="icon-btn" href="/uploads/${d.anexo_xml}" target="_blank" title="Ver XML">👁</a>
    <a class="icon-btn" href="/uploads/${d.anexo_xml}" download title="Baixar XML">⬇</a>
  `
  : '<span style="color:#6b7280;">—</span>';
      const acaoLancamento = d.lancamento_id
  ? `<span style="color:#166534; font-weight:bold;">Lançado #${d.lancamento_id}</span>`
  : `<a class="icon-btn" href="/documentos/gerar-lancamento/${d.id}" title="Gerar lançamento">🧾</a>`;

      linhas += `
        <tr>
          <td>${d.id}</td>
          <td>${d.tipo_documento || ''}</td>
          <td>${d.numero_documento || ''}</td>
          <td>${dataFormatada}</td>
          <td>${d.fornecedor || ''}</td>
          <td>${d.cnpj_cpf || ''}</td>
          <td style="text-align:right;">${formatMoneyBR(d.valor || 0)}</td>
          <td>${d.status}</td>
          <td>${d.origem_layout || ''}</td>
          <td>${pdfHtml}</td>
          <td>${xmlHtml}</td>
          <td>${acaoLancamento}</td>
        </tr>
      `;
    });

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Arquivo</title>
        <style>
          * { box-sizing: border-box; }
          body {
  margin: 0;
  font-family: Arial, sans-serif;
  font-size: 13px;
  background: #f4f6f8;
  color: #111827;
}
          .container { max-width: 1800px; margin: 40px auto; padding: 0 20px; }
          .card { background: white; border-radius: 14px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); padding: 24px; margin-bottom: 20px; }
          h1 { margin-top: 0; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
          .full { grid-column: 1 / -1; }
          label { display: block; margin-bottom: 6px; font-weight: bold; font-size: 14px; }
          input, select { width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 15px; }
          .actions { margin-top: 20px; display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
          button, a {
            text-decoration: none;
            padding: 12px 18px;
            border-radius: 10px;
            font-weight: bold;
            border: none;
            cursor: pointer;
            display: inline-block;
          }
          button { background: #2563eb; color: white; }
          .btn-primary { background: #2563eb; color: white; }
          .btn-secondary { background: #e5e7eb; color: #111827; }
          table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 12px; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
          th { background: #2563eb; color: white; }
         tr:nth-child(even) td {
  background: #fbfcfe;
}

tr:hover td {
  background: #f3f7ff;
}
          .icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-right: 4px;
  border-radius: 8px;
  text-decoration: none;
  font-size: 10px;
  background: transparent;
  color: #334155;
  border: none;
}

.icon-btn:hover {
  background: #eef2ff;
}
          .hint { font-size: 13px; color: #6b7280; margin-top: 6px; }
/* ===== REFINO VISUAL DOCUMENTOS ===== */

/* fundo mais suave */
body {
  background: #f8fafc;
}

/* tabela mais leve */
th {
  background: #f1f5f9;
  color: #334155;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

/* linhas mais suaves */
td {
  border-bottom: 1px solid #f1f5f9;
}

/* hover mais elegante */
tr:hover td {
  background: #f9fafb;
}

/* remover peso dos ícones */
.icon-btn {
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  border: none !important;
  padding: 0 !important;
  width: 18px;
  height: 18px;
  color: #64748b;
}

.icon-btn:hover {
  background: transparent !important;
  color: #1d4ed8;
  transform: scale(1.08);
}
        

/* ===== PADRÃO VISUAL PLENNATEC - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL PLENNATEC ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */



/* ===== AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */
/* Comprovantes Fiscais: filtros compactos para caberem em uma única linha em telas largas */
body.dm-global-page form[action="/lancamentos"] .filters {
  display: grid !important;
  grid-template-columns: 1.05fr 1.05fr 1.05fr 1.05fr 1.05fr 1fr .92fr .92fr auto !important;
  align-items: end !important;
  gap: 8px !important;
  padding: 12px 14px !important;
}

body.dm-global-page form[action="/lancamentos"] .filters > div {
  min-width: 0 !important;
}

body.dm-global-page form[action="/lancamentos"] .filters label {
  display: block !important;
  margin: 0 0 5px !important;
  font-size: 10px !important;
  line-height: 1.05 !important;
  font-weight: 900 !important;
  white-space: nowrap !important;
}

body.dm-global-page form[action="/lancamentos"] .filters input,
body.dm-global-page form[action="/lancamentos"] .filters select {
  width: 100% !important;
  min-width: 0 !important;
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 10px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons {
  display: inline-flex !important;
  align-items: end !important;
  justify-content: flex-start !important;
  gap: 7px !important;
  min-width: 142px !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons button,
body.dm-global-page form[action="/lancamentos"] .filter-buttons a {
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 13px !important;
  font-size: 11px !important;
  border-radius: 11px !important;
}

@media (max-width: 1280px) {
  body.dm-global-page form[action="/lancamentos"] .filters {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

/* Espaço do Contador: conteúdo interno da coluna Enviar Arquivo alinhado à esquerda */
.contador-premium-page .contador-table th:nth-child(4) {
  text-align: center !important;
}

.contador-premium-page .contador-table td:nth-child(4) {
  text-align: left !important;
  padding-left: 10px !important;
  padding-right: 8px !important;
}

.contador-premium-page .upload-cell-compact {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  flex-wrap: nowrap !important;
  max-width: 100% !important;
  margin-left: 0 !important;
}

.contador-premium-page .btn-upload-open {
  width: auto !important;
  min-width: 112px !important;
  height: 30px !important;
  min-height: 30px !important;
  padding: 0 12px !important;
  font-size: 10.8px !important;
  line-height: 1 !important;
  border-radius: 11px !important;
}

.contador-premium-page .upload-cell-compact .clip-indicator,
.contador-premium-page .upload-cell-compact .empty-inline,
.contador-premium-page .upload-cell-compact .attached-badge,
.contador-premium-page .upload-cell-compact .attached-empty {
  flex: 0 0 auto !important;
}
/* ===== FIM AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */

</style>
      </head>
      <body class="dm-global-page">
        ${renderGlobalHeader(req, { titulo: 'Arquivo de Comprovantes Fiscais', subtitulo: 'Importe, consulte e gere lançamentos a partir dos arquivos de comprovantes fiscais.', paginaAtual: 'documentos' })}
        <div class="container">
          <div class="card">
            <h1>📁 Arquivo</h1>

            <form method="POST" action="/documentos/importar" enctype="multipart/form-data">
              <div class="grid">
                <div>
                  <label for="anexo_xml">XML</label>
                  <input id="anexo_xml" type="file" name="anexo_xml" accept=".xml,text/xml,application/xml" />
                </div>

                <div>
                  <label for="anexo_pdf">PDF</label>
                  <input id="anexo_pdf" type="file" name="anexo_pdf" accept=".pdf" />
                </div>

                <div class="full">
                  <div class="hint">Você pode subir só XML, só PDF, ou os dois. Mesmo quando o XML não for reconhecido, o documento será guardado.</div>
                </div>
              </div>

              <div class="actions">
                <button type="submit">Importar documento</button>
                <a class="btn-secondary" href="/dashboard">Voltar ao Painel</a>
              </div>
            </form>
          </div>

          <div class="card">
            <table>
              <tr>
                <th>ID</th>
                <th>Tipo</th>
                <th>Número</th>
                <th>Data</th>
                <th>Fornecedor</th>
                <th>CNPJ/CPF</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Layout</th>
                <th>PDF</th>
                <th>XML</th>
                <th>Ação</th>
              </tr>
              ${linhas || '<tr><td colspan="12">Nenhum documento importado.</td></tr>'}
            </table>
          </div>
        </div>
        <script>
          function abrirModalUpload(id) {
            const modal = document.getElementById(id);
            if (modal) modal.classList.add('is-open');
          }

          function fecharModalUpload(id) {
            const modal = document.getElementById(id);
            if (!modal) return;
            modal.classList.remove('is-open');
            const input = modal.querySelector('input[type="file"]');
            const preview = modal.querySelector('[data-preview-list]');
            if (input) input.value = '';
            if (preview) preview.innerHTML = '<div class="modal-empty">Nenhum arquivo selecionado.</div>';
          }

          function atualizarPreviewArquivos(input) {
            const form = input.closest('form');
            const list = form ? form.querySelector('[data-preview-list]') : null;
            if (!list) return;

            const dt = new DataTransfer();
            Array.from(input.files || []).forEach(file => dt.items.add(file));
            input.files = dt.files;

            renderPreview(input, list);
          }

          function renderPreview(input, list) {
            const files = Array.from(input.files || []);
            if (!files.length) {
              list.innerHTML = '<div class="modal-empty">Nenhum arquivo selecionado.</div>';
              return;
            }

            list.innerHTML = '';
            files.forEach((file, index) => {
              const row = document.createElement('div');
              row.className = 'modal-file-row';

              const name = document.createElement('span');
              name.textContent = file.name;
              name.title = file.name;

              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'modal-delete';
              btn.title = 'Remover da seleção';
              btn.textContent = '🗑';
              btn.onclick = function () {
                const novo = new DataTransfer();
                Array.from(input.files || []).forEach((item, i) => {
                  if (i !== index) novo.items.add(item);
                });
                input.files = novo.files;
                renderPreview(input, list);
              };

              row.appendChild(name);
              row.appendChild(btn);
              list.appendChild(row);
            });
          }

          document.addEventListener('click', function(event) {
            if (event.target && event.target.classList && event.target.classList.contains('upload-modal-overlay')) {
              event.target.classList.remove('is-open');
            }
          });
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao carregar documentos:\n${error.message}</pre>`);
  }
});

router.post(
  '/documentos/importar',
  upload.fields([
    { name: 'anexo_pdf', maxCount: 1 },
    { name: 'anexo_xml', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const anexoPdf = req.files && req.files.anexo_pdf ? req.files.anexo_pdf[0].filename : null;
      const anexoXml = req.files && req.files.anexo_xml ? req.files.anexo_xml[0].filename : null;

      let dados = {
        tipo_documento: '',
        numero_documento: '',
        data_documento: '',
        fornecedor: '',
        cnpj_cpf: '',
        valor: '',
        status: 'Nao reconhecido',
        origem_layout: '',
        erro_leitura: null
      };

      if (req.files && req.files.anexo_xml) {
        try {
          const filePath = req.files.anexo_xml[0].path;
          dados = await parseXmlDocumento(filePath);
        } catch (error) {
          dados.status = 'Nao reconhecido';
          dados.origem_layout = 'Erro na leitura';
          dados.erro_leitura = error.message;
        }
      }

      if (!anexoXml && !anexoPdf) {
        return res.send('<pre>Nenhum arquivo foi enviado.</pre>');
      }

      await pool.query(
        `INSERT INTO documentos_fiscais
        (tipo_documento, numero_documento, data_documento, fornecedor, cnpj_cpf, valor, anexo_pdf, anexo_xml, status, origem_layout, erro_leitura)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          dados.tipo_documento || null,
          dados.numero_documento || null,
          dados.data_documento || null,
          dados.fornecedor || null,
          dados.cnpj_cpf || null,
          dados.valor || null,
          anexoPdf,
          anexoXml,
          dados.status || 'Nao reconhecido',
          dados.origem_layout || null,
          dados.erro_leitura || null
        ]
      );

      res.redirect('/documentos');
    } catch (error) {
      res.send(`<pre>Erro ao importar documento:\n${error.message}</pre>`);
    }
  }
);

router.get('/documentos/gerar-lancamento/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const docResult = await pool.query(
      'SELECT * FROM documentos_fiscais WHERE id = $1',
      [id]
    );

    if (!docResult.rows.length) {
      return res.send('<pre>Documento não encontrado.</pre>');
    }

    const doc = docResult.rows[0];
    const optionsCategorias = await getCategoriasOptions();

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Gerar lançamento</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; font-family: Arial, sans-serif; background: #f4f6f8; color: #111827; }
          .container { max-width: 900px; margin: 40px auto; padding: 0 20px; }
          .card { background: white; border-radius: 14px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); padding: 24px; }
          h1 { margin-top: 0; margin-bottom: 20px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
          .full { grid-column: 1 / -1; }
          label { display: block; margin-bottom: 6px; font-weight: bold; font-size: 14px; }
          input, select { width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 15px; }
          .actions { margin-top: 20px; display: flex; gap: 8px; flex-wrap: wrap; }
          button, a {
            text-decoration: none;
            padding: 12px 18px;
            border-radius: 10px;
            font-weight: bold;
            border: none;
            cursor: pointer;
            display: inline-block;
          }
          button { background: #2563eb; color: white; }
          .btn-secondary { background: #e5e7eb; color: #111827; }
/* ===== VISUAL PREMIUM /DOCUMENTOS ===== */
body {
  background: #f8fafc;
  color: #1f2937;
  font-size: 13px;
}

.card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 4px 12px rgba(0,0,0,0.04);
}

h1 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

label {
  font-size: 10px;
  font-weight: 600;
  color: #374151;
}

input, select {
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: #fff;
}

input:focus, select:focus {
  outline: none;
  border-color: #2563eb;
}

button, .btn {
  font-size: 13px;
  padding: 8px 14px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

table {
  font-size: 13px;
  border-collapse: collapse;
  width: 100%;
}

th {
  background: #f1f5f9;
  color: #334155;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  text-align: left;
}

th, td {
  padding: 8px 10px;
  border-bottom: 1px solid #f1f5f9;
}

tr:hover {
  background: #f9fafb;
}

/* ===== ÍCONES LEVES ===== */
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin: 0 3px;
  border: none !important;
  background: transparent !important;
  font-size: 14px;
  color: #64748b;
  cursor: pointer;
}

.icon-btn:hover {
  color: #1d4ed8;
  transform: scale(1.08);
}
        

/* ===== PADRÃO VISUAL PLENNATEC - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL PLENNATEC ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */



/* ===== AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */
/* Comprovantes Fiscais: filtros compactos para caberem em uma única linha em telas largas */
body.dm-global-page form[action="/lancamentos"] .filters {
  display: grid !important;
  grid-template-columns: 1.05fr 1.05fr 1.05fr 1.05fr 1.05fr 1fr .92fr .92fr auto !important;
  align-items: end !important;
  gap: 8px !important;
  padding: 12px 14px !important;
}

body.dm-global-page form[action="/lancamentos"] .filters > div {
  min-width: 0 !important;
}

body.dm-global-page form[action="/lancamentos"] .filters label {
  display: block !important;
  margin: 0 0 5px !important;
  font-size: 10px !important;
  line-height: 1.05 !important;
  font-weight: 900 !important;
  white-space: nowrap !important;
}

body.dm-global-page form[action="/lancamentos"] .filters input,
body.dm-global-page form[action="/lancamentos"] .filters select {
  width: 100% !important;
  min-width: 0 !important;
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 10px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons {
  display: inline-flex !important;
  align-items: end !important;
  justify-content: flex-start !important;
  gap: 7px !important;
  min-width: 142px !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons button,
body.dm-global-page form[action="/lancamentos"] .filter-buttons a {
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 13px !important;
  font-size: 11px !important;
  border-radius: 11px !important;
}

@media (max-width: 1280px) {
  body.dm-global-page form[action="/lancamentos"] .filters {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

/* Espaço do Contador: conteúdo interno da coluna Enviar Arquivo alinhado à esquerda */
.contador-premium-page .contador-table th:nth-child(4) {
  text-align: center !important;
}

.contador-premium-page .contador-table td:nth-child(4) {
  text-align: left !important;
  padding-left: 10px !important;
  padding-right: 8px !important;
}

.contador-premium-page .upload-cell-compact {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  flex-wrap: nowrap !important;
  max-width: 100% !important;
  margin-left: 0 !important;
}

.contador-premium-page .btn-upload-open {
  width: auto !important;
  min-width: 112px !important;
  height: 30px !important;
  min-height: 30px !important;
  padding: 0 12px !important;
  font-size: 10.8px !important;
  line-height: 1 !important;
  border-radius: 11px !important;
}

.contador-premium-page .upload-cell-compact .clip-indicator,
.contador-premium-page .upload-cell-compact .empty-inline,
.contador-premium-page .upload-cell-compact .attached-badge,
.contador-premium-page .upload-cell-compact .attached-empty {
  flex: 0 0 auto !important;
}
/* ===== FIM AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */

</style>
      </head>
      <body class="dm-global-page">
        ${renderGlobalHeader(req, { titulo: 'Gerar lançamento', subtitulo: 'Converta o documento fiscal selecionado em lançamento financeiro.', paginaAtual: 'documentos' })}
        <div class="container">
          <div class="card">
            <h1>🧾 Gerar lançamento a partir do documento #${doc.id}</h1>

            <form method="POST" action="/documentos/gerar-lancamento/${doc.id}">
              <div class="grid">
                <div>
                  <label for="tipo_documento">Tipo do documento</label>
                  <select id="tipo_documento" name="tipo_documento" required>
                    ${renderTipoDocumentoOptions(doc.tipo_documento)}
                  </select>
                </div>

                <div>
                  <label for="numero_documento">Número do documento</label>
                  <input id="numero_documento" name="numero_documento" value="${doc.numero_documento || ''}" />
                </div>

                <div>
                  <label for="data_despesa">Data</label>
                  <input id="data_despesa" type="date" name="data_despesa" value="${doc.data_documento ? new Date(doc.data_documento).toISOString().split('T')[0] : ''}" required />
                </div>

                <div>
                  <label for="valor">Valor</label>
                  <input id="valor" name="valor" type="text" inputmode="decimal" value="${formatValorInputBR(doc.valor)}" placeholder="R$ 0,00" required />
                </div>

                <div class="full">
                  <label for="fornecedor">Fornecedor</label>
                  <input id="fornecedor" name="fornecedor" value="${doc.fornecedor || ''}" required />
                </div>

                <div>
                  <label for="cnpj_cpf">CNPJ/CPF</label>
                  <input id="cnpj_cpf" name="cnpj_cpf" value="${doc.cnpj_cpf || ''}" />
                </div>

                <div>
                  <label for="codigo_pagamento">Código de pagamento</label>
                  <input id="codigo_pagamento" name="codigo_pagamento" />
                </div>

                <div>
                  <label for="tipo_pagamento">Tipo de pagamento</label>
                  <select id="tipo_pagamento" name="tipo_pagamento" required>
                    <option value="">Selecione o pagamento</option>
                    <option value="PIX">PIX</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Guia">Guia</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="DEB">DEB</option>
                    <option value="DOP">DOP</option>
                    <option value="CAR Inter">CAR Inter</option>
                    <option value="CAR VISA CX">CAR VISA CX</option>
                    <option value="CAR ELO CX">CAR ELO CX</option>
                    <option value="CAR Outro">CAR Outro</option>
                  </select>
                </div>

                <div>
                  <label for="categoria_id">Categoria</label>
                  <select id="categoria_id" name="categoria_id" required>
                    ${optionsCategorias}
                  </select>
                </div>
              </div>

              <div class="actions">
                <button type="submit">Criar lançamento</button>
                <a class="btn-secondary" href="/documentos">Cancelar</a>
              </div>
            </form>
          </div>
        </div>
        <script>
          function abrirModalUpload(id) {
            const modal = document.getElementById(id);
            if (modal) modal.classList.add('is-open');
          }

          function fecharModalUpload(id) {
            const modal = document.getElementById(id);
            if (!modal) return;
            modal.classList.remove('is-open');
            const input = modal.querySelector('input[type="file"]');
            const preview = modal.querySelector('[data-preview-list]');
            if (input) input.value = '';
            if (preview) preview.innerHTML = '<div class="modal-empty">Nenhum arquivo selecionado.</div>';
          }

          function atualizarPreviewArquivos(input) {
            const form = input.closest('form');
            const list = form ? form.querySelector('[data-preview-list]') : null;
            if (!list) return;

            const dt = new DataTransfer();
            Array.from(input.files || []).forEach(file => dt.items.add(file));
            input.files = dt.files;

            renderPreview(input, list);
          }

          function renderPreview(input, list) {
            const files = Array.from(input.files || []);
            if (!files.length) {
              list.innerHTML = '<div class="modal-empty">Nenhum arquivo selecionado.</div>';
              return;
            }

            list.innerHTML = '';
            files.forEach((file, index) => {
              const row = document.createElement('div');
              row.className = 'modal-file-row';

              const name = document.createElement('span');
              name.textContent = file.name;
              name.title = file.name;

              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'modal-delete';
              btn.title = 'Remover da seleção';
              btn.textContent = '🗑';
              btn.onclick = function () {
                const novo = new DataTransfer();
                Array.from(input.files || []).forEach((item, i) => {
                  if (i !== index) novo.items.add(item);
                });
                input.files = novo.files;
                renderPreview(input, list);
              };

              row.appendChild(name);
              row.appendChild(btn);
              list.appendChild(row);
            });
          }

          document.addEventListener('click', function(event) {
            if (event.target && event.target.classList && event.target.classList.contains('upload-modal-overlay')) {
              event.target.classList.remove('is-open');
            }
          });
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao abrir geração de lançamento:\n${error.message}</pre>`);
  }
});

router.post('/documentos/gerar-lancamento/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const docResult = await pool.query(
      'SELECT * FROM documentos_fiscais WHERE id = $1',
      [id]
    );

    if (!docResult.rows.length) {
      return res.send('<pre>Documento não encontrado.</pre>');
    }

    const doc = docResult.rows[0];

    const {
      tipo_documento,
      numero_documento,
      data_despesa,
      fornecedor,
      cnpj_cpf,
      codigo_pagamento,
      valor,
      tipo_pagamento,
      categoria_id
    } = req.body;

    const lancamentoResult = await pool.query(
      `INSERT INTO lancamentos
      (tipo_documento, numero_documento, data_despesa, fornecedor, cnpj_cpf, codigo_pagamento, categoria_id, valor, tipo_pagamento, anexo_pdf, anexo_xml)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id`,
      [
        tipo_documento,
        numero_documento || null,
        data_despesa,
        fornecedor,
        cnpj_cpf || null,
        codigo_pagamento || null,
        categoria_id,
        valor,
        tipo_pagamento,
        doc.anexo_pdf || null,
        doc.anexo_xml || null
      ]
    );

    const lancamentoId = lancamentoResult.rows[0].id;

    await pool.query(
      `UPDATE documentos_fiscais
       SET status = 'Lancado',
           lancamento_id = $1
       WHERE id = $2`,
      [lancamentoId, id]
    );

    res.redirect('/documentos');
  } catch (error) {
    res.send(`<pre>Erro ao gerar lançamento:\n${error.message}</pre>`);
  }
});

// =============================
// CONTAS A PAGAR
// =============================
    
router.get('/novo', async (req, res) => {
  try {
    const { rotina_id = '' } = req.query;

    const categoriasResult = await pool.query(`
      SELECT
        c.id,
        c.nome,
        c.categoria_pai_id,
        p.nome AS categoria_pai_nome
      FROM categorias c
      LEFT JOIN categorias p ON p.id = c.categoria_pai_id
      ORDER BY
        COALESCE(p.nome, c.nome),
        c.categoria_pai_id NULLS FIRST,
        c.nome
    `);

    const categorias = categoriasResult.rows;

    let rotinaPadrao = null;

    if (rotina_id) {
      const rotinaResult = await pool.query(`
        SELECT
          r.*,
          cp.nome AS categoria_principal_nome,
          cs.nome AS subcategoria_nome
        FROM rotina_despesas r
        LEFT JOIN categorias cp ON cp.id = r.categoria_principal_id
        LEFT JOIN categorias cs ON cs.id = r.subcategoria_id
        WHERE r.id = $1
        LIMIT 1
      `, [rotina_id]);

      if (rotinaResult.rows.length) {
        rotinaPadrao = rotinaResult.rows[0];
      }
    }

    const categoriaSelecionada = rotinaPadrao?.subcategoria_id || rotinaPadrao?.categoria_principal_id || '';

    let optionsCategorias = '<option value="">Selecione a categoria</option>';
    categorias.forEach(cat => {
      const selected = String(categoriaSelecionada) === String(cat.id) ? 'selected' : '';
      const nomeExibicao = cat.categoria_pai_nome
        ? `${cat.categoria_pai_nome} > ${cat.nome}`
        : cat.nome;

      optionsCategorias += `<option value="${cat.id}" ${selected}>${nomeExibicao}</option>`;
    });

    const fornecedorPadrao = rotinaPadrao?.fornecedor || '';
    const cnpjCpfPadrao = rotinaPadrao?.cnpj_cpf || '';
    const tipoPagamentoPadrao = rotinaPadrao?.tipo_pagamento_padrao || '';

    const origemInfo = rotinaPadrao
      ? `
        <div style="
          margin-bottom: 16px;
          padding: 12px 14px;
          border-radius: 10px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1e3a8a;
          font-size: 13px;
        ">
          Lançamento iniciado a partir da rotina:
          <strong>${rotinaPadrao.fornecedor || 'Sem fornecedor'}</strong>
          ${rotinaPadrao.categoria_principal_nome ? ` | Categoria principal: <strong>${rotinaPadrao.categoria_principal_nome}</strong>` : ''}
          ${rotinaPadrao.subcategoria_nome ? ` | Subcategoria: <strong>${rotinaPadrao.subcategoria_nome}</strong>` : ''}
          ${rotinaPadrao.tipo_pagamento_padrao ? ` | Pagamento padrão: <strong>${rotinaPadrao.tipo_pagamento_padrao}</strong>` : ''}
        </div>
      `
      : '';

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Novo lançamento</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: linear-gradient(180deg, #f8fbff 0%, #f3f6fb 100%);
            color: #111827;
          }
          .container {
            max-width: 900px;
            margin: 24px auto;
            padding: 0 16px;
          }
          .card {
            background: rgba(255,255,255,0.95);
            border-radius: 18px;
            box-shadow: 0 8px 30px rgba(15, 23, 42, 0.06);
            padding: 24px;
            border: 1px solid #e8eef7;
          }
          h1 {
            margin-top: 0;
            margin-bottom: 20px;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
          }
          .full {
            grid-column: 1 / -1;
          }
          label {
            display: block;
            margin-bottom: 6px;
            font-weight: bold;
            font-size: 14px;
          }
          input, select {
            width: 100%;
            padding: 12px;
            border: 1px solid #d1d5db;
            border-radius: 10px;
            font-size: 15px;
          }
          .actions {
            margin-top: 20px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }
          button, a {
            text-decoration: none;
            padding: 12px 18px;
            border-radius: 10px;
            font-weight: bold;
            border: none;
            cursor: pointer;
            display: inline-block;
          }
          button {
            background: #2563eb;
            color: white;
          }
          .btn-secondary {
            background: #e5e7eb;
            color: #111827;
          }
          .field-hint {
            margin-top: 6px;
            font-size: 10px;
            color: #6b7280;
          }
        

/* ===== PADRÃO VISUAL PLENNATEC - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL PLENNATEC ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */



          .nf-paste-box {
            margin: 16px 0 18px;
            padding: 16px;
            border-radius: 16px;
            border: 1px solid #dce3ec;
            background: rgba(255,255,255,0.76);
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
          }
          .nf-paste-box h3 {
            margin: 0 0 6px;
            font-size: 15px;
            color: #101828;
          }
          .nf-paste-box p {
            margin: 0 0 12px;
            font-size: 12px;
            color: #64748b;
            line-height: 1.35;
          }
          .nf-paste-box textarea {
            width: 100%;
            min-height: 112px;
            resize: vertical;
            padding: 12px;
            border: 1px solid #d1d5db;
            border-radius: 12px;
            font-size: 13px;
            font-family: Arial, sans-serif;
            background: rgba(255,255,255,0.94);
          }
          .nf-paste-actions {
            margin-top: 10px;
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
          }
          .nf-paste-msg {
            font-size: 12px;
            font-weight: 700;
          }
          .nf-paste-msg.ok { color: #047857; }
          .nf-paste-msg.warn { color: #92400e; }

          /* ===== COPIAR DO PDF - MODAL COM POP-UP FLUTUANTE ===== */
          .pdf-copy-btn {
            background: linear-gradient(135deg, #0f766e, #059669) !important;
            color: #ffffff !important;
          }
          .pdf-copy-modal {
            display: none;
            position: fixed;
            inset: 0;
            z-index: 99999;
            background: rgba(15, 23, 42, 0.88);
          }
          .pdf-copy-modal.active { display: block; }
          .pdf-copy-viewer-wrap {
            position: absolute;
            inset: 14px;
            border-radius: 14px;
            overflow: hidden;
            background: #ffffff;
            box-shadow: 0 22px 60px rgba(0,0,0,.35);
          }
          .pdf-copy-viewer {
            width: 100%;
            height: 100%;
            border: 0;
            background: #ffffff;
          }
          .pdf-copy-empty {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 30px;
            color: #475569;
            font-weight: 800;
            background: #f8fafc;
          }
          .pdf-copy-panel {
            position: absolute;
            top: 72px;
            right: 42px;
            width: min(470px, calc(100vw - 38px));
            background: rgba(255,255,255,.96);
            border: 2px solid #00B050;
            border-radius: 14px;
            box-shadow: 0 18px 45px rgba(0,0,0,.28);
            padding: 14px;
            cursor: default;
            user-select: none;
          }
          .pdf-copy-panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            cursor: move;
            padding-bottom: 10px;
            border-bottom: 1px solid #dbe7df;
            margin-bottom: 10px;
          }
          .pdf-copy-panel-header strong {
            color: #2f7d20;
            font-size: 19px;
          }
          .pdf-copy-close {
            width: 34px;
            height: 34px;
            border-radius: 10px !important;
            padding: 0 !important;
            background: #fee2e2 !important;
            color: #991b1b !important;
            border: 1px solid #fecaca !important;
            box-shadow: none !important;
          }
          .pdf-copy-file-row {
            display: flex;
            gap: 8px;
            align-items: center;
            margin-bottom: 10px;
          }
          .pdf-copy-file-row input {
            width: 100%;
            font-size: 12px;
            padding: 9px !important;
          }
          .pdf-copy-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }
          .pdf-copy-grid .full { grid-column: 1 / -1; }
          .pdf-copy-panel label {
            margin: 0 0 4px;
            font-size: 12px;
            color: #0f172a;
          }
          .pdf-copy-panel input,
          .pdf-copy-panel select {
            padding: 9px 10px !important;
            font-size: 13px !important;
            border-radius: 8px !important;
          }
          .pdf-copy-actions {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            margin-top: 12px;
            flex-wrap: wrap;
          }
          .pdf-copy-actions button {
            min-height: 38px !important;
            padding: 0 14px !important;
          }
          .pdf-copy-help {
            margin: 8px 0 0;
            color: #64748b;
            font-size: 11px;
            line-height: 1.35;
            user-select: text;
          }
          @media(max-width: 760px) {
            .pdf-copy-viewer-wrap { inset: 8px; }
            .pdf-copy-panel { top: 58px; left: 14px; right: auto; width: calc(100vw - 28px); }
            .pdf-copy-grid { grid-template-columns: 1fr; }
          }



/* ===== AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */
/* Comprovantes Fiscais: filtros compactos para caberem em uma única linha em telas largas */
body.dm-global-page form[action="/lancamentos"] .filters {
  display: grid !important;
  grid-template-columns: 1.05fr 1.05fr 1.05fr 1.05fr 1.05fr 1fr .92fr .92fr auto !important;
  align-items: end !important;
  gap: 8px !important;
  padding: 12px 14px !important;
}

body.dm-global-page form[action="/lancamentos"] .filters > div {
  min-width: 0 !important;
}

body.dm-global-page form[action="/lancamentos"] .filters label {
  display: block !important;
  margin: 0 0 5px !important;
  font-size: 10px !important;
  line-height: 1.05 !important;
  font-weight: 900 !important;
  white-space: nowrap !important;
}

body.dm-global-page form[action="/lancamentos"] .filters input,
body.dm-global-page form[action="/lancamentos"] .filters select {
  width: 100% !important;
  min-width: 0 !important;
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 10px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons {
  display: inline-flex !important;
  align-items: end !important;
  justify-content: flex-start !important;
  gap: 7px !important;
  min-width: 142px !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons button,
body.dm-global-page form[action="/lancamentos"] .filter-buttons a {
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 13px !important;
  font-size: 11px !important;
  border-radius: 11px !important;
}

@media (max-width: 1280px) {
  body.dm-global-page form[action="/lancamentos"] .filters {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

/* Espaço do Contador: conteúdo interno da coluna Enviar Arquivo alinhado à esquerda */
.contador-premium-page .contador-table th:nth-child(4) {
  text-align: center !important;
}

.contador-premium-page .contador-table td:nth-child(4) {
  text-align: left !important;
  padding-left: 10px !important;
  padding-right: 8px !important;
}

.contador-premium-page .upload-cell-compact {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  flex-wrap: nowrap !important;
  max-width: 100% !important;
  margin-left: 0 !important;
}

.contador-premium-page .btn-upload-open {
  width: auto !important;
  min-width: 112px !important;
  height: 30px !important;
  min-height: 30px !important;
  padding: 0 12px !important;
  font-size: 10.8px !important;
  line-height: 1 !important;
  border-radius: 11px !important;
}

.contador-premium-page .upload-cell-compact .clip-indicator,
.contador-premium-page .upload-cell-compact .empty-inline,
.contador-premium-page .upload-cell-compact .attached-badge,
.contador-premium-page .upload-cell-compact .attached-empty {
  flex: 0 0 auto !important;
}
/* ===== FIM AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */

</style>
      </head>
      <body class="dm-global-page">
        ${renderGlobalHeader(req, { titulo: 'Novo Lançamento', subtitulo: 'Cadastre uma nova despesa com anexos, categoria, fornecedor e pagamento.', paginaAtual: 'novo' })}
        <div class="container">
          <div class="card">
            <h1>➕ Novo lançamento</h1>

            ${origemInfo}

            <div class="nf-paste-box">
              <h3>📋 Colar conteúdo da NF</h3>
              <p>Abra o PDF da nota, selecione tudo, copie e cole aqui. Depois clique em preencher. Se não reconhecer, preencha manualmente.</p>
              <textarea id="texto_nf_colado" placeholder="Cole aqui o texto copiado da NF..."></textarea>
              <div class="nf-paste-actions">
                <button type="button" onclick="preencherPorTextoNF()">Preencher automaticamente</button>
                <button type="button" class="pdf-copy-btn" onclick="abrirCopiarDoPDF()">📄 Copiar do PDF</button>
                <button type="button" class="btn-secondary" onclick="limparTextoNF()">Limpar texto</button>
                <span id="nf_paste_msg" class="nf-paste-msg"></span>
              </div>
            </div>

            <form id="novoLancamentoForm" method="POST" action="/novo" enctype="multipart/form-data">
              <input type="hidden" name="rotina_id" value="${rotinaPadrao?.id || ''}">

              <div class="grid">
                <div>
                  <label for="tipo_documento">Tipo do documento</label>
                  <select id="tipo_documento" name="tipo_documento" required>
                    ${renderTipoDocumentoOptions()}
                  </select>
                </div>

                <div>
                  <label for="numero_documento">Número do documento</label>
                  <input id="numero_documento" name="numero_documento" placeholder="Ex.: NF12341" />
                </div>

                <div>
                  <label for="data_despesa">Data</label>
                  <input id="data_despesa" type="date" name="data_despesa" required />
                </div>

                <div>
                  <label for="valor">Valor</label>
                  <input id="valor" name="valor" type="text" inputmode="decimal" placeholder="R$ 0,00" required />
                </div>

                <div class="full">
                  <label for="fornecedor">Fornecedor</label>
                  <input
                    id="fornecedor"
                    name="fornecedor"
                    placeholder="Nome do fornecedor"
                    value="${fornecedorPadrao}"
                    required
                  />
                </div>

                <div>
                  <label for="cnpj_cpf">CNPJ/CPF</label>
                  <input id="cnpj_cpf" name="cnpj_cpf" placeholder="Informe o CNPJ ou CPF" value="${cnpjCpfPadrao}" />
                </div>

                <div>
                  <label for="codigo_pagamento">Código de pagamento</label>
                  <input id="codigo_pagamento" name="codigo_pagamento" placeholder="Ex.: NSU, referência" />
                </div>

                <div>
                  <label for="tipo_pagamento">Tipo de pagamento</label>
                  <select id="tipo_pagamento" name="tipo_pagamento" required>
                    <option value="">Selecione o pagamento</option>
                    <option value="PIX" ${tipoPagamentoPadrao === 'PIX' ? 'selected' : ''}>PIX</option>
                    <option value="Boleto" ${tipoPagamentoPadrao === 'Boleto' ? 'selected' : ''}>Boleto</option>
                    <option value="Guia" ${tipoPagamentoPadrao === 'Guia' ? 'selected' : ''}>Guia</option>
                    <option value="Dinheiro" ${tipoPagamentoPadrao === 'Dinheiro' ? 'selected' : ''}>Dinheiro</option>
                    <option value="DEB" ${tipoPagamentoPadrao === 'DEB' ? 'selected' : ''}>DEB</option>
                    <option value="DOP" ${tipoPagamentoPadrao === 'DOP' ? 'selected' : ''}>DOP</option>
                    <option value="CAR Inter" ${tipoPagamentoPadrao === 'CAR Inter' ? 'selected' : ''}>CAR Inter</option>
                    <option value="CAR VISA CX" ${tipoPagamentoPadrao === 'CAR VISA CX' ? 'selected' : ''}>CAR VISA CX</option>
                    <option value="CAR ELO CX" ${tipoPagamentoPadrao === 'CAR ELO CX' ? 'selected' : ''}>CAR ELO CX</option>
                    <option value="CAR Outro" ${tipoPagamentoPadrao === 'CAR Outro' ? 'selected' : ''}>CAR Outro</option>
                  </select>
                </div>

                <div>
                  <label for="categoria_id">Categoria</label>
                  <select id="categoria_id" name="categoria_id" required>
                    ${optionsCategorias}
                  </select>
                </div>

                <div>
                  <label for="anexo_pdf">PDF</label>
                  <input id="anexo_pdf" type="file" name="anexo_pdf" accept=".pdf" />
                </div>

                <div>
                  <label for="anexo_xml">XML</label>
                  <input id="anexo_xml" type="file" name="anexo_xml" accept=".xml,text/xml,application/xml" />
                  <div class="field-hint">Anexe o XML para salvar junto com o lançamento e disponibilizar para download depois.</div>
                </div>
              </div>

              <div class="actions">
                <button type="submit">Salvar</button>
                <a class="btn-secondary" href="/rotina-despesas">Voltar para Lista de Contas à pagar</a>
              </div>
            </form>
          </div>
        </div>

        <div id="pdfCopyModal" class="pdf-copy-modal" aria-hidden="true">
          <div class="pdf-copy-viewer-wrap">
            <iframe id="pdfCopyViewer" class="pdf-copy-viewer" title="Visualizador do PDF"></iframe>
            <div id="pdfCopyEmpty" class="pdf-copy-empty">
              <div>
                <div style="font-size:22px;margin-bottom:8px;">📄 Selecione o PDF</div>
                <div>Use o botão “Escolher PDF” no quadro flutuante para abrir a nota em tela cheia.</div>
              </div>
            </div>
          </div>

          <div id="pdfCopyPanel" class="pdf-copy-panel">
            <div id="pdfCopyDragHandle" class="pdf-copy-panel-header">
              <strong>Preencher</strong>
              <button type="button" class="pdf-copy-close" onclick="fecharCopiarDoPDF()" title="Fechar">×</button>
            </div>

            <div class="pdf-copy-file-row">
              <input id="pdfCopyFile" type="file" accept="application/pdf,.pdf" onchange="carregarPDFManual(event)" />
            </div>

            <div class="pdf-copy-grid">
              <div>
                <label for="pdf_tipo_documento">Tipo do documento</label>
                <select id="pdf_tipo_documento">
                  ${renderTipoDocumentoOptions()}
                </select>
              </div>
              <div>
                <label for="pdf_numero_documento">Número do documento</label>
                <input id="pdf_numero_documento" placeholder="Ex.: NF12341" />
              </div>
              <div>
                <label for="pdf_data_despesa">Dt Emissão</label>
                <input id="pdf_data_despesa" type="date" />
              </div>
              <div>
                <label for="pdf_valor">Valor</label>
                <input id="pdf_valor" type="text" inputmode="decimal" placeholder="R$ 0,00" />
              </div>
              <div>
                <label for="pdf_cnpj_cpf">CNPJ/CPF</label>
                <input id="pdf_cnpj_cpf" placeholder="00.000.000/0000-00" />
              </div>
              <div>
                <label for="pdf_fornecedor">Razão Social</label>
                <input id="pdf_fornecedor" placeholder="Nome/Razão Social" />
              </div>
            </div>

            <p class="pdf-copy-help">Arraste este quadro pela barra “Preencher”. Ao salvar, os dados serão enviados para os campos da tela Novo Lançamento.</p>

            <div class="pdf-copy-actions">
              <button type="button" class="btn-secondary" onclick="limparCamposCopiarDoPDF()">Limpar</button>
              <button type="button" onclick="salvarCopiarDoPDF()">Salvar</button>
            </div>
          </div>
        </div>

      
        <script>
          var pdfCopyObjectUrl = null;

          function abrirCopiarDoPDF() {
            var modal = document.getElementById('pdfCopyModal');
            if (!modal) return;
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
            carregarCamposAtuaisNoPopupPDF();
          }

          function fecharCopiarDoPDF() {
            var modal = document.getElementById('pdfCopyModal');
            if (!modal) return;
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
          }

          function carregarPDFManual(event) {
            var file = event && event.target && event.target.files ? event.target.files[0] : null;
            if (!file) return;
            if (file.type && file.type !== 'application/pdf') {
              alert('Selecione um arquivo PDF.');
              event.target.value = '';
              return;
            }
            if (pdfCopyObjectUrl) URL.revokeObjectURL(pdfCopyObjectUrl);
            pdfCopyObjectUrl = URL.createObjectURL(file);
            document.getElementById('pdfCopyViewer').src = pdfCopyObjectUrl;
            document.getElementById('pdfCopyEmpty').style.display = 'none';
          }

          function getCampoNovoLancamento(id) {
            return document.getElementById(id) || document.querySelector('[name="' + id + '"]');
          }

          function setValorCampoNovoLancamento(id, valor) {
            var campo = getCampoNovoLancamento(id);
            if (!campo) return;
            campo.value = valor || '';
            campo.dispatchEvent(new Event('input', { bubbles: true }));
            campo.dispatchEvent(new Event('change', { bubbles: true }));
          }

          function carregarCamposAtuaisNoPopupPDF() {
            var pares = [
              ['tipo_documento', 'pdf_tipo_documento'],
              ['numero_documento', 'pdf_numero_documento'],
              ['data_despesa', 'pdf_data_despesa'],
              ['valor', 'pdf_valor'],
              ['cnpj_cpf', 'pdf_cnpj_cpf'],
              ['fornecedor', 'pdf_fornecedor']
            ];
            pares.forEach(function(par) {
              var origem = getCampoNovoLancamento(par[0]);
              var destino = document.getElementById(par[1]);
              if (origem && destino && origem.value && !destino.value) destino.value = origem.value;
            });
          }

          function anexarPDFSelecionadoNoFormulario() {
            var origem = document.getElementById('pdfCopyFile');
            var destino = document.getElementById('anexo_pdf') || document.querySelector('input[name="anexo_pdf"]');

            if (!origem || !destino || !origem.files || !origem.files[0]) return false;

            try {
              var dt = new DataTransfer();
              dt.items.add(origem.files[0]);
              destino.files = dt.files;
              destino.dispatchEvent(new Event('input', { bubbles: true }));
              destino.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            } catch (erro) {
              console.error('Não foi possível anexar automaticamente o PDF:', erro);
              return false;
            }
          }

          function salvarCopiarDoPDF() {
            setValorCampoNovoLancamento('tipo_documento', document.getElementById('pdf_tipo_documento').value);
            setValorCampoNovoLancamento('numero_documento', document.getElementById('pdf_numero_documento').value);
            setValorCampoNovoLancamento('data_despesa', document.getElementById('pdf_data_despesa').value);
            setValorCampoNovoLancamento('valor', document.getElementById('pdf_valor').value);
            setValorCampoNovoLancamento('cnpj_cpf', document.getElementById('pdf_cnpj_cpf').value);
            setValorCampoNovoLancamento('fornecedor', document.getElementById('pdf_fornecedor').value);

            var pdfAnexado = anexarPDFSelecionadoNoFormulario();

            fecharCopiarDoPDF();
            var msg = document.getElementById('nf_paste_msg');
            if (msg) {
              msg.className = pdfAnexado ? 'nf-paste-msg ok' : 'nf-paste-msg';
              msg.textContent = pdfAnexado
                ? 'Dados enviados e PDF anexado automaticamente.'
                : 'Dados enviados. Nenhum PDF foi selecionado no popup.';
            }
          }

          function limparCamposCopiarDoPDF() {
            ['pdf_tipo_documento','pdf_numero_documento','pdf_data_despesa','pdf_valor','pdf_cnpj_cpf','pdf_fornecedor'].forEach(function(id) {
              var el = document.getElementById(id);
              if (el) el.value = '';
            });
          }

          (function habilitarArrastePopupPDF() {
            var panel = document.getElementById('pdfCopyPanel');
            var handle = document.getElementById('pdfCopyDragHandle');
            if (!panel || !handle) return;

            var arrastando = false;
            var offsetX = 0;
            var offsetY = 0;

            function iniciar(e) {
              var evento = e.touches ? e.touches[0] : e;
              arrastando = true;
              var rect = panel.getBoundingClientRect();
              offsetX = evento.clientX - rect.left;
              offsetY = evento.clientY - rect.top;
              panel.style.left = rect.left + 'px';
              panel.style.top = rect.top + 'px';
              panel.style.right = 'auto';
              document.body.style.userSelect = 'none';
            }

            function mover(e) {
              if (!arrastando) return;
              var evento = e.touches ? e.touches[0] : e;
              var maxLeft = window.innerWidth - panel.offsetWidth - 8;
              var maxTop = window.innerHeight - panel.offsetHeight - 8;
              var left = Math.max(8, Math.min(maxLeft, evento.clientX - offsetX));
              var top = Math.max(8, Math.min(maxTop, evento.clientY - offsetY));
              panel.style.left = left + 'px';
              panel.style.top = top + 'px';
            }

            function parar() {
              arrastando = false;
              document.body.style.userSelect = '';
            }

            handle.addEventListener('mousedown', iniciar);
            document.addEventListener('mousemove', mover);
            document.addEventListener('mouseup', parar);
            handle.addEventListener('touchstart', iniciar, { passive: true });
            document.addEventListener('touchmove', mover, { passive: true });
            document.addEventListener('touchend', parar);
          })();

          function somenteDigitosNF(valor) {
            return String(valor || '').replace(/\\D/g, '');
          }

          function formatarCnpjNF(valor) {
            var d = somenteDigitosNF(valor);
            if (d.length !== 14) return valor || '';
            return d.replace(/^(\\d{2})(\\d{3})(\\d{3})(\\d{4})(\\d{2})$/, '$1.$2.$3/$4-$5');
          }

          function normalizarTextoNF(texto) {
            return String(texto || '')
              .replace(/\\r/g, '\\n')
              .replace(/[\\t ]+/g, ' ')
              .replace(/\\n{2,}/g, '\\n')
              .trim();
          }

          function pegarPrimeiroMatch(texto, regexes) {
            for (var i = 0; i < regexes.length; i++) {
              var m = texto.match(regexes[i]);
              if (m && m[1]) return String(m[1]).trim();
            }
            return '';
          }

          function extrairFornecedorNF(texto) {
            var linhas = normalizarTextoNF(texto).split(/\\n/).map(function(l) { return l.trim(); }).filter(Boolean);
            var meuCnpj = '18862388000103';
            var empresaRegex = /(LTDA\\.?|S\\.A\\.?|\\bSA\\b|EIRELI|\\bME\\b|EPP)/i;
            var ignorar = /(PLENNATEC|TOMADOR|DESTINAT[ÁA]RIO|ADQUIRENTE|CPF\\/CNPJ|CNPJ\\/CPF|ENDERE[ÇC]O|MUNIC[ÍI]PIO|INSCRI[ÇC][ÃA]O|NOTA FISCAL|SECRETARIA|PREFEITURA)/i;

            for (var i = 0; i < linhas.length; i++) {
              var linha = linhas[i];
              if (/PRESTADOR|EMITENTE/i.test(linha)) {
                for (var j = i + 1; j < Math.min(i + 16, linhas.length); j++) {
                  var cand = linhas[j];
                  var dig = somenteDigitosNF(cand);
                  if (dig === meuCnpj) continue;
                  if (empresaRegex.test(cand) && !ignorar.test(cand)) return cand;
                }
              }
            }

            for (var k = 0; k < linhas.length; k++) {
              var l = linhas[k];
              if (empresaRegex.test(l) && !ignorar.test(l)) return l;
            }
            return '';
          }

          function extrairDadosNFColada(textoOriginal) {
            var texto = normalizarTextoNF(textoOriginal);
            var plano = texto.replace(/\\s+/g, ' ');
            var dados = {};

            var cnpjs = plano.match(/[0-9]{2}\\.?[0-9]{3}\\.?[0-9]{3}\\/?[0-9]{4}-?[0-9]{2}/g) || [];
            for (var i = 0; i < cnpjs.length; i++) {
              if (somenteDigitosNF(cnpjs[i]) !== '18862388000103') {
                dados.cnpj_cpf = formatarCnpjNF(cnpjs[i]);
                break;
              }
            }

            dados.numero_documento = pegarPrimeiroMatch(texto, [
              /N[úu]mero\\s+da\\s+Nota\\s*\\n\\s*(\\d{3,})/i,
              /N[úu]mero\\s+da\\s+NFS-?e\\s*\\n\\s*(\\d{3,})/i,
              /N[úu]mero\\s+da\\s+DPS\\s*\\n\\s*(\\d{3,})/i,
              /N[ºo\\.]*\\s*(?:da\\s*)?(?:NF|NFS-?e|Nota)\\D{0,30}(\\d{3,})/i,
              /RPS\\s*N[ºo\\.]*\\s*(\\d{3,})/i
            ]) || pegarPrimeiroMatch(plano, [
              /N[úu]mero\\s+da\\s+Nota\\D{0,80}(\\d{3,})/i,
              /N[úu]mero\\s+da\\s+NFS-?e\\D{0,80}(\\d{3,})/i,
              /N[ºo\\.]*\\s*(?:da\\s*)?(?:NF|NFS-?e|Nota)\\D{0,30}(\\d{3,})/i
            ]);

            var valor = pegarPrimeiroMatch(plano, [
              /VALOR\\s+TOTAL\\s+DO\\s+SERVI[ÇC]O\\s*=\\s*R\\$\\s*([\\d\\.]+,\\d{2})/i,
              /VALOR\\s+TOTAL\\s+DA\\s+NOTA\\s*=\\s*R\\$\\s*([\\d\\.]+,\\d{2})/i,
              /VALOR\\s+TOTAL\\s+COBRADO\\s*=\\s*R\\$\\s*([\\d\\.]+,\\d{2})/i,
              /VALOR\\s+TOTAL\\s+DA\\s+NFS-?E\\s*R\\$\\s*([\\d\\.]+,\\d{2})/i,
              /Valor\\s+L[íi]quido\\s+da\\s+NFS-?e\\s*R\\$\\s*([\\d\\.]+,\\d{2})/i,
              /Valor\\s+do\\s+Servi[çc]o\\s*R\\$\\s*([\\d\\.]+,\\d{2})/i
            ]);
            if (!valor) {
              var valores = plano.match(/R\\$\\s*[\\d\\.]+,\\d{2}/g) || [];
              if (valores.length) valor = valores[valores.length - 1].replace(/R\\$\\s*/i, '').trim();
            }
            dados.valor = valor;

            var dataBR = pegarPrimeiroMatch(texto, [
              /Data\\s+e\\s+Hora\\s+de\\s+Emiss[ãa]o\\s*\\n\\s*(\\d{2}\\/\\d{2}\\/\\d{4})/i,
              /Data\\s+e\\s+Hora\\s+da\\s+emiss[ãa]o\\s+da\\s+NFS-?e\\s*\\n\\s*(\\d{2}\\/\\d{2}\\/\\d{4})/i,
              /Compet[êe]ncia\\s+da\\s+NFS-?e\\s*\\n\\s*(\\d{2}\\/\\d{2}\\/\\d{4})/i,
              /emitido\\s+em\\s+(\\d{2}\\/\\d{2}\\/\\d{4})/i
            ]) || pegarPrimeiroMatch(plano, [
              /Data\\s+e\\s+Hora\\s+de\\s+Emiss[ãa]o\\D{0,50}(\\d{2}\\/\\d{2}\\/\\d{4})/i,
              /Data\\s+e\\s+Hora\\s+da\\s+emiss[ãa]o\\s+da\\s+NFS-?e\\D{0,50}(\\d{2}\\/\\d{2}\\/\\d{4})/i,
              /Compet[êe]ncia\\s+da\\s+NFS-?e\\D{0,50}(\\d{2}\\/\\d{2}\\/\\d{4})/i
            ]);
            if (dataBR) {
              var partes = dataBR.split('/');
              dados.data_despesa = partes[2] + '-' + partes[1] + '-' + partes[0];
            }

            dados.fornecedor = extrairFornecedorNF(texto);
            dados.tipo_documento = /NFS-?e|NOTA FISCAL ELETR[ÔO]NICA DE SERVI[ÇC]OS|DANFSe/i.test(texto)
              ? 'NFEs Serviço'
              : 'NFe Produto';

            return dados;
          }

          function setCampoNF(id, valor) {
            var el = document.getElementById(id);
            if (el && valor) el.value = valor;
          }

          function preencherPorTextoNF() {
            var texto = document.getElementById('texto_nf_colado').value || '';
            var msg = document.getElementById('nf_paste_msg');
            if (!texto.trim()) {
              msg.className = 'nf-paste-msg warn';
              msg.textContent = 'Cole o texto da NF antes de preencher.';
              return;
            }

            var dados = extrairDadosNFColada(texto);
            var encontrou = 0;
            ['tipo_documento','numero_documento','data_despesa','valor','fornecedor','cnpj_cpf'].forEach(function(campo) {
              if (dados[campo]) {
                setCampoNF(campo, dados[campo]);
                encontrou++;
              }
            });

            if (encontrou >= 2) {
              msg.className = 'nf-paste-msg ok';
              msg.textContent = 'Campos preenchidos. Confira antes de salvar.';
            } else {
              msg.className = 'nf-paste-msg warn';
              msg.textContent = 'Texto não reconhecido. Preencha manualmente.';
            }
          }

          function limparTextoNF() {
            document.getElementById('texto_nf_colado').value = '';
            var msg = document.getElementById('nf_paste_msg');
            msg.className = 'nf-paste-msg';
            msg.textContent = '';
          }
        </script>
</body>
      </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao carregar formulário:\n${error.message}</pre>`);
  }
});
router.post(
  '/novo',
  upload.fields([
    { name: 'anexo_pdf', maxCount: 1 },
    { name: 'anexo_xml', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const {
        tipo_documento,
        numero_documento,
        data_despesa,
        fornecedor,
        cnpj_cpf,
        codigo_pagamento,
        valor,
        tipo_pagamento,
        categoria_id
      } = req.body;

      const anexoPdf = req.files && req.files.anexo_pdf ? req.files.anexo_pdf[0].filename : null;
      const anexoXml = req.files && req.files.anexo_xml ? req.files.anexo_xml[0].filename : null;

      await pool.query(
        `INSERT INTO lancamentos
        (tipo_documento, numero_documento, data_despesa, fornecedor, cnpj_cpf, codigo_pagamento, categoria_id, valor, tipo_pagamento, anexo_pdf, anexo_xml)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          tipo_documento,
          numero_documento || null,
          data_despesa,
          fornecedor,
          cnpj_cpf || null,
          codigo_pagamento || null,
          categoria_id,
          parseMoneyBR(valor),
          tipo_pagamento,
          anexoPdf,
          anexoXml
        ]
      );

      res.redirect('/lancamentos');
    } catch (error) {
      res.send(`<pre>Erro ao salvar lançamento:\n${error.message}</pre>`);
    }
  }
);

router.get('/editar/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const lancamentoResult = await pool.query(
      'SELECT * FROM lancamentos WHERE id = $1',
      [id]
    );

    if (lancamentoResult.rows.length === 0) {
      return res.send('<pre>Lançamento não encontrado.</pre>');
    }

    const lancamento = lancamentoResult.rows[0];
    const options = await getCategoriasOptions(lancamento.categoria_id);

    const dataFormatada = lancamento.data_despesa
      ? new Date(lancamento.data_despesa).toISOString().split('T')[0]
      : '';

   const linkPdf = lancamento.anexo_pdf
  ? `<span>PDF: <a href="/uploads/${lancamento.anexo_pdf}" target="_blank">Ver</a></span>`
  : `<span class="hint">PDF: não enviado</span>`;

const linkXml = lancamento.anexo_xml
  ? `<span>XML: <a href="/uploads/${lancamento.anexo_xml}" target="_blank">Ver</a></span>`
  : `<span class="hint">XML: não enviado</span>`;

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Editar lançamento</title>
        <style>
          * { box-sizing: border-box; }
          body {
  margin: 0;
  font-family: Arial, sans-serif;
  font-size: 13px;
  background: #f6f8fb;
  color: #111827;
}

.container {
  max-width: 1600px;
  margin: 18px auto;
  padding: 0 12px;
}

.card {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
  padding: 14px;
  border: 1px solid #e5e7eb;
}

h1 {
  margin-top: 0;
  margin-bottom: 12px;
  font-size: 20px;
}

label {
  display: block;
  font-size: 10px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #475569;
}

input, select {
  width: 100%;
  padding: 7px 9px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  background: #fff;
}

table {
  width: 100%;
  border-collapse: collapse;
  overflow: hidden;
}

th, td {
  padding: 7px 8px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: middle;
  font-size: 12.5px;
  line-height: 1.2;
}

th {
  background: #eaf0fb;
  color: #1e3a8a;
  font-weight: 700;
  position: sticky;
  top: 0;
}

tr:hover {
  background: #f8fafc;
}
         .btn-secondary { background: #e5e7eb; color: #111827; }

/* ===== VISUAL PREMIUM /EDITAR ===== */
body {
  background: #f8fafc;
  color: #1f2937;
  font-size: 13px;
}

.container {
  max-width: 1100px;
  margin: 28px auto;
  padding: 0 18px;
}

.card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 4px 12px rgba(0,0,0,0.04);
  padding: 22px;
}

h1 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 18px;
}

label {
  font-size: 10px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
  display: block;
}

input, select {
  width: 100%;
  font-size: 13px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
}

input:focus, select:focus {
  outline: none;
  border-color: #2563eb;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.full {
  grid-column: 1 / -1;
}

.actions {
  margin-top: 18px;
  display: flex;
  gap: 10px;
}

button {
  background: #2563eb;
  color: white;
  padding: 10px 14px;
  border-radius: 8px;
  border: none;
  font-weight: 600;
}

button:hover {
  background: #1d4ed8;
}

.btn-secondary {
  background: #e5e7eb;
  color: #111827;
}

.btn-secondary:hover {
  background: #d1d5db;
}


/* ===== PADRÃO VISUAL PLENNATEC- APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL PLENNATEC ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */



/* ===== AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */
/* Comprovantes Fiscais: filtros compactos para caberem em uma única linha em telas largas */
body.dm-global-page form[action="/lancamentos"] .filters {
  display: grid !important;
  grid-template-columns: 1.05fr 1.05fr 1.05fr 1.05fr 1.05fr 1fr .92fr .92fr auto !important;
  align-items: end !important;
  gap: 8px !important;
  padding: 12px 14px !important;
}

body.dm-global-page form[action="/lancamentos"] .filters > div {
  min-width: 0 !important;
}

body.dm-global-page form[action="/lancamentos"] .filters label {
  display: block !important;
  margin: 0 0 5px !important;
  font-size: 10px !important;
  line-height: 1.05 !important;
  font-weight: 900 !important;
  white-space: nowrap !important;
}

body.dm-global-page form[action="/lancamentos"] .filters input,
body.dm-global-page form[action="/lancamentos"] .filters select {
  width: 100% !important;
  min-width: 0 !important;
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 10px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons {
  display: inline-flex !important;
  align-items: end !important;
  justify-content: flex-start !important;
  gap: 7px !important;
  min-width: 142px !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons button,
body.dm-global-page form[action="/lancamentos"] .filter-buttons a {
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 13px !important;
  font-size: 11px !important;
  border-radius: 11px !important;
}

@media (max-width: 1280px) {
  body.dm-global-page form[action="/lancamentos"] .filters {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

/* Espaço do Contador: conteúdo interno da coluna Enviar Arquivo alinhado à esquerda */
.contador-premium-page .contador-table th:nth-child(4) {
  text-align: center !important;
}

.contador-premium-page .contador-table td:nth-child(4) {
  text-align: left !important;
  padding-left: 10px !important;
  padding-right: 8px !important;
}

.contador-premium-page .upload-cell-compact {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  flex-wrap: nowrap !important;
  max-width: 100% !important;
  margin-left: 0 !important;
}

.contador-premium-page .btn-upload-open {
  width: auto !important;
  min-width: 112px !important;
  height: 30px !important;
  min-height: 30px !important;
  padding: 0 12px !important;
  font-size: 10.8px !important;
  line-height: 1 !important;
  border-radius: 11px !important;
}

.contador-premium-page .upload-cell-compact .clip-indicator,
.contador-premium-page .upload-cell-compact .empty-inline,
.contador-premium-page .upload-cell-compact .attached-badge,
.contador-premium-page .upload-cell-compact .attached-empty {
  flex: 0 0 auto !important;
}
/* ===== FIM AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */

</style>
      </head>
      <body class="dm-global-page">
        ${renderGlobalHeader(req, { titulo: 'Editar Lançamento', subtitulo: 'Revise e atualize os dados do lançamento selecionado.', paginaAtual: 'lancamentos' })}
        <div class="container">
          <div class="card">
            <h1>✏️ Editar lançamento</h1>
            ${linkPdf}
            ${linkXml}

            <form method="POST" action="/editar/${lancamento.id}" enctype="multipart/form-data">
              <div class="grid">
                <div>
                  <label for="tipo_documento">Tipo do documento</label>
                  <select id="tipo_documento" name="tipo_documento" required>
                    ${renderTipoDocumentoOptions(lancamento.tipo_documento)}
                  </select>
                </div>

                <div>
                  <label for="numero_documento">Número do documento</label>
                  <input id="numero_documento" name="numero_documento" value="${lancamento.numero_documento || ''}" />
                </div>

                <div>
                  <label for="data_despesa">Data</label>
                  <input id="data_despesa" type="date" name="data_despesa" value="${dataFormatada}" required />
                </div>

                <div>
                  <label for="valor">Valor</label>
                  <input id="valor" name="valor" type="text" inputmode="decimal" value="${formatValorInputBR(lancamento.valor)}" placeholder="R$ 0,00" required />
                </div>

                <div class="full">
                  <label for="fornecedor">Fornecedor</label>
                  <input id="fornecedor" name="fornecedor" value="${lancamento.fornecedor || ''}" required />
                </div>

                <div>
                  <label for="cnpj_cpf">CNPJ/CPF</label>
                  <input id="cnpj_cpf" name="cnpj_cpf" value="${lancamento.cnpj_cpf || ''}" />
                </div>

                <div>
                  <label for="codigo_pagamento">Código de pagamento</label>
                  <input id="codigo_pagamento" name="codigo_pagamento" value="${lancamento.codigo_pagamento || ''}" />
                </div>

                <div>
                  <label for="tipo_pagamento">Tipo de pagamento</label>
                  <select id="tipo_pagamento" name="tipo_pagamento" required>
                    <option value="">Selecione o pagamento</option>
                    <option value="PIX" ${lancamento.tipo_pagamento === 'PIX' ? 'selected' : ''}>PIX</option>
                    <option value="Boleto" ${lancamento.tipo_pagamento === 'Boleto' ? 'selected' : ''}>Boleto</option>
                    <option value="Guia" ${lancamento.tipo_pagamento === 'Guia' ? 'selected' : ''}>Guia</option>
                    <option value="Dinheiro" ${lancamento.tipo_pagamento === 'Dinheiro' ? 'selected' : ''}>Dinheiro</option>
                    <option value="DEB" ${lancamento.tipo_pagamento === 'DEB' ? 'selected' : ''}>DEB</option>
                    <option value="DOP" ${lancamento.tipo_pagamento === 'DOP' ? 'selected' : ''}>DOP</option>
                    <option value="CAR Inter" ${lancamento.tipo_pagamento === 'CAR Inter' ? 'selected' : ''}>CAR Inter</option>
                    <option value="CAR VISA CX" ${lancamento.tipo_pagamento === 'CAR VISA CX' ? 'selected' : ''}>CAR VISA CX</option>
                    <option value="CAR ELO CX" ${lancamento.tipo_pagamento === 'CAR ELO CX' ? 'selected' : ''}>CAR ELO CX</option>
                    <option value="CAR Outro" ${lancamento.tipo_pagamento === 'CAR Outro' ? 'selected' : ''}>CAR Outro</option>
                  </select>
                </div>

                <div>
                  <label for="categoria_id">Categoria</label>
                  <select id="categoria_id" name="categoria_id" required>
                    ${options}
                  </select>
                </div>

                <div>
                  <label for="anexo_pdf">Trocar PDF</label>
                  <input id="anexo_pdf" type="file" name="anexo_pdf" accept=".pdf" />
                </div>

                <div>
                  <label for="anexo_xml">Trocar XML</label>
                  <input id="anexo_xml" type="file" name="anexo_xml" accept=".xml,text/xml,application/xml" />
                </div>
              </div>

              <div class="actions">
                <button type="submit">Atualizar</button>
              <a class="btn-secondary" href="/lancamentos" style="display:inline-block; padding:10px 14px; border-radius:8px; font-weight:600;">Cancelar</a>
              </div>
            </form>
          </div>
        </div>
        <script>
          function abrirModalUpload(id) {
            const modal = document.getElementById(id);
            if (modal) modal.classList.add('is-open');
          }

          function fecharModalUpload(id) {
            const modal = document.getElementById(id);
            if (!modal) return;
            modal.classList.remove('is-open');
            const input = modal.querySelector('input[type="file"]');
            const preview = modal.querySelector('[data-preview-list]');
            if (input) input.value = '';
            if (preview) preview.innerHTML = '<div class="modal-empty">Nenhum arquivo selecionado.</div>';
          }

          function atualizarPreviewArquivos(input) {
            const form = input.closest('form');
            const list = form ? form.querySelector('[data-preview-list]') : null;
            if (!list) return;

            const dt = new DataTransfer();
            Array.from(input.files || []).forEach(file => dt.items.add(file));
            input.files = dt.files;

            renderPreview(input, list);
          }

          function renderPreview(input, list) {
            const files = Array.from(input.files || []);
            if (!files.length) {
              list.innerHTML = '<div class="modal-empty">Nenhum arquivo selecionado.</div>';
              return;
            }

            list.innerHTML = '';
            files.forEach((file, index) => {
              const row = document.createElement('div');
              row.className = 'modal-file-row';

              const name = document.createElement('span');
              name.textContent = file.name;
              name.title = file.name;

              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'modal-delete';
              btn.title = 'Remover da seleção';
              btn.textContent = '🗑';
              btn.onclick = function () {
                const novo = new DataTransfer();
                Array.from(input.files || []).forEach((item, i) => {
                  if (i !== index) novo.items.add(item);
                });
                input.files = novo.files;
                renderPreview(input, list);
              };

              row.appendChild(name);
              row.appendChild(btn);
              list.appendChild(row);
            });
          }

          document.addEventListener('click', function(event) {
            if (event.target && event.target.classList && event.target.classList.contains('upload-modal-overlay')) {
              event.target.classList.remove('is-open');
            }
          });
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao carregar edição:\n${error.message}</pre>`);
  }
});

router.post('/editar/:id', upload.fields([{ name: 'anexo_pdf', maxCount: 1 }, { name: 'anexo_xml', maxCount: 1 }]), async (req, res) => {
  try {
    const { id } = req.params;

    const atual = await pool.query(
      `SELECT anexo_pdf, anexo_xml
       FROM lancamentos
       WHERE id = $1`,
      [id]
    );

    const lancamentoAtual = atual.rows[0] || {};
    const novoPdf = req.files && req.files.anexo_pdf ? req.files.anexo_pdf[0].filename : lancamentoAtual.anexo_pdf;
    const novoXml = req.files && req.files.anexo_xml ? req.files.anexo_xml[0].filename : lancamentoAtual.anexo_xml;

    const {
      tipo_documento,
      numero_documento,
      data_despesa,
      fornecedor,
      cnpj_cpf,
      codigo_pagamento,
      valor,
      tipo_pagamento,
      categoria_id
    } = req.body;

    await pool.query(
      `UPDATE lancamentos
       SET tipo_documento = $1,
           numero_documento = $2,
           data_despesa = $3,
           fornecedor = $4,
           cnpj_cpf = $5,
           codigo_pagamento = $6,
           valor = $7,
           tipo_pagamento = $8,
           categoria_id = $9,
           anexo_pdf = $10,
           anexo_xml = $11
       WHERE id = $12`,
      [tipo_documento, numero_documento || null, data_despesa, fornecedor, cnpj_cpf || null, codigo_pagamento || null, parseMoneyBR(valor), tipo_pagamento, categoria_id, novoPdf, novoXml, id]
    );

    res.redirect('/lancamentos');
  } catch (error) {
    res.send(`<pre>Erro ao atualizar lançamento:\n${error.message}</pre>`);
  }
});

router.get('/download/pdf/:id', protegerRota, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        l.anexo_pdf,
        l.tipo_pagamento,
        l.fornecedor,
        l.numero_documento,
        l.tipo_documento,
        l.valor,
        c.nome AS categoria
      FROM lancamentos l
      LEFT JOIN categorias c ON c.id = l.categoria_id
      WHERE l.id = $1
      `,
      [id]
    );

    if (!result.rows.length || !result.rows[0].anexo_pdf) {
      return res.send('<pre>PDF não encontrado.</pre>');
    }

    const lancamento = result.rows[0];
    const filePath = getUploadFilePath(lancamento.anexo_pdf);

    if (!fs.existsSync(filePath)) {
      return res.send('<pre>Arquivo PDF não encontrado na pasta uploads.</pre>');
    }

    const baseName = buildDownloadBaseName(lancamento);
    res.download(filePath, `${baseName}.pdf`);
  } catch (error) {
    res.send(`<pre>Erro ao baixar PDF:\n${error.message}</pre>`);
  }
});

router.get('/download/xml/:id', protegerRota, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        l.anexo_xml,
        l.tipo_pagamento,
        l.fornecedor,
        l.numero_documento,
        l.tipo_documento,
        l.valor,
        c.nome AS categoria
      FROM lancamentos l
      LEFT JOIN categorias c ON c.id = l.categoria_id
      WHERE l.id = $1
      `,
      [id]
    );

    if (!result.rows.length || !result.rows[0].anexo_xml) {
      return res.send('<pre>XML não encontrado.</pre>');
    }

    const lancamento = result.rows[0];
    const filePath = getUploadFilePath(lancamento.anexo_xml);

    if (!fs.existsSync(filePath)) {
      return res.send('<pre>Arquivo XML não encontrado na pasta uploads.</pre>');
    }

    const baseName = buildDownloadBaseName(lancamento);
    res.download(filePath, `${baseName}.xml`);
  } catch (error) {
    res.send(`<pre>Erro ao baixar XML:\n${error.message}</pre>`);
  }
});

router.post('/excluir/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM lancamentos WHERE id = $1', [id]);
    res.redirect('/lancamentos');
  } catch (error) {
    res.send(`<pre>Erro ao excluir lançamento:\n${error.message}</pre>`);
  }
});

router.get('/lancamentos', protegerRota, async (req, res) => {
  try {
    const {
      fornecedor = '',
      categoria_id = '',
      tipo_pagamento = '',
      cnpj_cpf = '',
      codigo_pagamento = '',
      numero_documento = '',
      data_inicio = '',
      data_fim = ''
    } = req.query;

    const categoriasResult = await pool.query(`
      SELECT c.id, c.nome, c.categoria_pai_id, p.nome AS categoria_pai_nome
      FROM categorias c
      LEFT JOIN categorias p ON p.id = c.categoria_pai_id
      ORDER BY
        COALESCE(p.nome, c.nome),
        c.categoria_pai_id NULLS FIRST,
        c.nome
    `);
    const categorias = categoriasResult.rows;

    let where = [];
    let values = [];

    if (fornecedor) {
      values.push(`%${fornecedor}%`);
      where.push(`l.fornecedor ILIKE $${values.length}`);
    }
    if (categoria_id) {
      values.push(categoria_id);
      where.push(`l.categoria_id = $${values.length}`);
    }
    if (tipo_pagamento) {
      values.push(tipo_pagamento);
      where.push(`l.tipo_pagamento = $${values.length}`);
    }
    if (cnpj_cpf) {
      values.push(`%${cnpj_cpf}%`);
      where.push(`CAST(l.cnpj_cpf AS TEXT) ILIKE $${values.length}`);
    }
    if (codigo_pagamento) {
      values.push(`%${codigo_pagamento}%`);
      where.push(`l.codigo_pagamento ILIKE $${values.length}`);
    }
    if (numero_documento) {
      values.push(`%${numero_documento}%`);
      where.push(`l.numero_documento ILIKE $${values.length}`);
    }
    if (data_inicio) {
      values.push(data_inicio);
      where.push(`l.data_despesa >= $${values.length}`);
    }
    if (data_fim) {
      values.push(data_fim);
      where.push(`l.data_despesa <= $${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await pool.query(
      `
      SELECT
        l.id,
        l.tipo_documento,
        l.numero_documento,
        l.data_despesa,
        l.fornecedor,
        l.cnpj_cpf,
        l.codigo_pagamento,
        l.valor,
        l.tipo_pagamento,
        l.anexo_pdf,
        l.anexo_xml,
        c.nome AS categoria
      FROM lancamentos l
      LEFT JOIN categorias c ON c.id = l.categoria_id
      ${whereSql}
      ORDER BY l.id DESC
      `,
      values
    );

    const resumoResult = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total_itens,
        COALESCE(SUM(l.valor), 0)::numeric AS valor_total
      FROM lancamentos l
      ${whereSql}
      `,
      values
    );

    const totalItens = resumoResult.rows[0]?.total_itens || 0;
    const valorTotal = resumoResult.rows[0]?.valor_total || 0;

    let linhas = '';
    result.rows.forEach(l => {
const nomePagamento = (l.tipo_pagamento || 'SemPagamento')
  .toString()
  .trim()
  .replace(/\s+/g, ' ');

const nomeFornecedor = (l.fornecedor || 'SemFornecedor')
  .toString()
  .trim()
  .replace(/\s+/g, ' ');

const nomeCategoria = (l.categoria || 'SemCategoria')
  .toString()
  .trim()
  .replace(/\s+/g, ' ');

const nomeNumero = (l.numero_documento || 'SemNumero')
  .toString()
  .trim()
  .replace(/\s+/g, ' ');

const nomeValor = formatMoneyBR(l.valor || 0)
  .replace(/\s+/g, '');

const nomeBaseDownload = `${nomePagamento}-${nomeFornecedor}-${nomeCategoria}-${nomeNumero}-${nomeValor}`
  .replace(/[\/\\:*?"<>|]/g, '-')
  .replace(/\s+/g, ' ')
  .trim();

      const pdfHtml = l.anexo_pdf
  ? `
    <a class="icon-btn" title="Ver PDF" href="/uploads/${l.anexo_pdf}" target="_blank">👁</a>
    <a class="icon-btn" title="Baixar PDF" href="/uploads/${l.anexo_pdf}" download="${nomeBaseDownload}.pdf">⬇</a>
  `
  : '<span style="color:#9ca3af;">-</span>';

      const xmlHtml = l.anexo_xml
  ? `
    <a class="icon-btn" title="Ver XML" href="/uploads/${l.anexo_xml}" target="_blank">👁</a>
    <a class="icon-btn" title="Baixar XML" href="/uploads/${l.anexo_xml}" download="${nomeBaseDownload}.xml">⬇</a>
  `
  : '<span style="color:#9ca3af;">-</span>';

      linhas += `
        <tr class="data-row">
          <td class="col-id sticky-id">${l.id}</td>
          <td>${l.tipo_documento || ''}</td>
          <td>${l.numero_documento || ''}</td>
          <td>${l.data_despesa ? new Date(l.data_despesa).toLocaleDateString('pt-BR') : ''}</td>
          <td>${l.fornecedor || ''}</td>
          <td class="col-cnpj">${l.cnpj_cpf || ''}</td>
          <td class="col-codpag">${l.codigo_pagamento || ''}</td>
          <td class="col-valor">${formatMoneyBR(l.valor || 0)}</td>
          <td class="col-pagamento">${l.tipo_pagamento || ''}</td>
          <td class="col-categoria">${l.categoria || ''}</td>
          <td class="col-pdf">${pdfHtml}</td>
          <td class="col-xml">${xmlHtml}</td>
          <td class="actions-cell sticky-actions">
            <a class="icon-btn" title="Editar" href="/editar/${l.id}">✏️</a>
            <form method="POST" action="/excluir/${l.id}" style="display:inline;" onsubmit="return confirm('Tem certeza que deseja excluir este lançamento?');">
              <button type="submit" class="icon-btn btn-icon-danger" title="Excluir">🗑️</button>
            </form>
          </td>
        </tr>
      `;
    });

    let optionsCategorias = '<option value="">Todas as categorias</option>';
    categorias.forEach(cat => {
      const selected = String(categoria_id) === String(cat.id) ? 'selected' : '';
      const nomeExibicao = cat.categoria_pai_nome
        ? `${cat.categoria_pai_nome} > ${cat.nome}`
        : cat.nome;

      optionsCategorias += `<option value="${cat.id}" ${selected}>${nomeExibicao}</option>`;
    });

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Comprovantes Fiscais</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #f8fafc;
            color: #1f2937;
            font-size: 13px;
          }
          .container {
            max-width: 1750px;
            margin: 40px auto;
            padding: 0 20px;
          }
          .card {
            background: #ffffff;
            border-radius: 12px;
            border: 1px solid #e5e7eb;
            box-shadow: 0 4px 12px rgba(0,0,0,0.04);
            padding: 24px;
          }
          h1 {
            margin-top: 0;
            font-size: 18px;
            font-weight: 600;
            color: #111827;
          }
          .actions {
            margin-bottom: 18px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          }
          .btn {
            display: inline-block;
            text-decoration: none;
            padding: 8px 14px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: bold;
            transition: all 0.2s ease;
            border: none;
            cursor: pointer;
          }
          .btn-primary { background: #2563eb; color: white; }
          .btn-primary:hover { background: #1d4ed8; }
          .btn-secondary { background: #e5e7eb; color: #111827; }
          .btn-secondary:hover { background: #d1d5db; }
          .btn-success { background: #16a34a; color: white; }
          .btn-success:hover { background: #15803d; }

          .month-compact-row { display: flex; align-items: center; gap: 8px; }
        .month-current-display { min-width: 78px; height: 42px; display: inline-flex; align-items: center; justify-content: center; padding: 0 14px; border-radius: 12px; background: #ffffff; border: 1px solid #dce3ec; color: #172033; font-weight: 900; white-space: nowrap; }
        .btn-month-open { min-width: 118px !important; height: 42px !important; padding: 0 14px !important; }
        .month-picker-overlay { display: none; position: fixed; inset: 0; z-index: 9999; background: rgba(15, 23, 42, 0.16); align-items: flex-start; justify-content: center; padding: 88px 18px 18px; }
        .month-picker-overlay.open { display: flex; }
        .month-picker-popover { width: 338px; max-width: calc(100vw - 28px); border-radius: 18px; background: rgba(255,255,255,0.98); border: 1px solid #dce3ec; box-shadow: 0 24px 70px rgba(15, 23, 42, 0.22); padding: 14px; }
        .month-picker-head { display: grid; grid-template-columns: 44px 1fr 44px; gap: 10px; align-items: center; margin-bottom: 14px; }
        .month-nav-btn { height: 38px !important; min-height: 38px !important; border-radius: 12px !important; padding: 0 !important; font-size: 20px !important; line-height: 1 !important; }
        .month-year-select { height: 38px !important; text-align: center; font-weight: 900; }
        .month-grid-picker { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .month-cell { height: 38px !important; min-height: 38px !important; padding: 0 !important; border-radius: 11px !important; font-size: 13px !important; font-weight: 900 !important; background: #E8F7EE !important; color: #14532d !important; border: 1px solid #c8ecd4 !important; box-shadow: 0 8px 16px rgba(15, 23, 42, .04) !important; transition: all .16s ease !important; }
        .month-cell:hover, .month-cell.active { background: linear-gradient(135deg, #00B050, #009640) !important; color: #fff !important; border-color: rgba(0, 176, 80, .9) !important; box-shadow: 0 10px 18px rgba(0, 176, 80, .22) !important; transform: translateY(-1px); }
        .month-picker-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 14px; }
        .month-selected-preview { color: #14532d; font-size: 12px; font-weight: 900; white-space: nowrap; }
        .month-picker-footer-actions { display: flex; justify-content: flex-end; gap: 8px; }
        th.col-vencimento, td.col-vencimento, th.col-status-pagto, td.col-status-pagto { text-align: center !important; vertical-align: middle !important; }

        .painel-colunas {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            padding: 8px 12px;
            border-radius: 8px;
            margin-bottom: 12px;
          }
          .painel-colunas label {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 10px;
            margin: 0;
            color: #374151;
          }
          .painel-colunas input[type="checkbox"] {
            width: auto;
            margin: 0;
          }

          .filters {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 8px;
            margin-bottom: 20px;
            align-items: end;
          }
          label {
            display: block;
            font-size: 10px;
            font-weight: bold;
            margin-bottom: 6px;
          }
          input, select {
            width: 100%;
            padding: 8px 10px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 13px;
            background: #fff;
          }
          input:focus, select:focus {
            outline: none;
            border-color: #2563eb;
          }
          .filter-buttons {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          }
          .filter-buttons button,
          .filter-buttons a {
            text-decoration: none;
            padding: 10px 14px;
            border-radius: 10px;
            font-weight: bold;
            border: none;
            cursor: pointer;
            display: inline-block;
          }
          .filter-buttons button {
            background: #2563eb;
            color: white;
          }
          .filter-buttons a {
            background: #e5e7eb;
            color: #111827;
          }

          .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 10px;
            margin-bottom: 14px;
          }
          .sum-card {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 10px 14px;
          }
          .sum-title {
            font-size: 11px;
            color: #6b7280;
          }
          .sum-value {
            font-size: 18px;
            font-weight: 600;
            color: #111827;
            line-height: 1.1;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            border-radius: 12px;
            overflow: hidden;
          }
          th {
            background: #f1f5f9;
            font-weight: 600;
            color: #334155;
            font-size: 10px;
            text-transform: uppercase;
            text-align: left;
          }
          th, td {
            padding: 8px 10px;
            border-bottom: 1px solid #f1f5f9;
            vertical-align: middle;
          }
          tr:hover {
            background: #f9fafb;
          }

          .col-valor {
            text-align: right;
            font-weight: 600;
            color: #111827;
          }
          th.col-valor {
            text-align: right;
          }

          .col-pdf, .col-xml {
            width: 70px;
            text-align: center;
          }

          .actions-cell {
            white-space: nowrap;
          }

          .icon-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            padding: 0;
            margin: 0 3px;
            border: none !important;
            background: transparent !important;
            box-shadow: none !important;
            outline: none !important;
            text-decoration: none;
            font-size: 14px;
            color: #64748b;
            cursor: pointer;
          }
          .icon-btn:hover {
            color: #1d4ed8;
            transform: scale(1.08);
          }
          .icon-btn[title="Excluir"] {
            color: #ef4444;
          }
          .icon-btn[title="Excluir"]:hover {
            color: #dc2626;
          }
          .icon-btn[title="Editar"] {
            color: #2563eb;
          }
        

/* ===== PADRÃO VISUAL PLENNATEC - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL PLENNATEC ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
/* ===== TABELA NÍVEL MERCADO LIVRE - DESPESAS MENSAIS ===== */
.ml-table-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:10px 0 8px; color:#64748b; font-size:12px; font-weight:800; }
.ml-table-shell { position:relative; width:100%; max-height:calc(100vh - 360px); min-height:320px; overflow:auto; border:1px solid rgba(226,232,240,.92); border-radius:16px; background:rgba(255,255,255,.88); box-shadow:inset 0 1px 0 rgba(255,255,255,.75); }
.ml-table { width:100%; min-width:1280px; border-collapse:separate !important; border-spacing:0 !important; table-layout:auto; background:transparent !important; border-radius:0 !important; }
.ml-table thead th { position:sticky; top:0; z-index:20; height:44px; padding:10px 12px; background:rgba(248,250,252,.98) !important; backdrop-filter:blur(10px); border-bottom:2px solid #e2e8f0; box-shadow:0 3px 8px rgba(15,23,42,.05); font-size:11px; text-transform:uppercase; letter-spacing:.02em; white-space:nowrap; }
.ml-table tbody td { height:42px; padding:9px 12px; border-bottom:1px solid rgba(226,232,240,.72); background:rgba(255,255,255,.92); white-space:nowrap; vertical-align:middle; }
.ml-table tbody tr:hover td { background:rgba(232,247,238,.72) !important; }
.ml-table .sticky-id { position:sticky; left:0; z-index:12; min-width:58px; width:58px; background:rgba(255,255,255,.98) !important; box-shadow:8px 0 14px rgba(15,23,42,.04); }
.ml-table thead .sticky-id { z-index:30; background:rgba(248,250,252,.98) !important; }
.ml-table .sticky-actions { position:sticky; right:0; z-index:12; min-width:94px; width:94px; text-align:center; background:rgba(255,255,255,.98) !important; box-shadow:-8px 0 14px rgba(15,23,42,.05); }
.ml-table thead .sticky-actions { z-index:30; background:rgba(248,250,252,.98) !important; }
.ml-load-more { display:none; align-items:center; justify-content:center; gap:10px; padding:14px; color:#64748b; font-weight:900; font-size:12px; }
.ml-load-more.active { display:flex; }
.ml-spinner { width:18px; height:18px; border-radius:50%; border:3px solid #dbeafe; border-top-color:#00B050; animation:mlSpin .75s linear infinite; }
@keyframes mlSpin { to { transform:rotate(360deg); } }
.ml-skeleton-overlay { display:none; position:fixed; inset:0; z-index:9999; background:rgba(248,250,252,.64); backdrop-filter:blur(3px); align-items:center; justify-content:center; }
.ml-skeleton-card { width:min(720px, calc(100vw - 36px)); border-radius:18px; background:rgba(255,255,255,.96); border:1px solid #e2e8f0; box-shadow:0 24px 70px rgba(15,23,42,.18); padding:22px; }
.ml-skeleton-title, .ml-skeleton-line { border-radius:999px; background:linear-gradient(90deg,#e5e7eb 0%,#f8fafc 45%,#e5e7eb 100%); background-size:220% 100%; animation:mlShimmer 1.15s infinite linear; }
.ml-skeleton-title { height:18px; width:220px; margin-bottom:16px; }
.ml-skeleton-line { height:38px; border-radius:10px; margin-top:10px; }
@keyframes mlShimmer { to { background-position:-220% 0; } }
@media (max-width:1100px) { .ml-table-shell { max-height:none; } }

/* ===== CORREÇÃO STICKY IGUAL ROTINA DE DESPESAS =====
   A rolagem volta a ser da página inteira. Assim cabeçalho/filtros sobem normalmente
   e somente os títulos da tabela ficam fixos no topo da tela. */
.ml-table-shell {
  max-height: none !important;
  min-height: 0 !important;
  overflow: visible !important;
  border: none !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}
.ml-table {
  min-width: 100% !important;
}
.ml-table thead,
.ml-table thead tr,
.ml-table thead th {
  overflow: visible !important;
}
.ml-table thead th {
  position: sticky !important;
  top: 0 !important;
  z-index: 999 !important;
  background: rgba(248, 250, 252, 0.985) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
  box-shadow: inset 0 -2px 0 #e5e7eb, 0 5px 16px rgba(15, 23, 42, 0.10) !important;
}
.ml-table thead .sticky-id { z-index: 1001 !important; }
.ml-table thead .sticky-actions { z-index: 1001 !important; }
/* ===== FIM CORREÇÃO STICKY IGUAL ROTINA ===== */

/* ===== HEADER FIXO REAL - DESPESAS MENSAIS =====
   Solução sênior: usamos uma cópia fixa do cabeçalho quando a página rola.
   Assim os filtros e o topo sobem normalmente, mas os títulos ficam presos no topo. */
.ml-table thead th {
  position: static !important;
  top: auto !important;
}
.ml-table-fixed-head {
  display: none;
  position: fixed;
  top: 0;
  z-index: 99999;
  pointer-events: none;
  border-collapse: collapse !important;
  table-layout: fixed !important;
  background: rgba(248, 250, 252, 0.992) !important;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12) !important;
}
.ml-table-fixed-head.is-visible { display: table; }
.ml-table-fixed-head th {
  background: rgba(248, 250, 252, 0.992) !important;
  color: #334155 !important;
  font-size: 10px !important;
  font-weight: 800 !important;
  text-transform: uppercase !important;
  padding: 8px 10px !important;
  border-bottom: 2px solid #e5e7eb !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  text-align: left !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
}
.ml-table-fixed-head th.col-valor { text-align: right !important; }
.ml-table-fixed-head th.col-pdf,
.ml-table-fixed-head th.col-xml,
.ml-table-fixed-head th.sticky-actions { text-align: center !important; }
.ml-table-fixed-head .sticky-id,
.ml-table-fixed-head .sticky-actions {
  position: static !important;
  left: auto !important;
  right: auto !important;
  box-shadow: none !important;
  z-index: auto !important;
}
/* ===== FIM HEADER FIXO REAL ===== */

/* ===== FIM TABELA NÍVEL MERCADO LIVRE ===== */



/* ===== AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */
/* Comprovantes Fiscais: filtros compactos para caberem em uma única linha em telas largas */
body.dm-global-page form[action="/lancamentos"] .filters {
  display: grid !important;
  grid-template-columns: 1.05fr 1.05fr 1.05fr 1.05fr 1.05fr 1fr .92fr .92fr auto !important;
  align-items: end !important;
  gap: 8px !important;
  padding: 12px 14px !important;
}

body.dm-global-page form[action="/lancamentos"] .filters > div {
  min-width: 0 !important;
}

body.dm-global-page form[action="/lancamentos"] .filters label {
  display: block !important;
  margin: 0 0 5px !important;
  font-size: 10px !important;
  line-height: 1.05 !important;
  font-weight: 900 !important;
  white-space: nowrap !important;
}

body.dm-global-page form[action="/lancamentos"] .filters input,
body.dm-global-page form[action="/lancamentos"] .filters select {
  width: 100% !important;
  min-width: 0 !important;
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 10px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons {
  display: inline-flex !important;
  align-items: end !important;
  justify-content: flex-start !important;
  gap: 7px !important;
  min-width: 142px !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons button,
body.dm-global-page form[action="/lancamentos"] .filter-buttons a {
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 13px !important;
  font-size: 11px !important;
  border-radius: 11px !important;
}

@media (max-width: 1280px) {
  body.dm-global-page form[action="/lancamentos"] .filters {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

/* Espaço do Contador: conteúdo interno da coluna Enviar Arquivo alinhado à esquerda */
.contador-premium-page .contador-table th:nth-child(4) {
  text-align: center !important;
}

.contador-premium-page .contador-table td:nth-child(4) {
  text-align: left !important;
  padding-left: 10px !important;
  padding-right: 8px !important;
}

.contador-premium-page .upload-cell-compact {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  flex-wrap: nowrap !important;
  max-width: 100% !important;
  margin-left: 0 !important;
}

.contador-premium-page .btn-upload-open {
  width: auto !important;
  min-width: 112px !important;
  height: 30px !important;
  min-height: 30px !important;
  padding: 0 12px !important;
  font-size: 10.8px !important;
  line-height: 1 !important;
  border-radius: 11px !important;
}

.contador-premium-page .upload-cell-compact .clip-indicator,
.contador-premium-page .upload-cell-compact .empty-inline,
.contador-premium-page .upload-cell-compact .attached-badge,
.contador-premium-page .upload-cell-compact .attached-empty {
  flex: 0 0 auto !important;
}
/* ===== FIM AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */

</style>
      </head>
      <body class="dm-global-page">
        ${renderGlobalHeader(req, {
          titulo: 'Comprovantes Fiscais',
          subtitulo: 'Consulte, filtre, edite e acompanhe todos os lançamentos cadastrados.',
          paginaAtual: 'lancamentos',
          extraActions: `
            <a class="dm-menu-btn" href="/exportar-excel?fornecedor=${encodeURIComponent(fornecedor)}&categoria_id=${encodeURIComponent(categoria_id)}&tipo_pagamento=${encodeURIComponent(tipo_pagamento)}&cnpj_cpf=${encodeURIComponent(cnpj_cpf)}&codigo_pagamento=${encodeURIComponent(codigo_pagamento)}&numero_documento=${encodeURIComponent(numero_documento)}&data_inicio=${encodeURIComponent(data_inicio)}&data_fim=${encodeURIComponent(data_fim)}">Exportar Excel</a>
            <button type="button" class="dm-menu-btn" onclick="togglePainelColunas()">Colunas</button>
          `
        })}
        <div class="ml-skeleton-overlay" id="mlSkeletonOverlay" aria-hidden="true"><div class="ml-skeleton-card"><div class="ml-skeleton-title"></div><div class="ml-skeleton-line"></div><div class="ml-skeleton-line"></div><div class="ml-skeleton-line"></div><div class="ml-skeleton-line"></div></div></div>
        <div class="container">
          <div class="card">
            <h1>📋 Comprovantes Fiscais </h1>

            <div id="painel-colunas" class="painel-colunas" style="display:none;">
              <label><input type="checkbox" data-col="col-cnpj"> CNPJ/CPF</label>
              <label><input type="checkbox" data-col="col-codpag"> Cód. pagamento</label>
              <label><input type="checkbox" data-col="col-pagamento"> Pagamento</label>
              <label><input type="checkbox" data-col="col-categoria"> Categoria</label>
              <label><input type="checkbox" data-col="col-pdf"> PDF</label>
              <label><input type="checkbox" data-col="col-xml"> XML</label>
            </div>

            <form method="GET" action="/lancamentos">
              <div class="filters">
                <div>
                  <label for="fornecedor">Fornecedor</label>
                  <input id="fornecedor" name="fornecedor" value="${fornecedor}" placeholder="Buscar fornecedor" />
                </div>

                <div>
                  <label for="cnpj_cpf">CNPJ/CPF</label>
                  <input id="cnpj_cpf" name="cnpj_cpf" value="${cnpj_cpf}" placeholder="Buscar CNPJ/CPF" />
                </div>

                <div>
                  <label for="codigo_pagamento">Código de pagamento</label>
                  <input id="codigo_pagamento" name="codigo_pagamento" value="${codigo_pagamento}" placeholder="Buscar código" />
                </div>

                <div>
                  <label for="numero_documento">Número do documento</label>
                  <input id="numero_documento" name="numero_documento" value="${numero_documento}" placeholder="Buscar número" />
                </div>

                <div>
                  <label for="categoria_id">Categoria</label>
                  <select id="categoria_id" name="categoria_id">
                    ${optionsCategorias}
                  </select>
                </div>

                <div>
                  <label for="tipo_pagamento">Pagamento</label>
                  <select id="tipo_pagamento" name="tipo_pagamento">
                    <option value="">Todos</option>
                    <option value="PIX" ${tipo_pagamento === 'PIX' ? 'selected' : ''}>PIX</option>
                    <option value="Boleto" ${tipo_pagamento === 'Boleto' ? 'selected' : ''}>Boleto</option>
                    <option value="Guia" ${tipo_pagamento === 'Guia' ? 'selected' : ''}>Guia</option>
                    <option value="Dinheiro" ${tipo_pagamento === 'Dinheiro' ? 'selected' : ''}>Dinheiro</option>
                    <option value="DEB" ${tipo_pagamento === 'DEB' ? 'selected' : ''}>DEB</option>
                    <option value="DOP" ${tipo_pagamento === 'DOP' ? 'selected' : ''}>DOP</option>
                    <option value="CAR Inter" ${tipo_pagamento === 'CAR Inter' ? 'selected' : ''}>CAR Inter</option>
                    <option value="CAR VISA CX" ${tipo_pagamento === 'CAR VISA CX' ? 'selected' : ''}>CAR VISA CX</option>
                    <option value="CAR ELO CX" ${tipo_pagamento === 'CAR ELO CX' ? 'selected' : ''}>CAR ELO CX</option>
                    <option value="CAR Outro" ${tipo_pagamento === 'CAR Outro' ? 'selected' : ''}>CAR Outro</option>
                  </select>
                </div>

                <div>
                  <label for="data_inicio">Data inicial</label>
                  <input id="data_inicio" type="date" name="data_inicio" value="${data_inicio}" />
                </div>

                <div>
                  <label for="data_fim">Data final</label>
                  <input id="data_fim" type="date" name="data_fim" value="${data_fim}" />
                </div>

                <div class="filter-buttons">
                  <button type="submit">Filtrar</button>
                  <a href="/lancamentos">Limpar</a>
                </div>
              </div>
            </form>

            <div class="summary">
              <div class="sum-card">
                <div class="sum-title">Quantidade de itens filtrados</div>
                <div class="sum-value">${totalItens}</div>
              </div>
              <div class="sum-card">
                <div class="sum-title">Valor total filtrado</div>
                <div class="sum-value">${formatMoneyBR(valorTotal)}</div>
              </div>
            </div>

            <div class="ml-table-toolbar">
              <span id="mlTableCounter">Exibindo lançamentos carregados</span>
              <span>Rolagem inteligente com cabeçalho, ID e ações fixos</span>
            </div>

            <div class="ml-table-shell" id="mlTableShell">
              <table class="ml-table">
                <thead>
                  <tr>
                    <th class="col-id sticky-id">ID</th>
                    <th>Documento</th>
                    <th>Número</th>
                    <th>Data</th>
                    <th>Fornecedor</th>
                    <th class="col-cnpj">CNPJ/CPF</th>
                    <th class="col-codpag">Cód. pagamento</th>
                    <th class="col-valor">Valor</th>
                    <th class="col-pagamento">Pagamento</th>
                    <th class="col-categoria">Categoria</th>
                    <th class="col-pdf">PDF</th>
                    <th class="col-xml">XML</th>
                    <th class="sticky-actions">Ações</th>
                  </tr>
                </thead>
                <tbody id="mlLancamentosBody">
                  ${linhas || '<tr class="data-row"><td colspan="13">Nenhum lançamento encontrado.</td></tr>'}
                </tbody>
              </table>
              <div class="ml-load-more" id="mlLoadMore"><span class="ml-spinner"></span> Carregando mais lançamentos...</div>
            </div>
          </div>
        </div>

        <script>
          function togglePainelColunas() {
            const painel = document.getElementById('painel-colunas');
            painel.style.display = painel.style.display === 'none' ? 'flex' : 'none';
          }

          function aplicarColuna(nomeColuna, mostrar) {
            document.querySelectorAll('.' + nomeColuna).forEach(el => {
              el.style.display = mostrar ? '' : 'none';
            });
            if (window.mlLancamentosSyncHeader) window.mlLancamentosSyncHeader();
          }

          function salvarPreferenciasColunas() {
            const preferencias = {};
            document.querySelectorAll('#painel-colunas input[type="checkbox"]').forEach(chk => {
              preferencias[chk.dataset.col] = chk.checked;
            });
            localStorage.setItem('painelFiscalColunas', JSON.stringify(preferencias));
          }

          function carregarPreferenciasColunas() {
            const padrao = {
              'col-cnpj': false,
              'col-codpag': false,
              'col-pagamento': true,
              'col-categoria': true,
              'col-pdf': true,
              'col-xml': true
            };

            let preferencias = padrao;
            const salvo = localStorage.getItem('painelFiscalColunas');

            if (salvo) {
              try {
                preferencias = { ...padrao, ...JSON.parse(salvo) };
              } catch (e) {}
            }

            document.querySelectorAll('#painel-colunas input[type="checkbox"]').forEach(chk => {
              const mostrar = !!preferencias[chk.dataset.col];
              chk.checked = mostrar;
              aplicarColuna(chk.dataset.col, mostrar);

              chk.addEventListener('change', () => {
                aplicarColuna(chk.dataset.col, chk.checked);
                salvarPreferenciasColunas();
              });
            });
          }

          function inicializarTabelaMercadoLivre() {
            const table = document.querySelector('.ml-table');
            const rows = Array.from(document.querySelectorAll('#mlLancamentosBody tr.data-row'));
            const counter = document.getElementById('mlTableCounter');
            const loader = document.getElementById('mlLoadMore');
            const pageSize = 35;
            let visible = 0;
            let loading = false;
            let fixedHeaderTable = null;

            function atualizarContador() {
              if (!counter) return;
              const total = rows.length;
              const exibidos = Math.min(visible, total);
              counter.textContent = total ? 'Exibindo ' + exibidos + ' de ' + total + ' lançamentos' : 'Nenhum lançamento encontrado';
            }

            function carregarMais() {
              if (loading) return;
              if (visible >= rows.length) {
                if (loader) loader.classList.remove('active');
                atualizarContador();
                return;
              }
              loading = true;
              if (loader && visible > 0) loader.classList.add('active');
              setTimeout(function () {
                const proximo = Math.min(visible + pageSize, rows.length);
                for (let i = visible; i < proximo; i++) rows[i].style.display = '';
                visible = proximo;
                loading = false;
                if (loader) loader.classList.toggle('active', visible < rows.length);
                atualizarContador();
                sincronizarHeaderFixo();
              }, visible === 0 ? 0 : 220);
            }

            function criarHeaderFixo() {
              if (!table || !table.tHead) return;
              if (fixedHeaderTable) fixedHeaderTable.remove();
              fixedHeaderTable = document.createElement('table');
              fixedHeaderTable.className = 'ml-table-fixed-head';
              fixedHeaderTable.setAttribute('aria-hidden', 'true');
              fixedHeaderTable.appendChild(table.tHead.cloneNode(true));
              document.body.appendChild(fixedHeaderTable);
              window.mlLancamentosSyncHeader = sincronizarHeaderFixo;
            }

            function sincronizarHeaderFixo() {
              if (!table || !table.tHead || !fixedHeaderTable) return;
              const tableRect = table.getBoundingClientRect();
              const originalThs = Array.from(table.tHead.querySelectorAll('th'));
              const clonedThs = Array.from(fixedHeaderTable.querySelectorAll('th'));
              const headerHeight = table.tHead.getBoundingClientRect().height || 40;
              const deveFixar = tableRect.top < 0 && tableRect.bottom > headerHeight;

              if (!deveFixar) {
                fixedHeaderTable.classList.remove('is-visible');
                return;
              }

              fixedHeaderTable.style.left = tableRect.left + 'px';
              fixedHeaderTable.style.width = tableRect.width + 'px';

              originalThs.forEach(function (th, index) {
                const clone = clonedThs[index];
                if (!clone) return;
                const style = window.getComputedStyle(th);
                const visivel = style.display !== 'none' && th.offsetWidth > 0;
                clone.style.display = visivel ? '' : 'none';
                if (visivel) {
                  const width = th.getBoundingClientRect().width;
                  clone.style.width = width + 'px';
                  clone.style.minWidth = width + 'px';
                  clone.style.maxWidth = width + 'px';
                }
              });

              fixedHeaderTable.classList.add('is-visible');
            }

            rows.forEach(function (row) { row.style.display = 'none'; });
            carregarMais();
            criarHeaderFixo();
            sincronizarHeaderFixo();

            function chegouPertoDoFimDaPagina() {
              const doc = document.documentElement;
              return (window.innerHeight + window.scrollY) >= (doc.scrollHeight - 260);
            }
            window.addEventListener('scroll', function () {
              if (chegouPertoDoFimDaPagina()) carregarMais();
              sincronizarHeaderFixo();
            }, { passive: true });
            window.addEventListener('resize', function () {
              if (chegouPertoDoFimDaPagina()) carregarMais();
              sincronizarHeaderFixo();
            });
          }

          function inicializarLoadingSkeleton() {
            const overlay = document.getElementById('mlSkeletonOverlay');
            const mostrar = function () { if (overlay) overlay.style.display = 'flex'; };
            document.querySelectorAll('form').forEach(function (form) { form.addEventListener('submit', mostrar); });
            document.querySelectorAll('a[href^="/lancamentos"], a[href^="/exportar-excel"], a[href^="/editar/"], a[href="/novo"]').forEach(function (link) {
              link.addEventListener('click', function () { if (!link.target || link.target === '_self') mostrar(); });
            });
          }
          document.addEventListener('DOMContentLoaded', function () {
            carregarPreferenciasColunas();
            inicializarTabelaMercadoLivre();
            inicializarLoadingSkeleton();
          });
        </script>

        <script>
          function abrirModalUpload(id) {
            const modal = document.getElementById(id);
            if (modal) modal.classList.add('is-open');
          }

          function fecharModalUpload(id) {
            const modal = document.getElementById(id);
            if (!modal) return;
            modal.classList.remove('is-open');
            const input = modal.querySelector('input[type="file"]');
            const preview = modal.querySelector('[data-preview-list]');
            if (input) input.value = '';
            if (preview) preview.innerHTML = '<div class="modal-empty">Nenhum arquivo selecionado.</div>';
          }

          function atualizarPreviewArquivos(input) {
            const form = input.closest('form');
            const list = form ? form.querySelector('[data-preview-list]') : null;
            if (!list) return;

            const dt = new DataTransfer();
            Array.from(input.files || []).forEach(file => dt.items.add(file));
            input.files = dt.files;

            renderPreview(input, list);
          }

          function renderPreview(input, list) {
            const files = Array.from(input.files || []);
            if (!files.length) {
              list.innerHTML = '<div class="modal-empty">Nenhum arquivo selecionado.</div>';
              return;
            }

            list.innerHTML = '';
            files.forEach((file, index) => {
              const row = document.createElement('div');
              row.className = 'modal-file-row';

              const name = document.createElement('span');
              name.textContent = file.name;
              name.title = file.name;

              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'modal-delete';
              btn.title = 'Remover da seleção';
              btn.textContent = '🗑';
              btn.onclick = function () {
                const novo = new DataTransfer();
                Array.from(input.files || []).forEach((item, i) => {
                  if (i !== index) novo.items.add(item);
                });
                input.files = novo.files;
                renderPreview(input, list);
              };

              row.appendChild(name);
              row.appendChild(btn);
              list.appendChild(row);
            });
          }

          document.addEventListener('click', function(event) {
            if (event.target && event.target.classList && event.target.classList.contains('upload-modal-overlay')) {
              event.target.classList.remove('is-open');
            }
          });
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao listar lançamentos:\n${error.message}</pre>`);
  }
});

router.get('/exportar-excel', async (req, res) => {
  try {
    const {
      fornecedor = '',
      categoria_id = '',
      tipo_pagamento = '',
      cnpj_cpf = '',
      codigo_pagamento = '',
      numero_documento = '',
      data_inicio = '',
      data_fim = ''
    } = req.query;

    let where = [];
    let values = [];

    if (fornecedor) {
      values.push(`%${fornecedor}%`);
      where.push(`l.fornecedor ILIKE $${values.length}`);
    }
    if (categoria_id) {
      values.push(categoria_id);
      where.push(`l.categoria_id = $${values.length}`);
    }
    if (tipo_pagamento) {
      values.push(tipo_pagamento);
      where.push(`l.tipo_pagamento = $${values.length}`);
    }
    if (cnpj_cpf) {
      values.push(`%${cnpj_cpf}%`);
      where.push(`l.cnpj_cpf ILIKE $${values.length}`);
    }
    if (codigo_pagamento) {
      values.push(`%${codigo_pagamento}%`);
      where.push(`l.codigo_pagamento ILIKE $${values.length}`);
    }
    if (numero_documento) {
      values.push(`%${numero_documento}%`);
      where.push(`l.numero_documento ILIKE $${values.length}`);
    }
    if (data_inicio) {
      values.push(data_inicio);
      where.push(`l.data_despesa >= $${values.length}::date`);
    }
    if (data_fim) {
      values.push(data_fim);
      where.push(`l.data_despesa <= $${values.length}::date`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const result = await pool.query(
      `
      SELECT
  l.id,
  l.tipo_documento,
  l.numero_documento,
  l.data_despesa,
  l.fornecedor,
  l.cnpj_cpf,
  l.codigo_pagamento,
  l.valor,
  l.tipo_pagamento,
  l.anexo_pdf,
  l.anexo_xml,
  c.nome AS categoria,
  c.categoria_pai_id,
  p.nome AS categoria_principal,
  CASE
    WHEN c.categoria_pai_id IS NULL THEN ''
    ELSE c.nome
  END AS subcategoria
FROM lancamentos l
LEFT JOIN categorias c ON c.id = l.categoria_id
LEFT JOIN categorias p ON p.id = c.categoria_pai_id
      ${whereSql}
      ORDER BY l.id DESC
      `,
      values
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Lancamentos');

    worksheet.columns = [
  { header: 'ID', key: 'id', width: 10 },
  { header: 'Tipo do documento', key: 'tipo_documento', width: 22 },
  { header: 'Número do documento', key: 'numero_documento', width: 22 },
  { header: 'Data', key: 'data_despesa', width: 15 },
  { header: 'Fornecedor', key: 'fornecedor', width: 28 },
  { header: 'CNPJ/CPF', key: 'cnpj_cpf', width: 22 },
  { header: 'Código de pagamento', key: 'codigo_pagamento', width: 24 },
  { header: 'Valor', key: 'valor', width: 15 },
  { header: 'Tipo de pagamento', key: 'tipo_pagamento', width: 24 },
  { header: 'Categoria Principal', key: 'categoria_principal', width: 24 },
  { header: 'Subcategoria', key: 'subcategoria', width: 24 },
  { header: 'PDF', key: 'anexo_pdf', width: 28 },
  { header: 'XML', key: 'anexo_xml', width: 28 }
];

    result.rows.forEach(l => {
const nomePagamento = (l.tipo_pagamento || 'SemPagamento')
  .toString().trim().replace(/\s+/g, ' ');

const nomeFornecedor = (l.fornecedor || 'SemFornecedor')
  .toString().trim().replace(/\s+/g, ' ');

const nomeCategoria = (l.categoria || 'SemCategoria')
  .toString().trim().replace(/\s+/g, ' ');

const nomeNumero = (l.numero_documento || 'SemNumero')
  .toString().trim().replace(/\s+/g, ' ');

const nomeValor = formatMoneyBR(l.valor || 0)
  .replace(/\s+/g, '');

const nomeBaseDownload = `${nomePagamento}-${nomeFornecedor}-${nomeCategoria}-${nomeNumero}-${nomeValor}`
  .replace(/[\/\\:*?"<>|]/g, '-')
  .replace(/\s+/g, ' ')
  .trim();

  worksheet.addRow({
    id: l.id,
    tipo_documento: l.tipo_documento,
    numero_documento: l.numero_documento || '',
    data_despesa: l.data_despesa ? new Date(l.data_despesa).toISOString().split('T')[0] : '',
    fornecedor: l.fornecedor,
    cnpj_cpf: l.cnpj_cpf || '',
    codigo_pagamento: l.codigo_pagamento || '',
    valor: Number(l.valor),
    tipo_pagamento: l.tipo_pagamento,
    categoria_principal: l.categoria_pai_id ? (l.categoria_principal || '') : (l.categoria || ''),
    subcategoria: l.categoria_pai_id ? (l.subcategoria || '') : '',
    anexo_pdf: l.anexo_pdf ? `${nomeBaseDownload}.pdf` : '',
anexo_xml: l.anexo_xml ? `${nomeBaseDownload}.xml` : ''  });
});

    worksheet.getRow(1).font = { bold: true };
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.getCell(8).numFmt = 'R$ #,##0.00';
      }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="lancamentos.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.send(`<pre>Erro ao exportar Excel:\n${error.message}</pre>`);
  }
});

router.get('/categorias', protegerRota, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id,
        c.nome,
        c.categoria_pai_id,
        p.nome AS categoria_pai_nome
      FROM categorias c
      LEFT JOIN categorias p ON p.id = c.categoria_pai_id
      ORDER BY
        COALESCE(p.nome, c.nome),
        c.categoria_pai_id NULLS FIRST,
        c.nome
    `);

    let linhas = '';
    result.rows.forEach(c => {
      linhas += `
        <tr>
          <td>${c.id}</td>
          <td>${c.nome}</td>
          <td>${c.categoria_pai_id ? 'Subcategoria' : 'Principal'}</td>
          <td>${c.categoria_pai_nome || '—'}</td>
          <td>
            <a class="icon-btn" href="/categorias/editar/${c.id}" title="Editar">✏️</a>
            <a class="icon-btn" href="/categorias/excluir/${c.id}" onclick="return confirm('Excluir categoria?')" title="Excluir">🗑️</a>
          </td>
        </tr>
      `;
    });

    res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Categorias</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f6f8fb;
          margin: 0;
          color: #111827;
          font-size: 14px;
        }
        .container {
          max-width: 980px;
          margin: 40px auto;
          padding: 0 20px;
        }
        .card {
          background: #fff;
          border-radius: 14px;
          padding: 24px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.08);
        }
        h1 {
          margin-top: 0;
          margin-bottom: 18px;
          font-size: 26px;
        }
        .btn {
          background: #2563eb;
          color: white;
          padding: 10px 14px;
          border-radius: 8px;
          text-decoration: none;
          display: inline-block;
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 18px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          padding: 10px 12px;
          border-bottom: 1px solid #e5e7eb;
          text-align: left;
          font-size: 14px;
        }
        th {
          background: #eef2ff;
          font-weight: 700;
        }
        tr:hover td {
          background: #f9fafb;
        }
        .icon-btn {
          text-decoration: none;
          margin-right: 8px;
        }
      

/* ===== PADRÃO VISUAL PLENNATEC - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL PLENNATEC ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */



/* ===== AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */
/* Comprovantes Fiscais: filtros compactos para caberem em uma única linha em telas largas */
body.dm-global-page form[action="/lancamentos"] .filters {
  display: grid !important;
  grid-template-columns: 1.05fr 1.05fr 1.05fr 1.05fr 1.05fr 1fr .92fr .92fr auto !important;
  align-items: end !important;
  gap: 8px !important;
  padding: 12px 14px !important;
}

body.dm-global-page form[action="/lancamentos"] .filters > div {
  min-width: 0 !important;
}

body.dm-global-page form[action="/lancamentos"] .filters label {
  display: block !important;
  margin: 0 0 5px !important;
  font-size: 10px !important;
  line-height: 1.05 !important;
  font-weight: 900 !important;
  white-space: nowrap !important;
}

body.dm-global-page form[action="/lancamentos"] .filters input,
body.dm-global-page form[action="/lancamentos"] .filters select {
  width: 100% !important;
  min-width: 0 !important;
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 10px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons {
  display: inline-flex !important;
  align-items: end !important;
  justify-content: flex-start !important;
  gap: 7px !important;
  min-width: 142px !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons button,
body.dm-global-page form[action="/lancamentos"] .filter-buttons a {
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 13px !important;
  font-size: 11px !important;
  border-radius: 11px !important;
}

@media (max-width: 1280px) {
  body.dm-global-page form[action="/lancamentos"] .filters {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

/* Espaço do Contador: conteúdo interno da coluna Enviar Arquivo alinhado à esquerda */
.contador-premium-page .contador-table th:nth-child(4) {
  text-align: center !important;
}

.contador-premium-page .contador-table td:nth-child(4) {
  text-align: left !important;
  padding-left: 10px !important;
  padding-right: 8px !important;
}

.contador-premium-page .upload-cell-compact {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  flex-wrap: nowrap !important;
  max-width: 100% !important;
  margin-left: 0 !important;
}

.contador-premium-page .btn-upload-open {
  width: auto !important;
  min-width: 112px !important;
  height: 30px !important;
  min-height: 30px !important;
  padding: 0 12px !important;
  font-size: 10.8px !important;
  line-height: 1 !important;
  border-radius: 11px !important;
}

.contador-premium-page .upload-cell-compact .clip-indicator,
.contador-premium-page .upload-cell-compact .empty-inline,
.contador-premium-page .upload-cell-compact .attached-badge,
.contador-premium-page .upload-cell-compact .attached-empty {
  flex: 0 0 auto !important;
}
/* ===== FIM AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */

</style>
    </head>
    <body class="dm-global-page">
        ${renderGlobalHeader(req, { titulo: 'Categorias', subtitulo: 'Organize categorias e subcategorias usadas nos lançamentos.', paginaAtual: 'categorias' })}
      <div class="container">
        <div class="card">
          <h1>📁 Categorias</h1>

<div style="display:flex; gap:10px; margin-bottom:18px;">
  <a class="btn" href="/categorias/nova">+ Nova categoria</a>
  <a class="btn" href="/dashboard" style="background:#e5e7eb; color:#111827;">Voltar</a>
</div>

          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Principal</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${linhas || '<tr><td colspan="5">Nenhuma categoria cadastrada.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </body>
    </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao listar categorias:\n${error.message}</pre>`);
  }
});

// NOVA CATEGORIA - FORM
router.get('/categorias/nova', async (req, res) => {
  try {
    const principais = await pool.query(`
      SELECT id, nome
      FROM categorias
      WHERE categoria_pai_id IS NULL
      ORDER BY nome
    `);

    const opcoesPrincipais = principais.rows.map(c =>
      `<option value="${c.id}">${c.nome}</option>`
    ).join('');

    res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Nova categoria</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f6f8fb;
          margin: 0;
          color: #111827;
        }
        .container {
          max-width: 760px;
          margin: 40px auto;
          padding: 0 20px;
        }
        .card {
          background: #fff;
          border-radius: 14px;
          padding: 24px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.08);
        }
        h1 {
          margin-top: 0;
          margin-bottom: 18px;
          font-size: 26px;
        }
        label {
          display: block;
          margin-bottom: 8px;
          font-weight: bold;
          font-size: 14px;
        }
        input, select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          box-sizing: border-box;
          margin-bottom: 16px;
        }
        .actions {
          display: flex;
          gap: 10px;
          margin-top: 10px;
        }
        button, .btn-secondary {
          padding: 10px 14px;
          border-radius: 8px;
          text-decoration: none;
          border: none;
          font-size: 14px;
          font-weight: bold;
          display: inline-block;
        }
        button {
          background: #2563eb;
          color: #fff;
          cursor: pointer;
        }
        .btn-secondary {
          background: #e5e7eb;
          color: #111827;
        }
      

/* ===== PADRÃO VISUAL PLENNATEC - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL PLENNATEC ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */



/* ===== AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */
/* Comprovantes Fiscais: filtros compactos para caberem em uma única linha em telas largas */
body.dm-global-page form[action="/lancamentos"] .filters {
  display: grid !important;
  grid-template-columns: 1.05fr 1.05fr 1.05fr 1.05fr 1.05fr 1fr .92fr .92fr auto !important;
  align-items: end !important;
  gap: 8px !important;
  padding: 12px 14px !important;
}

body.dm-global-page form[action="/lancamentos"] .filters > div {
  min-width: 0 !important;
}

body.dm-global-page form[action="/lancamentos"] .filters label {
  display: block !important;
  margin: 0 0 5px !important;
  font-size: 10px !important;
  line-height: 1.05 !important;
  font-weight: 900 !important;
  white-space: nowrap !important;
}

body.dm-global-page form[action="/lancamentos"] .filters input,
body.dm-global-page form[action="/lancamentos"] .filters select {
  width: 100% !important;
  min-width: 0 !important;
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 10px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons {
  display: inline-flex !important;
  align-items: end !important;
  justify-content: flex-start !important;
  gap: 7px !important;
  min-width: 142px !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons button,
body.dm-global-page form[action="/lancamentos"] .filter-buttons a {
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 13px !important;
  font-size: 11px !important;
  border-radius: 11px !important;
}

@media (max-width: 1280px) {
  body.dm-global-page form[action="/lancamentos"] .filters {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

/* Espaço do Contador: conteúdo interno da coluna Enviar Arquivo alinhado à esquerda */
.contador-premium-page .contador-table th:nth-child(4) {
  text-align: center !important;
}

.contador-premium-page .contador-table td:nth-child(4) {
  text-align: left !important;
  padding-left: 10px !important;
  padding-right: 8px !important;
}

.contador-premium-page .upload-cell-compact {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  flex-wrap: nowrap !important;
  max-width: 100% !important;
  margin-left: 0 !important;
}

.contador-premium-page .btn-upload-open {
  width: auto !important;
  min-width: 112px !important;
  height: 30px !important;
  min-height: 30px !important;
  padding: 0 12px !important;
  font-size: 10.8px !important;
  line-height: 1 !important;
  border-radius: 11px !important;
}

.contador-premium-page .upload-cell-compact .clip-indicator,
.contador-premium-page .upload-cell-compact .empty-inline,
.contador-premium-page .upload-cell-compact .attached-badge,
.contador-premium-page .upload-cell-compact .attached-empty {
  flex: 0 0 auto !important;
}
/* ===== FIM AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */

</style>
    </head>
    <body class="dm-global-page">
        ${renderGlobalHeader(req, { titulo: 'Nova Categoria', subtitulo: 'Cadastre uma nova categoria ou subcategoria operacional.', paginaAtual: 'categorias' })}
      <div class="container">
        <div class="card">
          <h1>📁 Nova categoria</h1>

          <form method="POST" action="/categorias/nova">
            <label for="nome">Nome da categoria</label>
            <input id="nome" name="nome" required />

            <label for="categoria_pai_id">Categoria principal</label>
            <select id="categoria_pai_id" name="categoria_pai_id">
              <option value="">Nenhuma (categoria principal)</option>
              ${opcoesPrincipais}
            </select>

            <div class="actions">
              <button type="submit">Salvar</button>
              <a class="btn-secondary" href="/categorias">Cancelar</a>
            </div>
          </form>
        </div>
      </div>
    </body>
    </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao carregar nova categoria:\n${error.message}</pre>`);
  }
});

// NOVA CATEGORIA - SALVAR
router.post('/categorias/nova', async (req, res) => {
  try {
    const { nome, categoria_pai_id } = req.body;

    if (!nome || !nome.trim()) {
      return res.send('<pre>Nome da categoria é obrigatório.</pre>');
    }

    await pool.query(
      'INSERT INTO categorias (nome, categoria_pai_id) VALUES ($1, $2)',
      [nome.trim(), categoria_pai_id || null]
    );

    res.redirect('/categorias');
  } catch (error) {
    res.send(`<pre>Erro ao salvar categoria:\n${error.message}</pre>`);
  }
});

// EDITAR CATEGORIA - FORM
router.get('/categorias/editar/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM categorias WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.send('<pre>Categoria não encontrada.</pre>');
    }

    const categoria = result.rows[0];

    const principais = await pool.query(`
      SELECT id, nome
      FROM categorias
      WHERE categoria_pai_id IS NULL
        AND id <> $1
      ORDER BY nome
    `, [id]);

    const opcoesPrincipais = principais.rows.map(c => `
      <option value="${c.id}" ${String(c.id) === String(categoria.categoria_pai_id) ? 'selected' : ''}>
        ${c.nome}
      </option>
    `).join('');

    res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Editar categoria</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f6f8fb;
          margin: 0;
          color: #111827;
        }
        .container {
          max-width: 760px;
          margin: 40px auto;
          padding: 0 20px;
        }
        .card {
          background: #fff;
          border-radius: 14px;
          padding: 24px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.08);
        }
        h1 {
          margin-top: 0;
          margin-bottom: 18px;
          font-size: 26px;
        }
        label {
          display: block;
          margin-bottom: 8px;
          font-weight: bold;
          font-size: 14px;
        }
        input, select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          box-sizing: border-box;
          margin-bottom: 16px;
        }
        .actions {
          display: flex;
          gap: 10px;
          margin-top: 10px;
        }
        button, .btn-secondary {
          padding: 10px 14px;
          border-radius: 8px;
          text-decoration: none;
          border: none;
          font-size: 14px;
          font-weight: bold;
          display: inline-block;
        }
        button {
          background: #2563eb;
          color: #fff;
          cursor: pointer;
        }
        .btn-secondary {
          background: #e5e7eb;
          color: #111827;
        }
      

/* ===== PADRÃO VISUAL PLENNATEC - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL PLENNATEC ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */



/* ===== AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */
/* Comprovantes Fiscais: filtros compactos para caberem em uma única linha em telas largas */
body.dm-global-page form[action="/lancamentos"] .filters {
  display: grid !important;
  grid-template-columns: 1.05fr 1.05fr 1.05fr 1.05fr 1.05fr 1fr .92fr .92fr auto !important;
  align-items: end !important;
  gap: 8px !important;
  padding: 12px 14px !important;
}

body.dm-global-page form[action="/lancamentos"] .filters > div {
  min-width: 0 !important;
}

body.dm-global-page form[action="/lancamentos"] .filters label {
  display: block !important;
  margin: 0 0 5px !important;
  font-size: 10px !important;
  line-height: 1.05 !important;
  font-weight: 900 !important;
  white-space: nowrap !important;
}

body.dm-global-page form[action="/lancamentos"] .filters input,
body.dm-global-page form[action="/lancamentos"] .filters select {
  width: 100% !important;
  min-width: 0 !important;
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 10px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons {
  display: inline-flex !important;
  align-items: end !important;
  justify-content: flex-start !important;
  gap: 7px !important;
  min-width: 142px !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons button,
body.dm-global-page form[action="/lancamentos"] .filter-buttons a {
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 13px !important;
  font-size: 11px !important;
  border-radius: 11px !important;
}

@media (max-width: 1280px) {
  body.dm-global-page form[action="/lancamentos"] .filters {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

/* Espaço do Contador: conteúdo interno da coluna Enviar Arquivo alinhado à esquerda */
.contador-premium-page .contador-table th:nth-child(4) {
  text-align: center !important;
}

.contador-premium-page .contador-table td:nth-child(4) {
  text-align: left !important;
  padding-left: 10px !important;
  padding-right: 8px !important;
}

.contador-premium-page .upload-cell-compact {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  flex-wrap: nowrap !important;
  max-width: 100% !important;
  margin-left: 0 !important;
}

.contador-premium-page .btn-upload-open {
  width: auto !important;
  min-width: 112px !important;
  height: 30px !important;
  min-height: 30px !important;
  padding: 0 12px !important;
  font-size: 10.8px !important;
  line-height: 1 !important;
  border-radius: 11px !important;
}

.contador-premium-page .upload-cell-compact .clip-indicator,
.contador-premium-page .upload-cell-compact .empty-inline,
.contador-premium-page .upload-cell-compact .attached-badge,
.contador-premium-page .upload-cell-compact .attached-empty {
  flex: 0 0 auto !important;
}
/* ===== FIM AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */

</style>
    </head>
    <body class="dm-global-page">
        ${renderGlobalHeader(req, { titulo: 'Editar Categoria', subtitulo: 'Atualize o nome e a hierarquia da categoria selecionada.', paginaAtual: 'categorias' })}
      <div class="container">
        <div class="card">
          <h1>✏️ Editar categoria</h1>

          <form method="POST" action="/categorias/editar/${categoria.id}">
            <label for="nome">Nome da categoria</label>
            <input id="nome" name="nome" value="${categoria.nome}" required />

            <label for="categoria_pai_id">Categoria principal</label>
            <select id="categoria_pai_id" name="categoria_pai_id">
              <option value="">Nenhuma (categoria principal)</option>
              ${opcoesPrincipais}
            </select>

            <div class="actions">
              <button type="submit">Atualizar</button>
              <a class="btn-secondary" href="/categorias">Cancelar</a>
            </div>
          </form>
        </div>
      </div>
    </body>
    </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao carregar categoria:\n${error.message}</pre>`);
  }
});

// EDITAR CATEGORIA - SALVAR
router.post('/categorias/editar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, categoria_pai_id } = req.body;

    if (!nome || !nome.trim()) {
      return res.send('<pre>Nome da categoria é obrigatório.</pre>');
    }

    await pool.query(
      'UPDATE categorias SET nome = $1, categoria_pai_id = $2 WHERE id = $3',
      [nome.trim(), categoria_pai_id || null, id]
    );

    res.redirect('/categorias');
  } catch (error) {
    res.send(`<pre>Erro ao atualizar categoria:\n${error.message}</pre>`);
  }
});

// EXCLUIR CATEGORIA
router.get('/categorias/excluir/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM categorias WHERE id = $1', [id]);

    res.redirect('/categorias');
  } catch (error) {
    res.send(`<pre>Erro ao excluir categoria:\n${error.message}</pre>`);
  }
});

router.get('/', (req, res) => {
  res.redirect('/lancamentos');
});
// ===== ROTINA DE DESPESAS =====

// LISTAGEM
router.get('/rotina-despesas', protegerRota, permitirPerfis('ADMIN', 'USUARIO'), async (req, res) => {
  try {
    await ensureRotinaDespesasColumns();

    const mesAnoEdicao = (await getPainelConfig('rotina_mes_ano_edicao', '')) || getMesAnoAtual();
    const mesAnoEdicaoLabel = formatMesAnoCurto(mesAnoEdicao);
    const anoMesEdicao = String(mesAnoEdicao || getMesAnoAtual()).split('-')[0] || String(new Date().getFullYear());
    const mesNumeroEdicao = String(mesAnoEdicao || getMesAnoAtual()).split('-')[1] || String(new Date().getMonth() + 1).padStart(2, '0');
    const statusMesEdicao = await getStatusMesCompetencia(mesAnoEdicao);
    const fornecedorFiltro = String(req.query.fornecedor || '').trim();
    const statusFiltro = (req.query.status || '').trim();
    const diaVencimentoFiltro = normalizarDiaVencimento(req.query.dia_vencimento || '');
    const vencimentoFiltro = diaVencimentoFiltro;

    const fornecedoresResult = await pool.query(`
      SELECT DISTINCT fornecedor
      FROM rotina_despesas
      WHERE fornecedor IS NOT NULL AND TRIM(fornecedor) <> ''
      ORDER BY fornecedor ASC
    `);

    const fornecedoresOptionsHtml = fornecedoresResult.rows.map(row => {
      const fornecedor = String(row.fornecedor || '').trim();
      const selected = fornecedorFiltro === fornecedor ? 'selected' : '';
      const label = fornecedor
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      const value = fornecedor
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;');
      return `<option value="${value}" ${selected}>${label}</option>`;
    }).join('');

    const whereParts = [];
    const values = [];

    if (fornecedorFiltro) {
      values.push(`%${fornecedorFiltro}%`);
      whereParts.push(`r.fornecedor ILIKE $${values.length + 1}`);
    }

    if (statusFiltro) {
      values.push(statusFiltro);
      whereParts.push(`COALESCE(sm.status_linha, r.status, 'PENDENTE') = $${values.length + 1}`);
    }

    if (diaVencimentoFiltro) {
      values.push(diaVencimentoFiltro);
      whereParts.push(`NULLIF(regexp_replace(COALESCE(r.dia_vencimento::text, ''), '[^0-9]', '', 'g'), '') = $${values.length + 1}`);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const opcoesMesAnoHtml = gerarOpcoesMesAno(mesAnoEdicao);

    const result = await pool.query(`
      SELECT
        r.*,
        cp.nome AS categoria_principal_nome,
        cs.nome AS subcategoria_nome,
        COALESCE(sm.status_linha, r.status, 'PENDENTE') AS status_linha_mes,
        COALESCE(sm.status_pagto, 'A_PAGAR') AS status_pagto_mes,
        COALESCE(sm.ativo, r.ativo, true) AS ativo_mes
      FROM rotina_despesas r
      LEFT JOIN categorias cp ON cp.id = r.categoria_principal_id
      LEFT JOIN categorias cs ON cs.id = r.subcategoria_id
      LEFT JOIN rotina_despesas_status_mensal sm
        ON sm.rotina_id = r.id
       AND sm.mes_ano = $1
      ${whereSql}
      ORDER BY r.ordem, r.fornecedor
    `, [mesAnoEdicao, ...values]);

    let linhas = '';

    result.rows.forEach(r => {
      const ondeEncontrarHtml =
        r.onde_encontrar_comprovante && r.onde_encontrar_comprovante.startsWith('http')
          ? `<a href="${r.onde_encontrar_comprovante}" target="_blank" rel="noopener noreferrer">Abrir link</a>`
          : (r.onde_encontrar_comprovante || '');

      linhas += `
        <tr>
          <td class="col-rot-fornecedor">${r.fornecedor || ''}</td>
          <td class="col-rot-cnpj">${r.cnpj_cpf || ''}</td>
          <td class="col-rot-fato">${r.fato_gerador || ''}</td>
          <td class="col-rot-onde">${ondeEncontrarHtml}</td>
          <td class="col-rot-pagamento">${r.tipo_pagamento_padrao || ''}</td>
          <td class="col-rot-cat-principal">${r.categoria_principal_nome || ''}</td>
          <td class="col-rot-subcategoria">${r.subcategoria_nome || ''}</td>
          <td class="col-vencimento col-rot-vencimento">${formatDiaVencimento(r.dia_vencimento) || formatDateBR(r.data_vencimento) || '-'}</td>

          <td class="col-status-pagto col-rot-status-pagto">
            <form method="POST" action="/rotina-despesas/status-pagto/${r.id}" class="status-form">
              <input type="hidden" name="fornecedor_filtro" value="${fornecedorFiltro}">
              <input type="hidden" name="status_filtro" value="${statusFiltro}">
              <input type="hidden" name="mes_ano_filtro" value="${mesAnoEdicao}">
              <input type="hidden" name="dia_vencimento_filtro" value="${diaVencimentoFiltro}">

              <select
                name="status_pagto"
                class="status-select status-pagto-${normalizarStatusPagto(r.status_pagto_mes)}"
                onchange="this.form.submit()"
              >
                ${renderStatusPagtoOptions(r.status_pagto_mes)}
              </select>
            </form>
          </td>

          <td class="col-status col-rot-status">
            <form method="POST" action="/rotina-despesas/status/${r.id}" class="status-form">
              <input type="hidden" name="fornecedor_filtro" value="${fornecedorFiltro}">
              <input type="hidden" name="status_filtro" value="${statusFiltro}">
              <input type="hidden" name="mes_ano_filtro" value="${mesAnoEdicao}">
              <input type="hidden" name="dia_vencimento_filtro" value="${diaVencimentoFiltro}">

              <select
                name="status"
                class="status-select status-${normalizarStatusLinha(r.status_linha_mes)}"
                onchange="this.form.submit()"
              >
                <option value="PENDENTE" ${normalizarStatusLinha(r.status_linha_mes) === 'PENDENTE' ? 'selected' : ''}>PENDENTE</option>
                <option value="FEITO" ${normalizarStatusLinha(r.status_linha_mes) === 'FEITO' ? 'selected' : ''}>FEITO</option>
                <option value="N/A" ${normalizarStatusLinha(r.status_linha_mes) === 'N/A' ? 'selected' : ''}>Não tem</option>
              </select>
            </form>
          </td>

          <td class="col-ativo col-rot-ativo">
            <form method="POST" action="/rotina-despesas/ativo/${r.id}" class="status-form">
              <input type="hidden" name="fornecedor_filtro" value="${fornecedorFiltro}">
              <input type="hidden" name="status_filtro" value="${statusFiltro}">
              <input type="hidden" name="mes_ano_filtro" value="${mesAnoEdicao}">
              <input type="hidden" name="dia_vencimento_filtro" value="${diaVencimentoFiltro}">
              <select name="ativo" class="status-select status-ativo-${r.ativo_mes ? 'SIM' : 'NAO'}" onchange="this.form.submit()">
                <option value="true" ${r.ativo_mes ? 'selected' : ''}>Sim</option>
                <option value="false" ${!r.ativo_mes ? 'selected' : ''}>Não</option>
              </select>
            </form>
          </td>

          <td class="col-acoes col-rot-acoes">
            <div class="acoes-wrap">
              <a class="icon-btn" href="/novo?rotina_id=${r.id}" title="Novo lançamento">➕</a>
              <a class="icon-btn" href="/rotina-despesas/editar/${r.id}" title="Editar">✏️</a>
              <a class="icon-btn" href="/rotina-despesas/excluir/${r.id}" title="Excluir" onclick="return confirm('Deseja excluir este item da rotina?')">🗑️</a>
            </div>
          </td>
        </tr>
      `;
    });

    res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>Lista de Contas à pagar</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f6f8fb;
          margin: 0;
          color: #111827;
        }

        .container {
          max-width: 1380px;
          margin: 40px auto;
          padding: 0 20px;
        }

        .card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }

        h1 {
          margin-top: 0;
          margin-bottom: 20px;
          font-size: 28px;
        }

        .top-bar {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .filters,
        .month-reference-form {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: end;
        }

        .month-reference-form {
          margin-left: auto;
          padding: 10px 12px;
          border-radius: 16px;
          background: rgba(248, 250, 252, 0.72);
          border: 1px solid #e0e6ef;
        }

        .month-reference-form .filter-group select {
          min-width: 170px;
        }

        .month-reference-form .status-mes-select {
          min-width: 140px;
          text-align: center;
          font-weight: 900;
        }

        .month-reference-form .status-mes-select.status-FEITO {
          background-color: #dcfce7 !important;
          color: #166534 !important;
          border-color: #86efac !important;
        }

        .month-reference-form .status-mes-select.status-PENDENTE {
          background-color: #fef3c7 !important;
          color: #92400e !important;
          border-color: #fcd34d !important;
        }

        .painel-colunas {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
          margin: 8px 0 16px;
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(248,250,252,0.9);
          border: 1px solid #e0e6ef;
        }

        .painel-colunas label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin: 0;
          font-size: 12px;
          font-weight: 700;
          color: #334155;
        }

        .filter-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 700;
          font-size: 13px;
        }

        .filter-group select,
        .filter-group input[type="date"] {
          height: 44px;
          padding: 0 18px;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          min-width: 180px;
          background: #fff;
          color: #334155;
        }

        .btn {
          padding: 10px 14px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: bold;
          font-size: 14px;
          display: inline-block;
          border: none;
          cursor: pointer;
        }

        .btn-primary {
          background: #2563eb;
          color: white;
        }

        .btn-secondary {
          background: #e5e7eb;
          color: #111827;
        }

        .btn-warning {
          background: #dc2626;
          color: white;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        th, td {
          padding: 10px 10px;
          border-bottom: 1px solid #eee;
          text-align: left;
          vertical-align: middle;
          word-wrap: break-word;
          font-size: 13px;
          line-height: 1.25;
        }

        th {
          background: #f1f5f9;
          font-weight: 700;
        }

        tr:hover {
          background: #f9fafb;
        }

        a {
          color: #2563eb;
        }

        .col-status,
        .col-ativo,
        .col-acoes {
          text-align: center;
          white-space: nowrap;
        }

        .col-vencimento {
          width: 105px;
          white-space: nowrap;
        }

        .col-status,
        .col-status-pagto {
          width: 150px;
        }

        .col-ativo {
          width: 80px;
        }

        .col-acoes {
          width: 110px;
        }

        .status-form {
          margin: 0;
          display: flex;
          justify-content: center;
        }

        .status-select {
          width: 115px;
          padding: 6px 28px 6px 10px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: bold;
          text-align: center;
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          background-image: none !important;
          box-shadow: none;
        }

        .status-FEITO {
          background-color: #dcfce7 !important;
          color: #166534 !important;
          border: 1px solid #86efac !important;
        }

        .status-PENDENTE {
          background-color: #fef3c7 !important;
          color: #92400e !important;
          border: 1px solid #fcd34d !important;
        }

        .status-N\\/A {
          background-color: #e5e7eb !important;
          color: #374151 !important;
          border: 1px solid #cbd5e1 !important;
        }

        .status-pagto-A_PAGAR {
          background-color: #dbeafe !important;
          color: #1d4ed8 !important;
          border: 1px solid #93c5fd !important;
        }

        .status-pagto-PAGO {
          background-color: #dcfce7 !important;
          color: #166534 !important;
          border: 1px solid #86efac !important;
        }

        .status-pagto-VENCIDO {
          background-color: #fee2e2 !important;
          color: #991b1b !important;
          border: 1px solid #fca5a5 !important;
        }

        .status-pagto-Não tem {
          background-color: #e5e7eb !important;
          color: #991b1b !important;
          border: 1px solid #cbd5e1 !important;
        }

        .status-ativo-SIM {
          background-color: #dcfce7 !important;
          color: #166534 !important;
          border: 1px solid #86efac !important;
        }

        .status-ativo-NAO {
          background-color: #e5e7eb !important;
          color: #374151 !important;
          border: 1px solid #cbd5e1 !important;
        }

        .month-reference-form {
          margin-left: auto !important;
          padding: 10px 12px !important;
          border-radius: 16px !important;
          background: rgba(248, 250, 252, 0.72) !important;
          border: 1px solid #e0e6ef !important;
          box-shadow: 0 18px 45px rgba(15,23,42,0.08) !important;
        }

        .month-compact-row { display: flex; align-items: center; gap: 8px; }
        .month-current-display { min-width: 78px; height: 42px; display: inline-flex; align-items: center; justify-content: center; padding: 0 14px; border-radius: 12px; background: #ffffff; border: 1px solid #dce3ec; color: #172033; font-weight: 900; white-space: nowrap; }
        .btn-month-open { min-width: 118px !important; height: 42px !important; padding: 0 14px !important; }
        .month-picker-overlay { display: none !important; position: fixed; inset: 0; z-index: 9999; background: rgba(15, 23, 42, 0.20); align-items: flex-start; justify-content: center; padding: 88px 18px 18px; }
        .month-picker-overlay.open { display: flex !important; }
        .month-picker-popover { width: 338px; max-width: calc(100vw - 28px); border-radius: 18px; background: rgba(255,255,255,0.98); border: 1px solid #dce3ec; box-shadow: 0 24px 70px rgba(15, 23, 42, 0.22); padding: 14px; }
        .month-picker-head { display: grid; grid-template-columns: 44px 1fr 44px; gap: 10px; align-items: center; margin-bottom: 14px; }
        .month-nav-btn { height: 38px !important; min-height: 38px !important; border-radius: 12px !important; padding: 0 !important; font-size: 20px !important; line-height: 1 !important; }
        .month-year-select { height: 38px !important; text-align: center; font-weight: 900; }
        .month-grid-picker { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .month-cell { height: 38px !important; min-height: 38px !important; padding: 0 !important; border-radius: 11px !important; font-size: 13px !important; font-weight: 900 !important; background: #E8F7EE !important; color: #14532d !important; border: 1px solid #c8ecd4 !important; box-shadow: 0 8px 16px rgba(15, 23, 42, .04) !important; transition: all .16s ease !important; }
        .month-cell:hover, .month-cell.active { background: linear-gradient(135deg, #00B050, #009640) !important; color: #fff !important; border-color: rgba(0, 176, 80, .9) !important; box-shadow: 0 10px 18px rgba(0, 176, 80, .22) !important; transform: translateY(-1px); }
        .month-picker-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 14px; }
        .month-selected-preview { color: #14532d; font-size: 12px; font-weight: 900; white-space: nowrap; }
        .month-picker-footer-actions { display: flex; justify-content: flex-end; gap: 8px; }
        th.col-vencimento, td.col-vencimento, th.col-status-pagto, td.col-status-pagto { text-align: center !important; vertical-align: middle !important; }

        .acoes-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .icon-btn {
          width: 18px;
          height: 18px;
          padding: 0;
          margin: 0 3px;
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
          outline: none !important;
          text-decoration: none;
          font-size: 14px;
          color: #64748b;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .icon-btn:hover {
          color: #1d4ed8;
          transform: scale(1.08);
        }

        .icon-btn[title="Excluir"] {
          color: #4b5563;
        }

        .icon-btn[title="Excluir"]:hover {
          color: #dc2626;
        }

        .icon-btn[title="Editar"] {
          color: #2563eb;
        }
      

/* ===== PADRÃO VISUAL PLENNATEC - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL PLENNATEC ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */



/* ===== AJUSTE SENIOR ROTINA: ALINHAMENTO FINO + CABEÇALHO FIXO REAL ===== */
/* Bloco final da página de Lista de Contas à pagar. Fica no fim do <style> para vencer regras antigas. */
.container {
  max-width: 1420px !important;
  margin: 38px auto 24px !important;
  padding: 0 18px !important;
}

.card {
  padding: 22px 24px 20px !important;
  overflow: visible !important;
}

/* Topo da rotina em 3 linhas: ações, colunas, filtros + competência/status */
.top-bar {
  display: grid !important;
  grid-template-columns: minmax(760px, 1fr) minmax(390px, auto) !important;
  grid-template-areas:
    "acoes acoes"
    "colunas colunas"
    "filtros mes" !important;
  align-items: end !important;
  column-gap: 22px !important;
  row-gap: 12px !important;
  margin-bottom: 14px !important;
}

.top-bar > .actions {
  grid-area: acoes !important;
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  flex-wrap: wrap !important;
}

#painel-colunas-rotina {
  grid-area: colunas !important;
  margin: 0 !important;
}

.top-bar > form.filters {
  grid-area: filtros !important;
}

.top-bar > form.month-reference-form {
  grid-area: mes !important;
}

/* Filtros compactos e perfeitamente alinhados em cima/baixo */
.filters {
  display: grid !important;
  grid-template-columns: 260px 180px 196px 128px 92px !important;
  align-items: end !important;
  gap: 10px !important;
  flex-wrap: nowrap !important;
  width: 100% !important;
  max-width: 900px !important;
  min-height: 64px !important;
  margin: 0 !important;
  padding: 0 !important;
}

.filter-group {
  display: flex !important;
  flex-direction: column !important;
  justify-content: flex-end !important;
  margin: 0 !important;
  min-width: 0 !important;
}

.filters .filter-group label,
.month-reference-form .filter-group label {
  display: block !important;
  height: 16px !important;
  margin: 0 0 4px !important;
  font-size: 11px !important;
  line-height: 16px !important;
  font-weight: 900 !important;
  color: #253247 !important;
  white-space: nowrap !important;
}

.filters .filter-group select,
.filters .filter-group input,
.month-reference-form .filter-group select {
  width: 100% !important;
  height: 40px !important;
  min-height: 40px !important;
  padding: 0 12px !important;
  font-size: 12px !important;
  font-weight: 800 !important;
  border-radius: 11px !important;
  line-height: 40px !important;
}

.filters .btn {
  height: 40px !important;
  min-height: 40px !important;
  padding: 0 16px !important;
  font-size: 12px !important;
  border-radius: 11px !important;
  align-self: end !important;
  margin: 0 !important;
}

/* Competência e status alinhados com a mesma linha dos filtros */
.month-reference-form {
  display: grid !important;
  grid-template-columns: 210px 148px !important;
  gap: 10px !important;
  align-items: end !important;
  justify-self: end !important;
  align-self: end !important;
  min-height: 64px !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}

.month-compact-group {
  min-width: 0 !important;
}

.month-compact-row {
  display: grid !important;
  grid-template-columns: 88px 112px !important;
  gap: 8px !important;
  align-items: center !important;
  height: 40px !important;
}

.month-current-display,
.btn-month-open,
.month-reference-form .status-mes-select {
  height: 40px !important;
  min-height: 40px !important;
  font-size: 12px !important;
  border-radius: 11px !important;
  line-height: 40px !important;
  margin: 0 !important;
}

.month-current-display {
  min-width: 88px !important;
  width: 88px !important;
  padding: 0 10px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-weight: 900 !important;
  background: rgba(255, 255, 255, 0.92) !important;
  border: 1px solid #dce3ec !important;
  color: #172033 !important;
}

.btn-month-open {
  min-width: 112px !important;
  width: 112px !important;
  padding: 0 10px !important;
}

.month-reference-form .status-mes-select {
  min-width: 148px !important;
  width: 148px !important;
  padding: 0 12px !important;
  text-align: center !important;
}

/* Tabela: sem overflow escondido, necessária para sticky funcionar */
table {
  width: 100% !important;
  border-collapse: separate !important;
  border-spacing: 0 !important;
  overflow: visible !important;
}

/* Cabeçalho fixo na rolagem da página: fica no topo quando filtros/cabeçalho somem */
table thead,
table thead tr,
table thead th {
  overflow: visible !important;
}

table thead th {
  position: sticky !important;
  top: 0 !important;
  z-index: 999 !important;
  background: rgba(248, 250, 252, 0.985) !important;
  backdrop-filter: blur(14px) !important;
  -webkit-backdrop-filter: blur(14px) !important;
  box-shadow: inset 0 -2px 0 #e5e7eb, 0 5px 16px rgba(15, 23, 42, 0.10) !important;
}

thead th {
  font-size: 12px !important;
  line-height: 1.15 !important;
  padding: 10px 10px !important;
  color: #253247 !important;
  font-weight: 900 !important;
  vertical-align: middle !important;
}

tbody td {
  font-size: 12.5px !important;
  line-height: 1.2 !important;
  padding: 9px 10px !important;
  vertical-align: middle !important;
}

/* Centralizações solicitadas em versões anteriores */
.col-vencimento,
.col-rot-vencimento,
.col-status-pagto,
.col-rot-status-pagto,
.col-status,
.col-rot-status,
.col-ativo,
.col-rot-ativo,
.col-acoes,
.col-rot-acoes {
  text-align: center !important;
}

.col-rot-acoes .acoes-wrap {
  justify-content: center !important;
}

/* Modal do mês permanece acima e sem contaminar o fluxo da página */
.month-picker-overlay {
  align-items: flex-start !important;
  padding-top: 115px !important;
}

@media (max-width: 1280px) {
  .top-bar {
    grid-template-columns: 1fr !important;
    grid-template-areas:
      "acoes"
      "colunas"
      "filtros"
      "mes" !important;
  }
  .filters {
    grid-template-columns: minmax(200px, 1fr) minmax(150px, 180px) minmax(170px, 200px) 126px 92px !important;
    max-width: 100% !important;
  }
  .month-reference-form {
    justify-self: start !important;
  }
}

@media (max-width: 820px) {
  .filters,
  .month-reference-form {
    grid-template-columns: 1fr !important;
  }
  .month-compact-row {
    grid-template-columns: 1fr 1fr !important;
  }
  .month-current-display,
  .btn-month-open,
  .month-reference-form .status-mes-select,
  .filters .btn {
    width: 100% !important;
  }
}
/* ===== FIM AJUSTE SENIOR ROTINA ===== */


/* ===== AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */
/* Comprovantes Fiscais: filtros compactos para caberem em uma única linha em telas largas */
body.dm-global-page form[action="/lancamentos"] .filters {
  display: grid !important;
  grid-template-columns: 1.05fr 1.05fr 1.05fr 1.05fr 1.05fr 1fr .92fr .92fr auto !important;
  align-items: end !important;
  gap: 8px !important;
  padding: 12px 14px !important;
}

body.dm-global-page form[action="/lancamentos"] .filters > div {
  min-width: 0 !important;
}

body.dm-global-page form[action="/lancamentos"] .filters label {
  display: block !important;
  margin: 0 0 5px !important;
  font-size: 10px !important;
  line-height: 1.05 !important;
  font-weight: 900 !important;
  white-space: nowrap !important;
}

body.dm-global-page form[action="/lancamentos"] .filters input,
body.dm-global-page form[action="/lancamentos"] .filters select {
  width: 100% !important;
  min-width: 0 !important;
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 10px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons {
  display: inline-flex !important;
  align-items: end !important;
  justify-content: flex-start !important;
  gap: 7px !important;
  min-width: 142px !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons button,
body.dm-global-page form[action="/lancamentos"] .filter-buttons a {
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 13px !important;
  font-size: 11px !important;
  border-radius: 11px !important;
}

@media (max-width: 1280px) {
  body.dm-global-page form[action="/lancamentos"] .filters {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

/* Espaço do Contador: conteúdo interno da coluna Enviar Arquivo alinhado à esquerda */
.contador-premium-page .contador-table th:nth-child(4) {
  text-align: center !important;
}

.contador-premium-page .contador-table td:nth-child(4) {
  text-align: left !important;
  padding-left: 10px !important;
  padding-right: 8px !important;
}

.contador-premium-page .upload-cell-compact {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  flex-wrap: nowrap !important;
  max-width: 100% !important;
  margin-left: 0 !important;
}

.contador-premium-page .btn-upload-open {
  width: auto !important;
  min-width: 112px !important;
  height: 30px !important;
  min-height: 30px !important;
  padding: 0 12px !important;
  font-size: 10.8px !important;
  line-height: 1 !important;
  border-radius: 11px !important;
}

.contador-premium-page .upload-cell-compact .clip-indicator,
.contador-premium-page .upload-cell-compact .empty-inline,
.contador-premium-page .upload-cell-compact .attached-badge,
.contador-premium-page .upload-cell-compact .attached-empty {
  flex: 0 0 auto !important;
}
/* ===== FIM AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */

</style>
    </head>
    <body class="dm-global-page">
      ${renderGlobalHeader(req, {
        titulo: 'Lista de Contas à pagar',
        subtitulo: 'Controle operacional das despesas mensais, status, vencimentos e competência.',
        paginaAtual: 'rotina-despesas',
        primaryHref: '/rotina-despesas/novo',
        primaryLabel: '+ Novo item',
        extraActions: `
          <form method="POST" action="/rotina-despesas/reset-status" class="dm-menu-extra-form">
            <button type="submit" class="dm-menu-btn" onclick="return confirm('Tem certeza que deseja mudar todos os STATUS para pendente?');">🔄 Zerar Status</button>
          </form>
          <button type="button" class="dm-menu-btn" onclick="togglePainelColunasRotina()">Colunas</button>
        `
      })}
      <div class="container">
        <div class="card">
          <h1>📋 Lista de Contas à pagar</h1>

          <div class="top-bar">
            <div id="painel-colunas-rotina" class="painel-colunas" style="display:none;">
              <label><input type="checkbox" data-col="col-rot-cnpj"> CNPJ/CPF</label>
              <label><input type="checkbox" data-col="col-rot-fato"> Fato Gerador</label>
              <label><input type="checkbox" data-col="col-rot-onde"> Onde encontrar</label>
              <label><input type="checkbox" data-col="col-rot-pagamento"> Pagamento</label>
              <label><input type="checkbox" data-col="col-rot-cat-principal"> Categoria Principal</label>
              <label><input type="checkbox" data-col="col-rot-subcategoria"> Subcategoria</label>
              <label><input type="checkbox" data-col="col-rot-vencimento"> Vencimento</label>
              <label><input type="checkbox" data-col="col-rot-status-pagto"> Status Pagto</label>
              <label><input type="checkbox" data-col="col-rot-status"> Status</label>
              <label><input type="checkbox" data-col="col-rot-ativo"> Ativo</label>
            </div>

            <form method="GET" action="/rotina-despesas" class="filters">
              <div class="filter-group">
                <label for="fornecedor">Fornecedor</label>
                <select id="fornecedor" name="fornecedor">
                  <option value="" ${fornecedorFiltro === '' ? 'selected' : ''}>Todos</option>
                  ${fornecedoresOptionsHtml}
                </select>
              </div>

              <div class="filter-group">
                <label for="status">Filtrar por status</label>
                <select id="status" name="status">
                  <option value="" ${statusFiltro === '' ? 'selected' : ''}>Todos</option>
                  <option value="PENDENTE" ${statusFiltro === 'PENDENTE' ? 'selected' : ''}>Pendente</option>
                  <option value="FEITO" ${statusFiltro === 'FEITO' ? 'selected' : ''}>Feito</option>
                  <option value="N/A" ${statusFiltro === 'N/A' ? 'selected' : ''}>Não tem</option>
                </select>
              </div>

              <div class="filter-group">
                <label for="dia_vencimento">Filtrar por dia vencimento</label>
                <select id="dia_vencimento" name="dia_vencimento">
                  ${gerarOpcoesDiaVencimento(diaVencimentoFiltro, 'Todos os dias')}
                </select>
              </div>

              <button type="submit" class="btn btn-primary">Aplicar filtro</button>
              <a href="/rotina-despesas" class="btn btn-dark">Limpar</a>
            </form>

            <form method="POST" action="/rotina-despesas/mes-referencia" class="month-reference-form" id="monthReferenceForm">
              <input type="hidden" name="acao" id="mes_acao" value="status">
              <input type="hidden" name="mes_ano" id="mes_ano_edicao" value="${mesAnoEdicao}">

              <div class="filter-group month-compact-group">
                <label>Mês de competência</label>
                <div class="month-compact-row">
                  <span class="month-current-display" id="mesAtualLabel">${mesAnoEdicaoLabel}</span>
                  <button type="button" class="btn btn-dark btn-month-open" onclick="abrirSeletorMes()">Escolher mês</button>
                </div>
              </div>

              <div class="filter-group">
                <label for="status_mes">Status do mês</label>
                <select id="status_mes" name="status_mes" class="status-mes-select status-${statusMesEdicao || 'PENDENTE'}" onchange="document.getElementById('mes_acao').value='status'; this.form.submit()">
                  <option value="PENDENTE" ${statusMesEdicao === 'PENDENTE' ? 'selected' : ''}>PENDENTE</option>
                  <option value="FEITO" ${statusMesEdicao === 'FEITO' ? 'selected' : ''}>FEITO</option>
                </select>
              </div>
            </form>

            <div id="monthPickerOverlay" class="month-picker-overlay" onclick="fecharSeletorMes(event)">
              <div class="month-picker-popover" onclick="event.stopPropagation()">
                <div class="month-picker-head">
                  <button type="button" class="month-nav-btn" onclick="mudarAnoPicker(-1)">«</button>
                  <select id="monthPickerYear" class="month-year-select" onchange="atualizarMesesPicker()">
                    ${[2025,2026,2027,2028,2029,2030].map(ano => `<option value="${ano}" ${String(anoMesEdicao) === String(ano) ? 'selected' : ''}>${ano}</option>`).join('')}
                  </select>
                  <button type="button" class="month-nav-btn" onclick="mudarAnoPicker(1)">»</button>
                </div>

                <div class="month-grid-picker" id="monthGridPicker">
                  ${MESES_CURTOS_PT.map((nome, idx) => {
                    const mesValor = String(idx + 1).padStart(2, '0');
                    const ativo = mesValor === mesNumeroEdicao ? 'active' : '';
                    return `<button type="button" class="month-cell ${ativo}" data-month="${mesValor}" onclick="selecionarMesPicker('${mesValor}')">${nome}</button>`;
                  }).join('')}
                </div>

                <div class="month-picker-footer">
                  <span class="month-selected-preview" id="monthSelectedPreview">Selecionado: ${mesAnoEdicaoLabel}</span>
                  <div class="month-picker-footer-actions">
                    <button type="button" class="btn btn-dark" onclick="fecharSeletorMes()">Cancelar</button>
                    <button type="button" class="btn btn-primary" onclick="aplicarMesCompetencia()">Filtrar mês</button>
                  </div>
                </div>
              </div>
            </div>
          </div>


          <table>
            <thead>
              <tr>
                <th class="col-rot-fornecedor">Fornecedor</th>
                <th class="col-rot-cnpj">CNPJ/CPF</th>
                <th class="col-rot-fato">Fato Gerador</th>
                <th class="col-rot-onde">Onde encontrar</th>
                <th class="col-rot-pagamento">Pagamento</th>
                <th class="col-rot-cat-principal">Categoria Principal</th>
                <th class="col-rot-subcategoria">Subcategoria</th>
                <th class="col-vencimento col-rot-vencimento">Vencimento</th>
                <th class="col-status-pagto col-rot-status-pagto">Status Pagto</th>
                <th class="col-status col-rot-status">Status</th>
                <th class="col-ativo col-rot-ativo">Ativo</th>
                <th class="col-acoes col-rot-acoes">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${linhas || '<tr><td colspan="12">Nenhum item cadastrado</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <script>
        function togglePainelColunasRotina() {
          const painel = document.getElementById('painel-colunas-rotina');
          painel.style.display = painel.style.display === 'none' ? 'flex' : 'none';
        }

        function aplicarColunaRotina(nomeColuna, mostrar) {
          document.querySelectorAll('.' + nomeColuna).forEach(el => {
            el.style.display = mostrar ? '' : 'none';
          });
        }

        function salvarPreferenciasColunasRotina() {
          const preferencias = {};
          document.querySelectorAll('#painel-colunas-rotina input[type="checkbox"]').forEach(chk => {
            preferencias[chk.dataset.col] = chk.checked;
          });
          localStorage.setItem('painelFiscalColunasRotina', JSON.stringify(preferencias));
        }

        function carregarPreferenciasColunasRotina() {
          const padrao = {
            'col-rot-cnpj': true,
            'col-rot-fato': true,
            'col-rot-onde': true,
            'col-rot-pagamento': true,
            'col-rot-cat-principal': true,
            'col-rot-subcategoria': true,
            'col-rot-vencimento': true,
            'col-rot-status-pagto': true,
            'col-rot-status': true,
            'col-rot-ativo': true
          };

          let preferencias = padrao;
          const salvo = localStorage.getItem('painelFiscalColunasRotina');
          if (salvo) {
            try { preferencias = { ...padrao, ...JSON.parse(salvo) }; } catch (e) {}
          }

          document.querySelectorAll('#painel-colunas-rotina input[type="checkbox"]').forEach(chk => {
            const mostrar = !!preferencias[chk.dataset.col];
            chk.checked = mostrar;
            aplicarColunaRotina(chk.dataset.col, mostrar);

            chk.addEventListener('change', () => {
              aplicarColunaRotina(chk.dataset.col, chk.checked);
              salvarPreferenciasColunasRotina();
            });
          });
        }

        document.addEventListener('DOMContentLoaded', carregarPreferenciasColunasRotina);

        let mesSelecionadoPicker = '${mesNumeroEdicao}';
        const nomesMesPicker = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

        function obterLabelMesPicker() {
          const ano = document.getElementById('monthPickerYear')?.value || '${anoMesEdicao}';
          const indiceMes = Math.max(0, Math.min(11, parseInt(mesSelecionadoPicker || '1', 10) - 1));
          return nomesMesPicker[indiceMes] + '-' + String(ano).slice(-2);
        }

        function atualizarPreviewMesPicker() {
          const preview = document.getElementById('monthSelectedPreview');
          if (preview) preview.textContent = 'Selecionado: ' + obterLabelMesPicker();
        }

        function abrirSeletorMes() {
          const overlay = document.getElementById('monthPickerOverlay');
          atualizarPreviewMesPicker();
          if (overlay) overlay.classList.add('open');
        }

        function fecharSeletorMes(event) {
          if (event && event.target && event.target.id !== 'monthPickerOverlay') return;
          const overlay = document.getElementById('monthPickerOverlay');
          if (overlay) overlay.classList.remove('open');
        }

        function selecionarMesPicker(mes) {
          mesSelecionadoPicker = String(mes).padStart(2, '0');
          document.querySelectorAll('#monthGridPicker .month-cell').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.month === mesSelecionadoPicker);
          });
          atualizarPreviewMesPicker();
        }

        function atualizarMesesPicker() {
          selecionarMesPicker(mesSelecionadoPicker);
          atualizarPreviewMesPicker();
        }

        function mudarAnoPicker(delta) {
          const select = document.getElementById('monthPickerYear');
          if (!select) return;
          const atual = parseInt(select.value || '2026', 10);
          let novo = atual + delta;
          novo = Math.max(2025, Math.min(2030, novo));
          select.value = String(novo);
          atualizarPreviewMesPicker();
        }

        function aplicarMesCompetencia() {
          const ano = document.getElementById('monthPickerYear')?.value || '2026';
          const mes = mesSelecionadoPicker || '01';
          const campoMes = document.getElementById('mes_ano_edicao');
          const campoAcao = document.getElementById('mes_acao');
          if (campoMes) campoMes.value = ano + '-' + mes;
          if (campoAcao) campoAcao.value = 'mes';
          document.getElementById('monthReferenceForm')?.submit();
        }

        document.addEventListener('DOMContentLoaded', atualizarPreviewMesPicker);

        document.querySelectorAll('.status-select').forEach(select => {
          select.addEventListener('change', function () {
            this.classList.remove('status-FEITO', 'status-PENDENTE', 'status-N/A', 'status-pagto-A_PAGAR', 'status-pagto-PAGO', 'status-pagto-NÃO TEM', 'status-pagto-VENCIDO');
            if (this.name === 'status_pagto') {
              this.classList.add('status-pagto-' + this.value);
            } else {
              this.classList.add('status-' + this.value);
            }
          });
        });
      </script>
    </body>
    </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro:\n${error.message}</pre>`);
  }
});
router.post('/rotina-despesas/mes-referencia', protegerRota, permitirPerfis('ADMIN', 'USUARIO'), async (req, res) => {
  try {
    await ensureRotinaDespesasColumns();

    const mesAno = String(req.body.mes_ano || '').trim();
    const statusMes = String(req.body.status_mes || 'PENDENTE').trim() === 'FEITO' ? 'FEITO' : 'PENDENTE';
    const acao = String(req.body.acao || 'status').trim();

    const mesFinal = mesAno || getMesAnoAtual();
    await setPainelConfig('rotina_mes_ano_edicao', mesFinal);
    if (acao !== 'mes') {
      await setStatusMesCompetencia(mesFinal, statusMes);
    }

    res.redirect('/rotina-despesas');
  } catch (error) {
    res.send(`<pre>Erro ao salvar mês/status de referência:
${error.message}</pre>`);
  }
});

router.post('/rotina-despesas/status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, fornecedor_filtro, status_filtro, mes_ano_filtro, dia_vencimento_filtro } = req.body;

    const mesCompetencia = String(mes_ano_filtro || '').trim() || await getPainelConfig('rotina_mes_ano_edicao', getMesAnoAtual()) || getMesAnoAtual();
    await upsertStatusMensal(id, mesCompetencia, normalizarStatusLinha(status), null);

    const redirectParams = new URLSearchParams();
    if (mes_ano_filtro) redirectParams.set('mes_ano', mes_ano_filtro);
    if (fornecedor_filtro) redirectParams.set('fornecedor', fornecedor_filtro);
    if (status_filtro) redirectParams.set('status', status_filtro);
    if (dia_vencimento_filtro) redirectParams.set('dia_vencimento', dia_vencimento_filtro);
    const redirectQuery = redirectParams.toString();
    const destino = redirectQuery ? `/rotina-despesas?${redirectQuery}` : '/rotina-despesas';

    res.redirect(destino);
  } catch (error) {
    res.send(`<pre>Erro ao atualizar status:
${error.message}</pre>`);
  }
});

router.post('/rotina-despesas/status-pagto/:id', async (req, res) => {
  try {
    await ensureRotinaDespesasColumns();
    const { id } = req.params;
    const { status_pagto, fornecedor_filtro, status_filtro, mes_ano_filtro, dia_vencimento_filtro } = req.body;
    const mesCompetencia = String(mes_ano_filtro || '').trim() || await getPainelConfig('rotina_mes_ano_edicao', getMesAnoAtual()) || getMesAnoAtual();

    await upsertStatusMensal(id, mesCompetencia, null, normalizarStatusPagto(status_pagto));

    const redirectParams = new URLSearchParams();
    if (fornecedor_filtro) redirectParams.set('fornecedor', fornecedor_filtro);
    if (status_filtro) redirectParams.set('status', status_filtro);
    if (dia_vencimento_filtro) redirectParams.set('dia_vencimento', dia_vencimento_filtro);
    const redirectQuery = redirectParams.toString();
    const destino = redirectQuery ? `/rotina-despesas?${redirectQuery}` : '/rotina-despesas';

    res.redirect(destino);
  } catch (error) {
    res.send(`<pre>Erro ao atualizar status de pagamento:
${error.message}</pre>`);
  }
});

router.post('/rotina-despesas/ativo/:id', protegerRota, permitirPerfis('ADMIN', 'USUARIO'), async (req, res) => {
  try {
    await ensureRotinaDespesasColumns();
    const { id } = req.params;
    const { ativo, fornecedor_filtro, status_filtro, mes_ano_filtro, dia_vencimento_filtro } = req.body;
    const mesCompetencia = String(mes_ano_filtro || '').trim() || await getPainelConfig('rotina_mes_ano_edicao', getMesAnoAtual()) || getMesAnoAtual();

    await upsertStatusMensal(id, mesCompetencia, null, null, normalizarAtivoMensal(ativo));

    const redirectParams = new URLSearchParams();
    if (fornecedor_filtro) redirectParams.set('fornecedor', fornecedor_filtro);
    if (status_filtro) redirectParams.set('status', status_filtro);
    if (dia_vencimento_filtro) redirectParams.set('dia_vencimento', dia_vencimento_filtro);
    const redirectQuery = redirectParams.toString();
    const destino = redirectQuery ? `/rotina-despesas?${redirectQuery}` : '/rotina-despesas';

    res.redirect(destino);
  } catch (error) {
    res.send(`<pre>Erro ao atualizar ativo do mês:
${error.message}</pre>`);
  }
});

router.post('/rotina-despesas/reset-status', async (req, res) => {
  try {
    await ensureRotinaDespesasColumns();
    const mesCompetencia = await getPainelConfig('rotina_mes_ano_edicao', getMesAnoAtual()) || getMesAnoAtual();
    await pool.query(`
      INSERT INTO rotina_despesas_status_mensal (rotina_id, mes_ano, status_linha, status_pagto, ativo, atualizado_em)
      SELECT id, $1, 'PENDENTE', 'A_PAGAR', true, NOW()
      FROM rotina_despesas
      WHERE ativo = true
      ON CONFLICT (rotina_id, mes_ano)
      DO UPDATE SET status_linha = 'PENDENTE', atualizado_em = NOW()
    `, [mesCompetencia]);

    res.redirect('/rotina-despesas');
  } catch (error) {
    res.send(`<pre>Erro ao resetar status:\n${error.message}</pre>`);
  }
});

// FORM NOVO
router.get('/rotina-despesas/novo', async (req, res) => {
  try {
    await ensureRotinaDespesasColumns();
    const principaisResult = await pool.query(`
      SELECT id, nome
      FROM categorias
      WHERE categoria_pai_id IS NULL
      ORDER BY nome
    `);

    const subcategoriasResult = await pool.query(`
      SELECT c.id, c.nome, p.nome AS principal_nome
      FROM categorias c
      LEFT JOIN categorias p ON p.id = c.categoria_pai_id
      WHERE c.categoria_pai_id IS NOT NULL
      ORDER BY p.nome, c.nome
    `);

    const optionsPrincipais = principaisResult.rows.map(c =>
      `<option value="${c.id}">${c.nome}</option>`
    ).join('');

    const optionsSubcategorias = subcategoriasResult.rows.map(c =>
      `<option value="${c.id}">${c.principal_nome} > ${c.nome}</option>`
    ).join('');

    res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>Novo Item da Rotina</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f6f8fb;
          margin: 0;
          color: #111827;
        }
        .container {
          max-width: 900px;
          margin: 40px auto;
          padding: 0 20px;
        }
        .card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        h1 {
          margin-top: 0;
          margin-bottom: 20px;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .full {
          grid-column: 1 / -1;
        }
        label {
          display: block;
          margin-bottom: 6px;
          font-weight: 700;
        }
        input, select, textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          box-sizing: border-box;
          font-size: 14px;
        }
        textarea {
          min-height: 90px;
          resize: vertical;
        }
        .actions {
          margin-top: 18px;
          display: flex;
          gap: 10px;
        }
        .btn {
          padding: 10px 14px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: bold;
          font-size: 14px;
          display: inline-block;
          border: none;
          cursor: pointer;
        }
        .btn-primary {
          background: #2563eb;
          color: white;
        }
        .btn-secondary {
          background: #e5e7eb;
          color: #111827;
        }
      

/* ===== PADRÃO VISUAL PLENNATEC - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL PLENNATEC ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */



/* ===== AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */
/* Comprovantes Fiscais: filtros compactos para caberem em uma única linha em telas largas */
body.dm-global-page form[action="/lancamentos"] .filters {
  display: grid !important;
  grid-template-columns: 1.05fr 1.05fr 1.05fr 1.05fr 1.05fr 1fr .92fr .92fr auto !important;
  align-items: end !important;
  gap: 8px !important;
  padding: 12px 14px !important;
}

body.dm-global-page form[action="/lancamentos"] .filters > div {
  min-width: 0 !important;
}

body.dm-global-page form[action="/lancamentos"] .filters label {
  display: block !important;
  margin: 0 0 5px !important;
  font-size: 10px !important;
  line-height: 1.05 !important;
  font-weight: 900 !important;
  white-space: nowrap !important;
}

body.dm-global-page form[action="/lancamentos"] .filters input,
body.dm-global-page form[action="/lancamentos"] .filters select {
  width: 100% !important;
  min-width: 0 !important;
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 10px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons {
  display: inline-flex !important;
  align-items: end !important;
  justify-content: flex-start !important;
  gap: 7px !important;
  min-width: 142px !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons button,
body.dm-global-page form[action="/lancamentos"] .filter-buttons a {
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 13px !important;
  font-size: 11px !important;
  border-radius: 11px !important;
}

@media (max-width: 1280px) {
  body.dm-global-page form[action="/lancamentos"] .filters {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

/* Espaço do Contador: conteúdo interno da coluna Enviar Arquivo alinhado à esquerda */
.contador-premium-page .contador-table th:nth-child(4) {
  text-align: center !important;
}

.contador-premium-page .contador-table td:nth-child(4) {
  text-align: left !important;
  padding-left: 10px !important;
  padding-right: 8px !important;
}

.contador-premium-page .upload-cell-compact {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  flex-wrap: nowrap !important;
  max-width: 100% !important;
  margin-left: 0 !important;
}

.contador-premium-page .btn-upload-open {
  width: auto !important;
  min-width: 112px !important;
  height: 30px !important;
  min-height: 30px !important;
  padding: 0 12px !important;
  font-size: 10.8px !important;
  line-height: 1 !important;
  border-radius: 11px !important;
}

.contador-premium-page .upload-cell-compact .clip-indicator,
.contador-premium-page .upload-cell-compact .empty-inline,
.contador-premium-page .upload-cell-compact .attached-badge,
.contador-premium-page .upload-cell-compact .attached-empty {
  flex: 0 0 auto !important;
}
/* ===== FIM AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */

</style>
    </head>
    <body class="dm-global-page">
        ${renderGlobalHeader(req, { titulo: 'Novo Item da Rotina', subtitulo: 'Cadastre uma nova despesa recorrente para o controle mensal.', paginaAtual: 'rotina-despesas' })}
      <div class="container">
        <div class="card">
          <h1>➕ Novo item da rotina</h1>

          <form method="POST" action="/rotina-despesas/novo">
            <div class="grid">
              <div>
                <label for="fornecedor">Fornecedor</label>
                <input id="fornecedor" name="fornecedor" required />
              </div>

              <div>
                <label for="cnpj_cpf">CNPJ/CPF</label>
                <input id="cnpj_cpf" name="cnpj_cpf" placeholder="Informe o CNPJ ou CPF" />
              </div>

              <div>
                <label for="tipo_pagamento_padrao">Tipo de pagamento padrão</label>
                <select id="tipo_pagamento_padrao" name="tipo_pagamento_padrao">
                  <option value="">Selecione</option>
                  <option value="PIX">PIX</option>
                  <option value="Boleto">Boleto</option>
                  <option value="Guia">Guia</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="DEB">DEB</option>
                  <option value="DOP">DOP</option>
                  <option value="CAR Inter">CAR Inter</option>
                  <option value="CAR VISA CX">CAR VISA CX</option>
                  <option value="CAR ELO CX">CAR ELO CX</option>
                  <option value="CAR Outro">CAR Outro</option>
                </select>
              </div>

              <div>
                <label for="dia_vencimento">Dia de vencimento</label>
                <select id="dia_vencimento" name="dia_vencimento">
                  ${gerarOpcoesDiaVencimento('', 'Selecione o dia')}
                </select>
              </div>

              <div class="full">
                <label for="onde_encontrar_comprovante">Onde encontrar comprovante</label>
                <input id="onde_encontrar_comprovante" name="onde_encontrar_comprovante" />
              </div>

              <div class="full">
                <label for="fato_gerador">Fato gerador da despesa</label>
                <input id="fato_gerador" name="fato_gerador" />
              </div>

              <div>
                <label for="categoria_principal_id">Categoria principal padrão</label>
                <select id="categoria_principal_id" name="categoria_principal_id">
                  <option value="">Selecione</option>
                  ${optionsPrincipais}
                </select>
              </div>

              <div>
                <label for="subcategoria_id">Subcategoria padrão</label>
                <select id="subcategoria_id" name="subcategoria_id">
                  <option value="">Selecione</option>
                  ${optionsSubcategorias}
                </select>
              </div>

              <div>
                <label for="status">Status</label>
                <select id="status" name="status">
                  <option value="PENDENTE" selected>PENDENTE</option>
                  <option value="FEITO">FEITO</option>
                  <option value="N/A">Não tem</option>
                </select>
              </div>

              <div>
                <label for="ordem">Ordem</label>
                <input id="ordem" name="ordem" type="number" value="0" />
              </div>

              <div>
                <label for="ativo">Ativo</label>
                <select id="ativo" name="ativo">
                  <option value="true" selected>Sim</option>
                  <option value="false">Não</option>
                </select>
              </div>

              <div class="full">
                <label for="observacoes">Observações</label>
                <textarea id="observacoes" name="observacoes"></textarea>
              </div>
            </div>

            <div class="actions">
              <button class="btn btn-primary" type="submit">Salvar</button>
              <a class="btn btn-dark" href="/rotina-despesas">Cancelar</a>
            </div>
          </form>
        </div>
      </div>
    </body>
    </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao abrir novo item:\n${error.message}</pre>`);
  }
});

// SALVAR NOVO
router.post('/rotina-despesas/novo', async (req, res) => {
  try {
    await ensureRotinaDespesasColumns();
    const {
      fornecedor,
      cnpj_cpf,
      onde_encontrar_comprovante,
      fato_gerador,
      tipo_pagamento_padrao,
      dia_vencimento,
      categoria_principal_id,
      subcategoria_id,
      status,
      ativo,
      ordem,
      observacoes
    } = req.body;

    await pool.query(`
      INSERT INTO rotina_despesas (
        fornecedor,
        cnpj_cpf,
        onde_encontrar_comprovante,
        fato_gerador,
        tipo_pagamento_padrao,
        dia_vencimento,
        categoria_principal_id,
        subcategoria_id,
        status,
        ativo,
        ordem,
        observacoes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    `, [
      fornecedor,
      cnpj_cpf || null,
      onde_encontrar_comprovante || null,
      fato_gerador || null,
      tipo_pagamento_padrao || null,
      normalizarDiaVencimento(dia_vencimento) || null,
      toNullableInt(categoria_principal_id),
      toNullableInt(subcategoria_id),
      status || 'PENDENTE',
      ativo === 'true',
      Number(ordem || 0),
      observacoes || null
    ]);

    res.redirect('/rotina-despesas');
  } catch (error) {
    res.send(`<pre>Erro ao salvar item:\n${error.message}</pre>`);
  }
});

// FORM EDITAR
router.get('/rotina-despesas/editar/:id', async (req, res) => {
  try {
    await ensureRotinaDespesasColumns();
    const { id } = req.params;

    const itemResult = await pool.query(
      `SELECT * FROM rotina_despesas WHERE id = $1`,
      [id]
    );

    if (!itemResult.rows.length) {
      return res.send('<pre>Item não encontrado.</pre>');
    }

    const item = itemResult.rows[0];

    const principaisResult = await pool.query(`
      SELECT id, nome
      FROM categorias
      WHERE categoria_pai_id IS NULL
      ORDER BY nome
    `);

    const subcategoriasResult = await pool.query(`
      SELECT c.id, c.nome, p.nome AS principal_nome
      FROM categorias c
      LEFT JOIN categorias p ON p.id = c.categoria_pai_id
      WHERE c.categoria_pai_id IS NOT NULL
      ORDER BY p.nome, c.nome
    `);

    const optionsPrincipais = principaisResult.rows.map(c =>
      `<option value="${c.id}" ${String(item.categoria_principal_id) === String(c.id) ? 'selected' : ''}>${c.nome}</option>`
    ).join('');

    const optionsSubcategorias = subcategoriasResult.rows.map(c =>
      `<option value="${c.id}" ${String(item.subcategoria_id) === String(c.id) ? 'selected' : ''}>${c.principal_nome} > ${c.nome}</option>`
    ).join('');

    res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>Editar Item da Rotina</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f6f8fb;
          margin: 0;
          color: #111827;
        }
        .container {
          max-width: 900px;
          margin: 40px auto;
          padding: 0 20px;
        }
        .card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        h1 {
          margin-top: 0;
          margin-bottom: 20px;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .full {
          grid-column: 1 / -1;
        }
        label {
          display: block;
          margin-bottom: 6px;
          font-weight: 700;
        }
        input, select, textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          box-sizing: border-box;
          font-size: 14px;
        }
        textarea {
          min-height: 90px;
          resize: vertical;
        }
        .actions {
          margin-top: 18px;
          display: flex;
          gap: 10px;
        }
        .btn {
          padding: 10px 14px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: bold;
          font-size: 14px;
          display: inline-block;
          border: none;
          cursor: pointer;
        }
        .btn-primary {
          background: #2563eb;
          color: white;
        }
        .btn-secondary {
          background: #e5e7eb;
          color: #111827;
        }
      

/* ===== PADRÃO VISUAL PLENNATEC - APLICADO NAS TELAS INTERNAS ===== */
:root {
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --dm-orange-soft: #E8F7EE;
  --dm-text: #172033;
  --dm-muted: #64748b;
  --dm-border: rgba(226, 232, 240, 0.82);
  --dm-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  --dm-card: rgba(255, 255, 255, 0.84);
}

body {
  color: var(--dm-text) !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #fff4df 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.container,
.login-page,
.page-shell {
  position: relative;
}

.hero,
.card,
.panel,
.table-card,
.form-card,
.filter-box,
.filter-panel,
.nav-panel,
.topbar,
.stat-card,
.chart-card,
.login-page .card,
form:not(.inline-form):not(.delete-form) {
  border-radius: 18px !important;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  background: var(--dm-card) !important;
  box-shadow: var(--dm-shadow) !important;
  backdrop-filter: blur(14px);
}

h1, h2, h3,
.page-title,
.title {
  color: #101828 !important;
  letter-spacing: -0.35px;
}

.subtitle,
.hint,
p,
small,
td,
th,
label {
  color: inherit;
}

.btn,
button,
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  border-radius: 12px !important;
  font-weight: 800 !important;
}

.btn:not(.btn-dark):not(.btn-danger):not(.btn-icon-danger),
button:not(.btn-icon-danger):not(.btn-dark):not(.btn-danger),
input[type="submit"],
.btn-blue,
.btn-green,
.btn-primary,
.btn-purple,
.btn-orange,
.btn-red,
.btn-filter-apply,
.login-page button {
  background: linear-gradient(135deg, var(--dm-orange), var(--dm-orange-dark)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.btn-dark,
.btn-filter-clear,
a[href="/dashboard"].btn,
a[href="/logout"].btn,
.logout-btn {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.btn:hover,
button:hover,
.logout-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

a {
  color: var(--dm-orange-dark);
}

input,
select,
textarea {
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: rgba(255,255,255,0.92) !important;
  color: #172033 !important;
  outline: none !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--dm-orange) !important;
  box-shadow: 0 0 0 3px rgba(0, 176, 80, 0.14) !important;
}

table {
  background: rgba(255,255,255,0.78) !important;
  border-radius: 16px !important;
  overflow: hidden;
}

th {
  background: rgba(248, 250, 252, 0.92) !important;
  color: #334155 !important;
}

tr:hover {
  background: rgba(232, 247, 238, 0.55) !important;
}

.icon-btn,
.btn-icon-edit,
.btn-icon-key {
  color: var(--dm-orange-dark) !important;
}

@media (max-width: 760px) {
  .container { margin-top: 16px !important; }
}


/* ===== AJUSTE PADRÃO BOTÕES CINZA/LARANJA - LISTA E ROTINA ===== */
.actions .btn,
.actions a,
.actions button,
.filter-buttons button,
.filter-buttons a,
.top-bar .filters button,
.top-bar .filters a {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  vertical-align: middle !important;
  line-height: 1.15 !important;
  min-height: 44px !important;
  padding: 0 18px !important;
  border-radius: 12px !important;
  text-decoration: none !important;
  font-weight: 800 !important;
  white-space: nowrap !important;
}

.actions .btn-secondary,
.actions .btn-success,
.actions .btn-warning,
.actions a[href="/dashboard"],
.actions a[href="/documentos"],
.actions a[href="/rotina-despesas"],
.actions a[href="/lancamentos"],
.actions button.btn-secondary,
.actions button.btn-warning,
.filter-buttons a,
.top-bar .filters a.btn-secondary {
  background: linear-gradient(180deg, #f8fafc, #eef2f7) !important;
  color: #222b3b !important;
  border: 1px solid #e0e6ef !important;
  box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important;
}

.actions .btn-primary,
.filter-buttons button[type="submit"],
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, var(--dm-orange, #00B050), var(--dm-orange-dark, #009640)) !important;
  color: #ffffff !important;
  border: 1px solid rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important;
}

.actions form {
  display: inline-flex !important;
  align-items: center !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
/* ===== FIM AJUSTE PADRÃO BOTÕES ===== */

/* ===== FIM PADRÃO VISUAL PLENNATEC ===== */

      

/* ===== AJUSTE FINAL UX - BOTÕES CINZA/LARANJA E ÍCONES LIMPOS ===== */
.actions .btn, .actions a.btn, .actions button.btn, .filters .btn, .filters a.btn, .filters button.btn, .filter-buttons .btn, .filter-buttons a.btn, .filter-buttons button.btn, .top-bar .filters .btn, .top-bar .filters a.btn, .top-bar .filters button.btn { display: inline-flex !important; align-items: center !important; justify-content: center !important; text-align: center !important; vertical-align: middle !important; line-height: 1.15 !important; min-height: 44px !important; padding: 0 18px !important; border-radius: 12px !important; text-decoration: none !important; font-weight: 800 !important; white-space: nowrap !important; }
.actions .btn:not(.btn-primary), .actions a.btn:not(.btn-primary), .actions button.btn:not(.btn-primary), .filters .btn:not(.btn-primary), .filters a.btn:not(.btn-primary), .filters button.btn:not(.btn-primary), .filter-buttons .btn:not(.btn-primary), .filter-buttons a.btn:not(.btn-primary), .filter-buttons button.btn:not(.btn-primary), .top-bar .filters .btn:not(.btn-primary), .top-bar .filters a.btn:not(.btn-primary), .top-bar .filters button.btn:not(.btn-primary) { background: linear-gradient(180deg, #f8fafc, #eef2f7) !important; color: #222b3b !important; border: 1px solid #e0e6ef !important; box-shadow: 0 10px 20px rgba(15, 23, 42, .06) !important; }
.actions .btn-primary, .actions a.btn-primary, .actions button.btn-primary, .filters button[type="submit"].btn-primary, .filters .btn-primary, .filter-buttons button[type="submit"].btn-primary, .top-bar .filters button[type="submit"].btn-primary { background: linear-gradient(135deg, #00B050, #009640) !important; color: #ffffff !important; border: 1px solid rgba(0, 176, 80, 0.88) !important; box-shadow: 0 12px 22px rgba(0, 176, 80, .18) !important; }
.actions form, .actions-cell form, .acoes-user form, .acoes-wrap form { display: inline-flex !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; background: transparent !important; border: none !important; box-shadow: none !important; backdrop-filter: none !important; }
.icon-btn, button.icon-btn, .icon-btn.btn-icon-danger, button.icon-btn.btn-icon-danger, .btn-icon-danger { background: transparent !important; background-image: none !important; border: none !important; box-shadow: none !important; outline: none !important; width: auto !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 4px !important; border-radius: 0 !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; line-height: 1 !important; }
.logo, .login-page .logo { background: transparent !important; box-shadow: none !important; border: none !important; }
/* ===== FIM AJUSTE FINAL UX ===== */



/* ===== AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */
:root {
  --dm-green: #00B050;
  --dm-green-dark: #009640;
  --dm-green-soft: #E8F7EE;
  --dm-orange: #00B050;
  --dm-orange-dark: #009640;
  --orange: #00B050;
  --orange-dark: #009640;
}

body {
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 0% 0%, rgba(0, 176, 80, 0.55) 0%, rgba(178, 232, 199, 0.42) 18%, transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(226, 235, 245, 0.95) 0%, rgba(240, 244, 249, 0.75) 31%, transparent 56%),
    linear-gradient(135deg, #E8F7EE 0%, #f7f9fc 42%, #eef3f8 100%) !important;
}

.nav-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 12px !important;
  padding: 8px 24px !important;
}

.nav-btn,
.logout-btn,
.btn,
.actions .btn,
.actions a.btn,
.actions button.btn,
.filter-panel button,
.filter-panel a,
.filter-buttons button,
.filter-buttons a {
  white-space: nowrap !important;
  word-break: normal !important;
  overflow-wrap: normal !important;
  text-align: center !important;
}

.nav-btn {
  min-width: 0 !important;
  height: 50px !important;
  padding: 0 10px !important;
  font-size: clamp(11px, 0.82vw, 14px) !important;
  line-height: 1.05 !important;
}

.nav-btn .nav-icon {
  width: 19px !important;
  height: 19px !important;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  gap: 14px !important;
}

.stat-card {
  min-width: 0 !important;
  min-height: 104px !important;
  padding: 14px 18px !important;
  gap: 14px !important;
}

.stat-icon-box {
  width: 52px !important;
  height: 52px !important;
}

.stat-content strong {
  font-size: clamp(20px, 1.45vw, 25px) !important;
}

.filter-panel {
  min-height: 62px !important;
  padding: 10px 20px !important;
}

.filter-panel select,
.filter-panel input[type="date"] {
  width: min(310px, 31vw) !important;
  height: 42px !important;
}

.btn-filter-apply,
.filter-panel button[type="submit"],
.actions .btn-primary,
.actions a.btn-primary,
.actions button.btn-primary,
.filters .btn-primary,
.filter-buttons button[type="submit"].btn-primary,
.top-bar .filters button[type="submit"].btn-primary {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, 0.88) !important;
  box-shadow: 0 12px 22px rgba(0, 176, 80, .20) !important;
  color: #ffffff !important;
}

.nav-btn.active,
.hbar-orange,
.trend-line,
.line-dot {
  color: #00B050 !important;
  stroke: #00B050 !important;
}

.nav-btn.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  border-color: rgba(0, 176, 80, .9) !important;
  color: #ffffff !important;
  box-shadow: 0 14px 24px rgba(0, 176, 80, .22) !important;
}

.hbar-orange,
.hbar-green {
  background: linear-gradient(90deg, #00B050, #009640) !important;
}

.line-dot { fill: #00B050 !important; }
.trend-line { stroke: #00B050 !important; }
.stat-icon-box.orange { color: #00B050 !important; background: #E8F7EE !important; }
.app-mark span:nth-child(2) { background: #00B050 !important; }
.profile-copy strong, a { color: #00B050 !important; }

@media (min-width: 1101px) {
  .charts-grid { grid-template-columns: 1.05fr .96fr 1.05fr !important; gap: 14px !important; }
  .chart-card { min-height: 290px !important; padding: 16px 20px 14px !important; }
  .line-chart { height: 195px !important; }
}

@media (max-width: 1300px) and (min-width: 1101px) {
  .page-shell { width: min(100% - 24px, 1680px) !important; }
  .nav-panel { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; gap: 8px !important; padding: 8px 18px !important; }
  .nav-btn { font-size: 11px !important; padding: 0 8px !important; gap: 6px !important; }
  .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
  .stat-card { padding: 12px 14px !important; }
  .stat-content small, .stat-content span { font-size: 9px !important; }
  .stat-content strong { font-size: 20px !important; }
  .chart-heading h2 { font-size: 16px !important; }
  .hbar-header { font-size: 11px !important; }
}

@media (max-width: 1100px) {
  .nav-panel { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .charts-grid { grid-template-columns: 1fr !important; }
}
/* ===== FIM AJUSTE FINAL VERDE + WINDOWS RESPONSIVO ===== */



/* ===== AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */
/* Comprovantes Fiscais: filtros compactos para caberem em uma única linha em telas largas */
body.dm-global-page form[action="/lancamentos"] .filters {
  display: grid !important;
  grid-template-columns: 1.05fr 1.05fr 1.05fr 1.05fr 1.05fr 1fr .92fr .92fr auto !important;
  align-items: end !important;
  gap: 8px !important;
  padding: 12px 14px !important;
}

body.dm-global-page form[action="/lancamentos"] .filters > div {
  min-width: 0 !important;
}

body.dm-global-page form[action="/lancamentos"] .filters label {
  display: block !important;
  margin: 0 0 5px !important;
  font-size: 10px !important;
  line-height: 1.05 !important;
  font-weight: 900 !important;
  white-space: nowrap !important;
}

body.dm-global-page form[action="/lancamentos"] .filters input,
body.dm-global-page form[action="/lancamentos"] .filters select {
  width: 100% !important;
  min-width: 0 !important;
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 10px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons {
  display: inline-flex !important;
  align-items: end !important;
  justify-content: flex-start !important;
  gap: 7px !important;
  min-width: 142px !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons button,
body.dm-global-page form[action="/lancamentos"] .filter-buttons a {
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 13px !important;
  font-size: 11px !important;
  border-radius: 11px !important;
}

@media (max-width: 1280px) {
  body.dm-global-page form[action="/lancamentos"] .filters {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

/* Espaço do Contador: conteúdo interno da coluna Enviar Arquivo alinhado à esquerda */
.contador-premium-page .contador-table th:nth-child(4) {
  text-align: center !important;
}

.contador-premium-page .contador-table td:nth-child(4) {
  text-align: left !important;
  padding-left: 10px !important;
  padding-right: 8px !important;
}

.contador-premium-page .upload-cell-compact {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  flex-wrap: nowrap !important;
  max-width: 100% !important;
  margin-left: 0 !important;
}

.contador-premium-page .btn-upload-open {
  width: auto !important;
  min-width: 112px !important;
  height: 30px !important;
  min-height: 30px !important;
  padding: 0 12px !important;
  font-size: 10.8px !important;
  line-height: 1 !important;
  border-radius: 11px !important;
}

.contador-premium-page .upload-cell-compact .clip-indicator,
.contador-premium-page .upload-cell-compact .empty-inline,
.contador-premium-page .upload-cell-compact .attached-badge,
.contador-premium-page .upload-cell-compact .attached-empty {
  flex: 0 0 auto !important;
}
/* ===== FIM AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */

</style>
    </head>
    <body class="dm-global-page">
        ${renderGlobalHeader(req, { titulo: 'Editar Item da Rotina', subtitulo: 'Atualize dados, categoria, vencimento e regras do item recorrente.', paginaAtual: 'rotina-despesas' })}
      <div class="container">
        <div class="card">
          <h1>✏️ Editar item da rotina</h1>

          <form method="POST" action="/rotina-despesas/editar/${item.id}">
            <div class="grid">
              <div>
                <label for="fornecedor">Fornecedor</label>
                <input id="fornecedor" name="fornecedor" value="${item.fornecedor || ''}" required />
              </div>

              <div>
                <label for="cnpj_cpf">CNPJ/CPF</label>
                <input id="cnpj_cpf" name="cnpj_cpf" value="${item.cnpj_cpf || ''}" placeholder="Informe o CNPJ ou CPF" />
              </div>

              <div>
                <label for="tipo_pagamento_padrao">Tipo de pagamento padrão</label>
                <select id="tipo_pagamento_padrao" name="tipo_pagamento_padrao">
                  <option value="">Selecione</option>
                  <option value="PIX" ${item.tipo_pagamento_padrao === 'PIX' ? 'selected' : ''}>PIX</option>
                  <option value="Boleto" ${item.tipo_pagamento_padrao === 'Boleto' ? 'selected' : ''}>Boleto</option>
                  <option value="Guia" ${item.tipo_pagamento_padrao === 'Guia' ? 'selected' : ''}>Guia</option>
                  <option value="Dinheiro" ${item.tipo_pagamento_padrao === 'Dinheiro' ? 'selected' : ''}>Dinheiro</option>
                  <option value="DEB" ${item.tipo_pagamento_padrao === 'DEB' ? 'selected' : ''}>DEB</option>
                  <option value="DOP" ${item.tipo_pagamento_padrao === 'DOP' ? 'selected' : ''}>DOP</option>
                  <option value="CAR Inter" ${item.tipo_pagamento_padrao === 'CAR Inter' ? 'selected' : ''}>CAR Inter</option>
                  <option value="CAR VISA CX" ${item.tipo_pagamento_padrao === 'CAR VISA CX' ? 'selected' : ''}>CAR VISA CX</option>
                  <option value="CAR ELO CX" ${item.tipo_pagamento_padrao === 'CAR ELO CX' ? 'selected' : ''}>CAR ELO CX</option>
                  <option value="CAR Outro" ${item.tipo_pagamento_padrao === 'CAR Outro' ? 'selected' : ''}>CAR Outro</option>
                </select>
              </div>

              <div>
                <label for="dia_vencimento">Dia de vencimento</label>
                <select id="dia_vencimento" name="dia_vencimento">
                  ${gerarOpcoesDiaVencimento(item.dia_vencimento, 'Selecione o dia')}
                </select>
              </div>

              <div class="full">
                <label for="onde_encontrar_comprovante">Onde encontrar comprovante</label>
                <input id="onde_encontrar_comprovante" name="onde_encontrar_comprovante" value="${item.onde_encontrar_comprovante || ''}" />
              </div>

              <div class="full">
                <label for="fato_gerador">Fato gerador da despesa</label>
                <input id="fato_gerador" name="fato_gerador" value="${item.fato_gerador || ''}" />
              </div>

              <div>
                <label for="categoria_principal_id">Categoria principal padrão</label>
                <select id="categoria_principal_id" name="categoria_principal_id">
                  <option value="">Selecione</option>
                  ${optionsPrincipais}
                </select>
              </div>

              <div>
                <label for="subcategoria_id">Subcategoria padrão</label>
                <select id="subcategoria_id" name="subcategoria_id">
                  <option value="">Selecione</option>
                  ${optionsSubcategorias}
                </select>
              </div>

              <div>
                <label for="status">Status</label>
                <select id="status" name="status">
                  <option value="PENDENTE" ${item.status === 'PENDENTE' ? 'selected' : ''}>PENDENTE</option>
                  <option value="FEITO" ${item.status === 'FEITO' ? 'selected' : ''}>FEITO</option>
                  <option value="N/A" ${item.status === 'N/A' ? 'selected' : ''}>Não tem</option>
                </select>
              </div>

              <div>
                <label for="ordem">Ordem</label>
                <input id="ordem" name="ordem" type="number" value="${item.ordem || 0}" />
              </div>

              <div>
                <label for="ativo">Ativo</label>
                <select id="ativo" name="ativo">
                  <option value="true" ${item.ativo ? 'selected' : ''}>Sim</option>
                  <option value="false" ${!item.ativo ? 'selected' : ''}>Não</option>
                </select>
              </div>

              <div class="full">
                <label for="observacoes">Observações</label>
                <textarea id="observacoes" name="observacoes">${item.observacoes || ''}</textarea>
              </div>
            </div>

            <div class="actions">
              <button class="btn btn-primary" type="submit">Atualizar</button>
              <a class="btn btn-dark" href="/rotina-despesas">Cancelar</a>
            </div>
          </form>
        </div>
      </div>
    </body>
    </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao abrir edição:\n${error.message}</pre>`);
  }
});

// SALVAR EDIÇÃO
router.post('/rotina-despesas/editar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fornecedor,
      cnpj_cpf,
      onde_encontrar_comprovante,
      fato_gerador,
      tipo_pagamento_padrao,
      dia_vencimento,
      categoria_principal_id,
      subcategoria_id,
      status,
      ativo,
      ordem,
      observacoes
    } = req.body;

    await ensureRotinaDespesasColumns();

    await pool.query(`
      UPDATE rotina_despesas
      SET
        fornecedor = $1,
        cnpj_cpf = $2,
        onde_encontrar_comprovante = $3,
        fato_gerador = $4,
        tipo_pagamento_padrao = $5,
        dia_vencimento = $6,
        categoria_principal_id = $7,
        subcategoria_id = $8,
        status = $9,
        ativo = $10,
        ordem = $11,
        observacoes = $12
      WHERE id = $13
    `, [
      fornecedor,
      cnpj_cpf || null,
      onde_encontrar_comprovante || null,
      fato_gerador || null,
      tipo_pagamento_padrao || null,
      normalizarDiaVencimento(dia_vencimento) || null,
      toNullableInt(categoria_principal_id),
      toNullableInt(subcategoria_id),
      status || 'PENDENTE',
      ativo === 'true',
      Number(ordem || 0),
      observacoes || null,
      id
    ]);

    res.redirect('/rotina-despesas');
  } catch (error) {
    res.send(`<pre>Erro ao atualizar item:\n${error.message}</pre>`);
  }
});

// EXCLUIR
router.get('/rotina-despesas/excluir/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(`DELETE FROM rotina_despesas WHERE id = $1`, [id]);

    res.redirect('/rotina-despesas');
  } catch (error) {
    res.send(`<pre>Erro ao excluir item:\n${error.message}</pre>`);
  }
});

function getMesAtualRef() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
}

async function gerarZipEEnviar(res, arquivos, nomeZip) {
  const arquivosValidos = (arquivos || []).filter(item => item && item.filePath && fs.existsSync(item.filePath));

  if (!arquivosValidos.length) {
    return res.send('<pre>Nenhum arquivo encontrado para este mês.</pre>');
  }

  const nomeSeguro = sanitizeFilePart(nomeZip || 'arquivos-contador');
  const zipTemp = path.join(uploadsDir, `${Date.now()}-${nomeSeguro}.zip`);

  try {
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipTemp);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      output.on('error', reject);
      archive.on('error', reject);

      archive.pipe(output);

      arquivosValidos.forEach(item => {
        archive.file(item.filePath, {
          name: item.downloadName || path.basename(item.filePath)
        });
      });

      archive.finalize();
    });

    return res.download(zipTemp, `${nomeSeguro}.zip`, (err) => {
      try {
        if (fs.existsSync(zipTemp)) {
          fs.unlinkSync(zipTemp);
        }
      } catch (e) {}

      if (err && !res.headersSent) {
        res.status(500).send(`<pre>Erro ao baixar ZIP:\n${err.message}</pre>`);
      }
    });
  } catch (error) {
    try {
      if (fs.existsSync(zipTemp)) {
        fs.unlinkSync(zipTemp);
      }
    } catch (e) {}

    return res.send(`<pre>Erro ao gerar ZIP:\n${error.message}</pre>`);
  }
}

// =============================
// ESPAÇO DO CONTADOR
// =============================

function getContadorArquivoConfig() {
  return [
    { key: 'xml', label: 'XML - Notas Despesas', auto: true, countKey: 'xml', statusColumn: 'status_xml', downloadStatusColumn: 'download_xml_status', downloadAtColumn: 'download_xml_at', downloadHref: (mes) => `/espaco-contador/download/xml?mes=${encodeURIComponent(mes)}`, downloadLabel: '⬇ Baixar' },
    { key: 'pdf', label: 'PDF - Notas Despesas', auto: true, countKey: 'pdf', statusColumn: 'status_pdf', downloadStatusColumn: 'download_pdf_status', downloadAtColumn: 'download_pdf_at', downloadHref: (mes) => `/espaco-contador/download/pdf?mes=${encodeURIComponent(mes)}`, downloadLabel: '⬇ Baixar' },
    { key: 'ctes', label: 'CTEs Fretes Marketplaces', titulo: 'CTEs Fretes Marketplaces', statusColumn: 'status_ctes', downloadStatusColumn: 'download_ctes_status', downloadAtColumn: 'download_ctes_at', downloadHref: (mes) => `/espaco-contador/download-extra-grupo/ctes?mes=${encodeURIComponent(mes)}`, downloadLabel: '⬇ Baixar' },
    { key: 'cmv', label: 'CMV - Custo Mercadoria Vendida', titulo: 'CMV - Custo Mercadoria Vendida', statusColumn: 'status_cmv', downloadStatusColumn: 'download_cmv_status', downloadAtColumn: 'download_cmv_at', downloadHref: (mes) => `/espaco-contador/download-extra-grupo/cmv?mes=${encodeURIComponent(mes)}`, downloadLabel: '⬇ Baixar' },
    { key: 'extratos', label: 'Extratos Bancários', titulo: 'Extratos Bancários', statusColumn: 'status_extratos', downloadStatusColumn: 'download_extratos_status', downloadAtColumn: 'download_extratos_at', downloadHref: (mes) => `/espaco-contador/download-extra-grupo/extratos?mes=${encodeURIComponent(mes)}`, downloadLabel: '⬇ Baixar' },
    { key: 'lista', label: 'Lista das despesas do Mês', titulo: 'Lista das despesas do Mês', statusColumn: 'status_lista', downloadStatusColumn: 'download_lista_status', downloadAtColumn: 'download_lista_at', downloadHref: (mes) => `/espaco-contador/download-extra-grupo/lista?mes=${encodeURIComponent(mes)}`, downloadLabel: '⬇ Baixar' }
  ];
}


async function getContadorArquivoConfigCompleta(mesRef = null) {
  await ensureContadorTables();

  const ocultosResult = await pool.query(`
    SELECT chave
    FROM painel_configuracoes
    WHERE chave LIKE 'contador_tipo_oculto_%'
      AND valor = 'true'
  `);

  const ocultos = new Set(
    (ocultosResult.rows || []).map(row => String(row.chave || '').replace('contador_tipo_oculto_', ''))
  );

  const ocultoParaMes = (key) => {
    if (!mesRef) return false;
    return ocultos.has(`${mesRef}_${key}`);
  };

  const fixos = getContadorArquivoConfig().filter(item => !ocultoParaMes(item.key));

  const result = await pool.query(`
    SELECT id, label, titulo
    FROM contador_arquivo_tipos
    WHERE ativo = true
      AND (mes_ref = $1 OR mes_ref IS NULL)
    ORDER BY id ASC
  `, [mesRef]);

  const personalizados = result.rows.map(row => ({
    key: `custom_${row.id}`,
    label: row.label,
    titulo: row.titulo || row.label,
    custom: true,
    statusColumn: null,
    downloadStatusColumn: null,
    downloadAtColumn: null,
    downloadHref: (mes) => `/espaco-contador/download-extra-grupo/custom_${row.id}?mes=${encodeURIComponent(mes)}`,
    downloadLabel: `⬇ Baixar`
  }));

  return [...fixos, ...personalizados];
}


async function ensureContadorTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contador_status_mensal (
      mes_ref VARCHAR(7) PRIMARY KEY,
      status_xml VARCHAR(50) DEFAULT 'Aguardar',
      status_pdf VARCHAR(50) DEFAULT 'Aguardar',
      status_extras VARCHAR(50) DEFAULT 'Aguardar',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contador_arquivos_extras (
      id SERIAL PRIMARY KEY,
      mes_ref VARCHAR(7) NOT NULL,
      titulo TEXT NOT NULL,
      nome_arquivo TEXT NOT NULL,
      nome_original TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);


  await pool.query(`
    CREATE TABLE IF NOT EXISTS contador_arquivo_tipos (
      id SERIAL PRIMARY KEY,
      label TEXT NOT NULL,
      titulo TEXT NOT NULL,
      ativo BOOLEAN DEFAULT true,
      mes_ref VARCHAR(7),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE contador_arquivo_tipos
    ADD COLUMN IF NOT EXISTS mes_ref VARCHAR(7)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contador_status_custom_mensal (
      id SERIAL PRIMARY KEY,
      mes_ref VARCHAR(7) NOT NULL,
      tipo_key VARCHAR(80) NOT NULL,
      status_pronto VARCHAR(50) DEFAULT 'Aguardar',
      download_status VARCHAR(20) DEFAULT 'Baixar',
      download_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (mes_ref, tipo_key)
    )
  `);

  const alters = [
    `ADD COLUMN IF NOT EXISTS status_ctes VARCHAR(50) DEFAULT 'Aguardar'`,
    `ADD COLUMN IF NOT EXISTS status_cmv VARCHAR(50) DEFAULT 'Aguardar'`,
    `ADD COLUMN IF NOT EXISTS status_extratos VARCHAR(50) DEFAULT 'Aguardar'`,
    `ADD COLUMN IF NOT EXISTS status_lista VARCHAR(50) DEFAULT 'Aguardar'`,
    `ADD COLUMN IF NOT EXISTS download_xml_status VARCHAR(20) DEFAULT 'Baixar'`,
    `ADD COLUMN IF NOT EXISTS download_pdf_status VARCHAR(20) DEFAULT 'Baixar'`,
    `ADD COLUMN IF NOT EXISTS download_ctes_status VARCHAR(20) DEFAULT 'Baixar'`,
    `ADD COLUMN IF NOT EXISTS download_cmv_status VARCHAR(20) DEFAULT 'Baixar'`,
    `ADD COLUMN IF NOT EXISTS download_extratos_status VARCHAR(20) DEFAULT 'Baixar'`,
    `ADD COLUMN IF NOT EXISTS download_lista_status VARCHAR(20) DEFAULT 'Baixar'`,
    `ADD COLUMN IF NOT EXISTS download_xml_at TIMESTAMP`,
    `ADD COLUMN IF NOT EXISTS download_pdf_at TIMESTAMP`,
    `ADD COLUMN IF NOT EXISTS download_ctes_at TIMESTAMP`,
    `ADD COLUMN IF NOT EXISTS download_cmv_at TIMESTAMP`,
    `ADD COLUMN IF NOT EXISTS download_extratos_at TIMESTAMP`,
    `ADD COLUMN IF NOT EXISTS download_lista_at TIMESTAMP`
  ];

  for (const alter of alters) {
    await pool.query(`ALTER TABLE contador_status_mensal ${alter}`);
  }
}

function normalizarStatusDownload(value) {
  return String(value || '').trim().toLowerCase() === 'baixado' ? 'Baixado' : 'Não Baixado';
}

function formatDateTimeBR(value) {
  if (!value) return '-';
  const data = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(data.getTime())) return '-';
  return data.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

async function marcarDownloadContador(mesRef, key) {
  const config = (await getContadorArquivoConfigCompleta(mesRef)).find(item => item.key === key);
  if (!config) return;
  await ensureContadorTables();

  if (config.custom) {
    await pool.query(`
      INSERT INTO contador_status_custom_mensal (mes_ref, tipo_key, download_status, download_at, updated_at)
      VALUES ($1, $2, 'Baixado', NOW(), NOW())
      ON CONFLICT (mes_ref, tipo_key)
      DO UPDATE SET download_status = 'Baixado', download_at = NOW(), updated_at = NOW()
    `, [mesRef, key]);
    return;
  }

  await pool.query(`
    INSERT INTO contador_status_mensal (mes_ref)
    VALUES ($1)
    ON CONFLICT (mes_ref) DO NOTHING
  `, [mesRef]);
  await pool.query(`
    UPDATE contador_status_mensal
    SET ${config.downloadStatusColumn} = 'Baixado',
        ${config.downloadAtColumn} = NOW(),
        updated_at = NOW()
    WHERE mes_ref = $1
  `, [mesRef]);
}


function renderContadorTabelaDefinitivaAssets() {
  return `
    <style id="contador-tabela-definitiva-assets">
      /* =====================================================
         CONTADOR — TABELA DEFINITIVA SEM ESTOURO
         Este bloco fica depois do renderMonthPickerAssets(), por isso vence
         os estilos antigos que estavam sobrescrevendo a tabela.
      ===================================================== */
      body.contador-premium-page,
      body.contador-premium-page * {
        box-sizing: border-box !important;
      }

      html,
      body.contador-premium-page {
        width: 100% !important;
        max-width: 100% !important;
        overflow-x: hidden !important;
      }

      body.contador-premium-page .contador-premium-shell {
        width: calc(100vw - 16px) !important;
        max-width: calc(100vw - 16px) !important;
        min-width: 0 !important;
        margin-left: auto !important;
        margin-right: auto !important;
        display: grid !important;
        grid-template-columns: 250px minmax(0, 1fr) !important;
        gap: 16px !important;
        overflow: hidden !important;
      }

      body.contador-premium-page .contador-premium-sidebar {
        width: 250px !important;
        min-width: 250px !important;
        max-width: 250px !important;
        overflow: hidden !important;
      }

      body.contador-premium-page .contador-premium-main,
      body.contador-premium-page .dm-global-header-shell,
      body.contador-premium-page .container,
      body.contador-premium-page .contador-kpi-grid,
      body.contador-premium-page .filter-box,
      body.contador-premium-page .contador-board,
      body.contador-premium-page .table-wrap {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        overflow: hidden !important;
      }

      body.contador-premium-page .contador-kpi-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
      }

      body.contador-premium-page .contador-board {
        padding: 12px !important;
      }

      body.contador-premium-page .table-wrap {
        overflow-x: hidden !important;
        border-radius: 18px !important;
      }

      /* Tabela: largura total fixa, sem min-width escondido. */
      body.contador-premium-page table.contador-table {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        table-layout: fixed !important;
        border-collapse: separate !important;
        border-spacing: 0 !important;
      }

      /* 8 colunas reais: soma exata = 100% */
      body.contador-premium-page table.contador-table col:nth-child(1) { width: 20% !important; }
      body.contador-premium-page table.contador-table col:nth-child(2) { width: 4% !important; }
      body.contador-premium-page table.contador-table col:nth-child(3) { width: 5% !important; }
      body.contador-premium-page table.contador-table col:nth-child(4) { width: 14% !important; }
      body.contador-premium-page table.contador-table col:nth-child(5) { width: 17% !important; }
      body.contador-premium-page table.contador-table col:nth-child(6) { width: 8% !important; }
      body.contador-premium-page table.contador-table col:nth-child(7) { width: 9% !important; }
      body.contador-premium-page table.contador-table col:nth-child(8) { width: 23% !important; }

      body.contador-premium-page table.contador-table th,
      body.contador-premium-page table.contador-table td {
        width: auto !important;
        min-width: 0 !important;
        max-width: none !important;
        padding: 6px 3px !important;
        font-size: 9px !important;
        line-height: 1.05 !important;
        vertical-align: middle !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: clip !important;
      }

      body.contador-premium-page table.contador-table thead th {
        font-size: 8.4px !important;
        line-height: 1 !important;
        padding: 6px 2px !important;
        text-align: center !important;
        white-space: nowrap !important;
      }

      body.contador-premium-page table.contador-table .responsibility-head th {
        font-size: 10.2px !important;
        line-height: 1 !important;
        padding: 7px 2px !important;
        white-space: nowrap !important;
      }

      body.contador-premium-page .tipo-cell {
        padding-left: 7px !important;
        padding-right: 3px !important;
        overflow: hidden !important;
      }

      body.contador-premium-page .tipo-cell::before {
        display: none !important;
        content: none !important;
      }

      body.contador-premium-page .tipo-cell strong {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        font-size: 9.7px !important;
        line-height: 1.05 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      body.contador-premium-page .inline-delete-row-form {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: transparent !important;
        border: 0 !important;
        box-shadow: none !important;
      }

      body.contador-premium-page .row-delete-btn,
      body.contador-premium-page .inline-delete-row-form button {
        width: 19px !important;
        min-width: 19px !important;
        max-width: 19px !important;
        height: 19px !important;
        min-height: 19px !important;
        max-height: 19px !important;
        padding: 0 !important;
        font-size: 9px !important;
        line-height: 1 !important;
      }

      body.contador-premium-page .qtd-pill {
        width: 24px !important;
        min-width: 24px !important;
        max-width: 24px !important;
        height: 22px !important;
        padding: 0 !important;
        font-size: 9.5px !important;
        line-height: 1 !important;
      }

      body.contador-premium-page .upload-cell-compact,
      body.contador-premium-page .inline-upload-form {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 2px !important;
        flex-wrap: nowrap !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        overflow: hidden !important;
        white-space: nowrap !important;
      }

      body.contador-premium-page .btn-upload-open,
      body.contador-premium-page .upload-chip {
        flex: 0 1 auto !important;
        width: 72px !important;
        min-width: 0 !important;
        max-width: 72px !important;
        height: 25px !important;
        min-height: 25px !important;
        max-height: 25px !important;
        padding: 0 3px !important;
        font-size: 7.8px !important;
        line-height: 1 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: clip !important;
        border-radius: 8px !important;
      }

      body.contador-premium-page .attached-badge,
      body.contador-premium-page .attached-empty,
      body.contador-premium-page .empty-inline {
        flex: 0 1 auto !important;
        min-width: 0 !important;
        max-width: 26px !important;
        font-size: 7.4px !important;
        padding-left: 2px !important;
        padding-right: 2px !important;
        white-space: nowrap !important;
        overflow: hidden !important;
      }

      body.contador-premium-page .status-select {
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        height: 27px !important;
        min-height: 27px !important;
        max-height: 27px !important;
        padding-left: 5px !important;
        padding-right: 15px !important;
        font-size: 8px !important;
        line-height: 1 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        border-radius: 9px !important;
      }

      body.contador-premium-page .btn-download {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 62px !important;
        min-width: 0 !important;
        max-width: 62px !important;
        height: 25px !important;
        min-height: 25px !important;
        max-height: 25px !important;
        padding: 0 3px !important;
        font-size: 7.9px !important;
        line-height: 1 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        border-radius: 8px !important;
      }

      body.contador-premium-page .download-status-text,
      body.contador-premium-page .download-status,
      body.contador-premium-page .status-pill {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: auto !important;
        min-width: 0 !important;
        max-width: 100% !important;
        height: 21px !important;
        padding: 0 4px !important;
        font-size: 7.6px !important;
        line-height: 1 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
      }

      body.contador-premium-page table.contador-table th:nth-child(8),
      body.contador-premium-page table.contador-table td:nth-child(8) {
        padding-left: 2px !important;
        padding-right: 2px !important;
        font-size: 8px !important;
        line-height: 1 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-align: center !important;
      }

      body.contador-premium-page .download-date-wrap,
      body.contador-premium-page .download-history-wrap,
      body.contador-premium-page table.contador-table td:nth-child(8) span,
      body.contador-premium-page table.contador-table td:nth-child(8) div {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 2px !important;
        max-width: 100% !important;
        min-width: 0 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
      }

      body.contador-premium-page .trash-history {
        flex: 0 0 17px !important;
        width: 17px !important;
        min-width: 17px !important;
        max-width: 17px !important;
        height: 17px !important;
        min-height: 17px !important;
        max-height: 17px !important;
        font-size: 8px !important;
        padding: 0 !important;
        margin-left: 2px !important;
      }

      @media (max-width: 1380px) {
        body.contador-premium-page .contador-premium-shell {
          grid-template-columns: 232px minmax(0, 1fr) !important;
          gap: 12px !important;
        }

        body.contador-premium-page .contador-premium-sidebar {
          width: 232px !important;
          min-width: 232px !important;
          max-width: 232px !important;
        }

        body.contador-premium-page .contador-board {
          padding: 10px !important;
        }

        body.contador-premium-page table.contador-table col:nth-child(1) { width: 18% !important; }
        body.contador-premium-page table.contador-table col:nth-child(2) { width: 4% !important; }
        body.contador-premium-page table.contador-table col:nth-child(3) { width: 5% !important; }
        body.contador-premium-page table.contador-table col:nth-child(4) { width: 12% !important; }
        body.contador-premium-page table.contador-table col:nth-child(5) { width: 16% !important; }
        body.contador-premium-page table.contador-table col:nth-child(6) { width: 8% !important; }
        body.contador-premium-page table.contador-table col:nth-child(7) { width: 10% !important; }
        body.contador-premium-page table.contador-table col:nth-child(8) { width: 27% !important; }

        body.contador-premium-page table.contador-table th,
        body.contador-premium-page table.contador-table td {
          font-size: 8.4px !important;
          padding-left: 2px !important;
          padding-right: 2px !important;
        }

        body.contador-premium-page table.contador-table thead th {
          font-size: 7.8px !important;
        }

        body.contador-premium-page table.contador-table .responsibility-head th {
          font-size: 9.4px !important;
        }

        body.contador-premium-page .tipo-cell strong {
          font-size: 8.7px !important;
        }

        body.contador-premium-page .btn-upload-open,
        body.contador-premium-page .upload-chip {
          max-width: 66px !important;
          font-size: 7.2px !important;
        }

        body.contador-premium-page .btn-download {
          max-width: 58px !important;
          font-size: 7.4px !important;
        }
      }
    </style>
  `;
}

router.get('/espaco-contador', protegerRota, permitirPerfis('ADMIN', 'USUARIO', 'CONTADOR'), async (req, res) => {
  try {
    await ensureContadorTables();
    const mes = req.query.mes || getMesAtualRef();

    await pool.query(`
      INSERT INTO contador_status_mensal (mes_ref)
      VALUES ($1)
      ON CONFLICT (mes_ref) DO NOTHING
    `, [mes]);

    const [xmlCountResult, pdfCountResult, extrasResult, statusResult] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM lancamentos
        WHERE TO_CHAR(data_despesa, 'YYYY-MM') = $1
          AND anexo_xml IS NOT NULL
          AND TRIM(anexo_xml) <> ''
      `, [mes]),
      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM lancamentos
        WHERE TO_CHAR(data_despesa, 'YYYY-MM') = $1
          AND anexo_pdf IS NOT NULL
          AND TRIM(anexo_pdf) <> ''
      `, [mes]),
      pool.query(`
        SELECT *
        FROM contador_arquivos_extras
        WHERE mes_ref = $1
        ORDER BY created_at DESC, id DESC
      `, [mes]),
      pool.query(`
        SELECT *
        FROM contador_status_mensal
        WHERE mes_ref = $1
        LIMIT 1
      `, [mes])
    ]);

    const totalXml = xmlCountResult.rows[0]?.total || 0;
    const totalPdf = pdfCountResult.rows[0]?.total || 0;
    const arquivosExtras = extrasResult.rows || [];
    const statusMes = statusResult.rows[0] || {};
    const isAdmin = req.session?.usuario?.perfil === 'ADMIN';
    const customStatusResult = await pool.query(`
      SELECT *
      FROM contador_status_custom_mensal
      WHERE mes_ref = $1
    `, [mes]);
    const customStatusMap = Object.fromEntries((customStatusResult.rows || []).map(row => [row.tipo_key, row]));

    const hoje = new Date();
    const opcoesMes = [];
    for (let i = -2; i <= 12; i++) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      const ano = data.getFullYear();
      const mesNum = String(data.getMonth() + 1).padStart(2, '0');
      const valor = `${ano}-${mesNum}`;
      const label = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      opcoesMes.push({ valor, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }

    const optionsMes = opcoesMes.map(item => `
      <option value="${item.valor}" ${item.valor === mes ? 'selected' : ''}>${item.label}</option>
    `).join('');

    const escapeHtml = (text = '') => String(text || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;').replace(/'/g, '&#039;');

    const labelMes = formatMesAnoCurto(mes);
    const mesContadorAno = /^\d{4}-\d{2}$/.test(mes) ? mes.slice(0, 4) : String(new Date().getFullYear());
    const mesContadorNumero = /^\d{4}-\d{2}$/.test(mes) ? mes.slice(5, 7) : String(new Date().getMonth() + 1).padStart(2, '0');

    const renderStatusOptions = (atual) => `
      <option value="Aguardar" ${atual === 'Aguardar' ? 'selected' : ''}>Aguardar</option>
      <option value="Em andamento" ${atual === 'Em andamento' ? 'selected' : ''}>Em andamento</option>
      <option value="Liberado para baixar" ${atual === 'Liberado para baixar' ? 'selected' : ''}>Liberado para baixar</option>
    `;

    const statusClass = (status) => {
      if (status === 'Liberado para baixar') return 'status-liberado';
      if (status === 'Em andamento') return 'status-andamento';
      return 'status-aguardar';
    };

    const statusForm = (tipoStatus, atual) => `
      <form method="POST" action="/espaco-contador/salvar-status" class="status-form-inline">
        <input type="hidden" name="mes_ref" value="${escapeHtml(mes)}">
        <input type="hidden" name="tipo_status" value="${escapeHtml(tipoStatus)}">
        <select name="status" class="status-select ${statusClass(atual)}" onchange="this.form.submit()">
          ${renderStatusOptions(atual || 'Aguardar')}
        </select>
      </form>`;

    const normalizarTitulo = (text = '') => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const getExtrasByTitle = (titulo) => arquivosExtras.filter(item => normalizarTitulo(item.titulo) === normalizarTitulo(titulo));
    const countExtrasByTitle = (titulo) => getExtrasByTitle(titulo).length;

    const renderArquivosAnexadosResumo = (titulo) => {
      const total = getExtrasByTitle(titulo).length;
      if (!total) {
        return `<span class="empty-inline">Vazio</span>`;
      }
      return `<span class="clip-indicator" title="${total} arquivo(s) anexado(s)">📎 ${total}</span>`;
    };

    const renderArquivosModal = (titulo) => {
      const itens = getExtrasByTitle(titulo);
      if (!itens.length) {
        return `<div class="modal-empty">Nenhum arquivo anexado.</div>`;
      }
      return itens.map(item => `
        <div class="modal-file-row">
          <span title="${escapeHtml(item.nome_original || item.nome_arquivo)}">${escapeHtml(item.nome_original || item.nome_arquivo)}</span>
          <form method="POST" action="/espaco-contador/excluir-extra/${item.id}" onsubmit="return confirm('Excluir este arquivo anexado?')">
            <input type="hidden" name="mes_ref" value="${escapeHtml(mes)}">
            <button type="submit" class="modal-delete" title="Excluir arquivo">🗑</button>
          </form>
        </div>
      `).join('');
    };

    const uploadForm = (config) => {
      const modalId = `modal-upload-${config.key}`;
      return `
        <div class="upload-cell-compact">
          <button type="button" class="btn btn-mini btn-upload-open" onclick="abrirModalUpload('${modalId}')">Inserir Arquivo</button>
          ${renderArquivosAnexadosResumo(config.titulo)}
        </div>

        <div class="upload-modal-overlay" id="${modalId}" aria-hidden="true">
          <div class="upload-modal-card">
            <div class="upload-modal-header">
              <div>
                <strong>${escapeHtml(config.label)}</strong>
                <span>Inclua ou exclua arquivos deste grupo no mês ${escapeHtml(labelMes)}.</span>
              </div>
              <button type="button" class="modal-close" onclick="fecharModalUpload('${modalId}')">×</button>
            </div>

            <form method="POST" action="/espaco-contador/upload-extra" enctype="multipart/form-data" class="modal-upload-form" data-modal-form="${modalId}">
              <input type="hidden" name="mes_ref" value="${escapeHtml(mes)}" />
              <input type="hidden" name="titulo" value="${escapeHtml(config.titulo)}" />

              <label class="modal-file-picker">
                <input type="file" name="arquivos" multiple required onchange="atualizarPreviewArquivos(this)" />
                <span>📎 Escolher arquivo</span>
              </label>

              <div class="modal-preview-title">Arquivos selecionados para salvar</div>
              <div class="modal-preview-list" data-preview-list>
                <div class="modal-empty">Nenhum arquivo selecionado.</div>
              </div>

              <div class="modal-actions modal-actions-upload">
                <button type="button" class="btn btn-dark" onclick="fecharModalUpload('${modalId}')">Cancelar</button>
                <button type="submit" class="btn btn-green">Salvar arquivos</button>
              </div>
            </form>

            <div class="modal-preview-title modal-attached-title">Arquivos já anexados</div>
            <div class="modal-attached-list">
              ${renderArquivosModal(config.titulo)}
            </div>
          </div>
        </div>`;
    };

    const downloadPill = (status) => {
      const finalStatus = normalizarStatusDownload(status);
      const cls = finalStatus === 'Baixado' ? 'download-text-baixado' : 'download-text-nao-baixado';
      return `<span class="download-status-text ${cls}">${finalStatus}</span>`;
    };

    const renderDataDownload = (config, value) => {
      const dataFormatada = formatDateTimeBR(value);
      if (!isAdmin || dataFormatada === '-') return dataFormatada;
      return `
        <span class="download-date-wrap">
          <span>${dataFormatada}</span>
          <form method="POST" action="/espaco-contador/limpar-download/${escapeHtml(config.key)}" class="inline-trash-form" onsubmit="return confirm('Apagar este histórico de download?')">
            <input type="hidden" name="mes_ref" value="${escapeHtml(mes)}">
            <button type="submit" class="trash-history" title="Apagar histórico">🗑</button>
          </form>
        </span>`;
    };

    const configs = await getContadorArquivoConfigCompleta(mes);
    const linhasTabelaHtml = configs.map((config) => {
      const quantidade = config.countKey === 'xml' ? totalXml : config.countKey === 'pdf' ? totalPdf : countExtrasByTitle(config.titulo);
      const envio = config.auto ? 'Automático' : uploadForm(config);
      const customStatus = config.custom ? customStatusMap[config.key] || {} : null;
      const statusAtual = config.custom
        ? (customStatus.status_pronto || 'Aguardar')
        : (statusMes[config.statusColumn] || (config.key === 'xml' ? statusMes.status_xml : config.key === 'pdf' ? statusMes.status_pdf : 'Aguardar') || 'Aguardar');
      const statusPronto = statusForm(config.key, statusAtual);
      const downloadBtn = `<a class="btn btn-mini btn-green btn-download" href="${config.downloadHref(mes)}">${config.downloadLabel}</a>`;
      const statusDownload = config.custom ? downloadPill(customStatus.download_status) : downloadPill(statusMes[config.downloadStatusColumn]);
      const dataDownload = config.custom ? renderDataDownload(config, customStatus.download_at) : renderDataDownload(config, statusMes[config.downloadAtColumn]);
      return `
        <tr>
          <td class="tipo-cell"><strong>${escapeHtml(config.label)}</strong></td>
          <td class="center-cell">
            ${isAdmin ? `
              <form method="POST" action="/espaco-contador/excluir-tipo/${escapeHtml(config.key)}" class="inline-delete-row-form" onsubmit="return confirm('Excluir esta linha do Espaço do Contador?')">
                <input type="hidden" name="mes_ref" value="${escapeHtml(mes)}">
                <button type="submit" class="row-delete-btn" title="Excluir linha">🗑</button>
              </form>
            ` : ''}
          </td>
          <td class="center-cell"><span class="qtd-pill">${quantidade}</span></td>
          <td class="center-cell">${envio}</td>
          <td class="center-cell">${statusPronto}</td>
          <td class="center-cell">${downloadBtn}</td>
          <td class="center-cell">${statusDownload}</td>
          <td class="center-cell muted-cell">${dataDownload}</td>
        </tr>`;
    }).join('');

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Espaço do Contador</title>
        <style>
          * { box-sizing: border-box; }
          :root { --green:#00B050; --green-dark:#009640; --soft:#E8F7EE; --text:#172033; --muted:#64748b; --shadow:0 18px 45px rgba(15,23,42,.08); }
          body { margin:0; min-height:100vh; overflow-x:hidden; font-family:Arial, Helvetica, sans-serif; color:var(--text); background:radial-gradient(circle at 0% 0%, rgba(0,176,80,.50) 0%, rgba(178,232,199,.38) 18%, transparent 34%), radial-gradient(circle at 100% 0%, rgba(226,235,245,.95) 0%, rgba(240,244,249,.75) 31%, transparent 56%), linear-gradient(135deg,#E8F7EE 0%,#f7f9fc 42%,#eef3f8 100%); }
          .container { width:min(1560px, calc(100% - 48px)); margin:18px auto 24px; }
          .hero { background:rgba(255,255,255,.88); border:1px solid rgba(255,255,255,.72); border-radius:22px; box-shadow:var(--shadow); backdrop-filter:blur(14px); padding:20px 26px 22px; margin-bottom:12px; }
          .hero-top { display:flex; justify-content:space-between; align-items:flex-start; gap:18px; margin-bottom:18px; }
          .hero h1 { margin:0 0 6px; font-size:clamp(24px,1.8vw,32px); line-height:1; letter-spacing:-.7px; color:#101828; }
          .hero p { margin:0; color:#52627a; font-size:13px; font-weight:700; }
          .hero-badge { min-width:190px; height:50px; border-radius:999px; background:linear-gradient(180deg,#fff,#f8fafc); box-shadow:inset 0 1px 0 rgba(255,255,255,.9), 0 18px 35px rgba(15,23,42,.04); }
          .filter-box { display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap; background:rgba(255,255,255,.92); border:1px solid rgba(226,232,240,.75); border-radius:18px; padding:16px 18px; box-shadow:0 12px 30px rgba(15,23,42,.05); }
          .filter-group { display:flex; flex-direction:column; gap:7px; min-width:320px; }
          label { font-size:12px; font-weight:900; color:#334155; }
          select, input { height:42px; border-radius:12px; border:1px solid #dce3ec; background:#fff; color:#172033; font-size:13px; font-weight:800; padding:0 14px; outline:none; }
          .btn { height:42px; border-radius:12px; border:1px solid #dce3ec; display:inline-flex; align-items:center; justify-content:center; padding:0 18px; text-decoration:none; font-size:13px; font-weight:900; cursor:pointer; white-space:nowrap; }
          .btn-green { background:linear-gradient(135deg,var(--green),var(--green-dark)); color:#fff; border-color:rgba(0,176,80,.9); box-shadow:0 12px 22px rgba(0,176,80,.18); }
          .btn-dark { background:linear-gradient(180deg,#f8fafc,#eef2f7); color:#222b3b; border-color:#e0e6ef; }
          .btn-mini { height:34px; min-width:88px; padding:0 10px; border-radius:10px; font-size:11px; }
          .btn-download { min-width:138px; font-size:10.5px; }
          .btn-soft-green { color:#047857; background:#ecfdf5; border-color:#bbf7d0; }
          .contador-board { background:rgba(255,255,255,.92); border:1px solid rgba(226,232,240,.82); border-radius:20px; box-shadow:var(--shadow); overflow:hidden; }
          .table-wrap { width:100%; overflow-x:hidden; }
          .contador-table { width:100%; border-collapse:collapse; table-layout:fixed; background:#fff; }
          .contador-table th { background:#f0fdf4; color:#00A34A; border-bottom:1px solid #111827; border-right:1px solid #e5e7eb; padding:9px 6px; font-size:12px; line-height:1.12; text-align:center; white-space:normal; }
          .contador-table th:nth-child(2), .contador-table td:nth-child(2) { text-align:center; }
          .contador-table th:nth-child(3), .contador-table td:nth-child(3), .contador-table th:nth-child(4), .contador-table td:nth-child(4) { text-align:center; }
          .contador-table .responsibility-head th { padding:8px 7px; font-size:17px; font-weight:900; color:#0f172a !important; background:#dcf4d2 !important; border-top:1px solid #111827; }
          .contador-table .responsibility-head th.empresa { background:#dbeafe !important; }
          /* Larguras reais por coluna: usa colgroup no HTML e reforço aqui para evitar distorção por colspan */
          .contador-table th:nth-child(1), .contador-table td:nth-child(1) { width:28%; }
          .contador-table th:nth-child(2), .contador-table td:nth-child(2) { width:6%; }
          .contador-table th:nth-child(3), .contador-table td:nth-child(3) { width:16%; }
          .contador-table th:nth-child(4), .contador-table td:nth-child(4) { width:13%; }
          .contador-table th:nth-child(5), .contador-table td:nth-child(5) { width:15%; }
          .contador-table th:nth-child(6), .contador-table td:nth-child(6) { width:10%; }
          .contador-table th:nth-child(7), .contador-table td:nth-child(7) { width:12%; }
          .contador-table td { border-bottom:1px solid #cfd8e3; border-right:1px solid #e5e7eb; padding:9px 7px; vertical-align:middle; font-size:11.5px; color:#111827; }
          .tipo-cell { background:#dcf4d2; color:#17324d; }
          .tipo-cell strong { font-size:14.5px; line-height:1.08; font-weight:900; }
          .center-cell { text-align:center; }
          .muted-cell { color:#334155; font-weight:800; font-size:10.5px; line-height:1.2; }
          .qtd-pill { display:inline-flex; align-items:center; justify-content:center; min-width:42px; height:30px; border-radius:999px; background:#eef2f7; color:#111827; font-size:16px; font-weight:900; }
          .status-form-inline { margin:0; padding:0; background:transparent !important; border:none !important; box-shadow:none !important; display:inline-flex; }
          .status-select { width:100%; max-width:150px; height:32px; padding:0 10px; border-radius:999px; font-size:10.5px; font-weight:900; cursor:pointer; appearance:auto; text-align:center; }
          .status-aguardar { background-color:#e5e7eb !important; color:#374151 !important; border:1px solid #cbd5e1 !important; }
          .status-andamento { background-color:#fef3c7 !important; color:#92400e !important; border:1px solid #fcd34d !important; }
          .status-liberado { background-color:#dcfce7 !important; color:#166534 !important; border:1px solid #86efac !important; }
          .download-status-text { display:inline; font-size:11px; font-weight:900; white-space:nowrap; }
          .download-text-nao-baixado { color:#1d4ed8; }
          .download-text-baixado { color:#166534; }
          .upload-stack { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; width:100%; }
          .inline-upload-form { display:flex; align-items:center; justify-content:center; gap:6px; margin:0; padding:0; background:transparent !important; border:none !important; box-shadow:none !important; }
          .upload-chip { margin:0; width:126px; height:32px; display:inline-flex; align-items:center; justify-content:center; border-radius:999px; border:1px dashed #9ca3af; background:#f8fafc; color:#334155; font-size:10.5px; font-weight:900; cursor:pointer; overflow:hidden; padding:0 8px; }
          .upload-chip input { display:none; }
          .upload-name { max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
          .attached-list { width:100%; max-width:210px; display:flex; flex-direction:column; gap:4px; }
          .attached-empty { color:#94a3b8; font-size:10px; font-weight:800; }
          .attached-item { display:flex; align-items:center; justify-content:space-between; gap:6px; padding:4px 6px; border-radius:8px; background:#f8fafc; border:1px solid #e5e7eb; }
          .attached-item span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#334155; font-size:10px; font-weight:800; }
          .attached-actions { display:flex; align-items:center; gap:4px; flex-shrink:0; }
          .attached-actions form { margin:0; padding:0; background:transparent !important; border:none !important; box-shadow:none !important; }
          .attached-link, .attached-delete { width:22px; height:22px; border:0 !important; border-radius:7px !important; display:inline-flex; align-items:center; justify-content:center; background:#ecfdf5 !important; color:#047857 !important; font-size:11px; text-decoration:none; cursor:pointer; padding:0 !important; box-shadow:none !important; }
          .attached-delete { background:#fff1f2 !important; color:#be123c !important; }
          .extra-section { background:rgba(255,255,255,.88); border:1px solid rgba(255,255,255,.72); border-radius:20px; box-shadow:var(--shadow); padding:18px 20px; margin-top:14px; }
          .extra-section h2 { margin:0 0 4px; font-size:22px; color:#101828; }
          .card-sub { color:#52627a; font-size:12px; font-weight:700; margin-bottom:12px; }
          .extra-list { display:flex; flex-direction:column; gap:8px; }
          .extra-item { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:11px 12px; border-radius:12px; background:#f8fafc; border:1px solid #e5e7eb; }
          .extra-title { font-weight:900; color:#0f172a; margin-bottom:2px; font-size:12px; }
          .extra-sub { color:#64748b; font-size:11px; font-weight:700; }
          .empty-state { color:#94a3b8; font-size:13px; padding:14px 0; font-weight:800; }
          .upload-cell-compact { display:flex; align-items:center; justify-content:flex-start; gap:7px; width:100%; text-align:left; }
          .contador-table td:nth-child(4) { text-align:left !important; padding-left:14px !important; }
          .contador-table th:nth-child(4) { text-align:center !important; }
          .contador-table td:nth-child(4).center-cell { text-align:left !important; }
          .btn-upload-open { min-width:106px; height:30px !important; min-height:30px !important; padding:0 9px !important; border-radius:10px !important; font-size:10.5px !important; background:#f8fafc !important; color:#334155 !important; border:1px dashed #94a3b8 !important; box-shadow:none !important; }
          .empty-inline { color:#94a3b8; font-size:10px; font-weight:900; }
          .clip-indicator { display:inline-flex; align-items:center; justify-content:center; min-width:52px; height:28px; padding:0 8px; border-radius:999px; background:#ecfdf5; color:#047857; border:1px solid #86efac; font-size:11px; font-weight:900; }
          .upload-modal-overlay { position:fixed; inset:0; z-index:9999; display:none; align-items:center; justify-content:center; padding:24px; background:rgba(15,23,42,.42); backdrop-filter:blur(5px); }
          .upload-modal-overlay.is-open { display:flex; }
          .upload-modal-card { width:min(620px, calc(100vw - 34px)); max-height:86vh; overflow:auto; background:#fff; border:1px solid #e2e8f0; border-radius:22px; box-shadow:0 28px 80px rgba(15,23,42,.22); padding:18px; }
          .upload-modal-header { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; padding:4px 4px 14px; border-bottom:1px solid #e5e7eb; margin-bottom:14px; }
          .upload-modal-header strong { display:block; font-size:18px; color:#101828; margin-bottom:4px; }
          .upload-modal-header span { display:block; color:#64748b; font-size:12px; font-weight:700; }
          .modal-close { width:34px; height:34px; border-radius:10px; border:1px solid #e5e7eb; background:#f8fafc; color:#334155; font-size:22px; line-height:1; cursor:pointer; }
          .modal-upload-form { background:transparent !important; border:none !important; box-shadow:none !important; padding:0 !important; margin:0 !important; }
          .modal-file-picker { width:100%; min-height:58px; border:1.5px dashed #94a3b8; border-radius:16px; background:#f8fafc; display:flex; align-items:center; justify-content:center; cursor:pointer; margin-bottom:14px; }
          .modal-file-picker input { display:none; }
          .modal-file-picker span { color:#0f172a; font-size:14px; font-weight:900; }
          .modal-preview-title { margin:12px 0 7px; color:#334155; font-size:12px; font-weight:900; }
          .modal-preview-list, .modal-attached-list { display:flex; flex-direction:column; gap:6px; }
          .modal-file-row { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:9px 10px; border-radius:12px; background:#f8fafc; border:1px solid #e5e7eb; }
          .modal-file-row span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#1f2937; font-size:12px; font-weight:800; }
          .modal-file-row form { margin:0 !important; padding:0 !important; background:transparent !important; border:none !important; box-shadow:none !important; }
          .modal-delete { width:30px; height:30px; border-radius:9px !important; border:1px solid #fecdd3 !important; background:#fff1f2 !important; color:#be123c !important; cursor:pointer; box-shadow:none !important; padding:0 !important; }
          .modal-empty { color:#94a3b8; font-size:12px; font-weight:800; padding:8px 0; }
          .modal-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:16px; padding-top:14px; border-top:1px solid #e5e7eb; }
          .modal-actions-upload { margin-bottom:14px; }
          .modal-attached-title { border-top:1px solid #e5e7eb; padding-top:14px; }
          .add-row-cell { text-align:left !important; background:#dcf4d2 !important; padding:6px 12px !important; }
          .btn-add-file-row { display:inline-flex; align-items:center; justify-content:center; min-height:30px; padding:0 14px; border-radius:10px; border:1px solid #bfdbfe; background:#eff6ff; color:#1d4ed8; font-size:17px; font-weight:900; text-decoration:none; cursor:pointer; box-shadow:none; }
          .btn-add-file-row:hover { background:#dbeafe; transform:translateY(-1px); }
          .download-date-wrap { display:inline-flex; align-items:center; justify-content:center; gap:6px; white-space:nowrap; }
          .inline-trash-form { display:inline-flex !important; margin:0 !important; padding:0 !important; background:transparent !important; border:0 !important; box-shadow:none !important; }
          .trash-history { border:0 !important; background:transparent !important; padding:0 !important; margin:0 !important; color:#be123c !important; cursor:pointer; box-shadow:none !important; font-size:14px; line-height:1; }
          .add-row-modal-form { display:flex; flex-direction:column; gap:12px; margin:0 !important; padding:0 !important; background:transparent !important; border:0 !important; box-shadow:none !important; }
          .add-row-modal-form input { width:100%; min-height:46px; border-radius:12px; border:1px solid #dbe3ee; padding:0 14px; font-size:14px; font-weight:700; }
          @media (max-width:1250px) { .container{width:min(100% - 24px,1250px);} .contador-table th{font-size:12px;padding:8px 5px;} .contador-table td{font-size:10.5px;padding:8px 5px;} .tipo-cell strong{font-size:14px;} .btn-mini{font-size:10px;min-width:72px;padding:0 7px;} .btn-upload-open{min-width:100px !important;font-size:10px !important;} .btn-download{min-width:124px;} .upload-chip{width:112px;} .status-select{max-width:150px;font-size:10px;} }
          @media (max-width:980px) { .table-wrap{overflow-x:auto;} .contador-table{min-width:1080px;} .hero-top{flex-direction:column;} .hero-badge{display:none;} .filter-group{min-width:100%;} }
        

/* ===== ESPAÇO DO CONTADOR — PLENNATEC PREMIUM ISOLADO ===== */
body.contador-premium-page {
  margin: 0 !important;
  min-height: 100vh !important;
  overflow-x: hidden !important;
  background:
    radial-gradient(circle at 100% 0%, rgba(232,247,238,.80) 0%, transparent 30%),
    linear-gradient(135deg, #f7faf9 0%, #ffffff 46%, #f3f7f6 100%) !important;
}

.contador-premium-shell {
  width: min(1740px, calc(100% - 20px));
  min-height: 100vh;
  margin: 0 auto;
  padding: 16px 0 14px;
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  gap: 18px;
}

.contador-premium-sidebar {
  position: sticky;
  top: 16px;
  height: calc(100vh - 32px);
  overflow: hidden;
  border-radius: 0 28px 28px 0;
  padding: 24px 18px 18px;
  color: #fff;
  background:
    radial-gradient(circle at 40% 20%, rgba(32,201,112,.30), transparent 28%),
    linear-gradient(180deg, #063d31 0%, #075236 46%, #043324 100%);
  box-shadow: 0 28px 80px rgba(4,51,36,.24);
  display: flex;
  flex-direction: column;
}

.contador-premium-sidebar::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(120deg, rgba(255,255,255,.10), transparent 32%),
    radial-gradient(circle at 20% 80%, rgba(0,176,80,.22), transparent 30%);
  pointer-events: none;
}

.contador-premium-sidebar > * { position: relative; z-index: 1; }

.contador-sidebar-logo {
  height: 70px;
  border-radius: 18px;
  background: rgba(255,255,255,.98);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 11px 14px;
  margin-bottom: 24px;
  box-shadow: 0 18px 36px rgba(0,0,0,.18);
}
.contador-sidebar-logo img { width: 100%; max-height: 48px; object-fit: contain; }

.contador-sidebar-nav { display: flex; flex-direction: column; gap: 8px; }
.contador-sidebar-nav a {
  height: 45px; padding: 0 14px; border-radius: 14px;
  display: flex; align-items: center; gap: 12px; text-decoration: none;
  color: rgba(255,255,255,.88) !important; font-size: 14px; font-weight: 850;
  transition: transform .18s ease, background .18s ease, box-shadow .18s ease;
}
.contador-sidebar-nav a span { width: 22px; height: 22px; display: inline-grid; place-items: center; color: #dcffe9; }
.contador-sidebar-nav a:hover { transform: translateX(4px); background: rgba(255,255,255,.10); }
.contador-sidebar-nav a.active {
  background: linear-gradient(135deg, #13bd58, #079241);
  box-shadow: 0 15px 32px rgba(19,189,88,.33), inset 0 1px 0 rgba(255,255,255,.24);
  color: #fff !important;
}

.contador-sidebar-card {
  margin-top: auto; padding: 16px; border-radius: 18px;
  background: linear-gradient(180deg, rgba(29,185,84,.22), rgba(255,255,255,.06));
  border: 1px solid rgba(255,255,255,.14);
}
.contador-sidebar-card strong { display: block; font-size: 13px; margin-bottom: 8px; }
.contador-sidebar-card small { display: block; color: rgba(255,255,255,.75); font-size: 11px; line-height: 1.45; margin-bottom: 12px; }
.contador-sidebar-card a {
  height: 38px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; width: 100%;
  text-decoration: none; color: #06412d !important; background: #d8ffe4; font-weight: 900;
}
.contador-sidebar-user { margin-top: 18px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.16); display: flex; align-items: center; gap: 11px; }
.contador-sidebar-user img { width: 42px; height: 42px; border-radius: 999px; object-fit: contain; background: #fff; padding: 4px; }
.contador-sidebar-user strong, .contador-sidebar-user small { display: block; }
.contador-sidebar-user strong { font-size: 12px; color: #fff; }
.contador-sidebar-user small { color: rgba(255,255,255,.70); font-size: 10px; margin-top: 3px; }

.contador-premium-main { min-width: 0; }
.contador-premium-page .dm-global-header-shell { width: 100% !important; margin: 0 0 14px !important; }
.contador-premium-page .dm-global-top {
  min-height: 78px; background: rgba(255,255,255,.92) !important; border: 1px solid rgba(226,232,240,.88) !important;
  border-radius: 24px !important; box-shadow: 0 18px 46px rgba(15,23,42,.07) !important;
}
.contador-premium-page .dm-global-nav { display: none !important; }
.contador-premium-page .container { width: 100% !important; margin: 0 !important; }

.contador-kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 14px; }
.contador-kpi-card {
  min-height: 112px; padding: 18px; border-radius: 20px; background: #fff; border: 1px solid #eef2f4;
  box-shadow: 0 18px 42px rgba(15,23,42,.08); display: grid; grid-template-columns: 54px minmax(0, 1fr);
  align-items: center; gap: 14px; position: relative; overflow: hidden; transition: transform .18s ease, box-shadow .18s ease;
}
.contador-kpi-card:hover { transform: translateY(-4px); box-shadow: 0 28px 70px rgba(15,23,42,.13); }
.contador-kpi-card::after {
  content: ''; position: absolute; left: 84px; right: 18px; bottom: 16px; height: 26px; opacity: .58;
  background: linear-gradient(90deg, rgba(0,176,80,.05), rgba(0,176,80,.16));
  clip-path: polygon(0 70%, 12% 58%, 22% 66%, 34% 42%, 48% 56%, 62% 34%, 78% 57%, 100% 24%, 100% 100%, 0 100%);
  pointer-events: none;
}
.contador-kpi-icon { width: 54px; height: 54px; border-radius: 16px; display: grid; place-items: center; font-size: 22px; font-weight: 900; }
.contador-kpi-icon.green { color:#00B050; background:#E8F7EE; }
.contador-kpi-icon.blue { color:#1684f8; background:#eaf4ff; }
.contador-kpi-icon.purple { color:#8657ff; background:#f0eaff; }
.contador-kpi-icon.lime { color:#65a30d; background:#ecfccb; }
.contador-kpi-card small { display:block; font-size: 12px; color:#334155; font-weight:900; margin-bottom: 6px; }
.contador-kpi-card strong { display:block; font-size: 27px; color:#0f172a; letter-spacing:-.7px; line-height:1; margin-bottom: 6px; }
.contador-kpi-card span { display:block; font-size: 11px; color:#047857; font-weight:850; }

.contador-premium-page .hero {
  background: rgba(255,255,255,.92) !important; border: 1px solid rgba(226,232,240,.82) !important;
  border-radius: 20px !important; box-shadow: 0 18px 46px rgba(15,23,42,.07) !important;
  padding: 16px 18px !important; margin-bottom: 14px !important;
}
.contador-premium-page .filter-box {
  background: transparent !important; border: 0 !important; box-shadow: none !important; padding: 0 !important;
  display:flex !important; align-items:center !important; gap: 12px !important;
}
.contador-premium-page .filter-group {
  min-width: 0 !important; width: 360px !important; display: grid !important; grid-template-columns: 96px 1fr !important;
  align-items: center !important; gap: 12px !important;
}
.contador-premium-page .filter-group label { margin: 0 !important; color:#52627a !important; font-weight:900 !important; }
.contador-premium-page .filter-group select, .contador-premium-page .filter-box select {
  height: 44px !important; border-radius: 14px !important; background:#fff !important; border:1px solid #dfe7ef !important;
  box-shadow:0 10px 22px rgba(15,23,42,.05) !important;
}
.contador-premium-page .btn {
  height: 44px !important; border-radius: 14px !important; font-weight: 950 !important;
  transition: transform .16s ease, box-shadow .16s ease, filter .16s ease !important;
}
.contador-premium-page .btn:hover, .contador-premium-page button:hover { transform: translateY(-2px) !important; filter: brightness(1.03) !important; }

.contador-premium-page .contador-board {
  border-radius: 24px !important; background: rgba(255,255,255,.92) !important; border: 1px solid rgba(226,232,240,.82) !important;
  box-shadow: 0 24px 70px rgba(15,23,42,.08) !important; padding: 18px !important; overflow: hidden !important;
}
.contador-premium-page .table-wrap { width: 100% !important; overflow-x: auto !important; border-radius: 19px !important; }
.contador-premium-page .contador-table {
  width: 100% !important; min-width: 1120px !important; border-collapse: separate !important; border-spacing: 0 !important;
  table-layout: fixed !important; background: #fff !important; border: 1px solid #e5eaf0 !important; border-radius: 19px !important; overflow: hidden !important;
}
.contador-premium-page .contador-table col:nth-child(1) { width: 22% !important; }
.contador-premium-page .contador-table col:nth-child(2) { width: 7% !important; }
.contador-premium-page .contador-table col:nth-child(3) { width: 17% !important; }
.contador-premium-page .contador-table col:nth-child(4) { width: 16% !important; }
.contador-premium-page .contador-table col:nth-child(5) { width: 18% !important; }
.contador-premium-page .contador-table col:nth-child(6) { width: 10% !important; }
.contador-premium-page .contador-table col:nth-child(7) { width: 10% !important; }

.contador-premium-page .contador-table th, .contador-premium-page .contador-table td {
  border-right: 1px solid #e7edf3 !important; border-bottom: 1px solid #e7edf3 !important;
  color: #172033 !important; padding: 13px 14px !important; font-size: 12px !important; vertical-align: middle !important;
}
.contador-premium-page .contador-table tr > *:last-child { border-right: 0 !important; }
.contador-premium-page .contador-table thead th {
  background: linear-gradient(180deg,#fff,#f7fafc) !important; color:#0f172a !important; font-weight: 950 !important;
}
.contador-premium-page .contador-table thead tr:nth-child(3) th {
  color: #008f45 !important; font-size: 11.5px !important; background: linear-gradient(180deg,#ffffff,#fbfcfd) !important;
}
.contador-premium-page .contador-table .responsibility-head th {
  font-size: 16px !important; color: #0f172a !important; background: linear-gradient(180deg,#f8fafc,#eef4f1) !important;
  border-top: 0 !important; border-bottom: 1px solid #dbe4ef !important;
}
.contador-premium-page .contador-table .responsibility-head th.empresa { background: linear-gradient(180deg,#f8fbff,#eef6ff) !important; }

.contador-premium-page .contador-table th:nth-child(5),
.contador-premium-page .contador-table td:nth-child(5),
.contador-premium-page .contador-table .responsibility-head th:nth-child(3) {
  border-left: 2px solid #d2dbe7 !important;
  box-shadow: inset 10px 0 16px -18px rgba(15,23,42,.35) !important;
}
.contador-premium-page .add-row-cell {
  text-align: left !important; background: #fff !important; padding: 14px 10px 10px !important; border-bottom: 0 !important;
}
.contador-premium-page .btn-add-file-row {
  height: 44px !important; border: 0 !important; border-radius: 13px !important;
  background: linear-gradient(135deg,#00B050,#009640) !important; color:#fff !important; font-weight: 950 !important;
  padding: 0 18px !important; box-shadow: 0 14px 26px rgba(0,176,80,.22) !important; cursor: pointer !important;
}
.contador-premium-page .contador-table tbody tr { background: #fff !important; transition: background .16s ease; }
.contador-premium-page .contador-table tbody tr:nth-child(even) { background: #fbfcfd !important; }
.contador-premium-page .contador-table tbody tr:hover { background: #f7fbf8 !important; }

.contador-premium-page .tipo-cell {
  background: linear-gradient(180deg,#fbfcfd,#f3f6f8) !important; color:#172033 !important; font-weight: 950 !important;
  position: relative !important; padding-left: 58px !important;
}
.contador-premium-page .tipo-cell::before {
  content: '▧'; position:absolute; left: 18px; top:50%; transform:translateY(-50%);
  width: 30px; height: 30px; border-radius: 10px; display:grid; place-items:center;
  background:#eef7f1; color:#00A04A; font-size:14px; box-shadow: inset 0 1px 0 rgba(255,255,255,.9);
}
.contador-premium-page .tipo-cell strong { font-size: 13px !important; color:#172033 !important; }
.contador-premium-page .qtd-pill {
  min-width: 38px !important; height: 32px !important; border-radius: 999px !important; background:#f1f5f9 !important;
  color:#0f172a !important; font-size: 15px !important; box-shadow: inset 0 1px 0 rgba(255,255,255,.9) !important;
}
.contador-premium-page .status-select {
  height: 36px !important; max-width: 150px !important; border-radius: 14px !important;
  background: linear-gradient(180deg,#fff,#f7fafc) !important; box-shadow: 0 8px 18px rgba(15,23,42,.05) !important;
}
.contador-premium-page .btn-download {
  min-width: 150px !important; height: 36px !important; border-radius: 12px !important;
  background: linear-gradient(135deg,#00B050,#008f45) !important; color:#fff !important; border:0 !important;
  box-shadow: 0 12px 22px rgba(0,176,80,.18) !important;
}
.contador-premium-page .upload-chip {
  height: 34px !important; border-radius: 12px !important; background:#fff !important; border:1px dashed #9eb0c7 !important; color:#172033 !important;
}
.contador-premium-page .download-status-text {
  display:inline-flex !important; align-items:center !important; justify-content:center !important; min-width: 86px !important; height: 28px !important;
  border-radius: 999px !important; font-size: 10.5px !important; font-weight: 950 !important;
}
.contador-premium-page .download-text-nao-baixado { color:#b42318 !important; background:#ffe7ea !important; }
.contador-premium-page .download-text-baixado { color:#166534 !important; background:#dcfce7 !important; }
.contador-premium-page .muted-cell { color:#52627a !important; }
.contador-premium-page .attached-item { border-radius: 10px !important; background:#f8fafc !important; }
.contador-premium-page .upload-modal-card { border-radius: 22px !important; box-shadow: 0 34px 92px rgba(15,23,42,.28) !important; }

@media (max-width: 1180px) {
  .contador-premium-shell { grid-template-columns: 1fr; width: min(100% - 24px, 1180px); }
  .contador-premium-sidebar { display:none; }
  .contador-kpi-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
}
@media (max-width: 760px) {
  .contador-kpi-grid { grid-template-columns: 1fr; }
  .contador-premium-page .filter-box, .contador-premium-page .filter-group {
    display:flex !important; flex-direction:column !important; align-items:stretch !important; width:100% !important;
  }
}
/* ===== FIM ESPAÇO DO CONTADOR PREMIUM ISOLADO ===== */



/* ===== AJUSTE ESPAÇO DO CONTADOR MAIS COMPACTO E HARMÔNICO ===== */
.contador-premium-page .dm-global-top {
  min-height: 68px !important;
  padding: 12px 20px !important;
  border-radius: 21px !important;
}

.contador-premium-page .dm-global-logo {
  width: 48px !important;
  height: 48px !important;
}

.contador-premium-page .dm-global-title h1 {
  font-size: clamp(23px, 1.55vw, 29px) !important;
  margin-bottom: 4px !important;
}

.contador-premium-page .dm-global-title p {
  font-size: 12px !important;
}

.contador-kpi-grid {
  gap: 12px !important;
  margin-bottom: 12px !important;
}

.contador-kpi-card {
  min-height: 92px !important;
  padding: 14px 16px !important;
  border-radius: 18px !important;
  grid-template-columns: 44px minmax(0, 1fr) !important;
  gap: 12px !important;
}

.contador-kpi-icon {
  width: 44px !important;
  height: 44px !important;
  border-radius: 14px !important;
  font-size: 18px !important;
}

.contador-kpi-card small {
  font-size: 10.5px !important;
  margin-bottom: 4px !important;
}

.contador-kpi-card strong {
  font-size: 23px !important;
  margin-bottom: 4px !important;
  line-height: 1 !important;
}

.contador-kpi-card span {
  font-size: 10px !important;
}

.contador-kpi-card::after {
  left: 70px !important;
  right: 14px !important;
  bottom: 12px !important;
  height: 20px !important;
}

.contador-premium-page .hero {
  padding: 12px 14px !important;
  margin-bottom: 12px !important;
  border-radius: 18px !important;
}

.contador-premium-page .filter-box {
  gap: 10px !important;
}

.contador-premium-page .filter-group {
  width: 310px !important;
  grid-template-columns: 82px 1fr !important;
  gap: 10px !important;
}

.contador-premium-page .filter-group label {
  font-size: 11px !important;
  line-height: 1.1 !important;
}

.contador-premium-page .filter-group select,
.contador-premium-page .filter-box select {
  height: 38px !important;
  border-radius: 12px !important;
  font-size: 12px !important;
}

.contador-premium-page .btn {
  height: 38px !important;
  border-radius: 12px !important;
  font-size: 12px !important;
  padding: 0 15px !important;
}

.contador-premium-page .contador-board {
  padding: 14px !important;
  border-radius: 22px !important;
}

.contador-premium-page .btn-add-file-row {
  height: 38px !important;
  border-radius: 12px !important;
  font-size: 14px !important;
  padding: 0 15px !important;
}

.contador-premium-page .add-row-cell {
  padding: 10px 10px 8px !important;
}

.contador-premium-page .contador-table th,
.contador-premium-page .contador-table td {
  padding: 9px 10px !important;
  font-size: 11px !important;
}

.contador-premium-page .contador-table .responsibility-head th {
  font-size: 14px !important;
  padding: 10px 8px !important;
}

.contador-premium-page .contador-table thead tr:nth-child(3) th {
  font-size: 10.5px !important;
  padding: 9px 8px !important;
}

.contador-premium-page .tipo-cell {
  padding-left: 48px !important;
}

.contador-premium-page .tipo-cell::before {
  left: 14px !important;
  width: 25px !important;
  height: 25px !important;
  border-radius: 8px !important;
  font-size: 12px !important;
}

.contador-premium-page .tipo-cell strong {
  font-size: 11.5px !important;
  line-height: 1.08 !important;
}

.contador-premium-page .qtd-pill {
  min-width: 32px !important;
  height: 28px !important;
  font-size: 13px !important;
}

.contador-premium-page .status-select {
  height: 32px !important;
  max-width: 140px !important;
  border-radius: 12px !important;
  font-size: 10px !important;
}

.contador-premium-page .btn-download {
  min-width: 132px !important;
  height: 32px !important;
  border-radius: 11px !important;
  font-size: 10px !important;
  padding: 0 10px !important;
}

.contador-premium-page .upload-chip {
  height: 31px !important;
  width: 118px !important;
  border-radius: 10px !important;
  font-size: 10px !important;
}

.contador-premium-page .download-status-text {
  min-width: 78px !important;
  height: 25px !important;
  font-size: 9.5px !important;
}

.contador-premium-page .muted-cell,
.contador-premium-page .empty-inline,
.contador-premium-page .attached-empty {
  font-size: 9.5px !important;
}

.contador-premium-page .contador-table {
  min-width: 1080px !important;
}

/* Menor impacto também na lateral, mantendo o padrão visual */
.contador-premium-sidebar {
  padding-top: 20px !important;
}

.contador-sidebar-logo {
  height: 62px !important;
  margin-bottom: 18px !important;
}

.contador-sidebar-logo img {
  max-height: 42px !important;
}

.contador-sidebar-nav {
  gap: 7px !important;
}

.contador-sidebar-nav a {
  height: 40px !important;
  font-size: 13px !important;
}

.contador-sidebar-card {
  padding: 13px 14px !important;
}

.contador-sidebar-card small {
  font-size: 10px !important;
}

.contador-sidebar-card a {
  height: 34px !important;
  font-size: 12px !important;
}
/* ===== FIM AJUSTE ESPAÇO DO CONTADOR COMPACTO ===== */



/* ===== AJUSTE CONTADOR: BOTÃO BAIXAR CURTO + ESPAÇOS DA TABELA ===== */
.contador-premium-page .contador-table {
  min-width: 1060px !important;
}

/* Rebalanceamento das colunas: mais espaço no tipo e na data/lixeira */
.contador-premium-page .contador-table col:nth-child(1) { width: 24% !important; }
.contador-premium-page .contador-table col:nth-child(2) { width: 6% !important; }
.contador-premium-page .contador-table col:nth-child(3) { width: 16% !important; }
.contador-premium-page .contador-table col:nth-child(4) { width: 15% !important; }
.contador-premium-page .contador-table col:nth-child(5) { width: 13% !important; }
.contador-premium-page .contador-table col:nth-child(6) { width: 10% !important; }
.contador-premium-page .contador-table col:nth-child(7) { width: 16% !important; }

/* Primeira coluna: o ícone não invade mais o nome */
.contador-premium-page .tipo-cell {
  padding-left: 54px !important;
  padding-right: 12px !important;
  overflow: visible !important;
}

.contador-premium-page .tipo-cell::before {
  left: 15px !important;
  width: 25px !important;
  height: 25px !important;
}

.contador-premium-page .tipo-cell strong {
  display: block !important;
  padding-left: 4px !important;
  white-space: normal !important;
  overflow: visible !important;
  text-overflow: clip !important;
  line-height: 1.12 !important;
}

/* Botão baixar curto e elegante */
.contador-premium-page .btn-download {
  min-width: 92px !important;
  width: 92px !important;
  height: 31px !important;
  padding: 0 10px !important;
  font-size: 10.5px !important;
  justify-content: center !important;
  white-space: nowrap !important;
}

/* Coluna de data com mais respiro para não cortar a lixeira */
.contador-premium-page .contador-table td:nth-child(7),
.contador-premium-page .contador-table th:nth-child(7) {
  padding-left: 10px !important;
  padding-right: 10px !important;
  white-space: nowrap !important;
  overflow: visible !important;
}

.contador-premium-page .download-history-wrap,
.contador-premium-page .download-date-wrap,
.contador-premium-page td:nth-child(7) span {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
  max-width: 100% !important;
  white-space: nowrap !important;
}

.contador-premium-page .trash-history,
.contador-premium-page .attached-delete {
  flex-shrink: 0 !important;
  width: 23px !important;
  height: 23px !important;
  min-width: 23px !important;
  border-radius: 7px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
}

/* Leve compactação horizontal geral */
.contador-premium-page .contador-table th,
.contador-premium-page .contador-table td {
  padding-left: 8px !important;
  padding-right: 8px !important;
}

.contador-premium-page .status-select {
  max-width: 132px !important;
  font-size: 9.5px !important;
}
/* ===== FIM AJUSTE CONTADOR BOTÃO BAIXAR CURTO ===== */



/* ===== AJUSTES FINAIS CONTADOR: MENU, BOTÃO TOPO, SEM ÍCONES ===== */

/* Menu lateral com leitura igual ao Dashboard */
.contador-sidebar-nav a {
  font-size: 15px !important;
  font-weight: 900 !important;
  letter-spacing: -0.15px !important;
}

.contador-sidebar-nav a span {
  font-size: 14px !important;
}

/* Botão novo agora fica no topo, junto do filtro */
.contador-premium-page .btn-add-file-top {
  height: 38px !important;
  min-width: 138px !important;
  padding: 0 16px !important;
  border-radius: 12px !important;
  background: linear-gradient(135deg, #00B050, #009640) !important;
  color: #fff !important;
  border: 0 !important;
  box-shadow: 0 12px 22px rgba(0,176,80,.18) !important;
  font-size: 12px !important;
  font-weight: 950 !important;
  cursor: pointer !important;
  white-space: nowrap !important;
}

.contador-premium-page .btn-add-file-top:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 16px 30px rgba(0,176,80,.24) !important;
  filter: brightness(1.03) !important;
}

/* A linha antiga do botão dentro da tabela fica anulada caso ainda exista */
.contador-premium-page .add-row-cell {
  display: none !important;
}

/* Remover ícones da primeira coluna e devolver espaço para o texto */
.contador-premium-page .tipo-cell::before {
  display: none !important;
  content: none !important;
}

.contador-premium-page .tipo-cell {
  padding-left: 14px !important;
  padding-right: 12px !important;
  background: linear-gradient(180deg,#fbfcfd,#f3f6f8) !important;
}

.contador-premium-page .tipo-cell strong {
  padding-left: 0 !important;
  display: block !important;
  white-space: normal !important;
  overflow: visible !important;
  text-overflow: clip !important;
  line-height: 1.14 !important;
  font-size: 12px !important;
}

/* Tabela mais compacta e mais premium */
.contador-premium-page .contador-table th,
.contador-premium-page .contador-table td {
  padding: 8px 9px !important;
  font-size: 11px !important;
}

.contador-premium-page .contador-table .responsibility-head th {
  padding: 9px 8px !important;
  font-size: 14px !important;
}

.contador-premium-page .contador-table thead tr:nth-child(3) th {
  padding: 8px 7px !important;
  font-size: 10.5px !important;
}

/* Rebalancear colunas depois de encurtar o botão baixar */
.contador-premium-page .contador-table col:nth-child(1) { width: 23% !important; }
.contador-premium-page .contador-table col:nth-child(2) { width: 6% !important; }
.contador-premium-page .contador-table col:nth-child(3) { width: 16% !important; }
.contador-premium-page .contador-table col:nth-child(4) { width: 15% !important; }
.contador-premium-page .contador-table col:nth-child(5) { width: 12% !important; }
.contador-premium-page .contador-table col:nth-child(6) { width: 10% !important; }
.contador-premium-page .contador-table col:nth-child(7) { width: 18% !important; }

/* Botões e controles menores */
.contador-premium-page .btn-download {
  width: 86px !important;
  min-width: 86px !important;
  height: 30px !important;
  font-size: 10px !important;
  padding: 0 8px !important;
}

.contador-premium-page .status-select {
  height: 30px !important;
  max-width: 128px !important;
  font-size: 9.5px !important;
}

.contador-premium-page .qtd-pill {
  min-width: 30px !important;
  height: 26px !important;
  font-size: 12px !important;
}

.contador-premium-page .upload-chip {
  height: 30px !important;
  width: 112px !important;
  font-size: 9.8px !important;
}

.contador-premium-page .download-status-text {
  min-width: 76px !important;
  height: 24px !important;
  font-size: 9.3px !important;
}

/* Coluna de data/lixeira com folga */
.contador-premium-page .contador-table td:nth-child(7),
.contador-premium-page .contador-table th:nth-child(7) {
  padding-left: 10px !important;
  padding-right: 12px !important;
  white-space: nowrap !important;
  overflow: visible !important;
}

.contador-premium-page .trash-history {
  flex-shrink: 0 !important;
  width: 22px !important;
  height: 22px !important;
  min-width: 22px !important;
  margin-left: 4px !important;
}

/* Filtro com o botão novo alinhado e sem pesar visualmente */
.contador-premium-page .filter-box {
  align-items: center !important;
  gap: 10px !important;
  flex-wrap: wrap !important;
}

.contador-premium-page .filter-group {
  width: 305px !important;
}

/* Em telas menores, mantém usabilidade */
@media (max-width: 1180px) {
  .contador-premium-page .btn-add-file-top {
    width: auto !important;
  }
}

@media (max-width: 760px) {
  .contador-premium-page .btn-add-file-top {
    width: 100% !important;
  }
}
/* ===== FIM AJUSTES FINAIS CONTADOR ===== */



/* ===== AJUSTE FINAL CONTADOR SOLICITADO: BOTÃO À DIREITA + EXCLUIR LINHA ===== */
.contador-premium-page .filter-box {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  width: 100% !important;
}

.contador-premium-page .contador-filter-spacer {
  flex: 1 1 auto !important;
}

.contador-premium-page .btn-add-file-top {
  margin-left: auto !important;
  min-width: 190px !important;
  height: 38px !important;
  border-radius: 13px !important;
  font-size: 12px !important;
  font-weight: 950 !important;
  background: linear-gradient(135deg,#00B050,#009640) !important;
  color: #fff !important;
  box-shadow: 0 12px 22px rgba(0,176,80,.18) !important;
}

.contador-premium-page .contador-table {
  min-width: 1120px !important;
}

.contador-premium-page .contador-table col:nth-child(1) { width: 24% !important; }
.contador-premium-page .contador-table col:nth-child(2) { width: 5% !important; }
.contador-premium-page .contador-table col:nth-child(3) { width: 6% !important; }
.contador-premium-page .contador-table col:nth-child(4) { width: 15% !important; }
.contador-premium-page .contador-table col:nth-child(5) { width: 14% !important; }
.contador-premium-page .contador-table col:nth-child(6) { width: 12% !important; }
.contador-premium-page .contador-table col:nth-child(7) { width: 10% !important; }
.contador-premium-page .contador-table col:nth-child(8) { width: 14% !important; }

.contador-premium-page .contador-table .responsibility-head th:nth-child(4),
.contador-premium-page .contador-table th:nth-child(6),
.contador-premium-page .contador-table td:nth-child(6) {
  border-left: 2px solid #d2dbe7 !important;
  box-shadow: inset 10px 0 16px -18px rgba(15,23,42,.35) !important;
}

/* Remove completamente os ícones/antes do nome do arquivo */
.contador-premium-page .tipo-cell::before {
  display: none !important;
  content: none !important;
}

.contador-premium-page .tipo-cell {
  padding-left: 14px !important;
}

.contador-premium-page .tipo-cell strong {
  padding-left: 0 !important;
}

/* Botão excluir linha */
.contador-premium-page .inline-delete-row-form {
  margin: 0 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  padding: 0 !important;
}

.contador-premium-page .row-delete-btn {
  width: 27px !important;
  height: 27px !important;
  min-width: 27px !important;
  border-radius: 9px !important;
  border: 1px solid #fecaca !important;
  background: #fff5f5 !important;
  color: #b42318 !important;
  cursor: pointer !important;
  display: inline-grid !important;
  place-items: center !important;
  font-size: 13px !important;
  line-height: 1 !important;
  transition: transform .16s ease, box-shadow .16s ease, filter .16s ease !important;
}

.contador-premium-page .row-delete-btn:hover {
  transform: translateY(-1px) !important;
  box-shadow: 0 8px 16px rgba(180,35,24,.12) !important;
  filter: brightness(1.02) !important;
}

/* Botões baixar compactos */
.contador-premium-page .btn-download {
  width: 86px !important;
  min-width: 86px !important;
  height: 30px !important;
}

/* Coluna de data com folga para lixeira/histórico */
.contador-premium-page .contador-table td:nth-child(8),
.contador-premium-page .contador-table th:nth-child(8) {
  padding-left: 10px !important;
  padding-right: 12px !important;
  overflow: visible !important;
  white-space: nowrap !important;
}

.contador-premium-page .download-date-wrap {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
}

/* Mobile */
@media (max-width: 900px) {
  .contador-premium-page .filter-box {
    align-items: stretch !important;
    flex-direction: column !important;
  }

  .contador-premium-page .contador-filter-spacer {
    display: none !important;
  }

  .contador-premium-page .btn-add-file-top {
    width: 100% !important;
    margin-left: 0 !important;
  }
}
/* ===== FIM AJUSTE FINAL CONTADOR SOLICITADO ===== */



/* ===== AJUSTE CONTADOR: LARGURA ENVIAR ARQUIVO + TIPOS POR COMPETÊNCIA ===== */
.contador-premium-page .contador-table {
  min-width: 1120px !important;
}

.contador-premium-page .contador-table col:nth-child(1) { width: 21% !important; }
.contador-premium-page .contador-table col:nth-child(2) { width: 5% !important; }
.contador-premium-page .contador-table col:nth-child(3) { width: 6% !important; }
.contador-premium-page .contador-table col:nth-child(4) { width: 18% !important; }
.contador-premium-page .contador-table col:nth-child(5) { width: 15% !important; }
.contador-premium-page .contador-table col:nth-child(6) { width: 11% !important; }
.contador-premium-page .contador-table col:nth-child(7) { width: 10% !important; }
.contador-premium-page .contador-table col:nth-child(8) { width: 14% !important; }

/* Evita estouro visual na coluna Enviar Arquivo */
.contador-premium-page .contador-table td:nth-child(4),
.contador-premium-page .contador-table th:nth-child(4) {
  overflow: visible !important;
}

.contador-premium-page .upload-cell-compact {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px !important;
  flex-wrap: nowrap !important;
  max-width: 100% !important;
}

.contador-premium-page .upload-chip {
  width: 118px !important;
  min-width: 118px !important;
  height: 30px !important;
  padding: 0 8px !important;
  font-size: 9.8px !important;
}

.contador-premium-page .attached-badge {
  min-width: 42px !important;
  height: 26px !important;
  padding: 0 8px !important;
  font-size: 10px !important;
}

.contador-premium-page .empty-inline,
.contador-premium-page .attached-empty {
  white-space: nowrap !important;
  font-size: 9.5px !important;
}

.contador-premium-page .tipo-cell strong {
  line-height: 1.12 !important;
}

/* Divisor correto depois da inclusão da coluna lixeira */
.contador-premium-page .contador-table th:nth-child(6),
.contador-premium-page .contador-table td:nth-child(6) {
  border-left: 2px solid #d2dbe7 !important;
  box-shadow: inset 10px 0 16px -18px rgba(15,23,42,.35) !important;
}
/* ===== FIM AJUSTE CONTADOR COMPETÊNCIA ===== */



/* ===== FILTRO DE COMPETÊNCIA PADRÃO PLENNATEC ===== */
.month-smart-form {
  overflow: visible !important;
}

.month-compact-row {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

.month-current-display {
  min-width: 120px !important;
  height: 38px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 14px !important;
  border-radius: 12px !important;
  background: #ffffff !important;
  border: 1px solid #dce3ec !important;
  color: #172033 !important;
  font-weight: 900 !important;
  white-space: nowrap !important;
  box-shadow: 0 8px 18px rgba(15,23,42,.05) !important;
}

.btn-month-open {
  min-width: 118px !important;
  height: 38px !important;
  padding: 0 14px !important;
}

.month-picker-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(15, 23, 42, 0.16);
  align-items: flex-start;
  justify-content: center;
  padding: 88px 18px 18px;
}

.month-picker-overlay.open {
  display: flex;
}

.month-picker-popover {
  width: 338px;
  max-width: calc(100vw - 28px);
  border-radius: 18px;
  background: rgba(255,255,255,0.98);
  border: 1px solid #dce3ec;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.22);
  padding: 14px;
}

.month-picker-head {
  display: grid;
  grid-template-columns: 44px 1fr 44px;
  gap: 10px;
  align-items: center;
  margin-bottom: 14px;
}

.month-nav-btn {
  height: 38px !important;
  min-height: 38px !important;
  border-radius: 12px !important;
  padding: 0 !important;
  font-size: 20px !important;
  line-height: 1 !important;
  border: 0 !important;
  background: linear-gradient(135deg,#00B050,#009640) !important;
  color: #fff !important;
  font-weight: 900 !important;
  cursor: pointer !important;
}

.month-year-select {
  height: 38px !important;
  text-align: center !important;
  font-weight: 900 !important;
  border-radius: 12px !important;
  border: 1px solid #dce3ec !important;
  background: #fff !important;
}

.month-grid-picker {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.month-cell {
  height: 38px !important;
  min-height: 38px !important;
  padding: 0 !important;
  border-radius: 11px !important;
  font-size: 13px !important;
  font-weight: 900 !important;
  background: #E8F7EE !important;
  color: #14532d !important;
  border: 1px solid #c8ecd4 !important;
  box-shadow: 0 8px 16px rgba(15, 23, 42, .04) !important;
  transition: all .16s ease !important;
  cursor: pointer !important;
}

.month-cell:hover,
.month-cell.active {
  background: linear-gradient(135deg, #00B050, #009640) !important;
  color: #fff !important;
  border-color: rgba(0, 176, 80, .9) !important;
  box-shadow: 0 10px 18px rgba(0, 176, 80, .22) !important;
  transform: translateY(-1px);
}

.month-picker-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 14px;
}

.month-selected-preview {
  color: #14532d;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}

.month-picker-footer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
/* ===== FIM FILTRO DE COMPETÊNCIA PADRÃO PLENNATEC ===== */



/* ===== AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */
/* Comprovantes Fiscais: filtros compactos para caberem em uma única linha em telas largas */
body.dm-global-page form[action="/lancamentos"] .filters {
  display: grid !important;
  grid-template-columns: 1.05fr 1.05fr 1.05fr 1.05fr 1.05fr 1fr .92fr .92fr auto !important;
  align-items: end !important;
  gap: 8px !important;
  padding: 12px 14px !important;
}

body.dm-global-page form[action="/lancamentos"] .filters > div {
  min-width: 0 !important;
}

body.dm-global-page form[action="/lancamentos"] .filters label {
  display: block !important;
  margin: 0 0 5px !important;
  font-size: 10px !important;
  line-height: 1.05 !important;
  font-weight: 900 !important;
  white-space: nowrap !important;
}

body.dm-global-page form[action="/lancamentos"] .filters input,
body.dm-global-page form[action="/lancamentos"] .filters select {
  width: 100% !important;
  min-width: 0 !important;
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 10px !important;
  font-size: 12px !important;
  font-weight: 700 !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons {
  display: inline-flex !important;
  align-items: end !important;
  justify-content: flex-start !important;
  gap: 7px !important;
  min-width: 142px !important;
}

body.dm-global-page form[action="/lancamentos"] .filter-buttons button,
body.dm-global-page form[action="/lancamentos"] .filter-buttons a {
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 13px !important;
  font-size: 11px !important;
  border-radius: 11px !important;
}

@media (max-width: 1280px) {
  body.dm-global-page form[action="/lancamentos"] .filters {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }
}

/* Espaço do Contador: conteúdo interno da coluna Enviar Arquivo alinhado à esquerda */
.contador-premium-page .contador-table th:nth-child(4) {
  text-align: center !important;
}

.contador-premium-page .contador-table td:nth-child(4) {
  text-align: left !important;
  padding-left: 10px !important;
  padding-right: 8px !important;
}

.contador-premium-page .upload-cell-compact {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 6px !important;
  flex-wrap: nowrap !important;
  max-width: 100% !important;
  margin-left: 0 !important;
}

.contador-premium-page .btn-upload-open {
  width: auto !important;
  min-width: 112px !important;
  height: 30px !important;
  min-height: 30px !important;
  padding: 0 12px !important;
  font-size: 10.8px !important;
  line-height: 1 !important;
  border-radius: 11px !important;
}

.contador-premium-page .upload-cell-compact .clip-indicator,
.contador-premium-page .upload-cell-compact .empty-inline,
.contador-premium-page .upload-cell-compact .attached-badge,
.contador-premium-page .upload-cell-compact .attached-empty {
  flex: 0 0 auto !important;
}
/* ===== FIM AJUSTE FINAL SOLICITADO - COMPROVANTES + CONTADOR ===== */


/* =====================================================
   CONTADOR — CORREÇÃO RAIZ DIRETA NO HTML DA ROTA
   Grid fechado em 100%, sem min-width escondido nos controles.
   ===================================================== */
body.contador-premium-page {
  overflow-x: hidden !important;
}

body.contador-premium-page .contador-premium-shell {
  width: calc(100vw - 18px) !important;
  max-width: calc(100vw - 18px) !important;
  margin-left: auto !important;
  margin-right: auto !important;
  grid-template-columns: 250px minmax(0, 1fr) !important;
  gap: 16px !important;
  overflow: hidden !important;
}

body.contador-premium-page .contador-premium-main,
body.contador-premium-page .contador-board,
body.contador-premium-page .table-wrap {
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  overflow: hidden !important;
}

body.contador-premium-page .contador-board {
  padding: 12px !important;
}

body.contador-premium-page .contador-table {
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  table-layout: fixed !important;
  border-collapse: separate !important;
  border-spacing: 0 !important;
}

/* 8 colunas reais. Soma = 100%. */
body.contador-premium-page .contador-table col:nth-child(1) { width: 20% !important; }
body.contador-premium-page .contador-table col:nth-child(2) { width: 4% !important; }
body.contador-premium-page .contador-table col:nth-child(3) { width: 5% !important; }
body.contador-premium-page .contador-table col:nth-child(4) { width: 13% !important; }
body.contador-premium-page .contador-table col:nth-child(5) { width: 16% !important; }
body.contador-premium-page .contador-table col:nth-child(6) { width: 8% !important; }
body.contador-premium-page .contador-table col:nth-child(7) { width: 10% !important; }
body.contador-premium-page .contador-table col:nth-child(8) { width: 24% !important; }

body.contador-premium-page .contador-table th,
body.contador-premium-page .contador-table td {
  width: auto !important;
  min-width: 0 !important;
  max-width: none !important;
  padding: 6px 3px !important;
  font-size: 9px !important;
  line-height: 1.04 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: clip !important;
  vertical-align: middle !important;
}

body.contador-premium-page .contador-table thead th {
  font-size: 8.4px !important;
  line-height: 1 !important;
  padding: 6px 2px !important;
  text-align: center !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: clip !important;
}

body.contador-premium-page .contador-table .responsibility-head th {
  font-size: 10.2px !important;
  line-height: 1 !important;
  padding: 7px 2px !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: clip !important;
}

/* Tipo de arquivo: fixo, compacto e sem empurrar a tabela */
body.contador-premium-page .tipo-cell {
  padding-left: 7px !important;
  padding-right: 3px !important;
  max-width: 100% !important;
  overflow: hidden !important;
}

body.contador-premium-page .tipo-cell::before {
  display: none !important;
  content: none !important;
}

body.contador-premium-page .tipo-cell strong {
  display: block !important;
  width: 100% !important;
  max-width: 100% !important;
  font-size: 9.6px !important;
  line-height: 1.04 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

/* Lixeira e quantidade */
body.contador-premium-page .inline-delete-row-form {
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
}

body.contador-premium-page .row-delete-btn,
body.contador-premium-page .inline-delete-row-form button {
  width: 19px !important;
  min-width: 19px !important;
  max-width: 19px !important;
  height: 19px !important;
  min-height: 19px !important;
  max-height: 19px !important;
  padding: 0 !important;
  font-size: 9px !important;
}

body.contador-premium-page .qtd-pill {
  width: 24px !important;
  min-width: 24px !important;
  max-width: 24px !important;
  height: 22px !important;
  min-height: 22px !important;
  padding: 0 !important;
  font-size: 9.5px !important;
}

/* Enviar arquivo */
body.contador-premium-page .upload-cell-compact,
body.contador-premium-page .inline-upload-form {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 2px !important;
  flex-wrap: nowrap !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  overflow: hidden !important;
  white-space: nowrap !important;
}

body.contador-premium-page .btn-upload-open,
body.contador-premium-page .upload-chip {
  flex: 0 1 auto !important;
  width: 72px !important;
  min-width: 0 !important;
  max-width: 72px !important;
  height: 25px !important;
  min-height: 25px !important;
  max-height: 25px !important;
  padding: 0 3px !important;
  font-size: 7.8px !important;
  line-height: 1 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: clip !important;
  border-radius: 8px !important;
}

body.contador-premium-page .attached-badge,
body.contador-premium-page .attached-empty,
body.contador-premium-page .empty-inline {
  flex: 0 1 auto !important;
  min-width: 0 !important;
  max-width: 26px !important;
  font-size: 7.4px !important;
  padding-left: 2px !important;
  padding-right: 2px !important;
  white-space: nowrap !important;
  overflow: hidden !important;
}

/* Arquivos prontos */
body.contador-premium-page .status-select {
  display: block !important;
  width: 100% !important;
  min-width: 0 !important;
  max-width: 100% !important;
  height: 27px !important;
  min-height: 27px !important;
  max-height: 27px !important;
  padding-left: 5px !important;
  padding-right: 15px !important;
  font-size: 8px !important;
  line-height: 1 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  border-radius: 9px !important;
}

/* Arquivo */
body.contador-premium-page .btn-download {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 62px !important;
  min-width: 0 !important;
  max-width: 62px !important;
  height: 25px !important;
  min-height: 25px !important;
  max-height: 25px !important;
  padding: 0 3px !important;
  font-size: 7.9px !important;
  line-height: 1 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  border-radius: 8px !important;
}

/* Status */
body.contador-premium-page .download-status-text,
body.contador-premium-page .download-status,
body.contador-premium-page .status-pill {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: auto !important;
  min-width: 0 !important;
  max-width: 100% !important;
  height: 21px !important;
  min-height: 21px !important;
  max-height: 21px !important;
  padding: 0 4px !important;
  font-size: 7.6px !important;
  line-height: 1 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
}

/* Data Download */
body.contador-premium-page .contador-table th:nth-child(8),
body.contador-premium-page .contador-table td:nth-child(8) {
  padding-left: 2px !important;
  padding-right: 2px !important;
  font-size: 8px !important;
  line-height: 1 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-align: center !important;
}

body.contador-premium-page .download-date-wrap,
body.contador-premium-page .download-history-wrap,
body.contador-premium-page .contador-table td:nth-child(8) span,
body.contador-premium-page .contador-table td:nth-child(8) div {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 2px !important;
  max-width: 100% !important;
  min-width: 0 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
}

body.contador-premium-page .trash-history {
  flex: 0 0 17px !important;
  width: 17px !important;
  min-width: 17px !important;
  max-width: 17px !important;
  height: 17px !important;
  min-height: 17px !important;
  max-height: 17px !important;
  font-size: 8px !important;
  padding: 0 !important;
  margin-left: 2px !important;
}

@media (max-width: 1380px) {
  body.contador-premium-page .contador-premium-shell {
    grid-template-columns: 232px minmax(0, 1fr) !important;
    gap: 12px !important;
  }

  body.contador-premium-page .contador-premium-sidebar {
    width: 232px !important;
    min-width: 232px !important;
    max-width: 232px !important;
  }

  body.contador-premium-page .contador-table col:nth-child(1) { width: 18% !important; }
  body.contador-premium-page .contador-table col:nth-child(2) { width: 4% !important; }
  body.contador-premium-page .contador-table col:nth-child(3) { width: 5% !important; }
  body.contador-premium-page .contador-table col:nth-child(4) { width: 12% !important; }
  body.contador-premium-page .contador-table col:nth-child(5) { width: 16% !important; }
  body.contador-premium-page .contador-table col:nth-child(6) { width: 8% !important; }
  body.contador-premium-page .contador-table col:nth-child(7) { width: 10% !important; }
  body.contador-premium-page .contador-table col:nth-child(8) { width: 27% !important; }

  body.contador-premium-page .contador-table th,
  body.contador-premium-page .contador-table td {
    font-size: 8.4px !important;
    padding-left: 2px !important;
    padding-right: 2px !important;
  }

  body.contador-premium-page .contador-table thead th {
    font-size: 7.8px !important;
  }

  body.contador-premium-page .contador-table .responsibility-head th {
    font-size: 9.4px !important;
  }

  body.contador-premium-page .tipo-cell strong {
    font-size: 8.7px !important;
  }

  body.contador-premium-page .btn-upload-open,
  body.contador-premium-page .upload-chip {
    max-width: 66px !important;
    font-size: 7.2px !important;
  }

  body.contador-premium-page .btn-download {
    max-width: 58px !important;
    font-size: 7.4px !important;
  }
}

</style>
      </head>
      <body class="dm-global-page contador-premium-page">
        ${renderMonthPickerAssets()}
        ${renderContadorTabelaDefinitivaAssets()}
        <div class="contador-premium-shell">
          <aside class="contador-premium-sidebar" aria-label="Menu lateral PlennaTec">
            <div class="contador-sidebar-logo">
              <img src="/assets/logo-plennatec-login.png" onerror="this.src='/assets/logo-plennatec-perfil.png'" alt="PlennaTec" />
            </div>

            <nav class="contador-sidebar-nav">
              <a href="/dashboard"><span>⌂</span>Dashboard</a>
              <a href="/rotina-despesas"><span>▧</span>Contas a Pagar</a>
              <a href="/lancamentos"><span>▤</span>Comprovantes</a>
              <a href="/documentos"><span>▣</span>Arquivo</a>
              <a href="/categorias"><span>□</span>Categorias</a>
              <a class="active" href="/espaco-contador"><span>♙</span>Espaço do Contador</a>
              ${isAdmin ? `<a href="/usuarios"><span>◉</span>Usuários</a>` : ''}
            </nav>

            <div class="contador-sidebar-card">
              <strong>Gestão Premium</strong>
              <small>Fechamento contábil com arquivos, status e downloads em massa.</small>
              <a href="/novo">Novo lançamento</a>
            </div>

            <div class="contador-sidebar-user">
              <img src="/assets/logo-plennatec-perfil.png" onerror="this.style.display='none'" alt="Perfil" />
              <div>
                <strong>${escapeHtmlGlobal(req.session.usuario?.nome || 'Genivaldo')}</strong>
                <small>${escapeHtmlGlobal(req.session.usuario?.perfil || 'ADMIN')}</small>
              </div>
            </div>
          </aside>

          <main class="contador-premium-main">
            ${renderGlobalHeader(req, { titulo: 'Espaço do Contador', subtitulo: 'Baixe arquivos fiscais, acompanhe status e gerencie pacotes por competência.', paginaAtual: 'espaco-contador' })}
            <div class="container">
          <section class="contador-kpi-grid" aria-label="Resumo do mês">
            <div class="contador-kpi-card">
              <div class="contador-kpi-icon green">▧</div>
              <div><small>XML disponíveis</small><strong>${totalXml}</strong><span>Arquivos fiscais do mês</span></div>
            </div>
            <div class="contador-kpi-card">
              <div class="contador-kpi-icon blue">▤</div>
              <div><small>PDF disponíveis</small><strong>${totalPdf}</strong><span>Comprovantes fiscais</span></div>
            </div>
            <div class="contador-kpi-card">
              <div class="contador-kpi-icon purple">□</div>
              <div><small>Linhas extras</small><strong>${arquivosExtras.length}</strong><span>Pacotes adicionais</span></div>
            </div>
            <div class="contador-kpi-card">
              <div class="contador-kpi-icon lime">⇣</div>
              <div><small>Competência</small><strong>${labelMes}</strong><span>Mês selecionado</span></div>
            </div>
          </section>

          <section class="hero">
            <form method="GET" action="/espaco-contador" class="filter-box month-smart-form" id="contadorMonthForm">
              <div class="filter-group">
                <label>Escolha o mês dos arquivos</label>
                ${renderMonthPickerComponent({
                  prefix: 'contador',
                  selectedValue: mes,
                  fieldName: 'mes',
                  allowAll: false,
                  openButtonLabel: 'Escolher mês',
                  applyLabel: 'Filtrar mês',
                  compact: true
                })}
              </div>
              <button type="button" class="btn btn-green contador-apply-month-btn" onclick="aplicarMesGlobal('contador')">Aplicar mês</button>
              <span class="contador-filter-spacer"></span>
              ${isAdmin ? `<button type="button" class="btn btn-add-file-row btn-add-file-top" onclick="abrirModalUpload('modal-add-file-row')">Adicionar tipo de arquivo</button>` : ''}
            </form>
          </section>

          <section class="contador-board">
            <div class="table-wrap">
              <table class="contador-table">
                <colgroup>
                  <col style="width:20%;">
                  <col style="width:4%;">
                  <col style="width:5%;">
                  <col style="width:14%;">
                  <col style="width:17%;">
                  <col style="width:8%;">
                  <col style="width:9%;">
                  <col style="width:23%;">
                </colgroup>
                <thead>
                  ${isAdmin ? `
                  ` : ''}
                  <tr class="responsibility-head">
                    <th></th>
                    <th></th>
                    <th colspan="3" class="empresa">Responsabilidade da empresa</th>
                    <th colspan="3">Responsabilidade do Contador</th>
                  </tr>
                  <tr>
                    <th>Tipo de arquivo</th>
                    <th></th>
                    <th>Qtde</th>
                    <th>Enviar Arquivo</th>
                    <th>Arquivos prontos</th>
                    <th>Arquivo</th>
                    <th>Status Download</th>
                    <th>Data Download</th>
                  </tr>
                </thead>
                <tbody>${linhasTabelaHtml}</tbody>
              </table>
            </div>
          </section>

          ${isAdmin ? `
          <div class="upload-modal-overlay" id="modal-add-file-row" aria-hidden="true">
            <div class="upload-modal-card">
              <div class="upload-modal-header">
                <div>
                  <strong>Adicionar nova linha de arquivo</strong>
                  <span>Crie um novo tipo de arquivo para este painel. A linha terá upload, status e download em massa.</span>
                </div>
                <button type="button" class="modal-close" onclick="fecharModalUpload('modal-add-file-row')">×</button>
              </div>
              <form method="POST" action="/espaco-contador/adicionar-tipo" class="add-row-modal-form">
                <input type="hidden" name="mes_ref" value="${escapeHtml(mes)}">
                <label>
                  <strong>Nome da nova linha</strong>
                  <input type="text" name="label" placeholder="Ex.: Comprovantes diversos" required maxlength="90">
                </label>
                <div class="modal-actions">
                  <button type="button" class="btn btn-dark" onclick="fecharModalUpload('modal-add-file-row')">Cancelar</button>
                  <button type="submit" class="btn btn-green">Salvar linha</button>
                </div>
              </form>
            </div>
          </div>` : ''}
            </div>
          </main>
        </div>
        <script>

          function abrirModalUpload(id) {
            const modal = document.getElementById(id);
            if (modal) modal.classList.add('is-open');
          }

          function fecharModalUpload(id) {
            const modal = document.getElementById(id);
            if (!modal) return;
            modal.classList.remove('is-open');
            const input = modal.querySelector('input[type="file"]');
            const preview = modal.querySelector('[data-preview-list]');
            if (input) input.value = '';
            if (preview) preview.innerHTML = '<div class="modal-empty">Nenhum arquivo selecionado.</div>';
          }

          function atualizarPreviewArquivos(input) {
            const form = input.closest('form');
            const list = form ? form.querySelector('[data-preview-list]') : null;
            if (!list) return;

            const dt = new DataTransfer();
            Array.from(input.files || []).forEach(file => dt.items.add(file));
            input.files = dt.files;

            renderPreview(input, list);
          }

          function renderPreview(input, list) {
            const files = Array.from(input.files || []);
            if (!files.length) {
              list.innerHTML = '<div class="modal-empty">Nenhum arquivo selecionado.</div>';
              return;
            }

            list.innerHTML = '';
            files.forEach((file, index) => {
              const row = document.createElement('div');
              row.className = 'modal-file-row';

              const name = document.createElement('span');
              name.textContent = file.name;
              name.title = file.name;

              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'modal-delete';
              btn.title = 'Remover da seleção';
              btn.textContent = '🗑';
              btn.onclick = function () {
                const novo = new DataTransfer();
                Array.from(input.files || []).forEach((item, i) => {
                  if (i !== index) novo.items.add(item);
                });
                input.files = novo.files;
                renderPreview(input, list);
              };

              row.appendChild(name);
              row.appendChild(btn);
              list.appendChild(row);
            });
          }

          document.addEventListener('click', function(event) {
            if (event.target && event.target.classList && event.target.classList.contains('upload-modal-overlay')) {
              event.target.classList.remove('is-open');
            }
          });
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    res.send(`<pre>Erro ao abrir Espaço do Contador:\n${error.message}</pre>`);
  }
});



router.post('/espaco-contador/excluir-tipo/:tipo', protegerRota, permitirPerfis('ADMIN'), async (req, res) => {
  try {
    await ensureContadorTables();

    const mesRef = req.body.mes_ref || getMesAtualRef();
    const tipo = String(req.params.tipo || '').trim();

    if (!tipo) {
      return res.send('<pre>Tipo de arquivo inválido para exclusão.</pre>');
    }

    if (tipo.startsWith('custom_')) {
      const id = Number.parseInt(tipo.replace('custom_', ''), 10);

      if (!Number.isFinite(id)) {
        return res.send('<pre>Tipo personalizado inválido.</pre>');
      }

      await pool.query(`
        UPDATE contador_arquivo_tipos
        SET ativo = false
        WHERE id = $1
      `, [id]);

      await pool.query(`
        DELETE FROM contador_status_custom_mensal
        WHERE tipo_key = $1
      `, [tipo]);
    } else {
      const config = getContadorArquivoConfig().find(item => item.key === tipo);

      if (!config) {
        return res.send('<pre>Tipo de arquivo não encontrado.</pre>');
      }

      await setPainelConfig(`contador_tipo_oculto_${mesRef}_${tipo}`, 'true');
    }

    return res.redirect('/espaco-contador?mes=' + encodeURIComponent(mesRef));
  } catch (error) {
    return res.send(`<pre>Erro ao excluir linha do Espaço do Contador:
${error.message}</pre>`);
  }
});


router.post('/espaco-contador/adicionar-tipo', protegerRota, permitirPerfis('ADMIN'), async (req, res) => {
  try {
    await ensureContadorTables();
    const mesRef = req.body.mes_ref || getMesAtualRef();
    const label = String(req.body.label || '').trim();

    if (!label) {
      return res.send('<pre>Informe o nome da nova linha de arquivo.</pre>');
    }

    await pool.query(`
      INSERT INTO contador_arquivo_tipos (label, titulo, ativo, mes_ref, created_at)
      VALUES ($1, $1, true, $2, NOW())
    `, [label, mesRef]);

    res.redirect('/espaco-contador?mes=' + encodeURIComponent(mesRef));
  } catch (error) {
    res.send(`<pre>Erro ao adicionar nova linha de arquivo:
${error.message}</pre>`);
  }
});

router.post('/espaco-contador/limpar-download/:tipo', protegerRota, permitirPerfis('ADMIN'), async (req, res) => {
  try {
    await ensureContadorTables();
    const mesRef = req.body.mes_ref || getMesAtualRef();
    const tipo = String(req.params.tipo || '').trim();
    const config = (await getContadorArquivoConfigCompleta(mesRef)).find(item => item.key === tipo);

    if (!config) {
      return res.send('<pre>Tipo de download inválido para limpeza.</pre>');
    }

    if (config.custom) {
      await pool.query(`
        INSERT INTO contador_status_custom_mensal (mes_ref, tipo_key, download_status, download_at, updated_at)
        VALUES ($1, $2, 'Baixar', NULL, NOW())
        ON CONFLICT (mes_ref, tipo_key)
        DO UPDATE SET download_status = 'Baixar', download_at = NULL, updated_at = NOW()
      `, [mesRef, tipo]);
    } else {
      await pool.query(`
        INSERT INTO contador_status_mensal (mes_ref)
        VALUES ($1)
        ON CONFLICT (mes_ref) DO NOTHING
      `, [mesRef]);
      await pool.query(`
        UPDATE contador_status_mensal
        SET ${config.downloadStatusColumn} = 'Baixar',
            ${config.downloadAtColumn} = NULL,
            updated_at = NOW()
        WHERE mes_ref = $1
      `, [mesRef]);
    }

    res.redirect('/espaco-contador?mes=' + encodeURIComponent(mesRef));
  } catch (error) {
    res.send(`<pre>Erro ao limpar histórico de download:
${error.message}</pre>`);
  }
});

router.post('/espaco-contador/upload-extra', protegerRota, permitirPerfis('ADMIN', 'USUARIO', 'CONTADOR'), upload.array('arquivos', 30), async (req, res) => {
  try {
    await ensureContadorTables();
    const mesRef = req.body.mes_ref || getMesAtualRef();
    const titulo = String(req.body.titulo || '').trim();
    const arquivos = req.files || [];

    if (!arquivos.length) {
      return res.send('<pre>Selecione pelo menos um arquivo para enviar.</pre>');
    }

    if (!titulo) {
      arquivos.forEach(file => { try { fs.unlinkSync(getUploadFilePath(file.filename)); } catch (e) {} });
      return res.send('<pre>Informe o tipo/nome do pacote.</pre>');
    }

    for (const file of arquivos) {
      await pool.query(`
        INSERT INTO contador_arquivos_extras (mes_ref, titulo, nome_arquivo, nome_original, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [mesRef, titulo, file.filename, file.originalname || file.filename]);
    }

    res.redirect('/espaco-contador?mes=' + encodeURIComponent(mesRef));
  } catch (error) {
    res.send(`<pre>Erro ao enviar arquivo extra:\n${error.message}</pre>`);
  }
});


router.post('/espaco-contador/excluir-extra/:id', protegerRota, permitirPerfis('ADMIN', 'USUARIO', 'CONTADOR'), async (req, res) => {
  try {
    await ensureContadorTables();
    const id = Number.parseInt(req.params.id, 10);
    const mesRef = req.body.mes_ref || getMesAtualRef();

    if (!Number.isFinite(id)) {
      return res.send('<pre>Arquivo inválido para exclusão.</pre>');
    }

    const result = await pool.query('SELECT * FROM contador_arquivos_extras WHERE id = $1 LIMIT 1', [id]);
    const item = result.rows[0];

    if (!item) {
      return res.redirect('/espaco-contador?mes=' + encodeURIComponent(mesRef));
    }

    const filePath = getUploadFilePath(item.nome_arquivo);
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }

    await pool.query('DELETE FROM contador_arquivos_extras WHERE id = $1', [id]);
    res.redirect('/espaco-contador?mes=' + encodeURIComponent(item.mes_ref || mesRef));
  } catch (error) {
    res.send(`<pre>Erro ao excluir arquivo anexado:
${error.message}</pre>`);
  }
});

router.post('/espaco-contador/salvar-status', protegerRota, permitirPerfis('ADMIN', 'USUARIO', 'CONTADOR'), async (req, res) => {
  try {
    await ensureContadorTables();
    const { mes_ref, tipo_status, status } = req.body;

    if (!mes_ref || !tipo_status || !status) {
      return res.send('<pre>Dados inválidos para salvar o status.</pre>');
    }

    await pool.query(`
      INSERT INTO contador_status_mensal (mes_ref)
      VALUES ($1)
      ON CONFLICT (mes_ref) DO NOTHING
    `, [mes_ref]);

    const config = (await getContadorArquivoConfigCompleta(mes_ref)).find(item => item.key === tipo_status);

    if (!config) {
      return res.send('<pre>Tipo de status inválido.</pre>');
    }

    if (config.custom) {
      await pool.query(`
        INSERT INTO contador_status_custom_mensal (mes_ref, tipo_key, status_pronto, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (mes_ref, tipo_key)
        DO UPDATE SET status_pronto = EXCLUDED.status_pronto, updated_at = NOW()
      `, [mes_ref, tipo_status, status]);
    } else {
      const campo = config.statusColumn;
      await pool.query(`
        UPDATE contador_status_mensal
        SET ${campo} = $1,
            updated_at = NOW()
        WHERE mes_ref = $2
      `, [status, mes_ref]);
    }

    res.redirect('/espaco-contador?mes=' + encodeURIComponent(mes_ref));
  } catch (error) {
    res.send(`<pre>Erro ao salvar status do mês:\n${error.message}</pre>`);
  }
});

router.get('/espaco-contador/download-extra/:id', protegerRota, permitirPerfis('ADMIN', 'USUARIO', 'CONTADOR'), async (req, res) => {
  try {
    await ensureContadorTables();
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.send('<pre>Arquivo inválido.</pre>');

    const result = await pool.query('SELECT * FROM contador_arquivos_extras WHERE id = $1 LIMIT 1', [id]);
    const item = result.rows[0];
    if (!item) return res.send('<pre>Arquivo não encontrado.</pre>');

    const filePath = getUploadFilePath(item.nome_arquivo);
    if (!filePath || !fs.existsSync(filePath)) return res.send('<pre>Arquivo físico não encontrado em /uploads.</pre>');

    return res.download(filePath, item.nome_original || path.basename(filePath));
  } catch (error) {
    res.send(`<pre>Erro ao baixar arquivo extra:\n${error.message}</pre>`);
  }
});

router.get('/espaco-contador/download-extra-grupo/:grupo', protegerRota, permitirPerfis('ADMIN', 'USUARIO', 'CONTADOR'), async (req, res) => {
  try {
    await ensureContadorTables();
    const { grupo } = req.params;
    const { mes } = req.query;

    if (!mes) return res.send('<pre>Mês não informado.</pre>');

    const config = (await getContadorArquivoConfigCompleta(mes)).find(item => item.key === grupo && !item.auto);
    if (!config) return res.send('<pre>Grupo de arquivo inválido.</pre>');

    const result = await pool.query(`
      SELECT *
      FROM contador_arquivos_extras
      WHERE mes_ref = $1 AND titulo = $2
      ORDER BY created_at DESC, id DESC
    `, [mes, config.titulo]);

    const arquivos = [];
    const nomesUsados = new Set();

    for (const item of result.rows) {
      const filePath = getUploadFilePath(item.nome_arquivo);
      if (!filePath || !fs.existsSync(filePath)) continue;

      const originalName = path.basename(item.nome_original || item.nome_arquivo || path.basename(filePath));
      const ext = path.extname(originalName) || path.extname(item.nome_arquivo || '') || '.zip';
      const baseOriginal = path.basename(originalName, ext) || `arquivo-${item.id}`;
      let downloadName = `${sanitizeFilePart(baseOriginal, true)}${ext}`;
      if (nomesUsados.has(downloadName)) {
        downloadName = `${sanitizeFilePart(baseOriginal, true)}-${item.id}${ext}`;
      }
      nomesUsados.add(downloadName);
      arquivos.push({ filePath, downloadName });
    }

    if (!arquivos.length) {
      return res.send(`<pre>Nenhum arquivo encontrado para ${config.label} neste mês.</pre>`);
    }

    if (req.session?.usuario?.perfil === 'CONTADOR') {
      await marcarDownloadContador(mes, grupo);
    }
    return gerarZipEEnviar(res, arquivos, `${config.label}-${mes}`);
  } catch (error) {
    res.send(`<pre>Erro ao Baixar:\n${error.message}</pre>`);
  }
});

// DOWNLOAD EM MASSA - ESPAÇO DO CONTADOR
router.get('/espaco-contador/download/:tipo', protegerRota, permitirPerfis('ADMIN', 'USUARIO', 'CONTADOR'), async (req, res) => {
  try {
    await ensureContadorTables();
    const { tipo } = req.params;
    const { mes } = req.query;

    if (!['pdf', 'xml'].includes(tipo)) {
      return res.send('<pre>Tipo de arquivo inválido.</pre>');
    }

    if (!mes) {
      return res.send('<pre>Mês não informado.</pre>');
    }

    const campo = tipo === 'pdf' ? 'anexo_pdf' : 'anexo_xml';
    const extensao = tipo === 'pdf' ? 'pdf' : 'xml';

    const result = await pool.query(`
      SELECT
        l.id,
        l.fornecedor,
        l.numero_documento,
        l.tipo_documento,
        l.tipo_pagamento,
        l.valor,
        c.nome AS categoria,
        l.${campo} AS arquivo
      FROM lancamentos l
      LEFT JOIN categorias c ON c.id = l.categoria_id
      WHERE l.${campo} IS NOT NULL
        AND TRIM(l.${campo}) <> ''
        AND l.data_despesa >= DATE_TRUNC('month', $1::date)
        AND l.data_despesa < DATE_TRUNC('month', $1::date) + INTERVAL '1 month'
      ORDER BY l.id DESC
    `, [`${mes}-01`]);

    if (!result.rows.length) {
      return res.send(`<pre>Nenhum arquivo ${extensao.toUpperCase()} encontrado para este mês.</pre>`);
    }

    const arquivosValidos = [];
    const nomesUsados = new Set();

    for (const item of result.rows) {
      const filePath = getUploadFilePath(item.arquivo);

      if (filePath && fs.existsSync(filePath)) {
        const baseName = buildDownloadBaseName(item);
        let downloadName = `${baseName}.${extensao}`;

        if (nomesUsados.has(downloadName)) {
          downloadName = `${baseName}-ID-${item.id}.${extensao}`;
        }
        nomesUsados.add(downloadName);

        arquivosValidos.push({ filePath, downloadName });
      }
    }

    if (!arquivosValidos.length) {
      return res.send('<pre>Os registros existem no banco, mas os arquivos físicos não foram encontrados em /uploads.</pre>');
    }

    if (req.session?.usuario?.perfil === 'CONTADOR') {
      await marcarDownloadContador(mes, tipo);
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="arquivos-${extensao}-${mes}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).send(`<pre>Erro ao gerar ZIP:\n${err.message}</pre>`);
      }
    });

    archive.pipe(res);

    arquivosValidos.forEach(item => {
      archive.file(item.filePath, { name: item.downloadName });
    });

    await archive.finalize();
  } catch (error) {
    res.send(`<pre>Erro ao Baixar:\n${error.message}</pre>`);
  }
});

module.exports = router;