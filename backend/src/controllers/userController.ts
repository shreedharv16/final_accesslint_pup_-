import { Request, Response } from 'express';
import { getUserById } from '../services/authService';
import { getCurrentUsage } from '../middleware/rateLimitMiddleware';
import { HTTP_STATUS } from '../config/constants';
import { asyncHandler } from '../middleware/errorHandler';

/**
 * Get user profile
 * GET /api/user/profile
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;

    res.status(HTTP_STATUS.OK).json({
        data: { user }
    });
});

/**
 * Get user usage statistics
 * GET /api/user/usage
 */
export const getUsage = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    const usage = await getCurrentUsage(userId);

    res.status(HTTP_STATUS.OK).json({
        data: {
            current: {
                hourlyRequests: usage.hourlyRequests,
                dailyTokens: usage.dailyTokens
            },
            limits: {
                hourlyRequests: usage.rateLimitPerHour,
                dailyTokens: usage.rateLimitTokensPerDay
            },
            percentage: {
                hourlyRequests: Math.round((usage.hourlyRequests / usage.rateLimitPerHour) * 100),
                dailyTokens: Math.round((usage.dailyTokens / usage.rateLimitTokensPerDay) * 100)
            }
        }
    });
});

export default {
    getProfile,
    getUsage
};

