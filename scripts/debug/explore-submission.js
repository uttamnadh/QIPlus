const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Login as Sukesh
  await page.goto('https://idms-uat.qiplus.ae/login');
  await page.fill('input[name="username"]', 'Sukesh');
  await page.fill('input[name="password"]', 'Qa@12345');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  // Go to Drafts
  await page.click('text="Drafts"');
  await page.waitForTimeout(1000);

  // Print all drafts listed
  const draftRows = await page.locator('tbody tr, [role="row"]').allInnerTexts();
  console.log('--- Current Drafts ---');
  console.log(draftRows.slice(0, 5).join('\n'));

  // Go to Submitted
  await page.click('text="Submitted"');
  await page.waitForTimeout(1000);
  const submittedRows = await page.locator('tbody tr, [role="row"]').allInnerTexts();
  console.log('--- Current Submitted ---');
  console.log(submittedRows.slice(0, 5).join('\n'));

  await browser.close();
})();
