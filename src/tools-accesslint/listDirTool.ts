import * as vscode from 'vscode';
import * as path from 'path';
import { ToolDefinition, ToolResult, ToolExecutionContext } from './types';

export interface ListDirResult {
  success: boolean;
  entries?: Array<{
    name: string;
    type: 'file' | 'directory';
    path: string;
    size?: number;
    extension?: string;
  }>;
  error?: string;
  totalFiles?: number;
  totalDirectories?: number;
}

export class ListDirTool {
  private context: ToolExecutionContext;

  constructor(context: ToolExecutionContext) {
    this.context = context;
  }

  static getDefinition(cwd: string): ToolDefinition {
    return {
      name: "list_directory",
      descriptionForAgent: `List the contents of a directory. Use this to explore the repository structure, understand the codebase layout, or find specific files and folders. This tool provides detailed information about each entry including type (file/directory), size, and file extensions. Perfect for understanding project organization before making changes.

Working directory: ${cwd}

Examples:
- list_directory with path "." - list current workspace root
- list_directory with path "src" - list contents of src folder  
- list_directory with path "src/components" - list specific subfolder
- list_directory with recursive true - get full tree structure`,
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Directory path to list (relative to workspace root, or absolute). Use '.' for current workspace root.",
          },
          recursive: {
            type: "boolean",
            description: "Whether to recursively list subdirectories (default: false). Use with caution on large directories.",
          },
          include_hidden: {
            type: "boolean", 
            description: "Whether to include hidden files and directories (starting with .) (default: false)",
          },
          max_depth: {
            type: "number",
            description: "Maximum recursion depth when recursive is true (default: 3, max: 10)",
          },
          file_extensions: {
            type: "array",
            description: "Filter results to only include files with these extensions (e.g., ['.ts', '.js', '.json'])",
            items: {
              type: "string"
            }
          }
        },
        required: ["path"],
      },
    };
  }

  async execute(input: { 
    path: string; 
    recursive?: boolean;
    include_hidden?: boolean;
    max_depth?: number;
    file_extensions?: string[];
  }): Promise<ListDirResult> {
    try {
      const { path: dirPath, recursive = false, include_hidden = false, max_depth = 3, file_extensions } = input;
      
      // Resolve path relative to workspace root
      const fullPath = path.isAbsolute(dirPath) 
        ? dirPath 
        : path.resolve(this.context.workspaceRoot, dirPath);

      // Validate path is within workspace for security
      if (!fullPath.startsWith(this.context.workspaceRoot)) {
        return {
          success: false,
          error: 'Path must be within the workspace directory'
        };
      }

      // Check if directory exists
      try {
        const stat = await vscode.workspace.fs.stat(vscode.Uri.file(fullPath));
        if (stat.type !== vscode.FileType.Directory) {
          return {
            success: false,
            error: `Path "${dirPath}" is not a directory`
          };
        }
      } catch (error) {
        return {
          success: false,
          error: `Directory "${dirPath}" does not exist or cannot be accessed`
        };
      }

      let entries: Array<{
        name: string;
        type: 'file' | 'directory';
        path: string;
        size?: number;
        extension?: string;
      }> = [];

      if (recursive) {
        entries = await this.listRecursive(fullPath, Math.min(max_depth, 10), include_hidden, file_extensions);
      } else {
        entries = await this.listDirectory(fullPath, include_hidden, file_extensions);
      }

      const totalFiles = entries.filter(e => e.type === 'file').length;
      const totalDirectories = entries.filter(e => e.type === 'directory').length;

      return {
        success: true,
        entries,
        totalFiles,
        totalDirectories
      };

    } catch (error) {
      return {
        success: false,
        error: `Error listing directory: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async listDirectory(
    dirPath: string, 
    includeHidden: boolean, 
    fileExtensions?: string[]
  ): Promise<Array<{
    name: string;
    type: 'file' | 'directory';
    path: string;
    size?: number;
    extension?: string;
  }>> {
    const entries: Array<{
      name: string;
      type: 'file' | 'directory';
      path: string;
      size?: number;
      extension?: string;
    }> = [];

    try {
      const dirUri = vscode.Uri.file(dirPath);
      const dirContents = await vscode.workspace.fs.readDirectory(dirUri);

      for (const [name, type] of dirContents) {
        // Skip hidden files if not requested
        if (!includeHidden && name.startsWith('.')) {
          continue;
        }

        const entryPath = path.join(dirPath, name);
        const relativePath = path.relative(this.context.workspaceRoot, entryPath);
        const isFile = type === vscode.FileType.File;
        const isDir = type === vscode.FileType.Directory;

        // For files, check extension filter
        if (isFile && fileExtensions && fileExtensions.length > 0) {
          const extension = path.extname(name);
          if (!fileExtensions.includes(extension)) {
            continue;
          }
        }

        const entry: any = {
          name,
          type: isFile ? 'file' : 'directory',
          path: relativePath
        };

        // Get file size for files
        if (isFile) {
          try {
            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(entryPath));
            entry.size = stat.size;
            entry.extension = path.extname(name);
          } catch (error) {
            // Size not critical, continue without it
          }
        }

        entries.push(entry);
      }

      // Sort: directories first, then files, both alphabetically
      entries.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

    } catch (error) {
      throw new Error(`Failed to read directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return entries;
  }

  private async listRecursive(
    dirPath: string, 
    maxDepth: number, 
    includeHidden: boolean,
    fileExtensions?: string[],
    currentDepth: number = 0
  ): Promise<Array<{
    name: string;
    type: 'file' | 'directory';
    path: string;
    size?: number;
    extension?: string;
  }>> {
    if (currentDepth >= maxDepth) {
      return [];
    }

    const entries: Array<{
      name: string;
      type: 'file' | 'directory';
      path: string;
      size?: number;
      extension?: string;
    }> = [];

    try {
      const currentEntries = await this.listDirectory(dirPath, includeHidden, fileExtensions);
      entries.push(...currentEntries);

      // Recursively process directories
      for (const entry of currentEntries) {
        if (entry.type === 'directory') {
          const fullSubPath = path.resolve(this.context.workspaceRoot, entry.path);
          const subEntries = await this.listRecursive(
            fullSubPath, 
            maxDepth, 
            includeHidden, 
            fileExtensions, 
            currentDepth + 1
          );
          entries.push(...subEntries);
        }
      }

    } catch (error) {
      // Log error but don't fail the entire operation
      if (this.context.outputChannel) {
        this.context.outputChannel.appendLine(`Warning: Could not read directory ${dirPath}: ${error}`);
      }
    }

    return entries;
  }

  // Execute with logging
  async executeWithLogging(input: { 
    path: string; 
    recursive?: boolean;
    include_hidden?: boolean;
    max_depth?: number;
    file_extensions?: string[];
  }): Promise<ListDirResult> {
    const result = await this.execute(input);
    this.logExecution(input, result);
    return result;
  }

  private logExecution(input: any, result: ListDirResult): void {
    if (this.context.webviewProvider) {
      this.context.webviewProvider.postMessage({
        type: 'toolExecution',
        tool: 'list_directory',
        input: input,
        result: {
          ...result,
          // Truncate entries for logging if too many
          entries: result.entries && result.entries.length > 50 
            ? result.entries.slice(0, 50).concat([{ name: '... (truncated)', type: 'file' as const, path: '...' }])
            : result.entries
        },
        timestamp: new Date()
      });
    }

    if (this.context.outputChannel) {
      const status = result.success ? 'SUCCESS' : 'ERROR';
      this.context.outputChannel.appendLine(
        `[LIST_DIR ${status}] ${input.path} - Found ${result.totalFiles || 0} files, ${result.totalDirectories || 0} directories`
      );
      
      if (result.error) {
        this.context.outputChannel.appendLine(`ERROR: ${result.error}`);
      }
    }
  }

  // Get project structure summary (useful for LLMs to understand codebase)
  async getProjectStructure(): Promise<{
    success: boolean;
    structure?: string;
    fileTypes?: { [extension: string]: number };
    error?: string;
  }> {
    try {
      const result = await this.execute({
        path: '.',
        recursive: true,
        include_hidden: false,
        max_depth: 4,
      });

      if (!result.success || !result.entries) {
        return { success: false, error: result.error };
      }

      // Generate tree structure string
      const structure = this.generateTreeStructure(result.entries);

      // Count file types
      const fileTypes: { [extension: string]: number } = {};
      result.entries.forEach(entry => {
        if (entry.type === 'file' && entry.extension) {
          fileTypes[entry.extension] = (fileTypes[entry.extension] || 0) + 1;
        }
      });

      return {
        success: true,
        structure,
        fileTypes
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private generateTreeStructure(entries: Array<{
    name: string;
    type: 'file' | 'directory';
    path: string;
  }>): string {
    const tree = new Map<string, any>();
    
    // Build tree structure
    entries.forEach(entry => {
      const parts = entry.path.split(path.sep);
      let current = tree;
      
      parts.forEach((part, index) => {
        if (!current.has(part)) {
          current.set(part, index === parts.length - 1 ? entry.type : new Map());
        }
        if (index < parts.length - 1) {
          current = current.get(part);
        }
      });
    });
    
    // Convert to string representation
    return this.mapToTreeString(tree, 0);
  }

  private mapToTreeString(map: Map<string, any>, depth: number): string {
    const indent = '  '.repeat(depth);
    let result = '';
    
    const entries = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    
    entries.forEach(([name, value]) => {
      if (typeof value === 'string') {
        // It's a file or directory marker
        const icon = value === 'directory' ? '📁' : '📄';
        result += `${indent}${icon} ${name}\n`;
      } else if (value instanceof Map) {
        // It's a directory with contents
        result += `${indent}📁 ${name}/\n`;
        result += this.mapToTreeString(value, depth + 1);
      }
    });
    
    return result;
  }
}
