const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Login as Bhanu (Compliance officer)
  await page.goto('https://idms-uat.qiplus.ae/login');
  await page.fill('input[name="username"]', 'bhanu');
  await page.fill('input[name="password"]', 'Qa@123456789');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  // Go to Verification queue
  await page.goto('https://idms-uat.qiplus.ae/verifications');
  await page.waitForTimeout(2000);

  // Take screenshot & log table rows
  await page.screenshot({ path: 'compliance-queue-rows.png' });
  const rows = await page.locator('tbody tr, [role="row"]').allInnerTexts();
  console.log('Compliance queue rows:', rows);

  await browser.close();
})();
