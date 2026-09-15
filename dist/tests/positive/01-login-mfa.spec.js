"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const diagnostics_1 = require("../../fixtures/diagnostics");
const login_page_1 = require("../../pages/login.page");
const base_wizard_page_1 = require("../../pages/wizard/base-wizard.page");
const merchant_data_1 = require("../../fixtures/merchant-data");
diagnostics_1.test.describe.serial('01 — Authentication & MFA Verification', () => {
    (0, diagnostics_1.test)('Onboarding Officer (Sukesh) logs in directly without MFA', async ({ page }) => {
        const loginPage = new login_page_1.LoginPage(page);
        await loginPage.navigate();
        await loginPage.login(merchant_data_1.ROLES.onboarding.username, merchant_data_1.ROLES.onboarding.password);
        await page.waitForURL('**/dashboard', { timeout: 10000 });
        await (0, diagnostics_1.expect)(page.locator('text="Dashboard"').first()).toBeVisible();
        const basePage = new base_wizard_page_1.BaseWizardPage(page);
        await basePage.signOut();
    });
    (0, diagnostics_1.test)('Compliance Officer (bhanu) logs in with automated TOTP MFA', async ({ page }) => {
        const loginPage = new login_page_1.LoginPage(page);
        await loginPage.navigate();
        await loginPage.login(merchant_data_1.ROLES.compliance.username, merchant_data_1.ROLES.compliance.password, merchant_data_1.ROLES.compliance.totpSecret);
        await page.waitForURL('**/dashboard', { timeout: 10000 });
        await (0, diagnostics_1.expect)(page.locator('text="Dashboard"').first()).toBeVisible();
        const basePage = new base_wizard_page_1.BaseWizardPage(page);
        await basePage.signOut();
    });
    (0, diagnostics_1.test)('Final Approver (uttamnadh) logs in with automated TOTP MFA', async ({ page }) => {
        const loginPage = new login_page_1.LoginPage(page);
        await loginPage.navigate();
        await loginPage.login(merchant_data_1.ROLES.approver.username, merchant_data_1.ROLES.approver.password, merchant_data_1.ROLES.approver.totpSecret);
        await page.waitForURL('**/dashboard', { timeout: 10000 });
        await (0, diagnostics_1.expect)(page.locator('text="Dashboard"').first()).toBeVisible();
        const basePage = new base_wizard_page_1.BaseWizardPage(page);
        await basePage.signOut();
    });
});
