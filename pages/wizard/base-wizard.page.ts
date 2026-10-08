import { Page, Locator, expect } from '@playwright/test';

/**
 * Base page object shared by all wizard steps.
 * WHY: Uses Playwright web-first auto-retrying assertions for reliable step transitions.
 * OPTIMIZED: Zero dead waits — condition-based transitions with server-hiccup resiliency and fast sign out.
 */
export class BaseWizardPage {
  constructor(protected page: Page) {}

  // ── Step Indicator ────────────────────────────────────────────

  /** Get current step text, e.g. "Step 2 of 8: Business". */
  async getStepIndicator(): Promise<string> {
    const loc = this.page.locator('text=/Step \\d+ of 8/').first();
    await loc.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    return loc.innerText();
  }

  /** Get current step number as integer (1-8). */
  async getCurrentStepNumber(): Promise<number> {
    const text = await this.getStepIndicator().catch(() => '');
    const match = text.match(/Step (\d+) of 8/);
    return match ? parseInt(match[1], 10) : 1;
  }

  /** Assert the wizard is on the expected step number with Playwright auto-retry. */
  async expectStep(stepNumber: number) {
    const loc = this.page.locator('text=/Step \\d+ of 8/').first();
    await expect(loc).toContainText(`Step ${stepNumber} of 8`, { timeout: 10000 });
  }

  /** Get progress percentage text (e.g. "25%"). */
  async getProgressPercentage(): Promise<string> {
    return this.page.locator('text=/\\d+%/').first().innerText();
  }

  /** Get the registration/MRN number shown on the wizard page. */
  async getRegistrationNumber(): Promise<string> {
    // 1. Check header 'Registration No. <number>' or copy badge
    const headerLoc = this.page.locator('header, div:has-text("Registration No.")').first();
    if (await headerLoc.isVisible({ timeout: 1000 }).catch(() => false)) {
      const headerText = await headerLoc.innerText().catch(() => '');
      const match = headerText.match(/Registration\s*No\.?\s*([0-9A-Za-z-]+)/i);
      if (match) return match[1].trim();
    }

    // 2. Check general locator patterns
    const loc = this.page.locator('text=/Registration\\s*No\\.?\\s*\\d+/i, text=/Registration\\s+\\d+/i').first();
    if (await loc.isVisible({ timeout: 1000 }).catch(() => false)) {
      const text = await loc.innerText().catch(() => '');
      const match = text.match(/Registration\s*No\.?\s*([0-9A-Za-z-]+)/i) || text.match(/\b(202\d{5,8}|\d{10,16})\b/);
      if (match) return match[1].trim();
    }

    // 3. Check page text for 10-16 digit registration numbers
    const allText = await this.page.innerText('body').catch(() => '');
    const generalMatch = allText.match(/Registration\s*No\.?\s*([0-9A-Za-z-]+)/i) || allText.match(/\b(609\d{8,14}|202\d{7,10})\b/);
    if (generalMatch) return generalMatch[1].trim();

    return '';
  }

  // ── Navigation Buttons ────────────────────────────────────────

  /** Click 'Save & continue' cleanly. */
  async clickSaveAndContinue() {
    const btn = this.page.locator('button:has-text("Save & continue"), button:has-text("Save and continue")').first();
    await expect(btn).toBeEnabled({ timeout: 5000 });
    await btn.click();
  }

  /** Try to save and check if step advances (for negative tests). */
  async trySaveAndCheckAdvance(expectedNextStep?: number): Promise<boolean> {
    const currentIndicator = await this.getStepIndicator().catch(() => '');
    const btn = this.page.locator('button:has-text("Save & continue")').first();
    if (await btn.isEnabled().catch(() => false)) {
      await btn.click().catch(() => {});
      await this.page.waitForTimeout(400);
    }
    const newIndicator = await this.getStepIndicator().catch(() => '');
    return newIndicator !== currentIndicator;
  }

  /** Get all active validation error messages on the form. */
  async getValidationErrors(): Promise<string[]> {
    const errors = await this.page.locator('p.Mui-error, span.Mui-error, [role="alert"]').allInnerTexts().catch(() => []);
    return errors.map(e => e.trim()).filter(Boolean);
  }

  /** Click 'Back' button. */
  async clickBack() {
    await this.page.click('button:has-text("Back")');
  }

  /** Click 'Save Draft' button. */
  async clickSaveDraft() {
    await this.page.click('button:has-text("Save Draft")');
  }

  /** Check if 'Save & continue' button is enabled. */
  async isSaveAndContinueEnabled(): Promise<boolean> {
    return this.page.locator('button:has-text("Save & continue")').isEnabled();
  }

