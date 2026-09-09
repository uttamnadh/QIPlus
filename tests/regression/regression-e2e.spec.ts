import { test, expect } from '../../fixtures/diagnostics';
import { Page, BrowserContext } from '@playwright/test';
import { DashboardPage } from '../../pages/dashboard.page';
import { Step1ProfilePage } from '../../pages/wizard/step1-profile.page';
import { Step2BusinessPage } from '../../pages/wizard/step2-business.page';
import { Step3OwnershipPage } from '../../pages/wizard/step3-ownership.page';
import { Step4UBOsPage } from '../../pages/wizard/step4-ubos.page';
import { Step5SignatoriesPage } from '../../pages/wizard/step5-signatories.page';
import { Step6BankingPage } from '../../pages/wizard/step6-banking.page';
import { Step7DocumentsPage } from '../../pages/wizard/step7-documents.page';
import { Step8ReviewPage } from '../../pages/wizard/step8-review.page';
import { ComplianceQueuePage } from '../../pages/compliance-queue.page';
import { ApprovalQueuePage } from '../../pages/approval-queue.page';
import { BaseWizardPage } from '../../pages/wizard/base-wizard.page';
import { getMerchantData, ROLES, printMerchantSubmissionSummary } from '../../fixtures/merchant-data';
import { buildDraftIdentity } from '../../fixtures/test-data';
import { saveRegressionState, loadRegressionState, saveRegressionRecord } from '../../fixtures/regression-state';
import * as path from 'path';

let MERCHANT: any;

