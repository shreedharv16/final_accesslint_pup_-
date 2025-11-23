import logger from '../../utils/logger';
import { logInfo, logDebug } from '../loggingService';
import {
    ToolResult,
    ToolDefinition,
    ToolExecutionContext,
    ToolMode,
    ToolExecution,
    FileChange
} from './types';

/**
 * Backend Tool Manager
 * Executes tools in backend context (no direct file system access)
 * Files are provided by VSCode extension in the request
 */
export class ToolManager {
    private context: ToolExecutionContext;
    private executionHistory: ToolExecution[] = [];
    private fileChanges: FileChange[] = [];
    private currentMode: ToolMode = 'agent';

    constructor(context: ToolExecutionContext) {
        this.context = context;
    }

    /**
     * Get all available tool definitions
     */
    getToolDefinitions(): ToolDefinition[] {
        return [
            {
                name: 'read_file',
                description: 'Read the contents of a file. Returns the file content with line numbers.',
                parameters: {
                    file_path: {
                        type: 'string',
                        description: 'Path to the file to read (relative to workspace root)',
                        required: true
                    }
                }
            },
            {
                name: 'write_file',
                description: 'Create a new file with the specified content.',
                parameters: {
                    file_path: {
                        type: 'string',
                        description: 'Path where the file should be created',
                        required: true
                    },
                    content: {
                        type: 'string',
                        description: 'Content to write to the file',
                        required: true
                    }
                }
            },
            {
                name: 'edit_file',
                description: 'Edit an existing file by searching for old_string and replacing with new_string.',
                parameters: {
                    file_path: {
                        type: 'string',
                        description: 'Path to the file to edit',
                        required: true
                    },
                    old_string: {
                        type: 'string',
                        description: 'The exact string to search for (must be unique)',
                        required: true
                    },
                    new_string: {
                        type: 'string',
                        description: 'The replacement string',
                        required: true
                    },
                    replace_all: {
                        type: 'boolean',
                        description: 'Whether to replace all occurrences',
                        required: false
                    }
                }
            },
            {
                name: 'grep_search',
                description: 'Search for a pattern in files using grep-like functionality.',
                parameters: {
                    pattern: {
                        type: 'string',
                        description: 'The search pattern (regex)',
                        required: true
                    },
                    path: {
                        type: 'string',
                        description: 'Directory or file to search in',
                        required: false
                    },
                    file_type: {
                        type: 'string',
                        description: 'Filter by file type (e.g., "js", "ts", "py")',
                        required: false
                    }
                }
            },
            {
                name: 'list_directory',
                description: 'List contents of a directory.',
                parameters: {
                    path: {
                        type: 'string',
                        description: 'Directory path to list',
                        required: true
                    },
                    recursive: {
                        type: 'boolean',
                        description: 'Whether to list recursively',
                        required: false
                    }
                }
            },
            {
                name: 'attempt_completion',
                description: 'Mark the task as complete with a summary of what was done.',
                parameters: {
                    result: {
                        type: 'string',
                        description: 'Summary of what was accomplished',
                        required: true
                    },
                    command: {
                        type: 'string',
                        description: 'Optional command for the user to run',
                        required: false
                    }
                }
            }
        ];
    }

