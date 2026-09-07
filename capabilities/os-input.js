/**
 * Desktop Input & Vision Grounding Capability (L0 OS-Level Input)
 * Interacts with Wayland (Hyprland/wtype/grim) and X11 (scrot/import/xdotool)
 * without shell interpolation using execFile.
 */

const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

function execFilePromise(file, args = [], options = {}) {
  return new Promise((resolve) => {
    execFile(file, args, { timeout: 10000, ...options }, (err, stdout, stderr) => {
      if (err) {
        resolve({
          success: false,
          available: err.code !== "ENOENT",
          error: (stderr || err.message || "").trim(),
          stdout: ""
        });
      } else {
        resolve({
          success: true,
          available: true,
          stdout: (stdout || "").trim(),
          error: null
        });
      }
    });
  });
}

function registerInputCapabilities(registry) {
  // 1. Desktop Screen Capture (Vision Grounding)
  registry.register({
    name: "desktop_capture_screen",
    version: "1.0.0",
    category: "desktop",
    trustLevel: 0,
    description: "Captures a full screenshot of the desktop displays as base64 or saves to outputPath for vision grounding.",
    schema: {
      type: "object",
      properties: {
        outputPath: { type: "string", description: "Optional absolute or relative path to save PNG image" },
        region: { type: "string", description: "Optional geometry in WxH+X+Y format (e.g. 800x600+100+100)" }
      }
    },
    handler: async ({ outputPath, region } = {}) => {
      const tempPath = outputPath ? path.resolve(outputPath) : path.join(os.tmpdir(), `shiki_screen_${Date.now()}.png`);
      let captured = false;
      let usedTool = null;
      let errLog = null;

      // Wayland: grim
      const grimArgs = [];
      if (region) grimArgs.push("-g", region);
      grimArgs.push(tempPath);

      const grimRes = await execFilePromise("grim", grimArgs);
      if (grimRes.success) {
        captured = true;
        usedTool = "grim";
      } else {
        errLog = grimRes.error;
        // X11 fallback: scrot
        const scrotArgs = [];
        if (region) scrotArgs.push("-a", region);
        scrotArgs.push(tempPath);
        const scrotRes = await execFilePromise("scrot", scrotArgs);
        if (scrotRes.success) {
          captured = true;
          usedTool = "scrot";
        } else {
          // X11 fallback 2: import (imagemagick)
          const importArgs = ["-window", "root"];
          if (region) importArgs.push("-crop", region);
          importArgs.push(tempPath);
          const importRes = await execFilePromise("import", importArgs);
          if (importRes.success) {
            captured = true;
            usedTool = "import";
          }
        }
      }

      if (!captured || !fs.existsSync(tempPath)) {
        return {
          success: false,
          available: false,
          error: `No screenshot tool available or failed capture. Details: ${errLog || "none"}`
        };
      }

      const fileStats = fs.statSync(tempPath);
      let base64Data = null;
      if (!outputPath) {
        base64Data = fs.readFileSync(tempPath).toString("base64");
        try { fs.unlinkSync(tempPath); } catch (_) {}
      }

      return {
        success: true,
        available: true,
        tool: usedTool,
        path: outputPath ? tempPath : null,
        sizeBytes: fileStats.size,
        base64: base64Data
      };
    }
  });

  // 2. Desktop Mouse Positioning & Coordinate Query
  registry.register({
    name: "desktop_cursor_move",
    version: "1.0.0",
    category: "desktop",
    trustLevel: 1,
    description: "Moves the desktop cursor to the specified absolute pixel coordinates (x, y).",
    schema: {
      type: "object",
      required: ["x", "y"],
      properties: {
        x: { type: "number", description: "X coordinate in pixels" },
        y: { type: "number", description: "Y coordinate in pixels" }
      }
    },
    handler: async ({ x, y }) => {
      const posX = Math.round(Number(x));
      const posY = Math.round(Number(y));

      if (isNaN(posX) || isNaN(posY)) {
        return { success: false, error: "Invalid coordinates" };
      }

      // 1. Hyprland dispatcher
      const hyprRes = await execFilePromise("hyprctl", ["dispatch", `hl.dsp.cursor.move({x=${posX}, y=${posY}})`]);
      if (hyprRes.success) {
        return { success: true, tool: "hyprctl", x: posX, y: posY };
      }

      // 2. xdotool fallback (X11 / XWayland)
      const xdoRes = await execFilePromise("xdotool", ["mousemove", String(posX), String(posY)]);
      if (xdoRes.success) {
        return { success: true, tool: "xdotool", x: posX, y: posY };
      }

      return {
        success: false,
        available: false,
        error: "Neither Hyprland nor xdotool cursor positioning available on this host"
      };
    }
  });

  // 3. Desktop Keyboard Typing
  registry.register({
    name: "desktop_type_text",
    version: "1.0.0",
    category: "desktop",
    trustLevel: 1,
    description: "Types text keystrokes into the currently focused window using wtype (Wayland) or xdotool (X11).",
    schema: {
      type: "object",
      required: ["text"],
      properties: {
        text: { type: "string", description: "Text to type into focused element" }
      }
    },
    handler: async ({ text }) => {
      const textStr = String(text);

      // 1. Wayland: wtype
      const wtypeRes = await execFilePromise("wtype", [textStr]);
      if (wtypeRes.success) {
        return { success: true, tool: "wtype", length: textStr.length };
      }

      // 2. X11: xdotool
      const xdoRes = await execFilePromise("xdotool", ["type", "--", textStr]);
      if (xdoRes.success) {
        return { success: true, tool: "xdotool", length: textStr.length };
      }

      return {
        success: false,
        available: false,
        error: "Neither wtype nor xdotool is available to type keyboard inputs"
      };
    }
  });
}

module.exports = { registerInputCapabilities };
