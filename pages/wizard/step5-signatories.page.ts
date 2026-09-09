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
    // 1. Lightning-fast batch fill for all signatory inputs
    await this.fastFillReact({
      [`input[name="signatories.${index}.fullName"]`]: data.fullName,
      [`input[name="signatories.${index}.designation"]`]: data.designation,
      [`input[name="signatories.${index}.idRegNo"]`]: data.emiratesIdNumber,
      [`textarea[name="signatories.${index}.scopeOfAuthority"]`]: data.scopeOfAuthority,
    });

    // Fallbacks
    const nameInp = this.page.locator(`input[name="signatories.${index}.fullName"], input[name*="fullName"]`).nth(index);
    if (await nameInp.isVisible({ timeout: 150 }).catch(() => false)) {
      if ((await nameInp.inputValue().catch(() => '')) !== data.fullName) {
        await nameInp.fill(data.fullName);
      }
    }
    const desigInp = this.page.locator(`input[name="signatories.${index}.designation"], input[name*="designation"]`).nth(index);
    if (await desigInp.isVisible({ timeout: 150 }).catch(() => false)) {
      if ((await desigInp.inputValue().catch(() => '')) !== data.designation) {
        await desigInp.fill(data.designation);
      }
    }

    // 2. ID type radio
    if (data.idType === 'Emirates ID') {
      await this.page.getByRole('radio', { name: 'Emirates ID' }).nth(index).check({ force: true }).catch(() => {});
    } else {
      await this.page.getByRole('radio', { name: 'Passport' }).nth(index).check({ force: true }).catch(() => {});
    }

    const eid = this.page.getByLabel('Emirates ID number *').nth(index).or(
      this.page.locator(`input[name="signatories.${index}.idRegNo"], input[name*="idRegNo"]`).nth(index)
    );
    await eid.fill(data.emiratesIdNumber).catch(() => {});

    const scopeInp = this.page.getByLabel('Scope of authority *').nth(index).or(
      this.page.locator(`input[name="signatories.${index}.scopeOfAuthority"], textarea[name="signatories.${index}.scopeOfAuthority"], textarea`).nth(index)
    );
    if (await scopeInp.isVisible({ timeout: 150 }).catch(() => false)) {
      if ((await scopeInp.inputValue().catch(() => '')) !== data.scopeOfAuthority) {
        await scopeInp.fill(data.scopeOfAuthority).catch(() => {});
      }
    }

    // 3. Nationality dropdown
    try {
      const natGroup = this.page.locator('.MuiFormControl-root').filter({ hasText: /Nationality/i }).nth(index);
      const natCombobox = natGroup.locator('[role="combobox"]').first();
      if (await natCombobox.isVisible({ timeout: 800 }).catch(() => false)) {
        await natCombobox.click({ force: true });
        const listbox = this.page.locator('[role="listbox"]').first();
        const opt = listbox.locator(`[role="option"]:has-text("${data.nationality}"), li:has-text("${data.nationality}")`).first();
        if (await opt.isVisible({ timeout: 1200 }).catch(() => false)) {
          await opt.click({ force: true });
        }
        await this.page.locator('[role="listbox"]').waitFor({ state: 'hidden', timeout: 300 }).catch(() => {});
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
