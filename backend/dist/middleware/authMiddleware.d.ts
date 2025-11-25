import { Request, Response, NextFunction } from 'express';
import { User } from '../models';
declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}
/**
 * Middleware to verify JWT token and attach user to request
 */
export declare function authenticate(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Optional authentication - doesn't fail if no token, but attaches user if present
 */
export declare function optionalAuthenticate(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Middleware to check if user is active
 */
export declare function requireActive(req: Request, res: Response, next: NextFunction): void;
declare const _default: {
    authenticate: typeof authenticate;
    optionalAuthenticate: typeof optionalAuthenticate;
    requireActive: typeof requireActive;
};
export default _default;
//# sourceMappingURL=authMiddleware.d.ts.map