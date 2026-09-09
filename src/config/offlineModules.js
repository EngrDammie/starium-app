// src/config/offlineModules.js
//
// SINGLE SOURCE OF TRUTH for the offline-first engine.
//
// WHY THIS FILE EXISTS (for the next developer):
// Every factory module persists through the same pattern — try Firestore,
// fall back to a module-scoped localStorage queue, flush on reconnect.
// NetworkContext used to encode that pattern as ~10 copy-pasted useEffect
// blocks with 10 bespoke count/syncing states. Adding a module meant editing
// NetworkContext in 5+ places and hoping you didn't miss one.
//
// Now: to add a module you add ONE descriptor here. NetworkContext iterates
// this registry for queue counting and auto-sync. To remove a module, delete
// its descriptor. The legacy flat context names (cartonQueueCount,
// setCartonQueueCount, isCartonSyncing, ...) are derived from this registry
// in NetworkContext, so pages keep working unchanged.

import { syncQcOfflineQueue } from '../services/qcOperations';
import { syncCartonOfflineQueue } from '../services/cartonOperations';
import { syncLaminateOfflineQueue } from '../services/laminateOperations';
import { syncCartonInspectionQueue } from '../services/qcCartonInspectionOperations';
import { syncBagInspectionQueue } from '../services/qcBagInspectionOperations';
import { syncStringWeightQueue } from '../services/qcStringWeightOperations';
import { syncPalletTransferOfflineQueue } from '../services/palletTransferOperations';
import { syncEmptySiloQueue } from '../services/emptySiloOperations';
import { syncStoppedMachineQueue } from '../services/stoppedMachineOperations';

// Descriptor shape:
// {
//   id:           stable key used in queueCounts/syncing maps,
//   label:        human-readable name for logs,
//   queueKey:     localStorage key for the module's offline outbox,
//   syncFn:       async () => result — flushes the queue to Firestore,
//   countProp / setCountProp / syncingProp / setSyncingProp:
//                legacy flat NetworkContext names preserved for backwards
//                compatibility with existing pages.
// }
export const OFFLINE_MODULES = [
  {
    id: 'qc',
    label: 'QC tests',
    queueKey: 'starium_offline_queue',
    syncFn: syncQcOfflineQueue,
    countProp: 'queueCount',
    setCountProp: 'setQueueCount',
    syncingProp: 'isSyncing',
    setSyncingProp: 'setIsSyncing',
  },
  {
    id: 'carton',
    label: 'Carton waste',
    queueKey: 'starium_carton_offline_queue',
    syncFn: syncCartonOfflineQueue,
    countProp: 'cartonQueueCount',
    setCountProp: 'setCartonQueueCount',
    syncingProp: 'isCartonSyncing',
    setSyncingProp: 'setIsCartonSyncing',
  },
  {
    id: 'laminate',
    label: 'Laminate waste',
    queueKey: 'starium_laminate_offline_queue',
    syncFn: syncLaminateOfflineQueue,
    countProp: 'laminateQueueCount',
    setCountProp: 'setLaminateQueueCount',
    syncingProp: 'isLaminateSyncing',
    setSyncingProp: 'setIsLaminateSyncing',
  },
  {
    id: 'cartonInspection',
    label: 'Carton inspection',
    queueKey: 'starium_carton_inspection_queue',
    syncFn: syncCartonInspectionQueue,
    countProp: 'cartonInspectionQueueCount',
    setCountProp: 'setCartonInspectionQueueCount',
    syncingProp: 'isCartonInspectionSyncing',
    setSyncingProp: 'setIsCartonInspectionSyncing',
  },
  {
    id: 'bagInspection',
    label: 'Bag inspection',
    queueKey: 'starium_bag_inspection_queue',
    syncFn: syncBagInspectionQueue,
    countProp: 'bagInspectionQueueCount',
    setCountProp: 'setBagInspectionQueueCount',
    syncingProp: 'isBagInspectionSyncing',
    setSyncingProp: 'setIsBagInspectionSyncing',
  },
  {
    id: 'stringWeight',
    label: 'String weight',
    queueKey: 'starium_qc_string_weight_queue',
    syncFn: syncStringWeightQueue,
    countProp: 'stringWeightQueueCount',
    setCountProp: 'setStringWeightQueueCount',
    syncingProp: 'isStringWeightSyncing',
    setSyncingProp: 'setIsStringWeightSyncing',
  },
  {
    id: 'pallet',
    label: 'Pallet transfer',
    queueKey: 'starium_pallet_transfer_queue',
    syncFn: syncPalletTransferOfflineQueue,
    countProp: 'palletQueueCount',
    setCountProp: 'setPalletQueueCount',
    syncingProp: 'isPalletSyncing',
    setSyncingProp: 'setIsPalletSyncing',
  },
  {
    id: 'emptySilo',
    label: 'Empty silos',
    queueKey: 'starium_empty_silo_queue',
    syncFn: syncEmptySiloQueue,
    countProp: 'emptySiloQueueCount',
    setCountProp: 'setEmptySiloQueueCount',
    syncingProp: 'isEmptySiloSyncing',
    setSyncingProp: 'setIsEmptySiloSyncing',
  },
  {
    id: 'stoppedMachine',
    label: 'Stopped machines',
    queueKey: 'starium_stopped_machine_queue',
    syncFn: syncStoppedMachineQueue,
    countProp: 'stoppedMachineQueueCount',
    setCountProp: 'setStoppedMachineQueueCount',
    syncingProp: 'isStoppedMachineSyncing',
    setSyncingProp: 'setIsStoppedMachineSyncing',
  },
];

// The legacy sync services disagree on what they return:
//  - { synced: n }           (carton, laminate, inspections, silos, stopped)
//  - { synced, failed }      (qc)
//  - number                  (pallet returns a count)
//  - undefined               (early return on empty queue)
// Normalise to a number so the coordinator doesn't care.
export function normalizeSyncResult(result) {
  if (typeof result === 'number') return result;
  if (result && typeof result.synced === 'number') return result.synced;
  return 0;
}

export function getModuleById(id) {
  return OFFLINE_MODULES.find((m) => m.id === id);
}
