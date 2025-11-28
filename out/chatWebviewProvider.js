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
exports.ChatWebviewProvider = void 0;
const vscode = __importStar(require("vscode"));
const retryUtils_1 = require("./retryUtils");
class ChatWebviewProvider {
    constructor(_extensionUri, context, aiProviderManager, backendApiClient) {
        this._extensionUri = _extensionUri;
        this.context = context;
        this.aiProviderManager = aiProviderManager;
        this.backendApiClient = backendApiClient;
        // Initialize retry event listener for UI feedback
        this.retryEventListener = {
            onRetryAttempt: (operationName, attempt, maxRetries, delay, error) => {
                this._sendRetryNotification(operationName, attempt, maxRetries, delay, error);
            }
        };
        // Register the retry event listener
        retryUtils_1.RetryUtils.addRetryEventListener(this.retryEventListener);
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        // Listen for messages from the webview
        webviewView.webview.onDidReceiveMessage(message => {
            console.log('📨 Webview message received:', message);
            switch (message.type) {
                case 'sendMessage':
                    console.log(`🚀 Processing message: "${message.message}" in ${message.mode} mode with ${message.provider}`);
                    console.log(`📁 Context files: ${message.contextFiles?.length || 0} files`);
                    this._handleUserMessage(message.message, message.mode, message.provider, message.contextFiles);
                    break;
                case 'clearChat':
                    this._clearChat();
                    break;
                case 'configureApiKeys':
                    this._configureApiKeys();
                    break;
                case 'selectFiles':
                    this._selectFiles();
                    break;
                case 'toggleTodoItem':
                    this._handleTodoToggle(message.itemId, message.status);
                    break;
                case 'setMode':
                    this._handleModeChange(message.mode);
                    break;
            }
        }, undefined, this.context.subscriptions);
    }
    async _handleUserMessage(userMessage, mode = 'quick', provider = 'gemini', contextFiles = []) {
        if (!this._view) {
            return;
        }
        // Check authentication first (backend mode is always required)
        if (!this.backendApiClient.isAuthenticated()) {
            this._view.webview.postMessage({
                type: 'error',
                message: '🔒 Please login to use AccessLint. Use command: "AccessLint: Login"',
                timestamp: new Date()
            });
            vscode.window.showWarningMessage('AccessLint: You must be logged in to use this feature.', 'Login Now').then(async (choice) => {
                if (choice === 'Login Now') {
                    await vscode.commands.executeCommand('accesslint.login');
                }
            });
            return;
        }
        try {
            // Send user message to chat immediately
            this._view.webview.postMessage({
                type: 'userMessage',
                message: userMessage,
                timestamp: new Date()
            });
            // Show loading state
            this._view.webview.postMessage({
                type: 'aiResponse',
                message: '🤔 Thinking...',
                timestamp: new Date(),
                isLoading: true
            });
            // Create conversation if not exists (always use backend)
            try {
                if (!this.currentConversationId) {
                    const conversation = await this.backendApiClient.createChatConversation(mode === 'agent' ? 'agent' : 'chat', `Chat - ${new Date().toLocaleString()}`);
                    this.currentConversationId = conversation.id;
                }
            }
            catch (error) {
                console.error('Failed to create conversation:', error);
                throw new Error('Failed to initialize chat session. Please check your connection.');
            }
            if (mode === 'agent') {
                // For agent mode, trigger the LLM Agent Orchestrator
                // Don't send the activation message - just show the todo dropdown when created
                vscode.commands.executeCommand('accesslint.startLLMAgent', userMessage, provider);
            }
            else {
                // Quick mode - use backend or local AI provider
                console.log(`🔍 ChatWebview: Sending message to ${provider} in quick mode`);
                console.log(`📝 Message: ${userMessage}`);
                console.log(`📁 Processing ${contextFiles.length} context files`);
                // Prepare message with file context if files are selected
                let fullMessage = userMessage;
                if (contextFiles && contextFiles.length > 0) {
                    let fileContext = '\n\n**File Context:**\n';
                    for (const filePath of contextFiles) {
                        try {
                            console.log(`📖 Reading file: ${filePath}`);
                            // Resolve relative path to absolute URI
                            let fileUri;
                            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                                // Try to resolve as relative to workspace first
                                fileUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, filePath);
                            }
                            else {
                                // Fallback to treating as absolute path
                                fileUri = vscode.Uri.file(filePath);
                            }
                            console.log(`📍 Resolved URI: ${fileUri.fsPath}`);
                            const fileContent = await vscode.workspace.fs.readFile(fileUri);
                            const textContent = Buffer.from(fileContent).toString('utf8');
                            fileContext += `\n### ${filePath}\n\`\`\`\n${textContent}\n\`\`\`\n`;
                            console.log(`✅ Successfully read file: ${filePath} (${textContent.length} characters)`);
                        }
                        catch (error) {
                            console.error(`❌ Error reading file ${filePath}:`, error);
                            fileContext += `\n### ${filePath}\n*Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}*\n`;
                        }
                    }
                    fullMessage = `${userMessage}${fileContext}`;
                    console.log(`📦 Full message with context: ${fullMessage.length} characters`);
                }
                // Always use backend API (no offline mode)
                let responseText;
                try {
                    // Call backend API for AI response
                    const backendResponse = await this.backendApiClient.sendChatMessageWithResponse(this.currentConversationId || null, fullMessage, 'quick_mode');
                    responseText = backendResponse.response;
                    this.currentConversationId = backendResponse.conversationId;
                    console.log(`✅ Backend response received (${backendResponse.tokensUsed} tokens)`);
                }
                catch (error) {
                    console.error('❌ Backend call failed:', error);
                    throw new Error(`Failed to get AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
                // Send AI response to webview
                this._view.webview.postMessage({
                    type: 'aiResponse',
                    message: responseText,
                    timestamp: new Date()
                });
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            console.error(`❌ ChatWebview error:`, error);
            // Send detailed error to chat
            let userFriendlyMessage = `Error: ${errorMessage}`;
            // Add helpful suggestions for common errors
            if (errorMessage.includes('not configured')) {
                userFriendlyMessage += '\n\n💡 **Solution**: Click the "⚙️ API Keys" button to configure your AI provider.';
            }
            else if (errorMessage.includes('API key')) {
                userFriendlyMessage += '\n\n💡 **Solution**: Please check your API key configuration.';
            }
            else if (errorMessage.includes('rate limit')) {
                userFriendlyMessage += '\n\n💡 **Solution**: Please wait a moment and try again, or switch to a different AI provider.';
            }
            this._view.webview.postMessage({
                type: 'error',
                message: userFriendlyMessage,
                timestamp: new Date()
            });
        }
    }
    async _configureApiKeys() {
        // Trigger API key configuration
        vscode.commands.executeCommand('accesslint.configureApiKey');
    }
    /**
     * Send retry notification to the chat webview
     */
    _sendRetryNotification(operationName, attempt, maxRetries, delay, error) {
        if (!this._view)
            return;
        const isRateLimit = error.message.includes('rate limit') || error.message.includes('429');
        const delaySeconds = Math.ceil(delay / 1000);
        let message;
        if (isRateLimit) {
            message = `🚦 **Rate limit reached** - Retrying in ${delaySeconds} seconds (attempt ${attempt}/${maxRetries})...\n\n` +
                `⏱️ Azure OpenAI is asking us to wait ${delaySeconds} seconds before trying again. This is normal when the API is busy.`;
        }
        else {
            message = `🔄 **${operationName} failed** - Retrying in ${delaySeconds} seconds (attempt ${attempt}/${maxRetries})...\n\n` +
                `Error: ${error.message}`;
        }
        this._view.webview.postMessage({
            type: 'retryAttempt',
            message: message,
            timestamp: new Date(),
            attempt,
            maxRetries,
            delay: delaySeconds,
            isRateLimit
        });
    }
    async _selectFiles() {
        try {
            const files = await vscode.window.showOpenDialog({
                canSelectMany: true,
                canSelectFiles: true,
                canSelectFolders: false,
                openLabel: 'Add to Context',
                filters: {
                    'Code Files': ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'php', 'rb', 'go', 'rs', 'swift'],
                    'Web Files': ['html', 'css', 'scss', 'sass', 'less'],
                    'Config Files': ['json', 'yaml', 'yml', 'xml', 'toml', 'ini'],
                    'Text Files': ['txt', 'md', 'rst'],
                    'All Files': ['*']
                }
            });
            if (files && files.length > 0) {
                const fileNames = files.map(file => {
                    const workspaceFolder = vscode.workspace.getWorkspaceFolder(file);
                    if (workspaceFolder) {
                        return vscode.workspace.asRelativePath(file);
                    }
                    return file.fsPath;
                });
                // Send selected files to webview
                if (this._view) {
                    this._view.webview.postMessage({
                        type: 'filesSelected',
                        files: fileNames
                    });
                }
            }
        }
        catch (error) {
            console.error('Error selecting files:', error);
        }
    }
    async _handleTodoToggle(itemId, newStatus) {
        try {
            // For now, just log the toggle - in a full implementation, 
            // this would update the todo list state and notify the agent orchestrator
            console.log(`📋 Todo item ${itemId} toggled to ${newStatus}`);
            // You could implement actual todo state management here by:
            // 1. Getting the current agent session from the orchestrator
            // 2. Updating the todo item status
            // 3. Sending the updated todo list back to the webview
            // For now, we'll just acknowledge the toggle
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'todoItemToggled',
                    itemId,
                    newStatus,
                    timestamp: new Date()
                });
            }
        }
        catch (error) {
            console.error('Error toggling todo item:', error);
        }
    }
    async _handleModeChange(mode) {
        try {
            console.log(`🔄 Mode change requested: ${mode}`);
            // Set the mode through the AI provider manager
            await this.aiProviderManager.setMode(mode);
            console.log(`✅ Mode changed to: ${mode}`);
        }
        catch (error) {
            console.error('Error changing mode:', error);
        }
    }
    _clearChat() {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'clearChat'
            });
        }
        // Reset conversation ID for new conversation
        this.currentConversationId = undefined;
    }
    postMessage(message) {
        if (this._view) {
            this._view.webview.postMessage(message);
        }
    }
    openChat() {
        if (this._view) {
            this._view.show?.(true);
        }
    }
    clearChat() {
        this._clearChat();
    }
    _getHtmlForWebview(webview) {
        // Base64 encoded SVG icon (fixes display issues in webview)
        const iconPath = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8Y2lyY2xlIGN4PSIxMiIgY3k9IjYiIHI9IjIiIGZpbGw9IndoaXRlIi8+CiAgPHBhdGggZD0iTTE2IDhIOEM3LjQ1IDggNyA4LjQ1IDcgOUM3IDkuNTUgNy40NSAxMCA4IDEwSDEwVjE2QzEwIDE2LjU1IDEwLjQ1IDE3IDExIDE3QzExLjU1IDE3IDEyIDE2LjU1IDEyIDE2VjEzSDEyVjE2QzEyIDE2LjU1IDEyLjQ1IDE3IDEzIDE3QzEzLjU1IDE3IDE0IDE2LjU1IDE0IDE2VjEwSDE2QzE2LjU1IDEwIDE3IDkuNTUgMTcgOUMxNyA4LjQ1IDE2LjU1IDggMTYgOFoiIGZpbGw9IndoaXRlIi8+CiAgPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMS41IiBmaWxsPSJub25lIi8+Cjwvc3ZnPiA=';
        return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AccessLint Chat</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
            padding: 10px;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid var(--vscode-widget-border);
            margin-bottom: 10px;
        }
        
        .logo-section {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .logo {
            width: 24px;
            height: 24px;
            opacity: 0.9;
        }
        
        .title {
            font-size: 16px;
            font-weight: bold;
            color: var(--vscode-foreground);
        }
        
        .controls-section {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .mode-toggle {
            display: flex;
            background-color: var(--vscode-button-secondaryBackground);
            border-radius: 4px;
            overflow: hidden;
        }
        
        .mode-button {
            padding: 6px 12px;
            border: none;
            background: transparent;
            color: var(--vscode-button-secondaryForeground);
            cursor: pointer;
            font-size: 11px;
            transition: background-color 0.2s;
        }
        
        .mode-button.active {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .mode-button:hover:not(.active) {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .ai-badge {
            padding: 6px 12px;
            border-radius: 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            font-size: 11px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .login-status {
            padding: 8px 12px;
            margin-bottom: 10px;
            border-radius: 4px;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
        }
        
        .login-status.authenticated {
            background-color: #1a472a;
            border: 1px solid #2ea043;
            color: #3fb950;
        }
        
        .login-status.not-authenticated {
            background-color: #4a1e1e;
            border: 1px solid #da3633;
            color: #ff7b72;
        }
        
        .login-status-text {
            flex: 1;
        }
        
        .chat-container {
            flex: 1;
            overflow-y: auto;
            padding: 10px 0;
            margin-bottom: 10px;
        }
        
        .message {
            margin-bottom: 15px;
            padding: 10px;
            border-radius: 8px;
            word-wrap: break-word;
        }
        
        .user-message {
            background-color: var(--vscode-inputOption-activeBorder);
            margin-left: 20px;
        }
        
        .ai-message {
            background-color: var(--vscode-textBlockQuote-background);
            margin-right: 20px;
        }
        
        .error-message {
            background-color: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
        }
        
        .input-container {
            border-top: 1px solid var(--vscode-widget-border);
            padding-top: 10px;
        }
        
        .input-row {
            display: flex;
            gap: 10px;
            align-items: flex-end;
        }
        
        .message-input {
            flex: 1;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            resize: vertical;
            min-height: 20px;
            font-family: inherit;
        }
        
        .input-buttons {
            display: flex;
            gap: 5px;
        }
        
        .send-button, .clear-button, .context-button {
            padding: 8px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s;
        }
        
        .send-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .send-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .clear-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .clear-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .context-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            padding: 8px 10px;
            font-size: 14px;
        }
        
        .context-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .context-container {
            margin-top: 10px;
            padding: 10px;
            background-color: var(--vscode-textBlockQuote-background);
            border-radius: 4px;
            border: 1px solid var(--vscode-widget-border);
        }
        
        .context-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-size: 12px;
            font-weight: bold;
        }
        
        .clear-context-button {
            background: none;
            border: none;
            color: var(--vscode-button-secondaryForeground);
            cursor: pointer;
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 3px;
        }
        
        .clear-context-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .context-files {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
        }
        
        .context-file {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 11px;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .context-file-remove {
            cursor: pointer;
            font-weight: bold;
            margin-left: 5px;
        }
        
        .context-file-remove:hover {
            color: var(--vscode-errorForeground);
        }
        
        .bottom-buttons {
            margin-top: 10px;
            display: flex;
            justify-content: center;
        }
        
        .timestamp {
            font-size: 11px;
            opacity: 0.7;
            margin-top: 5px;
        }
        
        pre {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            white-space: pre-wrap;
        }
        
        .loading-message {
            opacity: 0.7;
        }
        
        .loading-message .timestamp::after {
            content: " (Loading...)";
            font-style: italic;
        }
    </style>
      </head>
      <body>
    <!-- Header with Logo and Controls -->
          <div class="header">
        <div class="logo-section">
            <img src="${iconPath}" alt="AccessLint" class="logo">
            <div class="title">AccessLint</div>
            </div>
        <div class="controls-section">
            <div class="mode-toggle">
                <button class="mode-button active" id="quickMode" data-mode="quick">Quick</button>
                <button class="mode-button" id="agentMode" data-mode="agent">Agent</button>
          </div>
            <div class="ai-badge">🤖 GPT-5</div>
            </div>
          </div>

    <!-- Login Status Bar -->
    <div class="login-status ${this.backendApiClient.isAuthenticated() ? 'authenticated' : 'not-authenticated'}" id="loginStatus">
        <span class="login-status-text" id="loginStatusText">
            ${this.backendApiClient.isAuthenticated() ? '✅ Logged in and connected to backend' : '🔒 Not logged in - Please login to use features'}
        </span>
    </div>

    <!-- Chat Container -->
    <div class="chat-container" id="chatContainer">
        <div class="message ai-message">
            <div>👋 Welcome to AccessLint! I'm your AI coding assistant powered by GPT-5.</div>
            <div><strong>Quick Mode:</strong> Direct chat with manual tool selection</div>
            <div><strong>Agent Mode:</strong> Autonomous AI that automatically uses tools</div>
            <div>Start chatting to get accessibility help!</div>
            <div class="timestamp">Ready to help</div>
            </div>
          </div>

    <!-- Input Container -->
    <div class="input-container">
        <div class="input-row">
            <textarea class="message-input" id="messageInput" 
                      placeholder="Ask me anything about your code..." 
                      rows="2"></textarea>
            <div class="input-buttons">
                <button class="context-button" id="contextButton" title="Add file context">📎</button>
                <button class="send-button" id="sendButton">Send</button>
            </div>
        </div>
        <div class="context-container" id="contextContainer" style="display: none;">
            <div class="context-header">
                <span>Selected Files:</span>
                <button class="clear-context-button" id="clearContextButton">Clear All</button>
            </div>
            <div class="context-files" id="contextFiles"></div>
        </div>
        <div class="bottom-buttons">
            <button class="clear-button" id="clearButton">Clear Chat</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const chatContainer = document.getElementById('chatContainer');
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        const clearButton = document.getElementById('clearButton');
        const quickModeBtn = document.getElementById('quickMode');
        const agentModeBtn = document.getElementById('agentMode');
        const configButton = document.getElementById('configButton');
        const providerSelect = document.getElementById('providerSelect');
        const contextButton = document.getElementById('contextButton');
        const contextContainer = document.getElementById('contextContainer');
        const contextFiles = document.getElementById('contextFiles');
        const clearContextButton = document.getElementById('clearContextButton');
        
        let currentMode = 'quick';
        let currentProvider = 'gemini';
        let selectedFiles = [];

        function addMessage(content, type, timestamp, isLoading = false) {
            console.log('✏️ addMessage called:', { content, type, timestamp, isLoading });
            console.log('📦 chatContainer element:', chatContainer);
            console.log('📦 chatContainer exists:', !!chatContainer);
            console.log('📦 document.getElementById(chatContainer):', document.getElementById('chatContainer'));
            
            if (!chatContainer) {
                console.error('❌ chatContainer is null! Cannot add message.');
                return;
            }
            
            // Remove previous loading message if this is a real response
            if (!isLoading) {
                const loadingMessages = chatContainer.querySelectorAll('.loading-message');
                console.log('🗑️ Removing loading messages:', loadingMessages.length);
                loadingMessages.forEach(msg => msg.remove());
            }
            
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${type}-message\`;
            if (isLoading) {
                messageDiv.classList.add('loading-message');
            }
            
            const contentDiv = document.createElement('div');
            try {
                contentDiv.innerHTML = formatMessage(content);
                console.log('✅ Content formatted successfully');
            } catch (error) {
                console.error('❌ Error formatting message:', error);
                contentDiv.textContent = content;
            }
            messageDiv.appendChild(contentDiv);
            
            const timestampDiv = document.createElement('div');
            timestampDiv.className = 'timestamp';
            timestampDiv.textContent = new Date(timestamp).toLocaleTimeString();
            messageDiv.appendChild(timestampDiv);
            
            console.log('➕ Adding message element to chatContainer');
            console.log('📦 messageDiv:', messageDiv);
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
            console.log('📏 chatContainer children count:', chatContainer.children.length);
            console.log('📏 chatContainer innerHTML length:', chatContainer.innerHTML.length);
        }

        function formatMessage(text) {
            // Simple markdown-like formatting
            return text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre>$1</pre>')
                .replace(/\`(.*?)\`/g, '<code>$1</code>')
                .replace(/\\n/g, '<br>');
        }

        function sendMessage() {
            const message = messageInput.value.trim();
            if (message) {
                // Combine message with context if files are selected
                let finalMessage = message;
                if (selectedFiles.length > 0) {
                    finalMessage = \`\${message}\n\nContext files: \${selectedFiles.join(', ')}\`;
                }
                
                vscode.postMessage({
                    type: 'sendMessage',
                    message: finalMessage,
                    mode: currentMode,
                    provider: currentProvider,
                    contextFiles: selectedFiles
                });
                messageInput.value = '';
                messageInput.focus();
            }
        }

        function addContext() {
            vscode.postMessage({
                type: 'selectFiles'
            });
        }

        function removeContextFile(filename) {
            selectedFiles = selectedFiles.filter(f => f !== filename);
            updateContextDisplay();
        }

        function clearContext() {
            selectedFiles = [];
            updateContextDisplay();
        }

        function updateContextDisplay() {
            if (selectedFiles.length === 0) {
                contextContainer.style.display = 'none';
            } else {
                contextContainer.style.display = 'block';
                contextFiles.innerHTML = selectedFiles.map(file => 
                    \`<div class="context-file">
                        📄 \${file}
                        <span class="context-file-remove" onclick="removeContextFile('\${file}')">×</span>
                    </div>\`
                ).join('');
            }
        }

        function clearChat() {
            chatContainer.innerHTML = '';
            addMessage('Chat cleared. How can I help you?', 'ai', new Date());
        }

        function setMode(mode) {
            currentMode = mode;
            quickModeBtn.classList.toggle('active', mode === 'quick');
            agentModeBtn.classList.toggle('active', mode === 'agent');
            
            const placeholder = mode === 'quick' 
                ? 'Ask me anything about your code...'
                : 'Tell me what task you want me to complete autonomously...';
            messageInput.placeholder = placeholder;
            
            // Update todo dropdown visibility based on mode
            updateTodoDropdownVisibility(mode);
        }

        function configureApiKeys() {
            vscode.postMessage({
                type: 'configureApiKeys'
            });
        }

        function setProvider(provider) {
            currentProvider = provider;
            addMessage(\`Switched to \${provider === 'gemini' ? 'Google Gemini' : provider === 'anthropic' ? 'Anthropic Claude' : 'OpenAI GPT'}\`, 'ai', new Date());
        }

        // Event listeners
        sendButton.addEventListener('click', sendMessage);
        clearButton.addEventListener('click', clearChat);
        configButton.addEventListener('click', configureApiKeys);
        contextButton.addEventListener('click', addContext);
        clearContextButton.addEventListener('click', clearContext);
        
        quickModeBtn.addEventListener('click', () => {
            setMode('quick');
            vscode.postMessage({
                type: 'setMode',
                mode: 'quick'
            });
        });
        agentModeBtn.addEventListener('click', () => {
            setMode('agent');
            vscode.postMessage({
                type: 'setMode',
                mode: 'agent'
            });
        });
        
        providerSelect.addEventListener('change', (e) => setProvider(e.target.value));
        
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Listen for messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            console.log('🎯 Webview received message:', message);
            
            switch (message.type) {
                case 'userMessage':
                    console.log('👤 Adding user message:', message.message);
                    addMessage(message.message, 'user', message.timestamp);
                    break;
                case 'aiResponse':
                    console.log('🤖 Adding AI response:', message.message, 'Loading:', message.isLoading);
                    addMessage(message.message, 'ai', message.timestamp, message.isLoading);
                    break;
                case 'error':
                    console.log('❌ Adding error message:', message.message);
                    addMessage(message.message, 'error', message.timestamp);
                    break;
                case 'clearChat':
                    console.log('🧹 Clearing chat');
                    clearChat();
                    break;
                case 'filesSelected':
                    console.log('📎 Files selected:', message.files);
                    selectedFiles = [...selectedFiles, ...message.files];
                    updateContextDisplay();
                    break;
                    
                case 'assistantMessage':
                    console.log('🤖 Adding assistant message:', message.message);
                    addMessage(message.message, 'ai', message.timestamp);
                    break;
                    
                case 'taskCompletion':
                    console.log('✅ Task completion:', message.result);
                    if (message.result) {
                        addMessage(message.result, 'ai', message.timestamp);
                        if (message.command) {
                            addMessage(\`💡 Suggested command: \\\`\${message.command}\\\`\`, 'ai', message.timestamp);
                        }
                    }
                    break;
                    
                case 'todoList':
                    console.log('📋 Todo list received in webview:', message.todoList);
                    console.log('📋 Todo items count:', message.todoList?.items?.length);
                    displayTodoList(message.todoList);
                    break;
                    
                case 'clearLoading':
                    console.log('🧹 Clearing loading messages');
                    // Remove any loading messages
                    const loadingMessages = document.querySelectorAll('.loading-message');
                    loadingMessages.forEach(msg => msg.remove());
                    break;
                    
                case 'toolExecution':
                    // Show tool execution status only in agent mode
                    if ((message.execution || message.tool) && currentMode === 'agent') {
                        appendToolExecution(message);
                    }
                    break;
                    
                case 'modeChanged':
                    // Update mode when changed from backend
                    if (message.mode) {
                        setMode(message.mode);
                    }
                    break;
            }
        });

        // Focus input on load
        messageInput.focus();

        // Add tool execution display function
        function appendToolExecution(data) {
            try {
                // The data structure is: { type: 'toolExecution', execution: { toolName, result, duration, ... } }
                const execution = data.execution || data;
                const toolName = execution.toolName;
                const result = execution.result;
                const duration = execution.duration;
                
                // Validate required data
                if (!toolName) {
                    console.warn('appendToolExecution: No tool name found in data:', data);
                    return;
                }
                
                // Create a simple status message like "✅ list_directory SUCCESS (254ms)"
                const statusIcon = result?.success ? '✅' : '❌';
                const statusText = result?.success ? 'SUCCESS' : 'ERROR';
                const durationText = duration ? \` (\${duration}ms)\` : '';
                const statusMessage = \`\${statusIcon} \${toolName} \${statusText}\${durationText}\`;
                
                // Add as a simple message in the chat
                addMessage(statusMessage, 'ai', new Date());
            } catch (error) {
                console.error('Error in appendToolExecution:', error);
            }
        }

        // Todo List Functions
        let currentTodoList = null;

        function displayTodoList(todoList) {
            console.log('📋 displayTodoList: Received todo list with', todoList?.items?.length, 'items');
            currentTodoList = todoList;
            
            if (!todoList || !todoList.items) {
                console.log('❌ displayTodoList: todoList is invalid', todoList);
                return;
            }

            console.log('📋 displayTodoList: Updating dropdown');
            updateTodoDropdown(todoList);
            
            // Show dropdown if in agent mode
            updateTodoDropdownVisibility(currentMode);
        }

        function updateTodoDropdown(todoList) {
            console.log('🔍 updateTodoDropdown: Called with todoList:', todoList);
            
            let dropdown = document.getElementById('todo-dropdown');
            console.log('🔍 updateTodoDropdown: dropdown exists:', !!dropdown);
            
            if (!dropdown) {
                console.log('🔍 updateTodoDropdown: Creating new dropdown');
                createTodoDropdown();
                dropdown = document.getElementById('todo-dropdown');
                console.log('🔍 updateTodoDropdown: dropdown created:', !!dropdown);
            }
            
            if (!dropdown) {
                console.log('❌ updateTodoDropdown: Failed to create dropdown');
                return;
            }
            
            console.log('🔍 updateTodoDropdown: Updating with', todoList.items.length, 'items');
            
            // Update dropdown button - simplified
            const dropdownBtn = dropdown.querySelector('.todo-dropdown-btn');
            if (dropdownBtn) {
                dropdownBtn.innerHTML = \`📋 Todo List Created (\${todoList.items.length} items) <span class="dropdown-arrow">▼</span>\`;
                console.log('✅ updateTodoDropdown: Button updated');
            }
            
            // Update dropdown content - simplified, no status tracking
            const dropdownContent = dropdown.querySelector('.todo-dropdown-content');
            if (dropdownContent) {
                dropdownContent.innerHTML = \`
                    <div class="todo-dropdown-header">
                        <div class="todo-query-mini">"\${todoList.query}"</div>
                    </div>
                    <div class="todo-items-mini">
                        \${todoList.items.map((item, index) => \`
                            <div class="todo-item-mini">
                                <div class="todo-number">\${index + 1}.</div>
                                <div class="todo-content-mini">
                                    <div class="todo-title-mini">\${item.title}</div>
                                </div>
                            </div>
                        \`).join('')}
                    </div>
                \`;
                console.log('✅ updateTodoDropdown: Content updated');
            }
            
            // Auto-open the dropdown to show the todo list
            const dropdownContentEl = document.getElementById('todo-dropdown-content');
            const arrow = document.querySelector('.dropdown-arrow');
            if (dropdownContentEl) {
                dropdownContentEl.style.display = 'block';
                if (arrow) {
                    arrow.textContent = '▲';
                }
                console.log('✅ updateTodoDropdown: Dropdown opened automatically');
            }
        }

        function createTodoDropdown() {
            console.log('🔍 createTodoDropdown: Starting creation');
            
            const inputContainer = document.querySelector('.input-container');
            console.log('🔍 createTodoDropdown: inputContainer found:', !!inputContainer);
            
            if (!inputContainer) {
                console.log('❌ createTodoDropdown: inputContainer not found');
                return;
            }
            
            const dropdown = document.createElement('div');
            dropdown.id = 'todo-dropdown';
            dropdown.className = 'todo-dropdown';
            dropdown.style.display = 'none'; // Initially hidden
            dropdown.innerHTML = \`
                <button class="todo-dropdown-btn" onclick="toggleTodoDropdown()">
                    📋 Todos (0/0) <span class="dropdown-arrow">▼</span>
                </button>
                <div class="todo-dropdown-content" id="todo-dropdown-content">
                    <div class="todo-dropdown-empty">No active todos</div>
                </div>
            \`;
            
            // Insert before the input container
            inputContainer.parentNode.insertBefore(dropdown, inputContainer);
            console.log('✅ createTodoDropdown: Dropdown created and inserted');
        }
        
        function updateTodoDropdownVisibility(mode) {
            const dropdown = document.getElementById('todo-dropdown');
            if (dropdown) {
                if (mode === 'agent' && currentTodoList) {
                    // Show dropdown only in agent mode when todo list exists
                    dropdown.style.display = 'block';
                } else {
                    // Hide dropdown in quick mode or when no todo list
                    dropdown.style.display = 'none';
                }
            }
        }

        function toggleTodoDropdown() {
            const dropdown = document.getElementById('todo-dropdown-content');
            const arrow = document.querySelector('.dropdown-arrow');
            if (dropdown) {
                const isVisible = dropdown.style.display === 'block';
                dropdown.style.display = isVisible ? 'none' : 'block';
                if (arrow) {
                    arrow.textContent = isVisible ? '▼' : '▲';
                }
            }
        }

        // Initialize todo dropdown when DOM is ready
        function initTodoDropdown() {
            console.log('🔍 Initializing todo dropdown on page load');
            createTodoDropdown();
            // Start with dropdown hidden (will show when needed)
            updateTodoDropdownVisibility(currentMode);
        }

        // Initialize todo dropdown after a small delay to ensure DOM is ready
        setTimeout(initTodoDropdown, 100);
    </script>
</body>
</html>`;
    }
    dispose() {
        // Clean up retry event listener
        if (this.retryEventListener) {
            retryUtils_1.RetryUtils.removeRetryEventListener(this.retryEventListener);
        }
        // Clean up resources
        this._view = undefined;
    }
}
exports.ChatWebviewProvider = ChatWebviewProvider;
ChatWebviewProvider.viewType = 'accesslint.chatView';
//# sourceMappingURL=chatWebviewProvider.js.map