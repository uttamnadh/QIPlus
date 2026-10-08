/**
 * ============================================================================
 * QiPlus Enterprise E2E Test Suite & Batch Orchestrator
 *
 * Framework Architect & Lead Automation Engineer: Bhanu Kiran
 * Copyright (c) 2026 Bhanu Kiran. All rights reserved.
 * ============================================================================
 */

const readline = require('readline');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'fixtures', 'state.json');

process.on('SIGINT', () => {
  console.log('\n============================================================');
  console.log('🚨 [FORCE CLOSED] Test execution was FORCE CLOSED by user (Ctrl+C)!');
  console.log('============================================================\n');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n============================================================');
  console.log('🚨 [FORCE CLOSED] Test execution was FORCE CLOSED (Terminated)!');
  console.log('============================================================\n');
  process.exit(143);
});

function readState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch {}
  return {};
}

function runSingleRecord(recordIndex, totalRecords, shareholderType, isHeaded, maxStep = 8, browserChannel = '') {
  return new Promise((resolve) => {
    const stepLabel = maxStep >= 8 ? 'Full (Step 1-8 Submit)' : `Up to Step ${maxStep}`;
    const browserLabel = isHeaded ? (browserChannel === 'chrome' ? 'Visible Google Chrome' : 'Visible Chromium') : 'Headless';
    console.log(`\n============================================================`);
    console.log(`🚀 PROCESSING RECORD ${recordIndex} OF ${totalRecords}`);
    console.log(`🏢 Shareholder Mode: ${shareholderType} | Target: ${stepLabel} | Browser: ${browserLabel}`);
    console.log(`============================================================\n`);

    const cliPath = path.join(__dirname, 'node_modules', '@playwright', 'test', 'cli.js');
    const args = [
      cliPath,
      'test',
      'tests/positive/02-onboarding-wizard.spec.ts',
      '--project=positive'
    ];

    if (isHeaded) {
      args.push('--headed');
    }

    const env = {
      ...process.env,
      SHAREHOLDER_TYPE: shareholderType,
      RECORD_COUNT: String(totalRecords),
      MAX_STEP: String(maxStep),
      HEADED: isHeaded ? 'true' : 'false',
      HEADLESS: isHeaded ? 'false' : 'true',
      BROWSER_CHANNEL: browserChannel || '',
      PLAYWRIGHT_HTML_REPORT: path.join(__dirname, 'playwright-report')
    };

    const child = spawn(process.execPath, args, {
      cwd: __dirname,
      env,
      stdio: 'inherit',
      shell: false,
      windowsHide: false
    });

    child.on('close', (code, signal) => {
      if (signal === 'SIGINT' || signal === 'SIGTERM' || code === 130) {
        console.log('\n============================================================');
        console.log('🚨 [FORCE CLOSED] Test execution was FORCE CLOSED by user!');
        console.log('============================================================\n');
      }
      const state = readState();
      const recordInfo = {
        index: recordIndex,
        success: code === 0,
        tradeName: state.tradeName || 'New Merchant',
        legalName: state.legalName || '',
        mrn: state.mrn || 'N/A',
        shareholderType: state.shareholderType || shareholderType,
        exitCode: code
      };
      resolve(recordInfo);
    });
  });
}

