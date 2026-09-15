"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Step6BankingPage = void 0;
const base_wizard_page_1 = require("./base-wizard.page");
/**
 * Page Object for Step 6 (Banking) — Banking & settlement details.
 * WHY: Banking step has IBAN validation (AE + 21 digits), SWIFT format
 * (8 or 11 chars), and dropdown selects for bank, currency, account type.
 * OPTIMIZED: Direct fast .fill() inputs, condition-based dropdown waits, zero dead sleeps.
 */
class Step6BankingPage extends base_wizard_page_1.BaseWizardPage {
    constructor(page) {
        super(page);
    }
    async fillAccountHolderName(value) {
        await this.page.getByLabel('Account holder name *').fill(value);
    }
    async selectBankName(value) {
        await this.selectDropdown('banking.bankNameId', value);
    }
    async fillBranchNameEmirate(value) {
        await this.page.getByLabel('Branch name & emirate *').fill(value);
    }
    async fillIBAN(value) {
        await this.page.getByLabel('IBAN *').fill(value);
    }
    async fillSwiftBic(value) {
        await this.page.getByLabel('SWIFT / BIC code *').fill(value);
    }
    async selectAccountCurrency(value) {
        await this.selectDropdown('banking.accountCurrency', value);
    }
    async selectAccountType(value) {
        await this.selectDropdown('banking.accountType', value);
    }
    /** Get value of IBAN input field as currently displayed. */
    async getIBANDisplayValue() {
        return this.page.getByLabel('IBAN *').inputValue().catch(() => '');
    }
    async fillAll(data) {
        // 1. Lightning-fast batch fill for text inputs
        await this.fastFillReact({
            'input[name="banking.accountHolderName"], input[id*="accountHolderName" i]': data.accountHolderName,
            'input[name="banking.branchNameEmirate"], input[id*="branchNameEmirate" i]': data.branchNameEmirate,
            'input[name="banking.iban"], input[id*="iban" i]': data.iban,
            'input[name="banking.swiftBic"], input[id*="swiftBic" i]': data.swiftBic,
        });
        // Fallbacks
        const acctInp = this.page.getByLabel('Account holder name *').first();
        if (await acctInp.isVisible({ timeout: 150 }).catch(() => false)) {
            if ((await acctInp.inputValue().catch(() => '')) !== data.accountHolderName) {
                await this.fillAccountHolderName(data.accountHolderName).catch(() => { });
                await this.fillBranchNameEmirate(data.branchNameEmirate).catch(() => { });
                await this.fillIBAN(data.iban).catch(() => { });
                await this.fillSwiftBic(data.swiftBic).catch(() => { });
            }
        }
        // 2. Dropdowns
        await this.selectBankName(data.bankName).catch(() => { });
        await this.selectAccountCurrency(data.accountCurrency).catch(() => { });
        await this.selectAccountType(data.accountType).catch(() => { });
    }
}
exports.Step6BankingPage = Step6BankingPage;
