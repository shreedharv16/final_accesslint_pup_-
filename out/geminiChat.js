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
exports.GeminiChatProvider = void 0;
const vscode = __importStar(require("vscode"));
const generative_ai_1 = require("@google/generative-ai");
class GeminiChatProvider {
    constructor(context) {
        this.genAI = null;
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('AccessLint Chat');
        this.currentSession = {
            messages: [],
            apiKeyConfigured: false
        };
        // Start initialization but don't block constructor
        this.initializationPromise = this.initializeWithStoredApiKey();
    }
    async initializeWithStoredApiKey() {
        try {
            const storedKey = await this.getStoredApiKey();
            if (storedKey) {
                this.initializeGemini(storedKey);
                this.outputChannel.appendLine('🔑 API key loaded from storage');
            }
            else {
                this.outputChannel.appendLine('🔑 No stored API key found');
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Failed to initialize API key: ${error}`);
        }
    }
    async waitForInitialization() {
        await this.initializationPromise;
    }
    async configureApiKey() {
        const apiKey = await vscode.window.showInputBox({
            prompt: 'Enter your Gemini API Key',
            placeHolder: 'Your Gemini API key...',
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'API key cannot be empty';
                }
                if (value.length < 10) {
                    return 'API key seems too short';
                }
                return null;
            }
        });
        if (!apiKey) {
            return false;
        }
        try {
            // Test the API key
            await this.testApiKey(apiKey);
            // Store the key
            await this.storeApiKey(apiKey);
            this.initializeGemini(apiKey);
            vscode.window.showInformationMessage('✅ Gemini API key configured successfully!');
            return true;
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`❌ Invalid API key: ${errorMsg}`);
            return false;
        }
    }
    async testApiKey(apiKey) {
        const testGenAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const model = testGenAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
        // Simple test query
        const result = await model.generateContent("Hello");
        const response = await result.response;
        if (!response.text()) {
            throw new Error('No response from Gemini API');
        }
    }
    initializeGemini(apiKey) {
        this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        this.currentSession.apiKeyConfigured = true;
        this.outputChannel.appendLine('🤖 Gemini AI initialized successfully');
    }
    async sendMessage(userMessage) {
        if (!this.genAI) {
            throw new Error('Gemini API not configured. Please set up your API key first.');
        }
        this.outputChannel.appendLine(`📤 User: ${userMessage}`);
        // Add user message to session
        const userChatMessage = {
            id: this.generateMessageId(),
            role: 'user',
            content: userMessage,
            timestamp: new Date()
        };
        this.currentSession.messages.push(userChatMessage);
        try {
            const model = this.genAI.getGenerativeModel({
                model: "gemini-2.0-flash-exp",
                systemInstruction: this.getSystemPrompt()
            });
            // Build conversation history for context
            const conversationHistory = this.buildConversationHistory();
            const result = await model.generateContent(conversationHistory + `\n\nUser: ${userMessage}`);
            const response = await result.response;
            const assistantMessage = response.text();
            this.outputChannel.appendLine(`📥 Assistant: ${assistantMessage}`);
            // Add assistant message to session
            const assistantChatMessage = {
                id: this.generateMessageId(),
                role: 'assistant',
                content: assistantMessage,
                timestamp: new Date()
            };
            this.currentSession.messages.push(assistantChatMessage);
            return assistantMessage;
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.outputChannel.appendLine(`❌ Chat error: ${errorMsg}`);
            throw new Error(`Failed to get response from Gemini: ${errorMsg}`);
        }
    }
    getSystemPrompt() {
        return `You are AccessLint, an AI assistant specialized in web accessibility and WCAG compliance. You help developers:

1. Understand accessibility best practices
2. Identify potential accessibility issues in code
3. Provide specific, actionable recommendations
4. Explain WCAG guidelines in practical terms
5. Suggest improvements for inclusive design

Focus on being helpful, accurate, and providing concrete examples. When discussing code, be specific about HTML, CSS, JavaScript, and ARIA attributes. Always consider different types of disabilities and assistive technologies.

Current context: You are integrated into a VSCode extension that scans repositories for accessibility analysis.`;
    }
    buildConversationHistory() {
        if (this.currentSession.messages.length === 0) {
            return '';
        }
        // Include last 10 messages for context (to avoid token limits)
        const recentMessages = this.currentSession.messages.slice(-10);
        return recentMessages
            .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
            .join('\n\n');
    }
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    async clearConversation() {
        this.currentSession.messages = [];
        this.outputChannel.appendLine('🗑️ Conversation cleared');
    }
    getSession() {
        return { ...this.currentSession };
    }
    isConfigured() {
        return this.currentSession.apiKeyConfigured;
    }
    async refreshApiKey() {
        // Refresh API key from storage
        await this.initializeWithStoredApiKey();
    }
    async storeApiKey(apiKey) {
        // Store in globalState to match ApiKeyManager
        await this.context.globalState.update('accesslint.geminiApiKey', apiKey);
    }
    async getStoredApiKey() {
        // Get from globalState to match ApiKeyManager
        return this.context.globalState.get('accesslint.geminiApiKey');
    }
    async removeApiKey() {
        await this.context.globalState.update('accesslint.geminiApiKey', undefined);
        this.genAI = null;
        this.currentSession.apiKeyConfigured = false;
        this.outputChannel.appendLine('🗑️ API key removed');
    }
    dispose() {
        this.outputChannel.dispose();
    }
}
exports.GeminiChatProvider = GeminiChatProvider;
//# sourceMappingURL=geminiChat.js.map