const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login Sukesh
  await page.goto('https://idms-uat.qiplus.ae/login');
  await page.fill('input[name="username"]', 'Sukesh');
  await page.fill('input[name="password"]', 'Qa@12345');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  await page.click('text="Create merchant"');
  await page.waitForTimeout(2000);

  const rootText = await page.locator('#root').innerText();
  console.log('--- ROOT TEXT ON /merchants/new ---');
  console.log(rootText);

  const inputs = await page.locator('input, select, textarea, button').all();
  console.log('--- FORM ELEMENTS ---');
  for (const input of inputs) {
    const tag = await input.evaluate(el => el.tagName);
    const type = await input.getAttribute('type') || '';
    const name = await input.getAttribute('name') || '';
    const id = await input.getAttribute('id') || '';
    const text = await input.innerText() || '';
    const placeholder = await input.getAttribute('placeholder') || '';
    const ariaLabel = await input.getAttribute('aria-label') || '';
    console.log(`Tag: ${tag} | type: ${type} | name: ${name} | id: ${id} | text: ${text.trim()} | placeholder: ${placeholder} | ariaLabel: ${ariaLabel}`);
  }

  await browser.close();
})();
