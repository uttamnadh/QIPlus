import { test, expect } from '@playwright/test';
import * as path from 'path';
import { LoginPage } from '../../pages/login.page';
import { DashboardPage } from '../../pages/dashboard.page';
import { Step1ProfilePage } from '../../pages/wizard/step1-profile.page';
import { Step2BusinessPage } from '../../pages/wizard/step2-business.page';
import { Step3OwnershipPage } from '../../pages/wizard/step3-ownership.page';
import { Step4UBOsPage } from '../../pages/wizard/step4-ubos.page';
import { Step5SignatoriesPage } from '../../pages/wizard/step5-signatories.page';
import { Step6BankingPage } from '../../pages/wizard/step6-banking.page';
import { Step7DocumentsPage } from '../../pages/wizard/step7-documents.page';
import { Step8ReviewPage } from '../../pages/wizard/step8-review.page';
import { MERCHANT, ROLES } from '../../fixtures/merchant-data';
import { navigateToWizardStep } from './field-validation.helper';

test('Test New registration and Steps 1-8 progression', async ({ page }) => {
  page.on('request', req => {
    if (req.url().includes('api') || req.url().includes('merchant')) {
      console.log(`REQ: ${req.method()} ${req.url()}`);
    }
  });
  page.on('response', async res => {
    if (res.url().includes('api') || res.url().includes('merchant')) {
      if (res.status() >= 400) {
        console.log(`RES ${res.status()}: ${res.url()} => ${await res.text().catch(() => '')}`);
      }
    }
  });

  const loginPage = new LoginPage(page);
  await loginPage.navigate();
  await loginPage.login(ROLES.onboarding.username, ROLES.onboarding.password);
  await page.waitForURL('**/dashboard');
  await page.waitForTimeout(1500);

  const dashboard = new DashboardPage(page);
  await dashboard.clickCreateMerchant();
  await page.waitForTimeout(2000);

  const step1 = new Step1ProfilePage(page);
  const vatDocPath = path.resolve(__dirname, '../../fixtures/test-doc.pdf');
  await step1.fillAll(MERCHANT, { vatRegistered: false, vatDocPath });
  await page.waitForTimeout(1000);

  console.log('--- Step 1: Clicking Save & Continue ---');
  await step1.clickSaveAndContinue();
  await page.waitForTimeout(2000);

  // Step 2
  const step2 = new Step2BusinessPage(page);
  await step2.fillAll(MERCHANT.business);
  await step2.clickSaveAndContinue();
  await page.locator('text=/Step 3 of 8/').first().waitFor({ timeout: 5000 });
  console.log('Step 2 saved -> now on Step 3');

  // Step 3
  const step3 = new Step3OwnershipPage(page);
  await step3.fillShareholder(0, MERCHANT.shareholders[0]);
  await step3.fillShareholderPercent(0, '100');
  await step3.clickSaveAndContinue();
  await page.locator('text=/Step 4 of 8/').first().waitFor({ timeout: 5000 });
  console.log('Step 3 saved -> now on Step 4');

  // Step 4
  const step4 = new Step4UBOsPage(page);
  await step4.fillUBO(0, MERCHANT.ubos[0]);
  await step4.clickSaveAndContinue();
  await page.locator('text=/Step 5 of 8/').first().waitFor({ timeout: 5000 });
  console.log('Step 4 saved -> now on Step 5');

  // Step 5
  const step5 = new Step5SignatoriesPage(page);
  await step5.fillSignatory(0, MERCHANT.signatories[0]);
  await step5.clickSaveAndContinue();
  await page.locator('text=/Step 6 of 8/').first().waitFor({ timeout: 5000 });
  console.log('Step 5 saved -> now on Step 6');

  // Step 6
  const step6 = new Step6BankingPage(page);
  await step6.fillAll(MERCHANT.banking);
  await step6.clickSaveAndContinue();
  await page.locator('text=/Step 7 of 8/').first().waitFor({ timeout: 5000 });
  console.log('Step 6 saved -> now on Step 7');

  // Step 7
  const step7 = new Step7DocumentsPage(page);
  await step7.uploadAllDummyDocuments(path.join(__dirname, '../../fixtures'));
  await step7.clickSaveAndContinue();
  await page.locator('text=/Step 8 of 8/').first().waitFor({ timeout: 5000 });
  console.log('Step 7 saved -> now on Step 8');

  // Step 8
  const step8 = new Step8ReviewPage(page);
  await step8.expectStep(8);
  console.log('All Steps 1 to 8 reachable successfully!');
});




