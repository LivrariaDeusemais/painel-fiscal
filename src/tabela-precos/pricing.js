const MARKETPLACE_RULES = [
  { marketplace: 'Bling', commission: 0, tax: 0.05, admin: 0.03, ads: 0, card: 0.0676, freightPercent: 0, fixedFee: 0, fixedFreight: 0, discount: 0, minMargin: 0.1, minProfit: 4 },
  { marketplace: 'Tray', commission: 0, tax: 0.05, admin: 0.03, ads: 0.15, card: 0.0676, freightPercent: 0, fixedFee: 0, fixedFreight: 0, discount: 0.3, minMargin: 0.1, minProfit: 4 },
  { marketplace: 'Mercado Livre', commission: 0.12, tax: 0.05, admin: 0.03, ads: 0.1, card: 0, freightPercent: 0, fixedFee: 0, fixedFreight: 0, discount: 0.3, minMargin: 0.1, minProfit: 4 },
  { marketplace: 'Shopee', commission: 0, tax: 0.05, admin: 0.03, ads: 0, card: 0, freightPercent: 0, fixedFee: 0, fixedFreight: 0, discount: 0.3, minMargin: 0.1, minProfit: 4 },
  { marketplace: 'TikTok', commission: 0.06, tax: 0.05, admin: 0.03, ads: 0.13, card: 0, freightPercent: 0.06, fixedFee: 6, fixedFreight: 0, discount: 0.3, minMargin: 0.1, minProfit: 4 },
  { marketplace: 'Amazon', commission: 0.15, tax: 0.05, admin: 0.03, ads: 0, card: 0, freightPercent: 0, fixedFee: 0, fixedFreight: 0, discount: 0, minMargin: 0.1, minProfit: 4 },
  { marketplace: 'AliExpress', commission: 0.16, tax: 0.05, admin: 0.03, ads: 0, card: 0, freightPercent: 0, fixedFee: 0, fixedFreight: 0, discount: 0.2232119350592366, minMargin: 0.1, minProfit: 4 },
  { marketplace: 'Magalu', commission: 0.18, tax: 0.05, admin: 0.03, ads: 0, card: 0, freightPercent: 0, fixedFee: 5, fixedFreight: 0, discount: 0.3, minMargin: 0.1, minProfit: 4 }
];

const DEFAULT_DYNAMIC_RULES = [
  { marketplace: 'Tray', type: 'frete_preco', priceMin: 0, priceMax: 64.99, value: 1, label: 'Até R$ 64,99' },
  { marketplace: 'Tray', type: 'frete_preco', priceMin: 65, priceMax: null, value: 12, label: 'A partir de R$ 65,00' },
  ...[
    [0, 0.3, [2.82, 3.43, 4.07, 12.95, 14.95, 16.95, 19.05, 21.65], 'Até 0,3 kg'],
    [0.300001, 0.5, [2.98, 3.48, 4.13, 13.85, 16.15, 18.15, 20.45, 23.25], 'De 0,3 a 0,5 kg'],
    [0.500001, 1, [3.02, 3.57, 4.22, 14.45, 16.85, 19.05, 21.35, 24.45], 'De 0,5 a 1 kg'],
    [1.000001, 1.5, [3.08, 3.68, 4.33, 14.75, 17.15, 19.45, 21.75, 25.45], 'De 1 a 1,5 kg'],
    [1.500001, 2, [3.13, 3.72, 4.38, 15.05, 17.65, 19.85, 22.25, 25.55], 'De 1,5 a 2 kg'],
    [2.000001, 3, [3.17, 4.33, 4.57, 16.45, 19.15, 21.65, 24.35, 27.05], 'De 2 a 3 kg'],
    [3.000001, 4, [3.22, 4.38, 4.88, 17.85, 20.75, 23.35, 26.35, 29.25], 'De 3 a 4 kg'],
    [4.000001, null, [3.28, 4.42, 5.12, 19.75, 22.85, 26.05, 29.25, 32.45], 'Acima de 4 kg']
  ].flatMap(([weightMin, weightMax, values, label]) => values.map((value, index) => ({
    marketplace: 'Mercado Livre', type: 'frete_peso_preco', weightMin, weightMax,
    priceMin: [0, 19, 49, 79, 100, 120, 150, 200][index],
    priceMax: [18.99, 48.99, 78.99, 99.99, 119.99, 149.99, 199.99, null][index],
    value, label
  }))),
  ...[
    [0, 79.99, 0.2, 4], [80, 99.99, 0.14, 16], [100, 199.99, 0.14, 20],
    [200, 499.99, 0.14, 26], [500, null, 0.14, 26]
  ].map(([priceMin, priceMax, commission, fixedFee]) => ({
    marketplace: 'Shopee', type: 'tarifa_preco', priceMin, priceMax, commission,
    fixedFee, ads: 0.1, freightPercent: 0.0035, value: 0.49,
    label: priceMax == null ? `A partir de R$ ${priceMin}` : `R$ ${priceMin} a R$ ${priceMax}`
  })),
  ...[
    [0, 29.99, 4.5], [30, 49.99, 6.5], [50, 78.99, 6.75]
  ].map(([priceMin, priceMax, value]) => ({ marketplace: 'Amazon', type: 'frete_preco', priceMin, priceMax, value, label: `R$ ${priceMin} a R$ ${priceMax}` })),
  ...[
    [0, 0.25, [11.95, 13.95, 15.95, 17.95, 20.45], 'Até 0,25 kg'],
    [0.250001, 0.5, [12.85, 15, 17.15, 19.3, 20.95], 'De 0,25 a 0,5 kg'],
    [0.500001, 1, [13.45, 15.7, 17.95, 20.2, 21.95], 'De 0,5 a 1 kg'],
    [1.000001, 2, [14, 16.35, 18.75, 21.1, 23.45], 'De 1 a 2 kg'],
    [2.000001, 3, [14.95, 17.45, 19.95, 22.4, 24.45], 'De 2 a 3 kg'],
    [3.000001, 4, [16.15, 18.85, 21.55, 24.2, 24.2], 'De 3 a 4 kg'],
    [4.000001, null, [17, 19.9, 22.75, 25.6, 25.6], 'Acima de 4 kg']
  ].flatMap(([weightMin, weightMax, values, label]) => values.map((value, index) => ({
    marketplace: 'Amazon', type: 'frete_peso_preco', weightMin, weightMax,
    priceMin: [79, 100, 120, 150, 200][index],
    priceMax: [99.99, 119.99, 149.99, 199.99, null][index], value, label
  }))),
  ...[
    [0, 0.3, 9.9, 'Até 0,3 kg'], [0.300001, 0.5, 9.95, 'De 0,3 a 0,5 kg'],
    [0.500001, 1, 14.5, 'De 0,5 a 1 kg'], [1.000001, 2, 14.8, 'De 1 a 2 kg'],
    [2.000001, 5, 18.39, 'De 2 a 5 kg']
  ].map(([weightMin, weightMax, value, label]) => ({ marketplace: 'AliExpress', type: 'frete_peso', weightMin, weightMax, value, label }))
];

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function weightBandLabel(weight) {
  const value = numberOrZero(weight);
  if (value <= 0.3) return 'ate 300g';
  if (value <= 0.5) return '300g-500g';
  if (value <= 1) return '500g-1kg';
  if (value <= 2) return '1kg-2kg';
  if (value <= 3) return '2kg-3kg';
  if (value <= 5) return '3kg-5kg';
  return 'acima de 5kg';
}

