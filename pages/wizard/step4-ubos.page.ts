import { Page, expect } from '@playwright/test';
import { BaseWizardPage } from './base-wizard.page';

/**
 * Page Object for Step 4: Ultimate Beneficial Owners (UBOs).
 * Handles UBO cards, ownership boundary validations (25% threshold),
 * and basis of control selection.
 * 
 * BUSINESS RULE (Dev Team Update):
 * Any individual holding 25% or more is auto-captured as a UBO.
 * In the UBO step:
 * 1. Full legal name
 * 2. % shareholding
 * 3. Emirates ID number
 * are carried forward from the Ownership step and CANNOT be rewritten or edited.
 */
export class Step4UBOsPage extends BaseWizardPage {
  constructor(page: Page) {
    super(page);
  }

  // ── High-Level Fill Actions ──────────────────────────────────

  /**
   * Fill UBO entry at the given index (0-based).
   * Note: Full legal name, % shareholding, and Emirates ID are carry-forwarded
   * for >=25% shareholders and are read-only (skipped if not editable).
   */
  async fillUBO(index: number, data: {
    fullLegalName: string;
    dateOfBirth: { day: string; month: string; year: string };
    placeOfBirth: string;
    nationality: string;
    countryOfResidence: string;
    percentShareholding: string;
    idType: string;
    emiratesIdNumber: string;
    idExpiryDate: { day: string; month: string; year: string };
    basisOfControl: string;
    occupation: string;
    pep: boolean;
  }) {
    // 1. Full legal name (skipped if carry-forwarded & read-only)
    const nameInput = this.page.getByLabel('Full legal name (as per ID) *').nth(index);
    if (await nameInput.isVisible({ timeout: 200 }).catch(() => false) && await nameInput.isEditable().catch(() => false)) {
      await nameInput.fill(data.fullLegalName).catch(() => {});
    }

    // 2. Place of birth & Occupation (direct fill)
    const pobInput = this.page.getByLabel('Place of birth *').nth(index);
    if (await pobInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await pobInput.fill(data.placeOfBirth).catch(() => {});
    }
    const occInput = this.page.getByLabel('Occupation *').nth(index);
    if (await occInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await occInput.fill(data.occupation).catch(() => {});
    }

    // 3. Emirates ID number
    const eidInput = this.page.getByLabel('Emirates ID number *').nth(index);
    if (await eidInput.isVisible({ timeout: 200 }).catch(() => false) && await eidInput.isEditable().catch(() => false)) {
      await eidInput.fill(data.emiratesIdNumber).catch(() => {});
    }

    // 4. % shareholding
    const pctInput = this.page.getByLabel('% shareholding *').nth(index);
    if (await pctInput.isVisible({ timeout: 200 }).catch(() => false) && await pctInput.isEditable().catch(() => false)) {
      await pctInput.fill(data.percentShareholding).catch(() => {});
    }

    // 5. ID type radio
    if (data.idType === 'Emirates ID') {
      await this.page.getByLabel('Emirates ID').nth(index).check({ force: true }).catch(() => {});
    } else {
      await this.page.getByLabel('Passport').nth(index).check({ force: true }).catch(() => {});
    }

    // 6. PEP checkbox
    const pepCheckbox = this.page.getByLabel('Politically Exposed Person (PEP)').nth(index);
    if (data.pep) {
      await pepCheckbox.check({ force: true }).catch(() => {});
    } else {
      await pepCheckbox.uncheck({ force: true }).catch(() => {});
    }

    // 7. Dates
    await this.fillUBODateOfBirth(index, data.dateOfBirth.day, data.dateOfBirth.month, data.dateOfBirth.year);
    await this.fillUBOIdExpiry(index, data.idExpiryDate.day, data.idExpiryDate.month, data.idExpiryDate.year);

    // 8. Dropdowns (Nationality, Residence, Basis of control - skip if default already matches)
    try {
      const natInput = this.page.locator('input[name*="nationality"], input[id*="nationality"]').nth(index).or(
        this.page.locator('label:has-text("Nationality")').nth(index).locator('..').locator('input')
      ).first();
      const curNat = (await natInput.inputValue().catch(() => '')).trim();
      const targetNat = data.nationality || 'United Arab Emirates';
      if (!curNat || !curNat.toLowerCase().includes(targetNat.toLowerCase())) {
        if (await natInput.isVisible({ timeout: 300 }).catch(() => false)) {
          await natInput.focus();
          await natInput.fill(targetNat);
          const opt = this.page.locator(`li[role="option"]:has-text("${targetNat}"), [role="option"]:has-text("${targetNat}")`).first();
          if (await opt.isVisible({ timeout: 500 }).catch(() => false)) {
            await opt.click({ force: true });
          } else {
            await this.page.keyboard.press('ArrowDown');
            await this.page.keyboard.press('Enter');
          }
        }
      }
    } catch {}

    try {
      const resInput = this.page.locator('input[name*="countryOfResidence"], input[id*="countryOfResidence"]').nth(index).or(
        this.page.locator('label:has-text("Country of residence")').nth(index).locator('..').locator('input')
      ).first();
      const curRes = (await resInput.inputValue().catch(() => '')).trim();
      const targetRes = data.countryOfResidence || 'United Arab Emirates';
      if (!curRes || !curRes.toLowerCase().includes(targetRes.toLowerCase())) {
        if (await resInput.isVisible({ timeout: 300 }).catch(() => false)) {
          await resInput.focus();
          await resInput.fill(targetRes);
          const opt = this.page.locator(`li[role="option"]:has-text("${targetRes}"), [role="option"]:has-text("${targetRes}")`).first();
          if (await opt.isVisible({ timeout: 500 }).catch(() => false)) {
            await opt.click({ force: true });
          } else {
            await this.page.keyboard.press('ArrowDown');
            await this.page.keyboard.press('Enter');
          }
        }
      }
    } catch {}

    try {
      const basisBox = this.page.locator('label:has-text("Basis of control")').nth(index).locator('..').locator('[role="combobox"]').first();
      const curBasis = (await basisBox.innerText().catch(() => '')).trim();
      if (!curBasis || !curBasis.toLowerCase().includes(data.basisOfControl.toLowerCase())) {
        if (await basisBox.isVisible({ timeout: 400 }).catch(() => false)) {
          await basisBox.click({ force: true });
          const opt = this.page.locator(`li[role="option"]:has-text("${data.basisOfControl}"), [role="option"]:has-text("${data.basisOfControl}")`).first();
          if (await opt.isVisible({ timeout: 600 }).catch(() => false)) {
            await opt.click({ force: true });
          }
        }
      }
    } catch {}
  }