    /**
     * Execute a tool
     */
    async executeTool(toolName: string, input: any, mode: ToolMode = this.currentMode): Promise<ToolResult> {
        const startTime = Date.now();
        const execution: ToolExecution = {
            toolName,
            mode,
            input,
            timestamp: new Date()
        };

        try {
            logDebug(
                `🔧 Executing tool: ${toolName}`,
                this.context.userId,
                this.context.sessionId,
                'agent',
                { input }
            );

            let result: ToolResult;

            switch (toolName) {
                case 'read_file':
                    result = await this.readFile(input.file_path);
                    break;
                case 'write_file':
                    result = await this.writeFile(input.file_path, input.content);
                    break;
                case 'edit_file':
                    result = await this.editFile(
                        input.file_path,
                        input.old_string,
                        input.new_string,
                        input.replace_all
                    );
                    break;
                case 'grep_search':
                    result = await this.grepSearch(input.pattern, input.path, input.file_type);
                    break;
                case 'list_directory':
                    result = await this.listDirectory(input.path, input.recursive);
                    break;
                case 'attempt_completion':
                    result = await this.attemptCompletion(input.result, input.command);
                    break;
                default:
                    throw new Error(`Unknown tool: ${toolName}`);
            }

            const duration = Date.now() - startTime;
            execution.result = result;
            execution.duration = duration;

            this.executionHistory.push(execution);

            logInfo(
                `✅ Tool executed: ${toolName} (${duration}ms)`,
                this.context.userId,
                this.context.sessionId,
                'agent'
            );

            return {
                ...result,
                metadata: {
                    toolName,
                    duration,
                    timestamp: new Date()
                }
            };
        } catch (error: any) {
            const duration = Date.now() - startTime;
            execution.result = {
                success: false,
                error: error.message
            };
            execution.duration = duration;

            this.executionHistory.push(execution);

            logger.error(`❌ Tool execution error (${toolName}):`, error);

            return {
                success: false,
                error: error.message,
                metadata: {
                    toolName,
                    duration,
                    timestamp: new Date()
                }
            };
        }
    }

    /**
     * Read file from workspace files cache
     */
    private async readFile(filePath: string): Promise<ToolResult> {
        if (!this.context.workspaceFiles) {
            return {
                success: false,
                error: 'Workspace files not available. Request files from extension.'
            };
        }

        const content = this.context.workspaceFiles.get(filePath);
        if (!content) {
            return {
                success: false,
                error: `File not found: ${filePath}. Available files: ${Array.from(this.context.workspaceFiles.keys()).join(', ')}`
            };
        }

        // Add line numbers like in VSCode extension
        const lines = content.split('\n');
        const numbered = lines.map((line, idx) => `${(idx + 1).toString().padStart(6)}|${line}`).join('\n');

        return {
            success: true,
            output: numbered,
            data: { content, filePath }
        };
    }

    /**
     * Write file (create new file)
     */
    private async writeFile(filePath: string, content: string): Promise<ToolResult> {
        // Record the file change to be applied by extension
        this.fileChanges.push({
            type: 'create',
            path: filePath,
            content
        });

        // Cache the file content
        if (!this.context.workspaceFiles) {
            this.context.workspaceFiles = new Map();
        }
        this.context.workspaceFiles.set(filePath, content);

        return {
            success: true,
            output: `File created: ${filePath} (${content.length} characters)`,
            data: { filePath, content, type: 'create' }
        };
    }

