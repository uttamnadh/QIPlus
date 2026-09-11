import { Browser, BrowserContext, Page } from '@playwright/test';
import { ExplorationResult, PageNode, RoleCredentials, RoleName } from '../types';
import { LoginPage } from '../../pages/login.page';
import { Crawler } from '../core/crawler';
import { FormFuzzer } from '../core/form-fuzzer';
import { BugDetector } from '../core/detector';
import { ApiProber } from '../core/api-prober';

export abstract class RoleStrategy {
  abstract roleName: RoleName;
  protected credentials: RoleCredentials;

  constructor(credentials: RoleCredentials) {
    this.credentials = credentials;
  }

  /**
   * Authenticate role using existing LoginPage POM and TOTP helper
   */
  async login(page: Page): Promise<boolean> {
    try {
      console.log(`🔑 [Login] Authenticating as ${this.credentials.displayName} (${this.credentials.username})...`);
      const loginPage = new LoginPage(page);
      await loginPage.navigate();
      await loginPage.login(
        this.credentials.username,
        this.credentials.password,
        this.credentials.totpSecret
      );
      await page.waitForURL(url => !url.href.includes('/login'), { timeout: 15000 });
      console.log(`✅ [Login] Successfully authenticated as ${this.credentials.displayName}`);
      return true;
    } catch (err: any) {
      console.error(`❌ [Login] Authentication failed for ${this.credentials.displayName}:`, err.message?.split('\n')[0]);
      return false;
    }
  }

  /**
   * Run standard crawl + role-specific exploration
   */
  async explore(
    page: Page,
    crawler: Crawler,
    fuzzer: FormFuzzer,
    detector: BugDetector,
    enableA11y = true,
    enableFuzzing = true
  ): Promise<ExplorationResult> {
    const startTime = Date.now();
    detector.startMonitoring();

    const loggedIn = await this.login(page);
    if (!loggedIn) {
      return {
        role: this.roleName,
        pagesVisited: 0,
        formsFound: 0,
        formsFuzzed: 0,
        apisDiscovered: 0,
        apisProbed: 0,
        bugsFound: detector.getBugs(),
        durationMs: Date.now() - startTime,
        pageGraph: [],
      };
    }

    // 1. General Live Crawl (BFS)
    const pageGraph = await crawler.crawl(
      page,
      this.roleName,
      fuzzer,
      detector,
      enableA11y,
      enableFuzzing
    );

    // 2. Custom Role-Specific Explorations
    await this.runCustomExploration(page, detector);

    // 3. Session Expiry Test (§29)
    await detector.testSessionExpiry();

    return {
      role: this.roleName,
      pagesVisited: pageGraph.length,
      formsFound: pageGraph.reduce((acc, p) => acc + p.formsFound.length, 0),
      formsFuzzed: pageGraph.reduce((acc, p) => acc + p.formsFound.length, 0),
      apisDiscovered: detector.getDiscoveredEndpoints().length,
      apisProbed: 0,
      bugsFound: detector.getBugs(),
      durationMs: Date.now() - startTime,
      pageGraph,
    };
  }

  /**
   * Role-specific custom explorations (overridden by sub-classes)
   */
  protected abstract runCustomExploration(page: Page, detector: BugDetector): Promise<void>;
}
