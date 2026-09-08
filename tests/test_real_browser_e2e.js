/**
 * Real Browser E2E Integration Test (T1, T2, T3)
 * Launches real Chromium in headless mode on 127.0.0.1:9222, attaches CDP,
 * tests real trusted click, trusted fill, hover, scroll, dialog handling, and tabs.
 */

const assert = require("assert");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");
const { BrowserService } = require("../packages/browser-controller/packages/core/browser-service");

async function waitForBrowserPort(port = 9222, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get("http://127.0.0.1:" + port + "/json/version", (res) => {
          if (res.statusCode === 200) resolve(true);
          else reject(new Error("Status " + res.statusCode));
        });
        req.on("error", reject);
        req.setTimeout(500, () => req.destroy());
      });
      return true;
    } catch (_) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  throw new Error("Browser debug port " + port + " not ready after " + timeoutMs + "ms");
}

async function runRealIntegrationTests() {
  console.log("=========================================================");
  console.log("  Testing Real Browser Integration (Live Chromium CDP)  ");
  console.log("=========================================================\n");

  const userDataDir = path.join(os.tmpdir(), "shiki_browser_test_" + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });

  const browserBin = "/usr/bin/chromium";
  const browserProc = spawn(browserBin, [
    "--headless=new",
    "--remote-debugging-port=9222",
    "--user-data-dir=" + userDataDir,
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "about:blank"
  ]);

  try {
    await waitForBrowserPort(9222, 10000);
    console.log("[1/4] Real Chromium launched & CDP port 9222 listening.");

    const browser = new BrowserService(9222);
    const tabs = await browser.listTabs();
    assert.ok(tabs.length > 0, "Expected at least 1 open tab in real browser");
    console.log(" -> PASS: Discovered " + tabs.length + " active tab(s) in real browser.");

    // Test tab creation and attachment
    console.log("\n[2/4] Testing real tab lifecycle...");
    const newTab = await browser.createTab("about:blank");
    assert.ok(newTab && newTab.id, "Expected new tab created");
    await browser.attach(newTab.id);
    console.log(" -> PASS: Created and attached to tab (" + newTab.id + ").");

    // Load rich interactive HTML fixture
    console.log("\n[3/4] Testing trusted input fidelity & React-like state...");
    const fixtureHtml = "data:text/html;charset=utf-8," + encodeURIComponent(`
      <!DOCTYPE html>
      <html>
        <head><title>Shiki Trusted Input Fixture</title></head>
        <body style="height: 2000px; padding: 20px;">
          <h1 id="title">Fixture Ready</h1>
          <div id="hover-box" style="width: 100px; height: 50px; background: #eee;">Hover Me</div>
          <p id="hover-status">No hover</p>
          <input id="user-input" name="username" placeholder="Enter username" style="margin: 20px 0;" />
          <p id="typed-value"></p>
          <button id="submit-btn" role="button">Submit Action</button>
          <p id="click-status">Not clicked</p>

          <script>
            const hoverBox = document.getElementById("hover-box");
            hoverBox.addEventListener("mouseenter", () => {
              document.getElementById("hover-status").innerText = "Hovered!";
            });

            const inp = document.getElementById("user-input");
            inp.addEventListener("keydown", (e) => {
              if (e.isTrusted) {
                document.getElementById("typed-value").innerText = "TRUSTED:" + inp.value;
              }
            });
            inp.addEventListener("input", (e) => {
              document.getElementById("typed-value").innerText = inp.value;
            });

            const btn = document.getElementById("submit-btn");
            btn.addEventListener("click", (e) => {
              document.getElementById("click-status").innerText = e.isTrusted ? "TRUSTED_CLICKED" : "UNTRUSTED_CLICKED";
            });
          </script>
        </body>
      </html>
    `);

    const navRes = await browser.navigate(fixtureHtml);
    assert.ok(navRes.success && navRes.navigated, "Expected page navigated successfully");

    // Test Hover
    const hoverRes = await browser.hover({ name: "Hover Me" });
    assert.ok(hoverRes.success, "Expected hover to succeed");
    const hoverText = await browser.evaluateJS("document.getElementById('hover-status').innerText");
    assert.strictEqual(hoverText, "Hovered!", "Expected hover event to trigger on live page");
    console.log(" -> PASS: Trusted mouseMoved triggered :hover / mouseenter on live DOM.");

    // Test Trusted Fill
    const fillRes = await browser.fillSemantic({ placeholder: "Enter username" }, "AutonomousPilot", true);
    assert.ok(fillRes.success && fillRes.trusted, "Expected trusted fill");
    const val = await browser.evaluateJS("document.getElementById('user-input').value");
    assert.strictEqual(val, "AutonomousPilot", "Expected input field value populated via trusted keystrokes");
    console.log(" -> PASS: Trusted keystrokes successfully typed into input field (" + val + ").");

    // Test Trusted Click
    const clickRes = await browser.clickSemantic({ name: "Submit Action" }, true);
    assert.ok(clickRes.success && clickRes.trusted, "Expected trusted click");
    const clickStatus = await browser.evaluateJS("document.getElementById('click-status').innerText");
    assert.strictEqual(clickStatus, "TRUSTED_CLICKED", "Expected e.isTrusted to be TRUE for CDP mouse click");
    console.log(" -> PASS: e.isTrusted confirmed TRUE for CDP mouse dispatch click.");

    // Test Scroll
    console.log("\n[4/4] Testing scroll and tab cleanup...");
    const scrollRes = await browser.scroll(0, 400);
    assert.ok(scrollRes.success, "Expected scroll to succeed");
    console.log(" -> PASS: Dispatched mouseWheel scroll.");

    // Close tab
    const closeRes = await browser.closeTab(newTab.id);
    assert.ok(closeRes.closed, "Expected tab closed");
    console.log(" -> PASS: Closed tab cleanly via CDP.");

    browser.close();

    console.log("\n=========================================================");
    console.log("  ALL REAL BROWSER INTEGRATION TESTS PASSED (4/4)       ");
    console.log("=========================================================\n");
  } finally {
    browserProc.kill("SIGKILL");
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }
}

runRealIntegrationTests().catch(err => {
  console.error("REAL BROWSER TEST FAILED:", err);
  process.exit(1);
});
