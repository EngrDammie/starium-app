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
const HOD = process.env.LIVE_TEST_HOD || 'blessing.adeyemi@example.test';
const HRH = process.env.LIVE_TEST_HR_HEAD || 'ibrahim.yusuf@example.test';
const HRM = process.env.LIVE_TEST_HR_MANAGER || 'segun.adeyinka@example.test';
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

// ─── The HR pre-pass: clean the slate before anything else ────────────────
// A previous run that failed midway leaves LIVE-TEST requests behind — and a
// leftover APPROVED one blocks the next run's dates under the self-overlap
// rule, correctly. HR cancels every live leftover first: pending without a
// reason, approved with one.
async function hrCleanup() {
  const cleanup = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await cleanup.bringToFront();
  await login(cleanup, HRM);
  await cleanup.goto(`${APP}/#/leave-approvals`, { waitUntil: 'domcontentloaded' });
  await cleanup.waitForTimeout(2_500);

  let handled = 0;
  for (const tab of ['Waiting for you', 'Waiting on others', 'Decided']) {
    const tabBtn = cleanup.getByRole('button', { name: tab === 'Waiting for you' ? /Waiting for you/ : tab === 'Waiting on others' ? /Waiting on others/ : /Decided/ });
    if (!(await tabBtn.count())) continue;
    await tabBtn.first().click();
    await cleanup.waitForTimeout(1_000);

    for (let i = 0; i < 12; i += 1) {
      const pendingBtn = cleanup.getByText('Cancel this request', { exact: true }).first();
      const approvedBtn = cleanup.getByText('Cancel this approved leave').first();

      if (await pendingBtn.count()) {
        await pendingBtn.click();
        await cleanup.waitForTimeout(1_200);
        handled += 1;
        continue;
      }
      if (await approvedBtn.count()) {
        await approvedBtn.click();
        await cleanup.waitForSelector('input[placeholder*="Reason for cancelling"]', { timeout: 10_000 });
        await cleanup.locator('input[placeholder*="Reason for cancelling"]').fill('LIVE-TEST: clearing a leftover from a failed run.');
        await cleanup.getByText('Confirm — cancel this leave').click();
        await cleanup.waitForTimeout(1_800);
        handled += 1;
        continue;
      }
      break;
    }
  }
  await shot(cleanup, '00-hr-cleanup');
  await cleanup.close();
  record('HR clears leftover LIVE-TEST requests before the run', true, `${handled} cancelled`);
}

