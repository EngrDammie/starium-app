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

import { validateCheck, summarizeCartonRecords } from '../cartonOperations';

describe('validateCheck (carton waste, 4 business rules)', () => {
  it('accepts a valid check', () => {
    expect(validateCheck({ allocated: 100, remaining: 40, wasted: 5 }, { remaining: 0 }).valid).toBe(true);
  });

  it('rejects remaining exceeding available', () => {
    const r = validateCheck({ allocated: 100, remaining: 150, wasted: 0 }, { remaining: 0 });
    expect(r.valid).toBe(false);
  });

  it('rejects negative used (remaining too high)', () => {
    const r = validateCheck({ allocated: 10, remaining: 30, wasted: 0 }, { remaining: 10 });
    expect(r.valid).toBe(false);
  });

  it('rejects wasted exceeding available', () => {
    const r = validateCheck({ allocated: 50, remaining: 50, wasted: 60 }, { remaining: 0 });
    expect(r.valid).toBe(false);
  });

  it('rejects used + wasted exceeding available', () => {
    // available = 100, used = 100 - 10 = 90, wasted = 20 -> 110 > 100
    const r = validateCheck({ allocated: 100, remaining: 10, wasted: 20 }, { remaining: 0 });
    expect(r.valid).toBe(false);
  });
});

describe('summarizeCartonRecords (pure grouping)', () => {
  it('groups by machine, sums totals, sorts checks, computes waste%', () => {
    const records = [
      { machineId: 1, machineDisplayNumber: 'M1', line: '1A', gram: 85, allocated: 100, used: 80, wasted: 10, roundNumber: 2 },
      { machineId: 1, machineDisplayNumber: 'M1', line: '1A', gram: 85, allocated: 50, used: 40, wasted: 5, roundNumber: 1 },
      { machineId: 2, machineDisplayNumber: 'M2', line: '1A', gram: 85, allocated: 20, used: 20, wasted: 0, roundNumber: 1 },
    ];
    const summary = summarizeCartonRecords(records);
    expect(summary).toHaveLength(2);
    const m1 = summary.find((m) => m.machineId === 1);
    expect(m1.totalAllocated).toBe(150);
    expect(m1.totalUsed).toBe(120);
    expect(m1.totalWasted).toBe(15);
    // 15 / 135 * 100 = 11.11
    expect(m1.wastePercent).toBeCloseTo(11.11, 2);
    expect(m1.checks.map((c) => c.roundNumber)).toEqual([1, 2]);
    const m2 = summary.find((m) => m.machineId === 2);
    expect(m2.wastePercent).toBe(0);
  });

  it('returns 0 waste% when nothing processed', () => {
    const summary = summarizeCartonRecords([
      { machineId: 1, allocated: 0, used: 0, wasted: 0, roundNumber: 1 },
    ]);
    expect(summary[0].wastePercent).toBe(0);
  });
});
