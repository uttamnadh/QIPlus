"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Step8ReviewPage = void 0;
const test_1 = require("@playwright/test");
const base_wizard_page_1 = require("./base-wizard.page");
/**
 * Page Object for Step 8 (Review) — Summary before submission.
 * WHY: The review step displays all entered data in read-only sections.
 * OPTIMIZED: Condition-based submission flow, zero dead sleeps.
 */
class Step8ReviewPage extends base_wizard_page_1.BaseWizardPage {
    constructor(page) {
        super(page);
    }
    /** Verify that key values are visible on the review page. */
    async verifyReviewData(data) {
        await (0, test_1.expect)(this.page.locator(`text="${data.tradeName}"`).first()).toBeVisible();
        await (0, test_1.expect)(this.page.locator(`text="${data.legalName}"`).first()).toBeVisible();
        await (0, test_1.expect)(this.page.locator(`text="${data.licence.authority}"`).first()).toBeVisible();
        await (0, test_1.expect)(this.page.locator(`text="${data.licence.number}"`).first()).toBeVisible();
        await (0, test_1.expect)(this.page.locator(`text="${data.banking.bankName}"`).first()).toBeVisible();
    }
    /** Click 'Submit for review' button and confirm dialog if shown (zero dead waits). */
    async submitForReview() {
        const btn = this.page.locator('button:has-text("Submit for review")');
        await btn.click();
        // Confirm modal dialog "Submit for compliance review?"
        const submitModalBtn = this.page.locator('[role="dialog"] button:has-text("Submit"), .MuiDialog-paper button:has-text("Submit")').first();
        if (await submitModalBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await submitModalBtn.click();
            await this.page.locator('[role="dialog"], .MuiDialog-root').first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => { });
        }
        // Wait for redirect to dashboard or submitted list
        await this.page.waitForURL(url => url.pathname.includes('/submitted') || url.pathname.includes('/dashboard'), { timeout: 8000 }).catch(() => null);
    }
    /** Check if Submit for review button is enabled. */
    async isSubmitEnabled() {
        return this.page.locator('button:has-text("Submit for review")').isEnabled().catch(() => false);
    }
    /** Get text next to or under a given label on the Review page. */
    async getDisplayedValue(label) {
        const loc = this.page.locator(`text="${label}"`).locator('xpath=following-sibling::*[1]');
        if (await loc.isVisible({ timeout: 1500 }).catch(() => false)) {
            return loc.innerText();
        }
        return '';
    }
    /** Get displayed Shareholders count on Review page. */
    async getShareholderCount() {
        const section = this.page.locator('text=/Shareholders \\(\\d+\\)/, text=/Ownership/i').first();
        const text = await section.innerText().catch(() => '');
        const match = text.match(/\((\d+)\)/);
        return match ? parseInt(match[1], 10) : -1;
    }
    /** Get displayed UBOs count on Review page. */
    async getUBOCount() {
        const section = this.page.locator('text=/UBOs \\(\\d+\\)/, text=/Ultimate Beneficial Owners/i').first();
        const text = await section.innerText().catch(() => '');
        const match = text.match(/\((\d+)\)/);
        return match ? parseInt(match[1], 10) : -1;
    }
    /** Get displayed Signatories count on Review page. */
    async getSignatoryCount() {
        const section = this.page.locator('text=/Signatories \\(\\d+\\)/, text=/Authorised Signatories/i').first();
        const text = await section.innerText().catch(() => '');
        const match = text.match(/\((\d+)\)/);
        return match ? parseInt(match[1], 10) : -1;
    }
    /** Get count of PEPs flagged on Review page. */
    async getPEPFlaggedCount() {
        const loc = this.page.locator('text=/PEPs flagged: \\d+/, text=/PEP/i').first();
        const text = await loc.innerText().catch(() => '');
        const match = text.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
    }
    /** Get mandatory documents attached count on Review page. */
    async getMandatoryDocCount() {
        const loc = this.page.locator('text=/\\d+ of \\d+ documents attached/').first();
        const text = await loc.innerText().catch(() => '');
        const match = text.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : -1;
    }
    /** Get displayed IBAN on Review page (checks for masking). */
    async getIBANDisplay() {
        const loc = this.page.locator('text=/AE\\d+/, text=/AE\\d+ •••• \\d+/').first();
        if (await loc.isVisible({ timeout: 1500 }).catch(() => false)) {
            return loc.innerText();
        }
        return '';
    }
    /** Get registration reference number / MRN displayed on Review. */
    async getRegistrationRef() {
        return this.getRegistrationNumber();
    }
    /** Get warning messages for incomplete steps when navigating directly to Step 8. */
    async getIncompleteStepWarnings() {
        const locs = this.page.locator('.MuiAlert-root, [role="alert"]');
        const count = await locs.count();
        const texts = [];
        for (let i = 0; i < count; i++) {
            const text = await locs.nth(i).innerText();
            if (text.trim())
                texts.push(text.trim());
        }
        return texts;
    }
    /** Check if the record on Step 8 / Review is in read-only mode (inputs disabled). */
    async isReadOnly() {
        const inputs = this.page.locator('input:not([readonly]):not([disabled])');
        const editableCount = await inputs.count();
        return editableCount === 0;
    }
}
exports.Step8ReviewPage = Step8ReviewPage;
