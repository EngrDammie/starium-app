// scripts/live/04-cleanup-list.test.js
//
// LIVE SUITE — read-only. Produces the deletion list for the system owner:
// every leave_requests document created by the live test runs, which are all
// tagged LIVE-TEST in their handover note. Deletes are owner-only by design,
// so the suite cannot clean up after itself — this hands the owner the list.
//
//   npm run test:live

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { auth, db } from '../../src/config/firebase';

const PASSWORD = process.env.LIVE_TEST_PASSWORD || 'success123';
const HRM = process.env.LIVE_TEST_HR_MANAGER || 'segun.adeyinka@example.test';

const OUT = '/tmp/opencode/live-cleanup-list.json';

describe('live cleanup — the deletion list for the owner', () => {
  it('lists every LIVE-TEST document', async () => {
    const cred = await signInWithEmailAndPassword(auth, HRM, PASSWORD);
    try {
      const snap = await getDocs(query(collection(db, 'leave_requests'), orderBy('requestedAt', 'desc')));
      const tagged = snap.docs
        .map(d => ({ id: d.id, status: d.data().status, note: d.data().handoverNote, type: d.data().leaveTypeLabel || d.data().leaveType, days: d.data().requestedDays }))
        .filter(r => /LIVE-TEST/i.test(String(r.note || '')));
      fs.writeFileSync(OUT, JSON.stringify(tagged, null, 2));
      console.log(`[cleanup] ${tagged.length} LIVE-TEST documents found. List at ${OUT}`);
      for (const r of tagged) console.log(`[cleanup] leave_requests/${r.id}  status=${r.status}  days=${r.days}`);
      expect(tagged.length).toBeGreaterThan(0);
    } finally {
      await signOut(auth);
    }
  });
});
