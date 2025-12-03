# AccessLint Agent Mode - Complete Workflow Documentation

## 📋 Table of Contents

1. [Overview](#overview)
2. [High-Level Flow Diagram](#high-level-flow-diagram)
3. [Step-by-Step Workflow](#step-by-step-workflow)
4. [Detailed Component Breakdown](#detailed-component-breakdown)
5. [Tool Selection & Execution](#tool-selection--execution)
6. [Attempt Completion Flow](#attempt-completion-flow)
7. [Error Handling & Recovery](#error-handling--recovery)
8. [Sequence Diagrams](#sequence-diagrams)

---

## 🎯 Overview

The Agent Mode workflow consists of **6 main phases**:

```
User Query → Session Init → Agent Loop → Tool Execution → AI Analysis → Completion
```

The AI decides which tools to call based on the task, executes them **locally** on the user's machine, and iterates until the task is complete.

---

## 🔄 High-Level Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER'S VS CODE                                  │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │ 1. USER TYPES QUERY                                                   │  │
│   │    "Create a React component for a login form with accessibility"     │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                      ↓                                       │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │ 2. CHAT WEBVIEW → EXTENSION                                           │  │
│   │    postMessage({ type: 'sendMessage', message: '...', mode: 'agent'}) │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                      ↓                                       │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │ 3. AGENT ORCHESTRATOR STARTS SESSION                                  │  │
│   │    agentLLMOrchestrator.startSession(goal, provider)                  │  │
│   │    - Creates session ID                                               │  │
│   │    - Initializes conversation history                                 │  │
│   │    - Creates todo list                                                │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                      ↓                                       │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │ 4. AGENT LOOP (Max 15 iterations)                                     │  │
│   │    ┌─────────────────────────────────────────────────────────────┐   │  │
│   │    │  a) Build conversation with context                          │   │  │
│   │    │  b) Send to AI (Azure OpenAI GPT-5)                          │   │  │
│   │    │  c) Parse AI response for tool calls                         │   │  │
│   │    │  d) Execute tools locally                                    │   │  │
│   │    │  e) Add results to conversation                              │   │  │
│   │    │  f) Check for completion                                     │   │  │
│   │    │  g) Repeat if not complete                                   │   │  │
│   │    └─────────────────────────────────────────────────────────────┘   │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                      ↓                                       │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │ 5. ATTEMPT_COMPLETION TOOL CALLED                                     │  │
│   │    - AI generates summary of what was accomplished                    │  │
│   │    - Results sent to webview                                          │  │
│   │    - Session marked as complete                                       │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                      ↓                                       │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │ 6. DISPLAY RESULTS IN UI                                              │  │
│   │    - Chat shows completion message                                    │  │
│   │    - Files created/modified shown                                     │  │
│   │    - Todo list updated                                                │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📝 Step-by-Step Workflow

### **Phase 1: User Input**

```
┌─────────────────────────────────────────────────────────────────┐
│ User types in Chat Webview:                                     │
│ "Create a React component for a login form with accessibility"  │
│                                                                 │
│ [Agent Mode Toggle: ON]  [Send Button]                          │
└─────────────────────────────────────────────────────────────────┘
```

**File:** `webviews/chat.js`

```javascript
// User clicks send or presses Enter
sendButton.onclick = () => {
    const message = userInput.value.trim();
    const mode = 'agent';  // Agent mode selected
    
    // Send to extension
    vscode.postMessage({
        type: 'sendMessage',
        message: message,
        mode: mode,
        provider: 'openai'
    });
};
```

---

### **Phase 2: Extension Receives Message**

**File:** `src/chatWebviewProvider.ts`

```typescript
// Line ~350-400
webviewView.webview.onDidReceiveMessage(async (message) => {
    switch (message.type) {
        case 'sendMessage':
            if (message.mode === 'agent') {
                // Agent mode - start orchestrator
                await this._handleAgentMode(message.message, message.provider);
            } else {
                // Quick mode - call backend directly
                await this._handleUserMessage(message.message, 'quick', message.provider);
            }
            break;
    }
});
```

```typescript
private async _handleAgentMode(userMessage: string, provider: string) {
    // Display user message in UI
    this._view?.webview.postMessage({
        type: 'userMessage',
        message: userMessage
    });

    // Show "Agent is thinking..." indicator
    this._view?.webview.postMessage({
        type: 'agentThinking',
        message: '🤖 Agent analyzing your request...'
    });

    // Start agent session
    const sessionId = await this.agentOrchestrator.startSession(userMessage, provider as any);
    
    // Note: The orchestrator runs asynchronously and sends updates via callbacks
}
```

---

### **Phase 3: Agent Session Initialization**

**File:** `src/agentLLMOrchestrator.ts`

```typescript
// Line ~110-210
async startSession(goal: string, provider: AiProvider = 'openai'): Promise<string> {
    // Create unique session ID
    const sessionId = Date.now().toString();
    
    // Initialize session state
    this.currentSession = {
        id: sessionId,
        goal: goal,
        messages: [],
        status: 'active',
        iterations: 0,
        startTime: new Date()
    };

    this.outputChannel.appendLine(`🤖 Agent Session Started: ${goal}`);
    this.outputChannel.appendLine(`🔧 Using provider: ${provider}`);

    // Create todo list for this task
    try {
        const todoList = await this.todoListManager.createTodoList(goal, sessionId, provider);
        this.outputChannel.appendLine(`📋 Todo list created with ${todoList.items.length} items`);
        
        // Send todo list to UI
        this.notifyTodoListCreated(todoList);
    } catch (error) {
        this.outputChannel.appendLine(`⚠️ Failed to create todo list: ${error}`);
    }

    // Add system prompt to conversation
    this.currentSession.messages.push({
        role: 'system',
        content: this.createSystemPrompt()  // From agentSystemPrompt.ts
    });

    // Add user goal with GPT-5 specific instructions
    this.currentSession.messages.push({
        role: 'user',
        content: `${goal}

CRITICAL FOR GPT-5: You MUST respond with XML tool calls, NOT JSON objects.

**ITERATION 1**: Explore + Read
<list_directory path="src">
<read_file file_path="src/App.js">

**ITERATION 2**: IMPLEMENT
<write_file> or <edit_file>
<attempt_completion>`
    });

    // Start the agent loop (async)
    this.runAgentLoop().catch(error => {
        this.outputChannel.appendLine(`❌ Agent error: ${error.message}`);
        this.currentSession.status = 'error';
    });

    return sessionId;
}
```

---

### **Phase 4: The Agent Loop**

**File:** `src/agentLLMOrchestrator.ts`

```typescript
// Line ~400-600 (simplified)
private async runAgentLoop(): Promise<void> {
    const maxIterations = 15;

    while (this.currentSession?.status === 'active' && 
           this.currentSession.iterations < maxIterations) {
        
        this.currentSession.iterations++;
        this.outputChannel.appendLine(`\n🔄 Agent iteration ${this.currentSession.iterations}`);

        try {
            // ═══════════════════════════════════════════════════════════
            // STEP 1: Request AI Response
            // ═══════════════════════════════════════════════════════════
            const aiResponse = await this.requestLLMResponse();
            
            this.outputChannel.appendLine(`📝 AI Response received (${aiResponse.text.length} chars)`);

            // ═══════════════════════════════════════════════════════════
            // STEP 2: Parse Tool Calls from Response
            // ═══════════════════════════════════════════════════════════
            const toolCalls = this.parseToolCalls(aiResponse.text);
            
            if (toolCalls.length === 0) {
                this.outputChannel.appendLine('⚠️ No tool calls detected in response');
                
                // Check if AI wants to complete without explicit tool call
                if (this.shouldForceCompletion()) {
                    this.outputChannel.appendLine('🎯 Forcing completion');
                    break;
                }
                continue;
            }

            this.outputChannel.appendLine(`🔧 Found ${toolCalls.length} tool call(s)`);

            // ═══════════════════════════════════════════════════════════
            // STEP 3: Check for Infinite Loop
            // ═══════════════════════════════════════════════════════════
            const loopDetection = this.detectInfiniteLoop(toolCalls);
            if (loopDetection.isLoop) {
                this.outputChannel.appendLine(`🚫 Loop detected: ${loopDetection.reason}`);
                
                // Force completion
                await this.forceCompletion(loopDetection.suggestion);
                break;
            }

            // ═══════════════════════════════════════════════════════════
            // STEP 4: Execute Tools
            // ═══════════════════════════════════════════════════════════
            const toolResults = await this.executeToolCalls(toolCalls);
            
            // Log results
            toolResults.forEach((result, i) => {
                const status = result.success ? '✅' : '❌';
                this.outputChannel.appendLine(`${status} Tool ${i+1}: ${toolCalls[i].name}`);
            });

            // ═══════════════════════════════════════════════════════════
            // STEP 5: Check for Completion
            // ═══════════════════════════════════════════════════════════
            const completionTool = toolCalls.find(tc => tc.name === 'attempt_completion');
            if (completionTool) {
                this.outputChannel.appendLine('🎉 Task completed!');
                this.currentSession.status = 'completed';
                
                // Send completion message to UI
                this.notifyCompletion(completionTool.input.result);
                break;
            }

            // ═══════════════════════════════════════════════════════════
            // STEP 6: Add Results to Conversation
            // ═══════════════════════════════════════════════════════════
            this.currentSession.messages.push({
                role: 'assistant',
                content: aiResponse.text,
                toolCalls: toolCalls
            });

            this.currentSession.messages.push({
                role: 'user',
                content: this.formatToolResults(toolResults)
            });

        } catch (error) {
            this.outputChannel.appendLine(`❌ Iteration error: ${error}`);
            // Continue to next iteration or fail
        }
    }

    // Final cleanup
    if (this.currentSession?.status === 'active') {
        this.outputChannel.appendLine('⏱️ Max iterations reached');
        this.currentSession.status = 'completed';
    }
}
```

---

### **Phase 5: AI Request & Response**

**File:** `src/agentLLMOrchestrator.ts`

```typescript
// Line ~865-885
private async requestLLMResponse(): Promise<AiResponse> {
    // Apply context management (truncate if too long)
    const optimizedMessages = await this.applyContextManagement(this.currentSession.messages);
    
    // Format conversation for AI
    const conversationText = this.formatConversation(optimizedMessages);
    
    // Log token estimate
    const tokenCount = conversationText.length / 4;
    this.outputChannel.appendLine(`📊 Sending: ${optimizedMessages.length} messages, ~${tokenCount} tokens`);
    
    // Call AI provider (GPT-5)
    try {
        this.outputChannel.appendLine(`🔧 Using tools-enabled API...`);
        return await this.aiProviderManager.sendMessageWithTools(conversationText, 'openai');
    } catch (error) {
        this.outputChannel.appendLine(`⚠️ Tools API failed, trying regular API...`);
        return await this.aiProviderManager.sendMessage(conversationText, 'openai');
    }
}
```

**File:** `src/openaiChat.ts`

```typescript
// Line ~80-150 (simplified)
async sendMessage(message: string, model: string = 'gpt-5'): Promise<string> {
    // Build conversation with history
    const fullConversation = [...this.conversationHistory, { role: 'user', content: message }];

    // Azure OpenAI endpoint (hardcoded)
    const endpoint = `https://ctonpsiotspocopenai.openai.azure.com/openai/deployments/gpt-5/chat/completions?api-version=2025-01-01-preview`;
    
    // API call
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'api-key': this.apiKey,  // Hardcoded in apiKeyManager.ts
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messages: fullConversation,
            max_completion_tokens: 128000
        })
    });

    const data = await response.json();
    return data.choices[0].message.content;
}
```

---

### **Phase 6: Tool Call Parsing**

**File:** `src/llmToolCallParser.ts`

The AI responds with XML-formatted tool calls:

```xml
<!-- Example AI Response -->
<thinking>
I need to explore the project structure first, then create the login form.
Let me start by listing the src directory.
</thinking>

