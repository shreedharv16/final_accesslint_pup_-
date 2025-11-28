import { Request, Response } from 'express';
/**
 * Send chat message
 * POST /api/chat/message
 * Body: { conversationId?, message, mode: 'quick_mode' | 'agent_mode' }
 */
export declare const sendMessage: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Create a new conversation
 * POST /api/chat/conversations
 * Body: { type: 'chat' | 'agent', title?: string }
 */
export declare const createConv: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get user conversations
 * GET /api/chat/conversations
 */
export declare const getConversations: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Send message to a conversation
 * POST /api/chat/conversations/:id/messages
 * Body: { content: string }
 */
export declare const sendMessageToConversation: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get conversation messages
 * GET /api/chat/conversations/:id/messages
 */
export declare const getMessages: (req: Request, res: Response, next: import("express").NextFunction) => void;
declare const _default: {
    sendMessage: (req: Request, res: Response, next: import("express").NextFunction) => void;
    createConv: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getConversations: (req: Request, res: Response, next: import("express").NextFunction) => void;
    sendMessageToConversation: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getMessages: (req: Request, res: Response, next: import("express").NextFunction) => void;
};
export default _default;
//# sourceMappingURL=chatController.d.ts.map