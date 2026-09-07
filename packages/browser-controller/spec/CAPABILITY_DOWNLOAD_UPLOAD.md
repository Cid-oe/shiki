# Capability Spec: File Downloads, Uploads & Chooser Handlers

## 1. Feature Description
Provides autonomous handling of OS-level file dialogs (`<input type="file">`, window download prompts, and print-to-PDF). 
In standard browser automation, operating system native file pickers freeze execution because they operate outside the DOM. This capability intercepts and automates:
- Direct attachment of local files to web file inputs via CDP `DOM.setFileInputFiles`.
- Interception of browser download events, redirection of target paths, and confirmation upon completion.
- Generating headless PDF renders of any page state.

## 2. Public TypeScript API
```typescript
export interface DownloadEvent {
  downloadId: number;
  tabId: number;
  url: string;
  filename: string;
  totalBytes: number;
  state: 'in_progress' | 'interrupted' | 'complete';
  targetPath?: string;
}

export interface FileTransferService {
  setFileInput(tabId: number, query: { selector?: string; name?: string }, filePaths: string[]): Promise<{ attached: boolean; count: number }>;
  waitForDownload(tabId: number, options?: { destinationDir?: string; timeoutMs?: number }): Promise<DownloadEvent>;
  capturePageToPdf(tabId: number, options?: { outputPath: string; printBackground?: boolean }): Promise<{ success: boolean; path: string }>;
}
```

## 3. MCP Tool Schemas
```json
[
  {
    "name": "browser_upload_file",
    "description": "Attaches one or more local file paths to a web file input without opening an OS dialog window.",
    "inputSchema": {
      "type": "object",
      "required": ["tabId", "filePaths"],
      "properties": {
        "tabId": { "type": "integer" },
        "query": {
          "type": "object",
          "properties": {
            "selector": { "type": "string" },
            "name": { "type": "string" }
          }
        },
        "filePaths": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Absolute filesystem paths to upload"
        }
      }
    }
  },
  {
    "name": "browser_wait_for_download",
    "description": "Intercepts a browser file download and saves it directly to a verified local directory.",
    "inputSchema": {
      "type": "object",
      "required": ["tabId"],
      "properties": {
        "tabId": { "type": "integer" },
        "destinationDir": { "type": "string", "default": "~/Downloads" },
        "timeoutMs": { "type": "integer", "default": 30000 }
      }
    }
  }
]
```

## 4. Extension & Native Messaging Implementation
- Background service worker registers `chrome.downloads.onCreated`, `chrome.downloads.onDeterminingFilename`, and `chrome.downloads.onChanged`.
- For file upload inputs: uses CDP `Page.setInterceptFileChooserDialog` or `DOM.setFileInputFiles` to bypass native X11/Wayland file dialogs.

## 5. Security & Trust Level
- **Trust Zone**: **Zone 2 (Local Filesystem Write/Read)**.
- **Constraints**: Agents can only read from or write to explicitly authorized directories (e.g. project artifacts or user downloads directory). System directories (`/etc`, `/usr`, `/proc`) are hard-blocked by the Native Host validator.
