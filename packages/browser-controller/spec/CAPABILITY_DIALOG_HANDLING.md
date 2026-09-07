# Capability Spec: Native JavaScript Dialog & Modal Interception

## 1. Feature Description
Handles native browser dialogs (`window.alert`, `window.confirm`, `window.prompt`, and `beforeunload`) that freeze DOM execution threads when triggered by web pages.
Allows AI agents to:
- Set automated resolution policies (e.g. automatically accept all confirms, or reject prompts).
- Inspect the prompt message text and respond with dynamic input text.
- Prevent pages from trapping the agent with `onbeforeunload` confirmation spam.

## 2. Public TypeScript API
```typescript
export interface JavaScriptDialogEvent {
  tabId: number;
  type: 'alert' | 'confirm' | 'prompt' | 'beforeunload';
  message: string;
  defaultPrompt?: string;
}

export interface DialogManagementService {
  setDefaultDialogPolicy(tabId: number, policy: { action: 'accept' | 'dismiss'; promptText?: string }): Promise<void>;
  handleNextDialog(tabId: number, options: { action: 'accept' | 'dismiss'; promptText?: string }): Promise<JavaScriptDialogEvent>;
}
```

## 3. MCP Tool Schemas
```json
[
  {
    "name": "browser_set_dialog_policy",
    "description": "Sets the automatic handling policy for JavaScript alert, confirm, and prompt dialogs on a tab.",
    "inputSchema": {
      "type": "object",
      "required": ["tabId", "action"],
      "properties": {
        "tabId": { "type": "integer" },
        "action": { "type": "string", "enum": ["accept", "dismiss"] },
        "promptText": { "type": "string", "description": "Text to supply if a prompt() dialog appears" }
      }
    }
  }
]
```

## 4. Implementation Details
- Uses CDP `Page.enable` and listens for `Page.javascriptDialogOpening`.
- Automatically responds with `Page.handleJavaScriptDialog({ accept: true/false, promptText })`.
