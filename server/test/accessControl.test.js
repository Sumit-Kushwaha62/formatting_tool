const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const {
  createAuthenticationMiddleware,
  registerAccountRoutes,
  resolveVerifiedUserId,
} = require('../accessControl');

const silentLogger = { error() {}, warn() {}, log() {} };

function createSupabaseMock({ validTokens = {}, verificationError = null, failTable = null, failAuthDelete = false } = {}) {
  const state = { verificationCalls: [], privilegedCalls: [] };
  const supabase = {
    auth: {
      async getUser(token) {
        state.verificationCalls.push(token);
        if (verificationError) return { data: { user: null }, error: verificationError };
        const userId = validTokens[token];
        return userId
          ? { data: { user: { id: userId } }, error: null }
          : { data: { user: null }, error: { name: 'AuthApiError', status: 401 } };
      },
      admin: {
        async deleteUser(userId) {
          state.privilegedCalls.push({ operation: 'auth.deleteUser', userId });
          return { error: failAuthDelete ? { message: 'mock failure' } : null };
        },
      },
    },
    from(table) {
      return {
        delete() {
          return {
            async eq(column, userId) {
              state.privilegedCalls.push({ operation: 'row.delete', table, column, userId });
              return { error: table === failTable ? { message: 'mock failure' } : null };
            },
          };
        },
      };
    },
  };
  return { supabase, state };
}

async function withServer(supabase, callback) {
  const app = express();
  app.use(express.json());
  registerAccountRoutes(app, { supabase, logger: silentLogger });

  const optionalAuthentication = createAuthenticationMiddleware({
    supabase,
    required: false,
    logger: silentLogger,
  });
  app.post('/format-identity', optionalAuthentication, (req, res) => {
    const identity = resolveVerifiedUserId({
      authenticatedUser: req.authenticatedUser,
      requestedUserId: req.body.userId,
    });
    if (identity.error) return res.status(identity.status).json(identity.error);
    return res.json({ processingAllowed: true, historyUserId: identity.userId });
  });

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const { port } = server.address();
  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { status: response.status, body: await response.json() };
}

test('missing bearer token rejects both account routes with zero privileged calls', async () => {
  const { supabase, state } = createSupabaseMock();
  await withServer(supabase, async (baseUrl) => {
    for (const path of ['/account', '/account/user-a']) {
      const response = await request(baseUrl, path, { method: 'DELETE' });
      assert.equal(response.status, 401);
      assert.equal(response.body.code, 'UNAUTHORIZED');
    }
  });
  assert.equal(state.verificationCalls.length, 0);
  assert.deepEqual(state.privilegedCalls, []);
});

test('malformed authorization header is rejected without auth or privileged calls', async () => {
  const { supabase, state } = createSupabaseMock();
  await withServer(supabase, async (baseUrl) => {
    const response = await request(baseUrl, '/account', {
      method: 'DELETE',
      headers: { Authorization: 'Basic not-a-bearer-token' },
    });
    assert.equal(response.status, 401);
  });
  assert.equal(state.verificationCalls.length, 0);
  assert.deepEqual(state.privilegedCalls, []);
});

test('invalid, expired and forged bearer tokens are rejected with zero privileged calls', async () => {
  for (const token of ['invalid-token', 'expired-token', 'eyJmb3JnZWQiOnRydWV9.fake.signature']) {
    const { supabase, state } = createSupabaseMock();
    await withServer(supabase, async (baseUrl) => {
      const response = await request(baseUrl, '/account', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(response.status, 401);
    });
    assert.deepEqual(state.verificationCalls, [token]);
    assert.deepEqual(state.privilegedCalls, []);
  }
});

test('verified user A cannot target user B through the compatibility route', async () => {
  const { supabase, state } = createSupabaseMock({ validTokens: { 'token-a': 'user-a' } });
  await withServer(supabase, async (baseUrl) => {
    const response = await request(baseUrl, '/account/user-b', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-a' },
    });
    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'ACCOUNT_FORBIDDEN');
  });
  assert.deepEqual(state.privilegedCalls, []);
});

test('verified user A deletes only user A using server-derived filters', async () => {
  const { supabase, state } = createSupabaseMock({ validTokens: { 'token-a': 'user-a' } });
  await withServer(supabase, async (baseUrl) => {
    const response = await request(baseUrl, '/account', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-a' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
  });
  assert.deepEqual(state.privilegedCalls, [
    { operation: 'row.delete', table: 'documents', column: 'user_id', userId: 'user-a' },
    { operation: 'row.delete', table: 'payments', column: 'user_id', userId: 'user-a' },
    { operation: 'row.delete', table: 'profiles', column: 'id', userId: 'user-a' },
    { operation: 'auth.deleteUser', userId: 'user-a' },
  ]);
});

test('authentication-service failure returns 503 with zero privileged calls', async () => {
  const { supabase, state } = createSupabaseMock({ verificationError: { name: 'NetworkError' } });
  await withServer(supabase, async (baseUrl) => {
    const response = await request(baseUrl, '/account', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer plausible-token' },
    });
    assert.equal(response.status, 503);
    assert.equal(response.body.code, 'AUTH_SERVICE_UNAVAILABLE');
  });
  assert.deepEqual(state.privilegedCalls, []);
});

test('privileged cleanup failure stops later destructive steps and reports partial state', async () => {
  const { supabase, state } = createSupabaseMock({
    validTokens: { 'token-a': 'user-a' },
    failTable: 'payments',
  });
  await withServer(supabase, async (baseUrl) => {
    const response = await request(baseUrl, '/account', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-a' },
    });
    assert.equal(response.status, 500);
    assert.equal(response.body.code, 'ACCOUNT_DELETION_INCOMPLETE');
    assert.deepEqual(response.body.completed, ['documents']);
  });
  assert.deepEqual(state.privilegedCalls, [
    { operation: 'row.delete', table: 'documents', column: 'user_id', userId: 'user-a' },
    { operation: 'row.delete', table: 'payments', column: 'user_id', userId: 'user-a' },
  ]);
});

