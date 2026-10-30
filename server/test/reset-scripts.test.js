/**
 * ==============================================================================
 * FORMAT STUDIO — RESET UTILITIES & SAFETY GUARDS UNIT TESTS
 * ==============================================================================
 * Validates the safety guards and logic of the reset artifacts:
 * 1. Strict URL validation & lookalike URL rejection (Shared Helper).
 * 2. Multi-page user enumeration pagination logic.
 * 3. Local directory boundary, path.relative containment & symlink/sibling rejection.
 * 4. Zero-count verification failure logic on non-zero, negative, NaN, null, or network errors.
 * 5. Error classification rules (network errors !== RLS proof).
 * 6. Centralized response classification (empty-row denial vs mutation denial).
 * 7. Executable Synthetic Acceptance Harness via Dependency Injection:
 *    - Full successful matrix execution with simulated clients.
 *    - Signup-trigger created profile handling.
 *    - Controlled-test token header wiring & validation.
 *    - Injected network failure.
 *    - Injected unexpected database error.
 *    - Injected returned cleanup error.
 *    - Injected thrown cleanup exception.
 *    - Injected failed absence check (user still present).
 * ==============================================================================
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTargetUrl,
  EXPECTED_PROJECT_REF,
  EXPECTED_HOSTNAME,
  EXPECTED_AUTH_CONFIRMATION,
  EXPECTED_SYNTHETIC_CONFIRMATION,
} from '../scripts/shared_validation.mjs';
import { fetchAllAuthUsers, runAuthCleanup } from '../scripts/03_auth_users_cleanup.mjs';
import { isSafeDirectory, processDirectory } from '../scripts/04_local_storage_cleanup.mjs';
import { evaluateZeroCount, evaluateSchemaColumns } from '../scripts/05_verify_reset.mjs';
import {
  generateSecureSyntheticPassword,
  isExpectedPermissionError,
  assertEmptyRowDenial,
  assertMutationDenial,
  assertExplicitPermissionDenial,
  isAuthUserNotFoundResponse,
  assertTableAbsence,
  runSyntheticAcceptanceTests,
} from '../scripts/06_synthetic_acceptance_test.mjs';
import fs from 'fs';
import path from 'path';
import os from 'os';

test('URL Validation — accepts exact HTTPS Supabase target URL', () => {
  const result = validateTargetUrl('https://qrntmoeoqqmnkgdsxmrv.supabase.co');
  assert.equal(result.valid, true);
  assert.equal(result.parsed.hostname, EXPECTED_HOSTNAME);
  assert.equal(result.parsed.protocol, 'https:');
  assert.equal(result.parsed.pathname, '/');
});

test('URL Validation — rejects HTTP, custom ports, userinfo, lookalike and path/query injections', () => {
  assert.equal(validateTargetUrl('http://qrntmoeoqqmnkgdsxmrv.supabase.co').valid, false);
  assert.equal(validateTargetUrl('https://qrntmoeoqqmnkgdsxmrv.supabase.co.evil.com').valid, false);
  assert.equal(validateTargetUrl('https://evil-qrntmoeoqqmnkgdsxmrv.supabase.co').valid, false);
  assert.equal(validateTargetUrl('https://qrntmoeoqqmnkgdsxmrv.supabase.co.fake.org').valid, false);
  assert.equal(validateTargetUrl('https://user:pass@qrntmoeoqqmnkgdsxmrv.supabase.co').valid, false);
  assert.equal(validateTargetUrl('https://qrntmoeoqqmnkgdsxmrv.supabase.co:8443').valid, false);
  assert.equal(validateTargetUrl('https://qrntmoeoqqmnkgdsxmrv.supabase.co:5432').valid, false);
  assert.equal(validateTargetUrl('https://qrntmoeoqqmnkgdsxmrv.supabase.co/rest/v1').valid, false);
  assert.equal(validateTargetUrl('https://qrntmoeoqqmnkgdsxmrv.supabase.co?token=leak').valid, false);
  assert.equal(validateTargetUrl('https://qrntmoeoqqmnkgdsxmrv.supabase.co#frag').valid, false);
  assert.equal(validateTargetUrl('').valid, false);
  assert.equal(validateTargetUrl(null).valid, false);
  assert.equal(validateTargetUrl('not-a-url').valid, false);
});

test('Auth Enumeration — handles multi-page pagination accurately', async () => {
  const page1 = Array.from({ length: 50 }, (_, i) => ({ id: `user_p1_${i}`, email: `p1_${i}@test.com` }));
  const page2 = Array.from({ length: 25 }, (_, i) => ({ id: `user_p2_${i}`, email: `p2_${i}@test.com` }));

  const mockAdminAuth = {
    listUsers: async ({ page, perPage }) => {
      if (page === 1) return { data: { users: page1, nextPage: 2 }, error: null };
      if (page === 2) return { data: { users: page2, nextPage: null }, error: null };
      return { data: { users: [], nextPage: null }, error: null };
    }
  };

  const { users } = await fetchAllAuthUsers(mockAdminAuth);
  assert.equal(users.length, 75);
  assert.equal(users[0].id, 'user_p1_0');
  assert.equal(users[74].id, 'user_p2_24');
});

test('Auth Cleanup — blocks execution if target URL is invalid before client creation', async () => {
  const res = await runAuthCleanup({
    SUPABASE_URL: 'http://insecure-http-url.supabase.co',
    SUPABASE_SERVICE_KEY: 'test-service-key-valid-length-1234567890',
  });
  assert.equal(res.success, false);
  assert.ok(res.error.includes('URL Security Validation Failed'));
});

test('Auth Cleanup — blocks live deletion if confirmation string is missing or mismatched', async () => {
  const res = await runAuthCleanup({
    SUPABASE_URL: 'https://qrntmoeoqqmnkgdsxmrv.supabase.co',
    SUPABASE_SERVICE_KEY: 'test-service-key-valid-length-1234567890',
    EXECUTE_WIPE: 'true',
    TARGET_PROJECT_REF: EXPECTED_PROJECT_REF,
    CONFIRM_WIPE_ALL_AUTH_USERS: 'WRONG_CONFIRMATION',
  });
  assert.equal(res.success, false);
  assert.ok(res.error.includes('Confirmation string mismatch'));
});

test('Local Cleanup — path.relative containment check blocks traversal and sibling prefixes', () => {
  const baseDir = path.resolve('C:/safe/workspace/uploads');
  const siblingDir = path.resolve('C:/safe/workspace/uploads_secret');
  const parentDir = path.resolve('C:/safe/workspace');
  const insideDir = path.resolve('C:/safe/workspace/uploads/user_123');

  assert.equal(isSafeDirectory(insideDir, baseDir), true);
  assert.equal(isSafeDirectory(siblingDir, baseDir), false);
  assert.equal(isSafeDirectory(parentDir, baseDir), false);
  assert.equal(isSafeDirectory(path.resolve('C:/Windows/System32'), baseDir), false);
});

test('Local Cleanup — processes regular files, preserves keep files, and dry run does not delete', () => {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'format-test-'));
  try {
    const keepFile = path.join(tmpBase, '.gitkeep');
    const deleteFile = path.join(tmpBase, 'temp_upload.docx');
    fs.writeFileSync(keepFile, 'keep');
    fs.writeFileSync(deleteFile, 'data');

    const dryRunStats = processDirectory(tmpBase, false);
    assert.equal(dryRunStats.found, 1);
    assert.equal(dryRunStats.deleted, 0);
    assert.equal(dryRunStats.skipped, 1);
    assert.equal(fs.existsSync(deleteFile), true);

    const liveStats = processDirectory(tmpBase, true);
    assert.equal(liveStats.found, 1);
    assert.equal(liveStats.deleted, 1);
    assert.equal(liveStats.skipped, 1);
    assert.equal(fs.existsSync(deleteFile), false);
    assert.equal(fs.existsSync(keepFile), true);
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

test('Verification — zero count evaluation strictly accepts 0 and rejects invalid/non-zero values', () => {
  assert.equal(evaluateZeroCount('profiles', 0).ok, true);
  assert.equal(evaluateZeroCount('profiles', 1).ok, false);
  assert.equal(evaluateZeroCount('profiles', 100).ok, false);
  assert.equal(evaluateZeroCount('profiles', -1).ok, false);
  assert.equal(evaluateZeroCount('profiles', NaN).ok, false);
  assert.equal(evaluateZeroCount('profiles', Infinity).ok, false);
  assert.equal(evaluateZeroCount('profiles', null).ok, false);
  assert.equal(evaluateZeroCount('profiles', undefined).ok, false);
  assert.equal(evaluateZeroCount('profiles', '0').ok, false);
  assert.equal(evaluateZeroCount('profiles', 0, { message: 'Network connection failed' }).ok, false);
});

test('Verification — schema column evaluation strictly catches missing columns and errors', () => {
  assert.equal(evaluateSchemaColumns('profiles', null).ok, true);
  assert.equal(evaluateSchemaColumns('profiles', { message: 'column profiles.name does not exist' }).ok, false);
});

test('Response Classification — isExpectedPermissionError correctly identifies auth rejections and rejects 5xx, network, and JWT errors', () => {
  assert.equal(isExpectedPermissionError({ code: '42501' }), true);
  assert.equal(isExpectedPermissionError({ code: 'P0001', message: 'Unauthorized: plan is immutable' }), true);
  assert.equal(isExpectedPermissionError({ status: 401, code: '42501' }), true);
  assert.equal(isExpectedPermissionError({ status: 403, code: '42501' }), true);
  assert.equal(isExpectedPermissionError({ status: 401, code: 'PGRST301' }), true);
  assert.equal(isExpectedPermissionError({ status: 403, message: 'permission denied for table profiles' }), true);
  assert.equal(isExpectedPermissionError({ status: 403, message: 'new row violates row-level security policy' }), true);

  assert.equal(isExpectedPermissionError({ status: 500, message: 'permission denied while contacting upstream' }), false);
  assert.equal(isExpectedPermissionError({ status: 502, message: 'Bad Gateway' }), false);
  assert.equal(isExpectedPermissionError({ status: 503, message: 'Service Unavailable' }), false);

  assert.equal(isExpectedPermissionError({ status: 401, message: 'JWT expired' }), false);
  assert.equal(isExpectedPermissionError({ status: 401, message: 'Invalid JWT' }), false);
  assert.equal(isExpectedPermissionError({ status: 401, message: 'token is invalid' }), false);
  assert.equal(isExpectedPermissionError({ status: 401, message: 'invalid token signature' }), false);

  assert.equal(isExpectedPermissionError(new Error('Network connection timeout')), false);
  assert.equal(isExpectedPermissionError({ message: 'ECONNREFUSED 127.0.0.1:5432' }), false);
  assert.equal(isExpectedPermissionError({ name: 'FetchError', message: 'request failed' }), false);

  assert.equal(isExpectedPermissionError(null), false);
  assert.equal(isExpectedPermissionError(undefined), false);
  assert.equal(isExpectedPermissionError({}), false);
  assert.equal(isExpectedPermissionError({ code: '42P01', message: 'relation does not exist' }), false);
});

test('Response Classification — assertEmptyRowDenial, assertMutationDenial, assertExplicitPermissionDenial strict outcome enforcement', () => {
  assert.doesNotThrow(() => assertEmptyRowDenial({ data: [], error: null }, 'cross select'));
  assert.doesNotThrow(() => assertMutationDenial({ data: [], error: null }, 'cross update'));

  const anonPermErr = { data: null, error: { status: 401, code: '42501', message: 'permission denied for table documents' } };
  assert.doesNotThrow(() => assertExplicitPermissionDenial(anonPermErr, 'anon select'));
  assert.doesNotThrow(() => assertMutationDenial(anonPermErr, 'anon update'));

  assert.throws(() => assertEmptyRowDenial({ data: [{ id: '1' }], error: null }, 'leak select'), /SECURITY VIOLATION/);
  assert.throws(() => assertMutationDenial({ data: [{ id: '1' }], error: null }, 'tamper update'), /SECURITY VIOLATION/);
  assert.throws(() => assertExplicitPermissionDenial({ data: [{ id: '1' }], error: null }, 'tamper insert'), /SECURITY VIOLATION/);

  assert.throws(() => assertEmptyRowDenial({ data: null, error: null }, 'test'), /malformed response/);
  assert.throws(() => assertMutationDenial({ data: null, error: null }, 'test'), /malformed response/);
  assert.throws(() => assertExplicitPermissionDenial({ data: null, error: null }, 'test'), /SECURITY VIOLATION/);

  assert.throws(() => assertEmptyRowDenial({}, 'test'), /malformed response/);
  assert.throws(() => assertMutationDenial({}, 'test'), /malformed response/);
  assert.throws(() => assertExplicitPermissionDenial({}, 'test'), /malformed response/);

  assert.throws(() => assertEmptyRowDenial({ data: [] }, 'test'), /malformed response/);
  assert.throws(() => assertMutationDenial({ data: [] }, 'test'), /malformed response/);
  assert.throws(() => assertEmptyRowDenial({ data: [], error: undefined }, 'test'), /unexpected error/);
  assert.throws(() => assertMutationDenial({ data: [], error: undefined }, 'test'), /unexpected non-permission error/);

  const err500 = { data: null, error: { status: 500, message: 'permission denied while contacting upstream' } };
  assert.throws(() => assertEmptyRowDenial(err500, 'test'), /failed with unexpected error/);
  assert.throws(() => assertMutationDenial(err500, 'test'), /unexpected non-permission error/);
  assert.throws(() => assertExplicitPermissionDenial(err500, 'test'), /unexpected non-permission error/);

  const expiredJwtRes = { data: null, error: { status: 401, message: 'JWT expired' } };
  assert.throws(() => assertMutationDenial(expiredJwtRes, 'test'), /unexpected non-permission error/);
  assert.throws(() => assertExplicitPermissionDenial(expiredJwtRes, 'test'), /unexpected non-permission error/);
});

test('Absence Verification — isAuthUserNotFoundResponse and assertTableAbsence strict outcome enforcement', () => {
  assert.equal(isAuthUserNotFoundResponse({ data: { user: null }, error: { status: 404, message: 'User not found' } }), true);
  assert.equal(isAuthUserNotFoundResponse({ error: { status: 404, code: 'user_not_found' } }), true);

  assert.equal(isAuthUserNotFoundResponse({ data: null, error: { status: 500, code: 'user_not_found' } }), false);
  assert.equal(isAuthUserNotFoundResponse({ data: null, error: { status: 502, code: 'user_not_found' } }), false);
  assert.equal(isAuthUserNotFoundResponse({ error: { status: 500, message: 'Internal Server Error' } }), false);
  assert.equal(isAuthUserNotFoundResponse({ error: { status: 500, message: 'User not found on remote gateway' } }), false);

  assert.equal(isAuthUserNotFoundResponse({ data: { user: { id: 'u1' } }, error: null }), false);
  assert.equal(isAuthUserNotFoundResponse({ user: { id: 'u1' } }), false);

  assert.equal(isAuthUserNotFoundResponse({}), false);
  assert.equal(isAuthUserNotFoundResponse(null), false);
  assert.equal(isAuthUserNotFoundResponse({ error: null }), false);

  assert.doesNotThrow(() => assertTableAbsence({ data: [], error: null }, 'profiles', 'u1'));
  assert.throws(() => assertTableAbsence({ data: [{ id: 'u1' }], error: null }, 'profiles', 'u1'), /STILL PRESENT/);
  assert.throws(() => assertTableAbsence({ data: null, error: null }, 'profiles', 'u1'), /malformed data/);
  assert.throws(() => assertTableAbsence({}, 'profiles', 'u1'), /malformed response/);
  assert.throws(() => assertTableAbsence({ data: [] }, 'profiles', 'u1'), /malformed response/);
  assert.throws(() => assertTableAbsence({ data: [], error: undefined }, 'profiles', 'u1'), /Absence check query failed/);
  assert.throws(() => assertTableAbsence({ data: null, error: { message: 'DB connection error' } }, 'profiles', 'u1'), /Absence check query failed/);
});

// ==============================================================================
// DEPENDENCY INJECTION & HARNESS LOGIC UNIT TESTS
// ==============================================================================

/**
 * Creates a configurable Mock Supabase Client hierarchy for testing the harness.
 */
