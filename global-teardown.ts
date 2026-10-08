import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Global Teardown hook executed by Playwright automatically after EVERY test run.
 * Automatically compiles allure-results into a fresh, updated Allure HTML report.
 */
export default async function globalTeardown() {
  if (process.env.ALLURE_SKIP === 'true') {
    return;
  }

  const resultsDir = path.join(__dirname, 'allure-results');
  const reportDir = path.join(__dirname, 'allure-report');

  if (fs.existsSync(resultsDir) && fs.readdirSync(resultsDir).length > 0) {
    try {
      console.log('\n📊 [Allure Report] Generating fresh Allure report...');
      const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      execSync(`${cmd} allure generate allure-results --clean -o allure-report`, {
        cwd: __dirname,
        stdio: 'inherit',
      });
      console.log(`✅ [Allure Report] Report updated at: ${path.join(reportDir, 'index.html')}\n`);
    } catch (err: any) {
      console.log(`⚠️ [Allure Report] Notice: ${err?.message || err}`);
    }
  }
}
