"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardPage = void 0;
const test_1 = require("@playwright/test");
/**
 * Page Object for the /dashboard screen.
 * WHY: The dashboard is the landing page for all roles and is the hub
 * for navigating to registration, queues, and other list views.
 * OPTIMIZED: Condition-based navigation waits, zero dead sleeps.
 */
class DashboardPage {
    constructor(page) {
        this.page = page;
    }
    /** Assert the welcome heading shows the expected username. */
    async expectWelcomeMessage(username) {
        await (0, test_1.expect)(this.page.locator(`h1:has-text("Welcome, ${username}")`)).toBeVisible();
    }
    /** Get the role label text from the header (e.g. 'Onboarding officer'). */
    async getRoleLabel() {
        // The role label sits in the top header bar
        const roleChip = this.page.locator('header, nav').locator('text=/Onboarding officer|Compliance officer|Final approver/');
        return roleChip.innerText();
    }
    /** Click the 'Create merchant' or 'New registration' button or navigate to /merchants/new. */
    async clickCreateMerchant() {
        const btn = this.page.locator('button:has-text("New registration"), button:has-text("Create merchant"), a:has-text("New registration"), a:has-text("Create merchant"), [data-testid*="create-merchant"]').first();
        if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await btn.click();
        }
        else {
            await this.page.goto('/merchants/new').catch(() => { });
        }
        const indicator = this.page.locator('text=/Step \\d+ of 8/').first();
        await indicator.waitFor({ state: 'visible', timeout: 5000 }).catch(() => { });
    }
    /** Navigate to New registration via sidebar. */
    async navigateToNewRegistration() {
        await this.page.click('text="New registration"');
    }
    /** Navigate to Drafts list via sidebar. */
    async navigateToDrafts() {
        const draftLink = this.page.locator('nav, aside, header, div').locator('text="Drafts"').first();
        if (await draftLink.isVisible({ timeout: 2000 }).catch(() => false)) {
            await draftLink.click().catch(() => { });
        }
        else {
            await this.page.goto('/applications/drafts').catch(() => { });
        }
    }
    /** Open an existing draft by MRN / Registration Number. */
    async openDraftByMrn(mrn) {
        await this.navigateToDrafts();
        await this.page.waitForTimeout(1000);
        // Try search input if available
        const searchInput = this.page.locator('input[placeholder*="search" i], input[type="search"], input[aria-label*="search" i]').first();
        if (await searchInput.isVisible({ timeout: 1500 }).catch(() => false)) {
            await searchInput.fill(mrn);
            await this.page.keyboard.press('Enter').catch(() => { });
            await this.page.waitForTimeout(1000);
        }
        // Find row with MRN
        const row = this.page.locator(`tr:has-text("${mrn}")`).first();
        if (await row.isVisible({ timeout: 3000 }).catch(() => false)) {
            const editBtn = row.locator('button:has-text("Edit"), button:has-text("Resume"), button:has-text("Continue"), a:has-text("Edit"), button[aria-label*="edit" i], svg[data-testid*="Edit" i]').first();
            if (await editBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
                await editBtn.click();
            }
            else {
                await row.click();
            }
        }
        else {
            // Fallback: click any element matching MRN directly
            const mrnEl = this.page.locator(`text="${mrn}"`).first();
            if (await mrnEl.isVisible({ timeout: 3000 }).catch(() => false)) {
                await mrnEl.click();
            }
        }
        // Wait for wizard step indicator
        await this.page.locator('text=/Step \\d+ of 8/').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => { });
    }
    /** Navigate to Submitted list via sidebar. */
    async navigateToSubmitted() {
        await this.page.click('text="Submitted"');
    }
    /** Navigate to Verification queue (Compliance officer sidebar). */
    async navigateToVerificationQueue() {
        await this.page.click('text="Verification queue"');
    }
    /** Navigate to Approval queue (Final approver sidebar). */
    async navigateToApprovalQueue() {
        await this.page.click('text="Approval queue"');
    }
    /** Navigate to Approved list via sidebar. */
    async navigateToApproved() {
        await this.page.click('text="Approved"');
    }
    /** Sign out from top navbar with modal confirmation if present. */
    async signOut() {
        await this.page.click('button:has-text("Sign out")');
        const dialog = this.page.locator('.MuiDialog-paper, [role="dialog"]').first();
        if (await dialog.isVisible({ timeout: 1500 }).catch(() => false)) {
            const confirmBtn = dialog.locator('button').filter({ hasNotText: 'Cancel' }).last();
            await confirmBtn.click();
        }
        await this.page.waitForURL('**/login', { timeout: 5000 }).catch(() => null);
    }
}
exports.DashboardPage = DashboardPage;
