const { chromium } = require('@playwright/test');

(async () => {
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Listen for API responses
    page.on('response', async (response) => {
      if (response.url().includes('merchant') || response.url().includes('api')) {
        console.log(`API Response: ${response.status()} ${response.url()}`);
        try {
          const body = await response.text();
          console.log('  Body:', body.substring(0, 300));
        } catch(e) {}
      }
    });

    await page.goto('https://idms-uat.qiplus.ae/login');
    await page.fill('input[name="username"]', 'Sukesh');
    await page.fill('input[name="password"]', 'Qa@12345');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    await page.click('text="Create merchant"');
    await page.waitForTimeout(2000);

    // Helper: fill MUI DatePicker
    const fillDate = async (inputName, day, month, year) => {
      const dateGroup = page.locator(`input[name="${inputName}"]`)
        .locator('xpath=ancestor::div[@role="group"]');
      await dateGroup.locator('[role="spinbutton"][aria-label="Day"]').click({ force: true });
      await page.waitForTimeout(100);
      await page.keyboard.type(day, { delay: 50 });
      await page.waitForTimeout(200);
      await dateGroup.locator('[role="spinbutton"][aria-label="Month"]').click({ force: true });
      await page.waitForTimeout(100);
      await page.keyboard.type(month, { delay: 50 });
      await page.waitForTimeout(200);
      await dateGroup.locator('[role="spinbutton"][aria-label="Year"]').click({ force: true });
      await page.waitForTimeout(100);
      await page.keyboard.type(year, { delay: 50 });
      await page.waitForTimeout(200);
      await page.locator('body').click({ position: { x: 5, y: 5 }, force: true });
      await page.waitForTimeout(100);
    };

    const selectDropdown = async (inputName, optionText) => {
      await page.locator(`input[name="${inputName}"]`).locator('..').click();
      await page.waitForTimeout(400);
      await page.click(`[role="option"]:has-text("${optionText}")`);
      await page.waitForTimeout(300);
    };

    // Fill Step 1
    await page.fill('input[name="profile.tradeName"]', 'Apex Global Trading');
    await page.fill('input[name="profile.legalName"]', 'Apex Global Trading LLC');
    await fillDate('profile.dateOfIncorporation', '15', '01', '2020');
    await selectDropdown('profile.legalForm', 'LLC');
    await page.fill('input[name="profile.trn"]', '100123456700003');
    await page.fill('input[name="profile.websiteUrl"]', 'https://apexglobal.ae');
    await page.fill('input[name="profile.primaryContactName"]', 'John Smith');
    await page.fill('input[name="profile.primaryContactPosition"]', 'Director');
    await page.fill('input[name="profile.primaryContactEmail"]', 'john@apexglobal.ae');
    await page.locator('input[type="tel"]').click();
    await page.locator('input[type="tel"]').fill('');
    await page.keyboard.type('501234567');
    await page.fill('input[name="registeredAddress.floorOffice"]', 'Suite 101, Tower A');
    await page.fill('input[name="registeredAddress.areaDistrict"]', 'Business Bay');
    await selectDropdown('registeredAddress.emirateCity', 'Dubai');
    await selectDropdown('licence.licensingAuthority', 'DED');
    await page.fill('input[name="licence.tradeLicenceNumber"]', 'TL123456');
    await fillDate('licence.issueDate', '01', '06', '2024');
    await fillDate('licence.expiryDate', '01', '06', '2028');
    await selectDropdown('licence.jurisdiction', 'Dubai');
    await page.fill('textarea[name="licence.businessActivities"]', 'General Trading & E-Commerce');

    console.log('Clicking Save & continue Step 1...');
    await page.click('button:has-text("Save & continue")');

    // Wait longer for API call
    await page.waitForTimeout(5000);

    // Check for snackbar/toast messages  
    const toasts = await page.locator('.MuiSnackbar-root, .MuiAlert-root, [role="alert"]').allInnerTexts();
    console.log('Toast/Alert messages:', toasts);

    // Check current step
    const stepText = await page.locator('text=/Step \\d+ of \\d+/').innerText();
    console.log('Current step:', stepText);
    console.log('Current URL:', page.url());

    await browser.close();
  } catch (err) {
    console.error('ERROR:', err.message);
  }
})();
