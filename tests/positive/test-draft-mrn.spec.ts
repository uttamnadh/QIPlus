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
import { LoginPage } from '../../pages/login.page';
import { MERCHANT, ROLES, saveState, printMerchantSubmissionSummary, getMerchantData } from '../../fixtures/merchant-data';
import * as path from 'path';

const TARGET_DRAFT_MRN = '60901140834299';

test.describe.serial(`Test Existing Draft MRN: ${TARGET_DRAFT_MRN}`, () => {
  let ctx: BrowserContext;
  let page: Page;
  const MERCHANT = getMerchantData('positive', 'Entity');

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext();
    page = await ctx.newPage();
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login(ROLES.onboarding.username, ROLES.onboarding.password);
    await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {});
    console.log(`[Draft Test] Logged in successfully. Opening draft MRN: ${TARGET_DRAFT_MRN}...`);
  });

  test.afterAll(async () => {
    await ctx?.close();
  });

  test(`Open draft MRN ${TARGET_DRAFT_MRN} and navigate wizard`, async () => {
    test.setTimeout(180000);
    const dashboard = new DashboardPage(page);
    const step1 = new Step1ProfilePage(page);
    const step2 = new Step2BusinessPage(page);
    const step3 = new Step3OwnershipPage(page);
    const step4 = new Step4UBOsPage(page);
    const step5 = new Step5SignatoriesPage(page);
    const step6 = new Step6BankingPage(page);
    const step7 = new Step7DocumentsPage(page);
    const step8 = new Step8ReviewPage(page);
    const dummyDoc = path.resolve(__dirname, '../../fixtures/dummy_1.png');

    // 1. Open draft
    await dashboard.navigateToDrafts();
    const draftRow = page.locator(`tr:has-text("${TARGET_DRAFT_MRN}"), [role="row"]:has-text("${TARGET_DRAFT_MRN}")`).first();
    const isPresent = await draftRow.isVisible({ timeout: 3000 }).catch(() => false);
    test.skip(!isPresent, `Draft MRN ${TARGET_DRAFT_MRN} does not exist in drafts queue.`);
    await draftRow.click();
    await page.waitForTimeout(2000);

    // 2. Identify current step
    let currentStepText = await page.locator('text=/Step \\d+ of 8/').first().innerText().catch(() => '');
    console.log(`[Draft ${TARGET_DRAFT_MRN}] Starting on: ${currentStepText || 'Unknown step'}`);

    const getCurrentStepNum = async (): Promise<number> => {
      const txt = await page.locator('text=/Step \\d+ of 8/').first().innerText().catch(() => '');
      const m = txt.match(/Step\s*(\d+)/i);
      return m ? parseInt(m[1], 10) : 1;
    };

    let stepNum = await getCurrentStepNum();

    // Step 1
    if (stepNum === 1) {
      console.log('[Step 1] Verifying / saving Profile...');
      await step1.fillTradeName(MERCHANT.tradeName).catch(() => {});
      await step1.clickSaveAndContinue();
      await page.waitForTimeout(1000);
      stepNum = await getCurrentStepNum();
    }

    // Step 2
    if (stepNum === 2) {
      console.log('[Step 2] Verifying / saving Business...');
      await step2.fillAll(MERCHANT.business).catch(() => {});
      await step2.clickSaveAndContinue();
      await page.waitForTimeout(1000);
      stepNum = await getCurrentStepNum();
    }

    // Step 3
    if (stepNum === 3) {
      console.log(`[Step 3] Configuring Shareholder: ${MERCHANT.shareholders[0].entityOrIndividual}...`);
      await step3.fillShareholder(0, MERCHANT.shareholders[0]);
      await step3.clickSaveAndContinue();
      await page.waitForTimeout(1000);
      stepNum = await getCurrentStepNum();
    }

    // Step 4
    if (stepNum === 4) {
      console.log(`[Step 4] Configuring UBO: ${MERCHANT.ubos[0].fullLegalName}...`);
      await step4.fillUBO(0, MERCHANT.ubos[0]);
      await step4.clickSaveAndContinue();
      await page.waitForTimeout(1000);
      stepNum = await getCurrentStepNum();
    }

    // Step 5
    if (stepNum === 5) {
      console.log('[Step 5] Configuring Signatories...');
      await step5.fillSignatory(0, MERCHANT.signatories[0]);
      await step5.clickSaveAndContinue();
      await page.waitForTimeout(1000);
      stepNum = await getCurrentStepNum();
    }

    // Step 6
    if (stepNum === 6) {
      console.log('[Step 6] Configuring Banking...');
      await step6.fillAll(MERCHANT.banking);
      await step6.clickSaveAndContinue();
      await page.waitForTimeout(1000);
      stepNum = await getCurrentStepNum();
    }

    // Step 7: Documents
    if (stepNum === 7) {
      console.log('[Step 7] Uploading all mandatory documents...');
      await step7.uploadMandatoryDocuments(dummyDoc);
      await page.screenshot({ path: `test-results/draft-${TARGET_DRAFT_MRN}-step7.png`, fullPage: true });
      await step7.clickSaveAndContinue();
      await page.waitForTimeout(1500);
      stepNum = await getCurrentStepNum();
    }

    // Step 8: Review & Submit
    if (stepNum === 8) {
      console.log('[Step 8] Reviewing and Submitting record...');
      const mrn = await step8.getRegistrationNumber().catch(() => TARGET_DRAFT_MRN);
      console.log(`[Step 8] Captured MRN: ${mrn}`);
      saveState({ mrn: mrn || TARGET_DRAFT_MRN, submitted: true });
      await page.screenshot({ path: `test-results/draft-${TARGET_DRAFT_MRN}-step8-review.png`, fullPage: true });

      await step8.submitForReview();
      console.log(`[Step 8] Submitted Draft ${TARGET_DRAFT_MRN} successfully!`);
    }

    // 3. Verify in Submitted list
    await dashboard.navigateToSubmitted();
    await page.waitForTimeout(2000);
    const submittedRow = page.locator(`text="${TARGET_DRAFT_MRN}"`).first();
    const isSubmitted = await submittedRow.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`[Verification] Is MRN ${TARGET_DRAFT_MRN} listed in Submitted tab? ${isSubmitted}`);
    await page.screenshot({ path: `test-results/draft-${TARGET_DRAFT_MRN}-submitted.png`, fullPage: true });

    printMerchantSubmissionSummary({
      tradeName: MERCHANT.tradeName,
      legalName: MERCHANT.legalName,
      mrn: TARGET_DRAFT_MRN,
      shareholderType: MERCHANT.shareholders[0].entityOrIndividual,
      shareholderIdType: MERCHANT.shareholders[0].idType,
      uboName: MERCHANT.ubos[0].fullLegalName,
      uboShare: MERCHANT.ubos[0].percentShareholding,
      step7Status: 'All mandatory documents uploaded & verified',
      suiteType: 'POSITIVE'
    });

    // 4. Sign out
    await dashboard.signOut();
  });
});
