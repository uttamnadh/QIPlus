"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function parseArgs() {
    const args = process.argv.slice(2);
    let daysThreshold = 7;
    let dryRun = false;
    let pattern = 'AUTOMATION';
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--days' && args[i + 1]) {
            daysThreshold = parseInt(args[i + 1], 10);
            i++;
        }
        else if (args[i] === '--dry-run') {
            dryRun = true;
        }
        else if (args[i] === '--pattern' && args[i + 1]) {
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
        if (!fs.existsSync(filePath))
            continue;
        try {
            const stats = fs.statSync(filePath);
            scannedCount++;
            const isStale = stats.mtimeMs < cutoffTime;
            if (isStale) {
                console.log(`[Stale Record State] ${file} last modified ${stats.mtime.toISOString()} (older than ${options.daysThreshold} days).`);
                if (!options.dryRun) {
                    fs.writeFileSync(filePath, JSON.stringify({ mrn: '' }, null, 2), 'utf-8');
                    console.log(`  -> Cleared stale state in ${file}`);
                }
                else {
                    console.log(`  -> [DRY RUN] Would clear state in ${file}`);
                }
                purgedCount++;
            }
        }
        catch (err) {
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
