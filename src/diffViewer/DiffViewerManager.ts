import * as vscode from 'vscode';
import { DiffGenerator, FileDiff, EditOperation } from './DiffGenerator';
import { DiffViewerProvider } from './DiffViewerProvider';

export interface DiffApprovalRequest {
  id: string;
  type: 'write' | 'edit';
  filePath: string;
  diff: FileDiff;
  originalInput: any;
  timestamp: Date;
}

export interface DiffApprovalResponse {
  requestId: string;
  approved: boolean;
  approvedHunks?: string[]; // IDs of approved hunks, if partial approval
  rejectReason?: string;
}

export class DiffViewerManager {
  private static instance: DiffViewerManager;
  private diffViewerProvider: DiffViewerProvider;
  private pendingRequests: Map<string, DiffApprovalRequest> = new Map();
  private resolveCallbacks: Map<string, (response: DiffApprovalResponse) => void> = new Map();

  constructor(
    private context: vscode.ExtensionContext,
    private workspaceRoot: string
  ) {
    this.diffViewerProvider = new DiffViewerProvider(context, this);
  }

  static getInstance(context?: vscode.ExtensionContext, workspaceRoot?: string): DiffViewerManager {
    if (!DiffViewerManager.instance && context && workspaceRoot) {
      DiffViewerManager.instance = new DiffViewerManager(context, workspaceRoot);
    }
    return DiffViewerManager.instance;
  }

  /**
   * Request approval for a file write operation
   */
  async requestWriteApproval(filePath: string, content: string): Promise<DiffApprovalResponse> {
    const requestId = this.generateRequestId();
    
    try {
      // Generate diff
      const diff = DiffGenerator.generateWriteDiff(filePath, content, this.workspaceRoot);
      
      // Create approval request
      const request: DiffApprovalRequest = {
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
      return new Promise<DiffApprovalResponse>((resolve) => {
        this.resolveCallbacks.set(requestId, resolve);
      });
      
    } catch (error) {
      // If diff generation fails, fall back to simple approval
      return this.fallbackApproval(filePath, `write file '${filePath}'`, error);
    }
  }

  /**
   * Request approval for file edit operations
   */
  async requestEditApproval(filePath: string, edits: EditOperation[]): Promise<DiffApprovalResponse> {
    const requestId = this.generateRequestId();
    
    try {
      // Generate diff
      const diff = DiffGenerator.generateEditDiff(filePath, edits, this.workspaceRoot);
      
      // Create approval request
      const request: DiffApprovalRequest = {
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
      return new Promise<DiffApprovalResponse>((resolve) => {
        this.resolveCallbacks.set(requestId, resolve);
      });
      
    } catch (error) {
      // If diff generation fails, fall back to simple approval
      return this.fallbackApproval(filePath, `apply ${edits.length} edit(s) to '${filePath}'`, error);
    }
  }

  /**
   * Handle approval response from the UI
   */
  handleApprovalResponse(response: DiffApprovalResponse): void {
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
  getPendingRequest(requestId: string): DiffApprovalRequest | undefined {
    return this.pendingRequests.get(requestId);
  }

  /**
   * Cancel a pending request
   */
  cancelRequest(requestId: string): void {
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
  private async fallbackApproval(filePath: string, operation: string, error: any): Promise<DiffApprovalResponse> {
    console.warn('Diff viewer failed, falling back to simple approval:', error);
    
    const message = `Do you want to ${operation}?\n\nNote: Diff preview failed - ${error.message}`;
    const choice = await vscode.window.showWarningMessage(
      message,
      { modal: true },
      'Approve',
      'Reject'
    );
    
    return {
      requestId: 'fallback',
      approved: choice === 'Approve',
      rejectReason: choice === 'Reject' ? 'Rejected via fallback dialog' : undefined
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `diff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Cancel all pending requests
    for (const requestId of this.resolveCallbacks.keys()) {
      this.cancelRequest(requestId);
    }
    
    this.diffViewerProvider.dispose();
  }
}
