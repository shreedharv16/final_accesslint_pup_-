"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useMCPToolDefinition = exports.useMCPToolName = void 0;
exports.useMCPToolName = "UseMCPTool";
const descriptionForAgent = `Request to use a tool provided by a connected MCP server. Each MCP server can provide multiple tools with different capabilities. Tools have defined input schemas that specify required and optional parameters.`;
exports.useMCPToolDefinition = {
    name: exports.useMCPToolName,
    descriptionForAgent,
    inputSchema: {
        type: "object",
        properties: {
            server_name: {
                type: "string",
                description: "The name of the MCP server providing the tool",
            },
            tool_name: {
                type: "string",
                description: "The name of the tool to execute",
            },
            arguments: {
                type: "object",
                description: "A JSON object containing the tool's input parameters, following the tool's input schema",
            },
        },
        required: ["server_name", "tool_name", "arguments"],
    },
};
//# sourceMappingURL=useMcpTool.js.map