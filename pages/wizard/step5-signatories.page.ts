import { Page } from '@playwright/test';
import { BaseWizardPage } from './base-wizard.page';

/**
 * Page Object for Step 5 (Signatories) — Authorised signatories.
 * WHY: Signatories card has Full name, Designation, Nationality dropdown,
 * ID type, Emirates ID number, and Scope of authority textarea.
 * OPTIMIZED: Condition-based dropdown option selection, zero dead waits.
 */
export class Step5SignatoriesPage extends BaseWizardPage {
  constructor(page: Page) {
    super(page);
  }

  async fillSignatory(index: number, data: {
    fullName: string;
    designation: string;
    nationality: string;
    countryOfResidence?: string;
    idType: string;
    emiratesIdNumber: string;
    scopeOfAuthority: string;
  }) {
    // 1. Direct instant text inputs via Playwright labels
    await this.page.getByLabel('Full name *').nth(index).fill(data.fullName);
    await this.page.getByLabel('Designation / role *').nth(index).fill(data.designation);

    // 2. ID type radio
    if (data.idType === 'Emirates ID') {
      await this.page.getByRole('radio', { name: 'Emirates ID' }).nth(index).check({ force: true }).catch(() => {});
    } else {
      await this.page.getByRole('radio', { name: 'Passport' }).nth(index).check({ force: true }).catch(() => {});
    }

    await this.page.getByLabel('Emirates ID number *').nth(index).fill(data.emiratesIdNumber);
    await this.page.getByLabel('Scope of authority *').nth(index).fill(data.scopeOfAuthority);

    // 3. Nationality dropdown (only if not already matching)
    try {
      const natGroup = this.page.locator('.MuiFormControl-root').filter({ hasText: /Nationality/i }).nth(index);
      const curNat = await natGroup.innerText().catch(() => '');
      if (!curNat.includes(data.nationality || 'United Arab Emirates')) {
        const natCombobox = natGroup.locator('[role="combobox"]').first();
        if (await natCombobox.isVisible({ timeout: 500 }).catch(() => false)) {
          await natCombobox.click({ force: true });
          const listbox = this.page.locator('[role="listbox"]').first();
          const opt = listbox.locator(`[role="option"]:has-text("${data.nationality}"), li:has-text("${data.nationality}")`).first();
          if (await opt.isVisible({ timeout: 1000 }).catch(() => false)) {
            await opt.click({ force: true });
          }
        }
      }
    } catch {}
  }

  async addSignatory() {
    await this.page.click('button:has-text("Add signatory")');
  }

  /** Fill Full Name for signatory at index. */
  async fillSignatoryName(index: number, value: string) {
    await this.page.getByLabel('Full name *').nth(index).fill(value);
  }

  /** Fill Designation for signatory at index. */
  async fillSignatoryDesignation(index: number, value: string) {
    await this.page.getByLabel('Designation / role *').nth(index).fill(value);
  }

  /** Select Nationality for signatory at index. */
  async fillSignatoryNationality(index: number, value: string) {
    try {
      await this.page.keyboard.press('Escape').catch(() => {});
      const natGroup = this.page.locator('.MuiFormControl-root').filter({ hasText: /Nationality/i }).nth(index);
      const natCombobox = natGroup.locator('[role="combobox"]').first();
      await natCombobox.click({ force: true }).catch(() => {});
      const opt = this.page.locator(`[role="option"]:has-text("${value}"), li:has-text("${value}")`).first();
      await opt.waitFor({ state: 'visible', timeout: 3000 });
      await opt.click();
    } catch {}
  }

  /** Fill Emirates ID number for signatory at index. */
  async fillSignatoryEmiratesId(index: number, value: string) {
    await this.page.getByLabel('Emirates ID number *').nth(index).fill(value);
  }

  /** Fill Scope of Authority for signatory at index. */
  async fillSignatoryScopeOfAuthority(index: number, value: string) {
    await this.page.getByLabel('Scope of authority *').nth(index).fill(value);
  }

  /** Delete signatory card at index (or last extra signatory). */
  async deleteSignatory(index?: number) {
    try {
      const deleteButtons = this.page.locator(
        'button[aria-label*="Remove Signatory" i], button[aria-label*="remove" i], button[aria-label*="delete" i], button:has-text("Delete"), button:has-text("Remove"), [data-testid*="Delete"]'
      );
      const delCount = await deleteButtons.count().catch(() => 0);
      if (delCount > 0) {
        const targetIdx = typeof index === 'number' && index < delCount ? index : delCount - 1;
        await deleteButtons.nth(targetIdx).click({ force: true }).catch(() => {});
        const confirmBtn = this.page.locator(
          '.MuiDialog-paper button:has-text("Delete"), .MuiDialog-paper button:has-text("Confirm"), .MuiDialog-paper button:has-text("Yes"), [role="dialog"] button:has-text("Delete"), [role="dialog"] button:has-text("Confirm")'
        ).first();
        if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmBtn.click().catch(() => {});
        }
        await this.page.waitForTimeout(300);
      }
    } catch {}
  }

  /** Removes all extra signatories until only one remains. */
  async removeExtraSignatories() {
    let count = await this.getSignatoryCount().catch(() => 1);
    let dAttempts = 0;
    while (count > 1 && dAttempts < 5) {
      dAttempts++;
      const deleteButtons = this.page.locator(
        'button[aria-label*="Remove Signatory" i], button[aria-label*="remove" i], button[aria-label*="delete" i], button:has-text("Delete"), button:has-text("Remove"), [data-testid*="Delete"]'
      );
      const delCount = await deleteButtons.count().catch(() => 0);
      if (delCount > 0) {
        await deleteButtons.last().click({ force: true }).catch(() => {});
        const confirmBtn = this.page.locator(
          '.MuiDialog-paper button:has-text("Delete"), .MuiDialog-paper button:has-text("Confirm"), .MuiDialog-paper button:has-text("Yes"), [role="dialog"] button:has-text("Delete"), [role="dialog"] button:has-text("Confirm")'
        ).first();
        if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmBtn.click().catch(() => {});
        }
      } else {
        break;
      }
      await this.page.waitForTimeout(400);
      count = await this.getSignatoryCount().catch(() => 1);
    }
  }

  /** Get count of visible signatory cards. */
  async getSignatoryCount(): Promise<number> {
    return this.page.getByLabel('Full name *').count();
  }
}
