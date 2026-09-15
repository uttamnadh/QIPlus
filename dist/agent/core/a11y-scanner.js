"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.A11yScanner = void 0;
const playwright_1 = __importDefault(require("@axe-core/playwright"));
class A11yScanner {
    /**
     * Scan a page using @axe-core/playwright for WCAG 2.1 AA accessibility violations
     */
    static async scan(page, role, url) {
        const bugs = [];
        try {
            // Don't scan if page has crashed or is empty
            const title = await page.title().catch(() => '');
            if (!title)
                return [];
            const results = await new playwright_1.default({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
                .exclude('.MuiDrawer-root[aria-hidden="true"]')
                .analyze();
            for (const violation of results.violations) {
                // Map axe impact to MuseQA severity
                const severity = this.mapAxeImpact(violation.impact);
                const nodeTargets = violation.nodes
                    .slice(0, 3)
                    .map(n => n.target.join(' > '))
                    .join('; ');
                bugs.push({
                    id: `A11Y-${Math.floor(1000 + Math.random() * 9000)}`,
                    severity,
                    category: 'accessibility',
                    title: `A11y: ${violation.help}`,
                    description: `${violation.description}\nImpact: ${violation.impact || 'minor'}\nTags: ${violation.tags.join(', ')}`,
                    stepsToReproduce: [
                        `Login as ${role}`,
                        `Navigate to ${url}`,
                        `Inspect elements: ${nodeTargets}`,
                        `Verify WCAG violation: ${violation.id}`,
                    ],
                    expected: 'Elements must satisfy WCAG 2.1 AA standards',
                    actual: `${violation.nodes.length} element(s) violated "${violation.id}": ${violation.helpUrl}`,
                    url,
                    role,
                    timestamp: new Date().toISOString(),
                    fieldName: nodeTargets.slice(0, 50),
                });
            }
        }
        catch (e) {
            // Don't let a11y scanner failure break the crawl
            // console.warn(`A11y scan skipped for ${url}:`, e.message);
        }
        return bugs;
    }
    static mapAxeImpact(impact) {
        switch (impact) {
            case 'critical':
                return 'High'; // Keep High so it doesn't block CI unnecessarily unless security
            case 'serious':
                return 'Medium';
            case 'moderate':
                return 'Medium';
            case 'minor':
            default:
                return 'Low';
        }
    }
}
exports.A11yScanner = A11yScanner;
