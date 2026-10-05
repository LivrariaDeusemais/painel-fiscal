const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MARKETPLACE_RULES,
  attractivePriceAtOrAbove,
  calculateAtPrice,
  calculatePriceSimulation,
  calculateMarketplace,
  calculateMercadoLivre,
  priceSimulationStatus,
  standardizeEqualProducts
} = require('../src/tabela-precos/pricing');
const { costWeightGroup, mercadoLivreCsv, priceReviewStatus, publishedPrices, weightRange } = require('../src/tabela-precos/service');

test('classifica as faixas de peso do modelo da base de produtos', () => {
  assert.equal(weightRange(0.3), 'ate 300g');
  assert.equal(weightRange(0.5), '300g-500g');
  assert.equal(weightRange(1), '500g-1kg');
  assert.equal(weightRange(2), '1kg-2kg');
  assert.equal(weightRange(2.42), '2kg-3kg');
});

test('monta o grupo de custo e peso conforme o modelo enviado', () => {
  assert.equal(costWeightGroup(59.9, 1.16), '060|1kg-2kg');
  assert.equal(costWeightGroup(156.88, 2.42), '157|2kg-3kg');
});

test('arredonda para os mesmos preços comerciais da planilha', () => {
  assert.equal(attractivePriceAtOrAbove(72.208), 72.9);
  assert.equal(attractivePriceAtOrAbove(129.01), 129.9);
  assert.equal(attractivePriceAtOrAbove(200.1), 202.9);
  assert.equal(attractivePriceAtOrAbove(208.506), 209.9);
});

test('reproduz exemplos validados do Mercado Livre', () => {
  const examples = [
    [{ cost: 156.88, weight: 2.42 }, 307.9, 27.05, 439.85714285714283],
    [{ cost: 59.9, weight: 1.16 }, 132.9, 19.45, 189.8571428571429],
    [{ cost: 39.105, weight: 0.92 }, 72.9, 4.22, 104.14285714285715],
    [{ cost: 97.605, weight: 1.15 }, 199.9, 21.75, 285.5714285714286]
  ];
  for (const [product, finalPrice, freight, grossPrice] of examples) {
    const result = calculateMercadoLivre(product);
    assert.equal(result.status, 'OK');
    assert.equal(result.finalPrice, finalPrice);
    assert.equal(result.freight, freight);
    assert.ok(Math.abs(result.grossPrice - grossPrice) < 1e-9);
  }
});

test('reproduz os preços principais dos oito canais da planilha', () => {
  const expected = {
    Bling: 209.9,
    Tray: 282.9,
    'Mercado Livre': 307.9,
    Shopee: 319.9,
    TikTok: 287.9,
    Amazon: 272.9,
    AliExpress: 267.9,
    Magalu: 254.9
  };
  for (const rule of MARKETPLACE_RULES) {
    const result = calculateMarketplace({ cost: 156.88, weight: 2.42 }, rule);
    assert.equal(result.status, 'OK');
    assert.equal(result.finalPrice, expected[rule.marketplace]);
  }
});

test('exige revisão quando o produto fica fora das faixas de frete', () => {
  const rule = MARKETPLACE_RULES.find(item => item.marketplace === 'AliExpress');
  const result = calculateMarketplace({ cost: 50, weight: 5.5 }, rule);
  assert.equal(result.status, 'Revisar');
  assert.match(result.reason, /fora das faixas/);
});

test('detalha todos os custos monetários calculados sobre o preço líquido', () => {
  const rule = MARKETPLACE_RULES.find(item => item.marketplace === 'TikTok');
  const details = calculateAtPrice({ cost: 50, weight: 0.5 }, rule, 100, []);
  assert.equal(details.freight, 6);
  assert.equal(details.fixedFee, 6);
  assert.equal(details.commissionValue, 6);
  assert.equal(details.adsValue, 13);
  assert.equal(details.adminValue, 3);
  assert.equal(details.taxValue, 5);
  assert.equal(details.costValue, 50);
  assert.equal(details.marketplaceReceivable, 82);
  assert.equal(details.totalCosts, 89);
  assert.equal(details.netProfit, 11);
  assert.equal(details.margin, 0.11);
});

