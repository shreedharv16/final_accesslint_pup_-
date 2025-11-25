import { Request, Response } from 'express';
/**
 * Download VSIX file
 * GET /api/download/vsix
 * Query: ?version=1.0.0 (optional)
 */
export declare const downloadVsix: (req: Request, res: Response, next: import("express").NextFunction) => void;
/**
 * Get available VSIX versions
 * GET /api/download/versions
 */
export declare const getVersions: (req: Request, res: Response, next: import("express").NextFunction) => void;
declare const _default: {
    downloadVsix: (req: Request, res: Response, next: import("express").NextFunction) => void;
    getVersions: (req: Request, res: Response, next: import("express").NextFunction) => void;
};
export default _default;
//# sourceMappingURL=downloadController.d.ts.map