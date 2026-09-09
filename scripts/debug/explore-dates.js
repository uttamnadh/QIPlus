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

    // ---- APPROACH: Click the Day spinbutton directly ----
    // The date picker has role="spinbutton" spans: Day, Month, Year
    // They are contenteditable and accept keyboard input
    
    // First find ALL day spinbuttons to understand the structure
    const allSpinbuttons = await page.locator('[role="spinbutton"]').all();
    console.log('All spinbuttons count:', allSpinbuttons.length);
    for (const sb of allSpinbuttons) {
      const label = await sb.getAttribute('aria-label');
      const text = await sb.innerText();
      console.log(`  Spinbutton: aria-label="${label}", text="${text}"`);
    }

    // Try filling first date - Date of Incorporation
    // Get the group container for this specific date field
    const dateGroup = page.locator('input[name="profile.dateOfIncorporation"]')
      .locator('xpath=ancestor::div[@role="group"]');
    
    const daySpinner = dateGroup.locator('[role="spinbutton"][aria-label="Day"]');
    const monthSpinner = dateGroup.locator('[role="spinbutton"][aria-label="Month"]');
    const yearSpinner = dateGroup.locator('[role="spinbutton"][aria-label="Year"]');

    console.log('\nClicking Day spinner...');
    await daySpinner.click({ force: true });
    await page.waitForTimeout(200);
    await page.keyboard.type('15');
    await page.waitForTimeout(200);

    console.log('Clicking Month spinner...');
    await monthSpinner.click({ force: true });
    await page.waitForTimeout(200);
    await page.keyboard.type('01');
    await page.waitForTimeout(200);

    console.log('Clicking Year spinner...');
    await yearSpinner.click({ force: true });
    await page.waitForTimeout(200);
    await page.keyboard.type('2020');
    await page.waitForTimeout(300);

    // Check result
    const dateVal = await page.locator('input[name="profile.dateOfIncorporation"]').inputValue();
    console.log('Hidden input value after typing:', dateVal);
    
    const dayText = await daySpinner.innerText();
    const monthText = await monthSpinner.innerText();
    const yearText = await yearSpinner.innerText();
    console.log(`Visible date: ${dayText}/${monthText}/${yearText}`);

    // ---- Now try the phone field ----
    console.log('\n=== PHONE FIELD ===');
    // Check if there's a country code selector
    const flagBtn = page.locator('button[aria-label="Open flags menu"]');
    if (await flagBtn.count() > 0) {
      console.log('Flag button found - phone has country code selector');
    }
    
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.click();
    await page.waitForTimeout(200);
    await phoneInput.fill('');
    await page.keyboard.type('501234567');
    await page.waitForTimeout(300);
    const phoneVal = await phoneInput.inputValue();
    console.log('Phone value:', phoneVal);

    await browser.close();
  } catch (err) {
    console.error('ERROR:', err.message);
  }
})();
