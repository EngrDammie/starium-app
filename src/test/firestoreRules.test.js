import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Static guard for firestore.rules.
//
// ─── HISTORY ────────────────────────────────────────────────────────────────
// This file began as the regression test for a real outage: pallet_transfers,
// empty_silos, carton_records, laminate_records and the QC check collections
// fell through to the admin-only catch-all, so staff writes failed SILENTLY —
// the app queued them offline and looked like it was working while nothing
// reached the database.
//
// On 20 Oct 2026 (task 7.1) it grew a second job: pinning the security
// posture of the personal-data collections. employees, leave_requests and
// user_roles used to be readable by anyone on the internet holding the API
// key — verified live with an unauthenticated REST read that returned HTTP
// 200 for a full roster of names, SAP numbers and phone numbers. Reads now
// require a signed-in user, and writes are restricted server-side to the
// people the UI already claimed were the only ones allowed.
//
// WHY STATIC: these tests read the rules as text. They cannot prove the
// expressions evaluate correctly (that needs the emulator), but they can
// prove the GUARDS EXIST — which is exactly what failed before: not a wrong
// guard, but no guard at all.

const EXPECTED_COLLECTIONS = [
  'alerts',
  'qc_string_weight_checks',
  'qc_bag_inspection_checks',
  'qc_carton_inspection_checks',
  'qc_tests',
  'carton_records',
  'laminate_records',
  'empty_silos',
  'pallet_transfers',
  'stopped_machines',
  'machine_issues',
  'shift_approvals',
  'employees',
  'leave_requests',
];

// Factory data: every signed-in user may write, per the offline-first
// design. These collections predate the leave module and are outside the
// scope of its hardening — the open reads on them are tracked in the backlog.
const FACTORY_COLLECTIONS = EXPECTED_COLLECTIONS.filter(
  (c) => c !== 'employees' && c !== 'leave_requests',
);

// Personal data: reads require a signed-in user, writes are restricted to
// owner / HR / approver / system owner.
const PERSONAL_DATA = ['employees', 'leave_requests', 'user_roles'];

function loadRules() {
  const p = path.resolve(__dirname, '../../firestore.rules');
  return fs.readFileSync(p, 'utf8');
}

function blockFor(rules, collection) {
  const start = rules.indexOf(`match /${collection}/`);
  expect(start, `missing explicit rules block for /${collection}/`).toBeGreaterThan(-1);
  // Slice to the start of the NEXT match block so a rule that exists on some
  // other collection cannot satisfy an assertion about this one.
  const rest = rules.slice(start + 1);
  const next = rest.search(/match \//);
  return next === -1 ? rules.slice(start) : rules.slice(start, start + 1 + next);
}

describe('firestore.rules collection coverage', () => {
  it('has an explicit match block for every writable app collection', () => {
    const rules = loadRules();
    for (const collection of EXPECTED_COLLECTIONS) {
      expect(rules.includes(`match /${collection}/`), `missing block for /${collection}/`).toBe(true);
    }
  });

  it('grants factory collections create/update to authenticated users via canWriteRecord()', () => {
    const rules = loadRules();
    for (const collection of FACTORY_COLLECTIONS) {
      const block = blockFor(rules, collection);
      expect(block.includes('allow create: if canWriteRecord()'), collection).toBe(true);
      expect(block.includes('allow update: if canWriteRecord()'), collection).toBe(true);
    }
  });

  it('restricts deletes to admins (or auth-disabled mode) on every collection', () => {
    const rules = loadRules();
    for (const collection of EXPECTED_COLLECTIONS) {
      const block = blockFor(rules, collection);
      expect(block.includes('allow delete: if !isAuthEnabled() || isAdmin()'), collection).toBe(true);
    }
  });
});

describe('firestore.rules personal data (task 7.1)', () => {
  it('NEVER serves personal data to unauthenticated readers', () => {
    // THE SECURITY REGRESSION. `allow read: if true` on employees,
    // leave_requests or user_roles puts names, SAP numbers, phone numbers
    // and leave histories on the open internet. This is the one assertion in
    // this file that must never be relaxed for a convenience: if a screen
    // needs the data before login resolves, the screen is wrong.
    const rules = loadRules();
    for (const collection of PERSONAL_DATA) {
      const block = blockFor(rules, collection);
      expect(block, collection).not.toMatch(/allow read:\s*if\s*true/);
      expect(block.includes('allow read: if canReadRecord()'), collection).toBe(true);
    }
  });

  it('keeps config/auth_settings public — the login screen needs it before any user is signed in', () => {
    const rules = loadRules();
    const start = rules.indexOf('match /config/auth_settings');
    expect(rules.slice(start, start + 400)).toContain('allow read: if true');
  });

  it('routes leave request writes through the server-side permission guard', () => {
    const rules = loadRules();
    const block = blockFor(rules, 'leave_requests');
    expect(block.includes('allow create: if mayWriteLeaveRequestFor(request.resource.data.employeeId)')).toBe(true);
    expect(block.includes('allow update: if mayWriteLeaveRequestFor(resource.data.employeeId)')).toBe(true);
  });

  it('lets HR manage employee records but only lets the owner touch their own', () => {
    const rules = loadRules();
    const block = blockFor(rules, 'employees');
    expect(block.includes('(isAdmin() || isHrDept())')).toBe(true);
    expect(block.includes('ownsEmployeeRecord(employeeId)')).toBe(true);
  });

  it('forbids HR from ever writing a super_admin account', () => {
    // The task 1.6 privilege-escalation fix, enforced in the database: HR
    // may grant department and approval roles, but the moment the FUTURE
    // state of a user_roles document says super_admin, only the system
    // owner may have written it.
    const rules = loadRules();
    const block = blockFor(rules, 'user_roles');
    expect(block.includes("!= 'super_admin'")).toBe(true);
  });

  it('reads isAdmin() from systemRole (the field the app writes), with the legacy role fallback', () => {
    // The old isAdmin() checked `data.role` — a field the app stopped
    // writing, so admin rights depended on which write path created the
    // account. Both spellings must be present, guarded by `in`, or newer
    // owners silently lose admin rights on deploy.
    const rules = loadRules();
    const adminBlock = rules.slice(
      rules.indexOf('function isAdminDoc()'),
      rules.indexOf('function isHrDept()'),
    );
    expect(adminBlock).toContain("d.systemRole == 'super_admin'");
    expect(adminBlock).toContain("'systemRole' in d");
    expect(adminBlock).toContain("d.role == 'admin'");
  });

  it('guards every optional-field access with `in` in the permission helpers', () => {
    // A missing field is an ERROR in rules, not a false, and an error denies
    // the request. An unguarded field access on an old document without that
    // field would lock its owner out of their own leave request.
    const rules = loadRules();
    for (const helper of ['function isAdminDoc()', 'function hrDeptDoc()', 'function leaveApproverDoc()', 'function ownsEmployeeDoc()']) {
      const body = rules.slice(rules.indexOf(helper));
      const bodyEnd = body.indexOf('\n    }');
      const fn = body.slice(0, bodyEnd);
      // Every field these helpers compare or call hasAny on must first appear
      // on the left of an `in`. Spot-check the load-bearing ones:
      for (const field of ['systemRole', 'departmentRoles', 'actionRoles', 'linkedUserUid']) {
        if (fn.includes(`.${field}`)) {
          expect(fn.includes(`'${field}' in `), `${helper} reads .${field} without an in-guard`).toBe(true);
        }
      }
    }
  });
});
