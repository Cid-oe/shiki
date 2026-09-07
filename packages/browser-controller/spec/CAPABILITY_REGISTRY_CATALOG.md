# Browser Controller: Master Capability Matrix & Benchmark Gap Analysis

This document catalogs every browser capability required by autonomous agents, mapped to its implementation layer and trust zone.

---

## 1. Capability Maturity Matrix

| Capability Category | Specific Feature | Implementation Layer | Trust Ring | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Session Management** | Ambient Tab Discovery | `chrome.tabs.query` | Zone 0 | ✅ Implemented |
| **Session Management** | Ambient Tab Attachment | `chrome.debugger.attach` | Zone 1 | ✅ Implemented |
| **Session Management** | URL Navigation & Wait | `chrome.tabs.update` | Zone 1 | ✅ Implemented |
| **DOM Interaction** | Accessible Tree Query | `Accessibility.getFullAXTree` | Zone 0 | ✅ Specified |
| **DOM Interaction** | Semantic Form Fill | `Input.dispatchKeyEvent` + Events | Zone 1 | ✅ Specified |
| **DOM Interaction** | Semantic Click | `DOM.scrollIntoView` + Click | Zone 1 | ✅ Specified |
| **Security & Challenges** | Cloudflare Turnstile Detection | `MutationObserver` on iframe | Zone 0 | ✅ Implemented |
| **Security & Challenges** | Challenge Token Await | Non-polling Event Bridge | Zone 0 | ✅ Implemented |
| **Security & Challenges** | HITL Telegram Relay | Out-of-band Webhook | Zone 4 | 🔄 In Spec |
| **Telemetry & Verification**| Response Code Verification | `Network.responseReceived` | Zone 0 | ✅ Specified |
| **Telemetry & Verification**| Network Idle Synchronization | In-flight request ring buffer | Zone 0 | ✅ Specified |
| **Credentials & Privacy** | Zero-Knowledge Autofill | `CredentialManagement` / Secret-tool | Zone 3 | ✅ Specified |
| **File I/O** | OS File Chooser Bypass | `DOM.setFileInputFiles` | Zone 2 | ✅ Specified |
| **File I/O** | Download Interception | `chrome.downloads.onDeterminingFilename` | Zone 2 | ✅ Specified |
| **Dual-Modal Vision** | Full-Page Screenshot | `Page.captureScreenshot` | Zone 0 | ✅ Specified |
| **Dual-Modal Vision** | Coordinate Grounding | `Input.dispatchMouseEvent` | Zone 1 | ✅ Specified |
| **Browser Storage** | Cookie Export / Import | `chrome.cookies.getAll` | Zone 3 | 🔄 Next |
| **Browser Storage** | LocalStorage / IndexedDB | `DOMStorage.getDOMStorageItems` | Zone 1 | 🔄 Next |
| **Dialog Management** | JavaScript Alert / Prompt | `Page.javascriptDialogOpening` | Zone 1 | 🔄 Next |

---

## 2. Benchmark Scenario Trace: "Register a Free Domain"

How a future AI agent executes the DigitalPlat domain registration without custom scripting:

```
[Agent Planner]
       │
       ▼
 1. Attach to Ambient Tab
    -> Call: browser_list_tabs(urlPattern: "digitalplat.org")
    -> Call: browser_attach_tab(tabId: 101)
       │
       ▼
 2. Semantic Form Population
    -> Call: browser_fill_semantic(query: { name: "username" }, value: "Cid-oe")
    -> Call: browser_fill_semantic(query: { name: "email" }, value: "cid@gmail.com")
    -> Call: browser_request_credential_autofill(domain: "digitalplat.org") // Populates password safely
       │
       ▼
 3. Autonomous Gate Inspection
    -> Call: browser_inspect_security_gate(tabId: 101)
    -> Result: { hasChallenge: true, type: "turnstile", solved: false }
       │
       ▼
 4. Reactive Suspension / Human Hand-off
    -> Call: browser_await_security_gate(tabId: 101, timeoutMs: 60000)
    -> Controller fires Telegram alert: "Please verify Turnstile on DigitalPlat tab"
    -> User taps checkmark
    -> Token inserted into DOM -> Event bus triggers agent wakeup immediately (0 polling tokens)
       │
       ▼
 5. Deterministic Network Submission Verification
    -> Call: browser_click_semantic(query: { role: "button", name: "Register" })
    -> Call: browser_wait_for_response(urlPattern: "/api/auth/register", expectedStatus: 200)
    -> Verified: Status 200 OK. Account created.
```
