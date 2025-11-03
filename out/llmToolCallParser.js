"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMToolCallParser = void 0;
class LLMToolCallParser {
    constructor(tools, strictToolManager) {
        this.toolDefinitions = new Map();
        this.mistakeCounter = 0;
        this.maxMistakes = 3;
        this.streamingBuffer = '';
        tools.forEach(tool => {
            this.toolDefinitions.set(tool.name, tool);
        });
        this.strictToolManager = strictToolManager;
    }
    /**
     * Parse LLM response to extract tool calls and regular text (enhanced like Cline)
     * Uses Cline's V1, V2, V3 parser strategy for maximum compatibility
     */
    parseResponse(response) {
        if (!response || response.trim().length === 0) {
            return { text: '', toolCalls: [], hasToolCalls: false };
        }
        try {
            // Only allow XML parsing - no fallbacks
            const result = this.parseStrictXML(response);
            if (!result.hasToolCalls && this.hasXMLBlocks(response)) {
                // XML blocks exist but parsing failed - this is an error
                this.incrementMistakeCounter();
                throw new Error(this.createStrictError('MALFORMED_XML', 'XML tool blocks found but could not be parsed'));
            }
            return result;
        }
        catch (error) {
            // Fail fast - no fallback parsing
            throw error instanceof Error ? error : new Error(String(error));
        }
    }
    /**
     * Strict XML-only parser (Cline-style)
     * Only accepts proper XML format: <tool_name>...</tool_name>
     */
    parseStrictXML(response) {
        const toolCalls = [];
        let cleanText = response;
        // Only allow strict XML format: <tool_name>parameters</tool_name>
        const xmlMatches = [...response.matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g)];
        for (const match of xmlMatches) {
            const toolName = match[1].trim();
            const content = match[2].trim();
            // Check if this is a valid tool
            if (!this.toolDefinitions.has(toolName)) {
                this.incrementMistakeCounter();
                throw new Error(this.createStrictError('UNKNOWN_TOOL', `Unknown tool: ${toolName}`, `Available tools: ${Array.from(this.toolDefinitions.keys()).join(', ')}`));
            }
            try {
                let input;
                // Try to parse as JSON first
                const jsonMatch = content.match(/^\s*\{[\s\S]*\}\s*$/);
                if (jsonMatch) {
                    input = this.parseJsonSafely(content);
                    if (input === null) {
                        throw new Error('Invalid JSON in tool parameters');
                    }
                }
                else {
                    // Parse XML parameters
                    input = this.parseXmlParameters(content);
                }
                // Validate against schema using strict tool manager if available
                if (this.strictToolManager) {
                    this.strictToolManager.validateToolCall(toolName, input);
                }
                else {
                    const validation = this.validateToolCall({ id: '', name: toolName, input });
                    if (!validation.valid) {
                        this.incrementMistakeCounter();
                        const toolSchema = this.getToolSchema(toolName);
                        throw new Error(this.createStrictError('SCHEMA_VALIDATION', `Tool ${toolName} parameters invalid: ${validation.errors.join(', ')}`, toolSchema));
                    }
                }
                toolCalls.push({
                    id: this.generateId(),
                    name: toolName,
                    input: input
                });
                cleanText = cleanText.replace(match[0], '');
            }
            catch (error) {
                this.incrementMistakeCounter();
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(this.createStrictError('MALFORMED_XML', `Failed to parse tool ${toolName}: ${errorMessage}`));
            }
        }
        return {
            text: cleanText.replace(/\n{3,}/g, '\n\n').trim(),
            toolCalls: toolCalls,
            hasToolCalls: toolCalls.length > 0
        };
    }
    /**
     * Check if response contains XML tool blocks
     */
    hasXMLBlocks(response) {
        return /<\w+>[\s\S]*?<\/\w+>/.test(response);
    }
    /**
     * Increment mistake counter and check if max reached
     */
    incrementMistakeCounter() {
        this.mistakeCounter++;
        if (this.mistakeCounter >= this.maxMistakes) {
            throw new Error(this.createStrictError('MAX_MISTAKES', `Maximum mistakes reached (${this.maxMistakes}). Please follow the strict XML format.`));
        }
    }
    /**
     * Create strict error message
     */
    createStrictError(type, message, details) {
        const errorMsg = `${type}: ${message}`;
        const exampleFormat = `

Your response must be in strict XML format. Examples:

<read_file>
{
  "file_path": "src/main.ts"
}
</read_file>

<write_file>
{
  "file_path": "index.html",
  "content": "<!DOCTYPE html>\\n<html>\\n<body>\\n<h1>Hello World</h1>\\n</body>\\n</html>"
}
</write_file>

<list_directory>
{
  "path": ".",
  "recursive": false
}
</list_directory>

❌ NO other formats accepted: no TOOL_CALL:, no function(), no natural language
✅ ALWAYS include ALL required parameters
✅ ALWAYS use exact parameter names as shown above`;
        return details ? `${errorMsg}\n${details}${exampleFormat}` : `${errorMsg}${exampleFormat}`;
    }
    /**
     * Reset mistake counter (called when LLM succeeds)
     */
    resetMistakeCounter() {
        this.mistakeCounter = 0;
    }
    /**
     * Get current mistake count
     */
    getMistakeCount() {
        return this.mistakeCounter;
    }
    /**
     * Get schema information for a specific tool
     */
    getToolSchema(toolName) {
        const toolDef = this.toolDefinitions.get(toolName);
        if (!toolDef) {
            return `Tool ${toolName} not found.`;
        }
        const required = toolDef.inputSchema.required || [];
        const properties = toolDef.inputSchema.properties || {};
        const schemaExample = {};
        for (const param of required) {
            if (properties[param]) {
                schemaExample[param] = properties[param].type === 'string' ? 'value' :
                    properties[param].type === 'number' ? 0 :
                        properties[param].type === 'boolean' ? false : 'value';
            }
        }
        return `Expected schema for ${toolName}:
<${toolName}>
${JSON.stringify(schemaExample, null, 2)}
</${toolName}>

Required parameters: ${required.join(', ')}`;
    }
    /**
     * Parse streaming response chunk (for real-time tool detection like Cline)
     * State machine for <tool> ... </tool> while stream is coming in
     */
    parseStreamingChunk(chunk) {
        this.streamingBuffer += chunk;
        // Look for opening XML tags
        const openingTagMatch = this.streamingBuffer.match(/<(\w+)>/);
        if (openingTagMatch) {
            const toolName = openingTagMatch[1];
            // Check if it's a valid tool
            if (this.toolDefinitions.has(toolName)) {
                // Look for closing tag
                const closingTag = `</${toolName}>`;
                const closingIndex = this.streamingBuffer.indexOf(closingTag);
                if (closingIndex !== -1) {
                    // Complete tool call found
                    const fullToolCall = this.streamingBuffer.substring(0, closingIndex + closingTag.length);
                    // Remove processed part from buffer
                    this.streamingBuffer = this.streamingBuffer.substring(closingIndex + closingTag.length);
                    return {
                        hasCompleteToolCall: true,
                        toolCallDetected: toolName,
                        shouldBuffer: false
                    };
                }
                else {
                    // Incomplete tool call, keep buffering
                    return {
                        hasCompleteToolCall: false,
                        toolCallDetected: toolName,
                        shouldBuffer: true
                    };
                }
            }
        }
        // No tool detection, ignore text outside XML blocks
        // Keep only potential start of XML tags in buffer
        const lastAngleBracket = this.streamingBuffer.lastIndexOf('<');
        if (lastAngleBracket > 0) {
            this.streamingBuffer = this.streamingBuffer.substring(lastAngleBracket);
        }
        return {
            hasCompleteToolCall: false,
            shouldBuffer: false
        };
    }
    /**
     * Clear streaming buffer
     */
    clearStreamingBuffer() {
        this.streamingBuffer = '';
    }
    /**
     * Parse XML-style parameters
     */
    parseXmlParameters(content) {
        const params = {};
        // Extract parameter tags
        const paramPattern = /<(\w+)>([\s\S]*?)<\/\1>/g;
        let match;
        while ((match = paramPattern.exec(content)) !== null) {
            const paramName = match[1];
            let paramValue = match[2].trim();
            // Try to parse as JSON
            if (paramValue.startsWith('{') || paramValue.startsWith('[')) {
                try {
                    paramValue = JSON.parse(paramValue);
                }
                catch {
                    // Keep as string
                }
            }
            params[paramName] = paramValue;
        }
        return params;
    }
    /**
     * Generate unique ID for tool calls
     */
    generateId() {
        return `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Validate tool call against schema
     */
    validateToolCall(toolCall) {
        const toolDef = this.toolDefinitions.get(toolCall.name);
        if (!toolDef) {
            return { valid: false, errors: [`Unknown tool: ${toolCall.name}`] };
        }
        const errors = [];
        const required = toolDef.inputSchema.required || [];
        // Check required parameters
        for (const requiredParam of required) {
            if (!(requiredParam in toolCall.input)) {
                errors.push(`Missing required parameter: ${requiredParam}`);
            }
        }
        // Basic type checking
        const properties = toolDef.inputSchema.properties || {};
        for (const [param, value] of Object.entries(toolCall.input)) {
            const propDef = properties[param];
            if (propDef && propDef.type) {
                const expectedType = propDef.type;
                const actualType = typeof value;
                if (expectedType === 'string' && actualType !== 'string') {
                    errors.push(`Parameter ${param} should be a string, got ${actualType}`);
                }
                else if (expectedType === 'number' && actualType !== 'number') {
                    errors.push(`Parameter ${param} should be a number, got ${actualType}`);
                }
                else if (expectedType === 'boolean' && actualType !== 'boolean') {
                    errors.push(`Parameter ${param} should be a boolean, got ${actualType}`);
                }
            }
        }
        return { valid: errors.length === 0, errors };
    }
    /**
     * Update available tools
     */
    updateTools(tools) {
        this.toolDefinitions.clear();
        tools.forEach(tool => {
            this.toolDefinitions.set(tool.name, tool);
        });
    }
    /**
     * Get available tool names
     */
    getAvailableTools() {
        return Array.from(this.toolDefinitions.keys());
    }
    /**
     * Safely parse JSON with error handling and enhanced multiline support
     */
    parseJsonSafely(jsonStr) {
        if (!jsonStr || jsonStr.trim().length === 0) {
            return null;
        }
        // Clean up the JSON string first - handle multiline formatting
        let cleanedJson = jsonStr.trim();
        // Remove any leading/trailing whitespace and ensure proper JSON boundaries
        if (cleanedJson.startsWith('{') && cleanedJson.endsWith('}')) {
            // Already properly formatted
        }
        else {
            // Try to extract JSON from mixed content
            const jsonMatch = cleanedJson.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanedJson = jsonMatch[0];
            }
        }
        try {
            return JSON.parse(cleanedJson);
        }
        catch (error) {
            // Try to fix common JSON issues with more aggressive cleaning
            const cleaned = cleanedJson
                .replace(/'/g, '"') // Single quotes to double quotes
                .replace(/(\w+):/g, '"$1":') // Unquoted keys
                .replace(/,\s*}/g, '}') // Trailing commas in objects
                .replace(/,\s*]/g, ']') // Trailing commas in arrays
                .replace(/\n\s*/g, ' ') // Replace newlines and indentation with spaces
                .replace(/\s+/g, ' ') // Normalize multiple spaces
                .trim();
            try {
                return JSON.parse(cleaned);
            }
            catch (secondError) {
                // Final attempt: try to extract valid JSON more aggressively
                try {
                    // Handle cases where JSON might be embedded in other text
                    const bracesMatch = cleaned.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
                    if (bracesMatch) {
                        return JSON.parse(bracesMatch[0]);
                    }
                }
                catch (thirdError) {
                    console.warn('Failed to parse JSON after all attempts:', jsonStr.substring(0, 200), secondError);
                    return null;
                }
                return null;
            }
        }
    }
    /**
     * Get parser statistics for monitoring
     */
    getParserStats() {
        return {
            mistakeCount: this.mistakeCounter,
            toolsRegistered: this.toolDefinitions.size,
            supportedFormats: ['strict_xml_only']
        };
    }
}
exports.LLMToolCallParser = LLMToolCallParser;
//# sourceMappingURL=llmToolCallParser.js.map