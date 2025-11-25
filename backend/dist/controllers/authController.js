"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.me = exports.refresh = exports.logout = exports.login = exports.register = void 0;
const authService_1 = require("../services/authService");
const constants_1 = require("../config/constants");
const errorHandler_1 = require("../middleware/errorHandler");
/**
 * Register new user
 * POST /api/auth/register
 */
exports.register = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(constants_1.HTTP_STATUS.BAD_REQUEST).json({
            error: 'Email and password are required'
        });
        return;
    }
    const result = await (0, authService_1.registerUser)({ email, password });
    res.status(constants_1.HTTP_STATUS.CREATED).json({
        message: constants_1.SUCCESS_MESSAGES.USER_CREATED,
        data: result
    });
});
/**
 * Login user
 * POST /api/auth/login
 */
exports.login = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(constants_1.HTTP_STATUS.BAD_REQUEST).json({
            error: 'Email and password are required'
        });
        return;
    }
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');
    const result = await (0, authService_1.loginUser)({
        email,
        password,
        ipAddress,
        userAgent
    });
    res.status(constants_1.HTTP_STATUS.OK).json({
        message: constants_1.SUCCESS_MESSAGES.LOGIN_SUCCESS,
        data: result
    });
});
/**
 * Logout user
 * POST /api/auth/logout
 */
exports.logout = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        await (0, authService_1.logoutUser)(token);
    }
    res.status(constants_1.HTTP_STATUS.OK).json({
        message: constants_1.SUCCESS_MESSAGES.LOGOUT_SUCCESS
    });
});
/**
 * Refresh access token
 * POST /api/auth/refresh
 */
exports.refresh = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        res.status(constants_1.HTTP_STATUS.BAD_REQUEST).json({
            error: 'Refresh token is required'
        });
        return;
    }
    const result = await (0, authService_1.refreshAccessToken)(refreshToken);
    res.status(constants_1.HTTP_STATUS.OK).json({
        message: constants_1.SUCCESS_MESSAGES.TOKEN_REFRESHED,
        data: result
    });
});
/**
 * Get current user
 * GET /api/auth/me
 */
exports.me = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user) {
        res.status(constants_1.HTTP_STATUS.UNAUTHORIZED).json({
            error: 'Not authenticated'
        });
        return;
    }
    res.status(constants_1.HTTP_STATUS.OK).json({
        data: {
            user: req.user
        }
    });
});
exports.default = {
    register: exports.register,
    login: exports.login,
    logout: exports.logout,
    refresh: exports.refresh,
    me: exports.me
};
//# sourceMappingURL=authController.js.map