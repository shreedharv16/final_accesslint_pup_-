"use strict";
/**
 * Demonstration of Strict XML-only parsing like Cline
 *
 * This file shows how AccessLint now enforces strict XML format
 * for tool calls, eliminating all fallback parsing strategies.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.demonstrateStrictParsing = void 0;
const llmToolCallParser_1 = require("../llmToolCallParser");
const strictToolManager_1 = require("./strictToolManager");
// Mock context for demo
const mockContext = {
    workspaceRoot: '/demo/workspace',
    outputChannel: { appendLine: console.log },
    webviewProvider: null
};
async function demonstrateStrictParsing() {
    // Initialize strict tool manager
    const strictToolManager = new strictToolManager_1.StrictToolManager(mockContext);
    // Initialize parser with strict mode
    const parser = new llmToolCallParser_1.LLMToolCallParser([], strictToolManager);
    console.log('=== AccessLint Strict XML Parsing Demo ===\n');
    // Test 1: Valid XML format (should work)
    console.log('Test 1: Valid XML format');
    const validXML = `
I need to read a file.

<read_file>
{
  "path": "src/main.ts"
}
</read_file>

This should work perfectly!`;
    try {
        const result = parser.parseResponse(validXML);
        console.log('✅ Valid XML parsed successfully:', result.toolCalls.length, 'tool calls found');
    }
    catch (error) {
        console.log('❌ Unexpected error:', error.message);
    }
    // Test 2: Old TOOL_CALL format (should fail)
    console.log('\nTest 2: Old TOOL_CALL format (should be rejected)');
    const oldFormat = `
I need to read a file.

TOOL_CALL: read_file
INPUT: {
  "path": "src/main.ts"
}

This uses the old format.`;
    try {
        const result = parser.parseResponse(oldFormat);
        console.log('❌ Old format incorrectly accepted');
    }
    catch (error) {
        console.log('✅ Old format correctly rejected:', error.message.substring(0, 100) + '...');
    }
    // Test 3: Natural language (should fail)
    console.log('\nTest 3: Natural language (should be rejected)');
    const naturalLanguage = `
Let me read the file src/main.ts to understand the code structure.
`;
    try {
        const result = parser.parseResponse(naturalLanguage);
        console.log('❌ Natural language incorrectly accepted');
    }
    catch (error) {
        console.log('✅ Natural language correctly rejected');
    }
    // Test 4: Malformed XML (should fail with helpful error)
    console.log('\nTest 4: Malformed XML (should fail with helpful error)');
    const malformedXML = `
<read_file>
{
  "path": "src/main.ts"
  // Missing closing brace
</read_file>`;
    try {
        const result = parser.parseResponse(malformedXML);
        console.log('❌ Malformed XML incorrectly accepted');
    }
    catch (error) {
        console.log('✅ Malformed XML correctly rejected with helpful error');
        console.log('Error message preview:', error.message.substring(0, 150) + '...');
    }
    // Test 5: Unknown tool (should fail)
    console.log('\nTest 5: Unknown tool (should be rejected)');
    const unknownTool = `
<unknown_tool>
{
  "param": "value"
}
</unknown_tool>`;
    try {
        const result = parser.parseResponse(unknownTool);
        console.log('❌ Unknown tool incorrectly accepted');
    }
    catch (error) {
        console.log('✅ Unknown tool correctly rejected:', error.message.substring(0, 100) + '...');
    }
    // Test 6: Streaming support
    console.log('\nTest 6: Streaming support');
    parser.clearStreamingBuffer();
    const chunks = ['<read', '_file>', '\n{', '\n  "path":', ' "test.js"', '\n}', '\n</read_file>'];
    for (let i = 0; i < chunks.length; i++) {
        const streamResult = parser.parseStreamingChunk(chunks[i]);
        if (streamResult.hasCompleteToolCall) {
            console.log('✅ Streaming: Complete tool call detected after chunk', i + 1);
            break;
        }
    }
    console.log('\n=== Demo Complete ===');
    console.log('AccessLint now uses strict XML-only parsing like Cline!');
    console.log('- No more fallback strategies');
    console.log('- Fail-fast error handling');
    console.log('- Clear error messages with examples');
    console.log('- Mistake counter to help LLM learn');
    console.log('- Streaming support for real-time detection');
}
exports.demonstrateStrictParsing = demonstrateStrictParsing;
// Run demo if this file is executed directly
if (require.main === module) {
    demonstrateStrictParsing().catch(console.error);
}
//# sourceMappingURL=strictParsingDemo.js.map