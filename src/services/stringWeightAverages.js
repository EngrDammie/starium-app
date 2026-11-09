// src/services/stringWeightAverages.js
//
// Pure calculation engine for running average string weights.
// No Firebase, no React, no side effects. Just math.
// Easy to test, easy to reason about, reusable anywhere.
//
// WHY THIS EXISTS:
// The Plant Manager wants to see, in real-time on the Dashboard,
// the running average weight for each gram/SKU produced in the shift.
// This engine takes raw string weight records and computes:
//   - Total checks
//   - Per-gram average, min, max, count, target
//   - Overall average
// All as plain objects — easy to render in Dashboard card or Report page.

import { toLocalDate } from './leaveCalculations'; // for date utilities if needed

/**
 * Compute running averages for string weight checks in a shift.
 *
 * @param {Array} records - All string weight check records (synced + queued)
 * @param {Object} config - App config, used for fillHeadWeightRanges (target weights)
 * @returns {Object} Averages summary with per-gram breakdown
 */
export function calculateStringWeightAverages(records, config) {
  if (!records || records.length === 0) {
    return {
      totalChecks: 0,
      totalWeightReadings: 0,
      perGram: {},
      overallAvg: null,
      gramOrder: []
    };
  }

  // Group all individual weight readings by gram/SKU
  const byGram = {};
  let totalWeight = 0;
  let totalCount = 0;

  for (const record of records) {
    const gram = record.gram;
    const weights = record.weights || [];
    
    if (!weights || !weights.length) continue;

    if (!byGram[gram]) {
      byGram[gram] = { 
        weights: [], 
        count: 0, 
        min: Infinity, 
        max: -Infinity 
      };
    }

    for (const w of weights) {
      const weight = Number(w);
      if (isNaN(weight)) continue;
      
      byGram[gram].weights.push(weight);
      byGram[gram].count++;
      byGram[gram].min = Math.min(byGram[gram].min, weight);
      byGram[gram].max = Math.max(byGram[gram].max, weight);
      totalWeight += weight;
      totalCount++;
    }
  }

  // Compute per-gram statistics
  const perGram = {};
  for (const [gram, data] of Object.entries(byGram)) {
    if (!data.weights.length) continue;
    
    const sum = data.weights.reduce((a, b) => a + b, 0);
    const avg = sum / data.count;
    
    // Get target range from config
    const ranges = config?.fillHeadWeightRanges?.[String(gram)];
    const targetMin = ranges?.target?.min;
    const targetMax = ranges?.target?.max;
    const targetCenter = targetMin && targetMax 
      ? (targetMin + targetMax) / 2 
      : null;

    perGram[gram] = {
      avg: Math.round(avg * 1000) / 1000,  // 3 decimal places
      count: data.count,
      min: data.min,
      max: data.max,
      target: targetCenter,
      targetMin,
      targetMax,
      targetRange: targetMin && targetMax ? `${targetMin}-${targetMax}` : 'N/A'
    };
  }

  // Sort grams numerically for consistent display
  const gramOrder = Object.keys(byGram).sort((a, b) => Number(a) - Number(b));

  return {
    totalChecks: records.length,
    totalWeightReadings: totalCount,
    perGram,
    overallAvg: totalCount > 0 ? Math.round((totalWeight / totalCount) * 1000) / 1000 : null,
    gramOrder
  };
}