/**
 * ==============================================================================
 * FORMAT STUDIO — SUPABASE RLS & ACCESS ISOLATION INTEGRATION TEST HARNESS
 * ==============================================================================
 * SAFETY GUARD:
 * This script MUST NOT be run against production. It requires explicit test-only
 * environment variables and explicit test confirmation before executing.
 *
 * REQUIRED TEST ENVIRONMENT VARIABLES:
 * - SUPABASE_TEST_URL
 * - SUPABASE_TEST_ANON_KEY
 * - SUPABASE_TEST_SERVICE_KEY
 * - SUPABASE_TEST_CONFIRMATION = "I_CONFIRM_THIS_IS_A_DISPOSABLE_TEST_INSTANCE"
 *
 * HOW TO RUN:
 * node scripts/supabase-integration-test.mjs
 * ==============================================================================
 */

import { createClient } from '@supabase/supabase-js';

const TEST_URL = process.env.SUPABASE_TEST_URL;
const TEST_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY;
const TEST_SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY;
const TEST_CONFIRMATION = process.env.SUPABASE_TEST_CONFIRMATION;

// 1. Guard against accidental production execution
if (!TEST_URL || !TEST_ANON_KEY || !TEST_SERVICE_KEY) {
  console.error('[BLOCKED] Missing test configuration environment variables:');
  console.error('  - SUPABASE_TEST_URL');
  console.error('  - SUPABASE_TEST_ANON_KEY');
  console.error('  - SUPABASE_TEST_SERVICE_KEY');
  console.error('\nRefusing to run against default application environment.');
  process.exit(1);
}

if (TEST_CONFIRMATION !== 'I_CONFIRM_THIS_IS_A_DISPOSABLE_TEST_INSTANCE') {
  console.error('[BLOCKED] Safety confirmation missing:');
  console.error('  SUPABASE_TEST_CONFIRMATION must equal "I_CONFIRM_THIS_IS_A_DISPOSABLE_TEST_INSTANCE"');
  console.error('\nRefusing to run against unconfirmed database instance.');
  process.exit(1);
}

if (process.env.SUPABASE_URL && TEST_URL === process.env.SUPABASE_URL && !TEST_URL.includes('127.0.0.1') && !TEST_URL.includes('localhost')) {
  console.error('[BLOCKED] SUPABASE_TEST_URL matches configured application SUPABASE_URL.');
  console.error('Refusing to execute integration test against configured primary instance.');
  process.exit(1);
}

console.log('--- SUPABASE ISOLATION HARNESS INITIALIZING ---');
console.log('Target URL:', TEST_URL);

