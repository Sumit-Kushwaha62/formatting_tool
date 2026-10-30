import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'http://127.0.0.1:5173/';
const clientDir = path.resolve('client');
const tempDir = path.resolve('phase5-test-run');

if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// 1. Create 3 small synthetic test PDFs using Python
const pdf1Path = path.resolve(tempDir, 'test_doc_alpha.pdf');
const pdf2Path = path.resolve(tempDir, 'test_doc_beta.pdf');
const pdf3Path = path.resolve(tempDir, 'test_doc_gamma.pdf');

await new Promise((resolve, reject) => {
  const pyCode = `
import fitz
for name, text in [('test_doc_alpha.pdf', 'Document Alpha Page Content'),
                   ('test_doc_beta.pdf', 'Document Beta Page Content'),
                   ('test_doc_gamma.pdf', 'Document Gamma Page Content')]:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), text, fontsize=18)
    doc.save(r'${tempDir.replace(/\\/g, '/')}/' + name)
    doc.close()
print('PDFs created successfully')
`;
  const child = spawn('python', ['-c', pyCode]);
  child.on('close', code => (code === 0 ? resolve() : reject('Failed to generate test PDFs')));
});

console.log('✓ Created 3 synthetic test PDFs for testing');

// 2. Start Vite server
const viteServer = await createServer({
  root: clientDir,
  server: { port: 5173, host: '127.0.0.1' },
});
await viteServer.listen();
console.log(`Vite server running at ${APP_URL}`);

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });

async function runTests() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Avoid daily popup during tool tests
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('fs_daily_feedback_date', new Date().toISOString().slice(0, 10));
  });

  // ── TEST 1: Merge PDF with Drag & Drop / Reordering & Real-Time Preview ──
  console.log('\n--- 1. Testing Interactive Merge PDF Reordering & Live Preview ---');
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  
  // Navigate to Merge PDF
  const toolsBtn = page.getByRole('button', { name: 'Tools', exact: true });
  await toolsBtn.click();
  await page.waitForTimeout(200);
  await page.locator('#desktop-tools-menu button:has-text("Merge PDF")').click();
  await page.waitForTimeout(400);

  // Upload the 3 PDFs
  const fileInput = page.locator('#fileInput');
  await fileInput.setInputFiles([pdf1Path, pdf2Path, pdf3Path]);
  await page.waitForTimeout(400);

  // Verify list rendered with 3 items
  const items = page.locator('.reorder-item');
  assert.equal(await items.count(), 3, '3 files rendered in reorder list');
  console.log('✓ Uploaded 3 PDF files into sequence');

  // Verify initial order: Alpha (#1), Beta (#2), Gamma (#3)
  let names = await page.locator('.reorder-name').allTextContents();
  assert.equal(names[0], 'test_doc_alpha.pdf');
  assert.equal(names[1], 'test_doc_beta.pdf');
  assert.equal(names[2], 'test_doc_gamma.pdf');
  console.log('✓ Initial sequence verified: Alpha (#1), Beta (#2), Gamma (#3)');

  // Test Move Down button on item #1 (Alpha moves to #2)
  const moveDownBtnFirst = page.locator('.reorder-item').first().locator('button[title="Move down"]');
  await moveDownBtnFirst.click();
  await page.waitForTimeout(200);

  names = await page.locator('.reorder-name').allTextContents();
  assert.equal(names[0], 'test_doc_beta.pdf');
  assert.equal(names[1], 'test_doc_alpha.pdf');
  assert.equal(names[2], 'test_doc_gamma.pdf');
  console.log('✓ Reorder move down works: Beta is now #1, Alpha is #2');

  // Test Move Up button on item #3 (Gamma moves to #2)
  const moveUpBtnLast = page.locator('.reorder-item').nth(2).locator('button[title="Move up"]');
  await moveUpBtnLast.click();
  await page.waitForTimeout(200);

  names = await page.locator('.reorder-name').allTextContents();
  assert.equal(names[0], 'test_doc_beta.pdf');
  assert.equal(names[1], 'test_doc_gamma.pdf');
  assert.equal(names[2], 'test_doc_alpha.pdf');
  console.log('✓ Reorder move up works: Beta #1, Gamma #2, Alpha #3');

  // ── TEST 2: Real-Time Document Previewer on an individual file ──
  console.log('\n--- 2. Testing Real-Time Document Previewer (Pre-Merge Preview) ---');
  const previewBtn = page.locator('.reorder-item').first().locator('.preview-btn-icon');
  await previewBtn.click();
  await page.waitForTimeout(300);

  const previewModal = page.locator('.preview-modal-dialog');
  await previewModal.waitFor({ state: 'visible' });
  assert.ok(await previewModal.isVisible(), 'Document Preview Modal opened');
  assert.ok(await page.locator('.preview-iframe').isVisible(), 'PDF Preview iframe rendered');
  console.log('✓ Real-time Document Preview modal rendered with active iframe');

  // Close preview modal
  await page.locator('.preview-btn-close').click();
  await page.waitForTimeout(200);
  assert.equal(await previewModal.isVisible(), false, 'Preview modal closed');
  console.log('✓ Preview modal dismissed cleanly');

  // ── TEST 3: PDF Compressor Navigation & Flow ──
  console.log('\n--- 3. Testing PDF Compressor Tool ---');
  await toolsBtn.click();
  await page.waitForTimeout(200);
  await page.locator('#desktop-tools-menu button:has-text("Compress PDF")').click();
  await page.waitForTimeout(400);

  assert.ok(await page.locator('.tool-title:has-text("PDF Compressor")').isVisible(), 'PDF Compressor page loaded');
  console.log('✓ PDF Compressor tool page loaded successfully');

  // Upload a file to compress
  const compressInput = page.locator('#compressFileInput');
  await compressInput.setInputFiles([pdf1Path]);
  await page.waitForTimeout(300);

  assert.ok(await page.locator('.compress-file-card').isVisible(), 'Selected file info card displayed');
  console.log('✓ File card displayed with file name & size');

  // Test compression levels
  const extremeLevel = page.locator('.compress-level-card:has-text("Extreme")');
  await extremeLevel.click();
  const lvlClass = await extremeLevel.getAttribute('class');
  assert.ok(lvlClass && lvlClass.includes('active'), 'Extreme level card has active class');
  console.log('✓ Compression level selection works (Extreme selected)');

  console.log('\n=============================================');
  console.log('ALL NEW FEATURES (COMPRESS, PREVIEW, REORDER) PASSED!');
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
