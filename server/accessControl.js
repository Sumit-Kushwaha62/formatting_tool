const AUTHENTICATION_REQUIRED = {
  error: 'Authentication required',
  code: 'UNAUTHORIZED',
};

const AUTHENTICATION_UNAVAILABLE = {
  error: 'Authentication service temporarily unavailable',
  code: 'AUTH_SERVICE_UNAVAILABLE',
};

function readBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== 'string') return null;
  const match = authorizationHeader.match(/^Bearer ([^\s]+)$/i);
  return match?.[1] || null;
}

function isCredentialRejection(error) {
  const status = Number(error?.status || error?.statusCode);
  return (status >= 400 && status < 500)
    || ['AuthApiError', 'AuthSessionMissingError', 'AuthInvalidTokenResponseError'].includes(error?.name);
}

function createAuthenticationMiddleware({ supabase, required = true, logger = console }) {
  return async function authenticateRequest(req, res, next) {
    const authorizationHeader = req.get('authorization');

    if (!authorizationHeader && !required) {
      req.authenticatedUser = null;
      return next();
    }

    const token = readBearerToken(authorizationHeader);
    if (!token) return res.status(401).json(AUTHENTICATION_REQUIRED);

    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (error) {
        if (!isCredentialRejection(error)) {
          logger.error('Authentication service verification failed');
          return res.status(503).json(AUTHENTICATION_UNAVAILABLE);
        }
        return res.status(401).json(AUTHENTICATION_REQUIRED);
      }

      if (!data?.user?.id) return res.status(401).json(AUTHENTICATION_REQUIRED);
      req.authenticatedUser = data.user;
      return next();
    } catch {
      logger.error('Authentication service verification failed');
      return res.status(503).json(AUTHENTICATION_UNAVAILABLE);
    }
  };
}

function resolveVerifiedUserId({ authenticatedUser, requestedUserId }) {
  if (!authenticatedUser?.id) {
    if (requestedUserId) {
      return { error: AUTHENTICATION_REQUIRED, status: 401 };
    }
    return { userId: null };
  }

  if (requestedUserId && requestedUserId !== authenticatedUser.id) {
    return {
      error: { error: 'Cannot access another account', code: 'ACCOUNT_FORBIDDEN' },
      status: 403,
    };
  }

  return { userId: authenticatedUser.id };
}

function createAccountDeletionHandler({ supabase, logger = console }) {
  return async function deleteAccount(req, res) {
    const userId = req.authenticatedUser.id;
    const completed = [];
    const cleanupSteps = [
      ['documents', 'user_id'],
      ['payments', 'user_id'],
      ['profiles', 'id'],
    ];

    try {
      for (const [table, column] of cleanupSteps) {
        const { error } = await supabase.from(table).delete().eq(column, userId);
        if (error) {
          logger.error(`Account cleanup failed at ${table}`);
          return res.status(500).json({
            error: 'Account deletion incomplete',
            code: 'ACCOUNT_DELETION_INCOMPLETE',
            completed,
          });
        }
        completed.push(table);
      }

      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) {
        logger.error('Account authentication-record deletion failed');
        return res.status(500).json({
          error: 'Account deletion incomplete',
          code: 'ACCOUNT_DELETION_INCOMPLETE',
          completed,
        });
      }

      completed.push('authentication');
      return res.json({ success: true, completed });
    } catch {
      logger.error('Account deletion failed unexpectedly');
      return res.status(500).json({
        error: 'Account deletion incomplete',
        code: 'ACCOUNT_DELETION_INCOMPLETE',
        completed,
      });
    }
  };
}

function registerAccountRoutes(app, { supabase, logger = console }) {
  const requireAuthentication = createAuthenticationMiddleware({ supabase, logger });
  const deleteAccount = createAccountDeletionHandler({ supabase, logger });

  app.delete('/account', requireAuthentication, deleteAccount);
  app.delete('/account/:userId', requireAuthentication, (req, res, next) => {
    const identity = resolveVerifiedUserId({
      authenticatedUser: req.authenticatedUser,
      requestedUserId: req.params.userId,
    });
    if (identity.error) return res.status(identity.status).json(identity.error);
    return next();
  }, deleteAccount);
}

module.exports = {
  AUTHENTICATION_REQUIRED,
  AUTHENTICATION_UNAVAILABLE,
  createAuthenticationMiddleware,
  createAccountDeletionHandler,
  readBearerToken,
  registerAccountRoutes,
  resolveVerifiedUserId,
};
