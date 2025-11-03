import { IStrictTool, ToolExecutionContext } from './types';
import { StrictReadTool } from './strictReadTool';
import { StrictWriteTool } from './strictWriteTool';
import { StrictListTool } from './strictListTool';

export class StrictToolManager {
  private tools: Map<string, IStrictTool> = new Map();
  private context: ToolExecutionContext;

  constructor(context: ToolExecutionContext) {
    this.context = context;
    this.registerTools();
  }

  private registerTools(): void {
    const readTool = new StrictReadTool(this.context);
    const writeTool = new StrictWriteTool(this.context);
    const listTool = new StrictListTool(this.context);
    
    this.tools.set(readTool.name, readTool);
    this.tools.set(writeTool.name, writeTool);
    this.tools.set(listTool.name, listTool);
    
    // TODO: Add remaining tools
    // this.tools.set('grep_search', new StrictGrepTool(this.context));
    // this.tools.set('bash_command', new StrictBashTool(this.context));
    // etc.
  }

  async executeTool(toolName: string, params: any): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}. Available tools: ${Array.from(this.tools.keys()).join(', ')}`);
    }

    try {
      return await tool.execute(params);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Tool ${toolName} execution failed: ${errorMessage}`);
    }
  }

  getAvailableTools(): string[] {
    return Array.from(this.tools.keys());
  }

  validateToolCall(toolName: string, params: any): void {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }
    
    tool.validate(params);
  }

  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  // Get tool definitions for the LLM parser (backward compatibility)
  getToolDefinitions(): Array<{ name: string }> {
    return Array.from(this.tools.keys()).map(name => ({ name }));
  }
}
