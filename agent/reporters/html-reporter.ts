import * as fs from 'fs';
import * as path from 'path';
import { AgentRunSummary } from '../types';

export class HtmlReporter {
  private outputDir: string;

  constructor(outputDir = 'agent-results') {
    this.outputDir = path.resolve(process.cwd(), outputDir);
  }

  async generateHTML(summary: AgentRunSummary): Promise<string> {
    const htmlPath = path.join(this.outputDir, 'agent-report.html');

    const durationSec = Math.round(summary.durationMs / 1000);
    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;

    const bugsJson = JSON.stringify(summary.bugs);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MuseQA Autonomous QA Dashboard</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --critical: #ef4444;
      --high: #f97316;
      --medium: #eab308;
      --low: #3b82f6;
      --success: #10b981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 24px; }
    .container { max-width: 1200px; margin: 0 auto; }
    header { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
    h1 { font-size: 24px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
    .meta { color: var(--text-muted); font-size: 14px; margin-top: 4px; }
    
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
    .stat-title { font-size: 12px; text-transform: uppercase; color: var(--text-muted); font-weight: 600; }
    .stat-value { font-size: 28px; font-weight: 800; margin-top: 6px; }
    .stat-crit { color: var(--critical); }
    .stat-high { color: var(--high); }
    .stat-med { color: var(--medium); }
    .stat-low { color: var(--low); }

    .controls { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    input[type="text"] { background: var(--card-bg); border: 1px solid var(--border); color: #fff; padding: 8px 14px; border-radius: 6px; flex: 1; min-width: 250px; font-size: 14px; }
    .filter-btn { background: var(--card-bg); border: 1px solid var(--border); color: var(--text-muted); padding: 8px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; }
    .filter-btn.active { background: #2563eb; color: #fff; border-color: #2563eb; }

    .bugs-list { display: flex; flex-direction: column; gap: 16px; }
    .bug-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 18px; transition: border-color 0.2s; }
    .bug-card:hover { border-color: #475569; }
    .bug-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .bug-title { font-size: 16px; font-weight: 600; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .badge-Critical { background: rgba(239, 68, 68, 0.2); color: var(--critical); border: 1px solid var(--critical); }
    .badge-High { background: rgba(249, 115, 22, 0.2); color: var(--high); border: 1px solid var(--high); }
    .badge-Medium { background: rgba(234, 179, 8, 0.2); color: var(--medium); border: 1px solid var(--medium); }
    .badge-Low { background: rgba(59, 130, 246, 0.2); color: var(--low); border: 1px solid var(--low); }
    
    .bug-meta { font-size: 12px; color: var(--text-muted); margin-top: 6px; display: flex; gap: 16px; flex-wrap: wrap; }
    .bug-desc { margin-top: 12px; font-size: 14px; color: #cbd5e1; line-height: 1.5; white-space: pre-line; }
    .steps-box { margin-top: 12px; background: #0b1120; padding: 12px; border-radius: 6px; font-size: 13px; }
    .steps-title { font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700; margin-bottom: 6px; }
    .screenshot-thumb { margin-top: 12px; max-width: 100%; max-height: 350px; border-radius: 6px; border: 1px solid var(--border); cursor: pointer; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>🤖 MuseQA Autonomous Bug-Hunting Dashboard</h1>
        <div class="meta">Target: <b>${summary.targetUrl}</b> | Duration: <b>${mins}m ${secs}s</b> | Executed: <b>${new Date(summary.startTime).toLocaleString()}</b></div>
      </div>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-title">Total Bugs</div>
        <div class="stat-value">${summary.totalBugsFound}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Critical</div>
        <div class="stat-value stat-crit">${summary.bugsBySeverity.Critical || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">High</div>
        <div class="stat-value stat-high">${summary.bugsBySeverity.High || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Medium</div>
        <div class="stat-value stat-med">${summary.bugsBySeverity.Medium || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Low</div>
        <div class="stat-value stat-low">${summary.bugsBySeverity.Low || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Pages Visited</div>
        <div class="stat-value">${summary.totalPagesVisited}</div>
      </div>
    </div>

    <div class="controls">
      <input type="text" id="searchInput" placeholder="Search bugs by title, URL, role, field...">
      <button class="filter-btn active" onclick="filterBugs('All')">All</button>
      <button class="filter-btn" onclick="filterBugs('Critical')">Critical</button>
      <button class="filter-btn" onclick="filterBugs('High')">High</button>
      <button class="filter-btn" onclick="filterBugs('Medium')">Medium</button>
      <button class="filter-btn" onclick="filterBugs('Low')">Low</button>
    </div>

    <div class="bugs-list" id="bugsList"></div>
  </div>

  <script>
    const BUGS = ${bugsJson};
    let currentFilter = 'All';

    function renderBugs() {
      const list = document.getElementById('bugsList');
      const query = document.getElementById('searchInput').value.toLowerCase();

      const filtered = BUGS.filter(b => {
        const matchesFilter = currentFilter === 'All' || b.severity === currentFilter;
        const matchesQuery = !query ||
          b.title.toLowerCase().includes(query) ||
          b.url.toLowerCase().includes(query) ||
          b.role.toLowerCase().includes(query) ||
          (b.fieldName && b.fieldName.toLowerCase().includes(query));
        return matchesFilter && matchesQuery;
      });

      if (filtered.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding: 40px; color: #64748b;">No matching issues found.</div>';
        return;
      }

      list.innerHTML = filtered.map(b => \`
        <div class="bug-card">
          <div class="bug-header">
            <div>
              <div class="bug-title">\${b.id ? b.id + ': ' : ''}\${escapeHtml(b.title)}</div>
              <div class="bug-meta">
                <span>Role: <b>\${b.role}</b></span>
                <span>Category: <b>\${b.category}</b></span>
                <span>URL: <code>\${b.url}</code></span>
              </div>
            </div>
            <span class="badge badge-\${b.severity}">\${b.severity}</span>
          </div>
          <div class="bug-desc">\${escapeHtml(b.description)}</div>
          \${b.stepsToReproduce && b.stepsToReproduce.length ? \`
            <div class="steps-box">
              <div class="steps-title">Steps to Reproduce</div>
              <ol style="margin-left: 18px;">
                \${b.stepsToReproduce.map(s => \`<li>\${escapeHtml(s)}</li>\`).join('')}
              </ol>
            </div>
          \` : ''}
          \${b.screenshotPath ? \`<img class="screenshot-thumb" src="\${b.screenshotPath}" alt="Screenshot">\` : ''}
        </div>
      \`).join('');
    }

    function filterBugs(severity) {
      currentFilter = severity;
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.innerText === severity);
      });
      renderBugs();
    }

    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    document.getElementById('searchInput').addEventListener('input', renderBugs);
    renderBugs();
  </script>
</body>
</html>`;

    fs.writeFileSync(htmlPath, html, 'utf-8');
    return htmlPath;
  }
}
