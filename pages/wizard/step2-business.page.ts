import { Page } from '@playwright/test';
import { BaseWizardPage } from './base-wizard.page';

/**
 * Page Object for Step 2 (Business) — Nature of Business details.
 * WHY: Encapsulates the business step fields including the multi-select
 * countries chip input and auto-calculated average transaction value.
 * OPTIMIZED: Direct fast .fill() inputs, zero dead waits.
 */
export class Step2BusinessPage extends BaseWizardPage {
  constructor(page: Page) {
    super(page);
  }

  async fillPrimaryProducts(value: string) {
    const textarea = this.page.getByLabel(/Primary Products/i).or(this.page.locator('textarea[name*="product" i], textarea')).first();
    await textarea.fill(value);
  }

  async fillExpectedMonthlyVolume(value: string) {
    await this.page.getByLabel('Expected Monthly Transaction Volume').fill(value);
  }

  async fillExpectedMonthlyCount(value: string) {
    await this.page.getByLabel('Expected Monthly Transaction Count').fill(value);
  }

  async fillAverageTransactionValue(value: string) {
    await this.page.getByLabel('Average Transaction Value').fill(value);
  }

  async fillYearsInOperation(value: string) {
    await this.page.getByLabel('Years in operation').fill(value);
  }

  /**
   * Select one or more countries from the "Countries where customers are
   * primarily based" multi-select autocomplete.
   * Condition-based option wait, zero dead sleeps.
   */
  async selectCustomerCountries(countries: readonly string[]) {
    for (const country of countries) {
      // Check if chip already present to avoid duplicate toggling
      const chip = this.page.locator(`.MuiChip-root:has-text("${country}")`);
      if (await chip.isVisible({ timeout: 500 }).catch(() => false)) continue;

      const countryInput = this.page.getByRole('combobox', { name: 'Countries where customers are primarily based' });
      await countryInput.click();
      await countryInput.fill(country);
      const option = this.page.locator(`[role="option"]:has-text("${country}")`).first();
      if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
        await option.click();
      }
    }
    // Dismiss any lingering autocomplete popper
    await this.page.keyboard.press('Escape').catch(() => {});
  }

  /** Set "Seasonal / Periodic business" checkbox state. */
  async setSeasonalBusiness(checked: boolean) {
    const cb = this.page.locator('input[name*="seasonal"], input[type="checkbox"]').filter({ hasText: /seasonal/i }).first();
    if (await cb.isVisible({ timeout: 2000 }).catch(() => false)) {
      const isChecked = await cb.isChecked();
      if (isChecked !== checked) {
        await cb.click();
      }
    }
  }

  /** Check if seasonal business conditional fields are visible. */
  async isSeasonalFieldsVisible(): Promise<boolean> {
    const field = this.page.locator('[name*="peakMonths"], [name*="seasonalDetails"]').first();
    return field.isVisible({ timeout: 1500 }).catch(() => false);
  }

  /** Select accepted currencies (other than AED) multi-select. */
  async selectCurrenciesAccepted(currencies: readonly string[]) {
    const input = this.page.locator('input[name*="currencies"], [role="combobox"]').filter({ hasText: /currencies/i }).first();
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      for (const curr of currencies) {
        await input.click();
        const option = this.page.locator(`[role="option"]:has-text("${curr}")`).first();
        if (await option.isVisible({ timeout: 1500 }).catch(() => false)) {
          await option.click();
        }
      }
      await this.page.keyboard.press('Escape').catch(() => {});
    }
  }

  /** Get value of Average Transaction Value field. */
  async getAverageTransactionValue(): Promise<string> {
    return this.page.getByLabel('Average Transaction Value').inputValue().catch(() => '');
  }

  /**
   * Fill all Step 2 fields from a data object.
   * OPTIMIZED: Batches independent volume/product inputs concurrently.
   */
  async fillAll(data: {
    primaryProducts: string;
    expectedMonthlyVolume: string;
    expectedMonthlyCount: string;
    averageTransactionValue: string;
    yearsInOperation: string;
    customerCountries: readonly string[];
  }) {
    // 1. Lightning-fast batch fill for all numeric & text inputs
    await this.fastFillReact({
      'textarea[name*="product" i], textarea': data.primaryProducts,
      'input[name*="expectedMonthlyVolume" i], input[id*="expectedMonthlyVolume" i]': data.expectedMonthlyVolume,
      'input[name*="expectedMonthlyCount" i], input[id*="expectedMonthlyCount" i]': data.expectedMonthlyCount,
      'input[name*="averageTransactionValue" i], input[id*="averageTransactionValue" i]': data.averageTransactionValue,
      'input[name*="yearsInOperation" i], input[id*="yearsInOperation" i]': data.yearsInOperation,
    });

    // Fallbacks if not populated
    const volInput = this.page.getByLabel('Expected Monthly Transaction Volume').first();
    if (await volInput.isVisible({ timeout: 200 }).catch(() => false)) {
      if ((await volInput.inputValue().catch(() => '')) !== data.expectedMonthlyVolume) {
        await this.fillPrimaryProducts(data.primaryProducts).catch(() => {});
        await this.fillExpectedMonthlyVolume(data.expectedMonthlyVolume).catch(() => {});
        await this.fillExpectedMonthlyCount(data.expectedMonthlyCount).catch(() => {});
        await this.fillAverageTransactionValue(data.averageTransactionValue).catch(() => {});
        await this.fillYearsInOperation(data.yearsInOperation).catch(() => {});
      }
    }

    await this.selectCustomerCountries(data.customerCountries).catch(() => {});
  }
}
