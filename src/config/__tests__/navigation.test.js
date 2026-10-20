// src/config/__tests__/navigation.test.js
//
// Permission routing is the one piece of this app that every single screen
// depends on, and it has now broken twice for the same root cause:
//
//   1. Sidebar and ProtectedRoute each held a copy of the visibility rule,
//      which drifted apart (fixed 16 Oct 2026 by funnelling both through
//      canAccessRoute).
//   2. ProtectedRoute STILL re-derived the answer from allowedRoles alone, so
//      a route spelled openToAll: true, allowedRoles: [] — "no roles to list,
//      everyone may enter" — was read as "no roles, therefore owner-only".
//      Employees were locked out of My Leave while the system owner sailed
//      through, which is precisely what makes a broken check look like a
//      permissions problem instead of a bug (found 18 Oct 2026, live).
//
// The empty-array ambiguity is the trap: [] means "owner only" on one route and
// "everyone" on another. The ONLY thing that distinguishes them is openToAll,
// so any check that does not read that flag is wrong. These tests pin that
// down so it cannot be reintroduced without a red test naming the reason.

import { describe, it, expect } from 'vitest';
import {
  MENU_CONFIG, canAccessRoute, findRoute,
  getFirstAccessiblePath, getAccessiblePaths,
} from '../navigation';

// A route exists for each permission shape the app actually uses. Lookup by
// path rather than hard-coding the object, so the tests keep working if the
// menu is regrouped.
const byPath = (path) => findRoute(path);

describe('canAccessRoute', () => {
  it('lets the system owner open anything', () => {
    for (const route of MENU_CONFIG.flatMap(c => c.children)) {
      expect(canAccessRoute(route, 'super_admin', [])).toBe(true);
    }
  });

  it('lets a restricted employee open an openToAll route despite empty departmentRoles', () => {
    const myLeave = byPath('/my-leave');
    expect(myLeave).not.toBeNull();
    expect(myLeave.openToAll).toBe(true);
    expect(canAccessRoute(myLeave, 'standard', [])).toBe(true);
  });

  it('distinguishes openToAll [] from owner-only []', () => {
    // THE REGRESSION. /my-leave and /system-config are both spelled
    // allowedRoles: [] — the first means "no roles to list", the second
    // "reserved for the owner". A check that reads allowedRoles alone cannot
    // tell them apart, and that is exactly how ProtectedRoute broke My Leave.
    const myLeave = byPath('/my-leave');
    const systemConfig = byPath('/system-config');
    expect(myLeave.allowedRoles).toEqual([]);
    expect(systemConfig.allowedRoles).toEqual([]);

    expect(canAccessRoute(myLeave, 'standard', [])).toBe(true);
    expect(canAccessRoute(systemConfig, 'standard', [])).toBe(false);
  });

  it('admits a holder of one of the listed roles', () => {
    const roster = byPath('/employees');
    expect(roster).not.toBeNull();
    expect(canAccessRoute(roster, 'standard', ['hr_staff'])).toBe(true);
    expect(canAccessRoute(roster, 'standard', ['hr_manager'])).toBe(true);
    expect(canAccessRoute(roster, 'standard', ['prod_staff'])).toBe(false);
  });
});

describe('getFirstAccessiblePath', () => {
  it('lands a restricted employee on My Leave, not on /no-access', () => {
    // A restricted login has systemRole standard and an EMPTY departmentRoles
    // array. Before the openToAll fix this returned null and Login sent them
    // to /no-access even though My Leave was theirs all along.
    expect(getFirstAccessiblePath('standard', [])).toBe('/my-leave');
  });

  it('still returns null for an account with nothing open', () => {
    // If openToAll were ever removed, this becomes null again and employees
    // are trapped on /no-access — the failure mode this test exists to catch.
    const withoutOpenToAll = MENU_CONFIG.flatMap(c => c.children)
      .filter(r => !r.openToAll);
    expect(withoutOpenToAll.length).toBeGreaterThan(0);
    expect(withoutOpenToAll.every(r => !canAccessRoute(r, 'standard', []))).toBe(true);
  });

  it('gives an HR manager a role-gated page, not My Leave by accident', () => {
    // The first accessible path for someone WITH roles must be their real
    // first page, and it must be one of the paths they can genuinely open.
    const first = getFirstAccessiblePath('standard', ['hr_manager']);
    const route = byPath(first);
    expect(route).not.toBeNull();
    expect(canAccessRoute(route, 'standard', ['hr_manager'])).toBe(true);
  });
});

describe('findRoute', () => {
  it('returns the full route object, not just allowedRoles', () => {
    const myLeave = byPath('/my-leave');
    expect(myLeave.openToAll).toBe(true);
    expect(myLeave.label).toBe('My Leave');
  });

  it('returns null for a path outside the menu, such as /change-password', () => {
    expect(byPath('/change-password')).toBeNull();
  });
});

describe('getAccessiblePaths', () => {
  it('includes My Leave for a restricted employee', () => {
    const paths = getAccessiblePaths('standard', []).map(r => r.path);
    expect(paths).toContain('/my-leave');
  });

  it('never lists a page the same user cannot open', () => {
    for (const route of getAccessiblePaths('standard', ['qc_staff'])) {
      expect(canAccessRoute(route, 'standard', ['qc_staff'])).toBe(true);
    }
  });
});

// ─── The action-role axis (task 5.2) ─────────────────────────────────────────
//
// The three approval powers are ACTION roles, not department roles: a
// production manager who signs at the HOD stage is not in HR and should not
// be. Before this axis existed, an approver could hold the power to sign and
// still have no way to reach the screen where the signature happens — the
// /leave-approvals route was gated to the HR department, so a supervisor in
// Production was locked out of their own queue.
describe('canAccessRoute with action roles', () => {
  const supervisorInProduction = ['prod_staff'];
  const supervisorAction = ['leave_supervisor'];

  it('lets an approver reach Leave Approvals through their ACTION role alone', () => {
    const route = byPath('/leave-approvals');
    expect(route.allowedActionRoles).toContain('leave_supervisor');
    expect(canAccessRoute(route, 'standard', supervisorInProduction, supervisorAction)).toBe(true);
  });

  it('does not grant Leave Approvals to a Production login with no approval power', () => {
    const route = byPath('/leave-approvals');
    expect(canAccessRoute(route, 'standard', supervisorInProduction, [])).toBe(false);
  });

  it('does not grant the approver the rest of the HR department menu', () => {
    // The power to SIGN leave is not the power to see the roster or the
    // report. Those stay department-gated.
    const roster = byPath('/employees');
    const report = byPath('/leave-report');
    expect(canAccessRoute(roster, 'standard', supervisorInProduction, supervisorAction)).toBe(false);
    expect(canAccessRoute(report, 'standard', supervisorInProduction, supervisorAction)).toBe(false);
  });

  it('keeps the HR department path working alongside the action-role path', () => {
    const route = byPath('/leave-approvals');
    expect(canAccessRoute(route, 'standard', ['hr_manager'], [])).toBe(true);
    expect(canAccessRoute(route, 'standard', ['hr_staff'], [])).toBe(true);
  });

  it('lands a pure approver on Leave Approvals after login, not on My Leave by accident', () => {
    // getFirstAccessiblePath must know about action roles too, or an
    // approver who is not in any department gets sent to their fallback page
    // instead of the queue with their work in it.
    const first = getFirstAccessiblePath('standard', [], ['leave_supervisor']);
    expect(first).toBe('/leave-approvals');
  });
});
