import { Request, Response } from 'express';
import {
    getAIResponse,
    saveMessage,
    createConversation,
    getUserConversations,
    getConversationMessages
} from '../services/aiService';
import { HTTP_STATUS } from '../config/constants';
import { asyncHandler } from '../middleware/errorHandler';

/**
 * Send chat message
 * POST /api/chat/message
 * Body: { conversationId?, message, mode: 'quick_mode' | 'agent_mode' }
 */
export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId, message, mode = 'quick_mode' } = req.body;
    const userId = req.user!.id;

    if (!message) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
            error: 'Message is required'
        });
        return;
    }

    // Create conversation if not provided
    let convId = conversationId;
    if (!convId) {
        const conversation = await createConversation(userId, mode);
        convId = conversation.id;
    }

    // Save user message
    await saveMessage(convId, 'user', message);

    // Get AI response with context (last 3 conversations)
    const systemPrompt = mode === 'agent_mode'
        ? 'You are AccessLint Agent, an expert in accessibility and code implementation.'
        : 'You are AccessLint Assistant, providing quick answers about accessibility.';

    const { response, tokensUsed } = await getAIResponse(
        convId,
        message,
        systemPrompt,
        { maxTokens: mode === 'agent_mode' ? 4000 : 2000 }
    );

    // Save assistant message
    await saveMessage(convId, 'assistant', response, null, tokensUsed);

    // Track tokens used
    (res as any).tokensUsed = tokensUsed;

    res.status(HTTP_STATUS.OK).json({
        data: {
            conversationId: convId,
            response,
            tokensUsed
        }
    });
});

/**
 * Create a new conversation
 * POST /api/chat/conversations
 * Body: { type: 'chat' | 'agent', title?: string }
 */
export const createConv = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { type = 'chat', title } = req.body;

    const conversation = await createConversation(userId, type === 'agent' ? 'agent_mode' : 'quick_mode');

    res.status(HTTP_STATUS.OK).json({
        data: conversation
    });
});

/**
 * Get user conversations
 * GET /api/chat/conversations
 */
export const getConversations = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const conversations = await getUserConversations(userId, { limit, offset });

    res.status(HTTP_STATUS.OK).json({
        data: { conversations }
    });
});

/**
 * Send message to a conversation
 * POST /api/chat/conversations/:id/messages
 * Body: { content: string }
 */
export const sendMessageToConversation = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user!.id;

    if (!content) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
            error: 'Message content is required'
        });
        return;
    }

    // Save user message
    await saveMessage(id, 'user', content);

    res.status(HTTP_STATUS.OK).json({
        data: {
            message: 'Message saved',
            conversationId: id
        }
    });
});

/**
 * Get conversation messages
 * GET /api/chat/conversations/:id/messages
 */
export const getMessages = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const messages = await getConversationMessages(id, limit);

    res.status(HTTP_STATUS.OK).json({
        data: { messages }
    });
});

export default {
    sendMessage,
    createConv,
    getConversations,
    sendMessageToConversation,
    getMessages
};

