import jwt from 'jsonwebtoken';
import { JWT } from '../config/constants';
import logger from './logger';

export interface JWTPayload {
    userId: string;
    email: string;
}

export interface JWTTokens {
    accessToken: string;
    refreshToken: string;
}

/**
 * Generate access token
 */
export function generateAccessToken(payload: JWTPayload): string {
    try {
        const token = jwt.sign(payload, JWT.SECRET, {
            expiresIn: JWT.EXPIRY,
            algorithm: JWT.ALGORITHM
        });

        logger.debug(`✅ Access token generated for user: ${payload.email}`);
        return token;
    } catch (error) {
        logger.error('❌ Error generating access token:', error);
        throw new Error('Failed to generate access token');
    }
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(payload: JWTPayload): string {
    try {
        const token = jwt.sign(payload, JWT.SECRET, {
            expiresIn: JWT.REFRESH_EXPIRY,
            algorithm: JWT.ALGORITHM
        });

        logger.debug(`✅ Refresh token generated for user: ${payload.email}`);
        return token;
    } catch (error) {
        logger.error('❌ Error generating refresh token:', error);
        throw new Error('Failed to generate refresh token');
    }
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokens(payload: JWTPayload): JWTTokens {
    return {
        accessToken: generateAccessToken(payload),
        refreshToken: generateRefreshToken(payload)
    };
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
    try {
        const decoded = jwt.verify(token, JWT.SECRET, {
            algorithms: [JWT.ALGORITHM]
        }) as JWTPayload;

        return decoded;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            logger.warn('⚠️  JWT token expired');
        } else if (error instanceof jwt.JsonWebTokenError) {
            logger.warn('⚠️  Invalid JWT token');
        } else {
            logger.error('❌ Error verifying JWT token:', error);
        }
        return null;
    }
}

/**
 * Decode JWT token without verification (useful for debugging)
 */
export function decodeToken(token: string): any {
    try {
        return jwt.decode(token);
    } catch (error) {
        logger.error('❌ Error decoding token:', error);
        return null;
    }
}

/**
 * Get token expiry date
 */
export function getTokenExpiry(token: string): Date | null {
    try {
        const decoded = jwt.decode(token) as any;
        if (decoded && decoded.exp) {
            return new Date(decoded.exp * 1000);
        }
        return null;
    } catch (error) {
        logger.error('❌ Error getting token expiry:', error);
        return null;
    }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
    const expiry = getTokenExpiry(token);
    if (!expiry) {
        return true;
    }
    return expiry < new Date();
}

export default {
    generateAccessToken,
    generateRefreshToken,
    generateTokens,
    verifyToken,
    decodeToken,
    getTokenExpiry,
    isTokenExpired
};

