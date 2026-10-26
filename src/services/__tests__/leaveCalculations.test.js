import { describe, it, expect } from 'vitest';

// leaveCalculations.js must stay Firebase-free, which is why this test needs
// NO mocks at all — unlike every other service test in this repo. That is the
// payoff of the hard rule in the file header: the date and balance logic can be
// proved correct in milliseconds without a browser or a database.
import {
  toLocalDate, toDateKey, addDays, daysBetween,
  isNonWorkingDay, listNonWorkingDaysInRange, countWorkingDays, nextWorkingDay,
  getLeaveYear, leaveYearStartDate, leaveYearEndDate, workingDaysRemainingInLeaveYear,
  proRateEntitlement, applyCarryOver,
  calculateBalance, sumApprovedDays,
  dateRangesOverlap, describeOverlaps, findOwnOverlaps, spansLeaveYear,
  validateLeaveRequest, workingDaysBetween, getLeaveType,
} from '../leaveCalculations';

// ─── Test fixtures ─────────────────────────────────────────────────────────

const POLICY = {
  leaveTypes: [
    { id: 'annual', label: 'Annual Leave', requiresPurpose: false, balanceTracked: true },
    { id: 'casual', label: 'Casual Leave', requiresPurpose: true, balanceTracked: true },
    { id: 'compassionate', label: 'Compassionate Leave', requiresPurpose: true, balanceTracked: false, maxDurationDays: 5 },
    { id: 'maternity', label: 'Maternity Leave', requiresPurpose: true, balanceTracked: false, maxDurationDays: 60 },
    { id: 'examination', label: 'Examination Leave', requiresPurpose: true, balanceTracked: false, maxDurationDays: 10 },
  ],
  annualEntitlementDays: 21,
  noticeRequiredDays: 7,
  noticeAppliesTo: ['annual'],
  allowCarryOver: true,
  maxCarryOverDays: 5,
  proRateNewJoiners: true,
  leaveYearStartMonth: 1,
  nonWorkingDays: [0],                 // Sunday only
  publicHolidays: [
    { date: '2026-01-01', label: "New Year's Day" },
    { date: '2026-10-01', label: 'Independence Day' },
  ],
  requireHandoverNote: true,
  handoverNoteRequiredDays: 3,
  allowNegativeBalance: false,
  overlapBehaviour: 'warn',
  conflictThreshold: 2,
};

const SATURDAY_OFF = { ...POLICY, nonWorkingDays: [0, 6] };

// 2026 calendar reference used by the tests below:
//   Oct 2026 — 1 Thu, 2 Fri, 3 Sat, 4 Sun, 5 Mon, 6 Tue, 7 Wed, 8 Thu,
//              9 Fri, 10 Sat, 11 Sun, 12 Mon ...
const d = (y, m, day) => new Date(y, m - 1, day);

// ─── TRAP 1: timezone ───────────────────────────────────────────────────────

describe('TRAP 1 — timezone off-by-one', () => {
  it('parses a bare YYYY-MM-DD as the SAME local day', () => {
    const parsed = toLocalDate('2026-10-05');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(9);
    expect(parsed.getDate()).toBe(5);
  });

  it('never uses toISOString, which would shift the day in a negative offset', () => {
    // The bug this guards: toISOString() on a local midnight date in UTC-5
    // returns the PREVIOUS day. toDateKey must be local.
    expect(toDateKey(d(2026, 10, 5))).toBe('2026-10-05');
  });

  it('round-trips a date key without shifting', () => {
    expect(toDateKey(toLocalDate('2026-10-05'))).toBe('2026-10-05');
    expect(toDateKey(toLocalDate('2026-01-01'))).toBe('2026-01-01');
    expect(toDateKey(toLocalDate('2026-12-31'))).toBe('2026-12-31');
  });

  it('strips time of day so two times on one date are the same day', () => {
    // Both instants fall on 5 Oct in Lagos (UTC+1): 00:01Z is 01:01 local and
    // 23:59Z is 01:59 local the NEXT day, so this asserts the LOCAL calendar
    // date rather than the UTC one — which is what actually gets counted.
    expect(toDateKey('2026-10-05T00:01:00Z')).toBe('2026-10-05');
    expect(toDateKey('2026-10-05T21:59:00Z')).toBe('2026-10-05');
    // Two different times on the same local date collapse to one key.
    expect(toDateKey(new Date(2026, 9, 5, 0, 0, 1))).toBe(toDateKey(new Date(2026, 9, 5, 23, 59, 59)));
  });

  it('accepts a Firestore Timestamp shape', () => {
    const ts = { toDate: () => d(2026, 10, 5) };
    expect(toDateKey(ts)).toBe('2026-10-05');
  });

  it('returns null for junk rather than an Invalid Date', () => {
    expect(toLocalDate(null)).toBeNull();
    expect(toLocalDate(undefined)).toBeNull();
    expect(toLocalDate('')).toBeNull();
    expect(toLocalDate('not-a-date')).toBeNull();
    expect(toLocalDate(new Date('nonsense'))).toBeNull();
  });

  it('adds days across a month boundary correctly', () => {
    expect(toDateKey(addDays('2026-01-31', 1))).toBe('2026-02-01');
    expect(toDateKey(addDays('2026-03-01', -1))).toBe('2026-02-28');
    expect(toDateKey(addDays('2028-02-28', 1))).toBe('2028-02-29'); // leap year
  });
});

