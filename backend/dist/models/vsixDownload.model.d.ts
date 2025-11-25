import { Model } from 'sequelize-typescript';
import { User } from './user.model';
export declare class VsixDownload extends Model {
    id: string;
    userId: string;
    vsixVersion: string;
    downloadTimestamp: Date;
    ipAddress?: string;
    userAgent?: string;
    user: User;
}
//# sourceMappingURL=vsixDownload.model.d.ts.map