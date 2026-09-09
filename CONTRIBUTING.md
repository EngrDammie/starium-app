# Contributing to Starium Rafa ERP

> Day-1 onboarding cheat sheet for a backup developer. For the full reference
> (every service function, page, collection shape, and business rule), read
> `docs/CODEBASE_REFERENCE.md` — it is accurate and comprehensive.

## 1. Run it locally

```bash
npm install
npm run dev      # local dev server
npm run build    # production build (must pass before any PR)
npm run lint     # eslint (fix new warnings you introduce)
npm run test     # vitest run — full unit suite, must stay green
npm run test:watch  # watch mode while developing
```

### Environment (`.env`, never commit — it is gitignored)

All values come from the Firebase console (`starium-rafa-app`):

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

## 2. Where things live (entry points)

| Need | File |
|---|---|
| Add a new page | `src/pages/` → route in `src/App.jsx` → entry in `src/config/navigation.js` (`MENU_CONFIG`) → friendly name in `PAGE_LABELS` (`src/pages/ActiveUsers.jsx`) |
| Change permissions | `src/config/navigation.js` (`allowedRoles`), `src/context/AuthContext.jsx` (role logic) |
| Add a new config field | `src/context/ConfigContext.jsx` (`DEFAULT_CONFIG`) + UI in `src/pages/SystemConfig/` (one component per tab) |
| Change density math | `src/context/ConfigContext.jsx` (divisors), `src/pages/PowderDensity.jsx` (calculation) |
| Modify offline behavior | `src/config/offlineModules.js` (registry — start here), `src/context/NetworkContext.jsx` (coordinator), `src/services/queueStore.js` (storage mechanics) |
| Add a new alert type | `src/context/AlertContext.jsx`, `src/components/AlertBanner.jsx` |
| Change machine grid layout | `src/components/MachineGrid.jsx`, config `machineGridColumns` |
| Change Firebase config | `src/config/firebase.js`, `.env` |
| Firestore rules | `firestore.rules` (deployed via `firebase deploy --only firestore:rules`). The static test `src/test/firestoreRules.test.js` asserts every writable collection has an explicit block — keep it green. |

## 3. Rabbit holes — read carefully before touching

1. **Empty-silos ↔ stopped-machines coupling** (`src/services/emptySiloOperations.js`):
   marking a machine empty auto-creates/gets a "No Powder" issue and reports
   the machine stopped; refilling auto-resolves it and broadcasts a reminder
   to START the machine. Touch one side, test the other.
2. **Shift approval flows** (`shift_approvals` collection, `mode_{SHIFT}_{DATE}`
   doc IDs): QC, carton, laminate, pallet, and string-weight each own a mode.
   Approver keys are camelCase (`buggySupervisor`, `plcOperator`, …).
3. **Offline sync coordinator** (`src/config/offlineModules.js` +
   `src/context/NetworkContext.jsx`): one registry descriptor per module
   (queue key + sync fn + legacy names). After each flush the true remaining
   queue length is re-read — partial failures stay visible by design.
4. **Role config is runtime data** (`config/settings` → `departmentRoles` /
   `actionRoles`), editable in System Config → Roles tab. `super_admin`
   bypasses everything; admin tabs use `allowedRoles: []`.
5. **Ghost Admin mode**: `config/auth_settings.authEnabled === false`
   bypasses login entirely (emergency/kiosk). Never enable in production
   without understanding the consequences.

## 4. How to add a new ERP module (checklist)

1. Create `src/services/<module>Operations.js` following the 4-function recipe:
   `get<Module>DocId` → `save<Module>` (online/offline branch) →
   `subscribeTo…` (`onSnapshot`) → `sync<Module>OfflineQueue` (`writeBatch`).
2. Add the localStorage queue key + sync fn as one descriptor in
   `src/config/offlineModules.js` (queue counting + auto-sync pick it up).
3. Create `src/pages/<Module>.jsx` (+ report page if needed) using the same
   four hooks every page uses: `useConfig`, `useAuth`, `useNetwork`, `useAlerts`.
4. Register the route in `src/App.jsx` wrapped in `<ProtectedRoute>`.
5. Add the menu entry with `allowedRoles` in `src/config/navigation.js`.
6. Add explicit `firestore.rules` blocks (create/update for authenticated,
   delete for admin) — then extend `src/test/firestoreRules.test.js`.
7. Add the queue key + collection to the offline-queue table in
   `docs/CODEBASE_REFERENCE.md`.
8. Run `npm run test`, `npm run lint`, `npm run build` — all green.

## 5. Testing & lint expectations

- New pure logic (validation, math, doc IDs, grouping) **must** ship with a
  vitest file under `src/**/__tests__/`. Mock `../../config/firebase` and
  `firebase/firestore` like the existing tests do.
- Storage-touching logic goes through `src/services/queueStore.js` with an
  injectable `storage` param so tests use `createMemoryStorage()`.
- `npm run test` must stay green. `npm run build` must pass.
- Don't introduce new eslint errors (the repo has pre-existing ones; leave
  them or fix opportunistically, but never add).