async function runBatch(count, shareholderMode, isHeaded, maxStep = 8, browserChannel = '') {
  const results = [];
  const startTime = Date.now();

  for (let i = 1; i <= count; i++) {
    let currentShareholder = 'Individual';
    if (shareholderMode === 'Entity') {
      currentShareholder = 'Entity';
    } else if (shareholderMode === 'Alternate') {
      currentShareholder = (i % 2 === 1) ? 'Individual' : 'Entity';
    } else {
      currentShareholder = 'Individual';
    }

    const result = await runSingleRecord(i, count, currentShareholder, isHeaded, maxStep, browserChannel);
    results.push(result);
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  const successCount = results.filter(r => r.success).length;

  const headerTitle = maxStep >= 8
    ? `🎉 BATCH ONBOARDING RUN COMPLETED: ${successCount}/${count} RECORDS SUBMITTED SUCCESSFULLY IN ${totalDuration}s`
    : (maxStep === 1
        ? `🎉 BATCH ONBOARDING RUN COMPLETED: ${successCount}/${count} RECORDS SAVED (Step 1 Completed) IN ${totalDuration}s`
        : `🎉 BATCH ONBOARDING RUN COMPLETED: ${successCount}/${count} RECORDS SAVED (Steps 1 to ${maxStep} Completed) IN ${totalDuration}s`);

  console.log('\n========================================================================================================');
  console.log(headerTitle);
  console.log('========================================================================================================');
  console.log(
    '#'.padEnd(4) + '| ' +
    'MERCHANT NAME'.padEnd(36) + '| ' +
    'MRN NUMBER'.padEnd(18) + '| ' +
    'SHAREHOLDER'.padEnd(15) + '| ' +
    'STATUS'
  );
  console.log('----+-------------------------------------+-------------------+----------------+--------------------------------');

  results.forEach((r) => {
    let status = `❌ Failed (Exit ${r.exitCode})`;
    if (r.success) {
      if (maxStep >= 8) {
        status = '✅ Submitted (Review)';
      } else if (maxStep === 1) {
        status = '✅ Step 1 Completed (Draft)';
      } else {
        status = `✅ Steps 1 to ${maxStep} Completed (Draft)`;
      }
    }
    const name = (r.tradeName || 'Merchant').substring(0, 34);
    console.log(
      String(r.index).padEnd(4) + '| ' +
      name.padEnd(36) + '| ' +
      String(r.mrn).padEnd(18) + '| ' +
      String(r.shareholderType).padEnd(15) + '| ' +
      status
    );
  });
  console.log('========================================================================================================\n');
}

function parseStepNumber(input) {
  if (!input || !String(input).trim()) return 8;
  const s = String(input).trim().toLowerCase();
  if (s.includes('-')) {
    const parts = s.split('-');
    const num = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(num) && num >= 1 && num <= 8) return num;
  }
  const num = parseInt(s, 10);
  if (!isNaN(num) && num >= 1 && num <= 8) return num;
  return 8;
}

