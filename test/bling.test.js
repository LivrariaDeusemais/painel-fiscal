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
