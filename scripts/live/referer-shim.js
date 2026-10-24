// scripts/live/referer-shim.js
//
// LIVE HARNESS ONLY — never imported by the app.
//
// The project's Identity Platform blocks sign-in requests whose Referer is
// empty ("auth/requests-from-referer-<empty>-are-blocked"). In the browser the
// Referer is whatever authorised domain the app is served from, so users never
// see this. A Node test process has no Referer at all, so every sign-in is
// refused before the credentials are even checked.
//
// The shim adds the app's real production origin as the Referer on Firebase
// Auth calls — the same origin these very accounts already sign in from every
// day. It is not a security bypass: the accounts, passwords and Firestore
// rules are all fully real. It makes the test process look like the real app
// rather than like an anonymous script.

const APP_ORIGIN = 'https://starium-app.dammieoptimus.workers.dev';

const originalFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : (input && input.url) || String(input);
  if (/identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com/.test(url)) {
    const headers = new Headers((init && init.headers) || (input && input.headers) || {});
    if (!headers.has('Referer')) {
      headers.set('Referer', APP_ORIGIN);
    }
    return originalFetch(input, { ...init, headers });
  }
  return originalFetch(input, init);
};

console.log('[live harness] Referer shim active for Firebase Auth calls:', APP_ORIGIN);
