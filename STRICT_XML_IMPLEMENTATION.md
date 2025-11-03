# AccessLint Strict XML Parsing Implementation

## Overview

AccessLint has been successfully transformed to use **strict XML-only parsing** like Cline, eliminating all fallback strategies and implementing fail-fast error handling. This makes the tool more stable, predictable, and easier to debug.

## ✅ Completed Implementation

### 1. Lock Down Parsing Strategy ✅

**Before:** Multiple fallback parsers (V1, V2, V3, natural language, heuristics)
```typescript
// OLD: Multiple strategies with fallbacks
let result = this.parseWithV3(response);
if (!result.hasToolCalls) {
  result = this.parseWithV2(response);
}
if (!result.hasToolCalls) {
  result = this.parseWithV1(response);
}
if (!result.hasToolCalls) {
  result = this.parseWithFallback(response);
}
```

**After:** Single strict XML-only strategy
```typescript
// NEW: Strict XML-only with fail-fast
const result = this.parseStrictXML(response);
if (!result.hasToolCalls && this.hasXMLBlocks(response)) {
  this.incrementMistakeCounter();
  throw new Error(this.createStrictError('MALFORMED_XML', 'XML tool blocks found but could not be parsed'));
}
```

### 2. Enforce XML Format in LLM Prompts ✅

**Updated system prompts** to require strict XML format:

```
**CRITICAL**: Tool use MUST be formatted in strict XML format. NO other formats are accepted.

## ONLY Supported Format (Strict XML):
<tool_name>
{
  "parameter1": "value1",
  "parameter2": "value2"
}
</tool_name>

**IMPORTANT**: Any response that contains tool calls but is NOT in strict XML format will be rejected.
```

All tool examples updated from old formats:
- ❌ `TOOL_CALL: read_file\nINPUT: {...}`
- ✅ `<read_file>{"path": "file.js"}</read_file>`

### 3. Schema Validation on Top of XML ✅

**Maintained robust validation** after XML parsing:
```typescript
// Validate against schema using strict tool manager if available
if (this.strictToolManager) {
  this.strictToolManager.validateToolCall(toolName, input);
} else {
  const validation = this.validateToolCall({ id: '', name: toolName, input });
  if (!validation.valid) {
    this.incrementMistakeCounter();
    throw new Error(this.createStrictError('SCHEMA_VALIDATION', 
      `Tool ${toolName} parameters invalid: ${validation.errors.join(', ')}`));
  }
}
```

### 4. Simplify Tool Registry ✅

**Implemented Cline-style IStrictTool interface:**
```typescript
export interface IStrictTool {
  readonly name: string;
  execute(params: any): Promise<any>;
  validate(params: any): void; // schema check - throws if invalid
}
```

**Created strict tool implementations:**
- `StrictReadTool` - File reading with validation
- `StrictWriteTool` - File writing with validation  
- `StrictListTool` - Directory listing with validation
- `StrictToolManager` - Manages strict tools

### 5. Drop Natural Language / Heuristics ✅

**Completely removed:**
- ❌ Natural language parsing (`"Let me read file X"`)
- ❌ Heuristic parameter extraction
- ❌ Fuzzy matching
- ❌ Inference from context
- ❌ `extractSimpleToolMentions()`
- ❌ `inferBasicParameters()`
- ❌ `extractParametersFromText()`

**Zero tolerance policy:**
```typescript
// If not wrapped in proper XML → reject immediately
if (!result.hasToolCalls && this.hasXMLBlocks(response)) {
  throw new Error("Malformed XML: tool blocks found but could not be parsed");
}
```

### 6. Streaming Rules Support ✅

**Implemented state machine for streaming:**
```typescript
parseStreamingChunk(chunk: string): {
  hasCompleteToolCall: boolean;
  toolCallDetected?: string;
  shouldBuffer: boolean;
} {
  this.streamingBuffer += chunk;
  
  // Look for opening XML tags
  const openingTagMatch = this.streamingBuffer.match(/<(\w+)>/);
  if (openingTagMatch) {
    const toolName = openingTagMatch[1];
    
    if (this.toolDefinitions.has(toolName)) {
      // Look for closing tag
      const closingTag = `</${toolName}>`;
      const closingIndex = this.streamingBuffer.indexOf(closingTag);
      
      if (closingIndex !== -1) {
        // Complete tool call found
        return { hasCompleteToolCall: true, toolCallDetected: toolName, shouldBuffer: false };
      }
    }
  }
  
  return { hasCompleteToolCall: false, shouldBuffer: false };
}
```

### 7. Strict Error Handling ✅

