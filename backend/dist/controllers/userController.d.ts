import { Request, Response } from 'express';
/**
 * Get user profile
 * GET /api/user/profile
 */
export declare const getProfile: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get user usage statistics
 * GET /api/user/usage
 */
export declare const getUsage: (req: Request, res: Response, next: import("express").NextFunction) => void;
declare const _default: {
    getProfile: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getUsage: (req: Request, res: Response, next: import("express").NextFunction) => void;
};
export default _default;
//# sourceMappingURL=userController.d.ts.map