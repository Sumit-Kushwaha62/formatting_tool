const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { parseFeatureFlag } = require('../config/features');
const {
  createPaymentHandlers,
  createRazorpayClient,
} = require('../payments');

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

const silentLogger = { log() {}, error() {} };

test('only the exact string true enables the server feature flag', () => {
  assert.equal(parseFeatureFlag(undefined), false);
  assert.equal(parseFeatureFlag('false'), false);
  assert.equal(parseFeatureFlag('TRUE'), false);
  assert.equal(parseFeatureFlag(true), false);
  assert.equal(parseFeatureFlag('true'), true);
});

test('disabled mode does not initialize Razorpay', () => {
  let constructorCalls = 0;
  class RazorpayMock {
    constructor() {
      constructorCalls += 1;
    }
  }

  const client = createRazorpayClient({
    monetizationEnabled: false,
    RazorpayClient: RazorpayMock,
  });

  assert.equal(client, null);
  assert.equal(constructorCalls, 0);
});

test('disabled payment endpoints reject before provider or database calls', async () => {
  let providerCalls = 0;
  let databaseCalls = 0;
  const handlers = createPaymentHandlers({
    monetizationEnabled: false,
    razorpay: { orders: { create: async () => { providerCalls += 1; } } },
    supabase: { from: () => { databaseCalls += 1; } },
    logger: silentLogger,
  });

  const orderResponse = createResponse();
  await handlers.createOrder({}, orderResponse);
  assert.equal(orderResponse.statusCode, 403);
  assert.equal(orderResponse.body.code, 'MONETIZATION_DISABLED');

  const verifyResponse = createResponse();
  await handlers.verifyPayment({ body: {} }, verifyResponse);
  assert.equal(verifyResponse.statusCode, 403);
  assert.equal(verifyResponse.body.code, 'MONETIZATION_DISABLED');
  assert.equal(providerCalls, 0);
  assert.equal(databaseCalls, 0);
});

test('enabled order and verification paths remain reachable with mocks', async () => {
  let providerCalls = 0;
  const writes = [];
  const paymentSecret = 'mock-only-secret';
  const orderId = 'order_mock';
  const paymentId = 'payment_mock';
  const signature = crypto
    .createHmac('sha256', paymentSecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const handlers = createPaymentHandlers({
    monetizationEnabled: true,
    razorpay: {
      orders: {
        create: async () => {
          providerCalls += 1;
          return { id: orderId, amount: 19900, currency: 'INR' };
        },
      },
    },
    supabase: {
      from(table) {
        return table === 'profiles'
          ? {
              update(values) {
                writes.push({ table, values });
                return { eq: async () => ({ error: null }) };
              },
            }
          : {
              insert: async (values) => {
                writes.push({ table, values });
                return { error: null };
              },
            };
      },
    },
    paymentSecret,
    logger: silentLogger,
  });

  const orderResponse = createResponse();
  await handlers.createOrder({}, orderResponse);
  assert.equal(orderResponse.statusCode, 200);
  assert.equal(orderResponse.body.id, orderId);
  assert.equal(providerCalls, 1);

  const verifyResponse = createResponse();
  await handlers.verifyPayment({
    body: {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      userId: 'mock-user',
    },
  }, verifyResponse);
  assert.equal(verifyResponse.statusCode, 200);
  assert.deepEqual(verifyResponse.body, { success: true });
  assert.equal(writes.length, 2);
});
