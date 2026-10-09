const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const previsao = require('../src/services/rotina-previsao');
const codigo = fs.readFileSync(require.resolve('../src/routes/index'), 'utf8');

test('estimativa prioriza edição mensal, cadastro positivo e histórico, preservando vazio e zero editados', () => {
  assert.equal(previsao.resolverEstimativa({valor_estimado_editado:true,valor_estimado_mes:'80.12',valor_estimado:'90',valor_historico:'100'}),80.12);
  assert.equal(previsao.resolverEstimativa({valor_estimado_editado:true,valor_estimado_mes:null,valor_estimado:90}),null);
  assert.equal(previsao.resolverEstimativa({valor_estimado_editado:true,valor_estimado_mes:'0',valor_estimado:90}),0);
  assert.equal(previsao.resolverEstimativa({valor_estimado:90,valor_historico:100}),90);
  assert.equal(previsao.resolverEstimativa({valor_estimado:0,valor_historico:'120.34'}),120.34);
  assert.equal(previsao.resolverEstimativa({valor_estimado:null,valor_historico:null}),null);
});

test('valores monetários e datas inválidas não são aceitos', () => {
  assert.equal(previsao.valorEstimado('1.234,56'),1234.56);
  assert.equal(previsao.valorEstimado('1234.56'),1234.56);
  assert.equal(previsao.valorEstimado(''),null);
  assert.equal(previsao.valorEstimado('0,00'),0);
  for (const valor of ['-1','abc','1,2,3','Infinity','12.345','1000000000000']) assert.throws(() => previsao.valorEstimado(valor));
  assert.equal(previsao.mesValido('2026-10'),true);
  assert.equal(previsao.mesValido('2026-13'),false);
  assert.equal(previsao.dataValida('2026-02-30'),false);
  assert.equal(previsao.dataValida('2028-02-29'),true);
});

