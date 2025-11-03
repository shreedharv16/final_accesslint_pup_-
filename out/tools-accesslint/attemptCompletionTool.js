"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttemptCompletionTool = void 0;
const vscode = __importStar(require("vscode"));
class AttemptCompletionTool {
    constructor(context) {
        this.context = context;
    }
    static getDefinition(cwd) {
        return {
            name: "attempt_completion",
            descriptionForAgent: `Use this tool when you have completed the task and want to present the final result to the user. This tool should be used when you have gathered enough information to provide a comprehensive answer to the user's question.

Working directory: ${cwd}

Key Guidelines:
- Use this tool ONLY when you have sufficient information to answer the user's question
- Provide a clear, comprehensive result that directly addresses what the user asked for
- Optionally include a CLI command that demonstrates or validates your findings
- This tool signals task completion to the user

Examples:
- After analyzing code files: "Based on my analysis of the codebase, I found..."
- After searching for patterns: "I examined the project structure and discovered..."
- Include commands like: "npm run build" or "ls src/components" to showcase findings`,
            inputSchema: {
                type: "object",
                properties: {
                    result: {
                        type: "string",
                        description: "The final result/answer to present to the user. This should be a comprehensive response that directly addresses their question.",
                    },
                    command: {
                        type: "string",
                        description: "Optional CLI command that demonstrates or validates the result (e.g., 'npm run build', 'ls src/components', 'grep -r \"pattern\" src/')",
                    }
                },
                required: ["result"],
            },
        };
    }
    async execute(input) {
        try {
            const { result, command } = input;
            if (!result || result.trim().length === 0) {
                return {
                    success: false,
                    error: 'Result cannot be empty. Please provide a comprehensive answer to the user\'s question.'
                };
            }
            // Log the completion attempt
            if (this.context.outputChannel) {
                this.context.outputChannel.appendLine(`✅ TASK COMPLETION ATTEMPT`);
                this.context.outputChannel.appendLine(`📋 Result: ${result.substring(0, 200)}${result.length > 200 ? '...' : ''}`);
                if (command) {
                    this.context.outputChannel.appendLine(`🔧 Suggested command: ${command}`);
                }
            }
            // Send completion to webview
            if (this.context.webviewProvider) {
                // Send as assistantMessage for immediate display
                this.context.webviewProvider.postMessage({
                    type: 'assistantMessage',
                    message: result,
                    timestamp: new Date()
                });
                // Also send suggested command if available
                if (command) {
                    this.context.webviewProvider.postMessage({
                        type: 'assistantMessage',
                        message: `💡 Suggested command: \`${command}\``,
                        timestamp: new Date()
                    });
                }
            }
            return {
                success: true,
                result: result,
                command: command
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Error attempting completion: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    // Execute with logging
    async executeWithLogging(input) {
        const result = await this.execute(input);
        this.logExecution(input, result);
        return result;
    }
    // Execute with approval (for agent mode)
    async executeWithApproval(input) {
        // For completion, we generally want to show the result immediately
        // but we can add approval logic here if needed
        const approved = await this.requestApproval(input);
        if (!approved) {
            return {
                success: false,
                error: 'Task completion was not approved'
            };
        }
        return this.executeWithLogging(input);
    }
    async requestApproval(input) {
        const message = `🎯 Agent wants to complete the task with this result:\n\n"${input.result.substring(0, 300)}${input.result.length > 300 ? '...' : ''}"\n\n${input.command ? `Suggested command: ${input.command}\n\n` : ''}Do you approve this completion?`;
        const choice = await vscode.window.showInformationMessage(message, { modal: false }, 'Approve', 'Deny', 'View Full Result');
        if (choice === 'View Full Result') {
            // Show full result in output channel
            if (this.context.outputChannel) {
                this.context.outputChannel.show();
                this.context.outputChannel.appendLine(`=== FULL COMPLETION RESULT ===`);
                this.context.outputChannel.appendLine(input.result);
                if (input.command) {
                    this.context.outputChannel.appendLine(`\nSuggested command: ${input.command}`);
                }
                this.context.outputChannel.appendLine(`==============================`);
            }
            // Ask again
            return this.requestApproval(input);
        }
        return choice === 'Approve';
    }
    logExecution(input, result) {
        if (this.context.webviewProvider) {
            this.context.webviewProvider.postMessage({
                type: 'toolExecution',
                tool: 'attempt_completion',
                input: {
                    result: input.result?.substring(0, 200) + (input.result?.length > 200 ? '...' : ''),
                    command: input.command
                },
                result: result,
                timestamp: new Date()
            });
        }
        if (this.context.outputChannel) {
            const status = result.success ? 'SUCCESS' : 'ERROR';
            this.context.outputChannel.appendLine(`[COMPLETION ${status}] Task completion attempted`);
            if (result.error) {
                this.context.outputChannel.appendLine(`ERROR: ${result.error}`);
            }
        }
    }
}
exports.AttemptCompletionTool = AttemptCompletionTool;
//# sourceMappingURL=attemptCompletionTool.js.map