import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS, ERROR_MESSAGES } from '../config/constants';
import logger from '../utils/logger';

/**
 * Custom error class
 */
export class AppError extends Error {
    statusCode: number;
    isOperational: boolean;

    constructor(message: string, statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Global error handler middleware
 */
export function errorHandler(err: Error | AppError, req: Request, res: Response, next: NextFunction): void {
    let statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    let message = ERROR_MESSAGES.INTERNAL_ERROR;
    let details: any = undefined;

    // Handle known AppError
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
    }
    // Handle Sequelize validation errors
    else if (err.name === 'SequelizeValidationError') {
        statusCode = HTTP_STATUS.BAD_REQUEST;
        message = 'Validation error';
        details = (err as any).errors?.map((e: any) => ({
            field: e.path,
            message: e.message
        }));
    }
    // Handle Sequelize unique constraint errors
    else if (err.name === 'SequelizeUniqueConstraintError') {
        statusCode = HTTP_STATUS.CONFLICT;
        message = 'Resource already exists';
        details = (err as any).errors?.map((e: any) => ({
            field: e.path,
            message: e.message
        }));
    }
    // Handle Sequelize database errors
    else if (err.name === 'SequelizeDatabaseError') {
        statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
        message = ERROR_MESSAGES.DB_QUERY_ERROR;
    }
    // Handle JWT errors
    else if (err.name === 'JsonWebTokenError') {
        statusCode = HTTP_STATUS.UNAUTHORIZED;
        message = ERROR_MESSAGES.TOKEN_INVALID;
    }
    else if (err.name === 'TokenExpiredError') {
        statusCode = HTTP_STATUS.UNAUTHORIZED;
        message = ERROR_MESSAGES.TOKEN_EXPIRED;
    }
    // Generic error
    else {
        message = err.message || ERROR_MESSAGES.INTERNAL_ERROR;
    }

    // Log error
    logger.error(`❌ Error: ${message}`, {
        statusCode,
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        user: req.user?.id || 'Anonymous'
    });

    // Send response
    const response: any = {
        error: message
    };

    if (details) {
        response.details = details;
    }

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
}

/**
 * Handle 404 errors
 */
export function notFoundHandler(req: Request, res: Response): void {
    logger.warn(`⚠️  404 Not Found: ${req.method} ${req.path}`);
    res.status(HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_MESSAGES.NOT_FOUND,
        message: `Route ${req.method} ${req.path} not found`
    });
}

/**
 * Async handler wrapper to catch errors
 */
export function asyncHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

export default {
    errorHandler,
    notFoundHandler,
    asyncHandler,
    AppError
};

