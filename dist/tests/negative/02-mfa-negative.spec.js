"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const diagnostics_1 = require("../../fixtures/diagnostics");
const login_page_1 = require("../../pages/login.page");
const user_management_page_1 = require("../../pages/user-management.page");
const base_wizard_page_1 = require("../../pages/wizard/base-wizard.page");
const merchant_data_1 = require("../../fixtures/merchant-data");
diagnostics_1.test.describe.serial('Negative Suite 02 — Two-Step Verification (MFA) & Lockout Recovery', () => {
    (0, diagnostics_1.test)('MFA-NEG-01: Invalid 6-digit TOTP code is rejected with 401 error alert', async ({ page }) => {
        const loginPage = new login_page_1.LoginPage(page);
        await loginPage.navigate();
        // Trigger MFA prompt for uttamnadh
        await page.fill('input[name="username"]', merchant_data_1.ROLES.approver.username);
        await page.fill('input[name="password"]', merchant_data_1.ROLES.approver.password);
        await page.click('button[type="submit"]');
        const digitInput = page.locator('input[aria-label*="Digit 1"], input[aria-label*="Digit"]').first();
        await (0, diagnostics_1.expect)(digitInput).toBeVisible({ timeout: 5000 });
        // Enter deliberately wrong OTP (111111)
        const digitInputs = await page.locator('input[aria-label*="Digit"]').all();
        for (let i = 0; i < 6; i++) {
            await digitInputs[i].fill('1');
        }
        const verifyBtn = page.locator('button:has-text("Verify"), button:has-text("Confirm")').first();
        if (await verifyBtn.isEnabled({ timeout: 1500 }).catch(() => false)) {
            await verifyBtn.click();
        }
        // Expect error toast/alert
        const alert = page.locator('.MuiAlert-root, [role="alert"]').first();
        await (0, diagnostics_1.expect)(alert).toBeVisible({ timeout: 5000 });
        const alertText = await alert.innerText();
        console.log('[MFA-NEG-01] Received error alert:', alertText);
        (0, diagnostics_1.expect)(alertText).toMatch(/invalid|incorrect|error/i);
    });
    (0, diagnostics_1.test)('MFA-NEG-02: Incomplete OTP (<6 digits) leaves Verify button disabled', async ({ page }) => {
        const loginPage = new login_page_1.LoginPage(page);
        await loginPage.navigate();
        await page.fill('input[name="username"]', merchant_data_1.ROLES.approver.username);
        await page.fill('input[name="password"]', merchant_data_1.ROLES.approver.password);
        await page.click('button[type="submit"]');
        const digitInput = page.locator('input[aria-label*="Digit 1"], input[aria-label*="Digit"]').first();
        await (0, diagnostics_1.expect)(digitInput).toBeVisible({ timeout: 5000 });
        // Enter only 3 digits
        const digitInputs = await page.locator('input[aria-label*="Digit"]').all();
        await digitInputs[0].fill('1');
        await digitInputs[1].fill('2');
        await digitInputs[2].fill('3');
        const verifyBtn = page.locator('button:has-text("Verify"), button:has-text("Confirm")').first();
        const isEnabled = await verifyBtn.isEnabled();
        (0, diagnostics_1.expect)(isEnabled).toBe(false);
    });
    (0, diagnostics_1.test)('MFA-NEG-03: Non-numeric input in OTP fields is filtered and ignored', async ({ page }) => {
        const loginPage = new login_page_1.LoginPage(page);
        await loginPage.navigate();
        await page.fill('input[name="username"]', merchant_data_1.ROLES.approver.username);
        await page.fill('input[name="password"]', merchant_data_1.ROLES.approver.password);
        await page.click('button[type="submit"]');
        const digitInput = page.locator('input[aria-label*="Digit 1"], input[aria-label*="Digit"]').first();
        await (0, diagnostics_1.expect)(digitInput).toBeVisible({ timeout: 5000 });
        // Attempt typing alphabetic letters into first digit box
        await digitInput.focus();
        await page.keyboard.type('A');
        const val = await digitInput.inputValue();
        (0, diagnostics_1.expect)(val).not.toBe('A');
    });
    (0, diagnostics_1.test)('MFA-NEG-04: "Back to sign in" returns cleanly to login page', async ({ page }) => {
        const loginPage = new login_page_1.LoginPage(page);
        await loginPage.navigate();
        await page.fill('input[name="username"]', merchant_data_1.ROLES.approver.username);
        await page.fill('input[name="password"]', merchant_data_1.ROLES.approver.password);
        await page.click('button[type="submit"]');
        const digitInput = page.locator('input[aria-label*="Digit 1"], input[aria-label*="Digit"]').first();
        await (0, diagnostics_1.expect)(digitInput).toBeVisible({ timeout: 5000 });
        const backBtn = page.locator('button:has-text("Back to sign in"), button:has-text("Back")').first();
        if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await backBtn.click();
            const usernameInput = page.locator('input[name="username"]');
            await (0, diagnostics_1.expect)(usernameInput).toBeVisible({ timeout: 5000 });
        }
    });
    (0, diagnostics_1.test)('MFA-NEG-05: Account Lockout after 5 failed attempts & Admin Unlock Recovery', async ({ page }) => {
        const loginPage = new login_page_1.LoginPage(page);
        const userAdmin = new user_management_page_1.UserManagementPage(page);
        const basePage = new base_wizard_page_1.BaseWizardPage(page);
        const targetUser = merchant_data_1.ROLES.approver.username; // uttamnadh
        console.log(`[MFA-NEG-05] 1. Triggering 5 failed attempts on ${targetUser}...`);
        for (let attempt = 1; attempt <= 5; attempt++) {
            await loginPage.navigate();
            await page.fill('input[name="username"]', targetUser);
            await page.fill('input[name="password"]', `WrongPass@${attempt}`);
            await page.click('button[type="submit"]');
            await page.waitForTimeout(600);
        }
        // Verify account lockout error message
        const lockoutAlert = page.locator('.MuiAlert-root, [role="alert"]').first();
        await (0, diagnostics_1.expect)(lockoutAlert).toBeVisible({ timeout: 5000 });
        const lockoutText = await lockoutAlert.innerText();
        console.log(`[MFA-NEG-05] Lockout message confirmed: "${lockoutText}"`);
        (0, diagnostics_1.expect)(lockoutText).toMatch(/locked|too many attempts/i);
        console.log('[MFA-NEG-05] 2. Admin (shankar) logging in to unlock account...');
        await loginPage.navigate();
        await loginPage.login(merchant_data_1.ROLES.userManagement.username, merchant_data_1.ROLES.userManagement.password, merchant_data_1.ROLES.userManagement.totpSecret);
        await page.waitForURL('**/dashboard', { timeout: 10000 });
        console.log(`[MFA-NEG-05] 3. Admin unlocking ${targetUser} in User Management...`);
        await userAdmin.navigateToUserManagement();
        await userAdmin.unlockUser(targetUser);
        console.log(`[MFA-NEG-05] Admin unlocked ${targetUser}. Signing out admin...`);
        await basePage.signOut();
        console.log(`[MFA-NEG-05] 4. Verifying restored login for ${targetUser}...`);
        await loginPage.navigate();
        await loginPage.login(merchant_data_1.ROLES.approver.username, merchant_data_1.ROLES.approver.password, merchant_data_1.ROLES.approver.totpSecret);
        await page.waitForURL('**/dashboard', { timeout: 10000 });
        await (0, diagnostics_1.expect)(page.locator('text="Dashboard"').first()).toBeVisible();
        console.log(`[MFA-NEG-05] ✅ Successfully logged back into ${targetUser} after Admin Unlock!`);
        await basePage.signOut();
    });
});