test('considera o crédito do marketplace no recebimento, lucro e margem da simulação', () => {
  const rule = MARKETPLACE_RULES.find(item => item.marketplace === 'Mercado Livre');
  const base = calculateAtPrice({ cost: 50, weight: 0.5 }, rule, 100, []);
  const result = calculatePriceSimulation({ cost: 50, weight: 0.5 }, rule, 100, 5, []);
  assert.equal(result.marketplaceCredit, 5);
  assert.equal(result.marketplaceReceivable, base.marketplaceReceivable + 5);
  assert.equal(result.totalCosts, base.totalCosts - 5);
  assert.equal(result.netProfit, base.netProfit + 5);
  assert.equal(result.margin, result.netProfit / 100);
});

test('considera percentual negativo como desconto assumido pelo vendedor', () => {
  const rule = MARKETPLACE_RULES.find(item => item.marketplace === 'Magalu');
  const base = calculateAtPrice({ cost: 50, weight: 0.5 }, rule, 100, []);
  const result = calculatePriceSimulation({ cost: 50, weight: 0.5 }, rule, 100, -5, []);
  assert.equal(result.marketplaceCredit, -5);
  assert.equal(result.marketplaceReceivable, base.marketplaceReceivable - 5);
  assert.equal(result.totalCosts, base.totalCosts + 5);
  assert.equal(result.netProfit, base.netProfit - 5);
  assert.equal(result.margin, result.netProfit / 100);
});

test('calcula o frete promocional sobre o preço original quando informado', () => {
  const rule = MARKETPLACE_RULES.find(item => item.marketplace === 'Mercado Livre');
  const dynamicRules = [
    { marketplace: 'Mercado Livre', priceMin: 0, priceMax: 119.99, weightMin: 0, weightMax: 1, value: 10 },
    { marketplace: 'Mercado Livre', priceMin: 120, priceMax: null, weightMin: 0, weightMax: 1, value: 20 }
  ];
  const result = calculatePriceSimulation({ cost: 50, weight: 0.5 }, rule, 100, 5, dynamicRules, 130);
  assert.equal(result.freight, 20);
  assert.equal(result.marketplaceReceivable, 100 - 20 - 12 + 5);
});

test('classifica a margem da calculadora nas três faixas definidas', () => {
  assert.equal(priceSimulationStatus(0.0799), 'Não aceitável');
  assert.equal(priceSimulationStatus(0.08), 'Aceitar temporariamente');
  assert.equal(priceSimulationStatus(0.1), 'Aceitar temporariamente');
  assert.equal(priceSimulationStatus(0.1001), 'Preço aprovado');
});

test('padroniza produtos com mesmo custo e faixa de peso', () => {
  const rule = MARKETPLACE_RULES.find(item => item.marketplace === 'Mercado Livre');
  const rows = [
    { product: { sku: 'A', cost: 10, weight: 0.2 }, rule, result: calculateMercadoLivre({ cost: 10, weight: 0.2 }, rule) },
    { product: { sku: 'B', cost: 10.004, weight: 0.25 }, rule, result: { ...calculateMercadoLivre({ cost: 10.004, weight: 0.25 }, rule), finalPrice: 29.9 } }
  ];
  const standardized = standardizeEqualProducts(rows);
  assert.equal(standardized[0].result.finalPrice, standardized[1].result.finalPrice);
});

test('exporta o CSV do Bling preservando o vínculo e zerando a promoção', () => {
  const csv = mercadoLivreCsv([{
    row: {
      dados: {
        IdProduto: '123',
        'ID na Loja': 'MLB456',
        Nome: 'Produto teste',
        'Código': 'SKU1',
        Preco: '10,0000',
        'Preco Promocional': '8,0000',
        'ID do Fornecedor': '',
        'ID da Marca': '',
        'Link Externo': 'https://exemplo.test/anuncio',
        'Nome Loja (Multilojas)': 'Mercado Livre'
      }
    },
    result: { status: 'OK', grossPrice: 142.7142857 }
  }]);

  assert.ok(csv.startsWith('\uFEFFIdProduto;ID na Loja;Nome;Código;Preco;Preco Promocional;'));
  assert.match(csv, /123;MLB456;Produto teste;SKU1;142,7143;0;;;/);
});

