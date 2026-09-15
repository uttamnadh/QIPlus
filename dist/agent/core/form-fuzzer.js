"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormFuzzer = void 0;
const config_1 = require("../config");
class FormFuzzer {
    /**
     * Discovers all forms and fields on current page
     */
    async discoverForms(page) {
        const forms = [];
        try {
            const formHandles = await page.$$('form, [role="form"], .MuiBox-root:has(input)');
            for (let i = 0; i < Math.min(formHandles.length, 3); i++) {
                const formHandle = formHandles[i];
                const fields = [];
                const inputs = await formHandle.$$('input:not([type="hidden"]), textarea, select, [role="combobox"]');
                for (const input of inputs) {
                    const name = (await input.getAttribute('name')) || (await input.getAttribute('id')) || '';
                    const typeAttr = (await input.getAttribute('type')) || '';
                    const placeholder = (await input.getAttribute('placeholder')) || '';
                    const required = (await input.getAttribute('required')) !== null;
                    const maxLength = parseInt((await input.getAttribute('maxlength')) || '-1', 10);
                    // Get label text
                    let label = '';
                    const id = await input.getAttribute('id');
                    if (id) {
                        const labelEl = await page.$(`label[for="${id}"]`);
                        if (labelEl)
                            label = (await labelEl.innerText()).trim();
                    }
                    const fieldType = this.classifyField(name, typeAttr, placeholder, label);
                    fields.push({
                        name: name || `field_${fields.length}`,
                        type: fieldType,
                        selector: name ? `[name="${name}"]` : `input:nth-of-type(${fields.length + 1})`,
                        required,
                        currentValue: (await input.inputValue().catch(() => '')) || '',
                        placeholder,
                        label,
                        maxLength: maxLength > 0 ? maxLength : undefined,
                    });
                }
                if (fields.length > 0) {
                    forms.push({
                        selector: `form:nth-of-type(${i + 1})`,
                        fields,
                        submitButton: 'button[type="submit"], button:has-text("Save"), button:has-text("Next"), button:has-text("Continue")',
                    });
                }
            }
        }
        catch (e) { }
        return forms;
    }
    /**
     * Heuristic field classifier
     */
    classifyField(name, type, placeholder, label) {
        const combined = `${name} ${placeholder} ${label}`.toLowerCase();
        if (type === 'email' || combined.includes('email'))
            return 'email';
        if (type === 'tel' || combined.includes('phone') || combined.includes('mobile'))
            return 'phone';
        if (type === 'number' || combined.includes('volume') || combined.includes('count') || combined.includes('amount') || combined.includes('value'))
            return 'number';
        if (type === 'date' || combined.includes('date') || combined.includes('expiry') || combined.includes('birth') || combined.includes('dob'))
            return 'date';
        if (type === 'file' || combined.includes('document') || combined.includes('upload'))
            return 'file';
        if (combined.includes('iban') || combined.includes('swift') || combined.includes('trn'))
            return 'text';
        if (type === 'password' || combined.includes('password'))
            return 'password';
        if (type === 'checkbox')
            return 'checkbox';
        if (type === 'radio')
            return 'radio';
        if (type === 'url' || combined.includes('website') || combined.includes('url'))
            return 'url';
        return 'text';
    }
    /**
     * Run smart fuzzing passes on a detected form
     */
    async fuzzForm(page, form, role, detector) {
        console.log(`   📝 Fuzzing form with ${form.fields.length} fields...`);
        // 1. Fuzz Pass: Empty Submit (test required validation)
        await this.testEmptySubmit(page, form, role, detector);
        // 2. Fuzz Pass: XSS & Special Characters in first eligible text input
        await this.testXssInjection(page, form, role, detector);
        // 3. Fuzz Pass: Negative Number / Boundary testing
        await this.testBoundaryNumbers(page, form, role, detector);
        // 4. Fuzz Pass: Domain Validations (TRN / IBAN checks)
        await this.testDomainValidations(page, form, role, detector);
    }
    /**
     * 1. Empty submit test
     */
    async testEmptySubmit(page, form, role, detector) {
        try {
            const submitBtn = page.locator('button[type="submit"], button:has-text("Save & Continue"), button:has-text("Next")').first();
            if (await submitBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await submitBtn.click({ force: true }).catch(() => { });
                await page.waitForTimeout(500);
                // Check if required fields triggered visual validation or if it submitted silently
                const errorAlerts = await page.locator('.Mui-error, [aria-invalid="true"], .MuiAlert-root').count();
                // If there are many required fields but 0 errors and page navigated, it's a validation gap
                if (form.fields.some(f => f.required) && errorAlerts === 0) {
                    detector.recordBug({
                        id: '',
                        severity: 'Medium',
                        category: 'validation-gap',
                        title: `Form submitted without required field validation on ${page.url()}`,
                        description: 'Form contains required fields but submitted without triggering any error state or visual validation highlights.',
                        stepsToReproduce: [`Open form at ${page.url()}`, `Leave all fields blank`, `Click submit`],
                        expected: 'Validation error banners or helper text on required fields',
                        actual: 'No visual validation triggered',
                        url: page.url(),
                        role,
                        timestamp: new Date().toISOString(),
                    });
                }
            }
        }
        catch (e) { }
    }
    /**
     * 2. XSS Injection test
     */
    async testXssInjection(page, form, role, detector) {
        const textInput = form.fields.find(f => f.type === 'text' && !f.name.includes('date'));
        if (!textInput)
            return;
        try {
            const input = page.locator(textInput.selector).first();
            if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
                const xssPayload = config_1.FUZZ_PAYLOADS.xss[0];
                await input.fill(xssPayload).catch(() => { });
                await input.evaluate(el => el.dispatchEvent(new Event('blur')));
                // Check if unescaped script tag is rendered directly in DOM
                const isReflected = await page.evaluate(payload => {
                    return document.body.innerHTML.includes(payload);
                }, xssPayload).catch(() => false);
                if (isReflected) {
                    detector.recordBug({
                        id: '',
                        severity: 'Critical',
                        category: 'injection',
                        title: `Potential XSS: Unsanitized script payload accepted in "${textInput.name}"`,
                        description: `Field "${textInput.name}" accepted raw script tag "${xssPayload}" without DOM sanitization.`,
                        stepsToReproduce: [`Navigate to form`, `Enter "${xssPayload}" into field "${textInput.name}"`, `Inspect DOM`],
                        expected: 'HTML entities escaped or script tags stripped',
                        actual: 'Unescaped script payload rendered in DOM',
                        url: page.url(),
                        role,
                        fieldName: textInput.name,
                        inputValue: xssPayload,
                        timestamp: new Date().toISOString(),
                    });
                }
            }
        }
        catch (e) { }
    }
    /**
     * 3. Boundary & Negative number test
     */
    async testBoundaryNumbers(page, form, role, detector) {
        const numberInput = form.fields.find(f => f.type === 'number' || f.name.toLowerCase().includes('volume') || f.name.toLowerCase().includes('value'));
        if (!numberInput)
            return;
        try {
            const input = page.locator(numberInput.selector).first();
            if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
                const negVal = config_1.FUZZ_PAYLOADS.boundaryNumbers.negative;
                await input.fill(negVal).catch(() => { });
                await input.evaluate(el => el.dispatchEvent(new Event('blur')));
                // Check if error state was set
                const hasError = await page.locator(`${numberInput.selector}.Mui-error, [aria-invalid="true"]`).count() > 0;
                if (!hasError) {
                    detector.recordBug({
                        id: '',
                        severity: 'Medium',
                        category: 'validation-gap',
                        title: `Negative numeric value accepted in field "${numberInput.name}"`,
                        description: `Field "${numberInput.name}" accepted negative value (${negVal}) without triggering input validation.`,
                        stepsToReproduce: [`Focus field "${numberInput.name}"`, `Enter negative value ${negVal}`, `Blur field`],
                        expected: 'Field should display validation error: must be greater than 0',
                        actual: 'Negative value accepted cleanly without validation error',
                        url: page.url(),
                        role,
                        fieldName: numberInput.name,
                        inputValue: negVal,
                        timestamp: new Date().toISOString(),
                    });
                }
            }
        }
        catch (e) { }
    }
    /**
     * 4. UAE Domain validations (TRN / IBAN)
     */
    async testDomainValidations(page, form, role, detector) {
        // Check TRN field if present
        const trnField = form.fields.find(f => f.name.toLowerCase().includes('trn'));
        if (trnField) {
            try {
                const input = page.locator(trnField.selector).first();
                if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
                    // Try invalid prefix (starts with 200 instead of 100)
                    const invalidTrn = config_1.FUZZ_PAYLOADS.uaeSpecific.invalidTrnPrefix;
                    await input.fill(invalidTrn).catch(() => { });
                    await input.evaluate(el => el.dispatchEvent(new Event('blur')));
                    const hasError = await page.locator(`text=/Must start with 100|Invalid TRN/i`).isVisible({ timeout: 1000 }).catch(() => false);
                    if (!hasError) {
                        detector.recordBug({
                            id: '',
                            severity: 'Medium',
                            category: 'validation-gap',
                            title: `TRN validation does not enforce "100" prefix on blur`,
                            description: `UAE TRN numbers must begin with 100 per FTA standards. Value "${invalidTrn}" was accepted without warning.`,
                            stepsToReproduce: [`Enter "${invalidTrn}" into TRN field`, `Tab away (trigger blur)`],
                            expected: 'Validation message indicating TRN must start with 100',
                            actual: 'Input accepted without validation flag',
                            url: page.url(),
                            role,
                            fieldName: trnField.name,
                            inputValue: invalidTrn,
                            timestamp: new Date().toISOString(),
                        });
                    }
                }
            }
            catch (e) { }
        }
    }
    /**
     * Helper: Fill MUI DatePicker safely using spinbutton segments
     */
    static async fillMUIDate(page, containerSelector, day, month, year) {
        try {
            const spinbutton = page.locator(`${containerSelector} [role="spinbutton"]`).first();
            if (await spinbutton.isVisible({ timeout: 2000 }).catch(() => false)) {
                await spinbutton.click();
                await page.keyboard.type(`${day.padStart(2, '0')}${month.padStart(2, '0')}${year}`);
                await page.keyboard.press('Escape');
            }
        }
        catch (e) { }
    }
    /**
     * Helper: Select MUI Combobox item safely
     */
    static async selectMUIOption(page, inputName, optionText) {
        try {
            const wrapper = page.locator(`[name="${inputName}"]`).locator('xpath=ancestor::div[contains(@class, "MuiInputBase-root")]').first();
            if (await wrapper.isVisible({ timeout: 2000 }).catch(() => false)) {
                await wrapper.click();
                await page.locator(`[role="option"]:has-text("${optionText}")`).first().click();
            }
        }
        catch (e) { }
    }
}
exports.FormFuzzer = FormFuzzer;
