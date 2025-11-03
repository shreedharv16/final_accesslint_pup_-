import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ToolDefinition, ToolResult, ToolExecutionContext, FileOperationResult } from './types';

const DEFAULT_LINE_LIMIT = 2000;
const MAX_LINE_LENGTH = 2000;

export class ReadTool {
  private context: ToolExecutionContext;

  constructor(context: ToolExecutionContext) {
    this.context = context;
  }

  static getDefinition(cwd: string): ToolDefinition {
    return {
      name: "read_file",
      descriptionForAgent: `Request to read the contents of a file at the specified path. Use this when you need to examine the contents of an existing file you do not know the contents of, for example to analyze code, review text files, or extract information from configuration files. By default, reads the entire file. Large files are auto-truncated to first 2000 lines with clear indication. Use limit/offset only when you specifically need to read a particular section of a large file.`,
      inputSchema: {
        type: "object",
        properties: {
          file_path: {
            type: "string",
            description: `The path of the file to read (relative to the current working directory ${cwd})`,
          },
          limit: {
            type: "number",
            description: "Maximum number of lines to read (optional). Only use when you need to limit output size for very large files. Omit to read entire file.",
          },
          offset: {
            type: "number",
            description: "Starting line number (1-based) for reading (optional). Only use when you need to read a specific section. Omit to start from beginning.",
          },
        },
        required: ["file_path"],
      },
    };
  }

  async execute(input: { file_path: string; limit?: number; offset?: number }): Promise<FileOperationResult> {
    try {
      const { file_path, limit, offset } = input;

      // Resolve relative path to absolute
      const absolutePath = path.isAbsolute(file_path)
        ? file_path
        : path.join(this.context.workspaceRoot, file_path);

      // Check if file exists
      if (!fs.existsSync(absolutePath)) {
        return {
          success: false,
          error: `File not found: ${file_path}`,
          filePath: file_path
        };
      }

      // Check if it's a file (not directory)
      const stats = fs.statSync(absolutePath);
      if (!stats.isFile()) {
        return {
          success: false,
          error: `Path is not a file: ${file_path}`,
          filePath: file_path
        };
      }

      // Read file content
      const content = fs.readFileSync(absolutePath, 'utf8');
      const lines = content.split('\n');
      const totalLines = lines.length;

      // Detect if LLM is using default small values that would limit full file reading
      // If limit is small (≤ 200) and offset is 1, and file is larger, read full file instead
      const isUsingSmallDefaults = limit && limit <= 200 && (!offset || offset === 1) && totalLines > limit;

      // Handle offset and limit parameters for incremental reading
      let effectiveLimit = limit;
      let effectiveOffset = offset;

      if (isUsingSmallDefaults) {
        // Override small defaults to read entire file
        this.context.outputChannel?.appendLine(`🔄 Detected small limit (${limit}) with offset (${offset || 1}), reading entire file instead`);
        effectiveLimit = undefined;
        effectiveOffset = undefined;
      }

      const startLine = effectiveOffset ? Math.max(0, effectiveOffset - 1) : 0; // Convert to 0-based index
      const endLine = effectiveLimit ? Math.min(totalLines, startLine + effectiveLimit) : totalLines;
      
      let resultLines: string[];
      let metadata = '';
      
      if (effectiveOffset || effectiveLimit) {
        // Incremental reading requested
        resultLines = lines.slice(startLine, endLine);
        metadata = `\n\n[Showing lines ${startLine + 1}-${endLine} of ${totalLines} total lines]`;
        if (isUsingSmallDefaults) {
          metadata += ` (Note: Small limit was overridden to read entire file)`;
        }
      } else if (totalLines > DEFAULT_LINE_LIMIT) {
        // Auto-truncation for large files
        resultLines = lines.slice(0, DEFAULT_LINE_LIMIT);
        metadata = `\n\n[TRUNCATED: Showing first ${DEFAULT_LINE_LIMIT} lines of ${totalLines} total lines. Use limit/offset parameters to read specific sections.]`;
      } else {
        // Normal reading
        resultLines = lines;
      }

      // Apply line length limits with clear indication
      const processedLines = resultLines.map((line, index) => {
        const lineNumber = startLine + index + 1;
        if (line.length > MAX_LINE_LENGTH) {
          return `${lineNumber.toString().padStart(6)}|${line.substring(0, MAX_LINE_LENGTH)}[...truncated]`;
        }
        return `${lineNumber.toString().padStart(6)}|${line}`;
      });

      const finalContent = processedLines.join('\n') + metadata;

      return {
        success: true,
        content: finalContent,
        filePath: file_path,
        metadata: {
          totalLines,
          linesShown: processedLines.length,
          startLine: startLine + 1,
          endLine,
          isTruncated: totalLines > DEFAULT_LINE_LIMIT && !effectiveLimit,
          hasMoreContent: endLine < totalLines,
          limitOverridden: !!isUsingSmallDefaults
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath: input.file_path
      };
    }
  }

  // Log tool execution for visibility
  private logExecution(input: any, result: FileOperationResult): void {
    if (this.context.webviewProvider) {
      this.context.webviewProvider.postMessage({
        type: 'toolExecution',
        tool: 'read_file',
        input: input,
        result: result,
        timestamp: new Date()
      });
    }

    if (this.context.outputChannel) {
      const status = result.success ? 'SUCCESS' : 'ERROR';
      this.context.outputChannel.appendLine(
        `[READ_TOOL ${status}] ${input.file_path} - ${result.success ? 'Read successfully' : result.error}`
      );
    }
  }

  async executeWithLogging(input: { file_path: string }): Promise<FileOperationResult> {
    const result = await this.execute(input);
    this.logExecution(input, result);
    return result;
  }
}
