/**
 * ==============================================================================
 * FORMAT STUDIO — SYNTHETIC ACCEPTANCE TEST HARNESS (PART B)
 * ==============================================================================
 * PROVES REAL RLS ISOLATION, FIELD PROTECTION & RBAC USING SEEDED SYNTHETIC USERS
 *
 * SAFETY GUARD:
 * This script MUST NOT be executed during the preparation/review phase.
 * It is designed for post-reset acceptance verification before public launch.
 *
 * EXECUTION GUARDS REQUIRED:
 * - $env:EXECUTE_SYNTHETIC_ACCEPTANCE="true"
 * - $env:CONFIRM_SYNTHETIC_TEST="YES_RUN_SYNTHETIC_ACCEPTANCE_TEST"
 * - $env:CONTROLLED_TEST_TOKEN="<temp_token>" (optional, for maintenance-gated test runs)
 *
 * COMPLETE ACCESS MATRIX TESTED:
 * 1. Target URL validation prior to client creation.
 * 2. Narrowly scoped, temporary controlled-test access configuration (no fixed public bypass key).
 * 3. User A and User B provisioning with cryptographically random credentials.
 * 4. Permitted own-profile and own-document reads and contact-field updates.
 * 5. Deterministic name / full_name synchronization.
 * 6. Cross-user read isolation on documents, payments, and profiles (error === null && data.length === 0).
 * 7. Cross-user update/delete denial on profiles, documents, and payments.
 * 8. Browser mutation denial on documents (INSERT/UPDATE/DELETE).
 * 9. Browser mutation denial on payments (INSERT/UPDATE/DELETE).
 * 10. Protected profile field modification denial (plan and payment_id immutability).
 * 11. Ownership reassignment denial on profiles, documents, and payments.
 * 12. Anonymous access denial across read and write operations.
 * 13. Authoritative post-mutation reads proving protected/denied records remained unchanged.
 * 14. Exhaustive, verifiable fixture cleanup with strict absence verification.
 * ==============================================================================
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  validateTargetUrl,
  EXPECTED_PROJECT_REF,
  EXPECTED_HOSTNAME,
  EXPECTED_SYNTHETIC_CONFIRMATION,
} from './shared_validation.mjs';

export { validateTargetUrl, EXPECTED_PROJECT_REF, EXPECTED_HOSTNAME, EXPECTED_SYNTHETIC_CONFIRMATION };

/**
 * Asserts a condition; throws descriptive Error on failure.
 * @param {boolean} condition
 * @param {string} message
 */
export function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

/**
 * Generates a secure, disposable synthetic password.
 * @returns {string}
 */
export function generateSecureSyntheticPassword() {
  return crypto.randomBytes(24).toString('base64url') + '!Aa1_#';
}

/**
 * Classifies whether an error represents an expected authorization/permission rejection.
 * Rejects transport/server errors (5xx), network errors, and invalid/expired JWT errors before checking codes.
 * Never classifies an error by message regex alone.
 *
 * @param {object|null} error
 * @returns {boolean}
 */
