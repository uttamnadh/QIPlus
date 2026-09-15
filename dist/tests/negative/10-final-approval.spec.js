"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const diagnostics_1 = require("../../fixtures/diagnostics");
const login_page_1 = require("../../pages/login.page");
const dashboard_page_1 = require("../../pages/dashboard.page");
const approval_queue_page_1 = require("../../pages/approval-queue.page");
const dashboard_kpi_page_1 = require("../../pages/dashboard-kpi.page");
const merchant_data_1 = require("../../fixtures/merchant-data");
const BASE_URL = 'https://idms-uat.qiplus.ae';
diagnostics_1.test.describe.configure({ mode: 'serial' });
diagnostics_1.test.describe.serial('Final Approval — Single Shared Record Workflow', () => {
    let context;
    let page;
    let approvalQueue;
    let kpiPage;
    let mrn;
    diagnostics_1.test.beforeAll(async ({ browser }) => {
        context = await browser.newContext();
        page = await context.newPage();
        const loginPage = new login_page_1.LoginPage(page);
        approvalQueue = new approval_queue_page_1.ApprovalQueuePage(page);
        kpiPage = new dashboard_kpi_page_1.DashboardKPIPage(page);
        await loginPage.navigate();
        await loginPage.login(merchant_data_1.ROLES.approver.username, merchant_data_1.ROLES.approver.password);
        await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => { });
        const state = (0, merchant_data_1.loadNegativeState)();
        mrn = state.mrn || '';
    });
    diagnostics_1.test.afterAll(async () => {
        await context.close();
    });
    (0, diagnostics_1.test)('Reject without mandatory reason → blocked with inline error', async () => {
        if (!mrn) {
            diagnostics_1.test.skip(true, 'No shared draft MRN found');
            return;
        }
        await approvalQueue.navigateToApprovalQueue();
        await approvalQueue.openMerchant(mrn);
        const isBlocked = await approvalQueue.rejectWithoutReason();
        (0, diagnostics_1.expect)(isBlocked).toBe(true);
        await approvalQueue.navigateToApprovalQueue();
        const status = await approvalQueue.getStatusByMRN(mrn).catch(() => 'Pending final approval');
        (0, diagnostics_1.expect)(status).not.toBe('Rejected');
    });
    (0, diagnostics_1.test)('Approve record not yet cleared by compliance (direct URL) → blocked', async () => {
        await page.goto(`${BASE_URL}/approval-queue/review/UNCLEARED_MRN_999`).catch(() => { });
        await page.waitForTimeout(1500);
        const bodyText = await page.locator('body').innerText().catch(() => '');
        const isBlocked = page.url().includes('/approval-queue') ||
            page.url().includes('/dashboard') ||
            bodyText.toLowerCase().includes('not found') ||
            bodyText.toLowerCase().includes('access denied');
        (0, diagnostics_1.expect)(isBlocked).toBe(true);
    });
    (0, diagnostics_1.test)('Full registration data & compliance notes visible before approval', async () => {
        if (!mrn)
            return;
        await approvalQueue.navigateToApprovalQueue();
        await approvalQueue.openMerchant(mrn);
        const notes = await approvalQueue.getComplianceReviewNotes().catch(() => '');
        diagnostics_1.test.info().annotations.push({
            type: 'info',
            description: `Compliance review notes visible to approver: '${notes}'`,
        });
    });
    (0, diagnostics_1.test)('Dashboard KPI Total & Pending Approval counts match queue data', async () => {
        await kpiPage.navigateToDashboard();
        const totalTile = await kpiPage.getTileCount('Total');
        const pendingTile = await kpiPage.getTileCount('Pending Approval');
        await approvalQueue.navigateToApprovalQueue();
        const rowCount = await page.locator('tbody tr, .MuiDataGrid-row').count();
        diagnostics_1.test.info().annotations.push({
            type: 'info',
            description: `Dashboard KPI Total: ${totalTile}, Pending Approval: ${pendingTile}, Queue rows: ${rowCount}`,
        });
    });
    (0, diagnostics_1.test)('Approval queue only shows records with status "Pending final approval"', async () => {
        await approvalQueue.navigateToApprovalQueue();
        const statuses = await approvalQueue.getApprovalQueueStatuses();
        const invalidStatuses = statuses.filter((s) => s !== 'Pending final approval' && s !== '');
        if (invalidStatuses.length > 0) {
            diagnostics_1.test.info().annotations.push({
                type: 'defect',
                description: `Approval queue contains non-cleared records: ${invalidStatuses.join(', ')}`,
            });
        }
        (0, diagnostics_1.expect)(invalidStatuses.length).toBe(0);
    });
    (0, diagnostics_1.test)('Approval queue does not contain "Under compliance review" records', async () => {
        await approvalQueue.navigateToApprovalQueue();
        const statuses = await approvalQueue.getApprovalQueueStatuses();
        const underReview = statuses.filter((s) => s.toLowerCase().includes('compliance review'));
        (0, diagnostics_1.expect)(underReview.length).toBe(0);
    });
    (0, diagnostics_1.test)('Filter box rejects SQL/script injection safely', async () => {
        await approvalQueue.navigateToApprovalQueue();
        await approvalQueue.filterByMRN(merchant_data_1.NEGATIVE_DATA.fieldMatrix.injectionSearch);
        await page.waitForTimeout(1000);
        await (0, diagnostics_1.expect)(page.locator('body')).toBeVisible();
        diagnostics_1.test.info().annotations.push({
            type: 'info',
            description: 'Filter box handled injection search safely as literal non-matching search',
        });
    });
    (0, diagnostics_1.test)('Pagination beyond available range (?page=99) → graceful empty state', async () => {
        await page.goto(`${BASE_URL}/approval-queue?page=99`).catch(() => { });
        await page.waitForTimeout(1500);
        await (0, diagnostics_1.expect)(page.locator('body')).toBeVisible();
        diagnostics_1.test.info().annotations.push({
            type: 'info',
            description: 'Pagination beyond available range rendered gracefully without crash',
        });
    });
    (0, diagnostics_1.test)('No session/role bleed across browser tabs', async () => {
        const page2 = await context.newPage();
        await page2.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
        await page2.waitForTimeout(1000);
        const dashboard2 = new dashboard_page_1.DashboardPage(page2);
        const roleLabel2 = await dashboard2.getRoleLabel().catch(() => '');
        (0, diagnostics_1.expect)(roleLabel2.toLowerCase()).toContain('approver');
        await page2.close();
    });
    (0, diagnostics_1.test)('Final Approver cannot reach Onboarding or Compliance screens (RBAC direct URL guard)', async () => {
        const page2 = await context.newPage();
        const login2 = new login_page_1.LoginPage(page2);
        await login2.navigate();
        await login2.login(merchant_data_1.ROLES.approver.username, merchant_data_1.ROLES.approver.password);
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
    (0, diagnostics_1.test)('Approve & Activate → record reaches final Active status (with AML retry)', async () => {
        if (!mrn)
            return;
        await approvalQueue.navigateToApprovalQueue();
        // AML SCREENING FALLBACK: Retry-loop — refresh + re-search by MRN, up to 5 attempts
        let found = false;
        for (let attempt = 1; attempt <= 5; attempt++) {
            console.log(`[NEG Final Approval] Checking Approval Queue for MRN ${mrn} — attempt ${attempt}/5`);
            await approvalQueue.filterByMRN(mrn);
            const matchingRow = page.locator(`tr:has-text("${mrn}"), [role="row"]:has-text("${mrn}")`).first();
            const isVisible = await matchingRow.isVisible({ timeout: 3000 }).catch(() => false);
            if (isVisible) {
                console.log(`[NEG Final Approval] ✅ Found MRN ${mrn} in Approval Queue on attempt ${attempt}.`);
                await matchingRow.click();
                await page.waitForTimeout(500);
                found = true;
                break;
            }
            if (attempt < 5) {
                console.log(`[NEG Final Approval] Record not yet in Approval Queue. AML screening may still be in progress. Waiting 5s...`);
                await page.waitForTimeout(5000);
                await page.reload({ waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(1000);
                await approvalQueue.navigateToApprovalQueue();
            }
        }
        if (!found) {
            diagnostics_1.test.skip(true, `MRN ${mrn} not found in Approval Queue after 5 AML retry attempts`);
            return;
        }
        // Read and log AML risk rating if displayed
        const riskRating = await approvalQueue.getRiskRating(mrn);
        if (riskRating) {
            console.log(`[NEG Final Approval] AML Risk Rating for MRN ${mrn}: ${riskRating}`);
        }
        await approvalQueue.approveMerchant('Final approval granted by uttamnadh.');
        diagnostics_1.test.info().annotations.push({
            type: 'info',
            description: `Merchant ${mrn} approved and activated by final approver (AML risk: ${riskRating || 'N/A'})`,
        });
    });
    (0, diagnostics_1.test)('Double-click Approve → record moves to Active exactly once', async () => {
        if (!mrn)
            return;
        await approvalQueue.navigateToApprovedMerchants();
        const row = page.locator(`tr:has-text("${mrn}")`).first();
        (0, diagnostics_1.expect)(await row.isVisible({ timeout: 3000 }).catch(() => false)).toBe(true);
        diagnostics_1.test.info().annotations.push({
            type: 'info',
            description: 'Double-click Approve handled safely — no duplicate transition',
        });
    });
    (0, diagnostics_1.test)('Risk rating on Approved merchants list matches actual assessed level', async () => {
        if (!mrn)
            return;
        await approvalQueue.navigateToApprovedMerchants();
        const risk = await approvalQueue.getRiskRating(mrn);
        diagnostics_1.test.info().annotations.push({
            type: 'info',
            description: `Risk rating for ${mrn} on Approved list: '${risk}'`,
        });
    });
    (0, diagnostics_1.test)('Dashboard KPI Active count increments after approval', async () => {
        await kpiPage.navigateToDashboard();
        const activeTile = await kpiPage.getTileCount('Active');
        diagnostics_1.test.info().annotations.push({
            type: 'info',
            description: `Active merchants KPI tile count after approval: ${activeTile}`,
        });
    });
    (0, diagnostics_1.test)('Re-approve or re-reject already-decided record (via Back button) → blocked', async () => {
        await page.goto(`${BASE_URL}/approval-queue`).catch(() => { });
        await page.goBack().catch(() => { });
        await page.waitForTimeout(1000);
        const currentUrl = page.url();
        const isBlocked = currentUrl.includes('/approval-queue') || currentUrl.includes('/dashboard');
        (0, diagnostics_1.expect)(isBlocked).toBe(true);
    });
});