function createMockClientHierarchy(overrides = {}) {
  const state = {
    users: [],
    profiles: {},
    documents: {},
    payments: {},
    capturedHeaders: [],
  };

  return function mockClientFactory(url, key, options = {}) {
    const isServiceRole = key.includes('service') || key.startsWith('test-service');
    let sessionUser = null;
    const clientHeaders = options?.global?.headers || {};
    state.capturedHeaders.push(clientHeaders);

    return {
      auth: {
        admin: {
          createUser: async ({ email, password, user_metadata }) => {
            if (overrides.createUserError) return { data: null, error: overrides.createUserError };
            const id = 'mock_user_' + Math.random().toString(36).slice(2, 8);
            const user = { id, email, created_at: new Date().toISOString() };
            state.users.push(user);

            // If auto-create profile via signup trigger is enabled in test simulation
            if (overrides.simulateSignupTrigger) {
              const fullName = user_metadata?.full_name || null;
              state.profiles[id] = {
                id,
                name: fullName,
                full_name: fullName,
                email,
                plan: 'free',
                payment_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
            }

            return { data: { user }, error: null };
          },
          deleteUser: async (id) => {
            if (overrides.thrownDeleteUserException) throw overrides.thrownDeleteUserException;
            if (overrides.deleteUserError) return { error: overrides.deleteUserError };
            state.users = state.users.filter(u => u.id !== id);
            return { error: null };
          },
          getUserById: async (id) => {
            if (overrides.getUserByIdError) return { data: null, error: overrides.getUserByIdError };
            if (overrides.userStillPresentInAbsenceCheck) {
              return { data: { user: { id } }, error: null };
            }
            if (overrides.malformedUserAbsenceResponse) {
              return { data: null, error: { status: 500, message: 'Gateway timeout' } };
            }
            const found = state.users.find(u => u.id === id);
            if (found) return { data: { user: found }, error: null };
            return { data: { user: null }, error: { status: 404, message: 'User not found' } };
          }
        },
        signInWithPassword: async ({ email, password }) => {
          if (overrides.signInError) return { error: overrides.signInError };
          const found = state.users.find(u => u.email === email);
          sessionUser = found || { id: 'mock_id' };
          return { data: { user: sessionUser }, error: null };
        }
      },
      from: (table) => {
        let currentFilters = {};
        let currentOperation = 'select';
        let updatePayload = null;

        const builder = {
          select: (cols) => {
            if (currentOperation !== 'update' && currentOperation !== 'delete') {
              currentOperation = 'select';
            }
            return builder;
          },
          insert: async (payload) => {
            if (overrides.insertError && overrides.insertError[table]) {
              return { data: null, error: overrides.insertError[table] };
            }
            // Anonymous insert denied explicitly on all tables per schema
            if (!isServiceRole && !sessionUser) {
              return { data: null, error: { status: 401, code: '42501', message: `permission denied for table ${table}` } };
            }
            // Browser mutations denied on documents / payments
            if (!isServiceRole && (table === 'documents' || table === 'payments')) {
              return { data: null, error: { status: 403, code: '42501', message: `permission denied for table ${table}` } };
            }
            const id = payload.id || 'rec_' + Math.random().toString(36).slice(2, 8);
            const defaults = table === 'profiles' ? { plan: 'free', payment_id: null, full_name: payload.name || null } : {};
            const rec = { id, ...defaults, ...payload };
            if (!state[table]) state[table] = {};
            state[table][id] = rec;
            return { data: [rec], error: null };
          },
          update: (payload) => {
            currentOperation = 'update';
            updatePayload = payload;
            return builder;
          },
          delete: () => {
            currentOperation = 'delete';
            return builder;
          },
          eq: (col, val) => {
            currentFilters[col] = val;
            return builder;
          },
          single: async () => {
            if (overrides.queryError) throw overrides.queryError;
            const entries = Object.values(state[table] || {});
            const found = entries.find(e => {
              for (const [k, v] of Object.entries(currentFilters)) {
                if (e[k] !== v) return false;
              }
              return true;
            });
            return { data: found || null, error: found ? null : { message: 'Row not found' } };
          },
          then: (resolve, reject) => {
            try {
              if (overrides.queryError) {
                return reject(overrides.queryError);
              }
              if (overrides.returnedQueryError) {
                return resolve({ data: null, error: overrides.returnedQueryError });
              }

              if (currentOperation === 'select') {
                if (!isServiceRole && !sessionUser) {
                  return resolve({ data: null, error: { status: 401, code: '42501', message: `permission denied for table ${table}` } });
                }

                const entries = Object.values(state[table] || {});
                const matching = entries.filter(e => {
                  if (!isServiceRole) {
                    if (!sessionUser) return false;
                    if (table === 'profiles' && e.id !== sessionUser.id) return false;
                    if ((table === 'documents' || table === 'payments') && e.user_id !== sessionUser.id) return false;
                  }
                  for (const [k, v] of Object.entries(currentFilters)) {
                    if (e[k] !== v) return false;
                  }
                  return true;
                });
                return resolve({ data: matching, error: null });
              }

              if (currentOperation === 'update') {
                if (!isServiceRole && (table === 'documents' || table === 'payments')) {
                  return resolve({ data: [], error: { status: 403, code: '42501', message: 'permission denied' } });
                }
                if (!isServiceRole && table === 'profiles' && (updatePayload.plan === 'pro' || updatePayload.payment_id)) {
                  return resolve({ data: null, error: { status: 403, code: '42501', message: 'Unauthorized: plan is immutable' } });
                }
                if (!isServiceRole && (updatePayload.id || updatePayload.user_id)) {
                  return resolve({ data: [], error: { status: 403, code: '42501', message: 'permission denied' } });
                }

                if (!isServiceRole && table === 'profiles' && currentFilters.id && currentFilters.id !== sessionUser?.id) {
                  if (overrides.http500PermissionError) {
                    return resolve({ data: null, error: { status: 500, message: 'permission denied while contacting upstream' } });
                  }
                  if (overrides.expiredJwtError) {
                    return resolve({ data: null, error: { status: 401, message: 'JWT expired' } });
                  }
                  if (overrides.malformedMutationResponse) {
                    return resolve({ data: null, error: null });
                  }
                  if (overrides.badSuccessCrossUserUpdate) {
                    return resolve({ data: [{ id: currentFilters.id, name: updatePayload.name }], error: null });
                  }
                  return resolve({ data: [], error: null });
                }

                const entries = Object.values(state[table] || {});
                const updated = [];
                for (const item of entries) {
                  let match = true;
                  for (const [k, v] of Object.entries(currentFilters)) {
                    if (item[k] !== v) match = false;
                  }
                  if (match) {
                    Object.assign(item, updatePayload);
                    if (updatePayload.name && !updatePayload.full_name) {
                      item.full_name = updatePayload.name;
                    }
                    updated.push(item);
                  }
                }
                return resolve({ data: updated, error: null });
              }

              if (currentOperation === 'delete') {
                if (overrides.thrownDeleteTableException && overrides.thrownDeleteTableException[table]) {
                  throw overrides.thrownDeleteTableException[table];
                }
                if (overrides.deleteTableError && overrides.deleteTableError[table]) {
                  return resolve({ data: null, error: overrides.deleteTableError[table] });
                }
                if (!isServiceRole && (table === 'documents' || table === 'payments')) {
                  return resolve({ data: [], error: { status: 403, code: '42501', message: 'permission denied' } });
                }
                const entries = Object.entries(state[table] || {});
                for (const [id, item] of entries) {
                  let match = true;
                  for (const [k, v] of Object.entries(currentFilters)) {
                    if (item[k] !== v) match = false;
                  }
                  if (match) delete state[table][id];
                }
                return resolve({ data: [], error: null });
              }
            } catch (err) {
              reject(err);
            }
          }
        };
        return builder;
      }
    };
  };
}

test('Synthetic Acceptance Harness (DI) — executes full bounded matrix and passes cleanly with mock client', async () => {
  const clientFactory = createMockClientHierarchy();
  const res = await runSyntheticAcceptanceTests(
    {
      SUPABASE_URL: 'https://qrntmoeoqqmnkgdsxmrv.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-service-key-valid-length-1234567890',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key-valid-length-1234567890',
      EXECUTE_SYNTHETIC_ACCEPTANCE: 'true',
      CONFIRM_SYNTHETIC_TEST: EXPECTED_SYNTHETIC_CONFIRMATION,
    },
    { clientFactory }
  );

  assert.equal(res.success, true);
  assert.equal(res.errors.length, 0);
});

test('Synthetic Acceptance Harness (DI) — verifies signup-trigger created profile flow', async () => {
  const clientFactory = createMockClientHierarchy({ simulateSignupTrigger: true });
  const res = await runSyntheticAcceptanceTests(
    {
      SUPABASE_URL: 'https://qrntmoeoqqmnkgdsxmrv.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-service-key-valid-length-1234567890',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key-valid-length-1234567890',
      EXECUTE_SYNTHETIC_ACCEPTANCE: 'true',
      CONFIRM_SYNTHETIC_TEST: EXPECTED_SYNTHETIC_CONFIRMATION,
    },
    { clientFactory }
  );

  assert.equal(res.success, true);
  assert.equal(res.errors.length, 0);
});

test('Synthetic Acceptance Harness (DI) — wires controlled test token header into client options', async () => {
  let capturedHeaders = [];
  const standardMock = createMockClientHierarchy();
  const clientFactory = (url, key, options) => {
    if (options?.global?.headers) {
      capturedHeaders.push(options.global.headers);
    }
    return standardMock(url, key, options);
  };

  const testToken = 'dynamic_temp_test_token_' + Date.now();
  const res = await runSyntheticAcceptanceTests(
    {
      SUPABASE_URL: 'https://qrntmoeoqqmnkgdsxmrv.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-service-key-valid-length-1234567890',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key-valid-length-1234567890',
      EXECUTE_SYNTHETIC_ACCEPTANCE: 'true',
      CONFIRM_SYNTHETIC_TEST: EXPECTED_SYNTHETIC_CONFIRMATION,
      CONTROLLED_TEST_TOKEN: testToken,
    },
    { clientFactory }
  );

  assert.equal(res.success, true);
  assert.ok(capturedHeaders.length >= 3); // User A, User B, Anon Client
  assert.ok(capturedHeaders.every(h => h['x-controlled-test-key'] === testToken));
});

test('Synthetic Acceptance Harness (DI) — fails when query throws network/connection exception and still cleans fixtures', async () => {
  const clientFactory = createMockClientHierarchy({
    queryError: new Error('Network connection timeout'),
  });

  const res = await runSyntheticAcceptanceTests(
    {
      SUPABASE_URL: 'https://qrntmoeoqqmnkgdsxmrv.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-service-key-valid-length-1234567890',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key-valid-length-1234567890',
      EXECUTE_SYNTHETIC_ACCEPTANCE: 'true',
      CONFIRM_SYNTHETIC_TEST: EXPECTED_SYNTHETIC_CONFIRMATION,
    },
    { clientFactory }
  );

  assert.equal(res.success, false);
  assert.ok(res.errors.some(e => e.includes('Network connection timeout')));
});

test('Synthetic Acceptance Harness (DI) — fails on HTTP 500 upstream error disguised with permission text', async () => {
  const clientFactory = createMockClientHierarchy({
    http500PermissionError: true,
  });

  const res = await runSyntheticAcceptanceTests(
    {
      SUPABASE_URL: 'https://qrntmoeoqqmnkgdsxmrv.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-service-key-valid-length-1234567890',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key-valid-length-1234567890',
      EXECUTE_SYNTHETIC_ACCEPTANCE: 'true',
      CONFIRM_SYNTHETIC_TEST: EXPECTED_SYNTHETIC_CONFIRMATION,
    },
    { clientFactory }
  );

  assert.equal(res.success, false);
  assert.ok(res.errors.some(e => e.includes('unexpected non-permission error')));
});

test('Synthetic Acceptance Harness (DI) — fails on expired/invalid authenticated JWT error during test', async () => {
  const clientFactory = createMockClientHierarchy({
    expiredJwtError: true,
  });

  const res = await runSyntheticAcceptanceTests(
    {
      SUPABASE_URL: 'https://qrntmoeoqqmnkgdsxmrv.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-service-key-valid-length-1234567890',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key-valid-length-1234567890',
      EXECUTE_SYNTHETIC_ACCEPTANCE: 'true',
      CONFIRM_SYNTHETIC_TEST: EXPECTED_SYNTHETIC_CONFIRMATION,
    },
    { clientFactory }
  );

  assert.equal(res.success, false);
  assert.ok(res.errors.some(e => e.includes('unexpected non-permission error')));
});

test('Synthetic Acceptance Harness (DI) — fails on malformed { data: null, error: null } mutation response', async () => {
  const clientFactory = createMockClientHierarchy({
    malformedMutationResponse: true,
  });

  const res = await runSyntheticAcceptanceTests(
    {
      SUPABASE_URL: 'https://qrntmoeoqqmnkgdsxmrv.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-service-key-valid-length-1234567890',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key-valid-length-1234567890',
      EXECUTE_SYNTHETIC_ACCEPTANCE: 'true',
      CONFIRM_SYNTHETIC_TEST: EXPECTED_SYNTHETIC_CONFIRMATION,
    },
    { clientFactory }
  );

  assert.equal(res.success, false);
  assert.ok(res.errors.some(e => e.includes('malformed response')));
});

test('Synthetic Acceptance Harness (DI) — fails on unexpected successful cross-user mutation', async () => {
  const clientFactory = createMockClientHierarchy({
    badSuccessCrossUserUpdate: true,
  });

  const res = await runSyntheticAcceptanceTests(
    {
      SUPABASE_URL: 'https://qrntmoeoqqmnkgdsxmrv.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-service-key-valid-length-1234567890',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key-valid-length-1234567890',
      EXECUTE_SYNTHETIC_ACCEPTANCE: 'true',
      CONFIRM_SYNTHETIC_TEST: EXPECTED_SYNTHETIC_CONFIRMATION,
    },
    { clientFactory }
  );

  assert.equal(res.success, false);
  assert.ok(res.errors.some(e => e.includes('SECURITY VIOLATION: User B cross-update profile succeeded')));
});

test('Synthetic Acceptance Harness (DI) — fails when returned cleanup error occurs and attempts remaining cleanups', async () => {
  const clientFactory = createMockClientHierarchy({
    deleteTableError: { documents: { message: 'Database delete constraint violation' } },
  });

  const res = await runSyntheticAcceptanceTests(
    {
      SUPABASE_URL: 'https://qrntmoeoqqmnkgdsxmrv.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-service-key-valid-length-1234567890',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key-valid-length-1234567890',
      EXECUTE_SYNTHETIC_ACCEPTANCE: 'true',
      CONFIRM_SYNTHETIC_TEST: EXPECTED_SYNTHETIC_CONFIRMATION,
    },
    { clientFactory }
  );

  assert.equal(res.success, false);
  assert.ok(res.errors.some(e => e.includes('Failed to delete documents')));
});

test('Synthetic Acceptance Harness (DI) — fails when thrown cleanup exception occurs and continues remaining cleanups', async () => {
  const clientFactory = createMockClientHierarchy({
    thrownDeleteTableException: { payments: new Error('Hard socket crash during delete') },
  });

  const res = await runSyntheticAcceptanceTests(
    {
      SUPABASE_URL: 'https://qrntmoeoqqmnkgdsxmrv.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-service-key-valid-length-1234567890',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key-valid-length-1234567890',
      EXECUTE_SYNTHETIC_ACCEPTANCE: 'true',
      CONFIRM_SYNTHETIC_TEST: EXPECTED_SYNTHETIC_CONFIRMATION,
    },
    { clientFactory }
  );

  assert.equal(res.success, false);
  assert.ok(res.errors.some(e => e.includes('Exception deleting payments')));
});

test('Synthetic Acceptance Harness (DI) — fails when user is still present during post-cleanup absence check', async () => {
  const clientFactory = createMockClientHierarchy({
    userStillPresentInAbsenceCheck: true,
  });

  const res = await runSyntheticAcceptanceTests(
    {
      SUPABASE_URL: 'https://qrntmoeoqqmnkgdsxmrv.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-service-key-valid-length-1234567890',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key-valid-length-1234567890',
      EXECUTE_SYNTHETIC_ACCEPTANCE: 'true',
      CONFIRM_SYNTHETIC_TEST: EXPECTED_SYNTHETIC_CONFIRMATION,
    },
    { clientFactory }
  );

  assert.equal(res.success, false);
  assert.ok(res.errors.some(e => e.includes('STILL PRESENT after cleanup')));
});

test('Synthetic Acceptance Harness (DI) — fails when user absence check returns 500 gateway error instead of 404', async () => {
  const clientFactory = createMockClientHierarchy({
    malformedUserAbsenceResponse: true,
  });

  const res = await runSyntheticAcceptanceTests(
    {
      SUPABASE_URL: 'https://qrntmoeoqqmnkgdsxmrv.supabase.co',
      SUPABASE_SERVICE_KEY: 'test-service-key-valid-length-1234567890',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key-valid-length-1234567890',
      EXECUTE_SYNTHETIC_ACCEPTANCE: 'true',
      CONFIRM_SYNTHETIC_TEST: EXPECTED_SYNTHETIC_CONFIRMATION,
    },
    { clientFactory }
  );

  assert.equal(res.success, false);
  assert.ok(res.errors.some(e => e.includes('failed to confirm user-not-found')));
});
