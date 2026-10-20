import { describe, it, expect } from 'vitest';
import { OFFLINE_MODULES, normalizeSyncResult, getModuleById } from '../../config/offlineModules';

// Guards the contract NetworkContext depends on: every module descriptor
// must carry the queue key, sync fn, and legacy flat names.
describe('offlineModules registry', () => {
  it('covers all 10 offline queues', () => {
    expect(OFFLINE_MODULES).toHaveLength(10);
  });

  it('has unique ids, queue keys, and legacy prop names', () => {
    const ids = OFFLINE_MODULES.map((m) => m.id);
    const keys = OFFLINE_MODULES.map((m) => m.queueKey);
    const countProps = OFFLINE_MODULES.map((m) => m.countProp);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(countProps).size).toBe(countProps.length);
  });

  it('every descriptor has a callable syncFn and all legacy names', () => {
    for (const mod of OFFLINE_MODULES) {
      expect(typeof mod.syncFn, `${mod.id} syncFn`).toBe('function');
      for (const prop of ['countProp', 'setCountProp', 'syncingProp', 'setSyncingProp']) {
        expect(typeof mod[prop], `${mod.id}.${prop}`).toBe('string');
      }
    }
  });

  it('preserves the exact legacy names existing pages depend on', () => {
    const countProps = OFFLINE_MODULES.map((m) => m.countProp);
    for (const expected of [
      'queueCount',
      'cartonQueueCount',
      'laminateQueueCount',
      'cartonInspectionQueueCount',
      'bagInspectionQueueCount',
      'stringWeightQueueCount',
      'palletQueueCount',
      'emptySiloQueueCount',
      'stoppedMachineQueueCount',
      'leaveRequestQueueCount',
    ]) {
      expect(countProps).toContain(expected);
    }
  });

  it('leaves are registered for SUBMISSIONS only — approvals must never queue', () => {
    // The deliberate exception to offline-first (blueprint section 10):
    // a leave request may wait on the device, an approval may not, because
    // an approval authorises paid leave and must exist in the database the
    // moment it is made. If someone adds an approval queue to this registry,
    // they are reopening a gap in a legal record. This test is the tripwire.
    const leave = getModuleById('leaveRequest');
    expect(leave).toBeTruthy();
    expect(leave.label).toMatch(/request/i);
    expect(OFFLINE_MODULES.some((m) => /approval/i.test(m.id) || /approval/i.test(m.label))).toBe(false);
  });
});

describe('normalizeSyncResult', () => {
  it('passes numbers through (pallet style)', () => {
    expect(normalizeSyncResult(3)).toBe(3);
  });
  it('reads .synced (object style)', () => {
    expect(normalizeSyncResult({ synced: 5 })).toBe(5);
  });
  it('treats undefined/empty as 0', () => {
    expect(normalizeSyncResult(undefined)).toBe(0);
    expect(normalizeSyncResult(null)).toBe(0);
    expect(normalizeSyncResult({})).toBe(0);
  });
});

describe('getModuleById', () => {
  it('finds modules by id', () => {
    expect(getModuleById('carton').queueKey).toBe('starium_carton_offline_queue');
    expect(getModuleById('nope')).toBeUndefined();
  });
});
