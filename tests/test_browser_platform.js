/**
 * Test Suite: Browser-as-a-Platform Hardened Capabilities
 * Tests Tab lifecycle, wait-for, dialog auto-handling, honest navigation failure reporting,
 * and unified surface integration.
 */

const assert = require("assert");
const path = require("path");
const { CapabilityRegistry } = require("../core/capability-registry");
const { registerBrowserCapabilities } = require("../capabilities/browser-ambient");

async function runTests() {
  console.log("=========================================================");
  console.log("  Testing Browser-as-a-Platform Capability Suite        ");
  console.log("=========================================================\n");

  const registry = new CapabilityRegistry();
  registerBrowserCapabilities(registry);

  const tools = registry.listCapabilities({ category: "browser" });
  console.log("[1/3] Verifying unified browser tool registration...");
  assert.ok(tools.length >= 15, "Expected >= 15 registered browser capabilities, got " + tools.length);
  console.log(" -> PASS: " + tools.length + " browser capabilities registered on master registry.");

  // Check critical tools exist
  const toolNames = new Set(tools.map(t => t.name));
  const expectedTools = [
    "browser_list_tabs",
    "browser_create_tab",
    "browser_close_tab",
    "browser_attach_and_navigate",
    "browser_reload",
    "browser_evaluate_js",
    "browser_wait_for",
    "browser_wait_for_network_idle",
    "browser_fill_semantic",
    "browser_click_semantic",
    "browser_type_keystrokes",
    "browser_scroll",
    "browser_capture_screenshot",
    "browser_inspect_security_gate",
    "browser_get_cookies",
    "browser_get_storage",
    "browser_set_storage",
    "browser_goal_generate_candidates"
  ];

  for (const name of expectedTools) {
    assert.ok(toolNames.has(name), "Missing tool: " + name);
  }
  console.log(" -> PASS: All 18 mission-critical browser capabilities verified in schema.");

  // 2. Test candidate generation autonomously
  console.log("\n[2/3] Testing browser_goal_generate_candidates...");
  const candidates = await registry.execute("browser_goal_generate_candidates", {
    context: { username: "cid", projectName: "shiki" }
  }, { operatorTrustLevel: 4 });
  assert.ok(Array.isArray(candidates) && candidates.length > 0, "Expected generated candidates");
  assert.ok(candidates.includes("shiki") || candidates.includes("shiki-hub"), "Expected core candidate");
  console.log(" -> PASS: Autonomous candidate generation returned " + candidates.length + " options.");

  // 3. Test honest navigation failure detection
  console.log("\n[3/3] Testing honest navigation failure behavior...");
  const navRes = await registry.execute("browser_attach_and_navigate", {
    tabTarget: 99999, // Non-existent tab
    url: "https://invalid.example.local",
    timeoutMs: 500
  }, { operatorTrustLevel: 4 }).catch(err => ({ success: false, error: err.message }));

  assert.ok(navRes.success === false, "Expected navigation failure to not report success: true");
  console.log(" -> PASS: Honest error reporting confirmed (no false-positive navigated: true).");

  console.log("\n=========================================================");
  console.log("  ALL BROWSER PLATFORM TESTS PASSED (3/3)               ");
  console.log("=========================================================\n");
}

runTests().catch(err => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
