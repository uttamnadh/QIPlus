const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: 'https://idms-uat.qiplus.ae' });
  const page = await context.newPage();

  page.on('requestfailed', req => {
    console.log(`[REQ FAILED] ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  });

  page.on('response', async res => {
    if (res.url().includes('document') || res.url().includes('upload') || res.url().includes('file') || res.status() >= 400) {
      const text = await res.text().catch(() => '');
      console.log(`[RES ${res.status()}] ${res.method()} ${res.url()}`);
      if (text.length < 500) console.log(`  Body: ${text}`);
      else console.log(`  Body (first 200): ${text.slice(0, 200)}...`);
    }
  });

  console.log('1. Logging in as Sukesh...');
  await page.goto('/login');
  await page.fill('input[name="username"]', 'Sukesh');
  await page.fill('input[name="password"]', 'Qa@12345');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  console.log('2. Creating new merchant registration...');
  await page.goto('/merchants/new');
  await page.waitForTimeout(2000);

  // Quick fill Step 1 to 6
  // Or navigate directly or use existing draft
  // Let's create a minimal fresh record
  const rnd = Math.floor(1000 + Math.random() * 9000);
  const tradeName = `UploadTest Enterprise ${rnd}`;
  const trn = `100${Math.floor(100000000000 + Math.random() * 900000000000)}`;

  console.log('Filling Step 1...');
  await page.fill('input[name="tradeName"]', tradeName);
  await page.fill('input[name="legalName"]', `${tradeName} LLC`);
  await page.fill('input[name="trn"]', '100713432116983');
  await page.fill('input[name="primaryContactEmail"]', 'upload@test.ae');
  await page.fill('input[name="primaryContactPhone"]', '501234567');
  await page.fill('input[name="licenceNumber"]', `TL${rnd}`);
  await page.fill('input[name="tradeLicenceExpiryDate"]', '2027-12-31');
  await page.click('div[role="combobox"]').catch(() => {});
  // Select legal form
  await page.click('label:has-text("Legal Form"), [id*="legalForm"], div[role="combobox"]').catch(() => {});
  const option = page.locator('[role="listbox"] [role="option"]').first();
  if (await option.isVisible({ timeout: 1000 }).catch(() => false)) await option.click();

  // Let's use the actual Step classes or run test with Playwright
  await browser.close();
})();
