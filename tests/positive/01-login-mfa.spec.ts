import { test, expect } from '../../fixtures/diagnostics';
import { LoginPage } from '../../pages/login.page';
import { BaseWizardPage } from '../../pages/wizard/base-wizard.page';
import { ROLES } from '../../fixtures/merchant-data';

test.describe.serial('01 — Authentication & MFA Verification', () => {
  test('Onboarding Officer (Sukesh) logs in directly without MFA', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login(ROLES.onboarding.username, ROLES.onboarding.password);
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page.locator('text="Dashboard"').first()).toBeVisible();

    const basePage = new BaseWizardPage(page);
    await basePage.signOut();
  });

  test('Compliance Officer (bhanu) logs in with automated TOTP MFA', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login(ROLES.compliance.username, ROLES.compliance.password, ROLES.compliance.totpSecret);
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page.locator('text="Dashboard"').first()).toBeVisible();

    const basePage = new BaseWizardPage(page);
    await basePage.signOut();
  });

  test('Final Approver (uttamnadh) logs in with automated TOTP MFA', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login(ROLES.approver.username, ROLES.approver.password, ROLES.approver.totpSecret);
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page.locator('text="Dashboard"').first()).toBeVisible();

    const basePage = new BaseWizardPage(page);
    await basePage.signOut();
  });
});