function promptUser() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n============================================================');
  console.log('   🚀 QiPlus E2E Onboarding Wizard Batch Runner');
  console.log('   👤 Architect: Bhanu Kiran (QA Automation Lead)');
  console.log('============================================================\n');

  console.log('1. Select Shareholder Type for Step 3:');
  console.log('  [1] Individual (Emirates ID / Passport, Auto-UBO) [Default]');
  console.log('  [2] Entity     (Trade License TL162770, Manual UBO in Step 4)');
  console.log('  [3] Alternate  (Mix between Individual & Entity)\n');

  rl.question('Enter choice [1, 2, or 3] (Default: 1): ', (choice) => {
    let shareholderMode = 'Individual';
    const trimmed = (choice || '').trim().toLowerCase();

    if (trimmed === '2' || trimmed === 'entity' || trimmed === 'e') {
      shareholderMode = 'Entity';
    } else if (trimmed === '3' || trimmed === 'alternate' || trimmed === 'alt' || trimmed === 'a' || trimmed === 'mix') {
      shareholderMode = 'Alternate';
    } else {
      shareholderMode = 'Individual';
    }

    console.log(`\n2. Enter Number of Merchant Records to create (e.g. 1, 2, 3, 5, 10):`);
    rl.question('Enter count (Default: 1): ', (countInput) => {
      let count = parseInt((countInput || '1').trim(), 10);
      if (isNaN(count) || count < 1) {
        count = 1;
      }

      console.log(`\n3. Select Target Step Range (Stop at any step 1 to 8):`);
      console.log('  8 - Step 1 to 8 (Full Onboarding & Final Submit) [Default]');
      console.log('  7 - Step 1 to 7 (Draft with Documents)');
      console.log('  6 - Step 1 to 6 (Draft with Banking & Settlement)');
      console.log('  5 - Step 1 to 5 (Draft with Authorized Signatories)');
      console.log('  4 - Step 1 to 4 (Draft with UBOs)');
      console.log('  3 - Step 1 to 3 (Draft with Shareholders / Ownership)');
      console.log('  2 - Step 1 to 2 (Draft with Business & Contact Details)');
      console.log('  1 - Step 1 only (Draft with Profile / MRN Created)\n');

      rl.question('Enter step (1-8, e.g. 8 for Full, 4 for 1-4, 1 for only 1) [Default: 8]: ', (stepChoice) => {
        const maxStep = parseStepNumber(stepChoice);

        console.log(`\n4. Select Browser Mode:`);
        console.log('  [1] Headed (Visible Browser) [Default]');
        console.log('  [2] Headless (Fast Background)\n');

        rl.question('Enter choice [1 or 2] (Default: 1): ', (modeChoice) => {
          rl.close();

          const modeTrimmed = (modeChoice || '').trim();
          const isHeaded = modeTrimmed !== '2' && modeTrimmed.toLowerCase() !== 'headless';

          const stepLabel = maxStep >= 8 ? 'Full (Step 1-8 Submit)' : `Up to Step ${maxStep}`;
          console.log(`\n▶ Starting batch run: ${count} record(s) | Mode: ${shareholderMode} | Target: ${stepLabel} | Browser: ${isHeaded ? 'Headed' : 'Headless'}\n`);
          runBatch(count, shareholderMode, isHeaded, maxStep);
        });
      });
    });
  });
}

function parseArgsAndRun() {
  const args = process.argv.slice(2);
  const isQuick = args.some(a => a === '--quick' || a === '-q' || a === '--fast' || a === '-y');

  let shareholderMode = 'Individual';
  let count = 1;
  let isHeaded = true;
  let maxStep = 8;
  let browserChannel = '';

  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      const val = arg.split('=')[1].toLowerCase();
      if (val === 'entity' || val === '2') shareholderMode = 'Entity';
      else if (val === 'alternate' || val === '3' || val === 'alt') shareholderMode = 'Alternate';
      else shareholderMode = 'Individual';
    } else if (arg.startsWith('--count=')) {
      count = parseInt(arg.split('=')[1], 10) || 1;
    } else if (arg.startsWith('--max-step=') || arg.startsWith('--step=')) {
      maxStep = parseStepNumber(arg.split('=')[1]);
    } else if (arg.startsWith('--browser-channel=') || arg.startsWith('--channel=')) {
      browserChannel = arg.split('=')[1].toLowerCase();
    } else if (arg === '--headless') {
      isHeaded = false;
    } else if (arg === '--headed') {
      isHeaded = true;
    }
  }

  // If quick flag or any explicit mode/count/step was passed, bypass interactive prompt
  if (isQuick || args.some(a => a.startsWith('--mode=') || a.startsWith('--count=') || a.startsWith('--max-step=') || a.startsWith('--step='))) {
    const stepLabel = maxStep >= 8 ? 'Full (Step 1-8 Submit)' : `Up to Step ${maxStep}`;
    const browserLabel = isHeaded ? (browserChannel === 'chrome' ? 'Visible Google Chrome' : 'Visible Chromium') : 'Headless';
    console.log('\n============================================================');
    console.log('   🚀 QiPlus E2E Quick Onboarding Runner');
    console.log('   👤 Architect: Bhanu Kiran (QA Automation Lead)');
    console.log(`   ▶ Batch: ${count} record(s) | Mode: ${shareholderMode} | Target: ${stepLabel} | Browser: ${browserLabel}`);
    console.log('============================================================\n');
    runBatch(count, shareholderMode, isHeaded, maxStep, browserChannel);
  } else {
    promptUser();
  }
}

parseArgsAndRun();
