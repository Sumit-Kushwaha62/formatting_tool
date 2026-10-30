# Phase 5B Dependency Vulnerability Remediation

## 1. Status

**PASS.** Fresh registry audits were available and all verified root, client production, client full-tree, and server production findings were remediated with scoped compatible changes. Final audits report zero vulnerabilities in every matching scope. No advisory was suppressed, no override was added, and `npm audit fix --force` was not used.

Phase 5A identity controls, anonymous formatting, free mode, disabled payments, upload validation, theme/UI behavior, processors, production credentials/data, and live Supabase accounts were not changed.

## 2. Environment and exact baseline

- Verification host: Windows, Node `v22.22.2`, npm `10.9.7`.
- Root production audit: **2 package findings** (`react-router`, `react-router-dom`).
- Client production audit: **5 package findings** (1 low, 4 high aggregate package severities).
- Client full audit: **12 package findings** (2 low, 1 moderate, 9 high aggregate package severities).
- Server production/full audit: **8 package findings** (1 low, 2 moderate, 5 high aggregate package severities); the server has no development dependencies.

Package counts are npm's aggregate vulnerable-package counts, not advisory counts and not proof of exploitability.

## 3. Production findings, chains, reachability and remediation

| Tree and chain | Before -> after | Advisory IDs and authoritative URLs | Evidence-based reachability | Remediation |
|---|---|---|---|---|
| Client direct `axios` | `1.16.0` -> `1.18.0` | [GHSA-xj6q-8x83-jv6g](https://github.com/advisories/GHSA-xj6q-8x83-jv6g), [GHSA-mmx7-hfxf-jppx](https://github.com/advisories/GHSA-mmx7-hfxf-jppx), [GHSA-pmv8-rq9r-6j72](https://github.com/advisories/GHSA-pmv8-rq9r-6j72), [GHSA-mwf2-3pr3-8698](https://github.com/advisories/GHSA-mwf2-3pr3-8698), [GHSA-gcfj-64vw-6mp9](https://github.com/advisories/GHSA-gcfj-64vw-6mp9), [GHSA-7q8q-rj6j-mhjq](https://github.com/advisories/GHSA-7q8q-rj6j-mhjq), [GHSA-jqh4-m9w3-8hp9](https://github.com/advisories/GHSA-jqh4-m9w3-8hp9), [GHSA-f4gw-2p7v-4548](https://github.com/advisories/GHSA-f4gw-2p7v-4548), [GHSA-42h9-826w-cgv3](https://github.com/advisories/GHSA-42h9-826w-cgv3), [GHSA-hcpx-6fm6-wx23](https://github.com/advisories/GHSA-hcpx-6fm6-wx23) | Axios is active in formatter, Contact and preserved payment code. The app creates request options itself; no prototype-polluted option source, HTTP/2 Node adapter, or attacker-controlled form serializer configuration was demonstrated. Active dependency, exact vulnerable gadgets not demonstrated. | Smallest fixed Axios line from the fresh audit, no API change required in current calls. |
| Client `axios -> form-data` | `4.0.5` -> `4.0.6` | [GHSA-hmw2-7cc7-3qxx](https://github.com/advisories/GHSA-hmw2-7cc7-3qxx) | Node multipart implementation is not used by the browser adapter/bundle based on source and build evidence; not reachable in the active browser path. | Compatible transitive patch within Axios's range. |
| Client `@supabase/supabase-js -> @supabase/realtime-js -> ws` | `8.20.0` -> `8.21.3` | [GHSA-58qx-3vcg-4xpx](https://github.com/advisories/GHSA-58qx-3vcg-4xpx), [GHSA-96hv-2xvq-fx4p](https://github.com/advisories/GHSA-96hv-2xvq-fx4p) | Browser Supabase realtime uses the platform WebSocket; the Node `ws` implementation is not the active browser transport based on the built application. Not reachable in the evidenced browser path. | Compatible lockfile patch through the existing parent range; Supabase itself was not unnecessarily upgraded. |
| Root/client direct `react-router-dom -> react-router` | `7.15.0` -> removed | [GHSA-84g9-w2xq-vcv6](https://github.com/advisories/GHSA-84g9-w2xq-vcv6), [GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6), [GHSA-h8fp-f39c-q6mh](https://github.com/advisories/GHSA-h8fp-f39c-q6mh), [GHSA-337j-9hxr-rhxg](https://github.com/advisories/GHSA-337j-9hxr-rhxg), [GHSA-chx6-hx7r-mcp5](https://github.com/advisories/GHSA-chx6-hx7r-mcp5), [GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2) | Repository-wide source/script/config scan found no React Router import or use; the application uses its existing internal navigation state. Not reachable based on evidence. | Removed the unused duplicate dependency from root and client manifests/lockfiles. Navigation/browser suites pass unchanged. |
| Server `express -> body-parser` | `2.2.2` -> `2.3.0` | [GHSA-v422-hmwv-36x6](https://github.com/advisories/GHSA-v422-hmwv-36x6) | Express JSON and URL-encoded parsing are public. The advisory requires an invalid configured limit that silently disables enforcement; the app does not configure an invalid body-parser limit. Not reachable based on current configuration. | Compatible transitive patch allowed by Express 5.2.1; Express was not upgraded unnecessarily. |
| Server `express/body-parser -> qs` | `6.15.1` -> `6.16.0` | [GHSA-q8mj-m7cp-5q26](https://github.com/advisories/GHSA-q8mj-m7cp-5q26), [GHSA-x5fp-wj9c-mxmx](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx), [GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) | URL-encoded parsing is reachable on public routes. The `stringify` crash is not used; parser limit/prototype failure preconditions were not demonstrated. Reachability of the affected parser internals was not established, so this was treated as production-relevant and patched. | Compatible transitive patch within Express/body-parser ranges. |
| Server direct `multer` | `2.1.1` -> `2.3.0` | [GHSA-72gw-mp4g-v24j](https://github.com/advisories/GHSA-72gw-mp4g-v24j), [GHSA-3p4h-7m6x-2hcm](https://github.com/advisories/GHSA-3p4h-7m6x-2hcm), [GHSA-wc9g-mqfw-jrwm](https://github.com/advisories/GHSA-wc9g-mqfw-jrwm), [GHSA-qvfw-j98x-7q72](https://github.com/advisories/GHSA-qvfw-j98x-7q72), [GHSA-535w-7cp7-47q4](https://github.com/advisories/GHSA-535w-7cp7-47q4) | Directly reachable on every public multipart upload route. Crafted nested/indexed fields and aborted/limit behavior can be sent remotely; this was the highest-priority demonstrated exposure. | Updated to patched 2.3.0 and set `limits.fieldArrayIndexLimit: 0` because no route accepts bracket-indexed fields. [Official 2.3.0 release](https://github.com/expressjs/multer/releases/tag/v2.3.0) documents the security fix and opt-in limit. |
| Server direct `nodemailer` | `6.10.1` -> `9.1.1` | [GHSA-mm7p-fcc7-pg87](https://github.com/advisories/GHSA-mm7p-fcc7-pg87), [GHSA-c7w3-x93f-qmm8](https://github.com/advisories/GHSA-c7w3-x93f-qmm8), [GHSA-vvjj-xcjg-gr5g](https://github.com/advisories/GHSA-vvjj-xcjg-gr5g), [GHSA-268h-hp4c-crq3](https://github.com/advisories/GHSA-268h-hp4c-crq3), [GHSA-wqvq-jvpq-h66f](https://github.com/advisories/GHSA-wqvq-jvpq-h66f), [GHSA-r7g4-qg5f-qqm2](https://github.com/advisories/GHSA-r7g4-qg5f-qqm2), [GHSA-rcmh-qjqh-p98v](https://github.com/advisories/GHSA-rcmh-qjqh-p98v), [GHSA-p6gq-j5cr-w38f](https://github.com/advisories/GHSA-p6gq-j5cr-w38f), [GHSA-8m3c-c648-2xjj](https://github.com/advisories/GHSA-8m3c-c648-2xjj), [GHSA-wmmp-3585-3rmp](https://github.com/advisories/GHSA-wmmp-3585-3rmp), [GHSA-2x7j-588g-ccc2](https://github.com/advisories/GHSA-2x7j-588g-ccc2), [GHSA-cc9r-2j5m-2m83](https://github.com/advisories/GHSA-cc9r-2j5m-2m83) | Contact uses SMTP transport, so the package is active. Recipient/from transport identities are server-configured; user input is only subject/HTML. The app does not use raw messages, URL/file attachments, JSON transport, OAuth token fetching, List headers, client envelope size, or recipient allow-list parsing. Those exact paths are not reachable based on evidence, but the public transport dependency was upgraded. | 9.1.1 is the first version outside every fresh affected range and retains CommonJS/SMTP support. Official [changelog](https://github.com/nodemailer/nodemailer/blob/master/CHANGELOG.md#911-2026-09-01) records the 9.1.0 parser/domain fixes and 9.1.1 access-policy fixes. The only intervening major changes affecting SES and `NoAuth` error naming are unused here. |
| Server `razorpay -> axios -> form-data` | Axios `1.16.1` -> `1.20.0`; form-data `4.0.5` -> `4.0.6` | Same Axios and form-data advisories above | Razorpay code remains installed but server monetization rejects before provider access. Not reachable while monetization is disabled; future reachability depends on safe payment reactivation. | Compatible transitive patches; Razorpay and payment modules preserved. |
| Server `@supabase/supabase-js -> @supabase/realtime-js -> ws` | `8.20.0` -> `8.21.3` | Same `ws` advisories above | Server account/database flows use Auth/PostgREST, not a `ws` server or realtime subscription. No affected WebSocket path was found; not reachable based on evidence. | Compatible transitive patch without a Supabase upgrade. |
| Server direct `uuid` | `9.0.1` -> `11.1.1` | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | The advisory affects v3/v5/v6 with caller buffers. Source uses only named `v4()` with no buffer, so the vulnerable behavior is not reachable based on evidence. | 11.1.1 is the smallest fixed version and still provides a CommonJS export, unlike v12+. The official [UUID changelog](https://github.com/uuidjs/uuid/blob/main/CHANGELOG.md) shows v11 breaking changes are confined to v1/v6/v7 internals used nowhere here. |

## 4. Development-only findings

These packages are used by lint/build tooling and are absent from the deployed production dependency classification. No build endpoint processes attacker-supplied source, source maps, Browserslist statistics, brace expressions, Nano ID sizes, or Vite dev-server paths in production. They were nevertheless updated within compatible parent ranges because fixes were straightforward.

| Chain/package | Before -> after | Advisory IDs |
|---|---|---|
| `eslint-plugin-react-hooks -> @babel/core` | `7.29.0` -> `7.29.7` | [GHSA-4x5r-pxfx-6jf8](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8) |
| Babel -> `browserslist -> baseline-browser-mapping` | `4.28.2` -> `4.28.9`; `2.10.23` -> `2.11.23` | [GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx), [GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g), [GHSA-w5vr-8v7q-w6rv](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv) |
| `eslint -> minimatch -> brace-expansion` | `5.0.5` -> `5.0.9` | [GHSA-jxxr-4gwj-5jf2](https://github.com/advisories/GHSA-jxxr-4gwj-5jf2), [GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp), [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg), [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) |
| `vite -> postcss -> nanoid` | PostCSS `8.5.12` -> `8.5.28`; Nano ID `3.3.11` -> `3.3.19` | [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp), [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849), [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv), [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8), [GHSA-xwg4-73v4-xw9w](https://github.com/advisories/GHSA-xwg4-73v4-xw9w) |
| Direct dev `vite` | `8.0.10` -> `8.0.16` | [GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3), [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) |

Vite stayed on the same major. Its [official 8.0.16 commit history](https://github.com/vitejs/vite/commits/v8.0.16) records the Windows alternate-path and launch-editor dependency fixes. Node 22.22.2 satisfies Vite 8's supported engine range.

## 5. Manifest and lockfile decisions

- Root: removed unused `react-router-dom`; root `package.json` and lockfile now intentionally contain no dependency.
- Client: removed unused `react-router-dom`; raised direct Axios to `^1.18.0` and Vite to `^8.0.16`; refreshed only advisory-related compatible transitives.
- Server: raised Multer to `^2.3.0`, Nodemailer to `^9.1.1`, UUID to `^11.1.1`; refreshed advisory-related Axios/form-data/ws/body-parser/qs transitives within existing parent ranges.
- No `overrides` field was introduced. Supabase, Express, Razorpay, React and other unrelated direct versions were left unchanged.
- Manifests and lockfiles were updated together.

## 6. Clean-install and regression verification

Clean source copies excluding existing `node_modules`, generated builds, uploads and outputs were created under the system temporary directory:

- `C:\Users\HP\AppData\Local\Temp\FormatTool-Phase5B-Root-20260913`
- `C:\Users\HP\AppData\Local\Temp\FormatTool-Phase5B-Client-20260913`
- `C:\Users\HP\AppData\Local\Temp\FormatTool-Phase5B-Server-20260913`

Results:

- Root clean `npm ci`: **PASS**; root audit zero.
- Client clean `npm ci`: **PASS**.
- Server clean `npm ci`: **PASS**.
- Client tests: **PASS 15/15**.
- Server tests: **PASS 16/16**, including all 9 Phase 5A HTTP authorization cases and zero-side-effect assertions.
- Client production build with Vite 8.0.16: **PASS**; JS 600.43 kB, existing greater-than-500-kB warning remains.
- Client lint: unchanged baseline **1 error, 5 warnings**.
- Backend syntax: `index.js`, `accessControl.js`, `payments.js`, `fileValidation.js`, and `test/accessControl.test.js`: **PASS**.
- Phase 4A local Chrome suite: **PASS** at desktop light/dark, 768 px, mobile light/dark and 320 px.
- Phase 4B local Chrome suite: **PASS** for formatter error/retry/mock completion, file retention, conversion tools, dashboard/account, Contact/auth/AI/Licence dialogs, theme sync, responsive layouts and overflow. These are fixture/mocked UI checks, not live provider/account verification.
- Upgraded Multer local HTTP checks against the clean server: health `200`; unsupported upload `400`; crafted bracket-indexed multipart field `400`; 25 MiB + 1 byte upload `413` with the configured 25 MB message; corrupt PDF `500`; corrected valid PDF retry `200`.
- Upgraded Nodemailer Contact check: a synthetic form reached Nodemailer 9.1.1 with SMTP forced to loopback, returned sanitized `500`, and delivered no email.
- No document-processing package changed. Only one representative valid PDF retry was processed to verify Multer compatibility; the nine-processor output suite was not repeated.

## 7. Final audit comparison and remaining findings

| Scope | Before | After |
|---|---:|---:|
| Root production/full | 2 packages | **0** |
| Client production | 5 packages | **0** |
| Client full tree | 12 packages | **0** |
| Server production/full | 8 packages | **0** |

There are no remaining npm audit findings in the verified registry snapshot. This means the final locked versions are outside every currently reported affected range; it does not establish that all dependency behavior is safe or that future advisories will remain zero.

One unrelated pre-existing behavior was observed during the required corrupt-upload retry check: `POST /api/pdf-to-word` returns a processor traceback in its JSON error body. This contradicts the earlier Phase 5 report's sanitized-error statement. It was not caused by a dependency upgrade and was not expanded into a non-dependency server rewrite in Phase 5B; it remains a release-hardening finding.

## 8. Public-release readiness

The recorded npm dependency-advisory blocker is resolved for this audit snapshot. Overall public-release readiness remains **FAIL** because these separate items remain:

- Live Supabase authentication/history and Row Level Security verification.
- Manual recovery/reconciliation after partial cross-service account deletion.
- DOCX/KrutiDev visual inspection limitations.
- Public-product Licence wording review.
- Payment authorization/ownership defects that block future monetization reactivation; monetization remains disabled.
- Sanitization of processor failure responses, including the observed PDF-to-Word traceback.

Stopped after Phase 5B. Awaiting review.
