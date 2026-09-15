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
exports.getOrPromptRunOptions = getOrPromptRunOptions;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const CONFIG_FILE = path.join(__dirname, '.run-config.json');
let cachedOptions = null;
function readRecentConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
            if (Date.now() - (data.timestamp || 0) < 60000) { // Valid for 60 seconds
                return {
                    shareholderType: data.shareholderType,
                    recordCount: data.recordCount
                };
            }
        }
    }
    catch { }
    return null;
}
function writeConfig(options) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...options, timestamp: Date.now() }, null, 2), 'utf-8');
    }
    catch { }
}
function applyOptions(opts) {
    cachedOptions = opts;
    process.env.SHAREHOLDER_TYPE = opts.shareholderType;
    process.env.RECORD_COUNT = String(opts.recordCount);
    writeConfig(opts);
    return opts;
}
function getOrPromptRunOptions() {
    if (cachedOptions)
        return cachedOptions;
    // 1. If passed via environment variables, use them directly without prompt
    if (process.env.SHAREHOLDER_TYPE && process.env.RECORD_COUNT) {
        return applyOptions({
            shareholderType: process.env.SHAREHOLDER_TYPE,
            recordCount: parseInt(process.env.RECORD_COUNT, 10) || 1
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
    // 3. If non-interactive (CI or no TTY)
    if (process.env.CI || !process.stdout.isTTY) {
        return applyOptions({
            shareholderType: process.env.SHAREHOLDER_TYPE || 'Individual',
            recordCount: parseInt(process.env.RECORD_COUNT || '1', 10) || 1
        });
    }
    // 4. Interactive prompt via console
    try {
        const conPath = process.platform === 'win32' ? '\\\\.\\CON' : '/dev/tty';
        const fd = fs.openSync(conPath, 'rs');
        process.stdout.write('\n============================================================\n');
        process.stdout.write('   🚀 QiPlus Onboarding Wizard Interactive Options\n');
        process.stdout.write('============================================================\n\n');
        process.stdout.write('1. Select Shareholder Type:\n');
        process.stdout.write('   [1] Individual (Emirates ID / Auto UBO) [Default]\n');
        process.stdout.write('   [2] Entity     (Trade License / Manual UBO)\n');
        process.stdout.write('   [3] Alternate  (Mix between Individual & Entity)\n\n');
        process.stdout.write('Enter choice [1, 2, or 3] (Default: 1): ');
        const buf = Buffer.alloc(256);
        let bytesRead = fs.readSync(fd, buf, 0, 256, null);
        const choice = buf.toString('utf-8', 0, bytesRead).trim().toLowerCase();
        let shareholderType = 'Individual';
        if (choice === '2' || choice === 'entity' || choice === 'e') {
            shareholderType = 'Entity';
        }
        else if (choice === '3' || choice === 'alternate' || choice === 'alt' || choice === 'a' || choice === 'mix') {
            shareholderType = 'Alternate';
        }
        process.stdout.write('\n2. Enter number of records to create (e.g. 1, 2, 3, 5, 10) [Default: 1]: ');
        bytesRead = fs.readSync(fd, buf, 0, 256, null);
        const countStr = buf.toString('utf-8', 0, bytesRead).trim();
        let recordCount = parseInt(countStr, 10) || 1;
        if (recordCount < 1)
            recordCount = 1;
        fs.closeSync(fd);
        process.stdout.write(`\n▶ Configuration: Mode = ${shareholderType} | Total Records = ${recordCount}\n\n`);
        return applyOptions({ shareholderType, recordCount });
    }
    catch {
        return applyOptions({
            shareholderType: process.env.SHAREHOLDER_TYPE || 'Individual',
            recordCount: parseInt(process.env.RECORD_COUNT || '1', 10) || 1
        });
    }
}
