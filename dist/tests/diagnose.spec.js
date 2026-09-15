"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const login_page_1 = require("../pages/login.page");
const merchant_data_1 = require("../fixtures/merchant-data");
(0, test_1.test)('Diagnose drafts and list views', async ({ page }) => {
    const loginPage = new login_page_1.LoginPage(page);
    await loginPage.navigate();
    await loginPage.login(merchant_data_1.ROLES.onboarding.username, merchant_data_1.ROLES.onboarding.password);
    await page.waitForURL('**/dashboard');
    // Check Drafts
    await page.click('button:has-text("Drafts"), a:has-text("Drafts")');
    await page.waitForTimeout(2000);
    console.log('--- DRAFTS TABLE (unfiltered) ---');
    let draftRows = await page.locator('table tr').allInnerTexts();
    console.log(draftRows);
    // Check Submitted
    await page.click('button:has-text("Submitted"), a:has-text("Submitted")');
    await page.waitForTimeout(2000);
    console.log('--- SUBMITTED TABLE ---');
    let subRows = await page.locator('table tr').allInnerTexts();
    console.log(subRows);
    // Check Return for Clarification
    await page.click('button:has-text("Return for Clarification"), a:has-text("Return for Clarification")');
    await page.waitForTimeout(2000);
    console.log('--- RETURN FOR CLARIFICATION TABLE ---');
    let retRows = await page.locator('table tr').allInnerTexts();
    console.log(retRows);
});
