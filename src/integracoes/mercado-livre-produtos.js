const ml=require('./mercado-livre'),pricing=require('../tabela-precos/service'),actions=require('./mercado-livre-actions'),part=require('./mercado-livre-participacoes');
const promo=()=>require('./mercado-livre-promocoes');
const ROOT=ml.ROOT+'/central-promocoes',PATH='/por-produto',TYPES=['integrar-promocoes-produto','consultar-participacao-produto'];
const key=c=>c.type+':'+c.id,ref=c=>String(c.offer_id||c.ref_id||c.id);
const esc=require('../services/ui-executivo').esc;
const money=v=>v==null||!Number.isFinite(Number(v))?'—':Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const pct=v=>v==null||!Number.isFinite(Number(v))?'—':(v*100).toLocaleString('pt-BR',{maximumFractionDigits:2})+'%';
const hidden=(name,v)=>`<input type="hidden" name="${esc(name)}" value="${esc(v??'')}">`;
function entryKey(e){return JSON.stringify([key(e.campaign),e.candidate.id,ref(e.candidate)]);}
async function model(pool,seller){
 const catalog=(await pool.query('SELECT dados FROM ml_promo_catalogo WHERE seller=$1',[seller])).rows[0]?.dados;
 if(!catalog)return {catalog,entries:[],groups:[]};
 const [rows,dynamic,saved,participations]=await Promise.all([pricing.marketplaceRows(pool,{marketplace:'Mercado Livre'}),pricing.freightRules(pool),pool.query('SELECT campanha,anuncio,oferta,dados FROM ml_promo_decisoes WHERE seller=$1',[seller]),pool.query('SELECT campanha,anuncio,dados FROM ml_promo_participacoes WHERE seller=$1',[seller])]);
 const cache={catalog,rows:rows.filter(i=>!i.row.sem_vinculo&&/^MLB\d+$/.test(String(i.row.id_loja).trim().toUpperCase())),dynamic,saved:saved.rows,participations:participations.rows};
 const entries=[],seen=new Set();
 for(const g of catalog.campaigns){const m=await promo().model(pool,seller,key(g.campaign),cache);for(const entry of m.entries){const e={...entry,campaign:g.campaign,campaignError:g.error};const id=entryKey(e);if(seen.has(id))continue;seen.add(id);e.index=entries.length;entries.push(e);}}
 return {catalog,entries,groups:groupEntries(entries),dynamic};
}
function groupEntries(entries){
 const groups=new Map();for(const e of entries){const sku=e.item?.row.sku||'Sem vínculo',id=JSON.stringify([sku,e.candidate.id]);if(!groups.has(id))groups.set(id,{id,sku,anuncio:e.candidate.id,item:e.item,entries:[]});groups.get(id).entries.push(e);}
 return [...groups.values()].sort((a,b)=>a.sku.localeCompare(b.sku,'pt-BR',{numeric:true})||a.anuncio.localeCompare(b.anuncio));
}
function filterGroups(m,q={}){
 const search=String(q.busca||'').trim().toLocaleLowerCase('pt-BR'),allowedDecisions=['Participar','Revisar','Não participar'],allowedStates=['Participando','Não participando','Pendente de confirmação'];
 return m.groups.map(g=>({...g,entries:g.entries.filter(e=>{
  const text=[g.sku,g.anuncio,e.item?.row.produto_nome,e.item?.row.nome,promo().campaignName(e.campaign)].join(' ').toLocaleLowerCase('pt-BR');
  return (!search||text.includes(search))&&(!q.campanha||key(e.campaign)===q.campanha)&&(!allowedDecisions.includes(q.decisao)||e.decision===q.decisao)&&(!allowedStates.includes(q.participacao)||e.participation.label===q.participacao)&&(q.estoque!=='positive'||Number(e.item?.row.estoque)>0);
 })})).filter(g=>g.entries.length);
}
function inputFor(body,e){const id=String(e.index);return {price:body.price?.[id],quantity:body.quantity?.[id],credit:body.credit?.[id],creditBasis:body.creditBasis?.[id]};}
function selectedEntries(m,body){
 const ids=Array.isArray(body.selected)?body.selected:[body.selected],wanted=new Set(ids.filter(v=>v!=null&&v!=='').map(String));
 if(!wanted.size||wanted.size>1000)throw Error('Selecione de 1 a 1.000 ofertas.');
 const entries=m.entries.filter(e=>wanted.has(String(e.index)));if(entries.length!==wanted.size)throw Error('Seleção inválida. Atualize a análise.');
 const unique=new Set();for(const e of entries){const id=key(e.campaign)+':'+e.candidate.id;if(unique.has(id))throw Error('Escolha uma oferta por anúncio dentro da mesma campanha. Você pode escolher várias campanhas para o mesmo anúncio.');unique.add(id);}
 for(const e of entries)if((body.basis?.[e.index]||'')!==(e.basis||''))throw Error('Uma oferta ou cálculo mudou. Atualize a análise antes de continuar.');
 return entries;
}
function validate(e,input,decision,manual,dynamic){
 if(!e.item||e.error)throw Error(e.error||'Cadastro incompleto.');
 if(!['Participar','Revisar','Não participar'].includes(decision))throw Error('Decisão inválida.');
 const s=promo().scenario(e.campaign,e.candidate,e.item,dynamic,input);
 if(s.creditStale)throw Error('As condições do bônus mudaram. Confira novamente.');
 if(!s.editable&&input.price!=null&&Math.abs(Number(String(input.price).replace(',','.'))-s.price)>.005)throw Error('Preço obrigatório não pode ser alterado.');
 return {s,data:{price:s.price,quantity:s.quantity,credit:s.creditOverride,creditBasis:s.creditOverride!=null?s.creditBasis:null,manual,decision:manual?decision:s.suggested,basis:e.basis}};
}
async function save(pool,seller,m,body,user){
 const indices=Object.keys(body.basis||{});if(!indices.length||indices.length>1000)throw Error('Não há ofertas válidas para salvar nesta página.');
 const changes=indices.map(id=>{const e=m.entries.find(e=>String(e.index)===id);if(!e||body.basis[id]!==e.basis)throw Error('A análise mudou. Recarregue antes de salvar.');const {data}=validate(e,inputFor(body,e),body.decision?.[id],body.manual?.[id]==='yes',m.dynamic);return {e,data:{...data,user,at:new Date().toISOString()}};});
 const client=await pool.connect();try{await client.query('BEGIN');for(const {e,data} of changes)await client.query('INSERT INTO ml_promo_decisoes(seller,campanha,anuncio,oferta,dados) VALUES($1,$2,$3,$4,$5) ON CONFLICT(seller,campanha,anuncio,oferta) DO UPDATE SET dados=EXCLUDED.dados,atualizado_em=NOW()',[seller,key(e.campaign),e.candidate.id,ref(e.candidate),JSON.stringify(data)]);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
function prepareEntries(m,body,user,readOnly=false){
 return selectedEntries(m,body).map(e=>{
  const base={index:e.index,campaign:e.campaign,link:e.item?.row.id,sku:e.item?.row.sku,anuncio:e.candidate.id,candidate:e.candidate,user};if(readOnly)return base;
  const input=inputFor(body,e),decision=body.decision?.[e.index],manual=body.manual?.[e.index]==='yes';
  if(decision!=='Participar')throw Error('Marque apenas ofertas com decisão Participar.');
  const {s}=validate(e,input,decision,manual,m.dynamic);
  return {...base,input,decision,manual,basis:e.basis,fingerprint:actions.fingerprint(e.item),expected:{price:s.price,credit:s.credit,profit:s.profit,margin:s.margin}};
 });
}
async function run(pool,op,readOnly=false){
 let failures=0;const groups=new Map();for(const e of op.dados.entries){const id=key(e.campaign);if(!groups.has(id))groups.set(id,{campaign:e.campaign,entries:[]});groups.get(id).entries.push(e);}
 for(const group of groups.values()){
  try{const result=await part.run(pool,{...op,dados:group},readOnly,{finalize:false});failures+=result.failures;}
  catch(error){failures+=group.entries.length;for(const e of group.entries)await ml.appendResult(pool,op.id,{indice:e.index,sku:e.sku,anuncio:e.anuncio,campanha:key(group.campaign),nome_campanha:promo().campaignName(group.campaign),oferta:ref(e.candidate),status:'Pendente de confirmação',motivo:error.message,final:true});}
 }
 await pool.query('UPDATE ml_operacoes SET status=$2,atualizado_em=NOW() WHERE id=$1',[op.id,failures?'parcial':'concluida']);
}
function offerRow(e,firstCells){
 const c=e.candidate,s=e.scenario,id=e.index,own=e.campaign.type==='SELLER_CAMPAIGN',decision=e.decision,dc=decision==='Participar'?'yes':decision==='Não participar'?'no':'review';
 const details=[e.error,...(s?.problems||[]),e.campaignError,e.participation.note].filter(Boolean).join(' ');
 const cell=(v,cl='')=>`<td class="${cl||'align-money'}">${v}</td>`;
 let row=`<tr data-offer-key="${esc(entryKey(e))}" data-valid="${s?'yes':'no'}" data-index="${id}" data-anuncio="${esc(c.id)}" data-campaign="${esc(key(e.campaign))}" data-own="${own?'yes':'no'}" data-group="${esc(e.groupId)}" data-decision="${esc(decision)}">${firstCells||''}`;
 row+=cell(`<label class="offer-choice" title="${esc(e.campaign.type+' · '+e.campaign.id)}"><input type="checkbox" name="selected" value="${id}" aria-label="Selecionar ${esc(e.item?.row.sku||c.id)} — ${esc(promo().campaignName(e.campaign))}" ${!s?'disabled':''}><span>${esc(promo().campaignName(e.campaign))}${own?'<small>Campanha própria · seleção manual</small>':''}</span></label>${hidden('basis['+id+']',e.basis||'')}`,'campaign-cell');
 row+=cell(esc(promo().campaignPeriod(c)||'Não informado pela API'),'align-center');
 row+=cell(money(own?(c.suggested_discounted_price||c.price):s?.rulePrice))+cell(s?pct(1-s.rulePrice/s.gross):'—','align-center');
 row+=cell(s?`<span class="price-edit"><input class="price" aria-label="Preço ${id}" name="price[${id}]" value="${s.price.toFixed(2).replace('.',',')}" ${!s.editable?'readonly':''} title="${!s.editable?'Preço obrigatório':'Preço editável'}">${s.editable?`<button type="button" class="icon" data-reset-price="${s.rulePrice.toFixed(2)}" title="Usar preço da regra">↺</button>`:''}</span>`:'—');
 row+=cell(s?`<span class="credit-edit"><span data-credit-display>${money(s.credit)}${s.estimated?' *':''}</span>${s.creditEditable?`<button type="button" class="icon" data-credit-edit="${id}" title="Conferir bônus">✎</button>`:''}</span>${hidden('credit['+id+']',s.creditOverride??'')}${hidden('creditBasis['+id+']',s.creditBasis)}`:'—');
 row+=cell(money(s?.receivable))+cell(money(s?.profit),s?.profit<0?'align-money negative':'align-money')+cell(s?pct(s.margin):'—','align-center');
 row+=cell(`${hidden('decision['+id+']',decision)}${hidden('manual['+id+']',e.manual?'yes':'')}<button type="button" class="decision-pill decision-${dc}" data-decision-edit="${id}" ${!s?'disabled':''} data-suggested="${esc(s?.suggested||'Revisar')}" title="${esc(e.error||'Regra: '+s?.suggested)}">${esc(decision)} ▾</button>`,'align-center');
 for(const k of ['freight','fixedFee','commissionValue','cardValue','marketplaceReceivable','adsValue','costValue','adminValue','taxValue','totalCosts'])row+=cell(money(s?(k==='marketplaceReceivable'?s.receivable:s.details[k]):null));
 row+=cell(`<span class="status-text" data-participation-status title="${esc(details)}">${esc(e.participation.label)} ⓘ</span>${e.campaign.type==='LIGHTNING'&&s?` <input class="price" type="number" min="1" title="Quantidade mínima permitida pela API; ajuste dentro dos limites da oferta" aria-label="Reserva ${id}" name="quantity[${id}]" value="${s.quantity??''}">`:''}`,'align-center');
 return row+'</tr>';
}
function render(req,m){
 const q=req.query||{},all=filterGroups(m,q),size=[25,50,100].includes(Number(q.tamanho))?Number(q.tamanho):25,pages=Math.max(1,Math.ceil(all.length/size)),page=Math.max(1,Math.min(pages,Math.floor(Number(q.pagina)||1))),groups=all.slice((page-1)*size,page*size),shown=groups.flatMap(g=>g.entries),ownCampaigns=m.catalog?.campaigns.filter(g=>g.campaign.type==='SELLER_CAMPAIGN')||[];
 const opt=(value,label,current)=>`<option value="${esc(value)}" ${value===current?'selected':''}>${esc(label)}</option>`;
 const link=n=>ROOT+PATH+'?'+new URLSearchParams({...q,pagina:String(n)});
 let body='';for(const [n,g] of groups.entries()){
  const i=g.item,span=g.entries.length,current=ownCampaigns.flatMap(g=>g.items).filter(c=>c.id===g.anuncio&&['started','pending'].includes(c.status)),own=current.length===1?current[0]:null;
  const shared=(v,cl='align-center')=>`<td rowspan="${span}" class="shared ${cl}">${v}</td>`;
  const first=shared(`<label class="sku-content"><input type="checkbox" data-product-select="g${n}" aria-label="Selecionar campanhas aprovadas de ${esc(g.sku)} ${esc(g.anuncio)}"><strong>${esc(g.sku)}</strong></label>`,'sku-cell')+shared(esc(g.anuncio))+shared(`<span class="product-text" title="${esc(i?.row.produto_nome||i?.row.nome||'Sem vínculo')}">${esc(i?.row.produto_nome||i?.row.nome||'Sem vínculo')}</span>`,'product')+shared(i?.row.estoque_matriz==null?'—':Math.floor(Number(i.row.estoque_matriz)))+shared(i?.row.estoque_full?.['Mercado Livre']==null?'—':Math.floor(Number(i.row.estoque_full['Mercado Livre'])))+shared(money(i?.published?.grossPrice),'align-money')+shared(own?pct(1-own.price/(i?.published?.grossPrice||own.original_price)):'—')+shared(own?money(own.price):'—','align-money')+shared(money(i?.result?.finalPrice),'align-money');
  g.entries.forEach((e,index)=>{body+=offerRow({...e,groupId:'g'+n},index===0?first:'');});
 }
 const headers=['SKU','Código do anúncio','Produto','Estoque Matriz','Estoque Full','Preço Bruto publicado','Desconto Deus é Mais','Preço Líquido Deus é Mais','Líquido calculado Plennatec','Campanha','Período da oferta','Sugestão Meli','Desc. Sugerido','Preço Final / envio','Bônus Meli','Valor receber','Lucro Líquido','Margem Líquida','Decisão','Frete','Taxa por Pedido','Comissão Valor','TX Cartão','Receber do MKP','ADS','CMV','ADM','Imposto','Total Custos','Participação'];
 return promo().shell(`${promo().integrationAlert(req,m.catalog)}<link rel="stylesheet" href="/assets/mercado-livre-produtos.css?v=1"><nav class="bar panel"><strong>Por produto</strong><a class="button" href="${ROOT}?visao=campanhas">Por campanha</a></nav><section class="panel"><h2>Produtos e suas campanhas</h2><p>Analise todas as ofertas de cada anúncio e envie as participações aprovadas em um único comando.</p><div class="bar"><form method="post" action="${ROOT}/atualizar">${hidden('csrf',req.session.mlCsrf)}${hidden('return_to','produtos')}<button ${m.sync?'disabled':''}>Atualizar campanhas e itens do Mercado Livre</button></form><span>Última consulta: ${m.catalog?esc(new Date(m.catalog.updatedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})):'Ainda não realizada'}</span><span>Atualização automática diária às 03h (Brasília)</span></div>${m.sync?'<p data-sync-active>Atualização das campanhas em andamento. Aguardando a conclusão da consulta.</p>':''}${m.catalog?.errors?.length?`<details class="help"><summary>Consulta com ${m.catalog.errors.length} pendência(s)</summary>${m.catalog.errors.map(esc).join('<br>')}</details>`:''}</section><form id="productsFilter" method="get" action="${ROOT+PATH}" class="panel bar"><label>SKU / anúncio / produto<input name="busca" value="${esc(q.busca||'')}"></label><label>Campanha<select name="campanha">${opt('','Todas',q.campanha)}${(m.catalog?.campaigns||[]).map(g=>opt(key(g.campaign),promo().campaignName(g.campaign),q.campanha)).join('')}</select></label><label>Estoque<select name="estoque">${opt('','Todos',q.estoque)}${opt('positive','Maior que zero',q.estoque)}</select></label><label>Decisão<select name="decisao">${opt('','Todas',q.decisao)}${['Participar','Revisar','Não participar'].map(d=>opt(d,d,q.decisao)).join('')}</select></label><label>Participação<select name="participacao">${opt('','Todas',q.participacao)}${['Participando','Não participando','Pendente de confirmação'].map(d=>opt(d,d,q.participacao)).join('')}</select></label><label>Por página<select name="tamanho">${[25,50,100].map(n=>opt(String(n),String(n),String(size))).join('')}</select></label><button>Filtrar</button><a href="${ROOT+PATH}">Limpar</a></form><div class="panel"><p>${all.length} anúncio(s) filtrado(s) · ${all.reduce((n,g)=>n+g.entries.length,0)} oferta(s) · exibindo ${groups.length} anúncio(s) e ${shown.length} oferta(s) · página ${page} de ${pages}.</p><details class="help"><summary>Seleção e regras de participação</summary><p>O quadradinho do SKU marca somente as ofertas exibidas com decisão Participar, exceto campanhas próprias. Deus é Mais usa o líquido calculado e exige seleção individual. Demais campanhas usam o preço sugerido dentro dos limites do Mercado Livre. A reserva relâmpago usa a quantidade mínima permitida pela API.</p><p>Margem acima de 10%: Participar; de 8% a 10%: Revisar; abaixo de 8%: Não participar. Lucro mínimo e demais exigências da campanha continuam valendo. O asterisco indica bônus estimado.</p></details></div><form novalidate id="productAnalysis" action="${ROOT+PATH}/salvar" method="post">${hidden('csrf',req.session.mlCsrf)}${hidden('return_query',new URLSearchParams(q).toString())}<div class="panel bar"><label><input id="productsAll" type="checkbox"> Marcar ofertas Participar desta página</label><button type="button" id="productsRules">Aplicar regra às ofertas desta página</button><button type="button" id="productsRefresh">Consultar participação desta página</button><span id="productsCount"></span></div><div class="panel scroll product-view"><table><thead><tr>${headers.map((h,n)=>`<th class="${n===0?'sku-cell ':''}${n>=11&&n<=15?'meli-header ':''}">${n===0?'<label class="sku-content"><input id="productsHeaderAll" type="checkbox" aria-label="Marcar ofertas Participar desta página pelo cabeçalho">SKU</label>':esc(h)}${h==='Decisão'?'<button type="button" class="filter" data-product-filter="decisao" title="Filtrar Decisão">▾</button>':h==='Participação'?'<button type="button" class="filter" data-product-filter="participacao" title="Filtrar Participação">▾</button>':''}</th>`).join('')}</tr></thead><tbody>${body||'<tr><td colspan="30">Nenhuma oferta encontrada para estes filtros.</td></tr>'}</tbody></table></div><div class="panel bar"><button id="productsSave" ${!shown.some(e=>e.scenario)?'disabled':''}>Salvar decisões e recalcular</button><button type="submit" id="productsIntegrate" disabled>Integrar decisões dos selecionados</button><span id="productsSelected">0 ofertas selecionadas</span></div></form><div id="productsNotice" class="panel" role="status" ${q.operation||m.operation?'':'hidden'} data-operation="${esc(q.operation||m.operation||'')}"></div><nav class="panel bar">${page>1?`<a class="button" href="${esc(link(page-1))}">Anterior</a>`:''}<span>Página ${page} de ${pages}</span>${page<pages?`<a class="button" href="${esc(link(page+1))}">Próxima</a>`:''}</nav><dialog id="productsFilterMenu"><div class="modal-head"><strong id="productsFilterTitle">Filtrar</strong><button type="button" data-close="productsFilterMenu">×</button></div><div id="productsFilterOptions" class="menu-options"></div></dialog><dialog id="productsDecision"><div class="modal-head"><strong>Alterar decisão</strong><button type="button" data-close="productsDecision">×</button></div><div class="menu-options">${['Participar','Revisar','Não participar'].map(d=>`<button type="button" data-decision-value="${esc(d)}">${esc(d)}</button>`).join('')}<button type="button" id="productsDecisionRule">Usar decisão da regra</button></div></dialog><dialog id="productsCredit"><div class="modal-head"><strong>Bônus conferido no portal</strong><button type="button" data-close="productsCredit">×</button></div><label>Bônus em reais<input id="productsCreditValue" inputmode="decimal"></label><p>Salve para recalcular o valor a receber e a margem desta oferta.</p><div class="menu-options"><button type="button" id="productsCreditApply">Aplicar</button><button type="button" id="productsCreditClear">Usar estimativa da API</button></div></dialog><details class="panel"><summary>Operações recentes desta visão</summary>${(m.jobs||[]).map(j=>`<p>${esc(new Date(j.criado_em).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))} · ${esc(j.status)} · <a href="${ROOT+PATH}?operation=${esc(j.id)}">Conferir resultado</a> · <a href="${ml.ROOT}/relatorio/${esc(j.id)}">Relatório</a></p>`).join('')||'<p>Nenhuma operação iniciada nesta visão.</p>'}</details><script src="/assets/mercado-livre-produtos.js?v=1" defer></script>`);
}
function mount({route,pool,account,owner,show}){
 route(PATH,'get',async(req,res)=>{const seller=await account(),m=await model(pool,seller);m.jobs=(await pool.query("SELECT id,status,criado_em FROM ml_operacoes WHERE seller_id=$1 AND usuario=$2 AND tipo=ANY($3::text[]) ORDER BY criado_em DESC LIMIT 6",[seller,owner(req),TYPES])).rows;m.operation=m.jobs.find(j=>j.status==='executando')?.id;m.sync=(await pool.query("SELECT id FROM ml_operacoes WHERE seller_id=$1 AND tipo='consulta-promocoes' AND status='executando' LIMIT 1",[seller])).rows[0];show(req,res,render(req,m));});
 route(PATH+'/salvar','post',async(req,res)=>{const seller=await account(),m=await model(pool,seller);await save(pool,seller,m,req.body,owner(req));const q=new URLSearchParams(String(req.body.return_query||''));q.delete('operation');res.redirect(ROOT+PATH+'?'+q);});
 const start=readOnly=>async(req,res)=>{const seller=await account(),m=await model(pool,seller),entries=prepareEntries(m,req.body,owner(req),readOnly);const op=await ml.beginOperation(pool,readOnly?TYPES[1]:TYPES[0],owner(req),{entries});setImmediate(()=>ml.runLocked(pool,op,()=>run(pool,op,readOnly)).catch(()=>{}));res.status(202).json({operation:op.id});};
 route(PATH+'/integrar','post',start(false));route(PATH+'/consultar-participacao','post',start(true));
 route(PATH+'/participacao','get',async(req,res)=>{
  if(!/^[a-f0-9-]{36}$/i.test(String(req.query.operation)))throw Error('Operação inválida.');
  const seller=await account(),op=(await pool.query('SELECT id,status,resultados,dados FROM ml_operacoes WHERE id=$1 AND seller_id=$2 AND usuario=$3 AND tipo=ANY($4::text[])',[req.query.operation,seller,owner(req),TYPES])).rows[0];if(!op)throw Error('Operação não encontrada.');
  const records=(await pool.query('SELECT campanha,anuncio,dados FROM ml_promo_participacoes WHERE seller=$1',[seller])).rows;
  const items=op.dados.entries.map(e=>({index:e.index,key:entryKey(e),...part.state(e.candidate,records.find(r=>r.campanha===key(e.campaign)&&r.anuncio===e.anuncio)?.dados)}));res.json({items,operation:{id:op.id,status:op.status,results:op.resultados,total:op.dados.entries.length}});
 });
}
module.exports={model,groupEntries,filterGroups,selectedEntries,validate,save,prepareEntries,run,render,mount,entryKey};
