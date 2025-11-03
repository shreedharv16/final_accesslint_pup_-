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
exports.EditTool = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class EditTool {
    constructor(context) {
        this.context = context;
    }
    static getDefinition(cwd) {
        return {
            name: "edit_file",
            descriptionForAgent: "Makes multiple changes to a single file in one operation. Use this tool to edit files by providing the exact text to replace and the new text. All edits are applied sequentially in the order provided.",
            inputSchema: {
                type: "object",
                properties: {
                    file_path: {
                        type: "string",
                        description: `Path to the file to modify (relative to current working directory: ${cwd})`,
                    },
                    edits: {
                        type: "array",
                        description: "Array of edit operations, each containing old_string and new_string",
                        items: {
                            type: "object",
                            properties: {
                                old_string: {
                                    type: "string",
                                    description: "Exact text to replace - must match exactly including whitespace and indentation",
                                },
                                new_string: {
                                    type: "string",
                                    description: "The replacement text",
                                },
                            },
                            required: ["old_string", "new_string"],
                        },
                    },
                },
                required: ["file_path", "edits"],
            },
        };
    }
    async execute(input) {
        try {
            const { file_path, edits } = input;
            // Resolve relative path to absolute
            const absolutePath = path.isAbsolute(file_path)
                ? file_path
                : path.join(this.context.workspaceRoot, file_path);
            // Check if file exists
            if (!fs.existsSync(absolutePath)) {
                return {
                    success: false,
                    error: `File not found: ${file_path}`,
                    filePath: file_path,
                    editsApplied: 0
                };
            }
            // Read original content
            let content = fs.readFileSync(absolutePath, 'utf8');
            const originalContent = content;
            let editsApplied = 0;
            // Apply edits sequentially
            for (let i = 0; i < edits.length; i++) {
                const edit = edits[i];
                // Validate edit
                if (edit.old_string === edit.new_string) {
                    continue; // Skip no-op edits
                }
                // Check if old_string exists in current content
                if (!content.includes(edit.old_string)) {
                    return {
                        success: false,
                        error: `Edit ${i + 1}: Text to replace not found in file: "${edit.old_string.substring(0, 100)}${edit.old_string.length > 100 ? '...' : ''}"`,
                        filePath: file_path,
                        editsApplied: editsApplied
                    };
                }
                // Count occurrences to check for ambiguity
                const occurrences = (content.match(new RegExp(this.escapeRegex(edit.old_string), 'g')) || []).length;
                if (occurrences > 1) {
                    return {
                        success: false,
                        error: `Edit ${i + 1}: Text to replace appears ${occurrences} times in file. Make the old_string more specific to match exactly one occurrence.`,
                        filePath: file_path,
                        editsApplied: editsApplied
                    };
                }
                // Apply the edit
                content = content.replace(edit.old_string, edit.new_string);
                editsApplied++;
            }
            // Only write if content actually changed
            if (content !== originalContent) {
                fs.writeFileSync(absolutePath, content, 'utf8');
            }
            return {
                success: true,
                filePath: file_path,
                editsApplied: editsApplied
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Error editing file: ${error instanceof Error ? error.message : 'Unknown error'}`,
                filePath: input.file_path,
                editsApplied: 0
            };
        }
    }
    // Helper to escape special regex characters
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    // Single edit operation for simple replacements
    async executeSingleEdit(input) {
        return this.execute({
            file_path: input.file_path,
            edits: [{ old_string: input.old_string, new_string: input.new_string }]
        });
    }
    // Request user approval for file edits using diff viewer
    async requestApproval(filePath, edits) {
        console.log('🔍 DEBUG: requestApproval called for edit_file:', filePath);
        try {
            // Use the DiffViewerManager for approval
            const { DiffViewerManager } = await Promise.resolve().then(() => __importStar(require('../diffViewer/DiffViewerManager')));
            console.log('🔍 DEBUG: DiffViewerManager imported successfully');
            // Get the extension context and workspace root
            const extensionContext = this.context.extensionContext;
            const workspaceRoot = this.context.workspaceRoot;
            console.log('🔍 DEBUG: extensionContext:', !!extensionContext, 'workspaceRoot:', workspaceRoot);
            if (!extensionContext || !workspaceRoot) {
                throw new Error('Extension context or workspace root not available');
            }
            const diffManager = DiffViewerManager.getInstance(extensionContext, workspaceRoot);
            console.log('🔍 DEBUG: diffManager instance:', !!diffManager);
            if (!diffManager) {
                throw new Error('DiffViewerManager instance not available');
            }
            console.log('🔍 DEBUG: Calling requestEditApproval...');
            const response = await diffManager.requestEditApproval(filePath, edits);
            console.log('🔍 DEBUG: requestEditApproval response:', response);
            return response.approved;
        }
        catch (error) {
            // Fallback to dialog if diff viewer fails
            console.warn('Diff viewer failed, falling back to dialog:', error);
            const message = `Do you want to apply ${edits.length} edit(s) to '${filePath}'?\n\nNote: Diff preview failed - ${error instanceof Error ? error.message : 'Unknown error'}`;
            const choice = await vscode.window.showWarningMessage(message, { modal: true }, 'Yes', 'No');
            return choice === 'Yes';
        }
    }
    // Log tool execution for visibility
    logExecution(input, result) {
        if (this.context.webviewProvider) {
            this.context.webviewProvider.postMessage({
                type: 'toolExecution',
                tool: 'edit_file',
                input: { ...input, edits: input.edits.map((edit) => ({
                        old_string: edit.old_string.length > 50 ? edit.old_string.substring(0, 50) + '...' : edit.old_string,
                        new_string: edit.new_string.length > 50 ? edit.new_string.substring(0, 50) + '...' : edit.new_string
                    })) },
                result: result,
                timestamp: new Date()
            });
        }
        if (this.context.outputChannel) {
            const status = result.success ? 'SUCCESS' : 'ERROR';
            this.context.outputChannel.appendLine(`[EDIT_TOOL ${status}] ${input.file_path} - ${result.success ? `${result.editsApplied} edits applied` : result.error}`);
        }
    }
    async executeWithLogging(input) {
        // Show diff viewer for user to preview changes (like executeWithApproval but without the extra dialog)
        const approved = await this.requestApproval(input.file_path, input.edits);
        if (!approved) {
            return {
                success: false,
                error: 'File edit cancelled by user',
                filePath: input.file_path,
                editsApplied: 0
            };
        }
        const result = await this.execute(input);
        this.logExecution(input, result);
        return result;
    }
    async executeWithApproval(input) {
        // Request user approval
        const approved = await this.requestApproval(input.file_path, input.edits);
        if (!approved) {
            return {
                success: false,
                error: 'File edit cancelled by user',
                filePath: input.file_path,
                editsApplied: 0
            };
        }
        return this.executeWithLogging(input);
    }
}
exports.EditTool = EditTool;
//# sourceMappingURL=editTool.js.map