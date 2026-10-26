// src/services/leaveCalculations.js
//
// Every date and arithmetic rule the Leave module obeys, in one file.
//
// ─────────────────────────────────────────────────────────────────────────
// HARD RULE FOR THE NEXT DEVELOPER: THIS FILE MUST NOT IMPORT FIREBASE.
//
// No `db`, no `collection`, no Firestore calls. Plain values in, plain values
// out. That is what makes it unit-testable — the tests in
// __tests__/leaveCalculations.test.js need no mocks at all, which is the point.
// If you find yourself wanting to read config from the database here, the
// caller should pass a `policy` object instead.
// ─────────────────────────────────────────────────────────────────────────
//
// WHY A SEPARATE FILE AT ALL (rather than logic inside the leave form):
// day-counting across Sundays, public holidays and partial weeks is exactly the
// logic that is miserable to debug through a UI. If it is a pure function, it
// can be proved correct once, in milliseconds, and then trusted everywhere.
//
// THE THREE TRAPS THIS FILE EXISTS TO AVOID — each has a test:
//   1. TIMEZONE. `new Date('2026-10-05')` parses as UTC midnight. In Lagos
//      (UTC+1) that is the 5th; in UTC-5 it is the 4th. Every day count would
//      be silently wrong. Everything here builds dates LOCALLY.
//   2. LEAVE YEAR != CALENDAR YEAR. With a July start, March 2026 belongs to
//      leave year 2025. Getting this wrong resets every balance in the wrong
//      month.
//   3. REVERSED DATES. Start after end must return 0, never a negative number,
//      because a negative balance stored today corrupts every future figure.
//
// Every `policy` value is read from ConfigContext at call time. Nothing is
// hardcoded here — see the leavePolicy block and the blueprint's section 04.

// ─── Date normalisation ────────────────────────────────────────────────────

