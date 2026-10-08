const { chromium } = require('@playwright/test');

async function testAuditor() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleLogs = [];
  const networkErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    }
  });

  page.on('response', resp => {
    if (resp.status() >= 400) {
      networkErrors.push({ url: resp.url(), status: resp.status() });
    }
  });

  console.log('Navigating to login...');
  await page.goto('https://idms-uat.qiplus.ae/login', { waitUntil: 'domcontentloaded' });

  await page.fill('input[name="username"]', 'auditor');
  await page.fill('input[name="password"]', 'Passw0rd!');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(3000);
  console.log('Current URL after auditor login:', page.url());

  // Capture sidebar items and navigation elements
  const sidebarItems = await page.locator('nav, aside, .MuiDrawer-root, [role="navigation"]').first().innerText().catch(() => 'No sidebar');
  console.log('\n--- AUDITOR SIDEBAR TEXT ---');
  console.log(sidebarItems);

  // Capture all links and buttons
  const links = await page.$$eval('a', els => els.map(e => ({ text: e.innerText.trim(), href: e.href })));
  console.log('\n--- AUDITOR LINKS ---');
  console.log(JSON.stringify(links, null, 2));

  // Capture all buttons
  const buttons = await page.$$eval('button', els => els.map(e => e.innerText.trim()).filter(Boolean));
  console.log('\n--- AUDITOR BUTTONS ---');
  console.log(buttons);

  // Take screenshot of landing page
  await page.screenshot({ path: 'test-results/auditor-landing.png', fullPage: true });

  console.log('\n--- CONSOLE LOGS ---');
  console.log(consoleLogs);

  console.log('\n--- NETWORK ERRORS ---');
  console.log(networkErrors);

  await browser.close();
}

testAuditor().catch(console.error);
