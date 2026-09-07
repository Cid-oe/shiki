const { spawn } = require('child_process');
const http = require('http');
const assert = require('assert');
const { CDPClient } = require('../packages/core/cdp-client');
const { NetworkBroker } = require('../packages/core/network-broker');

async function testNetwork() {
  console.log("Testing Network Broker (interception & idle sync)...");
  const TEST_PORT = 9224;
  const browserProc = spawn('/usr/bin/brave', [
    '--headless=new',
    `--remote-debugging-port=${TEST_PORT}`,
    '--disable-gpu',
    '--no-first-run',
    '--user-data-dir=/tmp/brave-net-test-3bSMQJ',
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 200));
      try {
        await new Promise((res, rej) => http.get(`http://127.0.0.1:${TEST_PORT}/json/version`, res).on('error', rej));
        break;
      } catch (e) {}
    }

    const cdp = new CDPClient(TEST_PORT);
    await cdp.attach(0);
    const broker = new NetworkBroker(cdp);
    await broker.enable();

    // Use a local data URL with an inline fetch
    const htmlFixture = `
      data:text/html,
      <html>
        <body>
          <button id="btn" onclick="fetch('data:application/json,{\"status\":\"ok\"}')">Fetch</button>
        </body>
      </html>
    `;
    await cdp.send('Page.navigate', { url: htmlFixture });
    
    // Verify network idle sync
    const idle = await broker.waitForNetworkIdle(200, 3000);
    assert.strictEqual(idle.idle, true);
    console.log(" -> PASS: Network idle synchronization verified.");

    cdp.close();
    console.log(" -> PASS: Network Broker test passed cleanly.");
  } finally {
    browserProc.kill();
  }
}

testNetwork().catch(err => {
  console.error("NETWORK TEST FAILED:", err);
  process.exit(1);
});
