/**
 * Automated Verification Suite for Browser Controller
 * Spawns an ephemeral headless target, attaches via CDPClient, executes semantic interactions,
 * inspects security gates, and verifies clean teardown.
 */

const { spawn } = require('child_process');
const http = require('http');
const assert = require('assert');
const { BrowserService } = require('../packages/core/browser-service');

async function runTests() {
  console.log("=========================================");
  console.log("  Running Browser Controller Test Suite  ");
  console.log("=========================================\n");

  const TEST_PORT = 9222;
  let browserProc = null;

  try {
    // 1. Launch a clean headless test target with CDP enabled
    console.log("[1/6] Launching test browser target on port", TEST_PORT, "...");
    browserProc = spawn('/usr/bin/brave', [
      '--headless=new',
      `--remote-debugging-port=${TEST_PORT}`,
      '--disable-gpu',
      '--no-first-run',
      '--user-data-dir=/tmp/brave-ctrl-test-i0zL55',
      'about:blank'
    ], { stdio: 'ignore' });

    // Wait for CDP port availability
    let ready = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 300));
      try {
        await new Promise((resolve, reject) => {
          http.get(`http://127.0.0.1:${TEST_PORT}/json/version`, res => resolve()).on('error', reject);
        });
        ready = true;
        break;
      } catch (e) {}
    }
    assert.strictEqual(ready, true, "Browser CDP port failed to respond");
    console.log(" -> PASS: Browser target online and listening.");

    // 2. Initialize BrowserService & list tabs
    console.log("\n[2/6] Testing session management & tab discovery...");
    const service = new BrowserService(TEST_PORT);
    const tabs = await service.listTabs();
    assert.ok(Array.isArray(tabs) && tabs.length > 0, "Failed to list browser tabs");
    console.log(` -> PASS: Discovered ${tabs.length} open tab(s).`);

    // 3. Attach and navigate to local HTML fixture
    console.log("\n[3/6] Testing attachment and semantic DOM engine...");
    await service.attach(tabs[0]);
    
    // Navigate to an inline data URI containing form fields and buttons
    const fixtureHtml = `
      data:text/html,
      <html>
        <body>
          <h2>Test Form</h2>
          <input type="text" name="username" placeholder="Enter username" />
          <input type="email" name="email" placeholder="Enter email" />
          <button id="submit-btn" role="button">Submit Order</button>
          <div id="result" style="display:none;">Order Placed</div>
          <script>
            document.getElementById('submit-btn').addEventListener('click', () => {
              document.getElementById('result').style.display = 'block';
            });
          </script>
        </body>
      </html>
    `;
    await service.navigate(fixtureHtml);

    // Query elements
    const elements = await service.queryElements({ role: 'button' });
    assert.ok(elements.length > 0, "Failed to locate button element");
    assert.strictEqual(elements[0].text, "Submit Order");
    console.log(" -> PASS: Semantic element resolution successful.");

    // 4. Test Semantic Fill
    console.log("\n[4/6] Testing semantic input filling...");
    const fillUser = await service.fillSemantic({ name: "username" }, "SeniorSystemsEngineer");
    assert.strictEqual(fillUser.success, true);
    const fillEmail = await service.fillSemantic({ placeholder: "email" }, "architect@system.local");
    assert.strictEqual(fillEmail.success, true);
    console.log(" -> PASS: Automated semantic form inputs dispatched.");

    // 5. Test Semantic Click & Interaction
    console.log("\n[5/6] Testing semantic click execution...");
    const clickRes = await service.clickSemantic({ name: "Submit Order" });
    assert.strictEqual(clickRes.success, true);
    console.log(" -> PASS: Click event triggered cleanly.");

    // 6. Test Security Gate Inspector
    console.log("\n[6/6] Testing security gate / anti-bot detector...");
    const gateStatus = await service.inspectSecurityGate();
    assert.strictEqual(gateStatus.hasChallenge, false);
    assert.strictEqual(gateStatus.type, 'none');
    console.log(" -> PASS: Security gate inspector accurately diagnosed challenge state.");

    service.close();
    console.log("\n=========================================");
    console.log("  ALL TESTS PASSED: 6/6 SUCCEEDED        ");
    console.log("=========================================\n");

  } finally {
    if (browserProc) {
      browserProc.kill();
    }
  }
}

runTests().catch(err => {
  console.error("\nTEST SUITE FAILED:", err);
  process.exit(1);
});
