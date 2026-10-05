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
test('duplicidade é calculada antes dos filtros e paginação mantém ordenação e limites',async()=>{
  const {managedLinkRows}=require('../src/tabela-precos/service');let calls=[];
  const result=await managedLinkRows({query:async(sql,args)=>{calls.push({sql,args});return {rows:calls.length===1?[{total:101}]:[]};}},{busca:'B1234',marketplace:'Mercado Livre',duplicados:'sim',pagina:'99'});
  assert.equal(result.pages,3);assert.equal(result.page,3);assert.equal(calls[1].args.at(-1),100);
  assert.match(calls[0].sql,/COUNT\(DISTINCT NULLIF/);assert.match(calls[0].sql,/GROUP BY marketplace,UPPER\(TRIM\(sku\)\)/);
  assert.match(calls[1].sql,/LIMIT 50 OFFSET \$5/);assert.deepEqual(calls[0].args,['B1234','%B1234%','Mercado Livre','sim']);
});
test('tela destaca duplicados, preserva filtros nos links e escapa os dados',()=>{
  const {render}=require('../src/tabela-precos/links-page');
  const html=render({session:{linkDeleteCsrf:'t'}},{rows:[{id:1,sku:'<SKU>',marketplace:'Mercado Livre',id_loja:'MLB123',anuncios:2}],total:51,page:1,pages:2,filters:{search:'B1234',marketplace:'Mercado Livre',duplicates:'sim'}},['Mercado Livre'],true);
  assert.ok(html.includes('Duplicado'));assert.ok(html.includes('2 anúncios'));assert.ok(html.includes('tpb-delete'));assert.ok(html.includes('&lt;SKU&gt;'));assert.ok(html.includes('pagina=2'));assert.ok(html.includes('duplicados=sim'));
});