function attractivePriceAtOrAbove(minimum) {
  const target = Math.max(9.9, numberOrZero(minimum));
  const decade = Math.floor(target / 10) * 10;
  const endings = [2.9, 4.9, 7.9, 9.9, 12.9];
  for (const ending of endings) {
    const candidate = decade + ending;
    if (candidate >= target) return Math.round(candidate * 100) / 100;
  }
  return Math.round((decade + 12.9) * 100) / 100;
}

function within(value, minimum, maximum) {
  return value >= numberOrZero(minimum) - 1e-9
    && (maximum == null || value <= Number(maximum) + 1e-9);
}

function dynamicForPrice(marketplace, price, weight, rows) {
  const matching = rows.find(row => row.marketplace === marketplace
    && within(price, row.priceMin, row.priceMax)
    && within(weight, row.weightMin, row.weightMax));
  if (!matching) return { freight: 0, commission: 0, ads: 0, freightPercent: 0, fixedFee: 0 };
  return {
    freight: numberOrZero(matching.value),
    commission: numberOrZero(matching.commission),
    ads: numberOrZero(matching.ads),
    freightPercent: numberOrZero(matching.freightPercent),
    fixedFee: numberOrZero(matching.fixedFee)
  };
}

function calculateAtPrice(product, rule, price, dynamicRules = DEFAULT_DYNAMIC_RULES) {
  const dynamic = dynamicForPrice(rule.marketplace, price, numberOrZero(product.weight), dynamicRules);
  const commissionRate = numberOrZero(rule.commission) + dynamic.commission;
  const cardRate = numberOrZero(rule.card);
  const adsRate = numberOrZero(rule.ads) + dynamic.ads;
  const adminRate = numberOrZero(rule.admin);
  const taxRate = numberOrZero(rule.tax);
  const freightRate = numberOrZero(rule.freightPercent) + dynamic.freightPercent;
  const percent = commissionRate + cardRate + adsRate + adminRate + taxRate + freightRate;
  const fixedFee = numberOrZero(rule.fixedFee) + dynamic.fixedFee;
  const freight = numberOrZero(rule.fixedFreight) + dynamic.freight + (price * freightRate);
  const commissionValue = price * commissionRate;
  const cardValue = price * cardRate;
  const adsValue = price * adsRate;
  const adminValue = price * adminRate;
  const taxValue = price * taxRate;
  const costValue = numberOrZero(product.cost);
  const marketplaceReceivable = price - freight - fixedFee - commissionValue - cardValue;
  const totalCosts = freight + fixedFee + commissionValue + cardValue + adsValue
    + costValue + adminValue + taxValue;
  const netProfit = price - totalCosts;
  return {
    percent,
    fixedFee,
    freight,
    commissionValue,
    cardValue,
    marketplaceReceivable,
    adsValue,
    costValue,
    adminValue,
    taxValue,
    totalCosts,
    netProfit,
    margin: price > 0 ? netProfit / price : 0
  };
}

