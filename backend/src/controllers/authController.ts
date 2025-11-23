import { Request, Response } from 'express';
import {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
} from '../services/authService';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../config/constants';
import { asyncHandler } from '../middleware/errorHandler';

/**
 * Register new user
 * POST /api/auth/register
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
            error: 'Email and password are required'
        });
        return;
    }

    const result = await registerUser({ email, password });

    res.status(HTTP_STATUS.CREATED).json({
        message: SUCCESS_MESSAGES.USER_CREATED,
        data: result
    });
});

/**
 * Login user
 * POST /api/auth/login
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
            error: 'Email and password are required'
        });
        return;
    }

    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');

    const result = await loginUser({
        email,
        password,
        ipAddress,
        userAgent
    });

    res.status(HTTP_STATUS.OK).json({
        message: SUCCESS_MESSAGES.LOGIN_SUCCESS,
        data: result
    });
});

/**
 * Logout user
 * POST /api/auth/logout
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        await logoutUser(token);
    }

    res.status(HTTP_STATUS.OK).json({
        message: SUCCESS_MESSAGES.LOGOUT_SUCCESS
    });
});

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
            error: 'Refresh token is required'
        });
        return;
    }

    const result = await refreshAccessToken(refreshToken);

    res.status(HTTP_STATUS.OK).json({
        message: SUCCESS_MESSAGES.TOKEN_REFRESHED,
        data: result
    });
});

/**
 * Get current user
 * GET /api/auth/me
 */
export const me = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
            error: 'Not authenticated'
        });
        return;
    }

    res.status(HTTP_STATUS.OK).json({
        data: {
            user: req.user
        }
    });
});

export default {
    register,
    login,
    logout,
    refresh,
    me
};

