import { Model } from 'sequelize-typescript';
import { ChatConversation } from './chatConversation.model';
export declare class ChatMessage extends Model {
    id: string;
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    toolCalls?: any;
    tokensUsed: number;
    timestamp: Date;
    conversation: ChatConversation;
}
//# sourceMappingURL=chatMessage.model.d.ts.map