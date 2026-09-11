import * as fs from 'fs';
import * as path from 'path';
import { AgentRunSummary, Bug, Severity } from '../types';

export class BugReportGenerator {
  private outputDir: string;

  constructor(outputDir = 'agent-results') {
    this.outputDir = path.resolve(process.cwd(), outputDir);
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Write machine-readable JSON report
   */
  async generateJSON(summary: AgentRunSummary): Promise<string> {
    const jsonPath = path.join(this.outputDir, 'agent-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf-8');
    return jsonPath;
  }

  /**
   * Write human-readable GitHub Flavored Markdown report
   */
  async generateMarkdown(summary: AgentRunSummary): Promise<string> {
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

    const severities: Severity[] = ['Critical', 'High', 'Medium', 'Low'];

    for (const sev of severities) {
      const group = summary.bugs.filter(b => b.severity === sev);
      if (group.length === 0) continue;

      const emoji = sev === 'Critical' ? '🔴' : sev === 'High' ? '🟠' : sev === 'Medium' ? '🟡' : '⚪';
      md += `### ${emoji} ${sev} Severity (${group.length})\n\n`;

      for (const bug of group) {
        md += `#### ${bug.id}: ${bug.title}\n\n`;
        md += `- **Category:** \`${bug.category}\`\n`;
        md += `- **Role:** \`${bug.role}\`\n`;
        md += `- **URL / Endpoint:** \`${bug.url}\`\n`;
        if (bug.fieldName) md += `- **Field:** \`${bug.fieldName}\`\n`;
        if (bug.inputValue) md += `- **Trigger Value:** \`${bug.inputValue}\`\n`;
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
