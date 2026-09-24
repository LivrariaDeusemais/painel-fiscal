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

const ML_PRICE_BANDS = [19, 49, 79, 100, 120, 150, 200, Infinity];
const ML_FREIGHT_MATRIX = [
  [2.82, 3.43, 4.07, 12.95, 14.95, 16.95, 19.05, 21.65],
  [2.98, 3.48, 4.13, 13.85, 16.15, 18.15, 20.45, 23.25],
  [3.02, 3.57, 4.22, 14.45, 16.85, 19.05, 21.35, 24.45],
  [3.08, 3.68, 4.33, 14.75, 17.15, 19.45, 21.75, 25.45],
  [3.13, 3.72, 4.38, 15.05, 17.65, 19.85, 22.25, 25.55],
  [3.17, 4.33, 4.57, 16.45, 19.15, 21.65, 24.35, 27.05],
  [3.22, 4.38, 4.88, 17.85, 20.75, 23.35, 26.35, 29.25],
  [3.28, 4.42, 5.12, 19.75, 22.85, 26.05, 29.25, 32.45]
];

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function weightBandIndex(weight) {
  const value = numberOrZero(weight);
  if (value <= 0.3) return 0;
  if (value <= 0.5) return 1;
  if (value <= 1) return 2;
  if (value <= 1.5) return 3;
  if (value <= 2) return 4;
  if (value <= 3) return 5;
  if (value <= 4) return 6;
  return 7;
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

function totalPercent(rule) {
  return ['commission', 'tax', 'admin', 'ads', 'card', 'freightPercent']
    .reduce((sum, key) => sum + numberOrZero(rule[key]), 0);
}

function calculateCandidate(product, rule, freight) {
  const cost = numberOrZero(product.cost);
  const fixed = numberOrZero(rule.fixedFee) + numberOrZero(rule.fixedFreight) + numberOrZero(freight);
  const percent = totalPercent(rule);
  const marginDenominator = 1 - percent - numberOrZero(rule.minMargin);
  const profitDenominator = 1 - percent;
  if (cost <= 0 || marginDenominator <= 0 || profitDenominator <= 0) return null;

  const minimumForMargin = (cost + fixed) / marginDenominator;
  const minimumForProfit = (cost + fixed + numberOrZero(rule.minProfit)) / profitDenominator;
  const minimum = Math.max(minimumForMargin, minimumForProfit);
  const finalPrice = attractivePriceAtOrAbove(minimum);
  return { finalPrice, minimum, freight: numberOrZero(freight) };
}

function bandContains(index, price) {
  const lower = index === 0 ? 0 : ML_PRICE_BANDS[index - 1];
  const upper = ML_PRICE_BANDS[index];
  return price + 1e-9 >= lower && price < upper;
}

function calculateMercadoLivre(product, rule = MARKETPLACE_RULES[2]) {
  const freightRow = ML_FREIGHT_MATRIX[weightBandIndex(product.weight)];
  const candidates = freightRow.map((freight, index) => {
    const candidate = calculateCandidate(product, rule, freight);
    return candidate && bandContains(index, candidate.finalPrice) ? candidate : null;
  }).filter(Boolean);

  const result = candidates.sort((a, b) => a.finalPrice - b.finalPrice)[0]
    || calculateCandidate(product, rule, freightRow[freightRow.length - 1]);
  if (!result) return { status: 'Revisar', reason: 'Custo ou taxas inválidas.' };

  const percent = totalPercent(rule);
  const netProfit = result.finalPrice * (1 - percent)
    - numberOrZero(product.cost)
    - numberOrZero(rule.fixedFee)
    - numberOrZero(rule.fixedFreight)
    - result.freight;
  const margin = result.finalPrice > 0 ? netProfit / result.finalPrice : 0;
  const discount = numberOrZero(rule.discount);
  const grossPrice = discount > 0 ? result.finalPrice / (1 - discount) : result.finalPrice;

  return {
    status: netProfit + 1e-9 >= numberOrZero(rule.minProfit) && margin + 1e-9 >= numberOrZero(rule.minMargin) ? 'OK' : 'Revisar',
    finalPrice: result.finalPrice,
    grossPrice,
    discount,
    freight: result.freight,
    netProfit,
    margin,
    weightBand: weightBandLabel(product.weight)
  };
}

function standardizeEqualProducts(items) {
  const maximumByGroup = new Map();
  for (const item of items) {
    if (!item.result || item.result.status !== 'OK') continue;
    const key = `${numberOrZero(item.product.cost).toFixed(2)}|${item.result.weightBand}`;
    maximumByGroup.set(key, Math.max(maximumByGroup.get(key) || 0, item.result.finalPrice));
  }

  return items.map(item => {
    if (!item.result || item.result.status !== 'OK') return item;
    const key = `${numberOrZero(item.product.cost).toFixed(2)}|${item.result.weightBand}`;
    const finalPrice = maximumByGroup.get(key) || item.result.finalPrice;
    if (finalPrice === item.result.finalPrice) return item;
    const rule = item.rule || MARKETPLACE_RULES[2];
    const freight = ML_FREIGHT_MATRIX[weightBandIndex(item.product.weight)]
      [ML_PRICE_BANDS.findIndex(upper => finalPrice < upper)];
    const percent = totalPercent(rule);
    const netProfit = finalPrice * (1 - percent) - numberOrZero(item.product.cost)
      - numberOrZero(rule.fixedFee) - numberOrZero(rule.fixedFreight) - freight;
    return {
      ...item,
      result: {
        ...item.result,
        finalPrice,
        grossPrice: finalPrice / (1 - numberOrZero(rule.discount)),
        freight,
        netProfit,
        margin: netProfit / finalPrice
      }
    };
  });
}

module.exports = {
  MARKETPLACE_RULES,
  ML_FREIGHT_MATRIX,
  attractivePriceAtOrAbove,
  calculateMercadoLivre,
  standardizeEqualProducts,
  weightBandIndex,
  weightBandLabel
};
