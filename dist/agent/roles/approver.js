"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApproverStrategy = void 0;
const role_strategy_1 = require("./role-strategy");
class ApproverStrategy extends role_strategy_1.RoleStrategy {
    constructor(credentials) {
        super(credentials);
        this.roleName = 'approver';
    }
    async runCustomExploration(page, detector) {
        console.log(`   🎯 [CustomExploration] Running Final Approver specific checks...`);
        // 1. Check for Batch Approval capability in table
        try {
            await page.goto('/merchants', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(1000);
            const hasCheckboxes = await page.locator('table th input[type="checkbox"], table td input[type="checkbox"]').count();
            const hasBatchBtn = await page.locator('button:has-text("Approve Selected"), button:has-text("Batch Approve")').isVisible({ timeout: 1000 }).catch(() => false);
            if (hasCheckboxes === 0 && !hasBatchBtn) {
                detector.recordBug({
                    id: '',
                    severity: 'Medium',
                    category: 'missing-feature',
                    title: 'Final Approver Queue lacks Batch Approval functionality',
                    description: 'High-volume approving officers must click through each record individually due to absent multi-select batch approval features.',
                    stepsToReproduce: [`Login as Final Approver`, `Navigate to /merchants`, `Inspect approval table controls`],
                    expected: 'Row checkboxes and "Batch Approve" action button',
                    actual: 'No batch selection or multi-approval controls available',
                    url: '/merchants',
                    role: this.roleName,
                    timestamp: new Date().toISOString(),
                });
            }
        }
        catch (e) { }
        // 2. Check for Immediate Activation without confirmation dialog
        try {
            const firstRow = page.locator('table tbody tr').first();
            if (await firstRow.isVisible({ timeout: 2000 }).catch(() => false)) {
                await firstRow.click();
                await page.waitForTimeout(1000);
                const approveBtn = page.locator('button:has-text("Approve & Activate"), button:has-text("Final Approve")').first();
                if (await approveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    // Check if button text or action lacks two-step confirmation
                    const modalText = await page.locator('[role="dialog"]').isVisible({ timeout: 500 }).catch(() => false);
                    if (!modalText) {
                        // Document potential missing double-check confirmation
                    }
                }
            }
        }
        catch (e) { }
    }
}
exports.ApproverStrategy = ApproverStrategy;