test('aplica o desconto configurado quando o vínculo não possui preço promocional', () => {
  const result = publishedPrices(
    { preco_atual: 200, preco_promocional: 0 },
    { discount: 0.3 }
  );
  assert.equal(result.grossPrice, 200);
  assert.equal(result.discount, 0.3);
  assert.equal(result.liquidPrice, 140);
});

test('prioriza o preço promocional praticado quando ele existe', () => {
  const result = publishedPrices(
    { preco_atual: 200, preco_promocional: 150 },
    { discount: 0.3 }
  );
  assert.equal(result.discount, 0.25);
  assert.equal(result.liquidPrice, 150);
});

test('classifica o status de conferência pela validação e diferença líquida', () => {
  assert.equal(priceReviewStatus('Novo', 'OK', 20), 'Novo');
  assert.equal(priceReviewStatus('Validado', 'Revisar', null), 'Revisar');
  assert.equal(priceReviewStatus('Validado', 'OK', 0), 'Manter preço');
  assert.equal(priceReviewStatus('Validado', 'OK', 0.004), 'Manter preço');
  assert.equal(priceReviewStatus('Validado', 'OK', 1), 'Analisar');
  assert.equal(priceReviewStatus('Validado', 'OK', -1), 'Analisar');
  assert.equal(priceReviewStatus('Validado', 'OK', 1.01), 'Reajustar');
  assert.equal(priceReviewStatus('Validado', 'OK', -1.01), 'Abaixou');
});

test('precifica produto sem vínculo sem inventar preço publicado e preserva anúncio existente', async () => {
  const { marketplaceRows, marketplaceCsv } = require('../src/tabela-precos/service');
  const rule = {
    marketplace: 'Mercado Livre', comissao: 0.12, imposto: 0.05, adm: 0.03,
    ads: 0, cartao: 0, frete_percentual: 0, taxa_fixa: 6,
    frete_fixo: 0, desconto: 0.3, margem_minima: 0.1, saldo_minimo: 0
  };
  const pool = { query: async sql => {
    if (sql.includes('FROM tabela_preco_regras WHERE')) return { rows: [rule] };
    if (sql.includes('FROM tabela_preco_fretes')) return { rows: [] };
    return { rows: [
      { sku: 'L1368', marketplace: 'Mercado Livre', custo: 5, peso: 0.109, sem_vinculo: true },
      { sku: 'EXISTENTE', marketplace: 'Mercado Livre', custo: 5, peso: 0.109,
        sem_vinculo: false, preco_atual: 30, preco_promocional: 20,
        dados: { 'Código': 'EXISTENTE', 'ID na Loja': 'MLB123' } }
    ] };
  } };
  const items = await marketplaceRows(pool, { marketplace: 'Mercado Livre' });
  const unlinked = items.find(i => i.row.sku === 'L1368');
  assert.equal(unlinked.result.status, 'OK');
  assert.ok(unlinked.result.finalPrice > 0);
  assert.deepEqual(unlinked.published, { grossPrice: null, discount: null, liquidPrice: null, details: null });
  const linked = items.find(i => i.row.sku === 'EXISTENTE');
  assert.equal(linked.published.liquidPrice, 20);
  assert.equal(linked.published.grossPrice, 30);
  const csv = marketplaceCsv(items);
  assert.equal(csv.trim().split('\r\n').length, 2);
  assert.match(csv, /MLB123/);
  assert.doesNotMatch(csv, /L1368/);
});

