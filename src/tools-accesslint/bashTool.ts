import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { ToolDefinition, ToolResult, ToolExecutionContext, BashCommandResult } from './types';

export class BashTool {
  private context: ToolExecutionContext;

  constructor(context: ToolExecutionContext) {
    this.context = context;
  }

  static getDefinition(cwd: string): ToolDefinition {
    return {
      name: "bash_command",
      descriptionForAgent: `Execute a CLI command on the system. Use this when you need to perform system operations, run build processes, install packages, or execute any command-line tools to accomplish the user's task. You must tailor your command to the user's system and provide clear explanation of what the command does.

**When to Use:**
- Running build processes (npm run build, yarn build)
- Installing dependencies (npm install, yarn install) 
- Running tests (npm test, yarn test)
- File system operations (ls, find, grep)
- Git operations (git status, git add, git commit)
- Package management (npm, yarn, pip)
- Development server operations (npm start, npm run dev)

**Important Guidelines:**
- Commands are executed in the workspace root directory: ${cwd}
- Use appropriate syntax for the current operating system (Windows/Unix/macOS)
- Set requires_approval to true for potentially destructive operations
- Set requires_approval to false for safe read-only operations
- Environment variables from the VS Code process are available
- Interactive and long-running commands are supported
- Each command runs in a new terminal instance

**Examples:**
- Safe operations: ls, pwd, git status, npm --version (requires_approval: false)
- Risky operations: npm install, rm -rf, sudo commands (requires_approval: true)
- Build operations: npm run build, yarn build (requires_approval: false)`,
      inputSchema: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The CLI command to execute. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.",
          },
          requires_approval: {
            type: "boolean",
            description: "A boolean indicating whether this command requires explicit user approval before execution. Set to 'true' for potentially impactful operations like installing/uninstalling packages, deleting/overwriting files, system configuration changes, network operations, or any commands that could have unintended side effects. Set to 'false' for safe operations like reading files/directories, running development servers, building projects, and other non-destructive operations.",
          },
          timeout: {
            type: "number",
            description: "Timeout in seconds for command execution (default: 30 seconds)",
          },
        },
        required: ["command", "requires_approval"],
      },
    };
  }

  async execute(input: { 
    command: string; 
    requires_approval: boolean; 
    timeout?: number 
  }): Promise<BashCommandResult> {
    try {
      const { command, requires_approval, timeout = 30 } = input;
      
      // Request approval if required
      if (requires_approval) {
        const approved = await this.requestApproval(command);
        if (!approved) {
          return {
            success: false,
            stderr: 'Command execution cancelled by user',
            exitCode: -1,
            command: command
          };
        }
      }

      // Execute the command
      return new Promise((resolve) => {
        const childProcess = cp.exec(
          command,
          {
            cwd: this.context.workspaceRoot,
            timeout: timeout * 1000,
            maxBuffer: 1024 * 1024 * 10, // 10MB buffer
            env: { ...process.env }
          },
          (error, stdout, stderr) => {
            if (error) {
              resolve({
                success: false,
                stdout: stdout || '',
                stderr: stderr || error.message,
                exitCode: error.code || -1,
                command: command
              });
            } else {
              resolve({
                success: true,
                stdout: stdout || '',
                stderr: stderr || '',
                exitCode: 0,
                command: command
              });
            }
          }
        );

        // Handle timeout
        const timeoutId = setTimeout(() => {
          childProcess.kill('SIGTERM');
          resolve({
            success: false,
            stderr: `Command timed out after ${timeout} seconds`,
            exitCode: -1,
            command: command
          });
        }, timeout * 1000);

        childProcess.on('exit', () => {
          clearTimeout(timeoutId);
        });
      });

    } catch (error) {
      return {
        success: false,
        stderr: `Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`,
        exitCode: -1,
        command: input.command
      };
    }
  }

  // Request user approval for potentially dangerous commands
  async requestApproval(command: string): Promise<boolean> {
    const message = `Do you want to execute this command?\n\n${command}`;
    
    const choice = await vscode.window.showWarningMessage(
      message,
      { modal: true },
      'Execute',
      'Cancel'
    );
    
    return choice === 'Execute';
  }

  // Check if command is potentially dangerous
  private isDangerousCommand(command: string): boolean {
    const dangerousPatterns = [
      /rm\s+-rf/i,
      /del\s+\/s/i,
      /rmdir\s+\/s/i,
      /format\s+/i,
      /fdisk/i,
      /mkfs/i,
      /dd\s+/i,
      /chmod\s+777/i,
      /sudo\s+/i,
      /curl.*\|\s*(bash|sh|powershell|cmd)/i,
      /wget.*\|\s*(bash|sh|powershell|cmd)/i,
      />\s*\/dev\/sd/i,
      /shutdown/i,
      /reboot/i,
      /halt/i
    ];

    return dangerousPatterns.some(pattern => pattern.test(command));
  }

  // Get appropriate shell for the current OS
  private getShell(): string {
    if (process.platform === 'win32') {
      return 'cmd.exe';
    } else {
      return '/bin/bash';
    }
  }

  // Escape command for shell execution
  private escapeCommand(command: string): string {
    if (process.platform === 'win32') {
      // Basic Windows command escaping
      return command.replace(/"/g, '\\"');
    } else {
      // Basic Unix command escaping
      return command.replace(/'/g, "'\"'\"'");
    }
  }

  // Execute multiple commands in sequence
  async executeSequence(commands: Array<{ 
    command: string; 
    requires_approval: boolean; 
    timeout?: number 
  }>): Promise<BashCommandResult[]> {
    const results: BashCommandResult[] = [];
    
    for (const cmd of commands) {
      const result = await this.execute(cmd);
      results.push(result);
      
      // Stop on first failure unless specified otherwise
      if (!result.success) {
        break;
      }
    }
    
    return results;
  }

  // Log tool execution for visibility
  private logExecution(input: any, result: BashCommandResult): void {
    if (this.context.webviewProvider) {
      this.context.webviewProvider.postMessage({
        type: 'toolExecution',
        tool: 'bash_command',
        input: input,
        result: {
          ...result,
          stdout: result.stdout?.substring(0, 500) + (result.stdout && result.stdout.length > 500 ? '...' : ''),
          stderr: result.stderr?.substring(0, 500) + (result.stderr && result.stderr.length > 500 ? '...' : '')
        },
        timestamp: new Date()
      });
    }

    if (this.context.outputChannel) {
      const status = result.success ? 'SUCCESS' : 'ERROR';
      this.context.outputChannel.appendLine(
        `[BASH_TOOL ${status}] ${input.command} - Exit code: ${result.exitCode}`
      );
      
      if (result.stdout) {
        this.context.outputChannel.appendLine(`STDOUT: ${result.stdout}`);
      }
      
      if (result.stderr) {
        this.context.outputChannel.appendLine(`STDERR: ${result.stderr}`);
      }
    }
  }

  async executeWithLogging(input: { 
    command: string; 
    requires_approval: boolean; 
    timeout?: number 
  }): Promise<BashCommandResult> {
    const result = await this.execute(input);
    this.logExecution(input, result);
    return result;
  }

  // Auto-detect if approval is needed based on command
  async executeWithAutoApproval(input: { 
    command: string; 
    timeout?: number 
  }): Promise<BashCommandResult> {
    const requiresApproval = this.isDangerousCommand(input.command);
    
    return this.executeWithLogging({
      ...input,
      requires_approval: requiresApproval
    });
  }
}
