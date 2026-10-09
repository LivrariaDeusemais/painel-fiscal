function mesValido(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ''));
}

function dataValida(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const data = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === value;
}

function valorEstimado(value) {
  if (value == null || String(value).trim() === '') return null;
  let texto = String(value).trim().replace(/^R\$\s*/, '');
  if (texto.includes(',')) texto = texto.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(texto)) throw new Error('Informe um valor válido, maior ou igual a zero.');
  const numero = Number(texto);
  if (!Number.isFinite(numero) || numero > 999999999999.99) throw new Error('Valor fora do limite permitido.');
  return numero;
}

function resolverEstimativa(conta) {
  if (conta.valor_estimado_editado) return conta.valor_estimado_mes == null ? null : Number(conta.valor_estimado_mes);
  if (Number(conta.valor_estimado) > 0) return Number(conta.valor_estimado);
  return conta.valor_historico == null ? null : Number(conta.valor_historico);
}

// O primeiro mês com lançamento vence; data e ID desempatam dentro dele.
const historicoEstimativaSql = `LEFT JOIN LATERAL (
  SELECT l.valor AS valor_historico
  FROM lancamentos l
  WHERE l.categoria_id = COALESCE(r.subcategoria_id, r.categoria_principal_id)
    AND (
      (NULLIF(regexp_replace(COALESCE(r.cnpj_cpf, ''), '[^0-9]', '', 'g'), '') IS NOT NULL
       AND regexp_replace(COALESCE(l.cnpj_cpf, ''), '[^0-9]', '', 'g') = regexp_replace(r.cnpj_cpf, '[^0-9]', '', 'g'))
      OR (NULLIF(regexp_replace(COALESCE(r.cnpj_cpf, ''), '[^0-9]', '', 'g'), '') IS NULL
          AND lower(trim(l.fornecedor)) = lower(trim(r.fornecedor)))
    )
    AND l.data_despesa >= ($1 || '-01')::date - INTERVAL '3 months'
    AND l.data_despesa < ($1 || '-01')::date
    AND l.valor IS NOT NULL
  ORDER BY l.data_despesa DESC, l.id DESC
  LIMIT 1
) historico ON true`;

module.exports = { mesValido, dataValida, valorEstimado, resolverEstimativa, historicoEstimativaSql };
