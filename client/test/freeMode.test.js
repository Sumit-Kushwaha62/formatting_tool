import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseFeatureFlag,
  resolveAppPage,
  resolveDashboardTab,
} from '../src/config/features.js';
import {
  shouldBlockDocumentFormatting,
  shouldCheckDocumentQuota,
} from '../src/lib/documentAccess.js';
import { loadRazorpayCheckout } from '../src/lib/razorpayCheckout.js';

test('only the exact string true enables a client feature flag', () => {
  assert.equal(parseFeatureFlag(undefined), false);
  assert.equal(parseFeatureFlag('false'), false);
  assert.equal(parseFeatureFlag('TRUE'), false);
  assert.equal(parseFeatureFlag(true), false);
  assert.equal(parseFeatureFlag('true'), true);
});

test('free mode redirects pricing and subscription navigation', () => {
  assert.equal(resolveAppPage('pricing', false), 'tool');
  assert.equal(resolveAppPage('contact', false), 'contact');
  assert.equal(resolveDashboardTab('subscription', false), 'overview');
  assert.equal(resolveAppPage('pricing', true), 'pricing');
  assert.equal(resolveDashboardTab('subscription', true), 'subscription');
});

test('free mode never commercially blocks historical free or paid users', () => {
  for (const userPlan of ['free', 'pro', 'team']) {
    const historicalAccount = { plan: userPlan };
    assert.equal(shouldBlockDocumentFormatting({
      user: { id: 'historical-user' },
      userPlan,
      docsCount: 42,
      paywallOpen: true,
      monetizationEnabled: false,
    }), false);
    assert.equal(shouldCheckDocumentQuota({
      userId: 'historical-user',
      userPlan,
      monetizationEnabled: false,
    }), false);
    assert.deepEqual(historicalAccount, { plan: userPlan });
  }
});

test('enabled mode retains the existing free-plan document gate', () => {
  assert.equal(shouldBlockDocumentFormatting({
    user: { id: 'free-user' },
    userPlan: 'free',
    docsCount: 3,
    monetizationEnabled: true,
  }), true);
  assert.equal(shouldBlockDocumentFormatting({
    user: { id: 'paid-user' },
    userPlan: 'pro',
    docsCount: 99,
    monetizationEnabled: true,
  }), false);
});

test('checkout loader makes no script request in free mode', async () => {
  let appendedScripts = 0;
  const documentRef = {
    querySelector: () => null,
    createElement: () => ({}),
    head: { appendChild: () => { appendedScripts += 1; } },
  };

  assert.equal(await loadRazorpayCheckout({
    monetizationEnabled: false,
    documentRef,
    windowRef: {},
  }), false);
  assert.equal(appendedScripts, 0);
});

test('enabled checkout loader remains reachable with a mocked document', async () => {
  let appendedScripts = 0;
  const documentRef = {
    querySelector: () => null,
    createElement: () => ({}),
    head: {
      appendChild: (script) => {
        appendedScripts += 1;
        script.onload();
      },
    },
  };

  assert.equal(await loadRazorpayCheckout({
    monetizationEnabled: true,
    documentRef,
    windowRef: {},
  }), true);
  assert.equal(appendedScripts, 1);
});
