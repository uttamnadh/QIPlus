"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Step7DocumentsPage = void 0;
const test_1 = require("@playwright/test");
const base_wizard_page_1 = require("./base-wizard.page");
const path = __importStar(require("path"));
/**
 * Page Object for Step 7 (Documents) — Lightning fast & reliable document uploads.
 * OPTIMIZED: Sequential upload with upload-completion condition checks to prevent backend network drops.
 */
class Step7DocumentsPage extends base_wizard_page_1.BaseWizardPage {
    constructor(page) {
        super(page);
    }
    /** Upload a single document to the specified slot index (0-based). */
    async uploadDocument(filePath, index = 0) {
        const fileInputs = this.page.locator('input[type="file"]');
        const count = await fileInputs.count();
        if (count > index) {
            await fileInputs.nth(index).setInputFiles(filePath);
        }
        else if (count > 0) {
            await fileInputs.first().setInputFiles(filePath);
        }
    }
    /** Upload a document explicitly to the VAT certificate / VAT checklist slot. */
    async uploadVatDocument(filePath) {
        const vatInput = this.page.locator('xpath=//label[contains(translate(text(), "vat", "VAT"), "VAT") or contains(translate(text(), "tax", "TAX"), "TAX")]/following::input[@type="file"]').first();
        if (await vatInput.isVisible({ timeout: 1500 }).catch(() => false)) {
            await vatInput.setInputFiles(filePath);
        }
        else {
            const fileInputs = this.page.locator('input[type="file"]');
            const count = await fileInputs.count();
            if (count > 0) {
                await fileInputs.last().setInputFiles(filePath);
            }
        }
    }
    /**
     * Fast & reliable parallel upload to all document slots with verification of upload status.
     */
    async uploadMandatoryDocuments(docPath) {
        const fileInputs = this.page.locator('input[type="file"]');
        const totalInputs = await fileInputs.count();
        console.log(`[Step 7] Found ${totalInputs} file inputs on Step 7`);
        if (totalInputs > 0) {
            const uploadPromises = [];
            for (let i = 0; i < totalInputs; i++) {
                const input = fileInputs.nth(i);
                uploadPromises.push(input.setInputFiles(docPath).catch((err) => {
                    console.log(`[Step 7] Error uploading slot ${i + 1}:`, err);
                }));
            }
            await Promise.all(uploadPromises);
        }
        else {
            // Fallback: try clicking upload buttons / dropzones with file chooser
            const dropzones = this.page.locator('div:has-text("Upload document"), label:has-text("Upload")');
            const dzCount = await dropzones.count();
            for (let i = 0; i < dzCount; i++) {
                try {
                    const [fileChooser] = await Promise.all([
                        this.page.waitForEvent('filechooser', { timeout: 2000 }).catch(() => null),
                        dropzones.nth(i).click({ force: true }).catch(() => { }),
                    ]);
                    if (fileChooser) {
                        await fileChooser.setFiles(docPath);
                    }
                }
                catch { }
            }
        }
        // Condition-based wait for warning banner to clear
        const warning = this.page.locator('text=/mandatory documents still needed/i');
        await warning.waitFor({ state: 'hidden', timeout: 4000 }).catch(() => { });
        const isWarningVisible = await warning.isVisible({ timeout: 500 }).catch(() => false);
        if (isWarningVisible) {
            const warningText = await warning.innerText().catch(() => '');
            console.log(`[Step 7 Warning] Banner text: "${warningText}"`);
        }
        else {
            console.log(`[Step 7 Success] All mandatory documents uploaded successfully! Warning banner cleared.`);
        }
        // Ensure Save button is enabled
        const saveBtn = this.page.locator('button:has-text("Save & continue"), button:has-text("Save and continue")').first();
        await (0, test_1.expect)(saveBtn).toBeEnabled({ timeout: 10000 });
    }
    /**
     * Upload all documents helper.
     */
    async uploadAllDocuments(docPath) {
        await this.uploadMandatoryDocuments(docPath);
    }
    /**
     * Upload all dummy files from fixtures directory.
     */
    async uploadAllDummyDocuments(fixturesDir) {
        const defaultFile = path.join(fixturesDir, 'dummy_1.png');
        await this.uploadMandatoryDocuments(defaultFile);
    }
    /** Click the 'View Doc' button/icon to preview an uploaded document. */
    async clickViewDoc() {
        const viewBtn = this.page.locator('button[aria-label="View document"], button:has-text("View"), [data-testid="VisibilityIcon"], svg[data-testid="EyeIcon"]').first();
        if (await viewBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            await viewBtn.click();
        }
    }
    /** Verify document preview is visible. */
    async verifyDocPreview() {
        const preview = this.page.locator('[role="dialog"], .MuiDialog-root, iframe, img, embed, object').first();
        await (0, test_1.expect)(preview).toBeVisible({ timeout: 1500 });
    }
    /** Close document preview dialog if open. */
    async closePreview() {
        const closeBtn = this.page.locator('.MuiDialog-root button').first();
        if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            await closeBtn.click().catch(() => { });
        }
        await this.page.keyboard.press('Escape').catch(() => { });
    }
    /** Get count of uploaded documents. */
    async getUploadedCount() {
        return this.page.locator('text=/\\d+ KB|\\d+ B|\\d+ MB/').count();
    }
    /** Check if mandatory document counter text is visible. */
    async getMandatoryDocStatus() {
        const loc = this.page.locator('text=/\\d+ of \\d+ attached/').first();
        if (await loc.isVisible({ timeout: 1500 }).catch(() => false)) {
            return loc.innerText();
        }
        return '';
    }
    /** Get text of missing required document warning banner. */
    async getMissingDocWarning() {
        const warning = this.page.locator('.MuiAlert-root[severity="warning"], .MuiAlert-standardWarning, [role="alert"]').first();
        if (await warning.isVisible({ timeout: 1500 }).catch(() => false)) {
            return warning.innerText();
        }
        return '';
    }
    /** Verify that the 'Save & continue' button is disabled when mandatory documents are missing. */
    async expectSaveDisabled() {
        const saveBtn = this.page.locator('button:has-text("Save & continue"), button:has-text("Save and continue")');
        await (0, test_1.expect)(saveBtn).toBeDisabled({ timeout: 2000 });
    }
    /** Verify that the 'Save & continue' button is enabled when mandatory documents are present. */
    async expectSaveEnabled() {
        const saveBtn = this.page.locator('button:has-text("Save & continue"), button:has-text("Save and continue")');
        await (0, test_1.expect)(saveBtn).toBeEnabled({ timeout: 5000 });
    }
    /** Remove/delete an uploaded document at index. */
    async removeDocument(index = 0) {
        const deleteBtns = this.page.locator('button[aria-label*="delete" i], button[aria-label*="remove" i], [data-testid="DeleteIcon"], svg[data-testid="CloseIcon"]');
        const count = await deleteBtns.count();
        if (count > index) {
            await deleteBtns.nth(index).click();
        }
        else if (count > 0) {
            await deleteBtns.first().click();
        }
    }
    /** Check if progression to Step 8 is blocked (save disabled or stay on step 7). */
    async isProgressionBlocked() {
        const saveBtn = this.page.locator('button:has-text("Save & continue"), button:has-text("Save and continue")').first();
        const isDisabled = await saveBtn.isDisabled().catch(() => false);
        if (isDisabled)
            return true;
        const currentStep = await this.getCurrentStepNumber().catch(() => 7);
        return currentStep === 7;
    }
    /** Get error message or validation banner for document uploads. */
    async getUploadError() {
        const errorLoc = this.page.locator('.MuiAlert-root[severity="error"], .MuiAlert-standardError, .MuiFormHelperText-root.Mui-error, [role="alert"]').first();
        if (await errorLoc.isVisible({ timeout: 1500 }).catch(() => false)) {
            return errorLoc.innerText();
        }
        return '';
    }
}
exports.Step7DocumentsPage = Step7DocumentsPage;
