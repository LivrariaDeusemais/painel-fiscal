const service=require('./mercado-livre');
const pricing=require('../tabela-precos/service');
const {calculateAtPrice}=require('../tabela-precos/pricing');
const ROOT=service.ROOT;
const escape=v=>String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>Number.isFinite(Number(v))?Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'-';
const percent=v=>Number.isFinite(Number(v))?(100*Number(v)).toLocaleString('pt-BR',{maximumFractionDigits:2})+'%':'-';
const user=req=>String(req.session.usuario.id || req.session.usuario.email || req.session.usuario.nome);
const round=v=>Math.round(Number(v)*100)/100;
function page(inner) {return `<style>.mla{max-width:1400px;margin:auto;background:white;padding:22px;border:1px solid #dce7e1;border-radius:10px}.mla p{line-height:1.5}.mla table{width:100%;border-collapse:collapse;font-size:12px}.mla td,.mla th{padding:10px;text-align:left;border-bottom:1px solid #ddd;overflow-wrap:anywhere}.mla button,.mla .button{padding:12px;background:#009640;color:white;border:0;border-radius:7px;cursor:pointer;text-decoration:none}.mla input,.mla select{padding:9px;border:1px solid #cbd5e1;border-radius:6px;margin:6px}.mla .warn{background:#fff7e8;padding:12px}.mla .scroll{overflow:auto}.mla label{display:inline-block}.mla button:disabled{opacity:.45;cursor:default}.ml-preview th{overflow-wrap:normal;min-width:80px}.ml-preview th:first-child{min-width:90px}.ml-preview td:nth-child(2){white-space:nowrap;min-width:150px}.ml-preview td:last-child{min-width:180px;max-width:280px}.ml-preview td:not(:last-child){white-space:nowrap}</style><div class="mla"><a href="${ROOT}">← Integração Mercado Livre</a>${inner}</div>`;}
function csrf(req){return `<input type="hidden" name="csrf" value="${escape(req.session.mlCsrf)}">`;}
function filterForm(path,filters,extra='') {return `<form method="get" action="${ROOT}/${path}">${extra}<label>SKU ou produto<input name="search" value="${escape(filters.search || '')}"></label><label>Estoque<select name="stock"><option value="positive" ${filters.stock!=='all'?'selected':''}>Maior que zero</option><option value="all" ${filters.stock==='all'?'selected':''}>Todos</option></select></label><label>Status do bruto<select name="grossStatus"><option value="">Todos</option>${['Aumentar valor','Manter valor','Reduzir valor','Revisar'].map(v=>`<option ${filters.grossStatus===v?'selected':''}>${v}</option>`).join('')}</select></label><button>Filtrar</button></form>`;}
async function localRows(pool,filters={}) {
  const rows=await pricing.marketplaceRows(pool,{marketplace:'Mercado Livre',search:String(filters.search || '').slice(0,200),stock:filters.stock==='all'?undefined:'positive'});
  return rows.filter(i=>!i.row.sem_vinculo && (!filters.grossStatus || i.grossStatus===filters.grossStatus));
}
function fingerprint(item) {
  // Includes every calculation input and target, not just the editable gross.
  return JSON.stringify({link:item.row.id,id:item.row.id_loja,sku:item.row.sku,product:item.product,rule:item.rule,target:item.result.finalPrice,gross:round(item.result.grossPrice),details:item.result.details,stock:item.row.estoque,matriz:item.row.estoque_matriz,full:item.row.estoque_full});
}
function validateGross(item,snapshot) {
  const gross=round(item.result.grossPrice);
  if(item.result.status!=='OK' || !Number.isFinite(gross) || gross<=0)throw new Error('Cálculo sem novo bruto válido.');
  if(snapshot.item.status!=='active')throw new Error('Anúncio não está ativo.');
  if(snapshot.item.tags?.includes('dynamic_standard_price'))throw new Error('Anúncio com automatização de preço. Gerencie a automatização no Mercado Livre.');
  if(snapshot.price.amount < snapshot.price.gross-0.005 && gross < snapshot.price.amount-0.005)throw new Error('Novo bruto menor que o líquido em vigor. Ajuste a promoção no Mercado Livre antes do envio.');
  return gross;
}
async function previewPrices(pool,rows,owner) {
  const op=await service.beginOperation(pool,'brutos',owner,{preparing:true});
  setImmediate(()=>service.runLocked(pool,op,()=>preparePrices(pool,rows,op)).catch(()=>{}));return op;
}
async function preparePrices(pool,rows,op) {
  const account={seller_id:op.seller},api=new service.MeliClient(pool),entries=[];
  const duplicates=new Map();for(const row of rows){const id=String(row.row.id_loja).trim().toUpperCase();duplicates.set(id,(duplicates.get(id)||0)+1);}
  for(const row of rows) {const entry={link:row.row.id,sku:row.row.sku,anuncio:row.row.id_loja,liquido:row.result.finalPrice,bruto:round(row.result.grossPrice),fingerprint:fingerprint(row)};
    try{const id=service.itemId(row.row.id_loja);if(duplicates.get(id)>1)throw new Error('Mesmo MLB em mais de um vínculo. Corrija a duplicidade.');
      const snap=await service.snapshot(api,id,account.seller_id);
      entry.bruto=validateGross(row,snap);entry.anuncio=id;entry.anterior=snap.price.gross;entry.liquidoAtual=snap.price.amount;entry.promocional=snap.price.amount < snap.price.gross-0.005;
      if(Math.abs(entry.bruto-entry.anterior)<0.005)throw new Error('Preço bruto já corresponde ao novo valor.');
      entry.status='Pronto';
    }catch(e){entry.status='Bloqueado';entry.motivo=e.message;}entries.push(entry);await service.appendResult(pool,op.id,{sku:entry.sku,anuncio:entry.anuncio,status:entry.status,motivo:entry.motivo});}
  await pool.query("UPDATE ml_operacoes SET status='previa',dados=$2,atualizado_em=NOW(),expira_em=NOW()+INTERVAL '20 minutes' WHERE id=$1",[op.id,JSON.stringify({entries})]);
}
async function claim(pool,id,owner,selected) {
  if(!/^[\da-f-]{36}$/i.test(id))throw new Error('Prévia inválida.');
  const client=await pool.connect();
  try{await client.query('BEGIN');const account=(await client.query('SELECT * FROM ml_integracao WHERE id=1 FOR UPDATE')).rows[0];
    const op=(await client.query("SELECT * FROM ml_operacoes WHERE id=$1 AND usuario=$2 AND status='previa' AND expira_em>NOW() FOR UPDATE",[id,owner])).rows[0];
    if(!op || op.seller_id!==account.seller_id)throw new Error('Prévia expirada, já confirmada ou de outra conta. Prepare novamente.');
    if((await client.query("SELECT id FROM ml_operacoes WHERE status='executando' LIMIT 1")).rows.length)throw new Error('Aguarde a operação atual terminar.');
    const wanted=new Set((Array.isArray(selected)?selected:[selected]).filter(Boolean).map(String));
    const entries=op.dados.entries.filter(e=>wanted.has(String(e.link)) && e.status==='Pronto');
    if(!entries.length || entries.length!==wanted.size)throw new Error('Selecione apenas itens disponíveis na prévia.');
    op.dados.entries=entries;await client.query("UPDATE ml_operacoes SET status='executando',dados=$2,resultados='[]'::jsonb,atualizado_em=NOW() WHERE id=$1",[id,JSON.stringify(op.dados)]);await client.query('COMMIT');return op;
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
async function finish(pool,op,worker) {
  let errors=0;
  try{await worker(async result=>{if(result.status!=='Publicado' && result.status!=='Incluído')errors++;await service.appendResult(pool,op.id,result);});
    await pool.query('UPDATE ml_operacoes SET status=$2,atualizado_em=NOW() WHERE id=$1',[op.id,errors?'parcial':'concluida']);
  }catch(e){await service.appendResult(pool,op.id,{status:'Falhou',motivo:e.message});await pool.query("UPDATE ml_operacoes SET status='falhou',atualizado_em=NOW() WHERE id=$1",[op.id]);}
}
async function executePrices(pool,op) {
  const api=new service.MeliClient(pool);
  await finish(pool,op,async report=>{const rows=await localRows(pool,{stock:'all'});for(const entry of op.dados.entries) {let result={sku:entry.sku,anuncio:entry.anuncio,bruto:entry.bruto,liquido:entry.liquido};
    try{const current=rows.find(i=>String(i.row.id)===String(entry.link));
      if(!current || fingerprint(current)!==entry.fingerprint)throw new Error('Cadastro, estoque ou cálculo mudou desde a prévia. Prepare novamente.');
      const snap=await service.snapshot(api,entry.anuncio,op.seller_id);
      validateGross(current,snap);
      if(!Number.isFinite(entry.liquidoAtual))throw new Error('Prévia antiga. Prepare uma nova prévia antes de enviar.');
      if(Math.abs(snap.price.gross-entry.anterior)>0.005 || Math.abs(snap.price.amount-entry.liquidoAtual)>0.005)throw new Error('Preço bruto ou líquido publicado mudou desde a prévia. Prepare novamente.');
      await service.appendResult(pool,op.id,{...result,status:'Envio iniciado',motivo:'Confira o anúncio se a operação for interrompida antes da confirmação.'});
      const response=await api.request('POST','/items/'+entry.anuncio+'/prices/standard',{}, {prices:[{conditions:{context_restrictions:['channel_marketplace']},amount:entry.bruto,currency_id:'BRL'}]});
      if(response.warnings?.length)throw new Error('Mercado Livre retornou avisos. Confira o anúncio antes de repetir.');
      const confirmed=await service.snapshot(api,entry.anuncio,op.seller_id);
      if(Math.abs(confirmed.price.gross-entry.bruto)>0.005)throw new Error('Envio aceito, mas o preço ainda não foi confirmado. Consulte o anúncio antes de repetir.');
      await service.savePrice(pool,{id:entry.link},confirmed.price);
      if(entry.promocional && Math.abs(confirmed.price.amount-entry.liquidoAtual)>0.005)throw new Error('Bruto confirmado, mas o Mercado Livre alterou o líquido promocional. Revise a promoção no portal; não repita o envio.');
      result.status='Publicado';result.motivo=entry.promocional?'Bruto confirmado e líquido promocional preservado.':'Somente o preço padrão foi enviado.';
    }catch(e){result={...result,status:'Pendente',motivo:e.message};}await report(result);}});
}
function previewTable(op,req) {
  return page(`<h2>Revisar ${op.tipo==='brutos'?'novos preços brutos':'participação na promoção'}</h2>${op.dados.newCampaign?`<p><strong>Nova campanha: ${escape(op.dados.newCampaign.name)}</strong> · ${escape(op.dados.newCampaign.start_date.slice(0,10))} a ${escape(op.dados.newCampaign.finish_date.slice(0,10))}</p>`:''}${op.tipo==='promocao'?'<p class="warn">A margem inclui a bonificação estimada informada pela campanha. O Mercado Livre valida o preço e a elegibilidade ao receber a participação.</p>':''}<p>Esta prévia expira em 20 minutos. Marque os anúncios que deseja enviar. A confirmação publica somente os itens selecionados.</p><form method="post" action="${ROOT}/confirmar/${op.id}">${csrf(req)}<div class="scroll"><table class="ml-preview"><thead><tr><th>Selecionar</th><th>SKU / MLB</th><th>Bruto publicado</th><th>${op.tipo==='brutos'?'Novo bruto':'Bruto de referência'}</th><th>Líquido atual</th><th>Novo líquido calculado</th><th>Desconto</th><th>Bonificação estimada</th><th>Lucro estimado</th><th>Margem estimada</th><th>Status</th></tr></thead><tbody>${op.dados.entries.map(e=>`<tr><td><input type="checkbox" name="selected" value="${escape(e.link)}" ${e.status!=='Pronto'?'disabled':''}></td><td>${escape(e.sku)}<br>${escape(e.anuncio)}</td><td>${money(e.anterior)}</td><td>${money(e.bruto)}</td><td>${money(e.liquidoAtual)}</td><td>${money(e.liquido)}</td><td>${percent(e.discount)}</td><td>${e.credit==null?'-':money(e.credit)}</td><td>${e.profit==null?'-':money(e.profit)}</td><td>${e.margin==null?'-':percent(e.margin)}</td><td>${escape(e.status)}<br>${escape(e.motivo || '')}</td></tr>`).join('')}</tbody></table></div><p><label><input type="checkbox" name="confirm" value="yes" required>Confirmo a publicação dos itens selecionados no Mercado Livre.</label></p><button>Confirmar publicação dos selecionados</button></form>`);
}
const ACCEPT_OFFER=new Set(['SMART','PRICE_MATCHING','PRE_NEGOTIATED','UNHEALTHY_STOCK']);
const COFINANCED=new Set(['MARKETPLACE_CAMPAIGN',...ACCEPT_OFFER]);
const SUPPORTED=new Set([...COFINANCED,'DEAL','SELLER_CAMPAIGN']);
function campaignKey(c){if(!/^[-\w]+$/.test(String(c.id)) || !/^[A-Z_]+$/.test(String(c.type)))throw new Error('Campanha inválida.');return {promotion:c.id,type:c.type};}
async function campaigns(api,seller) {const data=await api.get('/seller-promotions/users/'+seller,{app_version:'v2'});if(!Array.isArray(data.results))throw new Error('Lista de campanhas incompleta.');return data.results;}
async function campaignItems(api,campaign) {
  campaignKey(campaign);const rows=[],seen=new Set();let after;
  for(let n=0;n<1000;n++) {const data=await api.get('/seller-promotions/promotions/'+campaign.id+'/items',{promotion_type:campaign.type,app_version:'v2',limit:50,...(after?{search_after:after}:{})});
    if(!Array.isArray(data.results))throw new Error('Lista de itens da campanha incompleta.');rows.push(...data.results);
    const next=data.paging?.search_after || data.paging?.searchAfter || data.search_after || data.searchAfter;
    if(!next){if(data.paging?.total>rows.length)throw new Error('Campanha retornou paginação incompleta. Consulte novamente.');return rows;}
    if(seen.has(String(next)))throw new Error('Campanha repetiu a paginação. Consulte novamente.');seen.add(String(next));after=next;}
  throw new Error('Campanha excedeu o limite de consulta.');
}
function candidateKey(candidate) {return JSON.stringify({id:candidate.id,status:candidate.status,price:candidate.price,original:candidate.original_price,meli:candidate.meli_percentage,seller:candidate.seller_percentage,offer:candidate.offer_id,boost:candidate.boosted_offer,boostAmount:candidate.discount_meli_boost_amount,boostPrice:candidate.total_price_for_boosted_offer,min:candidate.min_discounted_price,max:candidate.max_discounted_price,suggested:candidate.suggested_discounted_price});}
function campaignTerms(campaign,candidate,item,gross,dynamic) {
  const type=campaign.type;
  let price,credit=0;
  if(COFINANCED.has(type)) {
    if(ACCEPT_OFFER.has(type) && !candidate.offer_id)throw new Error('Oferta sem identificador para aceitar a participação.');
    price=Number(candidate.price);
    if(!(price>0)) {
      const meli=Number(candidate.meli_percentage),seller=Number(candidate.seller_percentage),original=Number(candidate.original_price);
      if(!Number.isFinite(meli) || !Number.isFinite(seller) || !(original>0))throw new Error('Campanha sem preço proposto completo.');
      price=round(original*(1-(meli+seller)/100));
    }
    const share=candidate.meli_percentage==null?NaN:Number(candidate.meli_percentage),original=Number(candidate.original_price);
    if(!Number.isFinite(share) || share<0 || share>100 || !(original>0))throw new Error('Bonificação Mercado Livre sem base de cálculo válida.');
    credit=round(original*share/100);
  } else if(type==='DEAL') {
    price=Number(candidate.suggested_discounted_price);
    if(!(price>0))throw new Error('Campanha sem preço sugerido. Não há valor proposto para aceitar.');
  } else if(type==='SELLER_CAMPAIGN') price=round(item.result.finalPrice);
  else throw new Error('Tipo de campanha disponível para consulta; publicação ainda não habilitada para este tipo.');
  if(!(price>0) || !Number.isFinite(price) || price>=gross)throw new Error('Preço da promoção deve ser menor que o bruto publicado.');
  const discount=1-price/gross;
  if(type==='SELLER_CAMPAIGN' && discount<0.05-1e-9)throw new Error('Desconto abaixo de 5%. Revise e publique o novo bruto antes de participar.');
  if(candidate.min_discounted_price>0 && price<Number(candidate.min_discounted_price)-0.005 || candidate.max_discounted_price>0 && price>Number(candidate.max_discounted_price)+0.005)throw new Error('Preço fora dos limites permitidos pela campanha.');
  if(candidate.boosted_offer)throw new Error('Oferta com bonificação adicional automática. Revise as condições no Mercado Livre antes de participar.');
  const base=calculateAtPrice(item.product,item.rule,price,dynamic);
  const profit=base.netProfit+credit,margin=profit/price;
  return {price:round(price),discount,credit,profit,margin,baseProfit:base.netProfit,baseMargin:base.margin};
}
function participationBody(campaign,candidate,price) {
  if(!SUPPORTED.has(campaign.type))throw new Error('Tipo de campanha não habilitado.');
  const body={promotion_id:campaign.id,promotion_type:campaign.type};
  if(ACCEPT_OFFER.has(campaign.type)) {if(!candidate.offer_id)throw new Error('Identificador da oferta ausente.');body.offer_id=candidate.offer_id;}
  else if(!COFINANCED.has(campaign.type))body.deal_price=price;
  return body;
}
function sellerCampaign(input,now=new Date()) {
  const name=String(input.name || '').trim();if(name.length<3 || name.length>80)throw new Error('Nome da campanha deve ter entre 3 e 80 caracteres.');
  const start=String(input.start || ''),end=String(input.end || '');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end))throw new Error('Informe as datas da campanha.');
  const a=new Date(start+'T00:00:00Z'),b=new Date(end+'T00:00:00Z');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  if(!Number.isFinite(a.getTime()) || a.toISOString().slice(0,10)!==start || !Number.isFinite(b.getTime()) || b.toISOString().slice(0,10)!==end || start<today || b<a || (b-a)/86400000>=14)throw new Error('Use datas a partir de hoje, com até 14 dias incluindo início e fim.');
  return {promotion_type:'SELLER_CAMPAIGN',sub_type:'FLEXIBLE_PERCENTAGE',name,start_date:start+'T00:00:00',finish_date:end+'T00:00:00'};
}
async function previewCampaign(pool,rows,owner,campaign,newCampaign) {
  const op=await service.beginOperation(pool,'promocao',owner,{preparing:true});
  setImmediate(()=>service.runLocked(pool,op,()=>prepareCampaign(pool,rows,op,campaign,newCampaign)).catch(()=>{}));return op;
}
async function prepareCampaign(pool,rows,op,campaign,newCampaign) {
  const account={seller_id:op.seller},api=new service.MeliClient(pool),entries=[],dynamic=await pricing.freightRules(pool);
  const remote=newCampaign?[]:await campaignItems(api,campaign),duplicates=new Map();
  for(const row of rows){const id=String(row.row.id_loja).trim().toUpperCase();duplicates.set(id,(duplicates.get(id)||0)+1);}
  for(const row of rows) {const entry={link:row.row.id,sku:row.row.sku,anuncio:row.row.id_loja,fingerprint:fingerprint(row)};
    try {const id=service.itemId(row.row.id_loja);entry.anuncio=id;if(duplicates.get(id)>1)throw new Error('MLB duplicado na base. Corrija os vínculos.');
      if(!(Number(row.row.estoque)>0))throw new Error('Produto sem saldo em estoque.');
      if(row.result.status!=='OK')throw new Error('Cadastro sem cálculo de preço válido.');
      const snap=await service.snapshot(api,id,account.seller_id);entry.anterior=snap.price.gross;entry.liquidoAtual=snap.price.amount;entry.promocional=snap.price.amount < snap.price.gross-0.005;entry.bruto=snap.price.gross;
      if(snap.item.status!=='active' || snap.item.condition!=='new' || snap.item.listing_type_id==='free')throw new Error('Anúncio precisa estar ativo, novo e com exposição paga.');
      const candidates=remote.filter(c=>c.id===id);
      const candidate=newCampaign?{id,status:'candidate'}:candidates.length===1?candidates[0]:null;
      if(!candidate || candidate.status!=='candidate')throw new Error(candidates.length>1?'Mais de uma oferta para o MLB. Revise no Mercado Livre.':'Item não é candidato ou já participa da campanha.');
      const terms=campaignTerms(campaign,candidate,row,snap.price.gross,dynamic);
      Object.assign(entry,{liquido:terms.price,discount:terms.discount,credit:terms.credit,profit:terms.profit,margin:terms.margin,baseProfit:terms.baseProfit,candidateKey:candidateKey(candidate),status:'Pronto'});
    }catch(e){entry.status='Bloqueado';entry.motivo=e.message;}entries.push(entry);await service.appendResult(pool,op.id,{sku:entry.sku,anuncio:entry.anuncio,status:entry.status,motivo:entry.motivo});}
  await pool.query("UPDATE ml_operacoes SET status='previa',dados=$2,atualizado_em=NOW(),expira_em=NOW()+INTERVAL '20 minutes' WHERE id=$1",[op.id,JSON.stringify({entries,campaign,newCampaign})]);
}
async function executeCampaign(pool,op) {
  const api=new service.MeliClient(pool);
  await finish(pool,op,async report=>{
    const freshRows=await localRows(pool,{stock:'all'}),dynamic=await pricing.freightRules(pool);
    let campaign=op.dados.campaign;
    if(op.dados.newCampaign) {
      // Validate every selected item before creating the remote campaign.
      sellerCampaign({name:op.dados.newCampaign.name,start:op.dados.newCampaign.start_date.slice(0,10),end:op.dados.newCampaign.finish_date.slice(0,10)});
      for(const entry of op.dados.entries) {
        const row=freshRows.find(i=>String(i.row.id)===String(entry.link));if(!row || fingerprint(row)!==entry.fingerprint)throw new Error('Cadastro, estoque ou cálculo mudou. Prepare novamente.');
        const snap=await service.snapshot(api,entry.anuncio,op.seller_id);
        if(snap.item.status!=='active' || Math.abs(snap.price.gross-entry.anterior)>0.005)throw new Error('Anúncio ou bruto mudou. Prepare novamente antes de criar a campanha.');
        const terms=campaignTerms(campaign,{id:entry.anuncio,status:'candidate'},row,snap.price.gross,dynamic);
        if(Math.abs(terms.profit-entry.profit)>0.005 || Math.abs(terms.margin-entry.margin)>0.000001)throw new Error('Margem mudou desde a prévia. Prepare novamente antes de criar a campanha.');
        await pool.query('UPDATE ml_operacoes SET atualizado_em=NOW() WHERE id=$1',[op.id]);
      }
      await service.appendResult(pool,op.id,{status:'Criação iniciada',motivo:'Se houver interrupção, consulte as campanhas no Mercado Livre antes de criar novamente.'});
      const created=await api.request('POST','/seller-promotions/promotions',{app_version:'v2'},op.dados.newCampaign);
      if(!created.id || created.type!=='SELLER_CAMPAIGN')throw new Error('Criação sem identificação confirmada. Consulte as campanhas antes de repetir.');
      campaign={...created,type:'SELLER_CAMPAIGN'};op.dados.createdCampaign=campaign;await pool.query('UPDATE ml_operacoes SET dados=$2,atualizado_em=NOW() WHERE id=$1',[op.id,JSON.stringify(op.dados)]);
      await service.appendResult(pool,op.id,{status:'Campanha criada',motivo:'Identificador: '+campaign.id});
    }else{const found=(await campaigns(api,op.seller_id)).find(c=>c.id===campaign.id && c.type===campaign.type);if(!found || !['pending','started'].includes(found.status))throw new Error('Campanha não está mais disponível. Prepare novamente.');campaign=found;}
    const candidates=await campaignItems(api,campaign);
    for(const entry of op.dados.entries) {let result={sku:entry.sku,anuncio:entry.anuncio,bruto:entry.bruto,liquido:entry.liquido};
      try {const row=freshRows.find(i=>String(i.row.id)===String(entry.link));if(!row || fingerprint(row)!==entry.fingerprint)throw new Error('Cadastro ou cálculo mudou. Prepare novamente.');
        const snap=await service.snapshot(api,entry.anuncio,op.seller_id);if(snap.item.status!=='active' || !(Number(row.row.estoque)>0))throw new Error('Anúncio inativo ou sem estoque.');
        if(Math.abs(snap.price.gross-entry.anterior)>0.005)throw new Error('Preço bruto mudou desde a prévia. Prepare novamente.');
        const matches=candidates.filter(c=>c.id===entry.anuncio),candidate=matches.length===1?matches[0]:null;
        if(!candidate || candidate.status!=='candidate')throw new Error('Item não é candidato ou já participa. Consulte a campanha.');
        if(!op.dados.newCampaign && candidateKey(candidate)!==entry.candidateKey)throw new Error('Condições da oferta mudaram. Revise uma nova prévia.');
        const terms=campaignTerms(campaign,candidate,row,snap.price.gross,dynamic);if(Math.abs(terms.price-entry.liquido)>0.005 || Math.abs(terms.credit-entry.credit)>0.005 || Math.abs(terms.profit-entry.profit)>0.005 || Math.abs(terms.margin-entry.margin)>0.000001)throw new Error('Preço, benefício ou margem mudou desde a prévia. Prepare novamente.');
        const body=participationBody(campaign,candidate,terms.price);
        await service.appendResult(pool,op.id,{...result,status:'Envio iniciado',motivo:'Campanha '+campaign.id+'. Consulte a participação se houver interrupção.'});
        const accepted=await api.request('POST','/seller-promotions/items/'+entry.anuncio,{app_version:'v2'},body);
        if(!Number.isFinite(Number(accepted.price)) || Math.abs(Number(accepted.price)-terms.price)>0.005)throw new Error('Participação enviada, mas preço não confirmado. Confira a campanha antes de repetir.');
        result.status='Incluído';result.motivo='Campanha '+campaign.id;try{const confirmed=await service.snapshot(api,entry.anuncio,op.seller_id);await service.savePrice(pool,{id:entry.link},confirmed.price);}catch(e){result.motivo+=' · Participação confirmada; preço local pendente de nova consulta.';}
      }catch(e){result={...result,status:'Pendente',motivo:e.message};}await report(result);
    }
  });
}
function pricesTable(rows,req) {
  const costKeys=[['Frete','freight'],['Taxa por pedido','fixedFee'],['Comissão Valor','commissionValue'],['TX Cartão','cardValue'],['Receber do MKP','marketplaceReceivable'],['ADS','adsValue'],['CMV','costValue'],['ADM','adminValue'],['Imposto','taxValue'],['Total custos','totalCosts'],['Lucro líquido','netProfit'],['Margem líquida','margin']];
  const forms=[];
  const body=rows.map(i=>{
    const id=String(i.row.id),formId='gross-'+id,p=i.published || {},d=i.result.details || {},ok=i.result.status==='OK';
    forms.push(`<form id="${escape(formId)}" method="post" action="${ROOT}/precos/editar/${escape(id)}">${csrf(req)}<input type="hidden" name="filters" value="${escape(new URLSearchParams({search:req.query.search || '',stock:req.query.stock || '',grossStatus:req.query.grossStatus || ''}).toString())}"></form>`);
    const input=ok?`<input form="${escape(formId)}" aria-label="Novo Bruto ${escape(i.row.sku)}" class="ml-gross ${i.result.grossManual?'manual':''}" type="text" inputmode="decimal" name="valor" required pattern="[0-9]+([,.][0-9]{1,2})?" value="${Number(i.result.grossPrice).toFixed(2).replace('.',',')}" title="Pressione Enter para salvar">`:'-';
    const cell=(v,cls='')=>`<td class="${cls}">${v}</td>`;
    return '<tr>'+cell(`<input type="checkbox" name="links" value="${escape(id)}" ${!ok?'disabled':''}>`)+cell(`${escape(i.row.sku)}<br>${escape(i.row.id_loja)}`)+cell(escape(i.row.produto_nome || i.row.nome),'ml-description')+cell(i.row.estoque_matriz==null?'Não atualizado':Number(i.row.estoque_matriz).toLocaleString('pt-BR'))+cell(i.row.estoque_full==null?'Não atualizado':Number(i.row.estoque_full['Mercado Livre'] ?? 0).toLocaleString('pt-BR'))+cell(money(p.grossPrice))+cell(percent(p.discount))+cell(money(p.liquidPrice))+cell(p.details?percent(p.details.margin):'-')+cell((p.catalogListing?'Catálogo<br>':'')+(p.benefit?.status==='pending'?'Pendente':p.benefit?money(p.benefit.amount)+(p.benefit.estimated?'<br>Estimado':''):'-'))+cell(escape(i.grossStatus))+cell(input,'ml-green')+cell(ok?percent(i.result.discount):'-','ml-green')+cell(ok?money(i.result.finalPrice):'-','ml-blue')+costKeys.map(([label,key])=>cell(ok?(key==='margin'?percent(d[key]):money(d[key])):'-', ['marketplaceReceivable','netProfit','margin'].includes(key)?'ml-blue':'ml-green')).join('')+cell(ok?money(i.result.finalPrice-p.liquidPrice):'-')+cell(escape(pricing.marketplaceReviewStatus(i)))+'</tr>';
  }).join('');
  const headers=['Selecionar','SKU / anúncio','Produto','Estoque Matriz','Estoque Full','Preço Bruto publicado','Desconto aplicado','Preço líquido em vigor','Margem','Benefício Meli','Status do Bruto','Novo Bruto','Desconto','Novo Líquido',...costKeys.map(c=>c[0]),'Diferença líquida R$','Status'];
  return `<style>.mla{max-width:none}.ml-prices{min-width:2400px}.hide-green .ml-prices{min-width:1500px}.ml-prices th{white-space:normal;min-width:90px;max-width:130px}.ml-prices td{white-space:nowrap;overflow-wrap:normal}.mla .ml-prices th{white-space:normal;overflow-wrap:normal;min-width:100px;max-width:130px}.ml-prices .ml-description{white-space:normal;min-width:240px;max-width:340px}.ml-green{background:#e4f3dd}.ml-blue{background:#dceaff}.mla input.ml-gross{box-sizing:border-box;width:90px;font-size:11px;margin:0;padding:5px;color:#111}.mla input.ml-gross.manual{color:#2459dc;font-weight:bold}.mla.hide-green .ml-green,.mla.hide-description .ml-description{display:none}</style><p><label><input type="checkbox" data-hide="hide-green">Esconder colunas verdes</label><label><input type="checkbox" data-hide="hide-description">Esconder descrição</label></p><form method="post" action="${ROOT}/precos/previa">${csrf(req)}<label><input type="checkbox" data-select-all>Selecionar todos os itens exibidos</label><div class="scroll"><table class="ml-prices"><thead><tr>${headers.map((h,n)=>`<th class="${n===2?'ml-description':n===11||n===12||n>=14&&n<=23&&n!==18?'ml-green':[13,18,24,25].includes(n)?'ml-blue':''}">${escape(h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div><p><button>Preparar prévia dos selecionados</button></p></form>${forms.join('')}<script>document.querySelectorAll('.ml-gross').forEach(el=>el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const form=document.getElementById(el.getAttribute('form'));if(form.reportValidity())form.requestSubmit();}}));document.querySelectorAll('[data-hide]').forEach(el=>el.addEventListener('change',()=>el.closest('.mla').classList.toggle(el.dataset.hide,el.checked)));</script>${selectionScript()}`;
}

function mount(router,pool,renderShell) {
  const show=(req,res,html)=>res.send(renderShell(req,html,{title:'Mercado Livre',subtitle:'Revisão de preços e participação em promoções'}));
  const route=(path,method,fn)=>router[method](path,async(req,res)=>{try{await service.ensureTables(pool);await fn(req,res);}catch(e){req.session.mlFeedback={ok:false,message:e.message};res.redirect(ROOT);}});
  route('/precos','get',async(req,res)=>{const rows=await localRows(pool,req.query);show(req,res,page(`<h2>Novos preços brutos</h2>${filterForm('precos',req.query)}<p>Edite o Novo Bruto e pressione Enter para salvar. O Novo Líquido calculado permanece fixo. A sincronização envia somente o bruto padrão; ajuste as promoções no Mercado Livre.</p>${pricesTable(rows,req)}`));});
  route('/precos/editar/:id','post',async(req,res)=>{
    if(!/^\d+$/.test(req.params.id))throw new Error('Anúncio inválido.');
    const value=Number(String(req.body.valor || '').trim().replace(',','.'));
    if(!Number.isFinite(value) || value<=0 || value>99999999999)throw new Error('Informe um bruto positivo dentro do limite permitido.');
    const saved=await pool.query("UPDATE tabela_preco_vinculos SET novo_bruto_manual=$2 WHERE id=$1 AND marketplace='Mercado Livre' RETURNING id",[req.params.id,value]);
    if(!saved.rowCount)throw new Error('Anúncio não encontrado.');
    const filters=new URLSearchParams(String(req.body.filters || ''));
    for(const key of [...filters.keys()])if(!['search','stock','grossStatus'].includes(key))filters.delete(key);
    res.redirect(ROOT+'/precos?'+filters.toString());
  });
  route('/precos/previa','post',async(req,res)=>{const selected=new Set((Array.isArray(req.body.links)?req.body.links:[req.body.links]).filter(Boolean).map(String));const rows=(await localRows(pool,{stock:'all'})).filter(i=>selected.has(String(i.row.id)));if(!rows.length || rows.length!==selected.size)throw new Error('Selecione anúncios válidos.');const op=await previewPrices(pool,rows,user(req));req.session.mlFeedback={ok:true,message:'Preparando a prévia em segundo plano. Ao terminar, clique em Revisar prévia no histórico.'};res.redirect(ROOT);});
  route('/previa/:id','get',async(req,res)=>{if(!/^[\da-f-]{36}$/i.test(req.params.id))throw new Error('Prévia inválida.');const op=(await pool.query("SELECT * FROM ml_operacoes WHERE id=$1 AND usuario=$2 AND status='previa' AND expira_em>NOW()",[req.params.id,user(req)])).rows[0];if(!op)throw new Error('Prévia expirada ou já confirmada.');show(req,res,previewTable(op,req));});
  route('/confirmar/:id','post',async(req,res)=>{if(req.body.confirm!=='yes')throw new Error('Confirme a publicação dos itens selecionados.');const op=await claim(pool,req.params.id,user(req),req.body.selected);setImmediate(()=>service.runLocked(pool,op,()=>op.tipo==='brutos'?executePrices(pool,op):executeCampaign(pool,op)).catch(()=>{}));req.session.mlFeedback={ok:true,message:'Envio confirmado. Acompanhe o resultado por anúncio no histórico.'};res.redirect(ROOT);});
  route('/promocoes','get',async(req,res)=>{const account=(await service.state(pool)).account;if(!account.seller_id)throw new Error('Conecte a conta primeiro.');const list=await campaigns(new service.MeliClient(pool),account.seller_id);
    show(req,res,page(`<h2>Promoções disponíveis</h2><p>Consulte as condições e selecione os itens antes de confirmar. A API determina a elegibilidade de cada anúncio.</p><div class="scroll"><table><thead><tr><th>Campanha</th><th>Tipo</th><th>Status</th><th>Benefício ML</th><th>Analisar</th></tr></thead><tbody>${list.map(c=>{const key=campaignKey(c);return `<tr><td>${escape(c.name)}<br>${escape(c.id)}</td><td>${escape(c.type)}</td><td>${escape(c.status)}</td><td>${c.benefits?.meli_percent!=null?percent(Number(c.benefits.meli_percent)/100):'-'}</td><td><a href="${ROOT}/promocoes/analisar?${new URLSearchParams(key)}">Consultar itens</a></td></tr>`;}).join('')}</tbody></table></div><h2>Criar campanha própria</h2><p>Use todos os itens filtrados com estoque positivo, o Novo Líquido calculado e o bruto já publicado no Mercado Livre. Descontos abaixo de 5% exigem ajustar o bruto primeiro. A campanha admite até 14 dias e depende da reputação e elegibilidade da conta.</p><form method="post" action="${ROOT}/promocoes/criar-previa">${csrf(req)}<label>Nome<input name="name" required minlength="3" maxlength="80"></label><label>Início<input type="date" name="start" required></label><label>Fim<input type="date" name="end" required></label><label>SKU ou produto<input name="search"></label><button>Preparar prévia da campanha própria</button></form>`));});
  route('/promocoes/analisar','get',async(req,res)=>{const account=(await service.state(pool)).account,api=new service.MeliClient(pool);const campaign=(await campaigns(api,account.seller_id)).find(c=>c.id===req.query.promotion && c.type===req.query.type);if(!campaign)throw new Error('Campanha indisponível.');const rows=await localRows(pool,req.query),candidates=await campaignItems(api,campaign);const dynamic=await pricing.freightRules(pool);
    show(req,res,page(`<h2>${escape(campaign.name)}</h2>${filterForm('promocoes/analisar',req.query,`<input type="hidden" name="promotion" value="${escape(campaign.id)}"><input type="hidden" name="type" value="${escape(campaign.type)}">`)}<p class="warn">Lucro e margem são estimativas pelas regras do Plennatec. Na coparticipação, a bonificação é estimada sobre o preço original informado pelo Mercado Livre e pode ser compensada nos custos por venda. Confira as condições antes de aceitar. Ofertas com bonificação adicional automática ficam pendentes de revisão.</p><form method="post" action="${ROOT}/promocoes/previa">${csrf(req)}<input type="hidden" name="promotion" value="${escape(campaign.id)}"><input type="hidden" name="type" value="${escape(campaign.type)}"><label><input type="checkbox" data-select-all>Selecionar todos os candidatos exibidos</label><div class="scroll"><table><thead><tr><th>Selecionar</th><th>SKU / MLB</th><th>Status API</th><th>Preço promoção</th><th>Bonificação estimada</th><th>Lucro estimado</th><th>Margem estimada</th><th>Observação</th></tr></thead><tbody>${rows.map(i=>{const matches=candidates.filter(c=>c.id===String(i.row.id_loja).trim().toUpperCase()),c=matches.length===1?matches[0]:null;let terms,note='',enabled=false;try{if(!c || c.status!=='candidate')throw new Error(c?'Já participante ou não disponível':'Sem candidatura para este MLB');if(i.result.status!=='OK')throw new Error('Cálculo inválido');terms=campaignTerms(campaign,c,i,Number(c.original_price)||i.published.grossPrice,dynamic);enabled=SUPPORTED.has(campaign.type);}catch(e){note=e.message;}return `<tr><td><input type="checkbox" name="links" value="${escape(i.row.id)}" ${!enabled?'disabled':''}></td><td>${escape(i.row.sku)}<br>${escape(i.row.id_loja)}</td><td>${escape(c?.status || '-')}</td><td>${terms?money(terms.price):'-'}</td><td>${terms?money(terms.credit):'-'}</td><td>${terms?money(terms.profit):'-'}</td><td>${terms?percent(terms.margin):'-'}</td><td>${escape(note || (enabled?'Disponível para prévia':'Tipo de campanha com consulta apenas'))}</td></tr>`;}).join('')}</tbody></table></div><button ${!SUPPORTED.has(campaign.type)?'disabled':''}>Revisar participação dos selecionados</button></form>${selectionScript()}`));});
  route('/promocoes/previa','post',async(req,res)=>{const account=(await service.state(pool)).account,api=new service.MeliClient(pool),campaign=(await campaigns(api,account.seller_id)).find(c=>c.id===req.body.promotion && c.type===req.body.type);if(!campaign || !SUPPORTED.has(campaign.type))throw new Error('Campanha indisponível para publicação.');
    const selected=new Set((Array.isArray(req.body.links)?req.body.links:[req.body.links]).filter(Boolean).map(String));const rows=(await localRows(pool,{stock:'all'})).filter(i=>selected.has(String(i.row.id)));if(!rows.length || rows.length!==selected.size)throw new Error('Selecione itens válidos.');const op=await previewCampaign(pool,rows,user(req),campaign);req.session.mlFeedback={ok:true,message:'Preparando a prévia em segundo plano. Ao terminar, clique em Revisar prévia no histórico.'};res.redirect(ROOT);});
  route('/promocoes/criar-previa','post',async(req,res)=>{const creation=sellerCampaign(req.body),rows=await localRows(pool,{search:req.body.search,stock:'positive'});if(!rows.length)throw new Error('Nenhum anúncio com estoque para a campanha.');const op=await previewCampaign(pool,rows,user(req),{type:'SELLER_CAMPAIGN',name:creation.name},creation);req.session.mlFeedback={ok:true,message:'Preparando a prévia em segundo plano. Ao terminar, clique em Revisar prévia no histórico.'};res.redirect(ROOT);});
}
function selectionScript(){return `<script>document.querySelectorAll('[data-select-all]').forEach(el=>el.addEventListener('change',()=>el.closest('form').querySelectorAll('input[name="links"]:not(:disabled)').forEach(c=>c.checked=el.checked)))</script>`;}
module.exports={mount,fingerprint,validateGross,campaignItems,campaignTerms,sellerCampaign,candidateKey,claim,previewPrices,executePrices,participationBody,previewTable,pricesTable};