function contextoRotina(rows = []) {
  const consultas = [];
  const ctx = vm.createContext({
    ...previsao, URLSearchParams, console,
    router:{get:(_path,...args) => {ctx.handler=args.at(-1);}},
    protegerRota:()=>{}, permitirPerfis:()=>()=>{},
    ensureRotinaDespesasColumns:async()=>{},
    getPainelConfig:async()=> '2026-10', getMesAnoAtual:()=> '2026-10',
    formatMesAnoCurto:()=> 'Out-26', getStatusMesCompetencia:async()=> 'PENDENTE',
    normalizarDiaVencimento: value => String(value || ''),
    gerarOpcoesMesAno:()=>'', gerarOpcoesDiaVencimento:()=>'',
    formatDiaVencimento:value=>value||'', formatDateBR:()=>'',
    normalizarStatusPagto:value=>value||'A_PAGAR', normalizarStatusLinha:value=>value||'PENDENTE',
    renderStatusPagtoOptions:()=>'', renderGlobalHeader:()=>'',
    escapeHtmlGlobal:value=>String(value||'').replaceAll('"','&quot;'),
    MESES_CURTOS_PT:['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
    pool:{query:async(sql,values)=>{consultas.push({sql,values}); return {rows: sql.includes('SELECT DISTINCT fornecedor') ? [] : rows};}},
  });
  const a=codigo.indexOf("router.get('/rotina-despesas',");
  const b=codigo.indexOf("router.post('/rotina-despesas/valor-estimado/",a);
  vm.runInContext(codigo.slice(a,b),ctx);
  return {ctx, consultas};
}

test('lista rende valores, total, menus e scripts; filtros excluem sem data e contas anteriores à vigência', async () => {
  const {ctx,consultas}=contextoRotina([
    {id:1,fornecedor:'Teste',valor_estimado:'200',ativo_mes:true},
    {id:2,fornecedor:'Histórico',valor_historico:'150.5',ativo_mes:false},
    {id:3,fornecedor:'Editado',valor_estimado_editado:true,valor_estimado_mes:'99.5'},
    {id:4,fornecedor:'Sem valor'},
  ]);
  let html;
  await ctx.handler({query:{ativo:'true',vencimento_inicio:'2026-10-01',vencimento_fim:'2026-10-15'}},{send:value=>html=value});
  assert.ok(html.includes('450,00'),html.slice(0,200));
  assert.ok(html.includes('• 1 sem valor'));
  assert.ok(html.includes('estimativa-editada'));
  assert.ok(html.includes('Sem data'));
  assert.ok(html.includes('Ativos ✓'));
  assert.ok(html.includes('col-rot-estimado'));
  for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
  const consulta=consultas.at(-1);
  assert.deepEqual(Array.from(consulta.values),['2026-10',true,'2026-10-01','2026-10-15']);
  assert.ok(consulta.sql.includes("COALESCE(r.vigorar_a_partir, '2026-01') <= $1"));
  assert.ok(consulta.sql.includes('IS NOT NULL'));
  assert.ok(consulta.sql.includes("INTERVAL '3 months'"));
  assert.ok(consulta.sql.includes("l.data_despesa < ($1 || '-01')::date"));
  assert.ok(consulta.sql.includes('ORDER BY l.data_despesa DESC, l.id DESC'));
  assert.ok(consulta.sql.includes('l.categoria_id = COALESCE(r.subcategoria_id, r.categoria_principal_id)'));
});

test('Sem data desativa período e seleciona somente vencimentos vazios',async()=>{
  const {ctx,consultas}=contextoRotina();
  await ctx.handler({query:{sem_data:'1',vencimento_inicio:'2026-10-01',ativo:'false'}},{send:()=>{}});
  assert.deepEqual(Array.from(consultas.at(-1).values),['2026-10',false]);
  assert.ok(consultas.at(-1).sql.includes('IS NULL'));
  assert.ok(!consultas.at(-1).sql.includes('>= $3::date'));
});

test('edição grava só valor e marca mensal, sem sobrescrever status, pagamento e atividade existentes',async()=>{
  let handler,consulta,resposta,status;
  const ctx=vm.createContext({...previsao,
    router:{post:(_path,...args)=>{handler=args.at(-1);}}, protegerRota:()=>{}, permitirPerfis:()=>()=>{},
    ensureRotinaDespesasColumns:async()=>{}, pool:{query:async(sql,values)=>{consulta={sql,values};return{rows:[{rotina_id:1}]};}},
  });
  const a=codigo.indexOf("router.post('/rotina-despesas/valor-estimado/");
  vm.runInContext(codigo.slice(a,codigo.indexOf("router.post('/rotina-despesas/mes-referencia'",a)),ctx);
  const res={status:n=>{status=n;return res;},json:value=>{resposta=value;}};
  await handler({params:{id:1},body:{mes_ano:'2026-10',valor:'1.234,56'}},res);
  assert.equal(resposta.valor,1234.56);
  assert.deepEqual(Array.from(consulta.values),[1,'2026-10',1234.56]);
  const update=consulta.sql.split('DO UPDATE')[1];
  assert.ok(!update.includes('status_linha ='));
  assert.ok(!update.includes('status_pagto ='));
  assert.ok(!update.includes('ativo ='));
  await handler({params:{id:1},body:{mes_ano:'2026-13',valor:'10'}},res);
  assert.equal(status,400);
});

test('Nova Conta grava início escolhido e valor padrão; editar preserva ID e permite início legado',async()=>{
  for (const editar of [false,true]) {
    let handler,consulta;
    const ctx=vm.createContext({...previsao,
      router:{post:(_path,...args)=>{handler=args.at(-1);}},
      ensureRotinaDespesasColumns:async()=>{}, getMesAnoAtual:()=> '2026-10',
      normalizarDiaVencimento:value=>value||'',toNullableInt:value=>value?Number(value):null,
      pool:{query:async(sql,values)=>{consulta={sql,values};return{rows:[]};}},
    });
    const a=codigo.indexOf(editar ? "router.post('/rotina-despesas/editar/:id'" : "router.post('/rotina-despesas/novo'");
    const b=codigo.indexOf(editar ? "router.get('/rotina-despesas/excluir/:id'" : "// FORM EDITAR",a);
    vm.runInContext(codigo.slice(a,b),ctx);
    let destino;
    await handler({params:{id:7},body:{fornecedor:'Teste',valor_estimado:'320,50',vigorar_a_partir:'2026-11',ativo:'true'}},
      {redirect:value=>{destino=value;},send:value=>assert.fail(value)});
    assert.equal(destino,'/rotina-despesas');
    assert.equal(consulta.values.at(-1),'2026-11');
    assert.equal(consulta.values.at(-2),320.50);
    if (editar) {assert.equal(consulta.values[12],7); assert.ok(consulta.sql.includes('WHERE id = $13'));}
    else assert.ok(consulta.sql.includes('$13,$14'));
  }
});
