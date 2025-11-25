import { Request, Response, NextFunction } from 'express';
/**
 * Rate limiting middleware
 * Checks both hourly request limits and daily token limits
 */
export declare function rateLimit(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Track request usage
 * This should be called AFTER the request completes
 */
export declare function trackUsage(userId: string, endpoint: string, method: string, statusCode: number, tokensUsed?: number, executionTimeMs?: number): Promise<void>;
/**
 * Middleware to track usage after response
 */
export declare function usageTracker(req: Request, res: Response, next: NextFunction): void;
/**
 * Get current usage for a user
 */
export declare function getCurrentUsage(userId: string): Promise<{
    hourlyRequests: number;
    dailyTokens: number;
    rateLimitPerHour: number;
    rateLimitTokensPerDay: number;
}>;
declare const _default: {
    rateLimit: typeof rateLimit;
    trackUsage: typeof trackUsage;
    usageTracker: typeof usageTracker;
    getCurrentUsage: typeof getCurrentUsage;
};
export default _default;
//# sourceMappingURL=rateLimitMiddleware.d.ts.map