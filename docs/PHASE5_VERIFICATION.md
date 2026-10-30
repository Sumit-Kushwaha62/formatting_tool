# Phase 5 Functional Verification

## Status

**Overall: PARTIAL.** All nine supported tools completed real local browser-to-backend workflows and their downloaded artifacts passed independent structural/content checks. PDF outputs were also rendered and visually inspected. Live Supabase authentication/history was not run because the repository contains no clearly isolated test project/account, and DOCX/KrutiDev visual rendering was not available on this host.

All synthetic inputs, downloaded outputs, scripts and machine-readable evidence are isolated under `phase5-test-run/`. No production data, payment, email delivery or external AI provider was used.

## Tool matrix

| Tool/scenario | Browser/API/processor | Real or mocked | Result | Input/output evidence | Limitation |
|---|---|---|---|---|---|
| Book formatting | Chrome UI -> `POST /format` -> `formatter.py` | Real | PASS | `inputs/formatter-book.docx` -> `outputs/formatted-book.docx`; DOCX parser confirmed all markers, table, A5 geometry, 1-inch margin, header/footer and content order | No DOCX renderer installed; visual page inspection NOT RUN |
| Thesis formatting | Chrome UI -> `POST /format` -> `formatter.py` | Real | PASS | `inputs/formatter-thesis.docx` -> `outputs/formatted-thesis.docx`; content/table/order, A4, 1.5-inch left margin, header/footer | No DOCX renderer; visual inspection NOT RUN |
| Research Paper formatting | Chrome UI -> `POST /format` -> `formatter.py` | Real | PASS | `inputs/formatter-research.docx` -> `outputs/formatted-research.docx`; content/table/order, Letter geometry, margins, header/footer | No DOCX renderer; visual inspection NOT RUN |
| Letter / Notice formatting | Chrome UI -> `POST /format` -> `formatter.py` | Real | PASS | `inputs/formatter-letter.docx` -> `outputs/formatted-letter.docx`; content/table/order, Legal geometry, 1.2-inch left margin, header/footer | No DOCX renderer; visual inspection NOT RUN |
| Merge PDF | Chrome UI -> `POST /api/merge-pdf` -> `converter.py` | Real | PASS | Two PDFs -> `outputs/merged.pdf`; PyMuPDF confirmed 3 pages and all distinct markers in selection order; rendered pages in `evidence/merged-pdf-page-*.png` inspected | Synthetic text/layout only |
| Merge Word | Chrome UI -> `POST /api/merge-word` -> `converter.py` | Real | PASS | Two DOCX files -> `outputs/merged.docx`; parser confirmed both marker groups in order and both tables | No DOCX renderer; section-level visual preservation NOT RUN |
| PDF to Word | Chrome UI -> `POST /api/pdf-to-word` -> `pdf2docx` | Real | PASS | Two-page text PDF -> `outputs/pdf-to-word.docx`; both page markers exist as editable DOCX paragraphs in order | Text PDF only; OCR not claimed; visual fidelity NOT RUN |
| Excel to PDF | Chrome UI -> `POST /api/excel-to-pdf` -> `openpyxl`/ReportLab | Real | PASS | `inputs/excel-active-sheet.xlsx` -> `outputs/excel.pdf`; cells/numbers present; `evidence/excel-pdf-page-1.png` inspected | Actual behavior is active sheet only; second sheet is omitted. Legacy `.xls` is not supported and is no longer advertised |
| Hindi to Krutidev | Chrome UI -> `POST /api/convert-krutidev` -> `hindi_converter.py` | Real | PASS (structural) | `inputs/hindi-unicode.docx` -> `outputs/hindi-krutidev.docx`; fixed expected mappings cover matras/conjuncts, no Devanagari remains, Kruti Dev 010 and Times New Roman run fonts are assigned | KrutiDev font and DOCX renderer absent; glyph-level visual inspection NOT RUN |
| Empty / too few files | Chrome UI | Real UI state | PASS | `evidence/browser-failure-retry-results.json` | Server now also rejects one-file merge requests with HTTP 400 |
| Unsupported native selection | Chrome UI | Real UI state | PASS | Unsupported `.txt` rejected before request with an associated message | Extension allowlist; corrupt matching extensions still reach processor validation |
| Corrupt supported file | Chrome UI + real processor | Real | PASS | Corrupt PDF returned HTTP 500, error state appeared, no false success, file stayed removable and action settled | Server response intentionally avoids leaking processor traceback |
| Corrected retry | Chrome UI + real processor | Real | PASS | Bad file removed, valid PDF selected, HTTP 200 and `outputs/pdf-to-word-retry.docx`; parser confirmed both markers | None for tested text PDF |
| Over upload limit | API + health check | Real | PASS | 25 MiB + 1 KiB DOCX returned HTTP 413; `/health` remained HTTP 200 | No stress/load test |
| Backend unavailable | Chrome UI | Real unavailable backend | PASS | `evidence/browser-unavailable-results.json`: visible error, no false success, file retained, retry enabled | Network interruption during an active response was not simulated |
| Payment guards | Local API + unit tests | Real guard; mocked enabled-provider test | PASS | Both payment endpoints returned HTTP 403 `MONETIZATION_DISABLED`; unit tests prove zero provider/database calls in disabled handlers | No payment/provider integration run |
| Production fixture isolation | Production build + Chrome | Real production bundle | PASS | Fixture global, URL parameter and localStorage attempts did not authenticate; fixture identifier absent from `dist`; `evidence/production-isolation.json` | Development fixture remains intentionally available only under `import.meta.env.DEV` |
| Free/pro/team access | Client unit fixtures | Mocked account plans | PASS | Existing free-mode tests cover all three stored plans without commercial blocking | Live >3-document account and stored-plan immutability BLOCKED without isolated Supabase account |
| Contact | Local API with SMTP forced to loopback | Real handler, non-delivery transport | PASS | Empty payload HTTP 400; valid synthetic payload reached handler then failed HTTP 500 locally; no email sent | Actual external delivery NOT RUN |
| AI suggestions | Local API fallback | Real local fallback, provider disabled by empty prompt | PASS | HTTP 200, defaults returned with `aiUsed=false` | Mock-provider injection is not present; external provider integration NOT RUN |
| Authentication/history | Supabase | Not run | BLOCKED | Environment keys exist, but no clearly isolated test project/account is identified | Login/session/logout, live history, success/failure history writes and >3-document account remain unverified |

