const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
function records({base,statuses,custom,types,hidden,extras,counts}){
 const months=new Set([...statuses.map(x=>x.mes_ref),...custom.map(x=>x.mes_ref)]),out=[];
 for(const month of months){
  const status=statuses.find(x=>x.mes_ref===month)||{};
  const configs=[...base,...types.filter(t=>!t.mes_ref||t.mes_ref===month).map(t=>({key:'custom_'+t.id,label:t.label,titulo:t.titulo||t.label,custom:true}))];
  for(const c of configs){if(hidden.includes(month+'_'+c.key))continue;
   const source=c.custom?(custom.find(x=>x.mes_ref===month&&x.tipo_key===c.key)||{}):status;
   if(normalize(c.custom?source.status_pronto:source[c.statusColumn])!=='liberado para baixar')continue;
   const count=c.auto?Number(counts.find(x=>x.mes_ref===month)?.[c.countKey]||0):extras.filter(x=>x.mes_ref===month&&normalize(x.titulo)===normalize(c.titulo)).reduce((s,x)=>s+Number(x.total),0);
   if(!count)continue;
   const at=c.custom?source.download_at:source[c.downloadAtColumn];
   out.push({key:month+':'+c.key,month,label:c.label,count,downloadedAt:at||null,url:'/espaco-contador?mes='+encodeURIComponent(month)});
  }
 }
 return out.sort((a,b)=>b.month.localeCompare(a.month)||a.label.localeCompare(b.label));
}
async function load(pool,base){
 const [statuses,custom,types,hidden,extras,counts]=await Promise.all([
  pool.query('SELECT * FROM contador_status_mensal'),pool.query('SELECT * FROM contador_status_custom_mensal'),
  pool.query('SELECT id,label,titulo,mes_ref FROM contador_arquivo_tipos WHERE ativo=true'),
  pool.query("SELECT chave FROM painel_configuracoes WHERE chave LIKE 'contador_tipo_oculto_%' AND valor='true'"),
  pool.query('SELECT mes_ref,titulo,COUNT(*)::int AS total FROM contador_arquivos_extras GROUP BY mes_ref,titulo'),
  pool.query("SELECT to_char(data_despesa,'YYYY-MM') AS mes_ref,COUNT(*) FILTER(WHERE NULLIF(TRIM(anexo_xml),'') IS NOT NULL)::int AS xml,COUNT(*) FILTER(WHERE NULLIF(TRIM(anexo_pdf),'') IS NOT NULL)::int AS pdf FROM lancamentos GROUP BY to_char(data_despesa,'YYYY-MM')")
 ]);
 return records({base,statuses:statuses.rows,custom:custom.rows,types:types.rows,hidden:hidden.rows.map(x=>x.chave.replace('contador_tipo_oculto_','')),extras:extras.rows,counts:counts.rows});
}
module.exports={normalize,records,load};
