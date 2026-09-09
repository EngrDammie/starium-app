// src/services/reportUtils.js
//
// Shared pure helpers for the waste report pages.
//
// WHY THIS FILE EXISTS (for the next developer):
// CartonWasteReport and LaminateWasteReport each carried byte-identical
// copies of buildShiftIdentifiers() and calculateTrend(). They now live
// here, unit-tested, imported by both pages. If you change cross-shift
// logic, change it here — both reports follow automatically.

export function buildShiftIdentifiers(currentShift, targetDateStr, count) {
  const targetDate = new Date(targetDateStr);
  const results = [];

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(targetDate);
    d.setDate(d.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const shortDate = `${month}/${day}`;

    for (const shift of ['DAY', 'NIGHT']) {
      results.push({
        shift,
        date: dateStr,
        shortDate,
        isCurrent: i === 0 && shift === currentShift
      });
    }
  }

  return results;
}

// Least-squares slope trend over a series of waste% values.
// Returns 'improving' | 'worsening' | 'stable'.
export function calculateTrend(values) {
  const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (validValues.length < 2) return 'stable';

  const n = validValues.length;
  const indices = validValues.map((_, i) => i);
  const sumX = indices.reduce((s, x) => s + x, 0);
  const sumY = validValues.reduce((s, y) => s + y, 0);
  const sumXY = indices.reduce((s, x, i) => s + x * validValues[i], 0);
  const sumXX = indices.reduce((s, x) => s + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  if (Math.abs(slope) < 0.05) return 'stable';
  return slope < 0 ? 'improving' : 'worsening';
}
