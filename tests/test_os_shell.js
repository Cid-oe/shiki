/**
 * Automated Verification for Local Host Shell & Filesystem Capabilities
 * Tests:
 * 1. file_write -> file_read round trip in isolated scratch dir.
 * 2. file_list filtering and file_search (by name & content).
 * 3. shell_exec argv execution and shell syntax execution.
 * 4. shell_exec timeout behavior.
 * 5. Trust-Model v2 MCP protocol gating:
 *    - Default trust-1 connection cannot execute shell_exec (Trust 2: ENVIRONMENT_WRITE).
 *    - Trust self-elevation attempt (params.context = 4 on trust-1 connection) is rejected.
 *    - Initialize with trust 4 allows shell_exec execution.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { CapabilityRegistry } = require('../core/capability-registry');
const { registerShellCapabilities } = require('../capabilities/os-shell');

async function runTests() {
  console.log("=========================================================");
  console.log("  Testing Local Shell & Filesystem Capability Suite      ");
  console.log("=========================================================\n");

  const scratchDir = path.join(__dirname, '.scratch_shell_test');
  if (fs.existsSync(scratchDir)) fs.rmSync(scratchDir, { recursive: true, force: true });
  fs.mkdirSync(scratchDir, { recursive: true });

  const registry = new CapabilityRegistry();
  registerShellCapabilities(registry);

  try {
    // 1. In-process Filesystem Tests
    console.log("[1/5] Testing file_write & file_read roundtrip...");
    const testFile = path.join(scratchDir, 'test_write.txt');
    const writeRes = await registry.execute("file_write", {
      path: testFile,
      content: "Hello from Universal Execution Engine!"
    }, { operatorTrustLevel: 2 });
    assert.strictEqual(writeRes.success, true);

    const readRes = await registry.execute("file_read", { path: testFile }, { operatorTrustLevel: 0 });
    assert.strictEqual(readRes.content, "Hello from Universal Execution Engine!");
    console.log(" -> PASS: file_write and file_read verified.");

    // 2. Directory Listing & Bounded Search
    console.log("\n[2/5] Testing file_list & bounded file_search...");
    const listRes = await registry.execute("file_list", { path: scratchDir }, { operatorTrustLevel: 0 });
    assert.strictEqual(listRes.total, 1);
    assert.strictEqual(listRes.entries[0].name, 'test_write.txt');

    const searchRes = await registry.execute("file_search", {
      root: scratchDir,
      content: "Universal Execution"
    }, { operatorTrustLevel: 0 });
    assert.strictEqual(searchRes.totalMatches, 1);
    console.log(" -> PASS: file_list and content search verified.");

    // 3. Local Shell Execution (argv array & command string)
    console.log("\n[3/5] Testing local shell_exec execution...");
    const argvRes = await registry.execute("shell_exec", {
      argv: ["node", "-e", "console.log(6 * 7)"]
    }, { operatorTrustLevel: 2 });
    assert.strictEqual(argvRes.success, true);
    assert.strictEqual(argvRes.stdout, "42");

    const cmdRes = await registry.execute("shell_exec", {
      command: "echo 'first line' && echo 'second line'"
    }, { operatorTrustLevel: 2 });
    assert.strictEqual(cmdRes.success, true);
    assert.ok(cmdRes.stdout.includes("first line") && cmdRes.stdout.includes("second line"));
    console.log(" -> PASS: shell_exec (argv & /bin/sh -c) verified.");

    // 4. Shell Execution Timeout
    console.log("\n[4/5] Testing shell_exec timeout guard...");
    const timeoutRes = await registry.execute("shell_exec", {
      argv: ["node", "-e", "setTimeout(() => {}, 5000)"],
      timeoutMs: 400
    }, { operatorTrustLevel: 2 });
    assert.strictEqual(timeoutRes.timedOut, true);
    console.log(" -> PASS: Execution timeout aborted hung child process.");

    // 5. Trust Model v2 over MCP Server Stdio
    console.log("\n[5/5] Testing Trust Model v2 (no self-attestation bypass)...");
    const mcpServerPath = path.join(__dirname, '../mcp-server/index.js');
    const mcp = spawn('node', [mcpServerPath]);
    let buffer = '';
    mcp.stdout.on('data', chunk => buffer += chunk.toString());

    function sendMcp(req) {
      return new Promise((resolve) => {
        const startLen = buffer.length;
        const interval = setInterval(() => {
          const newContent = buffer.slice(startLen);
          const lines = newContent.split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.id === req.id) {
                clearInterval(interval);
                resolve(parsed);
                return;
              }
            } catch (_) {}
          }
        }, 40);
        mcp.stdin.write(JSON.stringify(req) + '\n');
      });
    }

    // Attempt shell_exec without initialize (default trust 1 < required 2)
    const uninitCall = await sendMcp({
      jsonrpc: "2.0",
      id: 201,
      method: "tools/call",
      params: {
        name: "shell_exec",
        arguments: { argv: ["node", "-v"] }
      }
    });
    assert.ok(uninitCall.error.message.includes("Permission denied"));
    console.log(" -> PASS: Default connection denied shell_exec (Trust 1 < 2).");

    // Attempt self-attestation elevation in params on a trust-1 connection
    const fakeElevateCall = await sendMcp({
      jsonrpc: "2.0",
      id: 202,
      method: "tools/call",
      params: {
        name: "shell_exec",
        arguments: { argv: ["node", "-v"] },
        context: { operatorTrustLevel: 4 } // Trying to self-elevate
      }
    });
    assert.ok(fakeElevateCall.error.message.includes("Permission denied"));
    console.log(" -> PASS: Self-attestation blocked: client cannot elevate above connection trust.");

    mcp.kill();

    // Now spawn a second connection initialized with trust 4
    const mcpElevated = spawn('node', [mcpServerPath]);
    let bufElevated = '';
    mcpElevated.stdout.on('data', chunk => bufElevated += chunk.toString());

    function sendElevated(req) {
      return new Promise((resolve) => {
        const startLen = bufElevated.length;
        const interval = setInterval(() => {
          const newContent = bufElevated.slice(startLen);
          const lines = newContent.split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.id === req.id) {
                clearInterval(interval);
                resolve(parsed);
                return;
              }
            } catch (_) {}
          }
        }, 40);
        mcpElevated.stdin.write(JSON.stringify(req) + '\n');
      });
    }

    const initRes = await sendElevated({
      jsonrpc: "2.0",
      id: 301,
      method: "initialize",
      params: { operatorTrustLevel: 4 }
    });
    assert.strictEqual(initRes.result.connectionTrustLevel, 4);

    const authorizedCall = await sendElevated({
      jsonrpc: "2.0",
      id: 302,
      method: "tools/call",
      params: {
        name: "shell_exec",
        arguments: { argv: ["node", "-e", "console.log('authorized-ok')"] }
      }
    });
    assert.ok(!authorizedCall.error, "Unexpected error: " + JSON.stringify(authorizedCall.error));
    assert.ok(authorizedCall.result.content[0].text.includes("authorized-ok"));
    console.log(" -> PASS: Authenticated/authorized Trust-4 connection executed shell_exec.");

    mcpElevated.kill();

    console.log("\n=========================================================");
    console.log("  ALL SHELL & FILESYSTEM TESTS PASSED (5/5)               ");
    console.log("=========================================================\n");

  } finally {
    if (fs.existsSync(scratchDir)) {
      fs.rmSync(scratchDir, { recursive: true, force: true });
    }
  }
}

runTests().catch(err => {
  console.error("OS-SHELL TEST FAILED:", err);
  process.exit(1);
});
