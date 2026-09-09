const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('response', async res => {
    if (res.url().includes('/submit') || res.url().includes('/merchants')) {
      console.log(`[NETWORK] ${res.request().method()} ${res.status()} ${res.url()}`);
      try {
        const text = await res.text();
        console.log(`[BODY] ${text.substring(0, 300)}`);
      } catch {}
    }
  });

  // Login as Sukesh
  await page.goto('https://idms-uat.qiplus.ae/login');
  await page.fill('input[name="username"]', 'Sukesh');
  await page.fill('input[name="password"]', 'Qa@12345');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  // Go to Drafts and open last draft
  await page.click('text="Drafts"');
  await page.waitForTimeout(1500);

  const firstDraftRow = page.locator('tbody tr, [role="row"]').first();
  await firstDraftRow.click();
  await page.waitForTimeout(1500);

  const resumeBtn = page.locator('button:has-text("Resume Editing")');
  if (await resumeBtn.isVisible()) {
    await resumeBtn.click();
    await page.waitForTimeout(1500);
  }

  // Jump to Step 8
  await page.locator('text="Review"').click().catch(() => {});
  await page.waitForTimeout(1500);

  console.log('Current URL on Step 8:', page.url());
  console.log('Clicking Submit for review button...');
  const btn = page.locator('button:has-text("Submit for review")');
  console.log('Submit button isEnabled:', await btn.isEnabled());
  await btn.click();
  await page.waitForTimeout(3000);

  const dialog = page.locator('[role="dialog"], .MuiDialog-root');
  if (await dialog.isVisible()) {
    console.log('Dialog text:', await dialog.innerText());
    const confirmBtn = dialog.locator('button').filter({ hasNotText: 'Cancel' }).last();
    console.log('Clicking confirm button in dialog...');
    await confirmBtn.click();
    await page.waitForTimeout(3000);
  }

  const toasts = await page.locator('.MuiSnackbar-root, [role="alert"]').allInnerTexts();
  console.log('Toasts after submit:', toasts);

  await browser.close();
})();
