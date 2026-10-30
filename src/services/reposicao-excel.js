const ExcelJS=require('exceljs');
// Modelo gestao-estoque.xlsx: instruções da primeira linha aplicadas ao relatório,
// sem exportar a linha de instruções nem a coluna EAN indicada para exclusão.
const columns=[
 ['SKU','sku',12],['Descrição','name',70],['Editora','supplier',15],['Categoria','category',9],['Código fornecedor','code',16],['Custo','cost',12],['Giro no período','giro',10],
 ['Full ML','fullMeli',10],['Full Shopee','fullShopee',10],['Matriz','matrix',8],['Full ML','meli',10],['Full Shopee','shopee',10],['Total estoque','stockTotal',10],['Matriz após envios','afterFull',12],
 ['Compras a receber','pending',12],['Prazo entrega','lead',10],['Dias estoque','coverage',10],['Sugestão','suggested',10],['Comprar','quantity',9],['Preço pedido','price',12],['Total comprar','lineTotal',14],['Atualização estoque','stockAt',17]
];
function workbook(rows){
 const w=new ExcelJS.Workbook(),s=w.addWorksheet('Reposição');
 s.columns=columns.map(([header,key,width])=>({key,width}));
 s.addRow([]);s.addRow(columns.map(c=>c[0]));
 s.mergeCells('H1:I1');s.getCell('H1').value='Enviar ao Full';
 s.mergeCells('J1:N1');s.getCell('J1').value='Saldo em estoque';
 for(let n=1;n<=columns.length;n++){
  const color=n<=7?'FF8FF1FF':n<=9?'FF00B050':n<=14?'FF376092':n<=21?'FFFFFF00':'FFF2F2F2';
  for(const row of [1,2]){const c=s.getRow(row).getCell(n);c.fill={type:'pattern',pattern:'solid',fgColor:{argb:color}};c.font={name:'Calibri',size:11,bold:true,color:{argb:n>=8&&n<=14?'FFFFFFFF':'FF000000'}};c.alignment={horizontal:'center',vertical:'middle',wrapText:true};}
  const key=columns[n-1][1],col=s.getColumn(n);
  col.alignment={horizontal:['name','supplier','category'].includes(key)?'left':['cost','price','lineTotal'].includes(key)?'right':'center',vertical:'middle'};
  col.numFmt=['cost','price','lineTotal'].includes(key)?'#,##0.00':key==='stockAt'?'dd/mm/yyyy':['sku','code'].includes(key)?'@':'0';
 }
 // Aplicar novamente: o alinhamento da coluna não deve desfazer os títulos.
 for(const r of [1,2]){s.getRow(r).height=r===1?22:34;s.getRow(r).eachCell(c=>{c.alignment={horizontal:'center',vertical:'middle',wrapText:true}})}
 for(const r of rows){const date=r.stockAt?new Date(r.stockAt):null;const row=s.addRow({...r,sku:String(r.sku??''),code:String(r.code??''),lineTotal:r.quantity==null||r.price==null?null:Math.round(r.quantity*r.price*100)/100,stockAt:date&&!Number.isNaN(date.getTime())?date:null});row.font={name:'Calibri',size:11};row.height=20;}
 s.views=[{state:'frozen',xSplit:1,ySplit:2}];
 s.autoFilter={from:{row:2,column:1},to:{row:Math.max(2,s.rowCount),column:columns.length}};
 return w;
}
module.exports={workbook};
