/**
 * EC Density Data Scanner - Node.js version
 * Run with: node scan-ec-density-node.js
 * Requires: GOOGLE_APPLICATION_CREDENTIALS env var pointing to service account JSON
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize with service account
const serviceAccount = require('./service-account.json'); // Place your service account JSON here

initializeApp({
  credential: cert(serviceAccount),
  projectId: 'starium-rafa-app'
});

const db = getFirestore();

async function scanECDensityData() {
  console.log('🔍 Scanning qc_tests collection...');
  
  const snapshot = await db.collection('qc_tests').get();
  console.log(`📄 Total documents: ${snapshot.size}`);
  
  const stats = {};
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const approvalDocId = data.approvalDocId || '';
    const match = approvalDocId.match(/^(level9|bot)_(DAY|NIGHT)_(\d{4}-\d{2}-\d{2})$/);
    if (!match) return;
    
    const [, mode, shift, date] = match;
    const key = `${date} | ${mode} | ${shift}`;
    
    if (!stats[key]) {
      stats[key] = { date, mode, shift, count: 0, teams: new Set(), qcNames: new Set() };
    }
    stats[key].count++;
    if (data.team) stats[key].teams.add(data.team);
    if (data.qcName) stats[key].qcNames.add(data.qcName);
  });
  
  const sorted = Object.values(stats)
    .sort((a, b) => b.date.localeCompare(a.date));
  
  console.log('\n📊 EC DENSITY DATA BY DATE/MODE/SHIFT:');
  console.log('='.repeat(100));
  console.log('Date       | Mode   | Shift | Tests | Teams        | QC Staff');
  console.log('-'.repeat(100));
  
  sorted.forEach(s => {
    const date = s.date;
    const mode = s.mode.toUpperCase().padEnd(6);
    const shift = s.shift.padEnd(5);
    const tests = String(s.count).padStart(5);
    const teams = [...s.teams].join(', ').padEnd(12) || '—'.padEnd(12);
    const qc = [...s.qcNames].join(', ') || '—';
    console.log(`${date} | ${mode} | ${shift} | ${tests} | ${teams} | ${qc}`);
  });
  
  // Summary
  const total = sorted.reduce((sum, s) => sum + s.count, 0);
  const dates = [...new Set(sorted.map(s => s.date))];
  const level9Total = sorted.filter(s => s.mode === 'level9').reduce((a, b) => a + b.count, 0);
  const botTotal = sorted.filter(s => s.mode === 'bot').reduce((a, b) => a + b.count, 0);
  
  console.log('\n📊 SUMMARY:');
  console.log(`   Total tests: ${total}`);
  console.log(`   Unique dates with data: ${dates.length}`);
  console.log(`   Date range: ${dates[dates.length-1]} to ${dates[0]}`);
  console.log(`   Level 9 tests: ${level9Total}`);
  console.log(`   BOT tests: ${botTotal}`);
  console.log(`   Best date: ${sorted[0]?.date} (${sorted[0]?.count} tests)`);
  
  // Date-only summary
  const byDate = {};
  sorted.forEach(s => {
    byDate[s.date] = (byDate[s.date] || 0) + s.count;
  });
  
  console.log('\n📅 BY DATE ONLY:');
  Object.entries(byDate)
    .sort(([a],[b]) => b.localeCompare(a))
    .forEach(([date, count]) => console.log(`   ${date}: ${count} tests`));
  
  return sorted;
}

scanECDensityData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });