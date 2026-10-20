const crypto=require('crypto');
const ml=require('./mercado-livre'),pricing=require('../tabela-precos/service');
const {calculatePriceSimulation}=require('../tabela-precos/pricing');
const ROOT=ml.ROOT+'/central-promocoes',PATH='/central-promocoes';
const decisions=['Participar','Analisar','Não participar'];
const flexible=new Set(['SELLER_CAMPAIGN','DEAL','LIGHTNING','DOD','PRICE_DISCOUNT']);
const fixed=new Set(['MARKETPLACE_CAMPAIGN','SMART','PRICE_MATCHING','PRE_NEGOTIATED','UNHEALTHY_STOCK']);
const acceptOffer=new Set(['SMART','PRICE_MATCHING','PRE_NEGOTIATED','UNHEALTHY_STOCK']);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>v==null||!Number.isFinite(Number(v))?'—':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const pct=v=>v==null||!Number.isFinite(Number(v))?'—':(v*100).toLocaleString('pt-BR',{maximumFractionDigits:2})+'%';
const round=v=>Math.round((Number(v)+Number.EPSILON)*100)/100;
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const owner=req=>String(req.session.usuario.id||req.session.usuario.email||req.session.usuario.nome);
const key=c=>c.type+':'+c.id;
const offerKey=c=>String(c.offer_id||c.ref_id||c.id);
function campaignName(c){
 const name=String(c.name||'').trim(),normalized=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(c.type==='SMART'&&normalized==='impulsione suas vendas')return 'Com redução de tarifas';
 if(c.type==='SMART_LIGHTNING')return 'Oferta relâmpago com redução de tarifas';
 if(c.type==='LIGHTNING'&&(!name||name==='LIGHTNING'))return 'Oferta relâmpago';
 if(c.type==='DOD'&&(!name||['DOD','Desconto individual'].includes(name)))return 'Oferta do dia';
 return name||({PRICE_DISCOUNT:'Desconto individual',LIGHTNING:'Oferta relâmpago',DOD:'Oferta do dia'}[c.type]||c.type);
}
function campaignPeriod(c){const date=v=>{const d=new Date(v);return v&&!Number.isNaN(d.getTime())?d.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}):''};const start=date(c.start_date),finish=date(c.finish_date);return start&&finish?start+' a '+finish:start||finish;}
function campaignReference(c){const name=campaignName(c),source=String(c.name||'').trim();return source&&source!==name?'<p><small>Nome recebido da integração: '+esc(source)+'.</small></p>':'';}

