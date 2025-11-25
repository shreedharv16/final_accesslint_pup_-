import { ToolResult, ToolDefinition, ToolExecutionContext, ToolMode, ToolExecution, FileChange } from './types';
/**
 * Backend Tool Manager
 * Executes tools in backend context (no direct file system access)
 * Files are provided by VSCode extension in the request
 */
export declare class ToolManager {
    private context;
    private executionHistory;
    private fileChanges;
    private currentMode;
    constructor(context: ToolExecutionContext);
    /**
     * Get all available tool definitions
     */
    getToolDefinitions(): ToolDefinition[];
    /**
     * Execute a tool
     */
    executeTool(toolName: string, input: any, mode?: ToolMode): Promise<ToolResult>;
    /**
     * Read file from workspace files cache
     */
    private readFile;
    /**
     * Write file (create new file)
     */
    private writeFile;
    /**
     * Edit file (search and replace)
     */
    private editFile;
    /**
     * Grep search (search in workspace files)
     */
    private grepSearch;
    /**
     * List directory (list files in workspace)
     */
    private listDirectory;
    /**
     * Attempt completion (mark task as done)
     */
    private attemptCompletion;
    /**
     * Get all file changes made during session
     */
    getFileChanges(): FileChange[];
    /**
     * Get execution history
     */
    getExecutionHistory(): ToolExecution[];
    /**
     * Clear file changes
     */
    clearFileChanges(): void;
    /**
     * Group file changes by type
     */
    private groupFileChangesByType;
    /**
     * Update workspace files cache
     */
    updateWorkspaceFiles(files: Map<string, string>): void;
}
export default ToolManager;
//# sourceMappingURL=toolManager.d.ts.map