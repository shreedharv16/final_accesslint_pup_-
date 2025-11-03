import * as vscode from 'vscode';
import { GeminiChatProvider } from './geminiChat';
import { AnthropicChatProvider } from './anthropicChat';
import { OpenAIChatProvider } from './openaiChat';
import { ApiKeyManager } from './apiKeyManager';
import { ToolManager } from './tools-accesslint/toolManager';
import { ToolDefinition, ToolMode } from './tools-accesslint/types';
import { LLMToolCallParser, ParsedToolCall } from './llmToolCallParser';

export type AiProvider = 'gemini' | 'anthropic' | 'openai';

export interface AiResponse {
  text: string;
  toolCalls?: ParsedToolCall[];
  provider: AiProvider;
}

export class AiProviderManager {
  private geminiProvider: GeminiChatProvider;
  private anthropicProvider: AnthropicChatProvider;
  private openaiProvider: OpenAIChatProvider;
  private primaryProvider: GeminiChatProvider | AnthropicChatProvider | OpenAIChatProvider;
  private apiKeyManager: ApiKeyManager;
  private toolManager: ToolManager;
  private toolCallParser: LLMToolCallParser;
  private currentMode: ToolMode = 'quick';

  constructor(
    private context: vscode.ExtensionContext,
    primaryProvider: GeminiChatProvider | AnthropicChatProvider | OpenAIChatProvider
  ) {
    // Set the primary provider
    this.primaryProvider = primaryProvider;

    // Initialize all providers based on the primary provider type
    if (primaryProvider instanceof GeminiChatProvider) {
      this.geminiProvider = primaryProvider;
      this.anthropicProvider = new AnthropicChatProvider(context);
      this.openaiProvider = new OpenAIChatProvider(context);
    } else if (primaryProvider instanceof AnthropicChatProvider) {
      this.anthropicProvider = primaryProvider;
      this.geminiProvider = new GeminiChatProvider(context);
      this.openaiProvider = new OpenAIChatProvider(context);
    } else {
      this.openaiProvider = primaryProvider;
      this.geminiProvider = new GeminiChatProvider(context);
      this.anthropicProvider = new AnthropicChatProvider(context);
    }
    this.apiKeyManager = new ApiKeyManager(context);
    
    // Initialize tool manager
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const outputChannel = vscode.window.createOutputChannel('AccessLint Tools');
    
    this.toolManager = new ToolManager({
      workspaceRoot,
      outputChannel,
      webviewProvider: null, // Will be set later when webview is available
      extensionContext: context
    });

    // Initialize tool call parser (strict tool manager will be set up via configuration)
    this.toolCallParser = new LLMToolCallParser(this.toolManager.getToolDefinitions());

    // Load initial mode from settings
    this.loadModeFromSettings();
  }

  /**
   * Initialize strict parsing mode if enabled in configuration
   */
  async initializeStrictParsing(): Promise<void> {
    const useStrictParsing = vscode.workspace.getConfiguration('accesslint').get('useStrictXMLParsing', false);
    
    if (useStrictParsing) {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
      const outputChannel = vscode.window.createOutputChannel('AccessLint Tools');
      
      const { StrictToolManager } = await import('./tools-accesslint/strictToolManager');
      const strictToolManager = new StrictToolManager({
        workspaceRoot,
        outputChannel,
        webviewProvider: null
      });

      // Re-initialize parser with strict tool manager
      this.toolCallParser = new LLMToolCallParser(this.toolManager.getToolDefinitions(), strictToolManager);
    }
  }

  /**
   * Reset the mistake counter (useful after max mistakes reached)
   */
  resetParsingMistakes(): void {
    this.toolCallParser.resetMistakeCounter();
    console.log('🔄 Parsing mistake counter reset - LLM can try again with proper XML format');
  }

  /**
   * Get current mistake count for monitoring
   */
  getParsingMistakeCount(): number {
    return this.toolCallParser.getMistakeCount();
  }

