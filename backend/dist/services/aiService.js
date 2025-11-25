"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAIResponse = getAIResponse;
exports.saveMessage = saveMessage;
exports.getConversationMessages = getConversationMessages;
exports.getLastConversationPairs = getLastConversationPairs;
exports.createConversation = createConversation;
exports.getUserConversations = getUserConversations;
exports.archiveConversation = archiveConversation;
exports.deleteOldConversations = deleteOldConversations;
const azureOpenAI_1 = require("../config/azureOpenAI");
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Get AI response with context management
 * Automatically includes last 3 conversations (6 messages: user + assistant pairs)
 */
async function getAIResponse(conversationId, userMessage, systemPrompt, options) {
    try {
        logger_1.default.info(`🤖 Getting AI response for conversation: ${conversationId}`);
        // Get conversation history from database
        const messages = await models_1.ChatMessage.findAll({
            where: { conversationId },
            order: [['timestamp', 'ASC']],
            limit: 100 // Get last 100 messages for analysis
        });
        // Build conversation history (exclude system messages, only user/assistant)
        const conversationHistory = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
            role: m.role,
            content: m.content
        }));
        // Build context with last 3 conversation pairs
        const contextMessages = (0, azureOpenAI_1.buildContextFromHistory)(systemPrompt, conversationHistory, userMessage);
        logger_1.default.info(`📝 Built context with ${contextMessages.length} messages (last 3 conversations)`);
        // Call OpenAI
        const response = await (0, azureOpenAI_1.chatCompletion)(contextMessages, options);
        // Estimate tokens used
        const totalContent = contextMessages.map(m => m.content).join('') + response;
        const tokensUsed = (0, azureOpenAI_1.estimateTokens)(totalContent);
        logger_1.default.info(`✅ AI response received (${tokensUsed} tokens)`);
        return {
            response,
            tokensUsed
        };
    }
    catch (error) {
        logger_1.default.error('❌ Error getting AI response:', error);
        throw error;
    }
}
/**
 * Save message to conversation
 */
async function saveMessage(conversationId, role, content, toolCalls, tokensUsed) {
    try {
        const message = await models_1.ChatMessage.create({
            conversationId,
            role,
            content,
            toolCalls,
            tokensUsed: tokensUsed || 0
        });
        logger_1.default.debug(`💾 Saved ${role} message to conversation ${conversationId}`);
        return message;
    }
    catch (error) {
        logger_1.default.error('❌ Error saving message:', error);
        throw error;
    }
}
/**
 * Get conversation messages with optional limit
 */
async function getConversationMessages(conversationId, limit) {
    try {
        const messages = await models_1.ChatMessage.findAll({
            where: { conversationId },
            order: [['timestamp', 'ASC']],
            limit: limit || undefined
        });
        return messages;
    }
    catch (error) {
        logger_1.default.error(`❌ Error getting messages for conversation ${conversationId}:`, error);
        throw error;
    }
}
/**
 * Get last N conversation pairs (user + assistant)
 */
async function getLastConversationPairs(conversationId, pairs = 3) {
    try {
        const messages = await models_1.ChatMessage.findAll({
            where: { conversationId },
            order: [['timestamp', 'ASC']]
        });
        // Filter out system messages
        const userAssistantMessages = messages.filter(m => m.role !== 'system');
        // Group into pairs
        const conversationPairs = [];
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
    }
    catch (error) {
        logger_1.default.error(`❌ Error getting conversation pairs for ${conversationId}:`, error);
        return [];
    }
}
/**
 * Create a new conversation
 */
async function createConversation(userId, conversationType, title) {
    try {
        const conversation = await models_1.ChatConversation.create({
            userId,
            conversationType,
            title: title || `${conversationType} - ${new Date().toLocaleDateString()}`
        });
        logger_1.default.info(`✅ Created new conversation: ${conversation.id} (${conversationType})`);
        return conversation;
    }
    catch (error) {
        logger_1.default.error('❌ Error creating conversation:', error);
        throw error;
    }
}
/**
 * Get user's conversations
 */
async function getUserConversations(userId, options) {
    try {
        const where = { userId };
        if (!options?.includeArchived) {
            where.isArchived = false;
        }
        const conversations = await models_1.ChatConversation.findAll({
            where,
            order: [['updatedAt', 'DESC']],
            limit: options?.limit || 20,
            offset: options?.offset || 0
        });
        return conversations;
    }
    catch (error) {
        logger_1.default.error(`❌ Error getting conversations for user ${userId}:`, error);
        throw error;
    }
}
/**
 * Archive a conversation
 */
async function archiveConversation(conversationId) {
    try {
        const conversation = await models_1.ChatConversation.findByPk(conversationId);
        if (!conversation) {
            throw new Error('Conversation not found');
        }
        conversation.isArchived = true;
        await conversation.save();
        logger_1.default.info(`✅ Archived conversation: ${conversationId}`);
    }
    catch (error) {
        logger_1.default.error(`❌ Error archiving conversation ${conversationId}:`, error);
        throw error;
    }
}
/**
 * Delete old conversations
 */
async function deleteOldConversations(daysToKeep = 90) {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        const result = await models_1.ChatConversation.destroy({
            where: {
                updatedAt: {
                    [require('sequelize').Op.lt]: cutoffDate
                },
                isArchived: true
            }
        });
        logger_1.default.info(`✅ Deleted ${result} old conversations (older than ${daysToKeep} days)`);
        return result;
    }
    catch (error) {
        logger_1.default.error('❌ Error deleting old conversations:', error);
        return 0;
    }
}
exports.default = {
    getAIResponse,
    saveMessage,
    getConversationMessages,
    getLastConversationPairs,
    createConversation,
    getUserConversations,
    archiveConversation,
    deleteOldConversations
};
//# sourceMappingURL=aiService.js.map