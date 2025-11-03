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
exports.StrictListTool = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class StrictListTool {
    constructor(context) {
        this.name = 'list_directory';
        this.context = context;
    }
    validate(params) {
        if (!params || typeof params !== 'object') {
            throw new Error('Parameters must be an object');
        }
        if (!params.path || typeof params.path !== 'string') {
            throw new Error('Missing required parameter: path (string)');
        }
        if (params.recursive !== undefined && typeof params.recursive !== 'boolean') {
            throw new Error('Parameter recursive must be a boolean');
        }
    }
    async execute(params) {
        this.validate(params);
        const { path: dirPath, recursive = false } = params;
        // Resolve relative path to absolute
        const absolutePath = path.isAbsolute(dirPath)
            ? dirPath
            : path.join(this.context.workspaceRoot, dirPath);
        // Check if directory exists
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`Directory not found: ${dirPath}`);
        }
        // Check if it's a directory
        const stats = fs.statSync(absolutePath);
        if (!stats.isDirectory()) {
            throw new Error(`Path is not a directory: ${dirPath}`);
        }
        // List directory contents
        const files = recursive
            ? this.listRecursively(absolutePath, dirPath)
            : this.listDirectory(absolutePath, dirPath);
        return {
            path: dirPath,
            files: files,
            totalCount: files.length,
            recursive: recursive
        };
    }
    listDirectory(absolutePath, relativePath) {
        const entries = fs.readdirSync(absolutePath, { withFileTypes: true });
        return entries
            .filter(entry => !entry.name.startsWith('.')) // Filter hidden files
            .map(entry => ({
            name: entry.name,
            type: entry.isDirectory() ? 'directory' : 'file',
            path: path.join(relativePath, entry.name).replace(/\\/g, '/')
        }));
    }
    listRecursively(absolutePath, relativePath) {
        const results = [];
        const processDirectory = (currentAbsolute, currentRelative) => {
            const entries = fs.readdirSync(currentAbsolute, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name.startsWith('.'))
                    continue; // Skip hidden files
                const entryPath = path.join(currentRelative, entry.name).replace(/\\/g, '/');
                const entryAbsolute = path.join(currentAbsolute, entry.name);
                results.push({
                    name: entry.name,
                    type: entry.isDirectory() ? 'directory' : 'file',
                    path: entryPath
                });
                if (entry.isDirectory()) {
                    processDirectory(entryAbsolute, entryPath);
                }
            }
        };
        processDirectory(absolutePath, relativePath);
        return results;
    }
}
exports.StrictListTool = StrictListTool;
//# sourceMappingURL=strictListTool.js.map