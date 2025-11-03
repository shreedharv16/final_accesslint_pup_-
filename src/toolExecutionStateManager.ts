import * as vscode from 'vscode';
import { ToolDefinition, ToolResult } from './tools-accesslint/types';

export interface ToolExecutionState {
  id: string;
  toolName: string;
  input: any;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime?: number;
  result?: ToolResult;
  error?: string;
  metadata: {
    attempts: number;
    lastAttemptTime: number;
    totalDuration: number;
    memoryUsage?: number;
  };
}

export interface ExecutionSession {
  id: string;
  startTime: number;
  endTime?: number;
  toolExecutions: ToolExecutionState[];
  totalTokensUsed: number;
  status: 'active' | 'completed' | 'failed' | 'cancelled';
}

export interface StateManagerConfig {
  maxConcurrentExecutions: number;
  executionTimeout: number;
  retryLimit: number;
  enableMetrics: boolean;
  enableLogging: boolean;
}

/**
 * Tool execution state manager inspired by Cline's approach
 * Manages execution lifecycle, prevents multiple executions, tracks state
 */
export class ToolExecutionStateManager {
  private activeExecutions: Map<string, ToolExecutionState> = new Map();
  private executionHistory: Map<string, ToolExecutionState> = new Map();
  private currentSession: ExecutionSession | null = null;
  private outputChannel: vscode.OutputChannel;
  private config: StateManagerConfig;

  constructor(config?: Partial<StateManagerConfig>) {
    this.config = {
      maxConcurrentExecutions: 1, // Like Cline - only one tool at a time
      executionTimeout: 30000, // 30 seconds
      retryLimit: 3,
      enableMetrics: true,
      enableLogging: true,
      ...config
    };

    this.outputChannel = vscode.window.createOutputChannel('AccessLint Tool State');
    
    if (this.config.enableLogging) {
      this.outputChannel.appendLine('🔧 Tool execution state manager initialized');
      this.outputChannel.appendLine(`⚙️ Config: ${JSON.stringify(this.config)}`);
    }
  }

  /**
   * Start a new execution session
   */
  startSession(): string {
    if (this.currentSession && this.currentSession.status === 'active') {
      this.endSession('completed');
    }

    const sessionId = this.generateId('session');
    this.currentSession = {
      id: sessionId,
      startTime: Date.now(),
      toolExecutions: [],
      totalTokensUsed: 0,
      status: 'active'
    };

    if (this.config.enableLogging) {
      this.outputChannel.appendLine(`🚀 New execution session started: ${sessionId}`);
    }

    return sessionId;
  }

  /**
   * End the current session
   */
  endSession(status: 'completed' | 'failed' | 'cancelled' = 'completed'): void {
    if (!this.currentSession) return;

    this.currentSession.endTime = Date.now();
    this.currentSession.status = status;

    if (this.config.enableLogging) {
      const duration = this.currentSession.endTime - this.currentSession.startTime;
      this.outputChannel.appendLine(
        `🏁 Session ${this.currentSession.id} ended: ${status} (${duration}ms)`
      );
    }

    this.currentSession = null;
  }

  /**
   * Check if a tool execution should be allowed (Cline-style single execution)
   */
  canExecuteTool(toolName: string): {
    allowed: boolean;
    reason?: string;
    activeExecutions?: string[];
  } {
    // Check if at maximum concurrent executions
    if (this.activeExecutions.size >= this.config.maxConcurrentExecutions) {
      return {
        allowed: false,
        reason: `Maximum concurrent executions reached (${this.config.maxConcurrentExecutions})`,
        activeExecutions: Array.from(this.activeExecutions.keys())
      };
    }

    // Check if this tool is already running (prevent duplicates)
    const existingExecution = Array.from(this.activeExecutions.values())
      .find(execution => execution.toolName === toolName && execution.status === 'running');

    if (existingExecution) {
      return {
        allowed: false,
        reason: `Tool ${toolName} is already running (ID: ${existingExecution.id})`,
        activeExecutions: [existingExecution.id]
      };
    }

    return { allowed: true };
  }

