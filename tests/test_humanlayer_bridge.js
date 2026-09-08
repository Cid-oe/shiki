/**
 * Test Suite: HumanLayer Out-of-Band Human Approval & Daemon Bridge
 * Tests approval dispatch, status polling, decision resolution, and daemon checks.
 */

const assert = require("assert");
const { CapabilityRegistry } = require("../core/capability-registry");
const { registerHumanLayerCapabilities, HumanLayerBridge } = require("../capabilities/humanlayer-bridge");

async function runTests() {
  console.log("=========================================================");
  console.log("  Testing HumanLayer Human-in-the-Loop & Daemon Bridge   ");
  console.log("=========================================================\n");

  const registry = new CapabilityRegistry();
  const bridge = new HumanLayerBridge();
  registerHumanLayerCapabilities(registry, bridge);

  // 1. Dispatch an out-of-band approval request
  console.log("[1/3] Testing humanlayer_request_approval...");
  const reqRes = await registry.execute("humanlayer_request_approval", {
    title: "Approve Domain Purchase for cidoe.org",
    description: "Financial operation: Requesting $12.00 charge on company card for domain registration.",
    category: "CRITICAL_APPROVAL",
    timeoutSeconds: 60
  }, { operatorTrustLevel: 4 });

  assert.ok(reqRes && reqRes.id, "Expected generated approval ID");
  assert.strictEqual(reqRes.status, "PENDING", "Initial status should be PENDING");
  console.log(" -> PASS: Created approval request (" + reqRes.id + ") with status PENDING.");

  // 2. Poll approval status
  console.log("\n[2/3] Testing humanlayer_check_approval...");
  const checkRes = await registry.execute("humanlayer_check_approval", { approvalId: reqRes.id }, { operatorTrustLevel: 4 });
  assert.ok(checkRes.found, "Approval request should be found");
  assert.strictEqual(checkRes.status, "PENDING", "Status should still be PENDING");
  console.log(" -> PASS: Polled approval status successfully.");

  // 3. Resolve approval (Operator approves)
  console.log("\n[3/3] Testing humanlayer_resolve_approval & daemon status...");
  const resolveRes = await registry.execute("humanlayer_resolve_approval", {
    approvalId: reqRes.id,
    decision: "APPROVED",
    reason: "Approved by Sid via mobile"
  }, { operatorTrustLevel: 4 });

  assert.strictEqual(resolveRes.status, "APPROVED", "Status should transition to APPROVED");
  assert.strictEqual(resolveRes.resolutionReason, "Approved by Sid via mobile");
  console.log(" -> PASS: Approval resolved with decision APPROVED.");

  const daemonStatus = await registry.execute("humanlayer_daemon_status", {}, { operatorTrustLevel: 4 });
  assert.ok(daemonStatus !== undefined, "Expected daemon status check");
  console.log(" -> PASS: Daemon check completed (installed: " + daemonStatus.installed + ").");

  console.log("\n=========================================================");
  console.log("  ALL HUMANLAYER INTEGRATION TESTS PASSED (3/3)          ");
  console.log("=========================================================\n");
}

runTests().catch(err => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
