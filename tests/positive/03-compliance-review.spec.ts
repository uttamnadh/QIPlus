import { test, expect } from '../../fixtures/diagnostics';
import { Page, BrowserContext } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';
import { ComplianceQueuePage } from '../../pages/compliance-queue.page';
import { BaseWizardPage } from '../../pages/wizard/base-wizard.page';
import { ROLES, loadState, saveState } from '../../fixtures/merchant-data';

/**
 * ============================================================================
 * Scenario 3: Compliance review & eMcREY Screening Polling
 *
 * Framework Architect & Lead Automation Engineer: Bhanu Kiran
 * Copyright (c) 2026 Bhanu Kiran. All rights reserved.
 * ============================================================================
 *
 * Compliance officer (bhanu) reviews the submitted merchant.
 * AML SCREENING NOTE: "Approve & forward" triggers asynchronous screening by eMcREY.
 * The spec verifies the toast notification, then polls the Compliance Approved section
 * >5 times until the record transitions out of "Pending Screening" into
 * "Pending final approval" or "Under compliance review".
 */
test.describe.serial('03 — Compliance review', () => {
  let ctx: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const currentState = loadState();
    if (!currentState.mrn || !currentState.submitted) {
      console.log('⚠️ [Compliance Skip] Onboarding officer did not submit an MRN. Skipping Compliance review without logging in.');
      return;
    }

    ctx = await browser.newContext();
    page = await ctx.newPage();

    // Login as compliance officer (bhanu) with automated MFA TOTP handling
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login(ROLES.compliance.username, ROLES.compliance.password, ROLES.compliance.totpSecret);
    await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {});
  });

  test.afterAll(async () => {
    await ctx?.close();
  });

  test('Search submitted record in Verification Queue, write decision notes, approve & forward', async () => {
    const currentState = loadState();
    test.skip(!currentState.mrn || !currentState.submitted, 'Onboarding officer did not submit an MRN record.');

    const queue = new ComplianceQueuePage(page);
    const targetMRN = currentState.mrn;

    console.log(`[Compliance] Searching for submitted MRN: ${targetMRN}`);
    await queue.navigateToVerificationQueue();
    await queue.openMerchant(targetMRN);

    // Verify submitted MRN record details are displayed
    await expect(page.locator(`text="${targetMRN}"`).first()).toBeVisible({ timeout: 5000 });

    if (currentState.tradeName) {
      await queue.expectTradeName(currentState.tradeName);
    }

    // Write decision notes and approve & forward
    // approveMerchant() fills mandatory decision notes, confirms modal, and verifies "Decision recorded" toast
    console.log(`[Compliance] Writing decision notes and approving MRN: ${targetMRN}`);
    await queue.approveMerchant('Approved by compliance officer after verifying all documents. Verified by Bhanu Kiran.');

    saveState({ complianceApproved: true });
    
    console.log('\n============================================================');
    console.log('✅ [POSITIVE] COMPLIANCE REVIEW AUDITED & APPROVED!');
    console.log(`📄 MRN NUMBER    : ${targetMRN}`);
    console.log('📝 DECISION      : Approved & Forwarded to Final Approver');
    console.log('============================================================\n');
  });

  test('eMcREY AML Screening Polling: Refresh >5 times until record appears in Approved section', async () => {
    test.setTimeout(90000);
    const currentState = loadState();
    test.skip(!currentState.mrn || !currentState.complianceApproved, 'Compliance review did not approve an MRN record.');
    const targetMRN = currentState.mrn;

    const queue = new ComplianceQueuePage(page);

    // eMcREY AML SCREENING: "Approve & forward" submits to eMcREY asynchronously.
    // Refresh >5 times (up to 10 attempts, 5s delay) until record arrives in Approved section
    // and transitions out of "Pending Screening" into "Pending final approval" or "Under compliance review".
    const result = await queue.waitForRecordInApproved(targetMRN, 8, 1000);

    expect(result.found, `MRN ${targetMRN} was not found in Compliance Approved section after eMcREY screening polling`).toBe(true);

    console.log(`[POSITIVE] ✅ MRN ${targetMRN} successfully passed eMcREY screening and is present in Compliance Approved section.`);

    const basePage = new BaseWizardPage(page);
    await basePage.signOut();
  });
});
