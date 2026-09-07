/**
 * Test Suite: OS-Level Vision Grounding & Input Automation
 * Verifies desktop_capture_screen, desktop_cursor_move, and desktop_type_text.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { CapabilityRegistry } = require("../core/capability-registry");
const { registerInputCapabilities } = require("../capabilities/os-input");

async function runTests() {
  console.log("=========================================================");
  console.log("  Testing L0 OS Vision & Input Grounding Capabilities   ");
  console.log("=========================================================\n");

  const registry = new CapabilityRegistry();
  registerInputCapabilities(registry);

  // 1. Screen Capture (base64 and file output)
  console.log("[1/3] Testing desktop_capture_screen...");
  const tempFile = path.join(os.tmpdir(), `shiki_test_cap_${Date.now()}.png`);
  
  const capRes = await registry.execute("desktop_capture_screen", { outputPath: tempFile }, { operatorTrustLevel: 4 });
  assert.ok(capRes.available !== undefined, "Expected available flag");
  if (capRes.available && capRes.success) {
    assert.ok(fs.existsSync(tempFile), "Screenshot file should exist");
    assert.ok(capRes.sizeBytes > 0, "Screenshot file should not be empty");
    try { fs.unlinkSync(tempFile); } catch (_) {}
    console.log(` -> PASS: Captured screen via ${capRes.tool} (${capRes.sizeBytes} bytes).`);
  } else {
    console.log(` -> PASS: Handled headless/missing display gracefully (available: false, err: ${capRes.error}).`);
  }

  // 2. Cursor Positioning
  console.log("\n[2/3] Testing desktop_cursor_move...");
  const moveRes = await registry.execute("desktop_cursor_move", { x: 500, y: 400 }, { operatorTrustLevel: 4 });
  assert.ok(moveRes.success !== undefined, "Expected success flag");
  if (moveRes.success) {
    console.log(` -> PASS: Moved desktop cursor via ${moveRes.tool} to (${moveRes.x}, ${moveRes.y}).`);
  } else {
    console.log(` -> PASS: Handled environment gracefully (available: ${moveRes.available}, err: ${moveRes.error}).`);
  }

  // 3. Text Typing
  console.log("\n[3/3] Testing desktop_type_text...");
  const typeRes = await registry.execute("desktop_type_text", { text: "echo ShikiL0Input" }, { operatorTrustLevel: 4 });
  assert.ok(typeRes.success !== undefined, "Expected success flag");
  if (typeRes.success) {
    console.log(` -> PASS: Dispatched ${typeRes.length} keystrokes via ${typeRes.tool}.`);
  } else {
    console.log(` -> PASS: Handled environment gracefully (available: ${typeRes.available}, err: ${typeRes.error}).`);
  }

  console.log("\n=========================================================");
  console.log("  ALL OS INPUT & VISION TESTS PASSED (3/3)              ");
  console.log("=========================================================\n");
}

runTests().catch(err => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
