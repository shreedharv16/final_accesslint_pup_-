"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webFetchToolDefinition = exports.webFetchToolName = void 0;
exports.webFetchToolName = "WebFetch";
const descriptionForAgent = `
- Fetches content from a specified URL and processes into markdown
- Takes a URL as input
- Fetches the URL content, converts HTML to markdown
- Use this tool when you need to retrieve and analyze web content

Usage notes:
  - IMPORTANT: If an MCP-provided web fetch tool is available, prefer using that tool instead of this one, as it may have fewer restrictions.
  - The URL must be a fully-formed valid URL
  - HTTP URLs will be automatically upgraded to HTTPS
  - This tool is read-only and does not modify any files
`;
exports.webFetchToolDefinition = {
    name: exports.webFetchToolName,
    descriptionForAgent,
    inputSchema: {
        type: "object",
        properties: {
            url: {
                type: "string",
                format: "url",
                description: "The URL to fetch content from",
            },
        },
        required: ["url"],
    },
};
//# sourceMappingURL=webFetchTool.js.map