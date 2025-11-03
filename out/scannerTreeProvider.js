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
exports.ScannerTreeProvider = void 0;
const vscode = __importStar(require("vscode"));
class ScannerTreeProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.scanResults = null;
        this.debugChannel = null;
    }
    setDebugChannel(channel) {
        this.debugChannel = channel;
        this.debugLog('🔍 Debug channel connected to ScannerTreeProvider');
    }
    debugLog(message) {
        if (this.debugChannel) {
            this.debugChannel.appendLine(`[TreeProvider] ${message}`);
        }
        console.log(`[AccessLint TreeProvider] ${message}`);
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    updateScanResults(results) {
        this.scanResults = results;
        this.refresh();
    }
    clearResults() {
        this.scanResults = null;
        this.refresh();
    }
    // Add method to get module by name for context menu commands
    getModuleByName(moduleName) {
        if (!this.scanResults?.modules) {
            return undefined;
        }
        // Remove folder emoji from name if present
        const cleanName = moduleName.replace('📁 ', '');
        return this.scanResults.modules.find(m => m.baseName === cleanName);
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!this.scanResults) {
            return Promise.resolve([
                {
                    label: 'No scan results available',
                    tooltip: 'Click "Scan Repository" to analyze the workspace',
                    iconPath: new vscode.ThemeIcon('info'),
                    collapsibleState: vscode.TreeItemCollapsibleState.None
                }
            ]);
        }
        if (!element) {
            // Root level items
            return Promise.resolve(this.getRootItems());
        }
        // Child items
        return Promise.resolve(this.getChildItems(element));
    }
    getRootItems() {
        if (!this.scanResults) {
            return [];
        }
        this.debugLog(`📊 Building root items...`);
        this.debugLog(`📊 Total files: ${this.scanResults.totalFiles}`);
        this.debugLog(`📊 Modules detected: ${this.scanResults.modules?.length || 0}`);
        if (this.scanResults.modules && this.scanResults.modules.length > 0) {
            this.debugLog(`📦 Available modules:`);
            this.scanResults.modules.forEach(module => {
                this.debugLog(`   - ${module.baseName} (${module.files.length} files in ${module.directory})`);
            });
        }
        else {
            this.debugLog(`⚠️ No modules detected - falling back to file type view`);
        }
        const items = [
            {
                label: `📊 Total Files: ${this.scanResults.totalFiles}`,
                tooltip: `Scanned at ${this.scanResults.scannedAt.toLocaleString()}`,
                iconPath: new vscode.ThemeIcon('file-directory'),
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                count: this.scanResults.totalFiles
            }
        ];
        // Add folder-based modules section as PRIMARY view if we have any
        if (this.scanResults.modules && this.scanResults.modules.length > 0) {
            this.debugLog(`✅ Adding Project Folders section with ${this.scanResults.modules.length} modules`);
            items.push({
                label: `📁 Project Folders (${this.scanResults.modules.length})`,
                tooltip: 'Folder-based modules - expand to see files and conversion options',
                iconPath: new vscode.ThemeIcon('folder-opened'),
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                contextValue: 'folderModules'
            });
        }
        else {
            this.debugLog(`⚠️ No modules found - Project Folders section will not appear`);
        }
        // Keep the original file types view as secondary option
        this.debugLog(`📋 Adding Files by Type section (${this.scanResults.filesByExtension.size} types)`);
        items.push({
            label: '📋 Files by Type',
            tooltip: 'Files grouped by extension',
            iconPath: new vscode.ThemeIcon('list-unordered'),
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextValue: 'filesByType'
        });
        // Add largest files section if we have any
        if (this.scanResults.largestFiles.length > 0) {
            items.push({
                label: '📈 Largest Files',
                tooltip: 'Files with the largest size',
                iconPath: new vscode.ThemeIcon('graph'),
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                contextValue: 'largestFiles'
            });
        }
        this.debugLog(`📊 Root items created: ${items.length} items`);
        return items;
    }
    getChildItems(element) {
        if (!this.scanResults) {
            return [];
        }
        if (element.contextValue === 'folderModules') {
            return this.getModuleItems();
        }
        if (element.contextValue === 'filesByType') {
            return this.getFileTypeItems();
        }
        if (element.contextValue === 'largestFiles') {
            return this.getLargestFileItems();
        }
        if (element.contextValue === 'fileType') {
            return this.getFilesForType(element.label);
        }
        if (element.contextValue === 'folderModule') {
            return this.getFilesForModule(element.label);
        }
        return [];
    }
    getModuleItems() {
        if (!this.scanResults?.modules) {
            this.debugLog(`⚠️ getModuleItems: No modules in scan results`);
            return [];
        }
        this.debugLog(`📦 getModuleItems: Processing ${this.scanResults.modules.length} modules`);
        return this.scanResults.modules.map(module => {
            const fileTypes = [...new Set(module.files.map(f => f.type))];
            const fileTypeStr = fileTypes.join(', ');
            this.debugLog(`📁 Creating module item: ${module.baseName} (${module.files.length} files: ${fileTypeStr})`);
            return {
                label: `📁 ${module.baseName}`,
                description: `${module.files.length} files (${fileTypeStr})`,
                tooltip: `Folder: ${module.directory}\nFiles: ${module.files.map(f => f.path.split(/[/\\]/).pop()).join(', ')}\nExpand to see files • Right-click to convert entire module`,
                iconPath: new vscode.ThemeIcon('folder'),
                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                contextValue: 'folderModule'
            };
        });
    }
    getFilesForModule(moduleLabel) {
        if (!this.scanResults?.modules) {
            return [];
        }
        // Extract folder name from label like "📁 profile"
        const folderName = moduleLabel.replace('📁 ', '');
        const module = this.scanResults.modules.find(m => m.baseName === folderName);
        if (!module) {
            return [];
        }
        this.debugLog(`Getting files for module: ${folderName}`);
        // Simply show the files - all conversion options are available via right-click
        return module.files.map(file => {
            // Extract filename for display
            const fileName = file.path.split(/[/\\]/).pop() || file.path;
            this.debugLog(`Processing file: ${file.path} -> URI will be created for: ${file.path}`);
            // Create clean file item that opens when clicked
            return {
                label: fileName,
                description: file.type,
                tooltip: `${file.path} (${file.type})\nClick to open • Right-click for conversion options`,
                iconPath: new vscode.ThemeIcon(this.getIconForFileType(file.type)),
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                contextValue: 'moduleFile',
                command: {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [this.getWorkspaceFileUri(file.path)]
                }
            };
        });
    }
    getFileTypeItems() {
        if (!this.scanResults) {
            return [];
        }
        const sortedExtensions = Array.from(this.scanResults.filesByExtension.entries())
            .sort((a, b) => b[1] - a[1]); // Sort by count descending
        return sortedExtensions.map(([extension, count]) => {
            const displayName = extension === 'no-extension' ? '(no extension)' : extension;
            const icon = this.getIconForExtension(extension);
            return {
                label: `${displayName} (${count})`,
                tooltip: `${count} files with ${displayName} extension`,
                iconPath: new vscode.ThemeIcon(icon),
                collapsibleState: count > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                contextValue: 'fileType',
                count
            };
        });
    }
    getLargestFileItems() {
        if (!this.scanResults) {
            return [];
        }
        return this.scanResults.largestFiles.map(file => {
            const sizeKB = (file.size / 1024).toFixed(1);
            return {
                label: `${file.path}`,
                description: `${sizeKB} KB`,
                tooltip: `${file.path} - ${sizeKB} KB`,
                iconPath: new vscode.ThemeIcon(this.getIconForExtension(this.getFileExtension(file.path))),
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                command: {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [this.getWorkspaceFileUri(file.path)]
                }
            };
        });
    }
    getFilesForType(typeLabel) {
        if (!this.scanResults) {
            return [];
        }
        // Extract extension from label like ".js (15)"
        const extension = typeLabel.split(' ')[0];
        const actualExtension = extension === '(no' ? 'no-extension' : extension;
        const filesWithExtension = this.scanResults.fileList.filter(file => {
            const fileExt = this.getFileExtension(file);
            return fileExt === actualExtension;
        });
        return filesWithExtension.slice(0, 50).map(file => {
            return {
                label: file,
                tooltip: file,
                iconPath: new vscode.ThemeIcon(this.getIconForExtension(actualExtension)),
                collapsibleState: vscode.TreeItemCollapsibleState.None,
                command: {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [this.getWorkspaceFileUri(file)]
                }
            };
        });
    }
    getFileExtension(filePath) {
        const parts = filePath.split('.');
        return parts.length > 1 ? `.${parts[parts.length - 1]}` : 'no-extension';
    }
    getIconForExtension(extension) {
        const iconMap = {
            '.html': 'file-code',
            '.htm': 'file-code',
            '.css': 'file-code',
            '.js': 'file-code',
            '.jsx': 'file-code',
            '.ts': 'file-code',
            '.tsx': 'file-code',
            '.vue': 'file-code',
            '.svelte': 'file-code',
            '.json': 'json',
            '.xml': 'file-code',
            '.md': 'markdown',
            '.txt': 'file-text',
            '.svg': 'file-media',
            '.png': 'file-media',
            '.jpg': 'file-media',
            '.jpeg': 'file-media',
            '.gif': 'file-media',
            'no-extension': 'file'
        };
        return iconMap[extension.toLowerCase()] || 'file';
    }
    getIconForFileType(fileType) {
        const iconMap = {
            'script': 'symbol-function',
            'style': 'symbol-color',
            'markup': 'file-code',
            'config': 'settings-gear',
            'other': 'file'
        };
        return iconMap[fileType] || 'file';
    }
    getWorkspaceFileUri(relativePath) {
        // Ensure we have a workspace folder
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            const error = 'No workspace folder available';
            this.debugLog(`❌ ${error}`);
            throw new Error(error);
        }
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri;
        this.debugLog(`🔍 Creating URI for: "${relativePath}"`);
        this.debugLog(`🔍 Workspace root: ${workspaceRoot.toString()}`);
        // Get workspace path and folder information
        const workspacePath = decodeURIComponent(workspaceRoot.path);
        const workspaceBaseName = workspacePath.split('/').pop();
        this.debugLog(`🔍 Workspace path: "${workspacePath}"`);
        this.debugLog(`🔍 Workspace folder name: "${workspaceBaseName}"`);
        const pathParts = relativePath.split(/[/\\]/).filter(part => part.length > 0);
        this.debugLog(`🔍 Path parts: [${pathParts.map(p => `"${p}"`).join(', ')}]`);
        if (pathParts.length > 0) {
            this.debugLog(`🔍 First path component: "${pathParts[0]}"`);
        }
        let resultUri;
        // Handle different cases:
        // 1. If workspace is opened at a component level (like CurrencyConverter) and we're looking for sibling components
        // 2. If we're looking for files within the current component
        if (pathParts.length > 0 && pathParts[0] !== workspaceBaseName) {
            // This is likely a sibling component (e.g., workspace=CurrencyConverter, file=Profile/ProfileModal.css)
            // We need to go up to the components directory
            if (workspacePath.includes('/components/')) {
                // Go up one level to components, then down to the target folder
                const componentsUri = vscode.Uri.joinPath(workspaceRoot, '..');
                resultUri = vscode.Uri.joinPath(componentsUri, relativePath);
                this.debugLog(`🔍 🔀 Sibling component detected - using components parent`);
                this.debugLog(`🔍 Components URI: ${componentsUri.toString()}`);
                this.debugLog(`🔍 Sibling URI: ${resultUri.toString()}`);
            }
            else {
                // Fallback to direct path
                resultUri = vscode.Uri.joinPath(workspaceRoot, relativePath);
                this.debugLog(`🔍 📁 Direct path (no components parent found)`);
            }
        }
        else if (pathParts.length > 1 && pathParts[0] === workspaceBaseName) {
            // Remove duplicate folder name (e.g., CurrencyConverter/CurrencyConverter.js -> CurrencyConverter.js)
            const adjustedPath = pathParts.slice(1).join('/');
            resultUri = vscode.Uri.joinPath(workspaceRoot, adjustedPath);
            this.debugLog(`🔍 ✅ Removed duplicate folder name!`);
            this.debugLog(`🔍 Adjusted path: "${adjustedPath}"`);
        }
        else {
            // Direct path within current component
            resultUri = vscode.Uri.joinPath(workspaceRoot, relativePath);
            this.debugLog(`🔍 📂 Direct path within current component`);
        }
        this.debugLog(`🔍 Final URI: ${resultUri.toString()}`);
        return resultUri;
    }
}
exports.ScannerTreeProvider = ScannerTreeProvider;
//# sourceMappingURL=scannerTreeProvider.js.map