/**
 * Browser Controller: Unified Automation Service
 * Exposes resilient semantic DOM operations, bot-gate inspection, network verification, 
 * dialog handling, trusted input, hover, drag, tabs, cookies, storage, wait-for, and zero-knowledge form fill.
 */

const { CDPClient } = require("./cdp-client");
const { NetworkBroker } = require("./network-broker");
const { SecurityHandoffEngine } = require("./security-handoff");
const { GoalAutonomousCompletionEngine } = require("./goal-autonomous-completion");
const { TelemetryTracer } = require("./telemetry-tracer");

class BrowserService {
  constructor(port = 9222, host = "127.0.0.1") {
    this.cdp = new CDPClient(port, host);
    this.activeTabId = null;
    this.networkBroker = new NetworkBroker(this.cdp);
    this.securityHandoff = new SecurityHandoffEngine(this.cdp);
    this.dialogHandlerRegistered = false;
    this.autoAcceptDialogs = true;
    this.lastDialog = null;
  }

  async listTabs(urlFilter = null) {
    return await this.cdp.listTabs(urlFilter);
  }

  async createTab(url = "about:blank") {
    return await this.cdp.createTab(url);
  }

  async closeTab(targetId) {
    return await this.cdp.closeTab(targetId);
  }

  async attach(tabTarget) {
    const res = await this.cdp.attach(tabTarget);
    // Enable core domains
    await this.cdp.send("Page.enable");
    await this.cdp.send("DOM.enable");
    await this.cdp.send("Runtime.enable");
    await this.networkBroker.enable();

    // Register dialog interceptor to prevent page deadlocks
    if (!this.dialogHandlerRegistered) {
      this.cdp.on("Page.javascriptDialogOpening", async (params) => {
        this.lastDialog = {
          type: params.type,
          message: params.message,
          timestamp: Date.now()
        };
        try {
          await this.cdp.send("Page.handleJavaScriptDialog", {
            accept: this.autoAcceptDialogs,
            promptText: ""
          });
        } catch (_) {}
      });
      this.dialogHandlerRegistered = true;
    }

    return res;
  }

