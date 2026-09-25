const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MARKETPLACE_RULES,
  attractivePriceAtOrAbove,
  calculateAtPrice,
  calculateMarketplace,
  calculateMercadoLivre,
  standardizeEqualProducts
} = require('../src/tabela-precos/pricing');
const { costWeightGroup, mercadoLivreCsv, publishedPrices, weightRange } = require('../src/tabela-precos/service');

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
