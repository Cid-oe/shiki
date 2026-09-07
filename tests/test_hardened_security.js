/**
 * Hardened Security & Error-Boundary Test Suite
 * Asserts:
 * 1. MCP crash-on-error fix: unparseable JSON & unknown tool calls fail gracefully without killing process.
 * 2. Shell injection immunity: '$(touch ...)' payloads in desktop_notify do NOT execute.
 * 3. Trust-Ring boundary enforcement: default MCP client cannot call container_exec (Trust 2) without elevated context.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

async function runSecurityTests() {
  console.log("=========================================================");
  console.log("  Testing Security Hardening & MCP Error Boundaries      ");
  console.log("=========================================================\n");

  const mcpServerPath = path.join(__dirname, '../mcp-server/index.js');
  const mcp = spawn('node', [mcpServerPath]);
  let buffer = '';

  mcp.stdout.on('data', chunk => buffer += chunk.toString());

  function sendReq(reqString) {
    return new Promise((resolve) => {
      const startLen = buffer.length;
      const interval = setInterval(() => {
        const newContent = buffer.slice(startLen);
        const lines = newContent.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            clearInterval(interval);
            resolve(parsed);
            return;
          } catch (e) {}
        }
      }, 50);
      mcp.stdin.write(reqString + '\n');
    });
  }

  // 1. Test unparseable JSON
  console.log("[1/4] Testing unparseable JSON error boundary...");
  const parseErr = await sendReq("NOT_VALID_JSON{");
  assert.strictEqual(parseErr.error.code, -32700);
  console.log(" -> PASS: Returned JSON-RPC -32700 Parse Error gracefully.");

  // 2. Test unknown tool call (previously crashed server with ReferenceError)
  console.log("\n[2/4] Testing unknown tool error handling...");
  const unknownToolErr = await sendReq(JSON.stringify({
    jsonrpc: "2.0",
    id: 999,
    method: "tools/call",
    params: { name: "nonexistent_danger_tool", arguments: {} }
  }));
  assert.strictEqual(unknownToolErr.id, 999);
  assert.strictEqual(unknownToolErr.error.code, -32000);
  assert.ok(unknownToolErr.error.message.includes("is not registered"));
  console.log(" -> PASS: Server caught error, preserved reqId, and remained alive.");

  // 3. Test Shell Injection Immunity
  console.log("\n[3/4] Testing shell injection immunity in desktop_notify...");
  const probeFile = `/tmp/shiki_pwned_test_${Date.now()}`;
  if (fs.existsSync(probeFile)) fs.unlinkSync(probeFile);

  const injectionRes = await sendReq(JSON.stringify({
    jsonrpc: "2.0",
    id: 1000,
    method: "tools/call",
    params: {
      name: "desktop_notify",
      arguments: {
        title: "Test",
        message: `$(touch ${probeFile})`
      }
    }
  }));

  assert.strictEqual(fs.existsSync(probeFile), false, "CRITICAL: Shell command executed via injection!");
  console.log(" -> PASS: Shell injection payload treated strictly as argv data (no file created).");

  // 4. Test Trust-Ring Boundary Enforcement over MCP
  console.log("\n[4/4] Testing Trust-Ring permission boundary over MCP...");
  const unauthorizedRes = await sendReq(JSON.stringify({
    jsonrpc: "2.0",
    id: 1001,
    method: "tools/call",
    params: {
      name: "container_exec",
      arguments: {
        containerId: "demo",
        command: "ls"
      }
      // Note: No operator context supplied -> defaults to Zone 1 (Safe Interact)
    }
  }));

  assert.strictEqual(unauthorizedRes.error.code, -32000);
  assert.ok(unauthorizedRes.error.message.includes("Permission denied"));
  console.log(" -> PASS: Default MCP client blocked from executing Trust-2 (ENVIRONMENT_WRITE) capability.");

  mcp.kill();
  console.log("\n=========================================================");
  console.log("  ALL HARDENED SECURITY TESTS PASSED (4/4)               ");
  console.log("=========================================================\n");
}

runSecurityTests().catch(err => {
  console.error("SECURITY TEST FAILED:", err);
  process.exit(1);
});
