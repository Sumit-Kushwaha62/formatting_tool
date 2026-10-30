import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const APP_URL = process.env.PHASE5A_APP_URL || 'http://127.0.0.1:5176/';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EVIDENCE_DIR = path.resolve('../phase5-test-run/evidence');
const qaFixture = {
  user: { id: 'phase5a-fixture-user', name: 'Security Test User', email: 'security@example.test' },
  userPlan: 'free',
  documents: [],
};

await mkdir(EVIDENCE_DIR, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
const results = [];

async function runViewport({ name, width, height, mobile }) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: mobile ? 'dark' : 'light' });
  await context.addInitScript((fixture) => {
    globalThis.__FORMAT_STUDIO_QA_FIXTURE__ = fixture;
  }, qaFixture);
  await context.route('**/rest/v1/profiles*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ name: qaFixture.user.name, phone: '', org: '' }),
  }));

  const destructiveRequests = [];
  const consoleErrors = [];
  const page = await context.newPage();
  page.on('request', (request) => {
    if (request.method() === 'DELETE' && /\/account(?:\/|$)/.test(request.url())) {
      destructiveRequests.push(request.url());
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('dialog', (dialog) => dialog.accept());

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.title(), 'Format Studio | Professional Document Formatting');
  await page.locator('.app-container').waitFor({ state: 'visible' });

  if (mobile) {
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    await page.locator('#mobile-navigation').getByRole('button', { name: 'My Account' }).click();
  } else {
    await page.getByRole('button', { name: 'My Account' }).click();
  }
  await page.getByText('Welcome back, Security Test User', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('heading', { name: 'Profile', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Delete Account', exact: true }).click();

  const expectedError = 'Your session has expired. Sign in again before deleting your account.';
  await page.getByRole('alert').filter({ hasText: expectedError }).waitFor({ state: 'visible' });
  assert.equal(destructiveRequests.length, 0, 'Expired local session must not send a destructive request');
  assert.equal(await page.getByRole('button', { name: 'Delete Account', exact: true }).isEnabled(), true);
  assert.equal(await page.getByText('Security Test User', { exact: true }).count() > 0, true, 'UI must not clear account state after failure');
  assert.equal(consoleErrors.length, 0, `Unexpected browser errors: ${consoleErrors.join(' | ')}`);

  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert.ok(dimensions.scrollWidth <= dimensions.clientWidth, `${name} has horizontal overflow`);

  const screenshot = path.join(EVIDENCE_DIR, `phase5a-account-delete-${name}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  results.push({
    viewport: name,
    url: page.url(),
    title: await page.title(),
    expiredSessionError: expectedError,
    destructiveRequests: destructiveRequests.length,
    accountStateRetained: true,
    buttonReenabled: true,
    overflow: false,
    consoleErrors,
    screenshot,
    result: 'PASS',
  });
  await context.close();
}

try {
  await runViewport({ name: 'desktop', width: 1440, height: 900, mobile: false });
  await runViewport({ name: 'mobile', width: 390, height: 844, mobile: true });
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
