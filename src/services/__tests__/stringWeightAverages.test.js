// src/services/__tests__/stringWeightAverages.test.js
//
// Tests for calculateStringWeightAverages pure function.

import { describe, it, expect } from 'vitest';
import { calculateStringWeightAverages } from '../stringWeightAverages';

const MOCK_CONFIG = {
  fillHeadWeightRanges: {
    '22': { target: { min: 1.00, max: 1.05 } },
    '40': { target: { min: 1.18, max: 1.22 } },
    '85': { target: { min: 1.23, max: 1.27 } }
  }
};

const MOCK_RECORDS = [
  { gram: 22, weights: [1.01, 1.02, 1.00] },
  { gram: 22, weights: [1.03, 1.01] },
  { gram: 40, weights: [1.19, 1.20, 1.21, 1.19] },
  { gram: 85, weights: [1.24, 1.25, 1.26, 1.25, 1.24] },
  { gram: 85, weights: [1.25, 1.25] }
];

describe('calculateStringWeightAverages', () => {
  it('computes correct averages per gram', () => {
    const result = calculateStringWeightAverages(MOCK_RECORDS, MOCK_CONFIG);
    
    expect(result.totalChecks).toBe(5);
    expect(result.gramOrder).toEqual(['22', '40', '85']);
    
    // 22g: (1.01+1.02+1.00+1.03+1.01)/5 = 5.08/5 = 1.016
    expect(result.perGram['22'].avg).toBeCloseTo(1.016, 2);
    expect(result.perGram['22'].count).toBe(5);
    expect(result.perGram['22'].target).toBeCloseTo(1.025, 2);
    
    // 40g: (1.19+1.20+1.21+1.19)/4 = 4.79/4 = 1.1975 -> 1.198
    expect(result.perGram['40'].avg).toBeCloseTo(1.198, 2);
    expect(result.perGram['40'].count).toBe(4);
    
    // 85g: (1.24+1.25+1.26+1.25+1.24+1.25+1.25)/7 = 8.74/7 = 1.24857 -> 1.249
    expect(result.perGram['85'].avg).toBeCloseTo(1.249, 2);
    expect(result.perGram['85'].count).toBe(7);
  });

  it('handles empty records', () => {
    const result = calculateStringWeightAverages([], MOCK_CONFIG);
    expect(result.totalChecks).toBe(0);
    expect(Object.keys(result.perGram)).toHaveLength(0);
  });

  it('ignores NaN weights', () => {
    const records = [
      { gram: 22, weights: [1.01, 'bad', 1.02] }
    ];
    const result = calculateStringWeightAverages(records, MOCK_CONFIG);
    expect(result.perGram['22'].avg).toBe(1.015); // Only 1.01 + 1.02
    expect(result.perGram['22'].count).toBe(2);
  });

  it('handles records with missing weights array', () => {
    const records = [
      { gram: 22, weights: null },
      { gram: 40, weights: [1.20] }
    ];
    const result = calculateStringWeightAverages(records, MOCK_CONFIG);
    expect(result.perGram['22']).toBeUndefined();
    expect(result.perGram['40'].avg).toBe(1.2);
  });

  it('handles records with undefined gram', () => {
    const records = [
      { weights: [1.00] }
    ];
    const result = calculateStringWeightAverages(records, MOCK_CONFIG);
    expect(result.perGram['undefined']).toBeDefined();
  });

  it('computes correct min and max', () => {
    const records = [
      { gram: 22, weights: [1.05, 1.00, 1.10, 0.95] }
    ];
    const result = calculateStringWeightAverages(records, MOCK_CONFIG);
    expect(result.perGram['22'].min).toBe(0.95);
    expect(result.perGram['22'].max).toBe(1.10);
  });

  it('handles config without target ranges', () => {
    const configNoTargets = { fillHeadWeightRanges: {} };
    const records = [{ gram: 99, weights: [1.50, 1.51] }];
    const result = calculateStringWeightAverages(records, configNoTargets);
    expect(result.perGram['99'].target).toBeNull();
    expect(result.perGram['99'].targetRange).toBe('N/A');
  });

  it('returns correct overall average', () => {
    // Total weight = 1.01+1.02+1.00+1.03+1.01 + 1.19+1.20+1.21+1.19 + 1.24+1.25+1.26+1.25+1.24+1.25+1.25
    // = 5.08 + 4.79 + 8.74 = 18.61
    // Total count = 5+4+7 = 16
    // Overall avg = 18.61/16 = 1.163125 -> 1.163
    const result = calculateStringWeightAverages(MOCK_RECORDS, MOCK_CONFIG);
    expect(result.overallAvg).toBeCloseTo(1.163, 2);
    expect(result.totalWeightReadings).toBe(16);
  });
});