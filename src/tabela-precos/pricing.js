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

function tierContext(rule, rows) {
  if(rule.marketplace!=='TikTok')return {rule,rows};
  const tiers=rule.tiktokTiers || {lowCommission:.1,lowFixed:4,highCommission:.06,highFixed:6};
  return {rule:{...rule,commission:0,fixedFee:0},rows:[...rows.filter(r=>r.marketplace!=='TikTok'),
    {marketplace:'TikTok',priceMin:0,priceMax:49.99,commission:tiers.lowCommission,fixedFee:tiers.lowFixed},
    {marketplace:'TikTok',priceMin:50,priceMax:null,commission:tiers.highCommission,fixedFee:tiers.highFixed}]};
}

function calculateAtPrice(product, rule, price, dynamicRules = DEFAULT_DYNAMIC_RULES, freightPrice = price) {
  ({rule,rows:dynamicRules}=tierContext(rule,dynamicRules));
  // TikTok SFP is charged on this sale, even when a promotion has a reference price.
  if (rule.marketplace === 'TikTok') freightPrice = price;
  const dynamic = dynamicForPrice(rule.marketplace, price, numberOrZero(product.weight), dynamicRules);
  const freightDynamic = dynamicForPrice(rule.marketplace, freightPrice, numberOrZero(product.weight), dynamicRules);
  const commissionRate = numberOrZero(rule.commission) + dynamic.commission;
  const cardRate = numberOrZero(rule.card);
  const adsRate = numberOrZero(rule.ads) + dynamic.ads;
  const adminRate = numberOrZero(rule.admin);
  const taxRate = numberOrZero(rule.tax);
  const freightRate = numberOrZero(rule.freightPercent) + freightDynamic.freightPercent;
  const percent = commissionRate + cardRate + adsRate + adminRate + taxRate + freightRate;
  const fixedFee = numberOrZero(rule.fixedFee) + dynamic.fixedFee;
  const cents=value=>rule.marketplace==='TikTok'?Math.round((value+Number.EPSILON)*100)/100:value;
  const freight = cents(numberOrZero(rule.fixedFreight) + freightDynamic.freight + (numberOrZero(freightPrice) * freightRate));
  const commissionValue = cents(price * commissionRate);
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

function calculatePriceSimulation(product, rule, price, marketplaceCredit = 0, dynamicRules = DEFAULT_DYNAMIC_RULES, freightPrice = price) {
  const salePrice = numberOrZero(price);
  const credit = numberOrZero(marketplaceCredit);
  const details = calculateAtPrice(product, rule, salePrice, dynamicRules, freightPrice);
  const netProfit = details.netProfit + credit;
  return {
    ...details,
    marketplaceCredit: credit,
    marketplaceReceivable: details.marketplaceReceivable + credit,
    totalCosts: details.totalCosts - credit,
    netProfit,
    margin: salePrice > 0 ? netProfit / salePrice : 0
  };
}

function priceSimulationStatus(margin) {
  const value = numberOrZero(margin);
  if (value < 0.08) return 'Não aceitável';
  if (value <= 0.1) return 'Aceitar temporariamente';
  return 'Preço aprovado';
}

function calculateMarketplace(product, rule, dynamicRules = DEFAULT_DYNAMIC_RULES) {
  ({rule,rows:dynamicRules}=tierContext(rule,dynamicRules));
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
    const finalPrice = attractivePriceAtOrAbove(Math.max(minimum, numberOrZero(row.priceMin)));
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

// Gross changes preserve the target liquid price and its margin calculation.
function applyGrossPolicy(item, mode = 'published') {
  const applied = item.published?.discount;
  const available = !item.row.sem_vinculo && Number(item.published?.grossPrice) > 0 && applied != null && Number.isFinite(Number(applied));
  const grossStatus = !available ? 'Revisar' : Number(applied) <= 0.06 + 1e-12 ? 'Aumentar valor' : Number(applied) <= 0.5 + 1e-12 ? 'Manter valor' : 'Reduzir valor';
  if (item.result?.status !== 'OK') return {...item, grossStatus:'Revisar'};
  const liquid = item.result.finalPrice;
  const configured = Number(item.rule.discount);
  const automatic = mode !== 'calculated' && grossStatus === 'Manter valor' ? Number(item.published.grossPrice) : configured >= 0 && configured < 1 ? liquid / (1 - configured) : null;
  const manual = Number(item.row.novo_bruto_manual);
  const grossPrice = manual > 0 && Number.isFinite(manual) ? manual : automatic;
  return {...item, grossStatus, result:{...item.result, grossPrice, grossManual:manual > 0, discount:grossPrice > 0 ? 1 - liquid / grossPrice : null}};
}

module.exports = {
  applyGrossPolicy,
  DEFAULT_DYNAMIC_RULES,
  MARKETPLACE_RULES,
  attractivePriceAtOrAbove,
  calculateAtPrice,
  calculatePriceSimulation,
  calculateMarketplace,
  calculateMercadoLivre,
  priceSimulationStatus,
  standardizeEqualProducts,
  weightBandLabel
};
