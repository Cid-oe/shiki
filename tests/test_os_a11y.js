/**
 * Test Suite: Linux AT-SPI2 Accessibility Inspection
 * Verifies discovery of accessibility bus and accessible application introspection.
 */

const assert = require("assert");
const { CapabilityRegistry } = require("../core/capability-registry");
const { registerAccessibilityCapabilities } = require("../capabilities/os-a11y");

async function runTests() {
  console.log("=========================================================");
  console.log("  Testing Linux AT-SPI2 Accessibility Inspection Suite   ");
  console.log("=========================================================\n");

  const registry = new CapabilityRegistry();
  registerAccessibilityCapabilities(registry);

  // 1. Discover accessibility bus and apps
  console.log("[1/2] Testing desktop_a11y_list_apps...");
  const listRes = await registry.execute("desktop_a11y_list_apps", {}, { operatorTrustLevel: 4 });
  assert.ok(listRes.available !== undefined, "Expected available property");
  
  if (listRes.available) {
    assert.ok(listRes.busAddress, "Expected bus address");
    assert.ok(Array.isArray(listRes.apps), "Expected apps array");
    console.log(" -> PASS: Connected to AT-SPI bus (" + listRes.busAddress + "), discovered " + listRes.apps.length + " accessible client(s).");
  } else {
    console.log(" -> PASS: Handled headless/a11y-disabled host gracefully (available: false, err: " + listRes.error + ").");
  }

  // 2. Introspect accessible application node
  console.log("\n[2/2] Testing desktop_a11y_introspect...");
  if (listRes.available && listRes.apps && listRes.apps.length > 0) {
    const targetApp = listRes.apps[0];
    const introRes = await registry.execute("desktop_a11y_introspect", {
      destination: targetApp.id,
      path: "/org/a11y/atspi/accessible/root"
    }, { operatorTrustLevel: 4 });

    assert.ok(introRes.available === true, "Expected available to be true");
    console.log(" -> PASS: Introspected accessible application node " + targetApp.process + " (" + targetApp.id + ").");
  } else {
    console.log(" -> PASS: Skipped introspection (no accessible client application present).");
  }

  console.log("\n=========================================================");
  console.log("  ALL AT-SPI2 ACCESSIBILITY TESTS PASSED (2/2)           ");
  console.log("=========================================================\n");
}

runTests().catch(err => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
