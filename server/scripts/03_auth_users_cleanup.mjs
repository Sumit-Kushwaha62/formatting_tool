/**
 * ==============================================================================
 * FORMAT STUDIO — GUARDED AUTH-USER CLEANUP UTILITY
 * ==============================================================================
 * Target Supabase Project: qrntmoeoqqmnkgdsxmrv
 * Target Hostname: qrntmoeoqqmnkgdsxmrv.supabase.co
 *
 * SAFETY GUARDS:
 * 1. Strict URL validation via shared validator (enforces HTTPS, exact hostname,
 *    rejects userinfo, lookalikes, custom ports, paths, or queries BEFORE creating
 *    any client or transmitting credentials).
 * 2. Default mode is DRY-RUN (no deletions performed without explicit flags).
 * 3. In live execution mode, strictly validates TARGET_PROJECT_REF and confirmation
 *    string before making any network calls.
 * 4. Multi-page pagination to accurately discover all existing users.
 * 5. Re-queries remaining users post-execution to verify true state.
 * 6. Sanitizes logs to prevent leaking personal emails, passwords, or raw provider errors.
 * 7. Returns nonzero exit code (exit 1) on any failure.
 *
 * USAGE:
 *   # 1. Preview mode (Dry Run):
 *   node server/scripts/03_auth_users_cleanup.mjs
 *
 *   # 2. Execution mode (Live Destruction - Pending Review):
 *   $env:EXECUTE_WIPE="true"
 *   $env:TARGET_PROJECT_REF="qrntmoeoqqmnkgdsxmrv"
 *   $env:CONFIRM_WIPE_ALL_AUTH_USERS="YES_DELETE_ALL_AUTH_USERS_QRNTMOEOQQMNKGDSXMRV"
 *   node server/scripts/03_auth_users_cleanup.mjs
 * ==============================================================================
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  validateTargetUrl,
  EXPECTED_PROJECT_REF,
  EXPECTED_HOSTNAME,
  EXPECTED_AUTH_CONFIRMATION,
} from './shared_validation.mjs';

export { validateTargetUrl, EXPECTED_PROJECT_REF, EXPECTED_HOSTNAME, EXPECTED_AUTH_CONFIRMATION };

/**
 * Enumerates all auth users across multiple pages.
 * @param {object} adminAuthClient
 * @returns {Promise<{ users: Array<{ id: string, created_at: string }>, error?: string }>}
 */
export async function fetchAllAuthUsers(adminAuthClient) {
  let allUsers = [];
  let page = 1;
  const perPage = 50;

  while (true) {
    const { data, error } = await adminAuthClient.listUsers({ page, perPage });
    if (error) {
      return { users: [], error: 'Failed to enumerate auth users' };
    }

    if (!data?.users || data.users.length === 0) break;
    for (const u of data.users) {
      allUsers.push({ id: u.id, created_at: u.created_at });
    }
    if (data.users.length < perPage) break;
    page += 1;
  }

  return { users: allUsers };
}

/**
 * Main execution function.
 * @param {object} [envOverrides] - Optional environment overrides for testing
 * @returns {Promise<{ success: boolean, deleted: number, remaining: number, error?: string, dryRun?: boolean }>}
 */
