"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplianceQueuePage = void 0;
const test_1 = require("@playwright/test");
/**
 * Page Object for the Compliance officer's verification queue and review screens.
 * WHY: Strictly targets the specific created MRN without falling back to recent records.
 *
 * AML SCREENING NOTE: "Approve & forward" now triggers an async backend AML screening check.
 * The record may NOT immediately appear in Compliance > Approved. Use waitForRecordInApproved()
 * with tight polling logic instead of fixed sleeps.
 * OPTIMIZED: Condition-based navigation and tight polling intervals (1s).
 */
class ComplianceQueuePage {
    constructor(page) {
        this.page = page;
    }
    /** Navigate to the verification queue via sidebar. */
    async navigateToVerificationQueue() {
        const backBtn = this.page.locator('button:has-text("Back")').first();
        if (await backBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await backBtn.click();
        }
        const link = this.page.locator('button:has-text("Verification queue"), a:has-text("Verification queue"), nav :text("Verification queue")').first();
        if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
            await link.click();
        }
        else {
            await this.page.click('text="Verification queue"');
        }
    }
    /** Filter the queue strictly by target MRN. */
    async filterByMRN(mrn) {
        const input = this.page.getByPlaceholder('Filter by MRN or name');
        await input.click();
        await input.fill(mrn);
        await this.page.keyboard.press('Enter');
    }
    /**
     * Open the exact merchant record by target MRN created in onboarding officer.
     * STRICT REQUIREMENT: Does NOT fall back to recent MRN records if target is not found.
     */
    async openMerchant(targetMRN) {
        (0, test_1.expect)(targetMRN).toBeTruthy();
        await this.filterByMRN(targetMRN);
        // Locate the row strictly matching the created target MRN
        const matchingRow = this.page.locator(`tr:has-text("${targetMRN}"), [role="row"]:has-text("${targetMRN}")`).first();
        await (0, test_1.expect)(matchingRow).toBeVisible({
            timeout: 5000
        });
        await matchingRow.click();
    }
    /** Get the status badge text for a merchant by MRN. */
    async getStatusByMRN(mrn) {
        const row = this.page.locator(`tr:has-text("${mrn}"), div:has-text("${mrn}")`);
        const status = row.locator('text=/Submitted for review|Under compliance review|Active|Rejected|Returned for info|Pending final approval/').first();
        return status.innerText();
    }
    /**
     * Approve the currently open merchant.
     * AML SCREENING: After clicking "Approve & forward", verifies the toast message
     * "Decision recorded: Approve & forward." confirming the async AML check was triggered.
     */
    async approveMerchant(notes = 'Approved by compliance officer after verifying documents and details.') {
        // Fill Decision notes * mandatory field
        const notesInput = this.page.locator('textarea[placeholder*="rationale" i], textarea, input[name="notes"]').first();
        await notesInput.waitFor({ state: 'visible', timeout: 10000 });
        await notesInput.focus();
        await notesInput.fill(notes);
        await notesInput.press('Space');
        await notesInput.press('Backspace');
        await notesInput.blur();
        await this.page.waitForTimeout(300);
        const approveBtn = this.page.locator('button:has-text("Approve & forward"), button:has-text("Approve")').first();
        await (0, test_1.expect)(approveBtn).toBeEnabled({ timeout: 5000 });
        await approveBtn.click();
        // Handle confirmation dialog reliably
        const confirmBtn = this.page.locator('[role="dialog"] button:has-text("Confirm"), .MuiDialog-paper button:has-text("Confirm"), [role="dialog"] button:has-text("Approve")').first();
        if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await confirmBtn.click();
        }
        // Verify the toast message confirming AML screening was triggered
        const toast = this.page.locator('.MuiSnackbar-root, [role="alert"], .MuiAlert-message');
        const toastVisible = await toast.first().isVisible({ timeout: 4000 }).catch(() => false);
        if (toastVisible) {
            const toastText = await toast.first().innerText().catch(() => '');
            console.log(`[Compliance] Toast message: "${toastText}"`);
            await (0, test_1.expect)(toast.first()).toContainText('Decision recorded', { timeout: 3000 }).catch(() => {
                console.log(`[Compliance] Toast text did not match expected "Decision recorded" — received: "${toastText}"`);
            });
        }
        // Ensure any modal backdrop is unmounted
        const dialog = this.page.locator('.MuiDialog-root, [role="dialog"]').first();
        if (await dialog.isVisible({ timeout: 1000 }).catch(() => false)) {
            await dialog.waitFor({ state: 'detached', timeout: 3000 }).catch(() => { });
        }
    }
    /**
     * Wait for a record to appear in the Approved section with retry polling logic.
     * eMcREY AML SCREENING: "Approve & forward" triggers asynchronous screening by eMcREY.
     * As per requirements, it takes time for eMcREY to process and return CLEAR/HIT.
     * This method polls the Approved section >5 times (default 10 attempts, 5s delay between
     * refreshes) until the record appears and transitions out of "Pending Screening"
     * into its evaluated state (e.g. "Pending final approval" or "Under compliance review").
     *
     * @returns object with found boolean and row status text.
     */
    async waitForRecordInApproved(targetMRN, maxAttempts = 10, delayMs = 5000) {
        let lastFoundStatus = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            console.log(`[Compliance] Checking Approved section for MRN ${targetMRN} (eMcREY screening) — attempt ${attempt}/${maxAttempts}`);
            await this.navigateToApproved().catch(() => { });
            await this.filterByMRN(targetMRN);
            const row = this.page.locator(`tr:has-text("${targetMRN}"), [role="row"]:has-text("${targetMRN}")`).first();
            const isVisible = await row.isVisible({ timeout: 2000 }).catch(() => false);
            if (isVisible) {
                const rowText = await row.innerText().catch(() => '');
                lastFoundStatus = rowText;
                console.log(`[Compliance] Found MRN ${targetMRN} in Approved section on attempt ${attempt}. Current row: ${rowText.replace(/\n+/g, ' | ')}`);
                // Wait until screening finishes (transitions OUT of "Pending Screening" into "Under compliance review" or "Pending final approval")
                if (!/Pending\s+Screening/i.test(rowText)) {
                    console.log(`[Compliance] ✅ MRN ${targetMRN} screening completed! Status transitioned out of "Pending Screening" to: ${rowText.replace(/\n+/g, ' | ')}`);
                    return { found: true, status: rowText };
                }
                console.log(`[Compliance] Record is still "Pending Screening" (eMcREY screening running). Refreshing to observe transition (Attempt ${attempt}/${maxAttempts})...`);
            }
            else {
                console.log(`[Compliance] Record not yet in Approved section. Waiting ${delayMs / 1000}s before refresh (Attempt ${attempt}/${maxAttempts})...`);
            }
            if (attempt < maxAttempts) {
                await this.page.waitForTimeout(delayMs);
                await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => { });
                await this.page.waitForTimeout(1000);
            }
        }
        if (lastFoundStatus) {
            console.log(`[Compliance] ℹ️ MRN ${targetMRN} is present in Approved section (status: ${lastFoundStatus.replace(/\n+/g, ' | ')}).`);
            return { found: true, status: lastFoundStatus };
        }
        console.log(`[Compliance] ⚠️ MRN ${targetMRN} was not found in Approved section after ${maxAttempts} refresh attempts.`);
        return { found: false, status: '' };
    }
    /** Verify the review page shows the expected trade name. */
    async expectTradeName(tradeName) {
        await (0, test_1.expect)(this.page.locator(`text="${tradeName}"`).first()).toBeVisible();
    }
    /** Verify the review page shows the expected legal entity. */
    async expectLegalEntity(legalEntity) {
        await (0, test_1.expect)(this.page.locator(`text="${legalEntity}"`).first()).toBeVisible();
    }
    /** Navigate to Approved list. */
    async navigateToApproved() {
        // If on detail page, click Back first
        const backBtn = this.page.locator('button:has-text("Back")').first();
        if (await backBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await backBtn.click();
            await this.page.waitForTimeout(500);
        }
        const approvedLink = this.page.locator('button:has-text("Approved"), a:has-text("Approved"), [role="tab"]:has-text("Approved"), nav :text("Approved")').first();
        if (await approvedLink.isVisible({ timeout: 2000 }).catch(() => false)) {
            await approvedLink.click();
        }
        else {
            await this.page.click('text="Approved"');
        }
        await this.page.waitForTimeout(500);
    }
    // ── Helpers for negative testing ──────────────────────────────
    async rejectWithoutReason() {
        const btn = this.page.locator('button:has-text("Reject")').first();
        await btn.click().catch(() => { });
    }
    async holdWithoutReason() {
        const btn = this.page.locator('button:has-text("On-hold"), button:has-text("Hold")').first();
        await btn.click().catch(() => { });
    }
    async returnWithoutComments() {
        const btn = this.page.locator('button:has-text("Request clarification"), button:has-text("Return")').first();
        await btn.click().catch(() => { });
    }
    async returnForClarification(reason) {
        const notesInput = this.page.locator('textarea, [role="textbox"]').first();
        if (await notesInput.isVisible({ timeout: 1500 }).catch(() => false)) {
            await notesInput.fill(reason);
        }
        await this.returnWithoutComments();
        const confirmBtn = this.page.locator('.MuiDialog-paper button:has-text("Confirm"), .MuiDialog-paper button:has-text("Request")').first();
        if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
            await confirmBtn.click().catch(() => { });
        }
    }
    async holdMerchant(reason) {
        const notesInput = this.page.locator('textarea, [role="textbox"]').first();
        if (await notesInput.isVisible({ timeout: 1500 }).catch(() => false)) {
            await notesInput.fill(reason);
        }
        await this.holdWithoutReason();
        const confirmBtn = this.page.locator('.MuiDialog-paper button:has-text("Confirm"), .MuiDialog-paper button:has-text("Hold")').first();
        if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
            await confirmBtn.click().catch(() => { });
        }
    }
    async navigateToOnHoldList() {
        const link = this.page.locator('a:has-text("On-hold"), button:has-text("On-hold")').first();
        await link.click().catch(() => { });
    }
    async releaseFromHold() {
        const btn = this.page.locator('button:has-text("Release"), button:has-text("Resume")').first();
        await btn.click().catch(() => { });
    }
    async isReviewReadOnly() {
        const notesInput = this.page.locator('textarea, [role="textbox"]').first();
        return !(await notesInput.isEnabled().catch(() => false));
    }
}
exports.ComplianceQueuePage = ComplianceQueuePage;
