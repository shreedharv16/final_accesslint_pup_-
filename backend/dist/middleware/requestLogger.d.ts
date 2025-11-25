import { Request, Response, NextFunction } from 'express';
/**
 * Log incoming requests
 */
export declare function requestLogger(req: Request, res: Response, next: NextFunction): void;
/**
 * Log errors
 */
export declare function errorLogger(err: Error, req: Request, res: Response, next: NextFunction): void;
declare const _default: {
    requestLogger: typeof requestLogger;
    errorLogger: typeof errorLogger;
};
export default _default;
//# sourceMappingURL=requestLogger.d.ts.map