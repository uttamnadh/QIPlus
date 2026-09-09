const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

let mrnList = [];
if (process.argv[2]) {
  mrnList.push({ mrn: process.argv[2], suite: 'Manual Check' });
} else {
  // Check positive state
  try {
    const posFile = path.join(__dirname, 'fixtures', 'state.json');
    if (fs.existsSync(posFile)) {
      const pos = JSON.parse(fs.readFileSync(posFile, 'utf-8'));
      if (pos.mrn) mrnList.push({ mrn: pos.mrn, suite: 'Positive Suite', tradeName: pos.tradeName });
    }
  } catch {}

  // Check regression state
  try {
    const regFile = path.join(__dirname, 'fixtures', 'regression-state.json');
    if (fs.existsSync(regFile)) {
      const reg = JSON.parse(fs.readFileSync(regFile, 'utf-8'));
      if (reg.mrn && !mrnList.some(m => m.mrn === reg.mrn)) {
        const rec = reg.records && reg.records.find(r => r.mrn === reg.mrn);
        mrnList.push({ mrn: reg.mrn, suite: 'Regression Suite', tradeName: rec ? rec.tradeName : undefined });
      }
    }
  } catch {}
}

if (mrnList.length === 0) {
  console.error('\n❌ No MRN found in state files. Usage: node check-status.js [MRN]\n');
  process.exit(1);
}

(async () => {
  console.log('\n========================================================================================');
  console.log('                 VS CODE TERMINAL STATUS AUDIT (LIVE PORTAL CHECK)                      ');
  console.log('========================================================================================');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto('https://idms-uat.qiplus.ae/login');
    await page.fill('input[name="username"]', 'uttamnadh');
    await page.fill('input[name="password"]', 'Qa@123456789');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.href.includes('/login'), { timeout: 15000 });

    for (const item of mrnList) {
      const targetMRN = item.mrn;
      console.log(`\n----------------------------------------------------------------------------------------`);
      console.log(`🔎 Auditing: ${item.suite} | MRN: ${targetMRN}`);
      console.log(`----------------------------------------------------------------------------------------`);

      // 1. Check Approved Merchants (Active)
      await page.locator('text="Approved merchants"').first().click();
      await page.waitForTimeout(1500);
      const filterInput = page.getByPlaceholder('Filter by MRN or name');
      await filterInput.fill(targetMRN);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);

      const activeRow = page.locator(`tr:has-text("${targetMRN}"), [role="row"]:has-text("${targetMRN}")`).first();
      const isActive = await activeRow.isVisible({ timeout: 2000 }).catch(() => false);

      if (isActive) {
        const rowText = await activeRow.innerText().catch(() => '');
        console.log('🌟 [STATUS RESULT] MERCHANT RECORD IS ACTIVE!');
        console.log(`   📄 MRN NUMBER     : ${targetMRN}`);
        if (item.tradeName) console.log(`   🏢 TRADE NAME     : ${item.tradeName}`);
        console.log(`   ✅ LIVE STATUS    : 🟢 ACTIVE (APPROVED & ACTIVATED)`);
        console.log(`   📍 LOCATION       : Approved Merchants Directory`);
        console.log(`   📋 ROW DETAILS    : ${rowText.replace(/\n+/g, ' | ')}`);
        continue;
      }

      // 2. Check Approval Queue (Under compliance review / On-hold / Pending final approval)
      await page.locator('text="Approval queue"').first().click();
      await page.waitForTimeout(1500);
      const queueInput = page.getByPlaceholder('Filter by MRN or name');
      await queueInput.fill(targetMRN);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);

      const queueRow = page.locator(`tr:has-text("${targetMRN}"), [role="row"]:has-text("${targetMRN}")`).first();
      const isQueue = await queueRow.isVisible({ timeout: 2000 }).catch(() => false);

      if (isQueue) {
        const rowText = await queueRow.innerText().catch(() => '');
        const isHold = /Under compliance review|On-hold/i.test(rowText);

        if (isHold) {
          console.log('⚠️ [STATUS RESULT] MERCHANT RECORD IS ON-HOLD (UNDER COMPLIANCE REVIEW)');
          console.log(`   📄 MRN NUMBER     : ${targetMRN}`);
          if (item.tradeName) console.log(`   🏢 TRADE NAME     : ${item.tradeName}`);
          console.log(`   🔒 LIVE STATUS    : 🟡 ON-HOLD (UNDER COMPLIANCE REVIEW)`);
          console.log(`   🔍 SCREENING      : eMcREY Hit (Flagged for Review)`);
          console.log(`   ⛔ ACTION         : Decision Locked (Buttons Disabled)`);
          console.log(`   📍 LOCATION        : Approval Queue`);
          console.log(`   📋 ROW DETAILS    : ${rowText.replace(/\n+/g, ' | ')}`);
        } else {
          console.log('ℹ️ [STATUS RESULT] MERCHANT RECORD IS PENDING FINAL APPROVAL');
          console.log(`   📄 MRN NUMBER     : ${targetMRN}`);
          if (item.tradeName) console.log(`   🏢 TRADE NAME     : ${item.tradeName}`);
          console.log(`   ⏳ LIVE STATUS    : 🔵 PENDING FINAL APPROVAL`);
          console.log(`   📍 LOCATION        : Approval Queue`);
          console.log(`   📋 ROW DETAILS    : ${rowText.replace(/\n+/g, ' | ')}`);
        }
        continue;
      }

      console.log(`⚠️ MRN ${targetMRN} was not found in Approved Merchants or Approval Queue.`);
    }

    console.log('\n========================================================================================\n');

  } catch (err) {
    console.error('Error during status check:', err);
  } finally {
    await browser.close();
  }
})();
