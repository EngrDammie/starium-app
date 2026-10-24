// scripts/live/01-smoke.test.js
//
// LIVE SUITE — signs in to the real project. Read-only: this file creates
// and writes nothing. It exists to prove three things before any write-path
// test runs:
//
//   1. The five test accounts authenticate against the real Firebase Auth.
//   2. Each account's user_roles document says what we expect it to say —
//      the chain test depends on these roles being exactly right.
//   3. The leave policy is present in the live config.
//
// Credentials are read from the environment (LIVE_TEST_*), never written into
// the repo. The shared password arrives as LIVE_TEST_PASSWORD so it appears
// exactly once in each command, and nowhere in git.
//
//   LIVE_TEST_EMPLOYEE=... LIVE_TEST_SUPERVISOR=... \
//   LIVE_TEST_HOD=... LIVE_TEST_HR_HEAD=... LIVE_TEST_HR_MANAGER=... \
//   LIVE_TEST_PASSWORD=... npm run test:live

import { describe, it, expect, afterAll } from 'vitest';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../src/config/firebase';

const ACCOUNTS = {
  employee: process.env.LIVE_TEST_EMPLOYEE,
  supervisor: process.env.LIVE_TEST_SUPERVISOR,
  hod: process.env.LIVE_TEST_HOD,
  hrHead: process.env.LIVE_TEST_HR_HEAD,
  hrManager: process.env.LIVE_TEST_HR_MANAGER,
};
const PASSWORD = process.env.LIVE_TEST_PASSWORD;

// Signing in as one user then another on the same Auth instance: sign out
// between so each read is truly that user's session.
async function asUser(email, fn) {
  const cred = await signInWithEmailAndPassword(auth, email, PASSWORD);
  try {
    return await fn(cred.user);
  } finally {
    await signOut(auth);
  }
}

describe('live smoke — the five test accounts', () => {
  it('has every credential provided via the environment', () => {
    for (const [name, value] of Object.entries(ACCOUNTS)) {
      expect(value, `LIVE_TEST_${name.toUpperCase()} is not set`).toBeTruthy();
    }
    expect(PASSWORD, 'LIVE_TEST_PASSWORD is not set').toBeTruthy();
  });

  it('signs in as the plain employee and reports their roles', async () => {
    const roles = await asUser(ACCOUNTS.employee, async (user) => {
      const snap = await getDoc(doc(db, 'user_roles', user.uid));
      return snap.exists() ? snap.data() : null;
    });
    expect(roles, 'user_roles document missing for the employee account').not.toBeNull();
    console.log('[smoke] employee:', JSON.stringify({
      systemRole: roles.systemRole,
      departmentRoles: roles.departmentRoles,
      actionRoles: roles.actionRoles,
    }));
    expect(roles.systemRole).toBe('standard');
  });

  it('signs in as each approver and confirms the expected approval power', async () => {
    const expected = {
      supervisor: 'leave_supervisor',
      hod: 'leave_hod',
      hrHead: 'leave_hr_head',
    };
    for (const [name, expectedRole] of Object.entries(expected)) {
      const roles = await asUser(ACCOUNTS[name], async (user) => {
        const snap = await getDoc(doc(db, 'user_roles', user.uid));
        return snap.exists() ? snap.data() : null;
      });
      expect(roles, `user_roles document missing for ${name}`).not.toBeNull();
      const held = roles.actionRoles || roles.approvalRoles || [];
      console.log(`[smoke] ${name}:`, JSON.stringify({
        systemRole: roles.systemRole,
        departmentRoles: roles.departmentRoles,
        actionRoles: roles.actionRoles,
      }));
      expect(held, `${name} should hold ${expectedRole}; found [${held}]`).toContain(expectedRole);
    }
  });

  it('signs in as the HR manager and confirms HR department access', async () => {
    const roles = await asUser(ACCOUNTS.hrManager, async (user) => {
      const snap = await getDoc(doc(db, 'user_roles', user.uid));
      return snap.exists() ? snap.data() : null;
    });
    expect(roles, 'user_roles document missing for hrManager').not.toBeNull();
    console.log('[smoke] hrManager:', JSON.stringify({
      systemRole: roles.systemRole,
      departmentRoles: roles.departmentRoles,
      actionRoles: roles.actionRoles,
    }));
    expect(roles.departmentRoles || []).toContain('hr_manager');
  });

  it('reads the live leave policy as a signed-in user', async () => {
    const policy = await asUser(ACCOUNTS.hrManager, async () => {
      const snap = await getDoc(doc(db, 'config', 'settings'));
      return snap.exists() ? snap.data().leavePolicy : null;
    });
    expect(policy, 'leave policy missing from config/settings').not.toBeNull();
    console.log('[smoke] live policy:', JSON.stringify({
      annualEntitlementDays: policy.annualEntitlementDays,
      nonWorkingDays: policy.nonWorkingDays,
      stages: (policy.stages || []).map(s => s.id),
      requireRejectionReason: policy.requireRejectionReason,
    }));
    expect(policy.annualEntitlementDays).toBeGreaterThan(0);
    expect((policy.stages || []).length).toBe(3);
  });
});
