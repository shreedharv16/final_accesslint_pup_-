import * as vscode from 'vscode';

export interface ApiKeyConfiguration {
  gemini?: string;
  anthropic?: string;
  openai?: string;
}

export interface AnthropicConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export class ApiKeyManager {
  private static readonly GEMINI_API_KEY = 'accesslint.geminiApiKey';
  private static readonly ANTHROPIC_API_KEY = 'accesslint.anthropicApiKey';
  private static readonly OPENAI_API_KEY = 'accesslint.openaiApiKey';
  private static readonly ANTHROPIC_MODEL = 'accesslint.anthropicModel';
  private static readonly ANTHROPIC_BASE_URL = 'accesslint.anthropicBaseUrl';

  // Default values
  private static readonly DEFAULT_ANTHROPIC_MODEL = 'claude-3-7-sonnet-20250219';
  private static readonly DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com';

  // Azure OpenAI configuration (HARDCODED for GPT-5)
  private static readonly AZURE_RESOURCE = "ctonpsiotspocopenai"; // Azure resource name
  private static readonly AZURE_DEPLOYMENT = "gpt-5";   // Azure deployment name
  private static readonly AZURE_API_VERSION = "2025-01-01-preview";
  private static readonly AZURE_API_KEY = "BiG4E52GKPwmxv60QxNWxAmlUoKyUyUnDPGavAx5sWSE0MkcmjKDJQQJ99BKACHYHv6XJ3w3AAABACOGDm43"; // Hardcoded API key
  private static readonly AZURE_ENDPOINT = `https://${ApiKeyManager.AZURE_RESOURCE}.openai.azure.com/openai/deployments/${ApiKeyManager.AZURE_DEPLOYMENT}/chat/completions?api-version=${ApiKeyManager.AZURE_API_VERSION}`;

  constructor(private context: vscode.ExtensionContext) {}

  // Gemini API Key Management
  async getGeminiApiKey(): Promise<string | undefined> {
    return this.context.globalState.get<string>(ApiKeyManager.GEMINI_API_KEY);
  }

  async setGeminiApiKey(apiKey: string): Promise<void> {
    await this.context.globalState.update(ApiKeyManager.GEMINI_API_KEY, apiKey);
  }

  async clearGeminiApiKey(): Promise<void> {
    await this.context.globalState.update(ApiKeyManager.GEMINI_API_KEY, undefined);
  }

  // Anthropic API Key Management
  async getAnthropicApiKey(): Promise<string | undefined> {
    return this.context.globalState.get<string>(ApiKeyManager.ANTHROPIC_API_KEY);
  }

  async setAnthropicApiKey(apiKey: string): Promise<void> {
    await this.context.globalState.update(ApiKeyManager.ANTHROPIC_API_KEY, apiKey);
  }

  async clearAnthropicApiKey(): Promise<void> {
    await this.context.globalState.update(ApiKeyManager.ANTHROPIC_API_KEY, undefined);
  }

  // OpenAI API Key Management (HARDCODED for GPT-5)
  async getOpenAIApiKey(): Promise<string | undefined> {
    // Return hardcoded API key for GPT-5
    return ApiKeyManager.AZURE_API_KEY;
  }

  async setOpenAIApiKey(apiKey: string): Promise<void> {
    // No-op: API key is hardcoded
    console.log('⚠️ API key is hardcoded, cannot be changed from extension');
  }

  async clearOpenAIApiKey(): Promise<void> {
    // No-op: API key is hardcoded
    console.log('⚠️ API key is hardcoded, cannot be cleared from extension');
  }

  // Azure OpenAI Configuration
  getAzureEndpoint(): string {
    return ApiKeyManager.AZURE_ENDPOINT;
  }

  getAzureConfig(): { baseURL: string; defaultQuery: any; apiVersion: string; deployment: string } {
    return {
      baseURL: `https://${ApiKeyManager.AZURE_RESOURCE}.openai.azure.com`,
      defaultQuery: { 'api-version': ApiKeyManager.AZURE_API_VERSION },
      apiVersion: ApiKeyManager.AZURE_API_VERSION,
      deployment: ApiKeyManager.AZURE_DEPLOYMENT
    };
  }

  // Anthropic Model Configuration
  async getAnthropicModel(): Promise<string> {
    const config = vscode.workspace.getConfiguration('accesslint');
    return config.get<string>('anthropicModel') || ApiKeyManager.DEFAULT_ANTHROPIC_MODEL;
  }

  async setAnthropicModel(model: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('accesslint');
    await config.update('anthropicModel', model, vscode.ConfigurationTarget.Global);
  }

