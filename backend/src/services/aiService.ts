import { chatCompletion, buildContextFromHistory, estimateTokens } from '../config/azureOpenAI';
import { ChatMessage, ChatConversation } from '../models';
import logger from '../utils/logger';
import { logInfo } from './loggingService';

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
export async function getAIResponse(
    conversationId: string,
    userMessage: string,
    systemPrompt: string,
    options?: AICompletionOptions
): Promise<{ response: string; tokensUsed: number }> {
    try {
        logger.info(`🤖 Getting AI response for conversation: ${conversationId}`);

        // Get conversation history from database
        const messages = await ChatMessage.findAll({
            where: { conversationId },
            order: [['timestamp', 'ASC']],
            limit: 100 // Get last 100 messages for analysis
        });

        // Build conversation history (exclude system messages, only user/assistant)
        const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content
            }));

        // Build context with last 3 conversation pairs
        const contextMessages = buildContextFromHistory(
            systemPrompt,
            conversationHistory,
            userMessage
        );

        logger.info(`📝 Built context with ${contextMessages.length} messages (last 3 conversations)`);

        // Call OpenAI
        const response = await chatCompletion(contextMessages, options);

        // Estimate tokens used
        const totalContent = contextMessages.map(m => m.content).join('') + response;
        const tokensUsed = estimateTokens(totalContent);

        logger.info(`✅ AI response received (${tokensUsed} tokens)`);

        return {
            response,
            tokensUsed
        };
    } catch (error) {
        logger.error('❌ Error getting AI response:', error);
        throw error;
    }
}

/**
 * Save message to conversation
 */
export async function saveMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    toolCalls?: any,
    tokensUsed?: number
): Promise<ChatMessage> {
    try {
        const message = await ChatMessage.create({
            conversationId,
            role,
            content,
            toolCalls,
            tokensUsed: tokensUsed || 0
        });

        logger.debug(`💾 Saved ${role} message to conversation ${conversationId}`);

        return message;
    } catch (error) {
        logger.error('❌ Error saving message:', error);
        throw error;
    }
}

/**
 * Get conversation messages with optional limit
 */
export async function getConversationMessages(
    conversationId: string,
    limit?: number
): Promise<ChatMessage[]> {
    try {
        const messages = await ChatMessage.findAll({
            where: { conversationId },
            order: [['timestamp', 'ASC']],
            limit: limit || undefined
        });

        return messages;
    } catch (error) {
        logger.error(`❌ Error getting messages for conversation ${conversationId}:`, error);
        throw error;
    }
}

/**
 * Get last N conversation pairs (user + assistant)
 */
export async function getLastConversationPairs(
    conversationId: string,
    pairs: number = 3
): Promise<Array<{ user: string; assistant: string }>> {
    try {
        const messages = await ChatMessage.findAll({
            where: { conversationId },
            order: [['timestamp', 'ASC']]
        });

        // Filter out system messages
        const userAssistantMessages = messages.filter(m => m.role !== 'system');

        // Group into pairs
        const conversationPairs: Array<{ user: string; assistant: string }> = [];
        for (let i = 0; i < userAssistantMessages.length - 1; i += 2) {
            if (userAssistantMessages[i].role === 'user' && 
                userAssistantMessages[i + 1]?.role === 'assistant') {
                conversationPairs.push({
                    user: userAssistantMessages[i].content,
                    assistant: userAssistantMessages[i + 1].content
                });
            }
        }

        // Return last N pairs
        return conversationPairs.slice(-pairs);
    } catch (error) {
        logger.error(`❌ Error getting conversation pairs for ${conversationId}:`, error);
        return [];
    }
}

/**
 * Create a new conversation
 */
export async function createConversation(
    userId: string,
    conversationType: 'quick_mode' | 'agent_mode',
    title?: string
): Promise<ChatConversation> {
    try {
        const conversation = await ChatConversation.create({
            userId,
            conversationType,
            title: title || `${conversationType} - ${new Date().toLocaleDateString()}`
        });

        logger.info(`✅ Created new conversation: ${conversation.id} (${conversationType})`);

        return conversation;
    } catch (error) {
        logger.error('❌ Error creating conversation:', error);
        throw error;
    }
}

/**
 * Get user's conversations
 */
export async function getUserConversations(
    userId: string,
    options?: {
        limit?: number;
        offset?: number;
        includeArchived?: boolean;
    }
): Promise<ChatConversation[]> {
    try {
        const where: any = { userId };

        if (!options?.includeArchived) {
            where.isArchived = false;
        }

        const conversations = await ChatConversation.findAll({
            where,
            order: [['updatedAt', 'DESC']],
            limit: options?.limit || 20,
            offset: options?.offset || 0
        });

        return conversations;
    } catch (error) {
        logger.error(`❌ Error getting conversations for user ${userId}:`, error);
        throw error;
    }
}

/**
 * Archive a conversation
 */
export async function archiveConversation(conversationId: string): Promise<void> {
    try {
        const conversation = await ChatConversation.findByPk(conversationId);
        if (!conversation) {
            throw new Error('Conversation not found');
        }

        conversation.isArchived = true;
        await conversation.save();

        logger.info(`✅ Archived conversation: ${conversationId}`);
    } catch (error) {
        logger.error(`❌ Error archiving conversation ${conversationId}:`, error);
        throw error;
    }
}

/**
 * Delete old conversations
 */
export async function deleteOldConversations(daysToKeep: number = 90): Promise<number> {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const result = await ChatConversation.destroy({
            where: {
                updatedAt: {
                    [require('sequelize').Op.lt]: cutoffDate
                },
                isArchived: true
            }
        });

        logger.info(`✅ Deleted ${result} old conversations (older than ${daysToKeep} days)`);
        return result;
    } catch (error) {
        logger.error('❌ Error deleting old conversations:', error);
        return 0;
    }
}

export default {
    getAIResponse,
    saveMessage,
    getConversationMessages,
    getLastConversationPairs,
    createConversation,
    getUserConversations,
    archiveConversation,
    deleteOldConversations
};