Paths in this table are relative to `phase5-test-run/`.

## Independent output inspection

- `python-docx`: paragraphs, tables, marker order, page dimensions, margins, headers/footers, editable PDF-to-Word text and explicit Hindi run fonts.
- PyMuPDF: PDF page count/text extraction and PNG rendering of every merged-PDF page plus the Excel PDF page.
- Fixed Hindi expectations (not generated during verification): `हिंदी भाषा -> fganh Hkk"kk`, `कर्म -> deZ`, `क्षेत्र -> {ks=`, `श्रद्धा -> 'J/~/kk`, `कृपया -> d\`i;k`, `मैं हूँ -> eSa gwW`, and `प्रौद्योगिकी -> izkS|ksfxdh`.
- Machine-readable results: `phase5-test-run/evidence/browser-real-results.json`, `browser-failure-retry-results.json`, `browser-unavailable-results.json`, `production-isolation.json`, and `structural-results.json`.

## Demonstrated regressions and fixes

1. Unsupported files could bypass the native input hint, reach processors, and sometimes produce HTTP 200 plus a blank false-success DOCX. Added client-side selection filtering and server-side extension allowlists with cleanup and HTTP 400 errors.
2. Merge APIs accepted a single file. Added server-side two-file minimum validation while retaining UI ordering behavior.
3. Excel advertised `.xls`, but the installed `openpyxl` processor returned HTTP 500 for it. Narrowed the truthful supported format to `.xlsx` and added a clear server rejection for `.xls`.
4. Uploads above the configured limit were enforced but surfaced as generic HTTP 500. Added Multer error handling with HTTP 413, a configured-limit message and cleanup.

Changed for these fixes: `client/src/components/ui/FileToolWorkspace.jsx`, `client/src/pages/tools/ExcelToPDF.jsx`, `server/index.js`, new `server/fileValidation.js`, and new `server/test/fileValidation.test.js`. Verification scripts and evidence are separate from product code.

## Checks

- Client tests: PASS, 12/12.
- Server tests: PASS, 7/7 (4 monetization + 3 upload-validation tests).
- Production frontend build: PASS; existing >500 kB chunk warning remains (595.44 kB JS).
- Lint: baseline failure unchanged at 1 error and 5 warnings.
- Backend syntax: `node --check` for server entry/payment/feature/validation modules PASS; `py_compile` for all processors PASS.
- Phase 4A browser suite: PASS at all six baseline viewport/theme scenarios.
- Phase 4B browser suite: PASS on final rerun. One earlier rerun saw a transient sandbox-blocked Supabase WebSocket console error; the complete repeat passed unchanged.
- Production fixture/Razorpay browser check: PASS.
- Scoped `git diff --check`: PASS; repository-wide output retains only the previously documented `server/utils.py` whitespace findings.

## Dependency audit and release blockers

Current registry audit data was retrieved without applying fixes:

- Client production tree: 5 findings (4 high, 1 low). Axios is directly used by active formatter/contact flows and is in the production bundle. React Router is installed but not imported by current application source. `form-data` and `ws` are transitive/Node-oriented in this browser build; exploit reachability was not demonstrated.
- Full client tree: 12 findings (9 high, 1 moderate, 2 low); the additional Babel/Vite/PostCSS/Browserslist/Nanoid/brace-expansion findings are build/development tooling.
- Server production tree: 8 findings (5 high, 2 moderate, 1 low). Multer and Nodemailer are directly reachable through public upload/contact routes; Axios/form-data/ws are transitive through Supabase; UUID is used only as v4 while its listed advisory targets v3/v5/v6 buffer handling; body-parser/qs are exposed through Express parsing.
- No automatic or force upgrade was run. Dependency remediation needs a scoped compatibility/security phase, especially for public upload and Contact endpoints.

Other public-release blockers remain: no safe live Supabase/account verification, unauthenticated service-role account deletion by path `userId`, previously recorded payment reactivation authorization defects (payment stays disabled), and unresolved public-product Licence wording.

## Readiness conclusions

- **Local functional readiness: PASS for the nine tested synthetic workflows** on this Windows/Python/Chrome environment, with DOCX/KrutiDev visual-render limitations stated above.
- **Public-release readiness: FAIL.** Live account/history/access-control coverage, reachable dependency findings and the Licence/product-policy issue require resolution before public release.
