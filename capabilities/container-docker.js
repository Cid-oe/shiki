/**
 * Container & Infrastructure Capability
 * Safe container commands using execFile without raw shell string concatenation.
 */

const { execFile } = require('child_process');

function execFilePromise(file, args = []) {
  return new Promise((resolve) => {
    execFile(file, args, { timeout: 15000 }, (err, stdout, stderr) => {
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

function registerDockerCapabilities(registry) {
  registry.register({
    name: "container_list",
    version: "1.0.0",
    category: "containers",
    trustLevel: 0,
    description: "Lists active Docker or Podman containers safely.",
    schema: {
      type: "object",
      properties: { all: { type: "boolean", default: false } }
    },
    handler: async ({ all = false }) => {
      const args = ["ps", "--format", "{{json .}}"];
      if (all) args.splice(1, 0, "-a");

      let res = await execFilePromise("docker", args);
      if (!res.available) {
        res = await execFilePromise("podman", args);
      }

      if (!res.available) {
        return { available: false, error: "Neither docker nor podman CLI installed on host", containers: [] };
      }

      const containers = res.stdout.split('\n').filter(Boolean).map(line => {
        try { return JSON.parse(line); } catch (e) { return { raw: line }; }
      });

      return { available: true, containers };
    }
  });

  registry.register({
    name: "container_exec",
    version: "1.0.0",
    category: "containers",
    trustLevel: 2, // ENVIRONMENT_WRITE
    description: "Executes a command inside a running container safely using direct execFile argv.",
    schema: {
      type: "object",
      required: ["containerId", "command"],
      properties: {
        containerId: { type: "string" },
        command: { type: "string" }
      }
    },
    handler: async ({ containerId, command }) => {
      // Validate containerId format strictly to prevent flag injection
      const sanitizedId = String(containerId).trim();
      if (!/^[a-zA-Z0-9_\-\.]+$/.test(sanitizedId)) {
        throw new Error(`Invalid containerId format: '${containerId}'`);
      }

      const args = ["exec", sanitizedId, "sh", "-c", String(command)];
      let res = await execFilePromise("docker", args);
      if (!res.available) {
        res = await execFilePromise("podman", args);
      }

      return res;
    }
  });
}

module.exports = { registerDockerCapabilities };
