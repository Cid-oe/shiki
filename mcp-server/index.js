#!/usr/bin/env node
/**
 * Universal Digital Execution Platform: Master MCP Server
 * Exposes all registered capabilities (Desktop, Browser, Containers, Research & Intelligence)
 * to any client AI agent via standard JSON-RPC 2.0.
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
  if (!line.trim()) return;
  try {
    const request = JSON.parse(line);

    // List all dynamic capabilities as standard MCP tools
    if (request.method === "tools/list") {
      const tools = registry.listCapabilities().map(cap => ({
        name: cap.name,
        description: `[Category: ${cap.category} | Trust: ${cap.trustDescription}] ${cap.description}`,
        inputSchema: cap.inputSchema
      }));

      console.log(JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        result: { tools }
      }));
      return;
    }

    // Dispatch execution through the permission-enforced Capability Registry
    if (request.method === "tools/call") {
      const { name, arguments: args } = request.params;
      const result = await registry.execute(name, args || {});

      console.log(JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        }
      }));
      return;
    }

    console.log(JSON.stringify({
      jsonrpc: "2.0",
      id: request.id,
      result: {}
    }));
  } catch (err) {
    console.log(JSON.stringify({
      jsonrpc: "2.0",
      id: request?.id || null,
      error: { code: -32000, message: err.message }
    }));
  }
});
