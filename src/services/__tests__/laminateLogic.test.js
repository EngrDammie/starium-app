import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/firebase', () => ({ db: {}, auth: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(),
}));

import {
  validateLaminateCheck,
  getSacWeight,
  computeTotalLaminateUsed,
  summarizeLaminateRecords,
} from '../laminateOperations';

const CONFIG = {
  laminateWaste: {
    rollsPerShift: 3,
    rollWeights: { '22': 51.32, '85': 51.6 },
    sacTypes: [
      { id: 'small', label: 'Small Sac', weight: 0.08 },
      { id: 'large', label: 'Large Sac', weight: 0.16 },
    ],
  },
};

describe('getSacWeight', () => {
  it('looks up configured sac weights', () => {
    expect(getSacWeight('small', CONFIG)).toBe(0.08);
    expect(getSacWeight('large', CONFIG)).toBe(0.16);
  });
  it('returns 0 for unknown sac type', () => {
    expect(getSacWeight('nope', CONFIG)).toBe(0);
  });
});

describe('computeTotalLaminateUsed', () => {
  it('multiplies roll weight by rolls per shift', () => {
    expect(computeTotalLaminateUsed({ gram: 22 }, CONFIG)).toBeCloseTo(153.96, 2);
  });
  it('returns 0 when gram has no configured roll weight', () => {
    expect(computeTotalLaminateUsed({ gram: 999 }, CONFIG)).toBe(0);
  });
});

describe('validateLaminateCheck (3 rules)', () => {
  it('accepts a valid check', () => {
    expect(
      validateLaminateCheck({ sacType: 'small', grossWeight: 1.5, totalLaminateUsed: 150 }, CONFIG).valid,
    ).toBe(true);
  });
  it('rejects missing sac type', () => {
    expect(
      validateLaminateCheck({ sacType: '', grossWeight: 1.5, totalLaminateUsed: 150 }, CONFIG).valid,
    ).toBe(false);
  });
  it('rejects gross weight below sac weight', () => {
    expect(
      validateLaminateCheck({ sacType: 'small', grossWeight: 0.01, totalLaminateUsed: 150 }, CONFIG).valid,
    ).toBe(false);
  });
  it('rejects non-positive total laminate used', () => {
    expect(
      validateLaminateCheck({ sacType: 'small', grossWeight: 1.5, totalLaminateUsed: 0 }, CONFIG).valid,
    ).toBe(false);
  });
});

describe('summarizeLaminateRecords (pure grouping)', () => {
  it('groups by machine and computes waste%', () => {
    const records = [
      { machineId: 1, totalLaminateUsed: 150, wasteCollected: 3, roundNumber: 2 },
      { machineId: 1, totalLaminateUsed: 150, wasteCollected: 2, roundNumber: 1 },
    ];
    const summary = summarizeLaminateRecords(records);
    expect(summary).toHaveLength(1);
    expect(summary[0].totalWasteCollected).toBe(5);
    expect(summary[0].wastePercent).toBeCloseTo(3.33, 2);
    expect(summary[0].checks.map((c) => c.roundNumber)).toEqual([1, 2]);
  });
});
