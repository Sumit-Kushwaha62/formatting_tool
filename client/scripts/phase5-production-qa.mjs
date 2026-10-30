import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const APP_URL = process.env.PHASE5_PRODUCTION_URL || 'http://127.0.0.1:4180/?fixture=1';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const evidencePath = path.resolve('../phase5-test-run/evidence/production-isolation.json');

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
const context = await browser.newContext();
await context.addInitScript(() => {
  globalThis.__FORMAT_STUDIO_QA_FIXTURE__ = {
    user: { id: 'should-not-activate', name: 'Fixture Leak', email: 'leak@example.test' },
    userPlan: 'team',
    documents: [{ id: 'fixture-doc' }],
  };
  localStorage.setItem('__FORMAT_STUDIO_QA_FIXTURE__', 'true');
  localStorage.setItem('fixture', 'true');
});
const page = await context.newPage();
const paymentRequests = [];
page.on('request', (request) => {
  if (/checkout\.razorpay\.com|create-order|verify-payment/i.test(request.url())) paymentRequests.push(request.url());
});

try {
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.locator('.home-page').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Log in' }).count(), 1);
  assert.equal(await page.getByRole('button', { name: 'My Account' }).count(), 0);
  assert.equal(await page.getByText('Fixture Leak', { exact: true }).count(), 0);
  assert.deepEqual(paymentRequests, []);
  await writeFile(evidencePath, JSON.stringify({
    fixtureGlobalInjected: true,
    fixtureUrlParameterInjected: true,
    fixtureLocalStorageInjected: true,
    productionAuthState: 'signed out',
    fixtureActivated: false,
    paymentRequests,
  }, null, 2), 'utf8');
} finally {
  await browser.close();
}

console.log('production fixture isolation and Razorpay-request absence: pass');
