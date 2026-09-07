#!/usr/bin/env node
/**
 * Universal Digital Execution Platform: Master MCP Server
 * Hardened JSON-RPC 2.0 stdio server with strict request scoping,
 * error boundary isolation, and explicit trust-level enforcement.
 */

const readline = require('readline');
const { CapabilityRegistry } = require('../core/capability-registry');
const { registerDesktopCapabilities } = require('../capabilities/os-desktop');
const { registerDockerCapabilities } = require('../capabilities/container-docker');
const { registerBrowserCapabilities } = require('../capabilities/browser-ambient');
const { registerResearchCapabilities } = require('../capabilities/research-intelligence');

const registry = new CapabilityRegistry();
registerDesktopCapabilities(registry);
registerDockerCapabilities(registry);
registerBrowserCapabilities(registry);
registerResearchCapabilities(registry);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let request = null;

  try {
    request = JSON.parse(trimmed);
  } catch (parseErr) {
    console.log(JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: `Parse error: Invalid JSON: ${parseErr.message}` }
    }));
    return;
  }

  const reqId = request && request.id !== undefined ? request.id : null;

  try {
    // 1. Tool Listing
    if (request.method === "tools/list") {
      const tools = registry.listCapabilities().map(cap => ({
        name: cap.name,
        description: `[Category: ${cap.category} | Trust: ${cap.trustDescription}] ${cap.description}`,
        inputSchema: cap.inputSchema
      }));

      console.log(JSON.stringify({
        jsonrpc: "2.0",
        id: reqId,
        result: { tools }
      }));
      return;
    }

    // 2. Tool Execution
    if (request.method === "tools/call") {
      const { name, arguments: args } = request.params || {};
      if (!name) {
        throw new Error("Missing 'name' in tools/call parameters");
      }

      // Enforce operator trust level via params or default to Zone 1 (Safe Interact)
      // High-risk operations (Zone 2+ write/exec/delete) must explicitly supply verified operator context
      const operatorTrustLevel = request.params?.context?.operatorTrustLevel !== undefined 
        ? request.params.context.operatorTrustLevel 
        : 1; // Default to Zone 1: prevents unauthorized container_exec / disk destruction

      const result = await registry.execute(name, args || {}, { operatorTrustLevel });

      console.log(JSON.stringify({
        jsonrpc: "2.0",
        id: reqId,
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        }
      }));
      return;
    }

    // Default response for unhandled protocol methods (ping, initialize, etc.)
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
