import { Request, Response } from 'express';
/**
 * Start agent session
 * POST /api/agent/start
 * Body: { goal, sessionType: 'chat_agent' | 'testing_agent', workspaceRoot, workspaceFiles }
 */
export declare const startAgent: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get agent session status
 * GET /api/agent/:id/status
 */
export declare const getSessionStatus: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get agent session logs (iterations)
 * GET /api/agent/:id/logs
 */
export declare const getSessionLogs: (req: Request, res: Response, next: import("express").NextFunction) => void;
declare const _default: {
    startAgent: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getSessionStatus: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getSessionLogs: (req: Request, res: Response, next: import("express").NextFunction) => void;
};
export default _default;
//# sourceMappingURL=agentController.d.ts.map