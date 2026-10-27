const {test}=require('node:test'),assert=require('node:assert/strict'),{render}=require('../src/assets/painel-indicators');
test('tabelas preservam zero, estimativa desconhecida e links sem misturar dados',()=>{
 const html=render([{key:'vencimentos-hoje',count:0,amount:0,unknown:1,url:'/contas'},{key:'arquivo',count:2,url:'/arquivo'}],{menu:'financeiro'});
 assert.match(html,/Qtde Contas/);assert.match(html,/Valor estimado/);assert.match(html,/R\$\s*0,00/);assert.match(html,/1 conta\(s\) sem valor informado/);assert.match(html,/href="\/arquivo">2/);assert.ok(html.indexOf('Contas a vencer')<html.indexOf('Arquivos para lançar'));
});
test('contábil mostra competência, tipo e status escapados; falha nunca aparece como resolvida',()=>{
 const html=render([{key:'fechamento:2026-08:xml',month:'2026-08',fileType:'XML <script>',status:'Em andamento',url:'/central?mes=2026-08'}],{menu:'contabil',closing:true});assert.match(html,/08\/2026/);assert.match(html,/XML &lt;script&gt;/);assert.match(html,/Em andamento/);assert.doesNotMatch(html,/<script>/);
 const failure=render([{key:'fechamento:erro',label:'Consulta indisponível',url:'/central'}],{menu:'contabil',closing:true});assert.match(failure,/Consulta indisponível/);assert.doesNotMatch(failure,/Nenhuma pendência/);
});
test('mostra No prazo sempre e Atraso somente quando houver contas vencidas',()=>{
 const due={key:'vencimentos-hoje',count:1,amount:100.10,url:'/hoje',overdue:{count:2,amount:17.80,url:'/atrasadas'}};
 const html=render([due],{menu:'financeiro'});assert.match(html,/Status/);assert.ok(html.indexOf('No prazo')<html.indexOf('Atraso'));assert.match(html,/class="pn-indicator-overdue"/);assert.match(html,/href="\/atrasadas">2/);assert.match(html,/17,80/);
 const noLate=render([{...due,overdue:{count:0,amount:0}}],{menu:'financeiro'});assert.match(noLate,/No prazo/);assert.doesNotMatch(noLate,/>Atraso<|pn-indicator-overdue/);
});
