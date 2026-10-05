const {test}=require('node:test');
const assert=require('node:assert/strict');
const service=require('../src/integracoes/mercado-livre');
const actions=require('../src/integracoes/mercado-livre-actions');
const {publishedPrices}=require('../src/tabela-precos/service');
const {MARKETPLACE_RULES}=require('../src/tabela-precos/pricing');
const item={id:'MLB123',seller_id:42,site_id:'MLB',currency_id:'BRL',price:75,status:'active',tags:[]};
const sale={amount:75,regular_amount:110,currency_id:'BRL',metadata:{promotion_id:'P-MLB1'}};
const prices={id:'MLB123',prices:[{type:'standard',amount:100,currency_id:'BRL',conditions:{context_restrictions:['channel_marketplace']}},{type:'standard',amount:80,currency_id:'BRL',conditions:{context_restrictions:['channel_marketplace','user_type_business'],min_purchase_unit:2}},{type:'standard',amount:90,currency_id:'BRL',conditions:{context_restrictions:['channel_mshops']}}]};
test('identifica bruto standard do canal, sem confundir referência promocional, B2B ou Mshops',()=>{
  assert.equal(service.standardPrice(prices,'MLB123'),100);
  const observed=service.readPrice(item,sale,42,service.standardPrice(prices,'MLB123'));
  assert.equal(observed.amount,75);assert.equal(observed.gross,100);
  assert.throws(()=>service.standardPrice({...prices,prices:[...prices.prices,prices.prices[0]]},'MLB123'),/ambíguo/);
  assert.throws(()=>service.standardPrice({...prices,id:'MLB999'},'MLB123'),/incompleta/);
});
test('consulta verifica propriedade, moeda, preço válido e código MLB exato',()=>{
  assert.throws(()=>service.itemId('MLB123/../../users/me'),/exato/);
  assert.throws(()=>service.assertOwned(item,'MLB123',43),/pertence/);
  assert.throws(()=>service.readPrice(item,{...sale,currency_id:'USD'},42,100),/inválido/);
  assert.throws(()=>service.readPrice(item,sale,42,Infinity),/inválido/);
  assert.throws(()=>service.readPrice(item,{...sale,amount:0},42,100),/inválido/);
});
test('preço remoto prevalece no anúncio certo e preserva os dados manuais para fallback',()=>{
  const remote=service.readPrice(item,sale,42,100),row={marketplace:'Mercado Livre',id_loja:'MLB123',preco_atual:150,preco_promocional:0,dados:{preco_liquido_manual:95,mercado_livre_preco:remote}};
  assert.equal(publishedPrices(row,{discount:.3}).liquidPrice,75);assert.equal(publishedPrices(row,{discount:.3}).discount,.25);
  assert.equal(row.dados.preco_liquido_manual,95);
  assert.equal(publishedPrices({...row,id_loja:'MLB999'},{discount:.3}).liquidPrice,95);
  assert.equal(publishedPrices({...row,marketplace:'Shopee'},{discount:.3}).liquidPrice,95);
});
test('escritas não se repetem em falha HTTP ou resposta ambígua; GET permite recuperação',async()=>{
  let calls=0;const api=new service.MeliClient({},async()=>{calls++;return {ok:false,status:503,json:async()=>({})};},async()=>{},async()=> 'token');
  await assert.rejects(api.request('POST','/items/MLB123/prices/standard',{}, {prices:[]}),/HTTP 503/);assert.equal(calls,1);
  calls=0;await assert.rejects(api.get('/items/MLB123'),/HTTP 503/);assert.equal(calls,4);
  calls=0;await assert.rejects(api.request('DELETE','/items/MLB123'),/permitida/);assert.equal(calls,0);
  await assert.rejects(api.get('https://example.org'),/permitida/);assert.equal(calls,0);
});
test('publicação de bruto permite promoções mas bloqueia automatização e bruto inferior ao líquido',()=>{
  const local={result:{status:'OK',grossPrice:120}},snap={item,price:{amount:100,gross:100}};
  assert.equal(actions.validateGross(local,snap,[]),120);
  assert.throws(()=>actions.validateGross(local,snap,undefined),/incompleta/);
  assert.equal(actions.validateGross(local,snap,[{status:'started'}]),120);
  assert.throws(()=>actions.validateGross(local,{...snap,item:{...item,tags:['dynamic_standard_price']}},[]),/automatização/);
  assert.equal(actions.validateGross(local,{...snap,price:{amount:75,gross:100}},[]),120);
  assert.throws(()=>actions.validateGross({result:{status:'OK',grossPrice:70}},{...snap,price:{amount:75,gross:100}},[]),/menor/);
});
test('campanha própria mantém líquido e exige 5% sem impor esse mínimo a outros tipos',()=>{
  const local={result:{finalPrice:95},product:{cost:30,weight:.3},rule:MARKETPLACE_RULES.find(r=>r.marketplace==='Mercado Livre')};
  const terms=actions.campaignTerms({type:'SELLER_CAMPAIGN'},{},local,100,[]);assert.equal(terms.price,95);assert.ok(Math.abs(terms.discount-.05)<1e-9);
  assert.throws(()=>actions.campaignTerms({type:'SELLER_CAMPAIGN'},{}, {...local,result:{finalPrice:95.01}},100,[]),/abaixo de 5/);
  assert.equal(actions.campaignTerms({type:'DEAL'},{suggested_discounted_price:99},local,100,[]).price,99);
});
test('coparticipação estima benefício explícito e bloqueia condições incompletas e boost',()=>{
  const local={result:{finalPrice:95},product:{cost:30,weight:.3},rule:MARKETPLACE_RULES.find(r=>r.marketplace==='Mercado Livre')};
  const candidate={price:70,original_price:100,meli_percentage:5,seller_percentage:25};const terms=actions.campaignTerms({type:'MARKETPLACE_CAMPAIGN'},candidate,local,100,[]);
  assert.equal(terms.credit,5);assert.equal(terms.price,70);assert.equal(terms.profit,terms.baseProfit+5);
  assert.throws(()=>actions.campaignTerms({type:'MARKETPLACE_CAMPAIGN'},{...candidate,meli_percentage:undefined},local,100,[]),/Bonificação/);
  assert.throws(()=>actions.campaignTerms({type:'MARKETPLACE_CAMPAIGN'},{...candidate,boosted_offer:true},local,100,[]),/adicional/);
});
test('paginação de campanhas usa cursor e recusa resultado incompleto',async()=>{
  const calls=[];const api={get:async(path,params)=>{calls.push(params);return calls.length===1?{results:[{id:'MLB123'}],paging:{searchAfter:'cursor',total:2}}:{results:[{id:'MLB124'}],paging:{total:2}};}};
  assert.equal((await actions.campaignItems(api,{id:'P-MLB1',type:'DEAL'})).length,2);assert.equal(calls[1].search_after,'cursor');
  await assert.rejects(actions.campaignItems({get:async()=>({results:[],paging:{total:10}})},{id:'P-MLB1',type:'DEAL'}),/incompleta/);
});
test('campanhas próprias validam datas locais, duração e calendário',()=>{
  const now=new Date('2026-10-02T12:00:00Z');const body=actions.sellerCampaign({name:'Campanha outubro',start:'2026-10-02',end:'2026-10-15'},now);
  assert.equal(body.sub_type,'FLEXIBLE_PERCENTAGE');assert.equal(body.start_date,'2026-10-02T00:00:00');
  assert.throws(()=>actions.sellerCampaign({name:'Campanha outubro',start:'2026-10-02',end:'2026-10-16'},now),/14 dias/);
  assert.throws(()=>actions.sellerCampaign({name:'Campanha outubro',start:'2026-09-31',end:'2026-10-02'},now),/datas/);
});
test('tokens criptografados não aparecem em texto simples e adulteração é recusada',()=>{
  const old=process.env.ML_TOKEN_ENCRYPTION_KEY;process.env.ML_TOKEN_ENCRYPTION_KEY='test-key-with-at-least-thirty-two-characters';
  try{const encrypted=service.crypt('secret-value');assert.ok(!encrypted.includes('secret-value'));assert.equal(service.crypt(encrypted,true),'secret-value');const parts=encrypted.split(':');parts[2]=Buffer.from('invalid').toString('base64');assert.throws(()=>service.crypt(parts.join(':'),true));}
  finally{if(old===undefined)delete process.env.ML_TOKEN_ENCRYPTION_KEY;else process.env.ML_TOKEN_ENCRYPTION_KEY=old;}
});
test('confirmação consome prévia uma única vez e recusa seleção adulterada ou outra conta',async()=>{
  let updates=0,op={id:'a'.repeat(8)+'-aaaa-aaaa-aaaa-'+ 'a'.repeat(12),seller_id:'42',dados:{entries:[{link:'1',status:'Pronto'},{link:'2',status:'Bloqueado'}]}};
  const client={release(){},query:async(sql,params)=>{
    if(sql.startsWith('SELECT * FROM ml_integracao'))return {rows:[{seller_id:'42'}]};
    if(sql.startsWith('SELECT * FROM ml_operacoes'))return {rows:op?[structuredClone(op)]:[]};
    if(sql.startsWith('SELECT id FROM ml_operacoes'))return {rows:[]};
    if(sql.startsWith('UPDATE ml_operacoes')){updates++;op=null;}
    return {rows:[]};
  }};const pool={connect:async()=>client};
  await assert.rejects(actions.claim(pool,op.id,'admin',['2']),/disponíveis/);assert.equal(updates,0);
  const id=op.id;op.seller_id='99';await assert.rejects(actions.claim(pool,id,'admin',['1']),/outra conta/);assert.equal(updates,0);
  op.seller_id='42';const result=await actions.claim(pool,id,'admin',['1']);assert.equal(result.dados.entries.length,1);assert.equal(updates,1);
  await assert.rejects(actions.claim(pool,id,'admin',['1']),/expirada/);assert.equal(updates,1);
});
test('grava preço remoto apenas no vínculo exato sem tocar custo, estoque ou valor manual',async()=>{
  let statement,values;const pool={query:async(sql,args)=>{statement=sql;values=args;return {rowCount:1};}};
  await service.savePrice(pool,{id:7},service.readPrice(item,sale,42,100));
  assert.match(statement,/AND marketplace='Mercado Livre'/);assert.match(statement,/UPPER\(TRIM\(id_loja\)\)=\$3/);
  assert.ok(!/SET.*(?:custo|estoque|preco_liquido_manual)=/.test(statement));assert.equal(values[2],'MLB123');
  await assert.rejects(service.savePrice({query:async()=>({rowCount:0})},{id:7},service.readPrice(item,sale,42,100)),/Vínculo mudou/);
});
test('aceita ofertas propostas usando offer_id, sem enviar preço que o vendedor não define',()=>{
  for(const type of ['SMART','PRICE_MATCHING','PRE_NEGOTIATED','UNHEALTHY_STOCK']) {
    assert.deepEqual(actions.participationBody({id:'P-MLB1',type},{offer_id:'OFFER-1'},70),{promotion_id:'P-MLB1',promotion_type:type,offer_id:'OFFER-1'});
    assert.throws(()=>actions.participationBody({id:'P-MLB1',type},{},70),/ausente/);
  }
  assert.deepEqual(actions.participationBody({id:'C-MLB1',type:'SELLER_CAMPAIGN'},{},70),{promotion_id:'C-MLB1',promotion_type:'SELLER_CAMPAIGN',deal_price:70});
  assert.deepEqual(actions.participationBody({id:'P-MLB1',type:'MARKETPLACE_CAMPAIGN'},{},70),{promotion_id:'P-MLB1',promotion_type:'MARKETPLACE_CAMPAIGN'});
});

