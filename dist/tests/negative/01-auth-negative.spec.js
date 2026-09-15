"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const diagnostics_1 = require("../../fixtures/diagnostics");
const login_page_1 = require("../../pages/login.page");
const merchant_data_1 = require("../../fixtures/merchant-data");
diagnostics_1.test.describe.serial('Negative Suite 01 — Login Form Security & Boundary Tests', () => {
    (0, diagnostics_1.test)('AUTH-NEG-01: Invalid password rejects login with error alert', async ({ page }) => {
        const loginPage = new login_page_1.LoginPage(page);
        await loginPage.navigate();
        const errorMsg = await loginPage.loginAndExpectFailure(merchant_data_1.ROLES.onboarding.username, 'WrongPassword@999');
        console.log('[AUTH-NEG-01] Received error message:', errorMsg);
        (0, diagnostics_1.expect)(errorMsg.length).toBeGreaterThan(0);
        (0, diagnostics_1.expect)(page.url()).toContain('/login');
    });
    (0, diagnostics_1.test)('AUTH-NEG-02: Non-existent username is rejected with generic error (no enumeration)', async ({ page }) => {
        const loginPage = new login_page_1.LoginPage(page);
        await loginPage.navigate();
        const errorMsg = await loginPage.loginAndExpectFailure('ghost_user_99999', 'Qa@123456');
        console.log('[AUTH-NEG-02] Received error message:', errorMsg);
        (0, diagnostics_1.expect)(errorMsg.length).toBeGreaterThan(0);
        (0, diagnostics_1.expect)(page.url()).toContain('/login');
    });
    (0, diagnostics_1.test)('AUTH-NEG-03: Submitting blank credentials triggers HTML5 required validation', async ({ page }) => {
        const loginPage = new login_page_1.LoginPage(page);
        await loginPage.navigate();
        await loginPage.clearFields();
        await loginPage.submitWithoutFill();
        const hasAttrs = await loginPage.hasRequiredAttributes();
        (0, diagnostics_1.expect)(hasAttrs.username).toBe(true);
        (0, diagnostics_1.expect)(hasAttrs.password).toBe(true);
        (0, diagnostics_1.expect)(page.url()).toContain('/login');
    });
    (0, diagnostics_1.test)('AUTH-NEG-04: SQL Injection payload in username/password is safely rejected', async ({ page }) => {
        const loginPage = new login_page_1.LoginPage(page);
        await loginPage.navigate();
        const errorMsg = await loginPage.loginAndExpectFailure("' OR '1'='1' --", "' OR '1'='1'");
        console.log('[AUTH-NEG-04] SQLi rejection message:', errorMsg);
        (0, diagnostics_1.expect)(page.url()).toContain('/login');
    });
    (0, diagnostics_1.test)('AUTH-NEG-05: XSS payload in username is escaped safely without DOM execution', async ({ page }) => {
        const loginPage = new login_page_1.LoginPage(page);
        await loginPage.navigate();
        let dialogFired = false;
        page.on('dialog', async (dialog) => {
            dialogFired = true;
            await dialog.dismiss();
        });
        const errorMsg = await loginPage.loginAndExpectFailure('<script>alert(1)</script>', 'Qa@12345');
        (0, diagnostics_1.expect)(dialogFired).toBe(false);
        (0, diagnostics_1.expect)(page.url()).toContain('/login');
    });
    (0, diagnostics_1.test)('AUTH-NEG-06: Direct unauthenticated URL navigation to /dashboard is redirected to /login', async ({ page }) => {
        // Clear cookies/storage to simulate unauthenticated user
        await page.context().clearCookies();
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' }).catch(() => { });
        await page.waitForTimeout(1000);
        (0, diagnostics_1.expect)(page.url()).toContain('/login');
    });
});