test('authentication-record deletion failure reports completed row cleanup truthfully', async () => {
  const { supabase, state } = createSupabaseMock({
    validTokens: { 'token-a': 'user-a' },
    failAuthDelete: true,
  });
  await withServer(supabase, async (baseUrl) => {
    const response = await request(baseUrl, '/account', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-a' },
    });
    assert.equal(response.status, 500);
    assert.equal(response.body.code, 'ACCOUNT_DELETION_INCOMPLETE');
    assert.deepEqual(response.body.completed, ['documents', 'payments', 'profiles']);
  });
  assert.equal(state.privilegedCalls.at(-1).operation, 'auth.deleteUser');
  assert.ok(state.privilegedCalls.every((call) => call.userId === 'user-a'));
});

test('anonymous formatting identity remains allowed without history writes', async () => {
  const { supabase, state } = createSupabaseMock();
  await withServer(supabase, async (baseUrl) => {
    const anonymous = await request(baseUrl, '/format-identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(anonymous.status, 200);
    assert.deepEqual(anonymous.body, { processingAllowed: true, historyUserId: null });

    const forgedHistory = await request(baseUrl, '/format-identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'victim-user' }),
    });
    assert.equal(forgedHistory.status, 401);
  });
  assert.deepEqual(state.privilegedCalls, []);
});

test('account deletion recovery assessment: failure at documents stage leaves payments/profiles/auth intact and retry is safe', async () => {
  const { supabase, state } = createSupabaseMock({
    validTokens: { 'token-a': 'user-a' },
    failTable: 'documents',
  });
  await withServer(supabase, async (baseUrl) => {
    const response = await request(baseUrl, '/account', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-a' },
    });
    assert.equal(response.status, 500);
    assert.equal(response.body.code, 'ACCOUNT_DELETION_INCOMPLETE');
    assert.deepEqual(response.body.completed, []);
  });
  assert.deepEqual(state.privilegedCalls, [
    { operation: 'row.delete', table: 'documents', column: 'user_id', userId: 'user-a' },
  ]);
});

test('account deletion recovery assessment: failure at profiles stage leaves auth user intact allowing re-authenticated cleanup attempt', async () => {
  const { supabase, state } = createSupabaseMock({
    validTokens: { 'token-a': 'user-a' },
    failTable: 'profiles',
  });
  await withServer(supabase, async (baseUrl) => {
    const response = await request(baseUrl, '/account', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-a' },
    });
    assert.equal(response.status, 500);
    assert.equal(response.body.code, 'ACCOUNT_DELETION_INCOMPLETE');
    assert.deepEqual(response.body.completed, ['documents', 'payments']);
  });
  assert.deepEqual(state.privilegedCalls, [
    { operation: 'row.delete', table: 'documents', column: 'user_id', userId: 'user-a' },
    { operation: 'row.delete', table: 'payments', column: 'user_id', userId: 'user-a' },
    { operation: 'row.delete', table: 'profiles', column: 'id', userId: 'user-a' },
  ]);
});

test('account deletion recovery: valid auth user with missing profile can authenticate and execute deletion', async () => {
  // Simulates a user whose profile was previously deleted or never initialized
  const { supabase, state } = createSupabaseMock({
    validTokens: { 'token-a': 'user-a' },
  });
  await withServer(supabase, async (baseUrl) => {
    const response = await request(baseUrl, '/account', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-a' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.deepEqual(response.body.completed, ['documents', 'payments', 'profiles', 'authentication']);
  });
  assert.deepEqual(state.privilegedCalls, [
    { operation: 'row.delete', table: 'documents', column: 'user_id', userId: 'user-a' },
    { operation: 'row.delete', table: 'payments', column: 'user_id', userId: 'user-a' },
    { operation: 'row.delete', table: 'profiles', column: 'id', userId: 'user-a' },
    { operation: 'auth.deleteUser', userId: 'user-a' },
  ]);
});

test('account deletion recovery: auth.deleteUser failure leaves token valid for retrying self-service deletion', async () => {
  // Simulates a failure at the final step (auth.admin.deleteUser)
  const { supabase, state } = createSupabaseMock({
    validTokens: { 'token-a': 'user-a' },
    failAuthDelete: true,
  });
  await withServer(supabase, async (baseUrl) => {
    // First attempt fails at auth stage
    const res1 = await request(baseUrl, '/account', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-a' },
    });
    assert.equal(res1.status, 500);
    assert.equal(res1.body.code, 'ACCOUNT_DELETION_INCOMPLETE');
    assert.deepEqual(res1.body.completed, ['documents', 'payments', 'profiles']);
  });

  // Re-attempt after transient auth failure clears
  const { supabase: retrySupabase, state: retryState } = createSupabaseMock({
    validTokens: { 'token-a': 'user-a' },
    failAuthDelete: false,
  });
  await withServer(retrySupabase, async (baseUrl) => {
    const res2 = await request(baseUrl, '/account', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-a' },
    });
    assert.equal(res2.status, 200);
    assert.equal(res2.body.success, true);
  });
  assert.deepEqual(retryState.privilegedCalls, [
    { operation: 'row.delete', table: 'documents', column: 'user_id', userId: 'user-a' },
    { operation: 'row.delete', table: 'payments', column: 'user_id', userId: 'user-a' },
    { operation: 'row.delete', table: 'profiles', column: 'id', userId: 'user-a' },
    { operation: 'auth.deleteUser', userId: 'user-a' },
  ]);
});
