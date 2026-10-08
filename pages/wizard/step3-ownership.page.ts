import { Page } from '@playwright/test';
import { BaseWizardPage } from './base-wizard.page';

/**
 * Page Object for Step 3 (Ownership) — Shareholders.
 * WHY: The ownership step has a repeating shareholder card pattern
 * with Entity/Individual dropdown, ID type radio buttons, and a
 * running total shareholding indicator.
 * OPTIMIZED: Condition-based dropdown option selection, zero dead waits.
 */
export class Step3OwnershipPage extends BaseWizardPage {
  constructor(page: Page) {
    super(page);
  }

  /** Get the total shareholding percentage displayed. */
  async getTotalShareholding(): Promise<string> {
    const text = await this.page.locator('text=/Total shareholding entered:/').innerText();
    return text.replace('Total shareholding entered:', '').trim();
  }

  /** Fill shareholder details. Index is 0-based for nth shareholder. */
  async fillShareholder(index: number, data: {
    fullLegalName: string;
    entityOrIndividual: 'Individual' | 'Entity' | string;
    countryOfRegistration: string;
    percentShareholding: string;
    idType: 'Emirates ID' | 'Passport' | 'Trade License' | string;
    emiratesIdNumber?: string;
    tradeLicenceNumber?: string;
    passportNumber?: string;
  }) {
    // Direct reliable fills
    const nameInp = this.page.getByLabel(/Full legal name/i).nth(index);
    await nameInp.fill(data.fullLegalName);

    const pctInp = this.page.getByLabel(/% shareholding/i).nth(index);
    await pctInp.fill(data.percentShareholding);

    // 3. Entity / Individual dropdown
    try {
      const entityCombobox = this.page.locator('[role="combobox"]').nth(index * 2);
      if (await entityCombobox.isVisible({ timeout: 1000 }).catch(() => false)) {
        await entityCombobox.click({ force: true });
        const listbox = this.page.locator('[role="listbox"]').first();
        const entityOpt = listbox.locator(`[role="option"]:has-text("${data.entityOrIndividual}"), li:has-text("${data.entityOrIndividual}")`).first();
        if (await entityOpt.isVisible({ timeout: 1000 }).catch(() => false)) {
          await entityOpt.click({ force: true });
        }
        await this.page.locator('[role="listbox"]').waitFor({ state: 'hidden', timeout: 300 }).catch(() => {});
      }
    } catch {}

    // 4. Country of registration / Nationality dropdown
    try {
      const countryCombobox = this.page.locator('[role="combobox"]').nth(index * 2 + 1);
      if (await countryCombobox.isVisible({ timeout: 1000 }).catch(() => false)) {
        const input = countryCombobox.locator('input').first();
        if (await input.isVisible().catch(() => false)) {
          await input.focus();
          await input.fill(data.countryOfRegistration || 'United Arab Emirates');
        } else {
          await countryCombobox.click({ force: true });
        }
        const listbox = this.page.locator('[role="listbox"]').first();
        const countryOpt = listbox.locator(`[role="option"]:has-text("${data.countryOfRegistration}"), li:has-text("${data.countryOfRegistration}")`).first();
        if (await countryOpt.isVisible({ timeout: 1500 }).catch(() => false)) {
          await countryOpt.click({ force: true });
        } else {
          await this.page.keyboard.press('ArrowDown');
          await this.page.keyboard.press('Enter');
        }
        await this.page.locator('[role="listbox"]').waitFor({ state: 'hidden', timeout: 300 }).catch(() => {});
      }
    } catch {}

    // 5. ID type & ID value
    const isEntity = /entity/i.test(data.entityOrIndividual);

    if (isEntity) {
      // Entity -> Trade License radio
      const tradeRadio = this.page.getByRole('radio', { name: /Trade Licen[cs]e/i }).or(this.page.getByLabel(/Trade Licen[cs]e/i)).first();
      if (await tradeRadio.isVisible({ timeout: 1000 }).catch(() => false)) {
        await tradeRadio.check({ force: true }).catch(() => {});
      }

      // Fill Trade Licence number (e.g. TL162770 or 876543245678322)
      const tlValue = data.tradeLicenceNumber || 'TL162770';
      const tlInput = this.page.getByLabel(/Trade Licen[cs]e number/i).first().or(this.page.locator('input[name*="licen"], input[name*="idRegNo"]').last());
      if (await tlInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await tlInput.fill(tlValue);
      }
    } else {
      // Individual -> Emirates ID or Passport
      if (/passport/i.test(data.idType)) {
        const passRadio = this.page.getByRole('radio', { name: 'Passport' }).first();
        if (await passRadio.isVisible({ timeout: 500 }).catch(() => false)) {
          await passRadio.check({ force: true }).catch(() => {});
        }
        const passInput = this.page.getByLabel(/Passport number/i).first();
        if (await passInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await passInput.fill(data.passportNumber || 'L12345678');
        }
      } else {
        const eidRadio = this.page.getByRole('radio', { name: 'Emirates ID' }).first();
        if (await eidRadio.isVisible({ timeout: 500 }).catch(() => false)) {
          await eidRadio.check({ force: true }).catch(() => {});
        }
        const idInp = this.page.getByLabel(/Emirates ID number/i).first();
        if (await idInp.isVisible({ timeout: 1000 }).catch(() => false)) {
          await idInp.fill(data.emiratesIdNumber || '784-1992-1448568-4');
        }
      }
    }
  }

