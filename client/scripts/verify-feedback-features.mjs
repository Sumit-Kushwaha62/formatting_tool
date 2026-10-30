import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://127.0.0.1:5173/';
const clientDir = path.resolve('client');

const viteServer = await createServer({
  root: clientDir,
  server: { port: 5173, host: '127.0.0.1' },
});
await viteServer.listen();
console.log(`Vite server running for feedback tests at ${APP_URL}`);

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });

async function runTests() {
  console.log('\n--- 1. Testing Daily Feedback Popup (First visit of the day) ---');
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Clear any previous feedback timestamp
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('fs_daily_feedback_date'));
  await page.reload({ waitUntil: 'domcontentloaded' });

  // Verify popup appears after timeout (~3.5s delay)
  console.log('Waiting for Daily Feedback Popup to appear...');
  const popup = page.locator('.daily-feedback-popup');
  await popup.waitFor({ state: 'visible', timeout: 6000 });
  console.log('✓ Daily Feedback Popup appeared smoothly on first visit of the day');

  // Verify elements in popup
  assert.ok(await page.locator('.daily-feedback-title').isVisible(), 'Popup title is visible');
  assert.equal(await page.locator('.daily-star-btn').count(), 5, '5 star rating buttons present in popup');
  assert.ok(await page.locator('.daily-feedback-textarea').isVisible(), 'Feedback textarea present');

  // Dismiss popup
  await page.locator('.daily-feedback-close').click();
  await page.waitForTimeout(300);
  assert.equal(await popup.isVisible(), false, 'Popup dismissed on close button click');
  console.log('✓ Popup dismisses correctly');

  // Verify localStorage marked today
  const today = new Date().toISOString().slice(0, 10);
  const storedDate = await page.evaluate(() => localStorage.getItem('fs_daily_feedback_date'));
  assert.equal(storedDate, today, 'localStorage fs_daily_feedback_date is marked with today');
  console.log('✓ Stored date in localStorage matches today');

  // Reload page to test "din me ek baar only"
  console.log('\n--- 2. Testing "Once Per Day" Rule on Reload ---');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000); // Wait longer than the 3.5s popup delay
  assert.equal(await popup.isVisible(), false, 'Popup MUST NOT appear again on second visit today');
  console.log('✓ Verified: Popup did NOT appear again on subsequent reload (once per day respected)');

  // 3. Test Contact Page - Improvement Feedback Section
  console.log('\n--- 3. Testing Contact Page Improvement Feedback Section ---');
  // Navigate to Contact
  await page.locator('.footer button:has-text("Contact")').first().click();
  await page.waitForTimeout(400);

  const contactCard = page.locator('.contact-card');
  await contactCard.waitFor({ state: 'visible' });

  // Verify tabs
  const feedbackTab = page.locator('.contact-tab-btn:has-text("Improvement Feedback")');
  const supportTab = page.locator('.contact-tab-btn:has-text("Contact Support")');
  assert.ok(await feedbackTab.isVisible(), 'Improvement Feedback tab is visible');
  assert.ok(await supportTab.isVisible(), 'Contact Support tab is visible');
  const tabClass = await feedbackTab.getAttribute('class');
  assert.ok(tabClass && tabClass.includes('active'), 'Improvement feedback tab has active class');
  console.log('✓ Tab switcher rendered with Improvement Feedback active by default');

  // Test star rating click
  const stars = page.locator('.star-btn');
  assert.equal(await stars.count(), 5, '5 rating stars rendered');
  await stars.nth(3).click(); // Click 4 stars
  assert.equal(await page.locator('.star-rating-desc').textContent(), 'Very Good');
  console.log('✓ Star rating interaction works (4 stars = Very Good)');

  // Test category chips
  const chips = page.locator('.category-chip');
  assert.ok(await chips.count() >= 5, 'Category chips rendered');
  await page.locator('.category-chip:has-text("UI & Experience")').click();
  const chipClass = await page.locator('.category-chip:has-text("UI & Experience")').getAttribute('class');
  assert.ok(chipClass && chipClass.includes('active'), 'Selected chip has active class');
  console.log('✓ Category chip selection works');

  // Test tab switching to support and back
  await supportTab.click();
  await page.waitForTimeout(200);
  assert.ok(await page.locator('input[placeholder="e.g. Rahul Sharma"]').isVisible(), 'Support form inputs visible');
  console.log('✓ Switching to Contact Support tab works');

  await feedbackTab.click();
  await page.waitForTimeout(200);
  assert.ok(await page.locator('textarea[placeholder*="interface"]').isVisible(), 'Switched back to Feedback tab');
  console.log('✓ Switching back to Improvement Feedback tab works');

  console.log('\n=============================================');
  console.log('ALL FEEDBACK & POPUP FUNCTIONAL TESTS PASSED!');
  console.log('=============================================');

  await context.close();
  await browser.close();
  await viteServer.close();
}

runTests().catch(async (err) => {
  console.error('Test execution failed:', err);
  await browser.close();
  await viteServer.close();
  process.exit(1);
});
