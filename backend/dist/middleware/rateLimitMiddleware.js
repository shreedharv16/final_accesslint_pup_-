"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = rateLimit;
exports.trackUsage = trackUsage;
exports.usageTracker = usageTracker;
exports.getCurrentUsage = getCurrentUsage;
const models_1 = require("../models");
const constants_1 = require("../config/constants");
const logger_1 = __importDefault(require("../utils/logger"));
const sequelize_1 = require("sequelize");
/**
 * Rate limiting middleware
 * Checks both hourly request limits and daily token limits
 */
async function rateLimit(req, res, next) {
    // Skip if rate limiting is disabled
    if (!constants_1.FEATURES.RATE_LIMITING) {
        next();
        return;
    }
    // Skip if no authenticated user
    if (!req.user) {
        next();
        return;
    }
    try {
        const userId = req.user.id;
        const user = await models_1.User.findByPk(userId);
        if (!user) {
            res.status(constants_1.HTTP_STATUS.UNAUTHORIZED).json({
                error: constants_1.ERROR_MESSAGES.USER_NOT_FOUND
            });
            return;
        }
        // Check hourly request limit
        const oneHourAgo = new Date(Date.now() - 3600000);
        const hourlyRequests = await models_1.UsageStat.count({
            where: {
                userId,
                timestamp: {
                    [sequelize_1.Op.gte]: oneHourAgo
                }
            }
        });
        if (hourlyRequests >= user.rateLimitPerHour) {
            const resetTime = new Date(Date.now() + 3600000);
            res.status(constants_1.HTTP_STATUS.TOO_MANY_REQUESTS).json({
                error: constants_1.ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
                limit: user.rateLimitPerHour,
                current: hourlyRequests,
                resetAt: resetTime.toISOString()
            });
            logger_1.default.warn(`⚠️  Rate limit exceeded for user ${user.email}: ${hourlyRequests}/${user.rateLimitPerHour} requests`);
            return;
        }
        // Check daily token limit
        const oneDayAgo = new Date(Date.now() - 86400000);
        const dailyTokens = await models_1.UsageStat.sum('tokensUsed', {
            where: {
                userId,
                timestamp: {
                    [sequelize_1.Op.gte]: oneDayAgo
                }
            }
        }) || 0;
        if (dailyTokens >= user.rateLimitTokensPerDay) {
            const resetTime = new Date(Date.now() + 86400000);
            res.status(constants_1.HTTP_STATUS.TOO_MANY_REQUESTS).json({
                error: constants_1.ERROR_MESSAGES.TOKEN_LIMIT_EXCEEDED,
                limit: user.rateLimitTokensPerDay,
                current: dailyTokens,
                resetAt: resetTime.toISOString()
            });
            logger_1.default.warn(`⚠️  Token limit exceeded for user ${user.email}: ${dailyTokens}/${user.rateLimitTokensPerDay} tokens`);
            return;
        }
        // Attach current usage to request for logging
        req.currentUsage = {
            hourlyRequests,
            dailyTokens,
            rateLimitPerHour: user.rateLimitPerHour,
            rateLimitTokensPerDay: user.rateLimitTokensPerDay
        };
        next();
    }
    catch (error) {
        logger_1.default.error('❌ Rate limiting error:', error);
        // Don't block the request on rate limit errors, just log
        next();
    }
}
/**
 * Track request usage
 * This should be called AFTER the request completes
 */
async function trackUsage(userId, endpoint, method, statusCode, tokensUsed = 0, executionTimeMs) {
    try {
        await models_1.UsageStat.create({
            userId,
            endpoint,
            method,
            statusCode,
            tokensUsed,
            executionTimeMs
        });
        logger_1.default.debug(`📊 Usage tracked: ${method} ${endpoint} - ${tokensUsed} tokens`);
    }
    catch (error) {
        logger_1.default.error('❌ Error tracking usage:', error);
        // Don't throw - tracking failures shouldn't break the app
    }
}
/**
 * Middleware to track usage after response
 */
function usageTracker(req, res, next) {
    if (!constants_1.FEATURES.REQUEST_LOGGING || !req.user) {
        next();
        return;
    }
    const startTime = Date.now();
    const originalSend = res.send;
    // Intercept response to track usage
    res.send = function (data) {
        const executionTime = Date.now() - startTime;
        const tokensUsed = res.tokensUsed || 0;
        // Track usage asynchronously
        trackUsage(req.user.id, req.path, req.method, res.statusCode, tokensUsed, executionTime).catch(err => {
            logger_1.default.error('❌ Failed to track usage:', err);
        });
        // Call original send
        return originalSend.call(this, data);
    };
    next();
}
/**
 * Get current usage for a user
 */
async function getCurrentUsage(userId) {
    try {
        const user = await models_1.User.findByPk(userId);
        if (!user) {
            throw new Error('User not found');
        }
        const oneHourAgo = new Date(Date.now() - 3600000);
        const oneDayAgo = new Date(Date.now() - 86400000);
        const hourlyRequests = await models_1.UsageStat.count({
            where: {
                userId,
                timestamp: {
                    [sequelize_1.Op.gte]: oneHourAgo
                }
            }
        });
        const dailyTokens = await models_1.UsageStat.sum('tokensUsed', {
            where: {
                userId,
                timestamp: {
                    [sequelize_1.Op.gte]: oneDayAgo
                }
            }
        }) || 0;
        return {
            hourlyRequests,
            dailyTokens,
            rateLimitPerHour: user.rateLimitPerHour,
            rateLimitTokensPerDay: user.rateLimitTokensPerDay
        };
    }
    catch (error) {
        logger_1.default.error(`❌ Error getting usage for user ${userId}:`, error);
        throw error;
    }
}
exports.default = {
    rateLimit,
    trackUsage,
    usageTracker,
    getCurrentUsage
};
//# sourceMappingURL=rateLimitMiddleware.js.map