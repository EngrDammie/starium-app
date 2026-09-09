// src/context/NetworkContext.jsx
//
// Offline-first coordinator, driven by the module registry in
// src/config/offlineModules.js (the single source of truth).
//
// HOW IT WORKS (for the next developer):
// Each factory module owns a localStorage outbox (see OFFLINE_MODULES).
// This provider (1) tracks how many records are pending per module, and
// (2) flushes each pending queue via its service syncFn when back online.
// After each flush it RE-READS the true remaining queue length instead of
// assuming zero — so partial failures stay visible instead of vanishing.
//
// BACKWARDS COMPATIBILITY: pages use flat names like `cartonQueueCount` /
// `setCartonQueueCount` / `isCartonSyncing`. Those are derived here from the
// registry maps, so existing pages work unchanged. New code should prefer
// the maps (`queueCounts`, `syncing`) or the registry directly.
import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { OFFLINE_MODULES, normalizeSyncResult } from '../config/offlineModules';
import { getQueueLength } from '../services/queueStore';

const NetworkContext = createContext();

const initialCounts = Object.fromEntries(OFFLINE_MODULES.map((m) => [m.id, 0]));
const initialSyncing = Object.fromEntries(OFFLINE_MODULES.map((m) => [m.id, false]));

function readAllQueueLengths() {
  const counts = {};
  for (const mod of OFFLINE_MODULES) {
    try {
      counts[mod.id] = getQueueLength(mod.queueKey);
    } catch {
      counts[mod.id] = 0;
    }
  }
  return counts;
}

export function NetworkProvider({ children }) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [queueCounts, setQueueCounts] = useState(initialCounts);
  const [syncing, setSyncing] = useState(initialSyncing);

  // 1. Listen for Wi-Fi changes + initial queue count read.
  useEffect(() => {
    const checkQueues = () => {
      setQueueCounts(readAllQueueLengths());
    };

    const handleOnline = () => {
      setIsOnline(true);
      checkQueues();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    checkQueues();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Auto-sync: flush every pending module queue when online.
  // Guarded by the `syncing` map so each module syncs at most once at a time.
  useEffect(() => {
    if (!isOnline) return;
    const pending = OFFLINE_MODULES.filter(
      (m) => (queueCounts[m.id] || 0) > 0 && !syncing[m.id],
    );
    if (pending.length === 0) return;

    let cancelled = false;

    (async () => {
      await Promise.allSettled(
        pending.map(async (mod) => {
          setSyncing((prev) => ({ ...prev, [mod.id]: true }));
          try {
            const result = await mod.syncFn();
            if (!cancelled) {
              const synced = normalizeSyncResult(result);
              if (synced > 0) console.log(`[Sync] ${mod.label}: ${synced} synced`);
            }
          } catch (e) {
            console.error(`[Sync] ${mod.label} failed:`, e);
          } finally {
            if (!cancelled) {
              let remaining = 0;
              try {
                remaining = getQueueLength(mod.queueKey);
              } catch {
                remaining = 0;
              }
              setQueueCounts((prev) => ({ ...prev, [mod.id]: remaining }));
              setSyncing((prev) => ({ ...prev, [mod.id]: false }));
            }
          }
        }),
      );
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, queueCounts]);

  // 3. Legacy flat API derived from the registry maps.
  // Setters accept either a raw number or an updater fn (prev => next),
  // matching React setState semantics used by existing pages.
  //
  // STABILITY CONTRACT (do not break): pages like PalletTransfer put these
  // setters in useEffect dependency arrays. The setter identities MUST be
  // stable across renders (hence useMemo with no deps — they only wrap the
  // stable useState setters), and calling a setter with an unchanged value
  // MUST NOT create new state (hence the Object.is bail-out returning prev).
  // Violating either re-creates the "Maximum update depth exceeded" loop.
  const legacySetters = useMemo(() => {
    const setters = {};
    for (const mod of OFFLINE_MODULES) {
      setters[mod.setCountProp] = (v) =>
        setQueueCounts((prev) => {
          const current = prev[mod.id] ?? 0;
          const next = typeof v === 'function' ? v(current) : v;
          if (Object.is(next, current)) return prev;
          return { ...prev, [mod.id]: next };
        });
      setters[mod.setSyncingProp] = (v) =>
        setSyncing((prev) => {
          const current = prev[mod.id] ?? false;
          const next = typeof v === 'function' ? v(current) : v;
          if (Object.is(next, current)) return prev;
          return { ...prev, [mod.id]: next };
        });
    }
    return setters;
  }, []);

  const value = useMemo(() => {
    const v = { isOnline, queueCounts, syncing };
    for (const mod of OFFLINE_MODULES) {
      v[mod.countProp] = queueCounts[mod.id] || 0;
      v[mod.syncingProp] = syncing[mod.id] || false;
      v[mod.setCountProp] = legacySetters[mod.setCountProp];
      v[mod.setSyncingProp] = legacySetters[mod.setSyncingProp];
    }
    return v;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, queueCounts, syncing]);

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export const useNetwork = () => useContext(NetworkContext);
