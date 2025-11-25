"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = requestLogger;
exports.errorLogger = errorLogger;
const logger_1 = __importDefault(require("../utils/logger"));
const constants_1 = require("../config/constants");
/**
 * Log incoming requests
 */
function requestLogger(req, res, next) {
    if (!constants_1.FEATURES.REQUEST_LOGGING) {
        next();
        return;
    }
    const startTime = Date.now();
    const { method, path, ip } = req;
    const userAgent = req.get('user-agent') || 'Unknown';
    const userId = req.user?.id || 'Anonymous';
    // Log request
    logger_1.default.info(`➡️  ${method} ${path} - User: ${userId} - IP: ${ip}`);
    // Intercept response to log completion
    const originalSend = res.send;
    res.send = function (data) {
        const duration = Date.now() - startTime;
        const { statusCode } = res;
        // Log response
        const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
        const emoji = statusCode >= 500 ? '❌' : statusCode >= 400 ? '⚠️ ' : '✅';
        logger_1.default[logLevel](`${emoji} ${method} ${path} - ${statusCode} - ${duration}ms - User: ${userId}`);
        return originalSend.call(this, data);
    };
    next();
}
/**
 * Log errors
 */
function errorLogger(err, req, res, next) {
    const { method, path } = req;
    const userId = req.user?.id || 'Anonymous';
    logger_1.default.error(`❌ Error in ${method} ${path} - User: ${userId}`, {
        error: err.message,
        stack: err.stack
    });
    next(err);
}
exports.default = {
    requestLogger,
    errorLogger
};
//# sourceMappingURL=requestLogger.js.map