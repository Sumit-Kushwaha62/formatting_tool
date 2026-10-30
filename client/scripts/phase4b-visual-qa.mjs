import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const APP_URL = 'http://127.0.0.1:5173/';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve('../docs/screenshots');
const THEME_KEY = 'format-studio-theme';

const fixtureDocuments = [
  { id: 'fixture-1', doc_type: 'thesis', file_name: 'Thesis_Draft.docx', status: 'done', created_at: '2026-09-09T10:30:00Z' },
  { id: 'fixture-2', doc_type: 'research', file_name: 'Research_Paper.docx', status: 'done', created_at: '2026-09-05T08:15:00Z' },
  { id: 'fixture-3', doc_type: 'letter', file_name: 'Department_Notice.docx', status: 'failed', created_at: '2026-08-28T14:45:00Z' },
  { id: 'fixture-4', doc_type: 'book', file_name: 'Book_Chapter.docx', status: 'done', created_at: '2026-08-21T09:00:00Z' },
];

const qaFixture = {
  user: { id: 'phase4b-fixture-user', name: 'Priya Sharma', email: 'priya@example.test' },
  userPlan: 'free',
  documents: fixtureDocuments,
};

await mkdir(SCREENSHOT_DIR, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
const results = [];

function sampleFile(name, mimeType, size = 24 * 1024) {
  return { name, mimeType, buffer: Buffer.alloc(size, 65) };
}

async function createApp({ width, height, colorScheme = 'light', storedTheme, fixture = false }) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme });
  if (storedTheme) {
    await context.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: THEME_KEY, value: storedTheme });
  }
  if (fixture) {
    await context.addInitScript((value) => { globalThis.__FORMAT_STUDIO_QA_FIXTURE__ = value; }, qaFixture);
    await context.route('**/rest/v1/documents*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-3/4' },
      body: JSON.stringify(fixtureDocuments),
    }));
    await context.route('**/rest/v1/profiles*', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ name: 'Priya Sharma', phone: '', org: '' }),
    }));
  }

  let formatShouldFail = true;
  await context.route('**/format', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (formatShouldFail) {
      formatShouldFail = false;
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Fixture formatting failure' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/octet-stream', body: 'mocked document bytes' });
  });
  await context.route('**/api/merge-pdf', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ downloadUrl: '/fixture/merged.pdf' }),
    });
  });

  const page = await context.newPage();
  const consoleErrors = [];
  const paymentRequests = [];
  const contactRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('request', (request) => {
    if (/checkout\.razorpay\.com|create-order|verify-payment/i.test(request.url())) paymentRequests.push(request.url());
    if (/\/contact(?:$|\?)/.test(request.url())) contactRequests.push(request.url());
  });
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.app-container').waitFor({ state: 'visible' });
  return { context, page, consoleErrors, paymentRequests, contactRequests };
}

async function assertNoOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert.ok(dimensions.scrollWidth <= dimensions.clientWidth, `${label} has horizontal overflow (${dimensions.scrollWidth} > ${dimensions.clientWidth})`);
}

async function navigateHome(page) {
  await page.locator('.nav-logo').click();
  await page.locator('.home-page').waitFor({ state: 'visible' });
}

async function navigateTool(page, name, mobile = false) {
  if (mobile) {
    const openMenu = page.getByRole('button', { name: 'Open navigation menu' });
    if (await openMenu.count()) await openMenu.click();
    const mobileNav = page.locator('#mobile-navigation');
    const tools = mobileNav.getByRole('button', { name: 'Tools', exact: true });
    await tools.click();
    await page.locator('#mobile-tools-list').getByRole('button', { name, exact: true }).click();
  } else {
    const nav = page.getByRole('navigation', { name: 'Primary navigation' });
    await nav.getByRole('button', { name: 'Tools', exact: true }).click();
    await page.locator('#desktop-tools-menu').getByRole('button', { name, exact: true }).click();
  }
  await page.locator('.tool-page').waitFor({ state: 'visible' });
}