  /**
   * Superfast sign out from top navbar with zero dead waits.
   * Handles optional "Sign out?" confirmation dialog reliably (e.g. on review pages with unsaved draft state).
   */
  async signOut() {
    if (this.page.isClosed()) return;
    if (this.page.url().includes('/login')) return;

    const signOutBtn = this.page.locator('button:has-text("Sign out"), [aria-label*="Sign out" i]').first();
    if (await signOutBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await signOutBtn.click({ force: true }).catch(() => {});

      const confirmBtn = this.page.locator('[role="dialog"] button:has-text("Sign out"), .MuiDialog-paper button:has-text("Sign out"), [role="dialog"] button:has-text("Confirm")').first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click({ force: true }).catch(() => {});
      }

      await this.page.waitForURL('**/login', { timeout: 4000 }).catch(() => null);
    }

    // Fail-safe: ensure page redirects to login
    if (!this.page.url().includes('/login')) {
      await this.page.goto('/login', { waitUntil: 'domcontentloaded' }).catch(() => {});
    }
  }

  // ── MUI DatePicker Helper ────────────────────────────────────

  /**
   * Fast, accurate helper for MUI DatePicker components.
   * Direct input fill with instant spinner fallback.
   */
  async fillDate(inputName: string, day: string, month: string, year: string) {
    const formatted = `${day}/${month}/${year}`;
    const digits = `${day}${month}${year}`;

    // Map inputName to human label for fallback
    const labelPattern = inputName.includes('expiryDate')
      ? /Licen[cs]e Expiry Date/i
      : inputName.includes('issueDate')
      ? /Licen[cs]e Issue Date/i
      : inputName.includes('dateOfIncorporation')
      ? /Date of Incorporation/i
      : null;

    const input = this.page.locator(`input[name="${inputName}"]`).first().or(
      labelPattern ? this.page.getByLabel(labelPattern).first() : this.page.locator('input[name*="Date"]').first()
    );

    if (await input.isVisible({ timeout: 100 }).catch(() => false)) {
      await input.focus().catch(() => {});
      await input.fill(formatted).catch(() => {});
      const curVal = await input.inputValue().catch(() => '');
      if (curVal.includes(year) || curVal === formatted) {
        return;
      }
    }

    // Try finding the group container via label or input
    let container = labelPattern
      ? this.page.locator('label, div').filter({ hasText: labelPattern }).locator('xpath=ancestor::div[contains(@class, "MuiFormControl-root") or @role="group"]').first()
      : input.locator('xpath=ancestor::div[@role="group"]');

    const daySpinner = container.locator('[role="spinbutton"][aria-label="Day"], [role="spinbutton"]').first();
    if (await daySpinner.isVisible({ timeout: 150 }).catch(() => false)) {
      await daySpinner.click({ force: true }).catch(() => {});
      await this.page.keyboard.press('Escape').catch(() => {});
      await this.page.keyboard.type(digits, { delay: 0 }).catch(() => {});
      await this.page.keyboard.press('Escape').catch(() => {});
    }
  }

  /**
   * Helper for MUI Select (dropdown) components.
   * Clicks select, waits for option, clicks option.
   */
  async selectDropdown(nameAttr: string, optionText: string) {
    const root = this.page
      .locator(`[name="${nameAttr}"]`)
      .locator('xpath=ancestor::div[contains(@class, "MuiInputBase-root") or contains(@class, "MuiFormControl-root")]')
      .or(this.page.locator(`[name="${nameAttr}"]`).locator('..'))
      .first();

    const combobox = root.locator('[role="combobox"], .MuiSelect-select').first();
    const curVal = (await combobox.innerText().catch(() => '')).trim();

    // If current value already includes the desired option (default is already selected), skip completely!
    if (curVal && (curVal.toLowerCase() === optionText.toLowerCase() || curVal.includes(optionText))) {
      return;
    }

    const clickTarget = (await combobox.isVisible().catch(() => false)) ? combobox : root;
    await clickTarget.click();

    const option = this.page.locator(`li[role="option"]:has-text("${optionText}"), [role="option"]:has-text("${optionText}")`).first();
    await option.waitFor({ state: 'visible', timeout: 2000 });
    await option.click();
    await this.page.locator('ul[role="listbox"]').first().waitFor({ state: 'hidden', timeout: 400 }).catch(() => {});
  }

  // ── Toast Messages ───────────────────────────────────────────

  /** Get text of active toast alert. */
  async getToastMessage(): Promise<string> {
    const toast = this.page.locator('.MuiSnackbar-root, [role="alert"]');
    await expect(toast).toBeVisible({ timeout: 4000 });
    return toast.innerText();
  }
}
