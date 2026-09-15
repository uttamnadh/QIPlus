"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const diagnostics_1 = require("../../fixtures/diagnostics");
const login_page_1 = require("../../pages/login.page");
const compliance_queue_page_1 = require("../../pages/compliance-queue.page");
const base_wizard_page_1 = require("../../pages/wizard/base-wizard.page");
const merchant_data_1 = require("../../fixtures/merchant-data");
const regression_state_1 = require("../../fixtures/regression-state");
/**
 * Regression Scenario 4: Multi-role status verification for the submitted regression merchant.
 * Checks status across:
 * 1st: Onboarding Officer (Sukesh) — verifies record in "Submitted" list.
 * 2nd: Compliance Officer (Bhanu) — verifies record in "Approved" list.
 * (Final Approver status verification is executed in 03-final-approval directly after decision without logout).
 */
diagnostics_1.test.describe.serial('04 — Regression Status Transitions', () => {
    (0, diagnostics_1.test)('1st — Onboarding officer (Sukesh) sees regression record in Submitted list', async ({ page }) => {
        const state = (0, regression_state_1.loadRegressionState)();
        const targetMRN = state.mrn;
        diagnostics_1.test.skip(!targetMRN, 'No regression MRN available. Skipping until regression onboarding has run.');
        diagnostics_1.test.skip(!state.finalApproved, 'Regression merchant is On-hold (Under compliance review) / not final approved; skipping post-activation status checks.');
        const loginPage = new login_page_1.LoginPage(page);
        await loginPage.navigate();
        await loginPage.login(merchant_data_1.ROLES.onboarding.username, merchant_data_1.ROLES.onboarding.password);
        await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => { });
        await page.click('text="Submitted"');
        const searchInput = page.getByPlaceholder('Filter by MRN or name').or(page.locator('input[placeholder*="Search" i], input[placeholder*="Filter" i]')).first();
        if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await searchInput.click();
            await searchInput.fill(targetMRN);
            await page.keyboard.press('Enter');
        }
        const row = page.locator(`tr:has-text("${targetMRN}"), [role="row"]:has-text("${targetMRN}")`).first();
        await (0, diagnostics_1.expect)(row).toBeVisible({ timeout: 5000 });
        const rowText = await row.innerText().catch(() => '');
        const record = state.records.find(r => r.mrn === targetMRN) || state.records[0];
        console.log('\n============================================================');
        console.log('📋 [REGRESSION STATUS CHECK 1/2 — ONBOARDING OFFICER (SUKESH)]');
        console.log(`📄 MRN NUMBER    : ${targetMRN}`);
        console.log(`🏢 TRADE NAME    : ${record?.tradeName || 'N/A'}`);
        console.log('📍 LOCATION       : Submitted List');
        console.log(`📋 DETAILS       : ${rowText.replace(/\n+/g, ' | ')}`);
        console.log('============================================================\n');
        const basePage = new base_wizard_page_1.BaseWizardPage(page);
        await basePage.signOut();
    });
    (0, diagnostics_1.test)('2nd — Compliance officer (Bhanu) sees regression record in Approved list', async ({ page }) => {
        const state = (0, regression_state_1.loadRegressionState)();
        const targetMRN = state.mrn;
        diagnostics_1.test.skip(!targetMRN, 'No regression MRN available. Skipping until regression onboarding has run.');
        diagnostics_1.test.skip(!state.finalApproved, 'Regression merchant is On-hold (Under compliance review) / not final approved; skipping post-activation status checks.');
        const loginPage = new login_page_1.LoginPage(page);
        await loginPage.navigate();
        await loginPage.login(merchant_data_1.ROLES.compliance.username, merchant_data_1.ROLES.compliance.password, merchant_data_1.ROLES.compliance.totpSecret);
        await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => { });
        const queue = new compliance_queue_page_1.ComplianceQueuePage(page);
        await queue.navigateToApproved();
        await queue.filterByMRN(targetMRN);
        const row = page.locator(`tr:has-text("${targetMRN}"), [role="row"]:has-text("${targetMRN}")`).first();
        await (0, diagnostics_1.expect)(row).toBeVisible({ timeout: 5000 });
        const rowText = await row.innerText().catch(() => '');
        const record = state.records.find(r => r.mrn === targetMRN) || state.records[0];
        console.log('\n============================================================');
        console.log('📋 [REGRESSION STATUS CHECK 2/2 — COMPLIANCE OFFICER (BHANU)]');
        console.log(`📄 MRN NUMBER    : ${targetMRN}`);
        console.log(`🏢 TRADE NAME    : ${record?.tradeName || 'N/A'}`);
        console.log('📍 LOCATION       : Compliance Approved List');
        console.log(`📋 DETAILS       : ${rowText.replace(/\n+/g, ' | ')}`);
        console.log('============================================================\n');
        const basePage = new base_wizard_page_1.BaseWizardPage(page);
        await basePage.signOut();
    });
});
