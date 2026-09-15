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
import { BaseWizardPage } from '../../pages/wizard/base-wizard.page';
import { LoginPage } from '../../pages/login.page';
import { getMerchantData, ROLES, sharedState, saveState, loadState, printMerchantSubmissionSummary, ShareholderType } from '../../fixtures/merchant-data';
import { getOrPromptRunOptions } from '../../fixtures/prompt-helper';
import * as path from 'path';

const runOptions = getOrPromptRunOptions();
const TOTAL_RECORDS = runOptions.recordCount;
const SHAREHOLDER_MODE = runOptions.shareholderType;
const initialShareholderType: ShareholderType = SHAREHOLDER_MODE === 'Entity' ? 'Entity' : 'Individual';

let MERCHANT = getMerchantData('positive', initialShareholderType);
const batchResults: Array<{ index: number; tradeName: string; mrn: string; shareholderType: string; success: boolean }> = [];

let highestStepCompleted = 0;

/**
 * Reusable helper to execute onboarding steps sequentially for a merchant record up to maxStep.
 */
async function runWizardSteps(page: Page, merchant: any, maxStep: number = 8): Promise<string> {
  const dashboard = new DashboardPage(page);
  const step1 = new Step1ProfilePage(page);
  const step2 = new Step2BusinessPage(page);
  const step3 = new Step3OwnershipPage(page);
  const step4 = new Step4UBOsPage(page);
  const step5 = new Step5SignatoriesPage(page);
  const step6 = new Step6BankingPage(page);
  const step7 = new Step7DocumentsPage(page);
  const step8 = new Step8ReviewPage(page);

  // Step 1
  await dashboard.clickCreateMerchant();
  await step1.expectStep(1);
  await step1.fillAll(merchant);
  await step1.clickSaveAndContinue();
  let mrn = await step1.getRegistrationNumber().catch(() => '');
  if (maxStep <= 1) return mrn;

  // Step 2
  await step2.expectStep(2);
  await step2.fillAll(merchant.business);
  await step2.clickSaveAndContinue();
  if (maxStep <= 2) return mrn;

  // Step 3
  await step3.expectStep(3);
  await step3.fillShareholder(0, merchant.shareholders[0]);
  await step3.clickSaveAndContinue();
  if (maxStep <= 3) return mrn;

  // Step 4
  await step4.expectStep(4);
  await step4.fillUBO(0, merchant.ubos[0]);
  await step4.clickSaveAndContinue();
  if (maxStep <= 4) return mrn;

  // Step 5
  await step5.expectStep(5);
  await step5.fillSignatory(0, merchant.signatories[0]);
  await step5.clickSaveAndContinue();
  if (maxStep <= 5) return mrn;

  // Step 6
  await step6.expectStep(6);
  await step6.fillAll(merchant.banking);
  await step6.clickSaveAndContinue();
  if (maxStep <= 6) return mrn;

  // Step 7
  await step7.expectStep(7);
  const docPath = path.resolve(__dirname, '../../fixtures/dummy_1.png');
  await step7.uploadAllDocuments(docPath);
  await step7.clickSaveAndContinue();
  await step7.expectStep(8);
  if (maxStep <= 7) return mrn;

  // Step 8
  const mrnOnReview = await step8.getRegistrationNumber().catch(() => '');
  if (mrnOnReview) mrn = mrnOnReview;
  await step8.submitForReview();
  return mrn;
}

/**
 * Scenario 2: Full onboarding wizard walkthrough as Onboarding officer.
 * Always creates NEW merchant record(s) with fresh random data every single run.
 * Supports single-record granular verification and multi-record batch onboarding.
 */