const adminClient = createClient(TEST_URL, TEST_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const createdUserIds = [];

async function runHarness() {
  const timestamp = Date.now();
  const emailA = `synth_test_a_${timestamp}@test.local`;
  const emailB = `synth_test_b_${timestamp}@test.local`;
  const password = `TestPass!987_${timestamp}`;

  console.log('Creating synthetic user A and user B...');

  // 1. Create User A via Admin API
  const { data: userAData, error: createAError } = await adminClient.auth.admin.createUser({
    email: emailA,
    password,
    email_confirm: true,
  });
  if (createAError) throw new Error(`Failed to create synthetic user A: ${createAError.message}`);
  const userA = userAData.user;
  createdUserIds.push(userA.id);

  // 2. Create User B via Admin API
  const { data: userBData, error: createBError } = await adminClient.auth.admin.createUser({
    email: emailB,
    password,
    email_confirm: true,
  });
  if (createBError) throw new Error(`Failed to create synthetic user B: ${createBError.message}`);
  const userB = userBData.user;
  createdUserIds.push(userB.id);

  console.log('Synthetic users created successfully.');

  // 3. Authenticate User A and User B to obtain user tokens (using Anon Client)
  const anonClientA = createClient(TEST_URL, TEST_ANON_KEY);
  const { data: authA, error: loginAError } = await anonClientA.auth.signInWithPassword({
    email: emailA,
    password,
  });
  if (loginAError) throw new Error(`User A login failed: ${loginAError.message}`);

  const anonClientB = createClient(TEST_URL, TEST_ANON_KEY);
  const { data: authB, error: loginBError } = await anonClientB.auth.signInWithPassword({
    email: emailB,
    password,
  });
  if (loginBError) throw new Error(`User B login failed: ${loginBError.message}`);

  console.log('Both users authenticated via anon key + user tokens.');

  // 4. Test User A inserting own profile
  console.log('\n[Check 1] User A initializes own profile...');
  const { error: profileAInsertErr } = await anonClientA
    .from('profiles')
    .insert({ id: userA.id, name: 'Synthetic User A', plan: 'free' });
  if (profileAInsertErr) throw new Error(`User A profile insert failed: ${profileAInsertErr.message}`);
  console.log('  PASS: User A inserted own free profile.');

  // 5. Test User A attempting to self-elevate plan to 'pro'
  console.log('\n[Check 2] User A attempts to self-elevate plan to "pro"...');
  const { error: elevateErr } = await anonClientA
    .from('profiles')
    .update({ plan: 'pro' })
    .eq('id', userA.id);
  if (!elevateErr) {
    // Check if row actually changed
    const { data: checkPlan } = await anonClientA.from('profiles').select('plan').eq('id', userA.id).single();
    if (checkPlan?.plan === 'pro') {
      throw new Error('SECURITY VIOLATION: User A successfully elevated plan to pro via anon client!');
    }
  }
  console.log('  PASS: Direct plan elevation was rejected / prohibited.');

  // 6. Test User A attempting to read User B profile
  console.log('\n[Check 3] User A attempts to read User B profile...');
  const { data: readBProfile } = await anonClientA
    .from('profiles')
    .select('*')
    .eq('id', userB.id);
  if (readBProfile && readBProfile.length > 0) {
    throw new Error('SECURITY VIOLATION: User A read User B private profile!');
  }
  console.log('  PASS: User A received 0 rows attempting to read User B profile.');

  // 7. Test User A creating document history for User B
  console.log('\n[Check 4] User A attempts to insert document owned by User B...');
  const { error: docInsertErr } = await anonClientA
    .from('documents')
    .insert({ user_id: userB.id, doc_type: 'book', file_name: 'forged.docx' });
  if (!docInsertErr) {
    throw new Error('SECURITY VIOLATION: User A inserted a document record for User B!');
  }
  console.log('  PASS: Cross-user document insert rejected.');

  // 8. Test Anonymous client reading documents
  console.log('\n[Check 5] Anonymous client attempts to read documents...');
  const unauthClient = createClient(TEST_URL, TEST_ANON_KEY);
  const { data: anonDocs } = await unauthClient.from('documents').select('*');
  if (anonDocs && anonDocs.length > 0) {
    throw new Error('SECURITY VIOLATION: Anonymous client read private document records!');
  }
  console.log('  PASS: Anonymous client received 0 rows from documents.');

  console.log('\n--- ALL RLS & ISOLATION CHECKS PASSED ON DISPOSABLE INSTANCE ---');
}

async function cleanup() {
  console.log('\n--- CLEANING UP TEST ARTIFACTS ---');
  for (const userId of createdUserIds) {
    try {
      await adminClient.from('documents').delete().eq('user_id', userId);
      await adminClient.from('payments').delete().eq('user_id', userId);
      await adminClient.from('profiles').delete().eq('id', userId);
      await adminClient.auth.admin.deleteUser(userId);
      console.log('Cleaned up synthetic user ID:', userId);
    } catch (err) {
      console.error('Cleanup error for user ID:', userId, err.message);
    }
  }
}

runHarness()
  .catch((err) => {
    console.error('\n[HARNESS FAILED]:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
  });
