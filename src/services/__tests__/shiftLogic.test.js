import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/firebase', () => ({ db: {}, auth: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  getDocs: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(),
}));

import { getShiftDateInfo } from '../qcOperations';
import { getShiftDateInfo as getSwShiftDateInfo } from '../qcStringWeightOperations';

const CONFIG = { dayShiftStart: 7, nightShiftStart: 19 };

function dateAt(hours, minutes = 0, y = 2026, m = 5, d = 15) {
  const dt = new Date(y, m, d, hours, minutes, 0, 0);
  return dt;
}

describe('getShiftDateInfo (qcOperations)', () => {
  it('returns DAY shift during day hours', () => {
    const { shift, date } = getShiftDateInfo(CONFIG, dateAt(10));
    expect(shift).toBe('DAY');
    expect(date).toBe('2026-06-15');
  });

  it('returns NIGHT shift after night start, same date', () => {
    const { shift, date } = getShiftDateInfo(CONFIG, dateAt(21));
    expect(shift).toBe('NIGHT');
    expect(date).toBe('2026-06-15');
  });

  it('assigns early-morning hours to previous day NIGHT shift (02:00 case)', () => {
    const { shift, date } = getShiftDateInfo(CONFIG, dateAt(2));
    expect(shift).toBe('NIGHT');
    expect(date).toBe('2026-06-14');
  });

  it('treats exact dayShiftStart as DAY and nightShiftStart as NIGHT', () => {
    expect(getShiftDateInfo(CONFIG, dateAt(7)).shift).toBe('DAY');
    expect(getShiftDateInfo(CONFIG, dateAt(19)).shift).toBe('NIGHT');
  });
});

describe('getShiftDateInfo (qcStringWeightOperations mirror)', () => {
  it('matches qcOperations behaviour for the 02:00 previous-day case', () => {
    const a = getShiftDateInfo(CONFIG, dateAt(2));
    const b = getSwShiftDateInfo(CONFIG, dateAt(2));
    expect(b).toEqual(a);
  });
});
