import { Request, Response } from 'express';
/**
 * Register new user
 * POST /api/auth/register
 */
export declare const register: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Login user
 * POST /api/auth/login
 */
export declare const login: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Logout user
 * POST /api/auth/logout
 */
export declare const logout: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Refresh access token
 * POST /api/auth/refresh
 */
export declare const refresh: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get current user
 * GET /api/auth/me
 */
export declare const me: (req: Request, res: Response, next: import("express").NextFunction) => void;
declare const _default: {
    register: (req: Request, res: Response, next: import("express").NextFunction) => void;
    login: (req: Request, res: Response, next: import("express").NextFunction) => void;
    logout: (req: Request, res: Response, next: import("express").NextFunction) => void;
    refresh: (req: Request, res: Response, next: import("express").NextFunction) => void;
    me: (req: Request, res: Response, next: import("express").NextFunction) => void;
};
export default _default;
//# sourceMappingURL=authController.d.ts.map