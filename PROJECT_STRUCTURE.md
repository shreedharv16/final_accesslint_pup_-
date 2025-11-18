# 🏗️ AccessLint Project Structure & Architecture

## 📋 **Table of Contents**
1. [Project Overview](#project-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Folder Structure](#folder-structure)
4. [Core Components](#core-components)
5. [Data Flow](#data-flow)
6. [File Descriptions](#file-descriptions)
7. [How It All Works Together](#how-it-all-works-together)

---

## 🎯 **Project Overview**

**AccessLint** is a VSCode extension that provides:
- **Real-time NVDA Screen Reader Testing** (using Guidepup)
- **AI-Powered Accessibility Fixing** (using Azure OpenAI, Anthropic, or Gemini)
- **Automated Agent Mode** (autonomous code fixing)
- **Chat Interface** (for accessibility questions)

**Tech Stack:**
- **Language:** TypeScript
- **UI:** HTML/CSS/JavaScript (Webviews)
- **AI:** Azure OpenAI, Anthropic Claude, Google Gemini
- **Testing:** NVDA (via Guidepup), Playwright

---

## 🏗️ **High-Level Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                      VSCode Extension Host                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐ │
│  │  Chat View     │   │ Testing View   │   │  Agent Mode    │ │
│  │  (Webview)     │   │  (Webview)     │   │  (Background)  │ │
│  └───────┬────────┘   └───────┬────────┘   └───────┬────────┘ │
│          │                    │                     │          │
│          └────────────┬───────┴─────────────────────┘          │
│                       │                                         │
│         ┌─────────────▼─────────────┐                          │
│         │  AI Provider Manager      │                          │
│         │  (OpenAI/Anthropic/Gemini)│                          │
│         └─────────────┬─────────────┘                          │
│                       │                                         │
│         ┌─────────────▼─────────────┐                          │
│         │    Tool Manager            │                          │
│         │  (read, write, edit, bash)│                          │
│         └───────────────────────────┘                          │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                     External Services                            │
├─────────────────────────────────────────────────────────────────┤
│  Azure OpenAI  │  Anthropic API  │  Gemini API  │  NVDA       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 **Folder Structure**

```
accesslint_pup-main/
├── src/                      # TypeScript source code
│   ├── diffViewer/          # Diff viewer for showing code changes
│   └── tools-accesslint/    # Tool implementations (read, write, etc.)
├── webviews/                # UI files (HTML/CSS/JS for webviews)
├── out/                     # Compiled JavaScript (generated)
├── icons/                   # Extension icons
├── package.json             # Extension manifest and dependencies
└── tsconfig.json           # TypeScript configuration
```

---

## 🔑 **Core Components**

### **1. UI Layer (Webviews)**
- **Chat Interface** - Ask accessibility questions
- **Testing Interface** - Run NVDA tests, view results, download reports
- **Diff Viewer** - Review code changes before applying

### **2. AI Layer**
- **AI Provider Manager** - Manages multiple AI providers
- **Orchestrators** - Control agent behavior and tool execution
- **Tool Manager** - Provides file operations to AI

### **3. Testing Layer**
- **Accessibility Tester** - Runs NVDA screen reader tests
- **Guidepup Integration** - Controls NVDA programmatically
- **Playwright** - Browser automation

### **4. Agent Layer**
- **Agent Orchestrator** - Autonomous task execution
- **Tool Execution** - File reading, writing, editing
- **Context Management** - Manages conversation history

---

## 📂 **Detailed Folder Structure**

### **`src/` - TypeScript Source Files**

```
src/
├── Core Extension Files
│   ├── extension.ts                    # Entry point, activates extension
│   ├── apiKeyManager.ts               # Manages API keys for AI providers
│   └── types.ts                       # Type definitions
│
├── UI Providers (Webview Management)
│   ├── chatWebviewProvider.ts        # Chat interface logic
│   ├── testingWebviewProvider.ts     # Testing menu logic
│   └── diffViewer/                   # Diff viewer for code changes
│       ├── DiffViewerManager.ts      # Manages diff viewer instances
│       ├── DiffViewerProvider.ts     # Provides diff view webview
│       └── DiffGenerator.ts          # Generates diff output
│
├── AI Integration
│   ├── aiProviderManager.ts          # Orchestrates all AI providers
│   ├── openaiChat.ts                 # Azure OpenAI integration
│   ├── anthropicChat.ts              # Anthropic Claude integration
│   ├── geminiChat.ts                 # Google Gemini integration
│   ├── llmToolCallParser.ts          # Parses AI tool calls (XML)
│   └── streamingProcessor.ts         # Handles streaming responses
│
├── Agent System (Autonomous Execution)
│   ├── agentLLMOrchestrator.ts       # Main agent for chat interface
│   ├── testingAgentOrchestrator.ts   # Testing-specific agent
│   ├── agentSystemPrompt.ts          # System prompt for agents
│   ├── todoListManager.ts            # Manages agent todo lists
│   └── toolExecutionStateManager.ts  # Tracks tool execution state
│
├── Context Management
│   ├── contextManager.ts             # Manages conversation context
│   ├── contextWindowUtils.ts         # Token counting utilities
│   ├── fileContextTracker.ts         # Tracks read files
│   └── tokenTracker.ts               # Monitors token usage
│
├── Accessibility Testing
│   └── accessibilityTester.ts        # NVDA + Playwright testing
│
├── Utilities
│   ├── rateLimiter.ts                # Rate limiting for API calls
│   └── retryUtils.ts                 # Retry logic for failed requests
│
└── tools-accesslint/                 # Tool Implementations
    ├── toolManager.ts                # Manages all tools
    ├── types.ts                      # Tool type definitions
    ├── readTool.ts                   # Read file content
    ├── writeTool.ts                  # Write new file
    ├── editTool.ts                   # Edit existing file
    ├── grepTool.ts                   # Search in files
    ├── listDirTool.ts                # List directory contents
    ├── bashTool.ts                   # Execute shell commands
    ├── attemptCompletionTool.ts      # Mark task as complete
    └── strict*.ts                    # Strict XML-based tools
```

---

### **`webviews/` - UI Files**

```
webviews/
├── chat.js                  # Chat interface JavaScript
├── chat.css                 # Chat interface styling
├── testing.js               # Testing menu JavaScript
├── testing.css              # Testing menu styling
├── diffViewer.js            # Diff viewer JavaScript
├── diffViewer.css           # Diff viewer styling
├── vscode.css               # VSCode theme variables
└── reset.css                # CSS reset
```

---

### **`out/` - Compiled Output (Generated)**

This folder is automatically generated by TypeScript compilation. Contains JavaScript versions of all TypeScript files plus source maps.

---

## 📄 **Key File Descriptions**

### **Extension Core**

#### **`extension.ts`**
**Purpose:** Entry point of the extension  
**What it does:**
- Initializes all providers (Chat, Testing, AI)
- Registers commands (start agent, configure keys, etc.)
- Sets up context and subscriptions
- Creates orchestrators for chat and testing

**Key exports:**
```typescript
export async function activate(context: vscode.ExtensionContext)
export function deactivate()
```

---

#### **`apiKeyManager.ts`**
**Purpose:** Manages API keys for all AI providers  
**What it does:**
- Securely stores API keys in VSCode secrets
- Provides UI for key configuration
- Validates API keys
- Supports Azure OpenAI, Anthropic, and Gemini

**Key methods:**
```typescript
async setAzureOpenAIConfig()
async setAnthropicConfig()
async setGeminiConfig()
async getApiKey(provider: string)
```

---

### **UI Providers**

#### **`chatWebviewProvider.ts`**
**Purpose:** Manages the chat interface webview  
**What it does:**
- Renders chat UI (HTML/CSS/JS)
- Handles user messages
- Displays AI responses
- Shows tool execution status
- Manages chat history

**Key features:**
- Quick mode (simple Q&A)
- Agent mode (autonomous task execution)
- File context attachment
- Diff viewer integration

---

#### **`testingWebviewProvider.ts`**
**Purpose:** Manages the testing interface webview  
**What it does:**
- Renders testing UI
- Initiates NVDA tests
- Displays test results
- Handles "Fix Issues" button
- Generates PDF reports

**Key methods:**
```typescript
_handleStartTest(url: string)
_handleFixIssues(testResult: any)
_handleDownloadReport(testResult: any)
```

---

### **AI Integration**

#### **`aiProviderManager.ts`**
**Purpose:** Central manager for all AI providers  
**What it does:**
- Routes requests to correct provider (OpenAI/Anthropic/Gemini)
- Manages tool call parsing
- Handles provider fallback
- Tracks API usage

**Key methods:**
```typescript
async sendMessage(message: string, provider?: AiProvider)
async sendMessageWithTools(message: string, provider?: AiProvider)
```

---

#### **`openaiChat.ts`**
**Purpose:** Azure OpenAI integration  
**What it does:**
- Connects to Azure OpenAI API
- Sends chat requests
- Handles streaming responses
- Manages rate limits and retries

**Configuration:**
- Endpoint URL
- API key
- Deployment name
- Model version

---

#### **`anthropicChat.ts`**
**Purpose:** Anthropic Claude integration  
**What it does:**
- Connects to Anthropic API
- Supports Claude 3.5 Sonnet
- Handles tool calls natively
- Manages conversation history

---

#### **`geminiChat.ts`**
**Purpose:** Google Gemini integration  
**What it does:**
- Connects to Gemini API
- Supports Gemini Pro
- Parses tool calls from text
- Alternative when OpenAI/Anthropic unavailable

---

### **Agent System**

#### **`agentLLMOrchestrator.ts`**
**Purpose:** Main autonomous agent (for chat interface)  
**What it does:**
- Manages agent sessions
- Executes tool calls
- Tracks iterations
- Detects infinite loops
- Manages file context
- Handles todo lists

**Agent loop:**
```typescript
1. Get LLM response
2. Parse tool calls
3. Execute tools (read_file, write_file, etc.)
4. Send results back to LLM
5. Repeat until task complete or max iterations
```

**Key features:**
- Intelligent context management
- File context tracking (caching)
- Loop detection
- Smart intervention (stops exploration loops)

---

#### **`testingAgentOrchestrator.ts`**
**Purpose:** Testing-specific agent (for "Fix Issues" button)  
**What it does:**
- Same as main agent but isolated
- Includes null-safety checks for timeout handling
- Optimized for accessibility fixing
- Separate from chat agent (no interference)

**Why separate?**
- Prevents chat agent modification
- Testing-specific optimizations
- Crash-resistant during timeout/stop

---

#### **`agentSystemPrompt.ts`**
**Purpose:** System prompt for agents  
**What it does:**
- Defines agent behavior
- Lists available tools
- Provides examples
- Sets expectations (XML format for tool calls)

**Content:**
- Tool descriptions
- Response format requirements
- Best practices
- Framework-agnostic guidelines

---

### **Testing System**

#### **`accessibilityTester.ts`**
**Purpose:** NVDA screen reader testing  
**What it does:**
- Launches NVDA via Guidepup
- Opens browser via Playwright
- Runs 6 types of tests:
  1. Headings (H key)
  2. Links (K key)
  3. Forms (F key)
  4. Landmarks (D key)
  5. Sequential (↓ key)
  6. Interactive elements (B key)
- Captures NVDA announcements
- Validates against WCAG rules
- Runs AI validation (if enabled)

**Two-phase validation:**
```typescript
Phase 1: Basic NVDA Testing (hardcoded rules)
  - Fast, specific checks
  - Issues marked as 'basic'

Phase 2: AI Comprehensive Validation
  - Sends NVDA data to AI
  - AI checks ALL WCAG 2.1 criteria
  - Issues marked as 'ai'
```

---

### **Tools System**

#### **`toolManager.ts`**
**Purpose:** Manages all tools available to agents  
**What it does:**
- Registers tools
- Executes tool requests
- Tracks tool usage
- Manages permissions
- Provides tool definitions to AI

**Available tools:**
- `read_file` - Read file contents
- `write_file` - Create new file
- `edit_file` - Modify existing file
- `grep_search` - Search in files
- `list_directory` - List directory contents
- `bash_command` - Execute shell commands
- `attempt_completion` - Mark task as done

---

#### **Individual Tool Files**

**`readTool.ts`**
- Reads file content
- Supports line ranges (offset, limit)
- Returns formatted output with line numbers

**`writeTool.ts`**
- Creates new files
- Validates file paths
- Creates directories if needed

**`editTool.ts`**
- Search and replace in files
- Supports replace_all flag
- Validates uniqueness of old_string

**`grepTool.ts`**
- Searches for patterns in files
- Supports regex
- Can filter by file type

**`listDirTool.ts`**
- Lists directory contents
- Supports recursive listing
- Filters hidden files

**`bashTool.ts`**
- Executes shell commands
- Captures output
- Requires user approval for dangerous commands

**`attemptCompletionTool.ts`**
- Marks task as complete
- Provides summary
- Can suggest commands

---

### **Context Management**

#### **`contextManager.ts`**
**Purpose:** Manages conversation history  
**What it does:**
- Keeps conversation under token limit
- Removes old messages when needed
- Preserves important context
- Tracks token usage

**Strategies:**
- Remove oldest messages first
- Keep system prompt always
- Preserve recent context

---

#### **`fileContextTracker.ts`**
**Purpose:** Tracks files read by agent  
**What it does:**
- Caches file contents
- Prevents re-reading same files
- Provides cache statistics
- Optimizes token usage

**Benefits:**
- Reduces redundant reads
- Saves API costs
- Faster execution

---

### **Diff Viewer**

#### **`diffViewer/DiffViewerManager.ts`**
**Purpose:** Manages diff viewer instances  
**What it does:**
- Creates diff views
- Tracks open diffs
- Handles user approval/rejection
- Applies accepted changes

---

#### **`diffViewer/DiffViewerProvider.ts`**
**Purpose:** Provides diff viewer webview  
**What it does:**
- Renders side-by-side diff
- Highlights changes
- Provides approve/reject buttons

---

#### **`diffViewer/DiffGenerator.ts`**
**Purpose:** Generates diff output  
**What it does:**
- Compares old vs new content
- Generates unified diff
- Formats for display

---

### **Webview Files**

#### **`testing.js`**
**Purpose:** Testing menu frontend logic  
**What it does:**
- Handles "Start Test" button
- Displays progress
- Shows test results
- Filters issues by severity
- Handles "Fix Issues" button
- Handles "Download Report" button
- Communicates with extension via postMessage

**Key functions:**
```javascript
startTest(url)
displayResults(result)
downloadReport(result)
```

---

#### **`testing.css`**
**Purpose:** Testing menu styling  
**What it does:**
- VSCode-themed design
- Responsive layout
- Color-coded severity badges
- Button styling
- Issue card styling

---

#### **`chat.js`**
**Purpose:** Chat interface frontend logic  
**What it does:**
- Handles message sending
- Displays chat history
- Shows tool execution status
- Manages mode switching (Quick/Agent)
- Handles file attachment

---

#### **`chat.css`**
**Purpose:** Chat interface styling  
**What it does:**
- Message bubbles
- Tool execution status
- Mode toggle buttons
- Input field styling

---

## 🔄 **Data Flow**

### **1. Chat Interface Flow**

```
User types message in chat
  ↓
chat.js sends postMessage to extension
  ↓
chatWebviewProvider receives message
  ↓
aiProviderManager.sendMessage()
  ↓
Azure OpenAI / Anthropic / Gemini API
  ↓
Response with tool calls
  ↓
llmToolCallParser extracts tool calls
  ↓
toolManager executes tools
  ↓
Results sent back to AI
  ↓
Final response to webview
  ↓
chat.js displays response
```

---

### **2. Agent Mode Flow**

```
User requests task
  ↓
agentLLMOrchestrator.startSession()
  ↓
Agent loop starts:
  ├─ Get LLM response
  ├─ Parse tool calls
  ├─ Execute tools (read_file, write_file, etc.)
  ├─ Check for loops
  ├─ Track file context
  └─ Repeat
  ↓
attempt_completion called
  ↓
Session ends
  ↓
Results shown in chat
```

---

### **3. Testing Flow**

```
User clicks "Start Test"
  ↓
testingWebviewProvider._handleStartTest()
  ↓
AccessibilityTester.initialize()
  ├─ Start NVDA
  └─ Launch Chromium
  ↓
AccessibilityTester.testUrl()
  ├─ Navigate to URL
  ├─ Run 6 test types
  ├─ Capture NVDA announcements
  ├─ Basic validation (hardcoded rules)
  └─ AI validation (comprehensive WCAG)
  ↓
Results sent to webview
  ↓
testing.js displays results
  ↓
User clicks "Fix Issues"
  ↓
testingAgentOrchestrator.startSession()
  ├─ Agent reads files
  ├─ Agent fixes issues
  └─ Agent calls attempt_completion
  ↓
Summary shown in UI
```

---

### **4. PDF Report Flow**

```
User clicks "Download Report"
  ↓
testing.js sends postMessage
  ↓
testingWebviewProvider._handleDownloadReport()
  ↓
_generatePDFContent()
  ├─ Build HTML with all issues
  ├─ Add styling (print-friendly)
  └─ Format NVDA announcements
  ↓
Show save dialog
  ↓
Save HTML file
  ↓
Ask to open in browser
  ↓
User prints to PDF
```

---

## 🧩 **How It All Works Together**

### **Extension Activation**

```typescript
// extension.ts
export async function activate(context: vscode.ExtensionContext) {
    // 1. Create AI providers
    const openaiProvider = new OpenAIChatProvider(context);
    const anthropicProvider = new AnthropicChatProvider(context);
    const geminiProvider = new GeminiChatProvider(context);
    
    // 2. Create AI manager
    const aiProviderManager = new AiProviderManager(context, openaiProvider);
    
    // 3. Create orchestrators
    const chatOrchestrator = new AgentLLMOrchestrator(aiProviderManager, toolManager);
    const testingOrchestrator = new TestingAgentOrchestrator(aiProviderManager, toolManager);
    
    // 4. Create UI providers
    const chatProvider = new ChatWebviewProvider(context, aiProviderManager);
    const testingProvider = new TestingWebviewProvider(context, testingOrchestrator);
    
    // 5. Register webviews
    vscode.window.registerWebviewViewProvider('accesslint.chatView', chatProvider);
    vscode.window.registerWebviewViewProvider('accesslint.testingView', testingProvider);
    
    // 6. Register commands
    vscode.commands.registerCommand('accesslint.startLLMAgent', ...);
    vscode.commands.registerCommand('accesslint.configureApiKeys', ...);
}
```

---

### **Agent Execution Loop**

```typescript
// agentLLMOrchestrator.ts
private async runAgentLoop() {
    while (session.status === 'active' && iterations < maxIterations) {
        // 1. Get AI response
        const response = await this.getLLMResponse();
        
        // 2. Parse tool calls
        const toolCalls = response.toolCalls;
        
        // 3. Check for loops
        if (this.detectInfiniteLoop(toolCalls).isLoop) {
            break;
        }
        
        // 4. Execute tools
        const results = await this.executeToolCallsEfficiently(toolCalls);
        
        // 5. Check for completion
        if (toolCalls.some(tc => tc.name === 'attempt_completion')) {
            break;
        }
        
        // 6. Add results to conversation
        session.messages.push({ role: 'user', content: results });
        
        iterations++;
    }
}
```

---

### **NVDA Testing**

```typescript
// accessibilityTester.ts
async testUrl(url: string) {
    // Phase 1: Basic validation
    const headingResults = await this.testHeadings();  // Press H key
    const linkResults = await this.testLinks();        // Press K key
    const formResults = await this.testFormElements(); // Press F key
    // ... more tests
    
    // Validate with hardcoded rules
    issues.push(...this.validateHeadingHierarchy(headingResults));
    
    // Phase 2: AI validation
    if (this.aiProviderManager) {
        const aiIssues = await this.aiValidation(url, interactions, issues);
        issues.push(...aiIssues);
    }
    
    return { issues, interactions, summary };
}
```

---

## 🎯 **Key Concepts**

### **1. Webview Communication**

Extension and webviews communicate via `postMessage`:

```javascript
// Webview → Extension
vscode.postMessage({ type: 'startTest', url: 'localhost:3000' });

// Extension → Webview
webview.postMessage({ type: 'testingComplete', result: {...} });
```

---

### **2. Tool Call Format**

AI returns tool calls in XML format:

```xml
<read_file>
{
  "file_path": "src/App.jsx"
}
</read_file>
```

Parser extracts this and toolManager executes it.

---

### **3. Session Management**

Agents maintain session state:

```typescript
interface AgentSession {
    id: string;
    goal: string;
    status: 'active' | 'completed' | 'error';
    iterations: number;
    messages: AgentMessage[];
    startTime: Date;
}
```

---

### **4. Context Window Management**

To stay within token limits:
- Track tokens for each message
- Remove old messages when limit approached
- Keep system prompt always
- Use file context caching

---

### **5. Provider Abstraction**

All AI providers implement same interface:

```typescript
interface ChatProvider {
    sendMessage(message: string): Promise<string>;
    isConfigured(): Promise<boolean>;
    refreshApiKey(): Promise<void>;
}
```

This allows easy switching between OpenAI/Anthropic/Gemini.

---

## 📊 **Summary Diagram**

```
┌─────────────────────────────────────────────────────────────────┐
│                          USER                                    │
└───────────────────────┬─────────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
┌───────▼──────┐              ┌────────▼────────┐
│ Chat View    │              │ Testing View    │
│ (Webview)    │              │ (Webview)       │
└───────┬──────┘              └────────┬────────┘
        │                               │
        │ postMessage                   │ postMessage
        │                               │
┌───────▼──────────────────────────────▼────────┐
│          Extension Host (extension.ts)         │
│  ┌──────────────────────────────────────────┐ │
│  │      chatWebviewProvider.ts              │ │
│  │      testingWebviewProvider.ts           │ │
│  └────────────────┬─────────────────────────┘ │
│                   │                            │
│  ┌────────────────▼─────────────────────────┐ │
│  │      aiProviderManager.ts                │ │
│  │  ┌────────────────────────────────────┐  │ │
│  │  │  openaiChat.ts                     │  │ │
│  │  │  anthropicChat.ts                  │  │ │
│  │  │  geminiChat.ts                     │  │ │
│  │  └────────────────────────────────────┘  │ │
│  └────────────────┬─────────────────────────┘ │
│                   │                            │
│  ┌────────────────▼─────────────────────────┐ │
│  │   agentLLMOrchestrator.ts                │ │
│  │   testingAgentOrchestrator.ts            │ │
│  └────────────────┬─────────────────────────┘ │
│                   │                            │
│  ┌────────────────▼─────────────────────────┐ │
│  │        toolManager.ts                    │ │
│  │  ┌────────────────────────────────────┐  │ │
│  │  │  readTool, writeTool, editTool     │  │ │
│  │  │  grepTool, listDirTool, bashTool   │  │ │
│  │  └────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼──────┐     ┌────────▼────────┐
│ Azure OpenAI │     │ NVDA + Browser  │
│ Anthropic    │     │ (Guidepup +     │
│ Gemini       │     │  Playwright)    │
└──────────────┘     └─────────────────┘
```

---

## 🎓 **Learning Path**

To understand the codebase:

1. **Start with:** `extension.ts` - See how everything initializes
2. **Then read:** `chatWebviewProvider.ts` - Understand UI integration
3. **Next:** `aiProviderManager.ts` - See how AI is managed
4. **Deep dive:** `agentLLMOrchestrator.ts` - Understand agent loop
5. **Tools:** `toolManager.ts` - See what agents can do
6. **Testing:** `accessibilityTester.ts` - Understand NVDA testing

---

## 📝 **File Count Summary**

```
Total TypeScript files: ~40
Total JavaScript files (compiled): ~40
Total Webview files: 7
Total Tool files: 13

Lines of code: ~15,000+ lines
```

---

**This architecture allows for:**
- ✅ Multiple AI providers (easy switching)
- ✅ Autonomous agent execution
- ✅ Real NVDA screen reader testing
- ✅ Modular tool system
- ✅ Clean separation of concerns
- ✅ Easy extension and maintenance

**Ready to add backend authentication and distribution!** 🚀

