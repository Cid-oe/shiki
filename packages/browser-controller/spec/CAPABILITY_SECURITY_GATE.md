# Capability Spec: Security Gates & Human-in-the-Loop Hand-off

## 1. Feature Description
Solves the fundamental agent roadblock: Cloudflare Turnstile, reCAPTCHA, Cloudflare Managed Challenge, and multi-factor authentication.
Instead of spinning tokens in endless retry loops or failing silently:
1. Detects presence and state of challenges across DOM and iframe hierarchies.
2. Emits a typed event over the Runtime Event Bus.
3. Automatically suspends agent execution with a durable checkpoint.
4. Alerts the human operator (via out-of-band push / Telegram / desktop notification).
5. Resumes execution instantly once the challenge clearance token is observed.

## 2. Public TypeScript API
```typescript
export interface SecurityGateStatus {
  hasChallenge: boolean;
  type: 'turnstile' | 'recaptcha_v2' | 'recaptcha_v3' | 'hcaptcha' | 'cloudflare_managed' | 'mfa_prompt' | 'none';
  solved: boolean;
  token?: string;
}

export interface SecurityGateService {
  inspectGate(tabId: number): Promise<SecurityGateStatus>;
  awaitGateResolution(tabId: number, timeoutMs?: number): Promise<{ solved: boolean; token?: string }>;
  requestHumanIntervention(tabId: number, options: { reason: string; notifyChannels?: ('telegram' | 'desktop')[] }): Promise<{ interventionId: string; resolvedPromise: Promise<boolean> }>;
}
```

## 3. MCP Tool Schemas
```json
[
  {
    "name": "browser_inspect_security_gate",
    "description": "Checks if the current page or any child iframe is presenting an anti-bot challenge (Turnstile, reCAPTCHA, etc.).",
    "inputSchema": {
      "type": "object",
      "required": ["tabId"],
      "properties": {
        "tabId": { "type": "integer" }
      }
    }
  },
  {
    "name": "browser_await_security_gate",
    "description": "Suspends agent tool calling until a detected challenge is solved by the user or cleared by the browser.",
    "inputSchema": {
      "type": "object",
      "required": ["tabId"],
      "properties": {
        "tabId": { "type": "integer" },
        "timeoutMs": { "type": "integer", "default": 60000 }
      }
    }
  }
]
```

## 4. Operational Telemetry & Trigger Mechanism
- Monitors DOM nodes matching:
  - `iframe[src*="challenges.cloudflare.com"]`
  - `input[name="cf-turnstile-response"]`
  - `div.g-recaptcha`, `iframe[src*="google.com/recaptcha"]`
- Hooks `MutationObserver` on the target frame to detect token insertion without CPU-intensive polling.
