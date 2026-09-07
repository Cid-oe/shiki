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
  • Wayland / Hyprland Windows                 • Durable Entity Knowledge Graph
  • System Clipboard & Notifications           • Continuous Research Deduplication
  • Docker / Container Exec                     • Financial & AI Signals Extractor
  • Ambient Browser Automation                 • Social Media Intelligence
       │                                               │
       └───────────────────────┬───────────────────────┘
                               │
                               ▼
            Master MCP Server (16 Tools via stdio)
```

---

## 🚀 Capabilities

### 1. Desktop & OS Management
* `desktop_list_windows`: Real-time Wayland/X11 window and workspace discovery.
* `desktop_focus_window`: Window focus and workspace navigation.
* `desktop_get_clipboard` / `desktop_set_clipboard`: System clipboard reading and writing.
* `desktop_notify`: System notifications via `notify-send`.

### 2. Native Ambient Browser Automation
* Attached to ambient user sessions (Brave/Chrome) preserving login states, cookies, and anti-bot fingerprints.
* Semantic element interaction (Accessible Role + Name -> Placeholder -> Coordinates).
* Automatic Cloudflare Turnstile, reCAPTCHA, and 2FA gate diagnosis.
* Network request/response interception and network idle synchronization.

### 3. Container & Infrastructure
* `container_list` & `container_exec`: Direct command execution inside Docker/Podman containers.

### 4. Continuous Learning & Research Intelligence
* Ingests academic papers and financial digests.
* Automatically parses actionable takeaways and entities (tools, startups, markets).
* Prevents redundant research by tracking read history.

---

## 🧪 Testing

```bash
# Run the platform test suite
node tests/verify_universal_platform.js
node tests/test_research_intelligence.js

# Run the browser engine suite
node packages/browser-controller/tests/run_tests.js
```

---

## 📜 License
MIT
