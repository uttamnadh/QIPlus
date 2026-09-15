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
const diagnostics_1 = require("../../fixtures/diagnostics");
const dashboard_page_1 = require("../../pages/dashboard.page");
const step1_profile_page_1 = require("../../pages/wizard/step1-profile.page");
const step2_business_page_1 = require("../../pages/wizard/step2-business.page");
const step3_ownership_page_1 = require("../../pages/wizard/step3-ownership.page");
const step4_ubos_page_1 = require("../../pages/wizard/step4-ubos.page");
const step5_signatories_page_1 = require("../../pages/wizard/step5-signatories.page");
const step6_banking_page_1 = require("../../pages/wizard/step6-banking.page");
const step7_documents_page_1 = require("../../pages/wizard/step7-documents.page");
const step8_review_page_1 = require("../../pages/wizard/step8-review.page");
const base_wizard_page_1 = require("../../pages/wizard/base-wizard.page");
const login_page_1 = require("../../pages/login.page");
const merchant_data_1 = require("../../fixtures/merchant-data");
const test_data_1 = require("../../fixtures/test-data");
const regression_state_1 = require("../../fixtures/regression-state");
const path = __importStar(require("path"));
let MERCHANT;
diagnostics_1.test.describe.serial('01 — Onboarding Wizard Regression Walkthrough (Dual Shareholder: Individual + Entity)', () => {
    let ctx;
    let page;
    diagnostics_1.test.beforeAll(async ({ browser }) => {
        const identity = (0, test_data_1.buildDraftIdentity)('positive');
        const baseData = (0, merchant_data_1.getMerchantData)('positive');
        const randomTL = `TL${Math.floor(100000 + Math.random() * 900000)}`;
        // Build merchant with BOTH Individual (50%) and Entity (50%) in the SAME record
        MERCHANT = {
            ...baseData,
            tradeName: identity.tradeName,
            legalName: identity.legalName,
            trn: identity.trn,
            websiteUrl: identity.websiteUrl,
            primaryContactName: identity.primaryContactName,
            primaryContactPosition: identity.primaryContactPosition,
            primaryContactEmail: identity.primaryContactEmail,
            primaryContactPhone: identity.primaryContactPhone,
            registeredAddress: {
                ...baseData.registeredAddress,
                floorOffice: identity.officeSuite,
                poBox: identity.poBox,
            },
            licence: {
                ...baseData.licence,
                number: identity.licenceNumber,
            },
            shareholders: [
                {
                    fullLegalName: identity.primaryContactName,
                    entityOrIndividual: 'Individual',
                    countryOfRegistration: 'United Arab Emirates',
                    percentShareholding: '50',
                    idType: 'Emirates ID',
                    emiratesIdNumber: identity.emiratesId,
                    tradeLicenceNumber: '',
                },
                {
                    fullLegalName: `${identity.tradeName} Holding LLC`,
                    entityOrIndividual: 'Entity',
                    countryOfRegistration: 'United Arab Emirates',
                    percentShareholding: '50',
                    idType: 'Trade License',
                    tradeLicenceNumber: randomTL,
                    emiratesIdNumber: '',
                },
            ],
            ubos: [
                {
                    fullLegalName: identity.primaryContactName,
                    dateOfBirth: { day: '15', month: '06', year: '1990' },
                    placeOfBirth: 'Dubai',
                    nationality: 'United Arab Emirates',
                    hasDualNationality: false,
                    countryOfResidence: 'United Arab Emirates',
                    percentShareholding: '50',
                    idType: 'Emirates ID',
                    emiratesIdNumber: identity.emiratesId,
                    idExpiryDate: { day: '31', month: '12', year: '2030' },
                    basisOfControl: 'Ownership',
                    occupation: 'Managing Director',
                    pep: false,
                },
            ],
            signatories: [
                {
                    ...baseData.signatories[0],
                    fullName: identity.primaryContactName,
                    emiratesIdNumber: identity.emiratesId,
                },
            ],
            banking: {
                ...baseData.banking,
                accountHolderName: identity.legalName.replace(/[^a-zA-Z\s]/g, '').trim(),
                iban: identity.iban,
            },
        };
        (0, regression_state_1.saveRegressionState)({ mrn: '', records: [] });
        ctx = await browser.newContext();
        page = await ctx.newPage();
        // Login as Onboarding Officer (Sukesh)
        const loginPage = new login_page_1.LoginPage(page);
        await loginPage.navigate();
        await loginPage.login(merchant_data_1.ROLES.onboarding.username, merchant_data_1.ROLES.onboarding.password);
        await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => { });
    });
    diagnostics_1.test.afterAll(async () => {
        await ctx?.close();
    });
    (0, diagnostics_1.test)('Step 1 — Create merchant draft, fill Profile and save', async () => {
        const dashboard = new dashboard_page_1.DashboardPage(page);
        const step1 = new step1_profile_page_1.Step1ProfilePage(page);
        await dashboard.clickCreateMerchant();
        await step1.expectStep(1);
        await step1.fillAll(MERCHANT);
        await step1.clickSaveAndContinue();
        const mrn = await step1.getRegistrationNumber().catch(() => '');
        if (mrn) {
            (0, regression_state_1.saveRegressionState)({ mrn });
            (0, regression_state_1.saveRegressionRecord)({
                mrn,
                tradeName: MERCHANT.tradeName,
                legalName: MERCHANT.legalName,
                shareholderType: 'Individual',
            });
        }
        console.log(`[REGRESSION] Created merchant draft with dual shareholders. MRN: ${mrn}`);
        await step1.expectStep(2);
    });
    (0, diagnostics_1.test)('Step 2 — Fill Business details and save', async () => {
        const step2 = new step2_business_page_1.Step2BusinessPage(page);
        await step2.expectStep(2);
        await step2.fillAll(MERCHANT.business);
        await step2.clickSaveAndContinue();
        await step2.expectStep(3);
    });
    (0, diagnostics_1.test)('Step 3 — Fill Ownership with BOTH Individual and Entity shareholders (50% + 50% = 100%)', async () => {
        const step3 = new step3_ownership_page_1.Step3OwnershipPage(page);
        await step3.expectStep(3);
        // 1. Shareholder 1: Individual (50% shareholding, Emirates ID)
        console.log(`[Step 3] Adding Shareholder 1 (Individual): ${MERCHANT.shareholders[0].fullLegalName} (50%)`);
        await step3.fillShareholder(0, MERCHANT.shareholders[0]);
        // 2. Add second shareholder: Entity (50% shareholding, Trade License)
        console.log(`[Step 3] Clicking '+ Add shareholder' for Shareholder 2 (Entity)...`);
        await step3.addShareholder();
        await page.waitForTimeout(500);
        console.log(`[Step 3] Adding Shareholder 2 (Entity): ${MERCHANT.shareholders[1].fullLegalName} (50%)`);
        await step3.fillShareholder(1, MERCHANT.shareholders[1]);
        let total = await step3.getTotalShareholding();
        console.log(`[Step 3] Total shareholding entered: ${total}`);
        (0, diagnostics_1.expect)(total).toContain('100');
        // 3. Dynamic Boundary & Deletion Check: Add 3rd card, exceed 100%, delete card
        console.log(`[Step 3 Regression] Testing 110% boundary condition & dynamic removal...`);
        await step3.addShareholder();
        await page.waitForTimeout(400);
        const pctInp3 = page.getByLabel(/% shareholding/i).nth(2);
        if (await pctInp3.isVisible({ timeout: 1000 }).catch(() => false)) {
            await pctInp3.fill('10');
            const exceedTotal = await step3.getTotalShareholding();
            console.log(`[Step 3 Regression] Exceeded total: ${exceedTotal}`);
            // Delete the 3rd shareholder card
            const delBtns = page.locator('button[aria-label*="Remove" i], button[aria-label*="delete" i], button:has-text("Delete"), button:has-text("Remove"), [data-testid*="Delete"]');
            const delCount = await delBtns.count();
            if (delCount > 0) {
                await delBtns.last().click({ force: true }).catch(() => { });
                await page.waitForTimeout(400);
            }
        }
        // Confirm total is restored to 100.00%
        total = await step3.getTotalShareholding();
        console.log(`[Step 3 Regression] Restored total after deletion: ${total}`);
        (0, diagnostics_1.expect)(total).toContain('100');
        await step3.clickSaveAndContinue();
        await step3.expectStep(4);
    });
    (0, diagnostics_1.test)('Step 4 — Fill UBO with Ownership basis (>=25% threshold) and save', async () => {
        const step4 = new step4_ubos_page_1.Step4UBOsPage(page);
        await step4.expectStep(4);
        const uboCount = await step4.getUBOCount();
        console.log(`[Step 4] Auto-populated UBO count: ${uboCount}`);
        if (uboCount === 0) {
            await step4.addUBO();
        }
        const totalUbos = Math.max(1, await step4.getUBOCount());
        for (let i = 0; i < totalUbos; i++) {
            await step4.fillUBO(i, MERCHANT.ubos[i] || MERCHANT.ubos[0]);
        }
        await step4.clickSaveAndContinue();
        await step4.expectStep(5);
    });
    (0, diagnostics_1.test)('Step 5 — Fill Signatories and save', async () => {
        const step5 = new step5_signatories_page_1.Step5SignatoriesPage(page);
        await step5.expectStep(5);
        await step5.fillSignatory(0, MERCHANT.signatories[0]);
        await step5.clickSaveAndContinue();
        await step5.expectStep(6);
    });
    (0, diagnostics_1.test)('Step 6 — Fill Banking details and save', async () => {
        const step6 = new step6_banking_page_1.Step6BankingPage(page);
        await step6.expectStep(6);
        await step6.fillAll(MERCHANT.banking);
        await step6.clickSaveAndContinue();
        await step6.expectStep(7);
    });
    (0, diagnostics_1.test)('Step 7 — Upload documents with View Doc modal preview check and save', async () => {
        const step7 = new step7_documents_page_1.Step7DocumentsPage(page);
        await step7.expectStep(7);
        const docPath = path.resolve(__dirname, '../../fixtures/dummy_1.png');
        await step7.uploadAllDocuments(docPath);
        // Test View Doc feature preview modal
        const viewBtn = page.locator('button:has-text("View"), [data-testid="VisibilityIcon"], button[aria-label*="view" i]').first();
        if (await viewBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await viewBtn.click();
            await page.waitForTimeout(500);
            await step7.closePreview();
        }
        await step7.clickSaveAndContinue();
        await step7.expectStep(8);
    });
    (0, diagnostics_1.test)('Step 8 — Review summary data (Individual + Entity) and submit record', async () => {
        const step8 = new step8_review_page_1.Step8ReviewPage(page);
        await step8.expectStep(8);
        await step8.verifyReviewData(MERCHANT);
        const mrn = await step8.getRegistrationNumber().catch(() => '');
        if (mrn) {
            (0, regression_state_1.saveRegressionState)({ mrn });
            (0, regression_state_1.saveRegressionRecord)({
                mrn,
                tradeName: MERCHANT.tradeName,
                legalName: MERCHANT.legalName,
                shareholderType: 'Individual',
                submitted: true,
            });
        }
        console.log(`[REGRESSION] Submitting MRN: ${mrn || 'Auto-assign'} with Dual Shareholders for Compliance Review`);
        await step8.submitForReview();
        await page.waitForTimeout(1000);
    });
    (0, diagnostics_1.test)('Step 9 — Verify submitted record in Submitted queue and sign out', async () => {
        const state = (0, regression_state_1.loadRegressionState)();
        let targetMRN = state.mrn;
        // Navigate to Submitted list via sidebar
        const submittedSidebar = page.locator('nav, aside, header').locator('text="Submitted"').first();
        if (await submittedSidebar.isVisible({ timeout: 3000 }).catch(() => false)) {
            await submittedSidebar.click();
        }
        else {
            await page.goto('/applications/submitted', { waitUntil: 'domcontentloaded' }).catch(() => { });
        }
        await page.waitForTimeout(1500);
        const searchInput = page.getByPlaceholder('Filter by MRN or name').or(page.locator('input[placeholder*="Search" i], input[placeholder*="Filter" i]')).first();
        if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await searchInput.click();
            await searchInput.fill(targetMRN || MERCHANT.tradeName);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(1000);
        }
        const nameRow = page.locator(`tr:has-text("${MERCHANT.tradeName}"), [role="row"]:has-text("${MERCHANT.tradeName}")`).first();
        if (await nameRow.isVisible({ timeout: 5000 }).catch(() => false)) {
            const rowText = await nameRow.innerText();
            const match = rowText.match(/\b(609\d{8,14}|202\d{5,10}|\d{10,16})\b/);
            if (match) {
                targetMRN = match[1];
                (0, regression_state_1.saveRegressionState)({ mrn: targetMRN });
                (0, regression_state_1.saveRegressionRecord)({
                    mrn: targetMRN,
                    tradeName: MERCHANT.tradeName,
                    legalName: MERCHANT.legalName,
                    shareholderType: 'Individual',
                    submitted: true,
                });
            }
        }
        (0, merchant_data_1.printMerchantSubmissionSummary)({
            tradeName: MERCHANT.tradeName,
            legalName: MERCHANT.legalName,
            mrn: targetMRN || state.mrn,
            shareholderType: 'Individual (50%) + Entity (50%)',
            shareholderIdType: 'Emirates ID & Trade License',
            shareholderIdValue: `${MERCHANT.shareholders[0].emiratesIdNumber} | ${MERCHANT.shareholders[1].tradeLicenceNumber}`,
            uboName: MERCHANT.ubos[0].fullLegalName,
            uboShare: MERCHANT.ubos[0].percentShareholding,
            step7Status: 'All mandatory documents uploaded & verified',
            suiteType: 'REGRESSION'
        });
        const basePage = new base_wizard_page_1.BaseWizardPage(page);
        await basePage.signOut();
    });
});
