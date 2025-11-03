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
exports.StrictReadTool = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class StrictReadTool {
    constructor(context) {
        this.name = 'read_file';
        this.context = context;
    }
    validate(params) {
        if (!params || typeof params !== 'object') {
            throw new Error('Parameters must be an object');
        }
        if (!params.path || typeof params.path !== 'string') {
            throw new Error('Missing required parameter: path (string)');
        }
        if (params.limit !== undefined && (typeof params.limit !== 'number' || params.limit <= 0)) {
            throw new Error('Parameter limit must be a positive number');
        }
        if (params.offset !== undefined && (typeof params.offset !== 'number' || params.offset <= 0)) {
            throw new Error('Parameter offset must be a positive number');
        }
    }
    async execute(params) {
        this.validate(params);
        const { path: filePath, limit, offset } = params;
        // Resolve relative path to absolute
        const absolutePath = path.isAbsolute(filePath)
            ? filePath
            : path.join(this.context.workspaceRoot, filePath);
        // Check if file exists
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        // Check if it's a file (not directory)
        const stats = fs.statSync(absolutePath);
        if (!stats.isFile()) {
            throw new Error(`Path is not a file: ${filePath}`);
        }
        // Read file content
        const content = fs.readFileSync(absolutePath, 'utf8');
        const lines = content.split('\n');
        // Apply offset and limit
        const startLine = (offset || 1) - 1; // Convert to 0-based index
        const endLine = limit ? startLine + limit : lines.length;
        const selectedLines = lines.slice(startLine, endLine);
        const resultContent = selectedLines.join('\n');
        return {
            content: resultContent,
            path: filePath,
            totalLines: lines.length,
            linesShown: selectedLines.length,
            startLine: startLine + 1,
            endLine: Math.min(endLine, lines.length),
            isTruncated: endLine < lines.length
        };
    }
}
exports.StrictReadTool = StrictReadTool;
//# sourceMappingURL=strictReadTool.js.map