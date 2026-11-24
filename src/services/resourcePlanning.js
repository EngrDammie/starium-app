// src/services/resourcePlanning.js
//
// Resource Planning calculation engine — pure functions, no Firebase.
// Mirrors the logic from the Resource Planning Blueprint.

export const SKU_IDS = ['22', '40', '45', '85', '125', '170', '850'];

/**
 * @typedef {Object} GramSpec
 * @property {number} piecesPerCarton
 * @property {string} packerBreakdown
 * @property {number} bagCount
 * @property {number} freebieCount
 * @property {number} minDensity
 * @property {number} maxDensity
 */

/**
 * @typedef {Object} PackingPlan
 * @property {number} '22'
 * @property {number} '40'
 * @property {number} '45'
 * @property {number} '85'
 * @property {number} '125'
 * @property {number} '170'
 * @property {number} '850'
 */

/**
 * @typedef {Object} SkuPricing
 * @property {number} sellingPricePerCarton
 * @property {number} cartonCost
 */

/**
 * @typedef {Object} Recipe
 * @property {string} name
 * @property {number} version
 * @property {number} yieldPercent
 * @property {number} batchInputKg
 * @property {number} batchOutputKg
 * @property {Array<{id: string, name: string, kgPerBatch: number, unitOfMeasure: string, pricePerKg: number}>} ingredients
 */

/**
 * @typedef {Object} PlanInput
 * @property {Recipe} recipe
 * @property {'rawMaterialBudget'|'targetPowderKg'} inputMode
 * @property {number} inputValue
 * @property {PackingPlan} packingPlan
 * @property {Record<string, GramSpec>} gramSpecs
 * @property {Record<string, SkuPricing>} skuPricing
 * @property {number} powderDensity
 * @property {number} conversionCostPerKg
 */

/**
 * @typedef {Object} SkuResult
 * @property {number} percentage
 * @property {number} powderKg
 * @property {number} sachets
 * @property {number} cartons
 * @property {number} piecesPerCarton
 * @property {string} packerBreakdown
 * @property {boolean} densityValid
 * @property {number} skuGrams
 */

/**
 * @typedef {Object} PlanOutput
 * @property {number} powderKg
 * @property {number} totalRawCost
 * @property {Record<string, SkuResult>} skus
 * @property {number} totalSachets
 * @property {number} totalCartons
 * @property {Object} financials
 * @property {number} financials.totalRevenue
 * @property {number} financials.totalRawCost
 * @property {number} financials.totalPackagingCost
 * @property {number} financials.conversionCost
 * @property {number} financials.totalCost
 * @property {number} financials.profit
 * @property {number} financials.marginPercent
 * @property {number} financials.profitPerNairaRaw
 * @property {number} financials.revenuePerNairaRaw
 * @property {number} financials.cartonsPerNairaRaw
 * @property {Record<string, {cartons: number, revenue: number, packagingCost: number, profit: number, marginPercent: number}>} financials.skuFinancials
 */

// ─── PURE CALCULATION FUNCTIONS ────────────────────────────────────

/**
 * @param {Recipe} recipe
 * @returns {number}
 */
export function calculateRawMaterialCost(recipe) {
  return recipe.ingredients.reduce((sum, ing) => sum + ing.kgPerBatch * ing.pricePerKg, 0);
}

/**
 * @param {Recipe} recipe
 * @param {'rawMaterialBudget'|'targetPowderKg'} inputMode
 * @param {number} inputValue
 * @returns {number}
 */
export function calculatePowderKg(recipe, inputMode, inputValue) {
  if (inputMode === 'targetPowderKg') return inputValue;

  const totalRawCost = calculateRawMaterialCost(recipe);
  const totalInputKg = recipe.ingredients.reduce((sum, ing) => sum + ing.kgPerBatch, 0);
  const batches = inputValue / totalRawCost;
  return batches * recipe.batchOutputKg;
}

/**
 * @param {number} powderKg
 * @param {PackingPlan} packingPlan
 * @param {Record<string, GramSpec>} gramSpecs
 * @param {number} powderDensity
 * @returns {{skus: Record<string, SkuResult>, totalSachets: number, totalCartons: number}}
 */
export function calculateSachetsAndCartons(powderKg, packingPlan, gramSpecs, powderDensity) {
  const results = {};
  let totalSachets = 0;
  let totalCartons = 0;

  for (const sku of SKU_IDS) {
    const pct = packingPlan[sku] || 0;
    if (pct === 0) {
      results[sku] = { percentage: 0, powderKg: 0, sachets: 0, cartons: 0, piecesPerCarton: 0, packerBreakdown: '', densityValid: false, skuGrams: Number(sku) };
      continue;
    }

    const spec = gramSpecs[sku];
    const skuGrams = Number(sku);

    // Density validation
    const densityValid = powderDensity >= spec.minDensity && powderDensity <= spec.maxDensity;

    const powderForSku = powderKg * (pct / 100);
    const sachets = Math.floor((powderForSku * 1000) / skuGrams);
    const cartons = sachets / spec.piecesPerCarton;

    results[sku] = {
      percentage: pct,
      powderKg: powderForSku,
      sachets,
      cartons,
      piecesPerCarton: spec.piecesPerCarton,
      packerBreakdown: spec.packerBreakdown,
      densityValid,
      skuGrams
    };

    totalSachets += sachets;
    totalCartons += cartons;
  }

  return { skus: results, totalSachets, totalCartons };
}