test('benefício vigente combina coparticipação e boost uma vez e rejeita campanha futura ou ambígua',()=>{
  const observed={amount:75,metadata:{promotion_id:'P1',promotion_type:'SMART'}};
  const active={id:'P1',type:'SMART',status:'started',price:80,original_price:100,meli_percentage:5,boosted_offer:true,total_price_for_boosted_offer:75,discount_meli_boost_amount:5};
  assert.equal(service.activeBenefit(observed,[active]).amount,10);
  assert.equal(service.activeBenefit(observed,[{...active,status:'pending'}]).status,'pending');
  assert.equal(service.activeBenefit(observed,[active,active]).status,'pending');
  assert.equal(service.activeBenefit({...observed,amount:74},[active]).status,'pending');
  assert.equal(service.activeBenefit(observed,[{...active,original_price:null}]).status,'pending');
  assert.equal(service.activeBenefit({amount:100,metadata:{}},[]).amount,0);
});

test('associa a oferta vencedora à campanha SMART com nomenclaturas diferentes da API',()=>{
  const sale={amount:281.25,metadata:{campaign_id:'P-MLB18087110',promotion_id:'OFFER-MLB1827540119-13978683128',promotion_type:'marketplace_campaign'}};
  const active={id:'P-MLB18087110',ref_id:'OFFER-MLB1827540119-13978683128',type:'SMART',status:'started',price:281.25,original_price:398.8,meli_percentage:1.6};
  const other={...active,id:'P-other',ref_id:'OFFER-other'};
  const result=service.activeBenefit(sale,[other,active]);assert.equal(result.amount,6.38);assert.equal(result.estimated,true);assert.match(result.reason,/Estimado/);
  assert.equal(service.activeBenefit(sale,[{...active,ref_id:'OFFER-other'}]).status,'pending');
  assert.equal(service.activeBenefit(sale,[{...active,id:'P-other'}]).status,'pending');
  assert.equal(service.activeBenefit(sale,[{...active,meli_percentage:null}]).status,'pending');
  assert.equal(service.activeBenefit({...sale,metadata:{promotion_id:active.ref_id,promotion_type:'marketplace_campaign'}},[active]).amount,6.38);
});
test('desconto custom associa ref_id e benefício absoluto de boost sem estimar coparticipação',()=>{
  const sale={amount:75,metadata:{promotion_id:'OFFER-123',promotion_type:'custom'}};
  const active={id:'P1',ref_id:'OFFER-123',type:'PRICE_DISCOUNT',status:'started',price:80,boosted_offer:true,total_price_for_boosted_offer:75,discount_meli_boost_amount:5};
  const result=service.activeBenefit(sale,[active]);assert.equal(result.amount,5);assert.equal(result.estimated,false);
});

