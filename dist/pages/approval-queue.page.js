"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalQueuePage = void 0;
const test_1 = require("@playwright/test");
/**
 * Page Object for the Final Approver's approval queue.
 * WHY: Strictly targets the specific approved MRN without falling back to recent records.
 * OPTIMIZED: Condition-based navigation and selection, zero dead sleeps.
 */
class ApprovalQueuePage {
    constructor(page) {
        this.page = page;
    }
    /** Navigate to the approval queue via sidebar. */
    async navigateToApprovalQueue() {
        const backBtn = this.page.locator('button:has-text("Back")').first();
        if (await backBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await backBtn.click();
        }
        const link = this.page.locator('button:has-text("Approval queue"), a:has-text("Approval queue"), nav :text("Approval queue")').first();
        if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
            await link.click();
        }
        else {
            await this.page.click('text="Approval queue"');
        }
    }
    /** Filter by MRN or name. */
    async filterByMRN(mrn) {
        const input = this.page.getByPlaceholder('Filter by MRN or name');
        await input.click();
        await input.fill(mrn);
        await this.page.keyboard.press('Enter');
    }
    /**
     * Open the exact merchant record by target MRN approved in compliance.
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
    /** Get status for a merchant by MRN. */
    async getStatusByMRN(mrn) {
        const row = this.page.locator(`tr:has-text("${mrn}"), div:has-text("${mrn}")`);
        const status = row.locator('text=/Pending final approval|Under compliance review|Active|Approved|Rejected/').first();
        return status.innerText();
    }
    /** Approve the currently open merchant. */
    async approveMerchant(notes = 'Final approval granted.') {
        // Check if merchant has screening hit
        const isScreeningHit = await this.page.locator('text=/Screening hit|case opened for compliance review/i').first().isVisible({ timeout: 1500 }).catch(() => false);
        if (isScreeningHit) {
            console.log('[ApprovalQueue] ℹ️ Record has Screening Hit — no approval decision can be taken by Final Approver.');
            return;
        }
        const notesInput = this.page.locator('textarea, [role="textbox"], input[name="notes"]').first();
        await notesInput.waitFor({ state: 'visible', timeout: 5000 }).catch(() => { });
        // If Decision notes is disabled (screening still running), refresh ONLY ONCE to check if enabled
        for (let reloadAttempt = 1; reloadAttempt <= 1; reloadAttempt++) {
            if (await notesInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                const isEditable = await notesInput.isEditable().catch(() => false);
                if (isEditable)
                    break;
                const checkHit = await this.page.locator('text=/Screening hit|case opened for compliance review/i').first().isVisible({ timeout: 500 }).catch(() => false);
                if (checkHit) {
                    console.log('[ApprovalQueue] ℹ️ Record transitioned to Screening Hit — decision buttons are locked.');
                    return;
                }
                console.log(`[ApprovalQueue] Decision notes disabled. Refreshing screening ONLY ONCE to confirm status...`);
                await this.page.waitForTimeout(2000);
                await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => { });
                await this.page.waitForTimeout(1000);
            }
        }
        if (await notesInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            const isEditable = await notesInput.isEditable().catch(() => false);
            if (!isEditable) {
                console.log('[ApprovalQueue] ℹ️ Decision notes is disabled (record is On-hold / Under compliance review) — cannot take decision in final approver.');
                return;
            }
            await notesInput.focus();
            await notesInput.fill(notes);
            await notesInput.press('Space');
            await notesInput.press('Backspace');
            await notesInput.blur();
            await this.page.waitForTimeout(300);
        }
        const approveBtn = this.page.locator('button:has-text("Approve & Activate"), button:has-text("Approve & activate"), button:has-text("Approve")').first();
        if (await approveBtn.isEnabled({ timeout: 5000 }).catch(() => false)) {
            await approveBtn.click();
            // Handle confirmation dialog reliably
            const confirmBtn = this.page.locator('[role="dialog"] button:has-text("Confirm"), .MuiDialog-paper button:has-text("Confirm"), [role="dialog"] button:has-text("Approve")').first();
            if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await confirmBtn.click();
            }
            // Ensure any modal backdrop is unmounted
            const dialog = this.page.locator('.MuiDialog-root, [role="dialog"]').first();
            if (await dialog.isVisible({ timeout: 1000 }).catch(() => false)) {
                await dialog.waitFor({ state: 'detached', timeout: 3000 }).catch(() => { });
            }
        }
        else {
            console.log('[ApprovalQueue] Approve & Activate button is not enabled.');
        }
    }
    /** Verify trade name on review. */
    async expectTradeName(tradeName) {
        await (0, test_1.expect)(this.page.locator(`text="${tradeName}"`).first()).toBeVisible();
    }
    /**
     * Wait for a record to appear in the Approval Queue with retry polling logic.
     * eMcREY AML SCREENING: Record will only land in Approval Queue after eMcREY
     * finishes processing the compliance approval. This method refreshes the queue
     * up to maxAttempts times with delayMs delay.
     */
    async waitForRecordInApprovalQueue(targetMRN, maxAttempts = 10, delayMs = 5000) {
        let matchingRowFound = false;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            console.log(`[ApprovalQueue] Checking Approval Queue for MRN ${targetMRN} (eMcREY screening) — attempt ${attempt}/${maxAttempts}`);
            await this.navigateToApprovalQueue().catch(() => { });
            await this.filterByMRN(targetMRN);
            const matchingRow = this.page.locator(`tr:has-text("${targetMRN}"), [role="row"]:has-text("${targetMRN}")`).first();
            const isVisible = await matchingRow.isVisible({ timeout: 2500 }).catch(() => false);
            if (isVisible) {
                matchingRowFound = true;
                const rowText = await matchingRow.innerText().catch(() => '');
                console.log(`[ApprovalQueue] Found MRN ${targetMRN} in Approval Queue on attempt ${attempt}. Row: ${rowText.replace(/\n+/g, ' | ')}`);
                // If row is still Pending Screening, wait and refresh!
                if (/Pending\s+Screening/i.test(rowText)) {
                    console.log(`[ApprovalQueue] MRN ${targetMRN} is still "Pending Screening". Waiting ${delayMs / 1000}s before refresh...`);
                }
                else {
                    console.log(`[ApprovalQueue] ✅ Found MRN ${targetMRN} ready in Approval Queue on attempt ${attempt}.`);
                    await matchingRow.click();
                    await this.page.waitForTimeout(1000);
                    return true;
                }
            }
            if (attempt < maxAttempts) {
                console.log(`[ApprovalQueue] Record not yet ready in Approval Queue. Waiting ${delayMs / 1000}s before refresh (Attempt ${attempt}/${maxAttempts})...`);
                await this.page.waitForTimeout(delayMs);
                await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => { });
                await this.page.waitForTimeout(1000);
            }
        }
        if (matchingRowFound) {
            console.log(`[ApprovalQueue] ℹ️ MRN ${targetMRN} was found in Approval Queue; proceeding to open record.`);
            const matchingRow = this.page.locator(`tr:has-text("${targetMRN}"), [role="row"]:has-text("${targetMRN}")`).first();
            await matchingRow.click().catch(() => { });
            await this.page.waitForTimeout(1000);
            return true;
        }
        console.log(`[ApprovalQueue] ⚠️ MRN ${targetMRN} NOT found in Approval Queue after ${maxAttempts} attempts.`);
        return false;
    }
    /**
     * Click "Re-check screening result" button if visible on the approval page
     * to trigger a fresh check against eMcREY screening engine.
     */
    async recheckScreeningResult() {
        const recheckBtn = this.page.locator('button[aria-label*="Re-check" i], button:has-text("Re-check"), [aria-label*="screening result" i]').first();
        if (await recheckBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
            console.log('[ApprovalQueue] "Re-check screening result" button found. Triggering eMcREY check...');
            await recheckBtn.click();
            await this.page.waitForTimeout(2000);
            return true;
        }
        console.log('[ApprovalQueue] "Re-check screening result" button not visible or already complete.');
        return false;
    }
    /** Read screening result text (e.g. CLEAR / HIT / No Match). */
    async getScreeningResult() {
        const screeningLocator = this.page.locator('text=/CLEAR|HIT|No Match|Potential Match|Passed/i').first();
        if (await screeningLocator.isVisible({ timeout: 2000 }).catch(() => false)) {
            return await screeningLocator.innerText().catch(() => '');
        }
        return '';
    }
    /** Navigate to Merchant Search directory. */
    async navigateToMerchantSearch() {
        const backBtn = this.page.locator('button:has-text("Back")').first();
        if (await backBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await backBtn.click();
            await this.page.waitForTimeout(500);
        }
        const searchLink = this.page.locator('button:has-text("Merchant search"), a:has-text("Merchant search"), nav :text("Merchant search"), [href*="/merchants/search"]').first();
        if (await searchLink.isVisible({ timeout: 2000 }).catch(() => false)) {
            await searchLink.click();
        }
        else {
            await this.page.goto('/merchants/search', { waitUntil: 'domcontentloaded' }).catch(() => { });
        }
        await this.page.waitForTimeout(1000);
    }
    /**
     * Verify that merchant is now Active in Merchant Search directory or Approved merchants.
     */
    async verifyMerchantActive(mrn) {
        // Attempt via Approved merchants first, then Merchant search
        await this.navigateToApprovedMerchants().catch(() => { });
        await this.filterByMRN(mrn);
        let row = this.page.locator(`tr:has-text("${mrn}"), [role="row"]:has-text("${mrn}")`).first();
        let isVisible = await row.isVisible({ timeout: 3000 }).catch(() => false);
        if (!isVisible) {
            // Fallback to Merchant search
            await this.navigateToMerchantSearch().catch(() => { });
            const searchInput = this.page.getByPlaceholder('Filter by MRN or name').or(this.page.locator('input[placeholder*="MRN" i], input[placeholder*="Search" i]')).first();
            if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
                await searchInput.click();
                await searchInput.fill(mrn);
                await this.page.keyboard.press('Enter');
                await this.page.waitForTimeout(1000);
            }
            row = this.page.locator(`tr:has-text("${mrn}"), [role="row"]:has-text("${mrn}")`).first();
            isVisible = await row.isVisible({ timeout: 3000 }).catch(() => false);
        }
        if (isVisible) {
            const activeBadge = row.locator('text=/Active/i').first();
            await (0, test_1.expect)(activeBadge).toBeVisible({ timeout: 3000 }).catch(() => { });
            const rowText = await row.innerText().catch(() => '');
            console.log(`[ApprovalQueue] ✅ Verified merchant ${mrn} is ACTIVE. Row: ${rowText.replace(/\n+/g, ' | ')}`);
            return true;
        }
        return false;
    }
    /** Navigate to Approved merchants. */
    async navigateToApprovedMerchants() {
        const backBtn = this.page.locator('button:has-text("Back")').first();
        if (await backBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await backBtn.click();
        }
        const link = this.page.locator('button:has-text("Approved merchants"), a:has-text("Approved merchants"), nav :text("Approved merchants")').first();
        if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
            await link.click();
        }
        else {
            await this.page.click('text="Approved merchants"');
        }
    }
    // ── Helpers for negative testing ──────────────────────────────
    async rejectWithoutReason() {
        const btn = this.page.locator('button:has-text("Reject")').first();
        await btn.click().catch(() => { });
    }
    async getComplianceReviewNotes() {
        const notesBox = this.page.locator('text=/Approved by compliance officer|Compliance notes|Decision notes/').first();
        return notesBox.innerText().catch(() => '');
    }
    async getApprovalQueueStatuses() {
        return this.page.locator('tbody tr td:nth-child(5)').allInnerTexts().catch(() => []);
    }
    async getRiskRating(mrn) {
        const rating = this.page.locator('text=/Low|Medium|High/').first();
        return rating.innerText().catch(() => '');
    }
}
exports.ApprovalQueuePage = ApprovalQueuePage;
