"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expect = exports.test = void 0;
const test_1 = require("@playwright/test");
const merchant_data_1 = require("./merchant-data");
async function loginInContext(browser, baseURL, username, password) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${baseURL}/login`);
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    return { context, page };
}
exports.test = test_1.test.extend({
    onboardingPage: async ({ browser }, use) => {
        const baseURL = 'https://idms-uat.qiplus.ae';
        const { context, page } = await loginInContext(browser, baseURL, merchant_data_1.ROLES.onboarding.username, merchant_data_1.ROLES.onboarding.password);
        await use(page);
        await context.close();
    },
    compliancePage: async ({ browser }, use) => {
        const baseURL = 'https://idms-uat.qiplus.ae';
        const { context, page } = await loginInContext(browser, baseURL, merchant_data_1.ROLES.compliance.username, merchant_data_1.ROLES.compliance.password);
        await use(page);
        await context.close();
    },
    approverPage: async ({ browser }, use) => {
        const baseURL = 'https://idms-uat.qiplus.ae';
        const { context, page } = await loginInContext(browser, baseURL, merchant_data_1.ROLES.approver.username, merchant_data_1.ROLES.approver.password);
        await use(page);
        await context.close();
    },
});
var test_2 = require("@playwright/test");
Object.defineProperty(exports, "expect", { enumerable: true, get: function () { return test_2.expect; } });
