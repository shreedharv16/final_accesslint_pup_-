import { Model } from 'sequelize-typescript';
import { User } from './user.model';
import { AgentIteration } from './agentIteration.model';
export declare class AgentSession extends Model {
    id: string;
    userId: string;
    sessionType: 'chat_agent' | 'testing_agent';
    goal: string;
    status: 'active' | 'completed' | 'error' | 'timeout';
    totalIterations: number;
    startTime: Date;
    endTime?: Date;
    fileChanges?: any;
    completionSummary?: string;
    errorMessage?: string;
    user: User;
    iterations: AgentIteration[];
}
//# sourceMappingURL=agentSession.model.d.ts.map