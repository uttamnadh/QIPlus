const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: 'https://idms-uat.qiplus.ae' });
  const page = await context.newPage();

  page.on('response', async res => {
    if (res.url().includes('document') || res.url().includes('upload') || res.status() >= 400) {
      const text = await res.text().catch(() => '');
      console.log(`[API ${res.status()}] ${res.method()} ${res.url()}`);
      if (text.length < 500) console.log(`  Body: ${text}`);
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('error') || msg.text().includes('upload')) {
      console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
    }
  });

  console.log('1. Logging in as Sukesh...');
  await page.goto('/login');
  await page.fill('input[name="username"]', 'Sukesh');
  await page.fill('input[name="password"]', 'Qa@12345');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  console.log('2. Opening New Registration...');
  await page.goto('/merchants/new');
  await page.waitForTimeout(2000);

  // Quick fill Steps 1 to 6 using Playwright
  console.log('Filling Step 1...');
  const rnd = Math.floor(1000 + Math.random() * 9000);
  await page.fill('input[name="tradeName"]', `Inspection Test ${rnd}`);
  await page.fill('input[name="legalName"]', `Inspection Test ${rnd} LLC`);
  await page.fill('input[name="trn"]', '100713432116983');
  await page.fill('input[name="primaryContactEmail"]', 'test@inspection.ae');
  await page.fill('input[name="primaryContactPhone"]', '501234567');
  await page.fill('input[name="licenceNumber"]', `TL${rnd}`);
  await page.fill('input[name="tradeLicenceExpiryDate"]', '2027-12-31');

  // Select legal form
  const legalFormBox = page.locator('div[role="combobox"]').first();
  await legalFormBox.click();
  await page.locator('[role="listbox"] [role="option"]').first().click();

  await page.click('button:has-text("Save & continue")');
  await page.waitForTimeout(1000);

  console.log('Filling Step 2...');
  await page.fill('input[name="expectedMonthlyVolumeAed"]', '150000');
  await page.fill('input[name="expectedMonthlyTransactionsCount"]', '500');
  await page.fill('input[name="averageTransactionValueAed"]', '300');
  await page.fill('input[name="yearsInOperation"]', '5');
  await page.fill('textarea[name="primaryProductsServices"]', 'General trading services');
  await page.click('button:has-text("Save & continue")');
  await page.waitForTimeout(1000);

  console.log('Filling Step 3...');
  await page.fill('input[name*="shareholders[0].name"], input[name*="fullName"]', 'Ahmed Al Mansoori');
  await page.fill('input[name*="percentage"], input[name*="shareholding"]', '100');
  await page.click('button:has-text("Save & continue")');
  await page.waitForTimeout(1500);

  console.log('Filling Step 4...');
  await page.click('button:has-text("Save & continue")');
  await page.waitForTimeout(1000);

  console.log('Filling Step 5...');
  await page.click('button:has-text("Save & continue")');
  await page.waitForTimeout(1000);

  console.log('Filling Step 6...');
  await page.fill('input[name*="accountNumber"]', '123456789012345');
  await page.fill('input[name*="iban"]', 'AE070331234567890123456');
  await page.fill('input[name*="accountHolderName"]', `Inspection Test ${rnd} LLC`);
  await page.click('button:has-text("Save & continue")');
  await page.waitForTimeout(2000);

  console.log('--- ARRIVED ON STEP 7 ---');
  console.log('Current URL on Step 7:', page.url());

  // Inspect all cards, file inputs, texts on Step 7
  const cards = await page.locator('.MuiCard-root, .MuiPaper-root, .MuiAccordion-root').all();
  console.log(`Found ${cards.length} total card/paper elements.`);

  const fileInputs = await page.locator('input[type="file"]').all();
  console.log(`Found ${fileInputs.length} total input[type="file"] elements.`);

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const text = (await card.innerText()).replace(/\n+/g, ' | ');
    const hasInput = await card.locator('input[type="file"]').count();
    console.log(`Card ${i + 1} (hasInput=${hasInput}): ${text.slice(0, 120)}`);
  }

  // Take screenshot of initial Step 7
  await page.screenshot({ path: 'test-results/step7-initial.png', fullPage: true });
  console.log('Screenshot saved to test-results/step7-initial.png');

  // Test uploading dummy_1.png to each input[type="file"]
  const dummyFile = path.resolve(__dirname, '../../fixtures/dummy_1.png');
  for (let i = 0; i < fileInputs.length; i++) {
    console.log(`Uploading to file input ${i + 1} of ${fileInputs.length}...`);
    await fileInputs[i].setInputFiles(dummyFile);
    await page.waitForTimeout(1500);
  }

  await page.screenshot({ path: 'test-results/step7-after-upload.png', fullPage: true });
  console.log('Screenshot saved to test-results/step7-after-upload.png');

  // Check Save & continue button state
  const saveBtn = page.locator('button:has-text("Save & continue")');
  console.log('Save & continue isEnabled:', await saveBtn.isEnabled());

  await browser.close();
})();
