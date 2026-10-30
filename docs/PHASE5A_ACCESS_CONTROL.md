# Phase 5A Account Access Control

## 1. Status

**PASS.** The reported unauthenticated service-role account-deletion route was confirmed in the pre-Phase-5A source and is protected in the current source. Account deletion now requires a bearer access token verified by Supabase Auth, derives every deletion target from that verified user, and keeps the former path route only as a protected compatibility endpoint. All authorization coverage used isolated mocks; no real account, production Supabase project, email, payment, deployment, or credential was changed.

## 2. Confirmed root cause and affected routes

The vulnerable route was `DELETE /account/:userId` in `server/index.js`. It had no authentication middleware and treated `req.params.userId` as authoritative. The server-wide Supabase client is initialized with `SUPABASE_SERVICE_KEY`, so an unauthenticated caller could cause these privileged operations for an arbitrary path ID:

1. Delete `documents` rows where `user_id` equalled the path value.
2. Delete `payments` rows where `user_id` equalled the path value.
3. Delete the `profiles` row where `id` equalled the path value.
4. Call `supabase.auth.admin.deleteUser(pathUserId)`.

The old handler also ignored errors from the three database cleanup calls, so it could report success after incomplete row cleanup if the final Auth deletion succeeded.

The directly analogous active route was `POST /format`. It accepted `req.body.userId` and used it for the service-role `documents` history insert after formatting. This did not delete an account, but it allowed request-supplied identity to determine a privileged history-write target.

The active payment routes still accept request identity when monetization is enabled. They remain disabled by default and return `403 MONETIZATION_DISABLED` before provider or database work. They were not reactivated or rewritten in this phase; their reactivation defects remain recorded below.

## 3. Complete secured call chain

The account UI flow is now:

1. `Profile.jsx` asks for explicit destructive-action confirmation and sets a pending state.
2. `useAuth.jsx` calls `requestCurrentAccountDeletion` and does not clear account state or navigate early.
3. `accountDeletion.js` reads the current Supabase session and sends `DELETE /account` once with `Authorization: Bearer <access_token>`. It does not send a target user ID and does not retry.
4. `accessControl.js` strictly parses the bearer header and calls `supabase.auth.getUser(accessToken)`. A decoded token, frontend state, metadata, request role, and request target are not trusted.
5. Only after verification succeeds, the deletion handler reads `req.authenticatedUser.id` and scopes all service-role cleanup to that ID.
6. Cleanup runs in the existing bounded order: `documents.user_id`, `payments.user_id`, `profiles.id`, then `auth.admin.deleteUser(id)`.
7. Only a confirmed HTTP success causes the client to sign out, clear local account/history state, close dialogs, and navigate home.

The compatibility route `DELETE /account/:userId` uses the same authentication middleware and returns `403 ACCOUNT_FORBIDDEN` before cleanup if its path ID differs from the verified identity. It cannot bypass the self-service route.

No Supabase Storage bucket access or account-owned stored-object path exists in the repository. Uploaded inputs and generated downloads use server-local temporary directories and their existing processing/download cleanup; there is therefore no account-specific Storage target to broaden into this deletion sequence. The `documents` table is the current history record cleanup.

## 4. Authentication, authorization and failure behavior

- Missing or malformed credentials: `401 UNAUTHORIZED`; token verification and privileged cleanup do not run.
- Invalid, expired or forged tokens rejected by Supabase verification: `401 UNAUTHORIZED`; cleanup does not run.
- Verified user targeting a different path ID: `403 ACCOUNT_FORBIDDEN`; cleanup does not run.
- Auth verification service failure or exception: sanitized `503 AUTH_SERVICE_UNAVAILABLE`; cleanup does not run.
- Cleanup failure: sanitized `500 ACCOUNT_DELETION_INCOMPLETE` with the names of completed stages. Later stages stop immediately.
- Success: every row filter and the Auth deletion use the verified `data.user.id` only.

Database and Auth operations are not claimed to be transactional. If a later cleanup stage fails, earlier deletions may already be permanent. The server reports the completed stages truthfully, and the frontend warns that some data may already have been removed and advises contacting support before retrying. There is no automatic destructive retry.

For `POST /format`, authentication is optional so public formatting remains available. An anonymous request without a supplied identity formats normally and skips history. A request that supplies `userId` without verified credentials receives `401`; a verified token plus a different supplied ID receives `403`; a verified request records history only for the verified user. Authentication runs before upload middleware, and any identity denial after multipart parsing removes the uploaded input before returning.

## 5. Files changed for Phase 5A

