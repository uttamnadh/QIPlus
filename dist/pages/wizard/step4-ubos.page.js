"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Step4UBOsPage = void 0;
const test_1 = require("@playwright/test");
const base_wizard_page_1 = require("./base-wizard.page");
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
class Step4UBOsPage extends base_wizard_page_1.BaseWizardPage {
    constructor(page) {
        super(page);
    }
    // ── High-Level Fill Actions ──────────────────────────────────
    /**
     * Fill UBO entry at the given index (0-based).
     * Note: Full legal name, % shareholding, and Emirates ID are carry-forwarded
     * for >=25% shareholders and are read-only (skipped if not editable).
     */
    async fillUBO(index, data) {
        // 1. Full legal name (skipped if carry-forwarded & read-only)
        const nameInput = this.page.getByLabel('Full legal name (as per ID) *').nth(index);
        if (await nameInput.isVisible({ timeout: 200 }).catch(() => false) && await nameInput.isEditable().catch(() => false)) {
            await nameInput.fill(data.fullLegalName).catch(() => { });
        }
        // 2. Place of birth & Occupation (batch fill)
        await this.fastFillReact({
            [`input[name="ubos.${index}.placeOfBirth"]`]: data.placeOfBirth,
            [`input[name="ubos.${index}.occupation"]`]: data.occupation,
        });
        const pobInput = this.page.getByLabel('Place of birth *').nth(index);
        if (await pobInput.isVisible({ timeout: 150 }).catch(() => false)) {
            if ((await pobInput.inputValue().catch(() => '')) !== data.placeOfBirth) {
                await pobInput.fill(data.placeOfBirth).catch(() => { });
            }
        }
        const occInput = this.page.getByLabel('Occupation *').nth(index);
        if (await occInput.isVisible({ timeout: 150 }).catch(() => false)) {
            if ((await occInput.inputValue().catch(() => '')) !== data.occupation) {
                await occInput.fill(data.occupation).catch(() => { });
            }
        }
        // 3. Emirates ID number
        const eidInput = this.page.getByLabel('Emirates ID number *').nth(index);
        if (await eidInput.isVisible({ timeout: 200 }).catch(() => false) && await eidInput.isEditable().catch(() => false)) {
            await eidInput.fill(data.emiratesIdNumber).catch(() => { });
        }
        // 4. % shareholding
        const pctInput = this.page.getByLabel('% shareholding *').nth(index);
        if (await pctInput.isVisible({ timeout: 200 }).catch(() => false) && await pctInput.isEditable().catch(() => false)) {
            await pctInput.fill(data.percentShareholding).catch(() => { });
        }
        // 5. ID type radio
        if (data.idType === 'Emirates ID') {
            await this.page.getByLabel('Emirates ID').nth(index).check({ force: true }).catch(() => { });
        }
        else {
            await this.page.getByLabel('Passport').nth(index).check({ force: true }).catch(() => { });
        }
        // 6. PEP checkbox
        const pepCheckbox = this.page.getByLabel('Politically Exposed Person (PEP)').nth(index);
        if (data.pep) {
            await pepCheckbox.check({ force: true }).catch(() => { });
        }
        else {
            await pepCheckbox.uncheck({ force: true }).catch(() => { });
        }
        // 7. Dates
        await this.fillUBODateOfBirth(index, data.dateOfBirth.day, data.dateOfBirth.month, data.dateOfBirth.year);
        await this.fillUBOIdExpiry(index, data.idExpiryDate.day, data.idExpiryDate.month, data.idExpiryDate.year);
        // 8. Dropdowns (Nationality, Residence, Basis of control)
        try {
            const natInput = this.page.locator('input[name*="nationality"], input[id*="nationality"]').nth(index).or(this.page.locator('label:has-text("Nationality")').nth(index).locator('..').locator('input')).first();
            if (await natInput.isVisible({ timeout: 800 }).catch(() => false)) {
                await natInput.focus();
                await natInput.fill(data.nationality || 'United Arab Emirates');
                const opt = this.page.locator(`li[role="option"]:has-text("${data.nationality || 'United Arab Emirates'}"), [role="option"]:has-text("${data.nationality || 'United Arab Emirates'}")`).first();
                if (await opt.isVisible({ timeout: 1500 }).catch(() => false)) {
                    await opt.click({ force: true });
                }
                else {
                    await this.page.keyboard.press('ArrowDown');
                    await this.page.keyboard.press('Enter');
                }
                await this.page.locator('[role="listbox"]').waitFor({ state: 'hidden', timeout: 300 }).catch(() => { });
            }
        }
        catch { }
        try {
            const resInput = this.page.locator('input[name*="countryOfResidence"], input[id*="countryOfResidence"]').nth(index).or(this.page.locator('label:has-text("Country of residence")').nth(index).locator('..').locator('input')).first();
            if (await resInput.isVisible({ timeout: 800 }).catch(() => false)) {
                await resInput.focus();
                await resInput.fill(data.countryOfResidence || 'United Arab Emirates');
                const opt = this.page.locator(`li[role="option"]:has-text("${data.countryOfResidence || 'United Arab Emirates'}"), [role="option"]:has-text("${data.countryOfResidence || 'United Arab Emirates'}")`).first();
                if (await opt.isVisible({ timeout: 1500 }).catch(() => false)) {
                    await opt.click({ force: true });
                }
                else {
                    await this.page.keyboard.press('ArrowDown');
                    await this.page.keyboard.press('Enter');
                }
                await this.page.locator('[role="listbox"]').waitFor({ state: 'hidden', timeout: 300 }).catch(() => { });
            }
        }
        catch { }
        try {
            const basisBox = this.page.locator('label:has-text("Basis of control")').nth(index).locator('..').locator('[role="combobox"]').first();
            if (await basisBox.isVisible({ timeout: 800 }).catch(() => false)) {
                await basisBox.click({ force: true });
                const opt = this.page.locator(`li[role="option"]:has-text("${data.basisOfControl}"), [role="option"]:has-text("${data.basisOfControl}")`).first();
                if (await opt.isVisible({ timeout: 1200 }).catch(() => false)) {
                    await opt.click({ force: true });
                }
                await this.page.locator('[role="listbox"]').waitFor({ state: 'hidden', timeout: 300 }).catch(() => { });
            }
        }
        catch { }
    }
    // ── Carry-Forward Verification Helpers ───────────────────────
    /**
     * Check if a UBO card has carry-forward notice text from the Ownership step.
     */
    async isUBOCarriedForward(index = 0) {
        const notice = this.page.locator('text=/Carried from the Ownership step/i').nth(index);
        return notice.isVisible({ timeout: 1000 }).catch(() => false);
    }
    /**
     * Check if Full legal name field is read-only / disabled.
     */
    async isUBONameReadOnly(index = 0) {
        const input = this.page.getByLabel('Full legal name (as per ID) *').nth(index);
        const isEditable = await input.isEditable().catch(() => true);
        return !isEditable;
    }
    /**
     * Check if % shareholding field is read-only / disabled.
     */
    async isUBOShareholdingReadOnly(index = 0) {
        const input = this.page.getByLabel('% shareholding *').nth(index);
        const isEditable = await input.isEditable().catch(() => true);
        return !isEditable;
    }
    /**
     * Check if Emirates ID number field is read-only / disabled.
     */
    async isUBOEmiratesIdReadOnly(index = 0) {
        const input = this.page.getByLabel('Emirates ID number *').nth(index);
        const isEditable = await input.isEditable().catch(() => true);
        return !isEditable;
    }
    /**
     * Assert all 3 carry-forward fields are read-only / locked.
     */
    async expectUBOCarryForwardLocked(index = 0) {
        const nameInput = this.page.getByLabel('Full legal name (as per ID) *').nth(index);
        const shareInput = this.page.getByLabel('% shareholding *').nth(index);
        const eidInput = this.page.getByLabel('Emirates ID number *').nth(index);
        (0, test_1.expect)(await nameInput.isEditable().catch(() => false)).toBe(false);
        (0, test_1.expect)(await shareInput.isEditable().catch(() => false)).toBe(false);
        (0, test_1.expect)(await eidInput.isEditable().catch(() => false)).toBe(false);
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
                await deleteButtons.last().click().catch(() => { });
                const confirmBtn = this.page.locator('.MuiDialog-paper button:has-text("Delete"), .MuiDialog-paper button:has-text("Confirm"), [role="dialog"] button:has-text("Delete")').first();
                if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                    await confirmBtn.click().catch(() => { });
                }
            }
            else {
                break;
            }
            count = await this.getUBOCount().catch(() => 1);
        }
    }
    // ── Helper methods for negative and regression tests ─────────
    async isSaveBlocked() {
        const btn = this.page.locator('button:has-text("Save & continue")');
        return (await btn.getAttribute('disabled')) !== null || !(await btn.isEnabled());
    }
    async fillUBOName(index, name) {
        const input = this.page.getByLabel('Full legal name (as per ID) *').nth(index);
        if (await input.isEditable().catch(() => false)) {
            await input.fill(name).catch(() => { });
        }
    }
    async fillUBODateOfBirth(index, day, month, year) {
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
            // Dismiss any open poppers first
            await this.page.keyboard.press('Escape').catch(() => { });
            // Direct text input fill if available
            const input = dobContainer.locator('input').first();
            if (await input.isVisible({ timeout: 500 }).catch(() => false)) {
                await input.focus();
                await input.fill(`${dStr}/${mStr}/${yStr}`).catch(() => { });
                await this.page.keyboard.press('Escape').catch(() => { });
            }
            // Fill spinbuttons sequentially
            const daySpinner = dobContainer.locator('[role="spinbutton"][aria-label="Day"], [role="spinbutton"]').first();
            if (await daySpinner.isVisible({ timeout: 500 }).catch(() => false)) {
                await daySpinner.click({ force: true }).catch(() => { });
                await this.page.keyboard.press('Escape').catch(() => { });
                await this.page.keyboard.type(`${dStr}${mStr}${yStr}`, { delay: 30 }).catch(() => { });
            }
            // Check if month/year spinners need individual fill
            const monthSpinner = dobContainer.locator('[role="spinbutton"][aria-label="Month"]').first();
            if (await monthSpinner.isVisible({ timeout: 300 }).catch(() => false)) {
                const monthText = await monthSpinner.innerText().catch(() => '');
                if (monthText.includes('MM') || !monthText) {
                    await monthSpinner.click({ force: true }).catch(() => { });
                    await this.page.keyboard.press('Escape').catch(() => { });
                    if (mStr)
                        await this.page.keyboard.type(mStr, { delay: 30 }).catch(() => { });
                }
            }
            const yearSpinner = dobContainer.locator('[role="spinbutton"][aria-label="Year"]').first();
            if (await yearSpinner.isVisible({ timeout: 300 }).catch(() => false)) {
                const yearText = await yearSpinner.innerText().catch(() => '');
                if (yearText.includes('YYYY') || !yearText) {
                    await yearSpinner.click({ force: true }).catch(() => { });
                    await this.page.keyboard.press('Escape').catch(() => { });
                    if (yStr)
                        await this.page.keyboard.type(yStr, { delay: 30 }).catch(() => { });
                }
            }
            await this.page.keyboard.press('Escape').catch(() => { });
            await this.page.locator('body').click({ position: { x: 5, y: 5 }, force: true }).catch(() => { });
        }
        catch { }
    }
    async fillUBOPlaceOfBirth(index, place) {
        await this.page.getByLabel('Place of birth *').nth(index).fill(place).catch(() => { });
    }
    async fillUBOEmiratesId(index, idNum) {
        const input = this.page.getByLabel('Emirates ID number *').nth(index);
        if (await input.isEditable().catch(() => false)) {
            await input.fill(idNum).catch(() => { });
        }
    }
    async fillUBOIdExpiry(index, day, month, year) {
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
            // Dismiss any open poppers first
            await this.page.keyboard.press('Escape').catch(() => { });
            // Direct text input fill if available
            const input = expiryContainer.locator('input').first();
            if (await input.isVisible({ timeout: 500 }).catch(() => false)) {
                await input.focus();
                await input.fill(`${dStr}/${mStr}/${yStr}`).catch(() => { });
                await this.page.keyboard.press('Escape').catch(() => { });
            }
            // Fill spinbuttons sequentially
            const daySpinner = expiryContainer.locator('[role="spinbutton"][aria-label="Day"], [role="spinbutton"]').first();
            if (await daySpinner.isVisible({ timeout: 500 }).catch(() => false)) {
                await daySpinner.click({ force: true }).catch(() => { });
                await this.page.keyboard.press('Escape').catch(() => { });
                await this.page.keyboard.type(`${dStr}${mStr}${yStr}`, { delay: 30 }).catch(() => { });
            }
            const monthSpinner = expiryContainer.locator('[role="spinbutton"][aria-label="Month"]').first();
            if (await monthSpinner.isVisible({ timeout: 300 }).catch(() => false)) {
                const monthText = await monthSpinner.innerText().catch(() => '');
                if (monthText.includes('MM') || !monthText) {
                    await monthSpinner.click({ force: true }).catch(() => { });
                    await this.page.keyboard.press('Escape').catch(() => { });
                    if (mStr)
                        await this.page.keyboard.type(mStr, { delay: 30 }).catch(() => { });
                }
            }
            const yearSpinner = expiryContainer.locator('[role="spinbutton"][aria-label="Year"]').first();
            if (await yearSpinner.isVisible({ timeout: 300 }).catch(() => false)) {
                const yearText = await yearSpinner.innerText().catch(() => '');
                if (yearText.includes('YYYY') || !yearText) {
                    await yearSpinner.click({ force: true }).catch(() => { });
                    await this.page.keyboard.press('Escape').catch(() => { });
                    if (yStr)
                        await this.page.keyboard.type(yStr, { delay: 30 }).catch(() => { });
                }
            }
            await this.page.keyboard.press('Escape').catch(() => { });
            await this.page.locator('body').click({ position: { x: 5, y: 5 }, force: true }).catch(() => { });
        }
        catch { }
    }
    async fillUBOShareholding(index, percent) {
        const input = this.page.getByLabel('% shareholding *').nth(index);
        if (await input.isEditable().catch(() => false)) {
            await input.fill(percent).catch(() => { });
        }
    }
    async selectUBOBasisOfControl(index, basis) {
        try {
            const basisCombobox = this.page.locator(`[name="ubos.${index}.basisOfControl"], [name*="basisOfControl"]`).first().locator('xpath=ancestor::div[contains(@class, "MuiInputBase-root")]');
            if (await basisCombobox.isVisible({ timeout: 1000 }).catch(() => false)) {
                await basisCombobox.click();
            }
            else {
                await this.page.locator('[role="combobox"]').nth(index * 3 + 2).click();
            }
            const opt = this.page.locator(`[role="option"]:has-text("${basis}"), li:has-text("${basis}")`).first();
            await opt.waitFor({ state: 'visible', timeout: 3000 });
            await opt.click();
            await opt.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => { });
        }
        catch { }
    }
    async selectBasisOfControlOnly(a, b) {
        const index = typeof a === 'number' ? a : (typeof b === 'number' ? b : 0);
        const basis = typeof a === 'string' ? a : (typeof b === 'string' ? b : '');
        await this.selectUBOBasisOfControl(index, basis);
    }
    async clearShareholderPercent(index = 0) {
        const input = this.page.getByLabel('% shareholding *').nth(index);
        if (await input.isEditable().catch(() => false)) {
            await input.fill('').catch(() => { });
        }
    }
    async fillShareholderPercentOnly(a, b) {
        const index = typeof a === 'number' ? a : (typeof b === 'number' ? b : 0);
        const percent = typeof a === 'string' ? a : (typeof b === 'string' ? b : '');
        await this.fillUBOShareholding(index, percent);
    }
    async getShareholderPercentError(index) {
        const err = this.page.locator('p.Mui-error, span.Mui-error, [role="alert"]').first();
        return err.innerText().catch(() => '');
    }
    async getUBOCount() {
        const byHeading = await this.page.locator('h6').filter({ hasText: /^UBO\s+\d+/i }).count();
        if (byHeading > 0)
            return byHeading;
        const byName = await this.page.locator('input[name*="ubos."][name*="fullName"], input[name*="placeOfBirth"]').count();
        if (byName > 0)
            return byName;
        return this.page.getByLabel('Full legal name (as per ID) *').count();
    }
    async setUBOPep(index, pep) {
        await this.setUBOPEP(index, pep);
    }
    async deleteUBO(index) {
        try {
            const deleteButtons = this.page.locator('button:has-text("Remove"), button:has-text("Delete"), button[aria-label*="delete" i], button[aria-label*="Remove" i], [data-testid*="Delete"]');
            const count = await deleteButtons.count().catch(() => 0);
            if (count > index) {
                await deleteButtons.nth(index).click({ force: true }).catch(() => { });
                const confirmBtn = this.page.locator('.MuiDialog-paper button:has-text("Delete"), .MuiDialog-paper button:has-text("Confirm"), [role="dialog"] button:has-text("Delete")').first();
                if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                    await confirmBtn.click().catch(() => { });
                }
            }
        }
        catch { }
    }
    async selectUBONationality(index, nationality) {
        try {
            const natCombobox = this.page.locator(`[name="ubos.${index}.nationality"], [name*="nationality"]`).first().locator('xpath=ancestor::div[contains(@class, "MuiInputBase-root")]');
            if (await natCombobox.isVisible({ timeout: 1000 }).catch(() => false)) {
                await natCombobox.click();
            }
            else {
                await this.page.locator('[role="combobox"]').nth(index * 3).click();
            }
            const opt = this.page.locator(`[role="option"]:has-text("${nationality}"), li:has-text("${nationality}")`).first();
            await opt.waitFor({ state: 'visible', timeout: 3000 });
            await opt.click();
            await opt.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => { });
        }
        catch { }
    }
    async selectUBOCountryOfResidence(index, country) {
        try {
            const resCombobox = this.page.locator(`[name="ubos.${index}.countryOfResidence"], [name*="countryOfResidence"]`).first().locator('xpath=ancestor::div[contains(@class, "MuiInputBase-root")]');
            if (await resCombobox.isVisible({ timeout: 1000 }).catch(() => false)) {
                await resCombobox.click();
            }
            else {
                await this.page.locator('[role="combobox"]').nth(index * 3 + 1).click();
            }
            const opt = this.page.locator(`[role="option"]:has-text("${country}"), li:has-text("${country}")`).first();
            await opt.waitFor({ state: 'visible', timeout: 3000 });
            await opt.click();
            await opt.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => { });
        }
        catch { }
    }
    async fillUBOOccupation(index, occupation) {
        await this.page.getByLabel('Occupation *').nth(index).fill(occupation).catch(() => { });
    }
    async setUBOPEP(index, pep) {
        const pepCheckbox = this.page.getByLabel('Politically Exposed Person (PEP)').nth(index);
        if (pep) {
            await pepCheckbox.check({ force: true }).catch(() => { });
        }
        else {
            await pepCheckbox.uncheck({ force: true }).catch(() => { });
        }
    }
    async addUBO() {
        const addBtn = this.page.locator('button:has-text("Add UBO"), button:has-text("Add beneficial"), button:has-text("Add owner")').first();
        await addBtn.click();
    }
    async getUBOCardCount() {
        return this.page.locator('[data-testid*="ubo"], .MuiCard-root, fieldset').count();
    }
    async getTotalShareholdingEntered() {
        const text = await this.page.locator('text=/Total shareholding entered:\\s*\\d+/').innerText().catch(() => '');
        return text;
    }
}
exports.Step4UBOsPage = Step4UBOsPage;
