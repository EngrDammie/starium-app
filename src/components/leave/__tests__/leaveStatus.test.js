// src/components/leave/__tests__/leaveStatus.test.js
//
// The status vocabulary shared by the employee's screen and the approvers'
// Decided tray. These helpers exist so the same request is never described
// two different ways, so the tests pin the wording and the colour rules —
// and the Timestamp unwrapping, which fails silently if it regresses.

import { describe, it, expect } from 'vitest';
import {
  isPending, leaveStatusLabel, leaveStatusStyle, decidedAt, outcomeNote,
} from '../leaveStatus';

const POLICY = {
  stages: [
    { id: 'supervisor', label: 'Supervisor' },
    { id: 'hod', label: 'HOD / Subsidiary' },
    { id: 'hr', label: 'Head of HR' },
  ],
};

describe('leaveStatusLabel', () => {
  it('derives pending labels from the LIVE policy, not a hard-coded list', () => {
    expect(leaveStatusLabel('pending_supervisor', POLICY)).toBe('Awaiting Supervisor');
    expect(leaveStatusLabel('pending_hod', POLICY)).toBe('Awaiting HOD / Subsidiary');
    expect(leaveStatusLabel('pending_hr', POLICY)).toBe('Awaiting Head of HR');
  });

  it('follows a renamed stage — HR may call the HOD something else', () => {
    const renamed = { stages: [{ id: 'hod', label: 'Head of Operations' }] };
    expect(leaveStatusLabel('pending_hod', renamed)).toBe('Awaiting Head of Operations');
  });

  it('falls back to the stage id when the policy is not loaded yet', () => {
    expect(leaveStatusLabel('pending_hod', null)).toBe('Awaiting hod');
  });

  it('names the terminal states the same way the employee sees them', () => {
    expect(leaveStatusLabel('approved', POLICY)).toBe('Approved');
    expect(leaveStatusLabel('rejected', POLICY)).toBe('Rejected');
    expect(leaveStatusLabel('cancelled', POLICY)).toBe('Cancelled');
  });

  it('never throws on a status it has not seen', () => {
    expect(leaveStatusLabel('something_new', POLICY)).toBe('something_new');
    expect(leaveStatusLabel('', POLICY)).toBe('—');
    expect(leaveStatusLabel(undefined, POLICY)).toBe('—');
  });
});

describe('leaveStatusStyle', () => {
  it('gives every pending state the same amber, including renamed stages', () => {
    for (const s of ['pending_supervisor', 'pending_hod', 'pending_hr', 'pending_anything']) {
      expect(leaveStatusStyle(s)).toContain('status-warning');
    }
  });

  it('matches the colour language the employee already knows', () => {
    expect(leaveStatusStyle('approved')).toContain('status-success');
    expect(leaveStatusStyle('rejected')).toContain('status-danger');
    expect(leaveStatusStyle('cancelled')).toContain('gray');
  });

  it('stays neutral for an unknown status rather than breaking a card', () => {
    expect(leaveStatusStyle('mystery')).toContain('border-[#333]');
    expect(leaveStatusStyle(null)).toContain('border-[#333]');
  });
});

describe('isPending', () => {
  it('recognises the pending prefix and nothing else', () => {
    expect(isPending('pending_hod')).toBe(true);
    expect(isPending('approved')).toBe(false);
    expect(isPending(undefined)).toBe(false);
  });
});

describe('decidedAt', () => {
  it('prefers the approval moment, then rejection, then cancellation', () => {
    const a = decidedAt({ fullyApprovedAt: new Date('2026-10-20'), rejectedAt: new Date('2026-10-21') });
    expect(a.getDate()).toBe(20);
    const r = decidedAt({ rejectedAt: new Date('2026-10-21') });
    expect(r.getDate()).toBe(21);
    const c = decidedAt({ cancelledAt: new Date('2026-10-22') });
    expect(c.getDate()).toBe(22);
  });

  it('UNWRAPS a Firestore Timestamp — new Date(timestamp) is Invalid and would blank the line', () => {
    const fakeTs = { toDate: () => new Date('2026-10-24T12:00:00') };
    const d = decidedAt({ fullyApprovedAt: fakeTs });
    expect(d).toBeInstanceOf(Date);
    expect(isNaN(d)).toBe(false);
    expect(d.getDate()).toBe(24);
  });

  it('returns null when nothing has been decided', () => {
    expect(decidedAt({ status: 'pending_hod' })).toBeNull();
    expect(decidedAt(null)).toBeNull();
    expect(decidedAt({ rejectedAt: 'not a date' })).toBeNull();
  });
});

describe('outcomeNote', () => {
  it('shows the rejection reason with who wrote it — the same text the employee reads', () => {
    const n = outcomeNote({ status: 'rejected', rejectedReason: 'Cover is too thin that week.', rejectedBy: 'Emeka Nwosu' });
    expect(n.tone).toBe('danger');
    expect(n.title).toContain('Emeka Nwosu');
    expect(n.body).toBe('Cover is too thin that week.');
  });

  it('says so plainly when a rejection carries no reason', () => {
    const n = outcomeNote({ status: 'rejected' });
    expect(n.tone).toBe('danger');
    expect(n.body).toMatch(/no reason/i);
  });

  it('explains a cancellation in terms of what it means for the balance', () => {
    const n = outcomeNote({ status: 'cancelled' });
    expect(n.tone).toBe('muted');
    expect(n.body).toMatch(/balance/i);
  });

  it('confirms an approval without inventing detail', () => {
    const n = outcomeNote({ status: 'approved' });
    expect(n.tone).toBe('good');
    expect(n.title).toMatch(/approved/i);
  });

  it('returns nothing for a request still in the chain', () => {
    expect(outcomeNote({ status: 'pending_hod' })).toBeNull();
    expect(outcomeNote(null)).toBeNull();
  });
});
