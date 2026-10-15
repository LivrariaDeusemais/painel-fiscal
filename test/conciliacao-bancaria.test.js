const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const s = require('../src/services/conciliacao-bancaria');
const { renderPage } = require('../src/views/conciliacao-bancaria');

function row(overrides = {}) {
  return { id: 'r1', date: '2026-09-03', amount: -10000, name: 'Fornecedor Exemplo', document: '***.456.789-**', raw: {}, observation: '', ...overrides };
}
function candidate(overrides = {}) {
  return { id: 1, data_despesa: '2026-09-03', valor: '100.00', fornecedor: 'Fornecedor Exemplo', cnpj_cpf: '12345678901', tipo_pagamento: 'DOP', categoria: 'Serviços', ...overrides };
}
test('concilia valor, nome, data e CPF parcial; completa somente documento compatível', () => {
  const result = s.reconcile([row()], [candidate()], 'caixa')[0];
  assert.equal(result.status, 'Conciliado');
  assert.equal(result.document, '12345678901');
  assert.equal(result.clientStatus, 'Somar Conta Cliente');
  assert.equal(result.difference, 0);
  const conflict = s.reconcile([row()], [candidate({ cnpj_cpf: '12399999901' })], 'caixa')[0];
  assert.equal(conflict.status, 'Revisar');
  assert.equal(conflict.linkedId, null);
  assert.equal(conflict.document, '***.456.789-**');
});
test('valor sozinho, nomes ambíguos e duas movimentações para um comprovante não confirmam vínculo', () => {
  assert.notEqual(s.reconcile([row({ name: 'Outro fornecedor', document: '' })], [candidate()], 'caixa')[0].status, 'Conciliado');
  assert.equal(s.reconcile([row()], [candidate(), candidate({ id: 2 })], 'caixa')[0].status, 'Revisar');
  const rows = s.reconcile([row(), row({ id: 'r2' })], [candidate()], 'caixa');
  assert.ok(rows.every(r => r.status === 'Revisar' && !r.linkedId));
});
test('IDs PIX encontrados no PDF permitem vínculo sem exigir a mesma data da despesa', () => {
  const pix = 'E003603052026090314123c6ecf27543';
  const r = s.reconcile([row({ pixId: pix, name: '', document: '' })], [candidate({ data_despesa: '2026-08-30', receiptText: `Identificador: ${pix}` })], 'caixa')[0];
  assert.equal(r.linkedId, 1);
  assert.equal(r.status, 'Conciliado');
});
test('nome+valor sem data igual e diferença de valor são sugestões para revisão', () => {
  assert.equal(s.reconcile([row()], [candidate({ data_despesa: '2026-09-02' })], 'caixa')[0].status, 'Revisar');
  const result = s.reconcile([row()], [candidate({ valor: '99.00' })], 'caixa')[0];
  assert.equal(result.status, 'Revisar');
  assert.equal(result.clientStatus, 'Pendente');
  assert.equal(s.applyLink(row(), candidate({ valor: '99.00' }), true).difference, 100);
});
test('entradas nunca somam, marketplaces e transferências seguem a regra inicial', () => {
  for (const [name, classification] of [['AIBR Instituicao de Pagamento Ltda.', 'Recebíveis AliExpress'], ['HUB INSTITUICAO DE PAGAMENTO SA', 'Recebíveis Magazine Luiza'], ['PIPO BRASIL', 'Recebíveis TikTok'], ['MAREE', 'Recebíveis Shopee'], ['CARTAO DE CREDITO - AMAZON', 'Recebíveis Amazon']]) {
    const r = s.reconcile([row({ name, document: '', amount: 10000 })], [], 'inter')[0];
    assert.equal(r.classification, classification); assert.equal(r.clientStatus, 'Não somar Cliente');
  }
  const own = row({ name: 'DEUS E MAIS COMERCIO', document: '18862388000103', amount: 10000 });
  assert.equal(s.reconcile([own], [], 'caixa')[0].status, 'Revisar');
  assert.equal(s.reconcile([{ ...own, pixId: 'E10573521202609011234abcdefghijkl' }], [], 'caixa')[0].classification, 'Recebíveis Mercado Livre');
  const transfer = s.reconcile([{ ...own, pixId: 'E00416968202609011234abcdefghijkl' }], [], 'caixa')[0];
  assert.equal(transfer.classification, 'Transferência recebida do Inter');
  assert.equal(transfer.clientStatus, 'Não somar Cliente');
  assert.equal(s.clientStatus({ amount: -100, status: 'Conciliado', paymentType: 'PIX' }), 'Não somar Cliente');
});
test('PIX enriquece uma movimentação sem duplicá-la e ambiguidades não escolhem arbitrariamente', () => {
  const r = row();
  const pix = row({ id: 'pix1', pixId: 'E12345678', hour: '10:00:00' });
  assert.equal(s.enrichPix([r], [pix])[0].pixId, pix.pixId);
  assert.equal(s.enrichPix([r], [pix, { ...pix, id: 'pix2', pixId: 'E99999999' }])[0].pixId, '');
});
test('importação preserva movimentos legítimos iguais e é idempotente entre formatos', () => {
  const rows = [row({ description: 'PIX ENVIADO' }), row({ id: 'r2', description: 'PIX ENVIADO' })];
  const parsed = { rows, columns: ['Valor'], account: {}, warnings: [], filename: 'a.csv', fileHash: 'abc', type: 'corrente' };
  const first = s.mergeImport(null, parsed);
  assert.equal(first.state.rows.length, 2);
  assert.equal(s.mergeImport(first.state, parsed).duplicate, true);
  const second = s.mergeImport(first.state, { ...parsed, fileHash: 'def', rows: rows.map((r, i) => ({ ...r, id: 'ofx' + i })) });
  assert.equal(second.state.rows.length, 2);
  assert.equal(second.added, 0);
});
test('importação Excel retira somente linhas de saldo e mantém CPF, colunas e data de movimento', async () => {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Extrato');
  ws.addRow(['Extrato de setembro']);
  ws.addRow(['Data Lancamento','Data Movimento','Histórico','Documento','Valor Lançamento','Saldo','CPF/CNPJ','Nome/Razão Social']);
  ws.addRow(['03/09/2026','01/09/2026','DEB PIX CHAVE','010100','- 100,00','1.000,00','***.456.789-**','Fornecedor']);
  ws.addRow(['03/09/2026','01/09/2026','SALDO DIA','000000','0,00','1.000,00','','']);
  ws.addRow(['01/10/2026','01/10/2026','TARIFA','1','-10,00','990,00','','']);
  const parsed = await s.parseStatement(await wb.xlsx.writeBuffer(), 'caixa.xlsx', 'caixa', 'corrente', '2026-09');
  assert.equal(parsed.rows.length, 1); assert.equal(parsed.columns.length, 8);
  assert.equal(parsed.rows[0].date, '2026-09-01'); assert.equal(parsed.rows[0].amount, -10000);
  assert.equal(parsed.rows[0].document, '***.456.789-**'); assert.equal(parsed.warnings.length, 1);
});
test('CSV e OFX preservam identificadores, centavos e dados da conta; banco incorreto é rejeitado', async () => {
  const csv = Buffer.from('Extrato Conta Corrente\nConta ;12345\nData Lançamento;Descrição;Valor;Saldo\n03/09/2026;Pix recebido: AIBR;1.234,56;2.000,00\n');
  const parsed = await s.parseStatement(csv, 'inter.csv', 'inter', 'corrente', '2026-09');
  assert.equal(parsed.rows[0].amount, 123456); assert.equal(parsed.account.number, '12345');
  const ofx = Buffer.from('<OFX><BANKID>077<ACCTID>12345<STMTTRN><DTPOSTED>20260903<TRNAMT>1234.56<FITID>1<MEMO>Pix recebido: AIBR<NAME>AIBR</STMTTRN><BALAMT>2000.00</OFX>');
  assert.equal((await s.parseStatement(ofx, 'inter.ofx', 'inter', 'corrente', '2026-09')).rows[0].amount, 123456);
  await assert.rejects(s.parseStatement(ofx, 'inter.ofx', 'caixa', 'corrente', '2026-09'), /banco/);
  await assert.rejects(s.parseStatement(csv, 'inter.csv', 'inter', 'pix', '2026-09'), /tabela/);
});
test('revisão manual e observações sobrevivem a uma nova conciliação', () => {
  const manual = { ...s.applyLink(row(), candidate(), true), observation: 'Conferido' };
  const result = s.reconcile([manual], [], 'caixa')[0];
  assert.equal(result.linkedId, 1); assert.equal(result.observation, 'Conferido');
});
test('Genivaldo Sestari tem finalidades distintas por direção, inclusive em linhas já revisadas', () => {
  const withdrawal = row({ name:'GENIVALDO SESTARI' });
  const deposit = row({ name:'Genivaldo Sestari',amount:10000 });
  assert.equal(s.origin(withdrawal,'caixa').label,'Retirada Sócios - Distribuição');
  assert.equal(s.origin(deposit,'inter').label,'Inserção de Capital pelo Sócio');
  assert.equal(s.reconcile([deposit],[],'caixa')[0].clientStatus,'Não somar Cliente');
  const manual = {...withdrawal,manual:true,status:'Conciliado',paymentType:'DOP',observation:'Conferido',linkedId:1};
  const result = s.reconcile([manual],[],'caixa')[0];
  assert.equal(result.classification,'Retirada Sócios - Distribuição'); assert.equal(result.clientStatus,'Somar Conta Cliente'); assert.equal(result.observation,'Conferido'); assert.equal(result.linkedId,1);
  assert.equal(s.applyPartnerRule(row()).classification,undefined);
});
test('OFX e Excel com data de lançamento diferente da data de movimento não duplicam pagamentos', () => {
  const excel = row({ date: '2026-09-05', postedDate: '2026-09-08', description: 'DEB PIX CHAVE', reference: '000000', raw: { 'Data Movimento': '05/09/2026' } });
  const ofx = row({ id: 'ofx', date: '2026-09-08', postedDate: '2026-09-08', description: 'DEB PIX CHAVE', reference: '000000' });
  const parsed = r => ({ rows: [r], columns: [], account: {}, warnings: [], filename: r.id, fileHash: r.id, type: 'corrente' });
  for (const order of [[excel, ofx], [ofx, excel]]) {
    const state = s.mergeImport(s.mergeImport(null, parsed({ ...order[0] })).state, parsed({ ...order[1] })).state;
    assert.equal(state.rows.length, 1); assert.equal(state.rows[0].date, '2026-09-05');
  }
});
test('exportação tem originais, observação ao final, filtros, datas e valores numéricos', async () => {
  const movement = { ...s.applyLink(row(), candidate(), true), raw: { Data: '03/09/2026', Valor: '-100,00', Saldo: '1.000,00' }, observation: 'Conferido' };
  const state = { columns: ['Data','Valor','Saldo'], rows: [movement], account: { number: '000123', branch: '0001' }, warnings: [] };
  const wb = s.exportWorkbook(state, 'caixa', '2026-09');
  const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(await wb.xlsx.writeBuffer());
  const ws = loaded.worksheets[0];
  assert.match(ws.getCell('A1').value, /Caixa.*09\/2026/);
  assert.match(ws.getCell('A3').value, /000123/);
  assert.equal(ws.getCell('B8').value, -100); assert.equal(ws.getCell('C8').value, 1000);
  assert.ok(ws.getCell('A8').value instanceof Date);
  assert.equal(ws.getCell('N7').value, 'Observação'); assert.equal(ws.getCell('N8').value, 'Conferido');
  assert.equal(ws.autoFilter, 'A7:N8');
});
test('script da página é válido e token não permite injetar HTML', () => {
  const html = renderPage({ token: 'abc', month: '2026-09', readonly: false });
  new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]);
  assert.match(html, /Vincular comprovante/); assert.match(html, /Observação/);
});

