import * as fs from 'fs';
import * as path from 'path';
import { IStrictTool, ToolExecutionContext } from './types';

export class StrictWriteTool implements IStrictTool {
  readonly name = 'write_file';
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

    if (!params.content || typeof params.content !== 'string') {
      throw new Error('Missing required parameter: content (string)');
    }
  }

  async execute(params: { path: string; content: string }): Promise<any> {
    this.validate(params);

    const { path: filePath, content } = params;

    // Resolve relative path to absolute
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.context.workspaceRoot, filePath);

    // Create directory if it doesn't exist
    const directory = path.dirname(absolutePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    // Write file content
    fs.writeFileSync(absolutePath, content, 'utf8');

    return {
      success: true,
      path: filePath,
      bytesWritten: Buffer.byteLength(content, 'utf8'),
      message: `Successfully wrote ${Buffer.byteLength(content, 'utf8')} bytes to ${filePath}`
    };
  }
}