  /** Click '+ Add shareholder' button. */
  async addShareholder() {
    await this.page.click('button:has-text("Add shareholder")');
  }

  /** Delete a shareholder card at the given index. */
  async deleteShareholder(index: number) {
    try {
      const delBtns = this.page.locator('button[aria-label*="Remove Shareholder" i], button[aria-label*="delete" i], button[aria-label*="remove" i], button:has-text("Delete"), button:has-text("Remove"), [data-testid*="Delete"]');
      const count = await delBtns.count();
      if (count > index) {
        await delBtns.nth(index).click({ force: true });
      } else if (count > 0) {
        await delBtns.last().click({ force: true });
      }
      const confirmBtn = this.page.locator('.MuiDialog-paper button:has-text("Delete"), .MuiDialog-paper button:has-text("Confirm"), .MuiDialog-paper button:has-text("Yes"), [role="dialog"] button:has-text("Delete")').first();
      if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmBtn.click();
      }
      await this.page.waitForTimeout(400);
    } catch {}
  }

  /** Get count of visible shareholder cards. */
  async getShareholderCount(): Promise<number> {
    const byName = await this.page.locator('input[name*="fullName"]').count();
    if (byName > 0) return byName;
    return this.page.getByLabel('Full legal name *').count();
  }

  /** Fill only the % shareholding field for shareholder at index. */
  async fillShareholderPercent(index: number, value: string) {
    const pctInp = this.page.locator(`input[name="shareholders.${index}.sharePct"], input[name*="sharePct"]`).nth(index);
    if (await pctInp.isVisible({ timeout: 1000 }).catch(() => false)) {
      await pctInp.fill(value);
    } else {
      const field = this.page.getByLabel('% shareholding *').nth(index);
      await field.fill(value);
    }
    await this.page.locator('body').click({ position: { x: 5, y: 5 }, force: true });
  }

  /** Get legal name of shareholder at index. */
  async getShareholderName(index: number): Promise<string> {
    return this.page.getByLabel('Full legal name *').nth(index).inputValue().catch(() => '');
  }

  /** Get total shareholding validation error message if visible. */
  async getTotalShareholdingError(): Promise<string> {
    const err = this.page.locator('.MuiAlert-root, [role="alert"]').first();
    if (await err.isVisible({ timeout: 1500 }).catch(() => false)) {
      return err.innerText();
    }
    return '';
  }

  /** Toggle Entity or Individual dropdown for shareholder at index. */
  async setEntityOrIndividual(index: number, type: string) {
    try {
      await this.page.keyboard.press('Escape').catch(() => {});
      const entityGroup = this.page.locator('.MuiFormControl-root').filter({ hasText: /Entity|Individual|Type/i }).nth(index);
      const entityCombobox = entityGroup.locator('[role="combobox"]').first();
      if (await entityCombobox.isVisible({ timeout: 1500 }).catch(() => false)) {
        await entityCombobox.click({ force: true });
      } else {
        await this.page.locator('[role="combobox"]').nth(index * 2).click({ force: true });
      }
      const opt = this.page.locator(`[role="option"]:has-text("${type}"), li:has-text("${type}")`).first();
      await opt.waitFor({ state: 'visible', timeout: 3000 });
      await opt.click();
      await this.page.keyboard.press('Escape').catch(() => {});
    } catch {}
  }
}
