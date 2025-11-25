import { Model } from 'sequelize-typescript';
import { User } from './user.model';
import { ChatMessage } from './chatMessage.model';
export declare class ChatConversation extends Model {
    id: string;
    userId: string;
    conversationType: 'quick_mode' | 'agent_mode';
    title?: string;
    createdAt: Date;
    updatedAt: Date;
    isArchived: boolean;
    user: User;
    messages: ChatMessage[];
}
//# sourceMappingURL=chatConversation.model.d.ts.map