import logger from '../utils/logger';
import { logInfo, logWarn, logError, logDebug } from './loggingService';
import { chatCompletion } from '../config/azureOpenAI';
import { AgentSession, AgentIteration } from '../models';
import { ToolManager } from './tools/toolManager';
import { ToolResult, FileChange } from './tools/types';
import { createAgentSystemPrompt } from './agentSystemPrompt';

export interface AgentMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface OrchestrationSession {
    id: string;
    userId: string;
    sessionType: 'chat_agent' | 'testing_agent';
    goal: string;
    status: 'active' | 'completed' | 'error' | 'timeout';
    iterations: number;
    messages: AgentMessage[];
    fileChanges: FileChange[];
    startTime: Date;
    endTime?: Date;
}

export interface OrchestratorConfig {
    maxIterations: number;
    timeoutMs: number;
    workspaceRoot: string;
    workspaceFiles: Map<string, string>;
}

/**
 * Agent Orchestrator Service
 * Manages agent execution on the backend
 * Preserves ALL logic from original orchestrators
 */
export class OrchestratorService {
    private config: OrchestratorConfig;
    private session: OrchestrationSession | null = null;
    private toolManager: ToolManager | null = null;

    // Loop detection (preserved from original)
    private recentToolCalls: Map<string, { count: number; lastCall: number }> = new Map();
    private toolCallHistory: Array<{ tool: string; input: string; timestamp: number; iteration: number }> = [];
    private readonly LOOP_DETECTION_WINDOW = 10 * 60 * 1000; // 10 minutes
    private readonly MAX_SAME_TOOL_CALLS = 15;
    private readonly MAX_IDENTICAL_CALLS = 4;

    constructor(config: OrchestratorConfig) {
        this.config = config;
    }

    /**
     * Start a new agent session
     */
    async startSession(
        userId: string,
        sessionType: 'chat_agent' | 'testing_agent',
        goal: string
    ): Promise<string> {
        try {
            // Create database session
            const dbSession = await AgentSession.create({
                userId,
                sessionType,
                goal,
                status: 'active',
                totalIterations: 0
            });

            // Create in-memory session
            this.session = {
                id: dbSession.id,
                userId,
                sessionType,
                goal,
                status: 'active',
                iterations: 0,
                messages: [],
                fileChanges: [],
                startTime: new Date()
            };

            // Initialize tool manager
            this.toolManager = new ToolManager({
                userId,
                sessionId: dbSession.id,
                workspaceRoot: this.config.workspaceRoot,
                workspaceFiles: this.config.workspaceFiles
            });

            // Create system prompt
            const systemPrompt = createAgentSystemPrompt(this.config.workspaceRoot);

            // Add system message
            this.session.messages.push({
                role: 'system',
                content: systemPrompt
            });

            // Add user goal
            this.session.messages.push({
                role: 'user',
                content: goal
            });

            logInfo(
                `🚀 Agent session started: ${sessionType}`,
                userId,
                dbSession.id,
                'agent',
                { goal }
            );

            return dbSession.id;
        } catch (error) {
            logger.error('❌ Error starting agent session:', error);
            throw error;
        }
    }

