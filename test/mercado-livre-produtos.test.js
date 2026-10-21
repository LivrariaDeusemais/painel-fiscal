const {test}=require('node:test'),assert=require('node:assert/strict'),p=require('../src/integracoes/mercado-livre-promocoes'),v=require('../src/integracoes/mercado-livre-produtos'),part=require('../src/integracoes/mercado-livre-participacoes'),ml=require('../src/integracoes/mercado-livre'),pricing=require('../src/tabela-precos/service'),actions=require('../src/integracoes/mercado-livre-actions');
function item(ann='MLB1',link=1){return {row:{id:link,sku:'B1254',id_loja:ann,produto_nome:'Produto de teste',estoque:17,estoque_matriz:2,estoque_full:{'Mercado Livre':15}},published:{grossPrice:366.9},product:{cost:143.16,weight:1.63},rule:{marketplace:'Mercado Livre',commission:.12,card:0,ads:.1,admin:.03,tax:.05,fixedFreight:25.55},result:{status:'OK',finalPrice:265.91,grossPrice:366.9}};}
function entry(campaignId,index,ann='MLB1'){
 const campaign={id:campaignId,type:'SMART',name:'Impulsione suas vendas'},candidate={id:ann,offer_id:'OFFER-'+campaignId+'-'+ann,status:'candidate',price:271,meli_percentage:5.5,original_price:366.9,start_date:'2026-10-21',end_date:'2026-11-04'},i=item(ann,ann==='MLB1'?1:2),s=p.scenario(campaign,candidate,i);
 return {index,campaign,candidate,item:i,scenario:s,decision:s.suggested,basis:p.basis(i,candidate,campaign),participation:{label:'Não participando'}};
}
function bodyFor(entries){const body={selected:entries.map(e=>String(e.index)),basis:{},decision:{},price:{},manual:{}};for(const e of entries){body.basis[e.index]=e.basis;body.decision[e.index]='Participar';body.price[e.index]='271';}return body;}
test('produto agrupa SKU e MLB, mantendo várias campanhas e anúncios independentes',()=>{
 const entries=[entry('P-1',0),entry('P-2',1),entry('P-1',2,'MLB2')],groups=v.groupEntries(entries);
 assert.equal(groups.length,2);assert.equal(groups[0].entries.length,2);assert.equal(groups[1].entries.length,1);
 const m={entries,groups};assert.equal(v.filterGroups(m,{campanha:'SMART:P-2'}).length,1);assert.equal(v.filterGroups(m,{campanha:'SMART:P-2'})[0].entries.length,1);assert.equal(v.filterGroups(m,{busca:'MLB2'})[0].anuncio,'MLB2');assert.equal(v.filterGroups(m,{participacao:'Participando'}).length,0);
});
test('seleção aceita várias campanhas por anúncio e impede duplicação ambígua na mesma campanha',()=>{
 const entries=[entry('P-1',0),entry('P-2',1)],m={entries,dynamic:[]},body=bodyFor(entries);
 assert.equal(v.prepareEntries(m,body,'3').length,2);assert.equal(v.prepareEntries(m,body,'3')[0].fingerprint,actions.fingerprint(entries[0].item));
 body.basis[0]='alterado';assert.throws(()=>v.prepareEntries(m,body,'3'),/mudou/);body.basis[0]=entries[0].basis;body.decision[0]='Revisar';assert.throws(()=>v.prepareEntries(m,body,'3'),/Participar/);
 const duplicated=[entry('P-1',0),{...entry('P-1',1),candidate:{...entry('P-1',1).candidate,offer_id:'OUTRA'}}];assert.throws(()=>v.selectedEntries({entries:duplicated},bodyFor(duplicated)),/uma oferta por anúncio/);
});
test('tabela por produto usa células comuns agrupadas, prazos por oferta e alternativa por campanha',()=>{
 const entries=[entry('P-1',0),entry('P-2',1)];entries[1].candidate.end_date='2026-11-10';
 const html=v.render({session:{mlCsrf:'csrf'},query:{}},{entries,groups:v.groupEntries(entries),catalog:{updatedAt:new Date().toISOString(),campaigns:[{campaign:entries[0].campaign,items:[]}]}});
 assert.match(html,/rowspan="2"/);assert.match(html,/21\/10\/2026 a 04\/11\/2026/);assert.match(html,/21\/10\/2026 a 10\/11\/2026/);assert.match(html,/visao=campanhas/);assert.match(html,/data-product-select="g0"/);assert.equal((html.match(/<th class=/g)||[]).length,30);
 const rows=html.match(/<tr data-offer-key[^]*?<\/tr>/g);assert.equal((rows[0].match(/<td /g)||[]).length,30);assert.equal((rows[1].match(/<td /g)||[]).length,21);
});
test('salvamento mantém a chave campanha/anúncio/oferta e não altera participação',async()=>{
 const entries=[entry('P-1',0),entry('P-2',1)],body=bodyFor(entries),writes=[];body.manual[0]='yes';body.manual[1]='yes';let committed=false;
 const pool={connect:async()=>({query:async(sql,a)=>{if(sql.startsWith('INSERT'))writes.push(a);if(sql==='COMMIT')committed=true;return {rows:[]};},release(){}})};
 await v.save(pool,'seller',{entries,dynamic:[]},body,'3');assert.equal(writes.length,2);assert.equal(writes[0][1],'SMART:P-1');assert.equal(writes[1][1],'SMART:P-2');assert.equal(JSON.parse(writes[0][4]).manual,true);assert.equal(committed,true);
});
test('modelo compartilhado evita reler produtos e custos a cada campanha',async()=>{
 const old={rows:pricing.marketplaceRows,freight:pricing.freightRules};let reads=0;const entries=[entry('P-1',0),entry('P-2',1)],catalog={updatedAt:new Date().toISOString(),campaigns:entries.map(e=>({campaign:e.campaign,items:[e.candidate]}))};
 const pool={query:async sql=>({rows:sql.includes('ml_promo_catalogo')?[{dados:catalog}]:[]})};pricing.marketplaceRows=async()=>{reads++;return [item()];};pricing.freightRules=async()=>[];
 try{const m=await v.model(pool,'seller');assert.equal(m.entries.length,2);assert.equal(m.groups.length,1);assert.equal(reads,1);}finally{pricing.marketplaceRows=old.rows;pricing.freightRules=old.freight;}
});
test('envio de várias campanhas mantém resultado por oferta e continua após uma recusa',async()=>{
 const original={Client:ml.MeliClient,snapshot:ml.snapshot,append:ml.appendResult,rows:pricing.marketplaceRows,freight:pricing.freightRules};
 const entries=[entry('P-1',0),entry('P-2',1)],reports=[],records=new Map(),accepted=new Set();let publishes=0,finalUpdates=0;
 const pool={query:async(sql,a=[])=>{if(sql.startsWith('SELECT anuncio'))return {rows:[...records].filter(([k])=>k.startsWith(a[1]+'|')).map(([,v])=>v)};if(sql.startsWith('INSERT INTO ml_promo_participacoes'))records.set(a[1]+'|'+a[2],{anuncio:a[2],dados:JSON.parse(a[3])});if(sql.startsWith('UPDATE ml_operacoes'))finalUpdates++;return {rows:[]};}};
 ml.MeliClient=class{async get(){return entries.map(e=>({...e.candidate,id:e.campaign.id,type:'SMART',status:accepted.has(e.campaign.id)?'pending':'candidate'}));}async request(method,path,params,body){publishes++;if(body.promotion_id==='P-1'){const error=Error('Oferta recusada');error.status=400;throw error;}accepted.add(body.promotion_id);return {price:271};}};
 ml.snapshot=async()=>({item:{status:'active',condition:'new',available_quantity:17},price:{gross:366.9}});ml.appendResult=async(pool,id,r)=>reports.push(r);pricing.marketplaceRows=async()=>[item()];pricing.freightRules=async()=>[];
 try{const op={id:'op',seller:'seller',dados:{entries:v.prepareEntries({entries,dynamic:[]},bodyFor(entries),'3')}};await v.run(pool,op);assert.equal(publishes,2);assert.equal(finalUpdates,1);assert.equal(reports.filter(r=>r.final).length,2);assert.equal(reports.find(r=>r.final&&r.campanha==='SMART:P-1').status,'Não participando');assert.equal(reports.find(r=>r.final&&r.campanha==='SMART:P-2').status,'Participando');await v.run(pool,op);assert.equal(publishes,3,'participação confirmada na segunda campanha não é reenviada');}finally{ml.MeliClient=original.Client;ml.snapshot=original.snapshot;ml.appendResult=original.append;pricing.marketplaceRows=original.rows;pricing.freightRules=original.freight;}
});

test('identidade da oferta não depende do índice após atualização do catálogo',()=>{const e=entry('P-1',0);assert.equal(v.entryKey(e),v.entryKey({...e,index:99}));assert.notEqual(v.entryKey(e),v.entryKey(entry('P-2',0)));});
