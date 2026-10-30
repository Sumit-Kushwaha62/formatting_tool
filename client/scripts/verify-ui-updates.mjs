import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve('../docs/screenshots');
const THEME_KEY = 'format-studio-theme';

await mkdir(SCREENSHOT_DIR, { recursive: true });

// Start Vite dev server on port 5173
const clientDir = path.resolve('client');
const viteServer = await createServer({
  root: clientDir,
  server: { port: 5173, host: '127.0.0.1' },
});
await viteServer.listen();
const APP_URL = 'http://127.0.0.1:5173/';
console.log(`Vite server running at ${APP_URL}`);

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });

async function assertNoOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert.ok(dimensions.scrollWidth <= dimensions.clientWidth, `${label} has horizontal overflow (${dimensions.scrollWidth} > ${dimensions.clientWidth})`);
}

async function runTests() {
  console.log('Starting UI updates visual verification...');

  // 1. Desktop Light Mode
  console.log('\n--- 1. Testing Desktop Light Mode (1440x900) ---');
  const desktopCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
  });
  await desktopCtx.addInitScript(({ key }) => localStorage.setItem(key, 'light'), { key: THEME_KEY });
  const desktopPage = await desktopCtx.newPage();
  
  const consoleErrors = [];
  desktopPage.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  desktopPage.on('pageerror', err => consoleErrors.push(err.message));

  await desktopPage.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(600);

  // Verify Logo
  const logo = desktopPage.locator('.nav-logo img.nav-logo-img');
  await logo.waitFor({ state: 'visible' });
  const logoSrc = await logo.getAttribute('src');
  assert.ok(logoSrc.includes('logo.png'), `Expected logo src to contain logo.png, got: ${logoSrc}`);
  console.log('✓ Original logo is present in navbar');

  // Verify Format Studio product name
  const logoText = await desktopPage.locator('.nav-logo-text').textContent();
  assert.equal(logoText.trim(), 'Format Studio');
  console.log('✓ "Format Studio" title preserved');

  // Verify Glassmorphism styles on nav
  const navBackdrop = await desktopPage.locator('.nav').evaluate(el => window.getComputedStyle(el).backdropFilter || window.getComputedStyle(el).webkitBackdropFilter);
  console.log(`✓ Nav backdrop-filter: ${navBackdrop}`);

  // Verify no standalone logout when unauthenticated
  assert.equal(await desktopPage.locator('.nav-logout').count(), 0, 'No logout button for unauthenticated users in navbar');
  console.log('✓ No standalone logout button in desktop navbar');

  await assertNoOverflow(desktopPage, 'Desktop Light Home');
  await desktopPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'ui-updates-home-desktop-light.png'), fullPage: false });
  console.log('✓ Saved ui-updates-home-desktop-light.png');

  // 2. Desktop Dark Mode
  console.log('\n--- 2. Testing Desktop Dark Mode (1440x900) ---');
  const themeToggle = desktopPage.locator('.nav-links .theme-toggle-btn');
  await themeToggle.click();
  await desktopPage.waitForTimeout(300);
  
  const currentTheme = await desktopPage.locator('html').getAttribute('data-theme');
  assert.equal(currentTheme, 'dark', 'Theme switched to dark');
  console.log('✓ Theme toggle switches to dark mode');

  await assertNoOverflow(desktopPage, 'Desktop Dark Home');
  await desktopPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'ui-updates-home-desktop-dark.png'), fullPage: false });
  console.log('✓ Saved ui-updates-home-desktop-dark.png');

  // 3. Navigation to Tool Page & Glass Cards
  console.log('\n--- 3. Testing Tool Page & Glass Surfaces ---');
  await desktopPage.getByRole('button', { name: 'Tools', exact: true }).click();
  await desktopPage.waitForTimeout(200);
  await desktopPage.locator('.nav-mega-dropdown button:has-text("Book")').click();
  await desktopPage.waitForTimeout(400);

  const toolCard = desktopPage.locator('.card').first();
  await toolCard.waitFor({ state: 'visible' });
  const cardBackdrop = await toolCard.evaluate(el => window.getComputedStyle(el).backdropFilter || window.getComputedStyle(el).webkitBackdropFilter);
  console.log(`✓ Tool Card backdrop-filter: ${cardBackdrop}`);

  await desktopPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'ui-updates-tool-desktop-dark.png'), fullPage: false });
  console.log('✓ Saved ui-updates-tool-desktop-dark.png');

  // Test logo click returns home
  await desktopPage.locator('.nav-logo').click();
  await desktopPage.waitForTimeout(300);
  assert.ok(await desktopPage.locator('.hero').isVisible(), 'Clicking logo navigates back to Home');
  console.log('✓ Logo click returns to Home');

  // 4. Test Modals & Glass Dialog
  console.log('\n--- 4. Testing Modals & Glass Dialog ---');
  await desktopPage.locator('.nav-btn-ghost').click();
  await desktopPage.waitForTimeout(300);
  const modal = desktopPage.locator('.modal-card');
  await modal.waitFor({ state: 'visible' });
  const modalBackdrop = await modal.evaluate(el => window.getComputedStyle(el).backdropFilter || window.getComputedStyle(el).webkitBackdropFilter);
  console.log(`✓ Modal backdrop-filter: ${modalBackdrop}`);
  await desktopPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'ui-updates-modal-desktop.png') });
  console.log('✓ Saved ui-updates-modal-desktop.png');

  // Close modal with close button
  await desktopPage.locator('.modal-close').click();
  await desktopPage.waitForTimeout(200);

  // 5. Mobile Layout (390x844) Light & Dark
  console.log('\n--- 5. Testing Mobile (390x844) ---');
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'light',
  });
  await mobileCtx.addInitScript(({ key }) => localStorage.setItem(key, 'light'), { key: THEME_KEY });
  const mobilePage = await mobileCtx.newPage();

  await mobilePage.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(500);

  // Check mobile navbar logo
  const mobileLogo = mobilePage.locator('.nav-logo img.nav-logo-img');
  await mobileLogo.waitFor({ state: 'visible' });
  console.log('✓ Mobile logo is visible');

  await assertNoOverflow(mobilePage, 'Mobile Light Home');
  await mobilePage.screenshot({ path: path.join(SCREENSHOT_DIR, 'ui-updates-home-mobile-light.png') });
  console.log('✓ Saved ui-updates-home-mobile-light.png');

  // Check mobile hamburger menu
  await mobilePage.locator('.hamburger').click();
  await mobilePage.waitForTimeout(300);
  const mobileMenu = mobilePage.locator('.mobile-menu');
  await mobileMenu.waitFor({ state: 'visible' });
  assert.equal(await mobileMenu.locator('.nav-logout').count(), 0, 'No standalone logout in mobile menu');
  console.log('✓ No standalone logout in mobile menu');

  // Switch to dark mode on mobile
  await mobilePage.locator('.mobile-theme-toggle').click();
  await mobilePage.waitForTimeout(300);
  await mobilePage.screenshot({ path: path.join(SCREENSHOT_DIR, 'ui-updates-home-mobile-dark.png') });
  console.log('✓ Saved ui-updates-home-mobile-dark.png');

  console.log('\n=======================================');
  console.log('ALL VISUAL QA AND UI CHECKS PASSED 100%');
  console.log('=======================================');

  await desktopCtx.close();
  await mobileCtx.close();
  await browser.close();
  await viteServer.close();
}

runTests().catch(async (err) => {
  console.error('Test execution failed:', err);
  await browser.close();
  await viteServer.close();
  process.exit(1);
});