    /**
     * Run the agent loop
     * CRITICAL: Preserves ALL logic from original orchestrator
     */
    async runAgentLoop(): Promise<{
        success: boolean;
        result?: string;
        fileChanges?: FileChange[];
        error?: string;
    }> {
        if (!this.session || !this.toolManager) {
            throw new Error('Session not started');
        }

        try {
            const startTime = Date.now();

            while (
                this.session.status === 'active' &&
                this.session.iterations < this.config.maxIterations
            ) {
                // Check timeout
                if (Date.now() - startTime > this.config.timeoutMs) {
                    this.session.status = 'timeout';
                    await this.updateSessionInDB('timeout');
                    logWarn(
                        '⏰ Agent session timeout',
                        this.session.userId,
                        this.session.id,
                        'agent'
                    );
                    break;
                }

                // Check if session was stopped externally
                if (!this.session) {
                    logWarn(
                        '🛑 Session stopped externally',
                        this.session.userId,
                        this.session.id,
                        'agent'
                    );
                    break;
                }

                this.session.iterations++;

                logDebug(
                    `🔄 Agent iteration ${this.session.iterations}`,
                    this.session.userId,
                    this.session.id,
                    'agent'
                );

                // Get LLM response
                const llmResponse = await this.getLLMResponse();
                if (!llmResponse) {
                    break; // Session stopped
                }

                // Parse tool calls from response
                const toolCalls = this.parseToolCalls(llmResponse);

                // Save iteration to database
                await AgentIteration.create({
                    sessionId: this.session.id,
                    iterationNumber: this.session.iterations,
                    llmRequest: { messages: this.session.messages },
                    llmResponse: { content: llmResponse, toolCalls },
                    toolCalls,
                    toolResults: null,
                    tokensUsed: 0 // Will be updated
                });

                // Check for loop
                const loopDetection = this.detectInfiniteLoop(toolCalls);
                if (loopDetection.isLoop) {
                    logWarn(
                        `⚠️  Loop detected: ${loopDetection.reason}`,
                        this.session.userId,
                        this.session.id,
                        'agent'
                    );

                    // Intervene
                    await this.interventionPrompt(loopDetection.reason || 'Loop detected');
                    continue;
                }

                if (toolCalls.length === 0) {
                    // No tool calls, just add assistant message
                    this.session.messages.push({
                        role: 'assistant',
                        content: llmResponse
                    });
                    continue;
                }

                // Execute tools
                const toolResults = await this.executeToolCalls(toolCalls);
                if (!this.session) {
                    break; // Session stopped
                }

                // Check for attempt_completion
                const completionCall = toolCalls.find(tc => tc.name === 'attempt_completion');
                if (completionCall) {
                    this.session.status = 'completed';
                    await this.updateSessionInDB('completed', completionCall.input.result);

                    logInfo(
                        `✅ Agent completed task`,
                        this.session.userId,
                        this.session.id,
                        'agent',
                        { result: completionCall.input.result }
                    );

                    // CRITICAL: Immediately exit the loop
                    return {
                        success: true,
                        result: completionCall.input.result,
                        fileChanges: this.toolManager.getFileChanges()
                    };
                }

                // Add tool results to messages
                const resultsContent = toolResults.map(r =>
                    `Tool: ${r.metadata?.toolName}\nResult: ${r.success ? r.output : r.error}`
                ).join('\n\n');

                this.session.messages.push({
                    role: 'assistant',
                    content: llmResponse
                });

                this.session.messages.push({
                    role: 'user',
                    content: resultsContent
                });
            }

            // Max iterations reached
            if (this.session.iterations >= this.config.maxIterations) {
                this.session.status = 'error';
                await this.updateSessionInDB('error', 'Max iterations reached');

                logError(
                    '❌ Max iterations reached',
                    this.session.userId,
                    this.session.id,
                    'agent'
                );

                return {
                    success: false,
                    error: 'Max iterations reached without completion'
                };
            }

            return {
                success: false,
                error: 'Session ended without completion'
            };
        } catch (error: any) {
            logger.error('❌ Error in agent loop:', error);

            if (this.session) {
                this.session.status = 'error';
                await this.updateSessionInDB('error', error.message);
            }

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get LLM response
     */
    private async getLLMResponse(): Promise<string | null> {
        if (!this.session) return null;

        try {
            const response = await chatCompletion(this.session.messages, {
                maxTokens: 4000,
                temperature: 0.7
            });

            return response;
        } catch (error) {
            logger.error('❌ Error getting LLM response:', error);
            throw error;
        }
    }

    /**
     * Parse tool calls from LLM response
     * Looks for XML format: <tool_name>{json}</tool_name>
     */
    private parseToolCalls(response: string): Array<{ name: string; input: any }> {
        const toolCalls: Array<{ name: string; input: any }> = [];

        // Regex to match <tool_name>{...}</tool_name>
        const toolRegex = /<(\w+)>\s*(\{[\s\S]*?\})\s*<\/\1>/g;
        let match;

        while ((match = toolRegex.exec(response)) !== null) {
            const toolName = match[1];
            const jsonInput = match[2];

            try {
                const input = JSON.parse(jsonInput);
                toolCalls.push({ name: toolName, input });
            } catch (error) {
                logger.warn(`⚠️  Failed to parse tool input for ${toolName}:`, jsonInput);
            }
        }

        return toolCalls;
    }

    /**
     * Execute tool calls
     */
    private async executeToolCalls(toolCalls: Array<{ name: string; input: any }>): Promise<ToolResult[]> {
        if (!this.session || !this.toolManager) {
            return [];
        }

        const results: ToolResult[] = [];

        for (const toolCall of toolCalls) {
            try {
                logDebug(
                    `🔧 Executing tool: ${toolCall.name}`,
                    this.session.userId,
                    this.session.id,
                    'agent',
                    { input: toolCall.input }
                );

                // Track tool call for loop detection
                this.trackToolCall(toolCall.name, toolCall.input, this.session.iterations);

                const result = await this.toolManager.executeTool(toolCall.name, toolCall.input, 'agent');
                results.push(result);

                if (result.success) {
                    logDebug(
                        `✅ Tool succeeded: ${toolCall.name}`,
                        this.session.userId,
                        this.session.id,
                        'agent'
                    );
                } else {
                    logWarn(
                        `⚠️  Tool failed: ${toolCall.name} - ${result.error}`,
                        this.session.userId,
                        this.session.id,
                        'agent'
                    );
                }
            } catch (error: any) {
                logger.error(`❌ Error executing tool ${toolCall.name}:`, error);
                results.push({
                    success: false,
                    error: error.message,
                    metadata: { toolName: toolCall.name }
                });
            }
        }

        return results;
    }

    /**
     * Detect infinite loops (preserved from original)
     */
    private detectInfiniteLoop(toolCalls: Array<{ name: string; input: any }>): {
        isLoop: boolean;
        reason?: string;
        type?: string;
    } {
        if (toolCalls.length === 0) {
            return { isLoop: false };
        }

        const now = Date.now();

        for (const toolCall of toolCalls) {
            const key = toolCall.name;
            const inputStr = JSON.stringify(toolCall.input);

            // Track this tool call
            const existing = this.recentToolCalls.get(key);
            if (existing) {
                existing.count++;
                existing.lastCall = now;
            } else {
                this.recentToolCalls.set(key, { count: 1, lastCall: now });
            }

            // Check for too many calls to same tool
            if (existing && existing.count > this.MAX_SAME_TOOL_CALLS) {
                return {
                    isLoop: true,
                    reason: `Excessive calls to ${key} (${existing.count} times)`,
                    type: 'excessive_same_tool'
                };
            }

            // Check for identical calls
            const identicalCalls = this.toolCallHistory.filter(
                h => h.tool === key && h.input === inputStr
            ).length;

            if (identicalCalls >= this.MAX_IDENTICAL_CALLS) {
                return {
                    isLoop: true,
                    reason: `Repeated identical calls to ${key}`,
                    type: 'identical_calls'
                };
            }
        }

        // Cleanup old entries
        const cutoff = now - this.LOOP_DETECTION_WINDOW;
        for (const [key, value] of this.recentToolCalls.entries()) {
            if (value.lastCall < cutoff) {
                this.recentToolCalls.delete(key);
            }
        }

        this.toolCallHistory = this.toolCallHistory.filter(h => h.timestamp > cutoff);

        return { isLoop: false };
    }

    /**
     * Track tool call for loop detection
     */
    private trackToolCall(tool: string, input: any, iteration: number): void {
        this.toolCallHistory.push({
            tool,
            input: JSON.stringify(input),
            timestamp: Date.now(),
            iteration
        });
    }

    /**
     * Intervention prompt when loop detected
     */
    private async interventionPrompt(reason: string): Promise<void> {
        if (!this.session) return;

        const interventionMessage = `SYSTEM INTERVENTION: ${reason}

You seem to be in a loop. Please:
1. Stop exploring and move to implementation
2. Read only 2-3 files maximum, then implement
3. Use attempt_completion once you've made the necessary changes

Remember: You are a DOER, not an explorer. Make the changes now.`;

        this.session.messages.push({
            role: 'user',
            content: interventionMessage
        });

        logInfo(
            `🚨 Intervention applied: ${reason}`,
            this.session.userId,
            this.session.id,
            'agent'
        );
    }

    /**
     * Update session in database
     */
    private async updateSessionInDB(
        status: 'active' | 'completed' | 'error' | 'timeout',
        summary?: string
    ): Promise<void> {
        if (!this.session) return;

        try {
            await AgentSession.update(
                {
                    status,
                    totalIterations: this.session.iterations,
                    endTime: new Date(),
                    completionSummary: summary,
                    fileChanges: this.toolManager?.getFileChanges()
                },
                {
                    where: { id: this.session.id }
                }
            );
        } catch (error) {
            logger.error('❌ Error updating session in DB:', error);
        }
    }

    /**
     * Stop the session
     */
    stopSession(): void {
        if (this.session) {
            this.session.status = 'error';
            this.session = null;
        }
    }

    /**
     * Get session status
     */
    getSessionStatus(): OrchestrationSession | null {
        return this.session;
    }

    /**
     * Get file changes
     */
    getFileChanges(): FileChange[] {
        return this.toolManager?.getFileChanges() || [];
    }
}

export default OrchestratorService;

