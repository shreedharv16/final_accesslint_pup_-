import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ToolDefinition, ToolResult, ToolExecutionContext, GrepResult } from './types';

export class GrepTool {
  private context: ToolExecutionContext;

  constructor(context: ToolExecutionContext) {
    this.context = context;
  }

  static getDefinition(cwd: string): ToolDefinition {
    return {
      name: "grep_search",
      descriptionForAgent: `Fast content search tool that works with any codebase size
- Searches file contents using regular expressions
- Supports full regex syntax (eg. "log.*Error", "function\\\\s+\\\\w+", etc.)
- Filter files by pattern with the include parameter (eg. "*.js", "*.{ts,tsx}")
- Returns file paths with line numbers and matching content
- Use this tool when you need to find files containing specific patterns`,
      inputSchema: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "The regular expression pattern to search for in file contents",
          },
          path: {
            type: "string",
            description: `The directory to search in (relative to ${cwd}). Use '.' for current directory`,
          },
          include: {
            type: "string",
            description: "File pattern to filter which files to search (e.g., '*.js' for JavaScript files, '*.{ts,tsx}' for TypeScript)",
          },
          exclude: {
            type: "string",
            description: "File pattern to exclude from search (e.g., 'node_modules', '*.log')",
          },
          max_results: {
            type: "number",
            description: "Maximum number of matches to return (default: 100)",
          },
        },
        required: ["pattern", "path"],
      },
    };
  }

  async execute(input: { 
    pattern: string; 
    path: string; 
    include?: string; 
    exclude?: string; 
    max_results?: number 
  }): Promise<GrepResult> {
    try {
      const { pattern, path: searchPath, include, exclude, max_results = 100 } = input;
      
      // Resolve search path
      const absoluteSearchPath = path.isAbsolute(searchPath) 
        ? searchPath 
        : path.join(this.context.workspaceRoot, searchPath);

      if (!fs.existsSync(absoluteSearchPath)) {
        return {
          success: false,
          error: `Search path not found: ${searchPath}`,
          matches: [],
          totalMatches: 0
        };
      }

      // Create regex pattern
      let regex: RegExp;
      try {
        regex = new RegExp(pattern, 'gi'); // case-insensitive, global
      } catch (error) {
        return {
          success: false,
          error: `Invalid regex pattern: ${error instanceof Error ? error.message : 'Unknown error'}`,
          matches: [],
          totalMatches: 0
        };
      }

      const matches: Array<{ file: string; line: number; content: string }> = [];
      const excludePatterns = exclude ? this.parseFilePattern(exclude) : [];
      const includePatterns = include ? this.parseFilePattern(include) : [];

      // Search files recursively
      await this.searchDirectory(absoluteSearchPath, regex, matches, includePatterns, excludePatterns, max_results);

      return {
        success: true,
        matches: matches,
        totalMatches: matches.length
      };

    } catch (error) {
      return {
        success: false,
        error: `Error during search: ${error instanceof Error ? error.message : 'Unknown error'}`,
        matches: [],
        totalMatches: 0
      };
    }
  }

  private async searchDirectory(
    dirPath: string, 
    regex: RegExp, 
    matches: Array<{ file: string; line: number; content: string }>,
    includePatterns: string[],
    excludePatterns: string[],
    maxResults: number
  ): Promise<void> {
    if (matches.length >= maxResults) return;

    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      if (matches.length >= maxResults) break;

      const itemPath = path.join(dirPath, item);
      const relativePath = path.relative(this.context.workspaceRoot, itemPath);

      // Check if excluded
      if (this.matchesPatterns(relativePath, excludePatterns)) {
        continue;
      }

      const stats = fs.statSync(itemPath);

      if (stats.isDirectory()) {
        // Skip common directories that should be excluded
        if (this.shouldSkipDirectory(item)) {
          continue;
        }
        await this.searchDirectory(itemPath, regex, matches, includePatterns, excludePatterns, maxResults);
      } else if (stats.isFile()) {
        // Check if included
        if (includePatterns.length > 0 && !this.matchesPatterns(relativePath, includePatterns)) {
          continue;
        }

        // Skip binary files
        if (this.isBinaryFile(itemPath)) {
          continue;
        }

        try {
          await this.searchFile(itemPath, regex, matches, maxResults);
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }
    }
  }

  private async searchFile(
    filePath: string, 
    regex: RegExp, 
    matches: Array<{ file: string; line: number; content: string }>,
    maxResults: number
  ): Promise<void> {
    if (matches.length >= maxResults) return;

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const relativePath = path.relative(this.context.workspaceRoot, filePath);

    for (let i = 0; i < lines.length && matches.length < maxResults; i++) {
      const line = lines[i];
      if (regex.test(line)) {
        matches.push({
          file: relativePath,
          line: i + 1,
          content: line.trim()
        });
      }
    }
  }

  private parseFilePattern(pattern: string): string[] {
    return pattern.split(',').map(p => p.trim());
  }

  private matchesPatterns(filePath: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      // Convert glob pattern to regex
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      
      const regex = new RegExp(regexPattern, 'i');
      return regex.test(filePath);
    });
  }

  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = [
      'node_modules', '.git', '.vscode', 'dist', 'build', 'out', 
      '.next', '.nuxt', 'coverage', '.nyc_output', '.cache',
      'bower_components', 'vendor'
    ];
    return skipDirs.includes(dirName) || dirName.startsWith('.');
  }

  private isBinaryFile(filePath: string): boolean {
    const binaryExtensions = [
      '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.o',
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.svg',
      '.mp3', '.mp4', '.avi', '.mov', '.wav', '.flac',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.zip', '.tar', '.gz', '.7z', '.rar',
      '.woff', '.woff2', '.ttf', '.eot'
    ];

    const ext = path.extname(filePath).toLowerCase();
    return binaryExtensions.includes(ext);
  }

  // Log tool execution for visibility
  private logExecution(input: any, result: GrepResult): void {
    if (this.context.webviewProvider) {
      this.context.webviewProvider.postMessage({
        type: 'toolExecution',
        tool: 'grep_search',
        input: input,
        result: { 
          ...result, 
          matches: result.matches?.slice(0, 10) // Only show first 10 matches in log
        },
        timestamp: new Date()
      });
    }

    if (this.context.outputChannel) {
      const status = result.success ? 'SUCCESS' : 'ERROR';
      const summary = result.success ? `Found ${result.totalMatches} matches` : result.error;
      this.context.outputChannel.appendLine(
        `[GREP_TOOL ${status}] Pattern: "${input.pattern}" - ${summary}`
      );
    }
  }

  async executeWithLogging(input: { 
    pattern: string; 
    path: string; 
    include?: string; 
    exclude?: string; 
    max_results?: number 
  }): Promise<GrepResult> {
    const result = await this.execute(input);
    this.logExecution(input, result);
    return result;
  }
}
