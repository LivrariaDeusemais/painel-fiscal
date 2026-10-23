const participation=require('./mercado-livre-participacoes');
async function notParticipating(pool,op){
 const campaign=op.dados?.campaign;if(!campaign?.id)return [];
 const key=campaign.type+':'+campaign.id,seller=op.seller_id||op.seller;
 const records=(await pool.query(`SELECT p.anuncio,p.dados,v.sku FROM ml_promo_participacoes p
 LEFT JOIN tabela_preco_vinculos v ON v.marketplace='Mercado Livre' AND UPPER(TRIM(v.id_loja))=p.anuncio
 WHERE p.seller=$1 AND p.campanha=$2 AND EXISTS(
 SELECT 1 FROM ml_operacoes o,jsonb_array_elements(o.dados->'entries') e
 WHERE o.seller_id=$1 AND o.tipo IN ('integrar-promocoes','promo-central')
 AND o.dados->'campaign'->>'id'=$3 AND o.dados->'campaign'->>'type'=$4 AND e->>'anuncio'=p.anuncio)`,[seller,key,campaign.id,campaign.type])).rows;
 return records.filter(r=>participation.state(null,r.dados).label==='Não participando').map(r=>({sku:r.sku||'',anuncio:r.anuncio,nome_campanha:campaign.name||campaign.id,campanha:key,status:'Não participando',motivo:r.dados.note||'A consulta não confirmou participação na campanha.',consultado_em:r.dados.checkedAt}));
}
module.exports={notParticipating};