// ─── TRAP 2: leave year ────────────────────────────────────────────────────

describe('TRAP 2 — leave year is not always the calendar year', () => {
  it('matches the calendar year when the year starts in January', () => {
    expect(getLeaveYear('2026-03-15', POLICY)).toBe(2026);
    expect(getLeaveYear('2026-12-31', POLICY)).toBe(2026);
    expect(getLeaveYear('2026-01-01', POLICY)).toBe(2026);
  });

  it('assigns an early-month date to the PREVIOUS year for a July start', () => {
    const july = { ...POLICY, leaveYearStartMonth: 7 };
    // July 2025 → June 2026 is leave year 2025.
    expect(getLeaveYear('2026-03-15', july)).toBe(2025);
    expect(getLeaveYear('2026-01-01', july)).toBe(2025);
    expect(getLeaveYear('2026-06-30', july)).toBe(2025);
    // On or after July it is the current year.
    expect(getLeaveYear('2026-07-01', july)).toBe(2026);
    expect(getLeaveYear('2026-12-31', july)).toBe(2026);
  });

  it('handles the 31 December boundary without resetting early', () => {
    expect(getLeaveYear('2026-12-31', POLICY)).toBe(2026);
    expect(getLeaveYear('2027-01-01', POLICY)).toBe(2027);
  });

  it('computes year start and end for a mid-year cycle', () => {
    const july = { ...POLICY, leaveYearStartMonth: 7 };
    expect(toDateKey(leaveYearStartDate(2026, july))).toBe('2026-07-01');
    expect(toDateKey(leaveYearEndDate(2026, july))).toBe('2027-06-30');
    expect(toDateKey(leaveYearStartDate(2026, POLICY))).toBe('2026-01-01');
    expect(toDateKey(leaveYearEndDate(2026, POLICY))).toBe('2026-12-31');
  });

  it('counts working days left before the year ends', () => {
    // 30 Nov → 31 Dec 2026 is 32 calendar days. Four Sundays fall in that
    // window (6, 13, 20, 27 Dec), so 28 working days remain.
    expect(workingDaysRemainingInLeaveYear('2026-11-30', POLICY)).toBe(28);
  });
});

// ─── TRAP 3: reversed dates ────────────────────────────────────────────────

describe('TRAP 3 — reversed dates must never go negative', () => {
  it('returns 0 for an end before the start', () => {
    expect(countWorkingDays('2026-10-09', '2026-10-05', POLICY)).toBe(0);
    expect(countWorkingDays('2026-12-31', '2026-01-01', POLICY)).toBe(0);
  });

  it('returns 0 rather than a negative for workingDaysBetween', () => {
    expect(workingDaysBetween('2026-10-09', '2026-10-05', POLICY)).toBe(0);
    expect(workingDaysBetween('2026-10-05', '2026-10-05', POLICY)).toBe(0);
  });

  it('never returns a negative day count from daysBetween misuse', () => {
    expect(daysBetween('2026-10-05', '2026-10-09')).toBe(4);
    expect(daysBetween('2026-10-09', '2026-10-05')).toBe(-4); // documented as signed
  });

  it('rejects a reversed range in validation rather than computing from it', () => {
    const errors = validateLeaveRequest(
      { leaveType: 'annual', leaveCommences: '2026-10-09', leaveEnds: '2026-10-05', requestedDays: 0 },
      POLICY,
      { today: d(2026, 1, 5) },
    );
    expect(errors.some(e => e.includes('last day cannot be before'))).toBe(true);
  });
});

// ─── Working-day counting ──────────────────────────────────────────────────

