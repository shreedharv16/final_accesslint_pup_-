import * as fs from 'fs';
import * as path from 'path';
import { IStrictTool, ToolExecutionContext } from './types';

export class StrictListTool implements IStrictTool {
  readonly name = 'list_directory';
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

    if (params.recursive !== undefined && typeof params.recursive !== 'boolean') {
      throw new Error('Parameter recursive must be a boolean');
    }
  }

  async execute(params: { path: string; recursive?: boolean }): Promise<any> {
    this.validate(params);

    const { path: dirPath, recursive = false } = params;

    // Resolve relative path to absolute
    const absolutePath = path.isAbsolute(dirPath)
      ? dirPath
      : path.join(this.context.workspaceRoot, dirPath);

    // Check if directory exists
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Directory not found: ${dirPath}`);
    }

    // Check if it's a directory
    const stats = fs.statSync(absolutePath);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${dirPath}`);
    }

    // List directory contents
    const files = recursive 
      ? this.listRecursively(absolutePath, dirPath)
      : this.listDirectory(absolutePath, dirPath);

    return {
      path: dirPath,
      files: files,
      totalCount: files.length,
      recursive: recursive
    };
  }

  private listDirectory(absolutePath: string, relativePath: string): Array<any> {
    const entries = fs.readdirSync(absolutePath, { withFileTypes: true });
    
    return entries
      .filter(entry => !entry.name.startsWith('.')) // Filter hidden files
      .map(entry => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: path.join(relativePath, entry.name).replace(/\\/g, '/')
      }));
  }

  private listRecursively(absolutePath: string, relativePath: string): Array<any> {
    const results: Array<any> = [];
    
    const processDirectory = (currentAbsolute: string, currentRelative: string) => {
      const entries = fs.readdirSync(currentAbsolute, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue; // Skip hidden files
        
        const entryPath = path.join(currentRelative, entry.name).replace(/\\/g, '/');
        const entryAbsolute = path.join(currentAbsolute, entry.name);
        
        results.push({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          path: entryPath
        });
        
        if (entry.isDirectory()) {
          processDirectory(entryAbsolute, entryPath);
        }
      }
    };
    
    processDirectory(absolutePath, relativePath);
    return results;
  }
}
