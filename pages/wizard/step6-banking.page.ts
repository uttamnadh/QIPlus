import { Page } from '@playwright/test';
import { BaseWizardPage } from './base-wizard.page';

/**
 * Page Object for Step 6 (Banking) — Banking & settlement details.
 * WHY: Banking step has IBAN validation (AE + 21 digits), SWIFT format
 * (8 or 11 chars), and dropdown selects for bank, currency, account type.
 * OPTIMIZED: Direct fast .fill() inputs, condition-based dropdown waits, zero dead sleeps.
 */
export class Step6BankingPage extends BaseWizardPage {
  constructor(page: Page) {
    super(page);
  }

  async fillAccountHolderName(value: string) {
    await this.page.getByLabel('Account holder name *').fill(value);
  }

  async selectBankName(value: string) {
    await this.selectDropdown('banking.bankNameId', value);
  }

  async fillBranchNameEmirate(value: string) {
    await this.page.getByLabel('Branch name & emirate *').fill(value);
  }

  async fillIBAN(value: string) {
    await this.page.getByLabel('IBAN *').fill(value);
  }

  async fillSwiftBic(value: string) {
    await this.page.getByLabel('SWIFT / BIC code *').fill(value);
  }

  async selectAccountCurrency(value: string) {
    await this.selectDropdown('banking.accountCurrency', value);
  }

  async selectAccountType(value: string) {
    await this.selectDropdown('banking.accountType', value);
  }

  /** Get value of IBAN input field as currently displayed. */
  async getIBANDisplayValue(): Promise<string> {
    return this.page.getByLabel('IBAN *').inputValue().catch(() => '');
  }

  async fillAll(data: {
    accountHolderName: string;
    bankName: string;
    branchNameEmirate: string;
    iban: string;
    swiftBic: string;
    accountCurrency: string;
    accountType: string;
  }) {
    // 1. Select dropdowns
    await this.selectBankName(data.bankName).catch(() => {});
    await this.selectAccountCurrency(data.accountCurrency).catch(() => {});
    await this.selectAccountType(data.accountType).catch(() => {});

    // 2. Fill text fields reliably via labels
    await this.page.getByLabel('Account holder name *').fill(data.accountHolderName);
    await this.page.getByLabel('Branch name & emirate *').fill(data.branchNameEmirate);
    await this.page.getByLabel('IBAN *').fill(data.iban);
    await this.page.getByLabel('SWIFT / BIC code *').fill(data.swiftBic);
  }
}
