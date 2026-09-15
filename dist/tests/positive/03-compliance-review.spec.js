"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const diagnostics_1 = require("../../fixtures/diagnostics");
const login_page_1 = require("../../pages/login.page");
const compliance_queue_page_1 = require("../../pages/compliance-queue.page");
const base_wizard_page_1 = require("../../pages/wizard/base-wizard.page");
const merchant_data_1 = require("../../fixtures/merchant-data");
/**
 * Scenario 3: Compliance officer (bhanu) reviews the submitted merchant.
 *
 * AML SCREENING NOTE: "Approve & forward" triggers asynchronous screening by eMcREY.
 * The spec verifies the toast notification, then polls the Compliance Approved section
 * >5 times until the record transitions out of "Pending Screening" into
 * "Pending final approval" or "Under compliance review".
 */
diagnostics_1.test.describe.serial('03 — Compliance review', () => {
    let ctx;
    let page;
    diagnostics_1.test.beforeAll(async ({ browser }) => {
        const currentState = (0, merchant_data_1.loadState)();
        if (!currentState.mrn || !currentState.submitted) {
            console.log('⚠️ [Compliance Skip] Onboarding officer did not submit an MRN. Skipping Compliance review without logging in.');
            return;
        }
        ctx = await browser.newContext();
        page = await ctx.newPage();
        // Login as compliance officer (bhanu) with automated MFA TOTP handling
        const loginPage = new login_page_1.LoginPage(page);
        await loginPage.navigate();
        await loginPage.login(merchant_data_1.ROLES.compliance.username, merchant_data_1.ROLES.compliance.password, merchant_data_1.ROLES.compliance.totpSecret);
        await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => { });
    });
    diagnostics_1.test.afterAll(async () => {
        await ctx?.close();
    });
    (0, diagnostics_1.test)('Search submitted record in Verification Queue, write decision notes, approve & forward', async () => {
        const currentState = (0, merchant_data_1.loadState)();
        diagnostics_1.test.skip(!currentState.mrn || !currentState.submitted, 'Onboarding officer did not submit an MRN record.');
        const queue = new compliance_queue_page_1.ComplianceQueuePage(page);
        const targetMRN = currentState.mrn;
        console.log(`[Compliance] Searching for submitted MRN: ${targetMRN}`);
        await queue.navigateToVerificationQueue();
        await queue.openMerchant(targetMRN);
        // Verify submitted MRN record details are displayed
        await (0, diagnostics_1.expect)(page.locator(`text="${targetMRN}"`).first()).toBeVisible({ timeout: 5000 });
        if (currentState.tradeName) {
            await queue.expectTradeName(currentState.tradeName);
        }
        // Write decision notes and approve & forward
        // approveMerchant() fills mandatory decision notes, confirms modal, and verifies "Decision recorded" toast
        console.log(`[Compliance] Writing decision notes and approving MRN: ${targetMRN}`);
        await queue.approveMerchant('Approved by compliance officer after verifying all documents.');
        (0, merchant_data_1.saveState)({ complianceApproved: true });
        console.log('\n============================================================');
        console.log('✅ [POSITIVE] COMPLIANCE REVIEW AUDITED & APPROVED!');
        console.log(`📄 MRN NUMBER    : ${targetMRN}`);
        console.log('📝 DECISION      : Approved & Forwarded to Final Approver');
        console.log('============================================================\n');
    });
    (0, diagnostics_1.test)('eMcREY AML Screening Polling: Refresh >5 times until record appears in Approved section', async () => {
        diagnostics_1.test.setTimeout(90000);
        const currentState = (0, merchant_data_1.loadState)();
        diagnostics_1.test.skip(!currentState.mrn || !currentState.complianceApproved, 'Compliance review did not approve an MRN record.');
        const targetMRN = currentState.mrn;
        const queue = new compliance_queue_page_1.ComplianceQueuePage(page);
        // eMcREY AML SCREENING: "Approve & forward" submits to eMcREY asynchronously.
        // Refresh >5 times (up to 10 attempts, 5s delay) until record arrives in Approved section
        // and transitions out of "Pending Screening" into "Pending final approval" or "Under compliance review".
        console.log(`[POSITIVE] Polling Compliance Approved section for MRN ${targetMRN} (waiting for eMcREY screening)...`);
        const result = await queue.waitForRecordInApproved(targetMRN, 10, 5000);
        (0, diagnostics_1.expect)(result.found, `MRN ${targetMRN} was not found in Compliance Approved section after eMcREY screening polling`).toBe(true);
        console.log(`[POSITIVE] ✅ MRN ${targetMRN} successfully passed eMcREY screening and is present in Compliance Approved section.`);
        const basePage = new base_wizard_page_1.BaseWizardPage(page);
        await basePage.signOut();
    });
});
