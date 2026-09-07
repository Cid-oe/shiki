/**
 * Desktop & Window Management Capability
 * Interacts with Wayland/X11 compositors (Hyprland, Sway, GNOME, KDE) to discover windows,
 * focus applications, switch workspaces, and manage clipboards.
 */

const { exec } = require('child_process');

function execCmd(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) resolve({ success: false, error: stderr.trim() || err.message, stdout: '' });
      else resolve({ success: true, stdout: stdout.trim(), error: null });
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
    schema: {
      type: "object",
      properties: {}
    },
    handler: async () => {
      const hyprRes = await execCmd("hyprctl clients -j 2>/dev/null");
      if (hyprRes.success && hyprRes.stdout) {
        try {
          const clients = JSON.parse(hyprRes.stdout);
          return clients.map(c => ({
            id: c.address,
            pid: c.pid,
            class: c.class,
            title: c.title,
            workspace: c.workspace.id,
            monitor: c.monitor,
            focused: c.focusHistoryID === 0
          }));
        } catch (e) {}
      }
      // Fallback to wmctrl
      const wmRes = await execCmd("wmctrl -l -p 2>/dev/null");
      if (wmRes.success && wmRes.stdout) {
        return wmRes.stdout.split('\n').map(line => {
          const parts = line.split(/\s+/);
          return { id: parts[0], workspace: parts[1], pid: parts[2], title: parts.slice(4).join(' ') };
        });
      }
      return [];
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
        query: { type: "string", description: "Window class or title substring (e.g. 'Brave', 'kitty', 'code')" }
      }
    },
    handler: async ({ query }) => {
      const hyprRes = await execCmd(`hyprctl dispatch focuswindow "class:${query}" 2>/dev/null || hyprctl dispatch focuswindow "title:${query}"`);
      return { success: hyprRes.success };
    }
  });

  // 3. Clipboard Management
  registry.register({
    name: "desktop_get_clipboard",
    version: "1.0.0",
    category: "desktop",
    trustLevel: 0,
    description: "Reads the current contents of the system clipboard.",
    schema: { type: "object", properties: {} },
    handler: async () => {
      const wlRes = await execCmd("wl-paste 2>/dev/null || xclip -o -selection clipboard 2>/dev/null");
      return { content: wlRes.stdout };
    }
  });

  registry.register({
    name: "desktop_set_clipboard",
    version: "1.0.0",
    category: "desktop",
    trustLevel: 1,
    description: "Writes content to the system clipboard.",
    schema: {
      type: "object",
      required: ["text"],
      properties: {
        text: { type: "string" }
      }
    },
    handler: async ({ text }) => {
      const safe = Buffer.from(text).toString('base64');
      const res = await execCmd(`echo -n "${safe}" | base64 -d | wl-copy 2>/dev/null || echo -n "${safe}" | base64 -d | xclip -selection clipboard 2>/dev/null`);
      return { success: res.success };
    }
  });

  // 4. Desktop Notifications
  registry.register({
    name: "desktop_notify",
    version: "1.0.0",
    category: "desktop",
    trustLevel: 1,
    description: "Sends a native system notification to the user's desktop environment.",
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
      const res = await execCmd(`notify-send -u "${urgency}" "${title.replace(/"/g, '\\"')}" "${message.replace(/"/g, '\\"')}"`);
      return { success: res.success };
    }
  });
}

module.exports = { registerDesktopCapabilities };
