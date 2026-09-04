# Starium App — Engineering Plan (Backup-Developer Handover + Code Quality)

> **Status:** Planning only. Nothing implemented yet.
> **Purpose:** A working document I (the AI assistant) will revisit later to execute. It consolidates every improvement recommended during our conversations so far, prioritized, with concrete steps.
> **Last updated:** 2026-09-04

---

## 1. Context & Why We're Doing This

The user (Damilare) wants a **backup developer** to be able to relieve him when he goes on leave — meaning the codebase must be safely maintainable by someone other than its sole author.

### Current state (verified against the code, not guessed)

- React 19 + Vite SPA, Firebase/Firestore, Tailwind, Chart.js, Three.js, react-router (HashRouter).
- Module-per-feature structure: Page → Service → Context → Firestore + per-module localStorage offline queue.
- **STRONG:** Documentation is excellent.
  - `README.md` (26KB) — features, security, modules, architecture.
  - `docs/CODEBASE_REFERENCE.md` (1,681 lines) — accurate, structured: tech stack, provider tree, routes, RBAC, every context's state, every service function + behavior, every page, every Firestore data model, **all business math**, key patterns, known gaps, a "Quick Reference: File Locations" table, offline queue table, and required Firestore indexes.
  - `.env` correctly gitignored. No leaked secrets.
  - Consistent naming, clean service files (e.g. `palletTransferOperations.js`).
