const {test}=require('node:test');
const assert=require('node:assert/strict');
const {render,safeReturn}=require('../src/integracoes/bling-shortcuts');
test('atalho mantém o marketplace filtrado e a URL de retorno',()=>{
 const req={originalUrl:'/ferramentas-ia/tabela-precos/tabela?marketplace=TikTok&status=Novo+custo'};
 const html=render(req,{csrf:'token',active:false},'links','TikTok');
 assert.ok(html.includes('name="marketplace" value="TikTok"'));assert.ok(html.includes('name="modulo" value="links"'));assert.ok(html.includes('status=Novo+custo'));assert.equal(safeReturn(req.originalUrl),req.originalUrl);
 assert.ok(render(req,{csrf:'token'},'links').includes('name="marketplace" value=""'));
 for(const url of ['https://other.test','//other.test','/ferramentas-ia/tabela-precos/tabela\n'])assert.equal(safeReturn(url),'/ferramentas-ia/tabela-precos/tabela');
});
test('atualização ativa desabilita o botão e acompanha a conclusão',()=>{
 const html=render({originalUrl:'/ferramentas-ia/tabela-precos/produtos'},{csrf:'token',active:true},'data');
 assert.ok(html.includes('disabled'));assert.ok(html.includes('Em andamento — aguarde'));assert.ok(html.includes('location.reload()'));assert.ok(html.includes('name="modulo" value="data"'));
});
