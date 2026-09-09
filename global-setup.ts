import * as fs from 'fs';
import * as path from 'path';

/**
 * Global Setup hook executed strictly ONCE before the test suite starts.
 * Cleans old allure-results folder so that every run generates a 100% fresh report.
 */
async function globalSetup() {
  const allureResultsDir = path.join(__dirname, 'allure-results');
  if (fs.existsSync(allureResultsDir)) {
    try {
      fs.rmSync(allureResultsDir, { recursive: true, force: true });
    } catch {}
  }
}

export default globalSetup;
