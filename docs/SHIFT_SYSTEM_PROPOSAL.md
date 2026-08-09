# Shift System Proposal — Flexible Shift Engine for starium-app

> Status: Proposal (no code changes yet)
> Target: Make shift handling flexible and versatile enough to compute shifts for any employee, any group, and the app itself.

---

## 1. Background & Current State

The app currently treats a "shift" as a **time-of-day grouping key**, not a schedule:

- `getShiftDateInfo(config)` in `src/services/qcOperations.js:7` (and duplicated in `qcStringWeightOperations.js`) derives `DAY`/`NIGHT` from the **current wall-clock hour**:
  - hour in `[dayShiftStart, nightShiftStart)` → `DAY`, date = today
  - hour `>= nightShiftStart` → `NIGHT`, date = today
  - hour `< dayShiftStart` (e.g. 02:00) → `NIGHT`, date = **yesterday**
- Boundaries come from `config/settings`: `dayShiftStart: 7`, `nightShiftStart: 19` (`src/context/ConfigContext.jsx:11`).
- Shift + date form Firestore doc IDs like `level9_DAY_2026-08-09` in the `shift_approvals` collection. Production/QC records (qc_tests, carton_records, laminate_records, pallet_transfers, empty_silos, etc.) link to a shift via `approvalDocId`.
- Reports (`Reports.jsx`, `CartonWasteReport.jsx`, `LaminateWasteReport.jsx`, `QCSachetReport.jsx`, `PalletTransferReport.jsx`, `MachineDowntimeLog.jsx`) rebuild the same doc IDs and/or recompute shift time-ranges from config hours.
- **There is no scheduling/rota/pattern/attendance anywhere.** No employee rota, no days-on/off, no rotation.

### Reference model worth borrowing

`docs/reproduce-app-prompt.md` describes a **voucher tracker** whose core is a flexible "rulebook" schedule:

- **Shift segments**: an array of `{ startDate, pattern }` where `pattern` is a repeating list of entries (`M`/`N`/`OFF`), each with a `work` flag.
- **Latest-segment-wins**: the newest segment whose `startDate <= target date` determines the shift for any given date.
- **Backward wrap**: dates before the first segment's start date wrap the pattern backwards, so history is still labelled.
- **Mid-period changes**: switching patterns is just adding a new segment — history is never rewritten.
- **OFF can't be marked missed; streaks skip OFF and break at the first missed day.**

That "rulebook" model is the flexible foundation to generalize.

---

## 2. Goals

1. A **generic shift engine** that answers one question for any date and any *subject*:
   **"What shift/state applies to this subject on this date?"**
2. Support arbitrary **subjects**: the app-wide default, individual employees, groups/teams, production lines/departments, machines.
3. Support arbitrary **labels + work/off semantics** (e.g. `DAY`/`NIGHT`/`OFF`, or `M`/`N`/`OFF`, or custom team letters).
4. Preserve the current clock-based behavior as the **default fallback** when no schedule exists, so nothing breaks.
5. Keep Firestore as the source of truth (consistent with the rest of the app), seeded with the existing config semantics.

---

## 3. Core Data Model

### 3.1 Shift entry (a single step in a repeating pattern)

```js
{
  label: 'NIGHT',        // any short string: 'DAY', 'NIGHT', 'M', 'A', ...
  work: true,            // true = working, false = off/holiday/rest day
}
```

### 3.2 Pattern

```js
['DAY', 'NIGHT', 'OFF']               // shorthand form
// or explicit entries:
[{ label: 'DAY', work: true }, { label: 'NIGHT', work: true }, { label: 'OFF', work: false }]
```

A pattern is a **repeating cycle**. Length is arbitrary (1, 2, 3, 6, 14, 28 …). Examples: `2-2-2` rotation = `['DAY','DAY','NIGHT','NIGHT','OFF','OFF']`; weekly fixed = `['DAY','DAY','DAY','DAY','DAY','OFF','OFF']`.

