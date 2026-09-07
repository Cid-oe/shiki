# Capability Spec: Semantic DOM Inspection & Interaction

## 1. Feature Description
Provides resilient, accessibility-tree-first interaction primitives. Replaces brittle CSS/XPath coordinates with semantic query resolution:
`Accessible Role + Name -> Visible Label -> data-testid -> Text Content -> Layout Coordinates`.
Supports auto-scrolling to elements, waiting for visibility, and typing with realistic dispatch events.

## 2. Public TypeScript API
```typescript
export interface SemanticQuery {
  role?: 'button' | 'link' | 'textbox' | 'checkbox' | 'combobox' | 'menuitem';
  name?: string; // Accessible name or visible text
  placeholder?: string;
  label?: string;
  testId?: string;
  selector?: string; // Fallback CSS
}

export interface ElementSnapshot {
  handle: string; // Ephemeral DOM reference ID
  role: string;
  name: string;
  tag: string;
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  rect: { x: number; y: number; width: number; height: number };
}

export interface SemanticDOMService {
  queryElements(tabId: number, query: SemanticQuery): Promise<ElementSnapshot[]>;
  clickSemantic(tabId: number, query: SemanticQuery, options?: { doubleClick?: boolean }): Promise<{ clicked: boolean }>;
  fillSemantic(tabId: number, query: SemanticQuery, value: string, options?: { clearFirst?: boolean; maskInLogs?: boolean }): Promise<{ filled: boolean }>;
  selectOption(tabId: number, query: SemanticQuery, optionValueOrText: string): Promise<{ selected: boolean }>;
  dumpAccessibilityTree(tabId: number, maxDepth?: number): Promise<string>;
}
```

## 3. MCP Tool Schemas
```json
[
  {
    "name": "browser_query_elements",
    "description": "Searches for interactive elements using accessibility roles, labels, and semantic names.",
    "inputSchema": {
      "type": "object",
      "required": ["tabId"],
      "properties": {
        "tabId": { "type": "integer" },
        "role": { "type": "string" },
        "name": { "type": "string" },
        "placeholder": { "type": "string" }
      }
    }
  },
  {
    "name": "browser_fill_semantic",
    "description": "Locates an input field by semantic attributes and simulates realistic typing.",
    "inputSchema": {
      "type": "object",
      "required": ["tabId", "query", "value"],
      "properties": {
        "tabId": { "type": "integer" },
        "query": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "placeholder": { "type": "string" },
            "label": { "type": "string" },
            "role": { "type": "string" }
          }
        },
        "value": { "type": "string" },
        "maskInLogs": { "type": "boolean", "default": false }
      }
    }
  },
  {
    "name": "browser_click_semantic",
    "description": "Clicks an interactive element resolved through accessibility names or roles.",
    "inputSchema": {
      "type": "object",
      "required": ["tabId", "query"],
      "properties": {
        "tabId": { "type": "integer" },
        "query": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "role": { "type": "string" }
          }
        }
      }
    }
  }
]
```

## 4. Implementation Details
- Uses `chrome.debugger` to query `Accessibility.getFullAXTree`.
- Injects synthetic `InputEvent('beforeinput')`, `InputEvent('input')`, and `Event('change')` to satisfy reactive frameworks (React, Vue, Angular, Svelte).
