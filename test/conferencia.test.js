const {test}=require('node:test'),assert=require('node:assert/strict');const s=require('../src/conferencia/service');const access=require('../src/access/catalog');
test('períodos mensal, trimestral, anual e personalizado',()=>{assert.equal(s.period({mode:'mensal',year:2024,month:2}).end,'2024-02-29');assert.deepEqual(s.period({mode:'trimestral',year:2026,quarter:3}),{mode:'trimestral',year:2026,start:'2026-07-01',end:'2026-09-30'});assert.equal(s.period({mode:'anual',year:2026}).end,'2026-12-31');assert.throws(()=>s.period({mode:'personalizada',start:'2026-02-30',end:'2026-03-31'}));});
test('trimestre nunca vira valor mensal estimado; lacunas não são cobertura',()=>{const q={start:'2026-07-01',end:'2026-09-30'};assert.equal(s.coverage([q],s.period({mode:'mensal',year:2026,month:8})).complete,false);assert.equal(s.coverage([q],q).complete,true);assert.equal(s.coverage([q],s.period({mode:'anual',year:2026})).complete,false);});
test('saldos usam primeiro anterior e último saldo; movimentos somam sem somar contas-pai',()=>{const x=s.aggregate([{data:{lines:[{code:'1',previous:10,value:20,debit:12,credit:2}]}},{data:{lines:[{code:'1',previous:20,value:25,debit:8,credit:3}]}}],'balancete');assert.deepEqual(x,[{code:'1',previous:10,value:25,debit:20,credit:5}]);});
test('nova capacidade não ganha acessos e downloads são separados',()=>{assert.equal(access.permitted({perfil:'CONTADOR',functionAccess:{}},'conferencia-contabil'),false);assert.equal(access.actionFor({method:'GET',originalUrl:'/contabil/conferencia/download/abc'}),'download');assert.equal(access.actionFor({method:'GET',originalUrl:'/contabil/conferencia/relatorio'}),'download');assert.equal(access.capability('/contabil/conferencia').restriction,'sensitive');});
test('grupos somam somente filhos comparáveis, sem duplicar subtotais ou validar',()=>{
 const row=(code,bold,previous,debit,actual)=>({code,bold,previous,debit,credit:0,value:previous+debit,actual,reference:debit,review:{status:'A conferir'}});
 const rows=[row('1',true,30,300,null),row('2',true,10,100,99999),row('3',false,4,40,4000),row('4',false,6,60,null),row('5',false,20,200,2000)];
 s.rollup(rows,'balancete');assert.equal(rows[1].actual,4000);assert.equal(rows[0].actual,6000);assert.equal(rows[0].diff,5700);assert.equal(rows[0].partial,true);assert.match(rows[0].source,/Comparação parcial/);assert.equal(rows[3].actual,null);assert.equal(rows[0].review.status,'A conferir');
 rows[3].actual=6000;s.rollup(rows,'balancete');assert.equal(rows[0].actual,12000);assert.equal(rows[0].partial,false);
});
test('grupo sem nenhuma fonte permanece indisponível; zero real é comparável',()=>{
 const rows=[{bold:true,previous:0,debit:10,credit:0,value:10,actual:null,reference:10},{previous:0,debit:10,credit:0,value:10,actual:null,reference:10}];
 s.rollup(rows,'balancete');assert.equal(rows[0].actual,null);assert.equal(rows[0].diff,null);
 rows[1].actual=0;s.rollup(rows,'balancete');assert.equal(rows[0].actual,0);assert.equal(rows[0].diff,-10);
});
test('não infere um grupo se os quatro valores contábeis não conciliam',()=>{
 const rows=[{bold:true,previous:1,debit:10,credit:0,value:11,actual:null,reference:10},{previous:4,debit:10,credit:0,value:14,actual:100,reference:10}];s.rollup(rows,'balancete');assert.equal(rows[0].actual,null);
});
test('DRE soma seções e resultados com sinais, sem duplicar seus detalhes',()=>{
 const rows=[['RECEITA BRUTA',100,true,null],['Vendas',100,false,100],['DEDUÇÕES DA RECEITA BRUTA',-10,true,null],['Devoluções',-10,false,null],['RECEITA LÍQUIDA',90,true,null],['CUSTOS',-40,true,null],['Mercadorias',-40,false,-40],['LUCRO BRUTO',50,true,null],['DESPESAS OPERACIONAIS',-20,true,null],['DESPESAS ADMINISTRATIVAS',-20,false,null],['Aluguel',-20,false,-20],['RECEITAS FINANCEIRAS',2,true,null],['Juros',2,false,2],['RESULTADO OPERACIONAL',32,true,null],['RESULTADO ANTES DO IR E CSL',32,true,null],['LUCRO LÍQUIDO DO EXERCÍCIO',32,true,null]].map(([label,value,bold,actual])=>({label,value,bold,actual,reference:value}));
 s.rollup(rows,'dre');assert.equal(rows[8].actual,-20);assert.equal(rows[15].actual,42);assert.equal(rows[15].partial,true);
 rows[3].actual=-10;s.rollup(rows,'dre');assert.equal(rows[15].actual,32);assert.equal(rows[15].partial,false);
});
