import * as fs from 'fs';
import * as path from 'path';
import { IStrictTool, ToolExecutionContext } from './types';

export class StrictReadTool implements IStrictTool {
  readonly name = 'read_file';
  private context: ToolExecutionContext;

  constructor(context: ToolExecutionContext) {
    this.context = context;
  }

  validate(params: any): void {
    if (!params || typeof params !== 'object') {
      throw new Error('Parameters must be an object');
    }

    if (!params.path || typeof params.path !== 'string') {
      throw new Error('Missing required parameter: path (string)');
    }

    if (params.limit !== undefined && (typeof params.limit !== 'number' || params.limit <= 0)) {
      throw new Error('Parameter limit must be a positive number');
    }

    if (params.offset !== undefined && (typeof params.offset !== 'number' || params.offset <= 0)) {
      throw new Error('Parameter offset must be a positive number');
    }
  }

  async execute(params: { path: string; limit?: number; offset?: number }): Promise<any> {
    this.validate(params);

    const { path: filePath, limit, offset } = params;

    // Resolve relative path to absolute
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.context.workspaceRoot, filePath);

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Check if it's a file (not directory)
    const stats = fs.statSync(absolutePath);
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`);
    }

    // Read file content
    const content = fs.readFileSync(absolutePath, 'utf8');
    const lines = content.split('\n');
    
    // Apply offset and limit
    const startLine = (offset || 1) - 1; // Convert to 0-based index
    const endLine = limit ? startLine + limit : lines.length;
    
    const selectedLines = lines.slice(startLine, endLine);
    const resultContent = selectedLines.join('\n');

    return {
      content: resultContent,
      path: filePath,
      totalLines: lines.length,
      linesShown: selectedLines.length,
      startLine: startLine + 1,
      endLine: Math.min(endLine, lines.length),
      isTruncated: endLine < lines.length
    };
  }
}