/**
 * @param {Record<string, SkuResult>} skuResults
 * @param {Record<string, SkuPricing>} skuPricing
 * @param {number} totalRawCost
 * @param {number} powderKg
 * @param {number} conversionCostPerKg
 * @returns {Object}
 */
export function calculateFinancials(skuResults, skuPricing, totalRawCost, powderKg, conversionCostPerKg) {
  let totalRevenue = 0;
  let totalPackagingCost = 0;
  const skuFinancials = {};

  for (const [sku, data] of Object.entries(skuResults)) {
    const pricing = skuPricing[sku];
    const cartons = data.cartons;
    const revenue = cartons * pricing.sellingPricePerCarton;
    const packagingCost = cartons * pricing.cartonCost;

    skuFinancials[sku] = {
      cartons,
      revenue,
      packagingCost,
      profit: revenue - packagingCost,
      marginPercent: cartons > 0 ? ((revenue - packagingCost) / revenue) * 100 : 0
    };

    totalRevenue += revenue;
    totalPackagingCost += packagingCost;
  }

  const conversionCost = powderKg * conversionCostPerKg;
  const totalCost = totalRawCost + totalPackagingCost + conversionCost;
  const profit = totalRevenue - totalCost;
  const marginPercent = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  const profitPerNairaRaw = totalRawCost > 0 ? profit / totalRawCost : 0;
  const revenuePerNairaRaw = totalRawCost > 0 ? totalRevenue / totalRawCost : 0;
  const cartonsPerNairaRaw = totalRawCost > 0 ? Object.values(skuResults).reduce((sum, d) => sum + d.cartons, 0) / totalRawCost : 0;

  return {
    totalRevenue,
    totalRawCost,
    totalPackagingCost,
    conversionCost,
    totalCost,
    profit,
    marginPercent,
    profitPerNairaRaw,
    revenuePerNairaRaw,
    cartonsPerNairaRaw,
    skuFinancials
  };
}

/**
 * @param {PlanInput} input
 * @returns {PlanOutput}
 */
export function runResourcePlan(input) {
  const totalRawCost = calculateRawMaterialCost(input.recipe);
  const powderKg = calculatePowderKg(input.recipe, input.inputMode, input.inputValue);
  const sachetsAndCartons = calculateSachetsAndCartons(powderKg, input.packingPlan, input.gramSpecs, input.powderDensity);
  const financials = calculateFinancials(sachetsAndCartons.skus, input.skuPricing, totalRawCost, powderKg, input.conversionCostPerKg);

  return {
    powderKg,
    totalRawCost,
    skus: sachetsAndCartons.skus,
    totalSachets: sachetsAndCartons.totalSachets,
    totalCartons: sachetsAndCartons.totalCartons,
    financials
  };
}

// ─── VALIDATION ────────────────────────────────────────────────────

/**
 * @param {PackingPlan} packingPlan
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validatePackingPlan(packingPlan) {
  const errors = [];
  const total = SKU_IDS.reduce((sum, sku) => sum + (packingPlan[sku] || 0), 0);

  if (Math.abs(total - 100) > 0.01) {
    errors.push(`Packing plan must sum to 100%, got ${total}%`);
  }

  for (const sku of SKU_IDS) {
    if ((packingPlan[sku] || 0) < 0) {
      errors.push(`${sku}g: percentage cannot be negative`);
    }
    if ((packingPlan[sku] || 0) > 100) {
      errors.push(`${sku}g: percentage cannot exceed 100%`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * @param {number} powderDensity
 * @param {Record<string, GramSpec>} gramSpecs
 * @param {PackingPlan} packingPlan
 * @returns {Record<string, {valid: boolean, warning: string}>}
 */
export function validateDensityForSkus(powderDensity, gramSpecs, packingPlan) {
  const results = {};

  for (const sku of SKU_IDS) {
    const spec = gramSpecs[sku];
    const isActive = (packingPlan[sku] || 0) > 0;

    if (!isActive) {
      results[sku] = { valid: true, warning: '' };
      continue;
    }

    const valid = powderDensity >= spec.minDensity && powderDensity <= spec.maxDensity;
    if (!valid) {
      results[sku] = { valid: false, warning: `Density ${powderDensity} outside range ${spec.minDensity}-${spec.maxDensity}` };
    } else {
      results[sku] = { valid: true, warning: '' };
    }
  }

  return results;
}