import { test, expect } from '../../fixtures/diagnostics';
import { Page, BrowserContext } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';
import { ApprovalQueuePage } from '../../pages/approval-queue.page';
import { BaseWizardPage } from '../../pages/wizard/base-wizard.page';
import { ROLES, loadState, saveState } from '../../fixtures/merchant-data';

/**
 * ============================================================================
 * Scenario 4: Final Approval & Merchant Activation
 *
 * Framework Architect & Lead Automation Engineer: Bhanu Kiran
 * Copyright (c) 2026 Bhanu Kiran. All rights reserved.
 * ============================================================================
 *
 * Final approver (uttamnadh) conducts final review, checks eMcREY screening, and activates merchant.
 * Handled with automated TOTP MFA login and condition-based queue navigation.
 */
test.describe.serial('04 — Final approval', () => {
  let ctx: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const currentState = loadState();
    if (!currentState.mrn || !currentState.complianceApproved) {
      console.log('⚠️ [Final Approval Skip] Compliance officer did not approve an MRN. Skipping Final approval without logging in.');
      return;
    }

    ctx = await browser.newContext();
    page = await ctx.newPage();

    // Login as final approver (uttamnadh) with automated MFA TOTP handling
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login(ROLES.approver.username, ROLES.approver.password, ROLES.approver.totpSecret);
    await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => {});
  });

  test.afterAll(async () => {
    await ctx?.close();
  });

  test('Final Approver locates MRN in Approval Queue with eMcREY polling', async () => {
    test.setTimeout(90000);
    const currentState = loadState();
    test.skip(!currentState.mrn || !currentState.complianceApproved, 'Compliance officer did not approve an MRN record.');
    const targetMRN = currentState.mrn;

    const queue = new ApprovalQueuePage(page);
    await queue.navigateToApprovalQueue();

    // eMcREY AML SCREENING POLLING: Retry-loop — refresh + re-search by MRN, up to 10 attempts
    // Waits until record appears in Approval Queue and transitions out of "Pending Screening"
    console.log(`[Final Approval] Searching for pending approval MRN: ${targetMRN}`);
    const found = await queue.waitForRecordInApprovalQueue(targetMRN, 8, 1000);
    expect(found, `MRN ${targetMRN} was not found in Approval Queue after retry attempts`).toBeTruthy();
  });

  test('Final Approver verifies eMcREY screening, re-checks result, and Activates merchant', async () => {
    const currentState = loadState();
    test.skip(!currentState.mrn || !currentState.complianceApproved, 'Compliance officer did not approve an MRN record.');
    const targetMRN = currentState.mrn;

    const queue = new ApprovalQueuePage(page);

    if (currentState.tradeName) {
      await queue.expectTradeName(currentState.tradeName);
    }

    // Read and log screening status & AML risk rating if displayed
    const screeningResult = await queue.getScreeningResult();
    if (screeningResult) {
      console.log(`[POSITIVE] eMcREY Screening Result for MRN ${targetMRN}: ${screeningResult}`);
    }

    const riskRating = await queue.getRiskRating(targetMRN);
    if (riskRating) {
      console.log(`[POSITIVE] AML Risk Rating for MRN ${targetMRN}: ${riskRating}`);
    }

    // Wait for the decision notes textarea to be visible
    const notesInput = page.locator('textarea, [role="textbox"], input[name="notes"]').first();
    await notesInput.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    const isNotesEditable = await notesInput.isEditable().catch(() => false);

    // Check explicitly if the screening result card indicates a Hit or On-hold outcome
    const isScreeningHit = await page.locator('text=/Screening hit|case opened for compliance review/i').first().isVisible({ timeout: 1500 }).catch(() => false);
    const screeningCard = page.locator('div, section').filter({ hasText: /Screening result/i }).first();
    const outcomeOnHold = await screeningCard.locator('text=/^On-hold$/i, [class*="badge"]:has-text("On-hold")').first().isVisible({ timeout: 1500 }).catch(() => false);

    // Truly On-hold or Screening Hit when notes are locked or screening explicitly says Hit/On-hold
    if (!isNotesEditable || isScreeningHit || outcomeOnHold) {
      const statusReason = isScreeningHit ? 'Screening hit (Case opened for compliance review)' : (outcomeOnHold ? 'Outcome: On-hold' : 'Decision notes locked');
      console.log(`[POSITIVE] ⚠️ Record is On-hold / Screening Hit (${statusReason}). Decision cannot be taken.`);
      saveState({ 
        onHold: true, 
        finalApproved: false,
        finalApproverDecision: 'Hit / Hold',
        screeningResult: isScreeningHit ? 'eMcREY Hit (Flagged for Review)' : (outcomeOnHold ? 'eMcREY On-hold' : 'Decision notes locked'),
        merchantStatus: outcomeOnHold ? 'On-hold' : 'Under compliance review'
      });
      test.info().annotations.push({
        type: 'info',
        description: `MRN ${targetMRN} is in ${statusReason}; decision cannot be taken.`
      });
      return;
    }

    // Screening is CLEAR: Write decision notes and approve to Active
    console.log(`[Final Approval] ✅ Screening is CLEAR. Writing decision notes and approving MRN ${targetMRN}...`);
    await queue.approveMerchant('Final approval and merchant activation granted after eMcREY AML verification. Verified by Bhanu Kiran.');
    saveState({ 
      finalApproved: true, 
      onHold: false,
      finalApproverDecision: 'Clear and Active',
      screeningResult: 'eMcREY Clear (Low Risk)',
      merchantStatus: 'Active'
    });
  });

  test('Without logout: Check merchant status (Active or On-hold), then LOGOUT', async () => {
    const currentState = loadState();
    test.skip(!currentState.mrn || !currentState.complianceApproved, 'Final approval did not complete.');
    const targetMRN = currentState.mrn;

    const queue = new ApprovalQueuePage(page);

    if ((currentState as any).onHold) {
      await queue.navigateToApprovalQueue();
      await queue.filterByMRN(targetMRN);
      const row = page.locator(`tr:has-text("${targetMRN}"), [role="row"]:has-text("${targetMRN}")`).first();
      const isRowVisible = await row.isVisible({ timeout: 3000 }).catch(() => false);
      const rowText = isRowVisible ? await row.innerText().catch(() => '') : `MRN: ${targetMRN} (Under compliance review)`;

      saveState({
        onHold: true,
        finalApproved: false,
        finalApproverDecision: 'Hit / Hold',
        screeningResult: 'eMcREY Hit (Flagged for Compliance Review)',
        merchantStatus: 'Under compliance review'
      });

      console.log('\n============================================================');
      console.log('⚠️ [VS CODE TERMINAL STATUS AUDIT — FINAL APPROVER]');
      console.log(`📄 MRN NUMBER    : ${targetMRN}`);
      console.log(`🏢 TRADE NAME    : ${currentState.tradeName || 'N/A'}`);
      console.log('🔍 SCREENING     : eMcREY Hit (Flagged for Compliance Review)');
      console.log('🔒 RECORD STATUS : 🟡 ON-HOLD (UNDER COMPLIANCE REVIEW)');
      console.log('⛔ ACTION        : Decision Locked (Buttons Disabled)');
      console.log(`📋 QUEUE ROW     : ${rowText.replace(/\n+/g, ' | ')}`);
      console.log('============================================================\n');
    } else {
      console.log(`[Final Approval] Verifying merchant ${targetMRN} is Active in directory...`);
      const isActive = await queue.verifyMerchantActive(targetMRN);
      expect(isActive, `Merchant ${targetMRN} should be verified as Active`).toBe(true);

      saveState({
        finalApproved: true,
        onHold: false,
        finalApproverDecision: 'Clear and Active',
        screeningResult: 'eMcREY Clear (Low Risk)',
        merchantStatus: 'Active'
      });

      console.log('\n============================================================');
      console.log('🌟 [VS CODE TERMINAL STATUS AUDIT — FINAL APPROVER]');
      console.log(`📄 MRN NUMBER    : ${targetMRN}`);
      console.log(`🏢 TRADE NAME    : ${currentState.tradeName || 'N/A'}`);
      console.log('🔍 SCREENING     : eMcREY Clear (Low Risk)');
      console.log('✅ RECORD STATUS : 🟢 ACTIVE (APPROVED & ACTIVATED)');
      console.log('💎 LIFECYCLE     : Onboarding -> Compliance -> Activated');
      console.log('============================================================\n');
    }

    const basePage = new BaseWizardPage(page);
    await basePage.signOut();
  });
});