- **WEAK (the gaps we'll fix):**
  1. **Zero automated tests** — no test files, no test framework, no `test` script in `package.json`.
  2. **`NetworkContext.jsx` duplication** — 10 near-identical `useEffect` sync blocks, 10 queue-count states, 10 sync-flags, and one giant 40-value context object (line 247). The classic "module registry refactor" opportunity.
  3. **`SystemConfig.jsx` = 1,216 lines** — a god-component (10 tabs in one file).
  4. **Low inline comment density** (~1% of ~13.7k lines) — mostly mitigated by the reference docs, but code body has almost no inline narration.
  5. **No `CONTRIBUTING.md` / onboarding doc** beyond the README/reference (the reference is great; a short day-1 onboarding cheat sheet still helps).
  6. Some large pages trending toward god-components (`QCSachetProductionChecks.jsx` 805, `CartonWasteReport.jsx` 645, `LaminateWasteReport.jsx` 648).

### Risk framing for the user (what I told them)

A good mid/senior React dev CAN understand & maintain this thanks to the docs, but:
- **No tests** = the only safety net is Damilare's memory. A stranger can't change the offline-sync or approval logic safely.
- **NetworkContext duplication** = the #1 confusion point for anyone touching offline sync.
- This is the difference between "maintainable-but-cautious" and "freely-maintainable."

---

## 2. Prioritized Work Backlog

Ordered by **impact on handover safety ÷ effort**. Do top-down.

### P0 — Highest impact, do FIRST

#### A. Introduce a test harness (Vitest)
- **Why:** The single biggest de-risker. Gives a backup dev a regression safety net.
- **Steps:**
  - Add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` as devDependencies.
  - Add `"test": "vitest run"` and `"test:watch": "vitest"` scripts.
  - Configure `vitest.config.js` (or add `test` block to `vite.config.js`): environment `jsdom`, setup file.
  - Create `src/test/setup.js` with jest-dom matchers.
- **What to test (prioritized):**
  1. **Pure business-logic functions** (highest ROI, easiest, no Firebase mocks):
     - `getShiftDateInfo` (shift boundary logic — incl. the 02:00 AM previous-day NIGHT case) in `qcOperations.js`.
     - All `computeOverallResult` / `computeCartonOverallResult` (bag & carton inspection).
     - `saveCartonRecord` validation rules (4 rules) + `wastePercent` formula + `used` formula.
     - `validateLaminateCheck` (3 rules) + `getSacWeight` + `computeTotalLaminateUsed` + `getLaminateWasteSummary`.
     - `getStringWeightStatus` (5-level mapping).
     - `getPalletTransferDocId`, `getCartonWasteDocId`, `getEmptySilosDocId`, etc. (doc ID formats).
  2. **Offline queue logic** — the heart of the app. Approach: refactor the queue read/parse/write into a small pure helper module (e.g. `src/services/queueStore.js`) with functions like `readQueue(key)`, `writeQueue(key, items)`, `pushToQueue(key, item)` that take/return plain data (no `localStorage` dependency), then unit-test THOSE. This de-duplicates AND makes testable.
  3. **Firestore writeBatch sync functions** — test with the official `@firebase/rules-unit-testing` OR mock the Firestore SDK granularly. (Lower priority; heavier setup. Do after the pure-logic layer is solid so the queue functions are covered independently.)
- **Note on approach:** Prefer extracting **pure functions** that don't touch Firebase or localStorage, and test those. Avoid building a heavy Firebase emulator harness unless needed for sync/approval integration tests.

#### B. Refactor `NetworkContext.jsx` into a module registry
- **Why:** Removes the #1 confusion point; directly supports testability; becomes a great interview story (already prepped in the LinkedIn optimizer — this makes the refactor real).
- **Goal:** One "MODULES" registry array (single source of truth) that drives:
  - route registration, nav entry + allowedRoles,
  - service file + sync function,
  - localStorage queue key,
  - and the auto-sync coordinator.
- **Steps:**
  1. Define a small module descriptor shape, e.g.:
     ```js
     {
       id: 'carton',
       queueKey: 'starium_carton_offline_queue',
       syncFn: syncCartonOfflineQueue,
     }
     ```
  2. Introduce a `useSyncQueues(modules, isOnline)` hook (or a config-driven loop in `NetworkContext`) that iterates the registry and runs one sync effect per module with shared state (`queueCounts`, `isSyncing` accessed via a map keyed by module id) instead of 10 bespoke blocks.
  3. Replace the 10 explicit `queueCount`/`isXSyncing` states with a single map state (e.g. `queueCounts[id]`, `syncing[id]`).
  4. Keep the context API **backwards-compatible** (preserve the same exposed names: `cartonQueueCount`, `setCartonQueueCount`, `isCartonSyncing`, etc.) so pages don't break. Can do this by deriving the flat names from the map.
  5. Run build + lint + (once added) tests to confirm no regression.
- **Risk:** Touches every page that reads queue counts via `useNetwork()`. Must preserve the exact exposed property names to avoid page breakage. Verify via `grep` of `useNetwork()` consumers after refactor.

### P1 — High value

#### C. Extract `SystemConfig.jsx` into per-tab components
- **Why:** 1,216-line god-component is hard to navigate/maintain.
- **Steps:**
  - Create `src/pages/SystemConfig/` directory.
  - Extract each of the 10 tabs into its own component (e.g. `MachinesTab.jsx`, `LinesTab.jsx`, `GramSpecsTab.jsx`, `RoleDefinitionsTab.jsx`, `GlobalSettingsTab.jsx`, `QCSettingsTab.jsx`, `ImportExportTab.jsx`, `CartonWasteTab.jsx`, `LaminateWasteTab.jsx`, `PalletTransferTab.jsx`).
  - Keep `SystemConfig.jsx` as a thin shell that renders the active tab + shared state/props.
  - No behavior change — pure structural split.
- **Risk:** Medium-large refactor; lots of shared local state. Do carefully, rely on lint + build + manual test of each tab. Tests (once added) for any extracted pure logic.

#### D. Add `CONTRIBUTING.md` (day-1 onboarding cheat sheet)
- **Why:** Cheap, high-value onboarding aid on top of the already-excellent reference docs.
- **Contents:**
  - How to run locally: `npm install`, `npm run dev`, copy `.env` (list required `VITE_` vars, no values), `npm run build`, `npm run lint`.
  - Recommended entry points: the "Quick Reference: File Locations" table in `docs/CODEBASE_REFERENCE.md`.
  - The rabbit holes / cross-module logic to read carefully: empty-silos→stopped-machines auto-stop/resolve, shift approval flows, offline sync coordinator, role config.
  - "How to add a new module" checklist (mirrors the architecture story).
  - Testing & lint expectations (once tests exist).

### P2 — Nice to have (do after P0/P1, or as time allows)

#### E. Reduce size of the largest pages
- `QCSachetProductionChecks.jsx` (805), `CartonWasteReport.jsx` (645), `LaminateWasteReport.jsx` (648).
- Extract report sub-components (summary cards, chart blocks, table sections) into reusable components.
- Lower priority than A–D; the users still work. These are quality-of-life maintainability gains.

#### F. Improve inline comments selectively
- Only where the cross-module reasoning is nuanced (e.g. the auto-stop integration, `startedAt` reset logic in `appendIssuesToMachine`, the logout-before-signout presence flow).
- Not a blanket "add comments everywhere" pass — the reference doc already carries the weight. Add sparse, high-value comments only.

#### G. (Deferred / optional) Integration tests with Firebase emulator
- Using `@firebase/rules-unit-testing` to test the offline sync `writeBatch` functions and approval flow end-to-end against the emulator.
- Heavier setup; only worth it once P0 pure-logic tests exist and if we want to lock down the Firestore rules too.
- Also consider a **rules unit test** that asserts each collection allows the documented write path (create by authenticated non-admin, delete only admin) — this would have caught the earlier Firestore rules bug automatically.

---

## 3. Verification / Definition of Done (for each item)

- **A (tests):** `npm run test` passes; coverage of all listed pure functions; at least the queueStore helper and business math functions covered; CI (if added) runs tests.
- **B (NetworkContext refactor):** Build passes; lint passes; the context API surface is unchanged (verify consumers); offline sync still works (manual test: go offline, queue each module's record, reconnect, confirm flush); tests (queueStore + sync) green.
- **C (SystemConfig split):** Build + lint pass; each of the 10 tabs still functions (manual smoke test).
- **D (CONTRIBUTING):** Added file, accurate, references the reference doc.
- **E / F / G:** As listed, with build/lint green.

---

## 4. How to Revisit / Resume This Work Later

When resuming, the flow is:
1. Re-read this file.
2. Start at **P0-A** (test harness + pure-function extraction), then **P0-B** (NetworkContext refactor). These two unlock both handover safety and the interview story.
3. Move to P1, then P2 as time permits.
4. For each item, follow the Verification section before considering it done.

**Suggested commit order (once implementing):**
1. Add test harness + first pure-function tests (green baseline).
2. Extract & test queueStore helper.
3. Refactor NetworkContext (keep API, verify consumers).
4. Split SystemConfig.
5. Add CONTRIBUTING.md.
6. (Optional) Reduce largest pages, selective comments, rules integration tests.

---

## 5. Open Questions for the User (things to confirm before/while implementing)

- Test library preference (Vitest recommended; confirm if they want Jest instead).
- Level of test coverage they want (pure-logic-only to start, vs. investing in Firebase emulator integration tests).
- Whether to add a CI step to run tests on push (GitHub Actions already exists for deploy).
- Priority/effort appetite: is handover safety worth the SystemConfig split and large-page extraction now, or keep those as lower priority?
- Whether they want the module-registry refactor done carefully to preserve the current exposed NetworkContext names (recommended) vs. a clean breaking refactor with page updates.

---

## 6. Reminders / Notes for the Resume Session

- The LinkedIn optimizer (`public/linkedin-optimizer.html`) already contains the interview-story framing for the module-registry refactor and the NetworkContext weakness. Making the refactor real now strengthens that story.
- The earlier **Firestore rules fix** (all collections added, deployed) is DONE and committed (`a95c1a1`). The `firestore.rules` file and `firebase.json` reference are in place.
- The **uncommitted** LinkedIn optimizer edits (Firebase + Supabase Q&A interview notes) are still pending — confirm whether to commit/push these when resuming (the user said "don't push yet").
- Never claim inventory/procurement modules exist — the docs and profile wording correctly describe the current module set only.
