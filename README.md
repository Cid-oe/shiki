# SHIKI (式) — Universal AI Digital Execution Platform

> *"If a human can do it on a computer, Shiki can execute it."*

**Shiki** (inspired by *Kara no Kyoukai* / Shikigami 式神) is a general-purpose digital execution and continuous learning platform for autonomous AI agents.

---

## ⚡ Core Architecture

```
                       SHIKI CORE RUNTIME
                               │
       ┌───────────────────────┴───────────────────────┐
       ▼                                               ▼
 [EXECUTION MESH]                             [KNOWLEDGE ENGINE]
  • Local Shell & Filesystem (argv safe)       • Durable Entity Knowledge Graph
  • Wayland / Hyprland Windows                 • Continuous Research Deduplication
  • System Clipboard & Notifications           • Financial & AI Signals Extractor
  • Docker / Container Exec                     • Social Media Intelligence
  • Ambient Browser Automation                 
       │                                               │
       └───────────────────────┬───────────────────────┘
                               │
                               ▼
            Master MCP Server (21 Tools via stdio)
```

---

## 🚀 Capabilities (21 Master Tools)

### 1. Local Host Shell & Filesystem
* `shell_exec`: Safe local command execution with argv arrays, working directory, and timeout aborts.
* `file_read` / `file_write`: Direct filesystem read/write with parent directory creation and size caps.
* `file_list` / `file_search`: Bounded directory inspection and regex/content search, skipping noisy trees (`.git`, `node_modules`).

### 2. Desktop & OS Management
* `desktop_list_windows`: Real-time Wayland/X11 window and workspace discovery (returns clean arrays with availability metadata).
* `desktop_focus_window`: Window focus and workspace navigation.
* `desktop_get_clipboard` / `desktop_set_clipboard`: System clipboard reading and writing via `wl-copy`/`xclip`.
* `desktop_notify`: Safe system notifications via `execFile` argv (immune to shell injection).

### 3. Native Ambient Browser Automation
* Attached to ambient user sessions (Brave/Chrome) preserving login states, cookies, and anti-bot fingerprints.
* Semantic element interaction (Accessible Role + Name -> Placeholder -> Coordinates).
* Automatic Cloudflare Turnstile, reCAPTCHA, and 2FA gate diagnosis (`browser.security.handoff`).
* Autonomous candidate generation & ranking (`browser.goal.autonomous_completion`).

### 4. Container & Infrastructure
* `container_list` & `container_exec`: Direct command execution inside Docker/Podman containers with alphanumeric identifier validation.

### 5. Continuous Learning & Research Intelligence
* Ingests academic papers and financial digests.
* Automatically parses actionable takeaways and entities (tools, startups, markets).
* Prevents redundant research by tracking read history.

---

## 🛡️ Trust Model v2 (No Self-Attestation)
* **Connection-Scoped Grants**: Handshake via `initialize` establishes connection privilege (Zone 0 to 4).
* **Per-Call Invariant**: Per-call `params.context.operatorTrustLevel` can only **lower** authority, never elevate above connection grant.
* **Default-Deny**: Non-integer or malformed inputs strictly default to lowest privilege.

---

## 🧪 Testing

```bash
# Run the complete test suite (5 test files, 19 assertions)
npm test
```

---

## 📜 License
MIT
