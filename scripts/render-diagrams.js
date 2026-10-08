const { execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const archifyCli = path.join(os.homedir(), '.agents', 'skills', 'archify', 'bin', 'archify.mjs');

if (!fs.existsSync(archifyCli)) {
  console.error(`Archify CLI not found at: ${archifyCli}`);
  process.exit(1);
}

const diagrams = [
  {
    type: 'architecture',
    input: 'docs/diagrams/qiplus-architecture.json',
    output: 'docs/diagrams/qiplus-architecture.html',
    flags: '--repo-root .'
  },
  {
    type: 'workflow',
    input: 'docs/diagrams/qiplus-onboarding-workflow.json',
    output: 'docs/diagrams/qiplus-onboarding-workflow.html',
    flags: '--repo-root .'
  },
  {
    type: 'lifecycle',
    input: 'docs/diagrams/qiplus-merchant-lifecycle.json',
    output: 'docs/diagrams/qiplus-merchant-lifecycle.html',
    flags: '--repo-root .'
  }
];

console.log('Rendering QiPlus Archify visual diagrams...\n');

for (const d of diagrams) {
  const cmd = `node "${archifyCli}" render ${d.type} "${d.input}" "${d.output}" ${d.flags}`.trim();
  console.log(`> ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log(`[PASS] Rendered ${d.output}\n`);
  } catch (err) {
    console.error(`[FAIL] Error rendering ${d.output}`);
    process.exit(1);
  }
}

console.log('All diagrams successfully rendered and verified!');
console.log('Open Developer Hub: docs/diagrams/index.html');
