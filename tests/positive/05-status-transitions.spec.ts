import { test, expect } from '../../fixtures/diagnostics';
import { LoginPage } from '../../pages/login.page';
import { ComplianceQueuePage } from '../../pages/compliance-queue.page';
import { BaseWizardPage } from '../../pages/wizard/base-wizard.page';
import { ROLES, loadState } from '../../fixtures/merchant-data';

/**
 * Scenario 5: Multi-role status verification for the submitted merchant.
 * Checks status across:
 * 1st: Onboarding Officer (Sukesh) — verifies record in "Submitted" list.
 * 2nd: Compliance Officer (Bhanu) — verifies record in "Approved" list.
 * (Final Approver status verification is executed in 04-final-approval directly after decision without logout).
 */
test.describe.serial('05 — Status transitions', () => {

  test('1st — Onboarding officer (Sukesh) sees record in Submitted list', async ({ page }) => {
    const currentState = loadState();
    test.skip(!currentState.mrn || !currentState.submitted, 'Onboarding officer did not submit an MRN record.');
    test.skip(Boolean((currentState as any).onHold || !(currentState as any).finalApproved), 'Merchant is On-hold (Under compliance review) / not final approved; skipping post-activation status checks.');
    const targetMRN = currentState.mrn;

    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login(ROLES.onboarding.username, ROLES.onboarding.password);
    await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {});

    await page.click('text="Submitted"');

    const searchInput = page.getByPlaceholder('Filter by MRN or name').or(page.locator('input[placeholder*="Search" i], input[placeholder*="Filter" i]')).first();
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.click();
      await searchInput.fill(targetMRN);
      await page.keyboard.press('Enter');
    }

    const row = page.locator(`tr:has-text("${targetMRN}"), [role="row"]:has-text("${targetMRN}")`).first();
    await expect(row).toBeVisible({ timeout: 5000 });
    const rowText = await row.innerText().catch(() => '');

    console.log('\n============================================================');
    console.log('📋 [STATUS CHECK 1/2 — ONBOARDING OFFICER (SUKESH)]');
    console.log(`📄 MRN NUMBER    : ${targetMRN}`);
    console.log(`🏢 TRADE NAME    : ${currentState.tradeName || 'N/A'}`);
    console.log('📍 LOCATION       : Submitted List');
    console.log(`📋 DETAILS       : ${rowText.replace(/\n+/g, ' | ')}`);
    console.log('============================================================\n');

    const basePage = new BaseWizardPage(page);
    await basePage.signOut();
  });

  test('2nd — Compliance officer (Bhanu) sees record in Approved list', async ({ page }) => {
    const currentState = loadState();
    test.skip(!currentState.mrn || !currentState.complianceApproved, 'Compliance officer did not approve an MRN record.');
    test.skip(Boolean((currentState as any).onHold || !(currentState as any).finalApproved), 'Merchant is On-hold (Under compliance review) / not final approved; skipping post-activation status checks.');
    const targetMRN = currentState.mrn;

    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login(ROLES.compliance.username, ROLES.compliance.password, ROLES.compliance.totpSecret);
    await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {});

    const queue = new ComplianceQueuePage(page);
    await queue.navigateToApproved();
    await queue.filterByMRN(targetMRN);

    const row = page.locator(`tr:has-text("${targetMRN}"), [role="row"]:has-text("${targetMRN}")`).first();
    await expect(row).toBeVisible({ timeout: 5000 });
    const rowText = await row.innerText().catch(() => '');

    console.log('\n============================================================');
    console.log('📋 [STATUS CHECK 2/2 — COMPLIANCE OFFICER (BHANU)]');
    console.log(`📄 MRN NUMBER    : ${targetMRN}`);
    console.log(`🏢 TRADE NAME    : ${currentState.tradeName || 'N/A'}`);
    console.log('📍 LOCATION       : Compliance Approved List');
    console.log(`📋 DETAILS       : ${rowText.replace(/\n+/g, ' | ')}`);
    console.log('============================================================\n');

    const basePage = new BaseWizardPage(page);
    await basePage.signOut();
  });
});