### 3.3 Segment (rulebook entry)

```js
{
  id: 'seg_xxx',           // auto-generated
  startDate: '2026-08-20', // YYYY-MM-DD; the first day this pattern takes effect
  pattern: [...],          // repeating cycle (labels)
}
```

### 3.4 Schedule (the rulebook for one subject)

```js
{
  subjectType: 'employee',      // 'app' | 'employee' | 'group' | 'line' | ...
  subjectId: 'abc123',          // Firestore uid, group id, line id, or 'default'
  name: 'Rafa B.',              // display label (optional)
  segments: [seg1, seg2, ...],  // sorted by startDate ascending
  updatedAt: Timestamp,
  updatedBy: 'uid' | null,
}
```

**Evaluation rule (latest-segment-wins):**

```
getApplicableSegment(schedule, targetDate):
  segments sorted by startDate
  the last segment where startDate <= targetDate
  if none → the FIRST segment still applies (backward wrap; days before startDate
            keep the pattern by wrapping backward, same as the voucher tracker)
```

**Evaluating a date against a segment:**

```
index = floor(diffInDays(startDate, targetDate)) mod pattern.length
index in JS: ((diff % len) + len) % len   // handles negative diffs (before startDate)
return pattern[index]
```

---

## 4. Shift Engine API (pure functions, no I/O)

New module: `src/services/shiftEngine.js` (or `src/utils/shift.js`).

```js
// 1. Resolve the shift entry for a target date given a schedule.
//    Returns { label, work, segment, index } or null if no schedule.
function getShiftEntry(schedule, targetDateStr)

// 2. Resolve entry + which schedule applied, with clock fallback.
//    Used by pages that need a single current shift.
//    Returns { label, work, isScheduled, fallbackUsed }
function getShiftForSubject(schedules, subjectKey, targetDateStr, config)

// 3. Precompute a date range (calendar/report grid).
//    Returns [{ date, label, work, ... }]
function buildShiftGrid(schedule, startDateStr, days)

// 4. Clock fallback (moved out of qcOperations so it is shared & testable).
//    Keeps the exact current behavior: DAY / NIGHT with dayShiftStart/nightShiftStart
//    and the "before dayShiftStart belongs to yesterday's NIGHT" rule.
function getClockShiftDateInfo(config, now = new Date())

// 5. Validation helpers for the admin UI.
function validatePattern(entries)     // non-empty, consistent shape
function validateSegmentStart(segments, candidateStart)  // no start before previous?
```

**Subject key convention:** `subjectType:subjectId` string, e.g. `app:default`, `employee:abc123`, `group:packagingA`, `line:1A`. This keeps lookups uniform.

---

## 5. Storage Design (Firestore)

New collection: **`shift_schedules`**

```
shift_schedules/{subjectType}_{subjectId}
```

or a flat keyed doc id like `app_default`. Document shape = the Schedule in §3.4.

- **App default**: `shift_schedules/app_default`. If absent, the engine falls back to the existing clock logic (`dayShiftStart`/`nightShiftStart` from `config/settings`).
- **Employee**: `shift_schedules/employee_{uid}` — one per user.
- **Groups / lines / machines**: same pattern, added later.
- Reading: read the doc(s) needed by the page. To avoid a read per page render, a `ShiftScheduleContext` (mirroring `ConfigContext`) subscribes via `onSnapshot` to the relevant schedule(s) — app default always, plus the current user's schedule when authenticated.

**Why Firestore, not localStorage:** consistent with every other setting in the app (config lives in Firestore), works across devices, and the same engine can later drive reports and admin tooling. (A localStorage-only variant is possible for a standalone/single-user deployment but is not the default here.)

---

## 6. Fallback & Compatibility

