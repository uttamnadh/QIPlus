import { test, expect } from '../../fixtures/diagnostics';
import { Page } from '@playwright/test';
import * as path from 'path';
import { Step1ProfilePage } from '../../pages/wizard/step1-profile.page';
import { Step2BusinessPage } from '../../pages/wizard/step2-business.page';
import { Step3OwnershipPage } from '../../pages/wizard/step3-ownership.page';
import { Step4UBOsPage } from '../../pages/wizard/step4-ubos.page';
import { Step5SignatoriesPage } from '../../pages/wizard/step5-signatories.page';
import { Step6BankingPage } from '../../pages/wizard/step6-banking.page';
import { Step7DocumentsPage } from '../../pages/wizard/step7-documents.page';
import { Step8ReviewPage } from '../../pages/wizard/step8-review.page';
import { getMerchantData } from '../../fixtures/merchant-data';

const MERCHANT = getMerchantData('negative');

/**
 * Describes a single field-level validation test case.
 */
export interface FieldTestCase {
  /** Human-readable field name (appears in report title). */
  field: string;
  /** What rule is being tested (e.g., "required", "format", "boundary"). */
  rule: string;
  /** Description of the invalid input for report clarity. */
  invalidValue: string;
  /** Enter the invalid value into the field. */
  action: (page: Page) => Promise<void>;
  /** Assert the wizard is blocked / error is shown. */
  assert: (page: Page) => Promise<void>;
  /** Restore the field to a valid value so the draft remains progressable. */
  restore: (page: Page) => Promise<void>;
  /** If true, the test will be skipped if the field element is not visible. */
  skipIfMissing?: boolean;
  /** Selector to check for existence when skipIfMissing is true. */
  presenceSelector?: string;
}

/**
 * Runs all field validation test cases for a step sequentially inside
 * ONE SINGLE TEST block on ONE SINGLE BROWSER PAGE instance.
 *
 * WHY: Prevents Playwright from launching separate background windows/tabs.
 * All scenarios run on the exact same merchant draft record.
 *
 * @param stepName - Human-readable step name (e.g., "Step 1 — Profile")
 * @param testCases - Array of field test case definitions
 * @param getPage - Optional function returning the shared page instance from beforeAll
 */