  async navigate(url, waitUntil = "load", timeoutMs = 12000) {
    return new Promise((resolve) => {
      let resolved = false;
      let timer = null;

      const onLoad = () => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve({ success: true, navigated: true, url, error: null });
      };

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        this.cdp.off("Page.loadEventFired", onLoad);
      };

      this.cdp.on("Page.loadEventFired", onLoad);

      timer = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve({
          success: false,
          navigated: false,
          url,
          error: "Navigation timed out after " + timeoutMs + "ms"
        });
      }, timeoutMs);

      this.cdp.send("Page.navigate", { url }).catch((err) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve({ success: false, navigated: false, url, error: err.message });
      });
    });
  }

  async reload(ignoreCache = false) {
    await this.cdp.send("Page.reload", { ignoreCache });
    return { reloaded: true };
  }

  async evaluateJS(expression) {
    const res = await this.cdp.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || "JS Evaluation error");
    }
    return res.result ? res.result.value : null;
  }

  async waitForSelector(selector, timeoutMs = 10000, pollIntervalMs = 100) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const exists = await this.evaluateJS("!!document.querySelector(" + JSON.stringify(selector) + ")");
      if (exists) return { found: true, selector, elapsedMs: Date.now() - startTime };
      await new Promise(r => setTimeout(r, pollIntervalMs));
    }
    throw new Error("Timeout waiting for selector " + selector + " after " + timeoutMs + "ms");
  }

  async waitForCondition(expression, timeoutMs = 10000, pollIntervalMs = 100) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const ok = await this.evaluateJS(expression);
      if (ok) return { satisfied: true, elapsedMs: Date.now() - startTime };
      await new Promise(r => setTimeout(r, pollIntervalMs));
    }
    throw new Error("Timeout waiting for condition after " + timeoutMs + "ms");
  }

  async getCookies(urls = []) {
    const params = urls.length > 0 ? { urls } : {};
    const res = await this.cdp.send("Network.getCookies", params);
    return res.cookies || [];
  }

  async setCookie(cookie) {
    const res = await this.cdp.send("Network.setCookie", cookie);
    return res;
  }

  async getLocalStorage(key = null) {
    if (key) {
      return await this.evaluateJS("localStorage.getItem(" + JSON.stringify(key) + ")");
    }
    return await this.evaluateJS("JSON.stringify(localStorage)");
  }

  async setLocalStorage(key, value) {
    return await this.evaluateJS("localStorage.setItem(" + JSON.stringify(key) + ", " + JSON.stringify(value) + ")");
  }

  async inspectSecurityGate() {
    return await this.securityHandoff.inspectChallenge();
  }

  async queryElements(semanticQuery) {
    const { role, name, placeholder } = semanticQuery;
    const expression = `
      (() => {
        const els = Array.from(document.querySelectorAll("button, a, input, select, textarea, [role]"));
        const rFilter = ${JSON.stringify(role || null)};
        const nFilter = ${JSON.stringify(name ? name.toLowerCase() : null)};
        const pFilter = ${JSON.stringify(placeholder ? placeholder.toLowerCase() : null)};

        const matches = els.filter(el => {
          const elRole = el.getAttribute("role") || el.tagName.toLowerCase();
          const elText = (el.innerText || el.textContent || el.value || "").trim().toLowerCase();
          const elPh = (el.placeholder || "").toLowerCase();
          const elAria = (el.getAttribute("aria-label") || "").toLowerCase();

          if (rFilter && !elRole.includes(rFilter)) return false;
          if (pFilter && !elPh.includes(pFilter)) return false;
          if (nFilter && !elText.includes(nFilter) && !elAria.includes(nFilter)) return false;
          return true;
        });

        return matches.map((el, i) => {
          const rect = el.getBoundingClientRect();
          return {
            index: i,
            tag: el.tagName,
            type: el.type || null,
            name: el.name || null,
            text: (el.innerText || el.value || "").slice(0, 50),
            visible: rect.width > 0 && rect.height > 0,
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
          };
        });
      })()
    `;
    return await this.evaluateJS(expression);
  }

  /**
   * Finds an element matching semantic query and returns its center coordinates and metadata
   */
  async findElementCoords(query) {
    const findExpr = `
      (() => {
        const qName = ${JSON.stringify(query.name ? query.name.toLowerCase() : null)};
        const qRole = ${JSON.stringify(query.role ? query.role.toLowerCase() : null)};
        const qPh = ${JSON.stringify(query.placeholder ? query.placeholder.toLowerCase() : null)};

        const els = Array.from(document.querySelectorAll("button, a, input, select, textarea, [role], div, span, p"));
        const target = els.find(el => {
          const name = (el.name || "").toLowerCase();
          const ph = (el.placeholder || "").toLowerCase();
          const text = (el.innerText || el.value || el.getAttribute("aria-label") || "").trim().toLowerCase();
          const role = (el.getAttribute("role") || el.tagName).toLowerCase();

          if (qName && !text.includes(qName) && !name.includes(qName)) return false;
          if (qRole && !role.includes(qRole)) return false;
          if (qPh && !ph.includes(qPh)) return false;
          return true;
        });

        if (!target) return null;
        target.scrollIntoView({ behavior: "instant", block: "center" });
        const rect = target.getBoundingClientRect();
        return {
          tag: target.tagName.toLowerCase(),
          name: target.name || null,
          placeholder: target.placeholder || null,
          text: (target.innerText || target.value || "").trim().slice(0, 50),
          x: Math.round(rect.x + rect.width / 2),
          y: Math.round(rect.y + rect.height / 2),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      })()
    `;
    return await this.evaluateJS(findExpr);
  }

  /**
   * Trusted Semantic Fill:
   * 1. Finds input element center coordinates
   * 2. Issues trusted click to focus
   * 3. Clears existing content via selectAll + Backspace
   * 4. Dispatches trusted key events per character
   * React, Vue, Angular, and bot-detection safe.
   */
  async fillSemantic(query, value, useTrusted = true) {
    const found = await this.findElementCoords(query);
    if (!found) return { success: false, error: "Input target not found" };

    if (useTrusted && found.x > 0 && found.y > 0) {
      // 1. Move and click to focus with trusted mouse events
      await this.cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: found.x, y: found.y });
      await this.cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: found.x, y: found.y, button: "left", clickCount: 1 });
      await this.cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: found.x, y: found.y, button: "left", clickCount: 1 });

      // 2. Clear field using Ctrl+A / Backspace
      await this.cdp.send("Input.dispatchKeyEvent", { type: "keyDown", modifiers: 2, windowsVirtualKeyCode: 65, key: "a", code: "KeyA" });
      await this.cdp.send("Input.dispatchKeyEvent", { type: "keyUp", modifiers: 2, windowsVirtualKeyCode: 65, key: "a", code: "KeyA" });
      await this.cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", windowsVirtualKeyCode: 8, key: "Backspace", code: "Backspace" });
      await this.cdp.send("Input.dispatchKeyEvent", { type: "keyUp", windowsVirtualKeyCode: 8, key: "Backspace", code: "Backspace" });

      // 3. Dispatch trusted character keystrokes
      await this.typeKeystrokes(String(value));

      return {
        success: true,
        trusted: true,
        name: found.name,
        placeholder: found.placeholder,
        filledLength: String(value).length
      };
    }

    // Untrusted fallback
    const evalRes = await this.cdp.send("Runtime.evaluate", {
      expression: `
        (() => {
          const qName = ${JSON.stringify(query.name ? query.name.toLowerCase() : null)};
          const qPh = ${JSON.stringify(query.placeholder ? query.placeholder.toLowerCase() : null)};
          
          const inputs = Array.from(document.querySelectorAll("input, textarea"));
          const target = inputs.find(el => {
            const name = (el.name || "").toLowerCase();
            const ph = (el.placeholder || "").toLowerCase();
            const aria = (el.getAttribute("aria-label") || "").toLowerCase();
            if (qName && (name.includes(qName) || aria.includes(qName))) return true;
            if (qPh && ph.includes(qPh)) return true;
            return false;
          });

          if (!target) return { success: false, error: "Element not found" };

          target.focus();
          target.value = ${JSON.stringify(value)};
          target.dispatchEvent(new Event("input", { bubbles: true }));
          target.dispatchEvent(new Event("change", { bubbles: true }));
          return { success: true, name: target.name, placeholder: target.placeholder };
        })()
      `,
      returnByValue: true
    });
    return evalRes.result.value;
  }

  /**
   * Trusted Semantic Click (default: trusted CDP events)
   */
  async clickSemantic(query, useTrusted = true) {
    const found = await this.findElementCoords(query);
    if (!found) return { success: false, error: "Click target not found" };

    if (useTrusted && found.x > 0 && found.y > 0) {
      await this.cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: found.x, y: found.y });
      await this.cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: found.x, y: found.y, button: "left", clickCount: 1 });
      await this.cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: found.x, y: found.y, button: "left", clickCount: 1 });
      return { success: true, trusted: true, text: found.text, coords: { x: found.x, y: found.y } };
    }

    await this.evaluateJS(`
      (() => {
        const qName = ${JSON.stringify(query.name ? query.name.toLowerCase() : null)};
        const clickable = Array.from(document.querySelectorAll("button, a, input[type=\"submit\"], input[type=\"button\"], [role=\"button\"]"));
        const target = clickable.find(el => {
          const text = (el.innerText || el.value || el.getAttribute("aria-label") || "").trim().toLowerCase();
          return qName && text.includes(qName);
        });
        if (target) target.click();
      })()
    `);
    return { success: true, trusted: false, text: found.text };
  }

  /**
   * Standalone Hover capability via CDP Input.dispatchMouseEvent mouseMoved
   */
  async hover(query) {
    const found = await this.findElementCoords(query);
    if (!found) return { success: false, error: "Hover target not found" };

    // Move away first to guarantee movement into the element bounds
    await this.cdp.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: 0,
      y: 0
    });

    await this.cdp.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: found.x,
      y: found.y
    });

    return { success: true, hovered: found.text || found.name, coords: { x: found.x, y: found.y } };
  }

  /**
   * Drag and Drop via CDP mousePressed, mouseMoved, mouseReleased
   */
  async dragAndDrop(fromQuery, toQuery, steps = 10) {
    const fromCoords = await this.findElementCoords(fromQuery);
    if (!fromCoords) return { success: false, error: "Source drag element not found" };

    const toCoords = await this.findElementCoords(toQuery);
    if (!toCoords) return { success: false, error: "Destination drop target not found" };

    // Move to source
    await this.cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: fromCoords.x, y: fromCoords.y });
    // Press left button
    await this.cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: fromCoords.x, y: fromCoords.y, button: "left", clickCount: 1 });

    // Interpolate steps
    for (let i = 1; i <= steps; i++) {
      const curX = Math.round(fromCoords.x + (toCoords.x - fromCoords.x) * (i / steps));
      const curY = Math.round(fromCoords.y + (toCoords.y - fromCoords.y) * (i / steps));
      await this.cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: curX, y: curY, button: "left" });
      await new Promise(r => setTimeout(r, 20));
    }

    // Release button at target
    await this.cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: toCoords.x, y: toCoords.y, button: "left", clickCount: 1 });

    return {
      success: true,
      dragged: { from: { x: fromCoords.x, y: fromCoords.y }, to: { x: toCoords.x, y: toCoords.y } }
    };
  }

  async typeKeystrokes(text) {
    for (const char of text) {
      await this.cdp.send("Input.dispatchKeyEvent", {
        type: "keyDown",
        text: char,
        unmodifiedText: char
      });
      await this.cdp.send("Input.dispatchKeyEvent", {
        type: "keyUp"
      });
    }
    return { success: true, typedCount: text.length };
  }

  async scroll(deltaX = 0, deltaY = 300, x = 100, y = 100) {
    await this.cdp.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x,
      y,
      deltaX,
      deltaY
    });
    return { success: true, scrolled: { deltaX, deltaY } };
  }

  async captureScreenshot() {
    const res = await this.cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 80 });
    return { data: res.data, mimeType: "image/jpeg" };
  }

  close() {
    this.cdp.close();
  }
}

module.exports = {
  BrowserService,
  NetworkBroker,
  SecurityHandoffEngine,
  GoalAutonomousCompletionEngine,
  TelemetryTracer
};
