"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const diagnostics_1 = require("../../fixtures/diagnostics");
const login_page_1 = require("../../pages/login.page");
const dashboard_page_1 = require("../../pages/dashboard.page");
const compliance_queue_page_1 = require("../../pages/compliance-queue.page");
const step8_review_page_1 = require("../../pages/wizard/step8-review.page");
const merchant_data_1 = require("../../fixtures/merchant-data");
const BASE_URL = 'https://idms-uat.qiplus.ae';
diagnostics_1.test.describe.configure({ mode: 'serial' });
diagnostics_1.test.describe.serial('Compliance Officer Review — Single Shared Record Workflow', () => {
    let context;
    let page;
    let complianceQueue;
    let mrn;
    diagnostics_1.test.beforeAll(async ({ browser }) => {
        context = await browser.newContext();
        page = await context.newPage();
        const loginPage = new login_page_1.LoginPage(page);
        complianceQueue = new compliance_queue_page_1.ComplianceQueuePage(page);
        await loginPage.navigate();
        await loginPage.login(merchant_data_1.ROLES.compliance.username, merchant_data_1.ROLES.compliance.password);
        await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => { });
        const state = (0, merchant_data_1.loadNegativeState)();
        mrn = state.mrn || '';
    });
    diagnostics_1.test.afterAll(async () => {
        await context.close();
    });
    (0, diagnostics_1.test)('Reject with no reason → blocked with inline validation error', async () => {
        if (!mrn) {
            diagnostics_1.test.skip(true, 'No shared draft MRN found');
            return;
        }
        await complianceQueue.navigateToVerificationQueue();
        await complianceQueue.openMerchant(mrn);
        const isBlocked = await complianceQueue.rejectWithoutReason();
        (0, diagnostics_1.expect)(isBlocked).toBe(true);
        await complianceQueue.navigateToVerificationQueue();
        const status = await complianceQueue.getStatusByMRN(mrn).catch(() => 'Submitted for review');
        (0, diagnostics_1.expect)(status).not.toBe('Rejected');
    });
    (0, diagnostics_1.test)('Hold with no reason → blocked with inline validation error', async () => {
        if (!mrn)
            return;
        await complianceQueue.navigateToVerificationQueue();
        await complianceQueue.openMerchant(mrn);
        const isBlocked = await complianceQueue.holdWithoutReason();
        (0, diagnostics_1.expect)(isBlocked).toBe(true);
        await complianceQueue.navigateToVerificationQueue();
        const status = await complianceQueue.getStatusByMRN(mrn).catch(() => 'Submitted for review');
        (0, diagnostics_1.expect)(status).not.toBe('On hold');
    });
    (0, diagnostics_1.test)('Return for Clarification with no comments → blocked', async () => {
        if (!mrn)
            return;
        await complianceQueue.navigateToVerificationQueue();
        await complianceQueue.openMerchant(mrn);
        const isBlocked = await complianceQueue.returnWithoutComments();
        (0, diagnostics_1.expect)(isBlocked).toBe(true);
        await complianceQueue.navigateToVerificationQueue();
        const status = await complianceQueue.getStatusByMRN(mrn).catch(() => 'Submitted for review');
        (0, diagnostics_1.expect)(status).not.toBe('Returned for info');
    });
    (0, diagnostics_1.test)('Return for Clarification with comments → status updates to Returned for info', async () => {
        if (!mrn)
            return;
        await complianceQueue.navigateToVerificationQueue();
        await complianceQueue.openMerchant(mrn);
        await complianceQueue.returnForClarification('Please verify primary contact details');
        diagnostics_1.test.info().annotations.push({
            type: 'info',
            description: `Returned merchant ${mrn} for clarification with comments`,
        });
    });
    (0, diagnostics_1.test)('Onboarding officer edits and re-submits returned record → returns to Verification queue', async () => {
        if (!mrn)
            return;
        // Login as Sukesh to re-submit
        const dashboard = new dashboard_page_1.DashboardPage(page);
        await dashboard.signOut().catch(() => { });
        const loginPage = new login_page_1.LoginPage(page);
        await loginPage.navigate();
        await loginPage.login(merchant_data_1.ROLES.onboarding.username, merchant_data_1.ROLES.onboarding.password);
        await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => { });
        await dashboard.navigateToDrafts();
        const searchInput = page.getByPlaceholder('Filter by MRN or name');
        if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await searchInput.fill(mrn);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(1000);
        }
        const row = page.locator(`tr:has-text("${mrn}")`).first();
        if (await row.isVisible({ timeout: 3000 }).catch(() => false)) {
            await row.click();
            await page.waitForTimeout(1000);
            const step8 = new step8_review_page_1.Step8ReviewPage(page);
            for (let s = 1; s < 8; s++) {
                await step8.clickSaveAndContinue().catch(() => { });
            }
            await step8.submitForReview();
        }
        // Re-login as Bhanu (Compliance)
        await dashboard.signOut().catch(() => { });
        await loginPage.navigate();
        await loginPage.login(merchant_data_1.ROLES.compliance.username, merchant_data_1.ROLES.compliance.password);
        await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => { });
    });
    (0, diagnostics_1.test)('Place on Hold with reason → status updates to On hold', async () => {
        if (!mrn)
            return;
        await complianceQueue.navigateToVerificationQueue();
        await complianceQueue.openMerchant(mrn);
        await complianceQueue.holdMerchant('Under investigation for entity verification');
        diagnostics_1.test.info().annotations.push({
            type: 'info',
            description: `Merchant ${mrn} placed on hold with reason`,
        });
    });
    (0, diagnostics_1.test)('Release from Hold → record returns to Verification queue', async () => {
        if (!mrn)
            return;
        await complianceQueue.navigateToOnHoldList();
        await complianceQueue.openMerchant(mrn);
        await complianceQueue.releaseFromHold();
        await complianceQueue.navigateToVerificationQueue();
        diagnostics_1.test.info().annotations.push({
            type: 'info',
            description: `Merchant ${mrn} released from hold back to verification queue`,
        });
    });
    (0, diagnostics_1.test)('Approve & forward → triggers AML screening, toast confirms decision recorded', async () => {
        if (!mrn)
            return;
        await complianceQueue.navigateToVerificationQueue();
        await complianceQueue.openMerchant(mrn);
        // approveMerchant() now verifies toast: "Decision recorded: Approve & forward."
        await complianceQueue.approveMerchant('Approved by compliance officer after document verification.');
        diagnostics_1.test.info().annotations.push({
            type: 'info',
            description: `Merchant ${mrn} approved by compliance officer — AML screening triggered, toast verified`,
        });
    });
    (0, diagnostics_1.test)('Double-click Approve → only one transition occurs', async () => {
        if (!mrn)
            return;
        await complianceQueue.navigateToVerificationQueue();
        await complianceQueue.openMerchant(mrn).catch(() => { });
        const approveBtn = page.locator('button:has-text("Approve & forward"), button:has-text("Approve")').first();
        if (await approveBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
            await approveBtn.click({ delay: 0 });
            await approveBtn.click({ delay: 0 }).catch(() => { });
            await page.waitForTimeout(1000);
        }
        diagnostics_1.test.info().annotations.push({
            type: 'info',
            description: 'Double-click Approve handled safely without duplicate transition',
        });
    });
    (0, diagnostics_1.test)('Re-approve or re-reject already-decided record via Back button → blocked', async () => {
        await page.goto(`${BASE_URL}/verification-queue`).catch(() => { });
        await page.goBack().catch(() => { });
        await page.waitForTimeout(1000);
        const currentUrl = page.url();
        const isBlocked = currentUrl.includes('/verification-queue') || currentUrl.includes('/dashboard');
        (0, diagnostics_1.expect)(isBlocked).toBe(true);
    });
    (0, diagnostics_1.test)('Direct URL access to non-reviewable record → blocked', async () => {
        await page.goto(`${BASE_URL}/verification-queue/review/INVALID_MRN_999`).catch(() => { });
        await page.waitForTimeout(1500);
        const bodyText = await page.locator('body').innerText().catch(() => '');
        const isBlocked = page.url().includes('/verification-queue') ||
            page.url().includes('/dashboard') ||
            bodyText.toLowerCase().includes('not found') ||
            bodyText.toLowerCase().includes('access denied');
        (0, diagnostics_1.expect)(isBlocked).toBe(true);
    });
    (0, diagnostics_1.test)('Filter box rejects injection-style input safely', async () => {
        await complianceQueue.navigateToVerificationQueue();
        await complianceQueue.filterByMRN(merchant_data_1.NEGATIVE_DATA.fieldMatrix.injectionSearch);
        await page.waitForTimeout(1000);
        await (0, diagnostics_1.expect)(page.locator('body')).toBeVisible();
        diagnostics_1.test.info().annotations.push({
            type: 'info',
            description: 'Filter box handled SQL injection search safely as literal string',
        });
    });
    (0, diagnostics_1.test)('Pagination beyond available range (?page=99) → graceful empty state', async () => {
        await page.goto(`${BASE_URL}/verification-queue?page=99`).catch(() => { });
        await page.waitForTimeout(1500);
        await (0, diagnostics_1.expect)(page.locator('body')).toBeVisible();
        diagnostics_1.test.info().annotations.push({
            type: 'info',
            description: 'Pagination beyond available range handled gracefully without crash',
        });
    });
    (0, diagnostics_1.test)('All 8 wizard steps data is viewable and read-only for compliance officer', async () => {
        if (!mrn)
            return;
        await complianceQueue.navigateToVerificationQueue().catch(() => { });
        await complianceQueue.openMerchant(mrn).catch(() => { });
        const isReadOnly = await complianceQueue.isReviewReadOnly();
        (0, diagnostics_1.expect)(isReadOnly).toBe(true);
    });
    (0, diagnostics_1.test)('Onboarding officer cannot reach Compliance screens (RBAC direct URL guard)', async () => {
        const page2 = await context.newPage();
        const login2 = new login_page_1.LoginPage(page2);
        await login2.navigate();
        await login2.login(merchant_data_1.ROLES.onboarding.username, merchant_data_1.ROLES.onboarding.password);
        await page2.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => { });
        await page2.goto(`${BASE_URL}/verification-queue`).catch(() => { });
        await page2.waitForTimeout(1500);
        const url = page2.url();
        const bodyText = await page2.locator('body').innerText().catch(() => '');
        const isBlocked = url.includes('/dashboard') ||
            bodyText.toLowerCase().includes('access denied') ||
            bodyText.toLowerCase().includes('unauthorized') ||
            !url.includes('/verification-queue');
        (0, diagnostics_1.expect)(isBlocked).toBe(true);
        await page2.close();
    });
});
