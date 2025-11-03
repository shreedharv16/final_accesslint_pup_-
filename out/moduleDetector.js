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
exports.ModuleDetector = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
class ModuleDetector {
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('AccessLint Module Detector');
    }
    /**
     * Detects modules in the workspace based on folder structure
     */
    async detectModules() {
        this.outputChannel.clear();
        this.outputChannel.appendLine('🔍 Detecting file modules...');
        try {
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                throw new Error('No workspace folder is open');
            }
            const config = this.getConfig();
            const excludePattern = `{${config.excludePatterns.join(',')}}`;
            // Find all supported files
            const files = await vscode.workspace.findFiles('**/*.{js,jsx,ts,tsx,html,css,scss,sass,vue,svelte}', excludePattern, config.maxFiles);
            this.outputChannel.appendLine(`📊 Found ${files.length} files to analyze`);
            // Group files by directory (folder-based modules)
            const moduleMap = new Map();
            for (const file of files) {
                const relativePath = vscode.workspace.asRelativePath(file);
                const fileInfo = this.analyzeFile(relativePath);
                if (fileInfo) {
                    const directory = fileInfo.directory;
                    if (!moduleMap.has(directory)) {
                        moduleMap.set(directory, []);
                    }
                    moduleMap.get(directory).push(fileInfo);
                }
            }
            // Convert to FileModule objects, only including multi-file modules
            const modules = [];
            for (const [directory, files] of moduleMap.entries()) {
                if (files.length > 1 && this.isValidModuleDirectory(directory, files)) {
                    const folderName = path.basename(directory);
                    const hasMultipleTypes = this.hasMultipleFileTypes(files);
                    // Only include if it has multiple file types (e.g., both JS and CSS)
                    if (hasMultipleTypes) {
                        // Validate that all files in this module actually exist relative to workspace
                        // TEMPORARILY DISABLED - let's see if this is what's preventing folder view
                        // const validatedFiles = await this.validateModuleFiles(files);
                        // if (validatedFiles.length > 1) {
                        modules.push({
                            name: `${folderName} module`,
                            baseName: folderName,
                            directory: directory,
                            files: files.sort((a, b) => a.path.localeCompare(b.path))
                        });
                        // } else {
                        //     this.outputChannel.appendLine(`⚠️ Skipped module '${folderName}' - files not accessible from current workspace`);
                        // }
                    }
                }
            }
            this.outputChannel.appendLine(`✅ Detected ${modules.length} file modules`);
            // Log detected modules
            for (const module of modules) {
                this.outputChannel.appendLine(`📦 ${module.name}: ${module.files.map(f => path.basename(f.path)).join(', ')}`);
            }
            return modules;
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.outputChannel.appendLine(`❌ Module detection failed: ${errorMsg}`);
            return [];
        }
    }
    /**
     * Detects module for a specific file by finding related files in the same folder
     */
    async detectModuleForFile(filePath) {
        const fileInfo = this.analyzeFile(filePath);
        if (!fileInfo) {
            return null;
        }
        const directory = path.dirname(filePath);
        const folderName = path.basename(directory);
        try {
            // Search for all supported files in the same directory
            const dirUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, directory);
            const dirContents = await vscode.workspace.fs.readDirectory(dirUri);
            const relatedFiles = [];
            for (const [fileName, fileType] of dirContents) {
                if (fileType === vscode.FileType.File) {
                    const fullPath = path.join(directory, fileName);
                    const relatedFileInfo = this.analyzeFile(fullPath);
                    if (relatedFileInfo) {
                        relatedFiles.push(relatedFileInfo);
                    }
                }
            }
            // Check if this is a valid module folder
            if (relatedFiles.length > 1 &&
                this.isValidModuleDirectory(directory, relatedFiles) &&
                this.hasMultipleFileTypes(relatedFiles)) {
                return {
                    name: `${folderName} module`,
                    baseName: folderName,
                    directory,
                    files: relatedFiles.sort((a, b) => a.path.localeCompare(b.path))
                };
            }
            return null;
        }
        catch (error) {
            this.outputChannel.appendLine(`⚠️ Failed to detect module for ${filePath}: ${error}`);
            return null;
        }
    }
    analyzeFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const baseName = path.basename(filePath, ext);
        // Skip common non-module files
        if (this.isNonModuleFile(baseName, ext)) {
            return null;
        }
        const fileType = this.getFileType(ext);
        return {
            path: filePath,
            extension: ext,
            type: fileType,
            baseName: baseName,
            directory: path.dirname(filePath)
        };
    }
    getFileType(extension) {
        const scriptExts = ['.js', '.jsx', '.ts', '.tsx'];
        const styleExts = ['.css', '.scss', '.sass', '.less'];
        const markupExts = ['.html', '.vue', '.svelte'];
        const configExts = ['.json', '.xml'];
        if (scriptExts.includes(extension))
            return 'script';
        if (styleExts.includes(extension))
            return 'style';
        if (markupExts.includes(extension))
            return 'markup';
        if (configExts.includes(extension))
            return 'config';
        return 'other';
    }
    isNonModuleFile(baseName, extension) {
        // Skip common non-module files but be more permissive for Angular
        const skipFiles = [
            'index', 'main', 'global', 'common', 'utils', 'helpers',
            'constants', 'config', 'settings', 'types', 'interfaces',
            'environment', 'karma.conf', 'protractor.conf', 'angular.json'
        ];
        const skipPrefixes = ['_', '.'];
        // Don't skip Angular-specific files
        const angularPatterns = [
            '.component', '.service', '.directive', '.pipe', '.module',
            '.guard', '.resolver', '.interceptor', '.spec', '.test'
        ];
        // If it's an Angular file, don't skip it
        if (angularPatterns.some(pattern => baseName.includes(pattern))) {
            return false;
        }
        return skipFiles.includes(baseName.toLowerCase()) ||
            skipPrefixes.some(prefix => baseName.startsWith(prefix));
    }
    isValidModuleDirectory(directory, files) {
        // Skip root-level directories and very deep nesting
        const pathParts = directory.split(/[/\\]/).filter(part => part.length > 0);
        // Enhanced Angular component detection
        const hasAngularComponent = files.some(file => file.extension === '.ts' &&
            (file.baseName.includes('.component') ||
                file.path.includes('component')));
        // If it's an Angular component directory, it's valid regardless of depth
        if (hasAngularComponent) {
            return true;
        }
        // Allow single-level component directories (like Home, Profile, CurrencyConverter)
        // and reasonably nested directories, but not too deep
        if (pathParts.length === 0 || pathParts.length > 5) {
            return false;
        }
        // Skip directories that are likely not component modules
        const folderName = path.basename(directory).toLowerCase();
        const skipDirs = [
            'src', 'lib', 'utils', 'helpers', 'constants', 'types', 'interfaces',
            'assets', 'images', 'styles', 'css', 'js', 'dist', 'build', 'public'
        ];
        if (skipDirs.includes(folderName)) {
            return false;
        }
        // Must have reasonable number of files (not too many, not too few)
        if (files.length > 10) {
            return false;
        }
        return true;
    }
    hasMultipleFileTypes(files) {
        const types = new Set(files.map(file => file.type));
        // For Angular components, we want to be more inclusive
        // A single TypeScript component with its template/styles is a valid module
        const hasAngularComponent = files.some(file => file.extension === '.ts' &&
            (file.baseName.includes('.component') ||
                file.path.includes('component')));
        // If it's an Angular component, even a single file can be a module
        // but prefer to have multiple files (component + template + styles)
        if (hasAngularComponent) {
            // Angular component with just one file is still valid
            return true;
        }
        // For non-Angular modules, require multiple file types
        return types.size > 1;
    }
    getConfig() {
        const config = vscode.workspace.getConfiguration('accesslint');
        return {
            excludePatterns: config.get('excludePatterns', [
                '**/node_modules/**',
                '**/dist/**',
                '**/build/**',
                '**/.git/**',
                '**/coverage/**',
                '**/.next/**',
                '**/out/**'
            ]),
            maxFiles: config.get('maxFiles', 10000)
        };
    }
    /**
     * Validates that module files actually exist relative to the current workspace
     */
    async validateModuleFiles(files) {
        const validFiles = [];
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri;
        this.outputChannel.appendLine(`🔍 Validating ${files.length} files...`);
        for (const file of files) {
            try {
                const fileUri = vscode.Uri.joinPath(workspaceRoot, file.path);
                this.outputChannel.appendLine(`   Checking: ${file.path} -> ${fileUri.toString()}`);
                const stat = await vscode.workspace.fs.stat(fileUri);
                if (stat.type === vscode.FileType.File) {
                    validFiles.push(file);
                    this.outputChannel.appendLine(`   ✅ Valid: ${file.path}`);
                }
                else {
                    this.outputChannel.appendLine(`   ❌ Not a file: ${file.path}`);
                }
            }
            catch (error) {
                this.outputChannel.appendLine(`   ❌ Not accessible: ${file.path} (${error})`);
            }
        }
        this.outputChannel.appendLine(`✅ Validation complete: ${validFiles.length}/${files.length} files are valid`);
        return validFiles;
    }
    dispose() {
        this.outputChannel.dispose();
    }
}
exports.ModuleDetector = ModuleDetector;
//# sourceMappingURL=moduleDetector.js.map