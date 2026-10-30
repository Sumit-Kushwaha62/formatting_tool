import test from 'node:test';
import assert from 'node:assert/strict';

import { requestCurrentAccountDeletion } from '../src/lib/accountDeletion.js';

function sessionClient(session, error = null) {
  return { auth: { getSession: async () => ({ data: { session }, error }) } };
}

test('account deletion uses the current session bearer token and self-service endpoint', async () => {
  const requests = [];
  const result = await requestCurrentAccountDeletion({
    supabase: sessionClient({ access_token: 'verified-session-token' }),
    apiUrl: 'http://api.example.test',
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    },
  });

  assert.deepEqual(result, { success: true });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'http://api.example.test/account');
  assert.deepEqual(requests[0].options, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer verified-session-token' },
  });
});

test('missing or expired local session prevents the destructive request', async () => {
  let requests = 0;

  await assert.rejects(
    requestCurrentAccountDeletion({
      supabase: sessionClient(null),
      apiUrl: 'http://api.example.test',
      fetchImpl: async () => { requests += 1; },
    }),
    (error) => error.status === 401 && /session has expired/i.test(error.message),
  );

  assert.equal(requests, 0);
});

test('partial server failure is reported without a success result or retry', async () => {
  let requests = 0;

  await assert.rejects(
    requestCurrentAccountDeletion({
      supabase: sessionClient({ access_token: 'valid-token' }),
      apiUrl: 'http://api.example.test',
      fetchImpl: async () => {
        requests += 1;
        return {
          ok: false,
          status: 500,
          json: async () => ({ code: 'ACCOUNT_DELETION_INCOMPLETE', completed: ['documents'] }),
        };
      },
    }),
    (error) => error.code === 'ACCOUNT_DELETION_INCOMPLETE' && /contact support before retrying/i.test(error.message),
  );

  assert.equal(requests, 1);
});