describe('countWorkingDays', () => {
  it('counts a normal working week', () => {
    // Mon 5 Oct → Fri 9 Oct 2026 = 5 working days, Sunday only is off.
    expect(countWorkingDays('2026-10-05', '2026-10-09', POLICY)).toBe(5);
  });

  it('excludes a Sunday inside the range', () => {
    // Mon 5 → Sun 11 Oct: 7 calendar days, 1 Sunday → 6 working days.
    expect(countWorkingDays('2026-10-05', '2026-10-11', POLICY)).toBe(6);
  });

  it('excludes a Saturday only when Saturday is configured off', () => {
    // Mon 5 → Sat 10 Oct.
    expect(countWorkingDays('2026-10-05', '2026-10-10', POLICY)).toBe(6);   // Sat works
    expect(countWorkingDays('2026-10-05', '2026-10-10', SATURDAY_OFF)).toBe(5); // Sat off
  });

  it('excludes a public holiday inside the range', () => {
    // Independence Day is Thu 1 Oct 2026. Wed 30 Sep → Fri 2 Oct is 3 days
    // minus the holiday = 2.
    expect(countWorkingDays('2026-09-30', '2026-10-02', POLICY)).toBe(2);
    expect(countWorkingDays('2026-09-30', '2026-09-30', POLICY)).toBe(1); // no holiday
  });

  it('returns 1 for a single working day', () => {
    expect(countWorkingDays('2026-10-05', '2026-10-05', POLICY)).toBe(1);
  });

  it('returns 0 for a single day that is a Sunday', () => {
    expect(countWorkingDays('2026-10-04', '2026-10-04', POLICY)).toBe(0);
  });

  it('returns 0 for a single day that is a public holiday', () => {
    expect(countWorkingDays('2026-10-01', '2026-10-01', POLICY)).toBe(0);
  });

  it('counts the same range identically from a string, a Date and a Timestamp', () => {
    const expected = 5;
    expect(countWorkingDays('2026-10-05', '2026-10-09', POLICY)).toBe(expected);
    expect(countWorkingDays(d(2026, 10, 5), d(2026, 10, 9), POLICY)).toBe(expected);
    expect(countWorkingDays({ toDate: () => d(2026, 10, 5) }, { toDate: () => d(2026, 10, 9) }, POLICY)).toBe(expected);
  });

  it('survives a missing policy by falling back to Sunday off', () => {
    expect(countWorkingDays('2026-10-05', '2026-10-09', {})).toBe(5);
    expect(countWorkingDays('2026-10-05', '2026-10-09', undefined)).toBe(5);
  });
});

describe('nextWorkingDay — the resumption date', () => {
  it('skips the weekend when Saturday and Sunday are both off', () => {
    // Fri 9 Oct → next working day is Mon 12 Oct.
    expect(toDateKey(nextWorkingDay('2026-10-09', SATURDAY_OFF))).toBe('2026-10-12');
  });

  it('returns Monday when only Sunday is off', () => {
    // Fri 9 Oct, Saturday is a working day here.
    expect(toDateKey(nextWorkingDay('2026-10-09', POLICY))).toBe('2026-10-10');
  });

  it('skips a public holiday that falls on the next day', () => {
    // Wed 30 Sep 2026 → Thu 1 Oct is Independence Day → Fri 2 Oct.
    expect(toDateKey(nextWorkingDay('2026-09-30', POLICY))).toBe('2026-10-02');
  });

  it('handles a holiday run across consecutive days', () => {
    const twoDays = {
      ...POLICY,
      publicHolidays: [
        { date: '2026-10-01', label: 'Holiday A' },
        { date: '2026-10-02', label: 'Holiday B' },
      ],
    };
    // Wed 30 Sep → Thu 1 and Fri 2 are holidays, Sat 3 works.
    expect(toDateKey(nextWorkingDay('2026-09-30', twoDays))).toBe('2026-10-03');
  });
});

describe('isNonWorkingDay and listNonWorkingDaysInRange', () => {
  it('identifies Sundays and holidays', () => {
    expect(isNonWorkingDay('2026-10-04', POLICY)).toBe(true);  // Sunday
    expect(isNonWorkingDay('2026-10-01', POLICY)).toBe(true);  // holiday
    expect(isNonWorkingDay('2026-10-05', POLICY)).toBe(false); // Monday
  });

  it('lists every excluded day in a range with its label', () => {
    const list = listNonWorkingDaysInRange('2026-09-30', '2026-10-04', POLICY);
    expect(list.map(x => x.date)).toEqual(['2026-10-01', '2026-10-04']);
    expect(list[0].label).toBe('Independence Day');
    expect(list[1].label).toBe('Non-working day');
  });

  it('returns an empty list for a reversed range instead of looping forever', () => {
    expect(listNonWorkingDaysInRange('2026-10-09', '2026-10-05', POLICY)).toEqual([]);
  });

  // REGRESSION (found 18 Oct 2026, live): an EMPTY nonWorkingDays array is a
  // deliberate answer — "every day is a working day" — and the factory had
  // configured exactly that. The guard `Array.isArray(days) && days.length`
  // read the empty list as "unset" and substituted Sundays, so the Leave
  // Request Form kept showing excluded non-working days after a week HR had
  // said everybody works. Only a missing or malformed field takes the default.
  it('treats an empty nonWorkingDays array as all days working, not as unset', () => {
    const allWorking = { ...POLICY, nonWorkingDays: [] };
    expect(isNonWorkingDay('2026-10-04', allWorking)).toBe(false); // Sunday, but working
    expect(listNonWorkingDaysInRange('2026-09-30', '2026-10-04', allWorking))
      .toEqual([{ date: '2026-10-01', label: 'Independence Day' }]); // holiday still excluded
    expect(countWorkingDays('2026-10-03', '2026-10-04', allWorking)).toBe(2); // Sat + Sun count
  });

  it('still defaults to Sunday when nonWorkingDays is absent entirely', () => {
    const unset = { ...POLICY, nonWorkingDays: undefined };
    expect(isNonWorkingDay('2026-10-04', unset)).toBe(true); // Sunday
  });

  it('still defaults to Sunday when nonWorkingDays is malformed', () => {
    const malformed = { ...POLICY, nonWorkingDays: 'every day' };
    expect(isNonWorkingDay('2026-10-04', malformed)).toBe(true); // Sunday
  });
});

