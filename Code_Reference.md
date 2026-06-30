# Code Reference — Starium Rafa ERP

Comprehensive reference for every exported function, component prop interface, and configuration structure in the codebase.

---

## 1. Context Providers

### AuthContext (`src/context/AuthContext.jsx`)

**Exports:** `AuthProvider`, `useAuth`

**Provider provides:**
| Value | Type | Description |
|---|---|---|
| `currentUser` | Firebase `User` or `null` | Logged-in user object |
| `systemRole` | `'super_admin' \| 'standard'` | Master system role |
| `departmentRoles` | `string[]` | e.g. `['qc_staff', 'qc_manager']` |
| `actionRoles` | `string[]` | e.g. `['buggy_supervisor']` |
| `firstName` | `string` | Title-cased first name |
| `lastName` | `string` | Title-cased last name |
| `userFullName` | `string` | Combined full name |
| `loading` | `boolean` | True while auth state initializing |
| `authEnabled` | `boolean` | From `config/auth_settings` doc |
| `logout` | `() => Promise<void>` | Signs out and sets offline status |

**Ghost Admin mode:** When `authEnabled === false`, creates a virtual user `{ email: 'development@local', uid: 'local-dev-id' }` with `super_admin` role and all department/action roles.

**Presence heartbeat:** Runs `setOnlineStatus()` on login and every 3 minutes; `setOfflineStatus()` on logout or `beforeunload`.

---

### ConfigContext (`src/context/ConfigContext.jsx`)

**Exports:** `ConfigProvider`, `useConfig`

**Provider provides:**
| Value | Type | Description |
|---|---|---|
| `config` | `object` | Merged Firestore + DEFAULT_CONFIG |
| `loadingConfig` | `boolean` | True while initial config loads |

**DEFAULT_CONFIG structure:**
```js
{
  level9MinDensity: 0.200, level9MaxDensity: 0.310, level9Divisor: 1580,
  botMinDensity: 0.200, botMaxDensity: 0.240, botDivisor: 1680,
  dayShiftStart: 7, nightShiftStart: 19, machineGridColumns: 6,
  packagingTeams: { labels: ['A', 'B', 'C'], defaultTeam: 'A' },
  productionLines: [{ id, name, order }],
  machines: [{ id, displayNumber, gram, min, max, line, name, fillHeads }],
  gramSpecs: {
    "22": { min, max, piecesPerCarton, piecesBreakdown, bagCount, freebieCount },
    "45": { ... }, "85": { ... }, "125": { ... }, "850": { ... }
  },
  cartonWaste: { targetWastePercent: 5, wasteAlertThreshold: 10 },
  laminateWaste: {
    targetWastePercent: 5, wasteAlertThreshold: 10, rollsPerShift: 3,
    rollWeights: { "22": 51.32, "45": 54.40, "85": 51.60, "125": 53.70, "850": 49.90 },
    sacTypes: [{ id: 'small', label: 'Small Sac', weight: 0.080 }, { id: 'large', label: 'Large Sac', weight: 0.160 }],
    defaultSacType: 'small'
  },
  qcCheckIntervals: { stringWeight: 15, bagInspection: 15, cartonInspection: 60 },
  fillHeadWeightRanges: {
    "22": { tooLow: { max }, low: { min, max }, target: { min, max }, high: { min, max }, tooHigh: { min } },
    "45": { ... }, "85": { ... }, "125": { ... }, "850": { ... }
  },
  departmentRoles: [{ id, label, category }],
  actionRoles: [{ id, label }]
}
```

**Merge logic:** Firestore data is spread over `DEFAULT_CONFIG` with deep merges for nested objects (packagingTeams, cartonWaste, laminateWaste, gramSpecs, fillHeadWeightRanges). Each machine defaults `fillHeads: 2` if missing. `gramSpecs` merge fills missing fields from defaults per gram key.

---

### NetworkContext (`src/context/NetworkContext.jsx`)

**Exports:** `NetworkProvider`, `useNetwork`

**Provider provides:**
| Value | Type | Description |
|---|---|---|
| `isOnline` | `boolean` | `navigator.onLine` status |
| `queueCount` | `number` | `starium_offline_queue` length |
| `cartonQueueCount` | `number` | `starium_carton_offline_queue` length |
| `laminateQueueCount` | `number` | `starium_laminate_offline_queue` length |
| `cartonInspectionQueueCount` | `number` | `starium_carton_inspection_queue` length |
| `isSyncing` / `setIsSyncing` | `boolean` / setter | QC queue sync state |
| `isCartonSyncing` / ... | `boolean` / setter | Carton queue sync state |
| `isLaminateSyncing` / ... | `boolean` / setter | Laminate queue sync state |
| `isCartonInspectionSyncing` / ... | `boolean` / setter | Carton inspection queue sync state |

