import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/authService';
import { User } from '../models';
import { ERROR_MESSAGES, HTTP_STATUS } from '../config/constants';
import logger from '../utils/logger';

// Extend Express Request to include user
declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}

/**
 * Middleware to verify JWT token and attach user to request
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(HTTP_STATUS.UNAUTHORIZED).json({
                error: ERROR_MESSAGES.UNAUTHORIZED,
                message: 'No token provided'
            });
            return;
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify token and get user
        const user = await verifyAccessToken(token);
        if (!user) {
            res.status(HTTP_STATUS.UNAUTHORIZED).json({
                error: ERROR_MESSAGES.TOKEN_INVALID,
                message: 'Invalid or expired token'
            });
            return;
        }

        // Attach user to request
        req.user = user;

        next();
    } catch (error) {
        logger.error('❌ Authentication error:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
            error: ERROR_MESSAGES.INTERNAL_ERROR,
            message: 'Authentication failed'
        });
    }
}

/**
 * Optional authentication - doesn't fail if no token, but attaches user if present
 */
export async function optionalAuthenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const user = await verifyAccessToken(token);
            if (user) {
                req.user = user;
            }
        }
        next();
    } catch (error) {
        logger.error('❌ Optional authentication error:', error);
        next();
    }
}

/**
 * Middleware to check if user is active
 */
export function requireActive(req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
            error: ERROR_MESSAGES.UNAUTHORIZED,
            message: 'User not authenticated'
        });
        return;
    }

    if (!req.user.isActive) {
        res.status(HTTP_STATUS.FORBIDDEN).json({
            error: ERROR_MESSAGES.USER_INACTIVE,
            message: 'User account is inactive'
        });
        return;
    }

    next();
}

export default {
    authenticate,
    optionalAuthenticate,
    requireActive
};