// Coerce anything date-ish into a local Date at midnight, or null.
//
// Accepts: Date, Firestore Timestamp ({ toDate() }), 'YYYY-MM-DD',
// 'YYYY-MM-DDTHH:mm:ss...Z', or a millisecond number.
export function toLocalDate(value) {
  if (value === null || value === undefined || value === '') return null;

  // Firestore Timestamp — the shape that arrives from a stored field.
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return toLocalDate(value.toDate());
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const d = new Date(value);
    return isNaN(d) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  if (value instanceof Date) {
    if (isNaN(value)) return null;
    // Rebuild from local parts so any time-of-day is discarded. Without this,
    // 2026-10-05T23:00 and 2026-10-05T01:00 could compare as different days.
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === 'string') {
    const s = value.trim();

    // Bare YYYY-MM-DD: construct explicitly as LOCAL.
    // NEVER `new Date('2026-10-05')` — that is UTC midnight, and it is the
    // single most common off-by-one bug in date-heavy factory apps.
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (iso) {
      const [, y, m, d] = iso;
      return new Date(Number(y), Number(m) - 1, Number(d));
    }

    const parsed = new Date(s);
    if (isNaN(parsed)) return null;
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  return null;
}

// 'YYYY-MM-DD' in LOCAL time, for comparing against stored holiday dates.
// Deliberately not toISOString(), which converts to UTC and shifts the day.
export function toDateKey(value) {
  const d = toLocalDate(value);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Local midnight N days after `value`. setDate, not millisecond arithmetic,
// so daylight-saving changes cannot skip or repeat a day.
export function addDays(value, days) {
  const d = toLocalDate(value);
  if (!d) return null;
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

// Whole days from a to b, ignoring time of day. Negative if b precedes a.
export function daysBetween(a, b) {
  const from = toLocalDate(a);
  const to = toLocalDate(b);
  if (!from || !to) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

// ─── Policy readers ────────────────────────────────────────────────────────
// Small helpers so every function tolerates a partial policy object rather
// than crashing when a field is missing.

function nonWorkingSet(policy) {
  const days = policy?.nonWorkingDays;
  // An EMPTY array is a deliberate answer, not a missing one: HR clearing the
  // box means every day is a working day. Falling back to Sunday whenever the
  // list is empty made that impossible to express, and the Leave Request Form
  // then kept subtracting Sundays the factory had said it works.
  //
  // Only a missing or malformed field takes the default (Sunday, assumption A7
  // in the blueprint — the setting most likely to be wrong).
  return new Set(Array.isArray(days) ? days : [0]);
}

function holidaySet(policy) {
  const list = policy?.publicHolidays;
  const set = new Set();
  if (Array.isArray(list)) {
    for (const h of list) {
      const key = typeof h === 'string' ? h : h?.date;
      if (key) set.add(key);
    }
  }
  return set;
}

export function getLeaveType(leaveTypeId, policy) {
  const types = policy?.leaveTypes || [];
  return types.find(t => t.id === leaveTypeId) || null;
}

// ─── Non-working day logic ─────────────────────────────────────────────────

export function isNonWorkingDay(value, policy) {
  const d = toLocalDate(value);
  if (!d) return false;
  if (nonWorkingSet(policy).has(d.getDay())) return true;
  return holidaySet(policy).has(toDateKey(d));
}

// Which non-working days fall inside a range — used by the request form to show
// staff exactly which dates will not be deducted, replacing the paper form's
// hand-written "Public Holidays included" line.
export function listNonWorkingDaysInRange(start, end, policy) {
  const from = toLocalDate(start);
  const to = toLocalDate(end);
  if (!from || !to || from.getTime() > to.getTime()) return [];

  const holidays = holidaySet(policy);
  const labels = new Map();
  for (const h of policy?.publicHolidays || []) {
    if (h?.date) labels.set(h.date, h.label || 'Public holiday');
  }

  const out = [];
  const cursor = new Date(from);
  while (cursor.getTime() <= to.getTime()) {
    const key = toDateKey(cursor);
    if (nonWorkingSet(policy).has(cursor.getDay())) {
      out.push({ date: key, label: 'Non-working day' });
    } else if (holidays.has(key)) {
      out.push({ date: key, label: labels.get(key) || 'Public holiday' });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

// Working days in an inclusive range.
//
// TRAP 3 GUARD: a reversed range returns 0, never a negative number.
export function countWorkingDays(start, end, policy) {
  const from = toLocalDate(start);
  const to = toLocalDate(end);
  if (!from || !to) return 0;
  if (from.getTime() > to.getTime()) return 0;

  const nonWorking = nonWorkingSet(policy);
  const holidays = holidaySet(policy);

  let count = 0;
  const cursor = new Date(from);
  while (cursor.getTime() <= to.getTime()) {
    if (!nonWorking.has(cursor.getDay()) && !holidays.has(toDateKey(cursor))) {
      count += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

// The next working day STRICTLY AFTER the given date — the resumption date.
// Friday with Saturday and Sunday off returns the following Monday.
export function nextWorkingDay(value, policy) {
  const from = toLocalDate(value);
  if (!from) return null;
  const cursor = new Date(from);
  do {
    cursor.setDate(cursor.getDate() + 1);
  } while (isNonWorkingDay(cursor, policy));
  return cursor;
}

// ─── Leave year ────────────────────────────────────────────────────────────

// Which leave year a date falls in.
//
// TRAP 2 GUARD: with leaveYearStartMonth = 7, a date in March 2026 belongs to
// leave year 2025, because that leave year ran Jul 2025 → Jun 2026.
export function getLeaveYear(value, policy) {
  const d = toLocalDate(value);
  if (!d) return null;
  const startMonth = policy?.leaveYearStartMonth || 1;
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return month >= startMonth ? year : year - 1;
}

export function leaveYearStartDate(leaveYear, policy) {
  const startMonth = policy?.leaveYearStartMonth || 1;
  return new Date(leaveYear, startMonth - 1, 1);
}

// The last day of a leave year.
export function leaveYearEndDate(leaveYear, policy) {
  const startMonth = policy?.leaveYearStartMonth || 1;
  const nextStart = new Date(leaveYear + 1, startMonth - 1, 1);
  return addDays(nextStart, -1);
}

export function workingDaysRemainingInLeaveYear(value, policy) {
  const d = toLocalDate(value);
  if (!d) return 0;
  const year = getLeaveYear(d, policy);
  return countWorkingDays(d, leaveYearEndDate(year, policy), policy);
}

// ─── Entitlement ───────────────────────────────────────────────────────────

// A new joiner's share of the annual allowance, pro-rated by days employed in
// the leave year. Someone who joined in July with a January leave year has
// worked roughly half the year and is owed roughly half.
//
// Returns the FULL entitlement when pro-rating is switched off, and when the
// employee has no joining date on record — assuming the worst (they are owed
// everything) is safer than assuming they are owed nothing.
export function proRateEntitlement(fullEntitlement, dateJoined, policy, asOf) {
  const total = Number(fullEntitlement) || 0;
  if (!policy?.proRateNewJoiners) return total;

  const joined = toLocalDate(dateJoined);
  if (!joined) return total;

  const year = getLeaveYear(asOf || new Date(), policy);
  const yearStart = leaveYearStartDate(year, policy);
  const yearEnd = leaveYearEndDate(year, policy);

  // Joined before this leave year began: full entitlement.
  if (joined.getTime() <= yearStart.getTime()) return total;
  // Has not started yet: nothing earned.
  if (joined.getTime() > yearEnd.getTime()) return 0;

  const daysInYear = daysBetween(yearStart, yearEnd) + 1;
  const daysWorked = daysBetween(joined, yearEnd) + 1;
  if (daysInYear <= 0) return total;
  return Math.round(total * (daysWorked / daysInYear));
}

// How much unused annual leave carries into the next year, capped so a large
// balance cannot snowball and block every future request.
export function applyCarryOver(outstanding, policy) {
  const amount = Number(outstanding) || 0;
  if (!policy?.allowCarryOver) return 0;
  if (amount <= 0) return 0;
  const cap = policy.maxCarryOverDays ?? 0;
  return Math.min(amount, cap);
}

// ─── Balance ───────────────────────────────────────────────────────────────

// The core arithmetic behind the paper form's three hand-calculated boxes.
//
// Deliberately DERIVED, never stored as a running counter. The request history
// is the ledger, so there is nothing that can drift out of step and nothing to
// reconcile at year end.
export function calculateBalance({
  entitlement = 0,
  carryOver = 0,
  alreadyTaken = 0,
  requestedDays = 0,
} = {}) {
  const totalEntitled = (Number(entitlement) || 0) + (Number(carryOver) || 0);
  const daysTaken = Number(alreadyTaken) || 0;
  const daysRequested = Number(requestedDays) || 0;

  const outstandingBefore = totalEntitled - daysTaken;
  const outstandingAfter = outstandingBefore - daysRequested;

  return {
    totalEntitled,
    daysTaken,
    daysRequested,
    outstandingBefore,
    outstandingAfter,
    // Strictly greater-than: requesting the exact remaining balance is legal.
    exceedsBalance: daysRequested > outstandingBefore,
  };
}

// Sum of APPROVED leave days for one employee in one leave year. This is what
// replaces the paper form's hand-written "No. of days already taken".
export function sumApprovedDays(requests, { employeeId, leaveYear }) {
  if (!Array.isArray(requests)) return 0;
  return requests.reduce((sum, r) => {
    if (r?.status !== 'approved') return sum;
    if (employeeId && r.employeeId !== employeeId) return sum;
    if (leaveYear != null && Number(r.leaveYear) !== Number(leaveYear)) return sum;
    const days = Number(r.requestedDays);
    return sum + (Number.isFinite(days) ? days : 0);
  }, 0);
}

// A short human date for validation messages — "3 Nov 2026", not an ISO
// string or a timestamp. The messages quote real ranges, so people can
// recognise their own request at a glance.
function shortDate(value) {
  const d = toLocalDate(value);
  if (!d) return 'those dates';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Overlap ───────────────────────────────────────────────────────────────

// Do two inclusive ranges share any day?
//
// Adjacent ranges do NOT overlap: leave ending Friday and starting the
// following Monday is normal, not a conflict.
export function dateRangesOverlap(aStart, aEnd, bStart, bEnd) {
  const a1 = toLocalDate(aStart);
  const a2 = toLocalDate(aEnd);
  const b1 = toLocalDate(bStart);
  const b2 = toLocalDate(bEnd);
  if (!a1 || !a2 || !b1 || !b2) return false;
  return a1.getTime() <= b2.getTime() && b1.getTime() <= a2.getTime();
}

// Which existing requests collide with a proposed range.
//
// Two distinct findings, following current practice:
//   overlaps — a colleague is also away. Informational.
//   conflict — enough people from one department are away that coverage is at
//              risk. Worth a conversation.
//
// This function answers the COLLEAGUE question only. It counts approved
// requests and deliberately excludes the proposer's own — the person's own
// calendar is a different question with a different answer (see
// findOwnOverlaps below: blocked, not warned).
//
// FIXED 26 Oct 2026: the conflict threshold used to be hardcoded as 2,
// ignoring policy.conflictThreshold entirely — the setting existed, HR could
// change it, and nothing anywhere would listen. It now reads the policy,
// keeping 2 as the fallback for callers without one.
export function describeOverlaps(proposedRange, existingRequests = [], { department, employeeId, policy } = {}) {
  const { leaveCommences, leaveEnds } = proposedRange || {};
  const overlapping = [];

  for (const r of existingRequests || []) {
    if (r?.status && r.status !== 'approved') continue;
    if (employeeId && r.employeeId === employeeId) continue; // own request
    if (!dateRangesOverlap(leaveCommences, leaveEnds, r.leaveCommences, r.leaveEnds)) continue;
    overlapping.push(r);
  }

  const sameDepartment = department
    ? overlapping.filter(r => r.department === department)
    : overlapping;

  const threshold = Number(policy?.conflictThreshold) || 2;
  return {
    overlaps: overlapping,
    overlapCount: overlapping.length,
    sameDepartment,
    // A conflict means this many are ALREADY away in the same department; the
  // proposed request then tips it over. Deliberately NOT counting the proposer
  // in the threshold — the setting reads "warn when this many are away".
  // Counting the proposer would fire one request earlier than the setting says.
    isConflict: sameDepartment.length >= threshold,
    threshold,
  };
}

// ─── The proposer's own calendar ────────────────────────────────────────────────────

// Which of the employee's OWN live requests share days with a proposed range.
//
// WHY THIS IS SEPARATE from describeOverlaps and why it BLOCKS rather than
// warns: a colleague being away the same week is a coverage judgement a
// human should make. One person booked twice for the same day is not a
// judgement at all — if both are approved, the ledger charges the shared
// days twice and the person is "on leave twice" on the same date. There is
// no legitimate case, so there is no warning, only a refusal whose message
// states the way out.
//
// Live requests are pending (any stage) and approved. Cancelled and
// rejected requests are history, not calendar, and are ignored — a person
// may re-book dates they previously cancelled.
export function findOwnOverlaps(request, ownRequests = []) {
  const { leaveCommences, leaveEnds } = request || {};
  const out = [];
  for (const r of ownRequests || []) {
    if (!r) continue;
    const status = String(r.status || '');
    const live = status.startsWith('pending_') || status === 'approved';
    if (!live) continue;
    if (!dateRangesOverlap(leaveCommences, leaveEnds, r.leaveCommences, r.leaveEnds)) continue;
    out.push(r);
  }
  return out;
}

// Does a range cross the leave-year boundary?
//
// The convention (kept deliberately): a request is charged wholly to the
// leave year of its FIRST day. Defensible — but an approver signing off a
// range that spans two years deserves to see it stated, and the snapshot
// says which year the days went to.
export function spansLeaveYear(start, end, policy) {
  const a = getLeaveYear(start, policy);
  const b = getLeaveYear(end, policy);
  return a !== null && b !== null && a !== b;
}

// ─── Validation ────────────────────────────────────────────────────────────

// Every reason a request cannot be submitted, as a list — NOT just the first.
//
// The reason is user-facing: the same strings are rendered on the form, so a
// person sees exactly what to fix rather than a generic rejection.
export function validateLeaveRequest(request, policy, options = {}) {
  const {
    balance = null,
    // The proposer's OWN requests, any status — they drive the taken-days,
    // pending-exposure and self-overlap rules.
    existingRequests = [],
    // OTHER people's approved requests — they drive the coverage question.
    departmentRequests = [],
    employeeId = null,
    department = null,
    today = new Date(),
  } = options;

  const errors = [];
  const { leaveType, leaveCommences, leaveEnds, purpose, handoverNote, requestedDays } = request || {};

  const starts = toLocalDate(leaveCommences);
  const ends = toLocalDate(leaveEnds);

  // ── Dates ──
  if (!starts) errors.push('Choose the first day of leave.');
  if (!ends) errors.push('Choose the last day of leave.');
  if (starts && ends && ends.getTime() < starts.getTime()) {
    errors.push('The last day cannot be before the first day.');
  }

  const type = getLeaveType(leaveType, policy);
  if (!type) errors.push('Choose a type of leave.');

  const days = Number.isFinite(Number(requestedDays)) ? Number(requestedDays) : 0;

  // A range that contains only non-working days is not leave at all.
  if (starts && ends && daysBetween(starts, ends) >= 0 && days === 0) {
    errors.push('Those dates contain no working days.');
  }

  // ── Notice period ──
  const noticeRequired = Number(policy?.noticeRequiredDays) || 0;
  if (starts && noticeRequired > 0 && (policy?.noticeAppliesTo || []).includes(leaveType)) {
    const leadTime = workingDaysBetween(today, starts, policy);
    if (leadTime < noticeRequired) {
      const short = noticeRequired - Math.max(leadTime, 0);
      errors.push(
        `${type ? type.label : 'This leave'} needs ${noticeRequired} working days' notice — you have ${Math.max(leadTime, 0)}. ${short} more ${short === 1 ? 'day' : 'days'} short.`,
      );
    }
  }

  // ── Balance — only for types that track one ──
  // Compared against `outstandingBefore`, NOT `balance.exceedsBalance`.
  // `exceedsBalance` is only true if the caller already folded this request's
  // days into the balance object — an easy mistake that fails SILENTLY, letting
  // an over-balance request through with no error anywhere.
  //
  // FIXED 26 Oct 2026: this check used to run for EVERY leave type, including
  // the ones that deliberately carry no balance (maternity, compassionate,
  // examination). Those types get entitlement 0, so "remaining" was always 0,
  // and every bereavement or maternity request in the app was refused with
  // "That is 3 days but only 0 remain". Nobody could file compassionate leave
  // at all. The balance rule now applies only where a balance exists; the
  // non-tracked types get a duration cap instead, just below.
  if (balance && type?.balanceTracked && !policy?.allowNegativeBalance) {
    // Days already awaiting approval COMMIT the balance just as surely as
    // approved days do. Before this, two pending requests each showed a
    // healthy snapshot, both were signed, and the combined taken quietly went
    // negative — no single screen ever added them up.
    const pending = (existingRequests || [])
      .filter(r => String(r?.status || '').startsWith('pending_'))
      .reduce((sum, r) => sum + (Number(r?.requestedDays) || 0), 0);
    const remaining = (Number(balance.outstandingBefore) || 0) - pending;
    if (days > remaining) {
      errors.push(
        pending > 0
          ? `That is ${days} days but only ${Math.max(remaining, 0)} remain uncommitted — ${pending} ${pending === 1 ? 'day is' : 'days are'} already awaiting approval. Cancel those requests or choose fewer days.`
          : `That is ${days} days but only ${Math.max(remaining, 0)} remain. Short by ${days - Math.max(remaining, 0)}.`,
      );
    }
  }

  // ── Duration cap — for the types that carry no balance ──
  // Without a balance to draw on, a "compassionate" request had no length
  // limit at all. Each leave type now declares maxDurationDays; maternity
  // defaults to 60 working days (the policy's 12 weeks), compassionate to 5,
  // examination to 10. HR can change any of them in the Leave Policy tab.
  if (!type?.balanceTracked) {
    const cap = Number(type?.maxDurationDays) || 0;
    if (cap > 0 && days > cap) {
      errors.push(
        `${type.label} is capped at ${cap} working days — this request is ${days}. Ask HR if you genuinely need longer.`,
      );
    }
  }

  // ── The proposer's own calendar — no double-booking, ever ──
  // Blocking, not warning: two live requests for the same person sharing a
  // day is arithmetic, not judgement. Approved history stays frozen either
  // way; the message states the way out for each state.
  if (starts && ends) {
    const clashes = findOwnOverlaps(request, existingRequests);
    if (clashes.length > 0) {
      const clash = clashes[0];
      if (clash.status === 'approved') {
        errors.push(
          `You already have approved leave for ${shortDate(clash.leaveCommences)} to ${shortDate(clash.leaveEnds)}. Ask HR to cancel it before booking these dates.`,
        );
      } else {
        const stageId = String(clash.status || '').slice('pending_'.length);
        const stage = (policy?.stages || []).find(st => st.id === stageId);
        errors.push(
          `You already have a request for ${shortDate(clash.leaveCommences)} to ${shortDate(clash.leaveEnds)} waiting on the ${stage?.label || stageId}. Cancel it from My Leave first, then book these dates.`,
        );
      }
    }
  }

  // ── Purpose ──
  if (type?.requiresPurpose && !String(purpose || '').trim()) {
    errors.push(`Give a reason — ${type.label} needs one.`);
  }

  // ── Handover note ──
  const handoverFrom = Number(policy?.handoverNoteRequiredDays);
  if (policy?.requireHandoverNote && handoverFrom > 0 && days >= handoverFrom) {
    if (!String(handoverNote || '').trim()) {
      errors.push(`Leave of ${handoverFrom} working days or more needs a handover note.`);
    }
  }

  // ── Colleague overlap — the human judgement, warn/block per policy ──
  // NOTE the list: departmentRequests, NOT existingRequests. existingRequests
  // are the proposer's OWN (they drive balance and the self-overlap check
  // above); the coverage question needs other people's approved requests.
  // This block only fires a hard error when the policy says block — the
  // warning itself is computed for the form by prepareLeaveRequest.
  if (starts && ends) {
    const clash = describeOverlaps(
      { leaveCommences: starts, leaveEnds: ends },
      departmentRequests || existingRequests,
      { department, employeeId, policy },
    );
    if (clash.isConflict && policy?.overlapBehaviour === 'block') {
      errors.push(`${clash.sameDepartment.length} people in ${department || 'your department'} are already away then.`);
    }
  }

  return errors;
}

// Working days from a to b, excluding b. Used for the notice calculation:
// "7 working days before I go" should not count today.
export function workingDaysBetween(a, b, policy) {
  const from = toLocalDate(a);
  const to = toLocalDate(b);
  if (!from || !to) return 0;
  if (from.getTime() >= to.getTime()) return 0;
  const lastDay = addDays(to, -1);
  return countWorkingDays(from, lastDay, policy);
}