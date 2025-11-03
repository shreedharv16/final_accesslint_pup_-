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
exports.WriteTool = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class WriteTool {
    constructor(context) {
        this.context = context;
    }
    static getDefinition(cwd) {
        return {
            name: "write_file",
            descriptionForAgent: `Request to write content to a file at the specified path. If the file exists, it will be overwritten with the provided content. If the file doesn't exist, it will be created. This tool will automatically create any directories needed to write the file.

Usage:
- The file_path parameter must be a relative path to the current working directory: ${cwd}
- This tool will overwrite the existing file if there is one at the provided path.
- If this is an existing file, you MUST use the read_file tool first to read the file's contents.
- ALWAYS prefer editing existing files in the codebase. NEVER write new files unless explicitly required.
- NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.`,
            inputSchema: {
                type: "object",
                properties: {
                    file_path: {
                        type: "string",
                        description: `The path of the file to write to (relative to the current working directory ${cwd})`,
                    },
                    content: {
                        type: "string",
                        description: "The content to write to the file. ALWAYS provide the COMPLETE intended content of the file, without any truncation or omissions. You MUST include ALL parts of the file, even if they haven't been modified.",
                    },
                },
                required: ["file_path", "content"],
            },
        };
    }
    async execute(input) {
        try {
            const { file_path, content } = input;
            // Resolve relative path to absolute
            const absolutePath = path.isAbsolute(file_path)
                ? file_path
                : path.join(this.context.workspaceRoot, file_path);
            // Create directory if it doesn't exist
            const dirPath = path.dirname(absolutePath);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
            // Check if file already exists for logging
            const fileExists = fs.existsSync(absolutePath);
            // Write the file
            fs.writeFileSync(absolutePath, content, 'utf8');
            return {
                success: true,
                content: content,
                filePath: file_path,
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Error writing file: ${error instanceof Error ? error.message : 'Unknown error'}`,
                filePath: input.file_path
            };
        }
    }
    // Request user approval for file writes using diff viewer
    async requestApproval(filePath, content, fileExists) {
        try {
            // Use the DiffViewerManager for approval
            const { DiffViewerManager } = await Promise.resolve().then(() => __importStar(require('../diffViewer/DiffViewerManager')));
            // Get the extension context and workspace root
            const extensionContext = this.context.extensionContext;
            const workspaceRoot = this.context.workspaceRoot;
            if (!extensionContext || !workspaceRoot) {
                throw new Error('Extension context or workspace root not available');
            }
            const diffManager = DiffViewerManager.getInstance(extensionContext, workspaceRoot);
            if (!diffManager) {
                throw new Error('DiffViewerManager instance not available');
            }
            const response = await diffManager.requestWriteApproval(filePath, content);
            return response.approved;
        }
        catch (error) {
            // Fallback to dialog if diff viewer fails
            console.warn('Diff viewer failed, falling back to dialog:', error);
            const action = fileExists ? 'overwrite' : 'create';
            const message = `Do you want to ${action} the file '${filePath}'?\n\nNote: Diff preview failed - ${error instanceof Error ? error.message : 'Unknown error'}`;
            const choice = await vscode.window.showWarningMessage(message, { modal: true }, 'Yes', 'No');
            return choice === 'Yes';
        }
    }
    // Log tool execution for visibility
    logExecution(input, result) {
        if (this.context.webviewProvider) {
            this.context.webviewProvider.postMessage({
                type: 'toolExecution',
                tool: 'write_file',
                input: { ...input, content: input.content.length > 100 ? input.content.substring(0, 100) + '...' : input.content },
                result: result,
                timestamp: new Date()
            });
        }
        if (this.context.outputChannel) {
            const status = result.success ? 'SUCCESS' : 'ERROR';
            this.context.outputChannel.appendLine(`[WRITE_TOOL ${status}] ${input.file_path} - ${result.success ? 'Written successfully' : result.error}`);
        }
    }
    async executeWithLogging(input) {
        const absolutePath = path.isAbsolute(input.file_path)
            ? input.file_path
            : path.join(this.context.workspaceRoot, input.file_path);
        const fileExists = fs.existsSync(absolutePath);
        // Show diff viewer for user to preview changes (like executeWithApproval but without the extra dialog)
        const approved = await this.requestApproval(input.file_path, input.content, fileExists);
        if (!approved) {
            return {
                success: false,
                error: 'File write cancelled by user',
                filePath: input.file_path
            };
        }
        const result = await this.execute(input);
        this.logExecution(input, result);
        return result;
    }
    async executeWithApproval(input) {
        const absolutePath = path.isAbsolute(input.file_path)
            ? input.file_path
            : path.join(this.context.workspaceRoot, input.file_path);
        const fileExists = fs.existsSync(absolutePath);
        // Request user approval
        const approved = await this.requestApproval(input.file_path, input.content, fileExists);
        if (!approved) {
            return {
                success: false,
                error: 'File write cancelled by user',
                filePath: input.file_path
            };
        }
        return this.executeWithLogging(input);
    }
}
exports.WriteTool = WriteTool;
//# sourceMappingURL=writeTool.js.map