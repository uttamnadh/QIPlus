/**
 * ==============================================================================
 * Project   : QiPlus IDMS End-to-End Test Automation Suite
 * Author    : Bhanu Kiran (QA Automation Lead & Framework Architect)
 * Copyright : QiPlus QA Engineering Team
 * ==============================================================================
 */
import * as fs from 'fs';
import * as path from 'path';
import { checkVpnAndPortal } from './fixtures/vpn-detector';

/**
 * Global Setup hook executed strictly ONCE before the test suite starts.
 * 1. Validates OpenVPN and server reachability (pre-flight check).
 * 2. Cleans old allure-results folder and writes fresh author environment metadata.
 */
async function globalSetup() {
  // 1. Clean allure results and write environment properties
  const allureResultsDir = path.join(__dirname, 'allure-results');
  if (fs.existsSync(allureResultsDir)) {
    try {
      fs.rmSync(allureResultsDir, { recursive: true, force: true });
    } catch {}
  }
  try {
    fs.mkdirSync(allureResultsDir, { recursive: true });
    const envContent = [
      'Framework.Architect=Bhanu Kiran',
      'Lead.Automation.Engineer=Bhanu Kiran',
      'Platform=QiPlus IDMS UAT (UAE Compliance)',
      'Language=TypeScript',
      'Engine=Playwright',
      'Architecture=Page Object Model (POM)',
      `Node.Version=${process.version}`,
      `OS.Platform=${process.platform}`,
    ].join('\n');
    fs.writeFileSync(path.join(allureResultsDir, 'environment.properties'), envContent, 'utf-8');
  } catch {}

  // 2. Pre-flight VPN & Portal Connectivity Check
  const check = await checkVpnAndPortal();
  if (!check.isServerReachable) {
    console.error('\n======================================================================');
    console.error('❌ [VPN PRE-FLIGHT CHECK FAILED] UNABLE TO REACH IDMS PORTAL');
    console.error('======================================================================');
    console.error(`⚠️  Target: https://idms-uat.qiplus.ae is currently unreachable.`);
    console.error(`⚠️  Reason: ${check.errorMessage || 'Connection timed out'}`);
    console.error(`\n👉 ACTION REQUIRED:`);
    console.error(`   1. Open 'OpenVPN Connect' on your machine.`);
    console.error(`   2. Connect to Server: 52.28.135.83 (Profile: bhanu.challa@trueid.in).`);
    console.error(`   3. Ensure Private IP (172.27.x.x) is active.`);
    console.error('======================================================================\n');
    throw new Error('Pre-flight check failed: OpenVPN is not connected or target server is unreachable.');
  } else {
    console.log('\n============================================================');
    console.log('🚀 QiPlus IDMS E2E Test Automation Platform');
    console.log('👤 Framework Architect : Bhanu Kiran (QA Automation Lead)');
    console.log('🛠️  Architecture        : Playwright (TS) + POM + Dynamic UAE Data');
    console.log(`🔒 [VPN PRE-FLIGHT]    : OpenVPN Connected (IP: ${check.vpnIp || '172.27.x.x'})`);
    console.log(`🌐 [PORTAL STATUS]     : https://idms-uat.qiplus.ae ONLINE (Status: ${check.statusCode})`);
    console.log('============================================================\n');
  }
}

export default globalSetup;
