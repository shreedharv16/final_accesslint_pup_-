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
exports.ToolExecutionStateManager = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Tool execution state manager inspired by Cline's approach
 * Manages execution lifecycle, prevents multiple executions, tracks state
 */
class ToolExecutionStateManager {
    constructor(config) {
        this.activeExecutions = new Map();
        this.executionHistory = new Map();
        this.currentSession = null;
        this.config = {
            maxConcurrentExecutions: 1,
            executionTimeout: 30000,
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
    startSession() {
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
    endSession(status = 'completed') {
        if (!this.currentSession)
            return;
        this.currentSession.endTime = Date.now();
        this.currentSession.status = status;
        if (this.config.enableLogging) {
            const duration = this.currentSession.endTime - this.currentSession.startTime;
            this.outputChannel.appendLine(`🏁 Session ${this.currentSession.id} ended: ${status} (${duration}ms)`);
        }
        this.currentSession = null;
    }
    /**
     * Check if a tool execution should be allowed (Cline-style single execution)
     */
    canExecuteTool(toolName) {
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
    canExecuteToolSequentially(toolName, messageToolUsed) {
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
    canExecuteToolLegacy(toolName) {
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
    startExecution(toolName, input) {
        const canExecute = this.canExecuteTool(toolName);
        if (!canExecute.allowed) {
            throw new Error(`Cannot execute tool: ${canExecute.reason}`);
        }
        const executionId = this.generateId('exec');
        const execution = {
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
            this.outputChannel.appendLine(`▶️ Started execution ${executionId}: ${toolName}`);
        }
        // Start timeout timer
        this.startExecutionTimeout(executionId);
        return executionId;
    }
    /**
     * Update execution status
     */
    updateExecutionStatus(executionId, status, result, error) {
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
                this.outputChannel.appendLine(`${icon} Execution ${executionId} ${status} (${execution.metadata.totalDuration}ms)`);
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
    cancelExecution(executionId, reason = 'User cancelled') {
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
    cancelAllExecutions(reason = 'Bulk cancellation') {
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
    getExecution(executionId) {
        return this.activeExecutions.get(executionId) || this.executionHistory.get(executionId);
    }
    /**
     * Get all active executions
     */
    getActiveExecutions() {
        return Array.from(this.activeExecutions.values());
    }
    /**
     * Get execution history
     */
    getExecutionHistory(limit) {
        const history = Array.from(this.executionHistory.values())
            .sort((a, b) => b.startTime - a.startTime);
        return limit ? history.slice(0, limit) : history;
    }
    /**
     * Get current session info
     */
    getCurrentSession() {
        return this.currentSession;
    }
    /**
     * Get execution statistics
     */
    getExecutionStats() {
        const allExecutions = Array.from(this.executionHistory.values());
        const completedExecutions = allExecutions.filter(e => e.status === 'completed');
        const totalExecutions = allExecutions.length;
        const successRate = totalExecutions > 0 ? (completedExecutions.length / totalExecutions) * 100 : 0;
        const averageDuration = completedExecutions.length > 0
            ? completedExecutions.reduce((sum, e) => sum + e.metadata.totalDuration, 0) / completedExecutions.length
            : 0;
        // Tool usage statistics
        const toolUsageStats = {};
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
    startExecutionTimeout(executionId) {
        setTimeout(() => {
            const execution = this.activeExecutions.get(executionId);
            if (execution && (execution.status === 'pending' || execution.status === 'running')) {
                this.updateExecutionStatus(executionId, 'failed', undefined, `Execution timeout after ${this.config.executionTimeout}ms`);
            }
        }, this.config.executionTimeout);
    }
    /**
     * Log execution metrics
     */
    logExecutionMetrics(execution) {
        if (!this.config.enableMetrics)
            return;
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
    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        if (this.config.enableLogging) {
            this.outputChannel.appendLine(`⚙️ Config updated: ${JSON.stringify(this.config)}`);
        }
    }
    /**
     * Clear execution history
     */
    clearHistory() {
        this.executionHistory.clear();
        if (this.config.enableLogging) {
            this.outputChannel.appendLine('🗑️ Execution history cleared');
        }
    }
    /**
     * Export execution data for analysis
     */
    exportExecutionData() {
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
    dispose() {
        this.cancelAllExecutions('State manager disposing');
        this.endSession('cancelled');
        this.outputChannel.dispose();
    }
}
exports.ToolExecutionStateManager = ToolExecutionStateManager;
//# sourceMappingURL=toolExecutionStateManager.js.map