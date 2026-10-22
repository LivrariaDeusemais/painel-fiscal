const ml=require('./mercado-livre'),pricing=require('../tabela-precos/service'),actions=require('./mercado-livre-actions');
const promo=()=>require('./mercado-livre-promocoes');
const key=c=>c.type+':'+c.id;
const ref=c=>String(c.offer_id||c.ref_id||c.id);
const active=c=>!!c&&['started','pending'].includes(c.status);
const TYPES=['integrar-promocoes','consultar-participacao'];
const UNCERTAIN_WAIT=120000;
async function ensure(pool){await pool.query(`CREATE TABLE IF NOT EXISTS ml_promo_participacoes(seller TEXT NOT NULL,campanha TEXT NOT NULL,anuncio TEXT NOT NULL,dados JSONB NOT NULL,atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(seller,campanha,anuncio))`);}
async function load(pool,seller,campaign){return (await pool.query('SELECT anuncio,dados FROM ml_promo_participacoes WHERE seller=$1 AND campanha=$2',[seller,key(campaign)])).rows;}
function state(candidate,record,cacheTime){
 const valid=record&&['confirmed','uncertain','sending'].includes(record.phase);
 if(valid&&record.phase!=='confirmed')return {label:'Pendente de confirmação',note:record.note||'Consulte a participação antes de repetir o envio.'};
 const use=valid&&(!cacheTime||Date.parse(record.checkedAt)>=Date.parse(cacheTime));
 const current=use?record.candidate:candidate,known=current&&['started','pending','candidate','finished','rejected','deleted'].includes(current.status);
 return {label:active(current)?'Participando':known||use&&current===null?'Não participando':'Pendente de confirmação',note:[current?.status==='pending'?'Participação programada.':'',use?record.note:'',use?'Conferido em '+new Date(record.checkedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Status da última importação.'].filter(Boolean).join(' ')};
}
async function store(pool,seller,campaign,id,data){const value={...data,checkedAt:data.checkedAt||new Date().toISOString()};await pool.query('INSERT INTO ml_promo_participacoes(seller,campanha,anuncio,dados) VALUES($1,$2,$3,$4) ON CONFLICT(seller,campanha,anuncio) DO UPDATE SET dados=EXCLUDED.dados,atualizado_em=NOW()',[seller,key(campaign),id,JSON.stringify(value)]);return value;}
function unique(rows,cached){
 if(rows.length<2)return rows[0]||null;
 const exact=rows.filter(c=>[c.offer_id,c.ref_id].filter(Boolean).includes(cached.offer_id||cached.ref_id));
 if(exact.length!==1)throw Error('Mais de uma oferta neste anúncio. Atualize a campanha e revise.');return exact[0];
}
// The item endpoint is authoritative for participation. The campaign query is
// scoped to one item, so a broken global campaign page cannot stop the batch.
async function observe(api,campaign,id,cached={}){
 const offers=await api.get('/seller-promotions/items/'+id,{app_version:'v2'});
 if(!Array.isArray(offers))throw Error('Consulta individual da participação incompleta.');
 const relevant=offers.filter(c=>c.type===campaign.type&&(String(c.id)===String(campaign.id)||campaign.type==='PRICE_DISCOUNT'&&!c.id));
 const current=unique(relevant,cached);if(!current)return null;
 const item={...current,id,offer_id:current.offer_id||(String(current.ref_id||'').startsWith('OFFER-')?current.ref_id:undefined)};
 const scopedTerms=['LIGHTNING','DOD','DEAL'].includes(campaign.type);
 if(scopedTerms||!item.offer_id&&['SMART','PRICE_MATCHING','PRE_NEGOTIATED','UNHEALTHY_STOCK'].includes(campaign.type)&&!active(item)){
  try{
   const data=await api.get('/seller-promotions/promotions/'+campaign.id+'/items',{app_version:'v2',promotion_type:campaign.type,item_id:id,limit:50});
   if(!Array.isArray(data.results))throw Error('Oferta individual incompleta.');
   const detail=unique(data.results.filter(c=>c.id===id),cached);
   if(detail){if(detail.status!==item.status||!scopedTerms&&detail.price>0&&item.price>0&&Math.abs(Number(detail.price)-Number(item.price))>.005)throw Error('Oferta mudou durante a consulta.');return {...item,...detail,id,offer_id:detail.offer_id||item.offer_id};}
   if(scopedTerms)throw Error('Condições da campanha não encontradas para este anúncio. Atualize as ofertas.');
  }catch(error){if(scopedTerms)throw error;item.lookupError=error.message;}
 }
 return item;
}
function uncertainStillFresh(prior,current){return prior&&prior.phase!=='confirmed'&&!active(current)&&Date.now()-Date.parse(prior.checkedAt)<UNCERTAIN_WAIT;}
async function saveDecision(pool,seller,campaign,entry,s){await pool.query('INSERT INTO ml_promo_decisoes(seller,campanha,anuncio,oferta,dados) VALUES($1,$2,$3,$4,$5) ON CONFLICT(seller,campanha,anuncio,oferta) DO UPDATE SET dados=EXCLUDED.dados,atualizado_em=NOW()',[seller,key(campaign),entry.anuncio,ref(entry.candidate),JSON.stringify({price:s.price,quantity:s.quantity,credit:s.creditOverride,creditBasis:s.creditOverride!=null?s.creditBasis:null,decision:'Participar',manual:entry.manual,basis:entry.basis,user:entry.user,at:new Date().toISOString()})]);}
async function run(pool,op,readOnly=false,options={}){
 const api=new ml.MeliClient(pool),seller=op.seller||op.seller_id,campaign=op.dados.campaign;
 let failures=0;const rows=readOnly?[]:await pricing.marketplaceRows(pool,{marketplace:'Mercado Livre'}),dynamic=readOnly?[]:await pricing.freightRules(pool);
 const prior=new Map((await load(pool,seller,campaign)).map(r=>[r.anuncio,r.dados]));
 for(const entry of op.dados.entries){let current=null,observed=false,sending=false,record;const report={sku:entry.sku,anuncio:entry.anuncio,campanha:key(campaign),nome_campanha:promo().campaignName(campaign),oferta:ref(entry.candidate),indice:entry.index};
  try{
   current=await observe(api,campaign,entry.anuncio,entry.candidate);observed=true;
   if(uncertainStillFresh(prior.get(entry.anuncio),current))throw Error('Envio anterior ainda sem confirmação. Aguarde dois minutos e consulte a participação antes de reenviar.');
   record=await store(pool,seller,campaign,entry.anuncio,{phase:'confirmed',candidate:current,note:current?'Participação consultada no Mercado Livre.':'Não encontrado nesta campanha; nenhuma participação enviada.'});
   if(readOnly){report.status=state(null,record).label;}
   else {
    // Never repeat admission for an accepted offer. Own campaigns may update an
    // existing flexible price, but only when the API permits that change.
    if(active(current)&&(campaign.type!=='SELLER_CAMPAIGN'||Math.abs(Number(current.price)-Number(entry.expected?.price))<.005)){
     report.status='Participando';report.motivo='Participação já confirmada; nenhum reenvio necessário.';
    }else{
     if(!current)throw Error('Anúncio não está elegível nesta campanha.');
     if(entry.error)throw Error(entry.error);
     const matches=rows.filter(i=>String(i.row.id)===String(entry.link)&&String(i.row.id_loja).trim().toUpperCase()===entry.anuncio);
     if(matches.length!==1||actions.fingerprint(matches[0])!==entry.fingerprint)throw Error('Cadastro, estoque ou cálculo mudou. Atualize a análise.');
     const item=matches[0],fresh={...entry.candidate,...current};
     const s=promo().scenario(campaign,fresh,item,dynamic,entry.input);
     if(s.creditStale)throw Error('Condições do bônus conferido mudaram. Confira o bônus novamente.');
     if(Math.abs(s.price-entry.expected.price)>.005||Math.abs(s.credit-entry.expected.credit)>.005||Math.abs(s.profit-entry.expected.profit)>.005||Math.abs(s.margin-entry.expected.margin)>.000001)throw Error('Preço, bônus ou margem mudou. Atualize e revise antes de enviar.');
     if((entry.manual?entry.decision:s.suggested)!=='Participar')throw Error('A decisão deste item precisa ser Participar.');
     const request=promo().payload(campaign,fresh,s);
     const snap=await ml.snapshot(api,entry.anuncio,seller);
     if(snap.item.status!=='active'||snap.item.condition!=='new'||!(Number(snap.item.available_quantity)>0)||Math.abs(snap.price.gross-s.gross)>.005)throw Error('Situação do anúncio, estoque ou bruto mudou. Atualize a análise.');
     if(snap.item.tags?.includes('dynamic_standard_price'))throw Error('Anúncio com automatização de preços; confira no Mercado Livre.');
     if(s.quantity&&s.quantity>Number(snap.item.available_quantity))throw Error('Reserva maior que o estoque atual do anúncio.');
     await saveDecision(pool,seller,campaign,entry,s);
     record=await store(pool,seller,campaign,entry.anuncio,{phase:'sending',candidate:current,operation:op.id,note:'Envio iniciado; aguardando confirmação.'});sending=true;
     await ml.appendResult(pool,op.id,{...report,status:'Envio iniciado',liquido:s.price});
     const response=await api.request(request.method,'/seller-promotions/items/'+entry.anuncio,{app_version:'v2'},request.body);
     const checked=await observe(api,campaign,entry.anuncio,fresh);
     if(response?.price!=null&&(!Number.isFinite(Number(response.price))||Math.abs(Number(response.price)-s.price)>.005)||!active(checked)||Math.abs(Number(checked.price)-s.price)>.005)throw Error('Envio recebido, mas participação e preço ainda não confirmados. Consulte antes de repetir.');
     record=await store(pool,seller,campaign,entry.anuncio,{phase:'confirmed',candidate:checked,operation:op.id,note:'Preço e participação confirmados pelo Mercado Livre.'});sending=false;
     report.status='Participando';report.liquido=s.price;report.motivo='Preço e participação confirmados.';
    }
   }
  }catch(error){
   failures++;const definitive=sending&&Number.isInteger(error.status)&&error.status>=400&&error.status<500;
   const previous=prior.get(entry.anuncio),hold=uncertainStillFresh(previous,current);
   const uncertain=sending&&!definitive||!observed||hold;
   record=await store(pool,seller,campaign,entry.anuncio,{phase:uncertain?'uncertain':'confirmed',candidate:current,operation:op.id,note:error.message,...(hold?{checkedAt:previous.checkedAt}:{})});
   report.status=state(null,record).label;report.motivo=error.message;
  }
  await ml.appendResult(pool,op.id,{...report,final:true});
 }
 if(options.finalize!==false)await pool.query('UPDATE ml_operacoes SET status=$2,atualizado_em=NOW() WHERE id=$1',[op.id,failures?'parcial':'concluida']);
 return {failures};
}
function mount({route,pool,account,owner,model}){
 const start=readOnly=>async(req,res)=>{
  const seller=await account(),m=await model(pool,seller,req.body.campaign);if(!m.group)throw Error('Selecione uma campanha.');
  const selected=new Set((Array.isArray(req.body.selected)?req.body.selected:[req.body.selected]).filter(v=>v!=null&&v!=='').map(String));
  if(!selected.size||selected.size>1000)throw Error('Selecione de 1 a 1.000 itens.');
  const chosen=m.entries.filter(e=>selected.has(String(e.index)));if(chosen.length!==selected.size)throw Error('Seleção inválida. Atualize a tabela.');
  if(new Set(chosen.map(e=>e.candidate.id)).size!==chosen.length)throw Error('Selecione apenas uma oferta por anúncio.');
  const dynamic=readOnly?[]:await pricing.freightRules(pool);
  const entries=chosen.map(e=>{
   const index=String(e.index),base={link:e.item?.row.id,sku:e.item?.row.sku,anuncio:e.candidate.id,candidate:e.candidate,user:owner(req)};if(readOnly)return base;
   try{
    if(!e.item||e.error)throw Error(e.error||'Cadastro incompleto.');
    if(req.body.basis?.[index]!==e.basis)throw Error('A análise mudou. Atualize a tabela.');
    const input={price:req.body.price?.[index],quantity:req.body.quantity?.[index],credit:req.body.credit?.[index],creditBasis:req.body.creditBasis?.[index]},decision=req.body.decision?.[index]==='Analisar'?'Revisar':req.body.decision?.[index];
    if(decision!=='Participar')throw Error('Selecione apenas itens com decisão Participar.');
    const s=promo().scenario(m.group.campaign,e.candidate,e.item,dynamic,input),manual=req.body.manual?.[index]==='yes';
    if(!s.editable&&Math.abs(Number(String(input.price).replace(',','.'))-s.price)>.005)throw Error('Preço obrigatório não pode ser alterado.');
    return {...base,input,decision,manual,basis:e.basis,fingerprint:actions.fingerprint(e.item),expected:{price:s.price,credit:s.credit,profit:s.profit,margin:s.margin}};
   }catch(error){return {...base,error:error.message};}
  });
  const op=await ml.beginOperation(pool,readOnly?'consultar-participacao':'integrar-promocoes',owner(req),{campaign:m.group.campaign,entries});
  setImmediate(()=>ml.runLocked(pool,op,()=>run(pool,op,readOnly)).catch(()=>{}));res.status(202).json({operation:op.id});
 };
 route('/integrar','post',start(false));route('/consultar-participacao','post',start(true));
 route('/participacao','get',async(req,res)=>{
  const seller=await account(),catalog=(await pool.query('SELECT dados FROM ml_promo_catalogo WHERE seller=$1',[seller])).rows[0]?.dados,group=catalog?.campaigns.find(g=>key(g.campaign)===req.query.campaign);if(!group)throw Error('Campanha não encontrada.');
  const records=new Map((await load(pool,seller,group.campaign)).map(r=>[r.anuncio,r.dados]));
  let operation=null;if(req.query.operation){operation=(await pool.query('SELECT id,status,resultados,dados FROM ml_operacoes WHERE id=$1 AND seller_id=$2 AND usuario=$3 AND tipo=ANY($4::text[])',[req.query.operation,seller,owner(req),TYPES])).rows[0];if(!operation||key(operation.dados.campaign)!==key(group.campaign))throw Error('Operação não encontrada.');operation={id:operation.id,status:operation.status,results:operation.resultados,total:operation.dados.entries.length,anuncios:operation.dados.entries.map(e=>e.anuncio)};}
  res.json({items:group.items.map(c=>({anuncio:c.id,...state(c,records.get(c.id),catalog.updatedAt)})),operation});
 });
}
module.exports={ensure,load,state,observe,run,mount,TYPES};