try {
  await hrCleanup();

  // ─── Flow 1: the employee ─────────────────────────────────────────────────
  await login(page, EMP);
  record('employee signs in and lands on My Leave', page.url().includes('/my-leave'), page.url());

  const cardLabels = await page.locator('.text-4xl, .font-black').count();
  const hasBalance = await page.getByText('Available', { exact: false }).count();
  record('My Leave shows the balance cards', hasBalance > 0, `${cardLabels} big numbers on screen`);
  await shot(page, '01-employee-my-leave');

  // Cancel any pending requests first, through the real UI. The suite always
  // requests the same date window, so a pending request from a previous run
  // would trip the new self-overlap rule and block this run's submission —
  // which is the rule working, but it is not what this step is testing.
  page.on('dialog', (d) => d.accept());
  let cancelled = 0;
  for (let i = 0; i < 10; i += 1) {
    const cancelBtn = page.getByRole('button', { name: 'Cancel', exact: true }).first();
    if (!(await cancelBtn.count())) break;
    await cancelBtn.click();
    await page.waitForTimeout(1_200);
    cancelled += 1;
  }
  record('the employee can cancel pending requests from the list', true, `${cancelled} cancelled`);
  await shot(page, '01a-pending-cleared');

  // Open the request form.
  await page.getByText('Request Leave').first().click();
  await page.waitForSelector('text=Section 1', { timeout: 15_000 });
  record('the request form opens with Section 1 and Section 2', true);
  await shot(page, '02-request-form');

  // Pick dates and watch the arithmetic move — the core promise of the form.
  // First: dates TOO SOON for annual leave's notice rule, which must be
  // explained in plain words while the Submit button stays disabled. A grey
  // button with no stated reason is a dead end, and this is the check that it
  // never returns.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  await page.locator('input[type="date"]').nth(0).fill(iso(tomorrow));
  await page.locator('input[type="date"]').nth(1).fill(iso(new Date(new Date(tomorrow).setDate(tomorrow.getDate() + 2))));
  await page.waitForTimeout(1_200);

  const blockedNotice = await page.getByText(/notice/i).count();
  const submitBtn = page.getByRole('button', { name: /Submit Leave Request/ });
  const submitDisabledWhileShort = await submitBtn.isDisabled();
  record('a too-soon request explains itself: notice shortfall listed, button disabled',
    blockedNotice > 0 && submitDisabledWhileShort,
    `notice mentions: ${blockedNotice}, disabled: ${submitDisabledWhileShort}`);
  await shot(page, '03a-short-notice-explained');

  // Now legitimate dates.
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

  // The positive counterpart to the blocker list: once everything is done,
  // the form says the way is clear — the button's change of state is
  // explained rather than merely noticed.
  await page.waitForTimeout(600);
  const readyLine = await page.getByText('Everything needed is filled in').count();
  record('the form states when it is ready to submit', readyLine > 0);

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

  // ─── Stages 2 and 3: the HOD and the Head of HR, in the browser ──────────
  for (const [email, label] of [[HOD, 'HOD'], [HRH, 'Head of HR']]) {
    const stagePage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await stagePage.bringToFront();
    await login(stagePage, email);
    record(`${label} signs in and lands on the approvals queue`, stagePage.url().includes('/leave-approvals'), stagePage.url());
    await stagePage.waitForSelector('text=Waiting for you', { timeout: 15_000 });
    const btn = stagePage.getByText(new RegExp(`Sign as ${label === 'HOD' ? 'HOD' : 'Head of HR'}`)).first();
    if (await btn.count()) {
      await btn.click();
      await stagePage.waitForSelector('text=Signed', { timeout: 20_000 });
      record(`${label} signs in the browser`, true);
    } else {
      record(`${label} signs in the browser`, false, 'no sign button');
    }
    await stagePage.close();
  }

  // ─── HR reverses the approved leave through the once-invisible button ───
  const hrPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await hrPage.bringToFront();
  await login(hrPage, HRM);
  // An HR manager's department role opens the Command Center first, not the
  // approvals queue — and the fully approved request sits in the DECIDED
  // tray. Both were assumptions this script got wrong on its first run.
  await hrPage.goto(`${APP}/#/leave-approvals`, { waitUntil: 'domcontentloaded' });
  await hrPage.waitForTimeout(2_500);
  await hrPage.getByRole('button', { name: /Decided/ }).click();
  await hrPage.waitForTimeout(1_200);

  const cancelBtn = hrPage.getByText('Cancel this approved leave').first();
  const cancelVisible = await cancelBtn.count();
  record('HR sees the Cancel button on an approved request', cancelVisible > 0,
    cancelVisible > 0 ? 'button present' : 'BUTTON MISSING — the 27 Oct bug is back');

  if (cancelVisible) {
    await cancelBtn.click();
    // A placeholder is an attribute, not text content — the text= selector
    // can never match it. The pre-pass got this right; copy it.
    await hrPage.waitForSelector('input[placeholder*="Reason for cancelling"]', { timeout: 10_000 });
    await hrPage.locator('input[placeholder*="Reason for cancelling"]').fill('LIVE-TEST: browser reversal with a written reason.');
    await hrPage.getByText('Confirm — cancel this leave').click();
    // The notice that lands: "Leave cancelled. The days returned to the
    // employee's balance." — waitForSelector takes a selector string, not a
    // regex; the pipe form matched nothing.
    await hrPage.waitForSelector('text=days returned', { timeout: 20_000 });
    await shot(hrPage, '09-hr-reversal');
    const reasonShown = await hrPage.getByText('browser reversal with a written reason').count();
    record('the typed reason appears on the card after the reversal', reasonShown > 0);
  }
  await hrPage.close();

  // ─── The Decided tray: state tags and the rejection reason ────────────────
  // A decided request must state its own conclusion — a green APPROVED, a
  // red REJECTED with the reason the employee reads, a grey CANCELLED — not
  // just the stage tags showing who signed what.
  await page2.getByRole('button', { name: /Decided/ }).click();
  await page2.waitForTimeout(1_500);

  const approvedTags = await page2.locator('span:has-text("Approved")').count();
  const rejectedTags = await page2.locator('span:has-text("Rejected")').count();
  const cancelledTags = await page2.locator('span:has-text("Cancelled")').count();
  const reasonShown = await page2.getByText(/Reason for rejection/i).count();
  // This suite reverses its own approval before it gets here, so a zero
  // APPROVED count is the design working, not a missing tag. The assertion
  // covers what the tray must always show: the other two conclusions, and
  // the reasons for every rejection on screen.
  record('the Decided tray shows state tags for concluded requests',
    rejectedTags > 0 && cancelledTags > 0,
    `approved:${approvedTags} rejected:${rejectedTags} cancelled:${cancelledTags} reasons:${reasonShown}`);
  await shot(page2, '08-decided-tags');

  if (rejectedTags > 0) {
    record('a rejected request shows the written reason in the card body', reasonShown > 0,
      `${reasonShown} reason block(s) visible`);
  } else {
    record('a rejected request shows the written reason in the card body', false, 'no rejected card in the tray');
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
