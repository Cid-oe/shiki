# Capability Spec: Bounding-Box Visual Grounding & Screen Perception

## 1. Feature Description
Provides dual-modal perception when accessibility trees and DOM semantics fail (e.g. Canvas applications, SVG charts, obfuscated SPAs, and visual game engines).
1. Captures viewport or full-page high-DPI screenshots.
2. Runs UI Element Detection (bounding box grounding, icon recognition, and OCR).
3. Produces normalized coordinate targets (`{ x: 0.42, y: 0.81 }`) with visual crop thumbnails for agent verification.

## 2. Public TypeScript API
```typescript
export interface VisualBoundingBox {
  id: string;
  label: string; // e.g. "submit_button", "dropdown_arrow", "icon_trash"
  confidence: number;
  box2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0..1000
  centerPoint: { x: number; y: number }; // Absolute pixels
  ocrText?: string;
}

export interface BrowserVisionService {
  captureScreenshot(tabId: number, options?: { fullPage?: boolean; format?: 'png' | 'jpeg'; quality?: number }): Promise<{ base64Image: string; width: number; height: number }>;
  detectVisualElements(tabId: number, options?: { region?: { x: number; y: number; width: number; height: number } }): Promise<VisualBoundingBox[]>;
  clickCoordinates(tabId: number, point: { x: number; y: number }): Promise<{ clicked: boolean }>;
}
```

## 3. MCP Tool Schemas
```json
[
  {
    "name": "browser_capture_screenshot",
    "description": "Takes a screenshot of the visible viewport or entire page and returns base64 image data.",
    "inputSchema": {
      "type": "object",
      "required": ["tabId"],
      "properties": {
        "tabId": { "type": "integer" },
        "fullPage": { "type": "boolean", "default": false },
        "format": { "type": "string", "enum": ["png", "jpeg"], "default": "jpeg" }
      }
    }
  },
  {
    "name": "browser_click_coordinates",
    "description": "Dispatches a verified mouse click to explicit pixel coordinates when DOM elements cannot be reached semantically.",
    "inputSchema": {
      "type": "object",
      "required": ["tabId", "x", "y"],
      "properties": {
        "tabId": { "type": "integer" },
        "x": { "type": "number", "description": "X pixel coordinate" },
        "y": { "type": "number", "description": "Y pixel coordinate" }
      }
    }
  }
]
```

## 4. Extension & Native Host Implementation
- Extension executes `chrome.tabs.captureVisibleTab` or uses CDP `Page.captureScreenshot({ captureBeyondViewport: true })`.
- Coordinate dispatch uses CDP `Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 })`.
