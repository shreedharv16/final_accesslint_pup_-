import { Model } from 'sequelize-typescript';
import { TestingSession } from './testingSession.model';
import { AgentSession } from './agentSession.model';
export declare class TestingFix extends Model {
    id: string;
    testingSessionId: string;
    agentSessionId: string;
    filesModified: any;
    fixSummary?: string;
    success: boolean;
    timestamp: Date;
    testingSession: TestingSession;
    agentSession: AgentSession;
}
export default TestingFix;
//# sourceMappingURL=testingFix.model.d.ts.map