"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeOpenAI = initializeOpenAI;
exports.getOpenAIClient = getOpenAIClient;
exports.chatCompletion = chatCompletion;
exports.buildContextFromHistory = buildContextFromHistory;
exports.estimateTokens = estimateTokens;
exports.truncateToTokenLimit = truncateToTokenLimit;
const openai_1 = require("openai");
const logger_1 = __importDefault(require("../utils/logger"));
// HARDCODED AZURE OPENAI CREDENTIALS (East US 2)
const AZURE_OPENAI_ENDPOINT = 'https://ctonpsiotspocopenai.openai.azure.com/';
const AZURE_OPENAI_API_KEY = 'BiG4E52GKPwmxv60QxNWxAmlUoKyUyUnDPGavAx5sWSE0MkcmjKDJQQJ99BKACHYHv6XJ3w3AAABACOGDm43';
const AZURE_OPENAI_DEPLOYMENT = 'gpt-5';
const AZURE_OPENAI_API_VERSION = '2024-02-15-preview';
let openaiClient = null;
/**
 * Initialize Azure OpenAI client with hardcoded credentials
 */
async function initializeOpenAI() {
    try {
        openaiClient = new openai_1.AzureOpenAI({
            endpoint: AZURE_OPENAI_ENDPOINT,
            apiKey: AZURE_OPENAI_API_KEY,
            apiVersion: AZURE_OPENAI_API_VERSION,
            deployment: AZURE_OPENAI_DEPLOYMENT
        });
        logger_1.default.info('✅ Azure OpenAI client initialized');
        logger_1.default.info(`🤖 Model: ${AZURE_OPENAI_DEPLOYMENT}`);
        logger_1.default.info(`🌐 Endpoint: ${AZURE_OPENAI_ENDPOINT}`);
    }
    catch (error) {
        logger_1.default.error('❌ Failed to initialize Azure OpenAI:', error);
        throw error;
    }
}
/**
 * Get OpenAI client
 */
function getOpenAIClient() {
    if (!openaiClient) {
        throw new Error('OpenAI client not initialized. Call initializeOpenAI() first.');
    }
    return openaiClient;
}
/**
 * Call Azure OpenAI with chat completion
 * Includes context management: keeps last 3 conversations
 */
async function chatCompletion(messages, options) {
    try {
        const client = getOpenAIClient();
        const response = await client.chat.completions.create({
            model: AZURE_OPENAI_DEPLOYMENT,
            messages,
            max_tokens: options?.maxTokens || 4000,
            temperature: options?.temperature || 0.7,
            stream: false // Always use non-streaming mode
        });
        const content = response.choices[0]?.message?.content || '';
        logger_1.default.info(`✅ GPT-5 completion (tokens: ${response.usage?.total_tokens || 0})`);
        return content;
    }
    catch (error) {
        logger_1.default.error('❌ Error in GPT-5 chat completion:', error);
        throw error;
    }
}
/**
 * Build context from recent conversations
 * Keeps system message + last 3 user/assistant pairs
 */
function buildContextFromHistory(systemMessage, conversationHistory, currentMessage) {
    const messages = [
        { role: 'system', content: systemMessage }
    ];
    // Keep last 3 conversation pairs (6 messages)
    const recentHistory = conversationHistory.slice(-6);
    messages.push(...recentHistory);
    // Add current message
    messages.push({ role: 'user', content: currentMessage });
    logger_1.default.info(`📝 Built context with ${messages.length} messages (last 3 conversations)`);
    return messages;
}
/**
 * Count tokens (approximate)
 */
function estimateTokens(text) {
    // Rough estimation: 1 token ≈ 4 characters for English
    return Math.ceil(text.length / 4);
}
/**
 * Truncate messages to fit token limit
 */
function truncateToTokenLimit(messages, maxTokens = 8000) {
    const systemMessage = messages.find(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');
    const truncated = [];
    let currentTokens = 0;
    // Always include system message
    if (systemMessage) {
        truncated.push(systemMessage);
        currentTokens += estimateTokens(systemMessage.content);
    }
    // Add messages from newest to oldest until we hit the limit
    for (let i = otherMessages.length - 1; i >= 0; i--) {
        const msg = otherMessages[i];
        const tokens = estimateTokens(msg.content);
        if (currentTokens + tokens > maxTokens) {
            break;
        }
        truncated.unshift(msg);
        currentTokens += tokens;
    }
    // Re-add system message at the beginning
    const result = systemMessage
        ? [systemMessage, ...truncated.filter(m => m.role !== 'system')]
        : truncated;
    logger_1.default.info(`🔄 Truncated to ${result.length} messages (~${currentTokens} tokens)`);
    return result;
}
exports.default = {
    initializeOpenAI,
    getOpenAIClient,
    chatCompletion,
    buildContextFromHistory,
    estimateTokens,
    truncateToTokenLimit
};
//# sourceMappingURL=azureOpenAI.js.map