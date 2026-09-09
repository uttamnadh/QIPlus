import { test, expect } from '../../fixtures/diagnostics';
import { Page, BrowserContext } from '@playwright/test';
import { ComplianceQueuePage } from '../../pages/compliance-queue.page';
import { BaseWizardPage } from '../../pages/wizard/base-wizard.page';
import { MERCHANT, ROLES } from '../../fixtures/merchant-data';
import { loadRegressionState, saveRegressionState } from '../../fixtures/regression-state';

/**
 * Regression: Compliance Officer reviews and approves a submitted merchant record.
 *
 * AML SCREENING NOTE: "Approve & forward" triggers async AML screening.
 * approveMerchant() now also verifies the toast: "Decision recorded: Approve & forward."
 */
test.describe.serial('02 — Compliance Officer Regression Review', () => {
  let ctx: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    ctx = await browser.newContext();
    page = await ctx.newPage();

    // Login as Compliance Officer (bhanu)
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[name="username"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.fill('input[name="username"]', ROLES.compliance.username);
    await page.fill('input[name="password"]', ROLES.compliance.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.href.includes('/login'), { timeout: 15000 }).catch(() => {});
  });

  test.afterAll(async () => {
    await ctx?.close();
  });

  test('Compliance Officer inspects & approves the regression record (AML toast verified)', async () => {
    const state = loadRegressionState();
    const targetMRN = state.mrn;
    expect(targetMRN, 'Target MRN from Step 1 must be present').toBeTruthy();

    const queue = new ComplianceQueuePage(page);
    await queue.navigateToVerificationQueue();
    await queue.openMerchant(targetMRN);

    // Verify compliance review page displays expected trade name
    const record = state.records.find(r => r.mrn === targetMRN) || state.records[0];
    if (record?.tradeName) {
      await queue.expectTradeName(record.tradeName);
    }

    // Write decision notes and click Approve & forward
    // approveMerchant() confirms dialog and verifies toast: "Decision recorded: Approve & forward."
    console.log(`[REGRESSION] Compliance approving MRN: ${targetMRN}`);
    await queue.approveMerchant('Compliance regression verification passed after document check.');
  });

  test('eMcREY AML Screening Polling: Refresh >5 times until record appears in Approved section', async () => {
    test.setTimeout(90000);
    const state = loadRegressionState();
    const targetMRN = state.mrn;
    expect(targetMRN, 'Target MRN from Step 1 must be present').toBeTruthy();

    const queue = new ComplianceQueuePage(page);

    // eMcREY AML SCREENING: "Approve & forward" submits to eMcREY asynchronously.
    // Refresh >5 times (up to 10 attempts, 5s delay) until record arrives in Approved section.
    console.log(`[REGRESSION] Polling Compliance Approved section for MRN ${targetMRN} (waiting for eMcREY screening)...`);
    const result = await queue.waitForRecordInApproved(targetMRN, 10, 5000);

    expect(result.found, `MRN ${targetMRN} was not found in Compliance Approved section after eMcREY screening polling`).toBe(true);

    console.log(`[REGRESSION] ✅ MRN ${targetMRN} successfully passed eMcREY screening and is present in Compliance Approved section.`);

    // Persist complianceApproved flag
    saveRegressionState({ complianceApproved: true });

    const basePage = new BaseWizardPage(page);
    await basePage.signOut();
  });
});
