import { AzureOpenAI } from 'openai';
export interface OpenAIConfig {
    endpoint: string;
    apiKey: string;
    deployment: string;
    apiVersion: string;
}
/**
 * Initialize Azure OpenAI client with hardcoded credentials
 */
export declare function initializeOpenAI(): Promise<void>;
/**
 * Get OpenAI client
 */
export declare function getOpenAIClient(): AzureOpenAI;
/**
 * Call Azure OpenAI with chat completion
 * Includes context management: keeps last 3 conversations
 */
export declare function chatCompletion(messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
}>, options?: {
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
}): Promise<string>;
/**
 * Build context from recent conversations
 * Keeps system message + last 3 user/assistant pairs
 */
export declare function buildContextFromHistory(systemMessage: string, conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
}>, currentMessage: string): Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
}>;
/**
 * Count tokens (approximate)
 */
export declare function estimateTokens(text: string): number;
/**
 * Truncate messages to fit token limit
 */
export declare function truncateToTokenLimit(messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
}>, maxTokens?: number): Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
}>;
declare const _default: {
    initializeOpenAI: typeof initializeOpenAI;
    getOpenAIClient: typeof getOpenAIClient;
    chatCompletion: typeof chatCompletion;
    buildContextFromHistory: typeof buildContextFromHistory;
    estimateTokens: typeof estimateTokens;
    truncateToTokenLimit: typeof truncateToTokenLimit;
};
export default _default;
//# sourceMappingURL=azureOpenAI.d.ts.map