test('colunas OFX complementares ficam internas, preservando as colunas do extrato principal', () => {
  const service = require('../src/services/conciliacao-bancaria');
  const columns = ['Data Movimento', 'Valor Lançamento', 'Saldo', 'Nome/Razão Social', 'Data', 'Valor', 'Nome', 'FITID', 'Tipo OFX'];
  const state = { columns, sources: [] };
  assert.deepEqual(service.visibleColumns(state), columns.slice(0, 4));
  assert.equal(state.columns.length, 9);
  state.sources = [{ type: 'corrente', format: 'table', columns: columns.slice(0, 4) }];
  assert.deepEqual(service.visibleColumns(state), columns.slice(0, 4));
  assert.deepEqual(service.visibleColumns({ columns: ['Data', 'Valor', 'Histórico', 'FITID', 'Tipo OFX'], sources: [] }), ['Data', 'Valor', 'Histórico']);
});

test('cadastro completa documentos compatíveis sem misturar homônimos ou alterar comprovantes', () => {
  const { applyPeople } = require('../src/services/conciliacao-bancaria');
  const rows = [{ name: 'Pessoa Teste', document: '***.531.418-**', linkedId: 55, amount: -30000, raw: { CPF: '***.531.418-**' } }, { name: 'Pessoa Teste', document: '999.123.456-00' }, { name: 'Outra Pessoa', document: '***.531.418-**' }];
  const people = [{ id: 'p1', source_name: 'PESSOA TESTE', name: 'Pessoa Teste', document: '12453141813' }];
  const result = applyPeople(rows, people);
  assert.equal(result[0].document, '124.531.418-13'); assert.equal(result[0].linkedId, 55); assert.equal(result[0].raw.CPF, '***.531.418-**');
  assert.equal(result[1].document, rows[1].document); assert.equal(result[2].document, rows[2].document);
  assert.equal(rows[0].document, '***.531.418-**');
  assert.equal(applyPeople(rows, [...people, { ...people[0], id: 'p2', document: '55553141899' }])[0].document, rows[0].document);
  assert.equal(applyPeople([{ name: 'Pessoa Teste', document: '124.531.418-13' }], [{ ...people[0], document: '12453141814', aliases: ['12453141813'] }])[0].document, '124.531.418-14');
});

