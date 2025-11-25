"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMessages = exports.getConversations = exports.sendMessage = void 0;
const aiService_1 = require("../services/aiService");
const constants_1 = require("../config/constants");
const errorHandler_1 = require("../middleware/errorHandler");
/**
 * Send chat message
 * POST /api/chat/message
 * Body: { conversationId?, message, mode: 'quick_mode' | 'agent_mode' }
 */
exports.sendMessage = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { conversationId, message, mode = 'quick_mode' } = req.body;
    const userId = req.user.id;
    if (!message) {
        res.status(constants_1.HTTP_STATUS.BAD_REQUEST).json({
            error: 'Message is required'
        });
        return;
    }
    // Create conversation if not provided
    let convId = conversationId;
    if (!convId) {
        const conversation = await (0, aiService_1.createConversation)(userId, mode);
        convId = conversation.id;
    }
    // Save user message
    await (0, aiService_1.saveMessage)(convId, 'user', message);
    // Get AI response with context (last 3 conversations)
    const systemPrompt = mode === 'agent_mode'
        ? 'You are AccessLint Agent, an expert in accessibility and code implementation.'
        : 'You are AccessLint Assistant, providing quick answers about accessibility.';
    const { response, tokensUsed } = await (0, aiService_1.getAIResponse)(convId, message, systemPrompt, { maxTokens: mode === 'agent_mode' ? 4000 : 2000 });
    // Save assistant message
    await (0, aiService_1.saveMessage)(convId, 'assistant', response, null, tokensUsed);
    // Track tokens used
    res.tokensUsed = tokensUsed;
    res.status(constants_1.HTTP_STATUS.OK).json({
        data: {
            conversationId: convId,
            response,
            tokensUsed
        }
    });
});
/**
 * Get user conversations
 * GET /api/chat/conversations
 */
exports.getConversations = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const conversations = await (0, aiService_1.getUserConversations)(userId, { limit, offset });
    res.status(constants_1.HTTP_STATUS.OK).json({
        data: { conversations }
    });
});
/**
 * Get conversation messages
 * GET /api/chat/conversations/:id/messages
 */
exports.getMessages = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const messages = await (0, aiService_1.getConversationMessages)(id, limit);
    res.status(constants_1.HTTP_STATUS.OK).json({
        data: { messages }
    });
});
exports.default = {
    sendMessage: exports.sendMessage,
    getConversations: exports.getConversations,
    getMessages: exports.getMessages
};
//# sourceMappingURL=chatController.js.map