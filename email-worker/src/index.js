// src/index.js — the Worker's front door.
//
// ONE endpoint: POST /send. The contract is deliberately narrow:
//
//   Authorization: Bearer <the caller's Firebase ID token>
//   Body: { requestId, event, stageId? }
//
// The caller names an event, never an address. Recipients are resolved from
// the live database (see firestore.js and resolve.js), the message is built
// from the templates in this repository (see templates.js), and delivery
// goes through the company Gmail (see smtp.js).
//
// WHAT A MALICIOUS CALLER CAN AND CANNOT DO:
//   - Cannot choose a recipient, or write a subject, or inject a body.
//   - Cannot trigger an event that does not match the request's real state —
//     resolveEvent returns null and nothing is sent.
//   - Cannot re-send an event that has already gone (the queue document in
//     Firestore is the authority: status 'sent' short-circuits here).
//   - CAN cause at most one legitimate, correctly-addressed email per
//     (request, event) pair that has not yet been sent. That is the entire
//     blast radius, and it is why there is no rate limiter: the ceiling is
//     structural, not statistical.
//
// The audit trail (queued → sent / failed) is written by the APP after this
// Worker responds, using its own authenticated write. This Worker stays
// stateless; if it never ran again the record would say 'queued' and the
// truth would be "not yet delivered" — which is still the truth.

import { verifyIdToken } from './jwt.js';
import { readDocument, queryRoleHolders } from './firestore.js';
import { resolveEvent } from './resolve.js';
import { buildMessage } from './templates.js';
import { sendMail } from './smtp.js';

// The events this Worker will ever send. Anything else is a 422 before a
// single byte of Firestore is read.
const EVENTS = new Set(['submitted', 'stage_signed', 'approved', 'rejected', 'lodged', 'cancelled', 'recalled']);

// CORS: the app is a browser app, so the call is cross-origin by nature.
// The deployed app domains plus local development. No wildcard — a wildcard
// would let any web page on the internet use a signed-in visitor's token to
// trigger mail, and the preflight is cheap to be precise about.
const ALLOWED_ORIGINS = [
  'https://starium-app.dammieoptimus.workers.dev',
  'https://starium-rafa-app.web.app',
  'https://starium-rafa-app.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:4173',
];

const json = (status, body, origin) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json',
    ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
  },
});

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : null;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...(corsOrigin ? { 'Access-Control-Allow-Origin': corsOrigin } : {}),
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (!corsOrigin) return json(403, { ok: false, error: 'Origin not allowed.' });
    if (request.method !== 'POST') return json(405, { ok: false, error: 'POST only.' }, corsOrigin);
    if (new URL(request.url).pathname !== '/send') return json(404, { ok: false, error: 'Not found.' }, corsOrigin);

    // 1. The caller must be a real, signed-in app user.
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const claims = await verifyIdToken(token, env.FIREBASE_PROJECT_ID);
    if (!claims) return json(401, { ok: false, error: 'Invalid or expired session.' }, corsOrigin);

    // 2. The payload must name a plausible event and a sane document id.
    let payload;
    try {
      payload = await request.json();
    } catch {
      return json(400, { ok: false, error: 'Malformed body.' }, corsOrigin);
    }
    const { requestId, event } = payload || {};
    if (!requestId || typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{10,40}$/.test(requestId)) {
      return json(400, { ok: false, error: 'Bad requestId.' }, corsOrigin);
    }
    if (!EVENTS.has(event)) {
      return json(422, { ok: false, error: 'Unknown event.' }, corsOrigin);
    }

    // 3. Dedupe: the app's queue document is the single authority on what
    //    has already been sent. Reading it with the caller's own token means
    //    the security rules stay the only gate.
    const projectId = env.FIREBASE_PROJECT_ID;
    const queueDoc = await readDocument(projectId, 'leave_notifications', `${requestId}_${event}`, token)
      .catch(() => null);
    if (queueDoc && queueDoc.status === 'sent') {
      return json(200, { ok: true, skipped: 'already-sent' }, corsOrigin);
    }

    // 4. Resolve the truth: the request, the policy, the employee, and —
    //    where the event needs them — the people holding the relevant
    //    approval role, each read through the caller's own token.
    const request_doc = await readDocument(projectId, 'leave_requests', requestId, token).catch(() => null);
    if (!request_doc) return json(404, { ok: false, error: 'Request not found.' }, corsOrigin);

    const policy = await readDocument(projectId, 'config', 'settings', token).catch(() => null);
    const leavePolicy = policy?.leavePolicy || null;

    const employee = request_doc.employeeId
      ? await readDocument(projectId, 'employees', request_doc.employeeId, token).catch(() => null)
      : null;

    // Which role's holders to notify, when the event is approver-facing.
    let holders = [];
    let roleToQuery = null;
    if (event === 'submitted') {
      roleToQuery = leavePolicy?.stages?.[0]?.actionRole || null;
    } else if (event === 'stage_signed') {
      const m = /^pending_(.+)$/.exec(String(request_doc.status || ''));
      const stage = (leavePolicy?.stages || []).find((s) => s.id === (m ? m[1] : null));
      roleToQuery = stage?.actionRole || null;
    } else if (event === 'cancelled') {
      // The stage it sat at before cancellation, if the caller said so. The
      // stageId is validated against the policy — it routes, it never grants.
      const stage = (leavePolicy?.stages || []).find((s) => s.id === payload.stageId);
      roleToQuery = stage?.actionRole || null;
    }
    if (roleToQuery) {
      holders = await queryRoleHolders(projectId, roleToQuery, token).catch(() => []);
    }

    // 5. Does this event make sense for this request, right now?
    const resolved = resolveEvent(event, { request: request_doc, employee, holders, policy: leavePolicy, queueDoc });
    if (!resolved) return json(422, { ok: false, error: 'Event not applicable to this request.' }, corsOrigin);
    if (resolved.skipped) return json(200, { ok: true, skipped: resolved.skipped }, corsOrigin);

    const message = buildMessage(event, {
      request: request_doc,
      stageLabel: resolved.stageLabel || null,
      reason: resolved.reason || null,
      actorEmail: resolved.actorEmail || null,
      appUrl: env.APP_URL,
    });
    if (!message || resolved.recipients.length === 0) {
      return json(422, { ok: false, error: 'No recipients for this event.' }, corsOrigin);
    }

    // 6. Deliver through the company Gmail, and say exactly what happened.
    try {
      const result = await sendMail({
        host: 'smtp.gmail.com',
        port: 465,
        user: env.GMAIL_USER,
        password: env.GMAIL_APP_PASSWORD,
        fromName: 'Starium Rafa ERP',
        recipients: resolved.recipients,
        subject: message.subject,
        body: message.body,
      });
      return json(200, { ok: true, recipients: result.accepted, rejected: result.rejected }, corsOrigin);
    } catch (error) {
      // Never leak the secret; the error text of an SMTP failure is ours.
      return json(502, { ok: false, error: 'Mail delivery failed.', detail: String(error.message || error).slice(0, 200) }, corsOrigin);
    }
  },
};