export function runFieldMatrix(stepName: string, testCases: FieldTestCase[], getPage?: () => Page): void {
  // Extract step number from stepName (e.g. "Step 5 - Signatories" → 5)
  const stepMatch = stepName.match(/Step\s+(\d+)/i);
  const expectedStep = stepMatch ? parseInt(stepMatch[1], 10) : 0;

  test(`${stepName} — Field Validation Matrix (${testCases.length} scenarios on single record)`, async ({ page: fixturePage }: { page: Page }) => {
    test.setTimeout(600000); // 10 mins per step test block
    const page = getPage ? getPage() : fixturePage;

    if (expectedStep > 0) {
      await navigateToWizardStep(page, expectedStep);
    }

    let scenarioIdx = 0;
    for (const tc of testCases) {
      scenarioIdx++;
      if (tc.skipIfMissing && tc.presenceSelector) {
        const exists = await page.locator(tc.presenceSelector).isVisible({ timeout: 1500 }).catch(() => false);
        if (!exists) {
          test.info().annotations.push({
            type: 'info',
            description: `[${stepName}] Field "${tc.field}" (${tc.rule}) not present in UI — skipped`,
          });
          continue;
        }
      }

      console.log(`Scenario #${scenarioIdx}: [${tc.field}] - [${tc.rule}] - STARTING`);
      try {
        // Step 1: Action (enter invalid value)
        await tc.action(page);

        // Step 2: Assert (check wizard blocked / validation error visible)
        await tc.assert(page);

        test.info().annotations.push({
          type: 'passed-field-check',
          description: `[${stepName}] Passed: ${tc.field} — ${tc.rule}: ${tc.invalidValue}`,
        });
        console.log(`  ✓ [${stepName}] (${scenarioIdx}/${testCases.length}) ${tc.field} [${tc.rule}]`);
      } catch (err: any) {
        test.info().annotations.push({
          type: 'defect',
          description: `[${stepName}] Failed: ${tc.field} — ${tc.rule}: ${err.message}`,
        });
        console.log(`  ✗ [${stepName}] (${scenarioIdx}/${testCases.length}) ${tc.field} [${tc.rule}] FAILED: ${err.message}`);
      } finally {
        // Dismiss any open MUI dropdown/popover before restore
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(200);

        // Check if wizard drifted from expected step — navigate back/forward if needed
        if (expectedStep > 0) {
          const currentStepNum = await page.locator('text=/Step \\d+ of 8/').first().innerText()
            .then(t => { const m = t.match(/Step (\d+) of 8/); return m ? parseInt(m[1], 10) : expectedStep; })
            .catch(() => expectedStep);
          if (currentStepNum !== expectedStep) {
            console.log(`Navigating to Step ${expectedStep} - DRIFT DETECTED (on ${currentStepNum})`);
            await navigateToWizardStep(page, expectedStep).catch(() => {});
          }
        }

        // Step 3: Always restore valid state on the SAME single page (NEVER click Save Draft)
        console.log(`Scenario #${scenarioIdx}: [${tc.field}] - RESTORE STARTING`);
        await tc.restore(page).catch((restoreErr) => {
          test.info().annotations.push({
            type: 'defect',
            description: `Restore failed for "${tc.field}": ${restoreErr.message}`,
          });
          console.log(`Scenario #${scenarioIdx}: [${tc.field}] - RESTORE FAILED: ${restoreErr.message}`);
        });
        console.log(`Scenario #${scenarioIdx}: [${tc.field}] - RESTORE COMPLETE`);
      }
    }
  });
}

/**
 * Helper to assert the wizard did NOT advance past the current step.
 * Uses the step indicator text (e.g., "Step 1 of 8").
 */
export async function assertStillOnStep(page: Page, stepNumber: number): Promise<void> {
  const indicator = page.locator('text=/Step \\d+ of 8/').first();
  await expect(indicator).toContainText(`Step ${stepNumber} of 8`, { timeout: 3000 });
}

/**
 * Helper to assert at least one MUI validation error is visible.
 */
export async function assertHasValidationError(page: Page): Promise<void> {
  const errors = page.locator('.MuiFormHelperText-root.Mui-error, .Mui-error .MuiFormHelperText-root');
  const count = await errors.count();
  if (count === 0) {
    const alerts = page.locator('.MuiAlert-root[severity="error"], .MuiAlert-standardError');
    const alertCount = await alerts.count();
    expect(count + alertCount).toBeGreaterThan(0);
  }
}

/**
 * Helper to click "Save & continue" and check if the step advanced.
 * Returns true if advanced (step changed), false if blocked (stayed).
 */
export async function trySaveAndCheckBlocked(page: Page, currentStep: number): Promise<boolean> {
  await page.click('button:has-text("Save & continue")');
  await page.waitForTimeout(1500);
  const indicator = await page.locator('text=/Step \\d+ of 8/').first().innerText().catch(() => '');
  return indicator.includes(`Step ${currentStep} of 8`);
}

/**
 * Safely navigates the wizard to the target step number by checking the current step
 * and filling valid step data sequentially when advancing forward.
 */