test('calculadora usa custo e peso do cadastro mesmo sem anúncio', async () => {
  const { calculatorContext } = require('../src/tabela-precos/service');
  const pool = { query: async sql => ({ rows:
    sql.includes('FROM tabela_preco_regras') ? [{ marketplace: 'Mercado Livre', desconto: 0.3 }] :
    sql.includes('FROM tabela_preco_produtos') ? [{ sku: 'L1368', custo: 5, peso: 0.109 }] : []
  }) };
  const context = await calculatorContext(pool, 'Mercado Livre', 'L1368');
  assert.equal(context.product.sku, 'L1368');
  assert.equal(context.product.custo, 5);
  assert.equal(context.product.peso, 0.109);
  assert.equal(context.link, null);
  assert.equal(context.published, null);
  assert.equal(context.rule.marketplace, 'Mercado Livre');
});

test('salva preço líquido manual preservando anúncio, bruto e dados do vínculo', async () => {
  const { saveCalculatorPrice, publishedPrices } = require('../src/tabela-precos/service');
  const calls = [];
  const client = { release() {}, query: async (sql, args) => {
    calls.push({ sql, args });
    if (sql.includes('FROM tabela_preco_produtos')) return { rows: [{ sku: 'B1103', nome: 'Bíblia' }] };
    if (sql.includes('FROM tabela_preco_regras')) return { rows: [{ desconto: 0.3 }] };
    if (sql.includes('FROM tabela_preco_vinculos')) return { rows: [{ id: 7, preco_atual: 439.8571, dados: { 'ID na Loja': 'MLB1', Nome: 'Bíblia' } }] };
    return { rows: [] };
  } };
  await saveCalculatorPrice({ connect: async () => client }, 'Mercado Livre', 'B1103', 299.9);
  const update = calls.find(c => c.sql.startsWith('UPDATE'));
  assert.equal(update.args[1], 7);
  assert.equal(JSON.parse(update.args[0])['ID na Loja'], 'MLB1');
  assert.equal(publishedPrices({ preco_atual: 439.8571, dados: JSON.parse(update.args[0]) }, { discount: 0.3 }).liquidPrice, 299.9);
  assert.doesNotMatch(update.sql, /SET preco_atual/);
  assert.equal(calls.at(-1).sql, 'COMMIT');
});

test('salva preço para produto sem anúncio sem criar identificador de marketplace', async () => {
  const { saveCalculatorPrice } = require('../src/tabela-precos/service');
  const calls = [];
  const client = { release() {}, query: async (sql, args) => {
    calls.push({ sql, args });
    if (sql.includes('FROM tabela_preco_produtos')) return { rows: [{ sku: 'L1368', nome: 'Livro' }] };
    if (sql.includes('FROM tabela_preco_regras')) return { rows: [{ desconto: 0.3 }] };
    return { rows: [] };
  } };
  await saveCalculatorPrice({ connect: async () => client }, 'Mercado Livre', 'L1368', 15.9);
  const insert = calls.find(c => c.sql.startsWith('INSERT'));
  assert.equal(insert.args[4], 15.9);
  assert.equal(JSON.parse(insert.args[5]).preco_manual_sem_vinculo, true);
  assert.equal(JSON.parse(insert.args[5])['ID na Loja'], undefined);
  assert.equal(calls.at(-1).sql, 'COMMIT');
});

test('rejeita preço manual inválido antes de gravar e desfaz tentativa sem cadastro', async () => {
  const { saveCalculatorPrice } = require('../src/tabela-precos/service');
  for (const price of [0, -1, NaN, Infinity]) {
    await assert.rejects(saveCalculatorPrice({}, 'Mercado Livre', 'X', price), /preço válido/);
  }
  const calls = [];
  const client = { release() {}, query: async sql => { calls.push(sql); return { rows: [] }; } };
  await assert.rejects(saveCalculatorPrice({ connect: async () => client }, 'Mercado Livre', 'X', 10), /SKU cadastrado/);
  assert.equal(calls.at(-1), 'ROLLBACK');
});

