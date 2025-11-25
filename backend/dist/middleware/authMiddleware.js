"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.optionalAuthenticate = optionalAuthenticate;
exports.requireActive = requireActive;
const authService_1 = require("../services/authService");
const constants_1 = require("../config/constants");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Middleware to verify JWT token and attach user to request
 */
async function authenticate(req, res, next) {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(constants_1.HTTP_STATUS.UNAUTHORIZED).json({
                error: constants_1.ERROR_MESSAGES.UNAUTHORIZED,
                message: 'No token provided'
            });
            return;
        }
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        // Verify token and get user
        const user = await (0, authService_1.verifyAccessToken)(token);
        if (!user) {
            res.status(constants_1.HTTP_STATUS.UNAUTHORIZED).json({
                error: constants_1.ERROR_MESSAGES.TOKEN_INVALID,
                message: 'Invalid or expired token'
            });
            return;
        }
        // Attach user to request
        req.user = user;
        next();
    }
    catch (error) {
        logger_1.default.error('❌ Authentication error:', error);
        res.status(constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            error: constants_1.ERROR_MESSAGES.INTERNAL_ERROR,
            message: 'Authentication failed'
        });
    }
}
/**
 * Optional authentication - doesn't fail if no token, but attaches user if present
 */
async function optionalAuthenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const user = await (0, authService_1.verifyAccessToken)(token);
            if (user) {
                req.user = user;
            }
        }
        next();
    }
    catch (error) {
        logger_1.default.error('❌ Optional authentication error:', error);
        next();
    }
}
/**
 * Middleware to check if user is active
 */
function requireActive(req, res, next) {
    if (!req.user) {
        res.status(constants_1.HTTP_STATUS.UNAUTHORIZED).json({
            error: constants_1.ERROR_MESSAGES.UNAUTHORIZED,
            message: 'User not authenticated'
        });
        return;
    }
    if (!req.user.isActive) {
        res.status(constants_1.HTTP_STATUS.FORBIDDEN).json({
            error: constants_1.ERROR_MESSAGES.USER_INACTIVE,
            message: 'User account is inactive'
        });
        return;
    }
    next();
}
exports.default = {
    authenticate,
    optionalAuthenticate,
    requireActive
};
//# sourceMappingURL=authMiddleware.js.map