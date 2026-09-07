/**
 * Desktop & Window Management Capability
 * Interacts with Wayland/X11 compositors safely without shell interpolation.
 * Uses execFile with argv arrays to prevent command injection.
 */

const { execFile } = require('child_process');

function execFilePromise(file, args = [], options = {}) {
  return new Promise((resolve) => {
    execFile(file, args, { timeout: 5000, ...options }, (err, stdout, stderr) => {
      if (err) {
        resolve({
          success: false,
          available: err.code !== 'ENOENT',
          error: (stderr || err.message || '').trim(),
          stdout: ''
        });
      } else {
        resolve({
          success: true,
          available: true,
          stdout: (stdout || '').trim(),
          error: null
        });
      }
    });
  });
}

function registerDesktopCapabilities(registry) {
  // 1. List active GUI windows
  registry.register({
    name: "desktop_list_windows",
    version: "1.0.0",
    category: "desktop",
    trustLevel: 0,
    description: "Lists all running GUI application windows across monitors and virtual workspaces.",
    schema: { type: "object", properties: {} },
    handler: async () => {
      const hyprRes = await execFilePromise("hyprctl", ["clients", "-j"]);
      if (hyprRes.success && hyprRes.stdout) {
        try {
          const clients = JSON.parse(hyprRes.stdout);
          return clients.map(c => ({
            id: c.address,
            pid: c.pid,
            class: c.class,
            title: c.title,
            workspace: c.workspace?.id,
            monitor: c.monitor,
            focused: c.focusHistoryID === 0
          }));
        } catch (e) {}
      }

      const wmRes = await execFilePromise("wmctrl", ["-l", "-p"]);
      if (wmRes.success && wmRes.stdout) {
        return wmRes.stdout.split('\n').filter(Boolean).map(line => {
          const parts = line.split(/\s+/);
          return { id: parts[0], workspace: parts[1], pid: parts[2], title: parts.slice(4).join(' ') };
        });
      }

      return {
        available: false,
        error: "Neither hyprctl nor wmctrl compositor discovery utilities are installed on this host",
        windows: []
      };
    }
  });

  // 2. Focus a window by title or class
  registry.register({
    name: "desktop_focus_window",
    version: "1.0.0",
    category: "desktop",
    trustLevel: 1,
    description: "Focuses an application window and brings its workspace into view.",
    schema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "Window class or title substring" }
      }
    },
    handler: async ({ query }) => {
      const sanitized = String(query).replace(/[^a-zA-Z0-9_\-\.\:\s]/g, '');
      const hyprRes = await execFilePromise("hyprctl", ["dispatch", "focuswindow", `class:${sanitized}`]);
      return { success: hyprRes.success, available: hyprRes.available };
    }
  });

  // 3. Clipboard Management (Safe piped execution)
  registry.register({
    name: "desktop_get_clipboard",
    version: "1.0.0",
    category: "desktop",
    trustLevel: 0,
    description: "Reads the current contents of the system clipboard.",
    schema: { type: "object", properties: {} },
    handler: async () => {
      const wlRes = await execFilePromise("wl-paste", ["--no-newline"]);
      if (wlRes.available) return { available: true, content: wlRes.stdout };

      const xclipRes = await execFilePromise("xclip", ["-o", "-selection", "clipboard"]);
      if (xclipRes.available) return { available: true, content: xclipRes.stdout };

      return { available: false, error: "Neither wl-paste nor xclip installed", content: "" };
    }
  });

  registry.register({
    name: "desktop_set_clipboard",
    version: "1.0.0",
    category: "desktop",
    trustLevel: 1,
    description: "Writes content to the system clipboard without shell interpolation.",
    schema: {
      type: "object",
      required: ["text"],
      properties: { text: { type: "string" } }
    },
    handler: async ({ text }) => {
      return new Promise((resolve) => {
        const proc = execFile("wl-copy", [], { timeout: 3000 }, (err) => {
          if (!err) return resolve({ success: true, tool: "wl-copy" });
          const xproc = execFile("xclip", ["-selection", "clipboard"], { timeout: 3000 }, (xerr) => {
            if (!xerr) return resolve({ success: true, tool: "xclip" });
            resolve({ success: false, available: false, error: "Neither wl-copy nor xclip available" });
          });
          xproc.stdin.write(text);
          xproc.stdin.end();
        });
        proc.stdin.write(text);
        proc.stdin.end();
      });
    }
  });

  // 4. Desktop Notifications (Immune to command injection: uses execFile argv)
  registry.register({
    name: "desktop_notify",
    version: "1.0.0",
    category: "desktop",
    trustLevel: 1,
    description: "Sends a native system notification safely via execFile argv.",
    schema: {
      type: "object",
      required: ["title", "message"],
      properties: {
        title: { type: "string" },
        message: { type: "string" },
        urgency: { type: "string", enum: ["low", "normal", "critical"], default: "normal" }
      }
    },
    handler: async ({ title, message, urgency = "normal" }) => {
      const res = await execFilePromise("notify-send", ["-u", urgency, String(title), String(message)]);
      return { success: res.success, available: res.available, error: res.error };
    }
  });
}

module.exports = { registerDesktopCapabilities };
