import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { ApiKeyManager } from './apiKeyManager';
import { RetryUtils, RetriableError, withRetry } from './retryUtils';

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AzureOpenAIResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
  }>;
}

export class OpenAIChatProvider {
  private apiKeyManager: ApiKeyManager;
  private isInitialized: boolean = false;
  private apiKey: string | null = null;
  private conversationHistory: OpenAIMessage[] = [];

  constructor(private context: vscode.ExtensionContext) {
    this.apiKeyManager = new ApiKeyManager(context);
    this.initializeOpenAI();
  }

  /**
   * Initialize Azure OpenAI
   */
  private async initializeOpenAI(): Promise<void> {
    try {
      const apiKey = await this.apiKeyManager.getOpenAIApiKey();
      if (apiKey) {
        this.apiKey = apiKey;
        this.isInitialized = true;
        console.log('✅ Azure OpenAI initialized successfully');
      } else {
        console.log('⚠️ Azure OpenAI API key not found');
        this.isInitialized = false;
      }
    } catch (error) {
      console.error('❌ Failed to initialize Azure OpenAI:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Wait for initialization to complete
   */
  async waitForInitialization(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    // Wait up to 5 seconds for initialization
    const maxAttempts = 50;
    let attempts = 0;
    
    while (!this.isInitialized && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    return this.isInitialized;
  }

  /**
   * Check if Azure OpenAI is available
   */
  isAvailable(): boolean {
    return this.isInitialized && this.apiKey !== null;
  }

  /**
   * Send a message to Azure OpenAI with automatic retry on rate limits
   */
  async sendMessage(message: string, model: string = 'gpt-5'): Promise<string> {
    return RetryUtils.retryAzureOpenAI(
      () => this._sendMessageInternal(message, model),
      'Azure OpenAI sendMessage'
    );
  }

  /**
   * Internal implementation of sendMessage (without retry logic)
   */
  private async _sendMessageInternal(message: string, model: string = 'gpt-5'): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Azure OpenAI not initialized. Please configure your Azure OpenAI API key.');
    }

    try {
      // Add user message to conversation history
      const userMessage: OpenAIMessage = {
        role: 'user',
        content: message
      };
      
      // Build full conversation including history with GPT-5 context management
      let fullConversation = [...this.conversationHistory, userMessage];
      
      // Apply GPT-5 specific context management
      if (model === 'gpt-5') {
        fullConversation = this.manageGPT5Context(fullConversation);
      }
      
      // Get the full Azure endpoint (matches your working script)
      const endpoint = this.apiKeyManager.getAzureEndpoint();
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: fullConversation.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          max_completion_tokens: 128000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Azure OpenAI API error:', response.status, errorText);
        
        if (response.status === 401) {
          throw new Error('Invalid Azure OpenAI API key. Please check your configuration.');
        } else if (response.status === 429) {
          // Create RetriableError for rate limit with proper retry-after parsing
          throw RetriableError.fromAzureOpenAIError(response.status, errorText, response);
        } else if (response.status === 500) {
          throw new Error('Azure OpenAI service error. Please try again later.');
        }
        
        throw new Error(`Azure OpenAI error: ${response.status} ${errorText}`);
      }

      const data = await response.json() as AzureOpenAIResponse;
      const assistantResponse = data.choices[0]?.message?.content || 'No response received';
      
      // Add both user message and assistant response to history
      this.conversationHistory.push(userMessage);
      this.conversationHistory.push({
        role: 'assistant',
        content: assistantResponse
      });
      
      console.log(`📈 Conversation history now has ${this.conversationHistory.length} messages`);
      
      return assistantResponse;
    } catch (error: any) {
      console.error('Azure OpenAI API error:', error);
      throw new Error(`Azure OpenAI error: ${error.message}`);
    }
  }

  /**
   * Send a conversation to Azure OpenAI with tool support and automatic retry on rate limits
   */
  async sendConversation(messages: OpenAIMessage[], model: string = 'gpt-5'): Promise<{
    text: string;
    toolCalls?: Array<{
      id: string;
      name: string;
      input: any;
    }>;
  }> {
    return RetryUtils.retryAzureOpenAI(
      () => this._sendConversationInternal(messages, model),
      'Azure OpenAI sendConversation'
    );
  }

  /**
   * Internal implementation of sendConversation (without retry logic)
   */
  private async _sendConversationInternal(messages: OpenAIMessage[], model: string = 'gpt-5'): Promise<{
    text: string;
    toolCalls?: Array<{
      id: string;
      name: string;
      input: any;
    }>;
  }> {
    if (!this.isAvailable()) {
      throw new Error('Azure OpenAI not initialized. Please configure your Azure OpenAI API key.');
    }

    try {
      // Get the full Azure endpoint (matches your working script)
      const endpoint = this.apiKeyManager.getAzureEndpoint();
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          max_completion_tokens: 128000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Azure OpenAI conversation error:', response.status, errorText);
        
        if (response.status === 401) {
          throw new Error('Invalid Azure OpenAI API key. Please check your configuration.');
        } else if (response.status === 429) {
          // Create RetriableError for rate limit with proper retry-after parsing
          throw RetriableError.fromAzureOpenAIError(response.status, errorText, response);
        }
        
        throw new Error(`Azure OpenAI error: ${response.status} ${errorText}`);
      }

      const data = await response.json() as AzureOpenAIResponse;
      const responseText = data.choices[0]?.message?.content || 'No response received';
      
      // For now, return simple response without tool calling
      // Tool calling can be enhanced later with function calling
      return {
        text: responseText
      };
    } catch (error: any) {
      console.error('Azure OpenAI conversation error:', error);
      throw new Error(`Azure OpenAI error: ${error.message}`);
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
    console.log('🗑️ Conversation history cleared');
  }

  /**
   * Get conversation history
   */
  getHistory(): OpenAIMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Get conversation history length
   */
  getHistoryLength(): number {
    return this.conversationHistory.length;
  }

  /**
   * Get available models
   */
  getAvailableModels(): string[] {
    return [
      'gpt-5',        // Azure deployment name
      'gpt-4',
      'gpt-4-turbo-preview',
      'gpt-4-1106-preview',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k'
    ];
  }

  /**
   * Refresh API key and reinitialize
   */
  async refreshApiKey(): Promise<void> {
    await this.initializeOpenAI();
  }

  /**
   * Get current model configuration
   */
  getCurrentModel(): string {
    const config = vscode.workspace.getConfiguration('accesslint');
    return config.get<string>('openaiModel') || 'gpt-5';
  }

  /**
   * Set current model
   */
  async setCurrentModel(model: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('accesslint');
    await config.update('openaiModel', model, vscode.ConfigurationTarget.Workspace);
  }

  /**
   * Start a new conversation session
   */
  newSession(): void {
    this.clearHistory();
    console.log('🆕 New conversation session started');
  }

  /**
   * Dispose method for cleanup
   */
  /**
   * GPT-5 specific context management with buffer space reservation
   */
  private manageGPT5Context(messages: OpenAIMessage[]): OpenAIMessage[] {
    const GPT5_CONTEXT_WINDOW = 128000;
    const GPT5_BUFFER_SIZE = 30000; // Reserve 30k tokens for response
    const maxAllowedTokens = GPT5_CONTEXT_WINDOW - GPT5_BUFFER_SIZE;
    
    // Estimate token count (rough approximation: 4 chars per token)
    const estimatedTokens = messages.reduce((total, msg) => total + Math.ceil(msg.content.length / 4), 0);
    
    if (estimatedTokens <= maxAllowedTokens) {
      return messages; // No need to truncate
    }
    
    console.log(`🗜️ GPT-5 context management: ${estimatedTokens} tokens > ${maxAllowedTokens}, optimizing...`);
    
    // Preserve essential messages
    const systemMessage = messages.find(msg => msg.role === 'system');
    const recentMessages = messages.slice(-8); // Keep last 8 messages
    const importantMessages = messages.filter(msg => 
      msg.content.includes('INTERVENTION') ||
      msg.content.includes('write_file') ||
      msg.content.includes('edit_file') ||
      msg.content.includes('CACHED')
    ).slice(-3); // Keep last 3 important messages
    
    // Smart combination avoiding duplicates
    const optimizedMessages: OpenAIMessage[] = [];
    if (systemMessage) optimizedMessages.push(systemMessage);
    
    // Add important messages not in recent
    for (const importantMsg of importantMessages) {
      if (!recentMessages.some(recent => recent === importantMsg)) {
        optimizedMessages.push(importantMsg);
      }
    }
    
    // Add recent messages
    for (const recentMsg of recentMessages) {
      if (!optimizedMessages.some(existing => existing === recentMsg)) {
        optimizedMessages.push(recentMsg);
      }
    }
    
    const newEstimatedTokens = optimizedMessages.reduce((total, msg) => total + Math.ceil(msg.content.length / 4), 0);
    console.log(`🗜️ GPT-5 context optimized: ${messages.length} → ${optimizedMessages.length} messages (~${estimatedTokens} → ~${newEstimatedTokens} tokens)`);
    
    return optimizedMessages;
  }

  dispose(): void {
    // Cleanup any resources if needed
    this.apiKey = null;
    this.isInitialized = false;
    this.conversationHistory = [];
  }
}