// ─── Balance arithmetic ────────────────────────────────────────────────────

describe('calculateBalance', () => {
  it('matches the paper form example: 21 entitled, 8 taken, 4 requested', () => {
    const b = calculateBalance({ entitlement: 21, carryOver: 0, alreadyTaken: 8, requestedDays: 4 });
    expect(b.totalEntitled).toBe(21);
    expect(b.outstandingBefore).toBe(13);
    expect(b.outstandingAfter).toBe(9);
    expect(b.exceedsBalance).toBe(false);
  });

  it("explains the paper form's stated \"outstanding 11\" as a 2-day carry-over", () => {
    // 21 + 2 carried − 8 − 4 = 11, which is what the form's author wrote.
    const b = calculateBalance({ entitlement: 21, carryOver: 2, alreadyTaken: 8, requestedDays: 4 });
    expect(b.outstandingAfter).toBe(11);
  });

  it('allows requesting the exact remaining balance', () => {
    const b = calculateBalance({ entitlement: 21, alreadyTaken: 13, requestedDays: 8 });
    expect(b.outstandingAfter).toBe(0);
    expect(b.exceedsBalance).toBe(false); // strictly greater is the test
  });

  it('flags an over-request', () => {
    const b = calculateBalance({ entitlement: 21, alreadyTaken: 13, requestedDays: 9 });
    expect(b.exceedsBalance).toBe(true);
    expect(b.outstandingAfter).toBe(-1);
  });

  it('treats missing input as zero rather than NaN', () => {
    const b = calculateBalance();
    expect(b.totalEntitled).toBe(0);
    expect(b.outstandingAfter).toBe(0);
    expect(b.exceedsBalance).toBe(false);
  });
});

describe('sumApprovedDays', () => {
  const requests = [
    { employeeId: 'E1', leaveYear: 2026, requestedDays: 4, status: 'approved' },
    { employeeId: 'E1', leaveYear: 2026, requestedDays: 3, status: 'approved' },
    { employeeId: 'E1', leaveYear: 2026, requestedDays: 10, status: 'pending_supervisor' },
    { employeeId: 'E1', leaveYear: 2026, requestedDays: 5, status: 'rejected' },
    { employeeId: 'E2', leaveYear: 2026, requestedDays: 7, status: 'approved' },
    { employeeId: 'E1', leaveYear: 2025, requestedDays: 6, status: 'approved' },
  ];

  it('counts only approved leave for that employee and year', () => {
    expect(sumApprovedDays(requests, { employeeId: 'E1', leaveYear: 2026 })).toBe(7);
  });

  it('excludes other employees and other years', () => {
    expect(sumApprovedDays(requests, { employeeId: 'E2', leaveYear: 2026 })).toBe(7);
    expect(sumApprovedDays(requests, { employeeId: 'E1', leaveYear: 2025 })).toBe(6);
  });

  it('returns 0 for an empty or missing list', () => {
    expect(sumApprovedDays([], { employeeId: 'E1' })).toBe(0);
    expect(sumApprovedDays(null, { employeeId: 'E1' })).toBe(0);
  });
});

// ─── Pro-rating and carry-over ─────────────────────────────────────────────

describe('proRateEntitlement', () => {
  it('gives a full year to someone who joined before the year began', () => {
    expect(proRateEntitlement(21, '2020-01-01', POLICY, d(2026, 6, 1))).toBe(21);
  });

  it('gives roughly half to someone who joined mid-year', () => {
    const days = proRateEntitlement(21, '2026-07-01', POLICY, d(2026, 7, 1));
    expect(days).toBe(11); // ~half of 21
    expect(days).toBeLessThan(21);
  });

  it('gives nothing to someone who has not started yet', () => {
    expect(proRateEntitlement(21, '2027-01-01', POLICY, d(2026, 6, 1))).toBe(0);
  });

  it('returns the full entitlement when pro-rating is switched off', () => {
    expect(proRateEntitlement(21, '2026-07-01', { ...POLICY, proRateNewJoiners: false }, d(2026, 7, 1))).toBe(21);
  });

  it('assumes the full entitlement when no joining date is on record', () => {
    expect(proRateEntitlement(21, null, POLICY, d(2026, 7, 1))).toBe(21);
  });
});

