const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Listen for console and network
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('response', async res => {
    if (res.url().includes('/api') || res.status() >= 400) {
      console.log(`API RESPONSE: ${res.status()} ${res.url()}`);
      try {
        const text = await res.text();
        console.log(`API BODY: ${text}`);
      } catch {}
    }
  });

  // Login as Sukesh
  await page.goto('https://idms-uat.qiplus.ae/login');
  await page.fill('input[name="username"]', 'Sukesh');
  await page.fill('input[name="password"]', 'Qa@12345');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  // Go to Drafts and open 2026000713
  await page.click('text="Drafts"');
  await page.waitForTimeout(1000);
  await page.click('text="2026000713"');
  await page.waitForTimeout(1500);

  // Click Resume Editing
  await page.click('button:has-text("Resume Editing")');
  await page.waitForTimeout(2000);

  // Click Step 8 (Review) in step bar
  await page.click('text="Review"');
  await page.waitForTimeout(2000);

  // Click Submit for review
  console.log('Clicking Submit for review...');
  await page.click('button:has-text("Submit for review")');
  await page.waitForTimeout(2000);

  // Check if modal or alert is visible
  const dialogs = await page.locator('[role="dialog"], .MuiDialog-root, .MuiAlert-root, [role="alert"]').allInnerTexts();
  console.log('--- Dialogs / Alerts visible ---');
  console.log(dialogs);

  await browser.close();
})();
