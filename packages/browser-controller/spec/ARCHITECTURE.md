# Browser Controller: Platform Architecture Specification

## 1. System Vision
The **Browser Controller** is an enterprise-grade, multi-agent-ready browser automation platform. It is not an ad-hoc script runner or a single-tab scraper; it is a long-running daemon and service mesh that exposes high-reliability, security-gated browser capabilities to any AI agent via the **Model Context Protocol (MCP)**, **gRPC/REST APIs**, and **Native Event Streams**.

---

## 2. High-Level Subsystem Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │                   Client AI Agents                     │
                    │         (Planner, Form Filler, Critic, QA)             │
                    └───────────────────────────┬────────────────────────────┘
                                                │ MCP (stdio / sse) / gRPC
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Browser Controller Core                                    │
│                                                                                            │
│   ┌───────────────────────────┐  ┌───────────────────────────┐  ┌───────────────────────┐  │
│   │   Session & Tab Manager   │  │   Semantic DOM Engine     │  │   Security & Gates    │  │
│   │  (Ambient, Ephemeral, CDP)│  │ (AXTree, ARIA, IntentMap) │  │ (Turnstile, MFA, HITL)│  │
│   └─────────────┬─────────────┘  └─────────────┬─────────────┘  └───────────┬───────────┘  │
│                 │                              │                            │              │
│   ┌─────────────┴─────────────┐  ┌─────────────┴─────────────┐  ┌───────────┴───────────┐  │
│   │   Storage & Cookie Store  │  │   Network & Telemetry     │  │   Event Streaming Bus │  │
│   │  (State Export / Import)  │  │  (Request/Response Inter) │  │  (DOM, Nav, Downloads)│  │
│   └─────────────┬─────────────┘  └─────────────┬─────────────┘  └───────────┬───────────┘  │
└─────────────────┼──────────────────────────────┼────────────────────────────┼──────────────┘
                  │ Native Messaging (JSON-RPC)  │                            │
                  ▼                              ▼                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                             Browser Execution Target                                       │
│                                                                                            │
│   ┌────────────────────────────────────────────────────────────────────────────────────┐   │
│   │                      Ambient User Browser (Brave / Chrome)                         │   │
│   │                                                                                    │   │
│   │   ┌─────────────────────────────────┐   ┌──────────────────────────────────────┐   │   │
│   │   │   Native Messaging Host (Node)  │<─>│   Manifest V3 Background Service     │   │   │
│   │   └─────────────────────────────────┘   └──────────────────┬───────────────────┘   │   │
│   │                                                            │ chrome.debugger / DOM │   │
│   │                                                            ▼                       │   │
│   │                                         Active Tab & Content Scripts               │   │
│   └────────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Capability Modules

1. **Session & Tab Management**: Ambient session attachment (no browser restart), multi-window orchestration, ephemeral incognito sandboxes.
2. **Semantic Element Interaction**: Priority-based target resolution (AXTree $\rightarrow$ Roles $\rightarrow$ Text $\rightarrow$ CSS $\rightarrow$ Vision) with auto-scroll and visibility stabilization.
3. **Security & Human Gate Detection**: Detection of Cloudflare Turnstile, reCAPTCHA, and 2FA, with structured suspension protocols.
4. **Network & Console Telemetry**: Zero-polling request/response interception and error log stream.
5. **Credential & Autofill Broker**: Triggering native browser password managers without exposing credentials to agent logs.
