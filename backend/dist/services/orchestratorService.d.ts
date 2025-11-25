import { FileChange } from './tools/types';
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
export declare class OrchestratorService {
    private config;
    private session;
    private toolManager;
    private recentToolCalls;
    private toolCallHistory;
    private readonly LOOP_DETECTION_WINDOW;
    private readonly MAX_SAME_TOOL_CALLS;
    private readonly MAX_IDENTICAL_CALLS;
    constructor(config: OrchestratorConfig);
    /**
     * Start a new agent session
     */
    startSession(userId: string, sessionType: 'chat_agent' | 'testing_agent', goal: string): Promise<string>;
    /**
     * Run the agent loop
     * CRITICAL: Preserves ALL logic from original orchestrator
     */
    runAgentLoop(): Promise<{
        success: boolean;
        result?: string;
        fileChanges?: FileChange[];
        error?: string;
    }>;
    /**
     * Get LLM response
     */
    private getLLMResponse;
    /**
     * Parse tool calls from LLM response
     * Looks for XML format: <tool_name>{json}</tool_name>
     */
    private parseToolCalls;
    /**
     * Execute tool calls
     */
    private executeToolCalls;
    /**
     * Detect infinite loops (preserved from original)
     */
    private detectInfiniteLoop;
    /**
     * Track tool call for loop detection
     */
    private trackToolCall;
    /**
     * Intervention prompt when loop detected
     */
    private interventionPrompt;
    /**
     * Update session in database
     */
    private updateSessionInDB;
    /**
     * Stop the session
     */
    stopSession(): void;
    /**
     * Get session status
     */
    getSessionStatus(): OrchestrationSession | null;
    /**
     * Get file changes
     */
    getFileChanges(): FileChange[];
}
export default OrchestratorService;
//# sourceMappingURL=orchestratorService.d.ts.map