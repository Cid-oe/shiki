/**
 * Ambient Browser Capability Adapter
 * Bridges the tested BrowserService, NetworkBroker, SecurityHandoff, and GoalCompletion
 * into the Universal Digital Execution Platform registry and Master MCP Server.
 */

const path = require("path");
const { 
  BrowserService, 
  NetworkBroker, 
  SecurityHandoffEngine, 
  GoalAutonomousCompletionEngine 
} = require(path.join(__dirname, "../packages/browser-controller/packages/core/browser-service"));

function registerBrowserCapabilities(registry, port = 9222) {
  const browser = new BrowserService(port);

  // 1. Tab Management
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
    handler: async ({ urlFilter } = {}) => {
      return await browser.listTabs(urlFilter);
    }
  });

  registry.register({
    name: "browser_create_tab",
    version: "1.0.0",
    category: "browser",
    trustLevel: 1,
    description: "Creates a new browser tab navigating to the given URL.",
    schema: {
      type: "object",
      properties: { url: { type: "string", default: "about:blank" } }
    },
    handler: async ({ url = "about:blank" } = {}) => {
      return await browser.createTab(url);
    }
  });

  registry.register({
    name: "browser_close_tab",
    version: "1.0.0",
    category: "browser",
    trustLevel: 1,
    description: "Closes a browser tab by target ID.",
    schema: {
      type: "object",
      required: ["targetId"],
      properties: { targetId: { type: "string" } }
    },
    handler: async ({ targetId }) => {
      return await browser.closeTab(targetId);
    }
  });

  // 2. Navigation & Reload
  registry.register({
    name: "browser_attach_and_navigate",
    version: "1.0.0",
    category: "browser",
    trustLevel: 1,
    description: "Attaches to a browser tab and navigates with honest status reporting (timeout/failure detection).",
    schema: {
      type: "object",
      required: ["tabTarget", "url"],
      properties: {
        tabTarget: { description: "Tab ID or index" },
        url: { type: "string" },
        timeoutMs: { type: "number", default: 12000 }
      }
    },
    handler: async ({ tabTarget, url, timeoutMs = 12000 }) => {
      await browser.attach(tabTarget);
      return await browser.navigate(url, "load", timeoutMs);
    }
  });

  registry.register({
    name: "browser_reload",
    version: "1.0.0",
    category: "browser",
    trustLevel: 1,
    description: "Reloads the currently attached browser page.",
    schema: {
      type: "object",
      properties: { ignoreCache: { type: "boolean", default: false } }
    },
    handler: async ({ ignoreCache = false } = {}) => {
      return await browser.reload(ignoreCache);
    }
  });

  // 3. Execution & Evaluation
  registry.register({
    name: "browser_evaluate_js",
    version: "1.0.0",
    category: "browser",
    trustLevel: 2,
    description: "Executes arbitrary JavaScript in the context of the currently attached page and returns value.",
    schema: {
      type: "object",
      required: ["expression"],
      properties: { expression: { type: "string" } }
    },
    handler: async ({ expression }) => {
      return await browser.evaluateJS(expression);
    }
  });

  // 4. Synchronization & Wait Primitives
  registry.register({
    name: "browser_wait_for",
    version: "1.0.0",
    category: "browser",
    trustLevel: 0,
    description: "Waits for a CSS selector or JavaScript expression condition to be satisfied before proceeding.",
    schema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        condition: { type: "string" },
        timeoutMs: { type: "number", default: 10000 }
      }
    },
    handler: async ({ selector, condition, timeoutMs = 10000 }) => {
      if (selector) return await browser.waitForSelector(selector, timeoutMs);
      if (condition) return await browser.waitForCondition(condition, timeoutMs);
      throw new Error("Must specify either selector or condition");
    }
  });

  registry.register({
    name: "browser_wait_for_network_idle",
    version: "1.0.0",
    category: "browser",
    trustLevel: 0,
    description: "Waits until in-flight network requests quiet down (e.g. for SPAs and AJAX completions).",
    schema: {
      type: "object",
      properties: {
        idleTimeMs: { type: "number", default: 500 },
        timeoutMs: { type: "number", default: 15000 }
      }
    },
    handler: async ({ idleTimeMs = 500, timeoutMs = 15000 } = {}) => {
      return await browser.networkBroker.waitForNetworkIdle(idleTimeMs, timeoutMs);
    }
  });

  // 5. Semantic & Trusted DOM Actions
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
    description: "Clicks elements with optional CDP trusted mouse events (mouseMoved, mousePressed, mouseReleased).",
    schema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "object" },
        useTrusted: { type: "boolean", default: false }
      }
    },
    handler: async ({ query, useTrusted = false }) => {
      return await browser.clickSemantic(query, useTrusted);
    }
  });

  registry.register({
    name: "browser_type_keystrokes",
    version: "1.0.0",
    category: "browser",
    trustLevel: 1,
    description: "Types text using trusted CDP Input.dispatchKeyEvent (keyDown, keyUp) character-by-character.",
    schema: {
      type: "object",
      required: ["text"],
      properties: { text: { type: "string" } }
    },
    handler: async ({ text }) => {
      return await browser.typeKeystrokes(text);
    }
  });

  registry.register({
    name: "browser_scroll",
    version: "1.0.0",
    category: "browser",
    trustLevel: 1,
    description: "Scrolls viewport via CDP mouseWheel event.",
    schema: {
      type: "object",
      properties: {
        deltaX: { type: "number", default: 0 },
        deltaY: { type: "number", default: 300 }
      }
    },
    handler: async ({ deltaX = 0, deltaY = 300 } = {}) => {
      return await browser.scroll(deltaX, deltaY);
    }
  });

  // 6. Inspection & Screenshots
  registry.register({
    name: "browser_capture_screenshot",
    version: "1.0.0",
    category: "browser",
    trustLevel: 0,
    description: "Captures a screenshot of the attached page as base64 JPEG.",
    schema: { type: "object", properties: {} },
    handler: async () => {
      return await browser.captureScreenshot();
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

  // 7. Storage & Session Persistence
  registry.register({
    name: "browser_get_cookies",
    version: "1.0.0",
    category: "browser",
    trustLevel: 1,
    description: "Retrieves browser cookies for domain/session verification.",
    schema: {
      type: "object",
      properties: { urls: { type: "array", items: { type: "string" } } }
    },
    handler: async ({ urls = [] } = {}) => {
      return await browser.getCookies(urls);
    }
  });

  registry.register({
    name: "browser_get_storage",
    version: "1.0.0",
    category: "browser",
    trustLevel: 1,
    description: "Reads localStorage data from the attached web origin.",
    schema: {
      type: "object",
      properties: { key: { type: "string" } }
    },
    handler: async ({ key } = {}) => {
      return await browser.getLocalStorage(key);
    }
  });

  registry.register({
    name: "browser_set_storage",
    version: "1.0.0",
    category: "browser",
    trustLevel: 2,
    description: "Writes key/value pair to localStorage on the attached page.",
    schema: {
      type: "object",
      required: ["key", "value"],
      properties: { key: { type: "string" }, value: { type: "string" } }
    },
    handler: async ({ key, value }) => {
      return await browser.setLocalStorage(key, value);
    }
  });

  // 8. Goal Completion & Autonomous Decision Engine
  registry.register({
    name: "browser_goal_generate_candidates",
    version: "1.0.0",
    category: "browser",
    trustLevel: 0,
    description: "Generates candidate domain names or project identifiers without prompting the user.",
    schema: {
      type: "object",
      properties: { context: { type: "object" } }
    },
    handler: async ({ context = {} } = {}) => {
      return GoalAutonomousCompletionEngine.generateCandidateIdentifiers(context);
    }
  });
}

module.exports = { registerBrowserCapabilities };
