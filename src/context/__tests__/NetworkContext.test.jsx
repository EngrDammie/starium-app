import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useEffect } from 'react';

vi.mock('../../config/firebase', () => ({ db: {}, auth: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(() => ({ set: vi.fn(), commit: vi.fn() })),
}));

import { NetworkProvider, useNetwork } from '../NetworkContext';

const LEGACY_PROPS = [
  'isOnline',
  'queueCount', 'setQueueCount', 'isSyncing', 'setIsSyncing',
  'cartonQueueCount', 'setCartonQueueCount', 'isCartonSyncing', 'setIsCartonSyncing',
  'laminateQueueCount', 'setLaminateQueueCount', 'isLaminateSyncing', 'setIsLaminateSyncing',
  'cartonInspectionQueueCount', 'setCartonInspectionQueueCount',
  'isCartonInspectionSyncing', 'setIsCartonInspectionSyncing',
  'bagInspectionQueueCount', 'setBagInspectionQueueCount',
  'isBagInspectionSyncing', 'setIsBagInspectionSyncing',
  'stringWeightQueueCount', 'setStringWeightQueueCount',
  'isStringWeightSyncing', 'setIsStringWeightSyncing',
  'palletQueueCount', 'setPalletQueueCount', 'isPalletSyncing', 'setIsPalletSyncing',
  'emptySiloQueueCount', 'setEmptySiloQueueCount', 'isEmptySiloSyncing', 'setIsEmptySiloSyncing',
  'stoppedMachineQueueCount', 'setStoppedMachineQueueCount',
  'isStoppedMachineSyncing', 'setIsStoppedMachineSyncing',
];

const capture = {};
function Probe() {
  const ctx = useNetwork();
  useEffect(() => {
    capture.value = ctx;
  });
  return null;
}

describe('NetworkContext backwards-compatible API', () => {
  it('exposes every legacy flat name existing pages depend on', () => {
    render(
      <NetworkProvider>
        <Probe />
      </NetworkProvider>,
    );
    for (const prop of LEGACY_PROPS) {
      expect(capture.value, `missing ${prop}`).toHaveProperty(prop);
    }
  });

  it('legacy setters accept raw values and updater functions', () => {
    render(
      <NetworkProvider>
        <Probe />
      </NetworkProvider>,
    );
    act(() => {
      capture.value.setLaminateQueueCount(4);
    });
    expect(capture.value.laminateQueueCount).toBe(4);
    act(() => {
      capture.value.setLaminateQueueCount((prev) => prev + 1);
    });
    expect(capture.value.laminateQueueCount).toBe(5);
  });

  it('legacy setter identities are stable across re-renders', () => {
    // Pages (e.g. PalletTransfer) list these setters in useEffect dep arrays.
    // A new identity every render re-fires those effects forever.
    const seen = [];
    function IdentityProbe() {
      const { setPalletQueueCount } = useNetwork();
      useEffect(() => {
        seen.push(setPalletQueueCount);
      });
      return null;
    }
    render(
      <NetworkProvider>
        <IdentityProbe />
      </NetworkProvider>,
    );
    const first = seen[seen.length - 1];
    act(() => {
      first(3);
    });
    const last = seen[seen.length - 1];
    expect(last).toBe(first);
  });

  it('does not loop when a page calls a setter with an unchanged value in an effect (PalletTransfer pattern)', () => {
    // Mirrors PalletTransfer.jsx: useEffect(..., [records, setPalletQueueCount])
    // calling setPalletQueueCount(q.length). Must settle, not hit
    // "Maximum update depth exceeded".
    let renders = 0;
    function PalletLike() {
      const { setPalletQueueCount } = useNetwork();
      renders++;
      useEffect(() => {
        setPalletQueueCount(0);
      }, [setPalletQueueCount]);
      return null;
    }
    render(
      <NetworkProvider>
        <PalletLike />
      </NetworkProvider>,
    );
    expect(renders).toBeLessThan(10);
  });
});
