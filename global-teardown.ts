import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Global Teardown hook executed by Playwright automatically after EVERY test run.
 * Automatically compiles allure-results into a fresh, updated Allure HTML report.
 */
export default async function globalTeardown() {
  const resultsDir = path.join(__dirname, 'allure-results');
  const reportDir = path.join(__dirname, 'allure-report');

  if (fs.existsSync(resultsDir) && fs.readdirSync(resultsDir).length > 0) {
    try {
      console.log('\n📊 [Allure Report] Compiling fresh Allure HTML report...');
      const localAllure = path.join(__dirname, 'node_modules', '.bin', process.platform === 'win32' ? 'allure.cmd' : 'allure');
      const cmd = fs.existsSync(localAllure)
        ? `"${localAllure}" generate allure-results --clean -o allure-report`
        : `${process.platform === 'win32' ? 'npx.cmd' : 'npx'} allure generate allure-results --clean -o allure-report`;

      execSync(cmd, {
        cwd: __dirname,
        stdio: 'inherit',
      });
      console.log(`✅ [Allure Report] Fresh report generated at: ${path.join(reportDir, 'index.html')}\n`);
    } catch (err: any) {
      console.log(`⚠️ [Allure Report] Notice: ${err?.message || err}`);
    }
  }
}