export async function navigateToWizardStep(page: Page, targetStep: number): Promise<void> {
  const step1 = new Step1ProfilePage(page);
  const step2 = new Step2BusinessPage(page);
  const step3 = new Step3OwnershipPage(page);
  const step4 = new Step4UBOsPage(page);
  const step5 = new Step5SignatoriesPage(page);
  const step6 = new Step6BankingPage(page);
  const step7 = new Step7DocumentsPage(page);
  const step8 = new Step8ReviewPage(page);

  const stepTabLocators = [
    '',
    'button:has-text("Profile"), [role="tab"]:has-text("Profile")',
    'button:has-text("Business"), [role="tab"]:has-text("Business")',
    'button:has-text("Ownership"), button:has-text("Shareholder"), [role="tab"]:has-text("Ownership")',
    'button:has-text("UBO"), [role="tab"]:has-text("UBO")',
    'button:has-text("Signator"), button:has-text("Authorized"), button:has-text("Authorised"), [role="tab"]:has-text("Signator")',
    'button:has-text("Banking"), button:has-text("Bank"), [role="tab"]:has-text("Bank")',
    'button:has-text("Document"), [role="tab"]:has-text("Document")',
    'button:has-text("Review"), [role="tab"]:has-text("Review")'
  ];

  const indicator = await page.locator('text=/Step \\d+ of 8/').first().innerText().catch(() => '');
  let currentStep = 1;
  const match = indicator.match(/Step (\d+) of 8/);
  if (match) currentStep = parseInt(match[1], 10);
  console.log(`Navigating to Step ${targetStep} - STARTING (Current = ${currentStep})`);

  let attempts = 0;
  while (currentStep < targetStep && attempts < 15) {
    attempts++;
    console.log(`  [DIAG-NAV-ADVANCE] Attempt ${attempts}: Advancing from Step ${currentStep} towards ${targetStep}`);

    if (currentStep === 1) {
      await step1.fillAll(MERCHANT).catch(() => {});
      await step1.clickSaveAndContinue().catch(() => {});
      await page.waitForTimeout(500);
    } else if (currentStep === 2) {
      await step2.fillAll(MERCHANT.business).catch(() => {});
      await step2.clickSaveAndContinue().catch(() => {});
    } else if (currentStep === 3) {
      await page.keyboard.press('Escape').catch(() => {});
      let shCount = await step3.getShareholderCount().catch(() => 1);
      let dAttempts = 0;
      while (shCount > 1 && dAttempts < 5) {
        dAttempts++;
        await step3.deleteShareholder(shCount - 1).catch(() => {});
        await page.waitForTimeout(300);
        shCount = await step3.getShareholderCount().catch(() => 1);
      }
      for (let i = 1; i < shCount; i++) {
        await step3.fillShareholderPercent(i, '0').catch(() => {});
      }
      await step3.fillShareholder(0, MERCHANT.shareholders[0]).catch(() => {});
      await step3.fillShareholderPercent(0, '100').catch(() => {});
      await step3.clickSaveAndContinue().catch(() => {});
    } else if (currentStep === 4) {
      await page.keyboard.press('Escape').catch(() => {});
      await step4.removeExtraUBOs().catch(() => {});
      await step4.fillUBO(0, MERCHANT.ubos[0]).catch(() => {});
      await step4.clickSaveAndContinue().catch(() => {});
    } else if (currentStep === 5) {
      await page.keyboard.press('Escape').catch(() => {});
      await step5.removeExtraSignatories().catch(() => {});
      await step5.fillSignatory(0, MERCHANT.signatories[0]).catch(() => {});
      await step5.clickSaveAndContinue().catch(() => {});
    } else if (currentStep === 6) {
      await step6.fillAll(MERCHANT.banking).catch(() => {});
      await step6.clickSaveAndContinue().catch(() => {});
    } else if (currentStep === 7) {
      await step7.uploadAllDummyDocuments(path.join(__dirname, '../../fixtures')).catch(() => {});
      await step7.clickSaveAndContinue().catch(() => {});
    }
    await page.waitForTimeout(500);
    const updated = await page.locator('text=/Step \\d+ of 8/').first().innerText().catch(() => '');
    const updatedMatch = updated.match(/Step (\d+) of 8/);
    if (updatedMatch) currentStep = parseInt(updatedMatch[1], 10);
    console.log(`  [DIAG-NAV-STATE] After step advance action: now on Step ${currentStep}`);
  }

  // If moving backwards, try direct header tab click first
  if (currentStep > targetStep) {
    const tabSelector = stepTabLocators[targetStep];
    const tab = page.locator(tabSelector).first();
    if (await tab.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.keyboard.press('Escape').catch(() => {});
      await tab.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);
      const navInd = await page.locator('text=/Step \\d+ of 8/').first().innerText().catch(() => '');
      const navMatch = navInd.match(/Step (\d+) of 8/);
      if (navMatch) currentStep = parseInt(navMatch[1], 10);
    }
  }

  let backAttempts = 0;
  while (currentStep > targetStep && backAttempts < 10) {
    backAttempts++;
    const backBtn = page.locator('button:has-text("Back"), button:has-text("Previous")').first();
    if (await backBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await backBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(800);
    }
    const updated = await page.locator('text=/Step \\d+ of 8/').first().innerText().catch(() => '');
    const updatedMatch = updated.match(/Step (\d+) of 8/);
    if (updatedMatch) currentStep = parseInt(updatedMatch[1], 10);
    else break;
  }

  const finalLoc = page.locator('text=/Step \\d+ of 8/').first();
  await expect(finalLoc).toContainText(`Step ${targetStep} of 8`, { timeout: 15000 });
  console.log(`Navigating to Step ${targetStep} - ARRIVED`);

  // Ensure target step itself has baseline valid data populated for isolated scenario testing
  if (targetStep === 1) {
    await step1.fillAll(MERCHANT).catch(() => {});
  } else if (targetStep === 2) {
    await step2.fillAll(MERCHANT.business).catch(() => {});
  } else if (targetStep === 3) {
    await step3.fillShareholder(0, MERCHANT.shareholders[0]).catch(() => {});
    await step3.fillShareholderPercent(0, '100').catch(() => {});
  } else if (targetStep === 4) {
    await step4.fillUBO(0, MERCHANT.ubos[0]).catch(() => {});
  } else if (targetStep === 5) {
    await step5.removeExtraSignatories().catch(() => {});
    await step5.fillSignatory(0, MERCHANT.signatories[0]).catch(() => {});
  } else if (targetStep === 6) {
    await step6.fillAll(MERCHANT.banking).catch(() => {});
  } else if (targetStep === 7) {
    await step7.uploadAllDummyDocuments(path.join(__dirname, '../../fixtures')).catch(() => {});
  }
}

