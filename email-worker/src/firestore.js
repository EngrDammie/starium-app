// src/firestore.js — reading the live database THROUGH THE CALLER'S OWN EYES.
//
// The design decision this file exists to record (27 Oct 2026): the Worker
// holds no Google credentials at all. It reads Firestore's REST API using the
// SAME Firebase ID token the caller presented — so the security rules remain
// the single authority on what may be read, exactly as they are for the app.
// An authenticated caller may read leave requests, the roster and user_roles
// under the deployed rules; that is precisely what recipient resolution
// needs, and precisely nothing more.
//
// The consequence worth stating: recipients are resolved SERVER-SIDE from the
// truth. The caller names an event, never an address — so no matter what a
// malicious user posts to this Worker, they cannot make the company send
// mail to an address that is not already in its own records.

const BASE = (projectId) =>
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

async function fsFetch(path, token, body) {
  const res = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Firestore ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function readDocument(projectId, collection, docId, token) {
  const path = `${BASE(projectId)}/${collection}/${docId}`;
  const json = await fsFetch(path, token).catch(() => null);
  return json ? parseDocument(json) : null;
}

// A query for: all user_roles documents whose actionRoles include the role.
// Single-field array-contains queries run on Firestore's automatic indexes,
// so this needs no composite index of its own.
export async function queryRoleHolders(projectId, actionRole, token) {
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'user_roles' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'actionRoles' },
          op: 'ARRAY_CONTAINS',
          value: { stringValue: actionRole },
        },
      },
      limit: 25,
    },
  };
  const json = await fsFetch(`${BASE(projectId)}:runQuery`, token, body).catch(() => null);
  if (!json || !Array.isArray(json)) return [];
  return json
    .filter((row) => row.document)
    .map((row) => parseDocument(row.document))
    .filter(Boolean);
}

// ─── REST → plain object ────────────────────────────────────────────────────
// Firestore's REST API wraps every value in a typed envelope. Only the
// shapes this Worker actually reads are unwrapped — anything else passes
// through untouched rather than guessed at.

function parseValue(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(parseValue);
  if ('mapValue' in v) return parseDocument({ fields: v.mapValue.fields || {} });
  return null;
}

function parseDocument(doc) {
  const fields = doc.fields || {};
  const out = { id: (doc.name || '').split('/').pop() };
  for (const [key, value] of Object.entries(fields)) out[key] = parseValue(value);
  return out;
}