function calculateMarketplace(product, rule, dynamicRules = DEFAULT_DYNAMIC_RULES) {
  if (numberOrZero(product.cost) <= 0 || numberOrZero(product.weight) <= 0) {
    return { status: 'Revisar', reason: 'Produto sem custo ou peso.' };
  }
  const marketplaceDynamic = dynamicRules.filter(row => row.marketplace === rule.marketplace);
  const dynamicCandidates = marketplaceDynamic.filter(row => within(
    numberOrZero(product.weight), row.weightMin, row.weightMax
  ));
  if (marketplaceDynamic.length && !dynamicCandidates.length) {
    return { status: 'Revisar', reason: 'Produto fora das faixas de frete cadastradas.' };
  }
  const rows = marketplaceDynamic.length ? dynamicCandidates : [{}];
  const candidates = rows.map(row => {
    const percent = ['commission', 'tax', 'admin', 'ads', 'card', 'freightPercent']
      .reduce((sum, key) => sum + numberOrZero(rule[key]), 0)
      + numberOrZero(row.commission) + numberOrZero(row.ads) + numberOrZero(row.freightPercent);
    const fixedFee = numberOrZero(rule.fixedFee) + numberOrZero(row.fixedFee);
    const freight = numberOrZero(rule.fixedFreight) + numberOrZero(row.value);
    const marginDenominator = 1 - percent - numberOrZero(rule.minMargin);
    const profitDenominator = 1 - percent;
    if (marginDenominator <= 0 || profitDenominator <= 0) return null;
    const minimum = Math.max(
      (numberOrZero(product.cost) + fixedFee + freight) / marginDenominator,
      (numberOrZero(product.cost) + fixedFee + freight + numberOrZero(rule.minProfit)) / profitDenominator
    );
    const finalPrice = attractivePriceAtOrAbove(minimum);
    if (!within(finalPrice, row.priceMin, row.priceMax)) return null;
    return { finalPrice, details: calculateAtPrice(product, rule, finalPrice, dynamicRules) };
  }).filter(Boolean).sort((a, b) => a.finalPrice - b.finalPrice);
  if (!candidates.length) return { status: 'Revisar', reason: 'Não foi possível calcular com as regras atuais.' };
  const { finalPrice, details } = candidates[0];
  const discount = numberOrZero(rule.discount);
  return {
    status: 'OK', finalPrice,
    grossPrice: discount > 0 ? finalPrice / (1 - discount) : finalPrice,
    discount, freight: details.freight, fixedFee: details.fixedFee,
    netProfit: details.netProfit, margin: details.margin, details,
    weightBand: weightBandLabel(product.weight)
  };
}

function calculateMercadoLivre(product, rule = MARKETPLACE_RULES[2], dynamicRules = DEFAULT_DYNAMIC_RULES) {
  return calculateMarketplace(product, rule, dynamicRules);
}

function standardizeEqualProducts(items, dynamicRules = DEFAULT_DYNAMIC_RULES) {
  const maximumByGroup = new Map();
  for (const item of items) {
    if (!item.result || item.result.status !== 'OK') continue;
    const key = `${item.rule.marketplace}|${numberOrZero(item.product.cost).toFixed(2)}|${item.result.weightBand}`;
    maximumByGroup.set(key, Math.max(maximumByGroup.get(key) || 0, item.result.finalPrice));
  }
  return items.map(item => {
    if (!item.result || item.result.status !== 'OK') return item;
    const key = `${item.rule.marketplace}|${numberOrZero(item.product.cost).toFixed(2)}|${item.result.weightBand}`;
    const finalPrice = maximumByGroup.get(key) || item.result.finalPrice;
    if (finalPrice === item.result.finalPrice) return item;
    const details = calculateAtPrice(item.product, item.rule, finalPrice, dynamicRules);
    const discount = numberOrZero(item.rule.discount);
    return {
      ...item,
      result: {
        ...item.result, finalPrice,
        grossPrice: discount > 0 ? finalPrice / (1 - discount) : finalPrice,
        freight: details.freight, fixedFee: details.fixedFee,
        netProfit: details.netProfit, margin: details.margin, details
      }
    };
  });
}

module.exports = {
  DEFAULT_DYNAMIC_RULES,
  MARKETPLACE_RULES,
  attractivePriceAtOrAbove,
  calculateAtPrice,
  calculateMarketplace,
  calculateMercadoLivre,
  standardizeEqualProducts,
  weightBandLabel
};