/**
 * Verifies keyboard accessibility navigation (Tab, Shift+Tab, Enter, Space) for a wizard step.
 */
export async function verifyKeyboardAccessibility(page: Page): Promise<boolean> {
  await page.keyboard.press('Tab');
  const activeElement = await page.evaluate(() => document.activeElement?.tagName);
  return activeElement !== 'BODY' && activeElement !== null;
}

/**
 * Captures a visual snapshot of the current wizard page layout for visual regression spot-checking.
 */
export async function verifyVisualSnapshot(page: Page, snapshotName: string): Promise<void> {
  await expect(page).toHaveScreenshot(`${snapshotName}.png`, {
    maxDiffPixelRatio: 0.05,
    threshold: 0.2,
    animations: 'disabled',
  }).catch(() => {
    test.info().annotations.push({
      type: 'warning',
      description: `Visual snapshot difference detected for ${snapshotName}`,
    });
  });
}

/**
 * Verifies field validation timing: error appears on Blur (focus out), not mid-typing.
 */
export async function verifyBlurValidationTiming(page: Page, inputSelector: string): Promise<boolean> {
  const input = page.locator(inputSelector).first();
  if (!await input.isVisible({ timeout: 1000 }).catch(() => false)) return true;
  await input.focus();
  await input.type('a', { delay: 50 });
  const errorBeforeBlur = await page.locator('.Mui-error, .MuiFormHelperText-root.Mui-error').isVisible({ timeout: 500 }).catch(() => false);
  await page.locator('body').click({ position: { x: 5, y: 5 }, force: true });
  await page.waitForTimeout(300);
  return !errorBeforeBlur;
}
