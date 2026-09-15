"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardKPIPage = void 0;
/**
 * Page Object for reading Dashboard KPI tiles.
 * Used by Compliance and Approver verification tests to cross-check
 * tile counts against actual queue/list row counts.
 */
class DashboardKPIPage {
    constructor(page) {
        this.page = page;
    }
    /**
     * Get the numeric count displayed on a specific KPI tile.
     * Tries multiple selector strategies since tile implementations vary.
     *
     * @param tileName - The tile label (e.g., "Total", "Drafts", "Pending Verification",
     *   "Pending Approval", "Active", "Rejected")
     */
    async getTileCount(tileName) {
        // Strategy 1: Look for a card/tile containing the label, then read the number
        const tile = this.page.locator(`.MuiCard-root:has-text("${tileName}"), .MuiPaper-root:has-text("${tileName}"), [class*="tile"]:has-text("${tileName}"), [class*="kpi"]:has-text("${tileName}")`).first();
        if (await tile.isVisible({ timeout: 3000 }).catch(() => false)) {
            const text = await tile.innerText();
            // Extract the first number found in the tile text
            const match = text.match(/(\d+)/);
            if (match)
                return parseInt(match[1], 10);
        }
        // Strategy 2: Look for heading-level number near the label
        const heading = this.page.locator(`h1, h2, h3, h4, h5, h6`).filter({ hasText: /^\d+$/ });
        const count = await heading.count();
        for (let i = 0; i < count; i++) {
            const parent = heading.nth(i).locator('xpath=ancestor::div[1]');
            const parentText = await parent.innerText().catch(() => '');
            if (parentText.toLowerCase().includes(tileName.toLowerCase())) {
                const numText = await heading.nth(i).innerText();
                return parseInt(numText, 10);
            }
        }
        return -1; // Not found
    }
    /**
     * Read all KPI tile counts at once.
     * Returns a map of tile name → count.
     */
    async getAllTileCounts() {
        const tileNames = ['Total', 'Drafts', 'Pending Verification', 'Pending Approval', 'Active', 'Rejected'];
        const result = {};
        for (const name of tileNames) {
            result[name] = await this.getTileCount(name);
        }
        return result;
    }
    /**
     * Count actual rows in the current list/table view.
     * Useful for cross-checking against KPI tile numbers.
     */
    async getListRowCount() {
        const rows = this.page.locator('table tbody tr, .MuiDataGrid-row');
        await this.page.waitForTimeout(1000);
        return rows.count();
    }
    /**
     * Navigate to dashboard and wait for KPI tiles to load.
     */
    async navigateToDashboard() {
        await this.page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
        await this.page.waitForTimeout(2000);
    }
}
exports.DashboardKPIPage = DashboardKPIPage;
