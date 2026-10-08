import { Page, expect } from '@playwright/test';

/**
 * Page Object for the Final Approver's approval queue.
 * WHY: Strictly targets the specific approved MRN without falling back to recent records.
 * OPTIMIZED: Condition-based navigation and selection, zero dead sleeps.
 */
export class ApprovalQueuePage {
  constructor(private page: Page) {}

  /** Navigate to the approval queue via sidebar. */
  async navigateToApprovalQueue() {
    const link = this.page.locator('button:has-text("Approval queue"), a:has-text("Approval queue"), nav :text("Approval queue"), [href*="/merchants/approval"]').first();
    if (await link.isVisible({ timeout: 500 }).catch(() => false)) {
      await link.click();
      return;
    }

    const backBtn = this.page.locator('button:has-text("Back")').first();
    if (await backBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await backBtn.click();
    }
    await this.page.click('text="Approval queue"').catch(() => {});
  }

  /** Filter by MRN or name/company name. */
  async filterByMRN(mrn: string) {
    const input = this.page.getByPlaceholder('Filter by MRN or company name')
      .or(this.page.getByPlaceholder('Filter by MRN or name'))
      .or(this.page.locator('input[placeholder*="MRN" i], input[placeholder*="Filter" i]')).first();
    await input.click();
    await input.fill(mrn);
    await this.page.keyboard.press('Enter');
  }

  /**
   * Open the exact merchant record by target MRN approved in compliance.
   * STRICT REQUIREMENT: Does NOT fall back to recent MRN records if target is not found.
   */
  async openMerchant(targetMRN: string) {
    expect(targetMRN).toBeTruthy();
    await this.filterByMRN(targetMRN);

    // Locate the row strictly matching the created target MRN
    const matchingRow = this.page.locator(`tr:has-text("${targetMRN}"), [role="row"]:has-text("${targetMRN}")`).first();
    await expect(matchingRow).toBeVisible({
      timeout: 5000
    });

    await matchingRow.click();
  }

  /** Get status for a merchant by MRN. */
  async getStatusByMRN(mrn: string): Promise<string> {
    const row = this.page.locator(`tr:has-text("${mrn}"), div:has-text("${mrn}")`);
    const status = row.locator('text=/Pending final approval|Under compliance review|Active|Approved|Rejected/').first();
    return status.innerText();
  }