test('importação de um anúncio atualiza somente seu vínculo e permite novo anúncio do mesmo SKU', () => {
  const { planLinkImport } = require('../src/tabela-precos/service');
  const existing = [
    { id: '1', sku: 'A', id_loja: 'MLB1', id_produto: '10' },
    { id: '2', sku: 'B', id_loja: 'MLB2', id_produto: '20' },
    { id: '3', sku: 'A', id_loja: 'MLB3', id_produto: '10' }
  ];
  const plan = planLinkImport(existing, [{ sku: 'A', store_id: 'MLB1', current_price: 99 }]);
  assert.deepEqual(plan.updates.map(row => row.id), ['1']);
  assert.equal(plan.updates[0].current_price, 99);
  assert.equal(plan.inserts.length, 0);
  const next = planLinkImport(existing, [{ sku: 'A', store_id: 'MLB4', product_id: '10' }]);
  assert.equal(next.updates.length, 0);
  assert.equal(next.inserts.length, 1);
});

test('importação por SKU preserva identificadores ausentes no arquivo e promove registro manual a vínculo', () => {
  const { planLinkImport } = require('../src/tabela-precos/service');
  const plan = planLinkImport([{ id: '1', sku: 'A', id_loja: 'MLB1', id_produto: '10' }], [{ sku: 'A', store_id: '', product_id: '', raw: {} }]);
  assert.equal(plan.updates[0].store_id, 'MLB1');
  assert.equal(plan.updates[0].product_id, '10');
  assert.equal(plan.updates[0].raw['ID na Loja'], 'MLB1');
  const manual = planLinkImport([{ id: '2', sku: 'L1368', id_loja: null }], [{ sku: 'L1368', store_id: 'MLB5', raw: {} }]);
  assert.equal(manual.updates[0].id, '2');
  assert.equal(manual.updates[0].store_id, 'MLB5');
  assert.equal(manual.updates[0].raw.preco_manual_sem_vinculo, undefined);
});

test('importação rejeita SKU ambíguo e linhas repetidas sem alterar vínculos', () => {
  const { planLinkImport } = require('../src/tabela-precos/service');
  const existing = [{ id: '1', sku: 'A', id_loja: 'MLB1' }, { id: '2', sku: 'A', id_loja: 'MLB2' }];
  assert.throws(() => planLinkImport(existing, [{ sku: 'A' }]), /Mais de um vínculo/);
  assert.throws(() => planLinkImport([], [{ sku: 'A', store_id: 'MLB1' }, { sku: 'A', store_id: 'MLB1' }]), /repetido/);
});

test('importa lote misto com atualização e inclusão sem apagar os demais vínculos', async () => {
  const { importLinks } = require('../src/tabela-precos/service');
  const calls = [];
  const client = { release() {}, query: async (sql, args) => {
    calls.push({ sql, args });
    return { rows: sql.startsWith('SELECT id,') ? [{ id: '1', sku: 'A', id_loja: 'MLB1' }, { id: '2', sku: 'B', id_loja: 'MLB2' }] : [] };
  } };
  const result = await importLinks({ connect: async () => client }, 'Mercado Livre', [
    { sku: 'A', store_id: 'MLB1', current_price: 99, raw: {} },
    { sku: 'C', store_id: 'MLB3', current_price: 29, raw: {} }
  ]);
  assert.deepEqual(result, { updated: 1, inserted: 1 });
  assert.equal(calls.some(c => /DELETE/.test(c.sql)), false);
  const update = calls.find(c => c.sql.includes('UPDATE tabela_preco_vinculos'));
  assert.deepEqual(JSON.parse(update.args[1]).map(row => row.id), ['1']);
  assert.equal(calls.at(-1).sql, 'COMMIT');
});


test('preserva líquido manual após nova carga Bling e identifica estimativa sem promoção', () => {
  const result = publishedPrices({ preco_atual: 399.2999878, preco_promocional: null,
    dados: { preco_liquido_manual: 299.9, preco_manual_em: '2026-10-01T12:00:00Z' } }, { discount: 0.3 });
  assert.equal(result.liquidPrice,299.9);
  assert.equal(result.source,'Informado manualmente');
  assert.equal(result.estimated,false);
  const estimate=publishedPrices({preco_atual:399.3},{discount:0.3});
  assert.equal(estimate.estimated,true);
  assert.equal(estimate.source,'Estimado pela regra');
});

