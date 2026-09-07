# Capability Spec: Autonomous Workflow Recorder & Compiler

## 1. Feature Description
Solves the high token cost and latency of LLM agents running the same browser workflow repeatedly.
1. **Record**: As an exploratory agent interacts with a web application (clicks, inputs, navigations), the controller records the sequence of semantic actions, invariant selectors, and network preconditions.
2. **Compile**: Optimizes and compiles the trace into a deterministic, zero-token `workflow.yaml`.
3. **Execute**: Future runs execute the compiled pipeline at native CDP speed (100x faster, zero LLM reasoning tokens) while falling back to the LLM agent only if DOM assertions break.

## 2. Public TypeScript API
```typescript
export interface RecordedAction {
  type: 'navigate' | 'click' | 'fill' | 'select' | 'upload' | 'assert_network';
  target: {
    semanticRole?: string;
    accessibleName?: string;
    stableSelector?: string;
  };
  value?: string;
  verificationExpected?: {
    networkUrl?: string;
    statusCode?: number;
  };
}

export interface WorkflowCompilerService {
  startRecording(tabId: number): Promise<{ recordingId: string }>;
  stopAndCompile(recordingId: string, workflowName: string): Promise<{ yamlPath: string; stepCount: number }>;
  executeCompiledWorkflow(tabId: number, yamlPath: string, variables?: Record<string, string>): Promise<{ success: boolean; durationMs: number }>;
}
```

## 3. MCP Tool Schemas
```json
[
  {
    "name": "browser_record_workflow",
    "description": "Begins recording semantic actions on a tab to compile into a deterministic, zero-token workflow script.",
    "inputSchema": {
      "type": "object",
      "required": ["tabId"],
      "properties": {
        "tabId": { "type": "integer" }
      }
    }
  },
  {
    "name": "browser_execute_workflow",
    "description": "Executes a pre-compiled workflow.yaml script at native speed without LLM token consumption.",
    "inputSchema": {
      "type": "object",
      "required": ["tabId", "workflowPath"],
      "properties": {
        "tabId": { "type": "integer" },
        "workflowPath": { "type": "string" },
        "variables": { "type": "object" }
      }
    }
  }
]
```
