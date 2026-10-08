const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 4500;
const STATE_FILE = path.join(__dirname, 'fixtures', 'state.json');
const REPORT_DIR = path.join(__dirname, 'playwright-report');

function getLatestState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch {}
  return {};
}

let activeProcess = null;
let clients = [];

function broadcastLog(data) {
  const message = `data: ${JSON.stringify({ type: 'log', text: data })}\n\n`;
  clients.forEach(res => res.write(message));
}

function broadcastStatus(status, details = {}) {
  const message = `data: ${JSON.stringify({ type: 'status', status, details })}\n\n`;
  clients.forEach(res => res.write(message));
}

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QiPlus IDMS - Onboarding Launchpad</title>
  <style>
    :root {
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --success: #10b981;
      --bg: #0f172a;
      --card: #1e293b;
      --text: #f8fafc;
      --text-dim: #94a3b8;
      --border: #334155;
      --input-bg: #0f172a;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 20px; display: flex; justify-content: center; }
    .container { max-width: 960px; width: 100%; display: flex; flex-direction: column; gap: 16px; }
    .header { display: flex; align-items: center; justify-content: space-between; background: var(--card); padding: 18px 22px; border-radius: 12px; border: 1px solid var(--border); }
    .header h1 { font-size: 1.35rem; display: flex; align-items: center; gap: 10px; }
    .badge { background: #064e3b; color: #34d399; font-size: 0.75rem; padding: 4px 10px; border-radius: 9999px; font-weight: 600; }
    
    /* Config Panel */
    .config-card { background: var(--card); padding: 20px; border-radius: 12px; border: 1px solid #3b82f6; display: flex; flex-direction: column; gap: 16px; }
    .config-title { font-size: 1.1rem; color: #60a5fa; font-weight: bold; display: flex; align-items: center; gap: 8px; }
    .config-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group label { font-size: 0.85rem; font-weight: 600; color: #cbd5e1; }
    .form-control { background: var(--input-bg); border: 1px solid var(--border); color: #fff; padding: 10px 12px; border-radius: 8px; font-size: 0.9rem; outline: none; }
    .form-control:focus { border-color: #60a5fa; }

    .btn-row { display: flex; gap: 8px; margin-top: 4px; }
    .pill-btn { background: #334155; border: none; color: #cbd5e1; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; cursor: pointer; }
    .pill-btn:hover { background: #475569; color: #fff; }

    /* Quick Presets Grid */
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
    .card { background: var(--card); padding: 16px; border-radius: 12px; border: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; }
    .card h3 { font-size: 1rem; color: #fff; }
    .card p { font-size: 0.8rem; color: var(--text-dim); line-height: 1.35; }
    
    .btn { background: var(--primary); color: white; border: none; padding: 12px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.95rem; transition: background 0.2s; }
    .btn:hover:not(:disabled) { background: var(--primary-hover); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-success { background: #059669; }
    .btn-success:hover:not(:disabled) { background: #047857; }
    .btn-outline { background: transparent; border: 1px solid var(--border); color: #cbd5e1; }
    .btn-outline:hover:not(:disabled) { background: #334155; }
    .btn-danger { background: #dc2626; }
    
    .terminal-container { background: #090d16; border-radius: 12px; border: 1px solid var(--border); overflow: hidden; display: flex; flex-direction: column; }
    .terminal-header { background: #161f30; padding: 10px 16px; font-size: 0.8rem; color: var(--text-dim); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); }
    .terminal { height: 320px; overflow-y: auto; padding: 16px; font-family: "Cascadia Code", Consolas, monospace; font-size: 0.85rem; line-height: 1.5; color: #e2e8f0; white-space: pre-wrap; word-break: break-all; }
    .pulse { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.2); } 100% { opacity: 1; transform: scale(1); } }
    .latest-card { background: #1e1b4b; border-color: #4338ca; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>🚀 QiPlus IDMS Onboarding Launchpad</h1>
        <p style="font-size:0.85rem; color:var(--text-dim); margin-top:4px;">Direct Browser Automation — Select Step Range & Records</p>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <a href="/report" target="_blank" class="btn btn-outline" style="padding:6px 14px; font-size:0.85rem; text-decoration:none; display:inline-flex; align-items:center; gap:6px;">📊 HTML Report ↗</a>
        <span class="badge"><span class="pulse"></span> READY</span>
      </div>
    </div>

    <!-- Interactive Configurator -->
    <div class="config-card">
      <div class="config-title">
        <span>⚙️ Custom Onboarding Configuration</span>
      </div>
      <div class="config-grid">
        <!-- Step Selection -->
        <div class="form-group">
          <label for="stepRange">🎯 Target Step Range (Stop at any step):</label>
          <select id="stepRange" class="form-control">
            <option value="8" selected>Step 1 to 8 (Full Submission — Review & Final Submit)</option>
            <option value="7">Step 1 to 7 (Draft with Documents)</option>
            <option value="6">Step 1 to 6 (Draft with Banking & Settlement)</option>
            <option value="5">Step 1 to 5 (Draft with Authorized Signatories)</option>
            <option value="4">Step 1 to 4 (Draft with UBOs)</option>
            <option value="3">Step 1 to 3 (Draft with Shareholders / Ownership)</option>
            <option value="2">Step 1 to 2 (Draft with Business & Contact Details)</option>
            <option value="1">Step 1 only (Draft with Merchant Profile / MRN Created)</option>
          </select>
          <div class="btn-row" style="flex-wrap: wrap; gap: 4px;">
            <button class="pill-btn" onclick="setStep(8)">1-8 Full</button>
            <button class="pill-btn" onclick="setStep(7)">1-7 Docs</button>
            <button class="pill-btn" onclick="setStep(6)">1-6 Bank</button>
            <button class="pill-btn" onclick="setStep(5)">1-5 Sign</button>
            <button class="pill-btn" onclick="setStep(4)">1-4 UBO</button>
            <button class="pill-btn" onclick="setStep(3)">1-3 Share</button>
            <button class="pill-btn" onclick="setStep(2)">1-2 Biz</button>
            <button class="pill-btn" onclick="setStep(1)">1 Prof</button>
          </div>
        </div>

        <!-- Record Count -->
        <div class="form-group">
          <label for="recordCount">🔢 Number of Records:</label>
          <input id="recordCount" type="number" min="1" max="50" value="1" class="form-control" />
          <div class="btn-row">
            <button class="pill-btn" onclick="setCount(1)">1</button>
            <button class="pill-btn" onclick="setCount(2)">2</button>
            <button class="pill-btn" onclick="setCount(3)">3</button>
            <button class="pill-btn" onclick="setCount(5)">5</button>
            <button class="pill-btn" onclick="setCount(10)">10</button>
          </div>
        </div>

        <!-- Shareholder Mode -->
        <div class="form-group">
          <label for="shareholderType">🏢 Shareholder Mode:</label>
          <select id="shareholderType" class="form-control">
            <option value="Individual" selected>Individual (Auto-UBO, Step 4 Pre-filled)</option>
            <option value="Entity">Corporate Entity (TL162770, Manual UBO)</option>
            <option value="Alternate">Alternate (Mix Individual & Entity)</option>
          </select>
        </div>

        <!-- Browser Mode -->
        <div class="form-group">
          <label for="browserMode">🌐 Browser Visibility:</label>
          <select id="browserMode" class="form-control">
            <option value="headed" selected>Visible Chromium (Watch Live)</option>
            <option value="chrome">Visible Google Chrome (Watch Live)</option>
            <option value="headless">Headless (Silent Background)</option>
          </select>
        </div>
      </div>

      <button id="btnCustomLaunch" class="btn btn-success" style="font-size:1.05rem; padding:14px;" onclick="triggerCustomRun()">
        ▶ Launch Onboarding Automation
      </button>
    </div>

    <!-- Latest Created Result Display -->
    <div id="latestResult" class="card latest-card" style="display:none;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <span style="font-size:0.8rem; color:#a5b4fc; text-transform:uppercase; font-weight:bold;">Latest Created Merchant</span>
          <h2 id="merchantTradeName" style="font-size:1.2rem; color:#fff; margin-top:2px;">—</h2>
          <p id="merchantMrn" style="font-size:0.9rem; color:#c7d2fe; font-family:monospace; margin-top:2px;">MRN: —</p>
          <p id="merchantStatus" style="font-size:0.85rem; color:#34d399; font-weight:600; margin-top:4px;">—</p>
        </div>
        <div style="display:flex; gap:10px; align-items:center;">
          <a href="/report" target="_blank" class="btn btn-outline" style="text-decoration:none; border-color:#6366f1; color:#a5b4fc;">
            📊 View Report ↗
          </a>
          <a id="portalLink" href="https://idms-uat.qiplus.ae" target="_blank" class="btn" style="background:#4f46e5; text-decoration:none;">
            Open Portal ↗
          </a>
        </div>
      </div>
    </div>

    <!-- Live Terminal Logs -->
    <div class="terminal-container">
      <div class="terminal-header">
        <span>LIVE AUTOMATION LOGS</span>
        <div style="display:flex; gap:8px;">
          <button id="btnStop" class="btn btn-danger" style="padding:4px 10px; font-size:0.75rem; display:none;" onclick="stopRun()">⏹ Stop</button>
          <button class="btn btn-outline" style="padding:4px 10px; font-size:0.75rem;" onclick="clearLogs()">Clear</button>
        </div>
      </div>
      <div id="terminal" class="terminal">Ready. Configure options above and click Launch, or use the Desktop shortcut.</div>
    </div>
  </div>

  <script>
    const terminal = document.getElementById('terminal');
    const btnCustomLaunch = document.getElementById('btnCustomLaunch');
    const btnStop = document.getElementById('btnStop');
    const latestResult = document.getElementById('latestResult');

    function setCount(num) {
      document.getElementById('recordCount').value = num;
    }

    function setStep(num) {
      document.getElementById('stepRange').value = String(num);
    }

    function appendLog(text) {
      terminal.innerText += text;
      terminal.scrollTop = terminal.scrollHeight;
    }

    function clearLogs() {
      terminal.innerText = '';
    }

    function setRunning(running) {
      btnCustomLaunch.disabled = running;
      btnStop.style.display = running ? 'inline-block' : 'none';
    }

    // Connect Server-Sent Events (SSE)
    const evtSource = new EventSource('/events');
    evtSource.onmessage = function(e) {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'log') {
          appendLog(msg.text);
        } else if (msg.type === 'status') {
          if (msg.status === 'running') {
            setRunning(true);
          } else if (msg.status === 'completed' || msg.status === 'failed' || msg.status === 'stopped') {
            setRunning(false);
            if (msg.details && msg.details.mrn) {
              latestResult.style.display = 'block';
              document.getElementById('merchantTradeName').innerText = msg.details.tradeName || 'New Merchant';
              document.getElementById('merchantMrn').innerText = 'MRN: ' + msg.details.mrn;
              const maxStep = msg.details.maxStep || 8;
              let statusText = 'Status: ❌ Execution Failed';
              if (msg.status === 'completed') {
                if (maxStep >= 8) {
                  statusText = 'Status: ✅ Submitted (Review)';
                } else if (maxStep === 1) {
                  statusText = 'Status: ✅ Step 1 Completed (Draft)';
                } else {
                  statusText = 'Status: ✅ Steps 1 to ' + maxStep + ' Completed (Draft)';
                }
              } else if (msg.status === 'stopped') {
                statusText = 'Status: ⏹ Stopped';
              }
              document.getElementById('merchantStatus').innerText = statusText;
            }
          }
        }
      } catch (err) {}
    };

    function triggerCustomRun() {
      const step = parseInt(document.getElementById('stepRange').value, 10) || 8;
      const count = document.getElementById('recordCount').value;
      const mode = document.getElementById('shareholderType').value;
      const browser = document.getElementById('browserMode').value;

      clearLogs();
      const stepLabel = step >= 8 ? 'Full (Step 1-8 Submit)' : (step === 1 ? 'Step 1 only' : 'Step 1 to ' + step);
      appendLog('[Launchpad] Starting onboarding: ' + count + ' record(s), Mode: ' + mode + ', Target: ' + stepLabel + ', Browser: ' + browser + '\\n');
      setRunning(true);

      const params = new URLSearchParams({
        mode: mode,
        count: count,
        step: step,
        browser: browser,
        headless: browser === 'headless' ? 'true' : 'false'
      });

      fetch('/run?' + params.toString(), { method: 'POST' });
    }

    function stopRun() {
      fetch('/stop', { method: 'POST' });
    }
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && parsedUrl.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML_CONTENT);
    return;
  }

  if (req.method === 'GET' && parsedUrl.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write(':\n\n');
    clients.push(res);
    req.on('close', () => {
      clients = clients.filter(c => c !== res);
    });
    return;
  }

  // Playwright HTML Report Static Serving
  if (req.method === 'GET' && (parsedUrl.pathname === '/report' || parsedUrl.pathname.startsWith('/report/'))) {
    let subPath = parsedUrl.pathname.slice('/report'.length);
    if (!subPath || subPath === '/' || subPath === '') {
      subPath = '/index.html';
    }
    const safePath = path.normalize(path.join(REPORT_DIR, subPath));
    if (!safePath.startsWith(REPORT_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }
    if (!fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
      if (subPath === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Playwright Report</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:16px;text-align:center;}</style>
</head>
<body>
  <h2>📊 No Playwright Report Available Yet</h2>
  <p style="color:#94a3b8;">Run an onboarding run from the Launchpad to generate your first report.</p>
  <a href="/" style="background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">← Back to Launchpad</a>
</body>
</html>`);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.zip': 'application/zip',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2'
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    fs.createReadStream(safePath).pipe(res);
    return;
  }

  if (req.method === 'POST' && parsedUrl.pathname === '/run') {
    if (activeProcess) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Process already running' }));
      return;
    }

    const mode = parsedUrl.searchParams.get('mode') || 'Individual';
    const count = parseInt(parsedUrl.searchParams.get('count') || '1', 10) || 1;
    const step = parseInt(parsedUrl.searchParams.get('step') || '8', 10) || 8;
    const browserParam = parsedUrl.searchParams.get('browser') || (parsedUrl.searchParams.get('headless') === 'true' ? 'headless' : 'headed');
    const isHeadless = browserParam === 'headless';
    const isChrome = browserParam === 'chrome';

    const args = [
      path.join(__dirname, 'run-wizard.js'),
      '--quick',
      `--mode=${mode}`,
      `--count=${count}`,
      `--max-step=${step}`
    ];

    if (isHeadless) {
      args.push('--headless');
    } else {
      args.push('--headed');
      if (isChrome) {
        args.push('--channel=chrome');
      }
    }

    broadcastStatus('running');
    const stepLabel = step >= 8 ? 'Full (Step 1-8 Submit)' : `Step 1 to ${step}`;
    broadcastLog(`\n============================================================\n`);
    broadcastLog(`🚀 LAUNCHING ONBOARDING BATCH (${count} records | ${stepLabel} | ${mode})\n`);
    broadcastLog(`============================================================\n\n`);

    activeProcess = spawn(process.execPath, args, {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      windowsHide: false
    });

    activeProcess.stdout.on('data', data => broadcastLog(data.toString()));
    activeProcess.stderr.on('data', data => broadcastLog(data.toString()));

    activeProcess.on('close', code => {
      activeProcess = null;
      const state = getLatestState();
      broadcastStatus(code === 0 ? 'completed' : 'failed', { ...state, maxStep: step, success: code === 0 });
      broadcastLog(`\n[Launchpad] Process finished with exit code ${code}.\n`);
      broadcastLog(`📊 Playwright Report: http://localhost:${PORT}/report\n`);
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'started', mode, count, step }));
    return;
  }

  if (req.method === 'POST' && parsedUrl.pathname === '/stop') {
    if (activeProcess) {
      activeProcess.kill();
      activeProcess = null;
      broadcastStatus('stopped');
      broadcastLog('\n[Launchpad] Process manually stopped by user.\n');
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'stopped' }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n============================================================`);
  console.log(`🚀 QiPlus Onboarding Launchpad Server active at:`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`============================================================\n`);
});
