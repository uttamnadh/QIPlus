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
  await page.waitForTimeout(1500);

  // Filter or click first row
  const firstRow = page.locator('tbody tr, [role="row"]').first();
  if (await firstRow.isVisible()) {
    await firstRow.click();
    await page.waitForTimeout(2000);
  }

  // Check decision notes textarea
  const textarea = page.locator('textarea').first();
  console.log('Textarea count:', await page.locator('textarea').count());
  if (await textarea.isVisible()) {
    await textarea.click();
    await textarea.fill('Approved by compliance officer after thorough review.');
    await page.waitForTimeout(500);
    // Also trigger input event
    await textarea.dispatchEvent('input');
    await page.waitForTimeout(500);
  }

  const approveBtn = page.locator('button:has-text("Approve & forward"), button:has-text("Approve")').first();
  console.log('Approve button visible:', await approveBtn.isVisible());
  console.log('Approve button enabled:', await approveBtn.isEnabled());

  // Take screenshot
  await page.screenshot({ path: 'compliance-decision-filled.png' });

  await browser.close();
})();
