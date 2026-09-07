#!/usr/bin/env node
/**
 * Native Messaging Host for Browser Controller
 * Communicates with the Chrome/Brave Extension over stdin/stdout using length-prefixed JSON.
 * Exposes a local Unix Domain Socket or HTTP endpoint for the MCP Server to consume.
 */

const fs = require('fs');
const net = require('net');

const SOCKET_PATH = '/tmp/browser_controller.sock';

// Remove stale socket if present
if (fs.existsSync(SOCKET_PATH)) {
  fs.unlinkSync(SOCKET_PATH);
}

// Map of pending requests sent to the browser extension: id -> callback
const pendingRequests = new Map();
let requestId = 1;

// Read 32-bit uint length prefix from stdin
function readMessage() {
  const header = process.stdin.read(4);
  if (!header) return null;
  const length = header.readUInt32LE(0);
  const body = process.stdin.read(length);
  if (!body) return null;
  return JSON.parse(body.toString());
}

// Write length-prefixed JSON to stdout (to Extension)
function writeMessage(msg) {
  const payload = Buffer.from(JSON.stringify(msg));
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  process.stdout.write(header);
  process.stdout.write(payload);
}

// Handle incoming messages from the Browser Extension
process.stdin.on('readable', () => {
  let msg;
  while ((msg = readMessage()) !== null) {
    const { id, result, error } = msg;
    if (pendingRequests.has(id)) {
      const { resolve, reject } = pendingRequests.get(id);
      pendingRequests.delete(id);
      if (error) reject(new Error(error));
      else resolve(result);
    }
  }
});

// IPC Server for Agent Runtime & MCP Server
const server = net.createServer((client) => {
  let buffer = '';
  client.on('data', async (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep incomplete chunk

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const req = JSON.parse(line);
        const curId = requestId++;

        const responsePromise = new Promise((resolve, reject) => {
          pendingRequests.set(curId, { resolve, reject });
        });

        writeMessage({ id: curId, method: req.method, params: req.params });
        const result = await responsePromise;
        client.write(JSON.stringify({ id: req.id, result }) + '\n');
      } catch (err) {
        client.write(JSON.stringify({ id: req.id, error: err.message }) + '\n');
      }
    }
  });
});

server.listen(SOCKET_PATH, () => {
  fs.chmodSync(SOCKET_PATH, 0o777);
});

process.on('SIGTERM', () => {
  if (fs.existsSync(SOCKET_PATH)) fs.unlinkSync(SOCKET_PATH);
  process.exit(0);
});
