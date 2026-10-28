const ExcelJS = require('exceljs');
const HEADERS = ['Título', 'Loja (NÃO EDITAR, APENAS INCLUIR LINHAS)', 'ID do Anúncio (NÃO EDITAR, APENAS INCLUIR LINHAS)', 'SKU (NÃO EDITAR, APENAS INCLUIR LINHAS)', 'Preço', 'Modalidade'];
function modality(value) {
  return ({gold_special:'Clássico',gold_pro:'Premium','Clássico':'Clássico',Classico:'Clássico',Premium:'Premium'})[value] || null;
}
async function buildWorkbook(items, resolveListing) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('ag-grid');
  sheet.columns = HEADERS.map((header, i) => ({header,width:[57.6640625,34.83203125,42.6640625,34.83203125,8.1640625,10.1640625][i]}));
  const listings = new Map();
  for (const item of items) {
    const row = item.row;
    if (row.sem_vinculo) continue;
    const id = String(row.id_loja || '').trim();
    const sku = String(row.sku || '').trim();
    if (!/^MLB\d+$/.test(id) || !sku || item.result?.status !== 'OK' || !Number.isFinite(item.result.grossPrice) || item.result.grossPrice <= 0) throw new Error(`Revise o anúncio e o preço do SKU ${sku || '(sem SKU)'}.`);
    if (!listings.has(id)) {
      const raw = row.dados || {};
      let type = modality(raw.mercado_livre_preco?.listingTypeId || raw.meli_listing_type_id || raw.listing_type_id || raw.Modalidade);
      if (!type) type = modality((await resolveListing(id)).listing_type_id);
      if (!type) throw new Error(`Modalidade do anúncio ${id} não identificada. Atualize a integração Mercado Livre antes de exportar.`);
      listings.set(id,type);
    }
    sheet.addRow([String(row.nome || row.produto_nome || ''),'Mercado Livre',id,sku,Number(item.result.grossPrice.toFixed(4)),listings.get(id)]);
  }
  return workbook;
}
module.exports = {HEADERS,buildWorkbook};
