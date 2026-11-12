// src/services/resourcePlanning.js
//
// Resource Planning calculation engine — pure functions, no Firebase.
// Mirrors the logic from the Resource Planning Blueprint.

export const SKU_IDS = ['22', '40', '45', '85', '125', '170', '850'];

export interface GramSpec {
  piecesPerCarton: number;
  packerBreakdown: string;
  bagCount: number;
  freebieCount: number;
  minDensity: number;
  maxDensity: number;
}

export interface PackingPlan {
  '22': number;
  '40': number;
  '45': number;
  '85': number;
  '125': number;
  '170': number;
  '850': number;
}

export interface SkuPricing {
  sellingPricePerCarton: number;
  cartonCost: number;
}

export interface Recipe {
  name: string;
  version: number;
  yieldPercent: number;
  batchInputKg: number;
  batchOutputKg: number;
  ingredients: Array<{
    id: string;
    name: string;
    kgPerBatch: number;
    unitOfMeasure: string;
    pricePerKg: number;
  }>;
}

export interface PlanInput {
  recipe: Recipe;
  inputMode: 'rawMaterialBudget' | 'targetPowderKg';
  inputValue: number;
  packingPlan: PackingPlan;
  gramSpecs: Record<string, GramSpec>;
  skuPricing: Record<string, SkuPricing>;
  powderDensity: number;
  conversionCostPerKg: number;
}

export interface SkuResult {
  percentage: number;
  powderKg: number;
  sachets: number;
  cartons: number;
  piecesPerCarton: number;
  packerBreakdown: string;
  densityValid: boolean;
  skuGrams: number;
}

export interface PlanOutput {
  powderKg: number;
  totalRawCost: number;
  skus: Record<string, SkuResult>;
  totalSachets: number;
  totalCartons: number;
  financials: {
    totalRevenue: number;
    totalRawCost: number;
    totalPackagingCost: number;
    conversionCost: number;
    totalCost: number;
    profit: number;
    marginPercent: number;
    profitPerNairaRaw: number;
    revenuePerNairaRaw: number;
    cartonsPerNairaRaw: number;
    skuFinancials: Record<string, {
      cartons: number;
      revenue: number;
      packagingCost: number;
      profit: number;
      marginPercent: number;
    }>;
  };
}

// ─── PURE CALCULATION FUNCTIONS ────────────────────────────────────

export function calculateRawMaterialCost(recipe: Recipe): number {
  return recipe.ingredients.reduce((sum, ing) => sum + ing.kgPerBatch * ing.pricePerKg, 0);
}

export function calculatePowderKg(recipe: Recipe, inputMode: 'rawMaterialBudget' | 'targetPowderKg', inputValue: number): number {
  if (inputMode === 'targetPowderKg') return inputValue;

  const totalRawCost = calculateRawMaterialCost(recipe);
  const totalInputKg = recipe.ingredients.reduce((sum, ing) => sum + ing.kgPerBatch, 0);
  const batches = inputValue / totalRawCost;
  return batches * recipe.batchOutputKg;
}

export function calculateSachetsAndCartons(
  powderKg: number,
  packingPlan: PackingPlan,
  gramSpecs: Record<string, GramSpec>,
  powderDensity: number
): { skus: Record<string, SkuResult>; totalSachets: number; totalCartons: number } {
  const results: Record<string, SkuResult> = {};
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

export function calculateFinancials(
  skuResults: Record<string, SkuResult>,
  skuPricing: Record<string, SkuPricing>,
  totalRawCost: number,
  powderKg: number,
  conversionCostPerKg: number
) {
  let totalRevenue = 0;
  let totalPackagingCost = 0;
  const skuFinancials: Record<string, any> = {};

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

export function runResourcePlan(input: PlanInput): PlanOutput {
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

export function validatePackingPlan(packingPlan: PackingPlan): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
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

export function validateDensityForSkus(powderDensity: number, gramSpecs: Record<string, GramSpec>, packingPlan: PackingPlan): Record<string, { valid: boolean; warning: string }> {
  const results: Record<string, { valid: boolean; warning: string }> = {};

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