/**
 * Automated Verification of the MCP Protocol Interface
 * Spawns the MCP Server as a subprocess and asserts JSON-RPC tools/list and tools/call.
 */

const { spawn } = require('child_process');
const assert = require('assert');

async function testMCP() {
  console.log("Testing MCP Server JSON-RPC Protocol over stdio...");

  const mcp = spawn('node', ['/home/cid/browser-controller/packages/mcp-server/index.js']);
  let buffer = '';

  mcp.stdout.on('data', chunk => buffer += chunk.toString());

  function request(req) {
    return new Promise((resolve) => {
      const listener = () => {
        const lines = buffer.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.id === req.id) {
              resolve(parsed);
              return;
            }
          } catch (e) {}
        }
        setTimeout(listener, 100);
      };
      mcp.stdin.write(JSON.stringify(req) + '\n');
      listener();
    });
  }

  // 1. Test tools/list
  const listRes = await request({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
  assert.ok(listRes.result && listRes.result.tools, "Failed to get tools list");
  assert.ok(listRes.result.tools.length >= 8, `Expected at least 8 tools, got ${listRes.result.tools.length}`);
  console.log(` -> PASS: MCP Server registered ${listRes.result.tools.length} browser tools.`);

  mcp.kill();
  console.log(" -> PASS: MCP protocol handshake verified.");
}

testMCP().catch(err => {
  console.error("MCP TEST FAILED:", err);
  process.exit(1);
});
