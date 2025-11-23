import { Request, Response, NextFunction } from 'express';
import { UsageStat, User } from '../models';
import { ERROR_MESSAGES, HTTP_STATUS, FEATURES } from '../config/constants';
import logger from '../utils/logger';
import { Op } from 'sequelize';

/**
 * Rate limiting middleware
 * Checks both hourly request limits and daily token limits
 */
export async function rateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Skip if rate limiting is disabled
    if (!FEATURES.RATE_LIMITING) {
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
        const user = await User.findByPk(userId);

        if (!user) {
            res.status(HTTP_STATUS.UNAUTHORIZED).json({
                error: ERROR_MESSAGES.USER_NOT_FOUND
            });
            return;
        }

        // Check hourly request limit
        const oneHourAgo = new Date(Date.now() - 3600000);
        const hourlyRequests = await UsageStat.count({
            where: {
                userId,
                timestamp: {
                    [Op.gte]: oneHourAgo
                }
            }
        });

        if (hourlyRequests >= user.rateLimitPerHour) {
            const resetTime = new Date(Date.now() + 3600000);
            res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
                error: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
                limit: user.rateLimitPerHour,
                current: hourlyRequests,
                resetAt: resetTime.toISOString()
            });
            logger.warn(`⚠️  Rate limit exceeded for user ${user.email}: ${hourlyRequests}/${user.rateLimitPerHour} requests`);
            return;
        }

        // Check daily token limit
        const oneDayAgo = new Date(Date.now() - 86400000);
        const dailyTokens = await UsageStat.sum('tokensUsed', {
            where: {
                userId,
                timestamp: {
                    [Op.gte]: oneDayAgo
                }
            }
        }) || 0;

        if (dailyTokens >= user.rateLimitTokensPerDay) {
            const resetTime = new Date(Date.now() + 86400000);
            res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
                error: ERROR_MESSAGES.TOKEN_LIMIT_EXCEEDED,
                limit: user.rateLimitTokensPerDay,
                current: dailyTokens,
                resetAt: resetTime.toISOString()
            });
            logger.warn(`⚠️  Token limit exceeded for user ${user.email}: ${dailyTokens}/${user.rateLimitTokensPerDay} tokens`);
            return;
        }

        // Attach current usage to request for logging
        (req as any).currentUsage = {
            hourlyRequests,
            dailyTokens,
            rateLimitPerHour: user.rateLimitPerHour,
            rateLimitTokensPerDay: user.rateLimitTokensPerDay
        };

        next();
    } catch (error) {
        logger.error('❌ Rate limiting error:', error);
        // Don't block the request on rate limit errors, just log
        next();
    }
}

/**
 * Track request usage
 * This should be called AFTER the request completes
 */
export async function trackUsage(
    userId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    tokensUsed: number = 0,
    executionTimeMs?: number
): Promise<void> {
    try {
        await UsageStat.create({
            userId,
            endpoint,
            method,
            statusCode,
            tokensUsed,
            executionTimeMs
        });

        logger.debug(`📊 Usage tracked: ${method} ${endpoint} - ${tokensUsed} tokens`);
    } catch (error) {
        logger.error('❌ Error tracking usage:', error);
        // Don't throw - tracking failures shouldn't break the app
    }
}

/**
 * Middleware to track usage after response
 */
export function usageTracker(req: Request, res: Response, next: NextFunction): void {
    if (!FEATURES.REQUEST_LOGGING || !req.user) {
        next();
        return;
    }

    const startTime = Date.now();
    const originalSend = res.send;

    // Intercept response to track usage
    res.send = function (data: any): Response {
        const executionTime = Date.now() - startTime;
        const tokensUsed = (res as any).tokensUsed || 0;

        // Track usage asynchronously
        trackUsage(
            req.user!.id,
            req.path,
            req.method,
            res.statusCode,
            tokensUsed,
            executionTime
        ).catch(err => {
            logger.error('❌ Failed to track usage:', err);
        });

        // Call original send
        return originalSend.call(this, data);
    };

    next();
}

/**
 * Get current usage for a user
 */
export async function getCurrentUsage(userId: string): Promise<{
    hourlyRequests: number;
    dailyTokens: number;
    rateLimitPerHour: number;
    rateLimitTokensPerDay: number;
}> {
    try {
        const user = await User.findByPk(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const oneHourAgo = new Date(Date.now() - 3600000);
        const oneDayAgo = new Date(Date.now() - 86400000);

        const hourlyRequests = await UsageStat.count({
            where: {
                userId,
                timestamp: {
                    [Op.gte]: oneHourAgo
                }
            }
        });

        const dailyTokens = await UsageStat.sum('tokensUsed', {
            where: {
                userId,
                timestamp: {
                    [Op.gte]: oneDayAgo
                }
            }
        }) || 0;

        return {
            hourlyRequests,
            dailyTokens,
            rateLimitPerHour: user.rateLimitPerHour,
            rateLimitTokensPerDay: user.rateLimitTokensPerDay
        };
    } catch (error) {
        logger.error(`❌ Error getting usage for user ${userId}:`, error);
        throw error;
    }
}

export default {
    rateLimit,
    trackUsage,
    usageTracker,
    getCurrentUsage
};