**Auto-sync effects (5 total):**
1. QC queue (`starium_offline_queue`) — iterative `addDoc` with retry
2. Carton queue (`starium_carton_offline_queue`) — `syncCartonOfflineQueue()`
3. Laminate queue (`starium_laminate_offline_queue`) — `syncLaminateOfflineQueue()`
4. Carton inspection queue (`starium_carton_inspection_queue`) — `syncCartonInspectionQueue()`

Triggered when `isOnline && queueCount > 0 && !isSyncing`.

---

### AlertContext (`src/context/AlertContext.jsx`)

**Exports:** `AlertProvider`, `useAlerts`

**Provider provides:**
| Value | Type | Description |
|---|---|---|
| `alerts` | `Array<{ id, title, message, level, targetPages, localTimestamp }>` | Live alert array |
| `broadcastAlert` | `(title, message, level?, targetPages?) => Promise<void>` | Firestore `addDoc` to `alerts` collection |
| `setAlerts` | `Dispatch<SetStateAction>` | Manual alert list override |

**Auto-remove:** Alerts auto-dismiss after 15 seconds.

---

## 2. Components

### Layout (`src/components/Layout.jsx`)

**Props:**
| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | required | Page content |
| `title` | `string` | optional | Header title (renders header section) |
| `subtitle` | `string` | optional | Header subtitle |
| `maxWidth` | `string` | `'max-w-4xl'` | Tailwind max-width class for main content |

**Renders:** Hamburger button -> Sidebar -> BroadcastModal -> AuthBar -> SyncBadge -> AlertBanner -> Header (if title) -> `<main>` with children -> Footer

---

### ProtectedRoute (`src/components/ProtectedRoute.jsx`)

**Props:** `{ children: ReactNode }`

**Logic:**
1. If `loading`, return `null`
2. If no `currentUser`, redirect to `/login`
3. If `systemRole === 'super_admin'`, render children
4. Look up `allowedRoles` for current path via `getAllowedRolesForPath()`
5. If `allowedRoles` is `null` (route not in menu), allow access
6. If `allowedRoles.length === 0`, deny with alert, redirect to `/`
7. If user lacks any matching role, deny with alert, redirect to `/` or `/login`

---

### Sidebar (`src/components/Sidebar.jsx`)

**Props:** `{ isOpen: boolean, onClose: () => void, onOpenBroadcast: () => void }`

**Logic:**
- Filters `MENU_CONFIG` categories based on `systemRole` and `departmentRoles`
- Empty categories removed; accordion with collapsible children
- Active route highlighted with primary color
- Pinned "Send Broadcast" button at bottom

---

### MachineGrid (`src/components/MachineGrid.jsx`)

**Props:** `{ density: string, selectedMachines?: number[], overrideMachines?: number[], onMachineClick: (machine, isMatch, isSelected) => void }`

**Logic:**
- Renders production line columns sorted right-to-left by `order` descending
- Each machine button colored: gold (selected/override), green (density match), gray (no match)
- Density matching uses `gramSpecs` for min/max ranges

---

### MachineModal (`src/components/MachineModal.jsx`)

**Props:** `{ isOpen, onClose, machine, isMatch, isSelected, onToggleSelect, onOverride }`

**Displays:** Machine ID, Line, Gram Setting, Density Range, Fill Heads, Carton Content (from `gramSpecs`), Select checkbox, Override button (if no match and not selected)

---

### QCStringWeightDialog (`src/components/QCStringWeightDialog.jsx`)

**Props:** `{ machine, roundNumber, previousRecord, onSave, onClose, saving }`

**Key state:** `weights[]`, `batchInput`, `meetsCriteria`, `remarks`
**Validation:** `getStringWeightStatus()` on each weight, `allFilled && meetsCriteria !== '' && (!isFirstRound || batchInput !== '')`
**Saves:** `{ weights, weightStatuses, allInTarget, outOfRangeCount, meetsCriteria, remarks, batchNumber }`

---

### QCBagInspectionDialog (`src/components/QCBagInspectionDialog.jsx`)

**Props:** `{ machine, roundNumber, previousRecord, batchNumber, stringWeightRecord, onSave, onClose, saving }`

