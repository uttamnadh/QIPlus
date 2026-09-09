const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://idms-uat.qiplus.ae/login');
  await page.fill('input[name="username"]', 'Sukesh');
  await page.fill('input[name="password"]', 'Qa@12345');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  await page.click('text="Create merchant"');
  await page.waitForTimeout(2000);

  const selectDropdown = async (inputName, optionText) => {
    const input = page.locator(`input[name="${inputName}"]`);
    await input.locator('..').click();
    await page.waitForTimeout(400);
    await page.click(`[role="option"]:has-text("${optionText}"), li:has-text("${optionText}")`);
    await page.waitForTimeout(300);
  };

  await page.fill('input[name="profile.tradeName"]', 'Apex Global Trading');
  await page.fill('input[name="profile.legalName"]', 'Apex Global Trading LLC');
  await page.fill('input[name="profile.dateOfIncorporation"]', '15/01/2020');
  await selectDropdown('profile.legalForm', 'LLC');
  await page.fill('input[name="profile.trn"]', '100123456700003');
  await page.fill('input[name="profile.websiteUrl"]', 'https://apexglobal.ae');
  await page.fill('input[name="profile.primaryContactName"]', 'John Smith');
  await page.fill('input[name="profile.primaryContactPosition"]', 'Director');
  await page.fill('input[name="profile.primaryContactEmail"]', 'john@apexglobal.ae');
  await page.locator('input[type="tel"]').fill('+971501234567');
  await page.fill('input[name="registeredAddress.floorOffice"]', 'Suite 101, Tower A');
  await page.fill('input[name="registeredAddress.areaDistrict"]', 'Business Bay');
  await selectDropdown('registeredAddress.emirateCity', 'Dubai');
  await selectDropdown('licence.licensingAuthority', 'DED');
  await page.fill('input[name="licence.tradeLicenceNumber"]', 'TL123456');
  await page.fill('input[name="licence.issueDate"]', '01/01/2022');
  await page.fill('input[name="licence.expiryDate"]', '01/01/2028');
  await selectDropdown('licence.jurisdiction', 'Dubai');
  await page.fill('textarea[name="licence.businessActivities"]', 'General Trading & E-Commerce');

  await page.click('button:has-text("Save & continue")');
  await page.waitForTimeout(1000);

  const errors = await page.locator('.Mui-error, p.MuiFormHelperText-root').allInnerTexts();
  console.log('Errors remaining after submit:', errors);

  await browser.close();
})();