    /**
     * Edit file (search and replace)
     */
    private async editFile(
        filePath: string,
        oldString: string,
        newString: string,
        replaceAll: boolean = false
    ): Promise<ToolResult> {
        if (!this.context.workspaceFiles) {
            return {
                success: false,
                error: 'Workspace files not available'
            };
        }

        const oldContent = this.context.workspaceFiles.get(filePath);
        if (!oldContent) {
            return {
                success: false,
                error: `File not found: ${filePath}`
            };
        }

        // Perform replacement
        let newContent: string;
        let replacements = 0;

        if (replaceAll) {
            const regex = new RegExp(oldString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            newContent = oldContent.replace(regex, () => {
                replacements++;
                return newString;
            });
        } else {
            // Replace only first occurrence
            const index = oldContent.indexOf(oldString);
            if (index === -1) {
                return {
                    success: false,
                    error: `String not found: "${oldString.substring(0, 50)}..."`
                };
            }

            // Check for multiple occurrences
            const secondIndex = oldContent.indexOf(oldString, index + 1);
            if (secondIndex !== -1 && !replaceAll) {
                return {
                    success: false,
                    error: `Multiple occurrences found. String must be unique or use replace_all: true`
                };
            }

            newContent = oldContent.substring(0, index) + newString + oldContent.substring(index + oldString.length);
            replacements = 1;
        }

        if (replacements === 0) {
            return {
                success: false,
                error: `No replacements made`
            };
        }

        // Record the file change
        this.fileChanges.push({
            type: 'modify',
            path: filePath,
            content: newContent,
            oldContent
        });

        // Update cache
        this.context.workspaceFiles.set(filePath, newContent);

        return {
            success: true,
            output: `File edited: ${filePath} (${replacements} replacement${replacements > 1 ? 's' : ''})`,
            data: { filePath, oldContent, newContent, replacements, type: 'modify' }
        };
    }

    /**
     * Grep search (search in workspace files)
     */
    private async grepSearch(pattern: string, path?: string, fileType?: string): Promise<ToolResult> {
        if (!this.context.workspaceFiles) {
            return {
                success: false,
                error: 'Workspace files not available'
            };
        }

        try {
            const regex = new RegExp(pattern, 'gi');
            const results: Array<{ file: string; line: number; content: string }> = [];

            for (const [filePath, content] of this.context.workspaceFiles.entries()) {
                // Filter by path if specified
                if (path && !filePath.startsWith(path)) {
                    continue;
                }

                // Filter by file type if specified
                if (fileType && !filePath.endsWith(`.${fileType}`)) {
                    continue;
                }

                const lines = content.split('\n');
                lines.forEach((line, index) => {
                    if (regex.test(line)) {
                        results.push({
                            file: filePath,
                            line: index + 1,
                            content: line.trim()
                        });
                    }
                });
            }

            const output = results.length > 0
                ? results.map(r => `${r.file}:${r.line}: ${r.content}`).join('\n')
                : 'No matches found';

            return {
                success: true,
                output,
                data: { results, count: results.length }
            };
        } catch (error: any) {
            return {
                success: false,
                error: `Invalid regex pattern: ${error.message}`
            };
        }
    }

    /**
     * List directory (list files in workspace)
     */
    private async listDirectory(path: string, recursive: boolean = false): Promise<ToolResult> {
        if (!this.context.workspaceFiles) {
            return {
                success: false,
                error: 'Workspace files not available'
            };
        }

        const files: string[] = [];
        const normalizedPath = path.endsWith('/') ? path : `${path}/`;

        for (const filePath of this.context.workspaceFiles.keys()) {
            if (filePath.startsWith(normalizedPath)) {
                const relativePath = filePath.substring(normalizedPath.length);
                
                if (!recursive && relativePath.includes('/')) {
                    continue; // Skip nested files in non-recursive mode
                }

                files.push(relativePath);
            }
        }

        files.sort();

        return {
            success: true,
            output: files.length > 0 ? files.join('\n') : 'No files found',
            data: { files, count: files.length, path }
        };
    }

    /**
     * Attempt completion (mark task as done)
     */
    private async attemptCompletion(result: string, command?: string): Promise<ToolResult> {
        const output = [
            '✅ Task completed successfully!',
            '',
            'Summary:',
            result
        ];

        if (command) {
            output.push('', 'Suggested command:', `  ${command}`);
        }

        if (this.fileChanges.length > 0) {
            output.push('', 'Files modified:');
            const grouped = this.groupFileChangesByType();
            if (grouped.create.length > 0) {
                output.push(`  Created: ${grouped.create.join(', ')}`);
            }
            if (grouped.modify.length > 0) {
                output.push(`  Modified: ${grouped.modify.join(', ')}`);
            }
            if (grouped.delete.length > 0) {
                output.push(`  Deleted: ${grouped.delete.join(', ')}`);
            }
        }

        return {
            success: true,
            output: output.join('\n'),
            data: {
                result,
                command,
                fileChanges: this.fileChanges,
                completed: true
            }
        };
    }

    /**
     * Get all file changes made during session
     */
    getFileChanges(): FileChange[] {
        return this.fileChanges;
    }

    /**
     * Get execution history
     */
    getExecutionHistory(): ToolExecution[] {
        return this.executionHistory;
    }

    /**
     * Clear file changes
     */
    clearFileChanges(): void {
        this.fileChanges = [];
    }

    /**
     * Group file changes by type
     */
    private groupFileChangesByType(): { create: string[]; modify: string[]; delete: string[] } {
        const result = { create: [] as string[], modify: [] as string[], delete: [] as string[] };

        for (const change of this.fileChanges) {
            result[change.type].push(change.path);
        }

        return result;
    }

    /**
     * Update workspace files cache
     */
    updateWorkspaceFiles(files: Map<string, string>): void {
        this.context.workspaceFiles = files;
    }
}

export default ToolManager;