- `server/accessControl.js`: shared bearer parsing, Supabase token verification, verified-identity resolution, protected self-service/compatibility routes, bounded deletion, and truthful partial-failure responses.
- `server/index.js`: removed the unauthenticated deletion handler, registered protected account routes, and applied optional verified identity to formatter history writes.
- `server/test/accessControl.test.js`: HTTP routing/middleware regression suite with isolated Auth and service-role mocks.
- `client/src/lib/accountDeletion.js`: current-session token attachment, self-service request, sanitized error mapping, and no retry behavior.
- `client/test/accountDeletion.test.js`: bearer/self-service, expired-session zero-request, and partial-failure/no-retry coverage.
- `client/src/hooks/useAuth.jsx`: waits for confirmed server success before sign-out or local state clearing.
- `client/src/components/dashboard/Profile.jsx`: preserves explicit confirmation and displays actionable failure state while keeping the account UI intact.
- `client/src/pages/Tool.jsx`: sends the current access token for authenticated formatting instead of supplying an unverified history user ID.
- `client/scripts/phase5a-account-ui-qa.mjs`: isolated desktop/mobile UI failure-path QA.
- `docs/PHASE5A_ACCESS_CONTROL.md` and `docs/UPDATE_STATUS.md`: Phase 5A security record and current status.

## 6. Executable verification results

- `cd server && npm test`: **PASS, 16/16** total (9 access-control, 3 upload-validation, 4 monetization tests).
  - Missing token covers both `/account` and legacy `/account/:userId`: zero verification calls and zero privileged calls.
  - Malformed header: zero verification calls and zero privileged calls.
  - Invalid, expired and forged token strings: verification attempted; zero privileged calls.
  - Verified user A targeting user B: `403`; zero privileged calls.
  - Verified user A success: exactly three row deletes and one Auth delete, all targeting `user-a` with the expected columns.
  - Auth-service failure: `503`; zero privileged calls.
  - Database cleanup failure: later destructive steps do not run and completed stages are truthful.
  - Auth-record failure: completed database stages are truthful and every call remains scoped to `user-a`.
  - Anonymous formatting identity: allowed with no history identity; forged anonymous history identity receives `401`; zero privileged calls in the identity harness.
- `cd client && npm test`: **PASS, 15/15** total (3 account-deletion, 6 free-mode/payment, 6 theme tests).
  - The client sends one request to `/account` with the current bearer token and no target ID.
  - A missing local session sends zero destructive requests.
  - A partial server failure is surfaced and is not retried.
- `cd client && npm run build`: **PASS**; output JS is 597.00 kB and the existing greater-than-500-kB chunk warning remains.
- `cd client && npm run lint`: baseline unchanged at **1 error and 5 warnings**. The error remains the pre-existing Fast Refresh export finding in `useAuth.jsx`; the five existing hook-dependency warnings remain in Overview, Profile, Subscription, `useAuth.jsx`, and Tool.
- Backend syntax: `node --check index.js`, `accessControl.js`, `payments.js`, and `test/accessControl.test.js`: **PASS**.
- Scoped `git diff --check` for the access-control implementation: **PASS**.
- Browser UI fallback: `PHASE5A_APP_URL=http://127.0.0.1:5173/ node scripts/phase5a-account-ui-qa.mjs`: **PASS** at 1440x900 and 390x844. The in-app browser connection was unavailable, so the established local Chrome/Playwright fallback was used. Both fixture runs confirmed the explicit confirmation, expired-session message, enabled retry button, retained account state, zero destructive network requests, zero console errors, and no horizontal overflow. Evidence: `phase5-test-run/evidence/phase5a-account-delete-desktop.png` and `phase5a-account-delete-mobile.png`.
- Existing targeted local HTTP evidence records `401` for missing/malformed deletion credentials and a successful anonymous formatter response. The real document-output suite was not repeated because processors were not changed in Phase 5A.

## 7. Mocked versus live verification

Auth verification and privileged Supabase operations were mocked while exercising real Express routing and middleware. The success test proves all mocked filters derive from the verified mock identity; it is not evidence of live Supabase token verification, RLS, or cross-service deletion behavior.

The browser check used a development-only account fixture and an absent local Supabase session. It made no deletion request. The anonymous formatter evidence used the local backend and synthetic input, not a live account. No real account was created, modified, or deleted, and no production Supabase project was contacted intentionally.

## 8. Remaining account-access findings and release blockers

- Client-side profile/history reads and profile updates use the browser Supabase client and session identity. Their security ultimately depends on Supabase Row Level Security policies, but database migrations/policy definitions are not present in this repository and no isolated live project was authorized for verification. Live RLS and account lifecycle verification remain release blockers.
- Cross-service deletion is non-transactional. A later failure can leave a partially deleted account; recovery remains a manual support/reconciliation limitation.
- Payment reactivation remains blocked: enabled handlers lack verified server-side user identity and ownership checks, trust request `userId`, do not retrieve and validate captured order/payment amount/currency/ownership independently, and perform non-transactional profile/history writes. Monetization remains disabled.
- Phase 5 dependency findings and the public-product Licence wording review remain unresolved release blockers.
- Live login, session expiry/refresh, logout, history reads/writes, profile RLS, and real Supabase failure behavior still require an explicitly isolated test project/account.

Stopped after Phase 5A. Awaiting review.
