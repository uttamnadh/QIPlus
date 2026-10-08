const net = require('net');

function checkBurpListener(host = '127.0.0.1', port = 8080) {
  console.log('\n============================================================');
  console.log('🔍 CHECKING BURP SUITE PROXY LISTENER STATUS');
  console.log('============================================================\n');

  const socket = new net.Socket();
  socket.setTimeout(2500);

  socket.on('connect', () => {
    console.log(`✅ [BURP STATUS]   : ONLINE (Proxy listening on ${host}:${port})`);
    console.log('💡 [READY TO RUN] : Execute tests with Burp proxy enabled:');
    console.log('   $env:BURP="true"; npx playwright test tests/positive/ --headed\n');
    socket.destroy();
    process.exit(0);
  });

  socket.on('timeout', () => {
    console.log(`❌ [BURP STATUS]   : OFFLINE / TIMEOUT (No response from ${host}:${port})`);
    console.log('⚠️ [HOW TO FIX]   : Start Burp Suite and verify Proxy Listener is active on 127.0.0.1:8080.\n');
    socket.destroy();
    process.exit(1);
  });

  socket.on('error', (err) => {
    console.log(`❌ [BURP STATUS]   : OFFLINE (${err.message})`);
    console.log('⚠️ [HOW TO FIX]   : Start Burp Suite and ensure Proxy Listener is active on 127.0.0.1:8080.\n');
    process.exit(1);
  });

  socket.connect(port, host);
}

checkBurpListener();
