import { AzureOpenAI } from 'openai';
import logger from '../utils/logger';

// HARDCODED AZURE OPENAI CREDENTIALS (East US 2)
const AZURE_OPENAI_ENDPOINT = 'https://ctonpsiotspocopenai.openai.azure.com/';
const AZURE_OPENAI_API_KEY = 'BiG4E52GKPwmxv60QxNWxAmlUoKyUyUnDPGavAx5sWSE0MkcmjKDJQQJ99BKACHYHv6XJ3w3AAABACOGDm43';
const AZURE_OPENAI_DEPLOYMENT = 'gpt-5';
const AZURE_OPENAI_API_VERSION = '2025-01-01-preview';

let openaiClient: AzureOpenAI | null = null;

export interface OpenAIConfig {
    endpoint: string;
    apiKey: string;
    deployment: string;
    apiVersion: string;
}

/**
 * Initialize Azure OpenAI client with hardcoded credentials
 */
export async function initializeOpenAI(): Promise<void> {
    try {
        openaiClient = new AzureOpenAI({
            endpoint: AZURE_OPENAI_ENDPOINT,
            apiKey: AZURE_OPENAI_API_KEY,
            apiVersion: AZURE_OPENAI_API_VERSION,
            deployment: AZURE_OPENAI_DEPLOYMENT
        });

        logger.info('✅ Azure OpenAI client initialized');
        logger.info(`🤖 Model: ${AZURE_OPENAI_DEPLOYMENT}`);
        logger.info(`🌐 Endpoint: ${AZURE_OPENAI_ENDPOINT}`);
    } catch (error) {
        logger.error('❌ Failed to initialize Azure OpenAI:', error);
        throw error;
    }
}

/**
 * Get OpenAI client
 */
export function getOpenAIClient(): AzureOpenAI {
    if (!openaiClient) {
        throw new Error('OpenAI client not initialized. Call initializeOpenAI() first.');
    }
    return openaiClient;
}

/**
 * Call Azure OpenAI with chat completion
 * Includes context management: keeps last 3 conversations
 */
export async function chatCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: {
        maxTokens?: number;
        temperature?: number;
        stream?: boolean;
    }
): Promise<string> {
    try {
        const client = getOpenAIClient();

        const response = await client.chat.completions.create({
            model: AZURE_OPENAI_DEPLOYMENT,
            messages,
            max_completion_tokens: options?.maxTokens || 4000, // GPT-5 uses max_completion_tokens
            temperature: options?.temperature || 0.7,
            stream: false // Always use non-streaming mode
        }) as any;

        const content = response.choices[0]?.message?.content || '';
        
        logger.info(`✅ GPT-5 completion (tokens: ${response.usage?.total_tokens || 0})`);

        return content;
    } catch (error) {
        logger.error('❌ Error in GPT-5 chat completion:', error);
        throw error;
    }
}

/**
 * Build context from recent conversations
 * Keeps system message + last 3 user/assistant pairs
 */
export function buildContextFromHistory(
    systemMessage: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    currentMessage: string
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemMessage }
    ];

    // Keep last 3 conversation pairs (6 messages)
    const recentHistory = conversationHistory.slice(-6);
    messages.push(...recentHistory);

    // Add current message
    messages.push({ role: 'user', content: currentMessage });

    logger.info(`📝 Built context with ${messages.length} messages (last 3 conversations)`);

    return messages;
}

/**
 * Count tokens (approximate)
 */
export function estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English
    return Math.ceil(text.length / 4);
}

/**
 * Truncate messages to fit token limit
 */
export function truncateToTokenLimit(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    maxTokens: number = 8000
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const systemMessage = messages.find(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');

    const truncated: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
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

    logger.info(`🔄 Truncated to ${result.length} messages (~${currentTokens} tokens)`);

    return result;
}

export default {
    initializeOpenAI,
    getOpenAIClient,
    chatCompletion,
    buildContextFromHistory,
    estimateTokens,
    truncateToTokenLimit
};

