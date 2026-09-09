import { test as base, Browser, BrowserContext, Page } from '@playwright/test';
import { ROLES } from './merchant-data';

/**
 * WHY: We use a custom fixture that creates ONE browser with THREE isolated
 * browser contexts — one per role. This satisfies the requirement to keep
 * each role's session isolated without launching separate browser instances.
 * Each context has its own cookies/storage, so switching tabs won't log
 * another role out.
 */

type RoleFixtures = {
  onboardingPage: Page;
  compliancePage: Page;
  approverPage: Page;
};

async function loginInContext(
  browser: Browser,
  baseURL: string,
  username: string,
  password: string
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseURL}/login`);
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  return { context, page };
}

export const test = base.extend<RoleFixtures>({
  onboardingPage: async ({ browser }, use) => {
    const baseURL = 'https://idms-uat.qiplus.ae';
    const { context, page } = await loginInContext(
      browser, baseURL, ROLES.onboarding.username, ROLES.onboarding.password
    );
    await use(page);
    await context.close();
  },

  compliancePage: async ({ browser }, use) => {
    const baseURL = 'https://idms-uat.qiplus.ae';
    const { context, page } = await loginInContext(
      browser, baseURL, ROLES.compliance.username, ROLES.compliance.password
    );
    await use(page);
    await context.close();
  },

  approverPage: async ({ browser }, use) => {
    const baseURL = 'https://idms-uat.qiplus.ae';
    const { context, page } = await loginInContext(
      browser, baseURL, ROLES.approver.username, ROLES.approver.password
    );
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
