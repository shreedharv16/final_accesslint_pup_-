/**
 * Tool types for backend execution
 * Adapted from VSCode extension tools to work in backend context
 */
export interface ToolResult {
    success: boolean;
    output?: string;
    error?: string;
    data?: any;
    metadata?: {
        toolName: string;
        duration?: number;
        timestamp?: Date;
        [key: string]: any;
    };
}
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        [key: string]: {
            type: string;
            description: string;
            required?: boolean;
        };
    };
}
export interface ToolExecutionContext {
    userId: string;
    sessionId: string;
    workspaceFiles?: Map<string, string>;
    workspaceRoot?: string;
}
export type ToolMode = 'quick' | 'agent';
export interface ToolExecution {
    toolName: string;
    mode: ToolMode;
    input: any;
    result?: ToolResult;
    duration?: number;
    timestamp: Date;
}
export interface FileChange {
    type: 'create' | 'modify' | 'delete';
    path: string;
    content?: string;
    oldContent?: string;
}
export interface ToolManagerOptions {
    maxConcurrentExecutions?: number;
    executionTimeout?: number;
    retryLimit?: number;
    enableMetrics?: boolean;
    enableLogging?: boolean;
}
//# sourceMappingURL=types.d.ts.map