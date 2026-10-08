const { chromium } = require('@playwright/test');
const fs = require('fs');

async function exploreAuditorLogs() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleLogs = [];
  const networkRequests = [];
  const networkErrors = [];

  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  page.on('response', async resp => {
    const status = resp.status();
    const url = resp.url();
    networkRequests.push({ url, status, method: resp.request().method() });
    if (status >= 400) {
      let body = '';
      try { body = await resp.text(); } catch {}
      networkErrors.push({ url, status, body: body.slice(0, 500) });
    }
  });

  console.log('Logging in as Auditor...');
  await page.goto('https://idms-uat.qiplus.ae/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="username"]', 'auditor');
  await page.fill('input[name="password"]', 'Passw0rd!');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/dashboard', { timeout: 10000 });
  console.log('Auditor Dashboard loaded.');

  // 1. Click on "Audit logs"
  console.log('Clicking "Audit logs" in sidebar...');
  const auditLogsLink = page.locator('text="Audit logs"').first();
  await auditLogsLink.click();
  await page.waitForTimeout(3000);

  console.log('Current URL on Audit logs:', page.url());
  await page.screenshot({ path: 'test-results/auditor-audit-logs.png', fullPage: true });

  // Get Page Title / Headers
  const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', els => els.map(e => e.innerText.trim()));
  console.log('Headings:', headings);

  // Get all buttons on the Audit logs page
  const auditButtons = await page.$$eval('button', els => els.map(e => ({
    text: e.innerText.trim(),
    ariaLabel: e.getAttribute('aria-label'),
    disabled: e.disabled
  })));
  console.log('Audit logs buttons:', auditButtons);

  // Get table headers / columns
  const tableHeaders = await page.$$eval('th, [role="columnheader"]', els => els.map(e => e.innerText.trim()));
  console.log('Table Headers:', tableHeaders);

  // Get row count & sample row data
  const rowCount = await page.locator('tbody tr, [role="row"]').count();
  console.log('Total Rows visible:', rowCount);
  const sampleRows = await page.$$eval('tbody tr', rows => rows.slice(0, 5).map(r => r.innerText.replace(/\s+/g, ' ').trim()));
  console.log('Sample Rows:', sampleRows);

  // Check inputs / filters / search
  const inputs = await page.$$eval('input, select, [role="combobox"]', els => els.map(e => ({
    name: e.name,
    placeholder: e.placeholder,
    type: e.type,
    ariaLabel: e.getAttribute('aria-label'),
    value: e.value
  })));
  console.log('Inputs / Filters on Audit logs:', inputs);

  // 2. Click on "Merchant search"
  console.log('\nNavigating to "Merchant search"...');
  const merchantSearchLink = page.locator('text="Merchant search"').first();
  await merchantSearchLink.click();
  await page.waitForTimeout(3000);
  console.log('Current URL on Merchant search:', page.url());
  await page.screenshot({ path: 'test-results/auditor-merchant-search.png', fullPage: true });

  const searchHeadings = await page.$$eval('h1, h2, h3, h4', els => els.map(e => e.innerText.trim()));
  console.log('Merchant Search Headings:', searchHeadings);

  const searchInputs = await page.$$eval('input', els => els.map(e => ({ placeholder: e.placeholder, name: e.name, value: e.value })));
  console.log('Merchant Search Inputs:', searchInputs);

  const searchButtons = await page.$$eval('button', els => els.map(e => e.innerText.trim()).filter(Boolean));
  console.log('Merchant Search Buttons:', searchButtons);

  // Check network errors so far
  console.log('\n--- NETWORK ERRORS ---');
  console.log(JSON.stringify(networkErrors, null, 2));

  console.log('\n--- CONSOLE ERRORS & WARNINGS ---');
  console.log(consoleLogs.filter(l => l.type === 'error'));

  await browser.close();
}

exploreAuditorLogs().catch(console.error);
