const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://idms-uat.qiplus.ae/login');
  await page.fill('input[name="username"]', 'Sukesh');
  await page.fill('input[name="password"]', 'Qa@12345');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  await page.click('text="Create merchant"');
  await page.waitForTimeout(2000);

  const inspectSelect = async (inputName, label) => {
    console.log(`=== OPTIONS FOR ${label} (${inputName}) ===`);
    const input = page.locator(`input[name="${inputName}"]`);
    await input.locator('..').click();
    await page.waitForTimeout(500);
    const options = await page.locator('[role="option"], li').allInnerTexts();
    console.log(options);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  };

  await inspectSelect('profile.legalForm', 'Legal Form');
  await inspectSelect('registeredAddress.emirateCity', 'Emirate / City');
  await inspectSelect('licence.licensingAuthority', 'Licensing Authority');
  await inspectSelect('licence.jurisdiction', 'Jurisdiction');

  await browser.close();
})();
