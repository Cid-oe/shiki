#!/usr/bin/env node
/**
 * Browser Controller MCP Server (Live Native Driver)
 * Connects directly to the ambient/headless browser target via the BrowserService core engine.
 */

const readline = require('readline');
const { BrowserService } = require('../core/browser-service');

const service = new BrowserService(9222, '127.0.0.1');

const TOOLS = [
  {
    name: "browser_list_tabs",
    description: "Returns all inspectable tabs from the browser with IDs, titles, and URLs.",
    inputSchema: {
      type: "object",
      properties: {
        urlFilter: { type: "string", description: "Optional URL filter pattern" }
      }
    }
  },
  {
    name: "browser_attach_tab",
    description: "Attaches controller to a target browser tab by tab ID or index.",
    inputSchema: {
      type: "object",
      required: ["tabTarget"],
      properties: {
        tabTarget: { description: "Tab ID (string) or index (number) or URL pattern" }
      }
    }
  },
  {
    name: "browser_navigate",
    description: "Navigates the currently attached tab to a specified URL and waits for page load.",
    inputSchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string", description: "Target URL to navigate to" }
      }
    }
  },
  {
    name: "browser_query_elements",
    description: "Queries interactive elements using semantic attributes (accessible role, name, placeholder).",
    inputSchema: {
      type: "object",
      properties: {
        role: { type: "string" },
        name: { type: "string" },
        placeholder: { type: "string" }
      }
    }
  },
  {
    name: "browser_fill_semantic",
    description: "Fills an input or textarea matching semantic name or placeholder.",
    inputSchema: {
      type: "object",
      required: ["query", "value"],
      properties: {
        query: {
          type: "object",
          properties: {
            name: { type: "string" },
            placeholder: { type: "string" }
          }
        },
        value: { type: "string" }
      }
    }
  },
  {
    name: "browser_click_semantic",
    description: "Clicks a button, link, or clickable element by semantic name or role.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: {
          type: "object",
          properties: {
            name: { type: "string" },
            role: { type: "string" }
          }
        }
      }
    }
  },
  {
    name: "browser_inspect_security_gate",
    description: "Inspects whether the active tab is blocked by Cloudflare Turnstile, reCAPTCHA, or human challenges.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "browser_capture_screenshot",
    description: "Captures a screenshot of the current page as base64 JPEG.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  }
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  if (!line.trim()) return;
  try {
    const request = JSON.parse(line);

    if (request.method === "tools/list") {
      console.log(JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        result: { tools: TOOLS }
      }));
      return;
    }

    if (request.method === "tools/call") {
      const { name, arguments: args } = request.params;
      let result;

      switch (name) {
        case "browser_list_tabs":
          result = await service.listTabs(args?.urlFilter);
          break;
        case "browser_attach_tab":
          result = await service.attach(args.tabTarget);
          break;
        case "browser_navigate":
          result = await service.navigate(args.url);
          break;
        case "browser_query_elements":
          result = await service.queryElements(args || {});
          break;
        case "browser_fill_semantic":
          result = await service.fillSemantic(args.query, args.value);
          break;
        case "browser_click_semantic":
          result = await service.clickSemantic(args.query);
          break;
        case "browser_inspect_security_gate":
          result = await service.inspectSecurityGate();
          break;
        case "browser_capture_screenshot":
          result = await service.captureScreenshot();
          break;
        default:
          throw new Error(`Tool ${name} not found`);
      }

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
