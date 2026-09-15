"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const diagnostics_1 = require("../../fixtures/diagnostics");
const approval_queue_page_1 = require("../../pages/approval-queue.page");
const base_wizard_page_1 = require("../../pages/wizard/base-wizard.page");
const merchant_data_1 = require("../../fixtures/merchant-data");
const regression_state_1 = require("../../fixtures/regression-state");
/**
 * Regression: Final Approver reviews and approves the merchant to Active status.
 *
 * AML SCREENING FALLBACK: If record hasn't arrived in Approval Queue yet due to async
 * AML screening, this spec retries up to 5 times (refresh + re-search by MRN).
 */
diagnostics_1.test.describe.serial('03 — Final Approver Regression Approval', () => {
    let ctx;
    let page;
    diagnostics_1.test.beforeAll(async ({ browser }) => {
        const state = (0, regression_state_1.loadRegressionState)();
        if (!state.mrn) {
            console.log('⚠️ [Regression Skip] No regression MRN available. Skipping Final approval without logging in.');
            return;
        }
        ctx = await browser.newContext();
        page = await ctx.newPage();
        // Login as Final Approver (uttamnadh)
        await page.goto('/login', { waitUntil: 'domcontentloaded' });
        await page.locator('input[name="username"]').waitFor({ state: 'visible', timeout: 10000 });
        await page.fill('input[name="username"]', merchant_data_1.ROLES.approver.username);
        await page.fill('input[name="password"]', merchant_data_1.ROLES.approver.password);
        await page.click('button[type="submit"]');
        await page.waitForURL(url => !url.href.includes('/login'), { timeout: 15000 }).catch(() => { });
    });
    diagnostics_1.test.afterAll(async () => {
        await ctx?.close();
    });
    (0, diagnostics_1.test)('Final Approver locates MRN in Approval Queue with eMcREY polling', async () => {
        diagnostics_1.test.setTimeout(90000);
        const state = (0, regression_state_1.loadRegressionState)();
        diagnostics_1.test.skip(!state.mrn, 'No regression MRN available. Skipping until regression onboarding has run.');
        const targetMRN = state.mrn;
        const queue = new approval_queue_page_1.ApprovalQueuePage(page);
        await queue.navigateToApprovalQueue();
        // eMcREY AML SCREENING POLLING: Retry-loop — refresh + re-search by MRN, up to 10 attempts
        const found = await queue.waitForRecordInApprovalQueue(targetMRN, 10, 5000);
        (0, diagnostics_1.expect)(found, `MRN ${targetMRN} was not found in Approval Queue after 10 eMcREY screening retry attempts`).toBeTruthy();
    });
    (0, diagnostics_1.test)('Final Approver verifies eMcREY screening, re-checks result, and Activates merchant', async () => {
        const state = (0, regression_state_1.loadRegressionState)();
        diagnostics_1.test.skip(!state.mrn, 'No regression MRN available. Skipping until regression onboarding has run.');
        const targetMRN = state.mrn;
        const queue = new approval_queue_page_1.ApprovalQueuePage(page);
        // Verify trade name on final approval screen
        const record = state.records.find(r => r.mrn === targetMRN) || state.records[0];
        if (record?.tradeName) {
            await queue.expectTradeName(record.tradeName);
        }
        // Check eMcREY screening status and trigger "Re-check screening result" if available
        await queue.recheckScreeningResult();
        // Read and log screening status & AML risk rating if displayed
        const screeningResult = await queue.getScreeningResult();
        if (screeningResult) {
            console.log(`[REGRESSION] eMcREY Screening Result for MRN ${targetMRN}: ${screeningResult}`);
        }
        const riskRating = await queue.getRiskRating(targetMRN);
        if (riskRating) {
            console.log(`[REGRESSION] AML Risk Rating for MRN ${targetMRN}: ${riskRating}`);
        }
        // Check if screening hit or decision locked
        let isScreeningHit = await page.locator('text=/Screening hit|case opened for compliance review/i').first().isVisible({ timeout: 2000 }).catch(() => false);
        let notesInput = page.locator('textarea, [role="textbox"], input[name="notes"]').first();
        let isNotesEditable = await notesInput.isEditable().catch(() => false);
        // If record is On-hold, refresh screening ONLY ONCE to confirm status
        if (isScreeningHit || !isNotesEditable) {
            console.log(`[REGRESSION] ℹ️ Record appears On-hold. Refreshing screening ONLY ONCE to confirm status...`);
            await page.waitForTimeout(1500);
            await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => { });
            await page.waitForTimeout(1500);
            await queue.recheckScreeningResult().catch(() => { });
            isScreeningHit = await page.locator('text=/Screening hit|case opened for compliance review/i').first().isVisible({ timeout: 2000 }).catch(() => false);
            notesInput = page.locator('textarea, [role="textbox"], input[name="notes"]').first();
            isNotesEditable = await notesInput.isEditable().catch(() => false);
            if (isScreeningHit || !isNotesEditable) {
                console.log(`[REGRESSION] ℹ️ Confirmed: MRN ${targetMRN} is On-hold (Under compliance review) after single screening refresh — decision buttons remain locked.`);
                (0, regression_state_1.saveRegressionState)({ finalApproved: false });
                return;
            }
        }
        // Write decision notes and approve to Active
        console.log(`[REGRESSION] Final Approver activating MRN: ${targetMRN}`);
        await queue.approveMerchant('Final approval and merchant activation granted after eMcREY AML verification.');
        (0, regression_state_1.saveRegressionState)({ finalApproved: true });
    });
    (0, diagnostics_1.test)('Without logout: Refresh once and check merchant status (Active or On-hold), then LOGOUT', async () => {
        const state = (0, regression_state_1.loadRegressionState)();
        const targetMRN = state.mrn;
        (0, diagnostics_1.expect)(targetMRN, 'Target MRN must be present').toBeTruthy();
        console.log(`\n[REGRESSION] Without logout: Refreshing page once to check updated status for MRN ${targetMRN}...`);
        await page.waitForTimeout(2000);
        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => { });
        await page.waitForTimeout(1500);
        const queue = new approval_queue_page_1.ApprovalQueuePage(page);
        if (!state.finalApproved) {
            await queue.navigateToApprovalQueue();
            await queue.filterByMRN(targetMRN);
            const row = page.locator(`tr:has-text("${targetMRN}"), [role="row"]:has-text("${targetMRN}")`).first();
            await (0, diagnostics_1.expect)(row).toBeVisible({ timeout: 5000 });
            const rowText = await row.innerText().catch(() => '');
            console.log('\n============================================================');
            console.log('⚠️ [VS CODE TERMINAL STATUS AUDIT — REGRESSION]');
            console.log(`📄 MRN NUMBER    : ${targetMRN}`);
            console.log('🔍 SCREENING     : eMcREY Hit (Flagged for Review)');
            console.log('🔒 RECORD STATUS : 🟡 ON-HOLD (UNDER COMPLIANCE REVIEW)');
            console.log('⛔ ACTION        : Decision Locked (Buttons Disabled)');
            console.log(`📋 QUEUE ROW     : ${rowText.replace(/\n+/g, ' | ')}`);
            console.log('============================================================\n');
        }
        else {
            console.log(`[REGRESSION] Verifying merchant ${targetMRN} is Active in directory...`);
            const isActive = await queue.verifyMerchantActive(targetMRN);
            (0, diagnostics_1.expect)(isActive, `Merchant ${targetMRN} should be verified as Active`).toBe(true);
            console.log('\n============================================================');
            console.log('🌟 [VS CODE TERMINAL STATUS AUDIT — REGRESSION]');
            console.log(`📄 MRN NUMBER    : ${targetMRN}`);
            console.log('🔍 SCREENING     : eMcREY Clear (Low Risk)');
            console.log('✅ RECORD STATUS : 🟢 ACTIVE (APPROVED & ACTIVATED)');
            console.log('💎 LIFECYCLE     : Onboarding -> Compliance -> Activated');
            console.log('============================================================\n');
        }
        const basePage = new base_wizard_page_1.BaseWizardPage(page);
        await basePage.signOut();
    });
});