  // ── Carry-Forward Verification Helpers ───────────────────────

  /**
   * Check if a UBO card has carry-forward notice text from the Ownership step.
   */
  async isUBOCarriedForward(index: number = 0): Promise<boolean> {
    const notice = this.page.locator('text=/Carried from the Ownership step/i').nth(index);
    return notice.isVisible({ timeout: 1000 }).catch(() => false);
  }

  /**
   * Check if Full legal name field is read-only / disabled.
   */
  async isUBONameReadOnly(index: number = 0): Promise<boolean> {
    const input = this.page.getByLabel('Full legal name (as per ID) *').nth(index);
    const isEditable = await input.isEditable().catch(() => true);
    return !isEditable;
  }

  /**
   * Check if % shareholding field is read-only / disabled.
   */
  async isUBOShareholdingReadOnly(index: number = 0): Promise<boolean> {
    const input = this.page.getByLabel('% shareholding *').nth(index);
    const isEditable = await input.isEditable().catch(() => true);
    return !isEditable;
  }

  /**
   * Check if Emirates ID number field is read-only / disabled.
   */
  async isUBOEmiratesIdReadOnly(index: number = 0): Promise<boolean> {
    const input = this.page.getByLabel('Emirates ID number *').nth(index);
    const isEditable = await input.isEditable().catch(() => true);
    return !isEditable;
  }

  /**
   * Assert all 3 carry-forward fields are read-only / locked.
   */
  async expectUBOCarryForwardLocked(index: number = 0) {
    const nameInput = this.page.getByLabel('Full legal name (as per ID) *').nth(index);
    const shareInput = this.page.getByLabel('% shareholding *').nth(index);
    const eidInput = this.page.getByLabel('Emirates ID number *').nth(index);

    expect(await nameInput.isEditable().catch(() => false)).toBe(false);
    expect(await shareInput.isEditable().catch(() => false)).toBe(false);
    expect(await eidInput.isEditable().catch(() => false)).toBe(false);
  }

