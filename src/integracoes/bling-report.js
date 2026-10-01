const ExcelJS = require('exceljs');

function buildReport(job) {
  const workbook = new ExcelJS.Workbook();
  const complete = Array.isArray(job.divergencias);
  const summary = workbook.addWorksheet('Resumo');
  summary.columns = [{width:28},{width:110}];
  summary.addRows([
    ['Atualização', String(job.id)], ['Início', new Date(job.criado_em).toISOString()],
    ['Status', job.status], ['Pendências contabilizadas', job.falhas],
    ['Detalhes disponíveis', complete ? job.divergencias.length : 'Somente resumo antigo'],
    ['Cobertura', complete ? 'Detalhes registrados nesta execução.' : 'Esta execução não armazenou a lista completa. Execute uma nova atualização para registrar todas as divergências.'],
    ['Resultado', job.mensagem || '']
  ]);
  const sheet = workbook.addWorksheet('Divergências', {views:[{state:'frozen',ySplit:1}]});
  sheet.columns = [
    {header:'Etapa',key:'etapa',width:20}, {header:'Marketplace',key:'marketplace',width:22},
    {header:'SKU',key:'sku',width:18}, {header:'ID produto Bling',key:'produto_id',width:24},
    {header:'ID anúncio / vínculo',key:'anuncio_id',width:30},
    {header:'Motivo',key:'motivo',width:80}, {header:'Tratamento',key:'acao',width:34}
  ];
  if (complete) sheet.addRows(job.divergencias);
  else sheet.addRow({etapa:'Resumo antigo',motivo:job.mensagem || '',acao:'Lista completa indisponível'});
  sheet.autoFilter = {from:'A1',to:'G1'};
  for (const page of [summary,sheet]) {
    page.eachRow(row=>{row.alignment={vertical:'top',wrapText:true};});
    page.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
    page.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF009640'}};
  }
  return workbook;
}
module.exports = {buildReport};
