// União manual de arquivos existentes; os arquivos físicos são preservados.
async function vincularPar(pool, ids, actor, fileExists) {
  if (!Array.isArray(ids) || ids.length !== 2 || ids.some(id => !/^\d+$/.test(String(id)) || !Number.isSafeInteger(Number(id)) || Number(id) < 1) || Number(ids[0]) === Number(ids[1])) {
    throw new Error('Selecione exatamente um PDF e um XML.');
  }
  ids = ids.map(Number).sort((a,b)=>a-b);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {rows} = await client.query('SELECT * FROM arquivo_fila WHERE id = ANY($1::int[]) OR par_id = ANY($1::int[]) ORDER BY id FOR UPDATE', [ids]);
    const selected = rows.filter(row => ids.includes(Number(row.id)));
    const pdf = selected.find(row => row.tipo === 'PDF'), xml = selected.find(row => row.tipo === 'XML');
    if (selected.length !== 2 || !pdf || !xml) throw new Error('Selecione exatamente um PDF e um XML.');
    if (rows.some(row => row.par_id) || selected.some(row => row.status !== 'DISPONIVEL' || row.analise_status === 'COMPLETO')) throw new Error('Um dos arquivos já está vinculado ou não está mais disponível. Atualize a página.');
    if (selected.some(row => ['DUPLICADO','ARQUIVO_AUSENTE'].includes(row.analise_status) || !fileExists(row))) throw new Error('Não é possível vincular arquivos ausentes ou marcados como duplicados.');
    if (pdf.chave_fiscal && xml.chave_fiscal && pdf.chave_fiscal !== xml.chave_fiscal) throw new Error('Os arquivos possuem chaves fiscais diferentes. Confira o PDF e o XML.');
    const audit = JSON.stringify({vinculoManual:{pdfId:pdf.id,xmlId:xml.id,usuarioId:actor.id,usuario:actor.nome,em:new Date().toISOString()}});
    await client.query(`UPDATE arquivo_fila SET par_id = CASE WHEN id = $1 THEN $2 ELSE $1 END,
      documento_classe = 'FISCAL', analise_status = 'COMPLETO', analisado_em = COALESCE(analisado_em,NOW()),
      chave_fiscal = COALESCE($3,chave_fiscal), cnpj_cpf = $4, fornecedor = $5, numero_documento = $6,
      tipo_documento_detectado = $7, data_documento = $8, valor_documento = $9,
      metadados = COALESCE(metadados,'{}'::jsonb) || $10::jsonb WHERE id IN ($1,$2)`,
      [pdf.id,xml.id,xml.chave_fiscal||pdf.chave_fiscal||null,xml.cnpj_cpf||pdf.cnpj_cpf||null,xml.fornecedor||pdf.fornecedor||null,xml.numero_documento||pdf.numero_documento||null,xml.tipo_documento_detectado||pdf.tipo_documento_detectado||null,xml.data_documento||pdf.data_documento||null,xml.valor_documento??pdf.valor_documento??null,audit]);
    await client.query('COMMIT');
    return {pdfId:pdf.id,xmlId:xml.id};
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
module.exports = {vincularPar};
