# Capability Spec: Native Credential Broker & Zero-Knowledge Autofill

## 1. Feature Description
Eliminates the anti-pattern of passing plaintext passwords or tokens through LLM context windows or agent chats. 
When an AI agent encounters a login screen, registration form, or checkout flow:
1. The agent signals the semantic requirement (e.g. `request_credential_autofill(tabId, domain, accountType)`).
2. The Browser Controller invokes the browser's built-in Credential Management API (`navigator.credentials.get()`) or queries the local platform password vault (libsecret / GNOME Keyring / macOS Keychain / 1Password / Bitwarden).
3. Credentials are populated directly into DOM memory inside the extension content script context.
4. The agent receives a status receipt (`{ status: 'populated', username: 'Cid-oe' }`) without ever reading or logging the raw password string.

## 2. Public TypeScript API
```typescript
export interface AutofillRequest {
  tabId: number;
  domain: string;
  fieldTypes: ('username' | 'password' | 'totp' | 'address' | 'credit_card')[];
}

export interface AutofillReceipt {
  success: boolean;
  populatedFields: string[];
  identityIdentifier?: string; // e.g. "cid066a86@gmail.com"
  masked: boolean;
  requiresBiometricPrompt: boolean;
}

export interface CredentialBrokerService {
  requestCredentialAutofill(request: AutofillRequest): Promise<AutofillReceipt>;
  triggerNativePasswordManager(tabId: number): Promise<{ dialogShown: boolean }>;
  storeNewCredentials(tabId: number, domain: string, username: string): Promise<{ saved: boolean }>;
}
```

## 3. MCP Tool Schemas
```json
[
  {
    "name": "browser_request_credential_autofill",
    "description": "Triggers browser-level or system-level password manager autofill into matching form fields without revealing the password to the agent.",
    "inputSchema": {
      "type": "object",
      "required": ["tabId", "domain"],
      "properties": {
        "tabId": { "type": "integer" },
        "domain": { "type": "string" },
        "fieldTypes": {
          "type": "array",
          "items": { "type": "string", "enum": ["username", "password", "totp", "address"] },
          "default": ["username", "password"]
        }
      }
    }
  },
  {
    "name": "browser_trigger_native_autofill",
    "description": "Focuses the primary credential field and dispatches native browser autofill suggestions.",
    "inputSchema": {
      "type": "object",
      "required": ["tabId"],
      "properties": {
        "tabId": { "type": "integer" }
      }
    }
  }
]
```

## 4. Extension & Native Messaging Implementation
- Content script listens for `AUTOFILL_DISPATCH`.
- Uses `chrome.debugger` to send `Input.dispatchKeyEvent` or dispatches synthetic `isTrusted`-like input events if using standard extension scripts.
- Integrates with OS credential stores via `secret-tool` (Linux libsecret) or native messaging host hooks.

## 5. Security & Trust Level
- **Trust Zone**: **Zone 3 (Sensitive Execution / Zero-Knowledge Isolation)**.
- **Safety Policy**:
  - The Native Host never echoes the password value back to stdout or the IPC socket.
  - Zero password leaks in transcript logs, telemetry databases, or LLM reasoning tokens.
