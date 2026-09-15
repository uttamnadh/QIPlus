"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminStrategy = void 0;
const role_strategy_1 = require("./role-strategy");
class AdminStrategy extends role_strategy_1.RoleStrategy {
    constructor(credentials) {
        super(credentials);
        this.roleName = 'admin';
    }
    async runCustomExploration(page, detector) {
        console.log(`   🎯 [CustomExploration] Running Administrator specific checks...`);
        // 1. Check User Management: Edit Existing Users & Deactivation Toggle
        try {
            await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(1000);
            // Check if user table rows have an Edit icon/button
            const hasEditAction = await page.locator('table tbody button[aria-label*="edit" i], table tbody [data-testid*="edit" i]').count();
            if (hasEditAction === 0) {
                detector.recordBug({
                    id: '',
                    severity: 'Medium',
                    category: 'missing-feature',
                    title: 'Administrator cannot edit existing users on /admin/users',
                    description: 'User management table provides Add User functionality but has no action to edit existing operator accounts or roles.',
                    stepsToReproduce: [`Login as Admin`, `Navigate to /admin/users`, `Inspect table row actions`],
                    expected: 'Edit button or click-to-edit row functionality',
                    actual: 'No edit controls available in user table',
                    url: '/admin/users',
                    role: this.roleName,
                    timestamp: new Date().toISOString(),
                });
            }
            // Check deactivation toggle
            const hasToggle = await page.locator('table tbody input[type="checkbox"], table tbody [role="switch"]').count();
            if (hasToggle === 0) {
                detector.recordBug({
                    id: '',
                    severity: 'Medium',
                    category: 'missing-feature',
                    title: 'User Management missing user deactivation/disable toggle',
                    description: 'Admins cannot disable or suspend access for departed employees without permanent deletion or backend database intervention.',
                    stepsToReproduce: [`Navigate to /admin/users`, `Inspect user status column`],
                    expected: 'Active/Inactive toggle switch or deactivation action',
                    actual: 'No account deactivation control present',
                    url: '/admin/users',
                    role: this.roleName,
                    timestamp: new Date().toISOString(),
                });
            }
        }
        catch (e) { }
        // 2. Proactively test picklists and prohibited activities routes
        const brokenRoutes = ['/admin/picklists', '/admin/prohibited-activities'];
        for (const r of brokenRoutes) {
            try {
                await page.goto(r, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(500);
                const is404 = await page.locator('text=/404|Page not found/i').isVisible({ timeout: 1000 }).catch(() => false);
                if (is404) {
                    detector.recordBug({
                        id: '',
                        severity: 'Medium',
                        category: 'network-error',
                        title: `Admin route ${r} returns 404 Not Found`,
                        description: `Admin navigation route ${r} results in 404 page error.`,
                        stepsToReproduce: [`Login as Admin`, `Navigate to ${r}`],
                        expected: 'Admin management panel or configuration table',
                        actual: '404 Page Not Found',
                        url: r,
                        role: this.roleName,
                        httpStatus: 404,
                        timestamp: new Date().toISOString(),
                    });
                }
            }
            catch (e) { }
        }
    }
}
exports.AdminStrategy = AdminStrategy;
