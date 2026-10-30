import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const APP_URL = 'http://127.0.0.1:5173/';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve('../docs/screenshots');
const THEME_KEY = 'format-studio-theme';

const toolActions = [
  ['Open formatter: Book', 'tool'],
  ['Open formatter: Thesis', 'tool'],
  ['Open formatter: Research Paper', 'tool'],
  ['Open formatter: Letter / Notice', 'tool'],
  ['Open tool: Merge PDF', 'merge-pdf'],
  ['Open tool: Merge Word', 'merge-word'],
  ['Open tool: PDF to Word', 'pdf-to-word'],
  ['Open tool: Excel to PDF', 'excel-to-pdf'],
  ['Open tool: Hindi to Krutidev', 'hindi-to-krutidev'],
];

await mkdir(SCREENSHOT_DIR, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
const results = [];

async function openHome({ width, height, colorScheme, storedTheme = null }) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme });
  if (storedTheme) {
    await context.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: THEME_KEY, value: storedTheme });
  }
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.home-page').waitFor({ state: 'visible' });
  return { context, page, consoleErrors };
}

async function assertNoOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert.ok(dimensions.scrollWidth <= dimensions.clientWidth, `${label} has horizontal overflow`);
}

try {
  const desktopLight = await openHome({ width: 1440, height: 1000, colorScheme: 'light' });
  assert.equal(await desktopLight.page.locator('html').getAttribute('data-theme'), 'light');
  assert.equal(await desktopLight.page.getByText('Pricing', { exact: true }).count(), 0);
  assert.equal(await desktopLight.page.locator('script[src*="razorpay"]').count(), 0);
  await assertNoOverflow(desktopLight.page, '1440px light home');

  const toolsTrigger = desktopLight.page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Tools', exact: true });
  await toolsTrigger.click();
  assert.equal(await toolsTrigger.getAttribute('aria-expanded'), 'true');
  assert.equal(await desktopLight.page.locator('#desktop-tools-menu button').count(), 9);
  await toolsTrigger.press('Escape');
  assert.equal(await toolsTrigger.getAttribute('aria-expanded'), 'false');

  const exploreButton = desktopLight.page.getByRole('button', { name: 'Explore tools' });
  await exploreButton.click();
  await desktopLight.page.waitForTimeout(500);
  assert.ok(await desktopLight.page.evaluate(() => window.scrollY > 0), 'Explore tools did not scroll');

  for (const [accessibleName] of toolActions) {
    const card = desktopLight.page.getByRole('button', { name: accessibleName });
    assert.equal(await card.count(), 1, `${accessibleName} card missing or duplicated`);
    await card.click();
    await desktopLight.page.locator('.tool-page').waitFor({ state: 'visible' });
    await desktopLight.page.getByRole('button', { name: 'Format Studio — Home' }).click();
    await desktopLight.page.locator('.home-page').waitFor({ state: 'visible' });
  }

  await desktopLight.page.keyboard.press('Tab');
  const focusOutline = await desktopLight.page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert.notEqual(focusOutline, 'none', 'Keyboard focus is not visibly outlined');
  await desktopLight.page.evaluate(() => document.activeElement?.blur());

  await desktopLight.page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase4a-home-desktop-light.png'), fullPage: true });
  assert.deepEqual(desktopLight.consoleErrors, []);
  results.push('desktop light: pass');
  await desktopLight.context.close();

  const desktopDark = await openHome({ width: 1440, height: 1000, colorScheme: 'dark' });
  assert.equal(await desktopDark.page.locator('html').getAttribute('data-theme'), 'dark');
  const lightToggle = desktopDark.page.getByRole('button', { name: 'Switch to light theme' });
  await lightToggle.click();
  assert.equal(await desktopDark.page.locator('html').getAttribute('data-theme'), 'light');
  await desktopDark.page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(await desktopDark.page.locator('html').getAttribute('data-theme'), 'light');
  await desktopDark.page.evaluate((key) => localStorage.removeItem(key), THEME_KEY);
  await desktopDark.page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(await desktopDark.page.locator('html').getAttribute('data-theme'), 'dark');
  await assertNoOverflow(desktopDark.page, '1440px dark home');
  await desktopDark.page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase4a-home-desktop-dark.png'), fullPage: true });
  assert.deepEqual(desktopDark.consoleErrors, []);
  results.push('desktop dark: pass');
  await desktopDark.context.close();

  const tablet = await openHome({ width: 768, height: 900, colorScheme: 'light' });
  await assertNoOverflow(tablet.page, '768px home');
  assert.equal(await tablet.page.getByRole('button', { name: 'Open navigation menu' }).count(), 1);
  assert.deepEqual(tablet.consoleErrors, []);
  results.push('tablet 768px: pass');
  await tablet.context.close();

  const mobileLight = await openHome({ width: 390, height: 844, colorScheme: 'light' });
  await assertNoOverflow(mobileLight.page, '390px light home');
  assert.equal(await mobileLight.page.getByRole('button', { name: 'Switch to dark theme' }).count(), 1);
  const menuButton = mobileLight.page.getByRole('button', { name: 'Open navigation menu' });
  await menuButton.click();
  assert.equal(await mobileLight.page.getByRole('button', { name: 'Close navigation menu' }).getAttribute('aria-expanded'), 'true');
  const mobileTools = mobileLight.page.locator('#mobile-navigation').getByRole('button', { name: 'Tools', exact: true });
  await mobileTools.click();
  assert.equal(await mobileLight.page.locator('#mobile-tools-list button').count(), 9);
  await mobileTools.press('Escape');
  assert.equal(await mobileLight.page.locator('#mobile-navigation').count(), 0);
  await mobileLight.page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase4a-home-mobile-light.png'), fullPage: true });
  assert.deepEqual(mobileLight.consoleErrors, []);
  results.push('mobile light: pass');
  await mobileLight.context.close();

  const mobileDark = await openHome({ width: 390, height: 844, colorScheme: 'dark' });
  await assertNoOverflow(mobileDark.page, '390px dark home');
  await mobileDark.page.screenshot({ path: path.join(SCREENSHOT_DIR, 'phase4a-home-mobile-dark.png'), fullPage: true });
  assert.deepEqual(mobileDark.consoleErrors, []);
  results.push('mobile dark: pass');
  await mobileDark.context.close();

  const narrow = await openHome({ width: 320, height: 720, colorScheme: 'light' });
  await assertNoOverflow(narrow.page, '320px home');
  assert.deepEqual(narrow.consoleErrors, []);
  results.push('narrow 320px: pass');
  await narrow.context.close();

  console.log(results.join('\n'));
} finally {
  await browser.close();
}
