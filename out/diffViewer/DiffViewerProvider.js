"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiffViewerProvider = void 0;
const vscode = __importStar(require("vscode"));
class DiffViewerProvider {
    constructor(context, diffManager) {
        this.context = context;
        this.diffManager = diffManager;
        this.disposables = [];
    }
    /**
     * Show diff viewer for the given request
     */
    async showDiff(request) {
        // Create or reveal webview panel
        if (this.panel) {
            this.panel.reveal();
        }
        else {
            this.panel = vscode.window.createWebviewPanel('diffViewer', 'Code Changes Review', vscode.ViewColumn.One, {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'webviews'),
                    vscode.Uri.joinPath(this.context.extensionUri, 'node_modules')
                ]
            });
            // Set up message handling
            this.panel.webview.onDidReceiveMessage(this.handleMessage.bind(this), undefined, this.disposables);
            // Clean up when panel is disposed
            this.panel.onDidDispose(() => {
                this.panel = undefined;
                this.disposables.forEach(d => d.dispose());
                this.disposables = [];
            }, undefined, this.disposables);
        }
        // Set webview content
        this.panel.webview.html = this.getWebviewContent();
        // Send diff data to webview
        this.panel.webview.postMessage({
            type: 'showDiff',
            request: {
                id: request.id,
                type: request.type,
                filePath: request.filePath,
                diff: request.diff,
                timestamp: request.timestamp.toISOString()
            }
        });
    }
    /**
     * Handle messages from the webview
     */
    handleMessage(message) {
        switch (message.type) {
            case 'approvalResponse':
                this.handleApprovalResponse(message.response);
                break;
            case 'requestPreview':
                this.handlePreviewRequest(message.requestId, message.approvedHunks);
                break;
            case 'cancelRequest':
                this.diffManager.cancelRequest(message.requestId);
                if (this.panel) {
                    this.panel.dispose();
                }
                break;
            case 'ready':
                // Webview is ready to receive data
                break;
            default:
                console.warn('Unknown message type:', message.type);
        }
    }
    /**
     * Handle approval response from webview
     */
    handleApprovalResponse(response) {
        this.diffManager.handleApprovalResponse(response);
        // Close the panel after approval
        if (this.panel) {
            this.panel.dispose();
        }
    }
    /**
     * Handle preview request
     */
    handlePreviewRequest(requestId, approvedHunks) {
        const request = this.diffManager.getPendingRequest(requestId);
        if (!request) {
            return;
        }
        // Generate preview content based on approved hunks
        let previewContent = request.diff.oldContent;
        // Apply only approved hunks
        const approvedHunkSet = new Set(approvedHunks);
        for (const hunk of request.diff.hunks) {
            if (approvedHunkSet.has(hunk.id)) {
                // Apply this hunk to the preview
                // This is a simplified implementation
                previewContent = previewContent.replace(hunk.oldContent.join('\n'), hunk.newContent.join('\n'));
            }
        }
        // Send preview back to webview
        if (this.panel) {
            this.panel.webview.postMessage({
                type: 'previewResult',
                requestId,
                previewContent
            });
        }
    }
    /**
     * Generate HTML content for the webview
     */
    getWebviewContent() {
        if (!this.panel) {
            throw new Error('Panel not initialized');
        }
        const webview = this.panel.webview;
        // Get URIs for resources
        const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'webviews', 'diffViewer.css'));
        const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'webviews', 'diffViewer.js'));
        // Load highlight.js for syntax highlighting
        const highlightJsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', 'highlight.js', 'lib', 'highlight.min.js'));
        const highlightCssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'node_modules', 'highlight.js', 'styles', 'vs2015.min.css'));
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource};">
    <title>Code Changes Review</title>
    <link rel="stylesheet" href="${highlightCssUri}">
    <link rel="stylesheet" href="${cssUri}">
</head>
<body>
    <div id="app">
        <div id="loading" class="loading">
            <div class="spinner"></div>
            <p>Loading diff viewer...</p>
        </div>
        
        <div id="diff-container" class="diff-container" style="display: none;">
            <!-- Header -->
            <div class="diff-header">
                <div class="file-info">
                    <h2 id="file-path"></h2>
                    <div class="file-stats">
                        <span id="additions" class="additions">+0</span>
                        <span id="deletions" class="deletions">-0</span>
                    </div>
                </div>
                
                <!-- Action buttons -->
                <div class="action-buttons">
                    <button id="approve-all" class="btn btn-primary">
                        ✅ Approve All
                    </button>
                    <button id="reject-all" class="btn btn-secondary">
                        ❌ Reject All
                    </button>
                    <button id="approve-selected" class="btn btn-success" disabled>
                        ✅ Approve Selected
                    </button>
                    <button id="preview" class="btn btn-info">
                        👁️ Preview Result
                    </button>
                </div>
            </div>

            <!-- Diff viewer mode toggle -->
            <div class="view-controls">
                <div class="view-mode">
                    <label>
                        <input type="radio" name="view-mode" value="unified" checked>
                        Unified View
                    </label>
                    <label>
                        <input type="radio" name="view-mode" value="split">
                        Split View
                    </label>
                </div>
                
                <div class="options">
                    <label>
                        <input type="checkbox" id="show-whitespace">
                        Show Whitespace
                    </label>
                </div>
            </div>

            <!-- Diff content -->
            <div id="diff-content" class="diff-content">
                <!-- Dynamic content will be inserted here -->
            </div>

            <!-- Preview modal -->
            <div id="preview-modal" class="modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Preview Result</h3>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <pre id="preview-content"><code></code></pre>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="${highlightJsUri}"></script>
    <script src="${jsUri}"></script>
</body>
</html>`;
    }
    /**
     * Dispose of resources
     */
    dispose() {
        if (this.panel) {
            this.panel.dispose();
        }
        this.disposables.forEach(d => d.dispose());
    }
}
exports.DiffViewerProvider = DiffViewerProvider;
//# sourceMappingURL=DiffViewerProvider.js.map