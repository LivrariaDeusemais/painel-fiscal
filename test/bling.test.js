const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizedProduct,defaultSupplierCost,balancesByMarketplace,encrypt,decrypt,BlingClient,runSync}=require('../src/integracoes/bling');

test('estoque Full usa o depósito da linha e não soma canais',()=>{
  const stock={depositos:[{id:1,saldoFisico:80},{id:2,saldoFisico:63},{id:3,saldoFisico:44}]};
  const settings={matriz:'1',full:{'Mercado Livre':'2',Shopee:'3'}};
  assert.deepEqual(balancesByMarketplace(stock,settings,'Mercado Livre'),{matrix:80,full:63});
  assert.deepEqual(balancesByMarketplace(stock,settings,'Shopee'),{matrix:80,full:44});
  assert.deepEqual(balancesByMarketplace(stock,settings,'Amazon'),{matrix:80,full:0});
  assert.equal(balancesByMarketplace({depositos:[]},settings,'Shopee').full,null);
});
test('cadastro não substitui custo da última compra pelo fornecedor',()=>{
  const p=normalizedProduct({id:123,codigo:' B1254 ',nome:'Bíblia',pesoLiquido:1.2,preco:199.86,fornecedor:{precoCusto:61.605}});
  assert.equal(p.sku,'B1254');assert.equal(p.weight,1.2);assert.equal(p.price,199.86);
  assert.equal(p.cost,undefined);
  assert.equal(normalizedProduct({id:1,codigo:'A',nome:'A',pesoLiquido:null}).weight,null);
});
test('tokens cifrados autenticam o conteúdo e não exibem segredo',()=>{
  process.env.BLING_TOKEN_ENCRYPTION_KEY='test-only-key-with-at-least-32-characters';
  const a=encrypt('secret-token'),b=encrypt('secret-token');
  assert.notEqual(a,b);assert.doesNotMatch(a,/secret-token/);assert.equal(decrypt(a),'secret-token');
  const parts=a.split(':');parts[1]=Buffer.alloc(16).toString('base64');assert.throws(()=>decrypt(parts.join(':')));
});
test('cliente trata limite de consultas sem escrever no Bling',async()=>{
  process.env.BLING_TOKEN_ENCRYPTION_KEY='test-only-key-with-at-least-32-characters';
  const client={query:async sql=>({rows:sql.includes('FOR UPDATE')?[{access_token:encrypt('test'),refresh_token:encrypt('refresh'),expira_em:new Date(Date.now()+3600000)}]:[]}),release(){}};
  const pool={connect:async()=>client};let calls=0;const waits=[];
  const api=new BlingClient(pool,async(url,options)=>{
    assert.ok(String(url).startsWith('https://api.bling.com.br/Api/v3/'));
    assert.equal(options.method,undefined);
    calls++;return calls===1?{status:429,headers:new Headers({'retry-after':'2'})}:{status:200,ok:true,json:async()=>({data:[]})};
  },async ms=>waits.push(ms));
  assert.deepEqual(await api.get('/depositos'),[]);assert.equal(calls,2);assert.ok(waits.includes(2000));
  await assert.rejects(api.get('/nfe/123/lancar-estoque'),/não permitida/);
});
test('sincronização salva Matriz e Full e mantém custo e vínculos intactos',async()=>{
  const calls=[];
  const db={query:async(sql,args)=>{calls.push({sql,args});return {rows:sql.startsWith('SELECT sku')?[{sku:'B1254',bling_id:'123'}]:[]};}};
  const api={all:async(path)=>path==='/produtos/fornecedores'?[{id:9,produto:{id:123},padrao:true,precoCusto:61.605}]:[{id:123,codigo:'B1254'}],get:async(path)=>path.startsWith('/produtos/')?{id:123,codigo:'B1254',nome:'Bíblia',pesoLiquido:1.2,preco:199.86}:[{produto:{id:123},depositos:[{id:1,saldoFisico:80},{id:2,saldoFisico:63},{id:3,saldoFisico:44}]}]};
  await runSync({},db,7,{matriz:'1',full:{'Mercado Livre':'2',Shopee:'3'}},api);
  const stock=calls.find(c=>c.sql.includes('SET estoque='));
  assert.equal(stock.args[1],80);assert.deepEqual(JSON.parse(stock.args[2]),{'Mercado Livre':63,Shopee:44});
  assert.equal(calls.some(c=>c.sql.includes('tabela_preco_vinculos')),false);
  assert.equal(calls.find(c=>/SET custo=/.test(c.sql)).args[1],61.605);
  assert.equal(calls.at(-1).args[1],'concluida');
});
test('saldo incompleto não zera nem sobrescreve saldo conhecido',async()=>{
  const calls=[];const db={query:async(sql,args)=>{calls.push({sql,args});return{rows:[]};}};
  const api={all:async(path)=>path==='/produtos/fornecedores'?[]:[{id:123,codigo:'A'}],get:async(path)=>path.startsWith('/produtos/')?{id:123,codigo:'A',nome:'A'}:[{produto:{id:123},depositos:[{id:1,saldoFisico:80}]}]};
  await runSync({},db,1,{matriz:'1',full:{Shopee:'3'}},api);
  assert.equal(calls.some(c=>c.sql.includes('SET estoque=')),false);
  assert.equal(calls.at(-1).args[1],'parcial');
});

