const { parseStringPromise } = require('xml2js');
const crypto = require('crypto');
const { money, norm, compatiblePersonDocument } = require('./conciliacao-bancaria');
const noPayment=p=>p.method==='Bonificação'||p.condition==='Bonificação';
const unscheduled=p=>noPayment(p)||p.method==='À Combinar'||p.condition==='Consignação';
const CARDS = ['Caixa VISA', 'Caixa ELO', 'Inter'];
async function parseInvoice(buffer) {
  const text = buffer.toString('utf8');
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('XML com entidades externas não é permitido.');
  const xml = await parseStringPromise(text, { explicitArray: false, tagNameProcessors: [s => s.split(':').pop()] });
  const nfe = xml.nfeProc?.NFe || xml.NFe;
  const info = nfe?.infNFe;
  if (!info) throw new Error('Envie o XML de uma NF-e de compra.');
  const key = String(info.$?.Id || '').replace(/^NFe/, '');
  const total = money(info.total?.ICMSTot?.vNF);
  if (!/^\d{44}$/.test(key) || !info.emit?.xNome || !info.ide?.nNF || !(total > 0)) throw new Error('XML incompleto: confira chave, fornecedor, número e valor da NF-e.');
  const array = v => v ? (Array.isArray(v) ? v : [v]) : [];
  return { key, supplier: String(info.emit.xNome), document: String(info.emit.CNPJ || info.emit.CPF || ''), number: String(info.ide.nNF), series: String(info.ide.serie || ''), date: String(info.ide.dhEmi || info.ide.dEmi || '').slice(0, 10), total, recipient: String(info.dest?.CNPJ || info.dest?.CPF || ''), items: array(info.det).map(d => ({ code: d.prod?.cProd, name: d.prod?.xProd, quantity: d.prod?.qCom, unit: d.prod?.uCom, total: d.prod?.vProd })), installments: array(info.cobr?.dup).map(d => ({ number: d.nDup, date: d.dVenc, amount: money(d.vDup) })) };
}
function validatePlan(input, total) {
  const credit = money(input.credit || 0);
  if (credit == null || credit < 0 || credit > total) throw new Error('Abatimento inválido.');
  const parts = (input.parts || []).map((p, i) => {
    const amount = money(p.amount), count = Number(p.count || 1);
    if (!['PIX', 'Boleto', 'Cartão', 'Bonificação', 'À Combinar'].includes(p.method) || !(amount > 0) || !Number.isInteger(count) || count < 1 || count > 60) throw new Error('Informe forma, valor e quantidade de parcelas válidos.');
    if (!unscheduled(p) && p.method === 'Cartão' && !CARDS.includes(p.card)) throw new Error('Selecione Caixa VISA, Caixa ELO ou Inter.');
    if (!['Antecipado', 'À vista', 'A prazo', 'Parcelado', 'Consignação', 'Bonificação'].includes(p.condition)) throw new Error('Selecione a condição do pagamento.');
    if(unscheduled(p))return {id:String(p.id||crypto.randomUUID()).slice(0,80),method:p.method,condition:p.condition,amount,count:0,card:'',bank:'',installments:[]};
    const dates = p.dates || [];
    if (dates.length !== count || dates.some(d => !/^\d{4}-\d{2}-\d{2}$/.test(d) || new Date(d + 'T12:00:00Z').toISOString().slice(0,10) !== d)) throw new Error('Informe os vencimentos de todas as parcelas.');
    const amounts = p.amounts?.length ? p.amounts.map(money) : Array.from({length:count}, (_, n) => Math.floor(amount/count) + (n < amount%count ? 1 : 0));
    if (amounts.length !== count || amounts.some(v => !(v > 0)) || amounts.reduce((a,b)=>a+b,0) !== amount) throw new Error('A soma das parcelas deve corresponder ao valor da parte.');
    const id = String(p.id || crypto.randomUUID()).slice(0,80);
    return { id, method: p.method, card: p.method === 'Cartão' ? p.card : '', bank: ['inter','caixa'].includes(p.bank) ? p.bank : '', condition: p.condition, amount, count, installments: dates.map((date,n)=>({ id: id+':'+n, date, amount:amounts[n] })) };
  });
  if (parts.length > 30 || credit + parts.reduce((s,p)=>s+p.amount,0) !== total) throw new Error('Pagamentos + abatimento devem corresponder ao total da NF.');
  return { credit, creditNote: String(input.creditNote || '').slice(0,2000), parts };
}
async function ensure(db) { await db.query(`CREATE TABLE IF NOT EXISTS conciliacoes_bancarias (banco TEXT NOT NULL, mes TEXT NOT NULL, dados JSONB NOT NULL, atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (banco,mes)); CREATE TABLE IF NOT EXISTS compras_estoque_nf (id TEXT PRIMARY KEY, chave TEXT UNIQUE NOT NULL, dados JSONB NOT NULL, criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW())`); }
async function list(db) {
  await ensure(db);
  const invoices = await db.query('SELECT id, dados FROM compras_estoque_nf ORDER BY criado_em DESC');
  const states = await db.query('SELECT banco, mes, dados FROM conciliacoes_bancarias');
  return invoices.rows.map(n => {
    const links = states.rows.flatMap(s => (s.dados.rows||[]).filter(r=>r.purchaseId===n.id).map(r=>({bank:s.banco,month:s.mes,movementId:r.id,amount:Math.abs(r.amount),partId:r.purchasePartId,date:r.date})));
    const bonus=(n.dados.plan?.parts||[]).filter(noPayment).reduce((sum,p)=>sum+p.amount,0);
    const deferred=(n.dados.plan?.parts||[]).filter(p=>unscheduled(p)&&!noPayment(p)).reduce((sum,p)=>sum+p.amount,0);
    const paid = links.reduce((s,l)=>s+l.amount,0), credit=n.dados.plan?.credit||0;
    const cardTotal=(n.dados.plan?.parts||[]).filter(p=>p.method==='Cartão'&&!unscheduled(p)).reduce((s,p)=>s+p.amount,0);
    const cashTotal=(n.dados.plan?.parts||[]).filter(p=>p.method!=='Cartão'&&!unscheduled(p)).reduce((s,p)=>s+p.amount,0);
    return { id:n.id,...n.dados,links,paid,remaining:Math.max(0,n.dados.total-credit-bonus-paid),bonus,deferred,cardTotal,cashTotal,status:bonus>0&&bonus+credit>=n.dados.total?'Bonificação — sem pagamento':paid+credit+bonus>=n.dados.total?'Conciliada':deferred?(paid?'Parcialmente paga — saldo a definir':'Pagamento a definir / consignação'):paid?'Parcialmente conciliada':cardTotal?'Pagamento em cartão — conferir fatura':'Não conciliada' };
  });
}
function match(row, invoices, bank) {
  if (row.amount >= 0 || row.linkedId || row.purchaseId || row.manual) return null;
  const found=[];
  for(const n of invoices) {
    const sameDoc=String(row.document||'').replace(/\D/g,'')===n.document;
    const sameName=norm(row.name||row.supplier)===norm(n.supplier);
    if(!sameDoc&&!sameName)continue;
    if(row.document && !compatiblePersonDocument(row.document,n.document))continue;
    for(const p of n.plan?.parts||[]) if(!unscheduled(p)&&p.method!=='Cartão'&&(!p.bank||!bank||p.bank===bank)) for(const installment of p.installments) {
      const linked=n.links.filter(l=>l.partId===installment.id).reduce((s,l)=>s+l.amount,0);
      if(installment.amount-linked===Math.abs(row.amount)) found.push({invoice:n,part:p,installment});
    }
  }
  return found.length===1?found[0]:null;
}
module.exports={CARDS,parseInvoice,validatePlan,ensure,list,match};
