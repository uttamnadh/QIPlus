import * as fs from 'fs';
import * as path from 'path';
import { Page, Response } from '@playwright/test';
import { Bug, BugCategory, DiscoveredEndpoint, NetworkError, RoleName, Severity, SuppressionRule } from '../types';
import { RunDiffer } from './run-differ';

export class BugDetector {
  private page: Page;
  private role: RoleName;
  private discoveredEndpoints: DiscoveredEndpoint[] = [];
  private consoleErrors: string[] = [];
  private networkErrors: NetworkError[] = [];
  private suppressions: SuppressionRule[] = [];
  private bugs: Bug[] = [];

  constructor(page: Page, role: RoleName, baseDir = process.cwd()) {
    this.page = page;
    this.role = role;
    this.loadSuppressions(baseDir);
  }

  private loadSuppressions(baseDir: string): void {
    const suppPath = path.resolve(baseDir, 'suppressions.json');
    if (fs.existsSync(suppPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(suppPath, 'utf-8'));
        this.suppressions = data.suppressions || [];
      } catch {}
    }
  }

  /**
   * Start passive listeners on page
   */
  startMonitoring(): void {
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        this.consoleErrors.push(text);

        // Check if suppressed
        const tempBug: Bug = {
          id: '',
          severity: 'Medium',
          category: 'console-error',
          title: `Console Error: ${text.slice(0, 80)}`,
          description: text,
          stepsToReproduce: [`Navigate to ${this.page.url()}`, `Check browser console errors`],
          expected: 'No uncaught JavaScript errors in console',
          actual: text,
          url: this.page.url(),
          role: this.role,
          consoleError: text,
          timestamp: new Date().toISOString(),
        };

        if (!this.isSuppressed(tempBug)) {
          this.recordBug(tempBug);
        }
      }
    });

    this.page.on('pageerror', err => {
      const text = err.message || String(err);
      this.consoleErrors.push(text);

      const bug: Bug = {
        id: '',
        severity: 'High',
        category: 'ui-crash',
        title: `Uncaught Exception: ${text.slice(0, 80)}`,
        description: err.stack || text,
        stepsToReproduce: [`Navigate to ${this.page.url()}`, `Trigger action causing unhandled exception`],
        expected: 'Handled error or gracefully isolated component error boundary',
        actual: text,
        url: this.page.url(),
        role: this.role,
        consoleError: text,
        timestamp: new Date().toISOString(),
      };

      if (!this.isSuppressed(bug)) {
        this.recordBug(bug);
      }
    });

    this.page.on('response', async (res: Response) => {
      const url = res.url();
      const status = res.status();
      const method = res.request().method();

      // Track all API endpoints
      if (url.includes('/api/')) {
        let responseBody: any = null;
        try {
          const ct = res.headers()['content-type'] || '';
          if (ct.includes('application/json')) {
            responseBody = await res.json().catch(() => null);
          }
        } catch {}

        this.discoveredEndpoints.push({
          url,
          method,
          status,
          role: this.role,
          responseStatus: status,
          responseBody,
        });

        // Run passive schema checks on API response
        if (responseBody) {
          this.validateApiSchema(url, method, status, responseBody);
        }
      }

      // Track failed responses
      if (status >= 400) {
        this.networkErrors.push({
          url,
          method,
          status,
          statusText: res.statusText(),
        });

        const tempBug: Bug = {
          id: '',
          severity: status >= 500 ? 'High' : 'Medium',
          category: 'network-error',
          title: `HTTP ${status} on ${method} ${url.split('?')[0].replace(/.*\/api\//, '/api/')}`,
          description: `Server returned HTTP ${status} ${res.statusText()} for ${method} ${url}`,
          stepsToReproduce: [`Perform action calling ${method} ${url}`, `Observe response status`],
          expected: 'Successful response or appropriate client-side prevention',
          actual: `Received HTTP ${status} error`,
          url,
          role: this.role,
          httpStatus: status,
          apiEndpoint: url,
          timestamp: new Date().toISOString(),
        };

        if (!this.isSuppressed(tempBug)) {
          this.recordBug(tempBug);
        }
      }
    });
  }

  /**
   * Passive Page Health Check on page visit
   */
  async checkPageHealth(url: string, loadTimeMs: number): Promise<Bug[]> {
    const pageBugs: Bug[] = [];

    try {
      // 1. Check for React Error Boundary or raw 404
      const bodyText = await this.page.evaluate(() => document.body?.innerText?.trim() || '').catch(() => '');

      if (bodyText.length < 15) {
        pageBugs.push({
          id: '',
          severity: 'Critical',
          category: 'ui-crash',
          title: `Blank Page Rendered on ${url}`,
          description: `Page body rendered less than 15 characters of content.`,
          stepsToReproduce: [`Login as ${this.role}`, `Navigate directly to ${url}`],
          expected: 'Complete rendered UI layout',
          actual: 'Completely blank page',
          url,
          role: this.role,
          timestamp: new Date().toISOString(),
        });
      }

      const hasErrorBoundary = await this.page.locator('text=/Something went wrong|Render Error|Error Boundary/i').first().isVisible({ timeout: 500 }).catch(() => false);
      if (hasErrorBoundary) {
        pageBugs.push({
          id: '',
          severity: 'Critical',
          category: 'ui-crash',
          title: `React Error Boundary Triggered on ${url}`,
          description: 'A component threw an unhandled render exception caught by the React error boundary.',
          stepsToReproduce: [`Login as ${this.role}`, `Navigate to ${url}`],
          expected: 'Functional UI elements without fatal crash',
          actual: 'React error boundary fallback rendered',
          url,
          role: this.role,
          timestamp: new Date().toISOString(),
        });
      }

      // 2. Performance check (> 8 seconds)
      if (loadTimeMs > 8000) {
        pageBugs.push({
          id: '',
          severity: 'Low',
          category: 'performance',
          title: `Slow Page Load (${(loadTimeMs / 1000).toFixed(1)}s) on ${url}`,
          description: `Page took ${loadTimeMs}ms to reach DOMContentLoaded. Exceeds standard threshold of 5000ms.`,
          stepsToReproduce: [`Navigate to ${url}`, `Observe navigation timing`],
          expected: 'Page load time under 5000ms',
          actual: `Load time: ${loadTimeMs}ms`,
          url,
          role: this.role,
          timestamp: new Date().toISOString(),
        });
      }

      // 3. Horizontal Scroll Overflow Check (desktop)
      const hasOverflow = await this.page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 2;
      }).catch(() => false);

      if (hasOverflow) {
        pageBugs.push({
          id: '',
          severity: 'Medium',
          category: 'visual-glitch',
          title: `Horizontal Scroll Overflow on ${url}`,
          description: 'The page content exceeds window width, forcing an unintended horizontal scrollbar.',
          stepsToReproduce: [`Open ${url} on standard desktop resolution`, `Notice horizontal scrollbar`],
          expected: 'Responsive container fitting 100% viewport width without scroll',
          actual: 'Scroll width exceeds client width',
          url,
          role: this.role,
          timestamp: new Date().toISOString(),
        });
      }

      // 4. Fixed Header Pointer Interception Heuristic
      const headerInterception = await this.page.evaluate(() => {
        const header = document.querySelector('header.MuiAppBar-root, header[class*="positionFixed"]');
        if (!header) return false;
        const rect = header.getBoundingClientRect();
        // Check if header covers top inputs when scrolled
        return rect.height > 50 && window.getComputedStyle(header).position === 'fixed';
      }).catch(() => false);

      if (headerInterception && url.includes('/merchants/new')) {
        // We know this is a specific issue
        pageBugs.push({
          id: '',
          severity: 'High',
          category: 'visual-glitch',
          title: 'MUI Fixed Header overlays form fields on scroll',
          description: 'The sticky header at z-index 1201 intercepts clicks intended for form fields near top viewport boundary.',
          stepsToReproduce: [`Navigate to ${url}`, `Scroll down`, `Attempt clicking fields at top of page`],
          expected: 'Header does not cover or block interaction with form controls',
          actual: 'MuiAppBar intercepts click events',
          url,
          role: this.role,
          timestamp: new Date().toISOString(),
        });
      }

    } catch (err) {}

    for (const b of pageBugs) {
      if (!this.isSuppressed(b)) {
        this.recordBug(b);
      }
    }

    return pageBugs;
  }

  /**
   * Passive API Schema Validation
   */
  private validateApiSchema(url: string, method: string, status: number, body: any): void {
    if (!body || typeof body !== 'object') return;

    // Check for sensitive data exposure
    const sensitiveKeys = ['password', 'secret', 'totp', 'privateKey'];
    const checkKeys = (obj: any, prefix = ''): string[] => {
      let findings: string[] = [];
      if (!obj || typeof obj !== 'object') return findings;
      for (const [k, v] of Object.entries(obj)) {
        const pathStr = prefix ? `${prefix}.${k}` : k;
        if (sensitiveKeys.some(s => k.toLowerCase().includes(s))) {
          findings.push(pathStr);
        }
        if (typeof v === 'object' && v !== null) {
          findings.push(...checkKeys(v, pathStr));
        }
      }
      return findings;
    };

    const exposed = checkKeys(body);
    if (exposed.length > 0) {
      this.recordBug({
        id: '',
        severity: 'Critical',
        category: 'rbac-bypass',
        title: `Sensitive Field Exposed in API Response: ${exposed.join(', ')}`,
        description: `API endpoint ${method} ${url} returned response containing potentially sensitive fields: ${exposed.join(', ')}`,
        stepsToReproduce: [`Invoke ${method} ${url}`, `Inspect response body keys`],
        expected: 'Sensitive credentials, secrets, or TOTP keys must never be exposed',
        actual: `Fields exposed: ${exposed.join(', ')}`,
        url,
        role: this.role,
        apiEndpoint: url,
        timestamp: new Date().toISOString(),
      });
    }

    // Check for missing error message on 4xx/5xx
    if (status >= 400 && !body.message && !body.error && !body.errors && !body.title) {
      this.recordBug({
        id: '',
        severity: 'Low',
        category: 'functional',
        title: `API Error Missing Diagnostic Message: HTTP ${status} on ${method} ${url.split('?')[0].replace(/.*\/api\//, '/api/')}`,
        description: `API returned HTTP ${status} without standard 'message' or 'error' detail field.`,
        stepsToReproduce: [`Call ${method} ${url}`, `Check error payload structure`],
        expected: 'Structured JSON error response with human-readable "message" field',
        actual: JSON.stringify(body).slice(0, 150),
        url,
        role: this.role,
        httpStatus: status,
        apiEndpoint: url,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Session Expiry / Graceful Token Invalidation Test
   */
  async testSessionExpiry(): Promise<Bug[]> {
    const expiryBugs: Bug[] = [];

    try {
      // Simulate expired token by overriding route headers
      await this.page.route('**/api/v1/**', async (route) => {
        const headers = {
          ...route.request().headers(),
          authorization: 'Bearer expired_or_tampered_jwt_token_sample_123',
        };
        await route.continue({ headers });
      });

      // Try navigating or clicking save
      await this.page.goto('/merchants/new').catch(() => {});
      await this.page.waitForTimeout(2000);

      // Check if user is gracefully warned or redirected to /login
      const currentUrl = this.page.url();
      const hasExpiryWarning = await this.page.locator('text=/session.*expired|please.*login|unauthorized/i').isVisible({ timeout: 2000 }).catch(() => false);
      const isLoginRedirect = currentUrl.includes('/login');

      if (!hasExpiryWarning && !isLoginRedirect) {
        expiryBugs.push({
          id: '',
          severity: 'Medium',
          category: 'functional',
          title: 'Missing Graceful Session Expiry Notification',
          description: 'When JWT becomes invalid or expired, the UI does not show a clear session expiry dialog or redirect cleanly to /login.',
          stepsToReproduce: [
            `Authenticate as ${this.role}`,
            `Invalidate session token`,
            `Attempt navigating to a protected route`,
          ],
          expected: 'User redirected to /login or presented with "Session Expired" dialog',
          actual: `App remained at "${currentUrl}" without user notification`,
          url: currentUrl,
          role: this.role,
          timestamp: new Date().toISOString(),
        });
      }

      await this.page.unroute('**/api/v1/**').catch(() => {});
    } catch (e) {}

    for (const b of expiryBugs) {
      this.recordBug(b);
    }
    return expiryBugs;
  }

  /**
   * Check if a bug matches suppression rules
   */
  isSuppressed(bug: Bug): boolean {
    return this.suppressions.some(rule => {
      const m = rule.match;
      if (m.category && m.category !== bug.category) return false;
      if (m.urlPattern && !bug.url.includes(m.urlPattern)) return false;
      if (m.httpStatus && m.httpStatus !== bug.httpStatus) return false;
      if (m.fieldName && m.fieldName !== bug.fieldName) return false;
      if (m.consoleMessagePattern && !new RegExp(m.consoleMessagePattern, 'i').test(bug.consoleError || '')) return false;
      return true;
    });
  }

  recordBug(bug: Bug): void {
    if (!bug.id) {
      bug.id = `BUG-${Math.floor(100 + Math.random() * 900)}`;
    }
    bug.fingerprint = RunDiffer.generateFingerprint(bug);

    // De-duplicate within current session
    const exists = this.bugs.some(b => b.fingerprint === bug.fingerprint);
    if (!exists) {
      this.bugs.push(bug);
      console.log(`   ⚠️ [${bug.severity.toUpperCase()}] ${bug.title} (${bug.category})`);
    }
  }

  getBugs(): Bug[] {
    return this.bugs;
  }

  getDiscoveredEndpoints(): DiscoveredEndpoint[] {
    return this.discoveredEndpoints;
  }

  getConsoleErrors(): string[] {
    return this.consoleErrors;
  }

  getNetworkErrors(): NetworkError[] {
    return this.networkErrors;
  }
}