  private loadModeFromSettings(): void {
    const config = vscode.workspace.getConfiguration('accesslint');
    this.currentMode = config.get<ToolMode>('toolMode') || 'quick';
    this.toolManager.setMode(this.currentMode);
  }

  // Set webview provider for tool logging
  setWebviewProvider(webviewProvider: any): void {
    this.toolManager.context.webviewProvider = webviewProvider;
  }

  // Get webview provider
  getWebviewProvider(): any {
    return this.toolManager.context.webviewProvider;
  }

  // Get default AI provider
  private async getDefaultProvider(): Promise<AiProvider> {
    const config = vscode.workspace.getConfiguration('accesslint');
    const defaultProvider = config.get<AiProvider>('defaultAiProvider') || 'gemini';
    
    // Check if the default provider is configured
    if (defaultProvider === 'gemini' && await this.geminiProvider.isConfigured()) {
      return 'gemini';
    } else if (defaultProvider === 'anthropic' && await this.anthropicProvider.isConfigured()) {
      return 'anthropic';
    } else if (defaultProvider === 'openai') {
      await this.openaiProvider.refreshApiKey();
      if (await this.openaiProvider.isAvailable()) {
        return 'openai';
      }
    }
    
    // Fallback: use whichever is configured
    if (await this.geminiProvider.isConfigured()) {
      return 'gemini';
    } else if (await this.anthropicProvider.isConfigured()) {
      return 'anthropic';
    } else {
      await this.openaiProvider.refreshApiKey();
      if (await this.openaiProvider.isAvailable()) {
        return 'openai';
      }
    }
    
    throw new Error('No AI provider is configured. Please configure at least one API key.');
  }

  // Check if a specific provider is configured
  private async isProviderConfigured(provider: AiProvider): Promise<boolean> {
    switch (provider) {
      case 'gemini':
        // Refresh API key in case it was configured through ApiKeyManager
        await this.geminiProvider.refreshApiKey();
        return await this.geminiProvider.isConfigured();
      case 'anthropic':
        return await this.anthropicProvider.isConfigured();
      case 'openai':
        // Refresh API key in case it was configured through ApiKeyManager
        await this.openaiProvider.refreshApiKey();
        return await this.openaiProvider.isAvailable();
      default:
        return false;
    }
  }

