const test = require('node:test');
const assert = require('node:assert/strict');

const { findInvalidUpload, hasMinimumFiles, normalizeFiles } = require('../fileValidation');

test('processing routes can reject extensions outside their explicit allowlist', () => {
  assert.equal(findInvalidUpload([{ originalname: 'paper.PDF' }], ['.pdf']), null);
  assert.equal(findInvalidUpload([{ originalname: 'paper.txt' }], ['.pdf']).originalname, 'paper.txt');
  assert.equal(findInvalidUpload({ originalname: 'draft.docx' }, ['.docx']), null);
});

test('legacy xls is not accepted when the installed processor only supports xlsx', () => {
  assert.equal(findInvalidUpload([{ originalname: 'sheet.xlsx' }], ['.xlsx']), null);
  assert.equal(findInvalidUpload([{ originalname: 'sheet.xls' }], ['.xlsx']).originalname, 'sheet.xls');
});

test('merge minimum counts and single-file normalization are deterministic', () => {
  const one = { originalname: 'one.pdf' };
  assert.deepEqual(normalizeFiles(one), [one]);
  assert.equal(hasMinimumFiles([one], 2), false);
  assert.equal(hasMinimumFiles([one, { originalname: 'two.pdf' }], 2), true);
});

const { ERROR_CODES, sanitizeLogMessage, sendSafeError } = require('../errors');

test('sanitizeLogMessage redacts auth headers, credentials, paths, emails, and control chars', () => {
  const raw = 'Error at C:\\Users\\HP\\Desktop\\Format_Tool\\secret.txt with user test@example.com\nand Bearer secret-token-123\r\nand api_key="secret-api-key-999" and password=topsecret123\x07 /var/log/app.log';
  const sanitized = sanitizeLogMessage(raw);
  assert.ok(!sanitized.includes('C:\\Users\\HP'));
  assert.ok(!sanitized.includes('/var/log/app.log'));
  assert.ok(!sanitized.includes('test@example.com'));
  assert.ok(!sanitized.includes('secret-token-123'));
  assert.ok(!sanitized.includes('secret-api-key-999'));
  assert.ok(!sanitized.includes('topsecret123'));
  assert.ok(!sanitized.includes('\n'));
  assert.ok(!sanitized.includes('\r'));
  assert.ok(!sanitized.includes('\x07'));
  assert.ok(sanitized.includes('[PATH_REDACTED]'));
  assert.ok(sanitized.includes('[EMAIL_REDACTED]'));
  assert.ok(sanitized.includes('Bearer [REDACTED]'));
  assert.ok(sanitized.includes('[SECRET_REDACTED]'));
});

test('sendSafeError logs allowlisted structured metadata without leaking raw error or stack', () => {
  const logged = [];
  const mockLogger = {
    error(msg) { logged.push(msg); }
  };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };

  const sensitiveError = new Error('Traceback (most recent call last): File "C:\\app\\converter.py", line 42: Process exited with code 1');
  sendSafeError(res, {
    status: 500,
    code: ERROR_CODES.PROCESSING_FAILED,
    message: 'PDF to Word conversion failed',
    error: sensitiveError,
    context: 'POST /api/pdf-to-word',
    logger: mockLogger,
  });

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, 'PDF to Word conversion failed');
  assert.equal(res.body.code, 'PROCESSING_FAILED');
  assert.ok(typeof res.body.requestId === 'string' && res.body.requestId.length > 0);
  assert.equal(res.body.stack, undefined);
  assert.equal(res.body.detail, undefined);

  const jsonStr = JSON.stringify(res.body);
  assert.ok(!jsonStr.includes('Traceback'));
  assert.ok(!jsonStr.includes('converter.py'));
  assert.ok(!jsonStr.includes('C:'));

  assert.equal(logged.length, 1);
  assert.ok(logged[0].includes(res.body.requestId));
  assert.ok(logged[0].includes('POST /api/pdf-to-word'));
  assert.ok(logged[0].includes('status=500'));
  assert.ok(logged[0].includes('code=PROCESSING_FAILED'));
  assert.ok(logged[0].includes('exitCode=1'));
  assert.ok(!logged[0].includes('Traceback'));
  assert.ok(!logged[0].includes('converter.py'));
  assert.ok(!logged[0].includes('C:'));
});