async function ensure(pool){await ml.ensureTables(pool);await pool.query(`CREATE TABLE IF NOT EXISTS ml_promo_catalogo(seller TEXT PRIMARY KEY,dados JSONB NOT NULL,atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW());CREATE TABLE IF NOT EXISTS ml_promo_decisoes(seller TEXT NOT NULL,campanha TEXT NOT NULL,anuncio TEXT NOT NULL,oferta TEXT NOT NULL,dados JSONB NOT NULL,atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(seller,campanha,anuncio,oferta))`);}
function suggestion(margin,profit,minProfit=0){return margin==null?'Analisar':profit<minProfit?'Analisar':margin>.10+1e-9?'Participar':margin<.08-1e-9?'Não participar':'Analisar';}
function scenario(campaign,candidate,item,dynamic=[],input={}){
 const type=campaign.type,gross=Number(item.published?.grossPrice),bonus=Number(candidate.meli_percentage)>0||Number(candidate.discount_meli_boost_amount)>0||fixed.has(type);
 const editable=flexible.has(type)&&!bonus;
 let price=editable?(input.price==null||input.price===''?round(item.result.finalPrice-(type==='SELLER_CAMPAIGN'?0:.10)):Number(String(input.price).replace(',','.'))):Number(candidate.price);
 let credit=0,estimated=false;
 if(bonus){
  if(candidate.meli_percentage!=null){if(!(Number(candidate.original_price)>0)||!Number.isFinite(Number(candidate.meli_percentage))||Number(candidate.meli_percentage)<0||Number(candidate.meli_percentage)>100)throw Error('Benefício Meli sem base válida.');credit=round(Number(candidate.original_price)*Number(candidate.meli_percentage)/100);estimated=credit>0;}
  else if(fixed.has(type))throw Error('Benefício Meli incompleto.');
 }
 if(candidate.boosted_offer){const boost=Number(candidate.discount_meli_boost_amount);if(!Number.isFinite(boost)||boost<0||!(Number(candidate.total_price_for_boosted_offer)>0))throw Error('Oferta com boost incompleto.');price=Number(candidate.total_price_for_boosted_offer);credit=round(credit+boost);}
 if(!(price>0)||!Number.isFinite(price)||!(gross>0)||price>=gross)throw Error('Preço deve ser positivo e menor que o bruto publicado.');
 if(!item.rule||!item.product||!(item.product.cost>0)||!(item.product.weight>0)||item.result.status!=='OK')throw Error('Custo, peso ou cálculo de preço incompleto.');
 const d=calculatePriceSimulation(item.product,item.rule,price,credit,dynamic),profit=round(d.netProfit),margin=profit/price;
 const problems=[];
 if(!flexible.has(type)&&!fixed.has(type))problems.push('Tipo disponível para análise; envio sem contrato de API validado.');
 if(candidate.boosted_offer)problems.push('Boost automático: revisar no portal; envio bloqueado para não alterar o benefício.');
 if(candidate.min_discounted_price>0&&price<Number(candidate.min_discounted_price)-.005||candidate.max_discounted_price>0&&price>Number(candidate.max_discounted_price)+.005)problems.push('Preço fora dos limites da oferta.');
 if(type==='SELLER_CAMPAIGN'&&1-price/gross<.05-1e-9)problems.push('Campanha própria exige pelo menos 5% de desconto.');
 if(acceptOffer.has(type)&&!candidate.offer_id)problems.push('API não retornou offer_id para aceitar a oferta.');
 const status=candidate.status;
 if(status!=='candidate'&&!(type==='SELLER_CAMPAIGN'&&['pending','started'].includes(status)))problems.push('Já participante ou status sem alteração habilitada.');
 if(type==='SELLER_CAMPAIGN'&&status!=='candidate'&&(candidate.sub_type||campaign.sub_type)!=='FLEXIBLE_PERCENTAGE')problems.push('Campanha não permite edição flexível.');
 if(type==='SELLER_CAMPAIGN'&&status==='started'&&price>=Number(candidate.price)-.005)problems.push('Oferta ativa só permite melhorar o preço.');
 const stock=Math.floor(Number(item.row.estoque)||0);
 if(stock<1)problems.push('Sem estoque disponível.');
 let quantity=null;
 if(type==='LIGHTNING'){
  const min=Number(candidate.stock?.min),max=Number(candidate.stock?.max);
  quantity=Number(input.quantity||Math.min(stock,max||stock));
  if(!Number.isInteger(quantity)||!Number.isFinite(min)||!Number.isFinite(max)||quantity<min||quantity>max||quantity>stock)problems.push('Informe estoque de reserva dentro dos limites da oferta e do estoque disponível.');
 }
 return {price:round(price),gross,credit,estimated,editable,details:d,profit,margin,receivable:round(d.marketplaceReceivable),quantity,discount:1-price/gross,problems,suggested:estimated?'Analisar':suggestion(margin,profit,Number(item.rule.minProfit)||0)};
}
function payload(c,candidate,s){
 if(s.problems.length)throw Error(s.problems.join(' '));
 const body={promotion_type:c.type};
 if(!['LIGHTNING','DOD','PRICE_DISCOUNT'].includes(c.type))body.promotion_id=c.id;
 if(acceptOffer.has(c.type))body.offer_id=candidate.offer_id;
 else if(!fixed.has(c.type))body.deal_price=s.price;
 if(c.type==='LIGHTNING')body.stock=s.quantity;
 return {method:c.type==='SELLER_CAMPAIGN'&&candidate.status!=='candidate'?'PUT':'POST',body};
}
async function local(pool){return (await pricing.marketplaceRows(pool,{marketplace:'Mercado Livre'})).filter(i=>!i.row.sem_vinculo&&/^MLB\d+$/.test(String(i.row.id_loja).trim().toUpperCase()));}
function basis(item,candidate,campaign){return hash({item:require('./mercado-livre-actions').fingerprint(item),candidate,campaign});}
async function refresh(pool,op){
 try{
  const api=new ml.MeliClient(pool),a=require('./mercado-livre-actions'),list=await a.campaigns(api,op.seller),by=new Map(),errors=[];
  for(const c of list){if(!c.id)continue;const k=key(c);if(!by.has(k))by.set(k,{campaign:c,items:[]});try{by.get(k).items=await a.campaignItems(api,c);}catch(e){by.get(k).error=e.message;errors.push(c.name+': '+e.message);}}
  const ids=[...new Set((await local(pool)).map(i=>String(i.row.id_loja).trim().toUpperCase()))];
  for(let n=0;n<ids.length;n++){
   try{const offers=await api.get('/seller-promotions/items/'+ids[n],{app_version:'v2'});if(!Array.isArray(offers))throw Error('Resposta incompleta');
    for(const o of offers){const id=o.id||(o.type==='PRICE_DISCOUNT'?'DESCONTO-INDIVIDUAL':null);if(!id)continue;const c={...o,id},k=key(c);if(!by.has(k))by.set(k,{campaign:{id,type:o.type,name:o.name||({DOD:'Oferta do dia',LIGHTNING:'Oferta relâmpago',PRICE_DISCOUNT:'Desconto individual'}[o.type]||o.type),status:'started',sub_type:o.sub_type},items:[]});const b=by.get(k);const found=b.items.filter(i=>i.id===ids[n]);const enriched={...o,id:ids[n],offer_id:o.offer_id||(String(o.ref_id||'').startsWith('OFFER-')?o.ref_id:undefined)};
     const exact=enriched.offer_id?found.filter(i=>i.offer_id===enriched.offer_id):found;
     const match=exact.length===1?exact[0]:(found.length===1&&!found[0].offer_id?found[0]:null);
     if(match)b.items[b.items.indexOf(match)]={...match,...enriched,offer_id:enriched.offer_id||match.offer_id};
     else if(!found.length||enriched.offer_id&&!found.some(i=>i.offer_id===enriched.offer_id))b.items.push(enriched);
    }
   }catch(e){errors.push(ids[n]+': '+e.message);}
   if(n%10===0)await pool.query('UPDATE ml_operacoes SET dados=$2,atualizado_em=NOW() WHERE id=$1',[op.id,JSON.stringify({progress:n+1,total:ids.length})]);
  }
  const data={campaigns:[...by.values()],errors,items:ids.length,updatedAt:new Date().toISOString()};
  const client=await pool.connect();try{await client.query('BEGIN');const account=(await client.query('SELECT seller_id FROM ml_integracao WHERE id=1 FOR UPDATE')).rows[0];if(account.seller_id!==op.seller)throw Error('Conta conectada mudou. Atualize novamente.');await client.query('INSERT INTO ml_promo_catalogo(seller,dados) VALUES($1,$2) ON CONFLICT(seller) DO UPDATE SET dados=EXCLUDED.dados,atualizado_em=NOW()',[op.seller,JSON.stringify(data)]);await client.query("UPDATE ml_operacoes SET status=$2,dados=$3,atualizado_em=NOW() WHERE id=$1",[op.id,errors.length?'parcial':'concluida',JSON.stringify({campaigns:data.campaigns.length,items:ids.length,errors})]);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
 }catch(e){await ml.appendResult(pool,op.id,{status:'Falhou',motivo:e.message});await pool.query("UPDATE ml_operacoes SET status='falhou',atualizado_em=NOW() WHERE id=$1",[op.id]);}
}
async function model(pool,seller,campaignId){
 const catalog=(await pool.query('SELECT dados FROM ml_promo_catalogo WHERE seller=$1',[seller])).rows[0]?.dados;
 const group=catalog?.campaigns.find(g=>key(g.campaign)===campaignId);
 if(!group)return {catalog};
 const rows=await local(pool),dynamic=await pricing.freightRules(pool),saved=(await pool.query('SELECT anuncio,oferta,dados FROM ml_promo_decisoes WHERE seller=$1 AND campanha=$2',[seller,campaignId])).rows;
 const entries=group.items.map((candidate,index)=>{
  const matches=rows.filter(i=>String(i.row.id_loja).trim().toUpperCase()===candidate.id),item=matches.length===1?matches[0]:null;
  const edit=saved.find(s=>s.anuncio===candidate.id&&s.oferta===offerKey(candidate))?.dados;
  const entry={candidate,item,index,edit,decision:'Analisar'};
  try{if(!item)throw Error(matches.length?'MLB duplicado nos vínculos':'Sem vínculo SKU para este anúncio');entry.basis=basis(item,candidate,group.campaign);entry.stale=!!edit&&edit.basis!==entry.basis;entry.scenario=scenario(group.campaign,candidate,item,dynamic,edit||{});entry.decision=!entry.stale&&edit?edit.decision:entry.scenario.suggested;}catch(e){entry.error=e.message;}
  return entry;
 });return {catalog,group,entries};
}
const hidden=(name,value)=>`<input type="hidden" name="${name}" value="${esc(value)}">`;
function shell(body){return `<style>.mp{font:13px Arial;color:#183029}.mp .panel{background:white;border:1px solid #dce7df;border-radius:10px;padding:16px;margin:16px 0}.mp .bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.mp button,.mp .button{display:inline-block;padding:8px 12px;border:1px solid #cbded1;border-radius:6px;background:#eff7f2;color:#075438;text-decoration:none;cursor:pointer}.mp input,.mp select{padding:7px;border:1px solid #cadbd0;border-radius:5px;max-width:190px}.mp button:disabled{opacity:.4;cursor:default}.mp .scroll{max-height:65vh;overflow:auto;position:relative}.mp table{border-collapse:separate!important;border-spacing:0;min-width:2900px!important;width:100%;table-layout:auto!important}.mp th,.mp td{padding:9px!important;font-size:11px!important;white-space:nowrap!important;min-width:100px!important;width:auto!important;max-width:none!important;border-bottom:1px solid #e0e9e3}.mp th{position:sticky!important;top:0;background:#edf5ef!important;z-index:2}.mp td.product{white-space:normal!important;min-width:230px!important}.mp small{display:block;font-size:11px;color:#596c60;white-space:normal}.mp .warn{padding:10px;background:#fff6e5;border-radius:6px}.mp .error{color:#a02e21}.mp .negative{color:#ad2828}.mp .price{width:85px}.mp details{position:relative}.mp details[open] select{display:block}.mp h1{font-size:24px;margin:0 0 8px!important}.mp h2{margin:0 0 6px!important}.mp p{margin:6px 0;line-height:1.4}.mp .panel{padding:12px;margin:10px 0}.mp .help{margin:8px 0}.mp #mpCampaign{max-width:min(700px,80vw);width:min(700px,80vw)}.mp a{color:#075438}</style><section class="mp"><h1>Promoção Mercado Livre</h1>${body}</section>`;}
function listing(req,m,jobs){const catalog=m.catalog,list=catalog?.campaigns||[];return shell(`<div class="panel bar"><form method="post" action="${ROOT}/atualizar">${hidden('csrf',req.session.mlCsrf)}<button ${jobs.some(j=>j.status==='executando')?'disabled':''}>Atualizar campanhas e itens do Mercado Livre</button></form><span>${catalog?'Última consulta: '+esc(new Date(catalog.updatedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})):'Nenhuma importação realizada.'}</span></div><p>Atualiza campanhas próprias, convites e ofertas por anúncio, unificando repetições pelo identificador. Não publica participações.</p>${catalog?.errors?.length?`<p class="warn">Consulta com ${catalog.errors.length} pendência(s). Revise antes de enviar.<details><summary>Ver pendências</summary>${catalog.errors.map(esc).join('<br>')}</details></p>`:''}<div class="panel"><label>Selecione a campanha <select id="mpCampaign"><option value="">Selecione</option>${list.map(g=>`<option value="${esc(key(g.campaign))}">${esc(campaignName(g.campaign))}${campaignPeriod(g.campaign)?' · '+esc(campaignPeriod(g.campaign)):''} (${g.items.length} itens)</option>`).join('')}</select></label> <button type="button" id="mpOpen">Analisar campanha</button><details class="help"><summary>Correspondência dos nomes das promoções</summary><ul>${list.filter(g=>campaignName(g.campaign)!==g.campaign.name).map(g=>`<li><strong>${esc(campaignName(g.campaign))}</strong> — ${esc(g.campaign.name||g.campaign.type)}</li>`).join('')}</ul></details></div><div class="panel"><h2>Operações recentes</h2>${jobs.map(j=>`<p>${esc(new Date(j.criado_em).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))} · ${esc(j.tipo)} · <strong>${esc(j.status)}</strong> ${j.dados.progress?esc(j.dados.progress)+' / '+esc(j.dados.total):''} ${j.status==='previa'?`<a href="${ROOT}/revisar/${j.id}">Revisar envio</a>`:''}<a href="${ml.ROOT}/relatorio/${j.id}">Relatório</a>${(j.resultados||[]).slice(-5).map(r=>`<small>${esc(r.sku||r.anuncio||'')} · ${esc(r.status)} · ${esc(r.motivo||'')}</small>`).join('')}</p>`).join('')||'Nenhuma operação.'}</div><script>document.getElementById('mpOpen').onclick=()=>{const c=document.getElementById('mpCampaign').value;if(c)location.href=${JSON.stringify(ROOT)}+'?campaign='+encodeURIComponent(c)};${jobs.some(j=>j.status==='executando')?'setTimeout(()=>location.reload(),10000);':''}</script>`);}
function analysis(req,m){
 const campaign=m.group.campaign;
 const costKeys=['freight','fixedFee','commissionValue','cardValue','marketplaceReceivable','adsValue','costValue','adminValue','taxValue','totalCosts'];
 const headers=['Selecionar','SKU','Código do anúncio','Produto','Estoque Matriz','Estoque Full','Preço Bruto publicado','Desconto Deus é Mais','Preço Líquido Deus é Mais','Líquido calculado Plennatec','Sugestão Meli','Desc. Sugerido','Preço Final Sugerido / envio','Bônus Meli','Valor receber','Lucro Líquido','Margem Líquida','Decisão','Frete','Taxa por Pedido','Comissão Valor','TX Cartão','Receber do MKP','ADS','CMV','ADM','Imposto','Total Custos','Situação / observação'];
 const body=m.entries.map(e=>{const i=e.item,c=e.candidate,s=e.scenario,id=e.index,hiddenFields=hidden('basis['+id+']',e.basis||'');const cell=(v,cl='')=>`<td class="${cl}">${v}</td>`;const own=m.catalog.campaigns.filter(g=>g.campaign.type==='SELLER_CAMPAIGN').flatMap(g=>g.items).filter(o=>o.id===c.id&&['started','pending'].includes(o.status));const current=own.length===1?own[0]:null;
 const selectable=!!s&&!s.problems.length&&!e.stale&&!e.error&&!m.group.error;
 const chosen=e.edit?.decision;
 return `<tr data-decision="${esc(e.decision)}">`+cell(`<input type="checkbox" name="selected" value="${id}" ${!selectable?'disabled':''}>${hiddenFields}`)+cell(esc(i?.row.sku||'—'))+cell(esc(c.id))+cell(esc(i?.row.produto_nome||i?.row.nome||'Sem vínculo'),'product')+cell(i?.row.estoque_matriz==null?'Não atualizado':Math.floor(Number(i.row.estoque_matriz)))+cell(i?.row.estoque_full?.['Mercado Livre']==null?'Não atualizado':Math.floor(Number(i.row.estoque_full['Mercado Livre'])))+cell(money(i?.published?.grossPrice))+cell(current?pct(1-current.price/(i?.published?.grossPrice||current.original_price)):'—')+cell(current?money(current.price):'—')+cell(money(i?.result?.finalPrice))+cell(money(c.suggested_discounted_price||c.price))+cell((c.suggested_discounted_price||c.price)>0&&s?pct(1-(c.suggested_discounted_price||c.price)/s.gross):'—')+cell(s?`<input aria-label="Preço ${esc(c.id)}" class="price" name="price[${id}]" value="${s.price.toFixed(2).replace('.',',')}" ${!s.editable?'readonly':''}><small>Desconto envio: ${pct(s.discount)}</small>${s.editable?`<button type="button" data-reset-price="${round(i.result.finalPrice-(campaign.type==='SELLER_CAMPAIGN'?0:.10))}">Usar regra</button>`:'<small>Preço obrigatório</small>'}`:'—')+cell(s?money(s.credit)+(s.estimated?'<small>Estimado pelo percentual</small>':''):'—')+cell(s?money(s.receivable):'—')+cell(s?money(s.profit):'—',s?.profit<0?'negative':'')+cell(s?pct(s.margin):'—')+cell(`<select aria-label="Decisão ${esc(c.id)}" name="decision[${id}]">${decisions.map(d=>`<option ${e.decision===d?'selected':''}>${d}</option>`).join('')}</select><small>Sugestão: ${esc(s?.suggested||'Analisar')}${chosen?' · Escolha salva':''}</small>`)+costKeys.map(k=>cell(s?money(k==='marketplaceReceivable'?s.receivable:s.details[k]):'—')).join('')+cell(esc(({candidate:'Elegível',started:'Participando',pending:'Programado',finished:'Encerrado'})[c.status]||c.status)+'<small>'+esc(e.error||s?.problems.join(' ')||'Disponível para revisão')+'</small>'+ (e.stale?'<small class="error">Dados mudaram. Revise e salve novamente.</small>':'')+(s?.estimated?'<small>Repasse calculado: conferir com Você recebe no portal.</small>':'')+(campaign.type==='LIGHTNING'&&s?`<label>Estoque reservado <input class="price" aria-label="Reserva ${esc(c.id)}" type="number" min="1" name="quantity[${id}]" value="${s.quantity}"></label>`:''))+'</tr>';
 }).join('');
 return shell(`<a href="${ROOT}">← Campanhas e operações</a><div class="panel"><h2>${esc(campaignName(campaign))}</h2>${campaignReference(campaign)}<p>${esc(campaign.type)} · ${esc(campaign.id)}${campaignPeriod(campaign)?' · '+esc(campaignPeriod(campaign)):''} · Consulta ${esc(new Date(m.catalog.updatedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))} · ${m.entries.length} itens</p><p>${campaign.type==='SELLER_CAMPAIGN'?'Preço de envio: líquido calculado Plennatec.':flexible.has(campaign.type)?'Campanha livre Meli: líquido calculado menos R$ 0,10.':'Oferta com benefício: preço obrigatório do Mercado Livre.'}</p><details class="help"><summary>Como conferir o cálculo e enviar as decisões</summary><p>Repasse = preço ao comprador − frete − taxas − comissão + benefício, uma única vez. Os valores calculados pelas regras locais devem ser conferidos com o portal. Benefícios estimados exigem decisão manual. Salvar a análise não publica preços. Não participar não remove ofertas já ativas.</p></details>${m.entries.some(e=>e.scenario?.estimated)?'<p class="warn">Benefício estimado pelo percentual: confira o repasse no portal antes de aprovar.</p>':''}${m.group.error?`<p class="error">${esc(m.group.error)}</p>`:''}<div class="bar"><label>Buscar SKU / anúncio / produto <input id="mpSearch"></label><label>Estoque <select id="mpStock"><option value="all">Todos</option><option value="positive">Maior que zero</option></select></label><label><input type="checkbox" id="mpAll"> Selecionar itens visíveis</label></div></div><form id="mpAnalysis" method="post" action="${ROOT}/salvar">${hidden('csrf',req.session.mlCsrf)}${hidden('campaign',key(campaign))}<div class="panel scroll"><table><thead><tr>${headers.map(h=>`<th>${h==='Decisão'?`<details><summary>Decisão ▾</summary><select id="mpDecision"><option value="">Todos</option>${decisions.map(d=>'<option>'+d+'</option>').join('')}</select></details>`:esc(h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div><div class="panel bar"><button>Salvar decisões e recalcular</button><label><input type="checkbox" name="review" value="yes"> Revisei os itens selecionados e quero preparar o envio.</label><button formaction="${ROOT}/preparar">${campaign.type==='SELLER_CAMPAIGN'?'Integrar preços na Campanha — revisar':'Preparar participação — revisar'}</button><small>Edite e salve antes de preparar. Somente selecionados com decisão Participar entram na prévia.</small></div></form><script>(()=>{const rows=[...document.querySelectorAll('#mpAnalysis tbody tr')],search=document.getElementById('mpSearch'),decision=document.getElementById('mpDecision'),stock=document.getElementById('mpStock');function filter(){for(const r of rows){const t=r.innerText.toLocaleLowerCase('pt-BR'),ds=r.querySelector('select').value,qty=(Number(r.cells[4].innerText)||0)+(Number(r.cells[5].innerText)||0);r.hidden=!(t.includes(search.value.toLocaleLowerCase('pt-BR'))&&(!decision.value||ds===decision.value)&&(stock.value==='all'||qty>0));}}document.querySelectorAll('[data-reset-price]').forEach(b=>b.onclick=()=>{b.closest('td').querySelector('input').value=Number(b.dataset.resetPrice).toFixed(2).replace('.',',')});search.oninput=filter;decision.onchange=filter;stock.onchange=filter;document.getElementById('mpAll').onchange=e=>{for(const r of rows){const cb=r.querySelector('input[type=checkbox]');if(!r.hidden&&!cb.disabled)cb.checked=e.target.checked}};document.getElementById('mpAnalysis').addEventListener('submit',async e=>{e.preventDefault();const form=e.target,data={csrf:form.elements.csrf.value,campaign:form.elements.campaign.value,basis:{},price:{},quantity:{},decision:{},selected:[],review:form.elements.review.checked?'yes':''};for(const [k,v] of new FormData(form)){const match=k.match(/^(basis|price|quantity|decision)\\[(\\d+)\\]$/);if(match)data[match[1]][match[2]]=v;if(k==='selected')data.selected.push(v);}const button=e.submitter;button.disabled=true;try{const response=await fetch(button.getAttribute('formaction')||form.action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(!response.ok){document.open();document.write(await response.text());document.close();return;}location.href=response.url;}catch(error){alert('Não foi possível salvar. Atualize e confira o resultado antes de repetir.');button.disabled=false;}});})();</script>`);
}
async function freshCandidates(api,campaign,ids){
 if(campaign.type!=='PRICE_DISCOUNT')return require('./mercado-livre-actions').campaignItems(api,campaign);
 const out=[];for(const id of ids){const offers=await api.get('/seller-promotions/items/'+id,{app_version:'v2'});if(!Array.isArray(offers))throw Error('Resposta de ofertas incompleta.');for(const o of offers.filter(o=>o.type==='PRICE_DISCOUNT'))out.push({...o,id});}return out;
}
async function prepare(pool,op,group,selected){
 try{
  const api=new ml.MeliClient(pool),a=require('./mercado-livre-actions'),remote=await freshCandidates(api,group.campaign,selected.map(e=>e.candidate.id)),dynamic=await pricing.freightRules(pool),entries=[];
  for(const e of selected){const entry={link:e.item.row.id,sku:e.item.row.sku,anuncio:e.candidate.id,basis:e.basis};
   try{
    const matches=remote.filter(c=>c.id===entry.anuncio);if(matches.length!==1)throw Error('Oferta ausente ou ambígua. Atualize campanhas.');
    const candidate={...e.candidate,...matches[0]};
    if(a.candidateKey(candidate)!==a.candidateKey(e.candidate))throw Error('Oferta mudou desde a importação. Atualize e revise.');
    const snap=await ml.snapshot(api,entry.anuncio,op.seller);
    if(snap.item.status!=='active'||snap.item.condition!=='new'||!(Number(snap.item.available_quantity)>0))throw Error('Anúncio não está ativo / novo.');
    if(Math.abs(snap.price.gross-e.scenario.gross)>.005)throw Error('Bruto publicado mudou. Atualize preços e campanhas.');
    const s=scenario(group.campaign,candidate,e.item,dynamic,{price:e.scenario.price,quantity:e.scenario.quantity});
    if(s.quantity&&s.quantity>Number(snap.item.available_quantity))throw Error('Estoque reservado maior que o estoque atual do anúncio.');
    payload(group.campaign,candidate,s);
    Object.assign(entry,{status:'Pronto',candidate,candidateKey:a.candidateKey(candidate),fingerprint:a.fingerprint(e.item),scenario:s,liquido:s.price,bruto:s.gross,credit:s.credit,profit:s.profit,margin:s.margin,quantity:s.quantity});
   }catch(error){entry.status='Bloqueado';entry.motivo=error.message;}
   entries.push(entry);await ml.appendResult(pool,op.id,{sku:entry.sku,anuncio:entry.anuncio,status:entry.status,motivo:entry.motivo});
  }
  await pool.query("UPDATE ml_operacoes SET status='previa',dados=$2,atualizado_em=NOW(),expira_em=NOW()+INTERVAL '20 minutes' WHERE id=$1",[op.id,JSON.stringify({campaign:group.campaign,entries})]);
 }catch(e){await ml.appendResult(pool,op.id,{status:'Falhou',motivo:e.message});await pool.query("UPDATE ml_operacoes SET status='falhou',atualizado_em=NOW() WHERE id=$1",[op.id]);}
}
async function execute(pool,op){
 const api=new ml.MeliClient(pool),a=require('./mercado-livre-actions'),seller=op.seller_id||op.seller;let failures=0;
 try{
  const campaign=op.dados.campaign,remote=await freshCandidates(api,campaign,op.dados.entries.map(e=>e.anuncio)),rows=await local(pool),dynamic=await pricing.freightRules(pool);
  for(const e of op.dados.entries){const report={sku:e.sku,anuncio:e.anuncio,bruto:e.bruto,liquido:e.liquido};
   try{
    const matches=rows.filter(i=>String(i.row.id)===String(e.link));if(matches.length!==1||a.fingerprint(matches[0])!==e.fingerprint)throw Error('Cadastro, estoque ou cálculo mudou. Prepare nova análise.');
    const item=matches[0],offers=remote.filter(c=>c.id===e.anuncio);if(offers.length!==1)throw Error('Oferta ausente ou ambígua. Atualize antes de repetir.');const candidate={...e.candidate,...offers[0]};
    if(a.candidateKey(candidate)!==e.candidateKey)throw Error('Condições da oferta mudaram. Atualize e revise.');
    const snap=await ml.snapshot(api,e.anuncio,seller);if(snap.item.status!=='active'||snap.item.condition!=='new'||!(Number(snap.item.available_quantity)>0)||Math.abs(snap.price.gross-e.bruto)>.005)throw Error('Situação do anúncio ou bruto mudou. Revise novamente.');
    const s=scenario(campaign,candidate,item,dynamic,{price:e.liquido,quantity:e.quantity});
    if(Math.abs(s.profit-e.profit)>.005||Math.abs(s.credit-e.credit)>.005||Math.abs(s.margin-e.margin)>.000001)throw Error('Custos ou margem mudaram. Prepare nova prévia.');
    if(s.quantity&&s.quantity>Number(snap.item.available_quantity))throw Error('Estoque reservado maior que o estoque atual do anúncio.');
    const request=payload(campaign,candidate,s);
    await ml.appendResult(pool,op.id,{...report,status:'Envio iniciado',motivo:'Campanha '+campaign.id+'. Se interrompido, consulte a participação antes de repetir.'});
    const response=await api.request(request.method,'/seller-promotions/items/'+e.anuncio,{app_version:'v2'},request.body);
    if(response.price==null||!Number.isFinite(Number(response.price))||Math.abs(Number(response.price)-s.price)>.005)throw Error('Envio realizado, mas preço não confirmado. Consulte o portal antes de repetir.');
    const check=(await freshCandidates(api,campaign,[e.anuncio])).filter(c=>c.id===e.anuncio&&['pending','started'].includes(c.status));
    if(check.length!==1||Math.abs(Number(check[0].price)-s.price)>.005)throw Error('Preço aceito; participação ainda não confirmada na consulta. Confira no portal antes de repetir.');
    report.status='Publicado';report.motivo='Participação e preço confirmados na campanha '+campaign.id;
    try{const updated=await ml.snapshot(api,e.anuncio,seller);await ml.savePrice(pool,{id:e.link},updated.price);}catch{report.motivo+=' · Consulte os preços locais novamente.';}
   }catch(error){failures++;report.status='Pendente';report.motivo=error.message;}
   await ml.appendResult(pool,op.id,report);
  }
  await pool.query('UPDATE ml_operacoes SET status=$2,atualizado_em=NOW() WHERE id=$1',[op.id,failures?'parcial':'concluida']);
 }catch(error){await ml.appendResult(pool,op.id,{status:'Falhou',motivo:error.message});await pool.query("UPDATE ml_operacoes SET status='falhou',atualizado_em=NOW() WHERE id=$1",[op.id]);}
}
function review(req,op){return shell(`<a href="${ROOT}">← Campanhas e operações</a><div class="panel"><h2>Revisar envio: ${esc(campaignName(op.dados.campaign))}</h2>${campaignReference(op.dados.campaign)}<p>Apenas anúncios marcados serão enviados. Prévia válida por 20 minutos; custos, estoque, bruto e oferta serão conferidos novamente.</p><p class="warn">Ofertas relâmpago reservam o estoque informado. Benefício estimado pelo percentual exige conferência no portal. Não participar não remove ofertas existentes.</p><label><input type="checkbox" id="mpReviewAll"> Selecionar todos os itens disponíveis</label><form id="mpReview" method="post" action="${ROOT}/confirmar/${op.id}">${hidden('csrf',req.session.mlCsrf)}<div class="scroll"><table style="min-width:900px!important"><thead><tr>${['Selecionar','SKU / MLB','Preço ao cliente','Benefício','Receber do MKP','Lucro','Margem','Estoque reservado','Situação'].map(v=>'<th>'+v+'</th>').join('')}</tr></thead><tbody>${op.dados.entries.map(e=>`<tr><td><input type="checkbox" name="selected" value="${esc(e.link)}" ${e.status!=='Pronto'?'disabled':''}></td><td>${esc(e.sku)}<br>${esc(e.anuncio)}</td><td>${money(e.liquido)}</td><td>${money(e.credit)}${e.scenario?.estimated?'<small>Estimado: conferir no portal</small>':''}</td><td>${money(e.scenario?.receivable)}</td><td>${money(e.profit)}</td><td>${pct(e.margin)}</td><td>${esc(e.quantity??'—')}</td><td>${esc(e.status)}<small>${esc(e.motivo||'')}</small></td></tr>`).join('')}</tbody></table></div><p><label><input type="checkbox" name="confirm" value="yes" required>Confirmo a publicação dos preços e participações selecionados no Mercado Livre.</label></p><button>Confirmar publicação dos selecionados</button></form></div><script>document.getElementById("mpReviewAll").onchange=e=>document.querySelectorAll('#mpReview input[name="selected"]:not(:disabled)').forEach(c=>c.checked=e.target.checked);</script>`);}
function mount(router,pool,renderShell){
 const route=(suffix,method,fn)=>router[method](PATH+suffix,async(req,res)=>{try{await ensure(pool);await fn(req,res)}catch(e){res.status(400).send(renderShell(req,shell(`<p class="warn">${esc(e.message)}</p><a href="${ROOT}">Voltar às promoções</a>`),{title:'Promoção Mercado Livre'}));}});
 const account=async()=>{const a=(await ml.state(pool)).account;if(!a.seller_id)throw Error('Conecte a conta Mercado Livre primeiro.');return a.seller_id;};
 const show=(req,res,html)=>res.send(renderShell(req,html,{title:'Promoção Mercado Livre'}));
 route('','get',async(req,res)=>{const seller=await account(),m=await model(pool,seller,req.query.campaign);if(req.query.campaign&&!m.group)throw Error('Campanha não encontrada. Atualize as campanhas.');const jobs=(await pool.query("SELECT * FROM ml_operacoes WHERE seller_id=$1 AND usuario=$2 AND tipo IN ('consulta-promocoes','promo-central') ORDER BY criado_em DESC LIMIT 12",[seller,owner(req)])).rows;show(req,res,m.group?analysis(req,m):listing(req,m,jobs));});
 route('/atualizar','post',async(req,res)=>{const op=await ml.beginOperation(pool,'consulta-promocoes',owner(req),{progress:0});setImmediate(()=>ml.runLocked(pool,op,()=>refresh(pool,op)).catch(()=>{}));res.redirect(ROOT);});
 async function save(req,seller,m){
  if(!m.group)throw Error('Selecione uma campanha importada.');
  const changes=[],dynamic=await pricing.freightRules(pool);
  for(const e of m.entries){if(e.error)continue;const index=String(e.index);if(req.body.basis?.[index]!==e.basis)throw Error('A campanha ou os cálculos mudaram. Atualize a página e revise.');const decision=req.body.decision?.[index];if(!decisions.includes(decision))throw Error('Decisão inválida.');const input={price:req.body.price?.[index],quantity:req.body.quantity?.[index]};const s=scenario(m.group.campaign,e.candidate,e.item,dynamic,input);
   if(!s.editable&&input.price!=null&&Math.abs(Number(String(input.price).replace(',','.'))-s.price)>.005)throw Error('Não altere o preço de uma oferta com valor obrigatório.');
   changes.push({e,s,data:{price:s.price,quantity:s.quantity,decision,basis:e.basis,user:owner(req),at:new Date().toISOString()}});
  }
  const client=await pool.connect();try{await client.query('BEGIN');for(const change of changes)await client.query('INSERT INTO ml_promo_decisoes(seller,campanha,anuncio,oferta,dados) VALUES($1,$2,$3,$4,$5) ON CONFLICT(seller,campanha,anuncio,oferta) DO UPDATE SET dados=EXCLUDED.dados,atualizado_em=NOW()',[seller,key(m.group.campaign),change.e.candidate.id,offerKey(change.e.candidate),JSON.stringify(change.data)]);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
  return changes;
 }
 route('/salvar','post',async(req,res)=>{const seller=await account(),m=await model(pool,seller,req.body.campaign);await save(req,seller,m);res.redirect(ROOT+'?campaign='+encodeURIComponent(req.body.campaign));});
 route('/preparar','post',async(req,res)=>{if(req.body.review!=='yes')throw Error('Revise e marque a confirmação para preparar os selecionados.');const seller=await account(),m=await model(pool,seller,req.body.campaign),changes=await save(req,seller,m),wanted=new Set((Array.isArray(req.body.selected)?req.body.selected:[req.body.selected]).filter(Boolean).map(String)),chosen=changes.filter(c=>wanted.has(String(c.e.index)));
  if(!chosen.length||chosen.length!==wanted.size)throw Error('Selecione anúncios válidos.');
  if(chosen.some(c=>c.data.decision!=='Participar'||c.s.problems.length||c.e.stale||m.group.error))throw Error('Selecione apenas decisões Participar, sem bloqueios e com análise atualizada. Salve e revise novamente.');
  if(new Set(chosen.map(c=>c.e.candidate.id)).size!==chosen.length)throw Error('Mais de uma oferta para o mesmo MLB. Selecione uma por vez.');
  const op=await ml.beginOperation(pool,'promo-central',owner(req),{preparing:true});setImmediate(()=>ml.runLocked(pool,op,()=>prepare(pool,op,m.group,chosen.map(c=>({...c.e,scenario:c.s})))).catch(()=>{}));res.redirect(ROOT);
 });
 route('/revisar/:id','get',async(req,res)=>{const op=(await pool.query("SELECT * FROM ml_operacoes WHERE id=$1 AND usuario=$2 AND seller_id=$3 AND tipo='promo-central' AND status='previa' AND expira_em>NOW()",[req.params.id,owner(req),await account()])).rows[0];if(!op)throw Error('Prévia expirada ou já utilizada.');show(req,res,review(req,op));});
 route('/confirmar/:id','post',async(req,res)=>{if(req.body.confirm!=='yes')throw Error('Confirme a publicação dos selecionados.');const seller=await account();const check=(await pool.query("SELECT id FROM ml_operacoes WHERE id=$1 AND usuario=$2 AND seller_id=$3 AND tipo='promo-central'",[req.params.id,owner(req),seller])).rows;if(!check.length)throw Error('Prévia inválida.');const op=await require('./mercado-livre-actions').claim(pool,req.params.id,owner(req),req.body.selected,['promo-central']);setImmediate(()=>ml.runLocked(pool,op,()=>execute(pool,op)).catch(()=>{}));res.redirect(ROOT);});
}
module.exports={campaignName,mount,scenario,suggestion,payload,basis,model,refresh,prepare,execute,analysis,listing,review};
