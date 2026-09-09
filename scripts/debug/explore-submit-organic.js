const { chromium } = require('@playwright/test');
const { Step1ProfilePage } = require('./dist/pages/wizard/step1-profile.page');
const { Step2BusinessPage } = require('./dist/pages/wizard/step2-business.page');
const { Step3OwnershipPage } = require('./dist/pages/wizard/step3-ownership.page');
const { Step4UBOsPage } = require('./dist/pages/wizard/step4-ubos.page');
const { Step5SignatoriesPage } = require('./dist/pages/wizard/step5-signatories.page');
const { Step6BankingPage } = require('./dist/pages/wizard/step6-banking.page');
const { Step7DocumentsPage } = require('./dist/pages/wizard/step7-documents.page');
const { Step8ReviewPage } = require('./dist/pages/wizard/step8-review.page');
const { MERCHANT } = require('./dist/fixtures/merchant-data');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('response', async res => {
    if (res.url().includes('/submit') || (res.url().includes('/merchants') && res.request().method() === 'POST')) {
      console.log(`[NETWORK SUBMIT] ${res.status()} ${res.url()}`);
      try {
        const text = await res.text();
        console.log(`[RESPONSE BODY] ${text.substring(0, 300)}`);
      } catch {}
    }
  });

  // Login
  await page.goto('https://idms-uat.qiplus.ae/login');
  await page.fill('input[name="username"]', 'Sukesh');
  await page.fill('input[name="password"]', 'Qa@12345');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  // Create new merchant
  await page.click('button:has-text("Create merchant")');
  await page.waitForTimeout(1000);

  const step1 = new Step1ProfilePage(page);
  await step1.fillAll(MERCHANT);
  const mrn = await step1.getRegistrationNumber();
  console.log('Generated MRN:', mrn);
  await step1.clickSaveAndContinue();
  await page.waitForTimeout(2000);

  const step2 = new Step2BusinessPage(page);
  await step2.fillAll(MERCHANT.business);
  await step2.clickSaveAndContinue();
  await page.waitForTimeout(2000);

  const step3 = new Step3OwnershipPage(page);
  await step3.fillShareholder(0, MERCHANT.shareholders[0]);
  await step3.clickSaveAndContinue();
  await page.waitForTimeout(2000);

  const step4 = new Step4UBOsPage(page);
  await step4.fillUBO(0, MERCHANT.ubos[0]);
  await step4.clickSaveAndContinue();
  await page.waitForTimeout(2000);

  const step5 = new Step5SignatoriesPage(page);
  await step5.fillSignatory(0, MERCHANT.signatories[0]);
  await step5.clickSaveAndContinue();
  await page.waitForTimeout(2000);

  const step6 = new Step6BankingPage(page);
  await step6.fillAll(MERCHANT.banking);
  await step6.clickSaveAndContinue();
  await page.waitForTimeout(2000);

  const step7 = new Step7DocumentsPage(page);
  const fixturesDir = path.resolve(__dirname, 'fixtures');
  await step7.uploadAllDummyDocuments(fixturesDir);
  await step7.clickSaveAndContinue();
  await page.waitForTimeout(2000);

  const step8 = new Step8ReviewPage(page);
  console.log('On Step 8, clicking Submit for review...');
  await page.click('button:has-text("Submit for review")');
  await page.waitForTimeout(2000);

  // Check if dialog appeared
  const dialog = page.locator('[role="dialog"], .MuiDialog-root');
  if (await dialog.isVisible()) {
    console.log('Modal visible! Content:', await dialog.innerText());
    const confirmBtn = dialog.locator('button').filter({ hasNotText: 'Cancel' }).last();
    await confirmBtn.click();
    await page.waitForTimeout(2000);
  }

  // Check toast or current page url
  console.log('Current URL after submit:', page.url());
  const toast = page.locator('.MuiSnackbar-root, [role="alert"]');
  if (await toast.isVisible().catch(() => false)) {
    console.log('Toast after submit:', await toast.innerText());
  }

  await browser.close();
})();
