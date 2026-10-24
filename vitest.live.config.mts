// vitest.live.config.mts
//
// The configuration for the LIVE test suite: scripts/live/*.test.js.
//
// These tests sign in to the real Firebase project as real users and exercise
// the app's real service functions against the production database. The
// main vitest.config.js already restricts `npm test` (and therefore CI) to
// tests under src/, so the live suite can never run by accident — this file
// makes the other half of the split explicit: it is reached only by typing
//
//   npm run test:live
//
// Conventions the live suite MUST follow, checked by review if not by code:
//   - every document created carries LIVE-TEST in its text, so the owner can
//     find and delete them afterwards (deletes are owner-only by design);
//   - no test deletes anything it did not create;
//   - no test uses a real employee's account.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scripts/live/**/*.{test,spec}.{js,jsx}'],
    environment: 'node',
    globals: false,
    setupFiles: ['./scripts/live/referer-shim.js'],
    // Live round-trips include network writes to Firestore, which can take
    // seconds each. The default 5s timeout produces flaky failures that
    // look like bugs in the app.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Live tests are inherently ordered: a request created in one test is
    // approved in the next. Parallel workers would race the chain.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
