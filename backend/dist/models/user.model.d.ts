import { Model } from 'sequelize-typescript';
import { Session } from './session.model';
import { ChatConversation } from './chatConversation.model';
import { AgentSession } from './agentSession.model';
import { TestingSession } from './testingSession.model';
import { VsixDownload } from './vsixDownload.model';
export declare class User extends Model {
    id: string;
    email: string;
    passwordHash: string;
    createdAt: Date;
    lastLogin?: Date;
    isActive: boolean;
    rateLimitPerHour: number;
    rateLimitTokensPerDay: number;
    sessions: Session[];
    chatConversations: ChatConversation[];
    agentSessions: AgentSession[];
    testingSessions: TestingSession[];
    vsixDownloads: VsixDownload[];
    toJSON(): any;
}
//# sourceMappingURL=user.model.d.ts.map