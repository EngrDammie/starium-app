import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/firebase', () => ({ db: {}, auth: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(),
}));

import { computeOverallResult } from '../qcBagInspectionOperations';
import { computeCartonOverallResult } from '../qcCartonInspectionOperations';
import { getStringWeightStatus } from '../qcStringWeightOperations';

describe('computeOverallResult (bag inspection)', () => {
  it('fails on any U', () => {
    expect(computeOverallResult({ a: 'A', b: 'U', c: 'M' })).toBe('fail');
  });
  it('is conditional on any M without U', () => {
    expect(computeOverallResult({ a: 'A', b: 'M' })).toBe('conditional');
  });
  it('passes when all A', () => {
    expect(computeOverallResult({ a: 'A', b: 'A' })).toBe('pass');
  });
});

describe('computeCartonOverallResult (carton inspection)', () => {
  it('fails on any U', () => {
    expect(computeCartonOverallResult({ a: 'A', b: 'U' })).toBe('fail');
  });
  it('passes otherwise', () => {
    expect(computeCartonOverallResult({ a: 'A', b: 'A' })).toBe('pass');
  });
});

describe('getStringWeightStatus (5-level mapping)', () => {
  const config = {
    fillHeadWeightRanges: {
      '22': {
        tooLow: { max: 128 },
        low: { min: 129, max: 136 },
        target: { min: 137, max: 141 },
        high: { min: 142, max: 149 },
        tooHigh: { min: 150 },
      },
    },
  };

  it('maps each band to the right level', () => {
    expect(getStringWeightStatus('22', 120, config).level).toBe('tooLow');
    expect(getStringWeightStatus('22', 130, config).level).toBe('low');
    expect(getStringWeightStatus('22', 139, config).level).toBe('target');
    expect(getStringWeightStatus('22', 145, config).level).toBe('high');
    expect(getStringWeightStatus('22', 160, config).level).toBe('tooHigh');
  });

  it('returns null for missing ranges or bad input', () => {
    expect(getStringWeightStatus('999', 139, config)).toBeNull();
    expect(getStringWeightStatus('22', '', config)).toBeNull();
    expect(getStringWeightStatus('22', null, config)).toBeNull();
  });
});
