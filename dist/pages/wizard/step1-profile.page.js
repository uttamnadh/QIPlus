"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Step1ProfilePage = void 0;
const base_wizard_page_1 = require("./base-wizard.page");
/**
 * Page Object for Step 1 (Profile) of the merchant onboarding wizard.
 * WHY: Encapsulates all profile fields so the test only passes data,
 * not locator details.
 * OPTIMIZED: Direct fast .fill() inputs, zero dead waits, condition-based checkbox state.
 */
class Step1ProfilePage extends base_wizard_page_1.BaseWizardPage {
    constructor(page) {
        super(page);
    }
    async fillTradeName(value) {
        await this.page.fill('input[name="profile.tradeName"]', value);
    }
    async fillLegalName(value) {
        await this.page.fill('input[name="profile.legalName"]', value);
    }
    async fillDateOfIncorporation(day, month, year) {
        await this.fillDate('profile.dateOfIncorporation', day, month, year);
    }
    async selectLegalForm(value) {
        await this.selectDropdown('profile.legalForm', value).catch(() => { });
    }
    async fillTrn(value) {
        await this.page.fill('input[name="profile.trn"]', value);
    }
    async fillWebsiteUrl(value) {
        await this.page.fill('input[name="profile.websiteUrl"]', value);
    }
    async fillPrimaryContactName(value) {
        await this.page.fill('input[name="profile.primaryContactName"]', value);
    }
    async fillPrimaryContactPosition(value) {
        await this.page.fill('input[name="profile.primaryContactPosition"]', value);
    }
    async fillPrimaryContactEmail(value) {
        await this.page.fill('input[name="profile.primaryContactEmail"]', value);
    }
    async fillPrimaryContactPhone(value) {
        const phoneInput = this.page.locator('input[type="tel"]').first();
        if (await phoneInput.isVisible({ timeout: 800 }).catch(() => false)) {
            await phoneInput.focus().catch(() => { });
            await phoneInput.click().catch(() => { });
            await this.page.keyboard.press('Control+A').catch(() => { });
            await this.page.keyboard.press('Backspace').catch(() => { });
            await phoneInput.fill('').catch(() => { });
            const raw = value.replace(/\D/g, '');
            const digitsToEnter = raw.startsWith('971') ? raw.slice(3) : raw;
            await phoneInput.fill(digitsToEnter).catch(async () => {
                await phoneInput.pressSequentially(digitsToEnter, { delay: 0 }).catch(() => { });
            });
            const curVal = await phoneInput.inputValue().catch(() => '');
            if (!curVal || curVal.replace(/\D/g, '').length < 3) {
                await phoneInput.pressSequentially(digitsToEnter, { delay: 0 }).catch(() => { });
            }
        }
    }
    async fillFloorOffice(value) {
        await this.page.fill('input[name="registeredAddress.floorOffice"]', value);
    }
    async fillAreaDistrict(value) {
        await this.page.fill('input[name="registeredAddress.areaDistrict"]', value);
    }
    async selectEmirateCity(value) {
        await this.selectDropdown('registeredAddress.emirateCity', value);
    }
    async fillPoBox(value) {
        await this.page.fill('input[name="registeredAddress.poBox"]', value);
    }
    async selectLicensingAuthority(value) {
        await this.selectDropdown('licence.licensingAuthority', value).catch(() => { });
    }
    async fillTradeLicenceNumber(value) {
        await this.page.fill('input[name="licence.tradeLicenceNumber"]', value);
    }
    async fillLicenceIssueDate(day, month, year) {
        await this.fillDate('licence.issueDate', day, month, year);
    }
    async fillLicenceExpiryDate(day, month, year) {
        await this.fillDate('licence.expiryDate', day, month, year);
    }
    async selectJurisdiction(value) {
        await this.selectDropdown('licence.jurisdiction', value);
    }
    async fillBusinessActivities(value) {
        await this.page.fill('textarea[name="licence.businessActivities"]', value);
    }
    /** Select Country of Incorporation (dropdown / autocomplete). */
    async selectCountryOfIncorporation(value) {
        const select = this.page.locator('[name="profile.countryOfIncorporation"]').locator('xpath=ancestor::div[contains(@class, "MuiInputBase-root")]').first();
        const curVal = await select.innerText().catch(() => '');
        if (curVal.includes(value))
            return;
        await this.selectDropdown('profile.countryOfIncorporation', value);
    }
    /** Set VAT registered checkbox state with reliable condition-based toggling. */
    async setVatRegistered(checked) {
        const cb = this.page.locator('input[name="profile.vatRegistered"], input[type="checkbox"]').first();
        const label = this.page.locator('label:has-text("VAT"), span:has-text("VAT")').first();
        const isChecked = await cb.isChecked().catch(() => false);
        if (isChecked !== checked) {
            if (await label.isVisible().catch(() => false)) {
                await label.click();
            }
            else {
                await cb.click({ force: true });
            }
            const stillChecked = await cb.isChecked().catch(() => false);
            if (stillChecked !== checked) {
                await cb.setChecked(checked, { force: true }).catch(() => { });
            }
        }
        if (!checked) {
            const fileInput = this.page.locator('input[type="file"]').first();
            await fileInput.waitFor({ state: 'attached', timeout: 3000 }).catch(() => { });
        }
    }
    /** Check if VAT registered checkbox is checked. */
    async isVatRegisteredChecked() {
        const cb = this.page.locator('input[name="profile.vatRegistered"]').first();
        return cb.isChecked().catch(() => false);
    }
    /** Set "Trading address same as registered" checkbox state. */
    async setTradingAddressSameAsRegistered(checked) {
        const cb = this.page.locator('input[name*="sameAsRegistered"], input[type="checkbox"]').filter({ hasText: /same as registered/i }).first();
        if (await cb.isVisible({ timeout: 2000 }).catch(() => false)) {
            const isChecked = await cb.isChecked();
            if (isChecked !== checked) {
                await cb.click();
            }
        }
    }
    /** Check if trading address fields section is visible. */
    async isTradingAddressVisible() {
        const section = this.page.locator('[name*="tradingAddress"], input[name="tradingAddress.floorOffice"]').first();
        return section.isVisible({ timeout: 1500 }).catch(() => false);
    }
    /** Fill Geo-coordinates field if available. */
    async fillGeoCoordinates(value) {
        const field = this.page.locator('input[name*="geoCoordinates"], input[name*="coordinates"]').first();
        if (await field.isVisible({ timeout: 2000 }).catch(() => false)) {
            await field.fill(value);
        }
    }
    async uploadVatDocumentInStep1(filePath) {
        const vatFileInput = this.page.locator('input[type="file"]').first();
        if ((await vatFileInput.count().catch(() => 0)) > 0) {
            await vatFileInput.setInputFiles(filePath).catch(() => { });
            return;
        }
        const uploadLabelOrBtn = this.page.locator('label:has-text("Upload"), button:has-text("Upload"), div:has-text("Upload VAT")').first();
        if (await uploadLabelOrBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            const [fileChooser] = await Promise.all([
                this.page.waitForEvent('filechooser', { timeout: 2000 }).catch(() => null),
                uploadLabelOrBtn.click({ force: true }).catch(() => { }),
            ]);
            if (fileChooser) {
                await fileChooser.setFiles(filePath).catch(() => { });
            }
        }
    }
    /**
     * Fill all Step 1 fields from a data object.
     * OPTIMIZED: Batches independent text fields concurrently with Promise.all for high speed.
     */
    async fillAll(data, options) {
        // 1. Lightning-fast batch fill for all text inputs via React synthetic events
        await this.fastFillReact({
            'profile.tradeName': data.tradeName,
            'profile.legalName': data.legalName,
            'profile.websiteUrl': data.websiteUrl,
            'profile.primaryContactName': data.primaryContactName,
            'profile.primaryContactPosition': data.primaryContactPosition,
            'profile.primaryContactEmail': data.primaryContactEmail,
            'registeredAddress.floorOffice': data.registeredAddress.floorOffice,
            'registeredAddress.areaDistrict': data.registeredAddress.areaDistrict,
            'registeredAddress.poBox': data.registeredAddress.poBox,
            'licence.tradeLicenceNumber': data.licence.number,
            'licence.activities': data.licence.activities,
        });
        // Fallback individual fills if not caught by batch
        const tradeInp = this.page.locator('input[name="profile.tradeName"]').first();
        if (await tradeInp.isVisible({ timeout: 200 }).catch(() => false)) {
            if ((await tradeInp.inputValue().catch(() => '')) !== data.tradeName) {
                await this.fillTradeName(data.tradeName).catch(() => { });
                await this.fillLegalName(data.legalName).catch(() => { });
                await this.fillWebsiteUrl(data.websiteUrl).catch(() => { });
                await this.fillPrimaryContactName(data.primaryContactName).catch(() => { });
                await this.fillPrimaryContactPosition(data.primaryContactPosition).catch(() => { });
                await this.fillPrimaryContactEmail(data.primaryContactEmail).catch(() => { });
                await this.fillFloorOffice(data.registeredAddress.floorOffice).catch(() => { });
                await this.fillAreaDistrict(data.registeredAddress.areaDistrict).catch(() => { });
                await this.fillPoBox(data.registeredAddress.poBox).catch(() => { });
                await this.fillTradeLicenceNumber(data.licence.number).catch(() => { });
            }
        }
        // Phone
        await this.fillPrimaryContactPhone(data.primaryContactPhone).catch(() => { });
        // 2. Dates
        await this.fillDateOfIncorporation(data.dateOfIncorporation.day, data.dateOfIncorporation.month, data.dateOfIncorporation.year).catch(() => { });
        await this.fillLicenceIssueDate(data.licence.issueDate.day, data.licence.issueDate.month, data.licence.issueDate.year).catch(() => { });
        await this.fillLicenceExpiryDate(data.licence.expiryDate.day, data.licence.expiryDate.month, data.licence.expiryDate.year).catch(() => { });
        // 3. Dropdowns
        await this.selectCountryOfIncorporation(data.countryOfIncorporation || 'United Arab Emirates').catch(() => { });
        await this.selectLegalForm(data.legalForm).catch(() => { });
        await this.selectEmirateCity(data.registeredAddress.emirateCity).catch(() => { });
        await this.selectLicensingAuthority(data.licence.authority).catch(() => { });
        await this.selectJurisdiction(data.licence.jurisdiction).catch(() => { });
        // 4. VAT options & TRN
        if (options?.vatRegistered === false) {
            await this.setVatRegistered(false).catch(() => { });
            if (options.vatDocPath) {
                await this.uploadVatDocumentInStep1(options.vatDocPath).catch(() => { });
            }
        }
        else {
            await this.setVatRegistered(true).catch(() => { });
            if (data.trn) {
                await this.fillTrn(data.trn).catch(() => { });
            }
        }
        await this.fillBusinessActivities(data.licence.activities).catch(() => { });
    }
}
exports.Step1ProfilePage = Step1ProfilePage;