  // Anthropic Base URL Configuration
  async getAnthropicBaseUrl(): Promise<string> {
    const config = vscode.workspace.getConfiguration('accesslint');
    return config.get<string>('anthropicBaseUrl') || ApiKeyManager.DEFAULT_ANTHROPIC_BASE_URL;
  }

  async setAnthropicBaseUrl(baseUrl: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('accesslint');
    await config.update('anthropicBaseUrl', baseUrl, vscode.ConfigurationTarget.Global);
  }

  // Get full Anthropic configuration
  async getAnthropicConfig(): Promise<AnthropicConfig | null> {
    const apiKey = await this.getAnthropicApiKey();
    if (!apiKey) {
      return null;
    }

    return {
      apiKey,
      model: await this.getAnthropicModel(),
      baseUrl: await this.getAnthropicBaseUrl()
    };
  }

  // Get all API keys
  async getAllApiKeys(): Promise<ApiKeyConfiguration> {
    return {
      gemini: await this.getGeminiApiKey(),
      anthropic: await this.getAnthropicApiKey(),
      openai: await this.getOpenAIApiKey()
    };
  }

  // Check if any API keys are configured
  async hasAnyApiKey(): Promise<boolean> {
    const keys = await this.getAllApiKeys();
    return !!(keys.gemini || keys.anthropic || keys.openai);
  }

  // Check if Gemini is configured
  async isGeminiConfigured(): Promise<boolean> {
    const apiKey = await this.getGeminiApiKey();
    return !!apiKey && apiKey.trim().length > 0;
  }

  // Check if Anthropic is configured
  async isAnthropicConfigured(): Promise<boolean> {
    const apiKey = await this.getAnthropicApiKey();
    return !!apiKey && apiKey.trim().length > 0;
  }

  // Check if OpenAI is configured (always true since hardcoded)
  async isOpenAIConfigured(): Promise<boolean> {
    // Always return true since API key is hardcoded
    return true;
  }