test('pré-cadastro atualiza quatro campos, mantém original e preserva finalidade de sócio por direção', () => {
 const s=require('../src/services/conciliacao-bancaria');
 const people=[{id:'1',source_name:'EMPRESA ORIGINAL',name:'Razão corrigida',trade_name:'Loja',document:'12345678000199',purpose:'Compra para estoque'}];
 const row={name:'Empresa Original',raw:{'Nome/Razão Social':'Empresa Original'},document:'12.345.678/0001-99',classification:'Anterior',amount:-10000};
 const updated=s.applyPeople([row],people)[0];assert.equal(updated.legalName,'Razão corrigida');assert.equal(updated.supplier,'Loja');assert.equal(updated.classification,'Compra para estoque');assert.equal(s.rawValue(updated,'Nome/Razão Social'),'Razão corrigida');assert.equal(updated.raw['Nome/Razão Social'],'Empresa Original');
 assert.equal(s.applyPeople([updated],[{...people[0],purpose:''}])[0].classification,'Anterior');
 const partner={name:'GENIVALDO SESTARI',document:'12453141813',classification:'',amount:100};
 const p={source_name:'GENIVALDO SESTARI',name:partner.name,document:partner.document,purpose:'Retirada'};
 assert.equal(s.applyPeople([partner],[p])[0].classification,'Inserção de Capital pelo Sócio');assert.equal(s.applyPeople([{...partner,amount:-100}],[p])[0].classification,'Retirada Sócios - Distribuição');
});