**Criteria:** 6 items with A/M/U grading. Descriptions shown on selection. Border color changes per grade.
**Overall:** `computeOverallResult()` — any U = fail, any M = conditional, else pass.
**Batch number:** Displayed from `stringWeightRecord` with "from String Weight Round {n}" annotation.
**Packing standard:** Shows `bagCount + freebieCount = piecesPerCarton` from `gramSpecs`.

---

### QCCartonInspectionDialog (`src/components/QCCartonInspectionDialog.jsx`)

**Props:** `{ machine, roundNumber, previousRecord, batchNumber, stringWeightRecord, onSave, onClose, saving }`

**Criteria:** 5 items with A/U grading. Same card-style layout as Bag Inspection.
**Overall:** `computeCartonOverallResult()` — any U = fail, else pass.
**Batch number:** Same inheritance pattern as Bag Inspection.

---

### BroadcastModal (`src/components/BroadcastModal.jsx`)

**Props:** `{ isOpen: boolean, onClose: () => void }`

**State:** `broadcastMsg`, `broadcastLevel`, `targetPages`
**Target selection:** "All Screens" toggle or per-route checkboxes grouped by navigation category.

---

### Other Components

| Component | Props | Purpose |
|---|---|---|
| `AuthBar` | none | Top-right user email + logout button |
| `SyncBadge` | none | Online/Offline indicator with pending queue count |
| `AlertBanner` | none | Toast notifications filtered by current page |
| `Footer` | none | Footer text with hover-to-reveal contact |
| `Layout` | `{ children, title?, subtitle?, maxWidth? }` | Page shell |

---

## 3. Services — Complete Function API

### qcOperations.js

```js
getShiftDateInfo(config)
// Returns: { shift: 'DAY'|'NIGHT', date: 'YYYY-MM-DD' }

getOrCreateShiftApproval(mode, config, isOnline?)
// Returns: docId string (creates shift_approvals doc if not exists)

saveQCTest(testData, isOnline, setQueueCount?)
// Returns: 'saved' | 'offline-queued' | 'error'

subscribeToShiftTests(mode, config, callback)
// Returns: unsubscribe function; callback receives sorted tests array

subscribeToShiftApproval(approvalId, callback)
// Returns: unsubscribe function; callback receives approval doc or null

addApprover(approvalId, approverName, approverRole)
// Returns: boolean success
```

### qcStringWeightOperations.js

```js
getStringWeightShiftDocId(config)            // Returns: 'qc_string_weight_{SHIFT}_{DATE}'
getShiftDateInfo(config)                      // Same as qcOperations version
getOrCreateStringWeightShift(config, isOnline) // Creates shift_approvals doc
saveStringWeightCheck(data, isOnline, setQueueCount?) // Returns: 'saved'|'queued'
subscribeToMachineStringWeights(docId, machineId, callback) // Returns: unsubscribe
subscribeToAllStringWeights(docId, callback)  // Returns: unsubscribe
subscribeToShiftApproval(approvalId, callback) // Same pattern
syncStringWeightQueue()                        // Returns: { synced: number } or void
getStringWeightStatus(gramSetting, weight, config) /* Returns:
  { level: 'tooLow'|'low'|'target'|'high'|'tooHigh', label, border, text, bg } | null */
```

### qcBagInspectionOperations.js

```js
saveBagInspectionCheck(data, isOnline)                       // Returns: 'saved'|'queued'
subscribeToMachineBagInspections(docId, machineId, callback)  // Returns: unsubscribe
subscribeToAllBagInspections(docId, callback)                  // Returns: unsubscribe
syncBagInspectionQueue()                                       // Returns: { synced: number } | void
computeOverallResult(criteria)                                 // Returns: 'pass'|'conditional'|'fail'
```

### qcCartonInspectionOperations.js

```js
saveCartonInspectionCheck(data, isOnline)                       // Returns: 'saved'|'queued'
subscribeToMachineCartonInspections(docId, machineId, callback)  // Returns: unsubscribe
subscribeToAllCartonInspections(docId, callback)                  // Returns: unsubscribe
syncCartonInspectionQueue()                                       // Returns: { synced: number } | void
computeCartonOverallResult(criteria)                              // Returns: 'pass'|'fail'
```

### cartonOperations.js

```js
getCartonWasteDocId(config)                   // Returns: 'carton_waste_{SHIFT}_{DATE}'
getOrCreateCartonWasteShift(config, isOnline)  // Creates shift_approvals doc
getPreviousCheck(machineId, shiftApprovalDocId) // Returns: last record or null
validateCheck(record, previousCheck)           // Returns: { valid: boolean, message?: string }
saveCartonCheck(checkData, config, isOnline)   // Returns: { status, message? }
syncCartonOfflineQueue()                       // Returns: { synced: number } | void
subscribeToShiftCartonRecords(config, callback)  // Returns: unsubscribe
subscribeToMachineCartonHistory(machineId, shiftApprovalDocId, callback) // Returns: unsubscribe
fetchCartonRecordsByShift(config, targetShift, targetDate) // Returns: records array
getCartonWasteSummary(config, targetShift, targetDate)     // Returns: per-machine summary array
```

