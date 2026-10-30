# Phase 5D — Supabase Authentication, Document History & Database Access Isolation

## 1. Status

**BLOCKED (Preparation Complete).** Complete schema provenance, permission reduction, profile protection analysis, and account deletion recovery models have been codified and verified via unit tests (27/27 server tests passing). A dedicated, guarded integration test harness (`server/test/supabase-integration-test.mjs`) has been created. However, actual database execution remains **BLOCKED** because no isolated Supabase environment (local Docker/CLI emulator or dedicated disposable test project) is currently provisioned.

Testing against live production projects was refused to prevent state corruption, real email triggers, or accidental data loss.

---

## 2. Schema Provenance & Reviewable SQL

### 2.1 Provenance Classification
- **Inferred from Application Code (Tables, Columns, Types)**:
  - `public.profiles`: `id`, `name`, `phone`, `org`, `plan`, `payment_id`, `created_at`, `updated_at` (derived from `useAuth.jsx` and `Profile.jsx`).
  - `public.documents`: `id`, `user_id`, `doc_type`, `file_name`, `status`, `created_at` (derived from `Activity.jsx`, `Tool.jsx`, `server/index.js`).
  - `public.payments`: `id`, `user_id`, `payment_id`, `amount`, `created_at` (derived from `payments.js`).
- **Proposed Test Schema (NOT from repository migrations or verified production export)**:
  - All table constraints, foreign key cascades, column check constraints, triggers (`tr_protect_profile_fields`), RLS policies, index optimizations, and realtime publication statements.
- **Reviewable SQL Location**: [`server/config/supabase_schema.sql`](file:///C:/Users/HP/Desktop/Format_Tool/server/config/supabase_schema.sql). Marked explicitly as **PROPOSED TEST SCHEMA — NOT DEPLOYED**.

---

## 3. Permission Review & Protection Architecture

### 3.1 Permission Reductions
- **`documents` Table**: Removed all browser client `INSERT`, `UPDATE`, and `DELETE` permissions. Browser clients now possess `SELECT` permission only. All document history writes are performed exclusively by the backend service-role upon verified formatting completion.
- **`payments` Table**: Revoked all browser client `INSERT`, `UPDATE`, and `DELETE` permissions. Browser clients possess `SELECT` permission only.
- **`profiles` Table**: Browser client `DELETE` permission is revoked (managed via backend service-role).

### 3.2 Profile Plan & Payment Field Protection
- **Why Ownership Checks Alone Are Insufficient**: RLS policies with `USING (auth.uid() = id) WITH CHECK (auth.uid() = id)` only restrict row ownership; without column-level restrictions or triggers, a user could execute `supabase.from('profiles').update({ plan: 'pro' })` on their own row.
- **Enforced Multi-Layer Protection**:
  1. **Column-Level Revocation**: `REVOKE UPDATE (plan, payment_id) ON public.profiles FROM anon, authenticated;`
  2. **Immutability Trigger**: `tr_protect_profile_fields` raises an exception if a non-service-role caller attempts to alter `plan` or `payment_id`.
  3. **No Unsafe Functions**: No recursive policies or unsafe `SECURITY DEFINER` functions are introduced.

---

## 4. Corrected Account Deletion Recovery Assessment

### 4.1 Independent Identity Lifecycle
- **Missing `public.profiles` Row**: An authenticated Supabase session and JWT are governed by `auth.users`, **not** `public.profiles`. A missing or deleted profile row does not invalidate a valid session token.
- **Deletion Retry**: If `DELETE /account` succeeds in deleting `public.profiles` but fails at the final `auth.admin.deleteUser` step, the user's access token remains valid for re-attempting `DELETE /account`.

### 4.2 Deletion Stage Matrix
| Stage | Failure State | Client Session / Token State | Authenticated Retry Result | Operator Action Required? |
| :--- | :--- | :--- | :--- | :--- |
| **1. Documents** | `documents` row delete failed. `completed: []`. | Token valid, profile intact. | **Safe & Idempotent**: Retries deletion from step 1. | None. |
| **2. Payments** | `payments` delete failed. `completed: ['documents']`. | Token valid, profile intact. | **Safe & Idempotent**: Documents delete is a no-op; resumes payments. | None. |
| **3. Profiles** | `profiles` delete failed. `completed: ['documents', 'payments']`. | Token valid, profile intact. | **Safe & Idempotent**: Prior steps no-op; cleans profile and user. | None. |
| **4. Auth User** | `auth.admin.deleteUser` failed. `completed: ['documents', 'payments', 'profiles']`. | Token valid until expiry; profile missing. | **Safe & Idempotent**: Server handler accepts verified token, detects missing rows as no-ops, and deletes Auth user. | None if retried before token expiry; manual dashboard removal if session lost. |
| **Ambiguous Timeout** | Network timeout during Auth deletion. | Ambiguous. | Client treats as incomplete; user re-authenticates or retries. If user already deleted, next attempt receives 401. | None. |

*Note: Unit tests establish the server handler's idempotent handling of missing rows; live cross-service transaction failure handling remains to be verified against an isolated instance.*

---

## 5. Integration Test Harness

### 5.1 Harness Specifications
- **Script Location**: [`server/test/supabase-integration-test.mjs`](file:///C:/Users/HP/Desktop/Format_Tool/server/test/supabase-integration-test.mjs)
- **Safety Guards**: Refuses to run if configured application environment is detected or if explicit confirmation is missing.
- **Required Test-Only Environment Variables**:
  - `SUPABASE_TEST_URL`
  - `SUPABASE_TEST_ANON_KEY`
  - `SUPABASE_TEST_SERVICE_KEY`
  - `SUPABASE_TEST_CONFIRMATION="I_CONFIRM_THIS_IS_A_DISPOSABLE_TEST_INSTANCE"`
- **Exact Run Command**:
  ```bash
  SUPABASE_TEST_URL="https://<disposable-ref>.supabase.co" \
  SUPABASE_TEST_ANON_KEY="<anon-key>" \
  SUPABASE_TEST_SERVICE_KEY="<service-key>" \
  SUPABASE_TEST_CONFIRMATION="I_CONFIRM_THIS_IS_A_DISPOSABLE_TEST_INSTANCE" \
  node server/test/supabase-integration-test.mjs
  ```

---

## 6. Verification Results

- **Server Unit & Access Control Tests**: `npm test` (in `server`) -> **Exit code 0 (PASS)** — **27/27 tests passing** (including 13 access control, recovery, and missing-profile tests).
- **Client Unit Tests**: `npm test` (in `client`) -> **Exit code 0 (PASS)** — **15/15 tests passing**.
- **Client Lint**: `npm run lint` (in `client`) -> **Exit code 1 (FAIL — 1 existing error, 5 warnings, no regression)**.
- **Integration Test Execution**: **BLOCKED (Awaiting disposable test project)**.
