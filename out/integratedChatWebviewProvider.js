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
exports.IntegratedChatWebviewProvider = void 0;
const vscode = __importStar(require("vscode"));
const chatWebviewProvider_1 = require("./chatWebviewProvider");
const aiProviderManager_1 = require("./aiProviderManager");
const agentLLMOrchestrator_1 = require("./agentLLMOrchestrator");
class IntegratedChatWebviewProvider extends chatWebviewProvider_1.ChatWebviewProvider {
    constructor(extensionUri, context, sharedProvider, sharedAccessibilityConverter, agentOrchestrator) {
        super(extensionUri, context, sharedProvider, sharedAccessibilityConverter);
        this.aiProviderManager = new aiProviderManager_1.AiProviderManager(context, sharedProvider);
        this.agentOrchestrator = agentOrchestrator;
        // Initialize LLM Agent Orchestrator
        this.llmAgentOrchestrator = new agentLLMOrchestrator_1.AgentLLMOrchestrator(this.aiProviderManager, this.aiProviderManager.getToolManager());
        // Set webview provider for tool logging
        this.aiProviderManager.setWebviewProvider(this);
    }
    // Get AI provider manager instance
    getAiProviderManager() {
        return this.aiProviderManager;
    }
    // Get LLM Agent Orchestrator instance
    getLLMAgentOrchestrator() {
        return this.llmAgentOrchestrator;
    }
    resolveWebviewView(webviewView, context, _token) {
        super.resolveWebviewView(webviewView, context, _token);
        // Add additional message handlers for our new features
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'toggleMode':
                    await this.handleToggleMode();
                    break;
                case 'setMode':
                    await this.handleSetMode(data.mode);
                    break;
                case 'configureSpecificApiKey':
                    await this.handleConfigureSpecificApiKey(data.provider);
                    break;
                case 'executeTool':
                    await this.handleExecuteTool(data);
                    break;
                case 'getProviderStatus':
                    await this.handleGetProviderStatus();
                    break;
                case 'newChatSession':
                    await this.handleNewChatSession();
                    break;
                case 'getTokenStats':
                    await this.handleGetTokenStats();
                    break;
                case 'toggleTodoItem':
                    await this.handleToggleTodoItem(data);
                    break;
            }
        }, undefined, this.context.subscriptions);
        // Initialize provider status
        this.updateProviderStatus();
    }
    // Override handleSendMessage to use the new AI provider manager
    async handleSendMessage(message, files) {
        const isConfigured = await this.aiProviderManager.isAnyProviderConfigured();
        if (!isConfigured) {
            this.postMessage({
                type: 'error',
                message: 'Please configure at least one API key first.'
            });
            return;
        }
        try {
            // Show user message immediately
            this.postMessage({
                type: 'userMessage',
                message: message
            });
            const currentMode = this.aiProviderManager.getMode();
            // Debug logging
            console.log(`🔍 AccessLint Debug - Current mode: ${currentMode}, Message: "${message.substring(0, 50)}..."`);
            // Check if this is a tool-based request
            const isToolReq = this.isToolRequest(message);
            console.log(`🔍 AccessLint Debug - Is tool request: ${isToolReq}`);
            if (isToolReq) {
                await this.handleToolBasedRequest(message, files, currentMode);
            }
            else if (this.isCodeChangeRequest(message, files) && files) {
                await this.handleCodeChangeRequest(message, files);
            }
            else {
                await this.handleRegularChatMessage(message, files);
            }
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`🔍 AccessLint Debug - Error in handleSendMessage:`, error);
            this.postMessage({
                type: 'error',
                message: errorMsg
            });
        }
    }
    isToolRequest(message) {
        // In agent mode, treat almost all requests as potential tool requests
        // except for purely conversational queries
        const currentMode = this.aiProviderManager.getMode();
        if (currentMode === 'agent') {
            // In agent mode, only exclude purely conversational messages
            const conversationalKeywords = [
                'hello', 'hi', 'hey', 'thanks', 'thank you', 'bye', 'goodbye',
                'what is', 'what are', 'explain', 'tell me about', 'how does',
                'can you explain', 'what does', 'define'
            ];
            const lowerMessage = message.toLowerCase();
            const isConversational = conversationalKeywords.some(keyword => lowerMessage.startsWith(keyword) || lowerMessage.includes(`can you ${keyword}`));
            // In agent mode, treat non-conversational messages as tool requests
            return !isConversational;
        }
        // In quick mode, only specific tool keywords trigger tool requests
        const toolKeywords = [
            'read file', 'write file', 'edit file', 'search for', 'grep', 'find in files',
            'run command', 'execute', 'bash', 'terminal', 'command line', 'create folder',
            'make folder', 'mkdir', 'list files', 'ls', 'dir', 'show files', 'browse',
            'navigate to', 'open file', 'view file', 'check file', 'look at file'
        ];
        const lowerMessage = message.toLowerCase();
        return toolKeywords.some(keyword => lowerMessage.includes(keyword));
    }
    async handleToolBasedRequest(message, files, mode = 'quick') {
        try {
            // In agent mode, use our new LLM Agent Orchestrator
            if (mode === 'agent') {
                // Show thinking message for agent mode
                this.postMessage({
                    type: 'assistantMessage',
                    message: '🤖 **Agent Mode Active** - Analyzing your request and determining which tools to use...'
                });
                // Check if there's already an active session
                const currentSession = this.llmAgentOrchestrator.getSessionStatus();
                if (currentSession && currentSession.status === 'active') {
                    console.log('🔄 Session already active, letting it continue...');
                    // The existing session will handle this automatically
                }
                else {
                    // Start a new LLM Agent session
                    console.log('🚀 Starting new LLM Agent session');
                    // Determine the best provider to use
                    const configStatus = await this.aiProviderManager.getConfigurationStatus();
                    const provider = configStatus.anthropic ? 'anthropic' : 'gemini';
                    try {
                        const sessionId = await this.llmAgentOrchestrator.startSession(message, provider);
                        console.log(`✅ LLM Agent session started: ${sessionId}`);
                        // The agent will run automatically in the background
                        // The output will be shown via the output channel
                        this.postMessage({
                            type: 'assistantMessage',
                            message: `🤖 **LLM Agent Session Started** (ID: ${sessionId})\n\n` +
                                `📊 Provider: ${provider}\n` +
                                `📋 Goal: ${message}\n\n` +
                                `🔍 **Check the Output Channel** for detailed execution logs and results.\n\n` +
                                `*The agent is now running autonomously and will use tools as needed to accomplish your task.*`
                        });
                        // Send todo list to UI after a brief delay to let it be created
                        setTimeout(() => {
                            const todoList = this.llmAgentOrchestrator.getCurrentTodoList();
                            if (todoList) {
                                this.postMessage({
                                    type: 'todoList',
                                    todoList: todoList
                                });
                            }
                        }, 1000);
                    }
                    catch (error) {
                        console.error('❌ Failed to start LLM Agent session:', error);
                        this.postMessage({
                            type: 'assistantMessage',
                            message: `❌ **Failed to start LLM Agent**: ${error instanceof Error ? error.message : 'Unknown error'}\n\nFalling back to regular chat mode...`
                        });
                        // Fall back to regular chat
                        await this.handleRegularChatMessage(message, files);
                    }
                }
            }
            else {
                // Quick mode - use regular chat with manual tool selection
                await this.handleRegularChatMessage(message, files);
            }
            // Hide loading state
        }
        catch (error) {
            throw error;
        }
    }
    async executeTool(toolName, input) {
        try {
            // Show tool execution start
            this.postMessage({
                type: 'assistantMessage',
                message: `⚙️ **${toolName}** - ${this.getToolDescription(toolName, input)}`
            });
            const result = await this.aiProviderManager.executeTool(toolName, input);
            // Show tool execution in chat with better formatting
            if (result.success) {
                let outputMessage = `✅ **${toolName}** completed successfully`;
                if (result.output && result.output.trim()) {
                    // Truncate very long outputs for readability
                    let displayOutput = result.output;
                    if (displayOutput.length > 1000) {
                        displayOutput = displayOutput.substring(0, 1000) + '\n...(output truncated)';
                    }
                    outputMessage += `:\n\`\`\`\n${displayOutput}\n\`\`\``;
                }
                this.postMessage({
                    type: 'assistantMessage',
                    message: outputMessage
                });
            }
            else {
                this.postMessage({
                    type: 'assistantMessage',
                    message: `❌ **${toolName}** failed: ${result.error || 'Unknown error'}`
                });
            }
            // Also send the detailed execution info
            this.postMessage({
                type: 'toolExecution',
                tool: toolName,
                input: input,
                result: result,
                timestamp: new Date()
            });
        }
        catch (error) {
            this.postMessage({
                type: 'assistantMessage',
                message: `❌ **${toolName}** error: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }
    getToolDescription(toolName, input) {
        switch (toolName) {
            case 'read_file':
                return `Reading file: ${input.filePath}`;
            case 'write_file':
                return `Writing to file: ${input.filePath}`;
            case 'edit_file':
                return `Editing file: ${input.filePath}`;
            case 'grep_search':
                return `Searching for: "${input.pattern}"`;
            case 'bash_command':
                return `Running command: ${input.command}`;
            default:
                return `Executing with: ${JSON.stringify(input)}`;
        }
    }
    // Override regular chat message to use AI provider manager
    async handleRegularChatMessage(message, files) {
        // Prepare message with file context if files are selected
        let fullMessage = message;
        if (files && files.length > 0) {
            let fileContext = '\n\n**File Context:**\n';
            for (const filePath of files) {
                try {
                    const fileContent = await this.fileOperations.readFile(filePath);
                    fileContext += `\n### ${filePath}\n\`\`\`\n${fileContent}\n\`\`\`\n`;
                }
                catch (error) {
                    fileContext += `\n### ${filePath}\n*Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}*\n`;
                }
            }
            fullMessage = `${message}${fileContext}`;
        }
        // Get AI response using provider manager
        const response = await this.aiProviderManager.sendMessage(fullMessage);
        // Hide loading and show response
        this.postMessage({
            type: 'loading',
            loading: false
        });
        this.postMessage({
            type: 'assistantMessage',
            message: response.text,
            provider: response.provider
        });
    }
    // Handle mode toggle
    async handleToggleMode() {
        const newMode = await this.aiProviderManager.toggleMode();
        this.updateModeUI(newMode);
    }
    async handleSetMode(mode) {
        await this.aiProviderManager.setMode(mode);
        this.updateModeUI(mode);
    }
    updateModeUI(mode) {
        this.postMessage({
            type: 'modeChanged',
            mode: mode
        });
    }
    // Handle specific API key configuration
    async handleConfigureSpecificApiKey(provider) {
        const success = await this.aiProviderManager.configureProvider(provider);
        if (success) {
            this.updateProviderStatus();
        }
    }
    // Handle tool execution request
    async handleExecuteTool(data) {
        await this.executeTool(data.toolName, data.input);
    }
    // Handle provider status request
    async handleGetProviderStatus() {
        this.updateProviderStatus();
    }
    // Handle new chat session request
    async handleNewChatSession() {
        await this.aiProviderManager.startNewSessions();
        this.postMessage({
            type: 'clearMessages'
        });
        this.postMessage({
            type: 'assistantMessage',
            message: '🆕 **New Chat Session Started**\n\nPrevious conversation history has been cleared. Token tracking has been reset for this session.'
        });
    }
    // Handle token stats request
    async handleGetTokenStats() {
        const stats = this.aiProviderManager.getTokenUsageStats();
        if (stats) {
            const summary = this.aiProviderManager.getFormattedTokenSummary();
            this.postMessage({
                type: 'assistantMessage',
                message: summary
            });
            this.postMessage({
                type: 'tokenStats',
                stats: stats
            });
        }
        else {
            this.postMessage({
                type: 'assistantMessage',
                message: '📊 **Token Tracking**\n\nToken tracking is currently only available when using Anthropic (Claude) as your AI provider. Configure Anthropic to see detailed usage statistics.'
            });
        }
    }
    // Update provider status in UI
    async updateProviderStatus() {
        const status = await this.aiProviderManager.getConfigurationStatus();
        const isConfigured = status.gemini || status.anthropic;
        this.postMessage({
            type: 'providerStatus',
            status: status
        });
        this.postMessage({
            type: 'updateState',
            apiKeyConfigured: isConfigured
        });
        // Also update mode status
        this.postMessage({
            type: 'modeChanged',
            mode: status.currentMode
        });
    }
    // Override the configure API key handler
    async handleConfigureApiKey() {
        const choice = await vscode.window.showQuickPick([
            {
                label: '$(key) Configure Gemini API Key',
                description: 'For Google Gemini AI models',
                value: 'gemini'
            },
            {
                label: '$(key) Configure Anthropic API Key',
                description: 'For Claude AI models',
                value: 'anthropic'
            },
            {
                label: '$(gear) Configure Both API Keys',
                description: 'Set up both providers',
                value: 'both'
            }
        ], {
            placeHolder: 'Select API key to configure'
        });
        if (!choice)
            return;
        switch (choice.value) {
            case 'gemini':
                await this.aiProviderManager.configureProvider('gemini');
                break;
            case 'anthropic':
                await this.aiProviderManager.configureProvider('anthropic');
                break;
            case 'both':
                await this.aiProviderManager.configureProvider('gemini');
                await this.aiProviderManager.configureProvider('anthropic');
                break;
        }
        this.updateProviderStatus();
    }
    // Override update webview state
    updateWebviewState() {
        this.updateProviderStatus();
        this.updateUIState();
    }
    async updateUIState() {
        const isConfigured = await this.aiProviderManager.isAnyProviderConfigured();
        this.postMessage({
            type: 'updateState',
            apiKeyConfigured: isConfigured
        });
    }
    // Initialize with Anthropic key
    async initializeWithAnthropicKey(apiKey, model) {
        await this.aiProviderManager.initializeWithAnthropicKey(apiKey, model);
        await this.updateProviderStatus();
        // Enable UI elements
        setTimeout(() => {
            this.postMessage({
                type: 'updateState',
                apiKeyConfigured: true
            });
        }, 100);
    }
    // Get current mode
    getCurrentMode() {
        return this.aiProviderManager.getMode();
    }
    // Get tool execution history
    getToolExecutionHistory() {
        return this.aiProviderManager.getToolExecutionHistory();
    }
    async handleToggleTodoItem(data) {
        try {
            const { itemId, status } = data;
            // Update the todo item status in the orchestrator
            if (status === 'completed') {
                this.llmAgentOrchestrator.markTodoItemCompleted(itemId);
            }
            else if (status === 'in_progress') {
                this.llmAgentOrchestrator.markTodoItemInProgress();
            }
            // Send updated todo list back to UI
            const todoList = this.llmAgentOrchestrator.getCurrentTodoList();
            if (todoList) {
                this.postMessage({
                    type: 'todoList',
                    todoList: todoList
                });
            }
        }
        catch (error) {
            console.error('Error toggling todo item:', error);
            this.postMessage({
                type: 'error',
                message: 'Failed to update todo item'
            });
        }
    }
    // Enhanced dispose
    dispose() {
        super.dispose();
        this.aiProviderManager.dispose();
    }
}
exports.IntegratedChatWebviewProvider = IntegratedChatWebviewProvider;
//# sourceMappingURL=integratedChatWebviewProvider.js.map