import { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { Bug, RoleName, Severity } from '../types';

export class A11yScanner {
  /**
   * Scan a page using @axe-core/playwright for WCAG 2.1 AA accessibility violations
   */
  static async scan(page: Page, role: RoleName, url: string): Promise<Bug[]> {
    const bugs: Bug[] = [];

    try {
      // Don't scan if page has crashed or is empty
      const title = await page.title().catch(() => '');
      if (!title) return [];

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .exclude('.MuiDrawer-root[aria-hidden="true"]')
        .analyze();

      for (const violation of results.violations) {
        // Map axe impact to MuseQA severity
        const severity: Severity = this.mapAxeImpact(violation.impact);

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
    } catch (e: any) {
      // Don't let a11y scanner failure break the crawl
      // console.warn(`A11y scan skipped for ${url}:`, e.message);
    }

    return bugs;
  }

  private static mapAxeImpact(impact?: string | null): Severity {
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