  // Send message using the appropriate provider with tool call parsing
  async sendMessage(message: string, provider?: AiProvider): Promise<AiResponse> {
    console.log(`🔄 AiProviderManager: Attempting to send message with provider: ${provider}`);
    
    const targetProvider = provider || await this.getDefaultProvider();
    console.log(`📡 Using target provider: ${targetProvider}`);
    
    // Check if provider is configured
    try {
      const isConfigured = await this.isProviderConfigured(targetProvider);
      console.log(`🔑 Provider ${targetProvider} configured: ${isConfigured}`);
      
      if (!isConfigured) {
        throw new Error(`${targetProvider} is not configured. Please set up your API key.`);
      }
    } catch (configError) {
      console.error(`❌ Configuration check failed:`, configError);
      throw configError;
    }
    
    try {
      let response: string;
      console.log(`🚀 Sending message to ${targetProvider}...`);
      
      switch (targetProvider) {
        case 'gemini':
          response = await this.geminiProvider.sendMessage(message);
          break;
        case 'anthropic':
          response = await this.anthropicProvider.sendMessage(message);
          break;
        case 'openai':
          response = await this.openaiProvider.sendMessage(message);
          break;
        default:
          throw new Error(`Unknown provider: ${targetProvider}`);
      }
      
      console.log(`✅ Received response from ${targetProvider}: ${response?.substring(0, 100)}...`);
      
      // Parse response for tool calls
      const parsed = this.toolCallParser.parseResponse(response);
      
      // Reset mistake counter on successful parsing (Cline-style)
      this.toolCallParser.resetMistakeCounter();
      
      return {
        text: parsed.text,
        toolCalls: parsed.toolCalls,
        provider: targetProvider
      };
    } catch (apiError) {
      console.error(`❌ API call failed for ${targetProvider}:`, apiError);
      throw new Error(`${targetProvider} error: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
    }
  }

  // Send message with tools support
  async sendMessageWithTools(
    message: string, 
    provider?: AiProvider
  ): Promise<AiResponse> {
    const targetProvider = provider || await this.getDefaultProvider();
    const tools = this.getToolDefinitionsForProvider(targetProvider);
    
    try {
      switch (targetProvider) {
        case 'anthropic':
          const anthropicResponse = await this.anthropicProvider.sendMessageWithTools(message, tools);
          return {
            text: anthropicResponse.response,
            toolCalls: anthropicResponse.toolCalls,
            provider: targetProvider
          };
        case 'gemini':
          // Gemini doesn't support structured tool calls, use text parsing
          const geminiResponse = await this.geminiProvider.sendMessage(this.buildToolAwarePrompt(message));
          const parsed = this.toolCallParser.parseResponse(geminiResponse);
          this.toolCallParser.resetMistakeCounter(); // Reset on successful parsing
          return {
            text: parsed.text,
            toolCalls: parsed.toolCalls,
            provider: targetProvider
          };
        case 'openai':
          // OpenAI doesn't support structured tool calls yet in our implementation, use text parsing
          const openaiResponse = await this.openaiProvider.sendMessage(this.buildToolAwarePrompt(message));
          const openaiParsed = this.toolCallParser.parseResponse(openaiResponse);
          this.toolCallParser.resetMistakeCounter(); // Reset on successful parsing
          return {
            text: openaiParsed.text,
            toolCalls: openaiParsed.toolCalls,
            provider: targetProvider
          };
        default:
          throw new Error(`Unknown provider: ${targetProvider}`);
      }
    } catch (error) {
      throw new Error(`${targetProvider} error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }



  // Build tool-aware prompt for providers that don't support structured tools
  private buildToolAwarePrompt(message: string): string {
    const tools = this.toolManager.getToolDefinitions();
    
    return `You have access to the following tools. When you want to use a tool, format it as:

TOOL_CALL: tool_name
INPUT: {json_input}

Available tools:
${tools.map(tool => `${tool.name}: ${tool.descriptionForAgent}`).join('\n')}

User message: ${message}`;
  }

  // Execute tool call
  async executeTool(toolName: string, input: any): Promise<any> {
    return this.toolManager.executeTool(toolName, input, this.currentMode);
  }

  // Get tool manager instance
  getToolManager(): ToolManager {
    return this.toolManager;
  }

  // Get tool definitions formatted for specific provider
  private getToolDefinitionsForProvider(provider: AiProvider): any[] {
    const definitions = this.toolManager.getToolDefinitions();
    
    switch (provider) {
      case 'anthropic':
        // Format for Anthropic Claude API
        return definitions.map(def => ({
          name: def.name,
          description: def.descriptionForAgent,
          input_schema: {
            type: "object",
            properties: def.inputSchema.properties,
            required: def.inputSchema.required || []
          }
        }));
      case 'gemini':
        // Gemini format (if needed in future)
        return definitions;
      default:
        return definitions;
    }
  }

  // Mode management
  getMode(): ToolMode {
    return this.currentMode;
  }

  async setMode(mode: ToolMode): Promise<void> {
    this.currentMode = mode;
    this.toolManager.setMode(mode);
    
    // Save to settings
    const config = vscode.workspace.getConfiguration('accesslint');
    await config.update('toolMode', mode, vscode.ConfigurationTarget.Global);
    
    // Notify webview
    if (this.toolManager.context.webviewProvider) {
      this.toolManager.context.webviewProvider.postMessage({
        type: 'modeChanged',
        mode: mode
      });
    }
  }

  // Toggle between modes
  async toggleMode(): Promise<ToolMode> {
    const newMode: ToolMode = this.currentMode === 'quick' ? 'agent' : 'quick';
    await this.setMode(newMode);
    return newMode;
  }

  // Configuration management
  async isAnyProviderConfigured(): Promise<boolean> {
    return (await this.geminiProvider.isConfigured()) || (await this.anthropicProvider.isConfigured());
  }

  async getConfigurationStatus(): Promise<{
    gemini: boolean;
    anthropic: boolean;
    defaultProvider: AiProvider;
    currentMode: ToolMode;
  }> {
    const config = vscode.workspace.getConfiguration('accesslint');
    
    return {
      gemini: await this.geminiProvider.isConfigured(),
      anthropic: await this.anthropicProvider.isConfigured(),
      defaultProvider: config.get<AiProvider>('defaultAiProvider') || 'gemini',
      currentMode: this.currentMode
    };
  }

  async configureProvider(provider: AiProvider): Promise<boolean> {
    switch (provider) {
      case 'gemini':
        return this.geminiProvider.configureApiKey();
      case 'anthropic':
        return this.anthropicProvider.configureApiKey();
      default:
        return false;
    }
  }

  // Clear conversations
  async clearConversations(): Promise<void> {
    this.geminiProvider.clearConversation();
    this.anthropicProvider.clearConversation();
    this.openaiProvider.clearHistory(); // Fix: Clear OpenAI history too
  }

  // Start new chat sessions (clears history and resets token tracking)
  async startNewSessions(): Promise<void> {
    this.geminiProvider.clearConversation();
    if (typeof (this.anthropicProvider as any).startNewSession === 'function') {
      (this.anthropicProvider as any).startNewSession();
    } else {
      this.anthropicProvider.clearConversation();
    }
    // Fix: Also clear OpenAI history for new sessions
    this.openaiProvider.newSession();
  }

  // Get token usage statistics (Anthropic only for now)
  getTokenUsageStats() {
    if (typeof (this.anthropicProvider as any).getTokenUsageStats === 'function') {
      return (this.anthropicProvider as any).getTokenUsageStats();
    }
    return null;
  }

  // Get formatted token summary (Anthropic only for now)
  getFormattedTokenSummary(): string {
    if (typeof (this.anthropicProvider as any).getFormattedTokenSummary === 'function') {
      return (this.anthropicProvider as any).getFormattedTokenSummary();
    }
    return 'Token tracking not available for current provider.';
  }

  // Test connections
  async testProviders(): Promise<{
    gemini: { configured: boolean; working?: boolean; error?: string };
    anthropic: { configured: boolean; working?: boolean; error?: string };
  }> {
    const results = {
      gemini: { configured: false, working: false, error: undefined as string | undefined },
      anthropic: { configured: false, working: false, error: undefined as string | undefined }
    };

    // Test Gemini
    results.gemini.configured = await this.geminiProvider.isConfigured();
    if (results.gemini.configured) {
      try {
        await this.geminiProvider.sendMessage('Test');
        results.gemini.working = true;
      } catch (error) {
        results.gemini.error = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    // Test Anthropic
    results.anthropic.configured = await this.anthropicProvider.isConfigured();
    if (results.anthropic.configured) {
      const testResult = await this.anthropicProvider.testConnection();
      results.anthropic.working = testResult.success;
      results.anthropic.error = testResult.error;
    }

    return results;
  }

  // Get available tools
  getAvailableTools(): string[] {
    return this.toolManager.getAvailableTools();
  }

  // Get tool execution history
  getToolExecutionHistory() {
    return this.toolManager.getExecutionHistory();
  }

  // Initialize with provided Anthropic key
  async initializeWithAnthropicKey(apiKey: string, model: string): Promise<void> {
    await this.apiKeyManager.initializeWithAnthropicKey(apiKey, model);
    await this.anthropicProvider.updateConfiguration();
  }

  /**
   * Get rate limiting status for the current provider
   */
  getRateLimitStatus(): any {
    const currentProvider = this.anthropicProvider; // Assuming we're using Anthropic for rate limiting
    if (currentProvider && typeof currentProvider.getRateLimitStatus === 'function') {
      return currentProvider.getRateLimitStatus();
    }
    return null;
  }

  // Get tool call parser for debugging
  getToolCallParser() {
    return this.toolCallParser;
  }

  dispose(): void {
    this.geminiProvider.dispose();
    this.anthropicProvider.dispose();
    this.toolManager.dispose();
  }
}

