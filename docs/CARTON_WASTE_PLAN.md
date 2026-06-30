# Carton Waste Tracking System — Comprehensive Implementation Plan

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Data Model & Firestore Schema](#2-data-model--firestore-schema)
3. [Business Logic & Formulas](#3-business-logic--formulas)
4. [Service Module: `cartonOperations.js`](#4-service-module-cartonoperationsjs)
5. [UI — Data Entry Page: `CartonWaste.jsx`](#5-ui--data-entry-page-cartonwastejsx)
6. [UI — Report Page: `CartonWasteReport.jsx`](#6-ui--report-page-cartonwastereportjsx)
7. [Config & Integration Updates](#7-config--integration-updates)
8. [Edge Cases & Error Handling](#8-edge-cases--error-handling)
9. [Implementation Order](#9-implementation-order)
10. [Appendix: Existing Patterns to Follow](#10-appendix-existing-patterns-to-follow)

---

## 1. Problem Statement

### The Current Workflow

Packaging staff perform rounds every 2 hours to each production machine. At each machine they record:

- **Allocated**: How many new cartons were brought to this machine since the last check
- **Remaining**: The physical count of cartons currently at the machine
- **Wasted**: How many cartons were damaged/discarded since the last check

From these three numbers, the system should calculate **used** cartons and the **waste percentage**. Totals are cumulative across the shift, and historical data must support manager reports comparing shifts, dates, and teams.

### The Risks We Eliminate

| Risk | Solution |
|---|---|
| Staff manually add running totals — arithmetic errors | System computes `used` and cumulative totals automatically |
| Staff forget previous "remaining" count | UI shows previous check data for reference |
| Data entry on paper — lost/delayed | Digital real-time with offline queue |
| No visibility until end of shift | Real-time dashboard with live waste % |
| Hard to compare across shifts/dates | Report page with cross-shift comparison charts |

---

## 2. Data Model & Firestore Schema

### Collection: `carton_records`

Each staff visit to a machine = one document. Data is **incremental** (what changed since last check), not cumulative.

#### Document Structure

```
carton_records/{autoId}
{
  // ── Machine Identity ──
  machineId:           1,          // numeric machine id
  machineDisplayNumber: "1",       // display number (for "M1" label)
  machineName:         "Machine 1",
  line:                "1A",
  gram:                75,

  // ── Shift Context ──
  shiftApprovalDocId:  "carton_waste_DAY_2026-06-18",  // follows existing {mode}_{shift}_{date} pattern
  shift:               "DAY",                           // "DAY" | "NIGHT"
  date:                "2026-06-18",
  team:                "A",                             // packaging team label (from config, or user profile)
  roundNumber:         3,                               // 1-based: 1st, 2nd, 3rd... check of this shift

  // ── Staff Inputs (3 fields only) ──
  allocated:           150,    // NEW cartons brought to machine since the previous check
  remaining:           200,    // PHYSICAL COUNT of cartons at the machine RIGHT NOW
  wasted:              8,      // CARTONS DAMAGED since the previous check

  // ── System-Calculated ──
  used:                70,     // previousCheck.remaining + allocated - remaining
  wastePercent:        10.26,  // wasted / (used + wasted) * 100

  // ── Cumulative Running Totals (computed on read, cached on write) ──
  // These are optional cached fields for fast report queries;
  // they can always be recomputed from all checks in the shift.
  runningAllocated:    450,    // sum of all allocated for this machine so far
  runningUsed:         160,    // sum of all used for this machine so far
  runningWasted:       19,     // sum of all wasted for this machine so far
  runningWastePercent: 10.61,  // runningWasted / (runningUsed + runningWasted) * 100

  // ── Previous Check Reference (for convenience) ──
  previousCheckId:     "abc123def",   // doc ID of previous check for this machine in this shift
  previousRemaining:   120,           // the "remaining" from that previous check

  // ── Metadata ──
  checkedBy:           "John Doe",    // full name from auth
  checkedAt:           Timestamp,     // Firestore server timestamp
  remarks:             "Roll was jammed, 5 cartons damaged",
  createdAt:           Timestamp,
  updatedAt:           Timestamp
}
```

#### Indexes Required

- `collection("carton_records") where shiftApprovalDocId == X` — shift-scoped queries
- `collection("carton_records") where shiftApprovalDocId == X order by machineId, roundNumber` — per-machine ordering
- `collection("carton_records") where machineId == X where shiftApprovalDocId == Y order by roundNumber desc limit 1` — find previous check (composite index)

Firestore will prompt you to create these indexes in the console when you first run the queries.

### Shift Approval Document Pattern

Following the existing convention (see `qcOperations.js:getOrCreateShiftApproval`):

```
shift_approvals/{carton_waste_DAY_2026-06-18}
{
  mode:    "carton_waste",   // identifies this as a carton waste tracking shift
  shift:   "DAY",
  date:    "2026-06-18",
  status:  "active",         // "active" | "closed"
  createdAt: Timestamp
}
```

Note: We don't need the full approval workflow (approvers, signatures) for carton waste unless managers want a "close shift" gate. The document primarily serves as a grouping key, but using the same `shift_approvals` collection means all shift metadata lives in one place.

### Design Rationale

**Why incremental (not cumulative) recording?**

If staff recorded cumulative totals each time:
- Check 1: allocatedCumulative=100, remainingCumulative=80, wastedCumulative=5
- Check 2: allocatedCumulative=250, remainingCumulative=200, wastedCumulative=12

They must mentally add: "I allocated 100 so far, now I allocated 150 more, so total is 250." One off-by-one error corrupts every subsequent check.

With incremental recording:
- Check 1: allocated=100, remaining=80, wasted=5
- Check 2: allocated=150, remaining=200, wasted=7

They only type what they see right now. The system handles all addition.

**Why store `used` and wastePercent on the document?**

These are derived from previous check data, which is an immutable input to this check. Storing them makes queries fast (no need to recompute in the report) and provides an audit trail of what the system calculated at the time of entry.

**Why cache `running*` fields?**

When the report page loads, it can read the latest check per machine and display running totals instantly without summing all checks. These are always recomputed when a new check is saved, and can be recalculated as a safety net if data gets inconsistent.

---

## 3. Business Logic & Formulas

### Core Formula

```
used = previousRemaining + allocated - remaining
```

Where `previousRemaining` is:
- `0` if this is the **first check of the shift** for this machine
- the `remaining` value from the **most recent prior check** for this machine in this shift

### Waste Percentage

```
wastePercent (this check) = wasted / (used + wasted) * 100

If used + wasted === 0 → wastePercent = 0
```

### Running Totals (Shift-Level for a Machine)

```
runningAllocated = Σ all checks.allocated for this machine in this shift
runningUsed      = Σ all checks.used for this machine in this shift
runningWasted    = Σ all checks.wasted for this machine in this shift
runningWastePercent = runningWasted / (runningUsed + runningWasted) * 100
```

### Shift-Level Totals (All Machines)

```
shiftAllocated = Σ runningAllocated across all machines
shiftUsed      = Σ runningUsed across all machines
shiftWasted    = Σ runningWasted across all machines
shiftWastePercent = shiftWasted / (shiftUsed + shiftWasted) * 100
```

### Validation Rules (Executed Before Save)

```javascript
function validateCheck(record, previousCheck) {
  const previousRemaining = previousCheck?.remaining ?? 0;
  const maxAvailable = previousRemaining + record.allocated;

  // 1. Remaining cannot exceed what was available
  if (record.remaining > maxAvailable) {
    return { valid: false, message: `Remaining (${record.remaining}) exceeds available cartons (${maxAvailable}). Check your counts.` };
  }

  // 2. Used cannot be negative
  const used = maxAvailable - record.remaining;
  if (used < 0) {
    return { valid: false, message: `Calculated used is negative (${used}). Remaining seems too high.` };
  }

  // 3. Wasted cannot exceed available cartons
  if (record.wasted > maxAvailable) {
    return { valid: false, message: `Wasted (${record.wasted}) exceeds available cartons (${maxAvailable}).` };
  }

  // 4. Wasted + used should not exceed maxAvailable (theoretical — but warn if it does)
  if (record.wasted + used > maxAvailable) {
    return { valid: false, message: `Used + Wasted (${used + record.wasted}) exceeds available (${maxAvailable}). Double-check your counts.` };
  }

  return { valid: true };
}
```

**Override mechanism**: Following the same pattern as powder density override, a manager can force-save with a reason. This is stored as an optional `overrideReason` field.

### Shift Boundary Logic

Uses the **exact same** `getShiftDateInfo()` function from `qcOperations.js`:

```javascript
// Reuse the existing function — no changes needed
import { getShiftDateInfo } from './qcOperations';
```

- DAY shift: hour >= config.dayShiftStart (default 7) AND < config.nightShiftStart (default 19)
- NIGHT shift: hour >= config.nightShiftStart OR hour < config.dayShiftStart
- Night shift dates roll back at midnight (a 2 AM check belongs to the previous day's shift)

### Team Assignment

Teams are determined by:
1. The user's profile may have a `packagingTeam` field
2. Or the user selects their team when they start the round
3. Or it defaults from a config setting

The team field allows cross-shift comparison: "Team A DAY vs Team B DAY" or "Team A this week vs last week".

---

## 4. Service Module: `cartonOperations.js`

Location: `src/services/cartonOperations.js`

### 4.1 Imports & Constants

```javascript
import { db } from '../config/firebase';
import {
  collection, addDoc, doc, getDoc, getDocs,
  query, where, orderBy, limit, onSnapshot,
  serverTimestamp, writeBatch
} from 'firebase/firestore';
import { getShiftDateInfo } from './qcOperations';
```

### 4.2 Functions

#### `getCartonWasteDocId(config)`

Returns the shiftApprovalDocId string following the existing pattern:

```javascript
export function getCartonWasteDocId(config) {
  const { shift, date } = getShiftDateInfo(config);
  return `carton_waste_${shift}_${date}`;
}
```

#### `getOrCreateCartonWasteShift(config)`

Creates or returns the shift approval document ID. Follows the exact pattern from `qcOperations.js:getOrCreateShiftApproval`:

```javascript
export async function getOrCreateCartonWasteShift(config, isOnline = true) {
  const docId = getCartonWasteDocId(config);
  if (!isOnline) return docId;

  try {
    const docRef = doc(db, 'shift_approvals', docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) return docSnap.id;

    await setDoc(docRef, {
      mode: 'carton_waste',
      shift: getShiftDateInfo(config).shift,
      date: getShiftDateInfo(config).date,
      status: 'active',
      createdAt: serverTimestamp()
    });
    return docId;
  } catch (error) {
    console.error("Error creating carton waste shift:", error);
    return docId;
  }
}
```

#### `getPreviousCheck(machineId, shiftApprovalDocId)`

Fetches the most recent check for this machine in this shift. This is the key function that computes the "previous" values:

```javascript
export async function getPreviousCheck(machineId, shiftApprovalDocId) {
  const q = query(
    collection(db, 'carton_records'),
    where('machineId', '==', machineId),
    where('shiftApprovalDocId', '==', shiftApprovalDocId),
    orderBy('roundNumber', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}
```

#### `saveCartonCheck(checkData, config, isOnline)`

Validates, computes derived fields, and saves. Supports offline queuing:

```javascript
export async function saveCartonCheck(checkData, config, isOnline) {
  const {
    machineId,
    allocated,
    remaining,
    wasted,
    team,
    checkedBy,
    remarks = '',
    previousCheck = null
  } = checkData;

  const previousRemaining = previousCheck?.remaining ?? 0;
  const used = previousRemaining + allocated - remaining;

  // Validation
  const validation = validateCheck({ allocated, remaining, wasted }, previousCheck);
  if (!validation.valid) return { status: 'error', message: validation.message };

  // Compute waste percent
  const totalProcessed = used + wasted;
  const wastePercent = totalProcessed > 0 ? (wasted / totalProcessed) * 100 : 0;

  // If we have previous check's running totals, carry them forward
  const prevRunningAllocated = previousCheck?.runningAllocated ?? 0;
  const prevRunningUsed = previousCheck?.runningUsed ?? 0;
  const prevRunningWasted = previousCheck?.runningWasted ?? 0;

  const runningAllocated = prevRunningAllocated + allocated;
  const runningUsed = prevRunningUsed + used;
  const runningWasted = prevRunningWasted + wasted;
  const runningTotalProcessed = runningUsed + runningWasted;
  const runningWastePercent = runningTotalProcessed > 0
    ? (runningWasted / runningTotalProcessed) * 100
    : 0;

  const roundNumber = previousCheck ? previousCheck.roundNumber + 1 : 1;
  const { shift, date } = getShiftDateInfo(config);
  const docId = getCartonWasteDocId(config);

  const record = {
    machineId: checkData.machineId,
    machineDisplayNumber: checkData.machineDisplayNumber,
    machineName: checkData.machineName || '',
    line: checkData.line || '',
    gram: checkData.gram || 0,
    shiftApprovalDocId: docId,
    shift,
    date,
    team: team || '',
    roundNumber,
    allocated,
    remaining,
    wasted,
    used,
    wastePercent: Math.round(wastePercent * 100) / 100,
    runningAllocated,
    runningUsed,
    runningWasted,
    runningWastePercent: Math.round(runningWastePercent * 100) / 100,
    previousCheckId: previousCheck?.id || null,
    previousRemaining,
    checkedBy,
    checkedAt: serverTimestamp(),
    remarks,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (isOnline) {
    try {
      await addDoc(collection(db, 'carton_records'), record);
      return { status: 'saved' };
    } catch (error) {
      console.error("[Carton Save] Error, queueing:", error);
      return queueCartonCheckOffline(record);
    }
  } else {
    return queueCartonCheckOffline(record);
  }
}
```

#### Offline Queue Helpers

```javascript
const CARTON_QUEUE_KEY = 'starium_carton_offline_queue';

function queueCartonCheckOffline(record) {
  try {
    const queue = JSON.parse(localStorage.getItem(CARTON_QUEUE_KEY) || '[]');
    queue.push({ ...record, localCreatedAt: new Date().toISOString() });
    localStorage.setItem(CARTON_QUEUE_KEY, JSON.stringify(queue));
    return { status: 'offline-queued' };
  } catch (e) {
    console.error("Failed to queue carton check offline", e);
    return { status: 'error' };
  }
}
```

#### `syncCartonOfflineQueue()`

To be called by `NetworkContext`'s sync mechanism:

```javascript
export async function syncCartonOfflineQueue() {
  const queue = JSON.parse(localStorage.getItem(CARTON_QUEUE_KEY) || '[]');
  if (queue.length === 0) return;

  const batch = writeBatch(db);
  const collectionRef = collection(db, 'carton_records');

  for (const record of queue) {
    const newDocRef = doc(collectionRef);
    batch.set(newDocRef, {
      ...record,
      localCreatedAt: record.localCreatedAt || new Date().toISOString(),
      syncedAt: serverTimestamp()
    });
  }

  try {
    await batch.commit();
    localStorage.removeItem(CARTON_QUEUE_KEY);
    return { synced: queue.length };
  } catch (error) {
    console.error("Failed to sync carton offline queue:", error);
    return { synced: 0 };
  }
}
```

#### `subscribeToShiftCartonRecords(config, callback)`

Real-time subscription for all records in the current shift (data entry page):

```javascript
export function subscribeToShiftCartonRecords(config, callback) {
  const docId = getCartonWasteDocId(config);
  const q = query(
    collection(db, 'carton_records'),
    where('shiftApprovalDocId', '==', docId),
    orderBy('roundNumber', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(records);
  }, (error) => {
    console.error("Error subscribing to carton records:", error);
    callback([]);
  });
}
```

#### `subscribeToMachineCartonHistory(machineId, shiftApprovalDocId, callback)`

Real-time subscription for a single machine's check history within a shift:

```javascript
export function subscribeToMachineCartonHistory(machineId, shiftApprovalDocId, callback) {
  const q = query(
    collection(db, 'carton_records'),
    where('machineId', '==', machineId),
    where('shiftApprovalDocId', '==', shiftApprovalDocId),
    orderBy('roundNumber', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(records);
  }, (error) => {
    console.error("Error subscribing to machine carton history:", error);
    callback([]);
  });
}
```

#### Report Query Functions

```javascript
/**
 * Fetch all carton records for a given shift (by explicit date+shift, not current time).
 * Used by the report page to view any past shift.
 */
export async function fetchCartonRecordsByShift(config, targetShift, targetDate) {
  const docId = `carton_waste_${targetShift}_${targetDate}`;
  const q = query(
    collection(db, 'carton_records'),
    where('shiftApprovalDocId', '==', docId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Returns aggregated per-machine data for a shift.
 * Used for the report table and charts.
 */
export async function getCartonWasteSummary(config, targetShift, targetDate) {
  const records = await fetchCartonRecordsByShift(config, targetShift, targetDate);

  const machinesMap = {};

  for (const record of records) {
    if (!machinesMap[record.machineId]) {
      machinesMap[record.machineId] = {
        machineId: record.machineId,
        machineDisplayNumber: record.machineDisplayNumber,
        line: record.line,
        gram: record.gram,
        checks: [],
        totalAllocated: 0,
        totalUsed: 0,
        totalWasted: 0
      };
    }

    const m = machinesMap[record.machineId];
    m.checks.push(record);
    m.totalAllocated += record.allocated;
    m.totalUsed += record.used;
    m.totalWasted += record.wasted;
  }

  return Object.values(machinesMap).map(m => {
    const totalProcessed = m.totalUsed + m.totalWasted;
    return {
      ...m,
      checks: m.checks.sort((a, b) => a.roundNumber - b.roundNumber),
      wastePercent: totalProcessed > 0
        ? Math.round((m.totalWasted / totalProcessed) * 10000) / 100
        : 0
    };
  });
}
```

---

## 5. UI — Data Entry Page: `CartonWaste.jsx`

Location: `src/pages/CartonWaste.jsx`

### 5.1 Page Layout & State

```
┌────────────────────────────────────────────────────────────┐
│  ← Carton Waste Tracking           Team: [A ▼]            │
│  Shift: DAY · Saturday, 18 Jun 2026                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ M1       │ │ M2       │ │ M3       │ │ M4       │    │
│  │ Alloc:500│ │ Alloc:450│ │ Alloc:350│ │ —       │    │
│  │ Waste:2.1%│ │ Waste:3.5%│ │ Waste:1.8%│ │         │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│  │ M5       │ │ M6       │ │ M7       │                 │
│  │ —       │ │ —       │ │ —       │                 │
│  └──────────┘ └──────────┘ └──────────┘                 │
│                                                            │
│  [View Report →]                                           │
└────────────────────────────────────────────────────────────┘
```

#### Key State Variables

```javascript
const [records, setRecords] = useState([]);       // all checks in current shift (real-time)
const [selectedMachine, setSelectedMachine] = useState(null);
const [isModalOpen, setIsModalOpen] = useState(false);
const [previousCheck, setPreviousCheck] = useState(null); // latest check for current machine
const [team, setTeam] = useState('');             // persisted to localStorage
```

### 5.2 Machine Grid

Uses the exact same `MachineGrid` component but with carton-specific coloring:

| Color | Meaning |
|---|---|---|
| 🟢 Green | Checked at least once this shift |
| ⚪ Gray | Not yet checked this shift |
| 🔴 Red | Running waste percent > target (configurable via `targetWastePercent`, default 5%) |

The grid renders machines from `config.machines` grouped by `config.productionLines`, sorted right-to-left (3B → 1A), same as the existing `MachineGrid` component.

Key difference: Instead of a density value driving the color, each machine cell displays:
- Machine label (M1, M2...)
- Running allocated count (if checked at least once)
- Running waste % (if checked at least once)

### 5.3 Check Modal

Opens when a machine cell is clicked.

```
┌─────────────────────────────────────────────────────┐
│  Machine M5 — Line 2A (85g)                    [✕]  │
│                                                      │
│  Previous Check (Round 2 by John Doe):           │  ← "Round 2" in cyan bold
│    Allocated: 150  |  Remaining: 200  |  Wasted: 8  │
│    Used: 70  |  Waste %: 10.3%                      │
│                                                      │
│  New Check — Round 3                              │  ← "Round 3" in amber bold
│                                                      │
│  Cartons Allocated (new since last check):           │
│  [___________________120__________________]          │
│                                                      │
│  Cartons Remaining (current physical count):         │
│  [___________________180__________________]          │
│                                                      │
│  Cartons Wasted (new since last check):              │
│  [____________________5___________________]          │
│                                                      │
│  ─── Auto-Calculated ───                            │
│  Cartons Used:       200 + 120 - 180 = 140    ✅    │
│  Waste % (this check):  5 / (140+5) = 3.4%          │
│                                                      │
│  ─── Running Totals (this shift, this machine) ───  │
│  Allocated: 620  |  Used: 210  |  Wasted: 13        │
│  Waste %:  13 / 223 = 5.83%                         │
│                                                      │
│  Remarks: [_____________________________]            │
│                                                      │
│  [Cancel]  [Save & Next Machine]  [Save & Close]     │
└─────────────────────────────────────────────────────┘
```

#### Modal Behaviors

- **"Save & Next Machine"**: Saves the current check and opens the **next machine in numerically sorted order** (e.g., M12 → M13 → M17 → M18 → M19), regardless of round or check status. This enables rapid data entry — staff tap through machines one by one. **Closes when the last machine is reached**, signaling the user to start a new cycle.
- **"Save & Close"**: Saves and closes modal, returning to machine grid.
- **"Cancel"**: Discards input, closes modal.
- **Validation feedback**: If any validation rule fails, the relevant field gets a red border + error message below it.
- **Previous check data**: Fetched asynchronously when the modal opens. Shows a loading skeleton while fetching (Firestore round-trip ~100-300ms).

#### Input Constraints

- `allocated`: integer ≥ 0
- `remaining`: integer ≥ 0, ≤ previousRemaining + allocated
- `wasted`: integer ≥ 0, ≤ previousRemaining + allocated
- All fields auto-focus on open (first field), Tab advances to next

### 5.4 Round Management (Per-Machine, Implicit)

Rounds are **per-machine** — there is no global round counter. Each machine independently tracks how many times it has been checked this shift.

- **Round number** = count of existing records for that machine in this shift + 1
- Machine A can be on Round 5 while Machine B is on Round 2 — no coordination needed

When a staff member opens a machine's check modal:
1. The system fetches the most recent check for this machine in this shift (`getPreviousCheck`)
2. If that check has `roundNumber: 2`, this new check will be `roundNumber: 3`
3. The dialog shows **`Previous Check (Round 2)`** in cyan and **`New Check — Round 3`** in amber

Since rounds are per-machine, "Save & Next Machine" simply advances to the next machine in numeric order — it doesn't care about rounds at all.

**Rationale**: This avoids all coordination problems. Staff A can check M1, M2, M3 (all Round 1), then check M1 again (Round 2) before ever touching M4. Staff B can independently check their own machines. The `checkedAt` timestamp provides exact ordering across machines.

### 5.5 Real-Time Updates

- `subscribeToShiftCartonRecords()` keeps the grid updated in real-time
- When another staff member checks a machine on another device, the grid updates instantly
- The running waste % per machine updates live

### 5.6 Unchecked Machines Indicator

A small badge on the page header shows the number of machines with **zero checks this shift** (completely untouched). As each machine is checked for the first time, this count decrements. This gives staff immediate feedback on which machines still need their first check.

---

## 6. UI — Report Page: `CartonWasteReport.jsx`

Location: `src/pages/CartonWasteReport.jsx`

### 6.1 Page Layout

```
┌────────────────────────────────────────────────────────────┐
│  Carton Waste Report                                  Print │
│                                                            │
│  [Date: 2026-06-18 ▼] [Shift: DAY ▼] [Team: All ▼]        │
│  [Machine: All Machines ▼]  [Generate Report]              │
│                                                            │
│  ─── Summary ───                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Total    │ │ Total    │ │ Total    │ │ Waste %  │    │
│  │ Allocated │ │ Used     │ │ Wasted   │ │          │    │
│  │ 12,500   │ │ 10,200   │ │ 345      │ │  3.27%   │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Waste % per Machine           Target: 5% ─────    │   │
│  │  ██░░░░░░░░░░  M1  2.17%   ✅                     │   │
│  │  ██████░░░░░░  M2  6.25%   ⚠️                     │   │
│  │  ██░░░░░░░░░░  M3  1.29%   ✅                     │   │
│  │  ████████░░░░  M4  8.50%   ⚠️                     │   │
│  │  ░░░░░░░░░░░░  M5  0.00%   ✅                     │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Waste Trend Over Rounds                          │   │
│  │  ┌──────────────────────────────────┐             │   │
│  │  │  📈 Chart.js Line Chart          │             │   │
│  │  │  X: Round Number                 │             │   │
│  │  │  Y: Waste %                      │             │   │
│  │  │  Lines: M1(🟢), M2(🔴), M3(🟡)  │             │   │
│  │  └──────────────────────────────────┘             │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ─── Per-Machine Breakdown ───                           │
│  ┌─────┬──────┬───────┬────────┬──────┬───────┬────────┐ │
│  │Mach │ Line │Checks │Alloc'd │ Used │Wasted│ Waste%  │ │
│  ├─────┼──────┼───────┼────────┼──────┼───────┼────────┤ │
│  │ M1  │ 1A   │  5    │ 2,000  │1,800 │  40   │ 2.17%  │ │
│  │ M2  │ 1A   │  5    │ 1,500  │1,200 │  80   │ 6.25%  │ │
│  │ M3  │ 2B   │  4    │ 2,500  │2,300 │  30   │ 1.29%  │ │
│  │ ... │      │       │        │      │       │        │ │
│  ├─────┼──────┼───────┼────────┼──────┼───────┼────────┤ │
│  │Total│      │       │12,500  │10,200│ 345   │ 3.27%  │ │
│  └─────┴──────┴───────┴────────┴──────┴───────┴────────┘ │
│                                                            │
│  ─── Cross-Shift Comparison ───                          │
│  ┌──────────────────────────────────────────┐            │
│  │  📊 Chart.js Bar Chart                   │            │
│  │  DAY 6/16 ████████████████  5.88%        │            │
│  │  DAY 6/17 ██████████░░░░░  4.12%        │            │
│  │  DAY 6/18 ████████░░░░░░░  3.27% ← cur  │            │
│  │  Trend: ↓ Improving                       │            │
│  └──────────────────────────────────────────┘            │
│                                                            │
│  [Export CSV] [Print Report]                               │
└────────────────────────────────────────────────────────────┘
```

### 6.2 Filters

| Filter | Type | Source | Default |
|---|---|---|---|
| Date | Date picker | User selects | Today |
| Shift | Dropdown: DAY / NIGHT | User selects | Current shift |
| Team | Dropdown: All / A / B / C | User selects | "All" |
| Machine | Dropdown: All / M1 / M2 / ... | From config.machines | "All" |

The "Generate Report" button triggers data fetch. Alternatively, auto-fetch when all filters are set (better UX).

### 6.3 Summary Cards

4 cards in a row:
1. **Total Allocated** — sum of all `allocated` across all records matching filters
2. **Total Used** — sum of all `used` across all records matching filters
3. **Total Wasted** — sum of all `wasted` across all records matching filters
4. **Waste %** — `totalWasted / (totalUsed + totalWasted) * 100`

Color the waste % card:
- Green: < targetWastePercent (default 5%)
- Yellow: >= targetWastePercent but < targetWastePercent * 1.5
- Red: >= targetWastePercent * 1.5

### 6.4 Waste % by Machine (Horizontal Bar Chart)

- **Type**: Horizontal bar chart using Chart.js via react-chartjs-2
- **X-axis**: Waste percentage (0% to max observed + 10% padding)
- **Y-axis**: Machine labels (M1, M2, M3...)
- **Bar colors**: Green if ≤ target, yellow if ≤ target*1.5, red if > target*1.5
- **Target line**: Vertical dashed line at targetWastePercent
- **Tooltip**: Shows exact waste %, total used, total wasted

### 6.5 Waste Trend Over Rounds (Line Chart)

- **Type**: Multi-line chart
- **X-axis**: Round number (1, 2, 3...)
- **Y-axis**: Waste % (0% to 100%)
- **Each line**: A machine selected in the filter (if "All Machines", show top 5 highest waste machines)
- **Legend**: Machine labels with color coding
- **Target line**: Horizontal dashed line at targetWastePercent

### 6.6 Per-Machine Breakdown (Table)

- Columns: Machine, Line, # Checks, Total Allocated, Total Used, Total Wasted, Waste %
- Sortable by clicking column headers
- Click a row to expand and see individual check details (round-by-round breakdown)
- Last row is a bold "Total" row
- Print-friendly (A4 Landscape, no background colors, respects `print:` Tailwind classes)

### 6.7 Cross-Shift Comparison (Bar Chart)

- **Type**: Vertical bar chart
- **X-axis**: Shift labels (e.g., "DAY 6/16", "DAY 6/17", "DAY 6/18" or "NIGHT 6/15", etc.)
- **Y-axis**: Waste %
- **Up to 14 bars**: Last 14 shifts of the same type (DAY or NIGHT)
- **Color gradient**: Green (low waste) to Red (high waste)
- **Current shift highlighted** with a distinct border/glow
- **Trend arrow**: ↑ Worsening / ↓ Improving / → Stable based on linear regression slope

### 6.8 Export & Print

- **CSV Export**: Downloads a CSV with columns: Date, Shift, Team, Machine, Line, Round, Allocated, Used, Wasted, Waste %, CheckedBy, CheckedAt
- **Print**: Uses `window.print()`. The component uses `print:hidden` (existing Tailwind utility class) on non-essential UI elements. The report renders cleanly in A4 Landscape.

### 6.9 Shift Comparison Table (Below Charts)

```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Shift    │ Alloc'd  │ Used     │ Wasted   │ Waste %  │ vs Prev  │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ DAY 6/18 │ 12,500   │ 10,200   │ 345      │ 3.27%    │ -0.85% ↓ │
│ DAY 6/17 │ 11,800   │ 9,500    │ 410      │ 4.12%    │ -1.76% ↓ │
│ DAY 6/16 │ 10,200   │ 8,100    │ 480      │ 5.88%    │ —       │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

"vs Prev" column: Green with ↓ arrow if improvement, Red with ↑ arrow if worsening.

---

## 7. Config & Integration Updates

### 7.1 `src/config/navigation.js`

Add under the "Production" category (or "Quality Control" with the other machine tracking tools):

```javascript
{
  title: 'Production',
  icon: '⚙️',
  children: [
    { path: '/carton-waste', label: 'Carton Waste Tracking', icon: '📦', allowedRoles: ['prod_staff', 'prod_manager', 'qc_manager'] },
    { path: '/carton-waste-report', label: 'Carton Waste Report', icon: '📊', allowedRoles: ['prod_manager', 'qc_manager', 'packaging_manager'] },
    // ... existing entries
  ]
}
```

**Roles rationale**:
- `prod_staff`: The packaging staff doing the data entry
- `prod_manager`: Sees live data and reports
- `qc_manager`: Quality oversight on material waste
- `packaging_manager`: Dedicated packaging manager role (if it exists)

### 7.2 `src/App.jsx`

```javascript
import CartonWaste from './pages/CartonWaste';
import CartonWasteReport from './pages/CartonWasteReport';

// Inside <Routes>:
<Route path="/carton-waste" element={<ProtectedRoute><CartonWaste /></ProtectedRoute>} />
<Route path="/carton-waste-report" element={<ProtectedRoute><CartonWasteReport /></ProtectedRoute>} />
```

### 7.3 System Config Defaults

Add to `DEFAULT_CONFIG` in `ConfigContext.jsx`:

```javascript
cartonWaste: {
  targetWastePercent: 5,       // machines above this % are flagged
  wasteAlertThreshold: 10,     // if a check's waste% exceeds this, trigger alert
  teams: ['A', 'B', 'C'],     // available packaging team labels
  defaultTeam: 'A'
}
```

Add these fields to the System Config editor page (SystemConfig.jsx) so admins can tune them without code changes.

### 7.4 Update SyncBadge / NetworkContext

The `NetworkContext`'s sync function should also call `syncCartonOfflineQueue()`. Add it alongside the existing queue sync logic.

### 7.5 Firestore Security Rules (Optional but Recommended)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /carton_records/{record} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
        && request.resource.data.allocated is number
        && request.resource.data.remaining is number
        && request.resource.data.wasted is number
        && request.resource.data.used is number
        && request.resource.data.remaining >= 0;
      allow update: if request.auth != null
        && request.resource.data.updatedAt == request.time;
      allow delete: if false; // never delete — audit trail
    }
  }
}
```

---

## 8. Edge Cases & Error Handling

### 8.1 First Check of the Shift

- `previousCheck` is null
- `previousRemaining` = 0 (assume starting inventory is empty)
- `used` = 0 + allocated - remaining

**Potential improvement**: Add a `startingInventory` field to the shift approval document. Staff can record how many cartons each machine started with at shift handover. This would make `previousRemaining` default to `startingInventory[machineId] ?? 0`.

However, since cartons are allocated throughout the shift, starting with 0 is the safer assumption. If there were leftover cartons from the previous shift, they'd be reflected in the previous shift's final remaining count, and the next shift's first check should account for them.

**Edge case**: What if previous shift's final check recorded `remaining: 80`, and the new shift's first check also records `remaining: 80` but doesn't know about it?

- The previous shift data belongs to a different `shiftApprovalDocId`, so the system treats the new shift as fresh.
- Staff would record: allocated=0 (no new cartons), remaining=80 (what they see), wasted=0
- `used = 0 + 0 - 80 = -80` → **Validation fails**.
- **Resolution**: Staff should record the previous shift's remaining as a "brought forward allocation". They'd enter:
  - allocated: 80 (brought forward from previous shift)
  - remaining: 80 (current count)
  - wasted: 0
  - `used = 0 + 80 - 80 = 0` ✅
- The UI should show a prompt: "Is this the first check of the shift? Are there cartons carried over from the previous shift? Enter them as Allocated."

### 8.2 Machine Skipped for a Round

A machine might go 4+ hours without a check (staff forgot, machine was down, etc.).

- The next check simply uses the most recent `remaining` regardless of round gap
- `roundNumber` jumps: previous was round 2 (at 10:00), next is round 3 (at 14:00)
- Data is still valid — the `checkedAt` timestamps show the gap
- The report will show this as a larger time span between checks

### 8.3 Negative Used (Counting Error)

`used` comes out negative if `remaining` is too high. This means staff over-counted the remaining cartons.

- Validation blocks the save
- Show error: "Remaining (X) seems too high. Available was (Y). Did you mean to enter a lower number?"
- Offer an override for managers with a reason

### 8.4 Wasted > Available

`wasted` exceeds `previousRemaining + allocated`. This is impossible — you can't waste more than you have.

- Validation blocks the save
- Show error: "Wasted (X) exceeds available cartons (Y). Check your count."
- Offer manager override

### 8.5 Multiple Staff Checking the Same Machine

Because each check is a separate document, there's no conflict. If Staff A and Staff B both check M5 at nearly the same time:

- Staff A saves first → round 3 for M5
- Staff B loads the modal → sees round 3 as "previous" (Staff A's check)
- Staff B saves → round 4 for M5

If Staff B loaded the modal before Staff A saved, their `previousCheck` is round 2, and they'd both create round 3. This is handled by:

- Showing a warning if `previousCheck.id` on the server already has a check with `roundNumber = roundNumber + 1`
- Or simply letting both exist — the report sums all checks, so two round 3 entries would double-count. This is bad.
- **Better solution**: On save, re-fetch the latest check and re-validate. If the previous check has changed since the modal opened, warn the user and refresh the form.

### 8.6 Offline Queue Overflow

- The offline queue is stored in `localStorage` (limited to ~5-10MB)
- At ~1KB per check × 30 machines × 5 rounds × 2 shifts = ~300KB max — well within limits
- If offline for days, the queue grows but is still manageable
- Show a queue count in `SyncBadge` (reuse existing mechanism)

### 8.7 Mid-Shift Machine Change

What if a machine is swapped out mid-shift (e.g., M5 is replaced by M5B)?

- The machine's physical identity changes but its display number stays the same
- Staff record against the same `machineId` / `machineDisplayNumber`
- If the new machine has a different count, staff would see a jump in `remaining`
- Solution: Record a `machineChangeNote` field, or flag it in `remarks`

### 8.8 Comparing Incomplete Shifts

When viewing the current shift's report (shift still in progress), totals are partial. The report should display:

- "⚠️ Shift in progress — data is partial"
- Show the last check time: "Last check: 14:30"
- Don't show comparison arrows for the current shift

### 8.9 Zero Cartons Used or Wasted

A machine that never ran: allocated=0, remaining=0, wasted=0, used=0.

- Waste % = 0 / (0 + 0) = 0 (handled by the guard clause)
- Display as "0.00%" or "—" (no data)

### 8.10 Deleted/Edited Records

For audit trail integrity, records should never be deleted. If a mistake is made:
- Create a new check with the correct data (round N+1)
- Optionally, add a `correctionOfId` field referencing the erroneous check
- The report sums all checks, so the correction simply adds to the total

If the error is discovered immediately, a manager could "undo" by recording the adjustment in the next check. No retroactive edits.

---

## 9. Implementation Order

### Phase 1: Foundation (Service + Page Scaffolding)

| Step | File | What |
|---|---|---|
| 1 | `src/services/cartonOperations.js` | All functions described in section 4 |
| 2 | `src/pages/CartonWaste.jsx` | Page shell: layout, subscription, machine grid render |
| 3 | Wire up route in `App.jsx` and nav in `navigation.js` | |
| 4 | Add defaults to `ConfigContext.jsx` | cartonWaste config |

**Test**: Open page, see machine grid, no data yet.

### Phase 2: Data Entry (Check Modal)

| Step | File | What |
|---|---|---|
| 5 | `src/pages/CartonWaste.jsx` | Add check modal with form inputs |
| 6 | `src/pages/CartonWaste.jsx` | Integrate `getPreviousCheck()` and `saveCartonCheck()` |
| 7 | `src/pages/CartonWaste.jsx` | Add validation feedback in UI |
| 8 | `src/pages/CartonWaste.jsx` | Real-time grid updates via subscription |
| 9 | `src/pages/CartonWaste.jsx` | Save & Next Machine flow |

**Test**: Click machine → fill form → save → see grid update in real-time. Test offline: turn off network → save → check queue.

### Phase 3: Reports

| Step | File | What |
|---|---|---|
| 10 | `src/pages/CartonWasteReport.jsx` | Filters + fetch data |
| 11 | `src/pages/CartonWasteReport.jsx` | Summary cards + per-machine table |
| 12 | `src/pages/CartonWasteReport.jsx` | Chart.js waste % per machine bar chart |
| 13 | `src/pages/CartonWasteReport.jsx` | Chart.js waste trend line chart |
| 14 | `src/pages/CartonWasteReport.jsx` | Cross-shift comparison chart + table |
| 15 | `src/pages/CartonWasteReport.jsx` | CSV export + print |

**Test**: Generate report for today, for yesterday, compare shifts.

### Phase 4: Integration & Polish

| Step | File | What |
|---|---|---|
| 16 | `src/context/NetworkContext.jsx` | Add `syncCartonOfflineQueue()` to auto-sync |
| 17 | `src/pages/CartonWaste.jsx` | Add alert broadcast when waste exceeds threshold |
| 18 | `src/pages/SystemConfig.jsx` | Add carton waste settings to config UI |
| 19 | Firestore Console | Create required composite indexes |
| 20 | — | End-to-end testing |

**Test**: Full workflow: data entry → real-time update → report → cross-shift comparison → offline → sync.

---

## 10. Appendix: Existing Patterns to Follow

### Pattern 1: Firestore Service Module

Follow `src/services/emptySiloOperations.js` exactly:

```javascript
// File structure
import { db } from '../config/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { getShiftDateInfo } from './qcOperations';

export function getDocId(config) { /* ... */ }
export function subscribeToActive(callback) { /* ... */ }
export function subscribeToShift(config, callback) { /* ... */ }
export async function createRecord(data, config, broadcastAlert) { /* ... */ }
export async function updateRecord(id, data) { /* ... */ }
```

### Pattern 2: Page Component

Follow `src/pages/EmptySilos.jsx`:

```javascript
import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
// ... service imports

export default function PageName() {
  const { config } = useConfig();
  const { currentUser } = useAuth();
  const { broadcastAlert } = useAlert();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToShift(config, (data) => {
      setRecords(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [config]);

  return (
    <Layout title="Page Title" subtitle="Descriptive subtitle" maxWidth="max-w-6xl">
      {/* page content */}
    </Layout>
  );
}
```

### Pattern 3: Machine Grid & Lines

Follow `src/components/MachineGrid.jsx`:

```javascript
const lines = [...(config.productionLines || [])].sort((a, b) => b.order - a.order);

lines.map(lineObj => {
  const lineMachines = (config.machines || [])
    .filter(m => m.line === lineObj.id)
    .sort((a, b) => (a.displayNumber || a.id) - (b.displayNumber || b.id));

  if (lineMachines.length === 0) return null;

  return (
    <div key={lineObj.id} className="flex flex-col gap-2 md:gap-3 flex-1">
      {lineMachines.map(m => (
        <button key={m.id} onClick={() => handleMachineClick(m)} className={...}>
          M{m.displayNumber || m.id}
        </button>
      ))}
    </div>
  );
});
```

### Pattern 4: Machine Grid Cell Colors

Follow the existing color scheme pattern but adapt for carton status:

| Existing (PowderDensity) | Carton Waste Equivalent |
|---|---|---|
| Green: density in range | Green: checked at least once this shift |
| Gray: density out of range | Gray: not yet checked this shift |
| — | Red: waste % exceeds target |

### Pattern 5: Charts (Report Page)

Follow `src/pages/Reports.jsx` for Chart.js patterns:

```javascript
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const chartData = {
  labels: [...],
  datasets: [{
    label: 'Waste %',
    data: [...],
    backgroundColor: 'rgba(0, 188, 212, 0.5)',
    borderColor: '#00BCD4',
    borderWidth: 2,
    fill: false,
  }]
};

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#ccc' } },
    tooltip: { mode: 'index', intersect: false }
  },
  scales: {
    x: { ticks: { color: '#999' }, grid: { color: '#333' } },
    y: { ticks: { color: '#999' }, grid: { color: '#333' } }
  }
};

<Bar data={chartData} options={options} />
```

### Pattern 6: Offline Queue

Follow `src/services/qcOperations.js`:

```javascript
const QUEUE_KEY = 'starium_carton_offline_queue';

function queueOffline(data) {
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  queue.push({ ...data, localCreatedAt: new Date().toISOString() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return 'offline-queued';
}
```

### Pattern 7: Modal Form

Follow the modal pattern from existing pages (styled similarly to the machine check modals):

```jsx
{isModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/60" onClick={closeModal} />
    <div className="relative bg-dark-card border border-gray-700 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
      {/* modal content */}
    </div>
  </div>
)}
```

---

## Summary

This plan delivers:

1. **A robust data model** that eliminates arithmetic errors by recording incremental deltas
2. **Real-time data entry** with a familiar machine grid interface and validation
3. **Comprehensive reporting** with charts, per-machine breakdowns, and cross-shift comparisons
4. **Offline support** following the established queue-and-sync pattern
5. **Audit trail** through immutable, timestamped records
6. **Configurable thresholds** that managers can tune without code changes
7. **Alert integration** when waste exceeds acceptable levels

The system transforms a manual, error-prone clipboard process into a digital, real-time, data-driven waste reduction tool — giving managers the visibility they need to drive continuous improvement.
