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
exports.DiffViewerManager = void 0;
const vscode = __importStar(require("vscode"));
const DiffGenerator_1 = require("./DiffGenerator");
const DiffViewerProvider_1 = require("./DiffViewerProvider");
class DiffViewerManager {
    constructor(context, workspaceRoot) {
        this.context = context;
        this.workspaceRoot = workspaceRoot;
        this.pendingRequests = new Map();
        this.resolveCallbacks = new Map();
        this.diffViewerProvider = new DiffViewerProvider_1.DiffViewerProvider(context, this);
    }
    static getInstance(context, workspaceRoot) {
        if (!DiffViewerManager.instance && context && workspaceRoot) {
            DiffViewerManager.instance = new DiffViewerManager(context, workspaceRoot);
        }
        return DiffViewerManager.instance;
    }
    /**
     * Request approval for a file write operation
     */
    async requestWriteApproval(filePath, content) {
        const requestId = this.generateRequestId();
        try {
            // Generate diff
            const diff = DiffGenerator_1.DiffGenerator.generateWriteDiff(filePath, content, this.workspaceRoot);
            // Create approval request
            const request = {
                id: requestId,
                type: 'write',
                filePath,
                diff,
                originalInput: { file_path: filePath, content },
                timestamp: new Date()
            };
            // Store request
            this.pendingRequests.set(requestId, request);
            // Show diff viewer
            await this.diffViewerProvider.showDiff(request);
            // Return promise that resolves when user responds
            return new Promise((resolve) => {
                this.resolveCallbacks.set(requestId, resolve);
            });
        }
        catch (error) {
            // If diff generation fails, fall back to simple approval
            return this.fallbackApproval(filePath, `write file '${filePath}'`, error);
        }
    }
    /**
     * Request approval for file edit operations
     */
    async requestEditApproval(filePath, edits) {
        const requestId = this.generateRequestId();
        try {
            // Generate diff
            const diff = DiffGenerator_1.DiffGenerator.generateEditDiff(filePath, edits, this.workspaceRoot);
            // Create approval request
            const request = {
                id: requestId,
                type: 'edit',
                filePath,
                diff,
                originalInput: { file_path: filePath, edits },
                timestamp: new Date()
            };
            // Store request
            this.pendingRequests.set(requestId, request);
            // Show diff viewer
            await this.diffViewerProvider.showDiff(request);
            // Return promise that resolves when user responds
            return new Promise((resolve) => {
                this.resolveCallbacks.set(requestId, resolve);
            });
        }
        catch (error) {
            // If diff generation fails, fall back to simple approval
            return this.fallbackApproval(filePath, `apply ${edits.length} edit(s) to '${filePath}'`, error);
        }
    }
    /**
     * Handle approval response from the UI
     */
    handleApprovalResponse(response) {
        const callback = this.resolveCallbacks.get(response.requestId);
        if (callback) {
            callback(response);
            this.resolveCallbacks.delete(response.requestId);
            this.pendingRequests.delete(response.requestId);
        }
    }
    /**
     * Get pending request by ID
     */
    getPendingRequest(requestId) {
        return this.pendingRequests.get(requestId);
    }
    /**
     * Cancel a pending request
     */
    cancelRequest(requestId) {
        const callback = this.resolveCallbacks.get(requestId);
        if (callback) {
            callback({
                requestId,
                approved: false,
                rejectReason: 'Cancelled by user'
            });
            this.resolveCallbacks.delete(requestId);
            this.pendingRequests.delete(requestId);
        }
    }
    /**
     * Fallback to simple VS Code dialog if diff viewer fails
     */
    async fallbackApproval(filePath, operation, error) {
        console.warn('Diff viewer failed, falling back to simple approval:', error);
        const message = `Do you want to ${operation}?\n\nNote: Diff preview failed - ${error.message}`;
        const choice = await vscode.window.showWarningMessage(message, { modal: true }, 'Approve', 'Reject');
        return {
            requestId: 'fallback',
            approved: choice === 'Approve',
            rejectReason: choice === 'Reject' ? 'Rejected via fallback dialog' : undefined
        };
    }
    /**
     * Generate unique request ID
     */
    generateRequestId() {
        return `diff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Clean up resources
     */
    dispose() {
        // Cancel all pending requests
        for (const requestId of this.resolveCallbacks.keys()) {
            this.cancelRequest(requestId);
        }
        this.diffViewerProvider.dispose();
    }
}
exports.DiffViewerManager = DiffViewerManager;
//# sourceMappingURL=DiffViewerManager.js.map