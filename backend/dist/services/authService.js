"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUser = registerUser;
exports.loginUser = loginUser;
exports.logoutUser = logoutUser;
exports.refreshAccessToken = refreshAccessToken;
exports.verifyAccessToken = verifyAccessToken;
exports.getUserById = getUserById;
exports.updateUserRateLimits = updateUserRateLimits;
exports.deactivateUser = deactivateUser;
exports.cleanupExpiredSessions = cleanupExpiredSessions;
const models_1 = require("../models");
const password_1 = require("../utils/password");
const jwt_1 = require("../utils/jwt");
const constants_1 = require("../config/constants");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Register a new user
 */
async function registerUser(data) {
    try {
        const { email, password } = data;
        // Validate email format
        const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }
        // Validate password strength
        const passwordValidation = (0, password_1.validatePasswordStrength)(password);
        if (!passwordValidation.valid) {
            throw new Error(passwordValidation.errors.join('; '));
        }
        // Check if user already exists
        const existingUser = await models_1.User.findOne({ where: { email } });
        if (existingUser) {
            throw new Error(constants_1.ERROR_MESSAGES.EMAIL_EXISTS);
        }
        // Hash password
        const passwordHash = await (0, password_1.hashPassword)(password);
        // Create user
        const user = await models_1.User.create({
            email,
            passwordHash,
            isActive: true,
            rateLimitPerHour: 100,
            rateLimitTokensPerDay: 100000
        });
        // Generate tokens
        const payload = {
            userId: user.id,
            email: user.email
        };
        const tokens = (0, jwt_1.generateTokens)(payload);
        // Create session
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + 3600); // 1 hour
        await models_1.Session.create({
            userId: user.id,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt
        });
        logger_1.default.info(`✅ User registered: ${email}`);
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
    }
    catch (error) {
        logger_1.default.error('❌ Error registering user:', error);
        throw error;
    }
}
/**
 * Login user
 */
async function loginUser(data) {
    try {
        const { email, password, ipAddress, userAgent } = data;
        // Find user by email
        const user = await models_1.User.findOne({ where: { email } });
        if (!user) {
            throw new Error(constants_1.ERROR_MESSAGES.INVALID_CREDENTIALS);
        }
        // Check if user is active
        if (!user.isActive) {
            throw new Error(constants_1.ERROR_MESSAGES.USER_INACTIVE);
        }
        // Compare password
        const isPasswordValid = await (0, password_1.comparePassword)(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new Error(constants_1.ERROR_MESSAGES.INVALID_CREDENTIALS);
        }
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        // Generate tokens
        const payload = {
            userId: user.id,
            email: user.email
        };
        const tokens = (0, jwt_1.generateTokens)(payload);
        // Create session
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + 3600); // 1 hour
        await models_1.Session.create({
            userId: user.id,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt,
            ipAddress,
            userAgent
        });
        logger_1.default.info(`✅ User logged in: ${email}`);
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
    }
    catch (error) {
        logger_1.default.error('❌ Error logging in user:', error);
        throw error;
    }
}
/**
 * Logout user (invalidate session)
 */
async function logoutUser(accessToken) {
    try {
        // Delete session
        await models_1.Session.destroy({ where: { accessToken } });
        logger_1.default.info('✅ User logged out successfully');
    }
    catch (error) {
        logger_1.default.error('❌ Error logging out user:', error);
        throw error;
    }
}
/**
 * Refresh access token
 */
async function refreshAccessToken(refreshToken) {
    try {
        // Verify refresh token
        const payload = (0, jwt_1.verifyToken)(refreshToken);
        if (!payload) {
            throw new Error(constants_1.ERROR_MESSAGES.TOKEN_INVALID);
        }
        // Find session
        const session = await models_1.Session.findOne({ where: { refreshToken } });
        if (!session) {
            throw new Error(constants_1.ERROR_MESSAGES.TOKEN_INVALID);
        }
        // Check if session expired
        if (session.expiresAt < new Date()) {
            await session.destroy();
            throw new Error(constants_1.ERROR_MESSAGES.TOKEN_EXPIRED);
        }
        // Find user
        const user = await models_1.User.findByPk(payload.userId);
        if (!user || !user.isActive) {
            throw new Error(constants_1.ERROR_MESSAGES.USER_NOT_FOUND);
        }
        // Generate new access token
        const newPayload = {
            userId: user.id,
            email: user.email
        };
        const tokens = (0, jwt_1.generateTokens)(newPayload);
        // Update session
        session.accessToken = tokens.accessToken;
        session.expiresAt = new Date(Date.now() + 3600000); // 1 hour
        await session.save();
        logger_1.default.info(`✅ Access token refreshed for user: ${user.email}`);
        return {
            accessToken: tokens.accessToken
        };
    }
    catch (error) {
        logger_1.default.error('❌ Error refreshing access token:', error);
        throw error;
    }
}
/**
 * Verify access token and get user
 */
async function verifyAccessToken(accessToken) {
    try {
        // Verify token
        const payload = (0, jwt_1.verifyToken)(accessToken);
        if (!payload) {
            return null;
        }
        // Find session
        const session = await models_1.Session.findOne({ where: { accessToken } });
        if (!session) {
            return null;
        }
        // Check if session expired
        if (session.expiresAt < new Date()) {
            await session.destroy();
            return null;
        }
        // Find user
        const user = await models_1.User.findByPk(payload.userId);
        if (!user || !user.isActive) {
            return null;
        }
        return user;
    }
    catch (error) {
        logger_1.default.error('❌ Error verifying access token:', error);
        return null;
    }
}
/**
 * Get user by ID
 */
async function getUserById(userId) {
    try {
        const user = await models_1.User.findByPk(userId);
        return user;
    }
    catch (error) {
        logger_1.default.error(`❌ Error getting user ${userId}:`, error);
        return null;
    }
}
/**
 * Update user rate limits
 */
async function updateUserRateLimits(userId, rateLimitPerHour, rateLimitTokensPerDay) {
    try {
        const user = await models_1.User.findByPk(userId);
        if (!user) {
            throw new Error(constants_1.ERROR_MESSAGES.USER_NOT_FOUND);
        }
        user.rateLimitPerHour = rateLimitPerHour;
        user.rateLimitTokensPerDay = rateLimitTokensPerDay;
        await user.save();
        logger_1.default.info(`✅ Updated rate limits for user: ${user.email}`);
    }
    catch (error) {
        logger_1.default.error(`❌ Error updating rate limits for user ${userId}:`, error);
        throw error;
    }
}
/**
 * Deactivate user
 */
async function deactivateUser(userId) {
    try {
        const user = await models_1.User.findByPk(userId);
        if (!user) {
            throw new Error(constants_1.ERROR_MESSAGES.USER_NOT_FOUND);
        }
        user.isActive = false;
        await user.save();
        // Destroy all user sessions
        await models_1.Session.destroy({ where: { userId } });
        logger_1.default.info(`✅ User deactivated: ${user.email}`);
    }
    catch (error) {
        logger_1.default.error(`❌ Error deactivating user ${userId}:`, error);
        throw error;
    }
}
/**
 * Cleanup expired sessions
 */
async function cleanupExpiredSessions() {
    try {
        const result = await models_1.Session.destroy({
            where: {
                expiresAt: {
                    [require('sequelize').Op.lt]: new Date()
                }
            }
        });
        logger_1.default.info(`✅ Cleaned up ${result} expired sessions`);
    }
    catch (error) {
        logger_1.default.error('❌ Error cleaning up expired sessions:', error);
    }
}
exports.default = {
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
//# sourceMappingURL=authService.js.map