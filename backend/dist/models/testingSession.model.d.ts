import { Model } from 'sequelize-typescript';
import { User } from './user.model';
import { TestingFix } from './testingFix.model';
export declare class TestingSession extends Model {
    id: string;
    userId: string;
    testedUrl: string;
    nvdaInteractions: any;
    testResults: any;
    aiValidationResults?: any;
    startTime: Date;
    endTime?: Date;
    totalIssues: number;
    severityBreakdown?: any;
    user: User;
    fixes: TestingFix[];
}
export default TestingSession;
//# sourceMappingURL=testingSession.model.d.ts.map