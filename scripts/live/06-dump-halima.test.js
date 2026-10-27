// scripts/live/06-dump-halima.test.js
//
// LIVE SUITE — read-only diagnostic: Halima's full request history with
// statuses and dates, so a browser-suite failure caused by her REAL data
// (as opposed to LIVE-TEST data) can be told apart from an app bug.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../../src/config/firebase';

const PASSWORD = process.env.LIVE_TEST_PASSWORD || 'success123';
const EMP = process.env.LIVE_TEST_EMPLOYEE || 'halima.danjuma@example.test';
const OUT = '/tmp/opencode/halima-history.json';

const fmt = (v) => {
  if (!v) return '—';
  const d = v?.toDate ? v.toDate() : new Date(v);
  return isNaN(d) ? String(v) : d.toISOString().slice(0, 10);
};

describe('live — Halima\'s request history', () => {
  it('dumps every request with status and dates', async () => {
    const cred = await signInWithEmailAndPassword(auth, EMP, PASSWORD);
    try {
      const snap = await getDocs(query(collection(db, 'leave_requests'), where('employeeId', '==', 'SEED-ST-5002')));
      let docs = snap.docs.map(d => ({
        id: d.id, status: d.data().status, type: d.data().leaveType,
        from: fmt(d.data().leaveCommences), to: fmt(d.data().leaveEnds),
        days: d.data().requestedDays, consumed: d.data().daysConsumed ?? null,
        note: (d.data().handoverNote || '').slice(0, 40),
      }));
      if (docs.length === 0) {
        // The employee id may differ from the seeded guess; fall back to
        // listing by the linked record's own id via a full scan is not
        // possible unfiltered — so resolve the employee first.
        const empSnap = await getDocs(collection(db, 'employees'));
        const me = empSnap.docs.find(d => (d.data().linkedUserEmail || '').toLowerCase() === EMP.toLowerCase());
        if (me) {
          const rSnap = await getDocs(query(collection(db, 'leave_requests'), where('employeeId', '==', me.id)));
          docs = rSnap.docs.map(d => ({
            id: d.id, status: d.data().status, type: d.data().leaveType,
            from: fmt(d.data().leaveCommences), to: fmt(d.data().leaveEnds),
            days: d.data().requestedDays, consumed: d.data().daysConsumed ?? null,
            note: (d.data().handoverNote || '').slice(0, 40),
          }));
        }
      }
      fs.writeFileSync(OUT, JSON.stringify(docs, null, 2));
      expect(docs.length).toBeGreaterThan(0);
    } finally {
      await signOut(auth);
    }
  });
});