test('exportação distingue cabeçalhos originais por banco e exclui Conta Cliente', async () => {
 const state={columns:['Data','Valor','Saldo'],sources:[],rows:[],account:{},warnings:[]};
 for(const [bank,color,text] of [['inter','FFF79646','FF000000'],['caixa','FF005CA9','FFFFFFFF']]) {
  const wb=s.exportWorkbook(state,bank,'2026-09'),ws=wb.worksheets[0];
  assert.equal(ws.getCell('A7').fill.fgColor.argb,color);assert.equal(ws.getCell('C7').fill.fgColor.argb,color);assert.equal(ws.getCell('A7').font.color.argb,text);
  assert.equal(ws.getCell('D7').fill.fgColor.argb,'FF008F48');
  assert.ok(!ws.getRow(7).values.includes('Conta Cliente'));assert.doesNotMatch(ws.getCell('A4').value,/Somar Conta Cliente/);
  const exported=await wb.xlsx.writeBuffer();const parsed=new ExcelJS.Workbook();await parsed.xlsx.load(exported);assert.equal(parsed.worksheets[0].getCell('A7').fill.fgColor.argb,color);assert.equal(parsed.worksheets[0].views[0].ySplit,7);assert.equal(parsed.worksheets[0].views[0].xSplit||0,0);
 }
});
