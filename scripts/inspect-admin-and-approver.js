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

async function inspectAdmin() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const netErrors = [];
  page.on('response', resp => {
    if (resp.status() >= 400) {
      netErrors.push({ url: resp.url(), status: resp.status() });
    }
  });

  await page.goto('https://idms-uat.qiplus.ae/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="username"]', 'shankar');
  await page.fill('input[name="password"]', 'Passw0rd!');
  await page.click('button[type="submit"]');

  const digitInput = page.locator('input[aria-label*="Digit 1"], input[aria-label*="Digit"]').first();
  if (await digitInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    const otp = generateTOTP('CUZN3ZAJKZPNBMQRK5LD33D3YVWE6K7N');
    const digits = await page.locator('input[aria-label*="Digit"]').all();
    if (digits.length === 6) {
      for (let i = 0; i < 6; i++) await digits[i].fill(otp[i]);
    } else {
      await digitInput.fill(otp);
    }
    await page.locator('button:has-text("Verify"), button:has-text("Confirm")').first().click();
  }

  await page.waitForURL('**/dashboard', { timeout: 10000 });
  console.log('Admin Dashboard loaded.');

  // Check Admin links
  const links = ['User management', 'Master data', 'Document configuration'];
  for (const l of links) {
    const el = page.locator(`text="${l}"`).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      await el.click();
      await page.waitForTimeout(2000);
      console.log(`Clicked "${l}": URL = ${page.url()}`);
      await page.screenshot({ path: `test-results/admin-${l.toLowerCase().replace(/\s+/g, '-')}.png` });
    }
  }

  // Check Approver role changes too
  console.log('\n--- Switching to Approver Role ---');
  await page.goto('https://idms-uat.qiplus.ae/login');
  await page.context().clearCookies();
  await page.goto('https://idms-uat.qiplus.ae/login');
  await page.fill('input[name="username"]', 'uttamnadh');
  await page.fill('input[name="password"]', 'Qa@123456789');
  await page.click('button[type="submit"]');

  const appDigit = page.locator('input[aria-label*="Digit 1"]').first();
  if (await appDigit.isVisible({ timeout: 3000 }).catch(() => false)) {
    const otp = generateTOTP('H2SG6MBNDHY4OFPOYBB2WHVGTZAMYT23');
    const digits = await page.locator('input[aria-label*="Digit"]').all();
    for (let i = 0; i < 6; i++) await digits[i].fill(otp[i]);
    await page.locator('button:has-text("Verify")').click();
  }
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  console.log('Approver Dashboard loaded.');
  console.log('Approver Sidebar:', (await page.locator('nav, aside').innerText()).replace(/\s+/g, ' '));
  await page.screenshot({ path: 'test-results/approver-dashboard.png' });

  // Check Compliance role changes too
  console.log('\n--- Switching to Compliance Role ---');
  await page.context().clearCookies();
  await page.goto('https://idms-uat.qiplus.ae/login');
  await page.fill('input[name="username"]', 'bhanu');
  await page.fill('input[name="password"]', 'Qa@123456789');
  await page.click('button[type="submit"]');

  const compDigit = page.locator('input[aria-label*="Digit 1"]').first();
  if (await compDigit.isVisible({ timeout: 3000 }).catch(() => false)) {
    const otp = generateTOTP('O5JK3K56FHMKGX67KMQAS65YSXXTAAT4');
    const digits = await page.locator('input[aria-label*="Digit"]').all();
    for (let i = 0; i < 6; i++) await digits[i].fill(otp[i]);
    await page.locator('button:has-text("Verify")').click();
  }
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  console.log('Compliance Dashboard loaded.');
  console.log('Compliance Sidebar:', (await page.locator('nav, aside').innerText()).replace(/\s+/g, ' '));
  await page.screenshot({ path: 'test-results/compliance-dashboard.png' });

  console.log('\n--- Network Errors Recorded ---');
  console.log(netErrors);

  await browser.close();
}

inspectAdmin().catch(console.error);
