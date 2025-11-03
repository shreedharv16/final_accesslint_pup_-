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
exports.FileScanner = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const moduleDetector_1 = require("./moduleDetector");
class FileScanner {
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('AccessLint Scanner');
        this.moduleDetector = new moduleDetector_1.ModuleDetector();
    }
    async scanWorkspace() {
        const startTime = Date.now();
        this.outputChannel.clear();
        this.outputChannel.appendLine('🔍 Starting workspace scan...');
        try {
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                const error = 'No workspace folder is open';
                this.outputChannel.appendLine(`❌ ${error}`);
                return {
                    success: false,
                    error,
                    duration: Date.now() - startTime
                };
            }
            const config = this.getConfig();
            const excludePattern = `{${config.excludePatterns.join(',')}}`;
            this.outputChannel.appendLine(`📁 Scanning workspace: ${vscode.workspace.workspaceFolders[0].name}`);
            this.outputChannel.appendLine(`🚫 Excluding: ${config.excludePatterns.join(', ')}`);
            // Find all files excluding the patterns
            const files = await vscode.workspace.findFiles('**/*', excludePattern, config.maxFiles);
            this.outputChannel.appendLine(`📊 Found ${files.length} files`);
            const filesByExtension = new Map();
            const fileList = [];
            const largestFiles = [];
            for (const file of files) {
                const relativePath = vscode.workspace.asRelativePath(file);
                fileList.push(relativePath);
                // Get file extension
                const ext = path.extname(file.fsPath).toLowerCase() || 'no-extension';
                filesByExtension.set(ext, (filesByExtension.get(ext) || 0) + 1);
                // Get file size for largest files tracking
                try {
                    const stat = await vscode.workspace.fs.stat(file);
                    largestFiles.push({ path: relativePath, size: stat.size });
                }
                catch (error) {
                    // File might be deleted or inaccessible, skip size calculation
                }
            }
            // Sort largest files and keep top 10
            largestFiles.sort((a, b) => b.size - a.size);
            const topLargestFiles = largestFiles.slice(0, 10);
            // Detect modules
            this.outputChannel.appendLine('🔍 Detecting folder-based modules...');
            const modules = await this.moduleDetector.detectModules();
            const stats = {
                totalFiles: files.length,
                filesByExtension,
                fileList: fileList.sort(),
                largestFiles: topLargestFiles,
                scannedAt: new Date(),
                modules
            };
            const duration = Date.now() - startTime;
            this.logScanResults(stats, duration);
            return {
                success: true,
                stats,
                duration
            };
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.outputChannel.appendLine(`❌ Scan failed: ${errorMsg}`);
            return {
                success: false,
                error: errorMsg,
                duration: Date.now() - startTime
            };
        }
    }
    logScanResults(stats, duration) {
        this.outputChannel.appendLine('\n📈 SCAN RESULTS:');
        this.outputChannel.appendLine(`⏱️  Scan duration: ${duration}ms`);
        this.outputChannel.appendLine(`📁 Total files: ${stats.totalFiles}`);
        this.outputChannel.appendLine('\n📊 Files by extension:');
        const sortedExtensions = Array.from(stats.filesByExtension.entries())
            .sort((a, b) => b[1] - a[1]);
        for (const [ext, count] of sortedExtensions) {
            this.outputChannel.appendLine(`   ${ext}: ${count} files`);
        }
        if (stats.modules && stats.modules.length > 0) {
            this.outputChannel.appendLine(`\n📦 Detected ${stats.modules.length} folder-based modules:`);
            for (const module of stats.modules.slice(0, 10)) {
                const fileTypes = [...new Set(module.files.map(f => f.type))];
                this.outputChannel.appendLine(`   ${module.name}: ${fileTypes.join(', ')} (${module.files.length} files)`);
            }
        }
        if (stats.largestFiles.length > 0) {
            this.outputChannel.appendLine('\n📋 Largest files:');
            for (const file of stats.largestFiles.slice(0, 5)) {
                const sizeKB = (file.size / 1024).toFixed(1);
                this.outputChannel.appendLine(`   ${file.path} (${sizeKB} KB)`);
            }
        }
        this.outputChannel.appendLine(`\n✅ Scan completed at ${stats.scannedAt.toLocaleTimeString()}`);
        this.outputChannel.show(true);
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
    getCommonAccessibilityFileTypes() {
        return new Map([
            ['Web Files', ['.html', '.htm', '.xhtml']],
            ['Stylesheets', ['.css', '.scss', '.sass', '.less']],
            ['JavaScript', ['.js', '.jsx', '.mjs']],
            ['TypeScript', ['.ts', '.tsx']],
            ['Templates', ['.vue', '.svelte', '.angular', '.hbs', '.mustache']],
            ['React Native', ['.jsx', '.tsx']],
            ['Images', ['.svg', '.jpg', '.jpeg', '.png', '.gif', '.webp']],
            ['Config Files', ['.json', '.xml', '.yaml', '.yml']],
            ['Other', []]
        ]);
    }
    dispose() {
        this.outputChannel.dispose();
        this.moduleDetector.dispose();
    }
}
exports.FileScanner = FileScanner;
//# sourceMappingURL=fileScanner.js.map