### laminateOperations.js

```js
getLaminateWasteDocId(config)                   // Returns: 'laminate_waste_{SHIFT}_{DATE}'
getOrCreateLaminateWasteShift(config, isOnline)  // Creates shift_approvals doc
computeTotalLaminateUsed(machine, config)        // Returns: number (kg)
getSacWeight(sacType, config)                    // Returns: number (kg)
getPreviousLaminateCheck(machineId, shiftApprovalDocId)  // Returns: last record or null
validateLaminateCheck(record, config)            // Returns: { valid, message? }
saveLaminateCheck(checkData, config, isOnline)   // Returns: { status, message? }
syncLaminateOfflineQueue()                       // Returns: { synced: number } | void
subscribeToShiftLaminateRecords(config, callback) // Returns: unsubscribe
subscribeToMachineLaminateHistory(machineId, shiftApprovalDocId, callback) // Returns: unsubscribe
fetchLaminateRecordsByShift(config, targetShift, targetDate) // Returns: records array
getLaminateWasteSummary(config, targetShift, targetDate)     // Returns: per-machine summary array
```

### emptySiloOperations.js

```js
getEmptySilosDocId(config)                  // Returns: 'empty_silos_{SHIFT}_{DATE}'
subscribeToActiveEmptySilos(callback)       // Returns: unsubscribe (filters: noLongerEmptyAt == null)
subscribeToShiftEmptySilos(config, callback) // Returns: unsubscribe
markMachineEmpty(machine, userFullName, config, broadcastAlert) // Returns: 'saved'|'error'
markMachineNoLongerEmpty(recordId, buggyNumber, userFullName, config, broadcastAlert, machine) // Returns: 'updated'|'error'
```

### stoppedMachineOperations.js

```js
subscribeToMachineIssues(callback)           // Returns: unsubscribe (machine_issues collection)
addMachineIssue(label, addedBy)             // Returns: { id, label } | null
subscribeToActiveStoppedMachines(callback)   // Returns: unsubscribe (filters: isActive == true)
reportStoppedMachine(machine, issues, userFullName)  // Returns: 'saved'|'error'
markIssueSolved(machineDocId, issueId, userFullName) // Returns: 'solved'|'all-solved'|'error'
startMachine(machineDocId, userFullName)             // Returns: 'running'|'started-with-issues'|'error'
appendIssuesToMachine(docId, issues, userFullName)   // Returns: 'saved'|'error'
```

### machineDowntimeOperations.js

```js
queryMachineDowntime({ date, shift, machineNumber?, dayShiftStart?, nightShiftStart? })
// Returns: array of stopped_machines records within shift boundary
```

### presenceOperations.js

```js
setOnlineStatus(uid, email, path?)      // Sets presence/{uid} to online with heartbeat
setOfflineStatus(uid)                    // Sets presence/{uid} to offline
subscribeToActiveUsers(callback)         // Returns: unsubscribe (5-min stale safety net)
```

---

## 4. Configuration Structure

### Firestore doc: `config/settings`

Fields match `DEFAULT_CONFIG` structure above. Auto-generated on first read if not exists.

### Firestore doc: `config/auth_settings`

```js
{ authEnabled: boolean }
```

### Shift Approval Doc ID Patterns

| Module | Pattern |
|---|---|
| Level 9 | `level9_{SHIFT}_{DATE}` |
| BOT | `bot_{SHIFT}_{DATE}` |
| Carton Waste | `carton_waste_{SHIFT}_{DATE}` |
| Laminate Waste | `laminate_waste_{SHIFT}_{DATE}` |
| String Weight | `qc_string_weight_{SHIFT}_{DATE}` |

All stored in `shift_approvals` collection with `mode`, `shift`, `date`, `status` fields.

---

## 5. Navigation Configuration

### MENU_CONFIG (`src/config/navigation.js`)

Structure:
```js
[
  {
    title: 'Category Name',
    icon: 'emoji',
    children: [
      { path: '/route', label: 'Link Text', icon: 'emoji', allowedRoles: ['role1', 'role2'] }
    ]
  }
]
```

