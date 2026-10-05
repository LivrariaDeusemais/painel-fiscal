const test=require('node:test');
const assert=require('node:assert/strict');
const {deleteLink}=require('../src/tabela-precos/service');
test('exclusão exige o vínculo exato e não altera o produto ou outros anúncios',async()=>{
  let call;
  const pool={query:async(sql,args)=>{call={sql,args};return {rows:[{id:7}]};}};
  await deleteLink(pool,{id:'7',sku:'L1233',anuncio:'MLB7584362212',marketplace:'Mercado Livre'});
  assert.deepEqual(call.args,['7','L1233','MLB7584362212','Mercado Livre']);
  assert.match(call.sql,/DELETE FROM tabela_preco_vinculos WHERE id=\$1 AND sku=\$2 AND COALESCE/);
  assert.ok(!call.sql.includes('tabela_preco_produtos'));
  await assert.rejects(deleteLink({query:async()=>({rows:[]})},{id:7,sku:'L1233',marketplace:'Mercado Livre'}),/alterado/);
  await assert.rejects(deleteLink(pool,{id:'7 OR 1=1',sku:'L1233',marketplace:'Mercado Livre'}),/inválido/);
});
