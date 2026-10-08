import * as fs from 'fs';
import * as path from 'path';

export interface RunOptions {
  shareholderType: string;
  recordCount: number;
  maxStep?: number;
}

const CONFIG_FILE = path.join(__dirname, '.run-config.json');
let cachedOptions: RunOptions | null = null;

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

function readRecentConfig(): RunOptions | null {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      if (Date.now() - (data.timestamp || 0) < 60000) { // Valid for 60 seconds
        return {
          shareholderType: data.shareholderType,
          recordCount: data.recordCount,
          maxStep: data.maxStep || 8
        };
      }
    }
  } catch {}
  return null;
}

function writeConfig(options: RunOptions) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...options, timestamp: Date.now() }, null, 2), 'utf-8');
  } catch {}
}

function applyOptions(opts: RunOptions): RunOptions {
  cachedOptions = opts;
  process.env.SHAREHOLDER_TYPE = opts.shareholderType;
  process.env.RECORD_COUNT = String(opts.recordCount);
  process.env.MAX_STEP = String(opts.maxStep || 8);
  writeConfig(opts);
  return opts;
}

export function getOrPromptRunOptions(): RunOptions {
  if (cachedOptions) return cachedOptions;

  // 1. If passed via environment variables (RECORD_COUNT explicitly given), use it directly
  if (process.env.RECORD_COUNT) {
    return applyOptions({
      shareholderType: process.env.SHAREHOLDER_TYPE || 'Individual',
      recordCount: parseInt(process.env.RECORD_COUNT, 10) || 1,
      maxStep: parseInt(process.env.MAX_STEP || '8', 10) || 8
    });
  }

  // 2. If this is a Playwright worker process (process.env.TEST_WORKER_INDEX is set),
  // read the fresh config saved by the runner/main process
  if (process.env.TEST_WORKER_INDEX !== undefined) {
    const recent = readRecentConfig();
    if (recent) {
      return applyOptions(recent);
    }
  }

  // 3. If non-interactive (CI or list mode)
  if (process.env.CI || process.argv.includes('--list')) {
    return applyOptions({
      shareholderType: process.env.SHAREHOLDER_TYPE || 'Individual',
      recordCount: parseInt(process.env.RECORD_COUNT || '1', 10) || 1,
      maxStep: parseInt(process.env.MAX_STEP || '8', 10) || 8
    });
  }

  // 4. Interactive prompt via console for record count only
  try {
    const conPath = process.platform === 'win32' ? '\\\\.\\CON' : '/dev/tty';
    const fd = fs.openSync(conPath, 'rs');

    process.stdout.write('\n============================================================\n');
    process.stdout.write('   🚀 QiPlus Onboarding Wizard\n');
    process.stdout.write('============================================================\n\n');
    process.stdout.write('Enter number of records to create (e.g. 1, 2, 3, 5, 10) [Default: 1]: ');

    const buf = Buffer.alloc(256);
    const bytesRead = fs.readSync(fd, buf, 0, 256, null);
    const countStr = buf.toString('utf-8', 0, bytesRead).trim();
    let recordCount = parseInt(countStr, 10) || 1;
    if (recordCount < 1) recordCount = 1;

    fs.closeSync(fd);

    const shareholderType = process.env.SHAREHOLDER_TYPE || 'Individual';
    process.stdout.write(`\n▶ Configuration: Shareholder = ${shareholderType} | Total Records = ${recordCount}\n\n`);

    return applyOptions({
      shareholderType,
      recordCount,
      maxStep: parseInt(process.env.MAX_STEP || '8', 10) || 8
    });
  } catch {
    return applyOptions({
      shareholderType: process.env.SHAREHOLDER_TYPE || 'Individual',
      recordCount: parseInt(process.env.RECORD_COUNT || '1', 10) || 1,
      maxStep: parseInt(process.env.MAX_STEP || '8', 10) || 8
    });
  }
}
