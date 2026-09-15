"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const diagnostics_1 = require("../../fixtures/diagnostics");
const compliance_queue_page_1 = require("../../pages/compliance-queue.page");
const base_wizard_page_1 = require("../../pages/wizard/base-wizard.page");
const merchant_data_1 = require("../../fixtures/merchant-data");
const regression_state_1 = require("../../fixtures/regression-state");
/**
 * Regression: Compliance Officer reviews and approves a submitted merchant record.
 *
 * AML SCREENING NOTE: "Approve & forward" triggers async AML screening.
 * approveMerchant() now also verifies the toast: "Decision recorded: Approve & forward."
 */
diagnostics_1.test.describe.serial('02 — Compliance Officer Regression Review', () => {
    let ctx;
    let page;
    diagnostics_1.test.beforeAll(async ({ browser }) => {
        ctx = await browser.newContext();
        page = await ctx.newPage();
        // Login as Compliance Officer (bhanu)
        await page.goto('/login', { waitUntil: 'domcontentloaded' });
        await page.locator('input[name="username"]').waitFor({ state: 'visible', timeout: 10000 });
        await page.fill('input[name="username"]', merchant_data_1.ROLES.compliance.username);
        await page.fill('input[name="password"]', merchant_data_1.ROLES.compliance.password);
        await page.click('button[type="submit"]');
        await page.waitForURL(url => !url.href.includes('/login'), { timeout: 15000 }).catch(() => { });
    });
    diagnostics_1.test.afterAll(async () => {
        await ctx?.close();
    });
    (0, diagnostics_1.test)('Compliance Officer inspects & approves the regression record (AML toast verified)', async () => {
        const state = (0, regression_state_1.loadRegressionState)();
        const targetMRN = state.mrn;
        (0, diagnostics_1.expect)(targetMRN, 'Target MRN from Step 1 must be present').toBeTruthy();
        const queue = new compliance_queue_page_1.ComplianceQueuePage(page);
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
    (0, diagnostics_1.test)('eMcREY AML Screening Polling: Refresh >5 times until record appears in Approved section', async () => {
        diagnostics_1.test.setTimeout(90000);
        const state = (0, regression_state_1.loadRegressionState)();
        const targetMRN = state.mrn;
        (0, diagnostics_1.expect)(targetMRN, 'Target MRN from Step 1 must be present').toBeTruthy();
        const queue = new compliance_queue_page_1.ComplianceQueuePage(page);
        // eMcREY AML SCREENING: "Approve & forward" submits to eMcREY asynchronously.
        // Refresh >5 times (up to 10 attempts, 5s delay) until record arrives in Approved section.
        console.log(`[REGRESSION] Polling Compliance Approved section for MRN ${targetMRN} (waiting for eMcREY screening)...`);
        const result = await queue.waitForRecordInApproved(targetMRN, 10, 5000);
        (0, diagnostics_1.expect)(result.found, `MRN ${targetMRN} was not found in Compliance Approved section after eMcREY screening polling`).toBe(true);
        console.log(`[REGRESSION] ✅ MRN ${targetMRN} successfully passed eMcREY screening and is present in Compliance Approved section.`);
        // Persist complianceApproved flag
        (0, regression_state_1.saveRegressionState)({ complianceApproved: true });
        const basePage = new base_wizard_page_1.BaseWizardPage(page);
        await basePage.signOut();
    });
});
