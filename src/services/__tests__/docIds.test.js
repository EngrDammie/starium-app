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

import { getCartonWasteDocId } from '../cartonOperations';
import { getLaminateWasteDocId } from '../laminateOperations';
import { getPalletTransferDocId } from '../palletTransferOperations';
import { getEmptySilosDocId } from '../emptySiloOperations';
import { getStringWeightShiftDocId } from '../qcStringWeightOperations';

const CONFIG = { dayShiftStart: 7, nightShiftStart: 19 };
const DAY = new Date(2026, 5, 15, 10, 0, 0);
const NIGHT = new Date(2026, 5, 15, 22, 0, 0);

describe('shift-scoped document ID formats', () => {
  it('carton doc id', () => {
    expect(getCartonWasteDocId(CONFIG, DAY)).toBe('carton_waste_DAY_2026-06-15');
    expect(getCartonWasteDocId(CONFIG, NIGHT)).toBe('carton_waste_NIGHT_2026-06-15');
  });
  it('laminate doc id', () => {
    expect(getLaminateWasteDocId(CONFIG, DAY)).toBe('laminate_waste_DAY_2026-06-15');
  });
  it('pallet doc id', () => {
    expect(getPalletTransferDocId(CONFIG, DAY)).toBe('pallet_transfer_DAY_2026-06-15');
  });
  it('empty silos doc id', () => {
    expect(getEmptySilosDocId(CONFIG, DAY)).toBe('empty_silos_DAY_2026-06-15');
  });
  it('string weight doc id', () => {
    expect(getStringWeightShiftDocId(CONFIG, DAY)).toBe('qc_string_weight_DAY_2026-06-15');
  });
});
