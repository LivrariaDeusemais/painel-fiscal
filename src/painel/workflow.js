const {today}=require('./service'),{normalize}=require('./downloads'),{historicoEstimativaSql,resolverEstimativa}=require('../services/rotina-previsao');
const START='2026-08';
function closedMonths(date=today()){
 const month=date.slice(0,7),out=[];
 for(let y=2026,m=8;`${y}-${String(m).padStart(2,'0')}`<month;){out.push(`${y}-${String(m).padStart(2,'0')}`);if(++m===13){m=1;y++;}}
 return out;
}
function closingRecords({base,statuses,custom,types,hidden},date=today()){
 const out=[];
 for(const month of closedMonths(date)){
  const row=statuses.find(r=>r.mes_ref===month)||{},configs=[...base,...types.filter(t=>!t.mes_ref||t.mes_ref===month).map(t=>({key:'custom_'+t.id,label:t.label,custom:true}))];
  for(const config of configs){if(hidden.includes(month+'_'+config.key))continue;
   const source=config.custom?custom.find(r=>r.mes_ref===month&&r.tipo_key===config.key):row;
   const status=(config.custom?source?.status_pronto:source?.[config.statusColumn])||'Aguardar';
   if(normalize(status)==='liberado para baixar')continue;
   out.push({menu:'contabil',capability:'fechamento-despesas',key:'fechamento:'+month+':'+config.key,month,fileType:config.label,status,label:`${month.split('-').reverse().join('/')} · ${config.label} — ${status}`,count:1,url:'/espaco-contador?mes='+encodeURIComponent(month)});
  }
 }
 return out;
}
async function closing(pool,base,date=today()){
 const [statuses,custom,types,hidden]=await Promise.all([pool.query('SELECT * FROM contador_status_mensal WHERE mes_ref >= $1 AND mes_ref < $2',[START,date.slice(0,7)]),pool.query('SELECT * FROM contador_status_custom_mensal WHERE mes_ref >= $1 AND mes_ref < $2',[START,date.slice(0,7)]),pool.query('SELECT id,label,mes_ref FROM contador_arquivo_tipos WHERE ativo=true'),pool.query("SELECT chave FROM painel_configuracoes WHERE chave LIKE 'contador_tipo_oculto_%' AND valor='true'")]);
 return closingRecords({base,statuses:statuses.rows,custom:custom.rows,types:types.rows,hidden:hidden.rows.map(r=>r.chave.replace('contador_tipo_oculto_',''))},date);
}
async function dueToday(pool,date=today()){
 const result=await pool.query(`SELECT r.valor_estimado,sm.valor_estimado AS valor_estimado_mes,sm.valor_estimado_editado,historico.valor_historico FROM rotina_despesas r LEFT JOIN rotina_despesas_status_mensal sm ON sm.rotina_id=r.id AND sm.mes_ano=$1 ${historicoEstimativaSql}
 WHERE COALESCE(sm.ativo,r.ativo,true)=true
 AND UPPER(translate(COALESCE(sm.status_pagto,'A_PAGAR'),'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇáàâãéèêíìîóòôõúùûç ','AAAAEEEIIIOOOOUUUCaaaaeeeiiioooouuuc_')) NOT IN ('PAGO','DOP','NAO_TEM','NAOTEM')
 AND COALESCE(NULLIF(regexp_replace(COALESCE(r.dia_vencimento::text,''),'[^0-9]','','g'),'')::int,EXTRACT(DAY FROM r.data_vencimento)::int) IS NOT NULL
 AND LEAST(COALESCE(NULLIF(regexp_replace(COALESCE(r.dia_vencimento::text,''),'[^0-9]','','g'),'')::int,EXTRACT(DAY FROM r.data_vencimento)::int),EXTRACT(DAY FROM (date_trunc('month',$2::date)+INTERVAL '1 month - 1 day'))::int)=EXTRACT(DAY FROM $2::date)::int`,[date.slice(0,7),date]);
 const values=result.rows.map(resolverEstimativa),cents=values.reduce((sum,value)=>sum+(value==null?0:Math.round(value*100)),0),unknown=values.filter(v=>v==null).length,amount=cents/100;
 return {menu:'financeiro',capability:'vencimentos-hoje',key:'vencimentos-hoje',count:values.length,amount,unknown,label:`Contas a vencer hoje: ${values.length} conta(s) · Valor previsto ${amount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}${unknown?' · '+unknown+' sem valor informado':''}`,url:'/rotina-despesas?'+new URLSearchParams({mes_ano:date.slice(0,7),vencimento_inicio:date,vencimento_fim:date,ativo:'true',pendentes:'1'})};
}
module.exports={START,closedMonths,closingRecords,closing,dueToday};