  /**
   * Check if tool execution is allowed in sequential mode (single tool per message)
   */
  canExecuteToolSequentially(toolName: string, messageToolUsed: boolean): {
    allowed: boolean;
    reason?: string;
    policy?: string;
  } {
    // First check concurrent execution limits
    const concurrentCheck = this.canExecuteTool(toolName);
    if (!concurrentCheck.allowed) {
      return {
        allowed: false,
        reason: concurrentCheck.reason,
        policy: 'concurrent_execution_limit'
      };
    }

    // Check sequential execution policy - only one tool per message
    if (messageToolUsed) {
      return {
        allowed: false,
        reason: `Sequential execution policy: Tool "${toolName}" blocked because another tool has already been used in this message`,
        policy: 'sequential_execution_policy'
      };
    }

    return { allowed: true };
  }

  /**
   * Check if a tool execution should be allowed (Cline-style single execution) - DEPRECATED: Use canExecuteToolSequentially for sequential execution
   */
  canExecuteToolLegacy(toolName: string): {
    allowed: boolean;
    reason?: string;
    activeExecutions?: string[];
  } {
    // Check if at maximum concurrent executions
    if (this.activeExecutions.size >= this.config.maxConcurrentExecutions) {
      return {
        allowed: false,
        reason: `Maximum concurrent executions reached (${this.config.maxConcurrentExecutions})`,
        activeExecutions: Array.from(this.activeExecutions.keys())
      };
    }

    // Check if this tool is already running (prevent duplicates)
    const existingExecution = Array.from(this.activeExecutions.values())
      .find(execution => execution.toolName === toolName && execution.status === 'running');

    if (existingExecution) {
      return {
        allowed: false,
        reason: `Tool ${toolName} is already running (ID: ${existingExecution.id})`,
        activeExecutions: [existingExecution.id]
      };
    }

    return { allowed: true };
  }

  /**
   * Start tracking a tool execution
   */
  startExecution(toolName: string, input: any): string {
    const canExecute = this.canExecuteTool(toolName);
    if (!canExecute.allowed) {
      throw new Error(`Cannot execute tool: ${canExecute.reason}`);
    }

    const executionId = this.generateId('exec');
    const execution: ToolExecutionState = {
      id: executionId,
      toolName,
      input,
      status: 'pending',
      startTime: Date.now(),
      metadata: {
        attempts: 1,
        lastAttemptTime: Date.now(),
        totalDuration: 0
      }
    };

    this.activeExecutions.set(executionId, execution);
    
    if (this.currentSession) {
      this.currentSession.toolExecutions.push(execution);
    }

    if (this.config.enableLogging) {
      this.outputChannel.appendLine(
        `▶️ Started execution ${executionId}: ${toolName}`
      );
    }

    // Start timeout timer
    this.startExecutionTimeout(executionId);

    return executionId;
  }

  /**
   * Update execution status
   */
  updateExecutionStatus(
    executionId: string, 
    status: ToolExecutionState['status'],
    result?: ToolResult,
    error?: string
  ): void {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      console.warn(`Execution ${executionId} not found for status update`);
      return;
    }

    const previousStatus = execution.status;
    execution.status = status;
    execution.metadata.lastAttemptTime = Date.now();

    if (status === 'running' && previousStatus === 'pending') {
      // Mark as actually started
      if (this.config.enableLogging) {
        this.outputChannel.appendLine(`🔄 Execution ${executionId} is now running`);
      }
    }

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      execution.endTime = Date.now();
      execution.metadata.totalDuration = execution.endTime - execution.startTime;
      execution.result = result;
      execution.error = error;

      // Move to history and remove from active
      this.executionHistory.set(executionId, execution);
      this.activeExecutions.delete(executionId);

      if (this.config.enableLogging) {
        const icon = status === 'completed' ? '✅' : status === 'failed' ? '❌' : '⏹️';
        this.outputChannel.appendLine(
          `${icon} Execution ${executionId} ${status} (${execution.metadata.totalDuration}ms)`
        );
      }