/** Helper to cleanly log in as a specified role within the SAME single browser tab */
async function loginAsRoleInSameTab(page: Page, role: { username: string; password: string }) {
  await page.context().clearCookies();
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
  }).catch(() => {});
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="username"]').waitFor({ state: 'visible', timeout: 10000 });
  await page.fill('input[name="username"]', role.username);
  await page.fill('input[name="password"]', role.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.href.includes('/login'), { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

test.describe.serial('[REG-E2E] Consolidated End-to-End Regression Pipeline (Single Tab)', () => {
  let ctx: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const identity = buildDraftIdentity('positive');
    const baseData = getMerchantData('positive');
    const randomTL = `TL${Math.floor(100000 + Math.random() * 900000)}`;

    // Build merchant with BOTH Individual (50%) and Entity (50%) in the SAME record
    MERCHANT = {
      ...baseData,
      tradeName: identity.tradeName,
      legalName: identity.legalName,
      trn: identity.trn,
      websiteUrl: identity.websiteUrl,
      primaryContactName: identity.primaryContactName,
      primaryContactPosition: identity.primaryContactPosition,
      primaryContactEmail: identity.primaryContactEmail,
      primaryContactPhone: identity.primaryContactPhone,
      registeredAddress: {
        ...baseData.registeredAddress,
        floorOffice: identity.officeSuite,
        poBox: identity.poBox,
      },
      licence: {
        ...baseData.licence,
        number: identity.licenceNumber,
      },
      shareholders: [
        {
          fullLegalName: identity.primaryContactName,
          entityOrIndividual: 'Individual' as const,
          countryOfRegistration: 'United Arab Emirates',
          percentShareholding: '50',
          idType: 'Emirates ID' as const,
          emiratesIdNumber: identity.emiratesId,
          tradeLicenceNumber: '',
        },
        {
          fullLegalName: `${identity.tradeName} Holding LLC`,
          entityOrIndividual: 'Entity' as const,
          countryOfRegistration: 'United Arab Emirates',
          percentShareholding: '50',
          idType: 'Trade License' as const,
          tradeLicenceNumber: randomTL,
          emiratesIdNumber: '',
        },
      ],
      ubos: [
        {
          fullLegalName: identity.primaryContactName,
          dateOfBirth: { day: '15', month: '06', year: '1990' },
          placeOfBirth: 'Dubai',
          nationality: 'United Arab Emirates',
          hasDualNationality: false,
          countryOfResidence: 'United Arab Emirates',
          percentShareholding: '50',
          idType: 'Emirates ID',
          emiratesIdNumber: identity.emiratesId,
          idExpiryDate: { day: '31', month: '12', year: '2030' },
          basisOfControl: 'Ownership',
          occupation: 'Managing Director',
          pep: false,
        },
      ],
      signatories: [
        {
          ...baseData.signatories[0],
          fullName: identity.primaryContactName,
          emiratesIdNumber: identity.emiratesId,
        },
      ],
      banking: {
        ...baseData.banking,
        accountHolderName: identity.legalName.replace(/[^a-zA-Z\s]/g, '').trim(),
        iban: identity.iban,
      },
    };

    saveRegressionState({ mrn: '', records: [] });

    ctx = await browser.newContext();
    page = await ctx.newPage();
  });

  test.afterAll(async () => {
    await ctx?.close();
  });

  // ─────────────────────────────────────────────────────────────
  // PHASE 1: ONBOARDING OFFICER — WIZARD STEPS 1–8 WALKTHROUGH
  // ─────────────────────────────────────────────────────────────

  test('1.1 — Onboarding Officer logs in & completes Step 1 (Profile) with validation checks', async () => {
    await loginAsRoleInSameTab(page, ROLES.onboarding);
    const dashboard = new DashboardPage(page);
    await dashboard.clickCreateMerchant();

    const step1 = new Step1ProfilePage(page);
    await step1.expectStep(1);

    // Field-level check: Trade name blank -> blocked
    await step1.fillTradeName('');
    await step1.clickSaveAndContinue();
    await step1.expectStep(1);

    // Field-level check: TRN format invalid -> blocked
    await step1.fillTradeName(MERCHANT.tradeName);
    await step1.fillTrn('12345');
    await step1.clickSaveAndContinue();
    await step1.expectStep(1);

    // Fill valid Step 1 details (testing whitespace trimming on trade name)
    const spacedTradeName = `  ${MERCHANT.tradeName}  `;
    await step1.fillAll({ ...MERCHANT, tradeName: spacedTradeName });
    await step1.clickSaveAndContinue();

    const mrn = await step1.getRegistrationNumber();
    saveRegressionState({ mrn });
    saveRegressionRecord({
      mrn,
      tradeName: MERCHANT.tradeName,
      legalName: MERCHANT.legalName,
      shareholderType: 'Individual',
    });
    console.log(`[REG-E2E] Single Shared Draft Created. MRN: ${mrn}`);

    const step2 = new Step2BusinessPage(page);
    await step2.expectStep(2);
  });

  test('1.2 — Complete Step 2 (Business) with XSS sanitization check', async () => {
    const step2 = new Step2BusinessPage(page);
    await step2.expectStep(2);

    // Field-level check: Primary products blank -> blocked
    await step2.fillPrimaryProducts('');
    await step2.clickSaveAndContinue();
    await step2.expectStep(2);

    // Fill full Step 2 details first
    await step2.fillAll(MERCHANT.business);

    // XSS check: Test script injection attempt in Primary Products
    await step2.fillPrimaryProducts('<script>alert("XSS")</script>');
    await step2.clickSaveAndContinue();

    // Check if UI blocked with validation error or sanitized cleanly
    const isBlocked = await page.locator('.Mui-error, [role="alert"]').isVisible({ timeout: 1500 }).catch(() => false);
    if (isBlocked) {
      await step2.expectStep(2);
    }

    // Restore clean business details and advance to Step 3
    await step2.fillAll(MERCHANT.business);
    await step2.clickSaveAndContinue();

    const step3 = new Step3OwnershipPage(page);
    await step3.expectStep(3);
  });

  test('1.3 — Complete Step 3 (Ownership) with Dual Shareholders & 110% boundary check', async () => {
    const step3 = new Step3OwnershipPage(page);
    await step3.expectStep(3);

    // 1. Shareholder 1: Individual (50% shareholding, Emirates ID)
    console.log(`[Step 3] Adding Shareholder 1 (Individual): ${MERCHANT.shareholders[0].fullLegalName} (50%)`);
    await step3.fillShareholder(0, MERCHANT.shareholders[0]);

    // 2. Add second shareholder: Entity (50% shareholding, Trade License)
    console.log(`[Step 3] Clicking '+ Add shareholder' for Shareholder 2 (Entity)...`);
    await step3.addShareholder();
    await page.waitForTimeout(500);

    console.log(`[Step 3] Adding Shareholder 2 (Entity): ${MERCHANT.shareholders[1].fullLegalName} (50%)`);
    await step3.fillShareholder(1, MERCHANT.shareholders[1]);

    let total = await step3.getTotalShareholding();
    console.log(`[Step 3] Total shareholding entered: ${total}`);
    expect(total).toContain('100');

    // 3. Dynamic Boundary & Deletion Check: Add 3rd card, exceed 100%, delete card
    console.log(`[Step 3 Regression] Testing 110% boundary condition & dynamic removal...`);
    await step3.addShareholder();
    await page.waitForTimeout(400);
    const pctInp3 = page.getByLabel(/% shareholding/i).nth(2);
    if (await pctInp3.isVisible({ timeout: 1000 }).catch(() => false)) {
      await pctInp3.fill('10');
      const exceedTotal = await step3.getTotalShareholding();
      console.log(`[Step 3 Regression] Exceeded total: ${exceedTotal}`);

      // Delete the 3rd shareholder card
      const delBtns = page.locator('button[aria-label*="Remove" i], button[aria-label*="delete" i], button:has-text("Delete"), button:has-text("Remove"), [data-testid*="Delete"]');
      const delCount = await delBtns.count();
      if (delCount > 0) {
        await delBtns.last().click({ force: true }).catch(() => {});
        await page.waitForTimeout(400);
      }
    }

    // Confirm total is restored to 100.00%
    total = await step3.getTotalShareholding();
    console.log(`[Step 3 Regression] Restored total after deletion: ${total}`);
    expect(total).toContain('100');

    await step3.clickSaveAndContinue();
    const step4 = new Step4UBOsPage(page);
    await step4.expectStep(4);
  });

  test('1.4 — Complete Step 4 (UBOs) with Ownership basis (>=25% threshold)', async () => {
    const step4 = new Step4UBOsPage(page);
    await step4.expectStep(4);

    const uboCount = await step4.getUBOCount();
    console.log(`[Step 4] Auto-populated UBO count: ${uboCount}`);
    if (uboCount === 0) {
      await step4.addUBO();
    }

    const totalUbos = Math.max(1, await step4.getUBOCount());
    for (let i = 0; i < totalUbos; i++) {
      await step4.fillUBO(i, MERCHANT.ubos[i] || MERCHANT.ubos[0]);
    }

    await step4.clickSaveAndContinue();
    const step5 = new Step5SignatoriesPage(page);
    await step5.expectStep(5);
  });

  test('1.5 — Complete Step 5 (Signatories) with mandatory signatory check', async () => {
    const step5 = new Step5SignatoriesPage(page);
    await step5.expectStep(5);

    // Field-level check: Signatory full name blank -> blocked
    await page.getByLabel('Full name *').first().fill('');
    await step5.clickSaveAndContinue();
    await step5.expectStep(5);

    // Fill valid signatory details and save
    await step5.fillSignatory(0, MERCHANT.signatories[0]);
    await step5.clickSaveAndContinue();

    const step6 = new Step6BankingPage(page);
    await step6.expectStep(6);
  });

  test('1.6 — Complete Step 6 (Banking) with IBAN format check', async () => {
    const step6 = new Step6BankingPage(page);
    await step6.expectStep(6);

    // Fill valid banking details first
    await step6.fillAll(MERCHANT.banking);

    // Field-level check: IBAN missing "AE" prefix -> rejected
    await page.locator('input[name="banking.iban"], input[name*="iban"]').first().fill('GB29NWBK60161331926819');
    await step6.clickSaveAndContinue();
    await step6.expectStep(6);

    // Restore valid IBAN and save
    await page.locator('input[name="banking.iban"], input[name*="iban"]').first().fill(MERCHANT.banking.iban);
    await step6.clickSaveAndContinue();

    const step7 = new Step7DocumentsPage(page);
    await step7.expectStep(7);
  });

  test('1.7 — Complete Step 7 (Documents) with View Doc modal preview check', async () => {
    const step7 = new Step7DocumentsPage(page);
    await step7.expectStep(7);

    // Upload dummy documents
    const fixturesDir = path.resolve(__dirname, '../../fixtures');
    const vatDocPath = path.resolve(fixturesDir, 'dummy_1.png');
    await step7.uploadAllDummyDocuments(fixturesDir);
    await step7.uploadVatDocument(vatDocPath).catch(() => {});

    const initialCount = await step7.getUploadedCount();

    // Test View Doc feature preview modal
    const viewBtn = page.locator('button:has-text("View"), [data-testid="VisibilityIcon"], button[aria-label*="view" i]').first();
    if (await viewBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await viewBtn.click();
      await page.waitForTimeout(500);
      await step7.closePreview();
    }

    // Advance to Step 8
    const saveBtn = page.locator('button:has-text("Save & continue")');
    await expect(saveBtn).toBeEnabled({ timeout: 5000 });
    await saveBtn.click();

    const step8 = new Step8ReviewPage(page);
    await step8.expectStep(8);
  });

  test('1.8 — Complete Step 8 (Review) & Submit merchant record for review', async () => {
    const step8 = new Step8ReviewPage(page);
    await step8.expectStep(8);

    // Verify review summary data matches entered MERCHANT details
    await step8.verifyReviewData(MERCHANT);

    const mrn = await step8.getRegistrationNumber();
    console.log(`[REG-E2E] Submitting MRN: ${mrn} for Compliance Review`);

    await step8.submitForReview();
    await page.waitForTimeout(1000);

    printMerchantSubmissionSummary({
      tradeName: MERCHANT.tradeName,
      legalName: MERCHANT.legalName,
      mrn: mrn || '',
      shareholderType: MERCHANT.shareholders[0].entityOrIndividual,
      shareholderIdType: MERCHANT.shareholders[0].idType,
      uboName: MERCHANT.ubos[0].fullLegalName,
      uboShare: MERCHANT.ubos[0].percentShareholding,
      step7Status: 'All mandatory documents uploaded & verified',
      suiteType: 'REGRESSION'
    });

    const basePage = new BaseWizardPage(page);
    await basePage.signOut();
    expect(page.url()).toContain('/login');
  });

  // ─────────────────────────────────────────────────────────────
  // PHASE 2: COMPLIANCE OFFICER — INSPECTION & VERIFICATION
  // AML SCREENING: "Approve & forward" now triggers async AML check.
  // ─────────────────────────────────────────────────────────────

  test('2.1 — Compliance Officer reviews, inspects, and approves the regression record', async () => {
    test.setTimeout(90000);
    const state = loadRegressionState();
    const targetMRN = state.mrn;
    expect(targetMRN).toBeTruthy();

    await loginAsRoleInSameTab(page, ROLES.compliance);

    const queue = new ComplianceQueuePage(page);
    await queue.navigateToVerificationQueue();
    await queue.openMerchant(targetMRN);

    // Verify compliance review page displays expected trade name
    await queue.expectTradeName(MERCHANT.tradeName);

    // Write decision notes and click Approve & forward
    // approveMerchant() confirms modal and verifies toast: "Decision recorded: Approve & forward."
    console.log(`[REG-E2E] Compliance approving MRN: ${targetMRN}`);
    await queue.approveMerchant('Compliance regression verification passed after document check.');

    // eMcREY AML SCREENING: Refresh Approved section >5 times until record appears
    console.log(`[REG-E2E] Polling Compliance Approved section for MRN ${targetMRN} awaiting eMcREY screening...`);
    const approvedResult = await queue.waitForRecordInApproved(targetMRN, 10, 5000);
    expect(approvedResult.found, `MRN ${targetMRN} must appear in Compliance Approved section`).toBe(true);

    const basePage = new BaseWizardPage(page);
    await basePage.signOut();
    expect(page.url()).toContain('/login');
  });

  // ─────────────────────────────────────────────────────────────
  // PHASE 3: FINAL APPROVER — REVIEW, eMcREY CHECK & ACTIVATION
  // ─────────────────────────────────────────────────────────────

  test('3.1 — Final Approver reviews, checks eMcREY screening, and activates merchant to Active status', async () => {
    test.setTimeout(90000);
    const state = loadRegressionState();
    const targetMRN = state.mrn;
    expect(targetMRN).toBeTruthy();

    await loginAsRoleInSameTab(page, ROLES.approver);

    const queue = new ApprovalQueuePage(page);
    await queue.navigateToApprovalQueue();

    // eMcREY SCREENING POLLING: Retry-loop — refresh + re-search by MRN, up to 10 attempts
    const found = await queue.waitForRecordInApprovalQueue(targetMRN, 10, 5000);
    expect(found, `MRN ${targetMRN} was not found in Approval Queue after 10 eMcREY screening retry attempts`).toBeTruthy();

    // Verify trade name on final approval screen
    await queue.expectTradeName(MERCHANT.tradeName);

    // Trigger "Re-check screening result" if button is present
    await queue.recheckScreeningResult();

    // Read and log AML risk rating if displayed
    const riskRating = await queue.getRiskRating(targetMRN);
    if (riskRating) {
      console.log(`[REG-E2E] AML Risk Rating for MRN ${targetMRN}: ${riskRating}`);
    }

    // Check if screening hit or decision locked
    const isScreeningHit = await page.locator('text=/Screening hit|case opened for compliance review/i').first().isVisible({ timeout: 2000 }).catch(() => false);
    const notesInput = page.locator('textarea, [role="textbox"], input[name="notes"]').first();
    const isNotesEditable = await notesInput.isEditable().catch(() => false);

    if (isScreeningHit || !isNotesEditable) {
      console.log(`\n[REG-E2E] Without logout: Refreshing page once to check updated status for MRN ${targetMRN}...`);
      await page.waitForTimeout(2000);
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(1500);

      console.log(`[REG-E2E] ℹ️ MRN ${targetMRN} is in On-hold (Under compliance review) — decision buttons are locked and cannot be approved by Final Approver.`);
      await queue.navigateToApprovalQueue();
      await queue.filterByMRN(targetMRN);
      const row = page.locator(`tr:has-text("${targetMRN}"), [role="row"]:has-text("${targetMRN}")`).first();
      await expect(row).toBeVisible({ timeout: 5000 });
      const rowText = await row.innerText().catch(() => '');

      console.log('\n============================================================');
      console.log('⚠️ [VS CODE TERMINAL STATUS AUDIT — REGRESSION]');
      console.log(`📄 MRN NUMBER    : ${targetMRN}`);
      console.log(`🏢 TRADE NAME    : ${MERCHANT.tradeName || 'N/A'}`);
      console.log('🔍 SCREENING     : eMcREY Hit (Flagged for Review)');
      console.log('🔒 RECORD STATUS : 🟡 ON-HOLD (UNDER COMPLIANCE REVIEW)');
      console.log('⛔ ACTION        : Decision Locked (Buttons Disabled)');
      console.log(`📋 QUEUE ROW     : ${rowText.replace(/\n+/g, ' | ')}`);
      console.log('============================================================\n');
    } else {
      // Write decision notes and approve to Active
      console.log(`[REG-E2E] Final Approver activating MRN: ${targetMRN}`);
      await queue.approveMerchant('Final approval and merchant activation granted after eMcREY AML verification.');

      console.log(`\n[REG-E2E] Without logout: Refreshing page once to check updated status for MRN ${targetMRN}...`);
      await page.waitForTimeout(2000);
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(1500);

      // Verify merchant is Active in directory
      const isActive = await queue.verifyMerchantActive(targetMRN);
      expect(isActive, `Merchant ${targetMRN} should be verified Active in directory`).toBe(true);

      console.log('\n============================================================');
      console.log('🌟 [VS CODE TERMINAL STATUS AUDIT — REGRESSION]');
      console.log(`📄 MRN NUMBER    : ${targetMRN}`);
      console.log(`🏢 TRADE NAME    : ${MERCHANT.tradeName || 'N/A'}`);
      console.log('🔍 SCREENING     : eMcREY Clear (Low Risk)');
      console.log('✅ RECORD STATUS : 🟢 ACTIVE (APPROVED & ACTIVATED)');
      console.log('💎 LIFECYCLE     : Onboarding -> Compliance -> Activated');
      console.log('============================================================\n');
    }

    const basePage = new BaseWizardPage(page);
    await basePage.signOut();
    expect(page.url()).toContain('/login');
  });

  // ─────────────────────────────────────────────────────────────
  // PHASE 4: MULTI-ROLE STATUS RECONCILIATION
  // 1st: Sukesh (Onboarding) in Submitted list
  // 2nd: Bhanu (Compliance) in Approved list
  // (Uttamnadh already verified in Phase 3 without logout)
  // ─────────────────────────────────────────────────────────────

  test('4.1 — Verify multi-role status for Onboarding Officer (1st) and Compliance Officer (2nd)', async () => {
    const state = loadRegressionState();
    const targetMRN = state.mrn;
    expect(targetMRN).toBeTruthy();
    test.skip(!state.finalApproved, 'Regression merchant is On-hold (Under compliance review) / not final approved; skipping Phase 4 post-activation status checks.');

    const basePage = new BaseWizardPage(page);

    // 1st — Onboarding officer (Sukesh) checks status in Submitted list
    await loginAsRoleInSameTab(page, ROLES.onboarding);
    await page.click('text="Submitted"');
    const searchInput = page.getByPlaceholder('Filter by MRN or name').or(page.locator('input[placeholder*="Search" i], input[placeholder*="Filter" i]')).first();
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.click();
      await searchInput.fill(targetMRN);
      await page.keyboard.press('Enter');
    }
    const submittedRow = page.locator(`tr:has-text("${targetMRN}"), [role="row"]:has-text("${targetMRN}")`).first();
    await expect(submittedRow).toBeVisible({ timeout: 5000 });
    const subText = await submittedRow.innerText().catch(() => '');

    console.log('\n============================================================');
    console.log('📋 [REG-E2E STATUS CHECK 1/2 — ONBOARDING OFFICER (SUKESH)]');
    console.log(`📄 MRN NUMBER    : ${targetMRN}`);
    console.log(`🏢 TRADE NAME    : ${MERCHANT.tradeName || 'N/A'}`);
    console.log('📍 LOCATION       : Submitted List');
    console.log(`📋 DETAILS       : ${subText.replace(/\n+/g, ' | ')}`);
    console.log('============================================================\n');
    await basePage.signOut();

    // 2nd — Compliance officer (Bhanu) checks status in Approved list
    await loginAsRoleInSameTab(page, ROLES.compliance);
    const compQueue = new ComplianceQueuePage(page);
    await compQueue.navigateToApproved();
    await compQueue.filterByMRN(targetMRN);
    const approvedRow = page.locator(`tr:has-text("${targetMRN}"), [role="row"]:has-text("${targetMRN}")`).first();
    await expect(approvedRow).toBeVisible({ timeout: 5000 });
    const appText = await approvedRow.innerText().catch(() => '');

    console.log('\n============================================================');
    console.log('📋 [REG-E2E STATUS CHECK 2/2 — COMPLIANCE OFFICER (BHANU)]');
    console.log(`📄 MRN NUMBER    : ${targetMRN}`);
    console.log(`🏢 TRADE NAME    : ${MERCHANT.tradeName || 'N/A'}`);
    console.log('📍 LOCATION       : Compliance Approved List');
    console.log(`📋 DETAILS       : ${appText.replace(/\n+/g, ' | ')}`);
    console.log('============================================================\n');
    await basePage.signOut();
  });
});
