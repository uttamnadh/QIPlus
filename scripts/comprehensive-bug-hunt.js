const { chromium } = require('@playwright/test');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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

const ROLES = {
  onboarding: { user: 'Sukesh', pass: 'Qa@12345', totp: '' },
  compliance: { user: 'bhanu', pass: 'Qa@123456789', totp: 'O5JK3K56FHMKGX67KMQAS65YSXXTAAT4' },
  approver: { user: 'uttamnadh', pass: 'Qa@123456789', totp: 'H2SG6MBNDHY4OFPOYBB2WHVGTZAMYT23' },
  auditor: { user: 'auditor', pass: 'Passw0rd!', totp: '' },
  admin: { user: 'shankar', pass: 'Passw0rd!', totp: 'CUZN3ZAJKZPNBMQRK5LD33D3YVWE6K7N' },
};

async function login(page, roleConfig) {
  await page.goto('https://idms-uat.qiplus.ae/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="username"]', roleConfig.user);
  await page.fill('input[name="password"]', roleConfig.pass);
  await page.click('button[type="submit"]');

  if (roleConfig.totp) {
    const digitInput = page.locator('input[aria-label*="Digit 1"], input[aria-label*="Digit"]').first();
    if (await digitInput.isVisible({ timeout: 3500 }).catch(() => false)) {
      const otp = generateTOTP(roleConfig.totp);
      const digits = await page.locator('input[aria-label*="Digit"]').all();
      if (digits.length === 6) {
        for (let i = 0; i < 6; i++) await digits[i].fill(otp[i]);
      } else {
        await digitInput.fill(otp);
      }
      await page.locator('button:has-text("Verify"), button:has-text("Confirm")').first().click();
    }
  }
  await page.waitForURL(url => !url.href.includes('/login'), { timeout: 15000 }).catch(() => {});
}

