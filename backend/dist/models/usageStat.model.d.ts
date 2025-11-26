import { Model } from 'sequelize-typescript';
import { User } from './user.model';
export declare class UsageStat extends Model {
    id: string;
    userId: string;
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    statusCode?: number;
    tokensUsed: number;
    executionTimeMs?: number;
    timestamp: Date;
    user: User;
}
export default UsageStat;
//# sourceMappingURL=usageStat.model.d.ts.map