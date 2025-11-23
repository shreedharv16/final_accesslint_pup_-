import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { FEATURES } from '../config/constants';

/**
 * Log incoming requests
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
    if (!FEATURES.REQUEST_LOGGING) {
        next();
        return;
    }

    const startTime = Date.now();
    const { method, path, ip } = req;
    const userAgent = req.get('user-agent') || 'Unknown';
    const userId = req.user?.id || 'Anonymous';

    // Log request
    logger.info(`➡️  ${method} ${path} - User: ${userId} - IP: ${ip}`);

    // Intercept response to log completion
    const originalSend = res.send;
    res.send = function (data: any): Response {
        const duration = Date.now() - startTime;
        const { statusCode } = res;

        // Log response
        const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
        const emoji = statusCode >= 500 ? '❌' : statusCode >= 400 ? '⚠️ ' : '✅';
        
        logger[logLevel](
            `${emoji} ${method} ${path} - ${statusCode} - ${duration}ms - User: ${userId}`
        );

        return originalSend.call(this, data);
    };

    next();
}

/**
 * Log errors
 */
export function errorLogger(err: Error, req: Request, res: Response, next: NextFunction): void {
    const { method, path } = req;
    const userId = req.user?.id || 'Anonymous';

    logger.error(`❌ Error in ${method} ${path} - User: ${userId}`, {
        error: err.message,
        stack: err.stack
    });

    next(err);
}

export default {
    requestLogger,
    errorLogger
};