test('consulta mantém filtro exato no contexto da operação',async()=>{
  const pool={query:async(sql)=>({rows:sql.startsWith('SELECT seller_id')?[{seller_id:'42'}]:[]})};
  const op=await service.operation(pool,'consulta','admin',{filter:'B1103'},'executando');
  assert.deepEqual(op.dados,{filter:'B1103'});assert.equal(op.seller,'42');
});

test('catálogo é identificado pelo flag do anúncio, não pelo produto ou elegibilidade',()=>{
  assert.equal(service.readPrice({...item,catalog_listing:true},sale,42,100).catalogListing,true);
  assert.equal(service.readPrice({...item,catalog_product_id:'MLB999',tags:['catalog_listing_eligible']},sale,42,100).catalogListing,false);
  const row={marketplace:'Mercado Livre',id_loja:'MLB123',dados:{mercado_livre_preco:service.readPrice({...item,catalog_listing:true},sale,42,100)}};
  assert.equal(publishedPrices(row,{}).catalogListing,true);
});
test('revisão dos brutos exibe memória e edição externa sem misturar o formulário de seleção',()=>{
  const html=actions.pricesTable([{row:{id:1,sku:'B1234',id_loja:'MLB123',estoque_full:{}},published:{grossPrice:100,liquidPrice:75,catalogListing:true},result:{status:'OK',grossPrice:120,finalPrice:90,discount:.25,grossManual:true,details:{costValue:30,margin:.1}},grossStatus:'Manter valor'}],{query:{},session:{mlCsrf:'token'}});
  for(const label of ['Frete','CMV','Lucro líquido','Margem líquida','Catálogo','Novo Bruto B1234'])assert.ok(html.includes(label));
  assert.ok(html.includes('form="gross-1"'));assert.ok(html.includes('ml-gross manual'));
  assert.ok(html.indexOf('</form><form id="gross-1"')>0);
});

