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
exports.BugReportGenerator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class BugReportGenerator {
    constructor(outputDir = 'agent-results') {
        this.outputDir = path.resolve(process.cwd(), outputDir);
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }
    /**
     * Write machine-readable JSON report
     */
    async generateJSON(summary) {
        const jsonPath = path.join(this.outputDir, 'agent-report.json');
        fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf-8');
        return jsonPath;
    }
    /**
     * Write human-readable GitHub Flavored Markdown report
     */
    async generateMarkdown(summary) {
        const mdPath = path.join(this.outputDir, 'agent-report.md');
        const durationSec = Math.round(summary.durationMs / 1000);
        const mins = Math.floor(durationSec / 60);
        const secs = durationSec % 60;
        const durationStr = `${mins}m ${secs}s`;
        let md = `# 🤖 MuseQA Autonomous Bug-Hunting Report\n\n`;
        md += `> **Target:** \`${summary.targetUrl}\`  \n`;
        md += `> **Run Date:** \`${summary.startTime}\`  \n`;
        md += `> **Duration:** \`${durationStr}\`  \n`;
        md += `> **Roles Explored:** ${summary.rolesExplored.map(r => `\`${r}\``).join(', ')}\n\n`;
        md += `## 📊 Executive Summary\n\n`;
        md += `| Metric | Value |\n`;
        md += `|---|---|\n`;
        md += `| **Total Pages Visited** | ${summary.totalPagesVisited} |\n`;
        md += `| **Total Forms Fuzzed** | ${summary.totalFormsFuzzed} |\n`;
        md += `| **Total APIs Discovered** | ${summary.totalApisDiscovered} |\n`;
        md += `| **Total Bugs Found** | **${summary.totalBugsFound}** |\n`;
        md += `| 🆕 **New Bugs Since Last Run** | **${summary.newBugsCount}** |\n`;
        md += `| ✅ **Potentially Fixed Bugs** | **${summary.fixedBugsCount}** |\n\n`;
        md += `### Breakdown by Severity\n\n`;
        md += `| 🔴 Critical | 🟠 High | 🟡 Medium | ⚪ Low |\n`;
        md += `|:---:|:---:|:---:|:---:|\n`;
        md += `| **${summary.bugsBySeverity.Critical || 0}** | **${summary.bugsBySeverity.High || 0}** | **${summary.bugsBySeverity.Medium || 0}** | **${summary.bugsBySeverity.Low || 0}** |\n\n`;
        if (summary.diff && (summary.diff.newBugs.length > 0 || summary.diff.fixedBugs.length > 0)) {
            md += `## 🔄 Run-over-Run Diff\n\n`;
            if (summary.diff.newBugs.length > 0) {
                md += `### 🆕 Newly Discovered Issues (${summary.diff.newBugs.length})\n`;
                for (const nb of summary.diff.newBugs) {
                    md += `- **[${nb.severity}]** ${nb.title} (\`${nb.role}\` @ \`${nb.url}\`)\n`;
                }
                md += `\n`;
            }
            if (summary.diff.fixedBugs.length > 0) {
                md += `### ✅ Potentially Resolved Issues (${summary.diff.fixedBugs.length})\n`;
                for (const fb of summary.diff.fixedBugs) {
                    md += `- **${fb.id}:** ${fb.title} (\`${fb.urlPattern}\`)\n`;
                }
                md += `\n`;
            }
        }
        md += `## 🐛 Detailed Discovered Bugs (${summary.bugs.length})\n\n`;
        const severities = ['Critical', 'High', 'Medium', 'Low'];
        for (const sev of severities) {
            const group = summary.bugs.filter(b => b.severity === sev);
            if (group.length === 0)
                continue;
            const emoji = sev === 'Critical' ? '🔴' : sev === 'High' ? '🟠' : sev === 'Medium' ? '🟡' : '⚪';
            md += `### ${emoji} ${sev} Severity (${group.length})\n\n`;
            for (const bug of group) {
                md += `#### ${bug.id}: ${bug.title}\n\n`;
                md += `- **Category:** \`${bug.category}\`\n`;
                md += `- **Role:** \`${bug.role}\`\n`;
                md += `- **URL / Endpoint:** \`${bug.url}\`\n`;
                if (bug.fieldName)
                    md += `- **Field:** \`${bug.fieldName}\`\n`;
                if (bug.inputValue)
                    md += `- **Trigger Value:** \`${bug.inputValue}\`\n`;
                md += `\n**Description:**  \n${bug.description}\n\n`;
                if (bug.stepsToReproduce && bug.stepsToReproduce.length > 0) {
                    md += `**Steps to Reproduce:**\n`;
                    bug.stepsToReproduce.forEach((step, idx) => {
                        md += `${idx + 1}. ${step}\n`;
                    });
                    md += `\n`;
                }
                md += `**Expected:** ${bug.expected}  \n`;
                md += `**Actual:** ${bug.actual}\n\n`;
                if (bug.screenshotPath) {
                    md += `![Screenshot](${bug.screenshotPath})\n\n`;
                }
                md += `---\n\n`;
            }
        }
        fs.writeFileSync(mdPath, md, 'utf-8');
        return mdPath;
    }
}
exports.BugReportGenerator = BugReportGenerator;
