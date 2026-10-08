const JSZip = require('jszip');
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const xml = s => String(s ?? '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
const doc = body => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + body;

// ExcelJS writes the formatted cells; native Open XML PivotTables add Excel's
// field list and refresh support without an additional production dependency.
async function exportarComDinamicas(wb, count) {
  const zip = await JSZip.loadAsync(await wb.xlsx.writeBuffer());
  if (!count) return zip.generateAsync({ type: 'nodebuffer' });
  const source = wb.getWorksheet('Despesas');
  const fields = Array.from({ length: 13 }, (_, i) => ({ name: source.getCell(7, i + 1).value, numeric: i === 0 || i === 7, values: [], indexes: new Map() }));
  for (let r = 8; r < 8 + count; r++) {
    fields.forEach((f, i) => {
      const raw = source.getCell(r, i + 1).value;
      const value = raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw ?? '');
      if (!f.indexes.has(value)) { f.indexes.set(value, f.values.length); f.values.push(value); }
    });
  }
  // Do not invent a cached PivotTable matrix. Excel rebuilds it from the
  // worksheet on opening, using the same refresh-on-load model as Excelize.
  zip.file('xl/pivotCache/pivotCacheDefinition1.xml', doc(`<pivotCacheDefinition xmlns="${ns}" saveData="0" refreshOnLoad="1" createdVersion="6" refreshedVersion="6" minRefreshableVersion="3"><cacheSource type="worksheet"><worksheetSource sheet="Despesas" ref="A7:M${7 + count}"/></cacheSource><cacheFields count="13">${fields.map((f, i) => `<cacheField name="${xml(f.name)}"><sharedItems${f.numeric ? ' containsString="0" containsNumber="1" containsSemiMixedTypes="0"' : ''} containsBlank="${f.values.includes('') ? 1 : 0}" count="${f.values.length}">${f.values.map(v => f.numeric ? `<n v="${Number(v || 0)}"/>` : v === '' ? '<m/>' : `<s v="${xml(v)}"/>`).join('')}</sharedItems></cacheField>`).join('')}</cacheFields></pivotCacheDefinition>`));
  const relationships = entries => doc(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${entries}</Relationships>`);
  let contentTypes = await zip.file('[Content_Types].xml').async('string');
  const type = (part, kind) => `<Override PartName="/${part}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.${kind}+xml"/>`;
  contentTypes = contentTypes.replace('</Types>', type('xl/pivotCache/pivotCacheDefinition1.xml', 'pivotCacheDefinition') + '</Types>');
  for (const [idx, rowFields] of [[1, [9, 10]], [2, [4]]]) {
    const sheet = wb.worksheets[idx];
    const groups = sheet.rowCount - 9;
    const pivotFields = fields.map((f, i) => rowFields.includes(i)
      ? `<pivotField axis="axisRow" showAll="0" defaultSubtotal="0" compact="0" outline="0"><items count="${f.values.length}">${f.values.map((v, x) => `<item x="${x}"/>`).join('')}</items></pivotField>`
      : `<pivotField${i === 0 || i === 7 ? ' dataField="1"' : ''} showAll="0"/>`).join('');
    zip.file(`xl/pivotTables/pivotTable${idx}.xml`, doc(`<pivotTableDefinition xmlns="${ns}" name="Resumo${idx}" cacheId="1" dataCaption="Valores" createdVersion="6" updatedVersion="6" minRefreshableVersion="3" rowGrandTotals="0" colGrandTotals="0" useAutoFormatting="0" preserveFormatting="1" compact="0" compactData="0" gridDropZones="1"><location ref="A6:${idx === 1 ? 'D' : 'C'}${7 + groups}" firstHeaderRow="1" firstDataRow="2" firstDataCol="${rowFields.length}"/><pivotFields count="13">${pivotFields}</pivotFields><rowFields count="${rowFields.length}">${rowFields.map(x => `<field x="${x}"/>`).join('')}</rowFields><colFields count="1"><field x="-2"/></colFields><dataFields count="2"><dataField name="Quantidade" fld="0" subtotal="count" baseField="0" baseItem="0"/><dataField name="Valor total" fld="7" subtotal="sum" baseField="0" baseItem="0" numFmtId="4"/></dataFields></pivotTableDefinition>`));
    zip.file(`xl/pivotTables/_rels/pivotTable${idx}.xml.rels`, relationships(`<Relationship Id="rId1" Type="${rel}/pivotCacheDefinition" Target="../pivotCache/pivotCacheDefinition1.xml"/>`));
    // PivotTables are implicit worksheet relationships, not worksheet children.
    // CT_Worksheet has no pivotTableParts element (unlike ordinary tableParts).
    const sheetRelsPath = `xl/worksheets/_rels/sheet${idx + 1}.xml.rels`;
    const existingRels = zip.file(sheetRelsPath);
    const sheetRels = existingRels ? await existingRels.async('string') : relationships('');
    zip.file(sheetRelsPath, sheetRels.replace('</Relationships>', `<Relationship Id="rIdPivot" Type="${rel}/pivotTable" Target="../pivotTables/pivotTable${idx}.xml"/></Relationships>`));
    contentTypes = contentTypes.replace('</Types>', type(`xl/pivotTables/pivotTable${idx}.xml`, 'pivotTable') + '</Types>');
  }
  const workbookXml = await zip.file('xl/workbook.xml').async('string');
  // CT_Workbook requires pivotCaches after calcPr, never before it.
  const caches = '<pivotCaches><pivotCache cacheId="1" r:id="rIdDespesasCache"/></pivotCaches>';
  zip.file('xl/workbook.xml', workbookXml.replace(/(<calcPr\b[^>]*\/>|<calcPr\b[^>]*>[\s\S]*?<\/calcPr>)/, `$1${caches}`));
  const wbRel = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  zip.file('xl/_rels/workbook.xml.rels', wbRel.replace('</Relationships>', `<Relationship Id="rIdDespesasCache" Type="${rel}/pivotCacheDefinition" Target="pivotCache/pivotCacheDefinition1.xml"/></Relationships>`));
  zip.file('[Content_Types].xml', contentTypes);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
module.exports = { exportarComDinamicas };
