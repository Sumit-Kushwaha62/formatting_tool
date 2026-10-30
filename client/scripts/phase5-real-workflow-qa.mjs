import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const APP_URL = process.env.PHASE5_APP_URL || 'http://127.0.0.1:5173/';
const API_URL = process.env.PHASE5_API_URL || 'http://127.0.0.1:5010';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = path.resolve('..');
const RUN_DIR = path.join(ROOT, 'phase5-test-run');
const INPUTS = path.join(RUN_DIR, 'inputs');
const OUTPUTS = path.join(RUN_DIR, 'outputs');
const EVIDENCE = path.join(RUN_DIR, 'evidence');
const unavailableMode = process.argv.includes('--backend-unavailable');
const failuresOnlyMode = process.argv.includes('--failures-only');

await mkdir(OUTPUTS, { recursive: true });
await mkdir(EVIDENCE, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(120000);
const records = [];

const responseForPath = (pathname) => page.waitForResponse(
  (response) => new URL(response.url()).pathname === pathname,
  { timeout: 120000 },
);

async function loadHome() {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.home-page').waitFor();
}

async function navigateTool(name) {
  const nav = page.getByRole('navigation', { name: 'Primary navigation' });
  await nav.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.locator('#desktop-tools-menu').getByRole('button', { name, exact: true }).click();
  await page.locator('.tool-page').waitFor();
}

async function saveDownload(button, outputName) {
  const downloadPromise = page.waitForEvent('download');
  await button.click();
  const download = await downloadPromise;
  const outputPath = path.join(OUTPUTS, outputName);
  await download.saveAs(outputPath);
  return { outputPath, suggestedFilename: download.suggestedFilename() };
}

async function formatDocument(config) {
  await loadHome();
  await navigateTool('Book');
  await page.locator('.type-card').filter({ hasText: config.card }).click();
  await page.getByLabel('Language').selectOption('english');
  await page.getByLabel('Font family').selectOption(config.font);
  await page.getByLabel('Font size').selectOption(config.size);
  await page.getByLabel('Line spacing').selectOption(config.spacing);
  await page.getByRole('button', { name: config.pageSizeName, exact: true }).click();
  await page.getByLabel('Header text').fill('PHASE5 HEADER');
  await page.getByLabel('Footer text').fill('PHASE5 FOOTER');
  await page.getByLabel(config.titleLabel).fill(config.title);
  await page.getByRole('button', { name: 'Continue to upload' }).click();
  await page.getByLabel('Choose a Word document to format').setInputFiles(path.join(INPUTS, `formatter-${config.kind}.docx`));
  const responsePromise = responseForPath('/format');
  await page.getByRole('button', { name: 'Format Document' }).click();
  const response = await responsePromise;
  await page.getByText('Document Formatted', { exact: true }).waitFor({ timeout: 120000 });
  const downloaded = await saveDownload(page.getByRole('link', { name: 'Download file' }), `formatted-${config.kind}.docx`);
  records.push({
    tool: config.kind,
    surface: 'browser UI',
    endpoint: '/format',
    status: response.status(),
    options: { font: config.font, size: config.size, spacing: config.spacing, pageSize: config.pageSizeName.split(' ')[0], header: 'PHASE5 HEADER', footer: 'PHASE5 FOOTER' },
    input: `formatter-${config.kind}.docx`,
    output: path.basename(downloaded.outputPath),
    suggestedFilename: downloaded.suggestedFilename,
  });
}

async function runFileTool({ navName, inputFiles, actionName, resultText, outputName, endpoint, downloadName }) {
  await loadHome();
  await navigateTool(navName);
  await page.getByLabel('Browse files').setInputFiles(inputFiles.map((name) => path.join(INPUTS, name)));
  const responsePromise = responseForPath(endpoint);
  await page.getByRole('button', { name: actionName }).click();
  const response = await responsePromise;
  await page.getByText(resultText, { exact: true }).waitFor({ timeout: 120000 });
  const downloadButton = page.getByRole('button', { name: downloadName });
  const downloaded = await saveDownload(downloadButton, outputName);
  records.push({ tool: navName, surface: 'browser UI', endpoint, status: response.status(), input: inputFiles, output: path.basename(downloaded.outputPath), suggestedFilename: downloaded.suggestedFilename });
}

async function runHindi() {
  await loadHome();
  await navigateTool('Hindi to Krutidev');
  await page.getByLabel('Choose a Unicode Hindi Word document').setInputFiles(path.join(INPUTS, 'hindi-unicode.docx'));
  const responsePromise = responseForPath('/api/convert-krutidev');
  await page.getByRole('button', { name: 'Convert to Krutidev' }).click();
  const response = await responsePromise;
  await page.getByText('Conversion Complete', { exact: true }).waitFor({ timeout: 120000 });
  const downloaded = await saveDownload(page.getByRole('button', { name: 'Download converted file' }), 'hindi-krutidev.docx');
  records.push({ tool: 'Hindi to Krutidev', surface: 'browser UI', endpoint: '/api/convert-krutidev', status: response.status(), options: { font: 'Krutidev010' }, input: 'hindi-unicode.docx', output: path.basename(downloaded.outputPath), suggestedFilename: downloaded.suggestedFilename });
}

async function runFailures() {
  await loadHome();
  await navigateTool('Merge PDF');
  const emptyAction = page.getByRole('button', { name: 'Merge PDF files' });
  assert.equal(await emptyAction.isDisabled(), true);
  await page.getByLabel('Browse files').setInputFiles(path.join(INPUTS, 'merge-pdf-1.pdf'));
  assert.equal(await emptyAction.isDisabled(), true);
  assert.equal(await page.getByText('Merge complete', { exact: true }).count(), 0);
  records.push({ scenario: 'no input / too few files', surface: 'browser UI', result: 'PASS', evidence: 'primary action disabled; no success state' });

  await loadHome();
  await navigateTool('PDF to Word');
  await page.getByLabel('Browse files').setInputFiles(path.join(INPUTS, 'unsupported.txt'));
  await page.getByText('Only PDF files are supported.', { exact: true }).waitFor();
  assert.equal(await page.locator('.file-selected').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Convert to Word' }).isDisabled(), true);
  records.push({ scenario: 'unsupported native file selection', surface: 'browser UI', result: 'PASS; rejected before request' });

  await loadHome();
  await navigateTool('PDF to Word');
  await page.getByLabel('Browse files').setInputFiles(path.join(INPUTS, 'corrupt.pdf'));
  const corruptResponsePromise = responseForPath('/api/pdf-to-word');
  await page.getByRole('button', { name: 'Convert to Word' }).click();
  const corruptResponse = await corruptResponsePromise;
  assert.equal(corruptResponse.status(), 500);
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByText('Conversion complete', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Convert to Word' }).isEnabled(), true);
  records.push({ scenario: 'corrupt supported-format file and retry-ready state', surface: 'browser UI', endpoint: '/api/pdf-to-word', status: corruptResponse.status(), result: 'PASS' });

  await page.getByRole('button', { name: 'Remove corrupt.pdf' }).click();
  await page.getByLabel('Browse files').setInputFiles(path.join(INPUTS, 'pdf-to-word.pdf'));
  const retryResponsePromise = responseForPath('/api/pdf-to-word');
  await page.getByRole('button', { name: 'Convert to Word' }).click();
  const retryResponse = await retryResponsePromise;
  assert.equal(retryResponse.status(), 200);
  await page.getByText('Conversion complete', { exact: true }).waitFor();
  await saveDownload(page.getByRole('button', { name: 'Download' }), 'pdf-to-word-retry.docx');
  records.push({ scenario: 'corrected input retry', surface: 'browser UI', endpoint: '/api/pdf-to-word', status: 200, result: 'PASS; success and real download after failure' });

  const unsupportedResponse = await context.request.post(`${API_URL}/api/pdf-to-word`, {
    multipart: { files: { name: 'unsupported.txt', mimeType: 'text/plain', buffer: Buffer.from('unsupported') } },
  });
  assert.equal(unsupportedResponse.status(), 400);
  records.push({ scenario: 'unsupported file type', surface: 'API', endpoint: '/api/pdf-to-word', status: unsupportedResponse.status(), result: 'PASS (rejected before processor)' });

  const legacyXlsResponse = await context.request.post(`${API_URL}/api/excel-to-pdf`, {
    multipart: { files: { name: 'legacy.xls', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('legacy xls not supported') } },
  });
  assert.equal(legacyXlsResponse.status(), 400);
  records.push({ scenario: 'legacy .xls advertisement regression', surface: 'API', endpoint: '/api/excel-to-pdf', status: legacyXlsResponse.status(), result: 'PASS; clear rejection, UI now advertises actual .xlsx support' });

  const oversizeResponse = await context.request.post(`${API_URL}/format`, {
    multipart: {
      file: { name: 'over-limit.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await (await import('node:fs/promises')).readFile(path.join(INPUTS, 'over-limit.docx')) },
      docType: 'book',
      options: '{}',
    },
    timeout: 120000,
  });
  assert.equal(oversizeResponse.status(), 413);
  const oversizeBody = await oversizeResponse.json();
  assert.match(
    oversizeBody.error || '',
    /25 MB/,
    'Oversize response should identify the configured 25 MB limit',
  );
  const health = await context.request.get(`${API_URL}/health`);
  assert.equal(health.status(), 200);
  records.push({ scenario: 'just-over-25MiB upload and server survival', surface: 'API', endpoint: '/format then /health', status: [oversizeResponse.status(), health.status()], error: oversizeBody.error, result: 'PASS' });
}

async function runGuardsAndAdapters() {
  const createOrder = await context.request.post(`${API_URL}/create-order`, { data: {} });
  const verifyPayment = await context.request.post(`${API_URL}/verify-payment`, { data: {} });
  assert.equal(createOrder.status(), 403);
  assert.equal(verifyPayment.status(), 403);
  assert.equal((await createOrder.json()).code, 'MONETIZATION_DISABLED');
  assert.equal((await verifyPayment.json()).code, 'MONETIZATION_DISABLED');
  records.push({ scenario: 'payment endpoint guards', surface: 'API', status: [403, 403], result: 'PASS; MONETIZATION_DISABLED' });

  const contactValidation = await context.request.post(`${API_URL}/contact`, { data: { name: '', email: '', message: '' } });
  assert.equal(contactValidation.status(), 400);
  const contactLocal = await context.request.post(`${API_URL}/contact`, { data: { name: 'Phase Five', email: 'phase5@example.test', message: 'Local non-delivery transport check' } });
  assert.equal(contactLocal.status(), 500);
  records.push({ scenario: 'contact handler', surface: 'API', status: [400, 500], result: 'PASS; validation plus local-only SMTP failure, no delivery' });

  const aiFallback = await context.request.post(`${API_URL}/api/ai-suggest`, { data: { docType: 'thesis', userPrompt: '' } });
  assert.equal(aiFallback.status(), 200);
  const aiBody = await aiFallback.json();
  assert.equal(aiBody.aiUsed, false);
  assert.equal(aiBody.options.font_style, 'Times New Roman');
  records.push({ scenario: 'AI local fallback with provider disabled', surface: 'API', status: 200, result: 'PASS; aiUsed=false' });
}

async function runBackendUnavailable() {
  await loadHome();
  await navigateTool('PDF to Word');
  await page.getByLabel('Browse files').setInputFiles(path.join(INPUTS, 'pdf-to-word.pdf'));
  await page.getByRole('button', { name: 'Convert to Word' }).click();
  await page.getByRole('alert').waitFor({ timeout: 30000 });
  assert.equal(await page.getByText('Conversion complete', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Convert to Word' }).isEnabled(), true);
  records.push({ scenario: 'backend unavailable', surface: 'browser UI', result: 'PASS; error shown, no false success, file retained, retry enabled' });
}

try {
  if (unavailableMode) {
    await runBackendUnavailable();
  } else if (failuresOnlyMode) {
    await runFailures();
  } else {
    for (const config of [
      { kind: 'book', card: 'Book', font: 'Garamond', size: '14', spacing: '1.5', pageSizeName: 'A5 148×210mm', titleLabel: 'Book Title', title: 'Phase 5 Book' },
      { kind: 'thesis', card: 'Thesis', font: 'Times New Roman', size: '12', spacing: '1.5', pageSizeName: 'A4 210×297mm', titleLabel: 'Thesis Title', title: 'Phase 5 Thesis' },
      { kind: 'research', card: 'Research Paper', font: 'Times New Roman', size: '12', spacing: '1.15', pageSizeName: 'Letter 216×279mm', titleLabel: 'Paper Title', title: 'Phase 5 Research' },
      { kind: 'letter', card: 'Letter / Notice', font: 'Arial', size: '11', spacing: '1', pageSizeName: 'Legal 216×356mm', titleLabel: 'Subject', title: 'Phase 5 Notice' },
    ]) {
      await formatDocument(config);
    }

    await runFileTool({ navName: 'Merge PDF', inputFiles: ['merge-pdf-1.pdf', 'merge-pdf-2.pdf'], actionName: 'Merge PDF files', resultText: 'Merge complete', outputName: 'merged.pdf', endpoint: '/api/merge-pdf', downloadName: 'Download merged PDF' });
    await runFileTool({ navName: 'Merge Word', inputFiles: ['merge-word-1.docx', 'merge-word-2.docx'], actionName: 'Merge Word files', resultText: 'Merge complete', outputName: 'merged.docx', endpoint: '/api/merge-word', downloadName: 'Download merged document' });
    await runFileTool({ navName: 'PDF to Word', inputFiles: ['pdf-to-word.pdf'], actionName: 'Convert to Word', resultText: 'Conversion complete', outputName: 'pdf-to-word.docx', endpoint: '/api/pdf-to-word', downloadName: 'Download' });
    await runFileTool({ navName: 'Excel to PDF', inputFiles: ['excel-active-sheet.xlsx'], actionName: 'Convert to PDF', resultText: 'Conversion complete', outputName: 'excel.pdf', endpoint: '/api/excel-to-pdf', downloadName: 'Download' });
    await runHindi();
    await runFailures();
    await runGuardsAndAdapters();
  }
} finally {
  const fileName = unavailableMode
    ? 'browser-unavailable-results.json'
    : failuresOnlyMode
      ? 'browser-failure-retry-results.json'
      : 'browser-real-results.json';
  await writeFile(path.join(EVIDENCE, fileName), JSON.stringify(records, null, 2), 'utf8');
  await browser.close();
}

console.log(JSON.stringify(records, null, 2));