test('custo usa apenas fornecedor padrão, mesmo com fornecedores antigos',()=>{
  assert.deepEqual(defaultSupplierCost([{id:1,padrao:false,precoCusto:147.52},{id:2,padrao:true,precoCusto:156.88}]),{cost:156.88,supplierId:'2'});
  for (const value of [null,undefined,0,-1,'', 'abc', true]) assert.throws(()=>defaultSupplierCost([{padrao:true,precoCusto:value}]),/inválido/);
  assert.throws(()=>defaultSupplierCost([{padrao:false,precoCusto:10}]),/não encontrado/);
  assert.throws(()=>defaultSupplierCost([{padrao:true,precoCusto:10},{padrao:true,precoCusto:20}]),/Mais de um/);
});
test('falha na consulta de fornecedores preserva custo e ainda atualiza estoque',async()=>{
  const calls=[];const db={query:async(sql,args)=>{calls.push({sql,args});return{rows:[]};}};
  const api={all:async path=>{if(path==='/produtos/fornecedores')throw new Error('Sem permissão');return [{id:123,codigo:'A'}];},get:async path=>path.startsWith('/produtos/')?{id:123,codigo:'A',nome:'A'}:[{produto:{id:123},depositos:[{id:1,saldoFisico:80}]}]};
  await runSync({},db,1,{matriz:'1'},api);
  assert.equal(calls.some(c=>/SET custo=/.test(c.sql)),false);
  assert.equal(calls.find(c=>c.sql.includes('SET estoque=')).args[1],80);
  assert.equal(calls.at(-1).args[1],'parcial');
});

test('preço bruto por loja e anúncio ignora o promocional',()=>{
  const {grossLink}=require('../src/integracoes/bling');
  const p={id:'123',sku:'B1103',name:'Bíblia'};
  assert.equal(grossLink({id:5,produto:{id:123},codigo:'ALI123',preco:325.57,precoPromocional:200},p,'8').current_price,325.57);
  const ml=grossLink({id:9,produto:{id:123},anuncioLoja:{id:'MLB123'},preco:{valor:439.86,promocional:299.90}},p,'10',true);
  assert.equal(ml.current_price,439.86);assert.equal(ml.store_id,'MLB123');
  assert.equal(ml.promotional_price,undefined);
  assert.throws(()=>grossLink({produto:{id:321},codigo:'X',preco:10},p,'8'),/divergente/);
});
test('atualiza somente bruto do anúncio exato preservando dados de líquido',async()=>{
  const {saveGrossLinks}=require('../src/integracoes/bling');const calls=[];
  const db={query:async(sql,args)=>{calls.push({sql,args});return {rows:sql.startsWith('SELECT id,')?[{id:1,sku:'B1103',id_loja:'MLB1',id_produto:'123'},{id:2,sku:'B1103',id_loja:'MLB2',id_produto:'123'}]:[]};},release(){}};
  await saveGrossLinks({connect:async()=>db},'Mercado Livre',[{sku:'B1103',product_id:'123',store_id:'MLB2',current_price:450,raw:{bruto_origem:'Bling'}}]);
  const update=calls.find(c=>c.sql.startsWith('UPDATE tabela_preco_vinculos'));
  assert.equal(update.args[0],2);assert.equal(update.args[1],450);
  assert.doesNotMatch(update.sql,/preco_promocional\s*=|preco_liquido_manual/);
  assert.equal(calls.at(-1).sql,'COMMIT');
});
test('associação de anúncio a outro produto interrompe gravação',async()=>{
  const {saveGrossLinks}=require('../src/integracoes/bling');const calls=[];
  const db={query:async sql=>{calls.push(sql);return {rows:sql.startsWith('SELECT id,')?[{id:1,sku:'OUTRO',id_loja:'MLB1',id_produto:'999'}]:[]};},release(){}};
  await assert.rejects(saveGrossLinks({connect:async()=>db},'Mercado Livre',[{sku:'B1103',product_id:'123',store_id:'MLB1',current_price:450}]),/outro produto/);
  assert.equal(calls.at(-1),'ROLLBACK');assert.equal(calls.some(sql=>sql.startsWith('UPDATE tabela_preco_vinculos')),false);
});
test('consulta focada atualiza apenas SKUs selecionados e relata código ausente',async()=>{
  const calls=[],details=[];
  const db={query:async(sql,args)=>{calls.push({sql,args});return {rows:[]};}};
  const api={all:async path=>path==='/produtos'?[{id:1,codigo:'B1607'},{id:2,codigo:'B1605'},{id:3,codigo:'OUTRO'}]:[],get:async(path)=>{details.push(path);return path.startsWith('/produtos/')?{id:Number(path.split('/').at(-1)),codigo:path.endsWith('/1')?'B1607':'B1605',nome:'Livro'}:[{produto:{id:1},depositos:[{id:1,saldoFisico:5}]},{produto:{id:2},depositos:[{id:1,saldoFisico:6}]}];}};
  await runSync({},db,1,{matriz:'1',selectedSkus:['B1607','B1605','AUSENTE']},api);
  assert.ok(details.includes('/produtos/1'));assert.ok(details.includes('/produtos/2'));assert.ok(!details.includes('/produtos/3'));
  const stocks=calls.filter(c=>c.sql.includes('SET estoque='));assert.deepEqual(stocks.map(c=>c.args[0]),['B1607','B1605']);
  assert.ok(calls.some(c=>c.sql.includes('divergencias=')&&c.args[1].includes('AUSENTE')));
});

