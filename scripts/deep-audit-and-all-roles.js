const { chromium } = require('@playwright/test');
const crypto = require('crypto');

function base32Decode(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) throw new Error(`Invalid Base32 character: ${clean[i]}`);
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTOTP(secret, timeStepSeconds = 30, digits = 6) {
  if (!secret) return '';
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / timeStepSeconds);
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(timeBuffer);
  const hmacResult = hmac.digest();
  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const binary =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);
  const otp = (binary % Math.pow(10, digits)).toString();
  return otp.padStart(digits, '0');
}

async function runDeepAudit() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const networkErrors = [];
  page.on('response', async resp => {
    if (resp.status() >= 400) {
      let body = '';
      try { body = await resp.text(); } catch {}
      networkErrors.push({ url: resp.url(), status: resp.status(), body: body.slice(0, 300) });
    }
  });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // ─────────────────────────────────────────────────────────────
  // 1. AUDITOR DEEP DIVE
  // ─────────────────────────────────────────────────────────────
  console.log('=== 1. AUDITOR ROLE TESTING ===');
  await page.goto('https://idms-uat.qiplus.ae/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="username"]', 'auditor');
  await page.fill('input[name="password"]', 'Passw0rd!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });

  // A. Audit logs page
  await page.goto('https://idms-uat.qiplus.ae/audit/logs', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Check 1: Click "See field change logs" button (icon in row)
  const fieldLogBtn = page.locator('button[aria-label*="See field change logs"], button[aria-label*="field change"]').first();
  if (await fieldLogBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Clicking "See field change logs" button...');
    await fieldLogBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/audit-field-change-modal.png' });
    const modalText = await page.locator('.MuiDialog-root, [role="dialog"]').innerText().catch(() => 'No modal');
    console.log('Field Change Modal Content:\n', modalText);
    const closeBtn = page.locator('.MuiDialog-root button:has-text("Close"), [role="dialog"] button').first();
    await closeBtn.click().catch(() => page.keyboard.press('Escape'));
    await page.waitForTimeout(500);
  } else {
    console.log('No "See field change logs" button found or visible');
  }

  // Check 2: Date boundary bug test - Set From Date > To Date
  console.log('Testing Date Boundary: From Date > To Date...');
  const fromDateInp = page.locator('label:has-text("From date"), div:has-text("From date")').locator('..').locator('input').first();
  const toDateInp = page.locator('label:has-text("To date"), div:has-text("To date")').locator('..').locator('input').first();
  if (await fromDateInp.isVisible() && await toDateInp.isVisible()) {
    await fromDateInp.fill('29/09/2026');
    await toDateInp.fill('20/09/2026');
    const searchBtn = page.locator('button:has-text("Search")');
    await searchBtn.click();
    await page.waitForTimeout(1500);
    const alertError = await page.locator('.Mui-error, [role="alert"]').allInnerTexts().catch(() => []);
    console.log('Date boundary validation errors:', alertError);
    await page.screenshot({ path: 'test-results/audit-date-boundary-result.png' });
  }

  // Check 3: SQLi / XSS in MRN filter
  console.log('Testing MRN filter with XSS / injection payload...');
  const mrnInp = page.locator('input[placeholder="Any merchant"], input[name*="mrn" i]').first();
  if (await mrnInp.isVisible().catch(() => false)) {
    await mrnInp.fill('<script>alert("XSS")</script>');
    await page.locator('button:has-text("Search")').click();
    await page.waitForTimeout(1500);
    console.log('MRN search with XSS executed. Page URL:', page.url());
  }

  // Check 4: Check if "Reset" button works
  console.log('Testing Reset button...');
  const resetBtn = page.locator('button:has-text("Reset")');
  const isResetEnabled = await resetBtn.isEnabled().catch(() => false);
  console.log('Is Reset button enabled after filling filters?', isResetEnabled);
  if (isResetEnabled) {
    await resetBtn.click();
    await page.waitForTimeout(1000);
    console.log('Clicked Reset.');
  }

  // Check 5: Check Table Horizontal Scrolling / Column Cutoff
  const isTableOverflowing = await page.evaluate(() => {
    const tableContainer = document.querySelector('.MuiTableContainer-root, table');
    if (!tableContainer) return false;
    return tableContainer.scrollWidth > tableContainer.clientWidth;
  });
  console.log('Is Audit Table Horizontally Overflowing / Clipped?', isTableOverflowing);

  // Check 6: Row click in Merchant Search
  console.log('\nNavigating to Merchant Search to test row click and export...');
  await page.goto('https://idms-uat.qiplus.ae/merchants/search', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Test Export to Excel button
  console.log('Testing Export to Excel button...');
  const exportBtn = page.locator('button:has-text("Export to Excel")');
  if (await exportBtn.isVisible().catch(() => false)) {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 4000 }).catch(() => null),
      exportBtn.click().catch(() => {})
    ]);
    if (download) {
      console.log('Export succeeded! File suggested name:', download.suggestedFilename());
    } else {
      console.log('Export did NOT trigger a browser download event!');
    }
  }

  // Test clicking a merchant row in search
  const firstMerchantRow = page.locator('tbody tr').first();
  if (await firstMerchantRow.isVisible().catch(() => false)) {
    const rowText = await firstMerchantRow.innerText();
    console.log('Clicking merchant row:', rowText.replace(/\s+/g, ' ').slice(0, 80));
    await firstMerchantRow.click();
    await page.waitForTimeout(2000);
    console.log('URL after clicking row:', page.url());
    await page.screenshot({ path: 'test-results/auditor-merchant-row-click.png' });
  }

  // Sign out auditor
  const signOutBtn = page.locator('button:has-text("Sign out")').first();
  await signOutBtn.click({ force: true }).catch(() => {});
  await page.waitForURL('**/login', { timeout: 5000 }).catch(() => {});

  // ─────────────────────────────────────────────────────────────
  // 2. RBAC TEST ON /audit/logs FOR OTHER 4 ROLES
  // ─────────────────────────────────────────────────────────────
  const rolesToTest = [
    { name: 'onboarding', user: 'Sukesh', pass: 'Qa@12345', totp: '' },
    { name: 'compliance', user: 'bhanu', pass: 'Qa@123456789', totp: 'O5JK3K56FHMKGX67KMQAS65YSXXTAAT4' },
    { name: 'approver', user: 'uttamnadh', pass: 'Qa@123456789', totp: 'H2SG6MBNDHY4OFPOYBB2WHVGTZAMYT23' },
    { name: 'admin', user: 'shankar', pass: 'Passw0rd!', totp: 'CUZN3ZAJKZPNBMQRK5LD33D3YVWE6K7N' },
  ];

  for (const r of rolesToTest) {
    console.log(`\n=== Testing RBAC & Features for: ${r.name.toUpperCase()} (${r.user}) ===`);
    await page.goto('https://idms-uat.qiplus.ae/login', { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="username"]', r.user);
    await page.fill('input[name="password"]', r.pass);
    await page.click('button[type="submit"]');

    if (r.totp) {
      const digitInput = page.locator('input[aria-label*="Digit 1"], input[aria-label*="Digit"]').first();
      if (await digitInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        const otp = generateTOTP(r.totp);
        const digits = await page.locator('input[aria-label*="Digit"]').all();
        if (digits.length === 6) {
          for (let i = 0; i < 6; i++) await digits[i].fill(otp[i]);
        } else {
          await digitInput.fill(otp);
        }
        await page.locator('button:has-text("Verify"), button:has-text("Confirm")').first().click();
      }
    }

    await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {});
    console.log(`${r.name} logged in. Current URL:`, page.url());

    // Check sidebar navigation items for this role
    const navText = await page.locator('nav, aside, .MuiDrawer-root').first().innerText().catch(() => '');
    console.log(`${r.name} Sidebar Items:\n`, navText.replace(/\s+/g, ' ').trim());

    // RBAC Security Check: Can this role access /audit/logs?
    console.log(`Attempting direct navigation to /audit/logs as ${r.name}...`);
    await page.goto('https://idms-uat.qiplus.ae/audit/logs', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const finalUrl = page.url();
    const pageBodyText = await page.innerText('body');
    const isAccessDenied = finalUrl.includes('/login') || finalUrl.includes('/dashboard') || pageBodyText.includes('403') || pageBodyText.includes('Unauthorized') || pageBodyText.includes('Access Denied');
    console.log(`RBAC Result for ${r.name} on /audit/logs:`, {
      finalUrl,
      isAccessDenied,
      canViewLogs: pageBodyText.includes('Audit log search')
    });

    if (r.name === 'admin') {
      // Test admin routes
      for (const route of ['/admin/users', '/admin/picklists', '/admin/prohibited-activities']) {
        await page.goto(`https://idms-uat.qiplus.ae${route}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        console.log(`Admin route ${route} status: URL=${page.url()}, text=${(await page.innerText('body')).slice(0, 100).replace(/\s+/g, ' ')}`);
      }
    }

    // Sign out
    const sOut = page.locator('button:has-text("Sign out")').first();
    await sOut.click({ force: true }).catch(() => {});
    await page.waitForURL('**/login', { timeout: 4000 }).catch(() => {});
  }

  console.log('\n--- NETWORK ERRORS RECORDED ---');
  console.log(JSON.stringify(networkErrors, null, 2));

  console.log('\n--- CONSOLE ERRORS RECORDED ---');
  console.log(consoleErrors);

  await browser.close();
}

runDeepAudit().catch(console.error);