  // Configure Gemini API Key via UI
  async configureGeminiApiKey(): Promise<boolean> {
    const currentKey = await this.getGeminiApiKey();
    const placeholder = currentKey ? '••••••••••••••••••••••••••••••••' : 'Enter your Gemini API key';

    const apiKey = await vscode.window.showInputBox({
      prompt: 'Enter your Gemini API Key',
      placeHolder: placeholder,
      password: true,
      value: currentKey ? undefined : '',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'API key cannot be empty';
        }
        if (!value.startsWith('AIza')) {
          return 'Gemini API keys typically start with "AIza"';
        }
        return null;
      }
    });

    if (apiKey) {
      await this.setGeminiApiKey(apiKey.trim());
      vscode.window.showInformationMessage('Gemini API key configured successfully!');
      return true;
    }

    return false;
  }

  // Configure Anthropic API Key via UI
  async configureAnthropicApiKey(): Promise<boolean> {
    const currentKey = await this.getAnthropicApiKey();
    const placeholder = currentKey ? '••••••••••••••••••••••••••••••••' : 'Enter your Anthropic API key';

    const apiKey = await vscode.window.showInputBox({
      prompt: 'Enter your Anthropic API Key',
      placeHolder: placeholder,
      password: true,
      value: currentKey ? undefined : '',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'API key cannot be empty';
        }
        if (!value.startsWith('sk-ant-')) {
          return 'Anthropic API keys typically start with "sk-ant-"';
        }
        return null;
      }
    });

    if (apiKey) {
      await this.setAnthropicApiKey(apiKey.trim());
      vscode.window.showInformationMessage('Anthropic API key configured successfully!');
      return true;
    }

    return false;
  }

  // Configure OpenAI API Key via UI
  async configureOpenAIApiKey(): Promise<boolean> {
    const currentKey = await this.getOpenAIApiKey();
    const placeholder = currentKey ? '••••••••••••••••••••••••••••••••' : 'Enter your Azure OpenAI API key';

    const apiKey = await vscode.window.showInputBox({
      prompt: 'Enter your Azure OpenAI API Key',
      placeHolder: placeholder,
      password: true,
      value: currentKey ? undefined : '',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'API key cannot be empty';
        }
        // Azure OpenAI keys can have different formats, so we're more lenient
        if (value.length < 10) {
          return 'API key seems too short';
        }
        return null;
      }
    });

    if (apiKey) {
      await this.setOpenAIApiKey(apiKey.trim());
      vscode.window.showInformationMessage('Azure OpenAI API key configured successfully!');
      return true;
    }

    return false;
  }

  // Configure all API keys
  async configureApiKeys(): Promise<void> {
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
        label: '$(key) Configure Azure OpenAI API Key',
        description: 'For Azure OpenAI GPT models',
        value: 'openai'
      },
      {
        label: '$(gear) Configure All API Keys',
        description: 'Set up Gemini, Anthropic, and OpenAI',
        value: 'all'
      },
      {
        label: '$(settings-gear) Advanced Anthropic Settings',
        description: 'Configure model and base URL',
        value: 'anthropic-advanced'
      }
    ], {
      placeHolder: 'Select API key to configure'
    });

    if (!choice) return;

    switch (choice.value) {
      case 'gemini':
        await this.configureGeminiApiKey();
        break;
      case 'anthropic':
        await this.configureAnthropicApiKey();
        break;
      case 'openai':
        await this.configureOpenAIApiKey();
        break;
      case 'all':
        await this.configureGeminiApiKey();
        await this.configureAnthropicApiKey();
        await this.configureOpenAIApiKey();
        break;
      case 'anthropic-advanced':
        await this.configureAnthropicAdvanced();
        break;
    }
  }

  // Configure advanced Anthropic settings
  async configureAnthropicAdvanced(): Promise<void> {
    // First configure API key if not set
    if (!await this.isAnthropicConfigured()) {
      const configured = await this.configureAnthropicApiKey();
      if (!configured) return;
    }

    // Configure model
    const currentModel = await this.getAnthropicModel();
    const model = await vscode.window.showQuickPick([
      {
        label: 'claude-3-7-sonnet-20250219',
        description: 'Latest Claude 3.7 Sonnet (Recommended)',
        picked: currentModel === 'claude-3-7-sonnet-20250219'
      },
      {
        label: 'claude-sonnet-4-20250514',
        description: 'Claude 3.5 Sonnet',
        picked: currentModel === 'claude-sonnet-4-20250514'
      },
      {
        label: 'claude-3-opus-20240229',
        description: 'Claude 3 Opus - Most capable',
        picked: currentModel === 'claude-3-opus-20240229'
      },
      {
        label: 'claude-3-sonnet-20240229',
        description: 'Claude 3 Sonnet - Balanced',
        picked: currentModel === 'claude-3-sonnet-20240229'
      },
      {
        label: 'claude-3-haiku-20240307',
        description: 'Claude 3 Haiku - Fastest',
        picked: currentModel === 'claude-3-haiku-20240307'
      }
    ], {
      placeHolder: 'Select Anthropic model'
    });

    if (model) {
      await this.setAnthropicModel(model.label);
      vscode.window.showInformationMessage(`Anthropic model set to: ${model.label}`);
    }

    // Configure base URL if needed
    const changeBaseUrl = await vscode.window.showQuickPick([
      { label: 'Keep default', description: 'Use https://api.anthropic.com' },
      { label: 'Custom URL', description: 'Set custom base URL' }
    ], {
      placeHolder: 'Base URL configuration'
    });

    if (changeBaseUrl?.label === 'Custom URL') {
      const currentBaseUrl = await this.getAnthropicBaseUrl();
      const baseUrl = await vscode.window.showInputBox({
        prompt: 'Enter custom Anthropic base URL',
        value: currentBaseUrl,
        validateInput: (value) => {
          if (!value || !value.startsWith('http')) {
            return 'Please enter a valid URL starting with http:// or https://';
          }
          return null;
        }
      });

      if (baseUrl) {
        await this.setAnthropicBaseUrl(baseUrl.trim());
        vscode.window.showInformationMessage(`Anthropic base URL set to: ${baseUrl}`);
      }
    }
  }

  // Initialize with provided API key (for setup)
  async initializeWithAnthropicKey(apiKey: string, model?: string): Promise<void> {
    await this.setAnthropicApiKey(apiKey);
    if (model) {
      await this.setAnthropicModel(model);
    }
    vscode.window.showInformationMessage('Anthropic API configuration initialized!');
  }

  // Get status summary
  async getConfigurationStatus(): Promise<{
    gemini: { configured: boolean; hasKey: boolean };
    anthropic: { configured: boolean; hasKey: boolean; model: string };
    openai: { configured: boolean; hasKey: boolean };
  }> {
    return {
      gemini: {
        configured: await this.isGeminiConfigured(),
        hasKey: !!(await this.getGeminiApiKey())
      },
      anthropic: {
        configured: await this.isAnthropicConfigured(),
        hasKey: !!(await this.getAnthropicApiKey()),
        model: await this.getAnthropicModel()
      },
      openai: {
        configured: await this.isOpenAIConfigured(),
        hasKey: !!(await this.getOpenAIApiKey())
      }
    };
  }

  // Clear all API keys
  async clearAllApiKeys(): Promise<void> {
    await this.clearGeminiApiKey();
    await this.clearAnthropicApiKey();
    await this.clearOpenAIApiKey();
    vscode.window.showInformationMessage('All API keys cleared!');
  }
}
