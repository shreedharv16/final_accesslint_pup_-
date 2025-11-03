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
exports.StrictWriteTool = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class StrictWriteTool {
    constructor(context) {
        this.name = 'write_file';
        this.context = context;
    }
    validate(params) {
        if (!params || typeof params !== 'object') {
            throw new Error('Parameters must be an object');
        }
        if (!params.path || typeof params.path !== 'string') {
            throw new Error('Missing required parameter: path (string)');
        }
        if (!params.content || typeof params.content !== 'string') {
            throw new Error('Missing required parameter: content (string)');
        }
    }
    async execute(params) {
        this.validate(params);
        const { path: filePath, content } = params;
        // Resolve relative path to absolute
        const absolutePath = path.isAbsolute(filePath)
            ? filePath
            : path.join(this.context.workspaceRoot, filePath);
        // Create directory if it doesn't exist
        const directory = path.dirname(absolutePath);
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }
        // Write file content
        fs.writeFileSync(absolutePath, content, 'utf8');
        return {
            success: true,
            path: filePath,
            bytesWritten: Buffer.byteLength(content, 'utf8'),
            message: `Successfully wrote ${Buffer.byteLength(content, 'utf8')} bytes to ${filePath}`
        };
    }
}
exports.StrictWriteTool = StrictWriteTool;
//# sourceMappingURL=strictWriteTool.js.map