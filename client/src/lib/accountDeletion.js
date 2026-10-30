export class AccountDeletionError extends Error {
  constructor(message, { code = 'ACCOUNT_DELETE_FAILED', status = 0 } = {}) {
    super(message);
    this.name = 'AccountDeletionError';
    this.code = code;
    this.status = status;
  }
}

export async function requestCurrentAccountDeletion({ supabase, apiUrl, fetchImpl = fetch }) {
  const { data, error: sessionError } = await supabase.auth.getSession();
  const accessToken = data?.session?.access_token;

  if (sessionError || !accessToken) {
    throw new AccountDeletionError('Your session has expired. Sign in again before deleting your account.', {
      code: 'SESSION_REQUIRED',
      status: 401,
    });
  }

  const response = await fetchImpl(`${apiUrl}/account`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  let body = {};
  try {
    body = await response.json();
  } catch {
    // The status still determines the safe user-facing fallback.
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new AccountDeletionError('Your session has expired. Sign in again before deleting your account.', {
        code: body.code || 'UNAUTHORIZED',
        status: response.status,
      });
    }
    if (response.status === 403) {
      throw new AccountDeletionError('This account deletion request was not authorized.', {
        code: body.code || 'ACCOUNT_FORBIDDEN',
        status: response.status,
      });
    }
    if (body.code === 'ACCOUNT_DELETION_INCOMPLETE') {
      throw new AccountDeletionError('Account deletion was not completed. Some account data may already have been removed; contact support before retrying.', {
        code: body.code,
        status: response.status,
      });
    }
    throw new AccountDeletionError('Could not delete the account. Please try again later.', {
      code: body.code || 'ACCOUNT_DELETE_FAILED',
      status: response.status,
    });
  }

  return body;
}
