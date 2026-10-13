const crypto = require('crypto');
const ExcelJS = require('exceljs');
const iconv = require('iconv-lite');
const { parseString } = require('fast-csv');

const BANKS = { inter: 'Banco Inter', caixa: 'Caixa Econômica Federal' };
const norm = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const digits = v => String(v ?? '').replace(/\D/g, '');
const hash = v => crypto.createHash('sha256').update(v).digest('hex');
function document(v) {
  if (String(v || '').includes('*')) return String(v);
  const d = digits(v);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return String(v ?? '');
}
function money(v) {
  if (typeof v === 'number') return Math.round(v * 100);
  let s = String(v ?? '').replace(/R\$|\s|\u00a0/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
function date(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v ?? '');
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  const iso = s.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  const result = br ? `${br[3]}-${br[2]}-${br[1]}` : iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : '';
  const parsed = result && new Date(`${result}T12:00:00Z`);
  return parsed && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === result ? result : '';
}
function field(row, ...keys) {
  for (const key of keys) {
    const found = Object.keys(row).find(k => norm(k) === norm(key));
    if (found !== undefined) return row[found];
  }
  return '';
}
function decode(buffer) {
  const utf = buffer.toString('utf8');
  return utf.includes('\ufffd') ? iconv.decode(buffer, 'win1252') : utf.replace(/^\uFEFF/, '');
}
function cellValue(cell) {
  const v = cell.value;
  if (v && typeof v === 'object' && !(v instanceof Date)) return v.result ?? v.text ?? (v.richText || []).map(x => x.text).join('');
  return v ?? '';
}
async function parseStatement(buffer, filename, bank, type, month) {
  if (!BANKS[bank] || !['corrente', 'pix'].includes(type) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Selecione banco, mês e tipo de extrato válidos.');
  const result = { columns: [], rows: [], account: {}, warnings: [], fileHash: hash(buffer), filename, type };
  let tables = [];
  if (/\.xlsx$/i.test(filename)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    for (const ws of wb.worksheets) {
      const values = [];
      ws.eachRow(row => { values.push(row.values.slice(1).map((_, i) => cellValue(row.getCell(i + 1)))); });
      tables.push(values);
    }
  } else if (/\.csv$/i.test(filename)) {
    tables = [await new Promise((resolve, reject) => {
      const rows = [];
      parseString(decode(buffer), { delimiter: ';', headers: false, ignoreEmpty: true }).on('data', r => rows.push(r)).on('error', reject).on('end', () => resolve(rows));
    })];
  } else if (/<OFX>/i.test(decode(buffer))) {
    if (type === 'pix') throw new Error('Este OFX é de Conta Corrente. Selecione o tipo correto.');
    const text = decode(buffer);
    const get = (s, key) => (s.match(new RegExp(`<${key}>([^<\\r\\n]+)`, 'i')) || [])[1]?.trim() || '';
    const bankId = get(text, 'BANKID').replace(/^0+/, '');
    if (bankId && bankId !== (bank === 'inter' ? '77' : '104')) throw new Error('O banco do OFX não corresponde ao banco selecionado.');
    result.account = { bankId: get(text, 'BANKID'), branch: get(text, 'BRANCHID'), number: get(text, 'ACCTID'), closingBalance: money(get(text, 'BALAMT')) };
    result.columns = ['Data', 'Tipo OFX', 'Valor', 'Histórico', 'Nome', 'FITID', 'Documento', 'Saldo'];
    result.warnings.push('O OFX não informa saldo por movimentação; a coluna Saldo será preenchida quando houver Excel/CSV complementar.');
    for (const block of text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || []) {
      const raw = { Data: date(get(block, 'DTPOSTED')), 'Tipo OFX': get(block, 'TRNTYPE'), Valor: Number(get(block, 'TRNAMT')), Histórico: get(block, 'MEMO'), Nome: get(block, 'NAME'), FITID: get(block, 'FITID'), Documento: get(block, 'CHECKNUM') };
      const mapped = new Set(['DTPOSTED', 'TRNTYPE', 'TRNAMT', 'MEMO', 'NAME', 'FITID', 'CHECKNUM']);
      for (const match of block.matchAll(/<([A-Z0-9]+)>([^<\r\n]+)/gi)) {
        if (!mapped.has(match[1])) raw[match[1] === 'DTAVAIL' ? 'Data Disponível OFX' : match[1] === 'REFNUM' ? 'Referência OFX' : match[1]] = match[2].trim();
      }
      result.columns = [...new Set([...result.columns, ...Object.keys(raw)])];
      result.rows.push(toMovement(raw, type));
    }
  } else throw new Error('Formato não suportado. Envie XLSX, CSV ou OFX.');
  if (tables.length) {
    let found = false;
    for (const table of tables) {
      const headerIndex = table.findIndex(r => r.some(v => /^DATA( LANCAMENTO| MOVIMENTO)?$/.test(norm(v))) && r.some(v => ['VALOR', 'VALOR LANCAMENTO'].includes(norm(v))));
      if (headerIndex < 0) continue;
      const headers = table[headerIndex].map(v => String(v || '').trim());
      const isPix = headers.some(h => norm(h) === 'TIPO DE PIX');
      if (isPix !== (type === 'pix')) continue;
      const preamble = norm(table.slice(0, headerIndex).map(r => r.join(' ')).join(' '));
      const caixaLayout = headers.some(h => norm(h) === 'DATA MOVIMENTO') && headers.some(h => norm(h) === 'NOME RAZAO SOCIAL');
      const detectedBank = preamble.includes('BANCO INTER') ? 'inter' : preamble.includes('CAIXA ECONOMICA') || (type === 'corrente' && caixaLayout) ? 'caixa' : '';
      if (detectedBank && detectedBank !== bank) throw new Error('O banco do arquivo não corresponde ao banco selecionado.');
      found = true;
      const counts = {};
      const names = headers.map((h, i) => { const base = h || `Coluna ${i + 1}`; counts[base] = (counts[base] || 0) + 1; return counts[base] === 1 ? base : `${base} (${counts[base]})`; });
      for (const row of table.slice(0, headerIndex)) {
        if (norm(row[0]) === 'CONTA') result.account.number = String(row[1] ?? '');
        const title = String(row[0] ?? '').match(/CORRENTE:\s*(\d+)/i);
        if (title) result.account.number = title[1];
        if (norm(row[0]) === 'SALDO') result.account.closingBalance = money(row[1]);
      }
      result.columns = [...new Set([...result.columns, ...names])];
      for (const values of table.slice(headerIndex + 1)) {
        if (values.every(v => v === '' || v === null || v === undefined)) continue;
        const raw = Object.fromEntries(names.map((h, i) => [h, values[i] instanceof Date ? date(values[i]) : values[i] ?? '']));
        if (norm(field(raw, 'Histórico', 'Descrição')).startsWith('SALDO')) continue;
        const movement = toMovement(raw, type);
        if (!movement.date || movement.amount === null) throw new Error('Há uma linha sem data ou valor válido. Confira o arquivo original.');
        result.rows.push(movement);
      }
    }
    if (!found) throw new Error(`Não foi encontrada uma tabela do tipo ${type === 'pix' ? 'PIX' : 'Conta Corrente'} neste arquivo.`);
  }
  const outside = result.rows.filter(r => r.date.slice(0, 7) !== month).length;
  result.rows = result.rows.filter(r => r.date.slice(0, 7) === month);
  if (outside) result.warnings.push(`${outside} movimentação(ões) fora do mês selecionado não foram importadas.`);
  if (!result.rows.length) throw new Error('O arquivo não possui movimentações no mês selecionado.');
  if (type === 'pix') {
    const invalid = result.rows.filter(r => r.pixSituation && !['EFETIVADA', 'CONCLUIDA', 'CONCLUIDO', 'REALIZADO', 'REALIZADA'].includes(norm(r.pixSituation))).length;
    result.rows = result.rows.filter(r => !r.pixSituation || ['EFETIVADA', 'CONCLUIDA', 'CONCLUIDO', 'REALIZADO', 'REALIZADA'].includes(norm(r.pixSituation)));
    if (invalid) result.warnings.push(`${invalid} PIX não efetivado(s) ignorado(s).`);
  }
  const repeated = result.rows.map(r => r.fitid).filter(Boolean);
  if (new Set(repeated).size < repeated.length) result.warnings.push('O OFX repete identificadores: data, valor e descrição também serão usados na conferência.');
  return result;
}
function toMovement(raw, type) {
  let amount = money(field(raw, 'Valor Lançamento', 'Valor'));
  if (type === 'pix' && amount !== null && norm(field(raw, 'Tipo de Pix')) === 'ENVIADO') amount = -Math.abs(amount);
  return {
    id: crypto.randomUUID(), raw,
    date: date(field(raw, 'Data Movimento', 'Data Lançamento', 'Data')),
    postedDate: date(field(raw, 'Data Lançamento', 'Data')),
    amount, balance: money(field(raw, 'Saldo')),
    description: String(field(raw, 'Histórico', 'Descrição')),
    name: String(field(raw, 'Nome/Razão Social', 'Remetente/Destinatario', 'Nome', 'Instituição')),
    document: String(field(raw, 'CPF/CNPJ', 'CNPJ/CPF', 'CNPJ')),
    reference: String(field(raw, 'Documento')),
    fitid: String(field(raw, 'FITID')),
    pixId: type === 'pix' ? String(field(raw, 'Id')) : '',
    txid: String(field(raw, 'TXID')), pixSituation: String(field(raw, 'Situacao')),
    hour: String(field(raw, 'Hora')), observation: '', status: 'Não encontrado', sourceType: type
  };
}
function similar(a, b) {
  a = norm(a); b = norm(b);
  if (!a || !b) return 0;
  if (a === b || (Math.min(a.length, b.length) > 10 && (a.includes(b) || b.includes(a)))) return 1;
  const ignored = new Set(['LTDA', 'SA', 'DE', 'DO', 'DA', 'E', 'PIX', 'RECEBIDO', 'ENVIADO', 'CP']);
  const x = a.split(' ').filter(t => t.length > 2 && !ignored.has(t));
  const y = b.split(' ').filter(t => t.length > 2 && !ignored.has(t));
  return x.length && y.length ? x.filter(t => y.includes(t)).length / Math.max(x.length, y.length) : 0;
}
function enrichPix(rows, pixRows) {
  const used = new Set();
  return rows.map(row => {
    const candidates = pixRows.filter(p => !used.has(p.id) && p.amount === row.amount && p.date === row.date && (similar(p.name, row.name || row.description) >= .65 || (row.reference.length === 6 && p.hour.replace(/:/g, '').slice(0, 4) === row.reference.slice(-4))));
    if (candidates.length === 1) {
      const p = candidates[0]; used.add(p.id);
      return { ...row, pixId: p.pixId, txid: p.txid, hour: p.hour, pixRaw: p.raw, name: row.name || p.name };
    }
    return { ...row, pixId: '', txid: '', pixRaw: null, hour: '' };
  });
}
const MARKETPLACES = [
  { names: ['AIBR'], cnpj: '32246162000109', label: 'Recebíveis AliExpress' },
  { names: ['HUB INSTITUICAO'], cnpj: '13884775000119', label: 'Recebíveis Magazine Luiza' },
  { names: ['AMAZON'], cnpj: '15436940000103', label: 'Recebíveis Amazon' },
  { names: ['PIPO BRASIL'], cnpj: '46683038000107', label: 'Recebíveis TikTok' },
  { names: ['MAREE'], cnpj: '38372267000182', label: 'Recebíveis Shopee' },
  { names: ['MERCADO PAGO'], cnpj: '', label: 'Recebíveis Mercado Livre' }
];
function origin(row, bank, otherRows = []) {
  const partner = partnerClassification(row);
  if (partner) return { label: partner };
  const text = norm(`${row.name} ${row.description}`);
  const own = digits(row.document) === '18862388000103' || text.includes('DEUS E MAIS');
  if (own) {
    const other = bank === 'caixa' ? 'Inter' : 'Caixa';
    const counterpart = otherRows.filter(r => r.date === row.date && r.amount === -row.amount && (digits(r.document) === '18862388000103' || norm(`${r.name} ${r.description}`).includes('DEUS E MAIS')));
    const pixInter = bank === 'caixa' && row.amount > 0 && row.pixId?.startsWith('E00416968');
    const descriptionCaixa = bank === 'inter' && /CP\s*00360305/.test(text);
    if (counterpart.length === 1 || pixInter || descriptionCaixa) return { label: `Transferência ${row.amount > 0 ? 'recebida ' + (other === 'Inter' ? 'do Inter' : 'da Caixa') : 'enviada ' + (other === 'Inter' ? 'ao Inter' : 'à Caixa')}`, internal: true };
    // Prefixo observado nos recebimentos identificados como Mercado Pago pelo usuário em agosto.
    if (row.amount > 0 && row.pixId?.startsWith('E10573521')) return { label: 'Recebíveis Mercado Livre' };
    return { label: '', review: true };
  }
  if (row.amount > 0) {
    const match = MARKETPLACES.find(m => (m.cnpj && digits(row.document) === m.cnpj) || m.names.some(n => text.includes(n)));
    if (match) return { label: match.label, document: match.cnpj };
  }
  return { label: '' };
}
function partnerClassification(row) {
  const text = norm(`${row.name || row.supplier || ''} ${row.description || ''}`);
  if (!/\bGENIVALDO SESTARI\b/.test(text)) return '';
  return row.amount < 0 ? 'Retirada Sócios - Distribuição' : row.amount > 0 ? 'Inserção de Capital pelo Sócio' : '';
}
function applyPartnerRule(row) {
  const classification = partnerClassification(row);
  return classification ? { ...row, classification } : row;
}
function scoreCandidate(row, candidate) {
  const amount = Math.round(Number(candidate.valor) * 100);
  const exactAmount = Math.abs(row.amount) === amount;
  const doc = digits(row.document), targetDoc = digits(candidate.cnpj_cpf);
  const exactDoc = [11, 14].includes(doc.length) && doc === targetDoc;
  const name = similar(row.name || row.description, candidate.fornecedor);
  const code = String(candidate.codigo_pagamento || '').replace(/\s/g, '');
  const proof = String(candidate.receiptText || '').replace(/\s/g, '');
  const exactPix = (code.length >= 20 && [row.pixId, row.txid].filter(Boolean).includes(code)) || [row.pixId, row.txid].some(v => v && v.length >= 20 && proof.includes(v));
  const day = date(candidate.data_pagamento || candidate.data_despesa);
  const sameDay = day === row.date;
  const masked = String(row.document).includes('*') && targetDoc.length === 11 && digits(row.document).length === 6 && targetDoc.slice(3, 9) === digits(row.document);
  const score = (exactAmount ? 40 : 0) + (exactPix ? 100 : 0) + (exactDoc ? 35 : masked ? 15 : 0) + Math.round(name * 35) + (sameDay ? 15 : 0);
  const conflict = ([11, 14].includes(doc.length) && [11, 14].includes(targetDoc.length) && doc !== targetDoc) || (String(row.document).includes('*') && targetDoc.length === 11 && doc.length === 6 && !masked);
  return { id: candidate.id, score, exactAmount, exactPix, conflict, safe: exactAmount && !conflict && (exactPix || ((exactDoc || name >= .85) && sameDay)), reason: [exactAmount ? 'Valor idêntico' : 'Valor diferente', exactPix ? 'ID PIX idêntico' : '', exactDoc ? 'CPF/CNPJ idêntico' : masked ? 'CPF parcial compatível' : '', name >= .65 ? 'Nome compatível' : '', sameDay ? 'Data compatível (data do lançamento)' : 'Data diferente'].filter(Boolean).join(' · ') };
}
function clientStatus(row) {
  if (row.amount >= 0) return 'Não somar Cliente';
  if (row.internal && !row.paymentType) return 'Não somar Cliente';
  if (row.status !== 'Conciliado') return 'Pendente';
  return norm(row.paymentType) === 'DOP' ? 'Somar Conta Cliente' : 'Não somar Cliente';
}
function applyLink(row, candidate, manual = false) {
  const doc = String(row.document || '');
  let complete = digits(candidate.cnpj_cpf);
  if (![11, 14].includes(complete.length) && doc.includes('*') && digits(doc).length === 6) {
    const matches = (candidate.receiptDocuments || []).filter(d => d.length === 11 && d.slice(3, 9) === digits(doc));
    if (matches.length === 1) complete = matches[0];
  }
  const canComplete = !doc || (doc.includes('*') && complete.length === 11 && complete.slice(3, 9) === digits(doc)) || (!doc.includes('*') && digits(doc).length >= 6 && digits(doc).length < 11 && complete.includes(digits(doc)));
  const out = { ...row, linkedId: candidate.id, proofAvailable: !!candidate.anexo_pdf, supplier: candidate.fornecedor || '', paymentType: candidate.tipo_pagamento || '', category: [candidate.categoria_principal || candidate.categoria, candidate.subcategoria].filter(Boolean).join(' / '), paidAmount: Math.round(Number(candidate.valor) * 100), document: canComplete && [11, 14].includes(complete.length) ? complete : doc, status: 'Conciliado', manual };
  out.difference = Math.abs(row.amount) - out.paidAmount;
  out.clientStatus = clientStatus(out);
  return out;
}
function reconcile(rows, candidates, bank, otherRows = []) {
  const used = new Set(rows.filter(r => r.manual && r.linkedId).map(r => String(r.linkedId)));
  const rankings = new Map();
  for (const row of rows.filter(r => !r.manual && r.amount < 0)) rankings.set(row.id, candidates.map(c => scoreCandidate(row, c)).filter(c => c.score >= 55).sort((a, b) => b.score - a.score));
  const demand = new Map();
  for (const ranking of rankings.values()) if (ranking[0]?.safe && (!ranking[1] || ranking[0].score - ranking[1].score >= 15)) demand.set(String(ranking[0].id), (demand.get(String(ranking[0].id)) || 0) + 1);
  return rows.map(original => {
    if (original.manual) return { ...applyPartnerRule(original), clientStatus: clientStatus(original) };
    let row = { ...original, linkedId: null, supplier: '', category: '', paymentType: '', paidAmount: null, difference: null, classification: '', internal: false, status: 'Não encontrado', reason: '' };
    const identified = origin(row, bank, otherRows);
    row.classification = identified.label;
    row.internal = !!identified.internal;
    if (identified.document && !row.document) row.document = identified.document;
    if (identified.label) { row.status = 'Conciliado'; row.reason = 'Origem identificada pelas regras de recebíveis/transferências'; }
    if (identified.review) { row.status = 'Revisar'; row.reason = 'Titular próprio: confirmar banco de origem/destino'; }
    if (row.amount < 0 && !row.internal) {
      const ranking = rankings.get(row.id) || [];
      row.suggestions = ranking.slice(0, 5);
      const best = ranking[0];
      if (best) {
        row.status = 'Revisar'; row.reason = best.reason;
        if (best.safe && !used.has(String(best.id)) && demand.get(String(best.id)) === 1 && (!ranking[1] || best.score - ranking[1].score >= 15)) {
          row = applyLink(row, candidates.find(c => String(c.id) === String(best.id)));
          used.add(String(best.id));
        }
      }
    }
    row.clientStatus = clientStatus(row);
    return row;
  });
}
function mergeImport(state, parsed) {
  state = { rows: [], pix: [], sources: [], columns: [], account: {}, warnings: [], ...state };
  if (state.sources.some(s => s.fileHash === parsed.fileHash && s.type === parsed.type)) return { state, added: 0, duplicate: true };
  if (state.account.number && parsed.account.number && digits(state.account.number) !== digits(parsed.account.number)) throw new Error('O arquivo pertence a outra conta. Este período já possui uma conta importada para o banco.');
  const target = parsed.type === 'pix' ? state.pix : state.rows;
  const used = new Set();
  let added = 0;
  for (const incoming of parsed.rows) {
    const matches = target.filter(r => !used.has(r.id) && (r.date === incoming.date || (parsed.type === 'corrente' && (r.postedDate === incoming.date || incoming.postedDate === r.date))) && r.amount === incoming.amount && (parsed.type === 'pix' ? r.pixId === incoming.pixId && !!r.pixId : (norm(r.description) === norm(incoming.description) && (!r.reference || !incoming.reference || r.reference === incoming.reference))));
    if (matches.length) {
      const existing = matches[0]; used.add(existing.id);
      const useMovementDate = field(incoming.raw, 'Data Movimento') && !field(existing.raw, 'Data Movimento');
      existing.raw = { ...incoming.raw, ...existing.raw };
      existing.name ||= incoming.name;
      existing.document ||= incoming.document;
      existing.balance ??= incoming.balance;
      if (useMovementDate) {
        existing.date = incoming.date;
        existing.postedDate = incoming.postedDate;
      }
    } else { target.push(incoming); used.add(incoming.id); added++; }
  }
  if (parsed.type === 'corrente') state.columns = [...new Set([...state.columns, ...parsed.columns])];
  state.account = { ...state.account, ...parsed.account };
  state.warnings = [...new Set([...state.warnings, ...parsed.warnings])];
  state.sources.push({ filename: parsed.filename, fileHash: parsed.fileHash, type: parsed.type, count: parsed.rows.length, importedAt: new Date().toISOString() });
  state.rows = enrichPix(state.rows, state.pix).sort((a, b) => a.date.localeCompare(b.date));
  if (state.rows.every(r => r.balance !== null)) state.warnings = state.warnings.filter(w => !w.startsWith('O OFX não informa saldo por movimentação'));
  if (state.account.closingBalance != null && state.rows.length && state.rows.at(-1).balance != null && state.account.closingBalance !== state.rows.at(-1).balance) state.warnings = [...new Set([...state.warnings, 'O saldo informado no cabeçalho diverge do saldo da última movimentação. Confira o arquivo original.'])];
  return { state, added, duplicate: false };
}
const extraColumns = ['Fornecedor', 'CPF/CNPJ conciliado', 'Origem / Finalidade', 'Tipo de Pagamento', 'Categoria-Subcategoria', 'Valor pago Real', 'Diferença Valor', 'Tipo de movimentação', 'Conta Cliente', 'Status da Conciliação', 'Observação'];
function rawValue(row, key) {
  const value = row.raw[key] ?? '';
  return /^(CPF|CNPJ)/.test(norm(key)) ? document(row.document || value) : value;
}
function extraValues(row) {
  return [row.supplier || row.name || '', document(row.document), row.classification || '', row.paymentType || '', row.category || '', row.paidAmount == null ? '' : row.paidAmount / 100, row.difference == null ? '' : row.difference / 100, row.amount < 0 ? 'Saída' : 'Entrada', row.clientStatus, row.status, row.observation || ''];
}
function exportWorkbook(state, bank, month, rows = state.rows) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'PlennaTec';
  const ws = wb.addWorksheet('Conciliação');
  const columns = [...state.columns, ...extraColumns];
  ws.columns = columns.map(c => ({ width: /NOME|FORNECEDOR|HISTORICO|DESCRICAO|OBSERVACAO|ORIGEM|CATEGORIA/.test(norm(c)) ? 42 : 24 }));
  const last = ws.getColumn(columns.length).letter;
  ws.mergeCells(`A1:${last}2`);
  ws.getCell('A1').value = `Extrato conciliado — ${BANKS[bank]} — ${month.split('-').reverse().join('/')}`;
  ws.getCell('A1').font = { name: 'Aptos', bold: true, size: 20, color: { argb: 'FFFFFFFF' } };
  ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } };
  ws.getCell('A1').alignment = { vertical: 'middle', wrapText: true };
  ws.getRow(1).height = 30; ws.getRow(2).height = 25;
  ws.mergeCells(`A3:${last}3`);
  ws.getCell('A3').value = `Agência: ${state.account.branch || 'Não informada'} | Conta: ${state.account.number || 'Não informada no arquivo'} | Período por data da movimentação: ${month}`;
  ws.mergeCells(`A4:${last}4`);
  const selected = rows.filter(r => r.clientStatus === 'Somar Conta Cliente').reduce((s, r) => s + Math.abs(r.amount), 0);
  ws.getCell('A4').value = `${rows.length} movimentações | Somar Conta Cliente: ${(selected / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Revisar/Não encontrado: ${rows.filter(r => r.status !== 'Conciliado').length}`;
  ws.mergeCells(`A5:${last}5`); ws.getCell('A5').value = state.warnings.join(' | ') || 'Colunas originais preservadas. Diferença = valor absoluto do extrato menos valor do lançamento vinculado.';
  ws.getCell('A5').alignment = { wrapText: true }; ws.getRow(5).height = 34;
  ws.getRow(7).values = columns;
  ws.getRow(7).height = 34;
  ws.getRow(7).eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF008F48' } }; c.alignment = { wrapText: true, vertical: 'middle' }; });
  rows.forEach((row, i) => {
    const raw = state.columns.map(key => {
      const v = rawValue(row, key);
      if (['VALOR', 'VALOR LANCAMENTO', 'SALDO'].includes(norm(key)) && v !== '') return money(v) / 100;
      if (norm(key).startsWith('DATA') && date(v)) return new Date(`${date(v)}T12:00:00Z`);
      return v;
    });
    const line = ws.addRow([...raw, ...extraValues(row)]); line.height = 32;
    line.eachCell({ includeEmpty: true }, (c, j) => {
      c.font = { name: 'Aptos', size: 11, color: { argb: 'FF172033' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: row.status === 'Conciliado' ? (i % 2 ? 'FFF0FDF4' : 'FFFFFFFF') : 'FFFFF8E7' } };
      c.alignment = { vertical: 'middle', wrapText: true };
      if (c.value instanceof Date) c.numFmt = 'dd/mm/yyyy';
      else if (['VALOR', 'VALOR LANCAMENTO', 'SALDO', 'VALOR PAGO REAL', 'DIFERENCA VALOR'].includes(norm(columns[j - 1]))) c.numFmt = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
      if (columns[j - 1] === 'Diferença Valor' && row.difference) c.font.color = { argb: 'FFB91C1C' };
    });
  });
  ws.views = [{ state: 'frozen', ySplit: 7, xSplit: 1, showGridLines: false }];
  ws.autoFilter = `A7:${last}${Math.max(7, 7 + rows.length)}`;
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:7' };
  return wb;
}
module.exports = { BANKS, norm, money, date, document, parseStatement, mergeImport, reconcile, applyLink, clientStatus, scoreCandidate, origin, applyPartnerRule, enrichPix, extraColumns, extraValues, rawValue, exportWorkbook };
