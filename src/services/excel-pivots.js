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
  const records = [];
  for (let r = 8; r < 8 + count; r++) {
    records.push('<r>' + fields.map((f, i) => {
      const raw = source.getCell(r, i + 1).value;
      if (f.numeric) return `<n v="${Number(raw || 0)}"/>`;
      const value = raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw ?? '');
      if (!f.indexes.has(value)) { f.indexes.set(value, f.values.length); f.values.push(value); }
      return `<x v="${f.indexes.get(value)}"/>`;
    }).join('') + '</r>');
  }
  zip.file('xl/pivotCache/pivotCacheRecords1.xml', doc(`<pivotCacheRecords xmlns="${ns}" count="${count}">${records.join('')}</pivotCacheRecords>`));
  zip.file('xl/pivotCache/pivotCacheDefinition1.xml', doc(`<pivotCacheDefinition xmlns="${ns}" xmlns:r="${rel}" r:id="rId1" recordCount="${count}" createdVersion="3" refreshedVersion="3" minRefreshableVersion="3"><cacheSource type="worksheet"><worksheetSource sheet="Despesas" ref="A7:M${7 + count}"/></cacheSource><cacheFields count="13">${fields.map(f => `<cacheField name="${xml(f.name)}"><sharedItems${f.numeric ? ' containsString="0" containsNumber="1" containsInteger="0" containsSemiMixedTypes="0"' : ''} count="${f.values.length}">${f.values.map(v => `<s v="${xml(v)}"/>`).join('')}</sharedItems></cacheField>`).join('')}</cacheFields></pivotCacheDefinition>`));
  const relationships = entries => doc(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${entries}</Relationships>`);
  zip.file('xl/pivotCache/_rels/pivotCacheDefinition1.xml.rels', relationships(`<Relationship Id="rId1" Type="${rel}/pivotCacheRecords" Target="pivotCacheRecords1.xml"/>`));
  let contentTypes = await zip.file('[Content_Types].xml').async('string');
  const type = (part, kind) => `<Override PartName="/${part}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.${kind}+xml"/>`;
  contentTypes = contentTypes.replace('</Types>', type('xl/pivotCache/pivotCacheDefinition1.xml', 'pivotCacheDefinition') + type('xl/pivotCache/pivotCacheRecords1.xml', 'pivotCacheRecords') + '</Types>');
  for (const [idx, field] of [[1, 9], [2, 4]]) {
    const sheet = wb.worksheets[idx];
    const groups = sheet.rowCount - 9;
    const items = Array.from({ length: groups }, (_, i) => fields[field].indexes.get(String(sheet.getCell(8 + i, 1).value)));
    const pivotFields = fields.map((f, i) => i === field
      ? `<pivotField axis="axisRow" showAll="0" defaultSubtotal="0"><items count="${groups}">${items.map(v => `<item x="${v}"/>`).join('')}</items></pivotField>`
      : `<pivotField${i === 0 || i === 7 ? ' dataField="1"' : ''} showAll="0"/>`).join('');
    zip.file(`xl/pivotTables/pivotTable${idx}.xml`, doc(`<pivotTableDefinition xmlns="${ns}" name="Resumo${idx}" cacheId="1" dataCaption="Valores" rowGrandTotals="0" colGrandTotals="0" multipleFieldFilters="0" useAutoFormatting="0" compact="0" compactData="0" gridDropZones="0"><location ref="A7:C${7 + groups}" firstHeaderRow="0" firstDataRow="1" firstDataCol="1"/><pivotFields count="13">${pivotFields}</pivotFields><rowFields count="1"><field x="${field}"/></rowFields><rowItems count="${groups}">${items.map((v, i) => `<i><x v="${i}"/></i>`).join('')}</rowItems><colFields count="1"><field x="-2"/></colFields><colItems count="2"><i i="0"><x/></i><i i="1"><x v="1"/></i></colItems><dataFields count="2"><dataField name="Quantidade" fld="0" subtotal="count" baseField="0" baseItem="0"/><dataField name="Valor total" fld="7" subtotal="sum" baseField="0" baseItem="0" numFmtId="4"/></dataFields></pivotTableDefinition>`));
    zip.file(`xl/pivotTables/_rels/pivotTable${idx}.xml.rels`, relationships(`<Relationship Id="rId1" Type="${rel}/pivotCacheDefinition" Target="../pivotCache/pivotCacheDefinition1.xml"/>`));
    const sheetPath = `xl/worksheets/sheet${idx + 1}.xml`;
    const sheetXml = await zip.file(sheetPath).async('string');
    zip.file(sheetPath, sheetXml.replace('</worksheet>', `<pivotTableParts count="1"><pivotTablePart r:id="rIdPivot"/></pivotTableParts></worksheet>`));
    zip.file(`xl/worksheets/_rels/sheet${idx + 1}.xml.rels`, relationships(`<Relationship Id="rIdPivot" Type="${rel}/pivotTable" Target="../pivotTables/pivotTable${idx}.xml"/>`));
    contentTypes = contentTypes.replace('</Types>', type(`xl/pivotTables/pivotTable${idx}.xml`, 'pivotTable') + '</Types>');
  }
  const workbookXml = await zip.file('xl/workbook.xml').async('string');
  zip.file('xl/workbook.xml', workbookXml.replace('<calcPr', '<pivotCaches><pivotCache cacheId="1" r:id="rIdDespesasCache"/></pivotCaches><calcPr'));
  const wbRel = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  zip.file('xl/_rels/workbook.xml.rels', wbRel.replace('</Relationships>', `<Relationship Id="rIdDespesasCache" Type="${rel}/pivotCacheDefinition" Target="pivotCache/pivotCacheDefinition1.xml"/></Relationships>`));
  zip.file('[Content_Types].xml', contentTypes);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
module.exports = { exportarComDinamicas };
