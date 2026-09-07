#!/usr/bin/env node
/**
 * Browser Controller MCP Server (Unified Core Server)
 * Direct JSON-RPC 2.0 stdio server sharing the unified CapabilityRegistry backend.
 */

const path = require("path");
const readline = require("readline");
const { CapabilityRegistry } = require(path.join(__dirname, "../../../core/capability-registry"));
const { registerBrowserCapabilities } = require(path.join(__dirname, "../../../capabilities/browser-ambient"));

const registry = new CapabilityRegistry();
registerBrowserCapabilities(registry);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let request = null;
  try {
    request = JSON.parse(trimmed);
  } catch (err) {
    console.log(JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error: " + err.message }
    }));
    return;
  }

  const reqId = request && request.id !== undefined ? request.id : null;

  try {
    if (request.method === "tools/list") {
      const tools = registry.listCapabilities({ category: "browser" });
      console.log(JSON.stringify({
        jsonrpc: "2.0",
        id: reqId,
        result: { tools }
      }));
      return;
    }

    if (request.method === "tools/call") {
      const { name, arguments: args } = request.params;
      const result = await registry.execute(name, args || {}, { operatorTrustLevel: 4 });
      console.log(JSON.stringify({
        jsonrpc: "2.0",
        id: reqId,
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        }
      }));
      return;
    }

    console.log(JSON.stringify({
      jsonrpc: "2.0",
      id: reqId,
      result: {}
    }));
  } catch (err) {
    console.log(JSON.stringify({
      jsonrpc: "2.0",
      id: reqId,
      error: { code: -32000, message: err.message }
    }));
  }
});
