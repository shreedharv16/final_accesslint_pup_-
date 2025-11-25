import { Model } from 'sequelize-typescript';
import { User } from './user.model';
export declare class Session extends Model {
    id: string;
    userId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    createdAt: Date;
    ipAddress?: string;
    userAgent?: string;
    user: User;
}
//# sourceMappingURL=session.model.d.ts.map