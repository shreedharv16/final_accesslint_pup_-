import { User, Session } from '../models';
import { hashPassword, comparePassword, validatePasswordStrength } from '../utils/password';
import { generateTokens, verifyToken, JWTPayload } from '../utils/jwt';
import { ERROR_MESSAGES } from '../config/constants';
import logger from '../utils/logger';

export interface RegisterData {
    email: string;
    password: string;
}

export interface LoginData {
    email: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
}

export interface AuthResponse {
    user: {
        id: string;
        email: string;
        createdAt: Date;
        lastLogin: Date | null;
        isActive: boolean;
    };
    accessToken: string;
    refreshToken: string;
}

/**
 * Register a new user
 */
export async function registerUser(data: RegisterData): Promise<AuthResponse> {
    try {
        const { email, password } = data;

        // Validate email format
        const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }

        // Validate password strength
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.valid) {
            throw new Error(passwordValidation.errors.join('; '));
        }

        // Check if user already exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            throw new Error(ERROR_MESSAGES.EMAIL_EXISTS);
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create user
        const user = await User.create({
            email,
            passwordHash,
            isActive: true,
            rateLimitPerHour: 100,
            rateLimitTokensPerDay: 100000
        });

        // Generate tokens
        const payload: JWTPayload = {
            userId: user.id,
            email: user.email
        };
        const tokens = generateTokens(payload);

        // Create session
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + 3600); // 1 hour

        await Session.create({
            userId: user.id,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt
        });

        logger.info(`✅ User registered: ${email}`);

        return {
            user: {
                id: user.id,
                email: user.email,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin || null,
                isActive: user.isActive
            },
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
        };
    } catch (error) {
        logger.error('❌ Error registering user:', error);
        throw error;
    }
}

/**
 * Login user
 */
export async function loginUser(data: LoginData): Promise<AuthResponse> {
    try {
        const { email, password, ipAddress, userAgent } = data;

        // Find user by email
        const user = await User.findOne({ where: { email } });
        if (!user) {
            throw new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
        }

        // Check if user is active
        if (!user.isActive) {
            throw new Error(ERROR_MESSAGES.USER_INACTIVE);
        }

        // Compare password
        const isPasswordValid = await comparePassword(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate tokens
        const payload: JWTPayload = {
            userId: user.id,
            email: user.email
        };
        const tokens = generateTokens(payload);

        // Create session
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + 3600); // 1 hour

        await Session.create({
            userId: user.id,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt,
            ipAddress,
            userAgent
        });

        logger.info(`✅ User logged in: ${email}`);

        return {
            user: {
                id: user.id,
                email: user.email,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin,
                isActive: user.isActive
            },
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
        };
    } catch (error) {
        logger.error('❌ Error logging in user:', error);
        throw error;
    }
}

/**
 * Logout user (invalidate session)
 */
export async function logoutUser(accessToken: string): Promise<void> {
    try {
        // Delete session
        await Session.destroy({ where: { accessToken } });
        logger.info('✅ User logged out successfully');
    } catch (error) {
        logger.error('❌ Error logging out user:', error);
        throw error;
    }
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
        // Verify refresh token
        const payload = verifyToken(refreshToken);
        if (!payload) {
            throw new Error(ERROR_MESSAGES.TOKEN_INVALID);
        }

        // Find session
        const session = await Session.findOne({ where: { refreshToken } });
        if (!session) {
            throw new Error(ERROR_MESSAGES.TOKEN_INVALID);
        }

        // Check if session expired
        if (session.expiresAt < new Date()) {
            await session.destroy();
            throw new Error(ERROR_MESSAGES.TOKEN_EXPIRED);
        }

        // Find user
        const user = await User.findByPk(payload.userId);
        if (!user || !user.isActive) {
            throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        // Generate new access token
        const newPayload: JWTPayload = {
            userId: user.id,
            email: user.email
        };
        const tokens = generateTokens(newPayload);

        // Update session
        session.accessToken = tokens.accessToken;
        session.expiresAt = new Date(Date.now() + 3600000); // 1 hour
        await session.save();

        logger.info(`✅ Access token refreshed for user: ${user.email}`);

        return {
            accessToken: tokens.accessToken
        };
    } catch (error) {
        logger.error('❌ Error refreshing access token:', error);
        throw error;
    }
}

/**
 * Verify access token and get user
 */
export async function verifyAccessToken(accessToken: string): Promise<User | null> {
    try {
        // Verify token
        const payload = verifyToken(accessToken);
        if (!payload) {
            return null;
        }

        // Find session
        const session = await Session.findOne({ where: { accessToken } });
        if (!session) {
            return null;
        }

        // Check if session expired
        if (session.expiresAt < new Date()) {
            await session.destroy();
            return null;
        }

        // Find user
        const user = await User.findByPk(payload.userId);
        if (!user || !user.isActive) {
            return null;
        }

        return user;
    } catch (error) {
        logger.error('❌ Error verifying access token:', error);
        return null;
    }
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
    try {
        const user = await User.findByPk(userId);
        return user;
    } catch (error) {
        logger.error(`❌ Error getting user ${userId}:`, error);
        return null;
    }
}

/**
 * Update user rate limits
 */
export async function updateUserRateLimits(
    userId: string,
    rateLimitPerHour: number,
    rateLimitTokensPerDay: number
): Promise<void> {
    try {
        const user = await User.findByPk(userId);
        if (!user) {
            throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        user.rateLimitPerHour = rateLimitPerHour;
        user.rateLimitTokensPerDay = rateLimitTokensPerDay;
        await user.save();

        logger.info(`✅ Updated rate limits for user: ${user.email}`);
    } catch (error) {
        logger.error(`❌ Error updating rate limits for user ${userId}:`, error);
        throw error;
    }
}

/**
 * Deactivate user
 */
export async function deactivateUser(userId: string): Promise<void> {
    try {
        const user = await User.findByPk(userId);
        if (!user) {
            throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        user.isActive = false;
        await user.save();

        // Destroy all user sessions
        await Session.destroy({ where: { userId } });

        logger.info(`✅ User deactivated: ${user.email}`);
    } catch (error) {
        logger.error(`❌ Error deactivating user ${userId}:`, error);
        throw error;
    }
}

/**
 * Cleanup expired sessions
 */
export async function cleanupExpiredSessions(): Promise<void> {
    try {
        const result = await Session.destroy({
            where: {
                expiresAt: {
                    [require('sequelize').Op.lt]: new Date()
                }
            }
        });

        logger.info(`✅ Cleaned up ${result} expired sessions`);
    } catch (error) {
        logger.error('❌ Error cleaning up expired sessions:', error);
    }
}

export default {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    verifyAccessToken,
    getUserById,
    updateUserRateLimits,
    deactivateUser,
    cleanupExpiredSessions
};

