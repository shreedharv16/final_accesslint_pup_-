"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrictToolManager = void 0;
const strictReadTool_1 = require("./strictReadTool");
const strictWriteTool_1 = require("./strictWriteTool");
const strictListTool_1 = require("./strictListTool");
class StrictToolManager {
    constructor(context) {
        this.tools = new Map();
        this.context = context;
        this.registerTools();
    }
    registerTools() {
        const readTool = new strictReadTool_1.StrictReadTool(this.context);
        const writeTool = new strictWriteTool_1.StrictWriteTool(this.context);
        const listTool = new strictListTool_1.StrictListTool(this.context);
        this.tools.set(readTool.name, readTool);
        this.tools.set(writeTool.name, writeTool);
        this.tools.set(listTool.name, listTool);
        // TODO: Add remaining tools
        // this.tools.set('grep_search', new StrictGrepTool(this.context));
        // this.tools.set('bash_command', new StrictBashTool(this.context));
        // etc.
    }
    async executeTool(toolName, params) {
        const tool = this.tools.get(toolName);
        if (!tool) {
            throw new Error(`Unknown tool: ${toolName}. Available tools: ${Array.from(this.tools.keys()).join(', ')}`);
        }
        try {
            return await tool.execute(params);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Tool ${toolName} execution failed: ${errorMessage}`);
        }
    }
    getAvailableTools() {
        return Array.from(this.tools.keys());
    }
    validateToolCall(toolName, params) {
        const tool = this.tools.get(toolName);
        if (!tool) {
            throw new Error(`Unknown tool: ${toolName}`);
        }
        tool.validate(params);
    }
    hasTool(toolName) {
        return this.tools.has(toolName);
    }
    // Get tool definitions for the LLM parser (backward compatibility)
    getToolDefinitions() {
        return Array.from(this.tools.keys()).map(name => ({ name }));
    }
}
exports.StrictToolManager = StrictToolManager;
//# sourceMappingURL=strictToolManager.js.map