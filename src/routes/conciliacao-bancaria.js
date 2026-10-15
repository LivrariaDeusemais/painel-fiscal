const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { PDFParse } = require('pdf-parse');
const service = require('../services/conciliacao-bancaria');
const compras = require('../services/compras-estoque');
const { renderPage } = require('../views/conciliacao-bancaria');

function createRouter({ pool, protect, renderShell, uploadsDir }) {
  const router = express.Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } });
  let schema;
  const receiptCache = new Map();
  function ensureSchema() {
    if (!schema) schema = pool.query(`CREATE TABLE IF NOT EXISTS conciliacoes_bancarias (
      banco TEXT NOT NULL, mes TEXT NOT NULL, dados JSONB NOT NULL,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (banco, mes)
    ); CREATE TABLE IF NOT EXISTS conciliacao_pessoas (
      id TEXT PRIMARY KEY, source_name TEXT NOT NULL, name TEXT NOT NULL, document TEXT NOT NULL, aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    ); ALTER TABLE conciliacao_pessoas ADD COLUMN IF NOT EXISTS trade_name TEXT, ADD COLUMN IF NOT EXISTS purpose TEXT`).catch(e => { schema = null; throw e; });
    return schema;
  }
  function selection(req) {
    const bank = req.query.banco || req.body?.banco;
    const month = req.query.mes || req.body?.mes;
    if (!service.BANKS[bank] || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) throw Object.assign(new Error('Selecione banco e mês válidos.'), { status: 400 });
    return { bank, month };
  }
  function emptyState() { return { rows: [], pix: [], sources: [], columns: [], account: {}, warnings: [] }; }
  async function readState(db, bank, month, lock = false) {
    const result = await db.query(`SELECT dados FROM conciliacoes_bancarias WHERE banco=$1 AND mes=$2${lock ? ' FOR UPDATE' : ''}`, [bank, month]);
    const state = result.rows[0]?.dados || emptyState();
    const people = await db.query('SELECT id, source_name, name, document, aliases, trade_name, purpose FROM conciliacao_pessoas');
    state.rows = service.applyPeople(state.rows, people.rows).map(service.applyPartnerRule);
    state.displayColumns = service.visibleColumns(state);
    return state;
  }
  async function mutate(bank, month, operation) {
    await ensureSchema();
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      // Serializa alterações para impedir vínculos duplicados entre bancos e meses.
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['conciliacao:vinculos']);
      const state = await readState(db, bank, month, true);
      const other = await readState(db, bank === 'caixa' ? 'inter' : 'caixa', month, true);
      const result = await operation(state, other, db);
      const people = await db.query('SELECT id, source_name, name, document, aliases, trade_name, purpose FROM conciliacao_pessoas');
      result.state.rows = service.applyPeople(result.state.rows, people.rows).map(service.applyPartnerRule);
      result.state.displayColumns = service.visibleColumns(result.state);
      await db.query(`INSERT INTO conciliacoes_bancarias (banco,mes,dados) VALUES ($1,$2,$3::jsonb)
        ON CONFLICT (banco,mes) DO UPDATE SET dados=EXCLUDED.dados, atualizado_em=NOW()`, [bank, month, JSON.stringify(result.state)]);
      await db.query('COMMIT');
      return result;
    } catch (e) { await db.query('ROLLBACK'); throw e; }
    finally { db.release(); }
  }
  async function foreignLinks(db, bank, month) {
    const result = await db.query(`SELECT DISTINCT movimento->>'linkedId' AS id
      FROM conciliacoes_bancarias CROSS JOIN LATERAL jsonb_array_elements(dados->'rows') AS movimentos(movimento)
      WHERE (banco<>$1 OR mes<>$2) AND movimento->>'linkedId' IS NOT NULL`, [bank, month]);
    return new Set(result.rows.map(r => String(r.id)));
  }
  async function candidates(db, month, search = '', id = null) {
    const args = id ? [id] : [`${month}-01`];
    let where = id ? 'l.id=$1' : `l.data_despesa >= $1::date AND l.data_despesa < $1::date + INTERVAL '1 month'`;
    if (search) {
      args.splice(0, args.length, `%${search.trim()}%`);
      where = `(l.fornecedor ILIKE $1 OR l.cnpj_cpf ILIKE $1 OR l.codigo_pagamento ILIKE $1 OR l.numero_documento ILIKE $1 OR c.nome ILIKE $1 OR p.nome ILIKE $1)`;
    }
    const result = await db.query(`SELECT l.id,l.fornecedor,l.cnpj_cpf,l.valor,l.tipo_pagamento,l.codigo_pagamento,l.data_despesa,l.anexo_pdf,
      c.nome AS categoria, p.nome AS categoria_principal,
      CASE WHEN c.categoria_pai_id IS NULL THEN '' ELSE c.nome END AS subcategoria
      FROM lancamentos l LEFT JOIN categorias c ON c.id=l.categoria_id LEFT JOIN categorias p ON p.id=c.categoria_pai_id
      WHERE ${where} ORDER BY l.data_despesa DESC,l.id DESC${search ? ' LIMIT 100' : ''}`, args);
    return result.rows;
  }
  async function receiptEvidence(list) {
    let failed = 0;
    for (const candidate of list) {
      if (!candidate.anexo_pdf) continue;
      const file = path.join(uploadsDir, path.basename(candidate.anexo_pdf));
      try {
        const stat = fs.statSync(file);
        const key = `${file}:${stat.mtimeMs}`;
        let text = receiptCache.get(key);
        if (text === undefined) {
          if (stat.size > 15 * 1024 * 1024) { failed++; continue; }
          const parser = new PDFParse({ data: fs.readFileSync(file) });
          try { text = (await parser.getText()).text.slice(0, 200000); }
          finally { await parser.destroy(); }
          if (receiptCache.size >= 1000) receiptCache.clear();
          receiptCache.set(key, text);
        }
        candidate.receiptText = text;
        candidate.receiptDocuments = [...new Set((text.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g) || []).map(v => v.replace(/\D/g, '')))];
      } catch { failed++; }
    }
    return failed;
  }
  function csrf(req, res, next) {
    if (req.session.usuario?.perfil === 'CONTADOR') return res.status(403).json({ error: 'Seu perfil permite apenas consultar a conciliação.' });
    const token = req.headers['x-conciliacao-token'];
    if (!token || token !== req.session.conciliacaoToken) return res.status(403).json({ error: 'Atualize a página antes de salvar.' });
    next();
  }
  const run = fn => async (req, res) => {
    try { await fn(req, res); }
    catch (e) { console.error('Conciliação bancária:', e.message); const internal = e.code || e.status === 500; res.status(internal ? 500 : e.status || 400).json({ error: internal ? 'Não foi possível concluir a operação. Tente novamente ou contate o administrador.' : e.message }); }
  };
  router.use(protect);
  router.get('/', (req, res) => {
    req.session.conciliacaoToken ||= crypto.randomBytes(24).toString('hex');
    const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(new Date());
    res.send(renderShell(req, { titulo: 'Conciliações Bancárias', subtitulo: 'Extratos, pagamentos e recebíveis em uma única conferência.', paginaAtual: 'conciliacao-bancaria', navegacaoSuperior: true }, renderPage({ token: req.session.conciliacaoToken, month, readonly: req.session.usuario?.perfil === 'CONTADOR' })));
  });
  router.get('/dados', run(async (req, res) => {
    await ensureSchema(); const { bank, month } = selection(req);
    res.json(await readState(pool, bank, month));
  }));
  router.get('/pessoas', run(async (req, res) => {
    await ensureSchema();
    const saved = await pool.query('SELECT id, source_name, name, document, aliases, trade_name, purpose FROM conciliacao_pessoas ORDER BY name');
    const states = await pool.query('SELECT banco, mes, dados FROM conciliacoes_bancarias');
    const known = [...saved.rows];
    for (const state of states.rows) for (const row of state.dados.rows || []) {
      const source_name = service.personSourceName(row), document = String(row.document || '').replace(/\D/g, '');
      if (!source_name || String(row.document).includes('*') || ![11, 14].includes(document.length) || known.some(p => p.source_name === source_name && [p.document, ...(p.aliases || [])].some(d => d.replace(/\D/g, '') === document))) continue;
      known.push({ id: crypto.createHash('sha256').update(source_name + '|' + document).digest('hex'), source_name, name: row.name || row.supplier || row.description || 'Sem identificação', document, inferred: true });
    }
    const list = new Map(known.map(p => [p.id, { ...p, count: 0, documents: [], saved: !p.inferred }]));
    for (const state of states.rows) for (const row of state.dados.rows || []) {
      const sourceName = service.personSourceName(row);
      if (!sourceName) continue;
      const matches = known.filter(p => p.source_name === sourceName && [p.document, ...(p.aliases || [])].some(d => service.compatiblePersonDocument(row.document, d)));
      const id = matches.length === 1 ? matches[0].id : crypto.createHash('sha256').update(sourceName + '|' + (row.document || '')).digest('hex');
      if (!list.has(id)) list.set(id, { id, source_name: sourceName, name: row.name || row.supplier || row.description || 'Sem identificação', document: row.document || '', documents: [], count: 0, saved: false });
      const person = list.get(id); person.count++;
      if(person.trade_name == null) person.trade_name = row.supplier || '';
      if(person.purpose == null) person.purpose = row.classification || '';
      if (!person.documents.includes(row.document || '')) person.documents.push(row.document || '');
    }
    res.json([...list.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
  }));
  router.post('/pessoas', csrf, run(async (req, res) => {
    await ensureSchema();
    const { bank, month } = selection(req);
    const name = String(req.body.name || '').trim();
    const sourceName = service.norm(req.body.source_name);
    const tradeName = String(req.body.trade_name || '').trim().slice(0,200);
    const purpose = String(req.body.purpose || '').trim().slice(0,200);
    const document = String(req.body.document || '').replace(/\D/g, '');
    if (!name || name.length > 200 || !sourceName || sourceName.length > 200 || ![11, 14].includes(document.length)) throw new Error('Informe nome e CPF completo (11 dígitos) ou CNPJ completo (14 dígitos).');
    const id = /^[a-f0-9]{64}$/.test(req.body.id || '') ? req.body.id : crypto.createHash('sha256').update(sourceName + '|' + document).digest('hex');
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['conciliacao:vinculos']);
      const previous = await db.query('SELECT id, source_name, name, document, aliases, trade_name, purpose FROM conciliacao_pessoas WHERE id=$1 FOR UPDATE', [id]);
      if (previous.rows[0] && previous.rows[0].source_name !== sourceName) throw new Error('Cadastro incompatível. Reabra a janela de edição.');
      const sourceDocument = String(req.body.source_document || '').replace(/\D/g, '');
      const aliases = [...new Set([...(previous.rows[0]?.aliases || []), previous.rows[0]?.document, !String(req.body.source_document || '').includes('*') && [11, 14].includes(sourceDocument.length) ? sourceDocument : null].filter(Boolean))];
      await db.query(`INSERT INTO conciliacao_pessoas (id,source_name,name,document,aliases,trade_name,purpose) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, document=EXCLUDED.document, aliases=EXCLUDED.aliases, trade_name=EXCLUDED.trade_name, purpose=EXCLUDED.purpose, atualizado_em=NOW()`, [id, sourceName, name, document, JSON.stringify(aliases), tradeName, purpose]);
      await db.query('COMMIT');
    } catch (e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
    res.json({ state: await readState(pool, bank, month), message: 'Cadastro salvo. Documento aplicado aos movimentos compatíveis de todos os bancos e meses, inclusive nas próximas importações.' });
  }));
  router.post('/importar', csrf, (req, res, next) => upload.single('extrato')(req, res, e => e ? res.status(400).json({ error: e.code === 'LIMIT_FILE_SIZE' ? 'O limite por arquivo é 15 MB.' : 'Não foi possível receber o extrato.' }) : next()), run(async (req, res) => {
    const { bank, month } = selection(req);
    if (!req.file) throw new Error('Selecione um arquivo.');
    const parsed = await service.parseStatement(req.file.buffer, req.file.originalname, bank, req.body.tipo, month);
    const originalsDir = path.join(uploadsDir, '.conciliacoes');
    await fs.promises.mkdir(originalsDir, { recursive: true });
    await fs.promises.writeFile(path.join(originalsDir, `${parsed.fileHash}.bin`), req.file.buffer, { flag: 'w' });
    const result = await mutate(bank, month, async (state, other, db) => {
      const merged = service.mergeImport(state, parsed);
      const list = await candidates(db, month);
      const blocked = await foreignLinks(db, bank, month);
      merged.state.rows = service.reconcile(merged.state.rows, list.filter(c => !blocked.has(String(c.id))), bank, other.rows);
      return merged;
    });
    res.json({ ...result, message: result.duplicate ? 'Este arquivo já foi importado.' : `${result.added} registro(s) acrescentado(s).` });
  }));
  router.post('/conciliar', csrf, run(async (req, res) => {
    const { bank, month } = selection(req);
    const list = await candidates(pool, month);
    const failed = await receiptEvidence(list);
    const result = await mutate(bank, month, async (state, other, db) => {
      const blocked = await foreignLinks(db, bank, month);
      state.rows = service.reconcile(service.enrichPix(state.rows, state.pix), list.filter(c => !blocked.has(String(c.id))), bank, other.rows);
      const invoices = await compras.list(db);
      for (const row of state.rows) {
        const match = compras.match(row, invoices, bank);
        if(match){row.purchaseId=match.invoice.id;row.purchasePartId=match.installment.id;row.supplier=match.invoice.supplier;row.document=match.invoice.document;row.classification='Compra de mercadorias para revenda';row.paymentType=match.part.method;row.paidAmount=Math.abs(row.amount);row.difference=0;row.status='Conciliado';row.manual=true;row.clientStatus=service.clientStatus(row);row.reason='NF de estoque: fornecedor e valor da parcela compatíveis';match.invoice.links.push({partId:match.installment.id,amount:Math.abs(row.amount)});}
      }
      if (failed) state.warnings = [...new Set([...state.warnings, `${failed} PDF(s) indisponível(is) ou sem leitura. Use revisão manual para conferir os comprovantes.`])];
      return { state };
    });
    res.json(result);
  }));
  router.post('/conta', csrf, run(async (req, res) => {
    const { bank, month } = selection(req);
    const number = String(req.body.number || '').trim();
    const branch = String(req.body.branch || '').trim();
    if (!/^[\d .-]{1,30}$/.test(number) || (branch && !/^[\d .-]{1,20}$/.test(branch))) throw new Error('Informe conta e agência válidas.');
    const result = await mutate(bank, month, async state => {
      if (state.account.number && state.account.number.replace(/\D/g, '') !== number.replace(/\D/g, '')) throw new Error('A conta informada difere da conta do extrato importado.');
      state.account = { ...state.account, number, branch, updatedBy: req.session.usuario.id, updatedAt: new Date().toISOString() };
      return { state };
    });
    res.json(result);
  }));
  router.get('/comprovantes', run(async (req, res) => {
    await ensureSchema();
    const { month } = selection(req);
    const list = await candidates(pool, month, String(req.query.busca || '').slice(0, 150));
    const links = await pool.query(`SELECT banco, mes, movimento->>'id' AS movimento_id, movimento->>'linkedId' AS lancamento_id
      FROM conciliacoes_bancarias CROSS JOIN LATERAL jsonb_array_elements(dados->'rows') AS movimentos(movimento)
      WHERE movimento->>'linkedId' IS NOT NULL`);
    res.json(list.map(c => ({ ...c,
      linkedTo: links.rows.filter(link => String(link.lancamento_id) === String(c.id)).map(link => ({ bank: link.banco, month: link.mes, movementId: link.movimento_id })),
      pdfUrl: c.anexo_pdf ? `/conciliacao-bancaria/comprovante/${c.id}` : null
    })));
  }));
  router.get('/notas-compras', run(async(req,res)=>{const list=await compras.list(pool);res.json(list)}));
  router.get('/original/:hash', run(async (req, res) => {
    await ensureSchema(); const { bank, month } = selection(req);
    const state = await readState(pool, bank, month);
    const source = state.sources.find(s => s.fileHash === req.params.hash);
    if (!source || !/^[a-f0-9]{64}$/.test(req.params.hash)) return res.status(404).send('Extrato original não encontrado.');
    const file = path.join(uploadsDir, '.conciliacoes', `${source.fileHash}.bin`);
    if (!fs.existsSync(file)) return res.status(404).send('Extrato original indisponível.');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(source.filename)}`);
    res.sendFile(path.resolve(file), { dotfiles: 'allow' });
  }));
  router.get('/comprovante/:id', run(async (req, res) => {
    if (!/^\d+$/.test(req.params.id)) throw new Error('Comprovante inválido.');
    const result = await pool.query('SELECT anexo_pdf FROM lancamentos WHERE id=$1', [req.params.id]);
    const filename = result.rows[0]?.anexo_pdf;
    if (!filename) return res.status(404).send('Comprovante não encontrado.');
    const file = path.join(uploadsDir, path.basename(filename));
    if (!fs.existsSync(file)) return res.status(404).send('PDF indisponível.');
    res.type('pdf'); res.setHeader('Content-Disposition', 'inline'); res.sendFile(path.resolve(file));
  }));
  router.post('/salvar/:id', csrf, run(async (req, res) => {
    const { bank, month } = selection(req);
    const result = await mutate(bank, month, async (state, other, db) => {
      const index = state.rows.findIndex(r => r.id === req.params.id);
      if (index < 0) throw new Error('Movimentação não encontrada.');
      let row = state.rows[index];
      if (req.body.onlyObservation) row = { ...row, observation: String(req.body.observation || '').slice(0, 2000) };
      else {
        const linkedId = req.body.linkedId;
        if(req.body.purchaseId && linkedId) throw new Error('Escolha comprovante de despesa ou NF de estoque.');
        if (linkedId) {
          if (!/^\d+$/.test(String(linkedId))) throw new Error('Lançamento inválido.');
          if (row.amount >= 0) throw new Error('Vincule comprovantes de despesas somente a saídas.');
          if ([...state.rows, ...other.rows].some(r => r.id !== row.id && String(r.linkedId) === String(linkedId))) throw new Error('Este lançamento já está vinculado a outra movimentação.');
          if ((await foreignLinks(db, bank, month)).has(String(linkedId))) throw new Error('Este lançamento já está vinculado em outro banco ou mês.');
          const list = await candidates(db, month, '', linkedId);
          if (!list.length) throw new Error('Lançamento não encontrado.');
          row = service.applyLink(row, list[0], true);
        } else row = { ...row, manual: true, linkedId: null, supplier: '', category: '', paymentType: '', paidAmount: null, difference: null };
        row.purchaseId = null; row.purchasePartId = null;
        if (req.body.purchaseId) {
          if(row.amount>=0)throw new Error('Vincule NF de compra somente a saídas.');
          const invoices=await compras.list(db),invoice=invoices.find(n=>n.id===req.body.purchaseId);
          const part=invoice?.plan?.parts.find(p=>p.method!=='Cartão'&&p.installments.some(i=>i.id===req.body.purchasePartId));
          const installment=part?.installments.find(i=>i.id===req.body.purchasePartId);
          if(!installment)throw new Error('Selecione uma parcela PIX/boleto válida. Compras no cartão são conferidas na fatura.');
          const used=invoice.links.filter(l=>!(l.bank===bank&&l.month===month&&l.movementId===row.id)&&l.partId===installment.id).reduce((s,l)=>s+l.amount,0);
          if(Math.abs(row.amount)>installment.amount-used)throw new Error('Este pagamento excede o saldo restante da parcela.');
          row.purchaseId=invoice.id;row.purchasePartId=installment.id;row.supplier=invoice.supplier;row.document=invoice.document;row.classification='Compra de mercadorias para revenda';row.paymentType=part.method;row.paidAmount=Math.abs(row.amount);row.difference=0;
        }
        const fields = { supplier: 200, document: 30, classification: 200, paymentType: 80, category: 200, observation: 2000 };
        for (const [key, max] of Object.entries(fields)) if (req.body[key] !== undefined) row[key] = String(req.body[key]).trim().slice(0, max);
        if (req.body.paidAmount !== undefined && req.body.paidAmount !== '') {
          row.paidAmount = service.money(req.body.paidAmount);
          if (row.paidAmount === null || row.paidAmount < 0) throw new Error('Valor pago inválido.');
          row.difference = Math.abs(row.amount) - row.paidAmount;
        }
        if (!['Conciliado', 'Revisado', 'Revisar', 'Não encontrado'].includes(req.body.status)) throw new Error('Status inválido.');
        row.status = req.body.status;
        row.internal = /^TRANSFERENCIA (RECEBIDA|ENVIADA)/.test(service.norm(row.classification));
        if (row.status === 'Conciliado' && row.amount < 0 && !row.internal && !row.paymentType) throw new Error('Informe o tipo de pagamento antes de concluir a saída.');
        if (row.status === 'Conciliado' && row.amount >= 0 && !row.classification) throw new Error('Informe a origem/finalidade antes de concluir a entrada.');
        row.manual = true;
        row.clientStatus = service.clientStatus(row);
        row.reviewedBy = req.session.usuario.id || req.session.usuario.nome;
        row.reviewedAt = new Date().toISOString();
      }
      row = service.applyPartnerRule(row);
      const before = state.rows[index];
      row.history = [...(before.history || []), { at: new Date().toISOString(), by: req.session.usuario.id || req.session.usuario.nome, before: Object.fromEntries(['linkedId','purchaseId','purchasePartId','document','classification','paymentType','status','observation','paidAmount'].map(k => [k, before[k] ?? null])) }];
      state.rows[index] = row;
      return { state };
    });
    res.json(result);
  }));
  router.get('/exportar', run(async (req, res) => {
    await ensureSchema(); const { bank, month } = selection(req);
    const state = await readState(pool, bank, month);
    if (!state.rows.length) throw new Error('Importe o extrato de Conta Corrente antes de exportar.');
    const filters = JSON.parse(String(req.query.filtros || '{}'));
    const rows = state.rows.filter(row => Object.entries(filters).every(([key, value]) => !value || String(key.startsWith('raw:') ? row.raw[key.slice(4)] ?? '' : key === 'supplier' ? row.supplier || row.name || '' : key === 'direction' ? row.amount < 0 ? 'Saída' : 'Entrada' : row[key] ?? '') === (value === '__cb_empty__' ? '' : String(value))));
    const wb = service.exportWorkbook(state, bank, month, rows);
    const name = `Extrato conciliado ${service.BANKS[bank]} ${month.split('-').reverse().join('-')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
    res.send(Buffer.from(await wb.xlsx.writeBuffer()));
  }));
  return router;
}
module.exports = { createRouter };
