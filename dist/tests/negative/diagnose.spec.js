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
const test_1 = require("@playwright/test");
const path = __importStar(require("path"));
const login_page_1 = require("../../pages/login.page");
const dashboard_page_1 = require("../../pages/dashboard.page");
const step1_profile_page_1 = require("../../pages/wizard/step1-profile.page");
const step2_business_page_1 = require("../../pages/wizard/step2-business.page");
const step3_ownership_page_1 = require("../../pages/wizard/step3-ownership.page");
const step4_ubos_page_1 = require("../../pages/wizard/step4-ubos.page");
const step5_signatories_page_1 = require("../../pages/wizard/step5-signatories.page");
const step6_banking_page_1 = require("../../pages/wizard/step6-banking.page");
const step7_documents_page_1 = require("../../pages/wizard/step7-documents.page");
const step8_review_page_1 = require("../../pages/wizard/step8-review.page");
const merchant_data_1 = require("../../fixtures/merchant-data");
(0, test_1.test)('Test New registration and Steps 1-8 progression', async ({ page }) => {
    page.on('request', req => {
        if (req.url().includes('api') || req.url().includes('merchant')) {
            console.log(`REQ: ${req.method()} ${req.url()}`);
        }
    });
    page.on('response', async (res) => {
        if (res.url().includes('api') || res.url().includes('merchant')) {
            if (res.status() >= 400) {
                console.log(`RES ${res.status()}: ${res.url()} => ${await res.text().catch(() => '')}`);
            }
        }
    });
    const loginPage = new login_page_1.LoginPage(page);
    await loginPage.navigate();
    await loginPage.login(merchant_data_1.ROLES.onboarding.username, merchant_data_1.ROLES.onboarding.password);
    await page.waitForURL('**/dashboard');
    await page.waitForTimeout(1500);
    const dashboard = new dashboard_page_1.DashboardPage(page);
    await dashboard.clickCreateMerchant();
    await page.waitForTimeout(2000);
    const step1 = new step1_profile_page_1.Step1ProfilePage(page);
    const vatDocPath = path.resolve(__dirname, '../../fixtures/test-doc.pdf');
    await step1.fillAll(merchant_data_1.MERCHANT, { vatRegistered: false, vatDocPath });
    await page.waitForTimeout(1000);
    console.log('--- Step 1: Clicking Save & Continue ---');
    await step1.clickSaveAndContinue();
    await page.waitForTimeout(2000);
    // Step 2
    const step2 = new step2_business_page_1.Step2BusinessPage(page);
    await step2.fillAll(merchant_data_1.MERCHANT.business);
    await step2.clickSaveAndContinue();
    await page.locator('text=/Step 3 of 8/').first().waitFor({ timeout: 5000 });
    console.log('Step 2 saved -> now on Step 3');
    // Step 3
    const step3 = new step3_ownership_page_1.Step3OwnershipPage(page);
    await step3.fillShareholder(0, merchant_data_1.MERCHANT.shareholders[0]);
    await step3.fillShareholderPercent(0, '100');
    await step3.clickSaveAndContinue();
    await page.locator('text=/Step 4 of 8/').first().waitFor({ timeout: 5000 });
    console.log('Step 3 saved -> now on Step 4');
    // Step 4
    const step4 = new step4_ubos_page_1.Step4UBOsPage(page);
    await step4.fillUBO(0, merchant_data_1.MERCHANT.ubos[0]);
    await step4.clickSaveAndContinue();
    await page.locator('text=/Step 5 of 8/').first().waitFor({ timeout: 5000 });
    console.log('Step 4 saved -> now on Step 5');
    // Step 5
    const step5 = new step5_signatories_page_1.Step5SignatoriesPage(page);
    await step5.fillSignatory(0, merchant_data_1.MERCHANT.signatories[0]);
    await step5.clickSaveAndContinue();
    await page.locator('text=/Step 6 of 8/').first().waitFor({ timeout: 5000 });
    console.log('Step 5 saved -> now on Step 6');
    // Step 6
    const step6 = new step6_banking_page_1.Step6BankingPage(page);
    await step6.fillAll(merchant_data_1.MERCHANT.banking);
    await step6.clickSaveAndContinue();
    await page.locator('text=/Step 7 of 8/').first().waitFor({ timeout: 5000 });
    console.log('Step 6 saved -> now on Step 7');
    // Step 7
    const step7 = new step7_documents_page_1.Step7DocumentsPage(page);
    await step7.uploadAllDummyDocuments(path.join(__dirname, '../../fixtures'));
    await step7.clickSaveAndContinue();
    await page.locator('text=/Step 8 of 8/').first().waitFor({ timeout: 5000 });
    console.log('Step 7 saved -> now on Step 8');
    // Step 8
    const step8 = new step8_review_page_1.Step8ReviewPage(page);
    await step8.expectStep(8);
    console.log('All Steps 1 to 8 reachable successfully!');
});
