const {test}=require('node:test');
const assert=require('node:assert/strict');
const {vincularPar}=require('../src/services/arquivo-pares');
const rows=()=>[{id:1,tipo:'PDF',status:'DISPONIVEL',nome_arquivo:'danfe.pdf',analise_status:'COMPROVANTE'},{id:2,tipo:'XML',status:'DISPONIVEL',nome_arquivo:'nota.xml',analise_status:'AGUARDANDO_PDF',chave_fiscal:'123',fornecedor:'Evopack',numero_documento:'3642',valor_documento:'735.00'}];
function db(items,fail=false){const calls=[];let released=false;return {calls,get released(){return released;},connect:async()=>({query:async(sql,args)=>{calls.push({sql,args});if(sql.startsWith('SELECT'))return {rows:items};if(fail&&sql.startsWith('UPDATE'))throw Error('falha');return {rowCount:2};},release(){released=true;}})};}
test('vincula reciprocamente e preserva metadados fiscais e auditoria em uma transação',async()=>{const pool=db(rows());assert.deepEqual(await vincularPar(pool,['2','1'],{id:5,nome:'Operador'},()=>true),{pdfId:1,xmlId:2});assert.match(pool.calls[1].sql,/FOR UPDATE/);const update=pool.calls.find(c=>c.sql.startsWith('UPDATE'));assert.deepEqual(update.args.slice(0,6),[1,2,'123',null,'Evopack','3642']);assert.equal(update.args[8],'735.00');assert.equal(JSON.parse(update.args[9]).vinculoManual.usuarioId,5);assert.equal(pool.calls.at(-1).sql,'COMMIT');assert.ok(pool.released);});
test('rejeita cardinalidade, IDs repetidos e inválidos antes de acessar o banco',async()=>{for(const ids of [undefined,['1'],['1','2','3'],['1','1'],['1','2x'],['-1','2']])await assert.rejects(vincularPar({},ids,{},()=>true),/exatamente/);});
test('rejeita dois arquivos do mesmo tipo, pares existentes, indisponíveis, ausentes e chaves divergentes',async()=>{const variants=[r=>r[0].tipo='XML',r=>r[0].par_id=9,r=>r.push({id:9,par_id:1}),r=>r[0].status='USADO',r=>r[0].analise_status='COMPLETO',r=>r[0].analise_status='DUPLICADO',r=>r[0].analise_status='ARQUIVO_AUSENTE',r=>r[0].chave_fiscal='456',r=>r.pop()];for(const change of variants){const items=rows();change(items);const pool=db(items);await assert.rejects(vincularPar(pool,[1,2],{},()=>true));assert.equal(pool.calls.at(-1).sql,'ROLLBACK');assert.ok(!pool.calls.some(c=>c.sql.startsWith('UPDATE')));assert.ok(pool.released);}await assert.rejects(vincularPar(db(rows()),[1,2],{},()=>false),/ausentes/);});
test('falha ao gravar desfaz a transação e libera a conexão',async()=>{const pool=db(rows(),true);await assert.rejects(vincularPar(pool,[1,2],{},()=>true),/falha/);assert.equal(pool.calls.at(-1).sql,'ROLLBACK');assert.ok(pool.released);});

const {paresPorNome, conciliarPorNome}=require('../src/services/arquivo-pares');
const nomeExemplo='Etiqueta 10x15 - Mercado Livre-invoice-2000019669366Out-26';
function parNome() {return rows().map((r,i)=>({...r,nome_original:nomeExemplo+(i?'.xml':'.pdf')}));}
test('reconhece o par do exemplo pelo nome original mesmo após renomear e sem chave no PDF',()=>{
  const itens=parNome();
  assert.equal(paresPorNome(itens).length,1);
  itens[0].nome_original=nomeExemplo.toUpperCase()+'.PDF';
  assert.equal(paresPorNome(itens).length,1);
});
test('não associa nomes diferentes, números isolados, chaves conflitantes ou pares ambíguos',()=>{
  for(const alterar of [
    r=>r[0].nome_original='outra nota.pdf',
    r=>{r[0].nome_original='Fornecedor A NF 898.pdf';r[1].nome_original='Fornecedor B NF 898.xml';},
    r=>r[0].chave_fiscal='outra',
    r=>r.push({...r[0],id:3}),
    r=>r.push({...r[1],id:3}),
    r=>r[0].par_id=9,
    r=>r[1].status='USADO',
    r=>r[0].analise_status='DUPLICADO',
    r=>r[1].analise_status='ARQUIVO_AUSENTE'
  ]){const itens=parNome();alterar(itens);assert.equal(paresPorNome(itens).length,0);}
});
test('conciliação por nome grava chave, dados XML e critério automático preservando arquivos',async()=>{
  const itens=parNome(), pool=db(itens);
  pool.query=async()=>({rows:itens});
  assert.equal(await conciliarPorNome(pool,()=>true),1);
  const update=pool.calls.find(c=>c.sql.startsWith('UPDATE'));
  assert.equal(update.args[2],'123');
  const audit=JSON.parse(update.args[9]);
  assert.equal(audit.vinculoAutomatico.criterio,'NOME_ORIGINAL');
  assert.equal(audit.vinculoManual,undefined);
  assert.equal(pool.calls.at(-1).sql,'COMMIT');
});
