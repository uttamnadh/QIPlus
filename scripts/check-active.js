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

async function checkMRN() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://idms-uat.qiplus.ae/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="username"]', 'uttamnadh');
  await page.fill('input[name="password"]', 'Qa@123456789');
  await page.click('button[type="submit"]');

  const digitInput = page.locator('input[aria-label*="Digit 1"]').first();
  if (await digitInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    const otp = generateTOTP('H2SG6MBNDHY4OFPOYBB2WHVGTZAMYT23');
    const digits = await page.locator('input[aria-label*="Digit"]').all();
    for (let i = 0; i < 6; i++) await digits[i].fill(otp[i]);
    await page.locator('button:has-text("Verify")').click();
  }

  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await page.goto('https://idms-uat.qiplus.ae/merchants/search', { waitUntil: 'domcontentloaded' });

  const input = page.locator('input[placeholder*="MRN"]').first();
  await input.fill('61001093329612');
  await page.keyboard.press('Enter');

  // Wait for skeletons to detach
  await page.locator('.MuiSkeleton-root').first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

  const row = page.locator('tbody tr').first();
  console.log('Row text for 61001093329612:', await row.innerText());

  await browser.close();
}

checkMRN().catch(console.error);