test('atualização de dados usa ativos, limpa somente inativos/excluídos confirmados e dispensa lojas',async()=>{
  const calls=[],apiCalls=[];
  const db={query:async(sql,args)=>{calls.push({sql,args});return {rows:sql.startsWith('DELETE FROM tabela_preco_produtos')?[{sku:'OFF',bling_id:'2'}]:[]};}};
  const api={all:async(path,params)=>{apiCalls.push([path,params]);if(path==='/produtos')return params.criterio===2?[{id:1,codigo:'ON'}]:params.criterio===3?[{id:2,codigo:'OFF'}]:[{id:3,codigo:'GONE'}];return [];},get:async path=>{apiCalls.push([path]);return path==='/produtos/1'?{id:1,codigo:'ON',nome:'Ativo',pesoLiquido:1,preco:20}:[{produto:{id:1},depositos:[{id:9,saldoFisico:5}]}];}};
  await runSync({},db,1,{module:'data',matriz:'9',lojas:{TikTok:'8'}},api);
  assert.ok(!apiCalls.some(([path])=>path==='/produtos/2'||path==='/produtos/3'||path==='/produtos/lojas'));
  const removed=calls.find(c=>c.sql.startsWith('DELETE FROM tabela_preco_produtos'));assert.deepEqual(removed.args[0],['2','3']);
  assert.deepEqual(calls.find(c=>c.sql.startsWith('DELETE FROM tabela_preco_vinculos')).args,[['OFF']]);
  const report=JSON.parse(calls.filter(c=>c.sql.includes('diagnostico=$3')).at(-1).args[2]);assert.ok(report.some(r=>r.modulo==='Limpeza'&&r.sku==='OFF'&&r.status==='atualizado'));assert.ok(report.some(r=>r.modulo==='Estoque'&&r.status==='atualizado'));
});
test('atualização de vínculos não consulta detalhes, fornecedores ou estoque e ignora vínculos inativos',async()=>{
  const calls=[],requests=[];const db={query:async(sql,args)=>{calls.push({sql,args});return{rows:[]};}};
  const api={all:async(path,params)=>{requests.push(path);if(path==='/produtos')return params.criterio===2?[{id:1,codigo:'ON',nome:'Ativo'}]:[];return [{produto:{id:2},loja:{id:8},codigo:'INATIVO'}];},get:async()=>{throw Error('Não deve consultar detalhes');}};
  await runSync({},db,1,{module:'links',matriz:'9',lojas:{TikTok:'8'}},api);
  assert.ok(!requests.includes('/produtos/fornecedores'));assert.ok(!calls.some(c=>c.sql.includes('SET estoque=')||c.sql.includes('SET custo=')));assert.equal(calls.at(-1).args[1],'concluida');
});
test('falha ao consultar excluídos interrompe limpeza sem excluir produtos por ausência',async()=>{
  const calls=[];const db={query:async(sql,args)=>{calls.push({sql,args});return{rows:[]};}};
  const api={all:async(path,params)=>{if(params.criterio===4)throw Error('Consulta indisponível');return [];}};
  await runSync({},db,1,{module:'data',matriz:'1'},api);assert.ok(!calls.some(c=>c.sql.startsWith('DELETE')));assert.equal(calls.at(-1).sql.includes("status='falhou'"),true);
});