  /** Remove any extra UBO cards beyond index 0 and ensure at least one card exists. */
  async removeExtraUBOs() {
    let count = await this.getUBOCount().catch(() => 1);
    let dAttempts = 0;
    while (count > 1 && dAttempts < 5) {
      dAttempts++;
      const deleteButtons = this.page.locator('button:has-text("Remove"), button:has-text("Delete"), button[aria-label*="delete" i], button[aria-label*="Remove" i], [data-testid*="Delete"]');
      const delCount = await deleteButtons.count().catch(() => 0);
      if (delCount > 0) {
        await deleteButtons.last().click().catch(() => {});
        const confirmBtn = this.page.locator('.MuiDialog-paper button:has-text("Delete"), .MuiDialog-paper button:has-text("Confirm"), [role="dialog"] button:has-text("Delete")').first();
        if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmBtn.click().catch(() => {});
        }
      } else {
        break;
      }
      count = await this.getUBOCount().catch(() => 1);
    }
  }

  // ── Helper methods for negative and regression tests ─────────

  async isSaveBlocked(): Promise<boolean> {
    const btn = this.page.locator('button:has-text("Save & continue")');
    return (await btn.getAttribute('disabled')) !== null || !(await btn.isEnabled());
  }

  async fillUBOName(index: number, name: string) {
    const input = this.page.getByLabel('Full legal name (as per ID) *').nth(index);
    if (await input.isEditable().catch(() => false)) {
      await input.fill(name).catch(() => {});
    }
  }

  async fillUBODateOfBirth(index: number, day: any, month?: string, year?: string) {
    try {
      let dStr = day;
      let mStr = month;
      let yStr = year;
      if (typeof day === 'object' && day !== null) {
        dStr = day.day;
        mStr = day.month;
        yStr = day.year;
      }
      const dobContainer = this.page.locator('div:has-text("Date of birth")').locator('xpath=ancestor::div[contains(@class, "MuiFormControl-root") or @role="group"]').nth(index);

      const formatted = `${dStr}/${mStr}/${yStr}`;
      const digits = `${dStr}${mStr}${yStr}`;
      const input = dobContainer.locator('input').first();
      if (await input.isVisible({ timeout: 200 }).catch(() => false)) {
        await input.focus().catch(() => {});
        await input.fill(formatted).catch(() => {});
        const curVal = await input.inputValue().catch(() => '');
        if (curVal.replace(/\D/g, '') === digits) {
          return;
        }
      }

      const daySpinner = dobContainer.locator('[role="spinbutton"][aria-label="Day"], [role="spinbutton"]').first();
      if (await daySpinner.isVisible({ timeout: 200 }).catch(() => false)) {
        await daySpinner.click({ force: true }).catch(() => {});
        await this.page.keyboard.type(digits, { delay: 0 }).catch(() => {});
        return;
      }
    } catch {}
  }

  async fillUBOPlaceOfBirth(index: number, place: string) {
    await this.page.getByLabel('Place of birth *').nth(index).fill(place).catch(() => {});
  }

  async fillUBOEmiratesId(index: number, idNum: string) {
    const input = this.page.getByLabel('Emirates ID number *').nth(index);
    if (await input.isEditable().catch(() => false)) {
      await input.fill(idNum).catch(() => {});
    }
  }

  async fillUBOIdExpiry(index: number, day: any, month?: string, year?: string) {
    try {
      let dStr = day;
      let mStr = month;
      let yStr = year;
      if (typeof day === 'object' && day !== null) {
        dStr = day.day;
        mStr = day.month;
        yStr = day.year;
      }
      const expiryContainer = this.page.locator('div:has-text("ID expiry date")').locator('xpath=ancestor::div[contains(@class, "MuiFormControl-root") or @role="group"]').nth(index);

      const formatted = `${dStr}/${mStr}/${yStr}`;
      const digits = `${dStr}${mStr}${yStr}`;
      const input = expiryContainer.locator('input').first();
      if (await input.isVisible({ timeout: 200 }).catch(() => false)) {
        await input.focus().catch(() => {});
        await input.fill(formatted).catch(() => {});
        const curVal = await input.inputValue().catch(() => '');
        if (curVal.replace(/\D/g, '') === digits) {
          return;
        }
      }

      const daySpinner = expiryContainer.locator('[role="spinbutton"][aria-label="Day"], [role="spinbutton"]').first();
      if (await daySpinner.isVisible({ timeout: 200 }).catch(() => false)) {
        await daySpinner.click({ force: true }).catch(() => {});
        await this.page.keyboard.type(digits, { delay: 0 }).catch(() => {});
        return;
      }
    } catch {}
  }

  async fillUBOShareholding(index: number, percent: string) {
    const input = this.page.getByLabel('% shareholding *').nth(index);
    if (await input.isEditable().catch(() => false)) {
      await input.fill(percent).catch(() => {});
    }
  }

  async selectUBOBasisOfControl(index: number, basis: string) {
    try {
      const basisCombobox = this.page.locator(`[name="ubos.${index}.basisOfControl"], [name*="basisOfControl"]`).first().locator('xpath=ancestor::div[contains(@class, "MuiInputBase-root")]');
      if (await basisCombobox.isVisible({ timeout: 1000 }).catch(() => false)) {
        await basisCombobox.click();
      } else {
        await this.page.locator('[role="combobox"]').nth(index * 3 + 2).click();
      }
      const opt = this.page.locator(`[role="option"]:has-text("${basis}"), li:has-text("${basis}")`).first();
      await opt.waitFor({ state: 'visible', timeout: 3000 });
      await opt.click();
      await opt.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
    } catch {}
  }

  async selectBasisOfControlOnly(a: number | string, b?: number | string) {
    const index = typeof a === 'number' ? a : (typeof b === 'number' ? b : 0);
    const basis = typeof a === 'string' ? a : (typeof b === 'string' ? b : '');
    await this.selectUBOBasisOfControl(index, basis);
  }

  async clearShareholderPercent(index: number = 0) {
    const input = this.page.getByLabel('% shareholding *').nth(index);
    if (await input.isEditable().catch(() => false)) {
      await input.fill('').catch(() => {});
    }
  }

  async fillShareholderPercentOnly(a: number | string, b?: number | string) {
    const index = typeof a === 'number' ? a : (typeof b === 'number' ? b : 0);
    const percent = typeof a === 'string' ? a : (typeof b === 'string' ? b : '');
    await this.fillUBOShareholding(index, percent);
  }

  async getShareholderPercentError(index?: number): Promise<string> {
    const err = this.page.locator('p.Mui-error, span.Mui-error, [role="alert"]').first();
    return err.innerText().catch(() => '');
  }

  async getUBOCount(): Promise<number> {
    const byHeading = await this.page.locator('h6').filter({ hasText: /^UBO\s+\d+/i }).count();
    if (byHeading > 0) return byHeading;
    const byName = await this.page.locator('input[name*="ubos."][name*="fullName"], input[name*="placeOfBirth"]').count();
    if (byName > 0) return byName;
    return this.page.getByLabel('Full legal name (as per ID) *').count();
  }

  async setUBOPep(index: number, pep: boolean) {
    await this.setUBOPEP(index, pep);
  }

  async deleteUBO(index: number) {
    try {
      const deleteButtons = this.page.locator('button:has-text("Remove"), button:has-text("Delete"), button[aria-label*="delete" i], button[aria-label*="Remove" i], [data-testid*="Delete"]');
      const count = await deleteButtons.count().catch(() => 0);
      if (count > index) {
        await deleteButtons.nth(index).click({ force: true }).catch(() => {});
        const confirmBtn = this.page.locator('.MuiDialog-paper button:has-text("Delete"), .MuiDialog-paper button:has-text("Confirm"), [role="dialog"] button:has-text("Delete")').first();
        if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmBtn.click().catch(() => {});
        }
      }
    } catch {}
  }

  async selectUBONationality(index: number, nationality: string) {
    try {
      const natCombobox = this.page.locator(`[name="ubos.${index}.nationality"], [name*="nationality"]`).first().locator('xpath=ancestor::div[contains(@class, "MuiInputBase-root")]');
      if (await natCombobox.isVisible({ timeout: 1000 }).catch(() => false)) {
        await natCombobox.click();
      } else {
        await this.page.locator('[role="combobox"]').nth(index * 3).click();
      }
      const opt = this.page.locator(`[role="option"]:has-text("${nationality}"), li:has-text("${nationality}")`).first();
      await opt.waitFor({ state: 'visible', timeout: 3000 });
      await opt.click();
      await opt.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
    } catch {}
  }

  async selectUBOCountryOfResidence(index: number, country: string) {
    try {
      const resCombobox = this.page.locator(`[name="ubos.${index}.countryOfResidence"], [name*="countryOfResidence"]`).first().locator('xpath=ancestor::div[contains(@class, "MuiInputBase-root")]');
      if (await resCombobox.isVisible({ timeout: 1000 }).catch(() => false)) {
        await resCombobox.click();
      } else {
        await this.page.locator('[role="combobox"]').nth(index * 3 + 1).click();
      }
      const opt = this.page.locator(`[role="option"]:has-text("${country}"), li:has-text("${country}")`).first();
      await opt.waitFor({ state: 'visible', timeout: 3000 });
      await opt.click();
      await opt.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
    } catch {}
  }

  async fillUBOOccupation(index: number, occupation: string) {
    await this.page.getByLabel('Occupation *').nth(index).fill(occupation).catch(() => {});
  }

  async setUBOPEP(index: number, pep: boolean) {
    const pepCheckbox = this.page.getByLabel('Politically Exposed Person (PEP)').nth(index);
    if (pep) {
      await pepCheckbox.check({ force: true }).catch(() => {});
    } else {
      await pepCheckbox.uncheck({ force: true }).catch(() => {});
    }
  }

  async addUBO() {
    const addBtn = this.page.locator('button:has-text("Add UBO"), button:has-text("Add beneficial"), button:has-text("Add owner")').first();
    await addBtn.click();
  }

  async getUBOCardCount(): Promise<number> {
    return this.page.locator('[data-testid*="ubo"], .MuiCard-root, fieldset').count();
  }

  async getTotalShareholdingEntered(): Promise<string> {
    const text = await this.page.locator('text=/Total shareholding entered:\\s*\\d+/').innerText().catch(() => '');
    return text;
  }
}