describe('applyCarryOver', () => {
  it('carries up to the cap', () => {
    expect(applyCarryOver(3, POLICY)).toBe(3);
    expect(applyCarryOver(5, POLICY)).toBe(5);
  });

  it('caps a large balance so it cannot snowball', () => {
    expect(applyCarryOver(12, POLICY)).toBe(5);
  });

  it('carries nothing when switched off, or when nothing is left', () => {
    expect(applyCarryOver(9, { ...POLICY, allowCarryOver: false })).toBe(0);
    expect(applyCarryOver(0, POLICY)).toBe(0);
    expect(applyCarryOver(-4, POLICY)).toBe(0);
  });
});

// ─── Overlap ───────────────────────────────────────────────────────────────

describe('dateRangesOverlap', () => {
  it('detects identical ranges', () => {
    expect(dateRangesOverlap('2026-10-05', '2026-10-09', '2026-10-05', '2026-10-09')).toBe(true);
  });

  it('detects a partial overlap at either end', () => {
    expect(dateRangesOverlap('2026-10-05', '2026-10-09', '2026-10-08', '2026-10-12')).toBe(true);
    expect(dateRangesOverlap('2026-10-08', '2026-10-12', '2026-10-05', '2026-10-09')).toBe(true);
  });

  it('detects a range fully contained in the other', () => {
    expect(dateRangesOverlap('2026-10-01', '2026-10-31', '2026-10-05', '2026-10-09')).toBe(true);
  });

  it('does NOT treat adjacent ranges as overlapping', () => {
    // Leave ends Fri 9 Oct, next starts Mon 12 Oct — normal, not a conflict.
    expect(dateRangesOverlap('2026-10-05', '2026-10-09', '2026-10-12', '2026-10-16')).toBe(false);
    expect(dateRangesOverlap('2026-10-05', '2026-10-09', '2026-10-10', '2026-10-12')).toBe(false);
  });

  it('returns false for missing input', () => {
    expect(dateRangesOverlap(null, '2026-10-09', '2026-10-05', '2026-10-09')).toBe(false);
  });
});

describe('describeOverlaps — overlap vs conflict', () => {
  const base = { leaveCommences: '2026-10-05', leaveEnds: '2026-10-09' };

  it('reports an overlap but not a conflict for one colleague', () => {
    const r = describeOverlaps(base, [
      { employeeId: 'E2', department: 'production', status: 'approved', leaveCommences: '2026-10-07', leaveEnds: '2026-10-09' },
    ], { department: 'production', employeeId: 'E1' });
    expect(r.overlapCount).toBe(1);
    expect(r.isConflict).toBe(false);
  });

  it('escalates to a conflict at the threshold', () => {
    const r = describeOverlaps(base, [
      { employeeId: 'E2', department: 'production', status: 'approved', leaveCommences: '2026-10-05', leaveEnds: '2026-10-09' },
      { employeeId: 'E3', department: 'production', status: 'approved', leaveCommences: '2026-10-06', leaveEnds: '2026-10-08' },
    ], { department: 'production', employeeId: 'E1' });
    expect(r.overlapCount).toBe(2);
    expect(r.isConflict).toBe(true);
  });

  it('counts only the SAME department toward a conflict', () => {
    const r = describeOverlaps(base, [
      { employeeId: 'E2', department: 'production', status: 'approved', leaveCommences: '2026-10-05', leaveEnds: '2026-10-09' },
      { employeeId: 'E3', department: 'quality_control', status: 'approved', leaveCommences: '2026-10-05', leaveEnds: '2026-10-09' },
    ], { department: 'production', employeeId: 'E1' });
    expect(r.overlapCount).toBe(2);
    expect(r.sameDepartment).toHaveLength(1);
    expect(r.isConflict).toBe(false);
  });

  it("ignores the employee's own requests and non-approved ones", () => {
    const r = describeOverlaps(base, [
      { employeeId: 'E1', department: 'production', status: 'approved', leaveCommences: '2026-10-05', leaveEnds: '2026-10-09' },
      { employeeId: 'E2', department: 'production', status: 'rejected', leaveCommences: '2026-10-05', leaveEnds: '2026-10-09' },
      { employeeId: 'E3', department: 'production', status: 'pending_hod', leaveCommences: '2026-10-05', leaveEnds: '2026-10-09' },
    ], { department: 'production', employeeId: 'E1' });
    expect(r.overlapCount).toBe(0);
  });
});

// ─── Validation ────────────────────────────────────────────────────────────