async function openMobileMenu(page) {
  const openMenu = page.getByRole('button', { name: 'Open navigation menu' });
  if (await openMenu.count()) await openMenu.click();
  return page.locator('#mobile-navigation');
}

async function navigateContact(page, mobile = false) {
  if (mobile) {
    const mobileNav = await openMobileMenu(page);
    await mobileNav.getByRole('button', { name: 'Contact', exact: true }).click();
  } else {
    await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Contact', exact: true }).click();
  }
  await page.getByRole('heading', { name: 'Contact Format Studio', exact: true }).waitFor();
}

async function openModalFromNavigation(page, name, mobile = false) {
  if (mobile) {
    const mobileNav = await openMobileMenu(page);
    await mobileNav.getByRole('button', { name, exact: true }).click();
  } else if (name === 'Licence') {
    await page.locator('.footer').getByRole('button', { name: 'Licence', exact: true }).click();
  } else {
    await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name, exact: true }).click();
  }
}

async function navigateDashboard(page, mobile = false) {
  if (mobile) {
    const mobileNav = await openMobileMenu(page);
    await mobileNav.getByRole('button', { name: 'My Account', exact: true }).click();
  } else {
    await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'My Account', exact: true }).click();
  }
  await page.locator('.dash-shell').waitFor({ state: 'visible' });
}

async function assertClean(app, label) {
  assert.deepEqual(app.paymentRequests, [], `${label} made a payment request`);
  assert.deepEqual(app.consoleErrors, [], `${label} logged console/page errors: ${app.consoleErrors.join(' | ')}`);
  await assertNoOverflow(app.page, label);
}

