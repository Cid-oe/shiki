/**
 * Ambient Browser Capability Adapter
 * Bridges the tested BrowserService into the Universal Digital Execution Platform registry.
 */

const path = require('path');
const { BrowserService } = require(path.join(__dirname, '../packages/browser-controller/packages/core/browser-service'));

function registerBrowserCapabilities(registry, port = 9222) {
  const browser = new BrowserService(port);

  registry.register({
    name: "browser_list_tabs",
    version: "1.0.0",
    category: "browser",
    trustLevel: 0,
    description: "Discovers all open browser tabs across windows with titles, URLs, and debug endpoints.",
    schema: {
      type: "object",
      properties: { urlFilter: { type: "string" } }
    },
    handler: async ({ urlFilter }) => {
      return await browser.listTabs(urlFilter);
    }
  });

  registry.register({
    name: "browser_attach_and_navigate",
    version: "1.0.0",
    category: "browser",
    trustLevel: 1,
    description: "Attaches to an ambient tab and navigates to target URL.",
    schema: {
      type: "object",
      required: ["tabTarget", "url"],
      properties: {
        tabTarget: { description: "Tab ID or index" },
        url: { type: "string" }
      }
    },
    handler: async ({ tabTarget, url }) => {
      await browser.attach(tabTarget);
      return await browser.navigate(url);
    }
  });

  registry.register({
    name: "browser_inspect_security_gate",
    version: "1.0.0",
    category: "browser",
    trustLevel: 0,
    description: "Diagnoses whether the current page is blocked by Cloudflare Turnstile, reCAPTCHA, or human challenges.",
    schema: { type: "object", properties: {} },
    handler: async () => {
      return await browser.inspectSecurityGate();
    }
  });

  registry.register({
    name: "browser_fill_semantic",
    version: "1.0.0",
    category: "browser",
    trustLevel: 1,
    description: "Dispatches input into web fields matching accessibility names or placeholders.",
    schema: {
      type: "object",
      required: ["query", "value"],
      properties: {
        query: { type: "object" },
        value: { type: "string" }
      }
    },
    handler: async ({ query, value }) => {
      return await browser.fillSemantic(query, value);
    }
  });

  registry.register({
    name: "browser_click_semantic",
    version: "1.0.0",
    category: "browser",
    trustLevel: 1,
    description: "Clicks buttons, links, or actionable UI elements matching semantic roles or names.",
    schema: {
      type: "object",
      required: ["query"],
      properties: { query: { type: "object" } }
    },
    handler: async ({ query }) => {
      return await browser.clickSemantic(query);
    }
  });
}

module.exports = { registerBrowserCapabilities };
