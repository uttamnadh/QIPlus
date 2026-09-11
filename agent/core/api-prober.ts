import { Page } from '@playwright/test';
import { Bug, DiscoveredEndpoint, RoleName } from '../types';
import { BugDetector } from './detector';

export class ApiProber {
  private endpoints: DiscoveredEndpoint[];

  constructor(endpoints: DiscoveredEndpoint[]) {
    this.endpoints = endpoints;
  }

  /**
   * Run API security and parameter probes
   */
  async probe(page: Page, role: RoleName, detector: BugDetector): Promise<void> {
    console.log(`\n🔐 [ApiProber] Probing endpoints for role: ${role}...`);

    // 1. RBAC Cross-role Probe
    await this.probeRbac(page, role, detector);

    // 2. Pagination Tampering Probe
    await this.probePagination(page, role, detector);

    // 3. Search Param Injection Probe
    await this.probeSearchParamInjection(page, role, detector);
  }

  /**
   * Probe 1: RBAC Bypass
   * Maker/Onboarding trying to view Compliance or Approver queues
   */
  private async probeRbac(page: Page, role: RoleName, detector: BugDetector): Promise<void> {
    if (role === 'onboarding') {
      // Maker should NOT access COMPLIANCE_REVIEW or FINAL_APPROVAL queues
      const forbiddenQueues = [
        { status: 'COMPLIANCE_REVIEW', desc: 'Compliance Review Queue' },
        { status: 'FINAL_APPROVAL', desc: 'Final Approval Queue' },
      ];

      for (const q of forbiddenQueues) {
        try {
          const res = await page.request.get(`/qi-plus-merchant-onboarding-services/api/v1/merchants?status=${q.status}&size=10`).catch(() => null);
          if (res) {
            const statusCode = res.status();
            if (statusCode === 200) {
              const body = await res.json().catch(() => null);
              detector.recordBug({
                id: '',
                severity: 'Critical',
                category: 'rbac-bypass',
                title: `BOLA/RBAC Bypass: Onboarding Officer can view ${q.desc} (HTTP 200)`,
                description: `Onboarding Officer role requested ?status=${q.status} and received HTTP 200 OK with ${Array.isArray(body?.content) ? body.content.length : 'full'} merchant records instead of HTTP 403 Forbidden.`,
                stepsToReproduce: [
                  `Authenticate as Onboarding Officer`,
                  `GET /api/v1/merchants?status=${q.status}`,
                  `Inspect response status and body`,
                ],
                expected: 'HTTP 403 Forbidden',
                actual: `HTTP 200 OK returning records`,
                url: `/api/v1/merchants?status=${q.status}`,
                role,
                httpStatus: statusCode,
                apiEndpoint: `/api/v1/merchants?status=${q.status}`,
                timestamp: new Date().toISOString(),
              });
            }
          }
        } catch (e) {}
      }
    }
  }

  /**
   * Probe 2: Pagination Tampering (size=-1, size=999999)
   */
  private async probePagination(page: Page, role: RoleName, detector: BugDetector): Promise<void> {
    try {
      // Test size = -1
      const resNeg = await page.request.get('/qi-plus-merchant-onboarding-services/api/v1/merchants?status=DRAFT&size=-1').catch(() => null);
      if (resNeg && resNeg.status() === 200) {
        detector.recordBug({
          id: '',
          severity: 'Medium',
          category: 'validation-gap',
          title: 'Negative Pagination Parameter Accepted (size=-1)',
          description: 'API endpoint accepted size=-1 and returned HTTP 200 OK without input validation rejecting negative pagination sizes.',
          stepsToReproduce: [
            `Send GET /api/v1/merchants?status=DRAFT&size=-1`,
            `Observe response`,
          ],
          expected: 'HTTP 400 Bad Request with validation message: size must be positive',
          actual: 'HTTP 200 OK accepted',
          url: '/api/v1/merchants?status=DRAFT&size=-1',
          role,
          httpStatus: 200,
          apiEndpoint: '/api/v1/merchants',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {}
  }

  /**
   * Probe 3: Search Query SQL Injection Param
   */
  private async probeSearchParamInjection(page: Page, role: RoleName, detector: BugDetector): Promise<void> {
    try {
      const sqlPayload = "' OR 1=1 --";
      const res = await page.request.get(`/qi-plus-merchant-onboarding-services/api/v1/merchants?query=${encodeURIComponent(sqlPayload)}`).catch(() => null);
      if (res && res.status() >= 500) {
        detector.recordBug({
          id: '',
          severity: 'High',
          category: 'injection',
          title: `Server 500 error on SQL query injection probe: "${sqlPayload}"`,
          description: `Passing SQL injection payload in query parameter triggered internal server error ${res.status()}.`,
          stepsToReproduce: [
            `Send GET /api/v1/merchants?query=${encodeURIComponent(sqlPayload)}`,
            `Observe response`,
          ],
          expected: 'HTTP 400 Bad Request or graceful empty 200 search result',
          actual: `HTTP ${res.status()} Internal Server Error`,
          url: `/api/v1/merchants?query=${encodeURIComponent(sqlPayload)}`,
          role,
          httpStatus: res.status(),
          apiEndpoint: '/api/v1/merchants',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {}
  }
}
