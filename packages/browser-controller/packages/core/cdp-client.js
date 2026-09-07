/**
 * Browser Controller: Lightweight Native CDP Client
 * Direct WebSocket-based Chrome DevTools Protocol client with zero external dependencies.
 */

const http = require("http");

class CDPClient {
  constructor(port = 9222, host = "127.0.0.1") {
    this.port = port;
    this.host = host;
    this.ws = null;
    this.requestId = 1;
    this.pendingCallbacks = new Map();
    this.eventListeners = new Map();
  }

  async listTabs(urlFilter = null) {
    return new Promise((resolve, reject) => {
      http.get(`http://${this.host}:${this.port}/json/list`, (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => {
          try {
            const tabs = JSON.parse(data);
            if (urlFilter) {
              const regex = new RegExp(urlFilter, "i");
              resolve(tabs.filter(t => regex.test(t.url) || regex.test(t.title)));
            } else {
              resolve(tabs);
            }
          } catch (e) {
            reject(new Error(`Failed to parse tabs list: ${e.message}`));
          }
        });
      }).on("error", reject);
    });
  }

  async createTab(url = "about:blank") {
    return new Promise((resolve, reject) => {
      const encodedUrl = encodeURIComponent(url);
      const req = http.request({
        hostname: this.host,
        port: this.port,
        path: `/json/new?${encodedUrl}`,
        method: "PUT"
      }, (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => {
          try {
            const tab = JSON.parse(data);
            resolve(tab);
          } catch (e) {
            reject(new Error(`Failed to create new tab: ${e.message}`));
          }
        });
      });
      req.on("error", reject);
      req.end();
    });
  }

  async closeTab(targetId) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: this.host,
        port: this.port,
        path: `/json/close/${targetId}`,
        method: "GET"
      }, (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => {
          resolve({ closed: true, targetId, response: data.trim() });
        });
      });
      req.on("error", reject);
      req.end();
    });
  }

  async attach(target) {
    let wsUrl = null;
    if (typeof target === "string" && target.startsWith("ws://")) {
      wsUrl = target;
    } else if (typeof target === "number") {
      const tabs = await this.listTabs();
      const tab = tabs[target] || tabs.find(t => t.id === String(target));
      if (!tab) throw new Error(`Tab target ${target} not found`);
      wsUrl = tab.webSocketDebuggerUrl;
    } else if (typeof target === "object" && target.webSocketDebuggerUrl) {
      wsUrl = target.webSocketDebuggerUrl;
    } else {
      const tabs = await this.listTabs();
      if (tabs.length === 0) throw new Error("No inspectable tabs available");
      wsUrl = tabs[0].webSocketDebuggerUrl;
    }

    if (!wsUrl) throw new Error("Target has no WebSocket debugger URL");

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      this.ws.addEventListener("open", () => {
        resolve({ attached: true, wsUrl });
      });

      this.ws.addEventListener("error", (err) => {
        reject(new Error(`CDP WebSocket error: ${err.message || "connection failed"}`));
      });

      this.ws.addEventListener("message", (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.id && this.pendingCallbacks.has(msg.id)) {
            const { resolve, reject } = this.pendingCallbacks.get(msg.id);
            this.pendingCallbacks.delete(msg.id);
            if (msg.error) {
              reject(new Error(`CDP [${msg.error.code}]: ${msg.error.message}`));
            } else {
              resolve(msg.result);
            }
          } else if (msg.method) {
            const listeners = this.eventListeners.get(msg.method) || [];
            listeners.forEach(fn => fn(msg.params));
          }
        } catch (e) {
          console.error("CDP message parse error:", e);
        }
      });
    });
  }

  send(method, params = {}) {
    if (!this.ws || this.ws.readyState !== 1) {
      return Promise.reject(new Error("CDP client is not connected to a WebSocket target"));
    }
    const id = this.requestId++;
    return new Promise((resolve, reject) => {
      this.pendingCallbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(eventName, listener) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName).push(listener);
  }

  off(eventName, listener) {
    if (!this.eventListeners.has(eventName)) return;
    const list = this.eventListeners.get(eventName);
    const idx = list.indexOf(listener);
    if (idx !== -1) list.splice(idx, 1);
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

module.exports = { CDPClient };
