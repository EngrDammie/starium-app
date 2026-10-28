// email-worker/src/resolve.test.js
//
// Recipient resolution, pinned. The tests exist for one reason: the caller
// must never be able to choose who receives mail. Every recipient in every
// case comes from the resolved documents — the request, the roster, the
// role holders — and events that do not fit the request's real state must
// resolve to nothing at all.

import { describe, it, expect } from 'vitest';
import { resolveEvent, currentStageId, emailsOfHolders } from './resolve.js';

const POLICY = {
  stages: [
    { id: 'supervisor', label: 'Supervisor', actionRole: 'leave_supervisor' },
    { id: 'hod', label: 'HOD / Subsidiary', actionRole: 'leave_hod' },
    { id: 'hr', label: 'Head of HR', actionRole: 'leave_hr_head' },
  ],
};

const REQUEST = {
  id: 'req123',
  status: 'pending_supervisor',
  employeeId: 'emp1',
  employeeName: 'Halima Danjuma',
  contactEmail: 'halima@example.test',
  requestedDays: 4,
};

const EMPLOYEE = { id: 'emp1', email: 'roster-halima@example.test' };

const HOLDERS = [
  { email: 'emeka@example.test' },
  { email: 'standin@example.test' },
];

const ctx = (over = {}) => ({
  request: { ...REQUEST, ...(over.request || {}) },
  employee: over.employee !== undefined ? over.employee : EMPLOYEE,
  holders: over.holders !== undefined ? over.holders : HOLDERS,
  policy: POLICY,
  queueDoc: over.queueDoc !== undefined ? over.queueDoc : null,
});

describe('resolveEvent — who hears about what', () => {
  it('submitted goes to the first stage holders, resolved server-side', () => {
    const r = resolveEvent('submitted', ctx());
    expect(r.recipients).toEqual(['emeka@example.test', 'standin@example.test']);
    expect(r.stageLabel).toBe('Supervisor'); // so the email can name whose desk it is on
  });

  it('submitted resolves nothing once the request has moved on', () => {
    const r = resolveEvent('submitted', ctx({ request: { status: 'pending_hod' } }));
    expect(r).toBeNull();
  });

  it('stage_signed goes to the CURRENT stage holders, named by the label', () => {
    const r = resolveEvent('stage_signed', ctx({
      request: { status: 'pending_hod' },
      holders: [{ email: 'blessing@example.test' }],
    }));
    expect(r.recipients).toEqual(['blessing@example.test']);
    expect(r.stageLabel).toBe('HOD / Subsidiary');
  });

  it('approved goes to the employee, from the frozen contact first', () => {
    const r = resolveEvent('approved', ctx({ request: { status: 'approved' } }));
    expect(r.recipients).toEqual(['halima@example.test']);
  });

  it('falls back to the roster email when the request has no frozen contact', () => {
    const r = resolveEvent('approved', ctx({
      request: { status: 'approved', contactEmail: null },
    }));
    expect(r.recipients).toEqual(['roster-halima@example.test']);
  });

  it('rejected carries the written reason to the employee', () => {
    const r = resolveEvent('rejected', ctx({
      request: { status: 'rejected', rejectedReason: 'Cover too thin.' },
    }));
    expect(r.recipients).toEqual(['halima@example.test']);
    expect(r.reason).toBe('Cover too thin.');
  });

  it('lodged only fires for requests HR actually filed', () => {
    expect(resolveEvent('lodged', ctx({ request: { status: 'pending_supervisor', lodgedBy: 'hr@example.test' } }))).not.toBeNull();
    expect(resolveEvent('lodged', ctx())).toBeNull();
  });

  it('cancelled goes to the employee AND the stage holders it was sitting with', () => {
    const r = resolveEvent('cancelled', ctx({
      request: { status: 'cancelled', cancelledBy: 'hr@example.test', cancelledReason: 'Reversed.' },
    }));
    expect(r.recipients).toContain('halima@example.test');
    expect(r.recipients).toContain('emeka@example.test');
    expect(r.reason).toBe('Reversed.');
    expect(r.actorEmail).toBe('hr@example.test');
  });

  it('recalled goes to the employee with the reason and who recalled them', () => {
    const r = resolveEvent('recalled', ctx({
      request: { status: 'recalled', recallReason: 'Line 2 emergency.', recalledBy: 'hr@example.test' },
    }));
    expect(r.recipients).toEqual(['halima@example.test']);
    expect(r.reason).toBe('Line 2 emergency.');
    expect(r.actorEmail).toBe('hr@example.test');
  });

  it('REFUSES events that do not match the request state — a replay is not a send', () => {
    // 'approved' on a pending request: resolveEvent says no, whoever asks.
    expect(resolveEvent('approved', ctx())).toBeNull();
    expect(resolveEvent('rejected', ctx())).toBeNull();
    expect(resolveEvent('recalled', ctx())).toBeNull();
  });

  it('short-circuits when the queue document says the email already went', () => {
    const r = resolveEvent('submitted', ctx({ queueDoc: { status: 'sent' } }));
    expect(r.skipped).toBe('already-sent');
    expect(r.recipients).toBeUndefined();
  });

  it('sends nothing to nobody when there are no resolved addresses', () => {
    const r = resolveEvent('approved', ctx({
      request: { status: 'approved', contactEmail: null },
      employee: null,
    }));
    expect(r.recipients).toEqual([]);
  });
});

describe('currentStageId', () => {
  it('reads the stage from the status, through the policy', () => {
    expect(currentStageId({ status: 'pending_hod' }, POLICY)).toBe('hod');
    expect(currentStageId({ status: 'approved' }, POLICY)).toBeNull();
    expect(currentStageId({ status: 'pending_nonsense' }, POLICY)).toBeNull();
    expect(currentStageId(null, POLICY)).toBeNull();
  });
});

describe('emailsOfHolders', () => {
  it('keeps only real addresses', () => {
    expect(emailsOfHolders([{ email: 'a@x.test' }, { email: null }, {}, { email: 'b@x.test' }]))
      .toEqual(['a@x.test', 'b@x.test']);
    expect(emailsOfHolders(null)).toEqual([]);
  });
});