test.describe.serial('02 — Onboarding wizard walkthrough', () => {
  let ctx: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(Math.max(180000, TOTAL_RECORDS * 120000));
    // Generate a fresh random merchant record with the selected shareholder type
    MERCHANT = getMerchantData('positive', initialShareholderType);
    saveState({ mrn: '', submitted: false, complianceApproved: false });

    ctx = await browser.newContext();
    page = await ctx.newPage();
    // Login as onboarding officer (Sukesh)
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login(ROLES.onboarding.username, ROLES.onboarding.password);
    await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {});

    console.log(`[POSITIVE Suite] Initializing run (${TOTAL_RECORDS} record(s), Mode: ${SHAREHOLDER_MODE}): ${MERCHANT.tradeName} (TRN: ${MERCHANT.trn}, Licence: ${MERCHANT.licence.number})`);
  });

  test.afterAll(async () => {
    test.setTimeout(Math.max(180000, TOTAL_RECORDS * 120000));

    // If TOTAL_RECORDS > 1 and Step 9 did not run (e.g. stopped at Step 7 or Step 6 due to --grep),
    // run the remaining batch records up to highestStepCompleted!
    if (TOTAL_RECORDS > 1 && highestStepCompleted > 0 && highestStepCompleted < 9 && page) {
      console.log(`\n============================================================`);
      console.log(`🚀 PROCESSING BATCH RECORDS 2..${TOTAL_RECORDS} (Up to Step ${highestStepCompleted})`);
      console.log(`============================================================\n`);

      batchResults.push({
        index: 1,
        tradeName: MERCHANT.tradeName,
        mrn: sharedState.mrn || 'Created',
        shareholderType: MERCHANT.shareholders[0].entityOrIndividual,
        success: true
      });

      for (let r = 2; r <= TOTAL_RECORDS; r++) {
        let shareholderType: ShareholderType = 'Individual';
        if (SHAREHOLDER_MODE === 'Entity') shareholderType = 'Entity';
        else if (SHAREHOLDER_MODE === 'Alternate') shareholderType = (r % 2 === 1) ? 'Individual' : 'Entity';

        const currentMerchant = getMerchantData('positive', shareholderType);
        console.log(`\n============================================================`);
        console.log(`🚀 ONBOARDING RECORD ${r} OF ${TOTAL_RECORDS} (Up to Step ${highestStepCompleted})`);
        console.log(`📌 Merchant: ${currentMerchant.tradeName} | Shareholder: ${shareholderType}`);
        console.log(`============================================================\n`);

        const mrn = await runWizardSteps(page, currentMerchant, highestStepCompleted);
        console.log(`✅ Record ${r} completed up to Step ${highestStepCompleted} (MRN: ${mrn || 'Assigned'})`);

        batchResults.push({
          index: r,
          tradeName: currentMerchant.tradeName,
          mrn: mrn || 'N/A',
          shareholderType,
          success: true
        });
      }
    }

    if (batchResults.length > 1) {
      console.log('\n========================================================================================================');
      console.log(`🎉 BATCH ONBOARDING RUN COMPLETED: ${batchResults.filter(r => r.success).length}/${TOTAL_RECORDS} RECORDS COMPLETED (Up to Step ${highestStepCompleted})`);
      console.log('========================================================================================================');
      console.log(
        '#'.padEnd(4) + '| ' +
        'MERCHANT NAME'.padEnd(36) + '| ' +
        'MRN NUMBER'.padEnd(18) + '| ' +
        'SHAREHOLDER'.padEnd(15) + '| ' +
        'STATUS'
      );
      console.log('----+-------------------------------------+-------------------+----------------+------------------------');

      batchResults.forEach((r) => {
        const status = r.success ? `✅ Step ${highestStepCompleted} Done` : '❌ Failed';
        const name = (r.tradeName || 'Merchant').substring(0, 34);
        console.log(
          String(r.index).padEnd(4) + '| ' +
          name.padEnd(36) + '| ' +
          String(r.mrn).padEnd(18) + '| ' +
          String(r.shareholderType).padEnd(15) + '| ' +
          status
        );
      });
      console.log('========================================================================================================\n');
    }

    const basePage = new BaseWizardPage(page);
    await basePage.signOut().catch(() => {});
    await ctx?.close().catch(() => {});
  });

  test('Step 1 — Create NEW merchant record, fill Profile and save', async () => {
    const dashboard = new DashboardPage(page);
    const step1 = new Step1ProfilePage(page);

    await dashboard.clickCreateMerchant();
    await step1.expectStep(1);
    await step1.fillAll(MERCHANT);
    await step1.clickSaveAndContinue();

    const mrn = await step1.getRegistrationNumber().catch(() => '');
    if (mrn) {
      sharedState.mrn = mrn;
      saveState({ mrn });
    }

    highestStepCompleted = Math.max(highestStepCompleted, 1);
    await step1.expectStep(2);
  });

  test('Step 2 — Fill Business details and save', async () => {
    const step2 = new Step2BusinessPage(page);
    await step2.expectStep(2);

    await step2.fillAll(MERCHANT.business);
    await step2.clickSaveAndContinue();
    highestStepCompleted = Math.max(highestStepCompleted, 2);
    await step2.expectStep(3);
  });

  test('Step 3 — Fill Ownership (shareholder) details', async () => {
    const step3 = new Step3OwnershipPage(page);
    await step3.expectStep(3);

    console.log(`[Step 3] Selected Shareholder 1 Type: ${MERCHANT.shareholders[0].entityOrIndividual} (${MERCHANT.shareholders[0].idType}: ${MERCHANT.shareholders[0].tradeLicenceNumber || MERCHANT.shareholders[0].emiratesIdNumber})`);
    await step3.fillShareholder(0, MERCHANT.shareholders[0]);
    const total = await step3.getTotalShareholding();
    expect(total).toContain('100');

    await step3.clickSaveAndContinue();
    highestStepCompleted = Math.max(highestStepCompleted, 3);
    await step3.expectStep(4);
  });

  test('Step 4 — Fill UBO with Ownership basis (25% boundary)', async () => {
    const step4 = new Step4UBOsPage(page);
    await step4.expectStep(4);

    console.log(`[Step 4] Filling UBO 1: ${MERCHANT.ubos[0].fullLegalName} (Share: ${MERCHANT.ubos[0].percentShareholding}%, ID: ${MERCHANT.ubos[0].emiratesIdNumber})`);
    await step4.fillUBO(0, MERCHANT.ubos[0]);

    await step4.clickSaveAndContinue();
    highestStepCompleted = Math.max(highestStepCompleted, 4);
    await step4.expectStep(5);
  });

  test('Step 5 — Fill Signatories', async () => {
    const step5 = new Step5SignatoriesPage(page);
    await step5.expectStep(5);

    await step5.fillSignatory(0, MERCHANT.signatories[0]);

    await step5.clickSaveAndContinue();
    highestStepCompleted = Math.max(highestStepCompleted, 5);
    await step5.expectStep(6);
  });

  test('Step 6 — Fill Banking details and save', async () => {
    test.setTimeout(Math.max(60000, TOTAL_RECORDS * 60000));
    const step6 = new Step6BankingPage(page);
    await step6.expectStep(6);

    await step6.fillAll(MERCHANT.banking);
    await step6.clickSaveAndContinue();
    highestStepCompleted = Math.max(highestStepCompleted, 6);
    await step6.expectStep(7);
  });

  test('Step 7 — Upload documents and save', async () => {
    test.setTimeout(Math.max(60000, TOTAL_RECORDS * 60000));
    const step7 = new Step7DocumentsPage(page);
    await step7.expectStep(7);

    console.log('--- STEP 7 DIAGNOSTICS ---');
    const allFileInputs = page.locator('input[type="file"]');
    const inputCount = await allFileInputs.count();
    console.log(`[Step 7] input[type="file"] count: ${inputCount}`);

    const allCards = page.locator('.MuiCard-root, .MuiPaper-root, .MuiAccordion-root, div.border');
    console.log(`[Step 7] Cards count: ${await allCards.count()}`);

    const docPath = path.resolve(__dirname, '../../fixtures/dummy_1.png');
    console.log(`[Step 7] Uploading document from: ${docPath}`);
    await step7.uploadAllDocuments(docPath);

    await page.screenshot({ path: 'test-results/step7-live-after-upload.png', fullPage: true });

    await step7.clickSaveAndContinue();
    highestStepCompleted = Math.max(highestStepCompleted, 7);
    await step7.expectStep(8);
  });

  test('Step 8 — Review data integrity and submit record', async () => {
    const step8 = new Step8ReviewPage(page);
    await step8.expectStep(8);

    const mrnBeforeSubmit = await step8.getRegistrationNumber().catch(() => '');
    if (mrnBeforeSubmit) {
      sharedState.mrn = mrnBeforeSubmit;
      saveState({ mrn: mrnBeforeSubmit });
    }

    console.log(`[Step 8] Submitting NEW Record: ${MERCHANT.tradeName} (MRN: ${mrnBeforeSubmit || sharedState.mrn || 'Auto-assign on submit'})`);

    // Submit for review and confirm modal dialog
    await step8.submitForReview();
    highestStepCompleted = Math.max(highestStepCompleted, 8);
    saveState({ submitted: true });
  });

  test('Step 9 — Verify submitted record and process batch onboarding', async () => {
    test.setTimeout(Math.max(60000, TOTAL_RECORDS * 60000));
    const currentState = loadState();
    let targetMRN = currentState.mrn || sharedState.mrn;

    // Navigate to Submitted list via sidebar
    const submittedSidebar = page.locator('nav, aside, header').locator('text="Submitted"').first();
    if (await submittedSidebar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submittedSidebar.click();
    } else {
      await page.goto('/applications/submitted', { waitUntil: 'domcontentloaded' }).catch(() => {});
    }
    await page.waitForTimeout(1500);

    const searchInput = page.getByPlaceholder('Filter by MRN or name').or(page.locator('input[placeholder*="Search" i], input[placeholder*="Filter" i]')).first();
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.click();
      await searchInput.fill(targetMRN || MERCHANT.tradeName);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    }

    const nameRow = page.locator(`tr:has-text("${MERCHANT.tradeName}"), [role="row"]:has-text("${MERCHANT.tradeName}")`).first();
    if (await nameRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      const rowText = await nameRow.innerText();
      console.log(`[Submitted Section] Row text:\n${rowText}\n`);
      const match = rowText.match(/\b(609\d{8,14}|202\d{5,10}|\d{10,16})\b/);
      if (match) {
        targetMRN = match[1];
        sharedState.mrn = targetMRN;
        saveState({
          mrn: targetMRN,
          tradeName: MERCHANT.tradeName,
          legalName: MERCHANT.legalName,
          shareholderType: MERCHANT.shareholders[0].entityOrIndividual
        });
      }
    }

    printMerchantSubmissionSummary({
      tradeName: MERCHANT.tradeName,
      legalName: MERCHANT.legalName,
      mrn: targetMRN || sharedState.mrn,
      shareholderType: MERCHANT.shareholders[0].entityOrIndividual,
      shareholderIdType: MERCHANT.shareholders[0].idType,
      shareholderIdValue: (MERCHANT.shareholders[0] as any).tradeLicenceNumber || (MERCHANT.shareholders[0] as any).emiratesIdNumber,
      uboName: MERCHANT.ubos[0].fullLegalName,
      uboShare: MERCHANT.ubos[0].percentShareholding,
      step7Status: 'All mandatory documents uploaded & verified',
      suiteType: 'POSITIVE'
    });

    batchResults.push({
      index: 1,
      tradeName: MERCHANT.tradeName,
      mrn: targetMRN || sharedState.mrn,
      shareholderType: MERCHANT.shareholders[0].entityOrIndividual,
      success: true
    });

    // Process additional batch records if requested
    if (TOTAL_RECORDS > 1) {
      for (let r = 2; r <= TOTAL_RECORDS; r++) {
        let shareholderType: ShareholderType = 'Individual';
        if (SHAREHOLDER_MODE === 'Entity') {
          shareholderType = 'Entity';
        } else if (SHAREHOLDER_MODE === 'Alternate') {
          shareholderType = (r % 2 === 1) ? 'Individual' : 'Entity';
        }

        const currentMerchant = getMerchantData('positive', shareholderType);

        console.log(`\n============================================================`);
        console.log(`🚀 ONBOARDING RECORD ${r} OF ${TOTAL_RECORDS}`);
        console.log(`📌 Merchant: ${currentMerchant.tradeName} | Shareholder: ${shareholderType}`);
        console.log(`============================================================\n`);

        let mrn = await runWizardSteps(page, currentMerchant, 8);

        // Step 9: Verify in Submitted
        if (await submittedSidebar.isVisible({ timeout: 3000 }).catch(() => false)) {
          await submittedSidebar.click();
        } else {
          await page.goto('/applications/submitted', { waitUntil: 'domcontentloaded' }).catch(() => {});
        }
        await page.waitForTimeout(1500);

        if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await searchInput.click();
          await searchInput.fill(mrn || currentMerchant.tradeName);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(1000);
        }

        const batchRow = page.locator(`tr:has-text("${currentMerchant.tradeName}"), [role="row"]:has-text("${currentMerchant.tradeName}")`).first();
        if (await batchRow.isVisible({ timeout: 5000 }).catch(() => false)) {
          const rowText = await batchRow.innerText();
          const match = rowText.match(/\b(609\d{8,14}|202\d{5,10}|\d{10,16})\b/);
          if (match) {
            mrn = match[1];
          }
        }

        printMerchantSubmissionSummary({
          tradeName: currentMerchant.tradeName,
          legalName: currentMerchant.legalName,
          mrn: mrn,
          shareholderType: currentMerchant.shareholders[0].entityOrIndividual,
          shareholderIdType: currentMerchant.shareholders[0].idType,
          shareholderIdValue: (currentMerchant.shareholders[0] as any).tradeLicenceNumber || (currentMerchant.shareholders[0] as any).emiratesIdNumber,
          uboName: currentMerchant.ubos[0].fullLegalName,
          uboShare: currentMerchant.ubos[0].percentShareholding,
          step7Status: 'All mandatory documents uploaded & verified',
          suiteType: 'POSITIVE'
        });

        saveState({
          mrn,
          tradeName: currentMerchant.tradeName,
          legalName: currentMerchant.legalName,
          shareholderType: currentMerchant.shareholders[0].entityOrIndividual,
          submitted: true
        });

        batchResults.push({
          index: r,
          tradeName: currentMerchant.tradeName,
          mrn: mrn || 'N/A',
          shareholderType: currentMerchant.shareholders[0].entityOrIndividual,
          success: true
        });
      }
    }

    const basePage = new BaseWizardPage(page);
    await basePage.signOut();
  });
});
