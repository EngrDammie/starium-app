import { describe, it, expect } from 'vitest';
import { buildShiftIdentifiers, calculateTrend } from '../reportUtils';
import { formatCountdown, formatTime, pluralize } from '../formatUtils';

describe('buildShiftIdentifiers', () => {
  it('builds DAY/NIGHT pairs per day, oldest first, flagging current', () => {
    const ids = buildShiftIdentifiers('DAY', '2026-06-15', 2);
    expect(ids).toHaveLength(4);
    expect(ids[0]).toMatchObject({ shift: 'DAY', date: '2026-06-14' });
    expect(ids[1]).toMatchObject({ shift: 'NIGHT', date: '2026-06-14' });
    expect(ids[2]).toMatchObject({ shift: 'DAY', date: '2026-06-15', isCurrent: true });
    expect(ids[3]).toMatchObject({ shift: 'NIGHT', date: '2026-06-15', isCurrent: false });
  });
});

describe('calculateTrend', () => {
  it('detects improving / worsening / stable series', () => {
    expect(calculateTrend([10, 8, 6, 4])).toBe('improving');
    expect(calculateTrend([4, 6, 8, 10])).toBe('worsening');
    expect(calculateTrend([5, 5.01, 5, 5.02])).toBe('stable');
  });
  it('returns stable for short or empty series', () => {
    expect(calculateTrend([])).toBe('stable');
    expect(calculateTrend([5])).toBe('stable');
    expect(calculateTrend([null, undefined, NaN])).toBe('stable');
  });
});

describe('formatCountdown', () => {
  it('formats ms as m:ss', () => {
    expect(formatCountdown(90000)).toBe('1:30');
    expect(formatCountdown(61000)).toBe('1:01');
  });
  it('returns null for null/zero/negative', () => {
    expect(formatCountdown(null)).toBeNull();
    expect(formatCountdown(0)).toBeNull();
    expect(formatCountdown(-5)).toBeNull();
  });
});

describe('formatTime', () => {
  it('returns empty string for falsy input', () => {
    expect(formatTime(null)).toBe('');
    expect(formatTime(undefined)).toBe('');
  });
  it('handles Firestore-style timestamps with toDate()', () => {
    const fake = { toDate: () => new Date(2026, 5, 15, 14, 30) };
    expect(formatTime(fake)).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('pluralize', () => {
  it('returns singular for exactly 1', () => {
    expect(pluralize(1, 'carton')).toBe('carton');
  });
  it('returns default plural otherwise', () => {
    expect(pluralize(0, 'carton')).toBe('cartons');
    expect(pluralize(5, 'carton')).toBe('cartons');
    expect(pluralize(10, 'carton')).toBe('cartons');
  });
  it('supports custom plurals', () => {
    expect(pluralize(2, 'silo', 'silos')).toBe('silos');
    expect(pluralize(1, 'buggy', 'buggies')).toBe('buggy');
    expect(pluralize(6, 'buggy', 'buggies')).toBe('buggies');
  });
});
