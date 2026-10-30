/**
 * ==============================================================================
 * FORMAT STUDIO — POST-RESET READ-ONLY VERIFICATION HARNESS (PART A)
 * ==============================================================================
 * Performs strict, read-only empty-state and schema verification post-reset.
 *
 * VALIDATION CRITERIA (Any violation causes NONZERO exit status):
 * 1. Target URL strictly validated before any client creation.
 * 2. Zero Auth Users (count === 0, strictly numeric, finite, non-null).
 * 3. Zero rows in all target application tables (profiles, documents, payments).
 * 4. All required schema columns are accessible via admin client.
 * 5. Rejects negative counts, NaN, Infinity, null, malformed auth responses, and query errors.
 *
 * NOTE ON RLS VERIFICATION:
 * An anonymous query against an empty table returns 0 rows, which does NOT prove
 * RLS policy enforcement. To prove RLS enforcement, execute the dedicated synthetic
 * acceptance test harness (server/scripts/06_synthetic_acceptance_test.mjs).
 *
 * USAGE:
 *   node server/scripts/05_verify_reset.mjs
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
} from './shared_validation.mjs';

export { validateTargetUrl, EXPECTED_PROJECT_REF, EXPECTED_HOSTNAME };

/**
 * Strictly evaluates that a count result is valid and exactly equal to 0.
 * Rejects negative numbers, NaN, Infinity, non-numeric values, null, undefined, and query errors.
 *
 * @param {string} resourceName
 * @param {any} count
 * @param {object|null} [error]
 * @returns {{ ok: boolean, message: string }}
 */
export function evaluateZeroCount(resourceName, count, error = null) {
  if (error) {
    return { ok: false, message: `Query to '${resourceName}' failed with error: ${error.message || 'Unknown error'}` };
  }
  if (typeof count !== 'number' || !Number.isFinite(count) || Number.isNaN(count)) {
    return { ok: false, message: `Query to '${resourceName}' returned non-finite or invalid count: ${count}` };
  }
  if (count < 0) {
    return { ok: false, message: `Query to '${resourceName}' returned negative count: ${count}` };
  }
  if (count !== 0) {
    return { ok: false, message: `Expected 0 records for '${resourceName}', found: ${count}` };
  }
  return { ok: true, message: `'${resourceName}' is verified empty (count: 0).` };
}

/**
 * Validates schema columns accessibility.
 * @param {string} tableName
 * @param {object|null} [error]
 * @returns {{ ok: boolean, message: string }}
 */
export function evaluateSchemaColumns(tableName, error = null) {
  if (error) {
    return { ok: false, message: `Schema verification for '${tableName}' failed: ${error.message || 'Unknown error'}` };
  }
  return { ok: true, message: `All required columns on '${tableName}' verified.` };
}

export async function runVerification(envOverrides = {}) {
  const env = { ...process.env, ...envOverrides };
  const rawUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_KEY;

  console.log('=== FORMAT STUDIO POST-RESET VERIFICATION HARNESS ===');
  console.log('Mode: Part A — Read-Only Empty-State & Schema Integrity Checks\n');

  // 1. Strict Target URL Validation
  const urlCheck = validateTargetUrl(rawUrl);
  if (!urlCheck.valid) {
    const err = `[FATAL] Target URL Validation Failed: ${urlCheck.error}`;
    console.error(err);
    return { success: false, errors: [err] };
  }

  if (!serviceKey || typeof serviceKey !== 'string' || serviceKey.length < 20) {
    const err = '[FATAL] Missing or invalid SUPABASE_SERVICE_KEY.';
    console.error(err);
    return { success: false, errors: [err] };
  }

  const adminClient = createClient(rawUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const failureMessages = [];

  // 2. Auth Users Zero-Count Check
  console.log('--- 1. AUTH USERS ZERO-COUNT AUDIT ---');
  try {
    const { data: userData, error: userError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 10 });
    const userCount = userData && Array.isArray(userData.users) ? userData.users.length : null;
    const authEval = evaluateZeroCount('auth.users', userCount, userError);
    if (!authEval.ok) {
      console.error(`❌ FAIL: ${authEval.message}`);
      failureMessages.push(authEval.message);
    } else {
      console.log(`✓ PASS: ${authEval.message}`);
    }
  } catch (err) {
    const msg = `Auth user verification threw exception: ${err.message}`;
    console.error(`❌ FAIL: ${msg}`);
    failureMessages.push(msg);
  }

  // 3. Application Tables Zero-Count Check
  console.log('\n--- 2. APPLICATION TABLES ZERO-COUNT AUDIT ---');
  const tables = ['profiles', 'documents', 'payments'];
  for (const table of tables) {
    try {
      const { count, error } = await adminClient.from(table).select('*', { count: 'exact', head: true });
      const tableEval = evaluateZeroCount(`public.${table}`, count, error);
      if (!tableEval.ok) {
        console.error(`❌ FAIL: ${tableEval.message}`);
        failureMessages.push(tableEval.message);
      } else {
        console.log(`✓ PASS: ${tableEval.message}`);
      }
    } catch (err) {
      const msg = `Table '${table}' count threw exception: ${err.message}`;
      console.error(`❌ FAIL: ${msg}`);
      failureMessages.push(msg);
    }
  }

  // 4. Schema Column Verifications
  console.log('\n--- 3. SCHEMA COLUMN ACCESSIBILITY AUDIT ---');
  const schemaChecks = [
    {
      table: 'profiles',
      query: adminClient.from('profiles').select('id, name, full_name, email, phone, org, plan, payment_id, created_at, updated_at').limit(0)
    },
    {
      table: 'documents',
      query: adminClient.from('documents').select('id, user_id, doc_type, file_name, pages, status, created_at').limit(0)
    },
    {
      table: 'payments',
      query: adminClient.from('payments').select('id, user_id, payment_id, amount, created_at').limit(0)
    }
  ];

  for (const check of schemaChecks) {
    try {
      const { error } = await check.query;
      const schemaEval = evaluateSchemaColumns(check.table, error);
      if (!schemaEval.ok) {
        console.error(`❌ FAIL: ${schemaEval.message}`);
        failureMessages.push(schemaEval.message);
      } else {
        console.log(`✓ PASS: ${schemaEval.message}`);
      }
    } catch (err) {
      const msg = `Schema query for '${check.table}' threw exception: ${err.message}`;
      console.error(`❌ FAIL: ${msg}`);
      failureMessages.push(msg);
    }
  }

  console.log('\n=== VERIFICATION SUMMARY ===');
  if (failureMessages.length > 0) {
    console.error('❌ VERIFICATION FAILED: One or more empty-state/schema checks did not pass.');
    return { success: false, errors: failureMessages };
  }

  console.log('✅ ALL READ-ONLY INTEGRITY & EMPTY-STATE CHECKS PASSED.');
  return { success: true, errors: [] };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
  dotenv.config({ path: path.resolve(__dirname, '../../client/.env') });

  runVerification()
    .then((res) => {
      if (!res.success) {
        process.exitCode = 1;
      }
    })
    .catch((err) => {
      console.error('[FATAL EXCEPTION]:', err.message);
      process.exitCode = 1;
    });
}