try {
  const formatter = await createApp({ width: 1440, height: 1000, colorScheme: 'light' });
  await navigateTool(formatter.page, 'Book');
  await formatter.page.locator('.type-card').filter({ hasText: 'Thesis' }).click();
  await formatter.page.getByLabel('Language').selectOption('english');
  await formatter.page.getByLabel('Font family').selectOption('Times New Roman');
  await formatter.page.getByLabel('Font size').selectOption('14');
  await formatter.page.getByLabel('Line spacing').selectOption('1.5');
  await formatter.page.getByRole('button', { name: 'A4 210×297mm' }).click();
  await formatter.page.locator('.toggle').click();
  await formatter.page.getByRole('button', { name: 'Center' }).click();
  await formatter.page.getByLabel('Starting page number').fill('3');
  await formatter.page.getByLabel('Thesis Title').fill('Fixture thesis title');
  await formatter.page.getByLabel('Header text').fill('Fixture header');
  await formatter.page.evaluate(() => window.scrollTo(0, 0));
  await formatter.page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase4b-formatter-desktop-light.png'), fullPage: true });

  const retainedBeforeTheme = await formatter.page.getByLabel('Thesis Title').inputValue();
  await formatter.page.getByRole('button', { name: 'Switch to dark theme' }).click();
  assert.equal(await formatter.page.locator('html').getAttribute('data-theme'), 'dark');
  assert.equal(await formatter.page.getByLabel('Thesis Title').inputValue(), retainedBeforeTheme);
  assert.equal(await formatter.page.getByLabel('Add automatic page numbers').isChecked(), true);
  await formatter.page.evaluate(() => window.scrollTo(0, 0));
  await formatter.page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase4b-formatter-desktop-dark.png'), fullPage: true });

  await formatter.page.getByRole('button', { name: 'Continue to upload' }).click();
  await formatter.page.getByLabel('Choose a Word document to format').setInputFiles(sampleFile('fixture-thesis.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
  assert.equal(await formatter.page.getByText('fixture-thesis.docx', { exact: true }).count(), 1);
  await formatter.page.getByRole('button', { name: 'Format Document' }).click();
  await formatter.page.getByText('Formatting your document…', { exact: true }).waitFor();
  await formatter.page.getByText('Formatting Failed', { exact: true }).waitFor();
  assert.ok(formatter.consoleErrors.some((message) => message.includes('500')), 'Mocked formatter failure did not surface its expected console error');
  formatter.consoleErrors.length = 0;
  await formatter.page.getByRole('button', { name: 'Try Again' }).click();
  assert.equal(await formatter.page.getByText('fixture-thesis.docx', { exact: true }).count(), 1);
  await formatter.page.getByRole('button', { name: 'Format Document' }).click();
  await formatter.page.getByText('Document Formatted', { exact: true }).waitFor();
  await assertClean(formatter, 'formatter desktop');
  results.push('formatter settings, retention, error and mocked completion: pass');
  await formatter.context.close();

  const mobileFormatter = await createApp({ width: 390, height: 844, colorScheme: 'light' });
  await navigateTool(mobileFormatter.page, 'Book', true);
  await mobileFormatter.page.locator('.type-card').filter({ hasText: 'Book' }).click();
  await mobileFormatter.page.getByLabel('Book Title').fill('Mobile fixture book');
  await mobileFormatter.page.getByRole('button', { name: 'Continue to upload' }).click();
  await mobileFormatter.page.getByLabel('Choose a Word document to format').setInputFiles(sampleFile('mobile-book.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
  await mobileFormatter.page.getByRole('button', { name: 'Switch to dark theme' }).click();
  assert.equal(await mobileFormatter.page.getByText('mobile-book.docx', { exact: true }).count(), 1);
  await mobileFormatter.page.locator('.workspace-card').scrollIntoViewIfNeeded();
  await mobileFormatter.page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase4b-formatter-mobile.png'), fullPage: false });
  await assertClean(mobileFormatter, 'formatter mobile');
  results.push('formatter mobile and file retention: pass');
  await mobileFormatter.context.close();

  const merge = await createApp({ width: 1440, height: 1000, colorScheme: 'light' });
  await navigateTool(merge.page, 'Merge PDF');
  await merge.page.getByLabel('Browse files').setInputFiles([
    sampleFile('Research_Paper.pdf', 'application/pdf'),
    sampleFile('Thesis_Chapter_1.pdf', 'application/pdf'),
    sampleFile('Appendix.pdf', 'application/pdf'),
  ]);
  assert.equal(await merge.page.locator('.file-selected').count(), 3);
  await merge.page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase4b-merge-pdf-populated.png'), fullPage: true });
  await merge.page.getByRole('button', { name: 'Remove Thesis_Chapter_1.pdf' }).click();
  assert.equal(await merge.page.locator('.file-selected').count(), 2);
  await merge.page.getByRole('button', { name: 'Merge PDF files' }).click();
  await merge.page.getByText('Processing…', { exact: true }).waitFor();
  await merge.page.getByText('Merge complete', { exact: true }).waitFor();
  await assertClean(merge, 'merge PDF populated and mocked success');
  results.push('merge PDF populated/remove/mocked success: pass');
  await merge.context.close();

  for (const colorScheme of ['light', 'dark']) {
    for (const width of [1440, 390]) {
      const activeScreens = await createApp({ width, height: width === 1440 ? 900 : 844, colorScheme });
      const mobile = width < 769;
      for (const toolName of ['Merge Word', 'PDF to Word', 'Excel to PDF', 'Hindi to Krutidev']) {
        await navigateTool(activeScreens.page, toolName, mobile);
        await assertNoOverflow(activeScreens.page, `${toolName} ${colorScheme} ${width}`);
        await navigateHome(activeScreens.page);
      }
      await assertClean(activeScreens, `active tool screen sweep ${colorScheme} ${width}`);
      results.push(`active tool sweep ${colorScheme} ${width}px: pass`);
      await activeScreens.context.close();
    }
  }

  for (const colorScheme of ['light', 'dark']) {
    for (const width of [1440, 390]) {
      const mobile = width < 769;
      const surfaceSweep = await createApp({ width, height: mobile ? 844 : 900, colorScheme });
      await navigateContact(surfaceSweep.page, mobile);
      await assertNoOverflow(surfaceSweep.page, `Contact ${colorScheme} ${width}`);
      await navigateHome(surfaceSweep.page);
      await openModalFromNavigation(surfaceSweep.page, 'Log in', mobile);
      await surfaceSweep.page.getByRole('dialog', { name: 'Welcome back' }).waitFor();
      await surfaceSweep.page.keyboard.press('Escape');
      await navigateTool(surfaceSweep.page, 'Book', mobile);
      await surfaceSweep.page.getByRole('button', { name: 'AI formatting assistant' }).click();
      await surfaceSweep.page.getByRole('dialog', { name: 'AI formatting assistant' }).waitFor();
      await surfaceSweep.page.keyboard.press('Escape');
      await navigateHome(surfaceSweep.page);
      await openModalFromNavigation(surfaceSweep.page, 'Licence', mobile);
      await surfaceSweep.page.getByRole('dialog', { name: 'Licence Agreement' }).waitFor();
      if (mobile) {
        assert.equal(await surfaceSweep.page.locator('.modal-card').evaluate((element) => getComputedStyle(element).overflowY), 'auto');
      }
      await surfaceSweep.page.keyboard.press('Escape');
      await assertClean(surfaceSweep, `contact/auth/AI/licence sweep ${colorScheme} ${width}px`);
      results.push(`contact/auth/AI/licence sweep ${colorScheme} ${width}px: pass`);
      await surfaceSweep.context.close();

      const dashboardSweep = await createApp({ width, height: mobile ? 844 : 900, colorScheme, fixture: true });
      await navigateDashboard(dashboardSweep.page, mobile);
      await dashboardSweep.page.getByRole('button', { name: 'Activity', exact: true }).click();
      await dashboardSweep.page.getByRole('heading', { name: 'Activity', exact: true }).waitFor();
      await dashboardSweep.page.getByRole('button', { name: 'Profile', exact: true }).click();
      await dashboardSweep.page.getByRole('heading', { name: 'Profile', exact: true }).waitFor();
      await assertClean(dashboardSweep, `dashboard activity/profile sweep ${colorScheme} ${width}px`);
      results.push(`dashboard activity/profile sweep ${colorScheme} ${width}px: pass`);
      await dashboardSweep.context.close();
    }
  }

  const dashboard = await createApp({ width: 1440, height: 1000, colorScheme: 'light', fixture: true });
  await dashboard.page.getByRole('button', { name: 'My Account' }).click();
  await dashboard.page.getByText('Welcome back, Priya Sharma', { exact: true }).waitFor();
  await dashboard.page.getByText('4', { exact: true }).waitFor();
  assert.equal(await dashboard.page.getByText('Subscription', { exact: true }).count(), 0);
  assert.equal(await dashboard.page.getByText('Upgrade', { exact: false }).count(), 0);
  await dashboard.page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase4b-dashboard-desktop-fixture.png'), fullPage: true });
  await assertClean(dashboard, 'dashboard desktop fixture');
  results.push('dashboard desktop fixture: pass');
  await dashboard.context.close();

  const mobileDashboard = await createApp({ width: 390, height: 844, colorScheme: 'dark', fixture: true });
  const menu = mobileDashboard.page.getByRole('button', { name: 'Open navigation menu' });
  await menu.click();
  await mobileDashboard.page.locator('#mobile-navigation').getByRole('button', { name: 'My Account' }).click();
  await mobileDashboard.page.getByText('Welcome back, Priya Sharma', { exact: true }).waitFor();
  await mobileDashboard.page.getByRole('button', { name: 'Profile' }).click();
  await mobileDashboard.page.getByRole('heading', { name: 'Profile', exact: true }).waitFor();
  await mobileDashboard.page.getByRole('button', { name: 'Overview' }).click();
  await mobileDashboard.page.getByText('Welcome back, Priya Sharma', { exact: true }).waitFor();
  await mobileDashboard.page.evaluate(() => window.scrollTo(0, 0));
  await mobileDashboard.page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase4b-dashboard-mobile-fixture.png'), fullPage: false });
  await assertClean(mobileDashboard, 'dashboard mobile fixture');
  results.push('dashboard mobile navigation fixture: pass');
  await mobileDashboard.context.close();

  const contact = await createApp({ width: 1440, height: 1000, colorScheme: 'light' });
  await contact.page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Contact' }).click();
  await contact.page.getByRole('button', { name: 'Send message' }).click();
  assert.equal(await contact.page.locator('.field-error').count(), 3);
  assert.deepEqual(contact.contactRequests, []);
  await contact.page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase4b-contact-validation.png'), fullPage: true });
  await assertClean(contact, 'contact validation');
  results.push('contact validation without delivery: pass');
  await contact.context.close();

  const auth = await createApp({ width: 390, height: 844, colorScheme: 'dark' });
  await auth.page.getByRole('button', { name: 'Open navigation menu' }).click();
  const loginTrigger = auth.page.locator('#mobile-navigation').getByRole('button', { name: 'Log in' });
  await loginTrigger.click();
  await auth.page.getByRole('dialog', { name: 'Welcome back' }).waitFor();
  assert.equal(await auth.page.evaluate(() => document.activeElement?.id), 'login-email');
  await auth.page.keyboard.press('Shift+Tab');
  await auth.page.keyboard.press('Shift+Tab');
  assert.equal(await auth.page.getByRole('dialog').evaluate((dialog) => dialog.contains(document.activeElement)), true);
  await auth.page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase4b-auth-modal-mobile.png'), fullPage: false });
  await auth.page.keyboard.press('Escape');
  assert.equal(await auth.page.getByRole('dialog').count(), 0);
  await auth.page.waitForFunction(() => document.activeElement?.classList.contains('hamburger'));
  assert.equal(await auth.page.evaluate(() => document.activeElement?.classList.contains('hamburger')), true);

  await navigateTool(auth.page, 'Book', true);
  await auth.page.getByRole('button', { name: 'AI formatting assistant' }).click();
  await auth.page.getByRole('dialog', { name: 'AI formatting assistant' }).waitFor();
  await auth.page.keyboard.press('Escape');
  assert.equal(await auth.page.getByRole('dialog').count(), 0);
  await assertClean(auth, 'authentication and AI modal keyboard flow');
  results.push('modal focus, Escape and restoration: pass');
  await auth.context.close();

  const syncContext = await browser.newContext({ viewport: { width: 900, height: 700 }, colorScheme: 'light' });
  const syncPageA = await syncContext.newPage();
  const syncPageB = await syncContext.newPage();
  await Promise.all([
    syncPageA.goto(APP_URL, { waitUntil: 'domcontentloaded' }),
    syncPageB.goto(APP_URL, { waitUntil: 'domcontentloaded' }),
  ]);
  await syncPageA.getByRole('button', { name: 'Switch to dark theme' }).click();
  await syncPageB.locator('html[data-theme="dark"]').waitFor();
  assert.equal(await syncPageB.locator('html').getAttribute('data-theme'), 'dark');
  results.push('cross-tab theme synchronization: pass');
  await syncContext.close();

  const typography = await createApp({ width: 1440, height: 900, colorScheme: 'light' });
  await navigateTool(typography.page, 'Book');
  await typography.page.locator('.type-card').filter({ hasText: 'Book' }).click();
  const fontSizes = await typography.page.evaluate(() => Object.fromEntries(
    ['.tool-subtitle', '.field-input', '.field-label', '.nav-logo-sub'].map((selector) => [
      selector,
      getComputedStyle(document.querySelector(selector)).fontSize,
    ])
  ));
  assert.equal(fontSizes['.tool-subtitle'], '16px');
  assert.equal(fontSizes['.field-input'], '15px');
  assert.equal(fontSizes['.field-label'], '14px');
  assert.equal(fontSizes['.nav-logo-sub'], '10px');
  results.push(`computed typography: ${JSON.stringify(fontSizes)}`);
  await typography.context.close();

  const narrow = await createApp({ width: 320, height: 720, colorScheme: 'dark' });
  await navigateTool(narrow.page, 'Merge PDF', true);
  await assertClean(narrow, '320px narrow conversion');
  results.push('narrow 320px overflow: pass');
  await narrow.context.close();

  console.log(results.join('\n'));
} finally {
  await browser.close();
}
