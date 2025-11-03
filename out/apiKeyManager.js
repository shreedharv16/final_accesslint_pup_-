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
exports.ApiKeyManager = void 0;
const vscode = __importStar(require("vscode"));
class ApiKeyManager {
    constructor(context) {
        this.context = context;
    }
    // Gemini API Key Management
    async getGeminiApiKey() {
        return this.context.globalState.get(ApiKeyManager.GEMINI_API_KEY);
    }
    async setGeminiApiKey(apiKey) {
        await this.context.globalState.update(ApiKeyManager.GEMINI_API_KEY, apiKey);
    }
    async clearGeminiApiKey() {
        await this.context.globalState.update(ApiKeyManager.GEMINI_API_KEY, undefined);
    }
    // Anthropic API Key Management
    async getAnthropicApiKey() {
        return this.context.globalState.get(ApiKeyManager.ANTHROPIC_API_KEY);
    }
    async setAnthropicApiKey(apiKey) {
        await this.context.globalState.update(ApiKeyManager.ANTHROPIC_API_KEY, apiKey);
    }
    async clearAnthropicApiKey() {
        await this.context.globalState.update(ApiKeyManager.ANTHROPIC_API_KEY, undefined);
    }
    // OpenAI API Key Management
    async getOpenAIApiKey() {
        return this.context.globalState.get(ApiKeyManager.OPENAI_API_KEY);
    }
    async setOpenAIApiKey(apiKey) {
        await this.context.globalState.update(ApiKeyManager.OPENAI_API_KEY, apiKey);
    }
    async clearOpenAIApiKey() {
        await this.context.globalState.update(ApiKeyManager.OPENAI_API_KEY, undefined);
    }
    // Azure OpenAI Configuration
    getAzureEndpoint() {
        return ApiKeyManager.AZURE_ENDPOINT;
    }
    getAzureConfig() {
        return {
            baseURL: `https://${ApiKeyManager.AZURE_RESOURCE}.openai.azure.com`,
            defaultQuery: { 'api-version': ApiKeyManager.AZURE_API_VERSION },
            apiVersion: ApiKeyManager.AZURE_API_VERSION,
            deployment: ApiKeyManager.AZURE_DEPLOYMENT
        };
    }
    // Anthropic Model Configuration
    async getAnthropicModel() {
        const config = vscode.workspace.getConfiguration('accesslint');
        return config.get('anthropicModel') || ApiKeyManager.DEFAULT_ANTHROPIC_MODEL;
    }
    async setAnthropicModel(model) {
        const config = vscode.workspace.getConfiguration('accesslint');
        await config.update('anthropicModel', model, vscode.ConfigurationTarget.Global);
    }
    // Anthropic Base URL Configuration
    async getAnthropicBaseUrl() {
        const config = vscode.workspace.getConfiguration('accesslint');
        return config.get('anthropicBaseUrl') || ApiKeyManager.DEFAULT_ANTHROPIC_BASE_URL;
    }
    async setAnthropicBaseUrl(baseUrl) {
        const config = vscode.workspace.getConfiguration('accesslint');
        await config.update('anthropicBaseUrl', baseUrl, vscode.ConfigurationTarget.Global);
    }
    // Get full Anthropic configuration
    async getAnthropicConfig() {
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
    async getAllApiKeys() {
        return {
            gemini: await this.getGeminiApiKey(),
            anthropic: await this.getAnthropicApiKey(),
            openai: await this.getOpenAIApiKey()
        };
    }
    // Check if any API keys are configured
    async hasAnyApiKey() {
        const keys = await this.getAllApiKeys();
        return !!(keys.gemini || keys.anthropic || keys.openai);
    }
    // Check if Gemini is configured
    async isGeminiConfigured() {
        const apiKey = await this.getGeminiApiKey();
        return !!apiKey && apiKey.trim().length > 0;
    }
    // Check if Anthropic is configured
    async isAnthropicConfigured() {
        const apiKey = await this.getAnthropicApiKey();
        return !!apiKey && apiKey.trim().length > 0;
    }
    // Check if OpenAI is configured
    async isOpenAIConfigured() {
        const apiKey = await this.getOpenAIApiKey();
        return !!apiKey && apiKey.trim().length > 0;
    }
    // Configure Gemini API Key via UI
    async configureGeminiApiKey() {
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
    async configureAnthropicApiKey() {
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
    async configureOpenAIApiKey() {
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
    async configureApiKeys() {
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
        if (!choice)
            return;
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
    async configureAnthropicAdvanced() {
        // First configure API key if not set
        if (!await this.isAnthropicConfigured()) {
            const configured = await this.configureAnthropicApiKey();
            if (!configured)
                return;
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
    async initializeWithAnthropicKey(apiKey, model) {
        await this.setAnthropicApiKey(apiKey);
        if (model) {
            await this.setAnthropicModel(model);
        }
        vscode.window.showInformationMessage('Anthropic API configuration initialized!');
    }
    // Get status summary
    async getConfigurationStatus() {
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
    async clearAllApiKeys() {
        await this.clearGeminiApiKey();
        await this.clearAnthropicApiKey();
        await this.clearOpenAIApiKey();
        vscode.window.showInformationMessage('All API keys cleared!');
    }
}
exports.ApiKeyManager = ApiKeyManager;
ApiKeyManager.GEMINI_API_KEY = 'accesslint.geminiApiKey';
ApiKeyManager.ANTHROPIC_API_KEY = 'accesslint.anthropicApiKey';
ApiKeyManager.OPENAI_API_KEY = 'accesslint.openaiApiKey';
ApiKeyManager.ANTHROPIC_MODEL = 'accesslint.anthropicModel';
ApiKeyManager.ANTHROPIC_BASE_URL = 'accesslint.anthropicBaseUrl';
// Default values
ApiKeyManager.DEFAULT_ANTHROPIC_MODEL = 'claude-3-7-sonnet-20250219';
ApiKeyManager.DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
// Azure OpenAI configuration
ApiKeyManager.AZURE_RESOURCE = "ots-openai"; // Azure resource name
ApiKeyManager.AZURE_DEPLOYMENT = "gpt-5"; // Azure deployment name
ApiKeyManager.AZURE_API_VERSION = "2025-01-01-preview";
ApiKeyManager.AZURE_ENDPOINT = `https://${ApiKeyManager.AZURE_RESOURCE}.openai.azure.com/openai/deployments/${ApiKeyManager.AZURE_DEPLOYMENT}/chat/completions?api-version=${ApiKeyManager.AZURE_API_VERSION}`;
//# sourceMappingURL=apiKeyManager.js.map