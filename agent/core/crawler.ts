import * as fs from 'fs';
import * as path from 'path';
import { Page } from '@playwright/test';
import { Bug, FormInfo, PageNode, RoleName } from '../types';
import { BugDetector } from './detector';
import { FormFuzzer } from './form-fuzzer';
import { A11yScanner } from './a11y-scanner';
import { withRetry } from './resilience';

export class Crawler {
  private visitedUrls = new Set<string>();
  private pageGraph: PageNode[] = [];
  private maxPages: number;
  private maxDepth: number;
  private screenshotDir: string;

  constructor(maxPages = 25, maxDepth = 4, outputDir = 'agent-results') {
    this.maxPages = maxPages;
    this.maxDepth = maxDepth;
    this.screenshotDir = path.resolve(process.cwd(), outputDir, 'screenshots');
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  /**
   * Crawl app starting from /dashboard using Breadth-First Search
   */
  async crawl(
    page: Page,
    role: RoleName,
    fuzzer: FormFuzzer,
    detector: BugDetector,
    enableA11y = true,
    enableFuzzing = true
  ): Promise<PageNode[]> {
    this.visitedUrls.clear();
    this.pageGraph = [];

    const queue: Array<{ url: string; depth: number }> = [{ url: '/dashboard', depth: 0 }];

    console.log(`\n🔍 [Crawler] Starting live exploration for ${role}...`);

    while (queue.length > 0 && this.visitedUrls.size < this.maxPages) {
      const current = queue.shift()!;
      const cleanPath = current.url.split('?')[0];

      if (this.visitedUrls.has(cleanPath) || this.isSkipUrl(current.url)) {
        continue;
      }
      this.visitedUrls.add(cleanPath);

      console.log(`   🌐 Crawling [${this.visitedUrls.size}/${this.maxPages}] ${current.url} (depth ${current.depth})...`);

      const start = Date.now();
      let navigationSucceeded = false;

      try {
        await withRetry(
          async () => {
            await page.goto(current.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
          },
          { maxRetries: 2, initialDelayMs: 1500 },
          `Navigate to ${current.url}`
        );
        navigationSucceeded = true;
      } catch (err: any) {
        console.warn(`   ⚠️ Navigation to ${current.url} failed: ${err.message?.split('\n')[0]}`);
      }

      const loadTimeMs = Date.now() - start;

      if (!navigationSucceeded) continue;

      // Small stabilization wait
      await page.waitForTimeout(1000);

      // 1. Capture Screenshot
      const screenshotPath = await this.captureScreenshot(page, role, cleanPath);

      // 2. Health & Visual bug checks
      await detector.checkPageHealth(current.url, loadTimeMs);

      // 3. Discover links on page
      const discoveredLinks = await this.extractLinks(page);

      // 4. Broken Link Checker (§30)
      await this.checkBrokenLinks(page, current.url, discoveredLinks, role, detector);

      // 5. Discover and fuzz forms
      let formsFound: FormInfo[] = [];
      if (enableFuzzing) {
        formsFound = await fuzzer.discoverForms(page);
        for (const form of formsFound) {
          await fuzzer.fuzzForm(page, form, role, detector);
        }
      }

      // 6. Accessibility Scan (§20)
      if (enableA11y) {
        const a11yBugs = await A11yScanner.scan(page, role, current.url);
        for (const ab of a11yBugs) {
          detector.recordBug(ab);
        }
      }

      // Record in page graph
      this.pageGraph.push({
        url: current.url,
        path: cleanPath,
        title: await page.title().catch(() => ''),
        linksFound: discoveredLinks,
        formsFound,
        visited: true,
        screenshotPath,
        loadTimeMs,
        consoleErrors: [...detector.getConsoleErrors()],
        networkErrors: [...detector.getNetworkErrors()],
      });

      // Enqueue next level links if within maxDepth
      if (current.depth < this.maxDepth) {
        for (const link of discoveredLinks) {
          const norm = link.split('?')[0];
          if (!this.visitedUrls.has(norm) && !queue.some(q => q.url.split('?')[0] === norm)) {
            queue.push({ url: link, depth: current.depth + 1 });
          }
        }
      }
    }

    console.log(`✅ [Crawler] Explored ${this.pageGraph.length} pages for ${role}.`);
    return this.pageGraph;
  }

  /**
   * Extract internal navigable links
   */
  private async extractLinks(page: Page): Promise<string[]> {
    try {
      const links = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href], [role="menuitem"], .MuiListItem-root[href]'));
        const hrefs: string[] = [];

        for (const el of anchors) {
          let href = el.getAttribute('href') || el.getAttribute('data-href');
          if (href && (href.startsWith('/') || href.includes(window.location.host))) {
            href = href.replace(/https?:\/\/[^/]+/, '');
            if (!hrefs.includes(href)) hrefs.push(href);
          }
        }
        return hrefs;
      });

      return links.filter(l => !this.isSkipUrl(l));
    } catch {
      return [];
    }
  }

  /**
   * Section 30: Broken Link Checker
   */
  private async checkBrokenLinks(page: Page, currentUrl: string, links: string[], role: RoleName, detector: BugDetector): Promise<void> {
    const sampleLinks = links.slice(0, 10); // Check top 10 links per page to keep crawl fast

    for (const href of sampleLinks) {
      if (href.includes('#') || href.startsWith('javascript:') || href.includes('mailto:')) continue;

      try {
        const res = await page.request.get(href, { timeout: 4000 }).catch(() => null);
        if (res) {
          const status = res.status();
          if (status === 404) {
            detector.recordBug({
              id: '',
              severity: 'Medium',
              category: 'functional',
              title: `Broken Link: ${href} returned 404 on ${currentUrl}`,
              description: `Navigational link pointing to "${href}" from "${currentUrl}" resulted in HTTP 404 Not Found.`,
              stepsToReproduce: [`Open ${currentUrl}`, `Click link to ${href}`],
              expected: 'Page loads with HTTP 200',
              actual: `Received HTTP 404 Not Found`,
              url: currentUrl,
              role,
              httpStatus: 404,
              timestamp: new Date().toISOString(),
            });
          }
        }
      } catch {}
    }
  }

  private isSkipUrl(url: string): boolean {
    const lower = url.toLowerCase();
    return (
      lower.includes('/logout') ||
      lower.includes('/login') ||
      lower.includes('/auth') ||
      lower.includes('/api/') ||
      lower.endsWith('.png') ||
      lower.endsWith('.pdf') ||
      lower.endsWith('.svg') ||
      lower.endsWith('.ico')
    );
  }

  private async captureScreenshot(page: Page, role: RoleName, cleanPath: string): Promise<string> {
    try {
      const roleDir = path.join(this.screenshotDir, role);
      if (!fs.existsSync(roleDir)) {
        fs.mkdirSync(roleDir, { recursive: true });
      }
      const safeName = cleanPath.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40) || 'root';
      const filename = `${safeName}.png`;
      const fullPath = path.join(roleDir, filename);

      await page.screenshot({ path: fullPath, fullPage: false }).catch(() => {});
      return path.join('screenshots', role, filename);
    } catch {
      return '';
    }
  }
}
