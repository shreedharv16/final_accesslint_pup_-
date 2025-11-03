import * as vscode from 'vscode';
import { ReadTool } from './readTool';
import { WriteTool } from './writeTool';
import { EditTool } from './editTool';
import { GrepTool } from './grepTool';
import { BashTool } from './bashTool';
import { ListDirTool } from './listDirTool';
import { AttemptCompletionTool } from './attemptCompletionTool';
import { ToolDefinition, ToolResult, ToolExecutionContext, ToolMode, ToolExecution } from './types';
import { ToolExecutionStateManager } from '../toolExecutionStateManager';

export class ToolManager {
  public context: ToolExecutionContext;
  private tools: Map<string, any>;
  private executionHistory: ToolExecution[] = [];
  private currentMode: ToolMode = 'quick';
  private stateManager: ToolExecutionStateManager;

  // Tool instances
  private readTool: ReadTool;
  private writeTool: WriteTool;
  private editTool: EditTool;
  private grepTool: GrepTool;
  private bashTool: BashTool;
  private listDirTool: ListDirTool;
  private attemptCompletionTool: AttemptCompletionTool;

  constructor(context: ToolExecutionContext) {
    this.context = context;
    this.tools = new Map();
    
    // Ensure we have a proper working directory like Cline
    if (!this.context.workspaceRoot) {
      throw new Error('Working directory (workspaceRoot) is required for tool execution');
    }
    
    // Initialize state manager with Cline-like single execution policy
    this.stateManager = new ToolExecutionStateManager({
      maxConcurrentExecutions: 1, // Like Cline - only one tool at a time
      executionTimeout: 30000,
      retryLimit: 3,
      enableMetrics: true,
      enableLogging: true
    });
    
    // Initialize tools with workspace context
    this.readTool = new ReadTool(context);
    this.writeTool = new WriteTool(context);
    this.editTool = new EditTool(context);
    this.grepTool = new GrepTool(context);
    this.bashTool = new BashTool(context);
    this.listDirTool = new ListDirTool(context);
    this.attemptCompletionTool = new AttemptCompletionTool(context);

    // Register tools
    this.registerTools();
    
    // Start a new execution session
    this.stateManager.startSession();
  }

  private registerTools(): void {
    this.tools.set('read_file', this.readTool);
    this.tools.set('write_file', this.writeTool);
    this.tools.set('edit_file', this.editTool);
    this.tools.set('grep_search', this.grepTool);
    this.tools.set('bash_command', this.bashTool);
    this.tools.set('list_directory', this.listDirTool);
    this.tools.set('attempt_completion', this.attemptCompletionTool);
  }

  // Get all available tool definitions
  getToolDefinitions(): ToolDefinition[] {
    const workspaceRoot = this.context.workspaceRoot;
    
    return [
      ReadTool.getDefinition(workspaceRoot),
      WriteTool.getDefinition(workspaceRoot),
      EditTool.getDefinition(workspaceRoot),
      GrepTool.getDefinition(workspaceRoot),
      BashTool.getDefinition(workspaceRoot),
      ListDirTool.getDefinition(workspaceRoot),
      AttemptCompletionTool.getDefinition(workspaceRoot)
    ];
  }

