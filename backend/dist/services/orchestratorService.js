"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestratorService = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const loggingService_1 = require("./loggingService");
const azureOpenAI_1 = require("../config/azureOpenAI");
const models_1 = require("../models");
const toolManager_1 = require("./tools/toolManager");
const agentSystemPrompt_1 = require("./agentSystemPrompt");
/**
 * Agent Orchestrator Service
 * Manages agent execution on the backend
 * Preserves ALL logic from original orchestrators
 */
class OrchestratorService {
    constructor(config) {
        this.session = null;
        this.toolManager = null;
        // Loop detection (preserved from original)
        this.recentToolCalls = new Map();
        this.toolCallHistory = [];
        this.LOOP_DETECTION_WINDOW = 10 * 60 * 1000; // 10 minutes
        this.MAX_SAME_TOOL_CALLS = 15;
        this.MAX_IDENTICAL_CALLS = 4;
        this.config = config;
    }
    /**
     * Start a new agent session
     */
    async startSession(userId, sessionType, goal) {
        try {
            // Create database session
            const dbSession = await models_1.AgentSession.create({
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
            this.toolManager = new toolManager_1.ToolManager({
                userId,
                sessionId: dbSession.id,
                workspaceRoot: this.config.workspaceRoot,
                workspaceFiles: this.config.workspaceFiles
            });
            // Create system prompt
            const systemPrompt = (0, agentSystemPrompt_1.createAgentSystemPrompt)(this.config.workspaceRoot);
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
            (0, loggingService_1.logInfo)(`🚀 Agent session started: ${sessionType}`, userId, dbSession.id, 'agent', { goal });
            return dbSession.id;
        }
        catch (error) {
            logger_1.default.error('❌ Error starting agent session:', error);
            throw error;
        }
    }
    /**
     * Run the agent loop
     * CRITICAL: Preserves ALL logic from original orchestrator
     */
    async runAgentLoop() {
        if (!this.session || !this.toolManager) {
            throw new Error('Session not started');
        }
        try {
            const startTime = Date.now();
            while (this.session.status === 'active' &&
                this.session.iterations < this.config.maxIterations) {
                // Check timeout
                if (Date.now() - startTime > this.config.timeoutMs) {
                    this.session.status = 'timeout';
                    await this.updateSessionInDB('timeout');
                    (0, loggingService_1.logWarn)('⏰ Agent session timeout', this.session.userId, this.session.id, 'agent');
                    break;
                }
                // Check if session was stopped externally
                if (!this.session) {
                    (0, loggingService_1.logWarn)('🛑 Session stopped externally', undefined, undefined, 'agent');
                    break;
                }
                this.session.iterations++;
                (0, loggingService_1.logDebug)(`🔄 Agent iteration ${this.session.iterations}`, this.session.userId, this.session.id, 'agent');
                // Get LLM response
                const llmResponse = await this.getLLMResponse();
                if (!llmResponse) {
                    break; // Session stopped
                }
                // Parse tool calls from response
                const toolCalls = this.parseToolCalls(llmResponse);
                // Save iteration to database
                await models_1.AgentIteration.create({
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
                    (0, loggingService_1.logWarn)(`⚠️  Loop detected: ${loopDetection.reason}`, this.session.userId, this.session.id, 'agent');
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
                    (0, loggingService_1.logInfo)(`✅ Agent completed task`, this.session.userId, this.session.id, 'agent', { result: completionCall.input.result });
                    // CRITICAL: Immediately exit the loop
                    return {
                        success: true,
                        result: completionCall.input.result,
                        fileChanges: this.toolManager.getFileChanges()
                    };
                }
                // Add tool results to messages
                const resultsContent = toolResults.map(r => `Tool: ${r.metadata?.toolName}\nResult: ${r.success ? r.output : r.error}`).join('\n\n');
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
                (0, loggingService_1.logError)('❌ Max iterations reached', this.session.userId, this.session.id, 'agent');
                return {
                    success: false,
                    error: 'Max iterations reached without completion'
                };
            }
            return {
                success: false,
                error: 'Session ended without completion'
            };
        }
        catch (error) {
            logger_1.default.error('❌ Error in agent loop:', error);
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
    async getLLMResponse() {
        if (!this.session)
            return null;
        try {
            const response = await (0, azureOpenAI_1.chatCompletion)(this.session.messages, {
                maxTokens: 4000,
                temperature: 0.7
            });
            return response;
        }
        catch (error) {
            logger_1.default.error('❌ Error getting LLM response:', error);
            throw error;
        }
    }
    /**
     * Parse tool calls from LLM response
     * Looks for XML format: <tool_name>{json}</tool_name>
     */
    parseToolCalls(response) {
        const toolCalls = [];
        // Regex to match <tool_name>{...}</tool_name>
        const toolRegex = /<(\w+)>\s*(\{[\s\S]*?\})\s*<\/\1>/g;
        let match;
        while ((match = toolRegex.exec(response)) !== null) {
            const toolName = match[1];
            const jsonInput = match[2];
            try {
                const input = JSON.parse(jsonInput);
                toolCalls.push({ name: toolName, input });
            }
            catch (error) {
                logger_1.default.warn(`⚠️  Failed to parse tool input for ${toolName}:`, jsonInput);
            }
        }
        return toolCalls;
    }
    /**
     * Execute tool calls
     */
    async executeToolCalls(toolCalls) {
        if (!this.session || !this.toolManager) {
            return [];
        }
        const results = [];
        for (const toolCall of toolCalls) {
            try {
                (0, loggingService_1.logDebug)(`🔧 Executing tool: ${toolCall.name}`, this.session.userId, this.session.id, 'agent', { input: toolCall.input });
                // Track tool call for loop detection
                this.trackToolCall(toolCall.name, toolCall.input, this.session.iterations);
                const result = await this.toolManager.executeTool(toolCall.name, toolCall.input, 'agent');
                results.push(result);
                if (result.success) {
                    (0, loggingService_1.logDebug)(`✅ Tool succeeded: ${toolCall.name}`, this.session.userId, this.session.id, 'agent');
                }
                else {
                    (0, loggingService_1.logWarn)(`⚠️  Tool failed: ${toolCall.name} - ${result.error}`, this.session.userId, this.session.id, 'agent');
                }
            }
            catch (error) {
                logger_1.default.error(`❌ Error executing tool ${toolCall.name}:`, error);
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
    detectInfiniteLoop(toolCalls) {
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
            }
            else {
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
            const identicalCalls = this.toolCallHistory.filter(h => h.tool === key && h.input === inputStr).length;
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
    trackToolCall(tool, input, iteration) {
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
    async interventionPrompt(reason) {
        if (!this.session)
            return;
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
        (0, loggingService_1.logInfo)(`🚨 Intervention applied: ${reason}`, this.session.userId, this.session.id, 'agent');
    }
    /**
     * Update session in database
     */
    async updateSessionInDB(status, summary) {
        if (!this.session)
            return;
        try {
            await models_1.AgentSession.update({
                status,
                totalIterations: this.session.iterations,
                endTime: new Date(),
                completionSummary: summary,
                fileChanges: this.toolManager?.getFileChanges()
            }, {
                where: { id: this.session.id }
            });
        }
        catch (error) {
            logger_1.default.error('❌ Error updating session in DB:', error);
        }
    }
    /**
     * Stop the session
     */
    stopSession() {
        if (this.session) {
            this.session.status = 'error';
            this.session = null;
        }
    }
    /**
     * Get session status
     */
    getSessionStatus() {
        return this.session;
    }
    /**
     * Get file changes
     */
    getFileChanges() {
        return this.toolManager?.getFileChanges() || [];
    }
}
exports.OrchestratorService = OrchestratorService;
exports.default = OrchestratorService;
//# sourceMappingURL=orchestratorService.js.map