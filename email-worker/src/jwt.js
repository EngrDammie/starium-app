// src/jwt.js — verifying that the caller is a real, signed-in app user.
//
// WHY THIS GATE EXISTS: the Worker can send mail as the company. Anyone who
// finds its URL must not be able to trigger a single email. Every request
// carries the caller's Firebase ID token; this module proves it was signed
// by Google for THIS project and has not expired. Only then does anything
// else run.
//
// The token is verified against Google's published keys — no shared secret
// between the app and this Worker, nothing to keep in sync.

import { createRemoteJWKSet, jwtVerify } from 'jose';

// Google publishes the public keys for Firebase ID tokens in JWK format at
// this well-known address. `jose` fetches and caches them for us.
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

// Firebase ID tokens: issuer is per-project, audience is the project id.
export async function verifyIdToken(token, projectId) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    return payload;
  } catch {
    return null;
  }
}