  // Execute a tool by name with state management (Cline-style)
  async executeTool(toolName: string, input: any, mode: ToolMode = this.currentMode, messageToolUsed: boolean = false): Promise<ToolResult> {
    // Check if execution is allowed with sequential policy (single tool per message)
    const canExecute = this.stateManager.canExecuteToolSequentially(toolName, messageToolUsed);
    if (!canExecute.allowed) {
      return {
        success: false,
        error: canExecute.reason || 'Tool execution not allowed',
        metadata: {
          toolName,
          mode,
          duration: 0,
          timestamp: new Date(),
          rejectedDueTo: canExecute.reason,
          policyType: canExecute.policy
        }
      };
    }

    const startTime = Date.now();
    const executionId = this.stateManager.startExecution(toolName, input);
    
    const execution: ToolExecution = {
      toolName,
      mode,
      input,
      timestamp: new Date()
    };

    try {
      const tool = this.tools.get(toolName);
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      // Update state to running
      this.stateManager.updateExecutionStatus(executionId, 'running');

      let result: any;

      // Execute based on mode
      if (mode === 'quick') {
        // Quick mode: direct execution with minimal approval
        result = await this.executeQuickMode(tool, toolName, input);
      } else {
        // Agent mode: full approval workflow
        result = await this.executeAgentMode(tool, toolName, input);
      }

      // Calculate duration and log
      const duration = Date.now() - startTime;
      execution.result = result;
      execution.duration = duration;
      
      this.executionHistory.push(execution);
      this.logToolExecution(execution);

      const toolResult: ToolResult = {
        success: result.success || false,
        output: this.formatToolOutput(result),
        error: result.error,
        metadata: {
          toolName,
          mode,
          duration,
          timestamp: execution.timestamp,
          executionId
        }
      };

      // Update state to completed
      this.stateManager.updateExecutionStatus(
        executionId, 
        toolResult.success ? 'completed' : 'failed',
        toolResult,
        toolResult.error
      );

      return toolResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      const errorResult: ToolResult = {
        success: false,
        error: errorMessage,
        metadata: {
          toolName,
          mode,
          duration,
          timestamp: execution.timestamp,
          executionId
        }
      };

      execution.result = errorResult;
      execution.duration = duration;
      this.executionHistory.push(execution);
      this.logToolExecution(execution);

      // Update state to failed
      this.stateManager.updateExecutionStatus(executionId, 'failed', errorResult, errorMessage);

      return errorResult;
    }
  }

  private async executeQuickMode(tool: any, toolName: string, input: any): Promise<any> {
    // Quick mode: execute with logging only
    switch (toolName) {
      case 'read_file':
        return tool.executeWithLogging(input);
      case 'write_file':
        return tool.executeWithLogging(input);
      case 'edit_file':
        return tool.executeWithLogging(input);
      case 'grep_search':
        return tool.executeWithLogging(input);
      case 'bash_command':
        return tool.executeWithAutoApproval(input);
      case 'list_directory':
        return tool.executeWithLogging(input);
      case 'attempt_completion':
        return tool.executeWithLogging(input);
      default:
        return tool.execute(input);
    }
  }

  private async executeAgentMode(tool: any, toolName: string, input: any): Promise<any> {
    // Agent mode: execute with full approval workflow
    switch (toolName) {
      case 'read_file':
        return tool.executeWithLogging(input);
      case 'write_file':
        return tool.executeWithApproval(input);
      case 'edit_file':
        return tool.executeWithApproval(input);
      case 'grep_search':
        return tool.executeWithLogging(input);
      case 'bash_command':
        return tool.executeWithLogging(input);
      case 'list_directory':
        return tool.executeWithLogging(input);
      case 'attempt_completion':
        return tool.executeWithLogging(input);
      default:
        return tool.execute(input);
    }
  }