export function isExpectedPermissionError(error) {
  if (!error || typeof error !== 'object') return false;

  const status = Number(error.status || error.statusCode || 0);
  const code = String(error.code || '');
  const message = String(error.message || '');

  // 1. Immediately reject transport/server errors (5xx) even if message contains permission keywords
  if (status >= 500) {
    return false;
  }

  // 2. Reject network / connection / transport exceptions
  if (
    error.name === 'FetchError' ||
    error.name === 'TypeError' ||
    /network|econnrefused|etimedout|enotfound|socket|abort/i.test(message)
  ) {
    return false;
  }

  // 3. Reject invalid/expired JWT errors (session/token failures, not RLS authorization proof)
  if (/jwt expired|token expired|invalid jwt|invalid token|token is invalid|signature.*invalid/i.test(message)) {
    return false;
  }

  // 4. Must match explicit database or PostgREST authorization codes or status
  const isPermissionCode = code === '42501' || (code === 'P0001' && /unauthorized|immutable|permission/i.test(message));
  if (isPermissionCode) {
    return true;
  }

  const isPermissionStatus = status === 401 || status === 403;
  if (isPermissionStatus) {
    if (
      code === '42501' ||
      code === 'PGRST301' ||
      /permission denied|row-level security|violates rls|not authorized|unauthorized/i.test(message)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Asserts that a read/query operation resulted in successful empty-row denial under RLS.
 * Requires error === null and data to be an array with length === 0.
 *
 * @param {{ data: any, error: object|null }} result
 * @param {string} description
 */
export function assertEmptyRowDenial(result, description) {
  if (!result || typeof result !== 'object' || !('error' in result) || !('data' in result)) {
    throw new Error(`${description} returned malformed response: expected object with explicit data and error properties`);
  }
  const { data, error } = result;
  if (error !== null) {
    throw new Error(`${description} failed with unexpected error instead of clean empty result: ${error?.message || error}`);
  }
  if (!Array.isArray(data)) {
    throw new Error(`${description} failed: returned data is not an array (malformed response)`);
  }
  if (data.length !== 0) {
    throw new Error(`SECURITY VIOLATION: ${description} retrieved ${data.length} row(s); expected 0 rows under RLS`);
  }
}

/**
 * Asserts that a mutation (UPDATE/DELETE) was denied under RLS with 0 rows affected or an explicit permission error.
 * With no error, requires error === null AND Array.isArray(data) AND data.length === 0.
 * Rejects {}, undefined data, null data, and malformed responses.
 *
 * @param {{ data?: any, error?: object|null }} result
 * @param {string} description
 */
export function assertMutationDenial(result, description) {
  if (!result || typeof result !== 'object' || !('error' in result) || !('data' in result)) {
    throw new Error(`${description} returned malformed response: expected object with explicit data and error properties`);
  }
  const { data, error } = result;
  if (error !== null) {
    if (!isExpectedPermissionError(error)) {
      throw new Error(`${description} failed with unexpected non-permission error: ${error?.message || error} (code: ${error?.code || error?.status})`);
    }
    return;
  }
  if (!Array.isArray(data)) {
    throw new Error(`${description} returned malformed response: data must be an empty array when error is null (received: ${JSON.stringify(data)})`);
  }
  if (data.length > 0) {
    throw new Error(`SECURITY VIOLATION: ${description} succeeded and modified ${data.length} row(s); expected 0 rows`);
  }
}

/**
 * Asserts that an operation expected to fail explicitly (such as INSERT, revoked anonymous SELECT, or protected-field update)
 * produced the expected authorization/permission error. Does not infer denial from a missing response body.
 *
 * @param {{ data?: any, error?: object|null }} result
 * @param {string} description
 */
export function assertExplicitPermissionDenial(result, description) {
  if (!result || typeof result !== 'object' || !('error' in result)) {
    throw new Error(`${description} returned malformed response: expected object with explicit error property`);
  }
  const { data, error } = result;
  if (!error) {
    throw new Error(`SECURITY VIOLATION: ${description} did not return expected permission error (data: ${JSON.stringify(data)})`);
  }
  if (!isExpectedPermissionError(error)) {
    throw new Error(`${description} failed with unexpected non-permission error: ${error?.message || error} (code: ${error?.code || error?.status})`);
  }
}

/**
 * Validates that an Auth API response specifically indicates user-not-found (status 404 or code user_not_found).
 * Rejects transport/server errors (5xx), network errors, generic messages, and malformed responses.
 *
 * @param {object} res
 * @returns {boolean}
 */
export function isAuthUserNotFoundResponse(res) {
  if (!res || typeof res !== 'object') return false;
  const { data, error } = res;
  if (data?.user || res.user) return false;
  if (!error || typeof error !== 'object') return false;

  const status = Number(error.status || error.statusCode || 0);
  const code = String(error.code || '');
  const message = String(error.message || '');

  if (status >= 500) {
    return false;
  }

  if (
    error.name === 'FetchError' ||
    error.name === 'TypeError' ||
    /network|econnrefused|etimedout|enotfound|socket|abort/i.test(message)
  ) {
    return false;
  }

  if (status === 404) {
    return true;
  }
  if (code === 'user_not_found' && (status === 400 || status === 404 || status === 0)) {
    return true;
  }

  return false;
}

/**
 * Asserts that a database table query for a given fixture ID returned a successful empty array.
 * Rejects errors, malformed data, non-arrays, and non-zero row counts.
 *
 * @param {object} res
 * @param {string} tableName
 * @param {string} uid
 */
export function assertTableAbsence(res, tableName, uid) {
  if (!res || typeof res !== 'object' || !('error' in res) || !('data' in res)) {
    throw new Error(`Absence check for ${tableName} (${uid}) returned malformed response: expected object with explicit data and error properties`);
  }
  const { data, error } = res;
  if (error !== null) {
    throw new Error(`Absence check query failed for ${tableName} (${uid}): ${error?.message || error}`);
  }
  if (!Array.isArray(data)) {
    throw new Error(`Absence check for ${tableName} (${uid}) returned malformed data: expected array`);
  }
  if (data.length > 0) {
    throw new Error(`Fixture ${tableName} record for ${uid} is STILL PRESENT after cleanup (${data.length} row(s))`);
  }
}

/**
 * Main synthetic acceptance test runner.
 * Supports dependency injection for testing harness logic in isolation.
 *
 * @param {object} [envOverrides]
 * @param {object} [dependencies]
 * @param {Function} [dependencies.clientFactory]
 * @returns {Promise<{ success: boolean, errors: string[], previewOnly?: boolean }>}
 */
export async function runSyntheticAcceptanceTests(envOverrides = {}, dependencies = {}) {
  const env = { ...process.env, ...envOverrides };
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_KEY;
  const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

  const isExecuteMode = env.EXECUTE_SYNTHETIC_ACCEPTANCE === 'true';
  const confirmation = env.CONFIRM_SYNTHETIC_TEST;
  const controlledTestToken = env.CONTROLLED_TEST_TOKEN || env.MAINTENANCE_TEST_TOKEN || null;

  const clientFactory = dependencies.clientFactory || createClient;

  console.log('=== FORMAT STUDIO SYNTHETIC ACCEPTANCE TEST HARNESS ===');
  console.log('Mode: Part B — Live RLS, Permissions & Protection Verification\n');

  if (!isExecuteMode || confirmation !== EXPECTED_SYNTHETIC_CONFIRMATION) {
    console.log('Mode: PREVIEW ONLY (Synthetic acceptance test not executed).');
    console.log('To run this test post-reset, set:');
    console.log('  $env:EXECUTE_SYNTHETIC_ACCEPTANCE="true"');
    console.log(`  $env:CONFIRM_SYNTHETIC_TEST="${EXPECTED_SYNTHETIC_CONFIRMATION}"`);
    if (controlledTestToken) {
      console.log('  (Controlled test token configured for maintenance bypass)');
    }
    return { success: true, previewOnly: true, errors: [] };
  }

  // 1. Strict Target Validation BEFORE any client creation
  const urlCheck = validateTargetUrl(supabaseUrl);
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

  if (!anonKey || typeof anonKey !== 'string' || anonKey.length < 20) {
    const err = '[FATAL] Missing or invalid VITE_SUPABASE_ANON_KEY.';
    console.error(err);
    return { success: false, errors: [err] };
  }

  const adminClient = clientFactory(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const createdUserIds = [];
  const errorsEncountered = [];
  let userA = null;
  let userB = null;

  try {
    // 2. Provision Synthetic User A and User B
    const timestamp = Date.now() + '_' + crypto.randomInt(1000, 9999);
    const emailA = `synth_a_${timestamp}@acceptance.local`;
    const emailB = `synth_b_${timestamp}@acceptance.local`;
    const passwordA = generateSecureSyntheticPassword();
    const passwordB = generateSecureSyntheticPassword();

    console.log('1. Provisioning disposable synthetic User A and User B...');
    const { data: userAData, error: errA } = await adminClient.auth.admin.createUser({
      email: emailA,
      password: passwordA,
      email_confirm: true,
      user_metadata: { full_name: 'Synthetic User A' },
    });
    if (errA || !userAData?.user?.id) {
      throw new Error(`Failed to create synthetic User A: ${errA?.message || 'Unknown'}`);
    }
    userA = userAData.user;
    createdUserIds.push(userA.id);

    const { data: userBData, error: errB } = await adminClient.auth.admin.createUser({
      email: emailB,
      password: passwordB,
      email_confirm: true,
      user_metadata: { full_name: 'Synthetic User B' },
    });
    if (errB || !userBData?.user?.id) {
      throw new Error(`Failed to create synthetic User B: ${errB?.message || 'Unknown'}`);
    }
    userB = userBData.user;
    createdUserIds.push(userB.id);

    // 3. Authenticate User A, User B, and Anon Client with optional controlled-test header
    console.log('2. Authenticating clients for User A, User B, and Anonymous...');
    const clientCustomOptions = {
      auth: { autoRefreshToken: false, persistSession: false },
      ...(controlledTestToken
        ? { global: { headers: { 'x-controlled-test-key': controlledTestToken } } }
        : {}),
    };

    const clientA = clientFactory(supabaseUrl, anonKey, clientCustomOptions);
    const clientB = clientFactory(supabaseUrl, anonKey, clientCustomOptions);
    const anonClient = clientFactory(supabaseUrl, anonKey, clientCustomOptions);

    const { error: signinErrA } = await clientA.auth.signInWithPassword({ email: emailA, password: passwordA });
    assertCondition(!signinErrA, `User A signin failed: ${signinErrA?.message}`);

    const { error: signinErrB } = await clientB.auth.signInWithPassword({ email: emailB, password: passwordB });
    assertCondition(!signinErrB, `User B signin failed: ${signinErrB?.message}`);

    // 4. Signup / Profile Initialization Flow
    console.log('3. Initializing profile records according to application flow...');
    const { data: existingProfA, error: checkProfErrA } = await clientA.from('profiles').select('*').eq('id', userA.id);
    assertCondition(!checkProfErrA, `Profile check query failed: ${checkProfErrA?.message}`);

    if (existingProfA && existingProfA.length === 1) {
      console.log('  ✓ Profile auto-created via auth trigger; plan verified as free.');
      assertCondition(existingProfA[0].plan === 'free', 'Auto-created profile must default to free plan');
    } else {
      console.log('  ✓ Inserting default profile via application signup path...');
      const { error: insertProfErrA } = await clientA.from('profiles').insert({
        id: userA.id,
        name: 'Synthetic User A',
        phone: '+91 98765 43210',
        org: 'Test Organization A',
        plan: 'free',
      });
      assertCondition(!insertProfErrA, `User A profile insert failed: ${insertProfErrA?.message}`);
    }

    const { data: existingProfB } = await clientB.from('profiles').select('*').eq('id', userB.id);
    if (!existingProfB || existingProfB.length === 0) {
      const { error: insertProfErrB } = await clientB.from('profiles').insert({
        id: userB.id,
        name: 'Synthetic User B',
        phone: '+91 91234 56789',
        org: 'Test Organization B',
        plan: 'free',
      });
      assertCondition(!insertProfErrB, `User B profile insert failed: ${insertProfErrB?.message}`);
    }

    // 5. Permitted Own-Profile Update (Contact Fields) & Name/Full_Name Sync
    console.log('4. Testing permitted own-profile contact-field update for User A...');
    const updatedName = 'Synthetic User A Updated';
    const updatedPhone = '+91 90000 00000';
    const { error: updateProfErr } = await clientA
      .from('profiles')
      .update({ name: updatedName, phone: updatedPhone })
      .eq('id', userA.id);
    assertCondition(!updateProfErr, `User A contact update failed: ${updateProfErr?.message}`);

    const { data: recheckProfA, error: recheckErrA } = await clientA.from('profiles').select('*').eq('id', userA.id);
    assertCondition(!recheckErrA && recheckProfA?.length === 1, 'Failed to fetch updated profile for User A');
    assertCondition(recheckProfA[0].name === updatedName, 'Updated profile name was not persisted');
    assertCondition(recheckProfA[0].phone === updatedPhone, 'Updated profile phone was not persisted');
    assertCondition(recheckProfA[0].full_name === updatedName, 'Full name was not synchronized with name');
    console.log('  ✓ Contact fields updated and name/full_name synchronized deterministically.');

    // 6. Seed Test Document and Payment Fixtures via Service-Role (Simulating Backend Process)
    console.log('5. Setting up test fixtures via service-role (Fixture Setup)...');
    const { error: docFixtureErr } = await adminClient.from('documents').insert({
      user_id: userA.id,
      doc_type: 'thesis',
      file_name: 'synthetic_thesis.docx',
      pages: 12,
      status: 'done',
    });
    assertCondition(!docFixtureErr, `Document fixture insert failed: ${docFixtureErr?.message}`);

    const { error: payFixtureErr } = await adminClient.from('payments').insert({
      user_id: userA.id,
      payment_id: 'pay_synthetic_123',
      amount: 19900,
    });
    assertCondition(!payFixtureErr, `Payment fixture insert failed: ${payFixtureErr?.message}`);
    console.log('  ✓ Test document and payment fixtures seeded via service-role.');

    // 7. Permitted Own-Record Reads (User A)
    console.log('6. Verifying User A can read own documents and payments...');
    const { data: ownDocs, error: ownDocsErr } = await clientA.from('documents').select('*').eq('user_id', userA.id);
    assertCondition(!ownDocsErr && Array.isArray(ownDocs) && ownDocs.length === 1, 'User A failed to read own document');

    const { data: ownPay, error: ownPayErr } = await clientA.from('payments').select('*').eq('user_id', userA.id);
    assertCondition(!ownPayErr && Array.isArray(ownPay) && ownPay.length === 1, 'User A failed to read own payment');
    console.log('  ✓ User A successfully read own document and payment ledger records.');

    // 8. Cross-User Read Isolation (User B cannot read User A records)
    console.log('7. Verifying User B CANNOT read User A records (RLS read isolation)...');
    const crossDocsRes = await clientB.from('documents').select('*').eq('user_id', userA.id);
    assertEmptyRowDenial(crossDocsRes, 'User B cross-read documents');

    const crossPayRes = await clientB.from('payments').select('*').eq('user_id', userA.id);
    assertEmptyRowDenial(crossPayRes, 'User B cross-read payments');

    const crossProfRes = await clientB.from('profiles').select('*').eq('id', userA.id);
    assertEmptyRowDenial(crossProfRes, 'User B cross-read profile');
    console.log('  ✓ Cross-user read isolation confirmed for documents, payments, and profiles.');

    // 9. Cross-User Mutation Denial (User B cannot update/delete User A records)
    console.log('8. Verifying User B CANNOT modify User A records...');
    const crossUpdateProfRes = await clientB.from('profiles').update({ name: 'Tampered By B' }).eq('id', userA.id).select();
    assertMutationDenial(crossUpdateProfRes, 'User B cross-update profile');

    const crossUpdateDocRes = await clientB.from('documents').update({ status: 'tampered' }).eq('user_id', userA.id).select();
    assertMutationDenial(crossUpdateDocRes, 'User B cross-update document');

    const crossDeleteDocRes = await clientB.from('documents').delete().eq('user_id', userA.id).select();
    assertMutationDenial(crossDeleteDocRes, 'User B cross-delete document');

    const crossDeletePayRes = await clientB.from('payments').delete().eq('user_id', userA.id).select();
    assertMutationDenial(crossDeletePayRes, 'User B cross-delete payment');
    console.log('  ✓ Cross-user mutation denials confirmed.');

    // 10. Denied Browser Direct Mutations on Documents (INSERT/UPDATE/DELETE)
    console.log('9. Verifying browser CANNOT mutate documents directly...');
    const directDocInsertRes = await clientA.from('documents').insert({ user_id: userA.id, doc_type: 'letter', file_name: 'hacked.docx' });
    assertExplicitPermissionDenial(directDocInsertRes, 'Browser direct document INSERT');

    const directDocUpdateRes = await clientA.from('documents').update({ status: 'tampered' }).eq('user_id', userA.id).select();
    assertMutationDenial(directDocUpdateRes, 'Browser direct document UPDATE');

    const directDocDeleteRes = await clientA.from('documents').delete().eq('user_id', userA.id).select();
    assertMutationDenial(directDocDeleteRes, 'Browser direct document DELETE');
    console.log('  ✓ Browser direct document mutations strictly denied.');

    // 11. Denied Browser Direct Mutations on Payments (INSERT/UPDATE/DELETE)
    console.log('10. Verifying browser CANNOT mutate payments ledger directly...');
    const directPayInsertRes = await clientA.from('payments').insert({ user_id: userA.id, payment_id: 'fake_pay', amount: 19900 });
    assertExplicitPermissionDenial(directPayInsertRes, 'Browser direct payment INSERT');

    const directPayUpdateRes = await clientA.from('payments').update({ amount: 0 }).eq('user_id', userA.id).select();
    assertMutationDenial(directPayUpdateRes, 'Browser direct payment UPDATE');

    const directPayDeleteRes = await clientA.from('payments').delete().eq('user_id', userA.id).select();
    assertMutationDenial(directPayDeleteRes, 'Browser direct payment DELETE');
    console.log('  ✓ Browser direct payment mutations strictly denied.');

    // 12. Protected Profile Fields Denial & Authoritative Verification
    console.log('11. Verifying plan and payment_id immutability (Trigger & Grant Protection)...');
    const planEscalateRes = await clientA.from('profiles').update({ plan: 'pro' }).eq('id', userA.id);
    assertExplicitPermissionDenial(planEscalateRes, 'Browser plan escalation to pro');

    const paymentForgeRes = await clientA.from('profiles').update({ payment_id: 'forged_razorpay_id' }).eq('id', userA.id);
    assertExplicitPermissionDenial(paymentForgeRes, 'Browser payment_id forgery');

    // Authoritative read confirming plan and payment_id remained unchanged
    const { data: authProfCheck, error: authProfCheckErr } = await adminClient
      .from('profiles')
      .select('plan, payment_id')
      .eq('id', userA.id)
      .single();
    assertCondition(!authProfCheckErr && authProfCheck, 'Authoritative profile fetch failed');
    assertCondition(authProfCheck.plan === 'free', `SECURITY VIOLATION: Plan mutated to '${authProfCheck.plan}'; must remain 'free'`);
    assertCondition(authProfCheck.payment_id === null, 'SECURITY VIOLATION: payment_id mutated; must remain null');
    console.log('  ✓ Authoritative check confirmed plan (free) and payment_id (null) remained untouched.');

    // 13. Ownership Reassignment Denial & Authoritative Verification
    console.log('12. Verifying ownership reassignment attempts are denied...');
    const reassignProfRes = await clientA.from('profiles').update({ id: userB.id }).eq('id', userA.id).select();
    assertMutationDenial(reassignProfRes, 'Profile ownership reassignment to User B');

    const reassignDocRes = await clientA.from('documents').update({ user_id: userB.id }).eq('user_id', userA.id).select();
    assertMutationDenial(reassignDocRes, 'Document ownership reassignment to User B');

    const reassignPayRes = await clientA.from('payments').update({ user_id: userB.id }).eq('user_id', userA.id).select();
    assertMutationDenial(reassignPayRes, 'Payment ownership reassignment to User B');

    // Authoritative read confirming User A still owns records
    const { data: authDocCheck } = await adminClient.from('documents').select('user_id').eq('user_id', userA.id);
    assertCondition(authDocCheck?.length === 1 && authDocCheck[0].user_id === userA.id, 'Document ownership was corrupted');

    const { data: authPayCheck } = await adminClient.from('payments').select('user_id').eq('user_id', userA.id);
    assertCondition(authPayCheck?.length === 1 && authPayCheck[0].user_id === userA.id, 'Payment ownership was corrupted');
    console.log('  ✓ Ownership reassignment attempts strictly denied.');

    // 14. Anonymous Access Denial (Schema Revokes SELECT and Mutations on All Target Tables from anon)
    console.log('13. Verifying Anonymous client access denial across tables (explicit permission rejection)...');
    const anonDocsRes = await anonClient.from('documents').select('*');
    assertExplicitPermissionDenial(anonDocsRes, 'Anonymous SELECT documents');

    const anonProfRes = await anonClient.from('profiles').select('*');
    assertExplicitPermissionDenial(anonProfRes, 'Anonymous SELECT profiles');

    const anonPayRes = await anonClient.from('payments').select('*');
    assertExplicitPermissionDenial(anonPayRes, 'Anonymous SELECT payments');

    const anonInsertDocRes = await anonClient.from('documents').insert({ user_id: userA.id, doc_type: 'book', file_name: 'anon.docx' });
    assertExplicitPermissionDenial(anonInsertDocRes, 'Anonymous INSERT documents');

    const anonInsertPayRes = await anonClient.from('payments').insert({ user_id: userA.id, payment_id: 'anon_pay', amount: 100 });
    assertExplicitPermissionDenial(anonInsertPayRes, 'Anonymous INSERT payments');
    console.log('  ✓ Anonymous read and mutation attempts strictly denied.');

    console.log('\n✅ ALL BOUNDED ACCESS MATRIX TESTS PASSED.');
  } catch (err) {
    console.error(`\n❌ SYNTHETIC ACCEPTANCE FAILURE: ${err.message}`);
    errorsEncountered.push(err.message);
  } finally {
    // 15. Exhaustive, Verifiable Fixture Cleanup
    console.log('\n--- EXHAUSTIVE FIXTURE CLEANUP & VERIFICATION ---');
    let cleanupFailed = false;

    for (const uid of createdUserIds) {
      console.log(`Cleaning fixture user: ${uid}`);

      // 1. Delete documents fixture
      try {
        const { error: docDelErr } = await adminClient.from('documents').delete().eq('user_id', uid);
        if (docDelErr) {
          const msg = `Failed to delete documents for fixture user ${uid}: ${docDelErr.message}`;
          console.error(`  ⚠️ ${msg}`);
          errorsEncountered.push(msg);
          cleanupFailed = true;
        }
      } catch (e) {
        const msg = `Exception deleting documents for fixture user ${uid}: ${e.message}`;
        console.error(`  ⚠️ ${msg}`);
        errorsEncountered.push(msg);
        cleanupFailed = true;
      }

      // 2. Delete payments fixture (cleaned before Auth user deletion)
      try {
        const { error: payDelErr } = await adminClient.from('payments').delete().eq('user_id', uid);
        if (payDelErr) {
          const msg = `Failed to delete payments for fixture user ${uid}: ${payDelErr.message}`;
          console.error(`  ⚠️ ${msg}`);
          errorsEncountered.push(msg);
          cleanupFailed = true;
        }
      } catch (e) {
        const msg = `Exception deleting payments for fixture user ${uid}: ${e.message}`;
        console.error(`  ⚠️ ${msg}`);
        errorsEncountered.push(msg);
        cleanupFailed = true;
      }

      // 3. Delete profile fixture
      try {
        const { error: profDelErr } = await adminClient.from('profiles').delete().eq('id', uid);
        if (profDelErr) {
          const msg = `Failed to delete profile for fixture user ${uid}: ${profDelErr.message}`;
          console.error(`  ⚠️ ${msg}`);
          errorsEncountered.push(msg);
          cleanupFailed = true;
        }
      } catch (e) {
        const msg = `Exception deleting profile for fixture user ${uid}: ${e.message}`;
        console.error(`  ⚠️ ${msg}`);
        errorsEncountered.push(msg);
        cleanupFailed = true;
      }

      // 4. Delete Auth user
      try {
        const { error: userDelErr } = await adminClient.auth.admin.deleteUser(uid);
        if (userDelErr) {
          const msg = `Failed to delete Auth user for fixture ${uid}: ${userDelErr.message}`;
          console.error(`  ⚠️ ${msg}`);
          errorsEncountered.push(msg);
          cleanupFailed = true;
        }
      } catch (e) {
        const msg = `Exception deleting Auth user for fixture ${uid}: ${e.message}`;
        console.error(`  ⚠️ ${msg}`);
        errorsEncountered.push(msg);
        cleanupFailed = true;
      }
    }

    // Post-Cleanup Absence Verification
    console.log('Verifying absence of all created fixture users and rows...');
    for (const uid of createdUserIds) {
      // Verify Auth user absence (strict user_not_found / 404 response check)
      try {
        const userRes = await adminClient.auth.admin.getUserById(uid);
        if (userRes?.data?.user || userRes?.user) {
          const msg = `Fixture user ${uid} is STILL PRESENT after cleanup!`;
          console.error(`  ❌ ${msg}`);
          errorsEncountered.push(msg);
          cleanupFailed = true;
        } else if (!isAuthUserNotFoundResponse(userRes)) {
          const msg = `Auth user absence check for ${uid} failed to confirm user-not-found (status: ${userRes?.error?.status}, message: ${userRes?.error?.message})`;
          console.error(`  ❌ ${msg}`);
          errorsEncountered.push(msg);
          cleanupFailed = true;
        }
      } catch (e) {
        const msg = `Exception checking Auth user absence for ${uid}: ${e.message}`;
        console.error(`  ❌ ${msg}`);
        errorsEncountered.push(msg);
        cleanupFailed = true;
      }

      // Verify Profile absence (strict empty array check)
      try {
        const profRes = await adminClient.from('profiles').select('id').eq('id', uid);
        assertTableAbsence(profRes, 'profiles', uid);
      } catch (e) {
        console.error(`  ❌ ${e.message}`);
        errorsEncountered.push(e.message);
        cleanupFailed = true;
      }

      // Verify Documents absence (strict empty array check)
      try {
        const docRes = await adminClient.from('documents').select('id').eq('user_id', uid);
        assertTableAbsence(docRes, 'documents', uid);
      } catch (e) {
        console.error(`  ❌ ${e.message}`);
        errorsEncountered.push(e.message);
        cleanupFailed = true;
      }

      // Verify Payments absence (strict empty array check)
      try {
        const payRes = await adminClient.from('payments').select('id').eq('user_id', uid);
        assertTableAbsence(payRes, 'payments', uid);
      } catch (e) {
        console.error(`  ❌ ${e.message}`);
        errorsEncountered.push(e.message);
        cleanupFailed = true;
      }
    }

    if (!cleanupFailed) {
      console.log('✓ All synthetic fixture records and users verified cleanly removed.');
    }
  }

  if (errorsEncountered.length > 0) {
    console.error('\n❌ HARNESS FAILED WITH ERRORS:');
    for (const e of errorsEncountered) {
      console.error(`  - ${e}`);
    }
    return { success: false, errors: errorsEncountered };
  }

  console.log('\n🎉 ALL ACCEPTANCE TESTS AND FIXTURE CLEANUP SUCCEEDED (PASS).');
  return { success: true, errors: [] };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
  dotenv.config({ path: path.resolve(__dirname, '../../client/.env') });

  runSyntheticAcceptanceTests()
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
