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
exports.DiffGenerator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class DiffGenerator {
    /**
     * Generate diff for file write operations (new file or full overwrite)
     */
    static generateWriteDiff(filePath, newContent, workspaceRoot) {
        const absolutePath = path.isAbsolute(filePath)
            ? filePath
            : path.join(workspaceRoot, filePath);
        const fileExists = fs.existsSync(absolutePath);
        const oldContent = fileExists ? fs.readFileSync(absolutePath, 'utf8') : '';
        const language = this.getLanguageFromFile(filePath);
        if (!fileExists) {
            // New file creation
            return {
                filePath,
                oldContent: '',
                newContent,
                hunks: [{
                        id: 'new-file',
                        oldStart: 0,
                        oldLines: 0,
                        newStart: 1,
                        newLines: newContent.split('\n').length,
                        oldContent: [],
                        newContent: newContent.split('\n'),
                        context: [],
                        type: 'addition'
                    }],
                isNewFile: true,
                isDeletedFile: false,
                language
            };
        }
        // File overwrite - generate unified diff
        return this.generateUnifiedDiff(filePath, oldContent, newContent, workspaceRoot);
    }
    /**
     * Generate diff for edit operations (targeted edits)
     */
    static generateEditDiff(filePath, edits, workspaceRoot) {
        const absolutePath = path.isAbsolute(filePath)
            ? filePath
            : path.join(workspaceRoot, filePath);
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`File does not exist: ${filePath}`);
        }
        const originalContent = fs.readFileSync(absolutePath, 'utf8');
        let modifiedContent = originalContent;
        // Apply edits sequentially to generate the final content
        for (const edit of edits) {
            if (!modifiedContent.includes(edit.old_string)) {
                throw new Error(`Old string not found in file: "${edit.old_string.substring(0, 50)}..."`);
            }
            modifiedContent = modifiedContent.replace(edit.old_string, edit.new_string);
        }
        return this.generateUnifiedDiff(filePath, originalContent, modifiedContent, workspaceRoot);
    }
    /**
     * Generate unified diff between old and new content
     */
    static generateUnifiedDiff(filePath, oldContent, newContent, workspaceRoot) {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');
        const language = this.getLanguageFromFile(filePath);
        const hunks = this.computeDiffHunks(oldLines, newLines);
        return {
            filePath,
            oldContent,
            newContent,
            hunks,
            isNewFile: false,
            isDeletedFile: newContent.trim() === '',
            language
        };
    }
    /**
     * Compute diff hunks using a simple LCS-based algorithm
     */
    static computeDiffHunks(oldLines, newLines) {
        const hunks = [];
        let hunkId = 0;
        // Simple line-by-line comparison for now
        // This could be enhanced with more sophisticated diff algorithms
        const maxLines = Math.max(oldLines.length, newLines.length);
        let currentHunk = null;
        for (let i = 0; i < maxLines; i++) {
            const oldLine = oldLines[i];
            const newLine = newLines[i];
            if (oldLine !== newLine) {
                // Start a new hunk if needed
                if (!currentHunk) {
                    currentHunk = {
                        id: `hunk-${hunkId++}`,
                        oldStart: i + 1,
                        newStart: i + 1,
                        oldContent: [],
                        newContent: [],
                        context: []
                    };
                }
                // Add lines to current hunk
                if (oldLine !== undefined) {
                    currentHunk.oldContent.push(oldLine);
                }
                if (newLine !== undefined) {
                    currentHunk.newContent.push(newLine);
                }
            }
            else {
                // Lines are the same - finalize current hunk if exists
                if (currentHunk) {
                    currentHunk.oldLines = currentHunk.oldContent.length;
                    currentHunk.newLines = currentHunk.newContent.length;
                    // Determine hunk type
                    if (currentHunk.oldLines === 0) {
                        currentHunk.type = 'addition';
                    }
                    else if (currentHunk.newLines === 0) {
                        currentHunk.type = 'deletion';
                    }
                    else {
                        currentHunk.type = 'modification';
                    }
                    hunks.push(currentHunk);
                    currentHunk = null;
                }
            }
        }
        // Finalize last hunk if exists
        if (currentHunk) {
            currentHunk.oldLines = currentHunk.oldContent.length;
            currentHunk.newLines = currentHunk.newContent.length;
            if (currentHunk.oldLines === 0) {
                currentHunk.type = 'addition';
            }
            else if (currentHunk.newLines === 0) {
                currentHunk.type = 'deletion';
            }
            else {
                currentHunk.type = 'modification';
            }
            hunks.push(currentHunk);
        }
        return hunks;
    }
    /**
     * Get programming language from file extension
     */
    static getLanguageFromFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const languageMap = {
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.py': 'python',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.cs': 'csharp',
            '.php': 'php',
            '.rb': 'ruby',
            '.go': 'go',
            '.rs': 'rust',
            '.kt': 'kotlin',
            '.swift': 'swift',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.less': 'less',
            '.json': 'json',
            '.xml': 'xml',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.md': 'markdown',
            '.sql': 'sql',
            '.sh': 'bash',
            '.bat': 'batch',
            '.ps1': 'powershell'
        };
        return languageMap[ext] || 'text';
    }
    /**
     * Format diff hunk for display
     */
    static formatHunkForDisplay(hunk) {
        const lines = [];
        // Add hunk header
        lines.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);
        // Add removed lines
        hunk.oldContent.forEach(line => {
            lines.push(`-${line}`);
        });
        // Add added lines
        hunk.newContent.forEach(line => {
            lines.push(`+${line}`);
        });
        return lines.join('\n');
    }
}
exports.DiffGenerator = DiffGenerator;
//# sourceMappingURL=DiffGenerator.js.map