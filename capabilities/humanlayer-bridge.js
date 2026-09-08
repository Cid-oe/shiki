/**
 * HumanLayer Integration Engine (Human-in-the-Loop & Remote Execution Bridge)
 * Bridges HumanLayer cloud tasks, approval requests, daemon management, and MCP tools.
 */

const { execFile, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");
const https = require("https");

class HumanLayerBridge {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.HUMANLAYER_API_KEY || null;
    this.apiBase = options.apiBase || "https://api.humanlayer.com";
    this.daemonProcess = null;
    this.activeApprovals = new Map();
  }

  /**
   * Dispatches an out-of-band human approval request (Slack, Web, Email, Mobile).
   * Used when Shiki or Antigravity hits critical actions (payments, delete, security challenges).
   */
  async requestApproval(approvalRequest) {
    const { title, description, category = "SENSITIVE_AUTH", metadata = {}, timeoutSeconds = 300 } = approvalRequest;
    const approvalId = "hl_req_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

    const record = {
      id: approvalId,
      title,
      description,
      category,
      metadata,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + timeoutSeconds * 1000).toISOString()
    };

    this.activeApprovals.set(approvalId, record);

    // If HumanLayer API key is configured, post approval to cloud API
    if (this.apiKey) {
      try {
        const payload = JSON.stringify({
          spec: {
            prompt: title + "\n" + description,
            channel: "slack",
            timeout: timeoutSeconds
          }
        });

        await new Promise((resolve, reject) => {
          const req = https.request(this.apiBase + "/api/v1/approvals", {
            method: "POST",
            headers: {
              "Authorization": "Bearer " + this.apiKey,
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(payload)
            }
          }, (res) => {
            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end", () => resolve(data));
          });
          req.on("error", reject);
          req.write(payload);
          req.end();
        });
      } catch (err) {
        console.warn("[HumanLayerBridge] Cloud approval API notice:", err.message);
      }
    }

    return record;
  }

  /**
   * Checks status of an approval request or simulates approval in dev/test mode.
   */
  async checkApproval(approvalId) {
    const record = this.activeApprovals.get(approvalId);
    if (!record) return { found: false, status: "UNKNOWN" };

    if (new Date() > new Date(record.expiresAt)) {
      record.status = "EXPIRED";
    }

    return { found: true, ...record };
  }

  /**
   * Resolves an approval request with decision (APPROVED / REJECTED).
   */
  resolveApproval(approvalId, decision = "APPROVED", reason = "") {
    const record = this.activeApprovals.get(approvalId);
    if (!record) throw new Error("Approval ID not found");
    record.status = decision;
    record.resolutionReason = reason;
    record.resolvedAt = new Date().toISOString();
    return record;
  }

  /**
   * Launches or inspects local HumanLayer daemon
   */
  async launchDaemon(token = null) {
    const args = ["daemon", "launch"];
    if (token) args.push("--launch-token", token);

    return new Promise((resolve) => {
      execFile("humanlayer", ["--version"], (err, stdout) => {
        if (err) {
          resolve({
            installed: false,
            running: false,
            message: "HumanLayer CLI is not installed globally. Run: npm install -g @humanlayer/cli@latest"
          });
        } else {
          resolve({
            installed: true,
            version: stdout.trim(),
            running: false,
            command: "humanlayer " + args.join(" ")
          });
        }
      });
    });
  }
}

function registerHumanLayerCapabilities(registry, bridgeInstance = null) {
  const bridge = bridgeInstance || new HumanLayerBridge();

  // 1. Request Human Approval for Critical Operations
  registry.register({
    name: "humanlayer_request_approval",
    version: "1.0.0",
    category: "governance",
    trustLevel: 3,
    description: "Dispatches an out-of-band human-in-the-loop approval request via HumanLayer (Slack, Mobile, Web) for sensitive operations.",
    schema: {
      type: "object",
      required: ["title", "description"],
      properties: {
        title: { type: "string", description: "Clear summary of the action requiring human clearance" },
        description: { type: "string", description: "Detailed risk explanation, parameters, and consequences" },
        category: { type: "string", enum: ["SENSITIVE_AUTH", "CRITICAL_APPROVAL", "FINANCIAL", "CAPTCHA"], default: "CRITICAL_APPROVAL" },
        timeoutSeconds: { type: "number", default: 300 }
      }
    },
    handler: async (args) => {
      return await bridge.requestApproval(args);
    }
  });

  // 2. Poll Approval Status
  registry.register({
    name: "humanlayer_check_approval",
    version: "1.0.0",
    category: "governance",
    trustLevel: 0,
    description: "Polls current approval status (PENDING, APPROVED, REJECTED, EXPIRED) for a previously requested approval ID.",
    schema: {
      type: "object",
      required: ["approvalId"],
      properties: { approvalId: { type: "string" } }
    },
    handler: async ({ approvalId }) => {
      return await bridge.checkApproval(approvalId);
    }
  });

  // 3. Resolve Approval (Authorized operator)
  registry.register({
    name: "humanlayer_resolve_approval",
    version: "1.0.0",
    category: "governance",
    trustLevel: 4,
    description: "Resolves a pending HumanLayer approval request with decision (APPROVED or REJECTED).",
    schema: {
      type: "object",
      required: ["approvalId", "decision"],
      properties: {
        approvalId: { type: "string" },
        decision: { type: "string", enum: ["APPROVED", "REJECTED"] },
        reason: { type: "string", default: "" }
      }
    },
    handler: async ({ approvalId, decision, reason = "" }) => {
      return bridge.resolveApproval(approvalId, decision, reason);
    }
  });

  // 4. Daemon Status & Management
  registry.register({
    name: "humanlayer_daemon_status",
    version: "1.0.0",
    category: "governance",
    trustLevel: 0,
    description: "Checks whether HumanLayer daemon and CLI are installed and configured on the local host.",
    schema: { type: "object", properties: {} },
    handler: async () => {
      return await bridge.launchDaemon();
    }
  });
}

module.exports = {
  HumanLayerBridge,
  registerHumanLayerCapabilities
};