test('envio escreve somente bruto e verifica líquido promocional depois sem alterar promoção',async()=>{
  const pricing=require('../src/tabela-precos/service');
  const original={rows:pricing.marketplaceRows,api:service.MeliClient,snapshot:service.snapshot,save:service.savePrice,append:service.appendResult};
  const local={row:{id:1,sku:'B',id_loja:'MLB123'},product:{cost:30,weight:.3},rule:{},result:{status:'OK',grossPrice:120,finalPrice:90,details:{}},published:{}};
  const entry={link:1,sku:'B',anuncio:'MLB123',bruto:120,anterior:100,liquidoAtual:75,promocional:true,fingerprint:actions.fingerprint(local)};
  let requests=[],reports=[],saved=[],snapCount=0,changed=false;
  try{
    pricing.marketplaceRows=async()=>[local];
    service.MeliClient=class{async get(){return [{status:'started'}];}async request(...args){requests.push(args);return {};}};
    service.snapshot=async()=>({item,price:{gross:++snapCount%2?100:120,amount:changed&&snapCount%2===0?76:75}});
    service.savePrice=async(pool,row,price)=>saved.push(price);
    service.appendResult=async(pool,id,result)=>reports.push(result);
    const pool={query:async()=>({rows:[]})},op={id:'op',seller_id:42,dados:{entries:[entry]}};
    await actions.executePrices(pool,op);
    assert.equal(requests.length,1);assert.equal(requests[0][1],'/items/MLB123/prices/standard');
    assert.deepEqual(requests[0][3],{prices:[{conditions:{context_restrictions:['channel_marketplace']},amount:120,currency_id:'BRL'}]});
    assert.equal(reports.at(-1).status,'Publicado');assert.match(reports.at(-1).motivo,/preservado/);
    changed=true;await actions.executePrices(pool,op);
    assert.equal(reports.at(-1).status,'Pendente');assert.match(reports.at(-1).motivo,/alterou o líquido/);assert.equal(saved.at(-1).amount,76);
  }finally{pricing.marketplaceRows=original.rows;service.MeliClient=original.api;service.snapshot=original.snapshot;service.savePrice=original.save;service.appendResult=original.append;}
});