- **No schedule at all** → current clock-based behavior, byte-for-byte identical to today (`getClockShiftDateInfo`).
- **Schedule exists but has no segment covering the target date** (future date beyond last segment, or date before first segment) → still resolved by the rulebook (wrap backward / extend the last pattern forward). This is the tracker behavior and is a feature, not an error.
- **Doc IDs / `shift_approvals`** stay the same. An employee with an `OFF` (non-work) day simply has no shift approval created for that date — `getOrCreate*` is not called, or the UI shows the off-day state. This decision is detailed in §8.

---

## 7. Proposed Files / Changes

### New
- `src/services/shiftEngine.js` — pure engine + clock fallback (moved from `qcOperations.js`).
- `src/context/ShiftScheduleContext.jsx` — subscribes to schedules (app default + current user) and exposes them.
- `src/pages/ShiftScheduleAdmin.jsx` — admin page (rota manager):
  - Pick a subject (app default, or select an employee).
  - Build/edit a pattern via presets (2-2-2, 3-on/4-off, M/N/OFF, DAY/NIGHT/OFF, custom) — reuse the chip/preset UX from the voucher tracker.
  - Choose a start date, see a live N-day preview.
  - Save = upsert a segment into `shift_schedules/{key}`. A start date equal to an existing segment replaces it; earlier-than-anchor rejected with a `TOO EARLY` style warning.
- Optional: `docs/CODEBASE_REFERENCE.md` update documenting the new collection + engine.

### Modified (phase 2, only after engine + admin ship)
- `src/services/qcOperations.js` / `qcStringWeightOperations.js` — remove duplicated `getShiftDateInfo`, use `shiftEngine.getClockShiftDateInfo` or scheduled resolution.
- Pages that display "X Shift" (Dashboard, Level9Exec, BotExec, PowderDensity, CartonWaste, LaminateWaste, PalletTransfer, EmptySilos, QCSachetProductionChecks, reports) — resolve via the engine and handle the `OFF`/no-work case.

---

## 8. Open Decisions (need your call)

1. **When an employee is `OFF`, what happens to data entry for that subject?**
   - Option A: Block/disable creation of shift approval docs on OFF days (strict).
   - Option B: Allow a manual override (still record, just labelled).
   - Option C: Treat `OFF` as purely informational for now (UI badge only; recording continues).

2. **Should the app-wide default schedule exist at all in v1, or is clock-fallback enough until per-subject schedules are added?**
   - Recommended: ship the engine + admin UI + **app-default schedule support** first; wire employees/groups after.

3. **Do we migrate existing pages to the engine in this iteration, or keep clock behavior for all current pages and only use schedules where explicitly configured?**
   - Recommended: keep pages on clock fallback; the engine only changes behavior once a schedule is configured for that subject.

4. **Label vocabulary:** keep `DAY`/`NIGHT`/`OFF` (integrates cleanly with existing doc IDs and reports) vs. `M`/`N`/`OFF` (matches the voucher tracker verbatim). Engine supports both; this just sets the admin UI defaults.

5. **Subject types in v1:** app default + employees only, or also groups/teams and lines/machines?

---

## 9. Suggested Implementation Order (when approved)

1. **Phase 0 — Engine:** `src/services/shiftEngine.js` (pure functions + clock fallback) + unit tests against the voucher tracker's rulebook examples (backward wrap, segment switch, mid-period change, OFF handling).
2. **Phase 1 — Context:** `ShiftScheduleContext` reading `shift_schedules/app_default` (and current user) with `onSnapshot`.
3. **Phase 2 — Admin UI:** `ShiftScheduleAdmin.jsx` + route + nav entry; pattern presets, start date, live preview, save/replace validation, list existing segments.
4. **Phase 3 — Optional migration:** refactor duplicated `getShiftDateInfo` out of service files; update pages/reports to consult the engine and surface OFF state.
5. **Phase 4 — Docs:** update `CODEBASE_REFERENCE.md` with the new collection shape and engine API.

No code has been written yet. This document is the proposal awaiting your review.
