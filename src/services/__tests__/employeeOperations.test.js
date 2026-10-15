import { describe, it, expect, vi } from 'vitest';

// employeeOperations imports the real firebase module at load time, so it is
// mocked out here. Only the pure helpers below are exercised — they are the
// ones with logic worth pinning down.
vi.mock('../../config/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(),
  addDoc: vi.fn(), setDoc: vi.fn(), updateDoc: vi.fn(), deleteDoc: vi.fn(),
  query: vi.fn(), where: vi.fn(), onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'), orderBy: vi.fn(),
}));

import { normaliseSapNumber, normaliseEmail, buildFullName } from '../employeeOperations';

describe('normaliseSapNumber', () => {
  it('upper-cases and trims, so one person cannot become three', () => {
    expect(normaliseSapNumber('st-0421')).toBe('ST-0421');
    expect(normaliseSapNumber(' ST-0421 ')).toBe('ST-0421');
    expect(normaliseSapNumber('St-0421')).toBe('ST-0421');
  });

  it('treats padded and untrimmed variants as identical', () => {
    const variants = ['st-0421', 'ST-0421', ' ST-0421', 'st-0421 ', '\tST-0421\n'];
    expect(new Set(variants.map(normaliseSapNumber)).size).toBe(1);
  });

  it('returns an empty string for nullish input rather than throwing', () => {
    expect(normaliseSapNumber(null)).toBe('');
    expect(normaliseSapNumber(undefined)).toBe('');
    expect(normaliseSapNumber('')).toBe('');
  });

  it('does not collapse genuinely different numbers', () => {
    expect(normaliseSapNumber('ST-0421')).not.toBe(normaliseSapNumber('ST-0422'));
    expect(normaliseSapNumber('ST-0421')).not.toBe(normaliseSapNumber('ST-1042'));
  });
});

describe('normaliseEmail', () => {
  it('lower-cases and trims, so login matching is case-insensitive', () => {
    expect(normaliseEmail('Robert@Example.COM')).toBe('robert@example.com');
    expect(normaliseEmail('  Robert@Example.com  ')).toBe('robert@example.com');
  });

  it('is nullish-safe', () => {
    expect(normaliseEmail(undefined)).toBe('');
    expect(normaliseEmail(null)).toBe('');
  });
});

describe('buildFullName', () => {
  it('joins first and last name', () => {
    expect(buildFullName('robert', 'eneh')).toBe('robert eneh');
  });

  it('copes with only one name present', () => {
    expect(buildFullName('robert', '')).toBe('robert');
    expect(buildFullName('', 'eneh')).toBe('eneh');
  });

  it('returns an empty string when both are missing', () => {
    expect(buildFullName(null, undefined)).toBe('');
    expect(buildFullName('  ', '  ')).toBe('');
  });

  it('trims stray whitespace so names never render with double spaces', () => {
    expect(buildFullName('  robert ', '  eneh  ')).toBe('robert eneh');
  });
});