describe('validateLeaveRequest', () => {
  const valid = {
    leaveType: 'annual',
    leaveCommences: '2026-11-02',
    leaveEnds: '2026-11-06',
    requestedDays: 5,
    purpose: '',
    handoverNote: 'Machine 4 handover given to Yusuf',
  };
  const opts = { balance: calculateBalance({ entitlement: 21, alreadyTaken: 3 }), today: d(2026, 10, 20) };

  it('passes a well-formed request', () => {
    expect(validateLeaveRequest(valid, POLICY, opts)).toEqual([]);
  });

  it('returns EVERY failure at once, not just the first', () => {
    const errors = validateLeaveRequest(
      { leaveType: 'casual', leaveCommences: null, leaveEnds: null, requestedDays: 5, purpose: '' },
      POLICY,
      { today: d(2026, 10, 20) },
    );
    expect(errors.length).toBeGreaterThan(2);
    expect(errors.some(e => e.includes('first day'))).toBe(true);
    expect(errors.some(e => e.includes('last day'))).toBe(true);
    expect(errors.some(e => e.includes('reason'))).toBe(true);
  });

  it('requires a purpose for casual leave only', () => {
    const casual = { ...valid, leaveType: 'casual', purpose: '' };
    expect(validateLeaveRequest(casual, POLICY, opts).some(e => e.includes('reason'))).toBe(true);
    expect(validateLeaveRequest({ ...casual, purpose: 'Family emergency' }, POLICY, opts)).toEqual([]);
    // Annual does not require one.
    expect(validateLeaveRequest({ ...valid, purpose: '' }, POLICY, opts)).toEqual([]);
  });

  it('enforces the notice period for annual leave only', () => {
    const soon = { ...valid, leaveCommences: '2026-10-26', leaveEnds: '2026-10-30', requestedDays: 5 };
    expect(validateLeaveRequest(soon, POLICY, opts).some(e => e.includes('notice'))).toBe(true);
    // Casual needs no notice.
    expect(validateLeaveRequest({ ...soon, leaveType: 'casual', purpose: 'Errand' }, POLICY, opts)).toEqual([]);
  });

  it('blocks a request that exceeds the balance, and names the shortfall', () => {
    const greedy = { ...valid, requestedDays: 30 };
    const errors = validateLeaveRequest(greedy, POLICY, opts);
    expect(errors.some(e => e.includes('remain'))).toBe(true);
    expect(errors.some(e => e.includes('Short by'))).toBe(true);
  });

  it('allows an over-balance request when negative balances are permitted', () => {
    const lenient = { ...POLICY, allowNegativeBalance: true };
    expect(validateLeaveRequest({ ...valid, requestedDays: 30 }, lenient, opts)).toEqual([]);
  });

  it('requires a handover note only from the configured day count', () => {
    expect(validateLeaveRequest({ ...valid, requestedDays: 2, handoverNote: '' }, POLICY, opts)).toEqual([]);
    expect(validateLeaveRequest({ ...valid, requestedDays: 3, handoverNote: '' }, POLICY, opts)
      .some(e => e.includes('handover'))).toBe(true);
  });

  it('rejects a range containing no working days', () => {
    // Sat 3 – Sun 4 Oct 2026 is a weekend.
    const weekend = { ...valid, leaveCommences: '2026-10-03', leaveEnds: '2026-10-04', requestedDays: 0 };
    expect(validateLeaveRequest(weekend, POLICY, opts).some(e => e.includes('no working days'))).toBe(true);
  });

  it('blocks a conflicting overlap only when policy says block', () => {
    // TWO colleagues already away in production — that is the threshold.
    // Since the own-calendar fix, colleague requests travel in
    // departmentRequests; existingRequests is contractually the proposer's
    // OWN list and would trip the self-overlap block instead.
    const clash = [
      { employeeId: 'E2', department: 'production', status: 'approved', leaveCommences: '2026-11-04', leaveEnds: '2026-11-06' },
      { employeeId: 'E3', department: 'production', status: 'approved', leaveCommences: '2026-11-05', leaveEnds: '2026-11-06' },
    ];
    const withClash = { ...opts, departmentRequests: clash, department: 'production', employeeId: 'E1' };
    expect(validateLeaveRequest(valid, { ...POLICY, overlapBehaviour: 'warn' }, withClash)).toEqual([]);
    expect(validateLeaveRequest(valid, { ...POLICY, overlapBehaviour: 'block' }, withClash)
      .some(e => e.includes('already away'))).toBe(true);
  });

  it('honours a configured conflict threshold, not a hardcoded 2', () => {
    const colleagues = [
      { employeeId: 'E2', department: 'production', status: 'approved', leaveCommences: '2026-11-04', leaveEnds: '2026-11-06' },
      { employeeId: 'E3', department: 'production', status: 'approved', leaveCommences: '2026-11-05', leaveEnds: '2026-11-06' },
    ];
    const o = { ...opts, departmentRequests: colleagues, department: 'production', employeeId: 'E1' };
    // Threshold 3: two colleagues away is NOT a conflict any more.
    expect(validateLeaveRequest(valid, { ...POLICY, overlapBehaviour: 'block', conflictThreshold: 3 }, o)).toEqual([]);
    // Threshold 1: a single colleague is already a conflict.
    expect(validateLeaveRequest(valid, { ...POLICY, overlapBehaviour: 'block', conflictThreshold: 1 }, o)
      .some(e => e.includes('already away'))).toBe(true);
  });

  it('rejects an unknown leave type', () => {
    expect(validateLeaveRequest({ ...valid, leaveType: 'nonsense' }, POLICY, opts)
      .some(e => e.includes('type of leave'))).toBe(true);
  });

  it('tolerates being called with nothing at all', () => {
    expect(() => validateLeaveRequest(undefined, undefined, undefined)).not.toThrow();
    expect(validateLeaveRequest(undefined, undefined, undefined).length).toBeGreaterThan(0);
  });
});

