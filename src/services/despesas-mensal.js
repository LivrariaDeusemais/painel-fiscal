const ExcelJS = require('exceljs');

const dinheiro = '"R$" #,##0.00;[Red]("R$" #,##0.00);"—"';
function periodoRelatorio({ data_inicio = '', data_fim = '' } = {}) {
  const dataValida = v => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const format = v => v.split('-').reverse().join('/');
  if (dataValida(data_inicio) && dataValida(data_fim) && data_inicio.slice(0, 7) === data_fim.slice(0, 7)) {
    const d = new Date(`${data_inicio.slice(0, 7)}-01T12:00:00Z`);
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  if (dataValida(data_inicio) && dataValida(data_fim)) return `${format(data_inicio)} a ${format(data_fim)}`;
  if (dataValida(data_inicio)) return `A partir de ${format(data_inicio)}`;
  if (dataValida(data_fim)) return `Até ${format(data_fim)}`;
  return 'Todos os períodos';
}

function criarRelatorioDespesasMensal(rows, filtros = {}, agora = new Date()) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Plennatec';
  wb.created = agora;
  wb.calcProperties.fullCalcOnLoad = true;
  const titulo = `Lista de todas as despesas Deus é Mais - ${periodoRelatorio(filtros)}`;
  const total = Math.round(rows.reduce((s, l) => s + Number(l.valor || 0), 0) * 100) / 100;
  const headers = ['ID', 'Tipo do documento', 'Número do documento', 'Data', 'Fornecedor', 'CNPJ/CPF', 'Código de pagamento', 'Valor', 'Tipo de pagamento', 'Categoria Principal', 'Subcategoria', 'PDF', 'XML'];
  const lista = wb.addWorksheet('Despesas');
  lista.columns = [10, 23, 24, 16, 48, 24, 25, 20, 24, 30, 32, 60, 60].map(width => ({ width }));
  const detalhes = rows.map(l => {
    const categoria = l.categoria_pai_id ? l.categoria_principal || 'Sem categoria' : l.categoria || 'Sem categoria';
    const data = l.data_despesa ? new Date(l.data_despesa) : null;
    const nome = [l.tipo_pagamento || 'SemPagamento', l.fornecedor || 'SemFornecedor', l.categoria || 'SemCategoria', l.numero_documento || 'SemNumero', `R$${Number(l.valor || 0).toFixed(2).replace('.', ',')}`].join('-').replace(/[\/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
    return [l.id, l.tipo_documento || '', String(l.numero_documento || ''), data && !Number.isNaN(data.getTime()) ? data : '', l.fornecedor || 'Sem fornecedor', String(l.cnpj_cpf || ''), String(l.codigo_pagamento || ''), Number(l.valor || 0), l.tipo_pagamento || '', categoria, l.categoria_pai_id ? l.subcategoria || '' : '', l.anexo_pdf ? `${nome}.pdf` : '', l.anexo_xml ? `${nome}.xml` : ''];
  });
  function base(ws, fim, subtitulo) {
    ws.properties.tabColor = { argb: '008F48' };
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 7, showGridLines: false }];
    ws.mergeCells(`A1:${fim}2`);
    ws.getCell('A1').value = titulo;
    ws.getCell('A1').font = { name: 'Aptos Display', size: 20, bold: true, color: { argb: 'FFFFFF' } };
    ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '064E3B' } };
    ws.getCell('A1').alignment = { vertical: 'middle', wrapText: true };
    ws.getRow(1).height = 30;
    ws.getRow(2).height = 30;
    ws.mergeCells(`A3:${fim}3`);
    ws.getCell('A3').value = subtitulo;
    ws.getCell('A3').font = { name: 'Aptos', size: 12, color: { argb: '475569' } };
    ws.getRow(3).height = 26;
    ws.mergeCells(`A4:${fim}4`);
    ws.getCell('A4').value = `${rows.length} despesas • Total: ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} • Gerado em ${agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
    ws.getCell('A4').font = { bold: true, size: 12, color: { argb: '008F48' } };
    ws.mergeCells(`A5:${fim}5`);
    const filtrosTexto = Object.entries(filtros).filter(([k, v]) => v && !['data_inicio', 'data_fim'].includes(k)).map(([k, v]) => `${({ fornecedor: 'Fornecedor', categoria_id: 'Categoria ID', tipo_pagamento: 'Pagamento', cnpj_cpf: 'CNPJ/CPF', codigo_pagamento: 'Código', numero_documento: 'Documento' })[k] || k}: ${v}`).join(' • ');
    ws.getCell('A5').value = `Fonte: Comprovantes Fiscais, pela data da despesa.${filtrosTexto ? ` Filtros: ${filtrosTexto}.` : ''}${filtros.data_inicio && filtros.data_fim ? ` Intervalo: ${filtros.data_inicio} a ${filtros.data_fim}.` : ''}`;
    ws.getCell('A5').alignment = { wrapText: true, vertical: 'middle' };
    ws.getCell('A5').font = { italic: true, size: 10, color: { argb: '64748B' } };
    ws.getRow(5).height = 32;
    ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:7' };
    ws.headerFooter.oddFooter = '&LDeus é Mais | Plennatec&R Página &P de &N';
  }
  function cabecalho(ws, valores) {
    ws.getRow(7).values = valores;
    ws.getRow(7).height = 32;
    ws.getRow(7).eachCell(c => {
      c.font = { bold: true, size: 11, color: { argb: 'FFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '064E3B' } };
      c.alignment = { vertical: 'middle', wrapText: true };
    });
  }
  function linha(ws, r, cells) {
    const row = ws.getRow(r);
    row.values = cells;
    row.height = 32;
    row.eachCell(c => {
      c.font = { name: 'Aptos', size: 11, color: { argb: '1E293B' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r % 2 ? 'FFFFFF' : 'F1F7F4' } };
      c.alignment = { vertical: 'middle', wrapText: true };
    });
    return row;
  }
  base(lista, 'M', 'Relação completa dos lançamentos selecionados • valores em reais');
  cabecalho(lista, headers);
  detalhes.forEach((d, i) => linha(lista, i + 8, d));
  lista.getColumn(4).numFmt = 'dd/mm/yyyy';
  for (const c of [3, 6, 7]) lista.getColumn(c).numFmt = '@';
  lista.getColumn(8).numFmt = dinheiro;
  lista.autoFilter = `A7:M${Math.max(7, rows.length + 7)}`;
  const fimDados = Math.max(8, rows.length + 7);
  const rTotal = rows.length + 9;
  lista.getCell(`G${rTotal}`).value = 'TOTAL FILTRADO';
  lista.getCell(`H${rTotal}`).value = { formula: `SUM(H8:H${fimDados})`, result: total };
  lista.getCell(`H${rTotal}`).numFmt = dinheiro;
  lista.getRow(rTotal).font = { bold: true, color: { argb: '008F48' } };

  for (const [nome, campo] of [['Soma por Categorias', 9], ['Soma por Fornecedores', 4]]) {
    const categorias = campo === 9;
    const ws = wb.addWorksheet(nome);
    ws.columns = (categorias ? [36, 44, 18, 24, 20] : [68, 20, 24, 20]).map(width => ({ width }));
    const ultima = categorias ? 'E' : 'D';
    const colValor = categorias ? 'D' : 'C';
    const colQuantidade = categorias ? 'C' : 'B';
    base(ws, ultima, `${nome} • consolidação dos mesmos lançamentos da aba Despesas`);
    cabecalho(ws, categorias ? ['Categoria principal', 'Subcategoria', 'Quantidade', 'Valor total', 'Participação'] : ['Fornecedor', 'Quantidade', 'Valor total', 'Participação']);
    const grupos = new Map();
    detalhes.forEach(d => {
      const labels = categorias ? [d[9], d[10]] : [d[4]];
      const key = JSON.stringify(labels);
      const g = grupos.get(key) || { labels, n: 0, soma: 0 };
      g.n++; g.soma += d[7]; grupos.set(key, g);
    });
    const sorted = [...grupos.values()].sort((a, b) => categorias
      ? a.labels[0].localeCompare(b.labels[0], 'pt-BR') || b.soma - a.soma || a.labels[1].localeCompare(b.labels[1], 'pt-BR')
      : b.soma - a.soma || a.labels[0].localeCompare(b.labels[0], 'pt-BR'));
    sorted.forEach((g, i) => {
      const r = i + 8;
      // Native pivot output cells contain values, not formulas. The source is
      // the Despesas sheet and Excel refreshes the summaries when opened.
      linha(ws, r, [...g.labels, g.n, Math.round(g.soma * 100) / 100,
        { formula: `IF(SUM(Despesas!$H$8:$H$${fimDados})=0,0,${colValor}${r}/SUM(Despesas!$H$8:$H$${fimDados}))`, result: total ? g.soma / total : 0 }
      ]);
    });
    ws.getColumn(categorias ? 4 : 3).numFmt = dinheiro;
    ws.getColumn(categorias ? 5 : 4).numFmt = '0.0%';
    // Filtering pivot fields is handled by Excel's PivotTable controls.
    const t = sorted.length + 9;
    linha(ws, t, [...(categorias ? ['TOTAL', ''] : ['TOTAL']),
      { formula: `SUM(${colQuantidade}8:${colQuantidade}${Math.max(8, t - 2)})`, result: rows.length },
      { formula: `SUM(${colValor}8:${colValor}${Math.max(8, t - 2)})`, result: total }, total ? 1 : 0]);
    ws.getRow(t).font = { bold: true, color: { argb: 'FFFFFF' } };
    ws.getRow(t).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '008F48' } };
  }
  return wb;
}
module.exports = { criarRelatorioDespesasMensal, periodoRelatorio };
