import { test, expect } from '../../fixtures/diagnostics';
import { LoginPage } from '../../pages/login.page';
import { UserManagementPage } from '../../pages/user-management.page';
import { BaseWizardPage } from '../../pages/wizard/base-wizard.page';
import { ROLES } from '../../fixtures/merchant-data';

test.describe.serial('Negative Suite 02 — Two-Step Verification (MFA) & Lockout Recovery', () => {

  test('MFA-NEG-01: Invalid 6-digit TOTP code is rejected with 401 error alert', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();

    // Trigger MFA prompt for uttamnadh
    await page.fill('input[name="username"]', ROLES.approver.username);
    await page.fill('input[name="password"]', ROLES.approver.password);
    await page.click('button[type="submit"]');

    const digitInput = page.locator('input[aria-label*="Digit 1"], input[aria-label*="Digit"]').first();
    await expect(digitInput).toBeVisible({ timeout: 5000 });

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
    await expect(alert).toBeVisible({ timeout: 5000 });
    const alertText = await alert.innerText();
    console.log('[MFA-NEG-01] Received error alert:', alertText);
    expect(alertText).toMatch(/invalid|incorrect|error/i);
  });

  test('MFA-NEG-02: Incomplete OTP (<6 digits) leaves Verify button disabled', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();

    await page.fill('input[name="username"]', ROLES.approver.username);
    await page.fill('input[name="password"]', ROLES.approver.password);
    await page.click('button[type="submit"]');

    const digitInput = page.locator('input[aria-label*="Digit 1"], input[aria-label*="Digit"]').first();
    await expect(digitInput).toBeVisible({ timeout: 5000 });

    // Enter only 3 digits
    const digitInputs = await page.locator('input[aria-label*="Digit"]').all();
    await digitInputs[0].fill('1');
    await digitInputs[1].fill('2');
    await digitInputs[2].fill('3');

    const verifyBtn = page.locator('button:has-text("Verify"), button:has-text("Confirm")').first();
    const isEnabled = await verifyBtn.isEnabled();
    expect(isEnabled).toBe(false);
  });

  test('MFA-NEG-03: Non-numeric input in OTP fields is filtered and ignored', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();

    await page.fill('input[name="username"]', ROLES.approver.username);
    await page.fill('input[name="password"]', ROLES.approver.password);
    await page.click('button[type="submit"]');

    const digitInput = page.locator('input[aria-label*="Digit 1"], input[aria-label*="Digit"]').first();
    await expect(digitInput).toBeVisible({ timeout: 5000 });

    // Attempt typing alphabetic letters into first digit box
    await digitInput.focus();
    await page.keyboard.type('A');
    const val = await digitInput.inputValue();
    expect(val).not.toBe('A');
  });

  test('MFA-NEG-04: "Back to sign in" returns cleanly to login page', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();

    await page.fill('input[name="username"]', ROLES.approver.username);
    await page.fill('input[name="password"]', ROLES.approver.password);
    await page.click('button[type="submit"]');

    const digitInput = page.locator('input[aria-label*="Digit 1"], input[aria-label*="Digit"]').first();
    await expect(digitInput).toBeVisible({ timeout: 5000 });

    const backBtn = page.locator('button:has-text("Back to sign in"), button:has-text("Back")').first();
    if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await backBtn.click();
      const usernameInput = page.locator('input[name="username"]');
      await expect(usernameInput).toBeVisible({ timeout: 5000 });
    }
  });

  test('MFA-NEG-05: Account Lockout after 5 failed attempts & Admin Unlock Recovery', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const userAdmin = new UserManagementPage(page);
    const basePage = new BaseWizardPage(page);

    const targetUser = ROLES.approver.username; // uttamnadh

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
    await expect(lockoutAlert).toBeVisible({ timeout: 5000 });
    const lockoutText = await lockoutAlert.innerText();
    console.log(`[MFA-NEG-05] Lockout message confirmed: "${lockoutText}"`);
    expect(lockoutText).toMatch(/locked|too many attempts/i);

    console.log('[MFA-NEG-05] 2. Admin (shankar) logging in to unlock account...');
    await loginPage.navigate();
    await loginPage.login(ROLES.userManagement.username, ROLES.userManagement.password, ROLES.userManagement.totpSecret);
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    console.log(`[MFA-NEG-05] 3. Admin unlocking ${targetUser} in User Management...`);
    await userAdmin.navigateToUserManagement();
    await userAdmin.unlockUser(targetUser);
    console.log(`[MFA-NEG-05] Admin unlocked ${targetUser}. Signing out admin...`);
    await basePage.signOut();

    console.log(`[MFA-NEG-05] 4. Verifying restored login for ${targetUser}...`);
    await loginPage.navigate();
    await loginPage.login(ROLES.approver.username, ROLES.approver.password, ROLES.approver.totpSecret);
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page.locator('text="Dashboard"').first()).toBeVisible();
    console.log(`[MFA-NEG-05] ✅ Successfully logged back into ${targetUser} after Admin Unlock!`);

    await basePage.signOut();
  });
});
