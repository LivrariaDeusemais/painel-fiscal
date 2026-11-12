const { PDFParse } = require('pdf-parse');

const BRL = '[0-9.]+,[0-9]{2}';
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const amountInCents = value => Number(value.replace(/\D/g, ''));

function purchaseDate(day, month, dueDate, installment) {
  const due = new Date(dueDate + 'T12:00:00Z');
  const cycle = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() - Math.max(0, installment - 1), 1));
  const year = cycle.getUTCFullYear();
  const candidates = [year, year - 1, year + 1]
    .map(y => new Date(Date.UTC(y, Number(month) - 1, Number(day), 12)))
    .filter(d => d <= due && d.getUTCDate() === Number(day) && d.getUTCMonth() === Number(month) - 1);
  candidates.sort((a, b) => Math.abs(a - cycle) - Math.abs(b - cycle));
  return candidates[0]?.toISOString().slice(0, 10);
}

function movement(date, description, cents, parcel = '', merchant = '') {
  return { Data: date, 'Descrição': description.trim(), Valor: cents / 100, Parcela: parcel, Nome: merchant.trim() };
}

function parseCaixa(text, dueDate) {
  const section = text.split(/^Demonstrativo\s*$/im)[1];
  if (!section) return [];
  const rowPattern = new RegExp(`^(?:(\\d{2})/(\\d{2})\\s+)?(.+?)\\s+(${BRL})\\s*([CD])(?:\\t.*)?$`, 'i');
  let annualFee = false;
  const rows = [];
  for (const line of section.split('\n').map(line => line.trim())) {
    if (/^Valor total desta fatura\b/i.test(line)) break;
    if (/^ANUIDADE$/.test(line)) annualFee = true;
    if (/^(?:COMPRAS|Total final)/i.test(line)) annualFee = false;
    const match = line.match(rowPattern);
    if (!match) continue;
    const [, day, month, description, value, sign] = match;
    if (/^(?:TOTAL\b|OBRIGADO PELO PAGAMENTO|PAGAMENTO DA FATURA)/i.test(description)) continue;
    if (!day && !(annualFee && /^ANUIDADE\b/i.test(description))) continue;
    const cents = amountInCents(value);
    if (!cents) continue;
    const parcel = day && description.match(/\b(\d{1,2})\s+DE\s+(\d{1,2})\b/i);
    const date = day ? purchaseDate(day, month, dueDate, Number(parcel?.[1] || 1)) : dueDate;
    const merchant = parcel ? description.slice(0, parcel.index) : '';
    rows.push(movement(date, description, sign.toUpperCase() === 'C' ? -cents : cents, parcel ? parcel[1] + '/' + parcel[2] : '', merchant));
  }
  return rows;
}

function parseInter(text) {
  const section = text.split(/^Despesas da fatura\s*$/im)[1]?.split(/^Próxima fatura\s*$/im)[0];
  if (!section) return [];
  const rowPattern = new RegExp(`^(\\d{1,2})\\s+de\\s+([a-z]{3})\\.?\\s+(?:de\\s+)?(\\d{4})\\s+(.+?)\\s*\\t.*?([+-]?)\\s*R\\$\\s*(${BRL})\\s*$`, 'i');
  return section.split('\n').flatMap(line => {
    const match = line.trim().match(rowPattern);
    if (!match) return [];
    const [, day, month, year, description, sign, value] = match;
    if (/^(?:PAGTO|PGTO|PAGAMENTO)\b/i.test(description)) return [];
    const monthIndex = MONTHS.indexOf(month.toLowerCase()) + 1;
    const date = `${year}-${String(monthIndex).padStart(2, '0')}-${day.padStart(2, '0')}`;
    const parcel = description.match(/\(Parcela\s+(\d{1,2})\s+de\s+(\d{1,2})\)/i);
    return [movement(date, description, amountInCents(value) * (sign === '+' ? -1 : 1),
      parcel ? parcel[1] + '/' + parcel[2] : '', parcel ? description.slice(0, parcel.index) : '')];
  });
}

async function parseCardPdf(buffer, account, month) {
  if (!buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('Envie um arquivo PDF válido.');
  const parser = new PDFParse({ data: buffer });
  let text;
  try {
    text = (await parser.getText()).text;
  } catch {
    throw new Error('Não foi possível ler o PDF. Baixe a fatura original do banco, sem senha.');
  } finally {
    await parser.destroy();
  }

  const caixa = /^Demonstrativo\s*$/im.test(text) && /CART[ÕO]ES CAIXA/i.test(text);
  const inter = /^Despesas da fatura\s*$/im.test(text) && /\b(?:Banco Inter|Conta Inter|Inter Loop)\b/i.test(text);
  if (!caixa && !inter) throw new Error('Formato de fatura em PDF não reconhecido. Use a fatura original da Caixa ou do Inter com texto selecionável.');
  if (inter !== (account === 'inter-cartao')) throw new Error('O banco da fatura não corresponde ao cartão selecionado.');
  const prefix = caixa ? text.match(/^([0-9]{4})[. ](?:X{4}|\*{4})[. ](?:X{4}|\*{4})/im)?.[1] : undefined;
  if ((prefix?.startsWith('4') && account !== 'caixa-visa') || (prefix === '6509' && account !== 'caixa-elo')) {
    throw new Error('A bandeira da fatura não corresponde ao cartão selecionado.');
  }
  const due = text.match(/^(?:Data de )?Vencimento[ \t]*\n[ \t]*(\d{2})\/(\d{2})\/(\d{4})/im);
  if (!due) throw new Error('Não foi possível identificar o vencimento no PDF da fatura.');
  const dueDate = `${due[3]}-${due[2]}-${due[1]}`;
  if (!dueDate.startsWith(month + '-')) throw new Error('Selecione o mês de vencimento indicado na fatura.');
  const total = text.match(new RegExp(`^Valor total desta fatura\\s*\\n\\s*R\\$\\s*(${BRL})`, 'im'))
    || text.match(new RegExp(`^Despesas do mês[ \\t]+R\\$[ \\t]*(${BRL})`, 'im'));
  const rows = caixa ? parseCaixa(text, dueDate) : parseInter(text);
  const sum = rows.reduce((net, row) => net + Math.round(row.Valor * 100), 0);
  if (!rows.length || !total || sum !== amountInCents(total[1])) {
    throw new Error('Os lançamentos lidos no PDF não fecham com o total informado na fatura. Confira o arquivo antes de importar.');
  }
  return rows;
}

module.exports = { parseCardPdf };
