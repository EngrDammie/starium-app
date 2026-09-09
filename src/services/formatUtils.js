// src/services/formatUtils.js
//
// Tiny pure display formatters shared by QC pages. Extracted so they are
// unit-tested and reusable instead of re-defined per page.

export function formatCountdown(ms) {
  if (ms === null || ms <= 0) return null;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatTime(timestamp) {
  if (!timestamp) return '';
  const d = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Singular/plural unit label: pluralize(1, 'carton') → 'carton',
// pluralize(5, 'carton') → 'cartons'. Used for dashboard card units.
export function pluralize(count, singular, plural = `${singular}s`) {
  return Number(count) === 1 ? singular : plural;
}
