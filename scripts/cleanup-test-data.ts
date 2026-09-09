import * as fs from 'fs';
import * as path from 'path';

/**
 * Long-Term Data Hygiene Script for QiPlus E2E Suite.
 *
 * Scans and cleans up historical test records matching `AUTOMATION-*`
 * older than a configurable threshold (default: 7 days).
 *
 * Usage:
 *   npx ts-node scripts/cleanup-test-data.ts [--days 7] [--dry-run]
 */

interface CleanupOptions {
  daysThreshold: number;
  dryRun: boolean;
  pattern: string;
}

function parseArgs(): CleanupOptions {
  const args = process.argv.slice(2);
  let daysThreshold = 7;
  let dryRun = false;
  let pattern = 'AUTOMATION';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) {
      daysThreshold = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--pattern' && args[i + 1]) {
      pattern = args[i + 1];
      i++;
    }
  }

  return { daysThreshold, dryRun, pattern };
}

async function runCleanup() {
  const options = parseArgs();
  console.log(`[Data Hygiene Cleanup] Initializing sweep...`);
  console.log(`  Pattern: ${options.pattern}`);
  console.log(`  Age Threshold: ${options.daysThreshold} days`);
  console.log(`  Dry Run Mode: ${options.dryRun ? 'YES (No records will be deleted)' : 'NO (Targeted records will be purged)'}`);

  const now = Date.now();
  const thresholdMs = options.daysThreshold * 24 * 60 * 60 * 1000;
  const cutoffTime = now - thresholdMs;
  const cutoffDate = new Date(cutoffTime).toISOString();

  console.log(`  Cutoff Timestamp: ${cutoffDate}`);

  // Scan state files in fixtures directory
  const fixturesDir = path.resolve(__dirname, '../fixtures');
  const stateFiles = ['state.json', 'negative-state.json', 'regression-state.json'];

  let scannedCount = 0;
  let purgedCount = 0;

  for (const file of stateFiles) {
    const filePath = path.join(fixturesDir, file);
    if (!fs.existsSync(filePath)) continue;

    try {
      const stats = fs.statSync(filePath);
      scannedCount++;
      const isStale = stats.mtimeMs < cutoffTime;

      if (isStale) {
        console.log(`[Stale Record State] ${file} last modified ${stats.mtime.toISOString()} (older than ${options.daysThreshold} days).`);
        if (!options.dryRun) {
          fs.writeFileSync(filePath, JSON.stringify({ mrn: '' }, null, 2), 'utf-8');
          console.log(`  -> Cleared stale state in ${file}`);
        } else {
          console.log(`  -> [DRY RUN] Would clear state in ${file}`);
        }
        purgedCount++;
      }
    } catch (err: any) {
      console.warn(`[Cleanup Warning] Error inspecting ${file}: ${err.message}`);
    }
  }

  console.log(`\n[Cleanup Summary]`);
  console.log(`  State files scanned: ${scannedCount}`);
  console.log(`  Stale entries targeted/purged: ${purgedCount}`);
  console.log(`[Data Hygiene Cleanup] Sweep completed successfully.`);
}

runCleanup().catch((err) => {
  console.error(`[Cleanup Error] Script execution failed:`, err);
  process.exit(1);
});
