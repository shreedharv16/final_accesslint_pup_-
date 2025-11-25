import { Model } from 'sequelize-typescript';
import { User } from './user.model';
export declare class DebugLog extends Model {
    id: string;
    userId?: string;
    sessionId?: string;
    sessionType?: 'agent' | 'testing' | 'chat' | 'general';
    logLevel: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
    message: string;
    context?: any;
    timestamp: Date;
    user?: User;
}
//# sourceMappingURL=debugLog.model.d.ts.map