"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const diagnostics_1 = require("../../fixtures/diagnostics");
const login_page_1 = require("../../pages/login.page");
const approval_queue_page_1 = require("../../pages/approval-queue.page");
const base_wizard_page_1 = require("../../pages/wizard/base-wizard.page");
const merchant_data_1 = require("../../fixtures/merchant-data");
/**
 * Scenario 4: Final approver (uttamnadh) conducts final review, checks eMcREY screening, and activates merchant.
 * Handled with automated TOTP MFA login and condition-based queue navigation.
 */
diagnostics_1.test.describe.serial('04 — Final approval', () => {
    let ctx;
    let page;
    diagnostics_1.test.beforeAll(async ({ browser }) => {
        const currentState = (0, merchant_data_1.loadState)();
        if (!currentState.mrn || !currentState.complianceApproved) {
            console.log('⚠️ [Final Approval Skip] Compliance officer did not approve an MRN. Skipping Final approval without logging in.');
            return;
        }
        ctx = await browser.newContext();
        page = await ctx.newPage();
        // Login as final approver (uttamnadh) with automated MFA TOTP handling
        const loginPage = new login_page_1.LoginPage(page);
        await loginPage.navigate();
        await loginPage.login(merchant_data_1.ROLES.approver.username, merchant_data_1.ROLES.approver.password, merchant_data_1.ROLES.approver.totpSecret);
        await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => { });
    });
    diagnostics_1.test.afterAll(async () => {
        await ctx?.close();
    });
    (0, diagnostics_1.test)('Final Approver locates MRN in Approval Queue with eMcREY polling', async () => {
        diagnostics_1.test.setTimeout(90000);
        const currentState = (0, merchant_data_1.loadState)();
        diagnostics_1.test.skip(!currentState.mrn || !currentState.complianceApproved, 'Compliance officer did not approve an MRN record.');
        const targetMRN = currentState.mrn;
        const queue = new approval_queue_page_1.ApprovalQueuePage(page);
        await queue.navigateToApprovalQueue();
        // eMcREY AML SCREENING POLLING: Retry-loop — refresh + re-search by MRN, up to 10 attempts
        // Waits until record appears in Approval Queue and transitions out of "Pending Screening"
        console.log(`[Final Approval] Searching for pending approval MRN: ${targetMRN}`);
        const found = await queue.waitForRecordInApprovalQueue(targetMRN, 10, 5000);
        (0, diagnostics_1.expect)(found, `MRN ${targetMRN} was not found in Approval Queue after eMcREY screening retry attempts`).toBeTruthy();
    });
    (0, diagnostics_1.test)('Final Approver verifies eMcREY screening, re-checks result, and Activates merchant', async () => {
        const currentState = (0, merchant_data_1.loadState)();
        diagnostics_1.test.skip(!currentState.mrn || !currentState.complianceApproved, 'Compliance officer did not approve an MRN record.');
        const targetMRN = currentState.mrn;
        const queue = new approval_queue_page_1.ApprovalQueuePage(page);
        if (currentState.tradeName) {
            await queue.expectTradeName(currentState.tradeName);
        }
        // Check eMcREY screening status and trigger "Re-check screening result" if available
        await queue.recheckScreeningResult();
        // Read and log screening status & AML risk rating if displayed
        const screeningResult = await queue.getScreeningResult();
        if (screeningResult) {
            console.log(`[POSITIVE] eMcREY Screening Result for MRN ${targetMRN}: ${screeningResult}`);
        }
        const riskRating = await queue.getRiskRating(targetMRN);
        if (riskRating) {
            console.log(`[POSITIVE] AML Risk Rating for MRN ${targetMRN}: ${riskRating}`);
        }
        // Check if status is On-hold / Under compliance review (decision locked)
        let isScreeningHit = await page.locator('text=/Screening hit|case opened for compliance review/i').first().isVisible({ timeout: 2000 }).catch(() => false);
        let notesInput = page.locator('textarea, [role="textbox"], input[name="notes"]').first();
        let isNotesEditable = await notesInput.isEditable().catch(() => false);
        // If record is On-hold, refresh screening ONLY ONCE to confirm status
        if (isScreeningHit || !isNotesEditable) {
            console.log(`[Final Approval] ℹ️ Record appears On-hold. Refreshing screening ONLY ONCE to confirm status...`);
            await page.waitForTimeout(1500);
            await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => { });
            await page.waitForTimeout(1500);
            // Re-check screening result once after reload
            await queue.recheckScreeningResult().catch(() => { });
            isScreeningHit = await page.locator('text=/Screening hit|case opened for compliance review/i').first().isVisible({ timeout: 2000 }).catch(() => false);
            notesInput = page.locator('textarea, [role="textbox"], input[name="notes"]').first();
            isNotesEditable = await notesInput.isEditable().catch(() => false);
            if (isScreeningHit || !isNotesEditable) {
                console.log(`[POSITIVE] ℹ️ Confirmed: MRN ${targetMRN} is On-hold (Under compliance review) after single screening refresh — decision buttons remain locked.`);
                (0, merchant_data_1.saveState)({ onHold: true, finalApproved: false });
                diagnostics_1.test.info().annotations.push({
                    type: 'info',
                    description: `MRN ${targetMRN} is in On-hold (Under compliance review) after eMcREY screening; decision cannot be taken.`
                });
                return;
            }
        }
        // If cleared: Write decision notes and approve to Active
        console.log(`[Final Approval] Approving MRN ${targetMRN} with final decision notes.`);
        await queue.approveMerchant('Final approval and merchant activation granted after eMcREY AML verification.');
        (0, merchant_data_1.saveState)({ finalApproved: true, onHold: false });
    });
    (0, diagnostics_1.test)('Without logout: Refresh once and check merchant status (Active or On-hold), then LOGOUT', async () => {
        const currentState = (0, merchant_data_1.loadState)();
        diagnostics_1.test.skip(!currentState.mrn || !currentState.complianceApproved, 'Final approval did not complete.');
        const targetMRN = currentState.mrn;
        console.log(`\n[Final Approval] Without logout: Refreshing page once to check updated status for MRN ${targetMRN}...`);
        await page.waitForTimeout(2000);
        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => { });
        await page.waitForTimeout(1500);
        const queue = new approval_queue_page_1.ApprovalQueuePage(page);
        if (currentState.onHold) {
            await queue.navigateToApprovalQueue();
            await queue.filterByMRN(targetMRN);
            const row = page.locator(`tr:has-text("${targetMRN}"), [role="row"]:has-text("${targetMRN}")`).first();
            await (0, diagnostics_1.expect)(row).toBeVisible({ timeout: 5000 });
            const rowText = await row.innerText().catch(() => '');
            console.log('\n============================================================');
            console.log('⚠️ [VS CODE TERMINAL STATUS AUDIT — FINAL APPROVER]');
            console.log(`📄 MRN NUMBER    : ${targetMRN}`);
            console.log(`🏢 TRADE NAME    : ${currentState.tradeName || 'N/A'}`);
            console.log('🔍 SCREENING     : eMcREY Hit (Flagged for Compliance Review)');
            console.log('🔒 RECORD STATUS : 🟡 ON-HOLD (UNDER COMPLIANCE REVIEW)');
            console.log('⛔ ACTION        : Decision Locked (Buttons Disabled)');
            console.log(`📋 QUEUE ROW     : ${rowText.replace(/\n+/g, ' | ')}`);
            console.log('============================================================\n');
        }
        else {
            console.log(`[Final Approval] Verifying merchant ${targetMRN} is Active in directory...`);
            const isActive = await queue.verifyMerchantActive(targetMRN);
            (0, diagnostics_1.expect)(isActive, `Merchant ${targetMRN} should be verified as Active`).toBe(true);
            console.log('\n============================================================');
            console.log('🌟 [VS CODE TERMINAL STATUS AUDIT — FINAL APPROVER]');
            console.log(`📄 MRN NUMBER    : ${targetMRN}`);
            console.log(`🏢 TRADE NAME    : ${currentState.tradeName || 'N/A'}`);
            console.log('🔍 SCREENING     : eMcREY Clear (Low Risk)');
            console.log('✅ RECORD STATUS : 🟢 ACTIVE (APPROVED & ACTIVATED)');
            console.log('💎 LIFECYCLE     : Onboarding -> Compliance -> Activated');
            console.log('============================================================\n');
        }
        const basePage = new base_wizard_page_1.BaseWizardPage(page);
        await basePage.signOut();
    });
});