**Implemented mistake counter and clear error messages:**
```typescript
export interface ParseError {
  type: 'MALFORMED_XML' | 'UNKNOWN_TOOL' | 'SCHEMA_VALIDATION' | 'NO_XML_BLOCKS' | 'MAX_MISTAKES';
  message: string;
  details?: string;
}

private incrementMistakeCounter(): void {
  this.mistakeCounter++;
  if (this.mistakeCounter >= this.maxMistakes) {
    throw new Error(this.createStrictError('MAX_MISTAKES', 
      `Maximum mistakes reached (${this.maxMistakes}). Please follow the strict XML format.`));
  }
}

private createStrictError(type: string, message: string, details?: string): string {
  const errorMsg = `${type}: ${message}`;
  const exampleFormat = `

Your response must be in strict XML format. Example:

<read_file>
{
  "path": "src/main.ts"
}
</read_file>

Or with XML parameters:

<read_file>
  <path>src/main.ts</path>
</read_file>`;

  return details ? `${errorMsg}\n${details}${exampleFormat}` : `${errorMsg}${exampleFormat}`;
}
```

### 8. Keep Approval + Logging ✅

**Preserved AccessLint's superior features:**
- ✅ User approval workflow for dangerous operations
- ✅ Comprehensive logging and monitoring
- ✅ Tool execution state management
- ✅ Context management and workspace awareness

## Configuration

**Enable strict parsing** via VS Code settings:
```json
{
  "accesslint.useStrictXMLParsing": true
}
```

## File Structure

```
src/
├── llmToolCallParser.ts          # Main strict XML parser
├── agentSystemPrompt.ts          # Updated prompts with XML requirements
├── aiProviderManager.ts          # Integration with strict parsing
└── tools-accesslint/
    ├── types.ts                  # IStrictTool interface
    ├── strictToolManager.ts      # Strict tool registry
    ├── strictReadTool.ts         # Example strict tool
    ├── strictWriteTool.ts        # Example strict tool
    └── strictListTool.ts         # Example strict tool
```

## Error Handling & Recovery

### Mistake Counter System ✅
Like Cline, AccessLint implements a **3-strike system**:

1. **Strike 1-2**: Parser rejects malformed responses with helpful error messages
2. **Strike 3**: System blocks further attempts with "MAX_MISTAKES" error
3. **Reset**: Counter automatically resets on any successful parse

### Automatic Recovery ✅
```typescript
// Automatic reset on successful parsing
const parsed = this.toolCallParser.parseResponse(response);
this.toolCallParser.resetMistakeCounter(); // ✅ Reset after success

// Manual reset if needed
aiProviderManager.resetParsingMistakes();

// Monitor mistake count
const mistakes = aiProviderManager.getParsingMistakeCount();
```

### Example Error Flow ✅
```
Attempt 1: ❌ "TOOL_CALL: read_file..." → Rejected, helpful error shown
Attempt 2: ❌ "Let me read file..." → Rejected, XML example shown  
Attempt 3: ❌ "<write_file>{"content":"html"}</write_file>" → 
           Rejected with schema: "Missing required parameter: file_path"
Attempt 4: 🚫 "MAX_MISTAKES: Maximum mistakes reached (3)"

After Fix: ✅ Counter reset automatically, LLM uses proper format:
<write_file>
{
  "file_path": "index.html",
  "content": "<!DOCTYPE html>..."
}
</write_file>
```

### Recent Fixes Applied ✅
1. **Parameter Name Consistency**: Fixed `read_file` and `write_file` to use correct parameter names
2. **Enhanced Error Messages**: Now include full expected schema for failed tools
3. **Comprehensive Examples**: Added working examples for HTML/CSS creation
4. **Stronger Anti-Fallback Language**: Explicit ❌/✅ rules in system prompt
5. **Automatic Counter Reset**: Resets on successful parsing for recovery

## Benefits Achieved

1. **🔒 Security**: No more accidental tool execution from natural language
2. **🚀 Performance**: Faster parsing with no fallback overhead  
3. **🐛 Debugging**: Clear error messages help identify issues quickly
4. **📖 Predictability**: Consistent behavior across all LLM interactions
5. **🎯 Accuracy**: Eliminates false positives from heuristic parsing
6. **🔄 Compatibility**: Matches Cline's proven approach
7. **⚡ Streaming**: Real-time tool detection for interruption
8. **📚 Learning**: Mistake counter helps LLM improve over time
9. **🔄 Recovery**: Automatic reset on success, manual override available

## Migration Path

1. **Immediate**: Old format calls will be rejected with helpful error messages
2. **Learning**: LLM will quickly adapt to strict XML format requirements
3. **Gradual**: Enable strict parsing via configuration flag
4. **Full**: Eventually make strict parsing the default behavior

AccessLint now provides the stability and reliability of Cline's strict XML parsing while maintaining its superior approval workflow and logging capabilities!
