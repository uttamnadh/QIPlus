import * as fs from 'fs';
import * as path from 'path';
import { Browser, Page } from '@playwright/test';
import { Bug, RoleName, ViewportConfig } from '../types';
import { LoginPage } from '../../pages/login.page';
import { BugDetector } from './detector';

export class MobileViewportTester {
  /**
   * Run targeted mobile viewport checks on key pages
   */
  static async testViewports(
    browser: Browser,
    role: RoleName,
    credentials: { username: string; password: string; totpSecret?: string },
    viewports: ViewportConfig[],
    pagesToTest = ['/dashboard', '/merchants', '/merchants/new']
  ): Promise<Bug[]> {
    const bugs: Bug[] = [];
    const mobileDir = path.resolve(process.cwd(), 'agent-results', 'screenshots', 'mobile');
    if (!fs.existsSync(mobileDir)) {
      fs.mkdirSync(mobileDir, { recursive: true });
    }

    console.log(`\n📱 [MobileTester] Testing ${viewports.length} mobile viewports on key pages...`);

    for (const vp of viewports) {
      try {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          deviceScaleFactor: vp.deviceScaleFactor || 2,
          isMobile: true,
          hasTouch: true,
        });

        const page = await context.newPage();
        const loginPage = new LoginPage(page);
        await loginPage.login(credentials.username, credentials.password, credentials.totpSecret);

        for (const urlPath of pagesToTest) {
          try {
            await page.goto(urlPath, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(1000);

            // 1. Horizontal Scroll Overflow Check
            const hasHorizontalScroll = await page.evaluate(() => {
              return document.documentElement.scrollWidth > window.innerWidth + 2;
            }).catch(() => false);

            if (hasHorizontalScroll) {
              bugs.push({
                id: `MOB-${Math.floor(100 + Math.random() * 900)}`,
                severity: 'Medium',
                category: 'visual-glitch',
                title: `Mobile Horizontal Overflow on ${urlPath} (${vp.name} - ${vp.width}px)`,
                description: `On viewport ${vp.name} (${vp.width}x${vp.height}), page contents horizontally overflow, breaking mobile layout.`,
                stepsToReproduce: [
                  `Set mobile emulation viewport: ${vp.width}x${vp.height} (${vp.name})`,
                  `Navigate to ${urlPath}`,
                  `Notice horizontal scrolling behavior`,
                ],
                expected: 'Page contents wrap cleanly within viewport width',
                actual: 'Horizontal overflow forces lateral scrolling',
                url: urlPath,
                role,
                timestamp: new Date().toISOString(),
              });
            }

            // 2. Tap Target Sizes (< 44px)
            const smallTargets = await page.evaluate(() => {
              const interactive = document.querySelectorAll('button, a, input, select');
              let small = 0;
              for (const el of Array.from(interactive)) {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && (rect.width < 40 || rect.height < 40)) {
                  small++;
                }
              }
              return small;
            }).catch(() => 0);

            if (smallTargets > 5) {
              bugs.push({
                id: `A11Y-${Math.floor(100 + Math.random() * 900)}`,
                severity: 'Low',
                category: 'accessibility',
                title: `${smallTargets} touch targets under 44x44px on ${urlPath} (${vp.name})`,
                description: `Mobile accessibility guidelines (WCAG / Apple HIG) recommend minimum touch targets of 44x44px. Found ${smallTargets} undersized interactive targets.`,
                stepsToReproduce: [
                  `Emulate ${vp.name} (${vp.width}x${vp.height})`,
                  `Inspect interactive buttons and links on ${urlPath}`,
                ],
                expected: 'Touch targets at least 44x44px for reliable mobile tapping',
                actual: `${smallTargets} elements are undersized`,
                url: urlPath,
                role,
                timestamp: new Date().toISOString(),
              });
            }

            // Screenshot
            const safeName = `${vp.name.replace(/\s+/g, '_')}_${urlPath.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
            await page.screenshot({ path: path.join(mobileDir, safeName), fullPage: false }).catch(() => {});
          } catch (e) {}
        }

        await context.close();
      } catch (e) {}
    }

    return bugs;
  }
}
