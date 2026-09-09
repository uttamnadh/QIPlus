const { chromium } = require('@playwright/test');

(async () => {
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto('https://idms-uat.qiplus.ae/login');
    await page.fill('input[name="username"]', 'Sukesh');
    await page.fill('input[name="password"]', 'Qa@12345');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    await page.click('text="Create merchant"');
    await page.waitForTimeout(2000);

    // Fill Step 1
    await page.fill('input[name="profile.tradeName"]', 'Apex Global Trading');
    await page.fill('input[name="profile.legalName"]', 'Apex Global Trading LLC');
    await page.fill('input[name="profile.dateOfIncorporation"]', '15/01/2020');
    
    // Select Legal Form: click dropdown
    console.log('Selecting legal form...');
    const legalFormInput = page.locator('input[name="profile.legalForm"]');
    await legalFormInput.locator('..').click();
    await page.waitForTimeout(500);
    await page.click('li[role="option"]:has-text("LLC")');

    await page.fill('input[name="profile.trn"]', '100123456700003');
    await page.fill('input[name="profile.websiteUrl"]', 'https://apexglobal.ae');
    await page.fill('input[name="profile.primaryContactName"]', 'John Smith');
    await page.fill('input[name="profile.primaryContactPosition"]', 'Director');
    await page.fill('input[name="profile.primaryContactEmail"]', 'john@apexglobal.ae');
    
    // Phone with international format
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill('+971501234567');

    // Address
    await page.fill('input[name="registeredAddress.floorOffice"]', 'Suite 101, Tower A');
    await page.fill('input[name="registeredAddress.areaDistrict"]', 'Business Bay');
    
    // Emirate
    console.log('Selecting Emirate...');
    const emirateInput = page.locator('input[name="registeredAddress.emirateCity"]');
    await emirateInput.locator('..').click();
    await page.waitForTimeout(500);
    await page.click('li[role="option"]:has-text("Dubai")');

    // Licensing Authority
    console.log('Selecting Licensing Auth...');
    const authInput = page.locator('input[name="licence.licensingAuthority"]');
    await authInput.locator('..').click();
    await page.waitForTimeout(500);
    await page.click('li[role="option"]:has-text("DET")');

    await page.fill('input[name="licence.tradeLicenceNumber"]', 'TL123456');
    await page.fill('input[name="licence.issueDate"]', '01/01/2022');
    await page.fill('input[name="licence.expiryDate"]', '01/01/2028');

    // Jurisdiction
    console.log('Selecting Jurisdiction...');
    const jurisInput = page.locator('input[name="licence.jurisdiction"]');
    await jurisInput.locator('..').click();
    await page.waitForTimeout(500);
    await page.click('li[role="option"]:has-text("Dubai")');

    await page.fill('textarea[name="licence.businessActivities"]', 'General Trading & E-Commerce');

    console.log('Clicking Save & continue...');
    await page.click('button:has-text("Save & continue")');
    await page.waitForTimeout(3000);

    console.log('Current URL:', page.url());
    const rootText = await page.locator('#root').innerText();
    console.log('Page header after save:', rootText.substring(0, 400));

    const remainingErrors = await page.locator('.Mui-error, p.MuiFormHelperText-root').allInnerTexts();
    console.log('Remaining errors if any:', remainingErrors);

    await browser.close();
  } catch (err) {
    console.error('ERROR OCCURRED:', err);
  }
})();
