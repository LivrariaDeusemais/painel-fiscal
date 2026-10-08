const ExcelJS = require('exceljs');

const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const moeda = '"R$" #,##0.00;[Red]("R$" #,##0.00);"—"';
const percentual = '0.0%;[Green]-0.0%;"—"';
const round = n => Math.round((n + Number.EPSILON) * 100) / 100;

function criarRelatorioDespesasAnual(dados, ano, agora = new Date()) {
  const grupos = new Map();
  for (const item of dados) {
    if (!String(item.mes_ref).startsWith(`${ano}-`)) continue;
    const m = Number(String(item.mes_ref).slice(5, 7)) - 1;
    if (m < 0 || m > 11) continue;
    const chave = String(item.principal_id ?? 'sem-categoria');
    if (!grupos.has(chave)) grupos.set(chave, { nome: item.categoria_principal || 'Sem categoria', valores: Array(12).fill(0), filhos: new Map() });
    const grupo = grupos.get(chave);
    grupo.valores[m] = round(grupo.valores[m] + Number(item.total || 0));
    const filhoChave = String(item.categoria_id ?? 'sem-categoria');
    if (!grupo.filhos.has(filhoChave)) grupo.filhos.set(filhoChave, { nome: item.subcategoria || 'Sem subcategoria', valores: Array(12).fill(0), direto: item.categoria_id === item.principal_id });
    const filho = grupo.filhos.get(filhoChave);
    filho.valores[m] = round(filho.valores[m] + Number(item.total || 0));
  }
  const total = Array(12).fill(0);
  const linhas = [];
  [...grupos.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).forEach(g => {
    g.valores.forEach((v, i) => { total[i] = round(total[i] + v); });
    linhas.push({ ...g, principal: true });
    if (g.filhos.size > 1 || [...g.filhos.values()].some(f => !f.direto && g.nome !== 'Sem categoria')) {
      [...g.filhos.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).forEach(f => linhas.push({ ...f, nome: f.direto ? 'Sem subcategoria (lançamento direto)' : f.nome, principal: false }));
    }
  });
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Plennatec';
  wb.created = agora;
  wb.calcProperties.fullCalcOnLoad = true;
  const valores = wb.addWorksheet('Despesas anuais');
  const variacao = wb.addWorksheet('Variação mensal');
  for (const ws of [valores, variacao]) {
    ws.properties.tabColor = { argb: ws === valores ? '008F48' : '2274A5' };
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 7, showGridLines: false }];
    ws.columns = [{ width: 48 }, ...meses.map(() => ({ width: 17 })), { width: 20 }, { width: 16 }];
    ws.mergeCells('A1:O2');
    ws.getCell('A1').value = `PLENNATEC  |  DESPESAS ${ano}`;
    ws.getCell('A1').font = { name: 'Aptos Display', size: 22, bold: true, color: { argb: 'FFFFFF' } };
    ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '064E3B' } };
    ws.getCell('A1').alignment = { vertical: 'middle' };
    ws.mergeCells('A3:O3');
    ws.getCell('A3').value = ws === valores ? 'Evolução por categoria e subcategoria • valores em reais' : 'Crescimento em relação ao mês anterior • aumentos em vermelho, reduções em verde';
    ws.mergeCells('A4:O4');
    ws.getCell('A4').value = `Fonte: lançamentos do Dashboard, por data da despesa. Exportado em ${agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`;
    ws.mergeCells('A5:O5');
    ws.getCell('A5').value = 'O mês atual é parcial. Meses futuros não indicam crescimento. “Sem base” = mês anterior zerado; janeiro não tem comparação.';
    ws.getRow(5).height = 30;
    ws.getCell('A5').alignment = { wrapText: true, vertical: 'middle' };
    ws.getCell('A5').font = { size: 10, italic: true, color: { argb: '64748B' } };
    ws.getRow(7).values = ['Despesa / categoria', ...meses, ws === valores ? 'Total anual' : '', ws === valores ? 'Participação' : ''];
    ws.getRow(7).height = 28;
    ws.getRow(7).eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '064E3B' } }; c.font = { bold: true, color: { argb: 'FFFFFF' } }; });
    ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:7' };
    ws.headerFooter.oddFooter = '&LPlennatec&CRelatório anual&R Página &P de &N';
  }
  const totalAnual = round(total.reduce((a, b) => a + b, 0));
  const linhaTotal = 8;
  const todas = [{ nome: 'TOTAL DAS DESPESAS', valores: total, principal: true }, ...linhas];
  todas.forEach((item, idx) => {
    const r = linhaTotal + idx;
    const row = valores.getRow(r);
    const grow = variacao.getRow(r);
    row.getCell(1).value = item.nome;
    grow.getCell(1).value = item.nome;
    for (let m = 0; m < 12; m++) {
      row.getCell(m + 2).value = item.valores[m];
      row.getCell(m + 2).numFmt = moeda;
      if (m > 0 && (ano < agora.getFullYear() || (ano === agora.getFullYear() && m <= agora.getMonth()))) {
        const col = String.fromCharCode(66 + m);
        const prev = String.fromCharCode(65 + m);
        const anterior = item.valores[m - 1];
        const atual = item.valores[m];
        const result = anterior === 0 ? (atual === 0 ? '' : 'Sem base') : (atual - anterior) / anterior;
        grow.getCell(m + 2).value = { formula: `IF('Despesas anuais'!${prev}${r}=0,IF('Despesas anuais'!${col}${r}=0,"","Sem base"),('Despesas anuais'!${col}${r}-'Despesas anuais'!${prev}${r})/'Despesas anuais'!${prev}${r})`, result };
        grow.getCell(m + 2).numFmt = percentual;
      }
    }
    const soma = round(item.valores.reduce((a, b) => a + b, 0));
    row.getCell(14).value = { formula: `SUM(B${r}:M${r})`, result: soma };
    row.getCell(14).numFmt = moeda;
    row.getCell(15).value = { formula: `IF($N$8=0,0,N${r}/$N$8)`, result: totalAnual ? soma / totalAnual : 0 };
    row.getCell(15).numFmt = '0.0%';
    for (const rr of [row, grow]) {
      rr.height = item.principal ? 29 : 25;
      if (!item.principal) rr.outlineLevel = 1;
      for (let c = 1; c <= 15; c++) {
        const cell = rr.getCell(c);
        cell.font = { name: 'Aptos', size: 11, bold: item.principal, color: { argb: idx === 0 ? 'FFFFFF' : '1E293B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx === 0 ? '008F48' : item.principal ? 'E2F3EA' : idx % 2 ? 'F7FAFC' : 'FFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: c === 1 ? 'left' : 'right', indent: c === 1 && !item.principal ? 1 : 0, wrapText: c === 1 };
      }
    }
  });
  variacao.addConditionalFormatting({ ref: `C8:M${8 + linhas.length}`, rules: [
    { type: 'cellIs', operator: 'greaterThan', formulae: ['0'], style: { font: { color: { argb: 'B91C1C' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } } } },
    { type: 'cellIs', operator: 'lessThan', formulae: ['0'], style: { font: { color: { argb: '15803D' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCFCE7' } } } }
  ] });
  return wb;
}

module.exports = { criarRelatorioDespesasAnual };
