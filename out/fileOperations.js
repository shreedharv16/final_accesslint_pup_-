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
exports.FileOperations = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
class FileOperations {
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('AccessLint File Operations');
        this.backupDirectory = '.accesslint-backups';
    }
    async readFile(filePath) {
        try {
            const uri = this.getFileUri(filePath);
            const fileContent = await vscode.workspace.fs.readFile(uri);
            return Buffer.from(fileContent).toString('utf8');
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.outputChannel.appendLine(`❌ Failed to read file ${filePath}: ${errorMsg}`);
            throw new Error(`Failed to read file: ${errorMsg}`);
        }
    }
    async writeFileWithBackup(filePath, content) {
        this.outputChannel.appendLine(`💾 Writing file: ${filePath}`);
        try {
            // First, create a backup of the original file
            const originalContent = await this.readFile(filePath);
            const backupPath = await this.createBackup(filePath, originalContent);
            // Write the new content
            await this.writeFile(filePath, content);
            this.outputChannel.appendLine(`✅ File written successfully: ${filePath}`);
            this.outputChannel.appendLine(`📁 Backup created: ${backupPath}`);
            return {
                success: true,
                originalContent,
                backupPath
            };
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.outputChannel.appendLine(`❌ Failed to write file ${filePath}: ${errorMsg}`);
            return {
                success: false,
                error: errorMsg
            };
        }
    }
    async writeFile(filePath, content) {
        const uri = this.getFileUri(filePath);
        const fileContent = Buffer.from(content, 'utf8');
        await vscode.workspace.fs.writeFile(uri, fileContent);
    }
    async createBackup(filePath, content) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = path.basename(filePath);
        const backupFileName = `${fileName}.${timestamp}.backup`;
        // Ensure backup directory exists
        await this.ensureBackupDirectoryExists();
        const backupPath = path.join(this.backupDirectory, backupFileName);
        await this.writeFile(backupPath, content);
        return backupPath;
    }
    async restoreFromBackup(backupPath, targetPath) {
        this.outputChannel.appendLine(`🔄 Restoring from backup: ${backupPath} → ${targetPath}`);
        try {
            const backupContent = await this.readFile(backupPath);
            await this.writeFile(targetPath, backupContent);
            this.outputChannel.appendLine(`✅ File restored successfully: ${targetPath}`);
            return {
                success: true,
                originalContent: backupContent
            };
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.outputChannel.appendLine(`❌ Failed to restore file: ${errorMsg}`);
            return {
                success: false,
                error: errorMsg
            };
        }
    }
    async listBackups() {
        try {
            await this.ensureBackupDirectoryExists();
            const backupUri = this.getFileUri(this.backupDirectory);
            const entries = await vscode.workspace.fs.readDirectory(backupUri);
            return entries
                .filter(([_, type]) => type === vscode.FileType.File)
                .map(([name, _]) => name)
                .filter(name => name.endsWith('.backup'))
                .sort();
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Failed to list backups: ${error}`);
            return [];
        }
    }
    async cleanupOldBackups(maxAge = 7 * 24 * 60 * 60 * 1000) {
        this.outputChannel.appendLine('🧹 Cleaning up old backups...');
        try {
            const backups = await this.listBackups();
            const now = Date.now();
            for (const backup of backups) {
                const backupPath = path.join(this.backupDirectory, backup);
                try {
                    const uri = this.getFileUri(backupPath);
                    const stat = await vscode.workspace.fs.stat(uri);
                    const age = now - stat.mtime;
                    if (age > maxAge) {
                        await vscode.workspace.fs.delete(uri);
                        this.outputChannel.appendLine(`🗑️  Deleted old backup: ${backup}`);
                    }
                }
                catch (error) {
                    // Skip if file doesn't exist or can't be accessed
                    continue;
                }
            }
            this.outputChannel.appendLine('✅ Backup cleanup completed');
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Backup cleanup failed: ${error}`);
        }
    }
    async previewChanges(filePath, newContent) {
        try {
            const originalContent = await this.readFile(filePath);
            // Create temporary files for diff view
            const originalUri = vscode.Uri.parse(`untitled:${filePath}.original`);
            const newUri = vscode.Uri.parse(`untitled:${filePath}.new`);
            // Open diff view
            await vscode.commands.executeCommand('vscode.diff', originalUri, newUri, `${path.basename(filePath)} - AccessLint Changes`, {
                preview: true
            });
            // Note: In a real implementation, you'd need to populate these virtual documents
            // This is a simplified version showing the concept
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Failed to preview changes: ${error}`);
            throw error;
        }
    }
    async ensureBackupDirectoryExists() {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            throw new Error('No workspace folder available');
        }
        const backupUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, this.backupDirectory);
        try {
            await vscode.workspace.fs.stat(backupUri);
        }
        catch {
            // Directory doesn't exist, create it
            await vscode.workspace.fs.createDirectory(backupUri);
            this.outputChannel.appendLine(`📁 Created backup directory: ${this.backupDirectory}`);
        }
    }
    getFileUri(filePath) {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            throw new Error('No workspace folder available');
        }
        if (path.isAbsolute(filePath)) {
            return vscode.Uri.file(filePath);
        }
        return vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, filePath);
    }
    dispose() {
        this.outputChannel.dispose();
    }
}
exports.FileOperations = FileOperations;
//# sourceMappingURL=fileOperations.js.map