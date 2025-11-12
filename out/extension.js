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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const chatWebviewProvider_1 = require("./chatWebviewProvider");
const testingWebviewProvider_1 = require("./testingWebviewProvider");
const agentLLMOrchestrator_1 = require("./agentLLMOrchestrator");
const testingAgentOrchestrator_1 = require("./testingAgentOrchestrator");
const apiKeyManager_1 = require("./apiKeyManager");
const geminiChat_1 = require("./geminiChat");
const anthropicChat_1 = require("./anthropicChat");
const openaiChat_1 = require("./openaiChat");
const aiProviderManager_1 = require("./aiProviderManager");
async function activate(context) {
    console.log('🚀 AccessLint extension is now active!');
    // Create debug output channel
    const debugChannel = vscode.window.createOutputChannel('AccessLint Debug');
    debugChannel.appendLine('🔍 AccessLint Debug Channel Activated');
    debugChannel.appendLine('💡 To see these logs: View > Output > Select "AccessLint Debug" from dropdown');
    debugChannel.show(); // Show the debug channel immediately
    // Initialize API Key Manager
    const apiKeyManager = new apiKeyManager_1.ApiKeyManager(context);
    // Initialize AI Providers
    const geminiChatProvider = new geminiChat_1.GeminiChatProvider(context);
    const anthropicChatProvider = new anthropicChat_1.AnthropicChatProvider(context);
    const openaiChatProvider = new openaiChat_1.OpenAIChatProvider(context);
    // Wait for API key initialization
    geminiChatProvider.waitForInitialization().then(() => {
        debugChannel.appendLine('✅ Gemini provider initialized');
    }).catch((error) => {
        debugChannel.appendLine(`⚠️ Gemini provider initialization failed: ${error}`);
    });
    anthropicChatProvider.waitForInitialization().then(() => {
        debugChannel.appendLine('✅ Anthropic provider initialized');
    }).catch((error) => {
        debugChannel.appendLine(`⚠️ Anthropic provider initialization failed: ${error}`);
    });
    openaiChatProvider.waitForInitialization().then(() => {
        debugChannel.appendLine('✅ OpenAI provider initialized');
    }).catch((error) => {
        debugChannel.appendLine(`⚠️ OpenAI provider initialization failed: ${error}`);
    });
    // Create AI Provider Manager with the primary provider (Gemini by default)
    const aiProviderManager = new aiProviderManager_1.AiProviderManager(context, geminiChatProvider);
    // Initialize Chat WebView Provider
    const chatProvider = new chatWebviewProvider_1.ChatWebviewProvider(context.extensionUri, context, aiProviderManager);
    // Set up AI Provider Manager with webview
    aiProviderManager.setWebviewProvider(chatProvider);
    // Initialize DiffViewerManager
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const { DiffViewerManager } = await Promise.resolve().then(() => __importStar(require('./diffViewer/DiffViewerManager')));
    DiffViewerManager.getInstance(context, workspaceRoot);
    // Initialize LLM Agent Orchestrator for CHAT interface (original, untouched)
    const llmAgentOrchestrator = new agentLLMOrchestrator_1.AgentLLMOrchestrator(aiProviderManager, aiProviderManager.getToolManager());
    // Initialize TESTING Agent Orchestrator (specialized for testing menu with crash fixes)
    const testingAgentOrchestrator = new testingAgentOrchestrator_1.TestingAgentOrchestrator(aiProviderManager, aiProviderManager.getToolManager());
    // Initialize Testing WebView Provider with specialized testing orchestrator
    const testingProvider = new testingWebviewProvider_1.TestingWebviewProvider(context.extensionUri, context, testingAgentOrchestrator);
    // Register webview providers
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('accesslint.chatView', chatProvider), vscode.window.registerWebviewViewProvider('accesslint.testingView', testingProvider));
    // Register Commands
    // API Key Configuration Commands
    const configureApiKeyCommand = vscode.commands.registerCommand('accesslint.configureApiKey', async () => {
        await apiKeyManager.configureApiKeys();
        // Refresh all providers after configuration
        await openaiChatProvider.refreshApiKey();
        debugChannel.appendLine('✅ All providers refreshed after configuration');
    });
    const configureGeminiApiKeyCommand = vscode.commands.registerCommand('accesslint.configureGeminiApiKey', async () => {
        await apiKeyManager.configureGeminiApiKey();
    });
    const configureAnthropicApiKeyCommand = vscode.commands.registerCommand('accesslint.configureAnthropicApiKey', async () => {
        await apiKeyManager.configureAnthropicApiKey();
    });
    const configureOpenAIApiKeyCommand = vscode.commands.registerCommand('accesslint.configureOpenAIApiKey', async () => {
        const configured = await apiKeyManager.configureOpenAIApiKey();
        if (configured) {
            // Refresh the OpenAI provider after configuration
            await openaiChatProvider.refreshApiKey();
            debugChannel.appendLine('✅ Azure OpenAI provider refreshed after configuration');
        }
    });
    // Chat Commands
    const openChatCommand = vscode.commands.registerCommand('accesslint.openChat', () => {
        vscode.commands.executeCommand('accesslint.chatView.focus');
    });
    const newChatSessionCommand = vscode.commands.registerCommand('accesslint.newChatSession', () => {
        chatProvider.clearChat();
        // Clear conversation history for all providers
        openaiChatProvider.newSession();
        debugChannel.appendLine('🆕 New chat session started - all conversation histories cleared');
    });
    // Testing Commands
    const openTestingCommand = vscode.commands.registerCommand('accesslint.openTesting', () => {
        vscode.commands.executeCommand('accesslint.testingView.focus');
    });
    // Panel Commands  
    const showAccessLintCommand = vscode.commands.registerCommand('accesslint.showPanel', () => {
        vscode.commands.executeCommand('accesslint.chatView.focus');
    });
    // LLM Agent Commands
    const startLLMAgentCommand = vscode.commands.registerCommand('accesslint.startLLMAgent', async (input, provider) => {
        let agentInput = input;
        let selectedProvider = provider;
        // If called without parameters, show input dialog
        if (!agentInput) {
            agentInput = await vscode.window.showInputBox({
                prompt: 'What would you like the agent to do?',
                placeHolder: 'e.g., "Analyze this file for accessibility issues" or "Fix all console.log statements"'
            });
        }
        if (agentInput) {
            // If provider not specified, ask user to choose
            if (!selectedProvider) {
                const providerChoice = await vscode.window.showQuickPick([
                    { label: 'Gemini', value: 'gemini' },
                    { label: 'Anthropic (Claude)', value: 'anthropic' },
                    { label: 'OpenAI (GPT)', value: 'openai' }
                ], {
                    placeHolder: 'Select AI provider for agent mode'
                });
                if (providerChoice) {
                    selectedProvider = providerChoice.value;
                }
            }
            if (selectedProvider) {
                try {
                    console.log(`🔍 DEBUG: Starting agent session with input: "${agentInput}" and provider: ${selectedProvider}`);
                    await llmAgentOrchestrator.startSession(agentInput, selectedProvider);
                    console.log('✅ DEBUG: Agent session started successfully');
                    vscode.window.showInformationMessage('🤖 Agent started! Check the output panel for progress.');
                }
                catch (error) {
                    console.error('❌ DEBUG: Agent session failed:', error);
                    vscode.window.showErrorMessage(`Failed to start agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
        }
    });
    const stopLLMAgentCommand = vscode.commands.registerCommand('accesslint.stopLLMAgent', async () => {
        await llmAgentOrchestrator.stopSession();
        vscode.window.showInformationMessage('🛑 Agent stopped.');
    });
    const showLLMAgentStatusCommand = vscode.commands.registerCommand('accesslint.showLLMAgentStatus', () => {
        const status = llmAgentOrchestrator.getSessionStatus();
        if (status) {
            const message = `Agent Status: ${status.status}
Goal: ${status.goal}
Iterations: ${status.iterations}
Started: ${status.startTime.toLocaleTimeString()}`;
            vscode.window.showInformationMessage(message);
        }
        else {
            vscode.window.showInformationMessage('No active agent session.');
        }
    });
    // Token Usage Commands
    const showTokenStatsCommand = vscode.commands.registerCommand('accesslint.showTokenStats', () => {
        // This can be enhanced later with actual token tracking
        vscode.window.showInformationMessage('Token usage statistics will be available in a future update.');
    });
    const configureContextTruncationCommand = vscode.commands.registerCommand('accesslint.configureContextTruncation', async () => {
        const choice = await vscode.window.showQuickPick([
            { label: 'Conservative', description: 'Keep more context, slower responses' },
            { label: 'Balanced', description: 'Good balance of context and speed' },
            { label: 'Aggressive', description: 'Less context, faster responses' }
        ], {
            placeHolder: 'Select context truncation strategy'
        });
        if (choice) {
            vscode.window.showInformationMessage(`Context truncation set to: ${choice.label}`);
        }
    });
    // Add to subscriptions for proper cleanup
    context.subscriptions.push(configureApiKeyCommand, configureGeminiApiKeyCommand, configureAnthropicApiKeyCommand, configureOpenAIApiKeyCommand, openChatCommand, openTestingCommand, showAccessLintCommand, newChatSessionCommand, 
    // LLM Agent commands
    startLLMAgentCommand, stopLLMAgentCommand, showLLMAgentStatusCommand, 
    // Token usage commands
    showTokenStatsCommand, configureContextTruncationCommand, chatProvider, testingProvider, geminiChatProvider, anthropicChatProvider, llmAgentOrchestrator, debugChannel);
    // Status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(accessibility) AccessLint";
    statusBarItem.tooltip = "AccessLint - AI Accessibility Assistant";
    statusBarItem.command = 'accesslint.showPanel';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    console.log('✅ AccessLint extension activated successfully!');
}
exports.activate = activate;
function deactivate() {
    console.log('👋 AccessLint extension is deactivating...');
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map