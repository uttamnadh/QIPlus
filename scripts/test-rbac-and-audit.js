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

async function testAll() {
  const browser = await chromium.launch({ headless: true });

  const roles = [
    { role: 'auditor', user: 'auditor', pass: 'Passw0rd!', totp: '' },
    { role: 'onboarding', user: 'Sukesh', pass: 'Qa@12345', totp: '' },
    { role: 'compliance', user: 'bhanu', pass: 'Qa@123456789', totp: 'O5JK3K56FHMKGX67KMQAS65YSXXTAAT4' },
    { role: 'approver', user: 'uttamnadh', pass: 'Qa@123456789', totp: 'H2SG6MBNDHY4OFPOYBB2WHVGTZAMYT23' },
    { role: 'admin', user: 'shankar', pass: 'Passw0rd!', totp: 'CUZN3ZAJKZPNBMQRK5LD33D3YVWE6K7N' },
  ];

  for (const r of roles) {
    console.log(`\n============================================================`);
    console.log(`TESTING ROLE: ${r.role.toUpperCase()} (${r.user})`);
    console.log(`============================================================`);

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();

    const netErrors = [];
    page.on('response', resp => {
      if (resp.status() >= 400) {
        netErrors.push({ url: resp.url(), status: resp.status() });
      }
    });

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

    await page.waitForURL(url => !url.href.includes('/login'), { timeout: 10000 }).catch(() => {});
    console.log(`Logged in URL: ${page.url()}`);

    // Capture sidebar items
    const sidebar = await page.locator('nav, aside, .MuiDrawer-root').first().innerText().catch(() => '');
    console.log(`Sidebar items:\n${sidebar.replace(/\s+/g, ' ').trim()}`);

    // If Auditor, test audit log filter dropdown options & API payloads
    if (r.role === 'auditor') {
      await page.goto('https://idms-uat.qiplus.ae/audit/logs', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      // Check Dropdown options: "User role"
      console.log('\n--- Checking Audit Log Filter Options ---');
      const roleSelect = page.locator('label:has-text("User role"), div:has-text("User role")').locator('..').locator('[role="combobox"]').first();
      if (await roleSelect.isVisible().catch(() => false)) {
        await roleSelect.click();
        await page.waitForTimeout(500);
        const roleOpts = await page.locator('[role="listbox"] [role="option"]').allInnerTexts();
        console.log('Available User Roles:', roleOpts);
        await page.keyboard.press('Escape');
      }

      // Check Dropdown options: "Action"
      const actionSelect = page.locator('label:has-text("Action"), div:has-text("Action")').locator('..').locator('[role="combobox"]').first();
      if (await actionSelect.isVisible().catch(() => false)) {
        await actionSelect.click();
        await page.waitForTimeout(500);
        const actionOpts = await page.locator('[role="listbox"] [role="option"]').allInnerTexts();
        console.log('Available Actions in Filter:', actionOpts);
        await page.keyboard.press('Escape');
      }

      // Test Search with a real MRN (e.g. 60928132001579)
      const mrnInput = page.locator('input[placeholder="Any merchant"]').first();
      if (await mrnInput.isVisible().catch(() => false)) {
        console.log('Searching for MRN: 60928132001579...');
        await mrnInput.fill('60928132001579');
        await page.locator('button:has-text("Search")').click();
        await page.waitForTimeout(2000);
        const resultCount = await page.locator('text=/Search results/i').innerText().catch(() => '');
        console.log('MRN search count text:', resultCount);
        const firstRow = await page.locator('tbody tr').first().innerText().catch(() => 'No row');
        console.log('First search row:', firstRow.replace(/\s+/g, ' '));
        await page.screenshot({ path: 'test-results/audit-search-mrn.png' });
      }

      // Check if clicking "See field change logs" on a real MRN row works
      const changeLogBtn = page.locator('button[aria-label*="field change logs"], [data-testid*="Visibility"], [title*="change"]').first();
      if (await changeLogBtn.isVisible().catch(() => false)) {
        console.log('Found change log button! Clicking...');
        await changeLogBtn.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: 'test-results/audit-field-modal-opened.png' });
        const modal = await page.locator('[role="dialog"]').innerText().catch(() => '');
        console.log('Change Log Modal content:\n', modal);
        await page.keyboard.press('Escape');
      }

      // Test Pagination on /audit/logs
      const nextBtn = page.locator('button[aria-label="Go to next page"]');
      const isNextEnabled = await nextBtn.isEnabled().catch(() => false);
      console.log('Is Next Page enabled?', isNextEnabled);
      if (isNextEnabled) {
        await nextBtn.click();
        await page.waitForTimeout(1500);
        const pageText = await page.locator('text=/\\d+–\\d+ of \\d+/').innerText().catch(() => '');
        console.log('After clicking next, pagination text:', pageText);
      }
    } else {
      // Test RBAC: Can this non-auditor role access /audit/logs?
      console.log(`Checking RBAC on /audit/logs for ${r.role}...`);
      await page.goto('https://idms-uat.qiplus.ae/audit/logs', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      const url = page.url();
      const body = await page.innerText('body');
      const canAccess = body.includes('Audit log search');
      console.log(`Can ${r.role} view /audit/logs?`, canAccess, `(URL: ${url})`);
      if (canAccess) {
        console.log(`🚨 SECURITY / RBAC BUG: Role ${r.role} can view /audit/logs!`);
      }

      // Test RBAC on /merchants/search
      await page.goto('https://idms-uat.qiplus.ae/merchants/search', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      console.log(`Can ${r.role} access /merchants/search?`, (await page.innerText('body')).includes('Merchant applications'), `(URL: ${page.url()})`);
    }

    if (netErrors.length > 0) {
      console.log(`Network errors for ${r.role}:`, netErrors);
    }

    await ctx.close();
  }

  await browser.close();
  console.log('\n=== RUN COMPLETED ===');
}

testAll().catch(console.error);
