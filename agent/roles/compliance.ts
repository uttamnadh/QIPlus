import { Page } from '@playwright/test';
import { RoleCredentials, RoleName } from '../types';
import { RoleStrategy } from './role-strategy';
import { BugDetector } from '../core/detector';

export class ComplianceStrategy extends RoleStrategy {
  roleName: RoleName = 'compliance';

  constructor(credentials: RoleCredentials) {
    super(credentials);
  }

  protected async runCustomExploration(page: Page, detector: BugDetector): Promise<void> {
    console.log(`   🎯 [CustomExploration] Running Compliance Officer specific checks...`);

    // 1. Compliance Queue Search & Filter
    try {
      await page.goto('/merchants', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      const hasSearch = await page.locator('input[placeholder*="Search" i], input[type="search"]').isVisible({ timeout: 2000 }).catch(() => false);
      if (!hasSearch) {
        detector.recordBug({
          id: '',
          severity: 'Medium',
          category: 'missing-feature',
          title: 'Compliance Queue missing search and filter inputs',
          description: 'The compliance review queue on /merchants has no search or filter controls for reviewing assigned applications.',
          stepsToReproduce: [`Login as Compliance Officer`, `Navigate to /merchants`, `Inspect list header`],
          expected: 'Search input and risk-level filter controls present',
          actual: 'No search bar or filter controls available',
          url: '/merchants',
          role: this.roleName,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {}

    // 2. Test Whitespace-only Decision Notes
    try {
      const firstRow = page.locator('table tbody tr').first();
      if (await firstRow.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstRow.click();
        await page.waitForTimeout(1000);

        const notesField = page.locator('textarea[name*="note" i], textarea[placeholder*="note" i]').first();
        if (await notesField.isVisible({ timeout: 2000 }).catch(() => false)) {
          await notesField.fill('     ');
          const approveBtn = page.locator('button:has-text("Approve"), button:has-text("Proceed")').first();
          const isEnabled = await approveBtn.isEnabled().catch(() => false);

          if (isEnabled) {
            detector.recordBug({
              id: '',
              severity: 'Medium',
              category: 'validation-gap',
              title: 'Compliance Decision Notes field accepts whitespace-only input',
              description: 'Compliance review decision notes should require substantive feedback. Currently enables submission with purely blank spaces.',
              stepsToReproduce: [
                `Open merchant in compliance queue`,
                `Enter only whitespace characters ("   ") into notes field`,
                `Check approve button state`,
              ],
              expected: 'Button remains disabled until non-whitespace text is entered',
              actual: 'Action button becomes enabled with whitespace only',
              url: page.url(),
              role: this.roleName,
              fieldName: 'notes',
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    } catch (e) {}
  }
}
