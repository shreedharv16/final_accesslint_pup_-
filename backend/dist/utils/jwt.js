"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAccessToken = generateAccessToken;
exports.generateRefreshToken = generateRefreshToken;
exports.generateTokens = generateTokens;
exports.verifyToken = verifyToken;
exports.decodeToken = decodeToken;
exports.getTokenExpiry = getTokenExpiry;
exports.isTokenExpired = isTokenExpired;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const constants_1 = require("../config/constants");
const logger_1 = __importDefault(require("./logger"));
/**
 * Generate access token
 */
function generateAccessToken(payload) {
    try {
        const token = jsonwebtoken_1.default.sign(payload, constants_1.JWT.SECRET, {
            expiresIn: constants_1.JWT.EXPIRY,
            algorithm: constants_1.JWT.ALGORITHM
        });
        logger_1.default.debug(`✅ Access token generated for user: ${payload.email}`);
        return token;
    }
    catch (error) {
        logger_1.default.error('❌ Error generating access token:', error);
        throw new Error('Failed to generate access token');
    }
}
/**
 * Generate refresh token
 */
function generateRefreshToken(payload) {
    try {
        const token = jsonwebtoken_1.default.sign(payload, constants_1.JWT.SECRET, {
            expiresIn: constants_1.JWT.REFRESH_EXPIRY,
            algorithm: constants_1.JWT.ALGORITHM
        });
        logger_1.default.debug(`✅ Refresh token generated for user: ${payload.email}`);
        return token;
    }
    catch (error) {
        logger_1.default.error('❌ Error generating refresh token:', error);
        throw new Error('Failed to generate refresh token');
    }
}
/**
 * Generate both access and refresh tokens
 */
function generateTokens(payload) {
    return {
        accessToken: generateAccessToken(payload),
        refreshToken: generateRefreshToken(payload)
    };
}
/**
 * Verify JWT token
 */
function verifyToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, constants_1.JWT.SECRET, {
            algorithms: [constants_1.JWT.ALGORITHM]
        });
        return decoded;
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            logger_1.default.warn('⚠️  JWT token expired');
        }
        else if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            logger_1.default.warn('⚠️  Invalid JWT token');
        }
        else {
            logger_1.default.error('❌ Error verifying JWT token:', error);
        }
        return null;
    }
}
/**
 * Decode JWT token without verification (useful for debugging)
 */
function decodeToken(token) {
    try {
        return jsonwebtoken_1.default.decode(token);
    }
    catch (error) {
        logger_1.default.error('❌ Error decoding token:', error);
        return null;
    }
}
/**
 * Get token expiry date
 */
function getTokenExpiry(token) {
    try {
        const decoded = jsonwebtoken_1.default.decode(token);
        if (decoded && decoded.exp) {
            return new Date(decoded.exp * 1000);
        }
        return null;
    }
    catch (error) {
        logger_1.default.error('❌ Error getting token expiry:', error);
        return null;
    }
}
/**
 * Check if token is expired
 */
function isTokenExpired(token) {
    const expiry = getTokenExpiry(token);
    if (!expiry) {
        return true;
    }
    return expiry < new Date();
}
exports.default = {
    generateAccessToken,
    generateRefreshToken,
    generateTokens,
    verifyToken,
    decodeToken,
    getTokenExpiry,
    isTokenExpired
};
//# sourceMappingURL=jwt.js.map