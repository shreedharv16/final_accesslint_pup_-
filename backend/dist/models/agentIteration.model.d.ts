import { Model } from 'sequelize-typescript';
import { AgentSession } from './agentSession.model';
export declare class AgentIteration extends Model {
    id: string;
    sessionId: string;
    iterationNumber: number;
    llmRequest: any;
    llmResponse: any;
    toolCalls?: any;
    toolResults?: any;
    tokensUsed: number;
    executionTimeMs?: number;
    timestamp: Date;
    session: AgentSession;
}
export default AgentIteration;
//# sourceMappingURL=agentIteration.model.d.ts.map