// email-worker/src/templates.test.js
//
// The seven emails, pinned. Two things matter more than phrasing:
//
//   1. EVERY event produces a message with a subject and a body.
//   2. NO email ever contains the leave PURPOSE. A compassionate-leave
//      reason can involve family bereavement; mailboxes are forwarded,
//      screenshotted and left open. Approvers read purposes in the app,
//      where the access rules govern them. One test asserts a purpose that
//      EXISTS on the request appears NOWHERE in ANY of the seven bodies.

import { describe, it, expect } from 'vitest';
import { buildMessage } from './templates.js';

const APP_URL = 'https://starium-app.dammieoptimus.workers.dev';

const REQUEST = {
  id: 'test123',
  employeeName: 'Halima Danjuma',
  leaveCommences: '2026-11-02',
  leaveEnds: '2026-11-06',
  resumptionDate: '2026-11-07',
  requestedDays: 4,
  status: 'pending_supervisor',
  purpose: 'LIVE-TEST SECRET PURPOSE — bereavement in the family',
  contactEmail: 'halima.danjuma@example.test',
  lodgedBy: null,
};

const EVENTS = ['submitted', 'stage_signed', 'approved', 'rejected', 'lodged', 'cancelled', 'recalled'];

// buildMessage takes (event, options) — the helper builds the options and
// calls it correctly, so no test can fumble the argument shape again.
const msg = (event, over = {}) => buildMessage(event, {
  request: { ...REQUEST, ...(over.request || {}) },
  stageLabel: over.stageLabel || 'Supervisor',
  reason: over.reason,
  actorEmail: over.actorEmail,
  appUrl: APP_URL,
});

describe('buildMessage — the seven emails', () => {
  it('produces a subject and a body for every event', () => {
    for (const event of EVENTS) {
      const m = msg(event, {
        request: { ...REQUEST, status: { approved: 'approved', rejected: 'rejected', cancelled: 'cancelled', recalled: 'recalled' }[event] || REQUEST.status },
      });
      expect(m, event).not.toBeNull();
      expect(m.subject.length, `${event} subject`).toBeGreaterThan(5);
      expect(m.body.length, `${event} body`).toBeGreaterThan(40);
      expect(m.body, `${event} links the app`).toContain(APP_URL);
    }
  });

  it('NEVER leaks the leave purpose — not in any of the seven emails', () => {
    const variants = {
      submitted: { request: { ...REQUEST, status: 'pending_supervisor' } },
      stage_signed: { request: { ...REQUEST, status: 'pending_hod' } },
      approved: { request: { ...REQUEST, status: 'approved' } },
      rejected: { request: { ...REQUEST, status: 'rejected' }, reason: 'Cover too thin.' },
      lodged: { request: { ...REQUEST, status: 'pending_supervisor', lodgedBy: 'segun@example.test' } },
      cancelled: { request: { ...REQUEST, status: 'cancelled' }, reason: 'Reversed.', actorEmail: 'hr@example.test' },
      recalled: { request: { ...REQUEST, status: 'recalled', daysConsumed: 2, daysReturned: 2 }, reason: 'Emergency.', actorEmail: 'hr@example.test' },
    };
    for (const [event, over] of Object.entries(variants)) {
      const m = msg(event, over);
      expect(m, event).not.toBeNull();
      expect(m.subject + m.body, `${event} leaks purpose`).not.toContain('SECRET PURPOSE');
      expect(m.subject + m.body, `${event} leaks purpose`).not.toContain('bereavement');
    }
  });

  it('names the person, the days and the dates in the approver-facing mails', () => {
    const m = msg('submitted');
    expect(m.subject).toContain('Halima Danjuma');
    expect(m.body).toContain('4 working days');
    expect(m.body).toContain('2 Nov 2026 to 6 Nov 2026');
    expect(m.body).toContain('Supervisor');
  });

  it('carries the written reason into the rejection and the cancellation', () => {
    const rejected = msg('rejected', { reason: 'Cover too thin that week.' });
    expect(rejected.body).toContain('Cover too thin that week.');
    const cancelled = msg('cancelled', { reason: 'Project deadline moved.', actorEmail: 'segun@example.test' });
    expect(cancelled.body).toContain('Project deadline moved.');
    expect(cancelled.body).toContain('segun@example.test');
  });

  it('the recall email states consumed and returned days', () => {
    const m = msg('recalled', {
      request: { ...REQUEST, status: 'recalled', daysConsumed: 2, daysReturned: 2 },
      reason: 'Production emergency.',
      actorEmail: 'segun@example.test',
    });
    expect(m.body).toContain('2 of 4 working days were taken');
    expect(m.body).toContain('returned to your balance');
    expect(m.body).toContain('Production emergency.');
  });

  it('the approval email states the resumption date', () => {
    const m = msg('approved', { request: { ...REQUEST, status: 'approved' } });
    expect(m.body).toContain('7 Nov 2026');
    expect(m.body).toContain('confirm your return');
  });

  it('returns null for an unknown event rather than inventing one', () => {
    expect(msg('mischief')).toBeNull();
  });
});