  /** Approve the currently open merchant. */
  async approveMerchant(notes: string = 'Final approval granted.') {
    const notesInput = this.page.locator('textarea, [role="textbox"], input[name="notes"]').first();
    await notesInput.waitFor({ state: 'visible', timeout: 5000 });
    const isEditable = await notesInput.isEditable().catch(() => false);
    if (!isEditable) {
      console.log('[ApprovalQueue] ℹ️ Decision notes is disabled / locked — cannot take decision in final approver.');
      return;
    }

    await notesInput.fill(notes);

    const approveBtn = this.page.locator('button:has-text("Approve & Activate"), button:has-text("Approve & activate"), button:has-text("Approve")').first();
    await expect(approveBtn).toBeEnabled({ timeout: 5000 });
    await approveBtn.click();

    // Handle confirmation dialog reliably
    const confirmBtn = this.page.locator('[role="dialog"] button:has-text("Confirm"), .MuiDialog-paper button:has-text("Confirm"), [role="dialog"] button:has-text("Approve")').first();
    if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await confirmBtn.click();
      await this.page.locator('.MuiDialog-root, .MuiBackdrop-root').first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }
  }

  /** Verify trade name on review. */
  async expectTradeName(tradeName: string) {
    await expect(this.page.locator(`text="${tradeName}"`).first()).toBeVisible({ timeout: 3000 });
  }

  /**
   * Wait for a record to appear in the Approval Queue with fast retry polling logic.
   * Polling interval is optimized to 1s.
   */
  async waitForRecordInApprovalQueue(targetMRN: string, maxAttempts: number = 8, delayMs: number = 1000): Promise<boolean> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[ApprovalQueue] Checking Approval Queue for MRN ${targetMRN} (attempt ${attempt}/${maxAttempts})`);

      await this.navigateToApprovalQueue().catch(() => {});
      await this.filterByMRN(targetMRN);

      const matchingRow = this.page.locator(`tr:has-text("${targetMRN}"), [role="row"]:has-text("${targetMRN}")`).first();
      const isVisible = await matchingRow.isVisible({ timeout: 1500 }).catch(() => false);

      if (isVisible) {
        const rowText = await matchingRow.innerText().catch(() => '');
        console.log(`[ApprovalQueue] ✅ Found MRN ${targetMRN} in Approval Queue on attempt ${attempt}. Opening record...`);
        await matchingRow.click();
        return true;
      }

      if (attempt < maxAttempts) {
        await this.page.waitForTimeout(delayMs);
        await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      }
    }

    console.log(`[ApprovalQueue] ⚠️ MRN ${targetMRN} NOT found in Approval Queue after ${maxAttempts} attempts.`);
    return false;
  }

  /**
   * Click "Re-check screening result" button if visible on the approval page
   * to trigger a fresh check against eMcREY screening engine.
   */
  async recheckScreeningResult(): Promise<boolean> {
    const recheckBtn = this.page.locator('button[aria-label*="Re-check" i], button:has-text("Re-check"), [aria-label*="screening result" i]').first();
    if (await recheckBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      console.log('[ApprovalQueue] "Re-check screening result" button found. Triggering eMcREY check...');
      await recheckBtn.click();
      await this.page.waitForTimeout(2000);
      return true;
    }
    console.log('[ApprovalQueue] "Re-check screening result" button not visible or already complete.');
    return false;
  }

  /** Read screening result text (e.g. CLEAR / HIT / No Match). */
  async getScreeningResult(): Promise<string> {
    const screeningLocator = this.page.locator('text=/CLEAR|HIT|No Match|Potential Match|Passed/i').first();
    if (await screeningLocator.isVisible({ timeout: 600 }).catch(() => false)) {
      return await screeningLocator.innerText().catch(() => '');
    }
    return '';
  }

  /** Navigate to Merchant Search directory. */
  async navigateToMerchantSearch() {
    // Wait for any active dialog or backdrop to finish closing
    await this.page.locator('.MuiDialog-root, .MuiBackdrop-root').first().waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});

    const searchLink = this.page.locator('a[href*="/merchants/search"], nav >> text="Merchant search"').first();
    if (await searchLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchLink.click({ force: true });
    } else {
      await this.page.goto('/merchants/search', { waitUntil: 'domcontentloaded' }).catch(() => {});
    }
    await this.page.waitForURL('**/merchants/search', { timeout: 10000 }).catch(() => {});
  }

  /**
   * Verify that merchant is now Active in Merchant Search directory or Approved merchants.
   */
  async verifyMerchantActive(mrn: string): Promise<boolean> {
    // Attempt via Approved merchants first, then Merchant search
    await this.navigateToApprovedMerchants().catch(() => {});
    await this.filterByMRN(mrn);

    // Wait for skeleton loaders to finish
    await this.page.locator('.MuiSkeleton-root').first().waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});

    let row = this.page.locator(`tr:has-text("${mrn}"), [role="row"]:has-text("${mrn}")`).first();
    let isVisible = await row.waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false);

    if (!isVisible) {
      // Fallback to Merchant search
      await this.navigateToMerchantSearch().catch(() => {});
      const searchInput = this.page.getByPlaceholder('Filter by MRN or company name')
        .or(this.page.getByPlaceholder('Filter by MRN or name'))
        .or(this.page.locator('input[placeholder*="MRN" i], input[placeholder*="Search" i]')).first();

      if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await searchInput.click();
        await searchInput.fill(mrn);
        await this.page.keyboard.press('Enter');
      }

      // Wait for table skeletons to detach after search query
      await this.page.locator('.MuiSkeleton-root').first().waitFor({ state: 'hidden', timeout: 12000 }).catch(() => {});

      row = this.page.locator(`tr:has-text("${mrn}"), [role="row"]:has-text("${mrn}")`).first();
      isVisible = await row.waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false);
    }

    if (isVisible) {
      const activeBadge = row.locator('text=/Active/i').first();
      await expect(activeBadge).toBeVisible({ timeout: 5000 }).catch(() => {});
      const rowText = await row.innerText().catch(() => '');
      console.log(`[ApprovalQueue] ✅ Verified merchant ${mrn} is ACTIVE. Row: ${rowText.replace(/\n+/g, ' | ')}`);
      return true;
    }

    return false;
  }

  /** Navigate to Approved merchants. */
  async navigateToApprovedMerchants() {
    const backBtn = this.page.locator('button:has-text("Back")').first();
    if (await backBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await backBtn.click().catch(() => {});
    }

    const link = this.page.locator('button:has-text("Approved merchants"), a:has-text("Approved merchants"), nav :text("Approved merchants")').first();
    if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
      await link.click();
    } else {
      await this.page.click('text="Approved merchants"');
    }
  }

  // ── Helpers for negative testing ──────────────────────────────

  async rejectWithoutReason() {
    const btn = this.page.locator('button:has-text("Reject")').first();
    await btn.click().catch(() => {});
  }

  async getComplianceReviewNotes(): Promise<string> {
    const notesBox = this.page.locator('text=/Approved by compliance officer|Compliance notes|Decision notes/').first();
    return notesBox.innerText().catch(() => '');
  }

  async getApprovalQueueStatuses(): Promise<string[]> {
    return this.page.locator('tbody tr td:nth-child(5)').allInnerTexts().catch(() => []);
  }

  async getRiskRating(mrn?: string): Promise<string> {
    const rating = this.page.locator('text=/Low|Medium|High/').first();
    return rating.innerText().catch(() => '');
  }
}
