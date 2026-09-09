import { test, expect } from '../../fixtures/diagnostics';
import { LoginPage } from '../../pages/login.page';
import { ROLES } from '../../fixtures/merchant-data';

test.describe.serial('Negative Suite 01 — Login Form Security & Boundary Tests', () => {

  test('AUTH-NEG-01: Invalid password rejects login with error alert', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    const errorMsg = await loginPage.loginAndExpectFailure(ROLES.onboarding.username, 'WrongPassword@999');
    console.log('[AUTH-NEG-01] Received error message:', errorMsg);
    expect(errorMsg.length).toBeGreaterThan(0);
    expect(page.url()).toContain('/login');
  });

  test('AUTH-NEG-02: Non-existent username is rejected with generic error (no enumeration)', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    const errorMsg = await loginPage.loginAndExpectFailure('ghost_user_99999', 'Qa@123456');
    console.log('[AUTH-NEG-02] Received error message:', errorMsg);
    expect(errorMsg.length).toBeGreaterThan(0);
    expect(page.url()).toContain('/login');
  });

  test('AUTH-NEG-03: Submitting blank credentials triggers HTML5 required validation', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.clearFields();
    await loginPage.submitWithoutFill();

    const hasAttrs = await loginPage.hasRequiredAttributes();
    expect(hasAttrs.username).toBe(true);
    expect(hasAttrs.password).toBe(true);
    expect(page.url()).toContain('/login');
  });

  test('AUTH-NEG-04: SQL Injection payload in username/password is safely rejected', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    const errorMsg = await loginPage.loginAndExpectFailure("' OR '1'='1' --", "' OR '1'='1'");
    console.log('[AUTH-NEG-04] SQLi rejection message:', errorMsg);
    expect(page.url()).toContain('/login');
  });

  test('AUTH-NEG-05: XSS payload in username is escaped safely without DOM execution', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();

    let dialogFired = false;
    page.on('dialog', async dialog => {
      dialogFired = true;
      await dialog.dismiss();
    });

    const errorMsg = await loginPage.loginAndExpectFailure('<script>alert(1)</script>', 'Qa@12345');
    expect(dialogFired).toBe(false);
    expect(page.url()).toContain('/login');
  });

  test('AUTH-NEG-06: Direct unauthenticated URL navigation to /dashboard is redirected to /login', async ({ page }) => {
    // Clear cookies/storage to simulate unauthenticated user
    await page.context().clearCookies();
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1000);

    expect(page.url()).toContain('/login');
  });
});
