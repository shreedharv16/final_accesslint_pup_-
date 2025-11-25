import { ChatMessage, ChatConversation } from '../models';
export interface AIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface AICompletionOptions {
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
}
/**
 * Get AI response with context management
 * Automatically includes last 3 conversations (6 messages: user + assistant pairs)
 */
export declare function getAIResponse(conversationId: string, userMessage: string, systemPrompt: string, options?: AICompletionOptions): Promise<{
    response: string;
    tokensUsed: number;
}>;
/**
 * Save message to conversation
 */
export declare function saveMessage(conversationId: string, role: 'user' | 'assistant' | 'system', content: string, toolCalls?: any, tokensUsed?: number): Promise<ChatMessage>;
/**
 * Get conversation messages with optional limit
 */
export declare function getConversationMessages(conversationId: string, limit?: number): Promise<ChatMessage[]>;
/**
 * Get last N conversation pairs (user + assistant)
 */
export declare function getLastConversationPairs(conversationId: string, pairs?: number): Promise<Array<{
    user: string;
    assistant: string;
}>>;
/**
 * Create a new conversation
 */
export declare function createConversation(userId: string, conversationType: 'quick_mode' | 'agent_mode', title?: string): Promise<ChatConversation>;
/**
 * Get user's conversations
 */
export declare function getUserConversations(userId: string, options?: {
    limit?: number;
    offset?: number;
    includeArchived?: boolean;
}): Promise<ChatConversation[]>;
/**
 * Archive a conversation
 */
export declare function archiveConversation(conversationId: string): Promise<void>;
/**
 * Delete old conversations
 */
export declare function deleteOldConversations(daysToKeep?: number): Promise<number>;
declare const _default: {
    getAIResponse: typeof getAIResponse;
    saveMessage: typeof saveMessage;
    getConversationMessages: typeof getConversationMessages;
    getLastConversationPairs: typeof getLastConversationPairs;
    createConversation: typeof createConversation;
    getUserConversations: typeof getUserConversations;
    archiveConversation: typeof archiveConversation;
    deleteOldConversations: typeof deleteOldConversations;
};
export default _default;
//# sourceMappingURL=aiService.d.ts.map