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
exports.RunDiffer = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class RunDiffer {
    constructor(baseDir = process.cwd()) {
        this.knownBugs = [];
        this.knownBugsPath = path.resolve(baseDir, 'known-bugs.json');
        this.historyDir = path.resolve(baseDir, 'agent-results', 'previous-runs');
        this.loadKnownBugs();
    }
    /**
     * Generates a stable deterministic fingerprint for a bug
     */
    static generateFingerprint(bug) {
        const raw = `${bug.category || ''}:${bug.url || ''}:${bug.fieldName || bug.title || ''}:${bug.role || ''}`;
        // Return readable prefix plus hash
        const cleanPattern = (bug.url || '').replace(/https?:\/\/[^/]+/i, '').split('?')[0] || '/';
        const fieldOrId = bug.fieldName || (bug.title || '').replace(/\s+/g, '-').slice(0, 25);
        return `${bug.category || 'bug'}:${cleanPattern}:${fieldOrId}:${bug.role || 'all'}`;
    }
    /**
     * Load known bugs registry
     */
    loadKnownBugs() {
        if (fs.existsSync(this.knownBugsPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.knownBugsPath, 'utf-8'));
                this.knownBugs = data.bugs || [];
            }
            catch (e) {
                console.warn('⚠️ Could not load known-bugs.json:', e);
            }
        }
    }
    /**
     * Compare current bugs against known bugs & previous runs
     */
    compare(currentBugs) {
        const previousRun = this.loadLatestPreviousRun();
        const currentFingerprints = new Set(currentBugs.map(b => b.fingerprint || RunDiffer.generateFingerprint(b)));
        // Identify new bugs (not in known bugs registry AND not in previous run)
        const knownFingerprints = new Set(this.knownBugs.map(k => k.fingerprint));
        const prevFingerprints = new Set(previousRun?.bugs?.map((b) => b.fingerprint || RunDiffer.generateFingerprint(b)) || []);
        const newBugs = [];
        const ongoingBugs = [];
        for (const bug of currentBugs) {
            const fp = bug.fingerprint || RunDiffer.generateFingerprint(bug);
            bug.fingerprint = fp;
            if (!knownFingerprints.has(fp) && !prevFingerprints.has(fp)) {
                newBugs.push(bug);
            }
            else {
                ongoingBugs.push(bug);
            }
        }
        // Check for fixed bugs from known registry
        const fixedBugs = [];
        for (const known of this.knownBugs) {
            if (!currentFingerprints.has(known.fingerprint) && known.status === 'open') {
                fixedBugs.push(known);
            }
        }
        return {
            previousRunId: previousRun?.runId,
            newBugs,
            fixedBugs,
            ongoingBugs,
        };
    }
    /**
     * Archives current run data for future diffing
     */
    archiveRun(runSummary) {
        try {
            if (!fs.existsSync(this.historyDir)) {
                fs.mkdirSync(this.historyDir, { recursive: true });
            }
            const filename = `${runSummary.runId || Date.now()}.json`;
            fs.writeFileSync(path.join(this.historyDir, filename), JSON.stringify(runSummary, null, 2), 'utf-8');
            // Update manifest
            const manifestPath = path.join(this.historyDir, 'manifest.json');
            let manifest = { runs: [] };
            if (fs.existsSync(manifestPath)) {
                manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            }
            manifest.runs.unshift({
                runId: runSummary.runId,
                date: new Date().toISOString(),
                totalBugs: runSummary.totalBugsFound,
                newBugs: runSummary.newBugsCount,
                fixedBugs: runSummary.fixedBugsCount,
            });
            // Keep only last 30
            if (manifest.runs.length > 30) {
                const removed = manifest.runs.splice(30);
                for (const rem of removed) {
                    const remFile = path.join(this.historyDir, `${rem.runId}.json`);
                    if (fs.existsSync(remFile))
                        fs.unlinkSync(remFile);
                }
            }
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
        }
        catch (e) {
            console.warn('⚠️ Failed to archive run:', e);
        }
    }
    loadLatestPreviousRun() {
        try {
            const manifestPath = path.join(this.historyDir, 'manifest.json');
            if (fs.existsSync(manifestPath)) {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                if (manifest.runs && manifest.runs.length > 0) {
                    const latestId = manifest.runs[0].runId;
                    const latestFile = path.join(this.historyDir, `${latestId}.json`);
                    if (fs.existsSync(latestFile)) {
                        return JSON.parse(fs.readFileSync(latestFile, 'utf-8'));
                    }
                }
            }
        }
        catch { }
        return null;
    }
}
exports.RunDiffer = RunDiffer;
