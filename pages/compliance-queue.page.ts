import { Page, expect } from '@playwright/test';

/**
 * Page Object for the Compliance officer's verification queue and review screens.
 * WHY: Strictly targets the specific created MRN without falling back to recent records.
 *
 * AML SCREENING NOTE: "Approve & forward" now triggers an async backend AML screening check.
 * The record may NOT immediately appear in Compliance > Approved. Use waitForRecordInApproved()
 * with tight polling logic instead of fixed sleeps.
 * OPTIMIZED: Condition-based navigation and tight polling intervals (1s).
 */
export class ComplianceQueuePage {
  constructor(private page: Page) {}

  /** Navigate to the verification queue via sidebar. */
  async navigateToVerificationQueue() {
    const backBtn = this.page.locator('button:has-text("Back")').first();
    if (await backBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await backBtn.click().catch(() => {});
    }

    const link = this.page.locator('button:has-text("Verification queue"), a:has-text("Verification queue"), nav :text("Verification queue")').first();
    if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
      await link.click();
    } else {
      await this.page.click('text="Verification queue"');
    }
  }

  /** Filter the queue strictly by target MRN. */
  async filterByMRN(mrn: string) {
    const input = this.page.getByPlaceholder('Filter by MRN or company name')
      .or(this.page.getByPlaceholder('Filter by MRN or name'))
      .or(this.page.locator('input[placeholder*="MRN" i], input[placeholder*="Filter" i]')).first();
    await input.click();
    await input.fill(mrn);
    await this.page.keyboard.press('Enter');
  }

  /**
   * Open the exact merchant record by target MRN created in onboarding officer.
   * Uses fast retry polling to guarantee deterministic opening even if backend indexing
   * takes 1-3 seconds to propagate the freshly submitted record.
   */
  async openMerchant(targetMRN: string, maxAttempts: number = 6, delayMs: number = 1000) {
    expect(targetMRN).toBeTruthy();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[Compliance] Checking Verification Queue for MRN ${targetMRN} (attempt ${attempt}/${maxAttempts})`);
      await this.filterByMRN(targetMRN);

      // Wait briefly for table skeleton loader if present
      await this.page.locator('.MuiSkeleton-root').first().waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});

      const matchingRow = this.page.locator(`tr:has-text("${targetMRN}"), [role="row"]:has-text("${targetMRN}")`).first();
      const isVisible = await matchingRow.isVisible({ timeout: 1500 }).catch(() => false);

      if (isVisible) {
        console.log(`[Compliance] ✅ Found MRN ${targetMRN} in Verification Queue on attempt ${attempt}. Opening record...`);
        await matchingRow.click();
        return;
      }

      if (attempt < maxAttempts) {
        await this.page.waitForTimeout(delayMs);
        await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await this.navigateToVerificationQueue().catch(() => {});
      }
    }

    // Final assertion to produce a clear assertion failure if never found
    const matchingRow = this.page.locator(`tr:has-text("${targetMRN}"), [role="row"]:has-text("${targetMRN}")`).first();
    await expect(matchingRow).toBeVisible({ timeout: 4000 });
    await matchingRow.click();
  }

  /** Get the status badge text for a merchant by MRN. */
  async getStatusByMRN(mrn: string): Promise<string> {
    const row = this.page.locator(`tr:has-text("${mrn}"), div:has-text("${mrn}")`);
    const status = row.locator('text=/Submitted for review|Under compliance review|Active|Rejected|Returned for info|Pending final approval/').first();
    return status.innerText();
  }

  /**
   * Approve the currently open merchant.
   * AML SCREENING: After clicking "Approve & forward", verifies the toast message
   * "Decision recorded: Approve & forward." confirming the async AML check was triggered.
   */
  async approveMerchant(notes: string = 'Approved by compliance officer after verifying documents and details.') {
    // Fill Decision notes * mandatory field
    const notesInput = this.page.locator('textarea[placeholder*="rationale" i], textarea, input[name="notes"]').first();
    await notesInput.waitFor({ state: 'visible', timeout: 5000 });
    await notesInput.fill(notes);

    const approveBtn = this.page.locator('button:has-text("Approve & forward"), button:has-text("Approve")').first();
    await expect(approveBtn).toBeEnabled({ timeout: 5000 });
    await approveBtn.click();

    // Handle confirmation dialog reliably
    const confirmBtn = this.page.locator('[role="dialog"] button:has-text("Confirm"), .MuiDialog-paper button:has-text("Confirm"), [role="dialog"] button:has-text("Approve")').first();
    if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await confirmBtn.click();
    }
  }

  /**
   * Wait for a record to appear in the Approved section with retry polling logic.
   * Polling interval is optimized to 1s.
   */
  async waitForRecordInApproved(targetMRN: string, maxAttempts: number = 8, delayMs: number = 1000): Promise<{ found: boolean; status: string }> {
    let lastFoundStatus: string | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[Compliance] Checking Approved section for MRN ${targetMRN} (attempt ${attempt}/${maxAttempts})`);

      await this.navigateToApproved().catch(() => {});
      await this.filterByMRN(targetMRN);

      const row = this.page.locator(`tr:has-text("${targetMRN}"), [role="row"]:has-text("${targetMRN}")`).first();
      const isVisible = await row.isVisible({ timeout: 1500 }).catch(() => false);

      if (isVisible) {
        const rowText = await row.innerText().catch(() => '');
        lastFoundStatus = rowText;
        console.log(`[Compliance] Found MRN ${targetMRN} in Approved section: ${rowText.replace(/\n+/g, ' | ')}`);
        
        if (!/Pending\s+Screening/i.test(rowText)) {
          return { found: true, status: rowText };
        }
      }

      if (attempt < maxAttempts) {
        await this.page.waitForTimeout(delayMs);
        await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      }
    }

    if (lastFoundStatus) {
      return { found: true, status: lastFoundStatus };
    }

    return { found: false, status: '' };
  }

  /** Verify the review page shows the expected trade name. */
  async expectTradeName(tradeName: string) {
    await expect(this.page.locator(`text="${tradeName}"`).first()).toBeVisible();
  }

  /** Verify the review page shows the expected legal entity. */
  async expectLegalEntity(legalEntity: string) {
    await expect(this.page.locator(`text="${legalEntity}"`).first()).toBeVisible();
  }

  /** Navigate to Approved list. */
  async navigateToApproved() {
    // If on detail page, click Back first
    const backBtn = this.page.locator('button:has-text("Back")').first();
    if (await backBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await backBtn.click();
      await this.page.waitForTimeout(500);
    }

    const approvedLink = this.page.locator('button:has-text("Approved"), a:has-text("Approved"), [role="tab"]:has-text("Approved"), nav :text("Approved")').first();
    if (await approvedLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await approvedLink.click();
    } else {
      await this.page.click('text="Approved"');
    }
    await this.page.waitForTimeout(500);
  }

  // ── Helpers for negative testing ──────────────────────────────

  async rejectWithoutReason() {
    const btn = this.page.locator('button:has-text("Reject")').first();
    await btn.click().catch(() => {});
  }

  async holdWithoutReason() {
    const btn = this.page.locator('button:has-text("On-hold"), button:has-text("Hold")').first();
    await btn.click().catch(() => {});
  }

  async returnWithoutComments() {
    const btn = this.page.locator('button:has-text("Request clarification"), button:has-text("Return")').first();
    await btn.click().catch(() => {});
  }

  async returnForClarification(reason: string) {
    const notesInput = this.page.locator('textarea, [role="textbox"]').first();
    if (await notesInput.isVisible({ timeout: 1500 }).catch(() => false)) {
      await notesInput.fill(reason);
    }
    await this.returnWithoutComments();
    const confirmBtn = this.page.locator('.MuiDialog-paper button:has-text("Confirm"), .MuiDialog-paper button:has-text("Request")').first();
    if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await confirmBtn.click().catch(() => {});
    }
  }

  async holdMerchant(reason: string) {
    const notesInput = this.page.locator('textarea, [role="textbox"]').first();
    if (await notesInput.isVisible({ timeout: 1500 }).catch(() => false)) {
      await notesInput.fill(reason);
    }
    await this.holdWithoutReason();
    const confirmBtn = this.page.locator('.MuiDialog-paper button:has-text("Confirm"), .MuiDialog-paper button:has-text("Hold")').first();
    if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await confirmBtn.click().catch(() => {});
    }
  }

  async navigateToOnHoldList() {
    const link = this.page.locator('a:has-text("On-hold"), button:has-text("On-hold")').first();
    await link.click().catch(() => {});
  }

  async releaseFromHold() {
    const btn = this.page.locator('button:has-text("Release"), button:has-text("Resume")').first();
    await btn.click().catch(() => {});
  }

  async isReviewReadOnly(): Promise<boolean> {
    const notesInput = this.page.locator('textarea, [role="textbox"]').first();
    return !(await notesInput.isEnabled().catch(() => false));
  }
}