export async function runAuthCleanup(envOverrides = {}) {
  const env = { ...process.env, ...envOverrides };
  const rawUrl = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_KEY;
  const isExecuteMode = env.EXECUTE_WIPE === 'true';
  const targetProjectRef = env.TARGET_PROJECT_REF;
  const userConfirmation = env.CONFIRM_WIPE_ALL_AUTH_USERS;

  console.log('=== FORMAT STUDIO AUTH-USER CLEANUP UTILITY ===');
  console.log(`Execution Mode: ${isExecuteMode ? '🔴 LIVE EXECUTION (DESTRUCTIVE)' : '🟢 DRY RUN (PREVIEW ONLY)'}`);

  // 1. Strict URL validation BEFORE client creation
  const urlCheck = validateTargetUrl(rawUrl);
  if (!urlCheck.valid) {
    const err = `[BLOCKED] URL Security Validation Failed: ${urlCheck.error}`;
    console.error(err);
    return { success: false, deleted: 0, remaining: -1, error: err };
  }

  if (!serviceKey || typeof serviceKey !== 'string' || serviceKey.length < 20) {
    const err = '[BLOCKED] Missing or invalid SUPABASE_SERVICE_KEY.';
    console.error(err);
    return { success: false, deleted: 0, remaining: -1, error: err };
  }

  // 2. Execution Guard Validation for Live Mode (before any network calls)
  if (isExecuteMode) {
    if (targetProjectRef !== EXPECTED_PROJECT_REF) {
      const err = `[BLOCKED] TARGET_PROJECT_REF ("${targetProjectRef}") must equal "${EXPECTED_PROJECT_REF}".`;
      console.error(err);
      return { success: false, deleted: 0, remaining: -1, error: err };
    }

    if (userConfirmation !== EXPECTED_AUTH_CONFIRMATION) {
      const err = '[BLOCKED] Confirmation string mismatch.';
      console.error(err);
      return { success: false, deleted: 0, remaining: -1, error: err };
    }
  }

  const supabase = createClient(rawUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 3. Paginated User Enumeration
  const { users, error: listError } = await fetchAllAuthUsers(supabase.auth.admin);
  if (listError) {
    const err = `[ERROR] ${listError}`;
    console.error(err);
    return { success: false, deleted: 0, remaining: -1, error: err };
  }

  const totalUsers = users.length;
  console.log(`Discovered ${totalUsers} registered auth user(s).`);

  if (totalUsers === 0) {
    console.log('No auth users exist. Cleanup completed (0 records).');
    return { success: true, deleted: 0, remaining: 0 };
  }

  // 4. Dry Run Summary
  if (!isExecuteMode) {
    console.log('\n--- DRY RUN SUMMARY ---');
    console.log(`Target Hostname: ${EXPECTED_HOSTNAME}`);
    console.log(`Total users targeted for deletion: ${totalUsers}`);
    console.log('To execute deletion, set the following environment variables:');
    console.log('  $env:EXECUTE_WIPE="true"');
    console.log(`  $env:TARGET_PROJECT_REF="${EXPECTED_PROJECT_REF}"`);
    console.log(`  $env:CONFIRM_WIPE_ALL_AUTH_USERS="${EXPECTED_AUTH_CONFIRMATION}"`);
    return { success: true, deleted: 0, remaining: totalUsers, dryRun: true };
  }

  console.log('\n⚠️  EXECUTING LIVE DELETION OF AUTH USERS VIA ADMIN API ⚠️');
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < totalUsers; i++) {
    const userId = users[i].id;
    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) {
        console.error(`[FAIL] User [${i + 1}/${totalUsers}]: User deletion failed.`);
        failCount += 1;
      } else {
        successCount += 1;
        if (successCount % 5 === 0 || successCount === totalUsers) {
          console.log(`[PROGRESS] Deleted ${successCount}/${totalUsers} users...`);
        }
      }
    } catch {
      console.error(`[EXCEPTION] User [${i + 1}/${totalUsers}]: Network or execution exception.`);
      failCount += 1;
    }
  }

  // 5. Post-Execution State Re-query
  console.log('\n--- POST-EXECUTION VERIFICATION ---');
  const postCheck = await fetchAllAuthUsers(supabase.auth.admin);
  const remainingCount = postCheck.users ? postCheck.users.length : -1;

  console.log(`Successfully Deleted: ${successCount}`);
  console.log(`Failed Deletions:    ${failCount}`);
  console.log(`Observed Remaining Users: ${remainingCount}`);

  if (failCount > 0 || remainingCount > 0) {
    const err = `Auth user cleanup incomplete. ${remainingCount} user(s) remain.`;
    console.error(`[ERROR] ${err}`);
    return { success: false, deleted: successCount, remaining: remainingCount, error: err };
  }

  console.log('✅ All targeted auth users successfully deleted.');
  return { success: true, deleted: successCount, remaining: 0 };
}

// Run CLI when invoked directly
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  dotenv.config({ path: path.resolve(__dirname, '../.env') });

  runAuthCleanup()
    .then((res) => {
      if (!res.success) {
        process.exitCode = 1;
      }
    })
    .catch(() => {
      console.error('[FATAL] Unexpected cleanup error occurred.');
      process.exitCode = 1;
    });
}