// ─── The aberration fixes, each pinned by the finding that motivated it ────

describe('non-balance leave types are requestable again (found 26 Oct 2026)', () => {
  // THE WORST FINDING OF THE PASS: every compassionate, maternity and
  // examination request was refused as over-balance, because non-tracked
  // types have entitlement 0 and the balance check treated that as "zero
  // remaining". A member of staff could not file bereavement leave at all.
  const opts = {
    balance: calculateBalance({ entitlement: 0, carryOver: 0, alreadyTaken: 0, requestedDays: 3 }),
    today: d(2026, 10, 20),
  };
  const compassionate = {
    leaveType: 'compassionate', leaveCommences: '2026-12-07', leaveEnds: '2026-12-09',
    requestedDays: 3, purpose: 'Bereavement in the family.', handoverNote: 'Cover arranged with Ade.',
  };

  it('accepts a compassionate request — the balance rule no longer applies to it', () => {
    expect(validateLeaveRequest(compassionate, POLICY, opts)).toEqual([]);
  });

  it('accepts an examination request within its cap', () => {
    const exam = {
      leaveType: 'examination', leaveCommences: '2026-12-07', leaveEnds: '2026-12-16',
      requestedDays: 8, purpose: 'Final year exams.', handoverNote: 'Cover arranged with Ade.',
    };
    expect(validateLeaveRequest(exam, POLICY, opts)).toEqual([]);
  });

  it('caps non-tracked durations instead — compassionate beyond 5 working days is refused', () => {
    const long = { ...compassionate, leaveEnds: '2026-12-14', requestedDays: 6 };
    const errors = validateLeaveRequest(long, POLICY, opts);
    expect(errors.some(e => e.includes('capped at 5 working days'))).toBe(true);
  });

  it('caps examination at its own limit, and maternity at 60 working days', () => {
    const overExam = {
      leaveType: 'examination', leaveCommences: '2026-12-07', leaveEnds: '2026-12-22',
      requestedDays: 12, purpose: 'Exams.', handoverNote: '',
    };
    expect(validateLeaveRequest(overExam, POLICY, opts).some(e => e.includes('capped at 10'))).toBe(true);

    const longMaternity = {
      leaveType: 'maternity', leaveCommences: '2026-12-07', leaveEnds: '2027-03-02',
      requestedDays: 61, purpose: 'Maternity.', handoverNote: '',
    };
    expect(validateLeaveRequest(longMaternity, POLICY, opts).some(e => e.includes('capped at 60'))).toBe(true);
  });

  it('still enforces the balance for tracked types — annual is unchanged', () => {
    const greedy = {
      leaveType: 'annual', leaveCommences: '2026-12-07', leaveEnds: '2026-12-11',
      requestedDays: 5, purpose: '', handoverNote: '',
    };
    const broke = { balance: calculateBalance({ entitlement: 3, alreadyTaken: 0 }), today: d(2026, 10, 20) };
    expect(validateLeaveRequest(greedy, POLICY, broke).some(e => e.includes('remain'))).toBe(true);
  });
});

describe('pending days commit the balance (found 26 Oct 2026)', () => {
  // Two non-overlapping pending requests each showed a healthy snapshot;
  // both were signed; the combined taken went negative and no screen ever
  // added them up. Pending days now count as committed at creation.
  const opts = { balance: calculateBalance({ entitlement: 21, alreadyTaken: 11 }), today: d(2026, 10, 20) };
  // 10 remain. 6 are already awaiting approval.
  const pendingSix = {
    employeeId: 'E1', status: 'pending_hod', requestedDays: 6,
    leaveCommences: '2027-02-01', leaveEnds: '2027-02-08',
  };
  const ask = (days) => ({
    leaveType: 'annual', leaveCommences: '2027-03-01', leaveEnds: '2027-03-01',
    requestedDays: days, purpose: '', handoverNote: 'Cover arranged',
  });

  it('refuses a request that would overdraw the balance INCLUDING pending days', () => {
    const errors = validateLeaveRequest(ask(5), POLICY, { ...opts, existingRequests: [pendingSix] });
    expect(errors.some(e => e.includes('awaiting approval'))).toBe(true);
  });

  it('allows a request that fits within what pending has left alone', () => {
    expect(validateLeaveRequest(ask(4), POLICY, { ...opts, existingRequests: [pendingSix] })).toEqual([]);
  });

  it('ignores approved requests in the pending tally — they are already inside outstandingBefore', () => {
    const approvedSix = { ...pendingSix, status: 'approved' };
    expect(validateLeaveRequest(ask(5), POLICY, { ...opts, existingRequests: [approvedSix] })).toEqual([]);
  });

  it('ignores cancelled and rejected requests entirely', () => {
    const cancelled = { ...pendingSix, status: 'cancelled' };
    const rejected = { ...pendingSix, status: 'rejected' };
    expect(validateLeaveRequest(ask(5), POLICY, { ...opts, existingRequests: [cancelled, rejected] })).toEqual([]);
  });
});

