const readline = require('readline');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'fixtures', 'state.json');

function readState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch {}
  return {};
}

function runSingleRecord(recordIndex, totalRecords, shareholderType, isHeaded) {
  return new Promise((resolve) => {
    console.log(`\n============================================================`);
    console.log(`🚀 PROCESSING RECORD ${recordIndex} OF ${totalRecords}`);
    console.log(`🏢 Shareholder Mode: ${shareholderType} | Mode: ${isHeaded ? 'Headed' : 'Headless'}`);
    console.log(`============================================================\n`);

    const args = [
      'playwright',
      'test',
      'tests/positive/02-onboarding-wizard.spec.ts',
      '--reporter=list'
    ];

    if (isHeaded) {
      args.push('--headed');
    }

    const env = {
      ...process.env,
      SHAREHOLDER_TYPE: shareholderType
    };

    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const child = spawn(cmd, args, {
      env,
      stdio: 'inherit',
      shell: false
    });

    child.on('close', (code) => {
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

async function runBatch(count, shareholderMode, isHeaded) {
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

    const result = await runSingleRecord(i, count, currentShareholder, isHeaded);
    results.push(result);
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  const successCount = results.filter(r => r.success).length;

  console.log('\n========================================================================================================');
  console.log(`🎉 BATCH ONBOARDING RUN COMPLETED: ${successCount}/${count} RECORDS SUBMITTED SUCCESSFULLY IN ${totalDuration}s`);
  console.log('========================================================================================================');
  console.log(
    '#'.padEnd(4) + '| ' +
    'MERCHANT NAME'.padEnd(36) + '| ' +
    'MRN NUMBER'.padEnd(18) + '| ' +
    'SHAREHOLDER'.padEnd(15) + '| ' +
    'STATUS'
  );
  console.log('----+-------------------------------------+-------------------+----------------+------------------------');

  results.forEach((r) => {
    const status = r.success ? '✅ Submitted (Review)' : `❌ Failed (Exit ${r.exitCode})`;
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

function promptUser() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n============================================================');
  console.log('   🚀 QiPlus E2E Onboarding Wizard Batch Runner');
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

      console.log(`\n3. Select Browser Mode:`);
      console.log('  [1] Headed (Visible Browser) [Default]');
      console.log('  [2] Headless (Fast Background)\n');

      rl.question('Enter choice [1 or 2] (Default: 1): ', (modeChoice) => {
        rl.close();

        const modeTrimmed = (modeChoice || '').trim();
        const isHeaded = modeTrimmed !== '2' && modeTrimmed.toLowerCase() !== 'headless';

        console.log(`\n▶ Starting batch run: ${count} record(s) | Mode: ${shareholderMode} | Browser: ${isHeaded ? 'Headed' : 'Headless'}\n`);
        runBatch(count, shareholderMode, isHeaded);
      });
    });
  });
}

promptUser();