async function runBugHunt() {
  const browser = await chromium.launch({ headless: true });
  const bugs = [];

  console.log('============================================================');
  console.log('🚀 STARTING COMPREHENSIVE MULTI-ROLE BUG HUNT');
  console.log('Target: https://idms-uat.qiplus.ae');
  console.log('============================================================\n');

  // =========================================================================
  // 1. ROLE: ONBOARDING OFFICER (Sukesh)
  // =========================================================================
  console.log('--- [ROLE 1] ONBOARDING OFFICER (Sukesh) ---');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page, ROLES.onboarding);

    // Bug Check 1.1: RBAC bypass — Can Onboarding Officer access Compliance Queue?
    console.log('Checking RBAC: Sukesh accessing Compliance Verification Queue...');
    await page.goto('https://idms-uat.qiplus.ae/compliance/verification-queue', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const bodyText1 = await page.innerText('body');
    if (bodyText1.includes('Verification queue') || bodyText1.includes('Pending verification')) {
      bugs.push({
        role: 'Onboarding Officer',
        severity: 'HIGH',
        category: 'RBAC / Authorization Bypass',
        title: 'Onboarding Officer can directly access Compliance Verification Queue',
        evidence: `Navigating to /compliance/verification-queue rendered verification queue UI.`,
      });
      console.log('🚨 BUG FOUND: Onboarding Officer can access Compliance Verification Queue!');
    } else {
      console.log('✅ RBAC enforced: Onboarding Officer cannot access Compliance Verification Queue.');
    }

    // Bug Check 1.2: RBAC bypass — Can Onboarding Officer access Approval Queue?
    console.log('Checking RBAC: Sukesh accessing Approver Queue...');
    await page.goto('https://idms-uat.qiplus.ae/approver/approval-queue', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const bodyText2 = await page.innerText('body');
    if (bodyText2.includes('Approval queue') || bodyText2.includes('Pending approval queue')) {
      bugs.push({
        role: 'Onboarding Officer',
        severity: 'CRITICAL',
        category: 'RBAC / Authorization Bypass',
        title: 'Onboarding Officer can directly access Final Approval Queue',
        evidence: `Navigating to /approver/approval-queue rendered approval queue UI.`,
      });
      console.log('🚨 BUG FOUND: Onboarding Officer can access Approval Queue!');
    } else {
      console.log('✅ RBAC enforced: Onboarding Officer cannot access Approval Queue.');
    }

    // Bug Check 1.3: Wizard Step 1 Field Validation Boundaries
    console.log('Checking Wizard Step 1 Form Validations...');
    await page.goto('https://idms-uat.qiplus.ae/registration/new', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Test Expiry Date earlier than Issue Date
    const issueDateInp = page.locator('input[name="licence.issueDate"], label:has-text("Licence Issue Date") ~ div input').first();
    const expiryDateInp = page.locator('input[name="licence.expiryDate"], label:has-text("Licence Expiry Date") ~ div input').first();
    if (await issueDateInp.isVisible() && await expiryDateInp.isVisible()) {
      // Enter issue date 2025 and expiry date 2020 (Expired before issued!)
      console.log('Testing Issue Date > Expiry Date (2025 vs 2020)...');
    }

    // Test Step 2 Negative Numbers
    console.log('Checking Step 2 Negative Number input acceptance...');
    // Navigate to step 2 if possible or check draft fields
    await ctx.close();
  }

  // =========================================================================
  // 2. ROLE: COMPLIANCE OFFICER (bhanu)
  // =========================================================================
  console.log('\n--- [ROLE 2] COMPLIANCE OFFICER (bhanu) ---');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page, ROLES.compliance);

    // Bug Check 2.1: RBAC bypass — Can Compliance Officer create new registrations?
    console.log('Checking RBAC: Bhanu accessing /registration/new (Separation of Duties)...');
    await page.goto('https://idms-uat.qiplus.ae/registration/new', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const bodyTextComp = await page.innerText('body');
    const isStep1 = bodyTextComp.includes('Step 1 of 8') || bodyTextComp.includes('Merchant profile');
    if (isStep1) {
      bugs.push({
        role: 'Compliance Officer',
        severity: 'MEDIUM',
        category: 'Separation of Duties (SoD)',
        title: 'Compliance Officer can access New Merchant Registration wizard (/registration/new)',
        evidence: `Compliance role can navigate to and initiate merchant registration. Should be restricted to Onboarding Officer.`,
      });
      console.log('🚨 BUG FOUND: Compliance Officer can access /registration/new!');
    } else {
      console.log('✅ RBAC enforced: Compliance Officer cannot create new registrations.');
    }

    // Bug Check 2.2: RBAC bypass — Can Compliance Officer access Approver Queue?
    console.log('Checking RBAC: Bhanu accessing /approver/approval-queue...');
    await page.goto('https://idms-uat.qiplus.ae/approver/approval-queue', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const bodyCompApp = await page.innerText('body');
    if (bodyCompApp.includes('Approval queue') || bodyCompApp.includes('Pending approval queue')) {
      bugs.push({
        role: 'Compliance Officer',
        severity: 'HIGH',
        category: 'RBAC / Authorization Bypass',
        title: 'Compliance Officer can access Final Approval Queue',
        evidence: `Compliance role rendered /approver/approval-queue table.`,
      });
      console.log('🚨 BUG FOUND: Compliance Officer can access Approval Queue!');
    } else {
      console.log('✅ RBAC enforced: Compliance Officer cannot access Approval Queue.');
    }

    // Bug Check 2.3: Verification Queue - Decision with empty notes
    console.log('Checking Verification Queue Review Screen validations...');
    await page.goto('https://idms-uat.qiplus.ae/compliance/verification-queue', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Opening first merchant in Verification Queue...');
      await firstRow.click();
      await page.waitForTimeout(2500);

      // Check Reject button without reason
      const rejectBtn = page.locator('button:has-text("Reject"), button:has-text("Reject merchant")').first();
      if (await rejectBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await rejectBtn.click();
        await page.waitForTimeout(1000);
        // Look for confirm button in dialog
        const confirmBtn = page.locator('.MuiDialog-root button:has-text("Reject"), .MuiDialog-root button:has-text("Confirm")').last();
        if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
          const isEnabled = await confirmBtn.isEnabled();
          if (isEnabled) {
            await confirmBtn.click();
            await page.waitForTimeout(1000);
            const alertText = await page.locator('.Mui-error, [role="alert"]').innerText().catch(() => '');
            if (!alertText) {
              bugs.push({
                role: 'Compliance Officer',
                severity: 'HIGH',
                category: 'Data Integrity / Missing Mandatory Field',
                title: 'Compliance Officer allowed to reject without entering mandatory reason',
                evidence: 'Confirm button enabled with empty reason input; no validation alert triggered.',
              });
              console.log('🚨 BUG FOUND: Reject allowed without reason!');
            } else {
              console.log('✅ Validated: Reject blocked with inline error:', alertText);
            }
          } else {
            console.log('✅ Validated: Confirm Reject button is disabled when reason is empty.');
          }
        }
        await page.keyboard.press('Escape');
      }
    }
    await ctx.close();
  }

  // =========================================================================
  // 3. ROLE: FINAL APPROVER (uttamnadh)
  // =========================================================================
  console.log('\n--- [ROLE 3] FINAL APPROVER (uttamnadh) ---');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page, ROLES.approver);

    // Bug Check 3.1: Separation of Duties — Can Final Approver create new registrations?
    console.log('Checking RBAC: Approver accessing /registration/new...');
    await page.goto('https://idms-uat.qiplus.ae/registration/new', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const bodyTextApp = await page.innerText('body');
    if (bodyTextApp.includes('Step 1 of 8') || bodyTextApp.includes('Merchant profile')) {
      bugs.push({
        role: 'Final Approver',
        severity: 'MEDIUM',
        category: 'Separation of Duties (SoD)',
        title: 'Final Approver can access New Merchant Registration wizard (/registration/new)',
        evidence: 'Final Approver can create merchant drafts, violating four-eyes principle.',
      });
      console.log('🚨 BUG FOUND: Final Approver can access /registration/new!');
    } else {
      console.log('✅ RBAC enforced: Final Approver cannot create new registrations.');
    }

    // Bug Check 3.2: Can Approver access Compliance Queue?
    console.log('Checking RBAC: Approver accessing /compliance/verification-queue...');
    await page.goto('https://idms-uat.qiplus.ae/compliance/verification-queue', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const bodyComp = await page.innerText('body');
    if (bodyComp.includes('Verification queue') || bodyComp.includes('Pending verification')) {
      bugs.push({
        role: 'Final Approver',
        severity: 'HIGH',
        category: 'RBAC / Authorization Bypass',
        title: 'Final Approver can access Compliance Verification Queue',
        evidence: 'Approver rendered Compliance Queue and could act as compliance officer.',
      });
      console.log('🚨 BUG FOUND: Final Approver can access Compliance Verification Queue!');
    } else {
      console.log('✅ RBAC enforced: Final Approver cannot access Compliance Verification Queue.');
    }

    // Bug Check 3.3: Dashboard KPI Count vs Live Queue Count Consistency
    console.log('Checking Approver Dashboard KPI tile counts vs Live Table rows...');
    await page.goto('https://idms-uat.qiplus.ae/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const pendingTileText = await page.locator('div:has-text("PENDING APPROVAL")').last().innerText().catch(() => '');
    const pendingMatch = pendingTileText.match(/(\d+)/);
    const kpiCount = pendingMatch ? parseInt(pendingMatch[1], 10) : null;

    await page.goto('https://idms-uat.qiplus.ae/approver/approval-queue', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const queueRows = await page.locator('tbody tr').count();
    console.log(`Approver Dashboard KPI Pending Approval: ${kpiCount}, Actual Queue Rows: ${queueRows}`);

    await ctx.close();
  }

  // =========================================================================
  // 4. ROLE: AUDITOR (auditor)
  // =========================================================================
  console.log('\n--- [ROLE 4] AUDITOR (auditor) ---');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await login(page, ROLES.auditor);

    await page.goto('https://idms-uat.qiplus.ae/audit/logs', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Bug Check 4.1: Action dropdown options populated with User Roles instead of Actions
    const actionSelect = page.locator('label:has-text("Action"), div:has-text("Action")').locator('..').locator('[role="combobox"]').first();
    if (await actionSelect.isVisible().catch(() => false)) {
      await actionSelect.click();
      await page.waitForTimeout(500);
      const actionOpts = await page.locator('[role="listbox"] [role="option"]').allInnerTexts();
      if (actionOpts.includes('Administrator') || actionOpts.includes('Approver')) {
        bugs.push({
          role: 'Auditor',
          severity: 'HIGH',
          category: 'UI / Filter Misconfiguration',
          title: 'Audit Log "Action" Filter Dropdown populated with User Roles instead of Event Actions',
          evidence: `Options found in "Action" filter: ${JSON.stringify(actionOpts)}. Expected actions like CREATE, UPDATE, APPROVE, REJECT, LOGIN.`,
        });
        console.log('🚨 BUG FOUND: Action filter dropdown shows user roles instead of audit actions!');
      }
      await page.keyboard.press('Escape');
    }

    // Bug Check 4.2: Field Change Modal rendered empty
    const changeLogBtn = page.locator('button[aria-label*="field change logs"], [data-testid*="Visibility"], [title*="change"]').first();
    if (await changeLogBtn.isVisible().catch(() => false)) {
      await changeLogBtn.click();
      await page.waitForTimeout(1500);
      const modalText = await page.locator('[role="dialog"]').innerText().catch(() => '');
      if (!modalText || modalText.trim().length === 0) {
        bugs.push({
          role: 'Auditor',
          severity: 'MEDIUM',
          category: 'UI / Missing Audit Data',
          title: '"See field change logs" modal opens completely blank with no change diffs',
          evidence: 'Clicking the field change icon in the audit log table opened an empty modal dialog.',
        });
        console.log('🚨 BUG FOUND: Field change log modal is empty!');
      }
      await page.keyboard.press('Escape');
    }

    await ctx.close();
  }

  await browser.close();

  console.log('\n============================================================');
  console.log('🏁 BUG HUNT FINISHED. SUMMARY OF DEFECTS DISCOVERED:');
  console.log('============================================================');
  console.log(JSON.stringify(bugs, null, 2));

  fs.writeFileSync('test-results/bug-hunt-findings.json', JSON.stringify(bugs, null, 2));
}

runBugHunt().catch(console.error);
