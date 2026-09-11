import { Page } from '@playwright/test';
import { RoleCredentials, RoleName } from '../types';
import { RoleStrategy } from './role-strategy';
import { BugDetector } from '../core/detector';

export class AuditorStrategy extends RoleStrategy {
  roleName: RoleName = 'auditor';

  constructor(credentials: RoleCredentials) {
    super(credentials);
  }

  protected async runCustomExploration(page: Page, detector: BugDetector): Promise<void> {
    console.log(`   🎯 [CustomExploration] Running Auditor specific checks...`);

    // 1. Check Route Mismatch (/merchants vs /merchants/search)
    try {
      const navMerchants = await page.goto('/merchants', { waitUntil: 'domcontentloaded' }).catch(() => null);
      await page.waitForTimeout(1000);

      const is404 = await page.locator('text=/404|Page not found/i').isVisible({ timeout: 1500 }).catch(() => false);
      if (is404) {
        detector.recordBug({
          id: '',
          severity: 'High',
          category: 'network-error',
          title: 'Direct navigation to /merchants returns 404 for Auditor',
          description: 'Auditor navigating to /merchants receives a 404 error instead of the read-only merchant directory or redirecting to /merchants/search.',
          stepsToReproduce: [`Login as Auditor`, `Navigate directly to /merchants`],
          expected: 'Read-only merchant directory table or automatic redirect to valid route',
          actual: '404 Page Not Found error page displayed',
          url: '/merchants',
          role: this.roleName,
          httpStatus: 404,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {}

    // 2. Check for Audit Trail Route & Export Features
    try {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      const hasExportBtn = await page.locator('button:has-text("Export"), button:has-text("CSV"), button:has-text("Excel"), [aria-label*="export" i]').isVisible({ timeout: 1500 }).catch(() => false);
      if (!hasExportBtn) {
        detector.recordBug({
          id: '',
          severity: 'Medium',
          category: 'missing-feature',
          title: 'Auditor interface has Zero Export Features across queues',
          description: 'Auditor role is required by compliance to export transaction and onboarding logs, but UI provides no export button (CSV/Excel).',
          stepsToReproduce: [`Login as Auditor`, `Browse dashboard and directory`, `Look for export controls`],
          expected: 'Export data buttons visible to download reports',
          actual: 'No export actions present in UI',
          url: '/dashboard',
          role: this.roleName,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {}
  }
}
