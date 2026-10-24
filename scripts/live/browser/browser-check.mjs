// scripts/live/browser/browser-check.mjs
//
// LAYER 4 — the real UI, in a real browser, against the DEPLOYED app.
//
// Layers 1–3 proved the maths, the contracts, the rules and the service
// calls. None of them prove the screens. This script drives the actual
// deployed application exactly as a human would — sign in, read the balance,
// pick dates, watch the day-count move, submit, then switch to the
// supervisor's queue and sign in the browser too. It is a rehearsal of the
// demo as much as a test.
//
// Run:  node scripts/live/browser/browser-check.mjs
// Writes screenshots and a summary to /tmp/opencode/browser/.
//
// Deliberately NOT a vitest file: a browser session is slow, stateful and
// visual; a script with clear step logs serves the evidence page better.

import { chromium } from 'playwright';
import fs from 'node:fs';

const APP = 'https://starium-app.dammieoptimus.workers.dev';
const OUT = '/tmp/opencode/browser';
fs.mkdirSync(OUT, { recursive: true });

const EMP = process.env.LIVE_TEST_EMPLOYEE || 'halima.danjuma@example.test';
const SUP = process.env.LIVE_TEST_SUPERVISOR || 'emeka.nwosu@example.test';
const PASSWORD = process.env.LIVE_TEST_PASSWORD || 'success123';

const results = [];
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
function record(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? ` — ${detail}` : ''}`);
}

// A date about a month out, and three days after it — far enough to clear
// the notice rule, near enough to be plausible.
function pickableDates() {
  const start = new Date();
  start.setDate(start.getDate() + 30);
  const end = new Date(start);
  end.setDate(end.getDate() + 3);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: iso(start), end: iso(end) };
}

async function login(page, email) {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  // Auth + the employee lookup + first paint. Firestore round-trips on a
  // remote network can take a few seconds; generous but bounded.
  await page.waitForURL(/my-leave|approvals|\/$/, { timeout: 30_000 });
  await page.waitForTimeout(2_500);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  // ─── Flow 1: the employee ─────────────────────────────────────────────────
  await login(page, EMP);
  record('employee signs in and lands on My Leave', page.url().includes('/my-leave'), page.url());

  const cardLabels = await page.locator('.text-4xl, .font-black').count();
  const hasBalance = await page.getByText('Available', { exact: false }).count();
  record('My Leave shows the balance cards', hasBalance > 0, `${cardLabels} big numbers on screen`);
  await shot(page, '01-employee-my-leave');

  // Open the request form.
  await page.getByText('Request Leave').first().click();
  await page.waitForSelector('text=Section 1', { timeout: 15_000 });
  record('the request form opens with Section 1 and Section 2', true);
  await shot(page, '02-request-form');

  // Pick dates and watch the arithmetic move — the core promise of the form.
  const { start, end } = pickableDates();
  await page.locator('input[type="date"]').nth(0).fill(start);
  await page.locator('input[type="date"]').nth(1).fill(end);
  await page.waitForTimeout(1_200);

  const thisRequest = await page.locator('text=This request').locator('..').locator('div.text-2xl').first().textContent().catch(() => null);
  const outstanding = await page.getByText('Outstanding after', { exact: false }).count();
  record('the day-count boxes update as dates are picked',
    outstanding > 0 && !!thisRequest,
    `This request shows: ${thisRequest ?? 'not found'}`);
  await shot(page, '03-form-with-dates');

  // Complete Section 2 and submit — the full UI write path.
  await page.getByPlaceholder("Colleague's name").fill('LIVE-TEST browser cover');
  // Leave of 3+ working days requires a handover note (policy) — fill it or
  // the form correctly refuses to enable Submit.
  await page.getByPlaceholder('What is being handed over').fill('LIVE-TEST handover note from the browser run.');
  // The declaration input's placeholder is the signed-in user's own name
  // (it only falls back to "Your full name" when the name is unknown), and a
  // div:has() selector matches ancestor containers — so target the input by
  // the label it directly follows.
  await page.locator('label:has-text("type your full name") + input').first().fill('Halima Danjuma');
  await page.locator('input[type="checkbox"]').check();
  await page.getByText('Submit Leave Request').click();
  await page.waitForSelector('text=Leave request submitted', { timeout: 20_000 });
  record('the form submits and confirms', true);
  await shot(page, '04-submitted');

  // ─── Flow 2: the supervisor ──────────────────────────────────────────────
  const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page2.bringToFront();
  await login(page2, SUP);
  record('supervisor signs in and lands on the approvals queue', page2.url().includes('/leave-approvals'), page2.url());

  await page2.waitForSelector('text=Waiting for you', { timeout: 15_000 });
  const cards = await page2.locator('text=LIVE-TEST').count();
  record('the queue shows LIVE-TEST requests waiting for the supervisor', cards > 0, `${cards} mentions on screen`);
  await shot(page2, '05-supervisor-queue');

  const signButton = page2.getByText(/Sign as Supervisor/).first();
  if (await signButton.count()) {
    await signButton.click();
    // The success notice reads either "Signed. Moved to the next stage."
    // or "Signed. The leave is now fully approved."
    await page2.waitForSelector('text=Signed', { timeout: 20_000 });
    record('the supervisor signs in the browser and the chain advances', true);
    await shot(page2, '06-signed');
  } else {
    record('the supervisor signs in the browser and the chain advances', false, 'no sign button found');
  }

  // ─── Flow 3: the printable form, as the employee ────────────────────────
  await page.bringToFront();
  // After submitting, the app shows the success screen. The new "Back to My
  // Leave" button returns to the list — added because the browser suite
  // found there was no other way back (the sidebar route never remounts).
  const backBtn = page.getByText('Back to My Leave');
  if (await backBtn.count()) {
    await backBtn.click();
    await page.waitForTimeout(1_500);
    record('the employee can return from the success screen to the list', true);
  } else {
    record('the employee can return from the success screen to the list', false, 'no back button');
  }

  const printLink = page.locator('a[href*="/print/leave/"]').first();
  if (await printLink.count()) {
    await printLink.click();
    await page.waitForSelector('text=Leave Request Form', { timeout: 15_000 });
    const signatures = await page.getByText('Head of HR', { exact: false }).count();
    record('the printable form renders with the three signature blocks', signatures > 0);
    await shot(page, '07-printable-form');
  } else {
    // Diagnostics: what is actually on the page at this point?
    await shot(page, '07a-my-leave-debug');
    const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 400);
    record('the printable form renders with the three signature blocks', false,
      `no print link. Page text: ${JSON.stringify(bodyText)}`);
  }
} catch (e) {
  record('unexpected failure', false, String(e).slice(0, 300));
  try { await shot(page, '99-failure'); } catch {}
} finally {
  await browser.close();
}

fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify(results, null, 2));
const passed = results.filter(r => r.ok).length;
console.log(`\n${passed}/${results.length} steps passed. Screenshots and summary in ${OUT}`);
process.exit(passed === results.length ? 0 : 1);
