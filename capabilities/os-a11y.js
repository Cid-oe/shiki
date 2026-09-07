/**
 * Native Linux AT-SPI2 Accessibility Inspection Capability
 * Inspects GUI accessibility trees via D-Bus org.a11y.Bus without GUI screen-scraping.
 */

const { execFile } = require("child_process");

function execFilePromise(file, args = [], options = {}) {
  return new Promise((resolve) => {
    execFile(file, args, { timeout: 8000, ...options }, (err, stdout, stderr) => {
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

function registerAccessibilityCapabilities(registry) {
  // 1. Discover accessibility bus status & registered client applications
  registry.register({
    name: "desktop_a11y_list_apps",
    version: "1.0.0",
    category: "desktop",
    trustLevel: 0,
    description: "Lists accessible applications connected to the AT-SPI2 D-Bus accessibility bus.",
    schema: { type: "object", properties: {} },
    handler: async () => {
      // Step 1: Discover AT-SPI bus address
      const addrRes = await execFilePromise("busctl", [
        "--user", "call", "org.a11y.Bus", "/org/a11y/bus", "org.a11y.Bus", "GetAddress"
      ]);

      if (!addrRes.success || !addrRes.stdout) {
        return {
          available: false,
          error: "AT-SPI2 accessibility bus is not running or busctl is unavailable",
          apps: []
        };
      }

      // Address is typically in format: s "unix:path=..."
      const match = addrRes.stdout.match(/"([^"]+)"/);
      const busAddress = match ? match[1] : null;

      if (!busAddress) {
        return {
          available: false,
          error: "Could not parse AT-SPI bus address",
          apps: []
        };
      }

      // Step 2: List client services on the AT-SPI bus
      const listRes = await execFilePromise("busctl", ["--address=" + busAddress, "list"]);
      if (!listRes.success || !listRes.stdout) {
        return {
          available: true,
          busAddress,
          apps: []
        };
      }

      const lines = listRes.stdout.split("\n").filter(Boolean);
      const apps = [];
      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].trim().split(/\s+/);
        if (parts.length >= 3) {
          const name = parts[0];
          const pid = parts[1];
          const process = parts[2];
          if (name.startsWith(":") && process !== "busctl") {
            apps.push({ id: name, pid, process });
          }
        }
      }

      return {
        available: true,
        busAddress,
        apps
      };
    }
  });

  // 2. Introspect accessible application node
  registry.register({
    name: "desktop_a11y_introspect",
    version: "1.0.0",
    category: "desktop",
    trustLevel: 0,
    description: "Inspects AT-SPI2 D-Bus interfaces and elements of an accessible desktop application.",
    schema: {
      type: "object",
      required: ["destination"],
      properties: {
        destination: { type: "string", description: "D-Bus destination (e.g. :1.418 or well-known name)" },
        path: { type: "string", description: "D-Bus object path (default: /org/a11y/atspi/accessible/root)" }
      }
    },
    handler: async ({ destination, path = "/org/a11y/atspi/accessible/root" }) => {
      // Find bus address
      const addrRes = await execFilePromise("busctl", [
        "--user", "call", "org.a11y.Bus", "/org/a11y/bus", "org.a11y.Bus", "GetAddress"
      ]);

      if (!addrRes.success) {
        return { available: false, error: "AT-SPI2 accessibility bus not reachable" };
      }

      const match = addrRes.stdout.match(/"([^"]+)"/);
      const busAddress = match ? match[1] : null;
      if (!busAddress) {
        return { available: false, error: "Could not parse AT-SPI bus address" };
      }

      const cleanDest = String(destination).replace(/[^a-zA-Z0-9_\-\.:/]/g, "");
      const cleanPath = String(path).replace(/[^a-zA-Z0-9_\-\.:/]/g, "");

      const introRes = await execFilePromise("busctl", [
        "--address=" + busAddress, "introspect", cleanDest, cleanPath
      ]);

      return {
        success: introRes.success,
        available: true,
        destination: cleanDest,
        path: cleanPath,
        introspection: introRes.stdout || introRes.error
      };
    }
  });
}

module.exports = { registerAccessibilityCapabilities };
