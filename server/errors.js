const { v4: uuidv4 } = require('uuid');

const ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  PROCESSING_TIMEOUT: 'PROCESSING_TIMEOUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

const sanitizeLogMessage = (message = '') => {
  if (typeof message !== 'string') message = String(message || '');
  return message
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/(?:api[_-]?key|password|secret|token)\s*[:=]\s*['"]?[^\s,;'"&]+['"]?/gi, '[SECRET_REDACTED]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '[EMAIL_REDACTED]')
    .replace(/([A-Z]:\\[^\s:\n\r]+|\/(?:Users|home|tmp|var|etc)\/[^\s:\n\r]+)/g, '[PATH_REDACTED]')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\x00-\x1F\x7F]/g, '');
};

function extractExitCode(error) {
  if (typeof error === 'number' && Number.isInteger(error)) return error;
  if (error && typeof error.exitCode === 'number' && Number.isInteger(error.exitCode)) return error.exitCode;
  if (error && typeof error.code === 'number' && Number.isInteger(error.code)) return error.code;
  if (typeof error === 'string') {
    const match = error.match(/exit(?:ed with)? code (\d+)/i);
    if (match) return parseInt(match[1], 10);
  }
  if (error instanceof Error && error.message) {
    const match = error.message.match(/exit(?:ed with)? code (\d+)/i);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

function extractSignal(error) {
  if (error && typeof error.signal === 'string' && /^(SIG[A-Z0-9]+)$/.test(error.signal)) {
    return error.signal;
  }
  return null;
}

function sendSafeError(res, {
  status = 500,
  code = ERROR_CODES.INTERNAL_ERROR,
  message = 'An unexpected error occurred. Please try again.',
  error = null,
  context = '',
  logger = console,
} = {}) {
  const requestId = uuidv4();

  if (logger && typeof logger.error === 'function') {
    const safeContext = String(context || 'Request error')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/[\x00-\x1F\x7F]/g, '')
      .slice(0, 100);

    let structuredDetail = 'status=' + status + ', code=' + code;
    const exitCode = extractExitCode(error);
    if (exitCode !== null) {
      structuredDetail += ', exitCode=' + exitCode;
    }
    const signal = extractSignal(error);
    if (signal) {
      structuredDetail += ', signal=' + signal;
    }

    logger.error('[' + requestId + '] ' + safeContext + ': ' + structuredDetail);
  }

  return res.status(status).json({
    error: message,
    code,
    requestId,
  });
}

module.exports = {
  ERROR_CODES,
  sanitizeLogMessage,
  sendSafeError,
};
