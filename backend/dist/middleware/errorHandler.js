"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
exports.asyncHandler = asyncHandler;
const constants_1 = require("../config/constants");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Custom error class
 */
class AppError extends Error {
    constructor(message, statusCode = constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
    let statusCode = constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR;
    let message = constants_1.ERROR_MESSAGES.INTERNAL_ERROR;
    let details = undefined;
    // Handle known AppError
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
    }
    // Handle Sequelize validation errors
    else if (err.name === 'SequelizeValidationError') {
        statusCode = constants_1.HTTP_STATUS.BAD_REQUEST;
        message = 'Validation error';
        details = err.errors?.map((e) => ({
            field: e.path,
            message: e.message
        }));
    }
    // Handle Sequelize unique constraint errors
    else if (err.name === 'SequelizeUniqueConstraintError') {
        statusCode = constants_1.HTTP_STATUS.CONFLICT;
        message = 'Resource already exists';
        details = err.errors?.map((e) => ({
            field: e.path,
            message: e.message
        }));
    }
    // Handle Sequelize database errors
    else if (err.name === 'SequelizeDatabaseError') {
        statusCode = constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR;
        message = constants_1.ERROR_MESSAGES.DB_QUERY_ERROR;
    }
    // Handle JWT errors
    else if (err.name === 'JsonWebTokenError') {
        statusCode = constants_1.HTTP_STATUS.UNAUTHORIZED;
        message = constants_1.ERROR_MESSAGES.TOKEN_INVALID;
    }
    else if (err.name === 'TokenExpiredError') {
        statusCode = constants_1.HTTP_STATUS.UNAUTHORIZED;
        message = constants_1.ERROR_MESSAGES.TOKEN_EXPIRED;
    }
    // Generic error
    else {
        message = err.message || constants_1.ERROR_MESSAGES.INTERNAL_ERROR;
    }
    // Log error
    logger_1.default.error(`❌ Error: ${message}`, {
        statusCode,
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        user: req.user?.id || 'Anonymous'
    });
    // Send response
    const response = {
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
function notFoundHandler(req, res) {
    logger_1.default.warn(`⚠️  404 Not Found: ${req.method} ${req.path}`);
    res.status(constants_1.HTTP_STATUS.NOT_FOUND).json({
        error: constants_1.ERROR_MESSAGES.NOT_FOUND,
        message: `Route ${req.method} ${req.path} not found`
    });
}
/**
 * Async handler wrapper to catch errors
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
exports.default = {
    errorHandler,
    notFoundHandler,
    asyncHandler,
    AppError
};
//# sourceMappingURL=errorHandler.js.map