test('sendSafeError and logger prevent ordinary document content sentinel leakage', () => {
  const logged = [];
  const mockLogger = {
    error(msg) { logged.push(msg); }
  };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };

  const sentinel = 'DOCUMENT_CONTENT_SENTINEL_5C: This paragraph belongs to a private uploaded document.';
  const injectedError = new Error(`PyMuPDF failure on text: "${sentinel}" - exit code 2`);
  injectedError.stderr = `Processor stderr: "${sentinel}"`;
  injectedError.nested = { detail: sentinel };

  sendSafeError(res, {
    status: 500,
    code: ERROR_CODES.PROCESSING_FAILED,
    message: 'Formatting failed. Please ensure the document is a valid DOCX file.',
    error: injectedError,
    context: 'POST /format process',
    logger: mockLogger,
  });

  // Verify sentinel is completely absent from public response
  const jsonResponse = JSON.stringify(res.body);
  assert.ok(!jsonResponse.includes('DOCUMENT_CONTENT_SENTINEL_5C'));
  assert.ok(!jsonResponse.includes('This paragraph belongs to a private uploaded document'));

  // Verify sentinel is completely absent from private logs
  assert.equal(logged.length, 1);
  assert.ok(!logged[0].includes('DOCUMENT_CONTENT_SENTINEL_5C'));
  assert.ok(!logged[0].includes('This paragraph belongs to a private uploaded document'));
  assert.ok(logged[0].includes('status=500'));
  assert.ok(logged[0].includes('code=PROCESSING_FAILED'));
  assert.ok(logged[0].includes('exitCode=2'));
});

test('sendSafeError formats 400 validation errors cleanly', () => {
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };

  sendSafeError(res, {
    status: 400,
    code: ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
    message: 'Unsupported file type: test.exe. Only DOCX files are allowed.',
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'UNSUPPORTED_MEDIA_TYPE');
  assert.equal(res.body.error, 'Unsupported file type: test.exe. Only DOCX files are allowed.');
  assert.ok(res.body.requestId);
});

test('all ERROR_CODES are stable string identifiers', () => {
  assert.equal(ERROR_CODES.BAD_REQUEST, 'BAD_REQUEST');
  assert.equal(ERROR_CODES.UNSUPPORTED_MEDIA_TYPE, 'UNSUPPORTED_MEDIA_TYPE');
  assert.equal(ERROR_CODES.PAYLOAD_TOO_LARGE, 'PAYLOAD_TOO_LARGE');
  assert.equal(ERROR_CODES.PROCESSING_FAILED, 'PROCESSING_FAILED');
  assert.equal(ERROR_CODES.PROCESSING_TIMEOUT, 'PROCESSING_TIMEOUT');
  assert.equal(ERROR_CODES.INTERNAL_ERROR, 'INTERNAL_ERROR');
});

const http = require('node:http');
const app = require('../index');

test('POST /api/pdf-to-word with corrupt PDF returns 500 without leaking traceback', async () => {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();

  try {
    const boundary = '----TestBoundary' + Date.now();
    const parts = [
      Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="files"; filename="corrupt.pdf"\r\nContent-Type: application/pdf\r\n\r\n'),
      Buffer.from('NOT_A_VALID_PDF_STREAM_CORRUPT_DATA'),
      Buffer.from('\r\n--' + boundary + '--\r\n'),
    ];
    const payload = Buffer.concat(parts);

    const response = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/api/pdf-to-word',
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data; boundary=' + boundary,
          'Content-Length': payload.length,
        },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    assert.equal(response.status, 500);
    const parsed = JSON.parse(response.body);
    assert.equal(parsed.code, 'PROCESSING_FAILED');
    assert.equal(parsed.error, 'PDF to Word conversion failed. Please ensure the PDF is not password protected or corrupted.');
    assert.ok(typeof parsed.requestId === 'string' && parsed.requestId.length > 0);

    // Verify absolutely no traceback or paths in public error body
    assert.ok(!response.body.includes('Traceback'));
    assert.ok(!response.body.includes('converter.py'));
  } finally {
    server.close();
  }
});

test('GET /download/:filename returns safe 404 when file does not exist', async () => {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();

  try {
    const response = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/download/nonexistent_file_123.docx',
        method: 'GET',
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', reject);
      req.end();
    });

    assert.equal(response.status, 404);
    const parsed = JSON.parse(response.body);
    assert.equal(parsed.code, 'BAD_REQUEST');
    assert.equal(parsed.error, 'File not found or expired');
    assert.ok(typeof parsed.requestId === 'string' && parsed.requestId.length > 0);
    assert.ok(!response.body.includes('outputs'));
    assert.ok(!response.body.includes('C:'));
  } finally {
    server.close();
  }
});