  // Execute tool with conditional approval based on orchestrator decision
  public async executeToolWithConditionalApproval(toolName: string, input: any, needsApproval: boolean): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // If orchestrator already handled approval decision, respect it
    switch (toolName) {
      case 'write_file':
        return needsApproval ? tool.executeWithApproval(input) : tool.executeWithLogging(input);
      case 'edit_file':
        return needsApproval ? tool.executeWithApproval(input) : tool.executeWithLogging(input);
      default:
        return this.executeAgentMode(tool, toolName, input);
    }
  }

  public formatToolOutput(result: any): string {
    if (!result) return '';

    switch (true) {
      case 'content' in result:
        return result.content || '';
      case 'stdout' in result:
        return result.stdout || '';
      case 'matches' in result:
        return this.formatGrepOutput(result);
      case 'editsApplied' in result:
        return `Applied ${result.editsApplied} edits to ${result.filePath}`;
      default:
        return JSON.stringify(result, null, 2);
    }
  }

  private formatGrepOutput(result: any): string {
    if (!result.matches || result.matches.length === 0) {
      return 'No matches found';
    }

    return result.matches.map((match: any) => 
      `${match.file}:${match.line}: ${match.content}`
    ).join('\n');
  }

  private logToolExecution(execution: ToolExecution): void {
    // Log to webview for visibility
    if (this.context.webviewProvider) {
      this.context.webviewProvider.postMessage({
        type: 'toolExecution',
        execution: {
          ...execution,
          input: this.sanitizeInput(execution.input),
          result: this.sanitizeResult(execution.result)
        }
      });
    }

    // Log to output channel
    if (this.context.outputChannel) {
      const status = execution.result?.success ? 'SUCCESS' : 'ERROR';
      const duration = execution.duration ? `(${execution.duration}ms)` : '';
      this.context.outputChannel.appendLine(
        `[${execution.mode.toUpperCase()}_MODE] ${execution.toolName} ${status} ${duration}`
      );
    }
  }

  private sanitizeInput(input: any): any {
    if (!input) return input;
    
    // Truncate long strings for logging
    const sanitized = { ...input };
    
    if (sanitized.content && typeof sanitized.content === 'string' && sanitized.content.length > 200) {
      sanitized.content = sanitized.content.substring(0, 200) + '...';
    }
    
    if (sanitized.command && typeof sanitized.command === 'string' && sanitized.command.length > 100) {
      sanitized.command = sanitized.command.substring(0, 100) + '...';
    }

    return sanitized;
  }

  private sanitizeResult(result: any): any {
    if (!result) return result;
    
    // Truncate long outputs for logging
    const sanitized = { ...result };
    
    if (sanitized.stdout && sanitized.stdout.length > 500) {
      sanitized.stdout = sanitized.stdout.substring(0, 500) + '...';
    }
    
    if (sanitized.content && sanitized.content.length > 500) {
      sanitized.content = sanitized.content.substring(0, 500) + '...';
    }

    return sanitized;
  }

  // Mode management
  setMode(mode: ToolMode): void {
    this.currentMode = mode;
    
    if (this.context.webviewProvider) {
      this.context.webviewProvider.postMessage({
        type: 'modeChanged',
        mode: mode
      });
    }
  }

  getMode(): ToolMode {
    return this.currentMode;
  }

  // Get execution history
  getExecutionHistory(): ToolExecution[] {
    return [...this.executionHistory];
  }

  // Clear execution history
  clearHistory(): void {
    this.executionHistory = [];
    
    if (this.context.webviewProvider) {
      this.context.webviewProvider.postMessage({
        type: 'historyCleared'
      });
    }
  }

  // Get available tools
  getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  // Check if tool exists
  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  // Batch execute multiple tools (for agent mode)
  async executeToolSequence(
    sequence: Array<{ toolName: string; input: any }>,
    mode: ToolMode = 'agent'
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    
    for (const { toolName, input } of sequence) {
      const result = await this.executeTool(toolName, input, mode);
      results.push(result);
      
      // Stop on first failure in agent mode
      if (mode === 'agent' && !result.success) {
        break;
      }
    }
    
    return results;
  }

  // Get execution state information
  getExecutionState(): {
    activeExecutions: any[];
    executionHistory: any[];
    currentSession: any;
    stats: any;
  } {
    return {
      activeExecutions: this.stateManager.getActiveExecutions(),
      executionHistory: this.stateManager.getExecutionHistory(20), // Last 20
      currentSession: this.stateManager.getCurrentSession(),
      stats: this.stateManager.getExecutionStats()
    };
  }

  // Cancel all active executions (emergency stop like Cline)
  cancelAllExecutions(reason: string = 'User requested cancellation'): number {
    return this.stateManager.cancelAllExecutions(reason);
  }

  // Check current execution status
  isExecutionActive(): boolean {
    return this.stateManager.getActiveExecutions().length > 0;
  }

  // Get state manager for direct access
  getStateManager(): ToolExecutionStateManager {
    return this.stateManager;
  }

  dispose(): void {
    this.clearHistory();
    this.tools.clear();
    this.stateManager.dispose();
  }
}
