/**
 * Container & Infrastructure Capability
 * Enables agents to inspect, run, execute, and monitor containerized environments.
 */

const { exec } = require('child_process');

function execCmd(cmd) {
  return new Promise((resolve) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) resolve({ success: false, error: stderr.trim() || err.message, stdout: '' });
      else resolve({ success: true, stdout: stdout.trim(), error: null });
    });
  });
}

function registerDockerCapabilities(registry) {
  // 1. List running containers
  registry.register({
    name: "container_list",
    version: "1.0.0",
    category: "containers",
    trustLevel: 0,
    description: "Lists active Docker or Podman containers on the host.",
    schema: {
      type: "object",
      properties: {
        all: { type: "boolean", default: false }
      }
    },
    handler: async ({ all = false }) => {
      const res = await execCmd(`docker ps ${all ? '-a' : ''} --format "{{json .}}" 2>/dev/null || podman ps ${all ? '-a' : ''} --format "{{json .}}" 2>/dev/null`);
      if (!res.success || !res.stdout) return [];
      return res.stdout.split('\n').filter(Boolean).map(line => {
        try { return JSON.parse(line); } catch (e) { return { raw: line }; }
      });
    }
  });

  // 2. Execute command inside container
  registry.register({
    name: "container_exec",
    version: "1.0.0",
    category: "containers",
    trustLevel: 2,
    description: "Executes a command inside a running container and returns output.",
    schema: {
      type: "object",
      required: ["containerId", "command"],
      properties: {
        containerId: { type: "string" },
        command: { type: "string" }
      }
    },
    handler: async ({ containerId, command }) => {
      const res = await execCmd(`docker exec ${containerId} sh -c "${command.replace(/"/g, '\\"')}" 2>/dev/null || podman exec ${containerId} sh -c "${command.replace(/"/g, '\\"')}"`);
      return res;
    }
  });
}

module.exports = { registerDockerCapabilities };
