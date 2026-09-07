# Capability Spec: Browser Session & Tab Management

## 1. Feature Description
Allows AI agents to discover, attach to, create, and close browser windows and tabs without needing to launch separate browser processes or collide with Wayland/X11 compositors. Supports attaching to existing ambient tabs (e.g. where the user is already logged in) or spawning isolated sandboxes.

## 2. Public TypeScript API
```typescript
export interface TabDescriptor {
  tabId: number;
  windowId: number;
  url: string;
  title: string;
  active: boolean;
  incognito: boolean;
  status: 'loading' | 'complete';
}

export interface BrowserSessionService {
  listTabs(filter?: { urlPattern?: string; activeOnly?: boolean }): Promise<TabDescriptor[]>;
  attachTab(tabId: number): Promise<{ attached: boolean; sessionId: string }>;
  createTab(url: string, options?: { inBackground?: boolean; incognito?: boolean }): Promise<TabDescriptor>;
  activateTab(tabId: number): Promise<void>;
  closeTab(tabId: number): Promise<void>;
  navigate(tabId: number, url: string, options?: { waitUntil?: 'dom_ready' | 'network_idle'; timeoutMs?: number }): Promise<{ httpStatus: number; redirected: boolean }>;
}
```

## 3. Model Context Protocol (MCP) Tool Schemas
```json
[
  {
    "name": "browser_list_tabs",
    "description": "Lists all open browser tabs across windows with titles and URLs.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "urlPattern": { "type": "string", "description": "Optional substring/regex filter for URLs" }
      }
    }
  },
  {
    "name": "browser_attach_tab",
    "description": "Attaches agent controller to an existing ambient browser tab.",
    "inputSchema": {
      "type": "object",
      "required": ["tabId"],
      "properties": {
        "tabId": { "type": "integer", "description": "The unique ID of the target browser tab." }
      }
    }
  },
  {
    "name": "browser_navigate",
    "description": "Navigates a browser tab to a specified URL and waits for completion.",
    "inputSchema": {
      "type": "object",
      "required": ["tabId", "url"],
      "properties": {
        "tabId": { "type": "integer" },
        "url": { "type": "string" },
        "waitUntil": { "type": "string", "enum": ["dom_ready", "network_idle"], "default": "dom_ready" }
      }
    }
  }
]
```

## 4. Extension & Native Messaging Implementation Requirements
- **Manifest Permissions**: `"tabs"`, `"debugger"`, `"activeTab"`.
- **Native Host JSON-RPC**: The native messaging host forwards JSON-RPC packets between the MCP server and `chrome.runtime.onConnectNative`.
- **Target Resolution**: Uses `chrome.debugger.attach({ tabId }, "1.3")` for fine-grained CDP hooks when low-level protocol access is needed, falling back to `chrome.tabs` and `chrome.scripting` for standard operations.

## 5. Security & Trust Zone
- **Trust Zone**: **Zone 0 (Read)** for `list_tabs`; **Zone 1 (Interaction)** for `navigate` and `createTab`.
- **Protection**: Cannot navigate to restricted schemes (`chrome://`, `brave://`, `about:`, `file://`) without explicit elevated operator override.
