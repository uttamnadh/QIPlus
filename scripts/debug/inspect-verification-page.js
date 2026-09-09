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

  // Go to direct merchant verification page for 2026000735
  await page.goto('https://idms-uat.qiplus.ae/verifications/80a0735a-e2dd-473d-a4dc-e7df5341560e');
  await page.waitForTimeout(2000);

  // Log all inputs, textareas, buttons, checkboxes
  console.log('Inputs count:', await page.locator('input').count());
  console.log('Textareas count:', await page.locator('textarea').count());
  console.log('Buttons count:', await page.locator('button').count());

  const buttons = await page.locator('button').allInnerTexts();
  console.log('Button innerTexts:', buttons);

  const textareas = await page.locator('textarea').all();
  for (let i = 0; i < textareas.length; i++) {
    console.log(`Textarea ${i} placeholder:`, await textareas[i].getAttribute('placeholder'));
  }

  // Take full page screenshot
  await page.screenshot({ path: 'verification-full-page.png', fullPage: true });

  await browser.close();
})();
