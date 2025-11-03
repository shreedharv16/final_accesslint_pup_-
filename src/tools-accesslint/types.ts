export interface ToolDefinition {
  name: string;
  descriptionForAgent: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
}

// Cline-style strict tool interface
export interface IStrictTool {
  readonly name: string;
  execute(params: any): Promise<any>;
  validate(params: any): void; // schema check - throws if invalid
}

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ToolExecutionContext {
  workspaceRoot: string;
  outputChannel: any; // VS Code OutputChannel
  webviewProvider?: any; // For logging to chat
  extensionContext?: any; // VS Code ExtensionContext
}

export interface FileOperationResult {
  success: boolean;
  content?: string;
  error?: string;
  filePath?: string;
  metadata?: {
    totalLines?: number;
    linesShown?: number;
    startLine?: number;
    endLine?: number;
    isTruncated?: boolean;
    hasMoreContent?: boolean;
    limitOverridden?: boolean;
  };
}

export interface BashCommandResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  command?: string;
}

export interface GrepResult {
  success: boolean;
  matches?: Array<{
    file: string;
    line: number;
    content: string;
  }>;
  error?: string;
  totalMatches?: number;
}

export interface EditOperation {
  old_string: string;
  new_string: string;
}

export interface MultiEditResult {
  success: boolean;
  editsApplied?: number;
  error?: string;
  filePath?: string;
}

// Tool execution modes
export type ToolMode = 'quick' | 'agent';

export interface ToolExecution {
  toolName: string;
  mode: ToolMode;
  input: any;
  timestamp: Date;
  result?: ToolResult;
  duration?: number;
}
