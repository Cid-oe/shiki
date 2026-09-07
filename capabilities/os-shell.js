/**
 * Local Host Shell & Filesystem Capability (capabilities/os-shell.js)
 * Enables autonomous agents to run local host commands, inspect directories, read/write files,
 * and perform bounded file searches with strict trust-ring enforcement.
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

function execFilePromise(file, args = [], options = {}) {
  return new Promise((resolve) => {
    execFile(file, args, { timeout: 15000, maxBuffer: 10 * 1024 * 1024, ...options }, (err, stdout, stderr) => {
      if (err) {
        resolve({
          success: false,
          exitCode: err.code || 1,
          timedOut: !!err.killed,
          error: (stderr || err.message || '').trim(),
          stdout: (stdout || '').trim()
        });
      } else {
        resolve({
          success: true,
          exitCode: 0,
          timedOut: false,
          error: null,
          stdout: (stdout || '').trim()
        });
      }
    });
  });
}

function registerShellCapabilities(registry) {
  // 1. Local Shell Execution (Trust 2: ENVIRONMENT_WRITE)
  registry.register({
    name: "shell_exec",
    version: "1.0.0",
    category: "system",
    trustLevel: 2, // Blocked for Zone 0/1; requires explicit Trust 2+ grant
    description: "Executes a local command on the host. Supports direct argv arrays or explicit /bin/sh -c strings.",
    schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command string to execute via /bin/sh -c" },
        argv: { type: "array", items: { type: "string" }, description: "Direct executable and arguments array (preferred)" },
        cwd: { type: "string", description: "Working directory" },
        timeoutMs: { type: "integer", default: 15000 }
      }
    },
    handler: async ({ command, argv, cwd = process.cwd(), timeoutMs = 15000 }) => {
      if (argv && Array.isArray(argv) && argv.length > 0) {
        const file = argv[0];
        const args = argv.slice(1);
        return await execFilePromise(file, args, { cwd, timeout: timeoutMs });
      } else if (command && typeof command === 'string') {
        return await execFilePromise('/bin/sh', ['-c', command], { cwd, timeout: timeoutMs });
      } else {
        throw new Error("shell_exec requires either 'argv' (array) or 'command' (string)");
      }
    }
  });

  // 2. Read File (Trust 0: PASSIVE_READ)
  registry.register({
    name: "file_read",
    version: "1.0.0",
    category: "filesystem",
    trustLevel: 0,
    description: "Reads a text or binary file from the local filesystem.",
    schema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string", description: "Absolute or relative file path" },
        encoding: { type: "string", default: "utf8" },
        maxBytes: { type: "integer", default: 1048576 } // 1MB default limit
      }
    },
    handler: async ({ path: targetPath, encoding = "utf8", maxBytes = 1048576 }) => {
      const resolved = path.resolve(targetPath);
      if (!fs.existsSync(resolved)) {
        throw new Error(`File not found: ${resolved}`);
      }
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        throw new Error(`Target path is a directory: ${resolved}`);
      }
      if (stat.size > maxBytes) {
        throw new Error(`File size (${stat.size} bytes) exceeds maxBytes limit (${maxBytes} bytes)`);
      }
      const content = fs.readFileSync(resolved, encoding);
      return { path: resolved, size: stat.size, content };
    }
  });

  // 3. Write File (Trust 2: ENVIRONMENT_WRITE)
  registry.register({
    name: "file_write",
    version: "1.0.0",
    category: "filesystem",
    trustLevel: 2,
    description: "Writes content to a file, creating parent directories if necessary.",
    schema: {
      type: "object",
      required: ["path", "content"],
      properties: {
        path: { type: "string" },
        content: { type: "string" },
        encoding: { type: "string", default: "utf8" }
      }
    },
    handler: async ({ path: targetPath, content, encoding = "utf8" }) => {
      const resolved = path.resolve(targetPath);
      const parentDir = path.dirname(resolved);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(resolved, content, encoding);
      const stat = fs.statSync(resolved);
      return { success: true, path: resolved, bytesWritten: stat.size };
    }
  });

  // 4. List Directory (Trust 0: PASSIVE_READ)
  registry.register({
    name: "file_list",
    version: "1.0.0",
    category: "filesystem",
    trustLevel: 0,
    description: "Lists directory contents with file metadata (size, isDirectory, modifiedTime).",
    schema: {
      type: "object",
      properties: {
        path: { type: "string", default: "." },
        pattern: { type: "string", description: "Optional name filter regex or substring" }
      }
    },
    handler: async ({ path: targetPath = ".", pattern = null }) => {
      const resolved = path.resolve(targetPath);
      if (!fs.existsSync(resolved)) {
        throw new Error(`Directory not found: ${resolved}`);
      }
      const entries = fs.readdirSync(resolved, { withFileTypes: true });
      const regex = pattern ? new RegExp(pattern, 'i') : null;

      const results = entries
        .filter(e => !regex || regex.test(e.name))
        .map(e => {
          let size = 0;
          let mtime = null;
          try {
            const s = fs.statSync(path.join(resolved, e.name));
            size = s.size;
            mtime = s.mtime.toISOString();
          } catch (_) {}
          return {
            name: e.name,
            isDirectory: e.isDirectory(),
            isFile: e.isFile(),
            size,
            mtime
          };
        });

      return { path: resolved, total: results.length, entries: results };
    }
  });

  // 5. Bounded File Search (Trust 0: PASSIVE_READ)
  registry.register({
    name: "file_search",
    version: "1.0.0",
    category: "filesystem",
    trustLevel: 0,
    description: "Performs a safe, bounded recursive search by filename or text content, skipping ignored dirs.",
    schema: {
      type: "object",
      properties: {
        root: { type: "string", default: "." },
        name: { type: "string", description: "Filename pattern" },
        content: { type: "string", description: "Substring match inside files" },
        maxDepth: { type: "integer", default: 4 },
        maxResults: { type: "integer", default: 50 }
      }
    },
    handler: async ({ root = ".", name = null, content = null, maxDepth = 4, maxResults = 50 }) => {
      const startDir = path.resolve(root);
      const matches = [];
      const ignored = new Set(['.git', 'node_modules', '.cache', 'dist', 'build', '.audit_tmp']);
      const nameRegex = name ? new RegExp(name, 'i') : null;

      function walk(currentDir, depth) {
        if (depth > maxDepth || matches.length >= maxResults) return;
        let entries = [];
        try {
          entries = fs.readdirSync(currentDir, { withFileTypes: true });
        } catch (_) {
          return;
        }

        for (const entry of entries) {
          if (ignored.has(entry.name)) continue;
          const fullPath = path.join(currentDir, entry.name);

          if (entry.isDirectory()) {
            walk(fullPath, depth + 1);
          } else if (entry.isFile()) {
            if (nameRegex && !nameRegex.test(entry.name)) continue;
            if (content) {
              try {
                const stat = fs.statSync(fullPath);
                if (stat.size > 500000) continue; // Skip files > 500KB for content match
                const fileText = fs.readFileSync(fullPath, 'utf8');
                if (!fileText.includes(content)) continue;
              } catch (_) {
                continue;
              }
            }
            matches.push({ path: fullPath, name: entry.name });
            if (matches.length >= maxResults) return;
          }
        }
      }

      walk(startDir, 0);
      return { root: startDir, totalMatches: matches.length, matches };
    }
  });
}

module.exports = { registerShellCapabilities };
