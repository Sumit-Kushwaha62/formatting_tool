# Concrete Fresh-Launch Reset Plan for Format Studio

**Target Supabase Project**: `qrntmoeoqqmnkgdsxmrv`  
**Expected Base URL**: `https://qrntmoeoqqmnkgdsxmrv.supabase.co`  
**Dashboard Link**: [https://supabase.com/dashboard/project/qrntmoeoqqmnkgdsxmrv](https://supabase.com/dashboard/project/qrntmoeoqqmnkgdsxmrv)  
**Status**: **LOCAL PREPARATION & REVIEW ARTIFACTS COMPLETE (Hosted destructive execution, schema migration, and Auth deletion NOT performed in this pass)**

---

## 1. Scope & Audited Inventory (Hosted Database Evidence)

The database schema, constraints, and privileges are based on the **observed PostgreSQL catalog exports** (`supabase_query_csv.zip` and the 20-column permissions export):

### A. Observed Database Metadata

| Resource / Table | Observed Live State | Target Post-Reset Count | Action / Disposal Method |
| :--- | :--- | :---: | :--- |
| `auth.users` | **19 users** | **0** | Guarded API deletion via [`server/scripts/03_auth_users_cleanup.mjs`](file:///C:/Users/HP/Desktop/Format_Tool/server/scripts/03_auth_users_cleanup.mjs) |
| `public.profiles` | **18 rows**, RLS enabled, 8 columns (`id`, `full_name`, `email`, `phone`, `org`, `plan`, `created_at`, `payment_id`). Lacks `name` and `updated_at`. FK `profiles_id_fkey` -> `auth.users(id)` ON DELETE CASCADE. | **0** | Restrictive SQL truncation via [`server/scripts/01_application_table_reset.sql`](file:///C:/Users/HP/Desktop/Format_Tool/server/scripts/01_application_table_reset.sql) |
| `public.documents` | **1,262 rows**, RLS enabled, 7 columns (`id`, `user_id`, `doc_type`, `file_name`, `pages`, `status`, `created_at`). FK `documents_user_id_fkey` -> `auth.users(id)` ON DELETE CASCADE. | **0** | Restrictive SQL truncation via [`server/scripts/01_application_table_reset.sql`](file:///C:/Users/HP/Desktop/Format_Tool/server/scripts/01_application_table_reset.sql) |
| `public.payments` | **0 rows**, RLS enabled, 5 columns (`id`, `user_id`, `payment_id`, `amount`, `created_at`). FK `payments_user_id_fkey` -> `auth.users(id)` ON DELETE NO ACTION. | **0** | Restrictive SQL truncation via [`server/scripts/01_application_table_reset.sql`](file:///C:/Users/HP/Desktop/Format_Tool/server/scripts/01_application_table_reset.sql) |
| Supabase Storage Buckets | **0 buckets, 0 objects** (query returned 0 rows) | **0** | No Supabase storage deletion required |
| Realtime Publications | **0 tables in `supabase_realtime`** (query returned 0 rows) | `documents` | Added to publication in migration |
| Local Backend Uploads (`server/uploads/`) | **0 files** | **0** | Local machine cleanup via [`server/scripts/04_local_storage_cleanup.mjs`](file:///C:/Users/HP/Desktop/Format_Tool/server/scripts/04_local_storage_cleanup.mjs) |
| Local Backend Outputs (`server/outputs/`) | **13 files** | **0** | Local machine cleanup via [`server/scripts/04_local_storage_cleanup.mjs`](file:///C:/Users/HP/Desktop/Format_Tool/server/scripts/04_local_storage_cleanup.mjs) |

### B. Observed Permissions, Triggers & Authenticator Setting Evidence
1. **Broad Browser Permissions on Live DB**:
   - `anon` and `authenticated` roles currently have full table-level privileges (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER) on all 3 tables.
   - `anon` and `authenticated` roles currently have explicit column-level grants (SELECT, INSERT, UPDATE, REFERENCES) across all 20 columns (documents: 7, payments: 5, profiles: 8), including `profiles.plan` and `profiles.payment_id`.
2. **Auth User Trigger**:
   - `auth.users` has trigger `on_auth_user_created` (AFTER INSERT) calling `public.handle_new_user()` (`SECURITY DEFINER`), which executes:
     `INSERT INTO public.profiles (id, full_name, email, plan) VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email, 'free') ON CONFLICT (id) DO NOTHING;`
3. **Authenticator Role Setting Audit**:
   - Query on `pg_db_role_setting` for role `authenticator` returned: *"Success. No rows returned."*
   - Precisely recorded: No matching persistent role-setting entry exists in PostgreSQL catalogs for `authenticator`. (Note: This documents the absence of a database-level role override, without making claims regarding external PostgREST environment or configuration files).

---

## 2. Schema Reconciliation & Permission Controls

### A. Column & Constraint Alignment (Post-Truncation Sequence)
- **`public.profiles`**:
  - Reconciles missing `name TEXT` and `updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL`.
  - Reconciles `plan NOT NULL DEFAULT 'free'` with `CHECK (plan IN ('free', 'pro', 'team'))`.
  - Reconciles `created_at` and `updated_at` to `SET NOT NULL`.
  - **Signup Trigger Compatibility**: `handle_profile_insert()` ensures compatibility with `handle_new_user()`. When `handle_new_user()` supplies `full_name`, `name` is automatically populated from `full_name`. Contact updates keep `name` and `full_name` synchronized deterministically.
- **`public.documents`**:
  - Reconciles nullability and defaults post-truncation:
    - `doc_type TEXT NOT NULL`, `file_name TEXT NOT NULL`
    - `pages INTEGER DEFAULT 1`
    - `status TEXT NOT NULL DEFAULT 'done'` (`SET NOT NULL`)
    - `created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())` (`SET NOT NULL`)
  - Retains index `documents_user_id_created_at_idx` on `(user_id, created_at DESC)`.
- **`public.payments`**:
  - Live foreign key is `payments_user_id_fkey` on `user_id` -> `auth.users(id)` `ON DELETE NO ACTION`.
  - Reconciles nullability post-truncation: `payment_id TEXT NOT NULL`, `amount INTEGER NOT NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())` (`SET NOT NULL`).
  - Reconciles foreign key constraint to `ON DELETE CASCADE`.
  - **Payment Cleanup Ordering**: During reset, `payments` is truncated in Step 4 before `auth.users` deletion in Step 6 so foreign key constraints are never violated.

### B. Privilege & Policy Reconciliation
- **Table-Level & Explicit Column Revocation**:
  - Explicitly revokes all table-level privileges on `profiles`, `documents`, `payments` from `PUBLIC`, `anon`, `authenticated`.
  - Explicitly revokes all 20 column-level privilege grants from `PUBLIC`, `anon`, `authenticated` to wipe legacy grants.
- **Minimal Intended Grants**:
  - `postgres` & `service_role`: Full administrative access (`GRANT ALL ON TABLE ...`).
  - `authenticated`:
    - `GRANT SELECT, INSERT ON public.profiles TO authenticated;`
    - `GRANT UPDATE (name, full_name, phone, org, updated_at) ON public.profiles TO authenticated;` (`plan` and `payment_id` remain strictly revoked).
    - `GRANT SELECT ON public.documents TO authenticated;` (Browser mutations revoked).
    - `GRANT SELECT ON public.payments TO authenticated;` (Browser mutations revoked).
  - `anon`: Zero grants on application tables or columns.
- **RLS Policies**:
  - Drops all legacy/permissive policies and enforces strict own-user policies (`profiles_select_own`, `profiles_insert_own`, `profiles_update_own`, `documents_select_own`, `payments_select_own`).
- **Field Immutability Trigger**:
  - `protect_profile_fields()` runs as `SECURITY INVOKER`, checking `auth.role()` and JWT claims. Non-service-role updates to `plan` or `payment_id` raise SQLSTATE `42501`.

---

## 3. Maintenance Freeze, Verification & Service Restoration

> [!WARNING]
> Freeze enforcement status remains **Unverified** until actively exercised against the live Data API during the authorized execution phase.
>
> A frontend UI maintenance banner alone **does not** stop backend API requests or PostgREST mutations. PostgREST explicitly starts `READ WRITE` transactions for mutations, so setting `default_transaction_read_only` does **not** stop PostgREST writes.

### A. Dynamic Controlled-Test Access (No Hard-Coded Tokens)
1. **PowerShell Cryptographic Token Generation**:
   The operator generates a per-maintenance-window token in PowerShell using `RandomNumberGenerator`:
   ```powershell
   $env:CONTROLLED_TEST_TOKEN = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).Replace('+','-').Replace('/','_').TrimEnd('=')
   ```
2. **Maintenance Guard Mechanism**:
   The guard inspects the dynamic token set in `app.settings.maintenance_test_key` against the request header `x-controlled-test-key`:
   - Admin/service-role requests: Bypassed directly.
   - Test requests passing valid `x-controlled-test-key`: Allowed to reach normal PostgREST / RLS policies.
   - Standard client requests (anon, legacy authenticated): Denied with HTTP 503.

### B. Pre-Execution Verification Requirements (Must Pass Before Truncation)
Before running destructive truncation, verify:
1. **Ordinary Client Rejection**: Probe `GET /rest/v1/profiles` without test header returns `503 Service Unavailable`.
2. **Controlled Client Access**: Probe `GET /rest/v1/profiles` with header `x-controlled-test-key: $env:CONTROLLED_TEST_TOKEN` reaches normal RLS (returns `401 Unauthorized` / empty array, NOT `503`).
3. **Service-Role Usability**: Admin client probe connects successfully.
4. **Backend Suspension**: Probe Render `/health` endpoint returns connection refused or 503.
5. **Signup Lockout**: Supabase Auth signup returns `Signups not allowed for this instance`.

**STOP RULE**: If any verification check fails, **abort immediately** before executing `01_application_table_reset.sql`.

---

## 4. Prepared Reset & Verification Artifacts

1. **[`server/scripts/shared_validation.mjs`](file:///C:/Users/HP/Desktop/Format_Tool/server/scripts/shared_validation.mjs)**: Shared target validator enforcing exact HTTPS URL, hostname `qrntmoeoqqmnkgdsxmrv.supabase.co`, default port 443, root path, zero userinfo/queries.
2. **[`server/scripts/00_readonly_inventory_queries.sql`](file:///C:/Users/HP/Desktop/Format_Tool/server/scripts/00_readonly_inventory_queries.sql)**: Catalog inspection queries using PostgreSQL system catalogs.
3. **[`server/scripts/01_application_table_reset.sql`](file:///C:/Users/HP/Desktop/Format_Tool/server/scripts/01_application_table_reset.sql)**: Transactional truncation of approved application tables (`payments`, `documents`, `profiles`) with `RESTRICT`.
4. **[`server/scripts/02_fresh_launch_schema.sql`](file:///C:/Users/HP/Desktop/Format_Tool/server/scripts/02_fresh_launch_schema.sql)** (and [`server/config/supabase_schema.sql`](file:///C:/Users/HP/Desktop/Format_Tool/server/config/supabase_schema.sql)): DDL migration reconciling constraints, nullability post-truncation (`SET NOT NULL`), dropping legacy policies, revoking broad table and column grants, adding triggers, and enabling realtime.
5. **[`server/scripts/03_auth_users_cleanup.mjs`](file:///C:/Users/HP/Desktop/Format_Tool/server/scripts/03_auth_users_cleanup.mjs)**: Guarded Node.js script with strict URL parsing, dry-run default, paginated enumeration, sanitized logging, and post-execution count validation.
6. **[`server/scripts/04_local_storage_cleanup.mjs`](file:///C:/Users/HP/Desktop/Format_Tool/server/scripts/04_local_storage_cleanup.mjs)**: Local workspace filesystem wiper using `path.relative` containment checks and rejecting symlinks/junctions.
7. **[`server/scripts/05_verify_reset.mjs`](file:///C:/Users/HP/Desktop/Format_Tool/server/scripts/05_verify_reset.mjs)**: Strict read-only post-reset verification harness failing on non-zero counts, missing columns, or network errors (Part A).
8. **[`server/scripts/06_synthetic_acceptance_test.mjs`](file:///C:/Users/HP/Desktop/Format_Tool/server/scripts/06_synthetic_acceptance_test.mjs)**: Dynamic maintenance-gated synthetic acceptance harness proving permitted access, cross-user denial, and trigger immutability with automatic fixture cleanup (Part B).
9. **[`server/test/reset-scripts.test.js`](file:///C:/Users/HP/Desktop/Format_Tool/server/test/reset-scripts.test.js)**: Unit test suite validating safety guardrails, response classification, header wiring, and signup trigger handling (24 tests passing).

---

## 5. Concrete Execution Checklist

### Phase 1: Ingress Suspension & Maintenance Freeze Activation

#### Step 1: Suspend Render Backend Web Service
- **Command / Action**:
  - In [Render Dashboard](https://dashboard.render.com/) -> Select `format-tool-backend` service -> Click **Suspend Service**.
- **Expected Result**: Backend web service ceases accepting incoming traffic.
- **Stop / Recovery Action on Failure**: If suspension fails in Render UI, verify service status before proceeding. Do not proceed until backend compute is halted.

#### Step 2: Lockout Supabase Auth Signups
- **Command / Action**:
  - In [Supabase Dashboard -> Authentication -> Settings](https://supabase.com/dashboard/project/qrntmoeoqqmnkgdsxmrv/auth/users):
  - Toggle **Disable new user sign ups** to `ON`.
- **Expected Result**: Public signups return `Signups not allowed for this instance`.
- **Stop / Recovery Action on Failure**: Re-verify toggle state in Supabase Dashboard.

#### Step 3: Generate Dynamic Controlled Test Token & Configure Maintenance Guard
- **Command / Action**:
  - In PowerShell:
    ```powershell
    $env:CONTROLLED_TEST_TOKEN = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).Replace('+','-').Replace('/','_').TrimEnd('=')
    ```
  - In [Supabase SQL Editor](https://supabase.com/dashboard/project/qrntmoeoqqmnkgdsxmrv/sql), execute:
    ```sql
    CREATE OR REPLACE FUNCTION public.pgrst_maintenance_guard()
    RETURNS void AS $$
    DECLARE
      v_role text;
      v_test_key text;
      v_expected_key text;
    BEGIN
      v_role := coalesce(
        auth.role(),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
        nullif(current_setting('request.jwt.claim.role', true), ''),
        current_user
      );

      IF v_role IN ('service_role', 'postgres', 'supabase_admin') THEN
        RETURN;
      END IF;

      v_expected_key := nullif(current_setting('app.settings.maintenance_test_key', true), '');
      v_test_key := nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-controlled-test-key';

      IF v_expected_key IS NOT NULL AND v_test_key IS NOT NULL AND v_test_key = v_expected_key THEN
        RETURN;
      END IF;

      RAISE EXCEPTION 'Format Studio Data API is undergoing scheduled maintenance (503)'
        USING ERRCODE = '53300',
              DETAIL = 'Service unavailable during fresh-launch maintenance window';
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    ```
  - In PowerShell, apply the generated token to the database:
    ```powershell
    # Apply settings via Supabase SQL Editor or SQL statement:
    # ALTER ROLE authenticator SET app.settings.maintenance_test_key = '<paste generated token>';
    # ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.pgrst_maintenance_guard';
    # NOTIFY pgrst, 'reload config';
    ```
- **Expected Result**: Query returns `Success`. PostgREST configuration reloads.
- **Stop / Recovery Action on Failure**: If SQL errors occur, check syntax and re-run.

#### Step 4: Verify Maintenance Freeze Active on Live Data API
- **Command / Action** (in PowerShell):
  ```powershell
  # 1. Verify ordinary client is blocked with 503
  $blocked = $false
  try {
    Invoke-RestMethod -Uri "https://qrntmoeoqqmnkgdsxmrv.supabase.co/rest/v1/profiles" -Headers @{ "apikey" = $env:VITE_SUPABASE_ANON_KEY } -Method Get
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 503 -or $_.Exception.Message -match "maintenance") { $blocked = $true }
  }
  Write-Host "Ordinary Client Blocked (503): $blocked"

  # 2. Verify controlled test client reaches PostgREST
  $controlledOk = $false
  try {
    Invoke-RestMethod -Uri "https://qrntmoeoqqmnkgdsxmrv.supabase.co/rest/v1/profiles" -Headers @{ "apikey" = $env:VITE_SUPABASE_ANON_KEY; "x-controlled-test-key" = $env:CONTROLLED_TEST_TOKEN } -Method Get
    $controlledOk = $true
  } catch {
    # 401 or empty array is expected (RLS denial / unauthenticated), NOT 503 maintenance
    if ($_.Exception.Response.StatusCode.value__ -ne 503) { $controlledOk = $true }
  }
  Write-Host "Controlled Client Authorized: $controlledOk"
  ```
- **Expected Result**: `Ordinary Client Blocked: True`, `Controlled Client Authorized: True`.
- **STOP / ABORT ACTION**: If `Ordinary Client Blocked` is `False`, **DO NOT PROCEED**. Execute Step 11 Restoration immediately to unfreeze and investigate.

---

### Phase 2: Destructive Application Tables Reset & Migration

#### Step 5: Execute Application Tables Truncation
- **Command / Action**:
  - Run [`server/scripts/01_application_table_reset.sql`](file:///C:/Users/HP/Desktop/Format_Tool/server/scripts/01_application_table_reset.sql) in [Supabase SQL Editor](https://supabase.com/dashboard/project/qrntmoeoqqmnkgdsxmrv/sql).
- **Expected Result**: `profiles_count = 0`, `documents_count = 0`, `payments_count = 0`.
- **Stop / Recovery Action on Failure**: If truncation fails due to constraint locks, inspect active connections and retry.

#### Step 6: Execute Schema, Grants & RLS Policies Migration
- **Command / Action**:
  - Run [`server/scripts/02_fresh_launch_schema.sql`](file:///C:/Users/HP/Desktop/Format_Tool/server/scripts/02_fresh_launch_schema.sql) in [Supabase SQL Editor](https://supabase.com/dashboard/project/qrntmoeoqqmnkgdsxmrv/sql).
- **Expected Result**: Query returns `Success. No rows returned.` Schema, columns, NOT NULL constraints, grants, policies, and triggers are applied.
- **Stop / Recovery Action on Failure**: If any DDL error occurs, inspect error line, fix migration script, and re-run within the maintenance window.

---

### Phase 3: Auth Users & Filesystem Cleanup

#### Step 7: Delete Auth Users via Admin API
- **Command / Action** (in PowerShell):
  ```powershell
  $env:EXECUTE_WIPE="true"
  $env:TARGET_PROJECT_REF="qrntmoeoqqmnkgdsxmrv"
  $env:CONFIRM_WIPE_ALL_AUTH_USERS="YES_DELETE_ALL_AUTH_USERS_QRNTMOEOQQMNKGDSXMRV"
  node server/scripts/03_auth_users_cleanup.mjs
  ```
- **Expected Result**: Discovers 19 users, deletes all 19, re-queries to confirm `Observed Remaining Users: 0`, exits with code 0.
- **Stop / Recovery Action on Failure**: If remaining users > 0, re-run script to purge remaining records.

#### Step 8: Local Filesystem Storage Cleanup (Developer Machine Only)
- **Command / Action** (in PowerShell):
  ```powershell
  $env:EXECUTE_FILE_CLEANUP="true"
  node server/scripts/04_local_storage_cleanup.mjs
  ```
- **Expected Result**: Purges files in local `server/uploads/` and `server/outputs/` (preserving `.gitkeep`), exits with code 0.
- **Hosted Render Boundary**:
  - Running `04_local_storage_cleanup.mjs` cleans **local developer machine files only**.
  - Hosted Render service storage is ephemeral and cleared automatically on service restart/redeploy. If persistent disk mounts are used, prune files via Render Shell.

---

### Phase 4: Verification & Acceptance Testing

#### Step 9: Read-Only Post-Reset Verification (Part A)
- **Command / Action** (in PowerShell):
  ```powershell
  node server/scripts/05_verify_reset.mjs
  ```
- **Expected Result**: Verifies 0 auth users, 0 rows in profiles/documents/payments, and all schema columns accessible via admin client. Exits with code 0.
- **Stop / Recovery Action on Failure**: Review failure logs to identify non-zero table or missing schema column.

#### Step 10: Synthetic Acceptance Testing (Part B)
- **Command / Action** (in PowerShell):
  ```powershell
  $env:EXECUTE_SYNTHETIC_ACCEPTANCE="true"
  $env:CONFIRM_SYNTHETIC_TEST="YES_RUN_SYNTHETIC_ACCEPTANCE_TEST"
  node server/scripts/06_synthetic_acceptance_test.mjs
  ```
- **Expected Result**: Provisions synthetic User A/B, tests permitted reads/updates, cross-user isolation, browser mutation denials, plan/payment immutability, anonymous denials, cleans up fixtures, and exits with code 0.
- **Stop / Recovery Action on Failure**: If test fails, fixtures are automatically purged. **DO NOT UNFREEZE OR REOPEN UNVERIFIED APPLICATION**. Keep maintenance freeze active, investigate failure, fix issue, and re-run acceptance tests.

---

### Phase 5: Service Restoration & Unfreeze

#### Step 11: Restore Authenticator Configuration (Unfreeze PostgREST)
- **Command / Action**:
  - In [Supabase SQL Editor](https://supabase.com/dashboard/project/qrntmoeoqqmnkgdsxmrv/sql), execute:
    ```sql
    ALTER ROLE authenticator RESET pgrst.db_pre_request;
    ALTER ROLE authenticator RESET app.settings.maintenance_test_key;
    DROP FUNCTION IF EXISTS public.pgrst_maintenance_guard();
    NOTIFY pgrst, 'reload config';
    NOTIFY pgrst, 'reload schema';
    ```
- **Expected Result**: Persistent role settings reset to original absent state. PostgREST reloads config and schema.
- **Stop / Recovery Action on Failure**: Re-run NOTIFY statements if reload does not take effect immediately.

#### Step 12: Resume Render Backend Service
- **Command / Action**:
  - In [Render Dashboard](https://dashboard.render.com/) -> Select `format-tool-backend` service -> Click **Resume Service**.
  - Verify environment variables: `MONETIZATION_ENABLED=false`, `VITE_MONETIZATION_ENABLED=false`.
- **Expected Result**: Backend web service builds/starts and enters healthy running state.

#### Step 13: Re-Enable User Signups
- **Command / Action**:
  - In [Supabase Dashboard -> Authentication -> Settings](https://supabase.com/dashboard/project/qrntmoeoqqmnkgdsxmrv/auth/users):
  - Toggle **Disable new user sign ups** to `OFF`.
- **Expected Result**: Public user registrations are enabled.

#### Step 14: Final Public Health & Service Probes
- **Command / Action** (in PowerShell):
  ```powershell
  # 1. Verify backend health endpoint
  Invoke-RestMethod -Uri "https://format-tool-backend.onrender.com/health" -Method Get

  # 2. Verify Data API public probe returns valid response (not 503)
  Invoke-RestMethod -Uri "https://qrntmoeoqqmnkgdsxmrv.supabase.co/rest/v1/profiles" -Headers @{ "apikey" = $env:VITE_SUPABASE_ANON_KEY } -Method Get
  ```
- **Expected Result**: Backend returns `{ "status": "ok", ... }` (HTTP 200). PostgREST returns empty array `[]` (HTTP 200) under RLS.
