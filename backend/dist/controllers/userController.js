"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsage = exports.getProfile = void 0;
const rateLimitMiddleware_1 = require("../middleware/rateLimitMiddleware");
const constants_1 = require("../config/constants");
const errorHandler_1 = require("../middleware/errorHandler");
/**
 * Get user profile
 * GET /api/user/profile
 */
exports.getProfile = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    res.status(constants_1.HTTP_STATUS.OK).json({
        data: { user }
    });
});
/**
 * Get user usage statistics
 * GET /api/user/usage
 */
exports.getUsage = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.user.id;
    const usage = await (0, rateLimitMiddleware_1.getCurrentUsage)(userId);
    res.status(constants_1.HTTP_STATUS.OK).json({
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
exports.default = {
    getProfile: exports.getProfile,
    getUsage: exports.getUsage
};
//# sourceMappingURL=userController.js.map