`allowedRoles: []` means super_admin only. `getAllowedRolesForPath(path)` returns the `allowedRoles` array or `null`.

### Route List (20 routes)

| Path | Page Component | Roles |
|---|---|---|
| `/login` | `Login` | Public (no ProtectedRoute) |
| `/change-password` | `ChangePassword` | Any authenticated |
| `/` | `Dashboard` | qc_staff, qc_manager, prod_staff, prod_manager, hr_staff, hr_manager |
| `/powder-density` | `PowderDensity` | qc_staff, qc_manager, prod_staff, prod_manager |
| `/level9-exec` | `Level9Exec` | qc_manager, prod_manager |
| `/bot-exec` | `BotExec` | qc_manager, prod_manager |
| `/qc-sachet-production-checks` | `QCSachetProductionChecks` | qc_staff, qc_manager, prod_staff, prod_manager |
| `/empty-silos` | `EmptySilos` | qc_staff, qc_manager |
| `/stop-machine` | `StopMachine` | qc_staff, qc_manager |
| `/carton-waste` | `CartonWaste` | prod_staff, prod_manager, qc_manager |
| `/laminate-waste` | `LaminateWaste` | prod_staff, prod_manager, qc_manager |
| `/machine-downtime-log` | `MachineDowntimeLog` | qc_manager, prod_manager, packaging_manager |
| `/qc-density-report` | `Reports` | qc_manager, prod_manager, hr_manager |
| `/carton-waste-report` | `CartonWasteReport` | prod_manager, qc_manager, packaging_manager |
| `/laminate-waste-report` | `LaminateWasteReport` | prod_manager, qc_manager, packaging_manager |
| `/empty-silos-report` | `EmptySilosReport` | qc_manager, prod_manager, packaging_manager |
| `/stopped-machines-report` | `StoppedMachinesReport` | qc_manager, prod_manager, packaging_manager |
| `/system-config` | `SystemConfig` | super_admin only |
| `/user-management` | `UserManagement` | super_admin only |
| `/active-users` | `ActiveUsers` | super_admin only |

---

## 6. Offline Queue Summary

| localStorage Key | Module | Sync Function | Firestore Collection |
|---|---|---|---|
| `starium_offline_queue` | QC Tests | Manual in NetworkContext | `qc_tests` |
| `starium_carton_offline_queue` | Carton Waste | `syncCartonOfflineQueue()` | `carton_records` |
| `starium_laminate_offline_queue` | Laminate Waste | `syncLaminateOfflineQueue()` | `laminate_records` |
| `starium_qc_string_weight_queue` | String Weight | `syncStringWeightQueue()` | `qc_string_weight_checks` |
| `starium_bag_inspection_queue` | Bag Inspection | `syncBagInspectionQueue()` | `qc_bag_inspection_checks` |
| `starium_carton_inspection_queue` | Carton Inspection | `syncCartonInspectionQueue()` | `qc_carton_inspection_checks` |

All sync functions: write batch to Firestore with `localCreatedAt` and `syncedAt: serverTimestamp()`, clear queue on success.

---

## 7. QC Check Flow

```
String Weight Round 1
  ├── Sets batchNumber for machine (per-machine, entered once)
  ├── Enables Bag Inspection button
  └── Enables Carton Inspection button
         │
String Weight Round N (cooldown: qcCheckIntervals.stringWeight)
Bag Inspection Round N      (cooldown: qcCheckIntervals.bagInspection)
Carton Inspection Round N   (cooldown: qcCheckIntervals.cartonInspection)
```

Each check type:
- Has its own `roundNumber` per machine (independent counters)
- Subscribes to its own Firestore collection
- Has its own offline queue
- Inherits `batchNumber` from String Weight Round 1
- Shows previous round details when available
- Shows first-round info banner when no previous record
- Has configurable cooldown timer (countdown displayed on button; button disabled during cooldown)

---

## 8. Firestore Indexes Required

For each QC check collection (`qc_string_weight_checks`, `qc_bag_inspection_checks`, `qc_carton_inspection_checks`):
- Composite index: `approvalDocId` ASC, `machineId` ASC, `roundNumber` ASC

For `carton_records` and `laminate_records`:
- Composite index: `shiftApprovalDocId` ASC, `machineId` ASC, `roundNumber` ASC
- Composite index: `machineId` ASC, `shiftApprovalDocId` ASC, `roundNumber` DESC

For `stopped_machines`:
- Single index: `isActive` ASC
- Composite index: `stoppedAt` ASC, `machineDisplayNumber` ASC (for downtime queries)

For `presence`:
- Single index: `status` ASC
