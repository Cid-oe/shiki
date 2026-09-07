# Capability Spec: Browser Network & Telemetry Broker

## 1. Feature Description
Allows AI agents to observe, filter, intercept, and await network activity (HTTP requests, responses, status codes, and WebSockets) in real time without polling. 
Enables deterministic verification of:
- API payload submission (e.g. confirming whether `/api/register` returned `200 OK` or `400 Bad Request`).
- Network idle synchronization (waiting for background AJAX requests to finish before reading the DOM).
- Capture of HAR archives and downloadable response blobs.

## 2. Public TypeScript API
```typescript
export interface NetworkRequestEvent {
  requestId: string;
  tabId: number;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';
  headers: Record<string, string>;
  postData?: string;
  timestamp: number;
}

export interface NetworkResponseEvent {
  requestId: string;
  tabId: number;
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  mimeType: string;
  responseTimeMs: number;
}

export interface BrowserNetworkService {
  startCapturing(tabId: number, options?: { urlFilter?: string; captureBody?: boolean }): Promise<{ captureId: string }>;
  stopCapturing(captureId: string): Promise<void>;
  getCapturedTraffic(captureId: string): Promise<{ requests: NetworkRequestEvent[]; responses: NetworkResponseEvent[] }>;
  waitForResponse(tabId: number, urlPattern: string, options?: { expectedStatus?: number; timeoutMs?: number }): Promise<NetworkResponseEvent>;
  waitForNetworkIdle(tabId: number, options?: { idleTimeMs?: number; timeoutMs?: number }): Promise<{ idle: boolean }>;
}
```

## 3. MCP Tool Schemas
```json
[
  {
    "name": "browser_wait_for_response",
    "description": "Waits for a matching network request to complete and returns its HTTP status and response metadata.",
    "inputSchema": {
      "type": "object",
      "required": ["tabId", "urlPattern"],
      "properties": {
        "tabId": { "type": "integer" },
        "urlPattern": { "type": "string", "description": "Substring or regex pattern for endpoint (e.g. '/api/v1/register')" },
        "expectedStatus": { "type": "integer", "description": "Optional HTTP status to verify (e.g. 200, 201)" },
        "timeoutMs": { "type": "integer", "default": 15000 }
      }
    }
  },
  {
    "name": "browser_wait_for_network_idle",
    "description": "Waits until no network requests have been initiated for a specified idle window.",
    "inputSchema": {
      "type": "object",
      "required": ["tabId"],
      "properties": {
        "tabId": { "type": "integer" },
        "idleTimeMs": { "type": "integer", "default": 500, "description": "Inactivity threshold" },
        "timeoutMs": { "type": "integer", "default": 15000 }
      }
    }
  }
]
```

## 4. Extension & Native Messaging Requirements
- Uses `chrome.webRequest` or `chrome.debugger` (`Network.enable`, `Network.requestWillBeSent`, `Network.responseReceived`).
- In-memory ring buffer (default 500 events per tab) in `background.js` prevents memory exhaustion.
- Length-prefixed streaming JSON to native host.

## 5. Security & Trust Level
- **Trust Zone**: **Zone 0 (Read / Passive Telemetry)**.
- **Data Protection**: Authorization headers (`Bearer ...`, `Cookie`) and credit card/password fields in postData are sanitized/masked by default before emitting to the agent context unless explicitly whitelisted with an audit flag.
