import * as vscode from 'vscode';
import { ChatWebviewProvider } from './chatWebviewProvider';
import { TestingWebviewProvider } from './testingWebviewProvider';
import { AgentLLMOrchestrator } from './agentLLMOrchestrator';
import { TestingAgentOrchestrator } from './testingAgentOrchestrator';
import { ApiKeyManager } from './apiKeyManager';
import { GeminiChatProvider } from './geminiChat';
import { AnthropicChatProvider } from './anthropicChat';
import { OpenAIChatProvider } from './openaiChat';
import { AiProviderManager } from './aiProviderManager';
import { BackendApiClient } from './services/backendApiClient';

export async function activate(context: vscode.ExtensionContext) {
    console.log('🚀 AccessLint extension is now active!');
    
    // Create debug output channel
    const debugChannel = vscode.window.createOutputChannel('AccessLint Debug');
    debugChannel.appendLine('🔍 AccessLint Debug Channel Activated');
    debugChannel.appendLine('💡 To see these logs: View > Output > Select "AccessLint Debug" from dropdown');
    debugChannel.show(); // Show the debug channel immediately

    // Initialize Backend API Client
    const backendApiClient = new BackendApiClient(context);
    debugChannel.appendLine('🌐 Backend API Client initialized');

    // Check if backend mode is enabled
    const vsConfig = vscode.workspace.getConfiguration('accesslint');
    const useBackendMode = vsConfig.get('useBackendMode', true);
    
    // Backend mode is ALWAYS enabled (no offline mode)
    debugChannel.appendLine('🔄 Backend mode enabled (required)');
    
    // Check authentication status
    if (!backendApiClient.isAuthenticated()) {
        debugChannel.appendLine('⚠️ User not authenticated - prompting login');
        
        // Show login prompt immediately
        const result = await vscode.window.showWarningMessage(
            '🔒 AccessLint requires login to function. Please sign in to continue.',
            'Login Now'
        );
        
        if (result === 'Login Now') {
            // Trigger login command
            await vscode.commands.executeCommand('accesslint.login');
        }
        
        debugChannel.appendLine('⚠️ Extension loaded but features disabled until authenticated');
    } else {
        debugChannel.appendLine('✅ User authenticated');
        
        // Show authenticated user info in status bar
        try {
            const user = await backendApiClient.getCurrentUser();
            const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
            statusBar.text = `✅ AccessLint: ${user.email}`;
            statusBar.tooltip = `Logged in as ${user.email}\nClick to logout`;
            statusBar.command = 'accesslint.logout';
            statusBar.show();
            context.subscriptions.push(statusBar);
            debugChannel.appendLine(`👤 Logged in as: ${user.email}`);
        } catch (error) {
            debugChannel.appendLine(`⚠️ Failed to fetch user info: ${error}`);
            
            // Token might be invalid, prompt to login again
            vscode.window.showErrorMessage(
                'AccessLint: Session expired. Please login again.',
                'Login'
            ).then(async (choice) => {
                if (choice === 'Login') {
                    await backendApiClient.clearTokens();
                    await vscode.commands.executeCommand('accesslint.login');
                }
            });
        }
    }

    // Initialize API Key Manager
    const apiKeyManager = new ApiKeyManager(context);

    // Initialize AI Providers
    const geminiChatProvider = new GeminiChatProvider(context);
    const anthropicChatProvider = new AnthropicChatProvider(context);
    const openaiChatProvider = new OpenAIChatProvider(context);
    
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
    const aiProviderManager = new AiProviderManager(context, geminiChatProvider);

    // Initialize Chat WebView Provider
    const chatProvider = new ChatWebviewProvider(
        context.extensionUri,
        context,
        aiProviderManager,
        backendApiClient
    );

    // Set up AI Provider Manager with webview
    aiProviderManager.setWebviewProvider(chatProvider);

    // Initialize DiffViewerManager
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const { DiffViewerManager } = await import('./diffViewer/DiffViewerManager');
    DiffViewerManager.getInstance(context, workspaceRoot);

    // Initialize LLM Agent Orchestrator for CHAT interface (original, untouched)
    const llmAgentOrchestrator = new AgentLLMOrchestrator(
        aiProviderManager,
        aiProviderManager.getToolManager(),
        backendApiClient
    );
    
    // Initialize TESTING Agent Orchestrator (specialized for testing menu with crash fixes)
    const testingAgentOrchestrator = new TestingAgentOrchestrator(
        aiProviderManager,
        aiProviderManager.getToolManager(),
        backendApiClient
    );
    
    // Initialize Testing WebView Provider with specialized testing orchestrator
    const testingProvider = new TestingWebviewProvider(
        context.extensionUri,
        context,
        testingAgentOrchestrator,
        backendApiClient
    );
    
    // Register webview providers
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('accesslint.chatView', chatProvider),
        vscode.window.registerWebviewViewProvider('accesslint.testingView', testingProvider)
    );

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
    const startLLMAgentCommand = vscode.commands.registerCommand('accesslint.startLLMAgent', async (input?: string, provider?: string) => {
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
                    { label: 'Gemini', value: 'gemini' as const },
                    { label: 'Anthropic (Claude)', value: 'anthropic' as const },
                    { label: 'OpenAI (GPT)', value: 'openai' as const }
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
                    await llmAgentOrchestrator.startSession(agentInput, selectedProvider as any);
                    console.log('✅ DEBUG: Agent session started successfully');
                    vscode.window.showInformationMessage('🤖 Agent started! Check the output panel for progress.');
                } catch (error) {
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
        } else {
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

    // Login Command (for backend mode)
    const loginCommand = vscode.commands.registerCommand('accesslint.login', async () => {
        const email = await vscode.window.showInputBox({
            prompt: 'Enter your email',
            placeHolder: 'user@example.com',
            validateInput: (value) => {
                if (!value || !value.includes('@')) {
                    return 'Please enter a valid email address';
                }
                return null;
            }
        });

        if (!email) {
            return;
        }

        const password = await vscode.window.showInputBox({
            prompt: 'Enter your password',
            password: true
        });

        if (!password) {
            return;
        }

        try {
            await backendApiClient.login(email, password);
            vscode.window.showInformationMessage('✅ Logged in successfully!');
            await vscode.commands.executeCommand('workbench.action.reloadWindow');
        } catch (error: any) {
            const errorMsg = error.response?.data?.error || error.message || 'Login failed';
            vscode.window.showErrorMessage(`❌ Login failed: ${errorMsg}`);
        }
    });

    // Logout Command (for backend mode)
    const logoutCommand = vscode.commands.registerCommand('accesslint.logout', async () => {
        const confirm = await vscode.window.showWarningMessage(
            'Are you sure you want to logout?',
            'Yes',
            'No'
        );
        
        if (confirm === 'Yes') {
            try {
                await backendApiClient.logout();
                vscode.window.showInformationMessage('✅ Logged out successfully. Please reload the window.');
                await vscode.commands.executeCommand('workbench.action.reloadWindow');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to logout: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    });

    // Add to subscriptions for proper cleanup
    context.subscriptions.push(
        configureApiKeyCommand,
        configureGeminiApiKeyCommand,
        configureAnthropicApiKeyCommand,
        configureOpenAIApiKeyCommand,
        openChatCommand,
        openTestingCommand,
        showAccessLintCommand,
        newChatSessionCommand,
        loginCommand,
        logoutCommand,
        // LLM Agent commands
        startLLMAgentCommand,
        stopLLMAgentCommand,
        showLLMAgentStatusCommand,
        // Token usage commands
        showTokenStatsCommand,
        configureContextTruncationCommand,
        // Backend commands
        logoutCommand,
        chatProvider,
        testingProvider,
        geminiChatProvider,
        anthropicChatProvider,
        llmAgentOrchestrator,
        debugChannel
    );

    // Status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(accessibility) AccessLint";
    statusBarItem.tooltip = "AccessLint - AI Accessibility Assistant";
    statusBarItem.command = 'accesslint.showPanel';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    console.log('✅ AccessLint extension activated successfully!');
}

export function deactivate() {
    console.log('👋 AccessLint extension is deactivating...');
} 