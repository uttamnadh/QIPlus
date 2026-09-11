import { Page } from '@playwright/test';
import { RoleCredentials, RoleName } from '../types';
import { RoleStrategy } from './role-strategy';
import { BugDetector } from '../core/detector';

export class OnboardingStrategy extends RoleStrategy {
  roleName: RoleName = 'onboarding';

  constructor(credentials: RoleCredentials) {
    super(credentials);
  }

  protected async runCustomExploration(page: Page, detector: BugDetector): Promise<void> {
    console.log(`   🎯 [CustomExploration] Running Onboarding Officer specific checks...`);

    // 1. Check Drafts Queue Search/Filter
    try {
      await page.goto('/merchants', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      const hasSearch = await page.locator('input[placeholder*="Search" i], input[type="search"]').isVisible({ timeout: 2000 }).catch(() => false);
      if (!hasSearch) {
        detector.recordBug({
          id: '',
          severity: 'Medium',
          category: 'missing-feature',
          title: 'Drafts Queue missing search and filter inputs',
          description: 'The merchant drafts queue on /merchants has no search or filtering input controls for operators handling multiple records.',
          stepsToReproduce: [`Login as Onboarding Officer`, `Navigate to /merchants`, `Inspect list header`],
          expected: 'Search input and status filter controls present',
          actual: 'No search bar or filter dropdowns available',
          url: '/merchants',
          role: this.roleName,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {}

    // 2. Test Phone Input Backspace Behavior on Wizard Step 1
    try {
      await page.goto('/merchants/new', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      const phoneInput = page.locator('input[type="tel"], input[name*="phone" i]').first();
      if (await phoneInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await phoneInput.click();
        await page.keyboard.type('501234567');
        const valBefore = await phoneInput.inputValue();

        // Hit Backspace once
        await page.keyboard.press('Backspace');
        const valAfter = await phoneInput.inputValue();

        // If hitting backspace completely cleared the entire input or reset mask
        if (valBefore.length > 5 && valAfter.length === 0) {
          detector.recordBug({
            id: '',
            severity: 'Medium',
            category: 'functional',
            title: 'Phone Input Mask clears entire field on single Backspace',
            description: `Typing digits and pressing Backspace once cleared the entire input value instead of deleting only the trailing digit.`,
            stepsToReproduce: [
              `Navigate to /merchants/new`,
              `Type "501234567" into primary contact phone field`,
              `Press Backspace once`,
            ],
            expected: 'Only the last digit is removed',
            actual: 'Entire field value is wiped',
            url: '/merchants/new',
            role: this.roleName,
            fieldName: 'primaryContactPhone',
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (e) {}
  }
}
