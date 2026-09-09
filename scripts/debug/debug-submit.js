const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false });
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

  // Click first draft
  await page.locator('tbody tr, [role="row"]').first().click();
  await page.waitForTimeout(1500);

  // Click Resume Editing
  const resumeBtn = page.locator('button:has-text("Resume Editing")');
  if (await resumeBtn.isVisible()) {
    await resumeBtn.click();
    await page.waitForTimeout(1500);
  }

  // Click Save & continue through steps until Step 8
  for (let i = 0; i < 7; i++) {
    const saveBtn = page.locator('button:has-text("Save & continue")');
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(2000);
    }
  }

  // We are on Step 8. Take screenshot before click
  await page.screenshot({ path: 'step8-before-submit.png' });
  console.log('Clicking Submit for review...');
  await page.click('button:has-text("Submit for review")');
  await page.waitForTimeout(1500);

  // Take screenshot after click
  await page.screenshot({ path: 'step8-after-submit.png' });

  // Log visible text on screen
  const dialogText = await page.locator('[role="dialog"], .MuiDialog-root, .MuiSnackbar-root').allInnerTexts();
  console.log('Dialog / Toast text:', dialogText);

  await browser.close();
})();