describe('a person cannot double-book their own calendar (found 26 Oct 2026)', () => {
  const opts = { balance: calculateBalance({ entitlement: 21, alreadyTaken: 0 }), today: d(2026, 10, 20) };
  const ask = (start, end, days) => ({
    leaveType: 'annual', leaveCommences: start, leaveEnds: end,
    requestedDays: days, purpose: '', handoverNote: 'Cover arranged',
  });
  // The proposed range: Mon 2 Nov – Fri 6 Nov 2026.
  const proposed = ask('2026-11-02', '2026-11-06', 5);

  it('REFUSES a range overlapping the proposer\'s own PENDING request, and says to cancel it', () => {
    const pending = { employeeId: 'E1', status: 'pending_supervisor', leaveCommences: '2026-11-05', leaveEnds: '2026-11-09' };
    const errors = validateLeaveRequest(proposed, POLICY, { ...opts, existingRequests: [pending] });
    expect(errors.some(e => e.includes('Cancel it from My Leave first'))).toBe(true);
    expect(errors.some(e => e.includes('5 Nov'))).toBe(true);
  });

  it('REFUSES a range overlapping an APPROVED request, and points at HR', () => {
    const approved = { employeeId: 'E1', status: 'approved', leaveCommences: '2026-11-04', leaveEnds: '2026-11-06' };
    const errors = validateLeaveRequest(proposed, POLICY, { ...opts, existingRequests: [approved] });
    expect(errors.some(e => e.includes('Ask HR to cancel it'))).toBe(true);
  });

  it('REFUSES the identical range — the extreme case of the same rule', () => {
    const twin = { employeeId: 'E1', status: 'pending_hr', leaveCommences: '2026-11-02', leaveEnds: '2026-11-06' };
    expect(validateLeaveRequest(proposed, POLICY, { ...opts, existingRequests: [twin] }).length).toBeGreaterThan(0);
  });

  it('ALLOWS adjacent, back-to-back ranges — Friday ending, Monday starting', () => {
    const adjacent = { employeeId: 'E1', status: 'approved', leaveCommences: '2026-10-26', leaveEnds: '2026-10-30' };
    expect(validateLeaveRequest(proposed, POLICY, { ...opts, existingRequests: [adjacent] })).toEqual([]);
  });

  it('allows re-booking dates from a cancelled or rejected request', () => {
    const cancelled = { employeeId: 'E1', status: 'cancelled', leaveCommences: '2026-11-02', leaveEnds: '2026-11-06' };
    const rejected = { employeeId: 'E1', status: 'rejected', leaveCommences: '2026-11-03', leaveEnds: '2026-11-04' };
    expect(validateLeaveRequest(proposed, POLICY, { ...opts, existingRequests: [cancelled, rejected] })).toEqual([]);
  });

  it('findOwnOverlaps returns the live clashes and nothing else', () => {
    const live = [
      { employeeId: 'E1', status: 'pending_hod', leaveCommences: '2026-11-04', leaveEnds: '2026-11-05' },
      { employeeId: 'E1', status: 'approved', leaveCommences: '2026-12-01', leaveEnds: '2026-12-03' },
      { employeeId: 'E1', status: 'cancelled', leaveCommences: '2026-11-02', leaveEnds: '2026-11-06' },
      { employeeId: 'E1', status: 'rejected', leaveCommences: '2026-11-02', leaveEnds: '2026-11-06' },
    ];
    const clashes = findOwnOverlaps(proposed, live);
    expect(clashes).toHaveLength(1);
    expect(clashes[0].status).toBe('pending_hod');
  });
});

describe('spansLeaveYear — stated so approvers can see it', () => {
  it('detects a range crossing the year boundary', () => {
    expect(spansLeaveYear('2026-12-20', '2027-01-05', POLICY)).toBe(true);
  });

  it('passes ranges inside one year, and guards against missing dates', () => {
    expect(spansLeaveYear('2026-11-02', '2026-11-06', POLICY)).toBe(false);
    expect(spansLeaveYear(null, '2026-11-06', POLICY)).toBe(false);
  });
});

describe('getLeaveType', () => {
  it('finds a configured type', () => {
    expect(getLeaveType('annual', POLICY)?.label).toBe('Annual Leave');
  });

  it('returns null for an unknown type rather than throwing', () => {
    expect(getLeaveType('nope', POLICY)).toBeNull();
    expect(getLeaveType('annual', undefined)).toBeNull();
  });
});