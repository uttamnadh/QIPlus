import { defineConfig } from '@playwright/test';

if (!process.env.RUN_ID) {
  process.env.RUN_ID = Date.now().toString();
}

export default defineConfig({
  testDir: './tests',
  /* Clean allure-results strictly once before suite execution */
  globalSetup: './global-setup.ts',
  /* Automatically compile fresh Allure report after suite execution */
  globalTeardown: './global-teardown.ts',
  /* Run tests sequentially — shared state across pipeline */
  fullyParallel: false,
  /* No retries for deterministic happy-path tests (fail fast, no masked regressions) */
  retries: 0,
  /* Single worker to enforce sequential execution */
  workers: 1,
  /* HTML and Allure reporters for deliverables & trend dashboards */
  reporter: [
    ['allure-playwright', { resultsDir: 'allure-results' }],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list']
  ],
  /* Fast fail assertion timeout: 5s instead of default 30s */
  expect: {
    timeout: 5000,
  },
  use: {
    baseURL: 'https://idms-uat.qiplus.ae',
    browserName: 'chromium',
    /* Diagnostics: capture screenshots, traces, and video on failure */
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    /* Fail-fast action & navigation timeouts */
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  /* Global timeout per test */
  timeout: 60000,
  projects: [
    {
      name: 'positive',
      testMatch: [
        'positive/0*.spec.ts',
      ],
    },
    {
      name: 'negative',
      testMatch: [
        'negative/*.spec.ts',
      ],
    },
    {
      name: 'regression',
      testMatch: [
        'regression/*.spec.ts',
      ],
    },
  ],
});
