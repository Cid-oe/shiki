# Capability Spec: Storage State & Cookie Session Serialization

## 1. Feature Description
Allows AI agents to capture, export, sanitize, and restore authenticated browser state (Cookies, LocalStorage, SessionStorage, and IndexedDB keys).
Eliminates repeated authentication and solves the "headless session bootstrap" problem:
- An agent or human authenticates once in the ambient browser.
- The state is exported to an encrypted session snapshot.
- Future headless workers or subagents inject the state snapshot to resume workflows with zero login friction.

## 2. Public TypeScript API
```typescript
export interface CookieRecord {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}

export interface BrowserStorageSnapshot {
  domain: string;
  timestamp: number;
  cookies: CookieRecord[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
}

export interface StorageStateService {
  exportStorageState(tabId: number, domain: string, options?: { includeSessionStorage?: boolean }): Promise<BrowserStorageSnapshot>;
  importStorageState(tabId: number, snapshot: BrowserStorageSnapshot): Promise<{ cookiesSet: number; storageKeysSet: number }>;
  clearDomainStorage(tabId: number, domain: string): Promise<void>;
}
```

## 3. MCP Tool Schemas
```json
[
  {
    "name": "browser_export_storage_state",
    "description": "Exports cookies and localStorage for a domain into a serializable session snapshot.",
    "inputSchema": {
      "type": "object",
      "required": ["tabId", "domain"],
      "properties": {
        "tabId": { "type": "integer" },
        "domain": { "type": "string" },
        "includeSessionStorage": { "type": "boolean", "default": false }
      }
    }
  },
  {
    "name": "browser_import_storage_state",
    "description": "Injects cookies and localStorage into the target tab to restore an authenticated session.",
    "inputSchema": {
      "type": "object",
      "required": ["tabId", "snapshot"],
      "properties": {
        "tabId": { "type": "integer" },
        "snapshot": {
          "type": "object",
          "required": ["domain", "cookies", "localStorage"],
          "properties": {
            "domain": { "type": "string" },
            "cookies": { "type": "array" },
            "localStorage": { "type": "object" }
          }
        }
      }
    }
  }
]
```

## 4. Extension & Native Host Implementation
- Extension queries `chrome.cookies.getAll({ domain })`.
- LocalStorage extracted via `chrome.scripting.executeScript` accessing `window.localStorage`.
- Injected into new sessions using `chrome.cookies.set()` and evaluated `localStorage.setItem()`.

## 5. Security & Trust Level
- **Trust Zone**: **Zone 3 (Sensitive Data / Session Tokens)**.
- **Data Protection**: Snapshots are persisted strictly to restricted local paths (`chmod 600`) and stripped of sensitive telemetry before emitting back to agent logs.
