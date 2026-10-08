const os = require('os');
const https = require('https');

function detectVpn() {
  const interfaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        if (addr.address.startsWith('172.27.')) {
          return { active: true, ip: addr.address, name };
        }
        if (/openvpn|tap|tun|wintun/i.test(name)) {
          return { active: true, ip: addr.address, name };
        }
      }
    }
  }
  return { active: false };
}

function probePortal(url = 'https://idms-uat.qiplus.ae', timeoutMs = 3500) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      resolve({ reachable: true, statusCode: res.statusCode, latencyMs: Date.now() - start });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ reachable: false, error: 'Connection Timed Out (>3.5s)' });
    });
    req.on('error', (err) => {
      resolve({ reachable: false, error: err.message });
    });
  });
}

async function run() {
  console.log('\n============================================================');
  console.log('🔍 CHECKING OPENVPN & QIPLUS UAT PORTAL CONNECTIVITY');
  console.log('============================================================\n');

  const vpn = detectVpn();
  const probe = await probePortal();

  if (vpn.active) {
    console.log(`✅ [VPN STATUS]   : CONNECTED (OpenVPN Interface: "${vpn.name}", IP: ${vpn.ip})`);
  } else {
    console.log(`⚠️  [VPN STATUS]   : NOT DETECTED (No 172.27.x.x OpenVPN adapter found)`);
  }

  if (probe.reachable) {
    console.log(`✅ [TARGET SERVER]: REACHABLE (https://idms-uat.qiplus.ae - HTTP ${probe.statusCode}, Latency: ${probe.latencyMs}ms)`);
    console.log('\n🎉 ALL GOOD! Positive (P), Negative (N), and Regression (R) suites are READY to run.\n');
  } else {
    console.log(`❌ [TARGET SERVER]: UNREACHABLE (https://idms-uat.qiplus.ae)`);
    console.log(`⚠️  [ERROR REASON] : ${probe.error}`);
    console.log('\n------------------------------------------------------------');
    console.log('👉 PLEASE CONNECT TO OPENVPN:');
    console.log('   1. Open OpenVPN Connect application.');
    console.log('   2. Connect to Server: 52.28.135.83 (Profile: bhanu.challa@trueid.in).');
    console.log('   3. Re-run your tests once connected.');
    console.log('------------------------------------------------------------\n');
  }
}

run();
