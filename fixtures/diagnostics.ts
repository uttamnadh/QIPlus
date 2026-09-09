import { test as base, expect, Page, Response } from '@playwright/test';

type DiagnosticsFixtures = {
  intentional4xxPatterns: string[];
};

export const test = base.extend<DiagnosticsFixtures>({
  intentional4xxPatterns: [[], { option: true }],

  page: async ({ page, intentional4xxPatterns }, use, testInfo) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedResponses: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    page.on('response', res => {
      if (res.status() >= 400) {
        failedResponses.push(`${res.status()} ${res.request().method()} ${res.url()}`);
      }
    });

    await use(page);

    // Only attach + classify if the test FAILED
    if (testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach('console-errors.json', {
        body: JSON.stringify(consoleErrors, null, 2),
        contentType: 'application/json',
      });
      await testInfo.attach('page-errors.json', {
        body: JSON.stringify(pageErrors, null, 2),
        contentType: 'application/json',
      });
      await testInfo.attach('failed-network-responses.json', {
        body: JSON.stringify(failedResponses, null, 2),
        contentType: 'application/json',
      });

      // Filter out intentional 4xx responses for classification
      const unintendedFailedResponses = failedResponses.filter(entry => {
        return !intentional4xxPatterns.some(pattern => entry.includes(pattern));
      });

      let verdict = 'Unclear — check trace manually (likely a script/locator issue)';
      if (unintendedFailedResponses.length > 0) {
        verdict = 'Likely BACKEND — API returned an error status';
      } else if (pageErrors.length || consoleErrors.length) {
        verdict = 'Likely FRONTEND — JS error thrown in the browser';
      }

      console.log(`\n🔎 [${testInfo.title}] ${verdict}\n`);
    }
  },
});

/**
 * Reusable network-assertion helper that listens for a matching URL response,
 * asserts the status is < 400 (success), and returns the JSON payload.
 */
export async function expectApiSuccess(
  page: Page,
  urlPattern: string | RegExp,
  timeoutMs: number = 10000
): Promise<any> {
  const response = await page.waitForResponse(
    (res) => {
      const urlMatches = typeof urlPattern === 'string' ? res.url().includes(urlPattern) : urlPattern.test(res.url());
      return urlMatches;
    },
    { timeout: timeoutMs }
  );

  expect(response.status(), `API response status for ${response.url()}`).toBeLessThan(400);
  try {
    return await response.json();
  } catch {
    return await response.text();
  }
}

export { expect };

