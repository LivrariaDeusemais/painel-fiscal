const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MARKETPLACE_RULES,
  attractivePriceAtOrAbove,
  calculateMercadoLivre,
  standardizeEqualProducts
} = require('../src/tabela-precos/pricing');
const { mercadoLivreCsv } = require('../src/tabela-precos/service');

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
