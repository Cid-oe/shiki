#!/usr/bin/env node
/**
 * Universal Digital Execution Platform: Master MCP Server
 * Hardened JSON-RPC 2.0 stdio server with Trust Model v2:
 * - Connection-scoped trust established at 'initialize' (default 1, validated integer 0-4).
 * - Per-call params.context.operatorTrustLevel can only LOWER trust, never elevate.
 * - Non-integer or malformed trust inputs default-deny (revert to connectionTrust or 0).
 */

const readline = require('readline');
const { CapabilityRegistry } = require('../core/capability-registry');
const { registerDesktopCapabilities } = require('../capabilities/os-desktop');
const { registerDockerCapabilities } = require('../capabilities/container-docker');
const { registerBrowserCapabilities } = require('../capabilities/browser-ambient');
const { registerResearchCapabilities } = require('../capabilities/research-intelligence');
const { registerShellCapabilities } = require('../capabilities/os-shell');
const { registerInputCapabilities } = require('../capabilities/os-input');
const { registerAccessibilityCapabilities } = require('../capabilities/os-a11y');

const registry = new CapabilityRegistry();
registerDesktopCapabilities(registry);
registerDockerCapabilities(registry);
registerBrowserCapabilities(registry);
registerResearchCapabilities(registry);
registerShellCapabilities(registry);
registerInputCapabilities(registry);
registerAccessibilityCapabilities(registry);

// Trust level human-readable names
const TRUST_NAMES = {
  0: 'PASSIVE_READ',
  1: 'ACTIVE_INTERACT',
  2: 'ENVIRONMENT_WRITE',
  3: 'SENSITIVE_AUTH',
  4: 'CRITICAL_APPROVAL'
};

// Connection-scoped trust grant (defaults to Zone 1)
let connectionTrust = 1;

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
    // 1. Connection Handshake (Trust Model v2: Establish connection trust)
    if (request.method === "initialize") {
      const claimed = request.params?.operatorTrustLevel;
      if (claimed !== undefined) {
        if (!Number.isInteger(claimed) || claimed < 0 || claimed > 4) {
          console.log(JSON.stringify({
            jsonrpc: "2.0",
            id: reqId,
            error: { code: -32602, message: `Invalid operatorTrustLevel: must be integer 0-4, received ${JSON.stringify(claimed)}` }
          }));
          return;
        }
        connectionTrust = claimed;
      }

      console.log(JSON.stringify({
        jsonrpc: "2.0",
        id: reqId,
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: { name: "shiki-master", version: "1.0.0" },
          connectionTrustLevel: connectionTrust,
          trustDescription: TRUST_NAMES[connectionTrust]
        }
      }));
      return;
    }

    // 2. Tool Listing
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

    // 3. Tool Execution
    if (request.method === "tools/call") {
      const { name, arguments: args } = request.params || {};
      if (!name) {
        throw new Error("Missing 'name' in tools/call parameters");
      }

      // Trust Model v2 Enforcement:
      // A per-call context.operatorTrustLevel can only LOWER privilege (min), never raise above connectionTrust.
      const requested = request.params?.context?.operatorTrustLevel;
      let effectiveTrust = connectionTrust;

      if (requested !== undefined) {
        if (Number.isInteger(requested) && requested >= 0 && requested <= 4) {
          effectiveTrust = Math.min(connectionTrust, requested);
        } else {
          // Default-deny on non-integer/malformed input: force lowest privilege (0)
          effectiveTrust = 0;
        }
      }

      const result = await registry.execute(name, args || {}, { operatorTrustLevel: effectiveTrust });

      console.log(JSON.stringify({
        jsonrpc: "2.0",
        id: reqId,
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        }
      }));
      return;
    }

    // Default response for unhandled protocol methods
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
