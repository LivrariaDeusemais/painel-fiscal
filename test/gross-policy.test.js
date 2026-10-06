const {test}=require('node:test');
const assert=require('node:assert/strict');
const {applyGrossPolicy}=require('../src/tabela-precos/pricing');
function item(discount,manual=null) {
  return {row:{sem_vinculo:false,novo_bruto_manual:manual},published:{grossPrice:200,discount},rule:{discount:0.3},result:{status:'OK',finalPrice:100,details:{margin:0.1,netProfit:10}}};
}
test('limites do status bruto incluem 6% e 50%, mas 50,0001% reduz',()=>{
  for(const [value,status] of [[0,'Aumentar valor'],[0.06,'Aumentar valor'],[0.060001,'Manter valor'],[0.5,'Manter valor'],[0.500001,'Reduzir valor']]) assert.equal(applyGrossPolicy(item(value)).grossStatus,status);
});
test('manter repete publicado e aumentar/reduzir usam desconto da regra',()=>{
  assert.equal(applyGrossPolicy(item(0.3)).result.grossPrice,200);
  for(const d of [0.01,0.6]) {
    const result=applyGrossPolicy(item(d)).result;
    assert.equal(result.finalPrice,100);
    assert.equal(result.grossPrice,100/0.7);
    assert.ok(Math.abs(result.discount-0.3)<1e-12);
  }
});
test('edição por anúncio mantém líquido e margem, recalculando desconto',()=>{
  const original=item(0.3,250);const updated=applyGrossPolicy(original);
  assert.equal(updated.result.grossPrice,250);
  assert.equal(updated.result.discount,0.6);
  assert.equal(updated.result.finalPrice,100);
  assert.deepEqual(updated.result.details,original.result.details);
  assert.equal(applyGrossPolicy(item(0.3)).result.grossPrice,200);
});
test('sem publicado ou cálculo válido exige revisão sem inventar status comercial',()=>{
  const missing=item(null);missing.row.sem_vinculo=true;
  assert.equal(applyGrossPolicy(missing).grossStatus,'Revisar');
  const invalid=item(0.3);invalid.result.status='Revisar';
  assert.equal(applyGrossPolicy(invalid).grossStatus,'Revisar');
});

test('modo calculado usa desconto da regra em todos os marketplaces preservando líquido e margem',()=>{
  for(const marketplace of ['TikTok','Mercado Livre','Shopee']) {
    const original=item(0.3);original.rule.marketplace=marketplace;
    const result=applyGrossPolicy(original,'calculated').result;
    assert.equal(result.grossPrice,100/0.7);
    assert.ok(Math.abs(result.discount-0.3)<1e-12);
    assert.equal(result.finalPrice,100);
    assert.deepEqual(result.details,original.result.details);
  }
});
test('edição manual prevalece nos dois modos e recalcula apenas desconto',()=>{
  for(const mode of ['published','calculated']) {
    const result=applyGrossPolicy(item(0.3,250),mode).result;
    assert.equal(result.grossPrice,250);
    assert.equal(result.discount,0.6);
    assert.equal(result.finalPrice,100);
    assert.equal(result.details.margin,0.1);
  }
});