test('status mantém preço lucrativo mesmo quando o alvo calculado é maior e inclui benefício na margem',()=>{
  const {marketplaceReviewStatus}=require('../src/tabela-precos/service');
  const i={row:{status_validacao:'Validado'},rule:{minMargin:.1,minProfit:4},result:{status:'OK',finalPrice:282.9},published:{liquidPrice:265.91,details:{margin:.1249,netProfit:33.21},benefit:{status:'identified',amount:15.78}}};
  assert.equal(marketplaceReviewStatus(i),'Manter preço');
  assert.equal(marketplaceReviewStatus({...i,published:{...i.published,details:{margin:.1,netProfit:4}}}),'Manter preço');
  assert.equal(marketplaceReviewStatus({...i,published:{...i.published,details:{margin:.09996,netProfit:20}}}),'Manter preço');
  assert.equal(marketplaceReviewStatus({...i,published:{...i.published,details:{margin:.099,netProfit:20}}}),'Reajustar');
  assert.equal(marketplaceReviewStatus({...i,published:{...i.published,details:{margin:.12,netProfit:3.99}}}),'Reajustar');
  assert.equal(marketplaceReviewStatus({...i,published:{...i.published,benefit:{status:'pending'},details:{margin:.09,netProfit:20}}}),'Revisar');
  assert.equal(marketplaceReviewStatus({...i,row:{sem_vinculo:true}}),'Sem Vínculo');
  assert.equal(marketplaceReviewStatus({...i,row:{status_validacao:'Novo'}}),'Novo');
});
test('TikTok aplica faixa pelo líquido com taxa por unidade e arredonda cobranças como extrato',()=>{
  const rule=MARKETPLACE_RULES.find(r=>r.marketplace==='TikTok'),p={cost:10,weight:.3};
  const low=calculateAtPrice(p,rule,46);assert.equal(low.commissionValue,4.6);assert.equal(low.fixedFee,4);assert.equal(low.freight,2.76);assert.ok(Math.abs(low.marketplaceReceivable-34.64)<1e-8);
  const high=calculateAtPrice(p,rule,322.93);assert.equal(high.commissionValue,19.38);assert.equal(high.fixedFee,6);assert.equal(high.freight,19.38);assert.ok(Math.abs(high.marketplaceReceivable-278.17)<1e-8);
  assert.equal(calculateAtPrice(p,rule,49.99).fixedFee,4);assert.equal(calculateAtPrice(p,rule,50).fixedFee,6);assert.equal(calculateAtPrice(p,rule,50).commissionValue,3);
  for(const cost of [10,20,25,30,100]) {const result=calculateMarketplace({cost,weight:.3},rule);assert.equal(result.status,'OK');const details=calculateAtPrice({cost,weight:.3},rule,result.finalPrice);assert.equal(result.fixedFee,details.fixedFee);assert.ok(result.margin>=rule.minMargin-.0001);}
  const custom=calculateAtPrice(p,{...rule,tiktokTiers:{lowCommission:.09,lowFixed:3,highCommission:.05,highFixed:5}},46);assert.equal(custom.fixedFee,3);assert.equal(custom.commissionValue,4.14);
});
test('salva faixas do TikTok com percentuais normalizados e rejeita tarifas inválidas',async()=>{
  const {updateRule}=require('../src/tabela-precos/service');let args;
  const pool={query:async(sql,p)=>{args=p;return {rows:[]};}};
  await updateRule(pool,'TikTok',{tiktok_low_commission:'10',tiktok_low_fixed:'4',tiktok_high_commission:'6',tiktok_high_fixed:'6',frete_percentual:'6'});
  assert.deepEqual(JSON.parse(args[13]),{lowCommission:.1,lowFixed:4,highCommission:.06,highFixed:6});
  await assert.rejects(updateRule(pool,'TikTok',{tiktok_low_commission:'abc'}),/válidos/);
  await assert.rejects(updateRule(pool,'TikTok',{tiktok_high_commission:'100'}),/100%/);
});
