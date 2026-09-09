import { Page, expect } from '@playwright/test';
import { generateTOTP } from '../fixtures/totp.helper';
import { ROLES } from '../fixtures/merchant-data';

/**
 * Page Object for the Login Page.
 * WHY: Encapsulates authentication interactions across roles with reliable navigation,
 * automated MFA registration, and real-time TOTP generation.
 */
export class LoginPage {
  constructor(private page: Page) {}

  /** Navigate to the login page and wait for form readiness. */
  async navigate() {
    await this.page.goto('/login', { waitUntil: 'domcontentloaded' }).catch(() => {});
    const input = this.page.locator('input[name="username"]');
    if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
      return;
    }
    // If already logged in (redirected to dashboard), clear cookies to get a clean login form
    if (this.page.url().includes('/dashboard') || this.page.url().includes('/merchants')) {
      await this.page.context().clearCookies();
      await this.page.goto('/login', { waitUntil: 'domcontentloaded' }).catch(() => {});
    }
    await input.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  }

  /** Fill credentials, handle MFA TOTP verification (or setup) if required, and submit. */
  async login(username: string, password: string, totpSecret?: string) {
    const input = this.page.locator('input[name="username"]');
    if (!(await input.isVisible({ timeout: 2000 }).catch(() => false))) {
      await this.navigate();
    }
    if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.page.fill('input[name="username"]', username);
      await this.page.fill('input[name="password"]', password);
      await this.page.click('button[type="submit"]');

      // Check if 2-step verification or Authenticator setup is requested
      const mfaPrompt = this.page.locator('text=/Two-step verification|Authenticator|Set up your authenticator/i').first();
      const digitInput = this.page.locator('input[aria-label*="Digit 1"], input[aria-label*="Digit"]').first();

      const isMFA = await Promise.race([
        mfaPrompt.waitFor({ state: 'visible', timeout: 2500 }).then(() => true).catch(() => false),
        digitInput.waitFor({ state: 'visible', timeout: 2500 }).then(() => true).catch(() => false),
      ]);

      if (isMFA) {
        let secret = totpSecret || '';

        // If on first-time setup screen and no secret passed, extract it directly from the UI
        const isSetup = await this.page.locator('text=/Set up your authenticator/i').isVisible({ timeout: 1000 }).catch(() => false);
        if (isSetup && !secret) {
          const keyContainer = this.page.locator('text=/Can\'t scan/i').locator('xpath=..');
          const containerText = await keyContainer.innerText().catch(() => '');
          const match = containerText.match(/([A-Z2-7\s]{16,})/);
          if (match) {
            const extracted = match[1].replace(/Can't scan\? Enter this key manually/i, '').replace(/\s+/g, '').trim();
            if (extracted.length >= 16) secret = extracted;
          }
        }

        if (!secret) {
          if (username.toLowerCase().includes('bhanu') || username.toLowerCase().includes('compliance')) {
            secret = ROLES.compliance.totpSecret;
          } else if (username.toLowerCase().includes('uttam') || username.toLowerCase().includes('approver')) {
            secret = ROLES.approver.totpSecret;
          } else if (username.toLowerCase().includes('shankar') || username.toLowerCase().includes('user') || username.toLowerCase().includes('admin')) {
            secret = ROLES.userManagement.totpSecret;
          }
        }

        if (secret) {
          const otp = generateTOTP(secret);
          const digitInputs = await this.page.locator('input[aria-label*="Digit"]').all();
          if (digitInputs.length === 6) {
            for (let i = 0; i < 6; i++) {
              await digitInputs[i].fill(otp[i]);
            }
          } else {
            await digitInput.fill(otp);
          }

          const verifyBtn = this.page.locator('button:has-text("Verify"), button:has-text("Confirm")').first();
          if (await verifyBtn.isEnabled({ timeout: 1500 }).catch(() => false)) {
            await verifyBtn.click();
          }

          // If setup just completed (shows "Authenticator registered" and "Back to sign in"), re-login
          const backToSignIn = this.page.locator('button:has-text("Back to sign in")');
          if (await backToSignIn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await backToSignIn.click();
            await this.page.waitForTimeout(500);
            await this.login(username, password, secret);
            return;
          }
        }
      }

      await this.page.waitForURL(url => !url.href.includes('/login'), { timeout: 15000 }).catch(() => {});
    }
  }

  /** Complete MFA step manually with given TOTP secret if on verification screen. */
  async handleMFA(secret: string) {
    const digitInput = this.page.locator('input[aria-label*="Digit 1"], input[aria-label*="Digit"]').first();
    if (await digitInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const otp = generateTOTP(secret);
      const digitInputs = await this.page.locator('input[aria-label*="Digit"]').all();
      if (digitInputs.length === 6) {
        for (let i = 0; i < 6; i++) {
          await digitInputs[i].fill(otp[i]);
        }
      } else {
        await digitInput.fill(otp);
      }

      const verifyBtn = this.page.locator('button:has-text("Verify"), button:has-text("Confirm")').first();
      if (await verifyBtn.isEnabled({ timeout: 1500 }).catch(() => false)) {
        await verifyBtn.click();
      }
      await this.page.waitForURL(url => !url.href.includes('/login'), { timeout: 15000 }).catch(() => {});
    }
  }

  /** Assert error alert text. */
  async expectError(errorMessage: string) {
    const alert = this.page.locator('.MuiAlert-root, [role="alert"]');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(errorMessage);
  }

  // ── Negative testing helpers ────────────────────────────────────

  /**
   * Fill credentials, submit, and assert login FAILS (stays on /login).
   * Returns the error message text for further assertions (e.g., enumeration checks).
   */
  async loginAndExpectFailure(username: string, password: string): Promise<string> {
    await this.login(username, password);
    // Wait a moment for any redirect or error
    await this.page.waitForTimeout(1500);
    // Must still be on /login
    expect(this.page.url()).toContain('/login');
    return this.getErrorMessage();
  }

  /** Get the error message text without asserting on specific content. */
  async getErrorMessage(): Promise<string> {
    const alert = this.page.locator('.MuiAlert-root, [role="alert"]');
    if (await alert.isVisible({ timeout: 3000 }).catch(() => false)) {
      return alert.innerText();
    }
    return '';
  }

  /** Clear both username and password fields. */
  async clearFields() {
    await this.page.fill('input[name="username"]', '');
    await this.page.fill('input[name="password"]', '');
  }

  /** Click submit without filling anything (test HTML5 required validation). */
  async submitWithoutFill() {
    await this.page.click('button[type="submit"]');
    await this.page.waitForTimeout(500);
  }

  /** Check if the login form has HTML5 'required' attributes. */
  async hasRequiredAttributes(): Promise<{ username: boolean; password: boolean }> {
    const usernameRequired = await this.page.locator('input[name="username"]').getAttribute('required');
    const passwordRequired = await this.page.locator('input[name="password"]').getAttribute('required');
    return {
      username: usernameRequired !== null,
      password: passwordRequired !== null,
    };
  }
}
