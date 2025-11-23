import * as vscode from 'vscode';
import { AiProviderManager, AiProvider, AiResponse } from './aiProviderManager';
import { ToolManager } from './tools-accesslint/toolManager';
import { ToolDefinition, ToolResult, ToolMode } from './tools-accesslint/types';
import { createAgentSystemPrompt } from './agentSystemPrompt';
import { TodoListManager } from './todoListManager';
import { TodoList } from './types';
import { FileContextTracker } from './fileContextTracker';
import { BackendApiClient } from './services/backendApiClient';

export interface LLMAgentConfig {
  maxIterations: number;
  autoApproveBasicOperations: boolean;
  requireApprovalFor: string[];
  provider: AiProvider;
  systemPrompt?: string;
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    input: any;
  }>;
  toolResults?: Array<{
    id: string;
    result: ToolResult;
  }>;
}

export interface TaskState {
  didAlreadyUseTool: boolean;
  userMessageContent: Array<{
    type: "text";
    text: string;
  }>;
  currentToolResults: ToolResult[];
}

export interface AgentSession {
  id: string;
  goal: string;
  messages: AgentMessage[];
  status: 'active' | 'completed' | 'error' | 'user_stopped';
  iterations: number;
  startTime: Date;
  endTime?: Date;
}

export class AgentLLMOrchestrator {
  private aiProviderManager: AiProviderManager;
  private toolManager: ToolManager;
  private todoListManager: TodoListManager;
  private currentSession: AgentSession | null = null;
  private config: LLMAgentConfig;
  private outputChannel: vscode.OutputChannel;
  private fileContextTracker: FileContextTracker;
  private backendApiClient: BackendApiClient;
  private backendSessionId?: string;
  
  // Loop detection and state management
  private recentToolCalls: Map<string, { count: number; lastCall: number }> = new Map();
  private toolCallHistory: Array<{ tool: string; input: string; timestamp: number; iteration: number }> = [];
  private readonly LOOP_DETECTION_WINDOW = 10 * 60 * 1000; // 10 minutes (increased from 5)
  private readonly MAX_SAME_TOOL_CALLS = 15; // Max same tool calls in window (increased to handle large batches)
  private readonly MAX_IDENTICAL_CALLS = 4; // Max identical calls (increased from 2)
  private readonly RAPID_CALL_WINDOW = 60000; // 60 seconds for rapid call detection (increased from 30)


  constructor(
    aiProviderManager: AiProviderManager,
    toolManager: ToolManager,
    backendApiClient: BackendApiClient
  ) {
    this.aiProviderManager = aiProviderManager;
    this.toolManager = toolManager;
    this.backendApiClient = backendApiClient;
    this.todoListManager = new TodoListManager(aiProviderManager);
    this.outputChannel = vscode.window.createOutputChannel('AccessLint Agent');
    
    // Initialize file context tracker
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    this.fileContextTracker = new FileContextTracker(workspaceRoot);
    
    // Default configuration
    this.config = {
      maxIterations: 100, // Increased to allow dynamic completion
      autoApproveBasicOperations: true,
      requireApprovalFor: [
        'npm install',
        'yarn install',
        'pip install',
        'rm ',
        'del ',
        'rmdir',
        'format',
        'sudo',
        'apt install',
        'brew install'
      ],
      provider: 'anthropic',
      systemPrompt: this.createSystemPrompt()
    };
  }

  /**
   * Start a new agent session with a user goal
   */
  async startSession(goal: string, provider: AiProvider = 'anthropic'): Promise<string> {
    if (this.currentSession) {
      throw new Error('Another agent session is already running. Stop it first or wait for completion.');
    }

    const sessionId = Date.now().toString();
    this.currentSession = {
      id: sessionId,
      goal,
      messages: [],
      status: 'active',
      iterations: 0,
      startTime: new Date()
    };
    
    // Clear loop detection state for new session
    this.clearLoopDetection();
    
    // CRITICAL FIX: Clear all provider conversation histories for new agent session
    await this.aiProviderManager.startNewSessions();

    // Create session in backend if in backend mode
    const vsConfig = vscode.workspace.getConfiguration('accesslint');
    const useBackendMode = vsConfig.get('useBackendMode', true);
    
    if (useBackendMode && this.backendApiClient.isAuthenticated()) {
      try {
        const backendSession = await this.backendApiClient.startAgentSession(goal, 'chat');
        this.backendSessionId = backendSession.id;
        this.outputChannel.appendLine(`✅ Backend session created: ${backendSession.id}`);
      } catch (error) {
        this.outputChannel.appendLine(`⚠️ Failed to create backend session: ${error}`);
        // Continue with offline mode
      }
    }

    this.config.provider = provider;
    this.outputChannel.appendLine(`🤖 Agent Session Started: ${goal}`);
    this.outputChannel.appendLine(`🔧 Using provider: ${provider}`);


    // Create todo list for this query
    try {
      const todoList = await this.todoListManager.createTodoList(goal, sessionId, provider);
      this.outputChannel.appendLine(`📋 Todo list created with ${todoList.items.length} items`);
      
      // Notify UI about the new todo list
      this.notifyTodoListCreated(todoList);
    } catch (error) {
      this.outputChannel.appendLine(`⚠️ Failed to create todo list: ${error}`);
    }
    
    // Add system message
    this.currentSession.messages.push({
      role: 'system',
      content: this.config.systemPrompt || this.createSystemPrompt()
    });

    // Add user goal with implementation directive (enhanced for GPT-5)
    const isGPT5 = provider === 'openai';
    const directive = isGPT5 
      ? `${goal}

CRITICAL FOR GPT-5: You MUST respond with XML tool calls, NOT JSON objects or text analysis.

INTELLIGENT EXECUTION STRATEGY:

MANDATORY EXECUTION STRATEGY:

**ITERATION 1**: Explore + Read
<list_directory path="src">
<read_file file_path="src/App.js">
<read_file file_path="src/QuizApp.js">

**ITERATION 2**: IMPLEMENT (Required!)
<edit_file> or <write_file> (implement changes immediately)
<attempt_completion> (finish the task)

**CRITICAL RULES:**
- MAXIMUM 2 iterations for simple tasks
- NEVER read the same file twice
- If you read files in iteration 1, you MUST implement in iteration 2
- NO MORE than 3 read operations total per task
- Every response MUST contain XML tool calls`
      : `${goal}

Please start by exploring the workspace structure using list_directory with path="." to understand the project structure, then implement what I've requested by creating or modifying the necessary files.`;

    this.currentSession.messages.push({
      role: 'user',
      content: directive
    });

    // Start the agent loop
    this.runAgentLoop().catch(error => {
      this.outputChannel.appendLine(`❌ Agent error: ${error.message}`);
      if (this.currentSession) {
        this.currentSession.status = 'error';
        this.currentSession.endTime = new Date();
      }
    });

    return sessionId;
  }

  /**
   * Stop the current agent session
   */
  async stopSession(): Promise<void> {
    if (this.currentSession) {
      this.currentSession.status = 'user_stopped';
      this.currentSession.endTime = new Date();
      this.outputChannel.appendLine(`🛑 Agent session stopped by user`);
      this.currentSession = null;
    }
  }

  /**
   * Get current session status
   */
  getSessionStatus(): AgentSession | null {
    return this.currentSession;
  }

  /**
   * Detect if agent is in an infinite loop with smarter pattern recognition
   */
  private detectInfiniteLoop(toolCalls: any[]): { isLoop: boolean; reason?: string; suggestion?: string } {
    if (!toolCalls || toolCalls.length === 0) {
      return { isLoop: false };
    }

    const currentTime = Date.now();
    const currentIteration = this.currentSession?.iterations || 0;

    for (const toolCall of toolCalls) {
      const toolKey = toolCall.name;
      const inputKey = `${toolCall.name}_${JSON.stringify(toolCall.input)}`;

      // Track this tool call
      this.toolCallHistory.push({
        tool: toolCall.name,
        input: JSON.stringify(toolCall.input),
        timestamp: currentTime,
        iteration: currentIteration
      });

      // Clean old entries
      this.toolCallHistory = this.toolCallHistory.filter(
        entry => currentTime - entry.timestamp < this.LOOP_DETECTION_WINDOW
      );

      // More restrictive exploration pattern validation
      const isValidPattern = this.isValidExplorationPattern(toolCall, this.toolCallHistory);
      if (isValidPattern && this.currentSession!.iterations <= 3) {
        this.outputChannel.appendLine(`🔍 Allowing valid exploration pattern: ${toolCall.name} (early iteration)`);
        continue;
      } else if (isValidPattern && this.currentSession!.iterations > 3) {
        this.outputChannel.appendLine(`⚠️ Restricting exploration pattern: ${toolCall.name} (late iteration - should implement)`);
      }

      // Check for same tool called too many times (but be more lenient for read-only operations and batch operations)
      const sameToolCalls = this.toolCallHistory.filter(entry => entry.tool === toolCall.name);
      let maxAllowed = this.isReadOnlyTool(toolCall.name) ? this.MAX_SAME_TOOL_CALLS * 2 : this.MAX_SAME_TOOL_CALLS;
      
      // Special handling for write_file batch operations (project creation, etc.)
      if (toolCall.name === 'write_file') {
        // Check if this is a batch operation with different file paths
        const recentWriteCalls = this.toolCallHistory.filter(entry => 
          entry.tool === 'write_file' && 
          entry.iteration === currentIteration
        );
        
        if (recentWriteCalls.length > 0) {
          // Extract file paths from inputs to check if they're different
          const filePaths = new Set();
          recentWriteCalls.forEach(call => {
            try {
              const input = JSON.parse(call.input);
              filePaths.add(input.file_path);
            } catch {}
          });
          
          // If all file paths are different, this is likely a legitimate batch operation
          if (filePaths.size === recentWriteCalls.length) {
            maxAllowed = Math.max(maxAllowed, 20); // Allow up to 20 different files in a batch
            this.outputChannel.appendLine(`🔍 Detected batch file operation with ${filePaths.size} unique files, allowing higher limit`);
          }
        }
      }
      
      if (sameToolCalls.length > maxAllowed) {
        return {
          isLoop: true,
          reason: `Tool "${toolCall.name}" called ${sameToolCalls.length} times in recent iterations (max: ${maxAllowed})`,
          suggestion: `Try a different approach or use different parameters. For read_file, use limit/offset parameters if reading large files.`
        };
      }

      // Check for identical calls (same tool + same input) - but be more forgiving for exploration
      const identicalCalls = this.toolCallHistory.filter(
        entry => entry.tool === toolCall.name && entry.input === JSON.stringify(toolCall.input)
      );
      
      // For list_directory with ".", allow up to 3 calls as it's common for exploration
      const isBasicListDirectory = toolCall.name === 'list_directory' && 
                                  (toolCall.input?.path === '.' || toolCall.input?.path === '');
      const maxIdentical = isBasicListDirectory ? 3 : this.MAX_IDENTICAL_CALLS;
      
      if (identicalCalls.length > maxIdentical) {
        return {
          isLoop: true,
          reason: `Identical call to "${toolCall.name}" with same parameters repeated ${identicalCalls.length} times (max: ${maxIdentical})`,
          suggestion: `The previous calls already provided the information. Analyze the existing results instead of repeating the same call.`
        };
      }

      // Check for rapid consecutive identical calls - use new configurable window
      const recentIdentical = identicalCalls.filter(
        entry => currentTime - entry.timestamp < this.RAPID_CALL_WINDOW
      );
      if (recentIdentical.length >= 3) { // Increased threshold from 2 to 3
        return {
          isLoop: true,
          reason: `Rapid repeated calls to "${toolCall.name}" within ${this.RAPID_CALL_WINDOW/1000} seconds`,
          suggestion: `Stop repeating the same tool call. The information has already been retrieved.`
        };
      }
    }

    return { isLoop: false };
  }

