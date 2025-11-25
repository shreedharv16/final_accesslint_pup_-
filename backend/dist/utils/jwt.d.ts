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
export declare function generateAccessToken(payload: JWTPayload): string;
/**
 * Generate refresh token
 */
export declare function generateRefreshToken(payload: JWTPayload): string;
/**
 * Generate both access and refresh tokens
 */
export declare function generateTokens(payload: JWTPayload): JWTTokens;
/**
 * Verify JWT token
 */
export declare function verifyToken(token: string): JWTPayload | null;
/**
 * Decode JWT token without verification (useful for debugging)
 */
export declare function decodeToken(token: string): any;
/**
 * Get token expiry date
 */
export declare function getTokenExpiry(token: string): Date | null;
/**
 * Check if token is expired
 */
export declare function isTokenExpired(token: string): boolean;
declare const _default: {
    generateAccessToken: typeof generateAccessToken;
    generateRefreshToken: typeof generateRefreshToken;
    generateTokens: typeof generateTokens;
    verifyToken: typeof verifyToken;
    decodeToken: typeof decodeToken;
    getTokenExpiry: typeof getTokenExpiry;
    isTokenExpired: typeof isTokenExpired;
};
export default _default;
//# sourceMappingURL=jwt.d.ts.map