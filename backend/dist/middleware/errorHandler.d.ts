import { Request, Response, NextFunction } from 'express';
/**
 * Custom error class
 */
export declare class AppError extends Error {
    statusCode: number;
    isOperational: boolean;
    constructor(message: string, statusCode?: number);
}
/**
 * Global error handler middleware
 */
export declare function errorHandler(err: Error | AppError, req: Request, res: Response, next: NextFunction): void;
/**
 * Handle 404 errors
 */
export declare function notFoundHandler(req: Request, res: Response): void;
/**
 * Async handler wrapper to catch errors
 */
export declare function asyncHandler(fn: Function): (req: Request, res: Response, next: NextFunction) => void;
declare const _default: {
    errorHandler: typeof errorHandler;
    notFoundHandler: typeof notFoundHandler;
    asyncHandler: typeof asyncHandler;
    AppError: typeof AppError;
};
export default _default;
//# sourceMappingURL=errorHandler.d.ts.map