  /**
   * Check if a tool call is part of a valid exploration pattern
   */
  private isValidExplorationPattern(toolCall: any, history: Array<{ tool: string; input: string; timestamp: number; iteration: number }>): boolean {
    const recentHistory = history.filter(entry => 
      Date.now() - entry.timestamp < 2 * 60 * 1000 // Last 2 minutes
    );

    // Pattern 1: list_directory -> read_file -> list_directory (exploring structure)
    if (toolCall.name === 'list_directory') {
      const recentReads = recentHistory.filter(entry => entry.tool === 'read_file');
      if (recentReads.length > 0) {
        this.outputChannel.appendLine(`🔍 Valid pattern: list_directory after read_file operations`);
        return true;
      }
    }

    // Pattern 2: read_file -> grep_search -> read_file (analyzing code)
    if (toolCall.name === 'read_file') {
      const recentGreps = recentHistory.filter(entry => entry.tool === 'grep_search');
      if (recentGreps.length > 0) {
        this.outputChannel.appendLine(`🔍 Valid pattern: read_file after grep_search operations`);
        return true;
      }
    }

    // Pattern 3: grep_search with different patterns (searching for related things)
    if (toolCall.name === 'grep_search') {
      const recentGreps = recentHistory.filter(entry => entry.tool === 'grep_search');
      const uniquePatterns = new Set(recentGreps.map(entry => {
        const parsed = JSON.parse(entry.input);
        return parsed.pattern;
      }));
      
      // If we have different search patterns, it's likely valid exploration
      if (uniquePatterns.size > 1) {
        this.outputChannel.appendLine(`🔍 Valid pattern: grep_search with different patterns`);
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a tool is read-only and thus safer to allow more calls
   */
  private isReadOnlyTool(toolName: string): boolean {
    const readOnlyTools = ['read_file', 'list_directory', 'grep_search'];
    return readOnlyTools.includes(toolName);
  }

  /**
   * Clear loop detection state (called when session starts)
   */
  private clearLoopDetection(): void {
    this.recentToolCalls.clear();
    this.toolCallHistory = [];
  }

  /**
   * Main agent execution loop
   */
  private async runAgentLoop(): Promise<void> {
    if (!this.currentSession) return;

    while (
      this.currentSession.status === 'active' && 
      this.currentSession.iterations < this.config.maxIterations
    ) {
      try {
        this.currentSession.iterations++;
        this.outputChannel.appendLine(`🔄 Agent iteration ${this.currentSession.iterations}`);


        // Enhanced context management before LLM call
        if (this.config.provider === 'openai') {
          this.manageGPT5ContextEfficiently();
        } else {
          this.manageContextBeforeCall();
        }
        
        // Get LLM response
        this.outputChannel.appendLine(`🤖 Requesting LLM response (iteration ${this.currentSession.iterations})...`);
        const response = await this.getLLMResponse();
        
        this.outputChannel.appendLine(`📨 LLM Response: ${response.text ? 'Text content received' : 'No text content'}, ${response.toolCalls?.length || 0} tool calls`);

        // Enhanced debug logging to understand what's happening
        if (response.text) {
          this.outputChannel.appendLine(`📄 Response text preview: ${response.text.substring(0, 300)}...`);
        }

        if (response.toolCalls && response.toolCalls.length > 0) {
          this.outputChannel.appendLine(`🔧 Tool calls found: ${response.toolCalls.map(tc => tc.name).join(', ')}`);
          // Log detailed tool call information
          response.toolCalls.forEach((tc, index) => {
            this.outputChannel.appendLine(`  📋 Tool ${index + 1}: ${tc.name} (ID: ${tc.id})`);
            this.outputChannel.appendLine(`     Input: ${JSON.stringify(tc.input)}`);
          });
        } else {
          this.outputChannel.appendLine(`⚠️ No tool calls detected in response object.`);

          // Enhanced detection for GPT-5 JSON responses and tool patterns
          if (response.text) {
            const hasToolPatterns = response.text.includes('TOOL_CALL:') ||
                                  response.text.includes('list_directory') ||
                                  response.text.includes('read_file') ||
                                  response.text.includes('grep_search') ||
                                  response.text.includes('edit_file') ||
                                  response.text.includes('<tool_use') ||
                                  response.text.includes('read_file(');

            // Detect GPT-5 JSON planning responses that should be tool calls
            const isJSONPlanning = response.text.trim().startsWith('{') && 
                                 (response.text.includes('"items"') || 
                                  response.text.includes('"title"') ||
                                  response.text.includes('"description"'));

            if (hasToolPatterns) {
              this.outputChannel.appendLine(`🔍 Response text contains tool patterns, but they weren't parsed as structured tool calls.`);
              this.outputChannel.appendLine(`   Full response text: ${response.text}`); // Show full text for debugging
              this.outputChannel.appendLine(`   Text length: ${response.text.length} characters`);

              // Try to parse the text for tool calls as fallback
              try {
                const toolParser = this.aiProviderManager.getToolCallParser();
                const availableTools = toolParser.getAvailableTools();
                this.outputChannel.appendLine(`📋 Available tools: ${availableTools.join(', ')}`);

                const fallbackParsed = toolParser.parseResponse(response.text);
                if (fallbackParsed.hasToolCalls) {
                  this.outputChannel.appendLine(`✅ Fallback parsing found ${fallbackParsed.toolCalls.length} tool calls!`);
                  fallbackParsed.toolCalls.forEach((tc, index) => {
                    this.outputChannel.appendLine(`  📋 Fallback Tool ${index + 1}: ${tc.name}`);
                    this.outputChannel.appendLine(`     Input: ${JSON.stringify(tc.input)}`);
                  });
                  response.toolCalls = fallbackParsed.toolCalls;
                } else {
                  this.outputChannel.appendLine(`❌ Fallback parsing found no tool calls.`);
                }
              } catch (error) {
                this.outputChannel.appendLine(`❌ Fallback parsing failed: ${error}`);
              }
            } else if (isJSONPlanning && this.config.provider === 'openai') {
              // GPT-5 specific correction for JSON planning responses
              this.outputChannel.appendLine(`🚨 GPT-5 JSON PLANNING DETECTED: Model sent JSON instead of XML tool calls`);
              this.outputChannel.appendLine(`   JSON Response: ${response.text.substring(0, 200)}...`);
              
              // Add corrective feedback to force proper tool usage
              this.currentSession.messages.push({
                role: 'user',
                content: `ERROR: You sent a JSON planning response instead of using XML tool calls.

Your JSON response: ${response.text.substring(0, 300)}...

CORRECTION REQUIRED: You must use XML tool format, not JSON. Start exploring the project immediately:

<list_directory>
{
  "path": "."
}
</list_directory>

Then read files and implement the changes using write_file/edit_file tools. NO MORE JSON RESPONSES.`
              });

              continue; // Skip to next iteration with corrective feedback
            } else {
              this.outputChannel.appendLine(`ℹ️ No tool patterns found in response text.`);
            }
          }
        }
        
        // Add assistant message
        this.currentSession.messages.push({
          role: 'assistant',
          content: response.text,
          toolCalls: response.toolCalls
        });

          // Execute tool calls if any
        if (response.toolCalls && response.toolCalls.length > 0) {
          // Check for infinite loops BEFORE executing tools
          const loopDetection = this.detectInfiniteLoop(response.toolCalls);
          if (loopDetection.isLoop) {
            this.outputChannel.appendLine(`🔄 INFINITE LOOP DETECTED: ${loopDetection.reason}`);
            this.outputChannel.appendLine(`💡 Suggestion: ${loopDetection.suggestion}`);

            // Add a message to break the loop
            this.currentSession.messages.push({
              role: 'user',
              content: `STOP: Infinite loop detected. ${loopDetection.reason}. ${loopDetection.suggestion}

Please provide a final answer based on the information you have already gathered from previous tool executions. Do not repeat the same tool calls.`
            });

            // Continue to next iteration to get final response
            continue;
          }

          // Enhanced intervention for GPT-5 exploration loops (earlier and smarter)
          const isGPT5 = this.config.provider === 'openai';
          if (isGPT5 && this.currentSession.iterations >= 5) { // Reduced from 8 to 5
            const recentReadFiles = this.toolCallHistory.filter(
              entry => entry.tool === 'read_file' && 
              (Date.now() - entry.timestamp) < 300000 // last 5 minutes
            ).length;
            
            const recentImplementations = this.toolCallHistory.filter(
              entry => (entry.tool === 'write_file' || entry.tool === 'edit_file') &&
              (Date.now() - entry.timestamp) < 300000 // last 5 minutes
            ).length;
            
            // More intelligent intervention logic
            const hasCurrentImplementationCall = response.toolCalls.some(tc => tc.name === 'write_file' || tc.name === 'edit_file');
            const explorationToImplementationRatio = recentImplementations > 0 ? recentReadFiles / recentImplementations : recentReadFiles;
            
            // Aggressive loop detection (optimized for efficiency)
            const shouldIntervene = (
              recentReadFiles >= 2 && !hasCurrentImplementationCall && explorationToImplementationRatio > 2
            ) || (
              recentReadFiles >= 3 && explorationToImplementationRatio > 1.5
            ) || (
              recentReadFiles >= 4 // Force intervention after 4 reads regardless
            );

            if (shouldIntervene) {
              this.outputChannel.appendLine(`🚨 SMART INTERVENTION: ${recentReadFiles} reads vs ${recentImplementations} implementations (ratio: ${explorationToImplementationRatio.toFixed(1)})`);
              
              // Use file context to provide targeted guidance
              const cachedFiles = this.fileContextTracker.getCachedFiles();
              const stats = this.fileContextTracker.getCacheStats();
              
              const fileContextSummary = cachedFiles.length > 0 
                ? `You have already read ${cachedFiles.length} files: ${cachedFiles.slice(0, 3).join(', ')}${cachedFiles.length > 3 ? ` and ${cachedFiles.length - 3} more` : ''}.`
                : '';
              
              this.currentSession.messages.push({
                role: 'user',
                content: `IMPLEMENTATION DIRECTIVE: You have sufficient information to proceed.

${fileContextSummary}
Cache contains ${stats.totalFiles} files (${Math.round(stats.totalSize / 1024)}KB).

Task: "${this.currentSession.goal}"

IMMEDIATE ACTION REQUIRED: 
1. Use the cached file information to make your changes
2. Call write_file or edit_file tools NOW
3. Stop exploring - you have enough data to implement

Example: If changing background to pink, edit the CSS/style files you've already read.`
              });

              continue;
            }
          }
          
          // Enhanced validation and preprocessing of tool calls with file context tracking
          let validToolCalls: any[] = [];
          const originalToolCalls = response.toolCalls || [];

          this.outputChannel.appendLine(`🔧 Processing ${originalToolCalls.length} tool call(s) with enhanced validation and file context tracking...`);
          this.outputChannel.appendLine(`⚡ Intelligent execution: Parallel reads, sequential writes, batched operations`);
          
          // Apply file context tracking for read_file operations
          const optimizedToolCalls = this.applyFileContextOptimization(originalToolCalls);
          
          // First, deduplicate tool calls
          const deduplicatedToolCalls = this.deduplicateToolCalls(optimizedToolCalls);
          if (deduplicatedToolCalls.length < optimizedToolCalls.length) {
            this.outputChannel.appendLine(`🔄 Deduplicated: ${optimizedToolCalls.length} → ${deduplicatedToolCalls.length} tool calls`);
          }
          
          for (let index = 0; index < deduplicatedToolCalls.length; index++) {
            const toolCall = deduplicatedToolCalls[index];
            
            try {
              // Enhanced validation with automatic parameter completion
              const enhancedToolCall = this.enhanceToolCall(toolCall);
              const validation = this.aiProviderManager.getToolCallParser().validateToolCall(enhancedToolCall);
              
              if (validation.valid) {
                validToolCalls.push(enhancedToolCall);
                this.outputChannel.appendLine(`✅ Tool ${index + 1} (${enhancedToolCall.name}) validation passed`);
                
                // Log parameters for debugging
                const paramInfo = Object.keys(enhancedToolCall.input).length > 0 
                  ? `with ${Object.keys(enhancedToolCall.input).length} parameters`
                  : 'with no parameters';
                this.outputChannel.appendLine(`   Parameters: ${JSON.stringify(enhancedToolCall.input)}`);
                
              } else {
                this.outputChannel.appendLine(`❌ Tool ${index + 1} (${toolCall.name}) validation failed: ${validation.errors.join(', ')}`);
                
                // Try to fix common validation issues
                const fixedToolCall = this.attemptToolCallFix(toolCall, validation.errors);
                if (fixedToolCall) {
                  const retryValidation = this.aiProviderManager.getToolCallParser().validateToolCall(fixedToolCall);
                  if (retryValidation.valid) {
                    validToolCalls.push(fixedToolCall);
                    this.outputChannel.appendLine(`🔧 Tool ${index + 1} (${fixedToolCall.name}) fixed and validated successfully`);
                  }
                }
              }
            } catch (error) {
              this.outputChannel.appendLine(`❌ Tool ${index + 1} (${toolCall.name}) validation error: ${error}`);
              
              // Try basic recovery for common errors
              if (toolCall.name && this.toolManager.hasTool(toolCall.name)) {
                const basicToolCall = this.createBasicToolCall(toolCall.name);
                if (basicToolCall) {
                  validToolCalls.push(basicToolCall);
                  this.outputChannel.appendLine(`🆘 Tool ${index + 1} recovered with basic parameters`);
                }
              }
            }
          }

          if (validToolCalls.length === 0) {
            this.outputChannel.appendLine(`⚠️ No valid tool calls found after validation and recovery attempts`);
            
            // If we had tool calls but none were valid, ask LLM to retry with better format
            if (originalToolCalls.length > 0) {
              this.currentSession.messages.push({
                role: 'user',
                content: `The tool calls you provided had validation errors. Please retry with proper format. Available tools: ${this.toolManager.getAvailableTools().join(', ')}. Make sure to provide all required parameters correctly.`
              });
            }
            continue;
          }

          // Execute tool calls efficiently (allow multiple tools like Cline)
          const toolResults = await this.executeToolCallsEfficiently(validToolCalls);


          // Check if any tool call was attempt_completion
          const hasAttemptCompletion = validToolCalls.some(tc => tc.name === 'attempt_completion');
          if (hasAttemptCompletion) {
            // Find the attempt_completion result
            const completionResultIndex = validToolCalls.findIndex(tc => tc.name === 'attempt_completion');
            const completionResult = toolResults[completionResultIndex];
            
            if (completionResult.success) {
              this.outputChannel.appendLine(`🎯 Agent completed task using attempt_completion tool`);
              this.currentSession.status = 'completed';
              this.currentSession.endTime = new Date();
              
              // Show the completion result to user - use same message type as attempt_completion tool
              if (this.toolManager.context.webviewProvider) {
                // For attempt_completion, the output should contain the result text
                // Try to parse if it's JSON, otherwise use as-is
                let resultText = completionResult.output || 'Task completed successfully';
                let commandText = undefined;
                
                try {
                  // If output is JSON with result/command properties, extract them
                  const parsed = JSON.parse(completionResult.output || '{}');
                  if (parsed.result) {
                    resultText = parsed.result;
                    commandText = parsed.command;
                  }
                } catch {
                  // Not JSON, use output as result text
                  resultText = completionResult.output || 'Task completed successfully';
                }
                
                // Message sending is handled by attemptCompletionTool to avoid duplication
              }
              
              this.outputChannel.appendLine(`✅ Task completed successfully`);
              break;
            }
          }
          
          // Format tool results using Cline-style optimization (compact format)
          const toolResultsText = toolResults.map((result, index) => {
            const toolCall = validToolCalls[index];
            
            // Use the enhanced formatting from our token tracker
            const anthropicProvider = (this.aiProviderManager as any).anthropicProvider;
            if (anthropicProvider && typeof anthropicProvider.formatToolResult === 'function') {
              return anthropicProvider.formatToolResult(
                toolCall.name, 
                result, 
                result.success
              );
            }
            
            // Fallback compact format (even more aggressive for agent mode)
            const status = result.success ? '✓' : '✗';
            if (!result.success) {
              return `[${status}] ${toolCall.name}: ${result.error || 'Failed'}`;
            }
            
            let output = result.output || '';
            // More aggressive truncation for agent mode
            if (output.length > 150) {
              output = output.substring(0, 150) + '...[cut]';
            }
            
            return `[${status}] ${toolCall.name}: ${output}`;
          }).join('\n\n');
          
                     // Check if we should trigger completion based on available information
           const shouldComplete = this.shouldTriggerCompletion(toolResults, validToolCalls);

           if (shouldComplete) {
             // Add results and trigger completion
             this.currentSession.messages.push({
               role: 'user',
               content: `${toolResultsText}\n\nBased on the information gathered, please provide your final comprehensive answer.`,
               toolResults: toolResults.map((result, index) => ({
                 id: validToolCalls[index].id,
                 result
               }))
             });
           } else {
             // Add tool results to messages for next iteration (single result per message - Cline strategy)
             this.currentSession.messages.push({
               role: 'user',
               content: `${toolResultsText}\n\nContinue with your analysis. Use additional tools if needed, or provide your final answer.`,
               toolResults: toolResults.map((result, index) => ({
                 id: validToolCalls[index].id,
                 result
               }))
             });
           }
           
           this.outputChannel.appendLine(`📊 Tools executed, continuing to next iteration...`);
        } else {
          // No tool calls, check if we have enough information to provide an answer
          if (response.text && response.text.trim()) {
            // Check if the response looks like a final answer (generic completion detection)
            const hasAnalysisKeywords = response.text.toLowerCase().includes('analysis') ||
                                       response.text.toLowerCase().includes('found') ||
                                       response.text.toLowerCase().includes('based on') ||
                                       response.text.toLowerCase().includes('i found') ||
                                       response.text.toLowerCase().includes('the code') ||
                                       response.text.toLowerCase().includes('after analyzing') ||
                                       response.text.toLowerCase().includes('looking at') ||
                                       response.text.toLowerCase().includes('examining');
            
            const isSubstantialResponse = response.text.length > 150; // Must be substantial
            const hasExecutedTools = this.currentSession.messages.some(msg => msg.toolResults && msg.toolResults.length > 0);
            const maxIterationsReached = this.currentSession.iterations >= 3;
            
            const looksLikeFinalAnswer = (hasAnalysisKeywords && isSubstantialResponse) || 
                                       (hasExecutedTools && isSubstantialResponse) ||
                                       maxIterationsReached;
            
            if (looksLikeFinalAnswer) {
              this.outputChannel.appendLine(`📝 Agent provided final response: ${response.text.substring(0, 100)}...`);
              this.currentSession.status = 'completed';
              this.currentSession.endTime = new Date();
              this.outputChannel.appendLine(`✅ Agent completed task successfully in ${this.currentSession.iterations} iterations`);
              break;
            } else {
              // Response seems incomplete, ask for more detailed answer
              this.currentSession.messages.push({
                role: 'user',
                content: 'Please provide a more detailed final answer based on the files you analyzed. What specific information did you find that answers the user\'s question?'
              });
            }
          } else {
            // Empty response, ask for clarification
            this.currentSession.messages.push({
              role: 'user',
              content: 'Please provide a clear response to complete the task. What have you found based on the tools you executed?'
            });
          }
        }

      } catch (error) {
        this.outputChannel.appendLine(`❌ Agent iteration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        this.currentSession.status = 'error';
        this.currentSession.endTime = new Date();
        break;
      }
    }

    if (this.currentSession && this.currentSession.iterations >= this.config.maxIterations) {
      this.outputChannel.appendLine(`⏱️ Agent reached maximum iterations (${this.config.maxIterations})`);
      this.outputChannel.appendLine(`📊 Attempting to provide summary based on collected data...`);
      
      // Try to get a final summary from the LLM
      try {
        this.currentSession.messages.push({
          role: 'user',
          content: 'You have reached the maximum number of iterations. Please provide a final summary based on all the information you have gathered so far.'
        });
        
        const finalResponse = await this.getLLMResponse();
        if (finalResponse.text && finalResponse.text.trim()) {
          this.outputChannel.appendLine(`📝 Final summary: ${finalResponse.text}`);
        }
      } catch (error) {
        this.outputChannel.appendLine(`⚠️ Could not generate final summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      this.currentSession.status = 'completed';
      this.currentSession.endTime = new Date();
    }

    // Clean up session
    if (this.currentSession) {
      this.outputChannel.appendLine(`🏁 Session ${this.currentSession.id} ended with status: ${this.currentSession.status}`);
      this.currentSession = null;
    }
  }

  /**
   * Get response from LLM with current conversation and tool support
   */
  private async getLLMResponse(): Promise<AiResponse> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    // Apply context management before sending to LLM
    const optimizedMessages = await this.applyContextManagement(this.currentSession.messages);
    
    // Convert optimized messages to format expected by AI provider
    const conversationText = this.formatConversation(optimizedMessages);
    
    // Log conversation size
    const tokenCount = conversationText.length / 4; // rough estimate
    this.outputChannel.appendLine(`📊 Sending conversation: ${optimizedMessages.length} messages, ~${Math.round(tokenCount)} tokens`);
    
    // Use tools-enabled API for better tool call detection
    try {
      this.outputChannel.appendLine(`🔧 Using tools-enabled API for ${this.config.provider}...`);
      return await this.aiProviderManager.sendMessageWithTools(conversationText, this.config.provider);
    } catch (error) {
      this.outputChannel.appendLine(`⚠️ Tools API failed, falling back to regular API: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Fallback to regular API if tools API fails
      return await this.aiProviderManager.sendMessage(conversationText, this.config.provider);
    }
  }

  /**
   * Apply context management to messages before sending to LLM
   */
  private async applyContextManagement(messages: AgentMessage[]): Promise<AgentMessage[]> {
    const anthropicProvider = (this.aiProviderManager as any).anthropicProvider;
    
    if (anthropicProvider && typeof anthropicProvider.getContextManager === 'function') {
      const contextManager = anthropicProvider.getContextManager();
      
              // Convert AgentMessage to MessageContent format
        const messageContent = messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content, // AgentMessage content is always string
          timestamp: Date.now()
        }));
      
      // Apply context management
      const result = await contextManager.manageContext(messageContent, 'aggressive');
      
      if (result.wasModified) {
        this.outputChannel.appendLine(
          `🗜️ Context optimized: ${result.stats.truncatedMessages} messages removed, ${result.stats.tokensSaved} tokens saved`
        );
        
        // Convert back to AgentMessage format
        const optimizedMessages = result.messages.map((msg: { role: string; content: string }) => {
          const originalMessage = messages.find(m => m.content === msg.content);
          return originalMessage || {
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
            timestamp: new Date(),
            toolCalls: [],
            toolResults: []
          };
        });
        
        return optimizedMessages;
      }
    }
    
    return messages;
  }

  /**
   * Execute tool calls efficiently (like Cline) - allows multiple tools when appropriate
   */
  private async executeToolCallsEfficiently(toolCalls: Array<{ id: string; name: string; input: any }>): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    
    // Group tools by type for intelligent execution
    const readOnlyTools = toolCalls.filter(tc => 
      ['read_file', 'list_directory', 'grep_search'].includes(tc.name)
    );
    const writeTools = toolCalls.filter(tc => 
      ['write_file', 'edit_file'].includes(tc.name)
    );
    const completionTools = toolCalls.filter(tc => tc.name === 'attempt_completion');
    const otherTools = toolCalls.filter(tc => 
      !['read_file', 'list_directory', 'grep_search', 'write_file', 'edit_file', 'attempt_completion'].includes(tc.name)
    );

    this.outputChannel.appendLine(`🚀 Efficient execution: ${readOnlyTools.length} read, ${writeTools.length} write, ${otherTools.length} other, ${completionTools.length} completion`);

    // Execute read-only tools in parallel (like Cline)
    if (readOnlyTools.length > 0) {
      const readResults = await this.executeToolBatch(readOnlyTools, 'read-only');
      results.push(...readResults);
    }

    // Execute write tools sequentially (safer)
    if (writeTools.length > 0) {
      const writeResults = await this.executeToolBatch(writeTools, 'write');
      results.push(...writeResults);
    }

    // Execute other tools
    if (otherTools.length > 0) {
      const otherResults = await this.executeToolBatch(otherTools, 'other');
      results.push(...otherResults);
    }

    // Execute completion tools last
    if (completionTools.length > 0) {
      const completionResults = await this.executeToolBatch(completionTools, 'completion');
      results.push(...completionResults);
    }

    return results;
  }

  /**
   * Execute tool calls sequentially with single tool per message enforcement (legacy method)
   */
  private async executeToolCalls(toolCalls: Array<{ id: string; name: string; input: any }>): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    const taskState: TaskState = {
      didAlreadyUseTool: false,
      userMessageContent: [],
      currentToolResults: []
    };

    for (const toolCall of toolCalls) {
      try {
        // Single Tool Per Message Enforcement
        if (taskState.didAlreadyUseTool) {
          // Ignore any content after a tool has already been used
          taskState.userMessageContent.push({
            type: "text",
            text: this.formatResponseToolAlreadyUsed(toolCall.name),
          });

          // Add failed result for skipped tool
          results.push({
            success: false,
            error: `Tool "${toolCall.name}" skipped due to sequential execution policy`,
            metadata: {
              toolName: toolCall.name,
              skippedDueToSequentialPolicy: true,
              timestamp: new Date()
            }
          });
          continue;
        }

        this.outputChannel.appendLine(`🔧 [${toolCall.name}] Starting sequential execution...`);

        // Validate tool call first
        const validation = this.validateToolCall(toolCall);
        if (!validation.valid) {
          results.push({
            success: false,
            error: `Tool validation failed: ${validation.errors.join(', ')}`,
            metadata: { toolName: toolCall.name, validationErrors: validation.errors }
          });
          continue;
        }

        // Check if approval is needed
        const needsApproval = this.shouldRequestApproval(toolCall);

        if (needsApproval) {
          this.outputChannel.appendLine(`⚠️ [${toolCall.name}] Requesting user approval...`);
          const approved = await this.requestApproval(toolCall);
          if (!approved) {
            this.outputChannel.appendLine(`❌ [${toolCall.name}] User denied permission`);
            results.push({
              success: false,
              error: 'User denied permission to execute this tool',
              metadata: { toolName: toolCall.name, userDenied: true }
            });
            continue;
          }
          this.outputChannel.appendLine(`✅ [${toolCall.name}] User approved`);
        } else {
          this.outputChannel.appendLine(`🟢 [${toolCall.name}] Auto-approved (safe operation)`);
        }

        // Execute the tool sequentially - pass the messageToolUsed flag to enforce policy
        const startTime = Date.now();
        let result: ToolResult;

        // Use conditional approval method for write/edit tools that support it
        if (['write_file', 'edit_file'].includes(toolCall.name) && 
            typeof this.toolManager.executeToolWithConditionalApproval === 'function') {
          console.log(`🔍 DEBUG: Using conditional approval for ${toolCall.name}, needsApproval: ${needsApproval}`);
          // For write/edit tools, use the new conditional approval method
          const toolResult = await this.toolManager.executeToolWithConditionalApproval(
            toolCall.name,
            toolCall.input,
            needsApproval
          );
          
          result = {
            success: toolResult.success || false,
            output: this.toolManager.formatToolOutput ? this.toolManager.formatToolOutput(toolResult) : JSON.stringify(toolResult),
            error: toolResult.error,
            metadata: {
              toolName: toolCall.name,
              mode: 'agent',
              duration: Date.now() - startTime,
              timestamp: new Date(),
              executionId: 'conditional-approval'
            }
          };
        } else {
          // Use standard execution for other tools
          result = await this.toolManager.executeTool(
            toolCall.name,
            toolCall.input,
            'agent', // Use agent mode for proper logging
            taskState.didAlreadyUseTool // Pass flag to enforce single tool per message
          );
        }
        const duration = Date.now() - startTime;

        // Validate result object
        if (!result) {
          this.outputChannel.appendLine(`❌ Tool ${toolCall.name} returned undefined result`);
          throw new Error(`Tool ${toolCall.name} returned undefined result`);
        }
        if (typeof result !== 'object') {
          this.outputChannel.appendLine(`❌ Tool ${toolCall.name} returned invalid result type: ${typeof result}, value: ${JSON.stringify(result)}`);
          throw new Error(`Tool ${toolCall.name} returned invalid result type: ${typeof result}`);
        }
        if (result.success === undefined) {
          this.outputChannel.appendLine(`❌ Tool ${toolCall.name} returned result without success property. Result: ${JSON.stringify(result)}`);
          throw new Error(`Tool ${toolCall.name} returned result without success property`);
        }

        // Tool Result Flag Setting - once a tool result has been collected, ignore all other tool uses
        taskState.didAlreadyUseTool = true;
        taskState.currentToolResults.push(result);

        // Enhanced logging and file caching
        if (result.success) {
          this.outputChannel.appendLine(`✅ [${toolCall.name}] SUCCESS (${duration}ms) - Single tool policy enforced`);
          
          // Cache file content if this was a successful read_file operation
          if (toolCall.name === 'read_file' && result.output) {
            const filePath = toolCall.input?.file_path || toolCall.input?.path;
            if (filePath) {
              this.fileContextTracker.cacheFileContent(
                filePath, 
                result.output,
                toolCall.input?.limit,
                toolCall.input?.offset
              );
            }
          }
          
          if (result.output) {
            const truncatedOutput = result.output.length > 200
              ? result.output.substring(0, 200) + '...'
              : result.output;
            this.outputChannel.appendLine(`📄 Output: ${truncatedOutput}`);
          }
        } else {
          this.outputChannel.appendLine(`❌ [${toolCall.name}] FAILED (${duration}ms): ${result.error}`);
        }

        results.push({
          ...result,
          metadata: {
            ...result.metadata,
            toolName: toolCall.name,
            duration,
            approved: !needsApproval || true, // true if we got here
            sequentialExecutionEnforced: true
          }
        });

        // After executing one tool, break to prevent further executions in this message
        this.outputChannel.appendLine(`🛑 Sequential execution: Stopping after first tool (${toolCall.name}) to prevent rate limiting`);
        break;

      } catch (error) {
        this.outputChannel.appendLine(`💥 [${toolCall.name}] EXCEPTION: ${error instanceof Error ? error.message : 'Unknown error'}`);
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          metadata: {
            toolName: toolCall.name,
            exceptionOccurred: true,
            errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
            sequentialExecutionEnforced: true
          }
        });
      }
    }

    return results;
  }

  /**
   * Execute tool calls with intelligent approval (enhanced like Cline) - DEPRECATED: Use executeToolCalls for sequential execution
   */
  private async executeToolCallsParallel(toolCalls: Array<{ id: string; name: string; input: any }>): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      try {
        this.outputChannel.appendLine(`🔧 [${toolCall.name}] Starting execution...`);
        
        // Validate tool call first
        const validation = this.validateToolCall(toolCall);
        if (!validation.valid) {
          results.push({
            success: false,
            error: `Tool validation failed: ${validation.errors.join(', ')}`,
            metadata: { toolName: toolCall.name, validationErrors: validation.errors }
          });
          continue;
        }

        // Check if approval is needed (similar to Cline's approach)
        const needsApproval = this.shouldRequestApproval(toolCall);
        
        if (needsApproval) {
          this.outputChannel.appendLine(`⚠️ [${toolCall.name}] Requesting user approval...`);
          const approved = await this.requestApproval(toolCall);
          if (!approved) {
            this.outputChannel.appendLine(`❌ [${toolCall.name}] User denied permission`);
            results.push({
              success: false,
              error: 'User denied permission to execute this tool',
              metadata: { toolName: toolCall.name, userDenied: true }
            });
            continue;
          }
          this.outputChannel.appendLine(`✅ [${toolCall.name}] User approved`);
        } else {
          this.outputChannel.appendLine(`🟢 [${toolCall.name}] Auto-approved (safe operation)`);
        }

        // Execute the tool with error handling
        const startTime = Date.now();
        const result = await this.toolManager.executeTool(
          toolCall.name, 
          toolCall.input, 
          'agent' // Use agent mode for proper logging
        );
        const duration = Date.now() - startTime;

        // Validate result object
        if (!result) {
          this.outputChannel.appendLine(`❌ Tool ${toolCall.name} returned undefined result`);
          throw new Error(`Tool ${toolCall.name} returned undefined result`);
        }
        if (typeof result !== 'object') {
          this.outputChannel.appendLine(`❌ Tool ${toolCall.name} returned invalid result type: ${typeof result}, value: ${JSON.stringify(result)}`);
          throw new Error(`Tool ${toolCall.name} returned invalid result type: ${typeof result}`);
        }
        if (result.success === undefined) {
          this.outputChannel.appendLine(`❌ Tool ${toolCall.name} returned result without success property. Result: ${JSON.stringify(result)}`);
          throw new Error(`Tool ${toolCall.name} returned result without success property`);
        }
        
        // Enhanced logging similar to Cline
        if (result.success) {
          this.outputChannel.appendLine(`✅ [${toolCall.name}] SUCCESS (${duration}ms)`);
          if (result.output) {
            const truncatedOutput = result.output.length > 200 
              ? result.output.substring(0, 200) + '...'
              : result.output;
            this.outputChannel.appendLine(`📄 Output: ${truncatedOutput}`);
          }
        } else {
          this.outputChannel.appendLine(`❌ [${toolCall.name}] FAILED (${duration}ms): ${result.error}`);
        }
        
        results.push({
          ...result,
          metadata: {
            ...result.metadata,
            toolName: toolCall.name,
            duration,
            approved: !needsApproval || true // true if we got here
          }
        });

      } catch (error) {
        this.outputChannel.appendLine(`💥 [${toolCall.name}] EXCEPTION: ${error instanceof Error ? error.message : 'Unknown error'}`);
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          metadata: { 
            toolName: toolCall.name,
            exceptionOccurred: true,
            errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
          }
        });
      }
    }

    return results;
  }

  /**
   * Format response when tool already used (sequential execution enforcement)
   */
  private formatResponseToolAlreadyUsed(toolName: string): string {
    return `⚠️ **Sequential Execution Policy**: Tool "${toolName}" was not executed because another tool has already been used in this message. Only one tool can be executed per message to prevent rate limiting and ensure proper sequencing.`;
  }

  /**
   * Validate tool call against schema with improved handling of optional parameters
   */
  private validateToolCall(toolCall: { id: string; name: string; input: any }): { valid: boolean; errors: string[] } {
    const toolDef = this.toolManager.getToolDefinitions().find(t => t.name === toolCall.name);
    if (!toolDef) {
      return { valid: false, errors: [`Unknown tool: ${toolCall.name}`] };
    }

    const errors: string[] = [];
    const required = toolDef.inputSchema.required || [];
    
    // Check required parameters
    for (const requiredParam of required) {
      if (!(requiredParam in toolCall.input)) {
        errors.push(`Missing required parameter: ${requiredParam}`);
      }
    }

    // Enhanced type checking with null/undefined handling
    const properties = toolDef.inputSchema.properties || {};
    for (const [param, value] of Object.entries(toolCall.input)) {
      const propDef = properties[param];
      if (propDef && propDef.type) {
        const expectedType = propDef.type;
        const actualType = typeof value;
        
        // Debug logging to understand the issue
        console.log(`Validating ${toolCall.name}.${param}:`, value, `(type: ${actualType}, expected: ${expectedType}, required: ${required.includes(param)})`);
        
        // Skip validation for null values on optional parameters
        if (value === null || value === undefined) {
          if (required.includes(param)) {
            errors.push(`Required parameter ${param} cannot be null or undefined`);
          }
          console.log(`Skipping validation for null/undefined optional parameter: ${param}`);
          continue; // Skip type checking for null/undefined values on optional params
        }
        
        if (expectedType === 'string' && actualType !== 'string') {
          errors.push(`Parameter ${param} should be a string, got ${actualType}`);
        } else if (expectedType === 'number' && actualType !== 'number') {
          errors.push(`Parameter ${param} should be a number, got ${actualType}`);
        } else if (expectedType === 'boolean' && actualType !== 'boolean') {
          errors.push(`Parameter ${param} should be a boolean, got ${actualType}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Determine if a tool call needs user approval
   */
  private shouldRequestApproval(toolCall: { id: string; name: string; input: any }): boolean {
    if (!this.config.autoApproveBasicOperations) {
      return true; // Require approval for everything
    }

    // Check tool-specific logic
    switch (toolCall.name) {
      case 'bash_command':
        return this.bashCommandNeedsApproval(toolCall.input.command);
      
      case 'write_file':
        // Don't require approval - executeWithLogging will show diff viewer directly
        return false;

      case 'edit_file':
        // Don't require approval - executeWithLogging will show diff viewer directly
        return false;
      
      case 'read_file':
      case 'grep_search':
      case 'list_directory':
        // Always auto-approve read operations
        return false;
      
      case 'attempt_completion':
        // Auto-approve completion - this is the final step and should be shown directly
        return false;
      
      default:
        return true; // Unknown tools require approval
    }
  }

  /**
   * Check if bash command needs approval
   */
  private bashCommandNeedsApproval(command: string): boolean {
    if (!command) return true;

    const commandLower = command.toLowerCase().trim();

    // Auto-approve safe commands
    const safeCommands = [
      'ls', 'dir', 'pwd', 'whoami', 'date', 'echo',
      'cat', 'type', 'head', 'tail', 'grep', 'find',
      'git status', 'git log', 'git diff', 'git branch',
      'npm --version', 'node --version', 'yarn --version',
      'npm run build', 'npm run test', 'npm run dev', 'npm run start',
      'yarn build', 'yarn test', 'yarn dev', 'yarn start'
    ];

    // Check if command starts with any safe command
    if (safeCommands.some(safe => commandLower.startsWith(safe))) {
      return false;
    }

    // Check against dangerous patterns
    for (const dangerous of this.config.requireApprovalFor) {
      if (commandLower.includes(dangerous.toLowerCase())) {
        return true;
      }
    }

    // Default to requiring approval for unknown commands
    return true;
  }

  /**
   * Request user approval for tool execution
   */
  private async requestApproval(toolCall: { id: string; name: string; input: any }): Promise<boolean> {
    const toolName = toolCall.name;
    const input = JSON.stringify(toolCall.input, null, 2);
    
    const message = `🤖 Agent wants to execute: ${toolName}\n\nInput:\n${input}\n\nDo you approve?`;
    
    const choice = await vscode.window.showWarningMessage(
      message,
      { modal: true },
      'Approve',
      'Deny',
      'View Details'
    );
    
    if (choice === 'View Details') {
      // Show more details in output channel
      this.outputChannel.show();
      this.outputChannel.appendLine(`=== TOOL APPROVAL REQUEST ===`);
      this.outputChannel.appendLine(`Tool: ${toolName}`);
      this.outputChannel.appendLine(`Input: ${input}`);
      this.outputChannel.appendLine(`Session: ${this.currentSession?.goal}`);
      this.outputChannel.appendLine(`==============================`);
      
      // Ask again
      return this.requestApproval(toolCall);
    }
    
    return choice === 'Approve';
  }

  /**
   * Determine if the agent should trigger completion based on available information
   */
  private shouldTriggerCompletion(toolResults: ToolResult[], toolCalls: Array<{ id: string; name: string; input: any }>): boolean {
    if (!this.currentSession) return false;

    // Check for specific completion triggers based on user query
    const userGoal = this.currentSession.goal.toLowerCase();
    
    // Special handling for GPT-5 - be less aggressive with completion triggers
    const isGPT5 = this.config.provider === 'openai';
    
    // Enhanced completion logic with state awareness
    const hasReadFiles = toolResults.some(result => 
      result.success && 
      result.output && 
      result.output.length > 100
    );
    
    // Check if we've explored the project structure
    const hasExploredStructure = this.currentSession.messages.some(msg =>
      msg.toolResults?.some(tr => tr.result?.success && tr.result?.output?.includes('directory'))
    );
    
    // Count successful tool executions with meaningful results
    const successfulToolExecutions = this.currentSession.messages.filter(msg => 
      msg.toolResults?.some(tr => tr.result?.success && tr.result?.output && tr.result?.output.length > 50)
    ).length;
    
    // Check if we're making progress or stuck
    const recentFileReads = this.toolCallHistory.filter(
      entry => entry.tool === 'read_file' && 
      (Date.now() - entry.timestamp) < 60000 // last minute
    ).length;
    
    // Progressive completion triggers (optimized for GPT-5 efficiency)
    
    // For GPT-5, aggressive completion triggers
    const minIterationsForGPT5 = isGPT5 ? 3 : 2; // Reduced from 5 to 3
    const minToolExecutionsForGPT5 = isGPT5 ? 3 : 3; // Reduced from 4 to 3
    const maxFileReadsForGPT5 = isGPT5 ? 3 : 3; // Reduced from 5 to 3
    const maxIterationsForGPT5 = isGPT5 ? 6 : 5; // Reduced from 10 to 6
    
    // GPT-5 specific enhanced completion triggers
    if (isGPT5) {
      // Check if we have implementation tool calls in recent history
      const recentImplementations = this.toolCallHistory.filter(
        entry => (entry.tool === 'write_file' || entry.tool === 'edit_file') &&
        (Date.now() - entry.timestamp) < 180000 // last 3 minutes
      ).length;
      
      // Check if we've done sufficient exploration for implementation tasks
      const hasExploredSufficiently = this.toolCallHistory.filter(
        entry => (entry.tool === 'list_directory' || entry.tool === 'read_file') &&
        (Date.now() - entry.timestamp) < 300000 // last 5 minutes
      ).length >= 2;
      
      // Early completion for implementation tasks that have made progress
      if (recentImplementations >= 1 && hasExploredSufficiently && this.currentSession.iterations >= 3) {
        this.outputChannel.appendLine(`🎯 GPT-5 early completion: Implementation progress detected`);
        return true;
      }
    }
    
    // 1. Quick completion for simple queries with immediate results (disabled for GPT-5)
    if (!isGPT5 && hasReadFiles && userGoal.includes('what') && this.currentSession.iterations >= 1) {
      this.outputChannel.appendLine(`🎯 Triggering completion: Found substantial information for simple query`);
      return true;
    }
    
    // 2. Standard completion after exploring and reading
    if (hasReadFiles && hasExploredStructure && this.currentSession.iterations >= minIterationsForGPT5) {
      this.outputChannel.appendLine(`🎯 Triggering completion: Found substantial information after exploration`);
      return true;
    }
    
    // 3. Force completion if too many file reads (potential loop)
    if (recentFileReads >= maxFileReadsForGPT5) {
      this.outputChannel.appendLine(`🎯 Triggering completion: Too many recent file reads (${recentFileReads}), likely looping`);
      return true;
    }
    
    // 4. General completion after sufficient exploration
    if (successfulToolExecutions >= minToolExecutionsForGPT5) {
      this.outputChannel.appendLine(`🎯 Triggering completion: Enough tool executions (${successfulToolExecutions})`);
      return true;
    }
    
    // 5. Force completion if iterations are high
    if (this.currentSession.iterations >= maxIterationsForGPT5) {
      this.outputChannel.appendLine(`🎯 Triggering completion: Maximum iterations reached (${this.currentSession.iterations})`);
      return true;
    }
    
    return false;
  }

  /**
   * Deduplicate tool calls to prevent multiple identical calls
   */
  private deduplicateToolCalls(toolCalls: Array<{ id: string; name: string; input: any }>): Array<{ id: string; name: string; input: any }> {
    const seen = new Map<string, boolean>();
    const deduplicatedCalls: Array<{ id: string; name: string; input: any }> = [];
    
    for (const toolCall of toolCalls) {
      // Create a key based on tool name and input parameters
      const key = `${toolCall.name}:${JSON.stringify(toolCall.input)}`;
      
      if (!seen.has(key)) {
        seen.set(key, true);
        deduplicatedCalls.push(toolCall);
      } else {
        this.outputChannel.appendLine(`🔄 Removing duplicate tool call: ${toolCall.name}`);
      }
    }
    
    return deduplicatedCalls;
  }

  /**
   * Allow all tool calls - removed duplicate filtering for LLM autonomy (DEPRECATED - use deduplicateToolCalls)
   */
  private filterDuplicateToolCalls(toolCalls: Array<{ id: string; name: string; input: any }>): Array<{ id: string; name: string; input: any }> {
    // Return all tool calls without filtering - let the LLM choose freely
    return toolCalls;
  }



  /**
   * Manage context before making LLM call with improved strategy
   */
  private manageContextBeforeCall(): void {
    if (!this.currentSession) return;

    // Improved context management strategy
    const anthropicProvider = (this.aiProviderManager as any).anthropicProvider;
    if (anthropicProvider && typeof anthropicProvider.getTokenTracker === 'function') {
      const tokenTracker = anthropicProvider.getTokenTracker();
      
      // Convert messages for token counting
      const messageTexts = this.currentSession.messages.map(msg => msg.content).join('\n');
      const currentTokens = tokenTracker.estimateTokenCount(messageTexts);
      
      this.outputChannel.appendLine(`📊 Current context tokens: ${currentTokens}`);
      
      // More intelligent context management with preservation of important messages
      if (currentTokens > 4000) { // Increased threshold to be less aggressive
        this.outputChannel.appendLine(`🗜️ Starting smart context management...`);
        
        // Preserve essential messages
        const systemMessage = this.currentSession.messages.find(msg => msg.role === 'system');
        const recentMessages = this.currentSession.messages.slice(-3); // Keep last 3 messages
        const toolResultMessages = this.currentSession.messages.filter(msg => 
          msg.toolResults && msg.toolResults.length > 0
        ).slice(-2); // Keep last 2 tool result messages
        
        // Combine preserved messages, avoiding duplicates
        const preservedMessages: AgentMessage[] = [];
        if (systemMessage) preservedMessages.push(systemMessage);
        
        // Add tool result messages (but not if they're already in recent messages)
        for (const toolMsg of toolResultMessages) {
          if (!recentMessages.some(recent => recent === toolMsg)) {
            preservedMessages.push(toolMsg);
          }
        }
        
        // Add recent messages
        for (const recentMsg of recentMessages) {
          if (!preservedMessages.some(preserved => preserved === recentMsg)) {
            preservedMessages.push(recentMsg);
          }
        }
        
        // Calculate tokens saved
        const beforeCount = this.currentSession.messages.length;
        this.currentSession.messages = preservedMessages;
        const afterCount = this.currentSession.messages.length;
        
        this.outputChannel.appendLine(`🗜️ SMART TRUNCATION: Kept ${afterCount}/${beforeCount} messages (preserved system, tool results, and recent messages)`);
        
        // Recheck tokens
        const newMessageTexts = this.currentSession.messages.map(msg => msg.content).join('\n');
        const newTokens = tokenTracker.estimateTokenCount(newMessageTexts);
        this.outputChannel.appendLine(`📊 New token count: ${newTokens} (saved ~${currentTokens - newTokens} tokens)`);
      }
      
      // Final emergency check
      const finalMessageTexts = this.currentSession.messages.map(msg => msg.content).join('\n');
      const finalTokens = tokenTracker.estimateTokenCount(finalMessageTexts);
      
      if (finalTokens > 6000) { // Emergency threshold
        this.outputChannel.appendLine(`🚨 EMERGENCY TRUNCATION: Still too many tokens (${finalTokens})`);
        
        const systemMessage = this.currentSession.messages.find(msg => msg.role === 'system');
        const lastMessage = this.currentSession.messages[this.currentSession.messages.length - 1];
        
        this.currentSession.messages = systemMessage 
          ? [systemMessage, lastMessage]
          : [lastMessage];
          
        this.outputChannel.appendLine(`🚨 EMERGENCY: Keeping only system + last message`);
      }
    }
  }

  /**
   * Format conversation for LLM with advanced context management
   */
  private formatConversation(messages: AgentMessage[]): string {
    // Convert messages to the format expected by ContextManager
    const conversationHistory = messages.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
      timestamp: Date.now()
    }));

    // Build conversation text with optimized content
    let conversation = '';
    
    // Find system message and add it first
    const systemMessage = conversationHistory.find(msg => msg.role === 'system');
    if (systemMessage) {
      conversation += `${systemMessage.content}\n\n`;
    }
    
    // Add user-assistant pairs in compact format
    const nonSystemMessages = conversationHistory.filter(msg => msg.role !== 'system');
    
    nonSystemMessages.forEach((msg, index) => {
      if (msg.role === 'user') {
        conversation += `Human: ${msg.content}\n\n`;
      } else if (msg.role === 'assistant') {
        // Check if this is a tool call response
        const correspondingAgentMsg = messages.find(m => m.content === msg.content);
        if (correspondingAgentMsg?.toolCalls && correspondingAgentMsg.toolCalls.length > 0) {
          // Compact format for tool calls
          conversation += `Assistant: [Used tool: ${correspondingAgentMsg.toolCalls[0].name}]\n\n`;
        } else if (msg.content.length > 500) {
          // Compress very long responses
          const summary = msg.content.substring(0, 200) + '...[content compressed]...' + msg.content.substring(msg.content.length - 100);
          conversation += `Assistant: ${summary}\n\n`;
        } else {
          conversation += `Assistant: ${msg.content}\n\n`;
        }
      }
    });
    
    // Add guidance for next action
    conversation += `Continue your analysis. Use appropriate tools or provide your final comprehensive answer.`;
    
    return conversation;
  }

  /**
   * Create enhanced system prompt based on Cline's approach
   */
  private createSystemPrompt(): string {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    return createAgentSystemPrompt(workspaceRoot, process.platform);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<LLMAgentConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.outputChannel.appendLine(`⚙️ Agent configuration updated`);
  }

  /**
   * Get current configuration
   */
  getConfig(): LLMAgentConfig {
    return { ...this.config };
  }

  /**
   * Notify UI about todo list creation
   */
  private notifyTodoListCreated(todoList: TodoList): void {
    // Send todo list to the chat webview
    const webviewProvider = this.aiProviderManager.getWebviewProvider();
    this.outputChannel.appendLine(`🔍 DEBUG: webviewProvider exists: ${!!webviewProvider}`);
    
    if (webviewProvider) {
      // Format todo list for webview display
      const todoListForWebview = {
        ...todoList,
        stats: {
          total: todoList.items.length,
          completed: todoList.items.filter(item => item.status === 'completed').length,
          in_progress: todoList.items.filter(item => item.status === 'in_progress').length,
          pending: todoList.items.filter(item => item.status === 'pending').length
        },
        progress: Math.round(todoList.items.filter(item => item.status === 'completed').length / todoList.items.length * 100)
      };
      
      this.outputChannel.appendLine(`🔍 DEBUG: Sending todo list to webview with ${todoListForWebview.items.length} items`);
      
      webviewProvider.postMessage({
        type: 'todoList',
        todoList: todoListForWebview,
        timestamp: new Date()
      });

      // Clear any loading message and show just the todo dropdown
      webviewProvider.postMessage({
        type: 'clearLoading',
        timestamp: new Date()
      });
    } else {
      this.outputChannel.appendLine(`❌ DEBUG: webviewProvider is null - cannot send todo list to UI`);
    }
    
    // Also log it
    this.outputChannel.appendLine(`📋 Todo List Created:`);
    todoList.items.forEach((item, index) => {
      this.outputChannel.appendLine(`  ${index + 1}. ${item.title} (${item.status})`);
    });
  }

  /**
   * Mark current todo item as in progress
   */
  markTodoItemInProgress(): void {
    const nextItem = this.todoListManager.getNextPendingItem();
    if (nextItem) {
      this.todoListManager.markCurrentItemInProgress(nextItem.id);
      this.outputChannel.appendLine(`🔄 Started: ${nextItem.title}`);
    }
  }

  /**
   * Mark current todo item as completed
   */
  markTodoItemCompleted(itemId?: string): void {
    const todoList = this.todoListManager.getCurrentTodoList();
    if (!todoList) return;

    // If no specific item ID provided, complete the first in-progress item
    if (!itemId) {
      const inProgressItem = todoList.items.find(item => item.status === 'in_progress');
      if (inProgressItem) {
        itemId = inProgressItem.id;
      }
    }

    if (itemId) {
      this.todoListManager.markCurrentItemCompleted(itemId);
      const item = todoList.items.find(item => item.id === itemId);
      if (item) {
        this.outputChannel.appendLine(`✅ Completed: ${item.title}`);
      }
    }
  }

  /**
   * Enhance tool call with missing parameters and defaults
   */
  private enhanceToolCall(toolCall: any): any {
    if (!toolCall || !toolCall.name) {
      return toolCall;
    }

    const enhanced = { ...toolCall };
    if (!enhanced.input) {
      enhanced.input = {};
    }

    // Add tool-specific default parameters
    switch (toolCall.name) {
      case 'list_directory':
        if (!enhanced.input.path) {
          enhanced.input.path = '.';
        }
        break;

      case 'grep_search':
        if (!enhanced.input.path) {
          enhanced.input.path = '.';
        }
        if (!enhanced.input.max_results) {
          enhanced.input.max_results = 100;
        }
        break;

      case 'read_file':
        // No defaults needed for read_file - path is required
        break;

      case 'bash_command':
        if (!enhanced.input.requires_approval) {
          enhanced.input.requires_approval = false;
        }
        break;

      case 'attempt_completion':
        // Remove null optional parameters to avoid validation issues
        if (enhanced.input.command === null || enhanced.input.command === undefined) {
          delete enhanced.input.command;
          console.log(`Enhanced attempt_completion: Removed null command parameter`);
        }
        break;

      case 'edit_file':
        // Add missing file_path if it's missing (common parsing issue)
        if (!enhanced.input.file_path) {
          // Try to infer from recent context - look for recently read HTML file
          enhanced.input.file_path = 'hello_world.html'; // Default fallback
          console.log(`Enhanced edit_file: Added missing file_path`);
        }
        
        // Convert single edit format to array format if needed
        if (enhanced.input.old_string && enhanced.input.new_string && !enhanced.input.edits) {
          enhanced.input.edits = [{
            old_string: enhanced.input.old_string,
            new_string: enhanced.input.new_string
          }];
          // Remove the old format parameters
          delete enhanced.input.old_string;
          delete enhanced.input.new_string;
          console.log(`Enhanced edit_file: Converted single edit to array format`);
        }
        break;
    }

    return enhanced;
  }

  /**
   * Attempt to fix common tool call validation issues
   */
  private attemptToolCallFix(toolCall: any, errors: string[]): any | null {
    if (!toolCall || !toolCall.name || !errors.length) {
      return null;
    }

    const fixed = { ...toolCall };
    if (!fixed.input) {
      fixed.input = {};
    }

    for (const error of errors) {
      if (error.includes('Missing required parameter: path')) {
        if (toolCall.name === 'list_directory' || toolCall.name === 'grep_search') {
          fixed.input.path = '.';
        }
      }
      
      if (error.includes('Missing required parameter: pattern')) {
        if (toolCall.name === 'grep_search') {
          // If we can't infer a pattern, we can't fix this
          return null;
        }
      }

      if (error.includes('Missing required parameter: command')) {
        if (toolCall.name === 'bash_command') {
          // Can't safely create a command
          return null;
        }
      }

      if (error.includes('should be a string')) {
        // Try to convert parameters to strings if they aren't, or remove null optionals
        for (const [key, value] of Object.entries(fixed.input)) {
          if (value === null || value === undefined) {
            // For optional parameters, just remove them
            delete fixed.input[key];
            console.log(`Fix: Removed null parameter ${key} from ${toolCall.name}`);
          } else if (typeof value !== 'string' && value !== null && value !== undefined) {
            fixed.input[key] = String(value);
            console.log(`Fix: Converted parameter ${key} to string for ${toolCall.name}`);
          }
        }
      }

      // Specific fix for attempt_completion command parameter issue
      if (error.includes('Parameter command should be a string, got object') && toolCall.name === 'attempt_completion') {
        if (fixed.input.command === null || typeof fixed.input.command === 'object') {
          delete fixed.input.command;
          console.log(`Fix: Removed problematic command parameter from attempt_completion`);
        }
      }

      // Specific fix for edit_file parameter format issue
      if (error.includes('Missing required parameter: edits') && toolCall.name === 'edit_file') {
        if (fixed.input.old_string && fixed.input.new_string && !fixed.input.edits) {
          fixed.input.edits = [{
            old_string: fixed.input.old_string,
            new_string: fixed.input.new_string
          }];
          delete fixed.input.old_string;
          delete fixed.input.new_string;
          console.log(`Fix: Converted edit_file single edit format to array format`);
        }
      }

      // Specific fix for edit_file missing file_path
      if (error.includes('Missing required parameter: file_path') && toolCall.name === 'edit_file') {
        if (!fixed.input.file_path) {
          fixed.input.file_path = 'hello_world.html'; // Default fallback
          console.log(`Fix: Added missing file_path to edit_file`);
        }
      }
    }

    return fixed;
  }

  /**
   * Create a basic tool call for common recovery scenarios
   */
  private createBasicToolCall(toolName: string): any | null {
    switch (toolName) {
      case 'list_directory':
        return {
          id: this.generateToolCallId(),
          name: 'list_directory',
          input: { path: '.' }
        };

      case 'read_file':
        // Can't create a basic read_file without knowing which file
        return null;

      case 'grep_search':
        // Can't create a basic grep without a pattern
        return null;

      case 'bash_command':
        // Too dangerous to create a basic bash command
        return null;

      default:
        return null;
    }
  }

  /**
   * Generate a unique tool call ID
   */
  private generateToolCallId(): string {
    return `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current todo list for UI
   */
  getCurrentTodoList(): any {
    return this.todoListManager.getTodoListSummary();
  }

  /**
   * Apply file context optimization to tool calls to prevent redundant reads
   */
  private applyFileContextOptimization(toolCalls: any[]): any[] {
    const optimizedCalls: any[] = [];
    
    for (const toolCall of toolCalls) {
      if (toolCall.name === 'read_file') {
        const filePath = toolCall.input?.file_path || toolCall.input?.path;
        if (filePath) {
          const trackingResult = this.fileContextTracker.shouldReadFile({
            filePath,
            limit: toolCall.input?.limit,
            offset: toolCall.input?.offset
          });
          
          if (!trackingResult.shouldRead && trackingResult.cachedContent) {
            // Use cached content efficiently (like Cline)
            this.outputChannel.appendLine(`💾 CACHE HIT: ${filePath} - ${trackingResult.reason}`);
            
            // Create synthetic result with cached content
            const syntheticResult: ToolResult = {
              success: true,
              output: trackingResult.cachedContent,
              metadata: {
                toolName: 'read_file',
                fromCache: true,
                reason: trackingResult.reason,
                timestamp: new Date(),
                cacheTimestamp: Date.now()
              }
            };
            
            // Add to optimized calls with synthetic result (more efficient than adding to messages)
            const syntheticToolCall = {
              ...toolCall,
              _syntheticResult: syntheticResult,
              _isCached: true
            };
            optimizedCalls.push(syntheticToolCall);
            
            this.outputChannel.appendLine(`⚡ CACHE EFFICIENCY: Saved read of ${filePath} (${Math.min(trackingResult.cachedContent.length, 100)} chars)`);
            continue;
          } else {
            this.outputChannel.appendLine(`📖 Will read ${filePath} - ${trackingResult.reason}`);
          }
        }
      }
      
      optimizedCalls.push(toolCall);
    }
    
    return optimizedCalls;
  }

  /**
   * Enhanced context management for GPT-5 with proper buffer space (improved)
   */
  private manageGPT5ContextEfficiently(): void {
    if (!this.currentSession || this.config.provider !== 'openai') return;

    const messages = this.currentSession.messages;
    const messageTexts = messages.map(msg => msg.content).join('\n');
    const estimatedTokens = Math.ceil(messageTexts.length / 4); // Rough estimate
    
    // GPT-5 specific context management with 20k buffer (aggressive)
    const GPT5_CONTEXT_WINDOW = 128000;
    const GPT5_BUFFER_SIZE = 20000; // Aggressive buffer for maximum efficiency
    const maxAllowedTokens = GPT5_CONTEXT_WINDOW - GPT5_BUFFER_SIZE;
    
    this.outputChannel.appendLine(`📊 GPT-5 Context: ${estimatedTokens} tokens (${Math.round((estimatedTokens / GPT5_CONTEXT_WINDOW) * 100)}% of window)`);
    
    if (estimatedTokens > maxAllowedTokens) {
      this.outputChannel.appendLine(`🗜️ GPT-5 context optimization: Compacting conversation (${estimatedTokens} > ${maxAllowedTokens})`);
      
      // Ultra-aggressive preservation strategy
      const systemMessage = messages.find(msg => msg.role === 'system');
      const recentMessages = messages.slice(-3); // Keep last 3 messages (reduced from 4)
      const implementationMessages = messages.filter(msg => 
        msg.content.includes('edit_file') || 
        msg.content.includes('write_file') ||
        msg.content.includes('CACHE HIT') ||
        msg.content.includes('INTERVENTION') ||
        msg.toolResults?.some(tr => tr.result?.success && ['write_file', 'edit_file'].includes(tr.result?.metadata?.toolName))
      ).slice(-1); // Keep last 1 implementation message (reduced from 2)
      
      // Smart combination avoiding duplicates
      const preservedMessages: typeof messages = [];
      if (systemMessage) preservedMessages.push(systemMessage);
      
      // Add implementation messages not in recent
      for (const implMsg of implementationMessages) {
        if (!recentMessages.some(recent => recent === implMsg)) {
          preservedMessages.push(implMsg);
        }
      }
      
      // Add recent messages
      for (const recentMsg of recentMessages) {
        if (!preservedMessages.some(preserved => preserved === recentMsg)) {
          preservedMessages.push(recentMsg);
        }
      }
      
      const beforeCount = messages.length;
      this.currentSession.messages = preservedMessages;
      const afterCount = preservedMessages.length;
      
      const newEstimatedTokens = Math.ceil(preservedMessages.map(msg => msg.content).join('\n').length / 4);
      this.outputChannel.appendLine(`🗜️ GPT-5 efficient optimization: ${beforeCount} → ${afterCount} messages (~${estimatedTokens} → ~${newEstimatedTokens} tokens)`);
    }
  }

  /**
   * Enhanced context management for GPT-5 with proper buffer space (legacy)
   */
  private manageGPT5Context(): void {
    if (!this.currentSession || this.config.provider !== 'openai') return;

    const messages = this.currentSession.messages;
    const messageTexts = messages.map(msg => msg.content).join('\n');
    const estimatedTokens = Math.ceil(messageTexts.length / 4); // Rough estimate
    
    // GPT-5 specific context management with 30k buffer
    const GPT5_CONTEXT_WINDOW = 128000;
    const GPT5_BUFFER_SIZE = 30000;
    const maxAllowedTokens = GPT5_CONTEXT_WINDOW - GPT5_BUFFER_SIZE;
    
    this.outputChannel.appendLine(`📊 GPT-5 Context: ${estimatedTokens} tokens (${Math.round((estimatedTokens / GPT5_CONTEXT_WINDOW) * 100)}% of window)`);
    
    if (estimatedTokens > maxAllowedTokens) {
      this.outputChannel.appendLine(`🗜️ GPT-5 context management: Optimizing conversation (${estimatedTokens} > ${maxAllowedTokens})`);
      
      // Preserve essential messages for GPT-5
      const systemMessage = messages.find(msg => msg.role === 'system');
      const recentMessages = messages.slice(-5); // Keep last 5 messages
      const implementationMessages = messages.filter(msg => 
        msg.content.includes('write_file') || 
        msg.content.includes('edit_file') ||
        msg.toolResults?.some(tr => tr.result?.success && tr.result?.metadata?.toolName === 'write_file')
      ).slice(-2); // Keep last 2 implementation messages
      
      // Smart combination avoiding duplicates
      const preservedMessages: typeof messages = [];
      if (systemMessage) preservedMessages.push(systemMessage);
      
      // Add implementation messages not in recent
      for (const implMsg of implementationMessages) {
        if (!recentMessages.some(recent => recent === implMsg)) {
          preservedMessages.push(implMsg);
        }
      }
      
      // Add recent messages
      for (const recentMsg of recentMessages) {
        if (!preservedMessages.some(preserved => preserved === recentMsg)) {
          preservedMessages.push(recentMsg);
        }
      }
      
      const beforeCount = messages.length;
      this.currentSession.messages = preservedMessages;
      const afterCount = preservedMessages.length;
      
      const newEstimatedTokens = Math.ceil(preservedMessages.map(msg => msg.content).join('\n').length / 4);
      this.outputChannel.appendLine(`🗜️ GPT-5 optimization: ${beforeCount} → ${afterCount} messages (~${estimatedTokens} → ~${newEstimatedTokens} tokens)`);
    }
  }

  /**
   * Execute a batch of tools with intelligent parallel/sequential execution
   */
  private async executeToolBatch(
    toolCalls: Array<{ id: string; name: string; input: any }>, 
    batchType: 'read-only' | 'write' | 'other' | 'completion'
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    
    if (batchType === 'read-only') {
      // Execute read-only tools in parallel for efficiency (like Cline)
      this.outputChannel.appendLine(`📚 Parallel execution of ${toolCalls.length} read-only tools`);
      
          const promises = toolCalls.map(async (toolCall) => {
        try {
          const startTime = Date.now();
          
          // Check if this is a synthetic cached result
          if ((toolCall as any)._syntheticResult) {
            const syntheticResult = (toolCall as any)._syntheticResult;
            const duration = Date.now() - startTime;
            this.outputChannel.appendLine(`💾 [${toolCall.name}] CACHE SUCCESS (${duration}ms)`);
            return {
              ...syntheticResult,
              metadata: {
                ...syntheticResult.metadata,
                duration,
                executionMode: 'cached'
              }
            };
          }
          
          // Check approval
          const needsApproval = this.shouldRequestApproval(toolCall);
          if (needsApproval && !(await this.requestApproval(toolCall))) {
            return {
              success: false,
              error: 'User denied permission to execute this tool',
              metadata: { toolName: toolCall.name, userDenied: true }
            };
          }
          
          const result = await this.toolManager.executeTool(
            toolCall.name,
            toolCall.input,
            'agent'
          );
          
          const duration = Date.now() - startTime;
          
          // Cache file content if this was a successful read_file operation
          if (toolCall.name === 'read_file' && result.success && result.output) {
            const filePath = toolCall.input?.file_path || toolCall.input?.path;
            if (filePath) {
              this.fileContextTracker.cacheFileContent(
                filePath, 
                result.output,
                toolCall.input?.limit,
                toolCall.input?.offset
              );
            }
          }
          
          this.outputChannel.appendLine(`✅ [${toolCall.name}] PARALLEL SUCCESS (${duration}ms)`);
          
          return {
            ...result,
            metadata: {
              ...result.metadata,
              toolName: toolCall.name,
              duration,
              executionMode: 'parallel'
            }
          };
        } catch (error) {
          this.outputChannel.appendLine(`❌ [${toolCall.name}] PARALLEL FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            metadata: { 
              toolName: toolCall.name,
              executionMode: 'parallel',
              exceptionOccurred: true
            }
          };
        }
      });
      
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
      
    } else {
      // Execute non-read tools sequentially for safety
      this.outputChannel.appendLine(`🔧 Sequential execution of ${toolCalls.length} ${batchType} tools`);
      
      for (const toolCall of toolCalls) {
        try {
          const startTime = Date.now();
          
          // Check approval
          const needsApproval = this.shouldRequestApproval(toolCall);
          if (needsApproval && !(await this.requestApproval(toolCall))) {
            results.push({
              success: false,
              error: 'User denied permission to execute this tool',
              metadata: { toolName: toolCall.name, userDenied: true }
            });
            continue;
          }
          
          const result = await this.toolManager.executeTool(
            toolCall.name,
            toolCall.input,
            'agent'
          );
          
          const duration = Date.now() - startTime;
          
          this.outputChannel.appendLine(`✅ [${toolCall.name}] SEQUENTIAL SUCCESS (${duration}ms)`);
          
          results.push({
            ...result,
            metadata: {
              ...result.metadata,
              toolName: toolCall.name,
              duration,
              executionMode: 'sequential'
            }
          });
          
        } catch (error) {
          this.outputChannel.appendLine(`❌ [${toolCall.name}] SEQUENTIAL FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
          results.push({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            metadata: { 
              toolName: toolCall.name,
              executionMode: 'sequential',
              exceptionOccurred: true
            }
          });
        }
      }
    }
    
    return results;
  }

  dispose(): void {
    this.todoListManager.dispose();
    this.outputChannel.dispose();
    this.fileContextTracker.dispose();
  }
}