<list_directory>
{"path": "src"}
</list_directory>

<read_file>
{"file_path": "src/App.tsx"}
</read_file>
```

**Parser Logic:**

```typescript
// Line ~50-150 (simplified)
parseToolCalls(aiResponse: string): ParsedToolCall[] {
    const toolCalls: ParsedToolCall[] = [];
    
    // Regex to match tool XML tags
    const toolPatterns = [
        /<(read_file|write_file|edit_file|list_directory|grep_search|bash_command|attempt_completion)>\s*([\s\S]*?)\s*<\/\1>/gi,
        /<(read_file|write_file|edit_file|list_directory|grep_search|bash_command|attempt_completion)>([\s\S]*?)<\/\1>/gi
    ];

    for (const pattern of toolPatterns) {
        let match;
        while ((match = pattern.exec(aiResponse)) !== null) {
            const toolName = match[1].toLowerCase();
            const inputStr = match[2].trim();
            
            try {
                // Parse JSON input
                const input = JSON.parse(inputStr);
                
                toolCalls.push({
                    id: `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: toolName,
                    input: input
                });
            } catch (e) {
                // Try XML parameter format
                const input = this.parseXMLParams(inputStr);
                if (input) {
                    toolCalls.push({ id: `tool-${Date.now()}`, name: toolName, input });
                }
            }
        }
    }

    return toolCalls;
}
```

---

### **Phase 7: Tool Execution**

**File:** `src/agentLLMOrchestrator.ts`

```typescript
// Line ~978-1155 (simplified)
private async executeToolCalls(toolCalls: Array<{ id: string; name: string; input: any }>): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolCall of toolCalls) {
        this.outputChannel.appendLine(`🔧 [${toolCall.name}] Executing...`);

        // Validate tool call
        const validation = this.validateToolCall(toolCall);
        if (!validation.valid) {
            results.push({
                success: false,
                error: `Validation failed: ${validation.errors.join(', ')}`
            });
            continue;
        }

        // Check if approval needed (for write/edit operations)
        const needsApproval = this.shouldRequestApproval(toolCall);
        
        if (needsApproval && toolCall.name !== 'write_file' && toolCall.name !== 'edit_file') {
            this.outputChannel.appendLine(`⚠️ [${toolCall.name}] Requesting approval...`);
            const approved = await this.requestApproval(toolCall);
            if (!approved) {
                results.push({ success: false, error: 'User denied permission' });
                continue;
            }
        }

        // Execute the tool
        const startTime = Date.now();
        const result = await this.toolManager.executeTool(
            toolCall.name,
            toolCall.input,
            'agent'  // Mode
        );
        const duration = Date.now() - startTime;

        this.outputChannel.appendLine(`${result.success ? '✅' : '❌'} [${toolCall.name}] ${duration}ms`);

        results.push(result);

        // For sequential execution, break after first tool (rate limiting)
        break;
    }

    return results;
}
```

---

### **Phase 8: Individual Tool Execution**

**File:** `src/tools-accesslint/toolManager.ts`

```typescript
// Line ~100-200 (simplified)
async executeTool(toolName: string, input: any, mode: ToolMode): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    
    if (!tool) {
        return { success: false, error: `Unknown tool: ${toolName}` };
    }

    try {
        switch (toolName) {
            case 'read_file':
                return await this.readTool.execute(input);
            
            case 'write_file':
                // Show diff viewer for approval
                return await this.writeTool.executeWithLogging(input);
            
            case 'edit_file':
                // Show diff viewer for approval
                return await this.editTool.executeWithLogging(input);
            
            case 'list_directory':
                return await this.listDirTool.execute(input);
            
            case 'grep_search':
                return await this.grepTool.execute(input);
            
            case 'bash_command':
                return await this.bashTool.execute(input);
            
            case 'attempt_completion':
                return await this.attemptCompletionTool.execute(input);
            
            default:
                return { success: false, error: `Tool not implemented: ${toolName}` };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}
```

---

### **Phase 9: Tool Examples**

#### **Read File Tool**

**File:** `src/tools-accesslint/readTool.ts`

```typescript
async execute(input: { file_path: string; offset?: number; limit?: number }): Promise<ToolResult> {
    const fullPath = path.join(this.workspaceRoot, input.file_path);
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
        return { success: false, error: `File not found: ${input.file_path}` };
    }

    // Read file content
    let content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    
    // Apply offset/limit if specified
    if (input.offset || input.limit) {
        const start = input.offset || 0;
        const end = input.limit ? start + input.limit : lines.length;
        const selectedLines = lines.slice(start, end);
        
        // Add line numbers
        content = selectedLines.map((line, i) => `${start + i + 1}|${line}`).join('\n');
    }

    return {
        success: true,
        output: content,
        metadata: { totalLines: lines.length, filePath: input.file_path }
    };
}
```

#### **Write File Tool (with Diff Viewer)**

**File:** `src/tools-accesslint/writeTool.ts`

```typescript
async executeWithLogging(input: { file_path: string; content: string }): Promise<ToolResult> {
    const fullPath = path.join(this.workspaceRoot, input.file_path);
    
    // Check if file already exists (for diff)
    const fileExists = fs.existsSync(fullPath);
    const originalContent = fileExists ? fs.readFileSync(fullPath, 'utf-8') : '';

    // Use DiffViewerManager for approval
    const { DiffViewerManager } = await import('../diffViewer/DiffViewerManager');
    const diffManager = DiffViewerManager.getInstance(this.extensionContext, this.workspaceRoot);

    // Show diff and wait for user approval
    const approvalResult = await diffManager.requestWriteApproval(
        input.file_path,
        originalContent,
        input.content
    );

    if (!approvalResult.approved) {
        return {
            success: false,
            error: `User rejected: ${approvalResult.rejectReason || 'No reason provided'}`
        };
    }

    // User approved - write the file
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, input.content, 'utf-8');

    return {
        success: true,
        output: `File ${fileExists ? 'updated' : 'created'}: ${input.file_path}`,
        metadata: { filePath: input.file_path, bytesWritten: input.content.length }
    };
}
```

#### **Attempt Completion Tool**

**File:** `src/tools-accesslint/attemptCompletionTool.ts`

```typescript
async execute(input: { result: string; command?: string }): Promise<ToolResult> {
    // Log completion
    this.outputChannel.appendLine('🎉 Task completion requested');
    this.outputChannel.appendLine(`📝 Result: ${input.result}`);

    // If command provided, offer to run it
    if (input.command) {
        this.outputChannel.appendLine(`💻 Suggested command: ${input.command}`);
    }

    // Notify UI of completion
    if (this.webviewProvider) {
        this.webviewProvider.postMessage({
            type: 'agentComplete',
            result: input.result,
            command: input.command,
            timestamp: new Date()
        });
    }

    return {
        success: true,
        output: input.result,
        metadata: {
            isCompletion: true,
            command: input.command,
            timestamp: new Date()
        }
    };
}
```

---

### **Phase 10: Diff Viewer Approval Flow**

**File:** `src/diffViewer/DiffViewerManager.ts`

```typescript
async requestWriteApproval(filePath: string, oldContent: string, newContent: string): Promise<DiffApprovalResponse> {
    const requestId = this.generateRequestId();
    
    // Generate diff
    const diff = DiffGenerator.generateWriteDiff(filePath, oldContent, newContent);
    
    // Create approval request
    const request: DiffApprovalRequest = {
        id: requestId,
        type: 'write',
        filePath,
        diff,
        timestamp: new Date()
    };
    
    // Store request
    this.pendingRequests.set(requestId, request);
    
    // Show diff viewer webview panel
    await this.diffViewerProvider.showDiff(request);
    
    // Return promise that resolves when user responds
    return new Promise<DiffApprovalResponse>((resolve) => {
        this.resolveCallbacks.set(requestId, resolve);
    });
}
```

**File:** `src/diffViewer/DiffViewerProvider.ts`

```typescript
async showDiff(request: DiffApprovalRequest): Promise<void> {
    // Create or show webview panel
    if (!this.panel) {
        this.panel = vscode.window.createWebviewPanel(
            'accesslint-diff',
            `Diff: ${request.filePath}`,
            vscode.ViewColumn.Two,
            { enableScripts: true }
        );
    }

    // Set HTML content
    this.panel.webview.html = this.getWebviewContent();

    // Store pending request (wait for webview to be ready)
    this.pendingDiffRequest = {
        type: 'showDiff',
        request: {
            id: request.id,
            type: request.type,
            filePath: request.filePath,
            diff: request.diff,
            timestamp: request.timestamp.toISOString()
        }
    };
}

// When webview sends 'ready' message, send the diff data
private handleMessage(message: any): void {
    switch (message.type) {
        case 'ready':
            // Webview is ready - send pending diff data
            if (this.pendingDiffRequest && this.panel) {
                this.panel.webview.postMessage(this.pendingDiffRequest);
                this.pendingDiffRequest = null;
            }
            break;
        
        case 'approvalResponse':
            // User clicked Approve or Reject
            this.handleApprovalResponse(message.response);
            break;
    }
}
```

**File:** `webviews/diffViewer.js`

```javascript
// User clicks Approve All
approveAll() {
    this.vscode.postMessage({
        type: 'approvalResponse',
        response: {
            requestId: this.currentRequest.id,
            approved: true,
            approvedHunks: this.getAllHunkIds()
        }
    });
}

// User clicks Reject All
rejectAll() {
    this.vscode.postMessage({
        type: 'approvalResponse',
        response: {
            requestId: this.currentRequest.id,
            approved: false,
            rejectReason: 'User rejected all changes'
        }
    });
}
```

---

### **Phase 11: Completion & Results**

**File:** `src/agentLLMOrchestrator.ts`

```typescript
// When attempt_completion tool is executed
private notifyCompletion(result: string): void {
    // Send completion to chat webview
    const webviewProvider = this.aiProviderManager.getWebviewProvider();
    
    if (webviewProvider) {
        webviewProvider.postMessage({
            type: 'agentComplete',
            result: result,
            summary: {
                iterations: this.currentSession?.iterations,
                toolsUsed: this.getToolsUsedSummary(),
                filesModified: this.getFilesModifiedSummary(),
                duration: Date.now() - this.currentSession?.startTime.getTime()
            },
            timestamp: new Date()
        });
    }

    // Update todo list
    this.todoListManager.markAllComplete(this.currentSession?.id);
    
    // Log to output channel
    this.outputChannel.appendLine('════════════════════════════════════════');
    this.outputChannel.appendLine('🎉 TASK COMPLETED!');
    this.outputChannel.appendLine(`📝 ${result}`);
    this.outputChannel.appendLine(`🔄 Iterations: ${this.currentSession?.iterations}`);
    this.outputChannel.appendLine('════════════════════════════════════════');
}
```

**File:** `webviews/chat.js`

```javascript
// Handle completion message
window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.type) {
        case 'agentComplete':
            // Remove thinking indicator
            removeThinkingIndicator();
            
            // Display completion message
            addAgentMessage(`
                <div class="completion-message">
                    <div class="completion-header">
                        <span class="completion-icon">✅</span>
                        <span class="completion-title">Task Completed!</span>
                    </div>
                    <div class="completion-result">${escapeHtml(message.result)}</div>
                    <div class="completion-stats">
                        <span>🔄 ${message.summary.iterations} iterations</span>
                        <span>📁 ${message.summary.filesModified} files modified</span>
                        <span>⏱️ ${formatDuration(message.summary.duration)}</span>
                    </div>
                </div>
            `);
            break;
    }
});
```

---

## 🔧 Detailed Component Breakdown

### **Available Tools**

| Tool | Purpose | Approval Required? |
|------|---------|-------------------|
| `read_file` | Read file contents | ❌ No |
| `write_file` | Create/overwrite file | ✅ Yes (Diff Viewer) |
| `edit_file` | Apply specific edits | ✅ Yes (Diff Viewer) |
| `list_directory` | List folder contents | ❌ No |
| `grep_search` | Search files with regex | ❌ No |
| `bash_command` | Run shell commands | ⚠️ Some (dangerous cmds) |
| `attempt_completion` | Complete the task | ❌ No |

### **Tool Input/Output Schemas**

#### **read_file**
```json
// Input
{ "file_path": "src/App.tsx", "offset": 0, "limit": 100 }

// Output (ToolResult)
{
    "success": true,
    "output": "1|import React from 'react';\n2|...",
    "metadata": { "totalLines": 150, "filePath": "src/App.tsx" }
}
```

#### **write_file**
```json
// Input
{ "file_path": "src/LoginForm.tsx", "content": "import React..." }

// Output (after user approval)
{
    "success": true,
    "output": "File created: src/LoginForm.tsx",
    "metadata": { "filePath": "src/LoginForm.tsx", "bytesWritten": 1234 }
}
```

#### **attempt_completion**
```json
// Input
{
    "result": "Created accessible login form with proper ARIA labels, keyboard navigation, and focus management.",
    "command": "npm run dev"
}

// Output
{
    "success": true,
    "output": "Created accessible login form...",
    "metadata": { "isCompletion": true, "command": "npm run dev" }
}
```

---

## 🔄 Sequence Diagrams

### **Complete Agent Flow**

```
User          ChatWebview       Extension         Orchestrator        OpenAI          ToolManager      DiffViewer
  |               |                 |                  |                 |                  |               |
  |--"Create form"|                 |                  |                 |                  |               |
  |               |--postMessage--->|                  |                 |                  |               |
  |               |                 |---startSession-->|                 |                  |               |
  |               |                 |                  |                 |                  |               |
  |               |                 |                  |---requestLLM--->|                 |               |
  |               |                 |                  |                 |                  |               |
  |               |                 |                  |<--AI Response---|                 |               |
  |               |                 |                  |    (XML tools)  |                 |               |
  |               |                 |                  |                 |                  |               |
  |               |                 |                  |---parseTool---->|                 |               |
  |               |                 |                  |    (read_file)  |                 |               |
  |               |                 |                  |<--file content--|                 |               |
  |               |                 |                  |                 |                  |               |
  |               |                 |                  |---requestLLM--->|                 |               |
  |               |                 |                  |<--AI Response---|                 |               |
  |               |                 |                  |    (write_file) |                 |               |
  |               |                 |                  |                 |                  |               |
  |               |                 |                  |---executeTool--------------------------------->|
  |               |                 |                  |                 |                  |  Show Diff   |
  |<-----------------------------------------User Approves/Rejects------------------------------------|
  |               |                 |                  |<--approval result---------------------------|
  |               |                 |                  |                 |                  |               |
  |               |                 |                  |---requestLLM--->|                 |               |
  |               |                 |                  |<--AI Response---|                 |               |
  |               |                 |                  | (attempt_comp)  |                 |               |
  |               |                 |                  |                 |                  |               |
  |               |                 |<--completion-----|                 |                  |               |
  |               |<--postMessage---|                  |                 |                  |               |
  |<--Result------|                 |                  |                 |                  |               |
  |               |                 |                  |                 |                  |               |
```

### **Tool Selection Decision Tree**

```
                    AI Receives User Goal
                            |
                            ↓
                   ┌────────────────────┐
                   │  Analyze Task      │
                   │  (in <thinking>)   │
                   └────────────────────┘
                            |
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
   Need to see         Need to          Need to run
   file structure?     read code?       commands?
        |                   |                   |
        ↓                   ↓                   ↓
   ┌───────────┐      ┌───────────┐      ┌───────────┐
   │list_direc-│      │ read_file │      │bash_commd │
   │   tory    │      │           │      │           │
   └───────────┘      └───────────┘      └───────────┘
                            |
                            ↓
                   Understand enough?
                            |
              ┌─────────────┴─────────────┐
              ↓                           ↓
             No                          Yes
              |                           |
              ↓                           ↓
         Read more files          ┌──────────────┐
                                  │ Implement!   │
                                  │ write_file   │
                                  │ edit_file    │
                                  └──────────────┘
                                          |
                                          ↓
                                    Task complete?
                                          |
                                ┌─────────┴─────────┐
                                ↓                   ↓
                               No                  Yes
                                |                   |
                                ↓                   ↓
                           Continue             ┌───────────┐
                           iteration            │ attempt_  │
                                                │completion │
                                                └───────────┘
```

---

## ❌ Error Handling & Recovery

### **Common Errors**

| Error | Cause | Recovery |
|-------|-------|----------|
| `Azure OpenAI not initialized` | API key not configured | Uses hardcoded key in apiKeyManager.ts |
| `Tool validation failed` | Missing required params | AI retries with correct params |
| `User denied permission` | User rejected in diff viewer | AI informed, may try alternative |
| `File not found` | Wrong path | AI reads directory first |
| `Max iterations reached` | Task too complex or loop | Force completion |
| `Loop detected` | Same tool called repeatedly | Force completion with suggestion |

### **Error Message Format**

```typescript
// Tool error result format
{
    success: false,
    error: "File not found: src/NonExistent.tsx",
    metadata: {
        toolName: "read_file",
        errorType: "FileNotFoundError",
        timestamp: "2024-12-01T10:00:00.000Z"
    }
}
```

---

## 📊 Performance Characteristics

| Metric | Typical Value | Notes |
|--------|---------------|-------|
| Iterations per task | 2-5 | Simple tasks: 2, Complex: 8-15 |
| Time per iteration | 3-10 seconds | Depends on AI response time |
| Total task time | 10-60 seconds | Varies by complexity |
| Context window | 128K tokens | GPT-5 max |
| Tokens per request | 2K-8K | Depends on conversation length |

---

## 📝 Example Complete Session

```
User: "Create an accessible button component with proper ARIA labels"

═══════════════════════════════════════════════════════════════════

🤖 Agent Session Started
🔧 Using provider: openai
📋 Todo list created with 3 items

🔄 Agent iteration 1
📊 Sending: 2 messages, ~1800 tokens
🔧 Using tools-enabled API...
📝 AI Response received (450 chars)
🔧 Found 2 tool call(s)
  ✅ list_directory: src/
  ✅ read_file: src/App.tsx

🔄 Agent iteration 2
📊 Sending: 4 messages, ~2500 tokens
📝 AI Response received (1200 chars)
🔧 Found 1 tool call(s)
  🔧 write_file: src/components/AccessibleButton.tsx
  [Diff Viewer Opened - Waiting for approval...]
  ✅ User approved
  ✅ File created: src/components/AccessibleButton.tsx

🔄 Agent iteration 3
📊 Sending: 6 messages, ~3200 tokens
📝 AI Response received (800 chars)
🔧 Found 1 tool call(s)
  ✅ attempt_completion

════════════════════════════════════════════════════════════════════
🎉 TASK COMPLETED!
📝 Created AccessibleButton component with:
   - aria-label for screen readers
   - role="button" (explicit)
   - tabIndex for keyboard navigation
   - onKeyDown handler for Enter/Space
   - Focus visible outline

🔄 Iterations: 3
📁 Files created: 1
⏱️ Duration: 18 seconds
════════════════════════════════════════════════════════════════════
```

---

## 🔗 Related Files

| File | Purpose |
|------|---------|
| `src/agentLLMOrchestrator.ts` | Main orchestration logic |
| `src/agentSystemPrompt.ts` | System prompt for AI |
| `src/llmToolCallParser.ts` | Parse XML tool calls |
| `src/tools-accesslint/toolManager.ts` | Tool execution |
| `src/tools-accesslint/*.ts` | Individual tool implementations |
| `src/diffViewer/*.ts` | Diff approval system |
| `src/chatWebviewProvider.ts` | UI integration |
| `webviews/chat.js` | Chat UI JavaScript |
| `src/apiKeyManager.ts` | API key configuration |
| `src/openaiChat.ts` | OpenAI API client |

---

**Last Updated**: December 2024  
**Version**: 0.1.0