      // Log metrics if enabled
      if (this.config.enableMetrics) {
        this.logExecutionMetrics(execution);
      }
    }
  }

  /**
   * Cancel a running execution
   */
  cancelExecution(executionId: string, reason: string = 'User cancelled'): boolean {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return false;
    }

    this.updateExecutionStatus(executionId, 'cancelled', undefined, reason);
    
    if (this.config.enableLogging) {
      this.outputChannel.appendLine(`⏹️ Cancelled execution ${executionId}: ${reason}`);
    }

    return true;
  }

  /**
   * Cancel all active executions
   */
  cancelAllExecutions(reason: string = 'Bulk cancellation'): number {
    const activeIds = Array.from(this.activeExecutions.keys());
    
    for (const executionId of activeIds) {
      this.cancelExecution(executionId, reason);
    }

    if (this.config.enableLogging && activeIds.length > 0) {
      this.outputChannel.appendLine(`⏹️ Cancelled ${activeIds.length} executions: ${reason}`);
    }

    return activeIds.length;
  }

  /**
   * Get execution state by ID
   */
  getExecution(executionId: string): ToolExecutionState | undefined {
    return this.activeExecutions.get(executionId) || this.executionHistory.get(executionId);
  }

  /**
   * Get all active executions
   */
  getActiveExecutions(): ToolExecutionState[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit?: number): ToolExecutionState[] {
    const history = Array.from(this.executionHistory.values())
      .sort((a, b) => b.startTime - a.startTime);
    
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get current session info
   */
  getCurrentSession(): ExecutionSession | null {
    return this.currentSession;
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): {
    activeCount: number;
    totalExecutions: number;
    successRate: number;
    averageDuration: number;
    toolUsageStats: { [toolName: string]: number };
    currentSession?: {
      id: string;
      duration: number;
      executionCount: number;
    };
  } {
    const allExecutions = Array.from(this.executionHistory.values());
    const completedExecutions = allExecutions.filter(e => e.status === 'completed');
    const totalExecutions = allExecutions.length;
    
    const successRate = totalExecutions > 0 ? (completedExecutions.length / totalExecutions) * 100 : 0;
    const averageDuration = completedExecutions.length > 0 
      ? completedExecutions.reduce((sum, e) => sum + e.metadata.totalDuration, 0) / completedExecutions.length
      : 0;

    // Tool usage statistics
    const toolUsageStats: { [toolName: string]: number } = {};
    for (const execution of allExecutions) {
      toolUsageStats[execution.toolName] = (toolUsageStats[execution.toolName] || 0) + 1;
    }

    const stats = {
      activeCount: this.activeExecutions.size,
      totalExecutions,
      successRate,
      averageDuration,
      toolUsageStats
    };

    // Add current session info if active
    if (this.currentSession) {
      return {
        ...stats,
        currentSession: {
          id: this.currentSession.id,
          duration: Date.now() - this.currentSession.startTime,
          executionCount: this.currentSession.toolExecutions.length
        }
      };
    }

    return stats;
  }

  /**
   * Start execution timeout
   */
  private startExecutionTimeout(executionId: string): void {
    setTimeout(() => {
      const execution = this.activeExecutions.get(executionId);
      if (execution && (execution.status === 'pending' || execution.status === 'running')) {
        this.updateExecutionStatus(
          executionId,
          'failed',
          undefined,
          `Execution timeout after ${this.config.executionTimeout}ms`
        );
      }
    }, this.config.executionTimeout);
  }

  /**
   * Log execution metrics
   */
  private logExecutionMetrics(execution: ToolExecutionState): void {
    if (!this.config.enableMetrics) return;

    const metrics = {
      tool: execution.toolName,
      duration: execution.metadata.totalDuration,
      status: execution.status,
      attempts: execution.metadata.attempts,
      timestamp: execution.startTime
    };

    this.outputChannel.appendLine(`📊 Metrics: ${JSON.stringify(metrics)}`);
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<StateManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.enableLogging) {
      this.outputChannel.appendLine(`⚙️ Config updated: ${JSON.stringify(this.config)}`);
    }
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory.clear();
    
    if (this.config.enableLogging) {
      this.outputChannel.appendLine('🗑️ Execution history cleared');
    }
  }

  /**
   * Export execution data for analysis
   */
  exportExecutionData(): {
    config: StateManagerConfig;
    activeExecutions: ToolExecutionState[];
    executionHistory: ToolExecutionState[];
    currentSession: ExecutionSession | null;
    stats: any;
  } {
    return {
      config: this.config,
      activeExecutions: this.getActiveExecutions(),
      executionHistory: this.getExecutionHistory(),
      currentSession: this.currentSession,
      stats: this.getExecutionStats()
    };
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.cancelAllExecutions('State manager disposing');
    this.endSession('cancelled');
    this.outputChannel.dispose();
  }
}
