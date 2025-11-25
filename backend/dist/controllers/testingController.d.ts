import { Request, Response } from 'express';
/**
 * Submit test results (from VSCode extension)
 * POST /api/testing/run
 * Body: { url, nvdaInteractions, testResults, aiValidationResults }
 */
export declare const submitTestResults: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Request agent to fix issues
 * POST /api/testing/fix
 * Body: { sessionId, workspaceRoot, workspaceFiles }
 */
export declare const fixIssues: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get testing session
 * GET /api/testing/:id
 */
export declare const getTestingSession: (req: Request, res: Response, next: import("express").NextFunction) => void;
declare const _default: {
    submitTestResults: (req: Request, res: Response, next: import("express").NextFunction) => void;
    fixIssues: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getTestingSession: (req: Request, res: Response, next: import("express").NextFunction) => void;
};
export default _default;
//# sourceMappingURL=testingController.d.ts.map