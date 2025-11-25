import { User } from '../models';
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
export declare function registerUser(data: RegisterData): Promise<AuthResponse>;
/**
 * Login user
 */
export declare function loginUser(data: LoginData): Promise<AuthResponse>;
/**
 * Logout user (invalidate session)
 */
export declare function logoutUser(accessToken: string): Promise<void>;
/**
 * Refresh access token
 */
export declare function refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
}>;
/**
 * Verify access token and get user
 */
export declare function verifyAccessToken(accessToken: string): Promise<User | null>;
/**
 * Get user by ID
 */
export declare function getUserById(userId: string): Promise<User | null>;
/**
 * Update user rate limits
 */
export declare function updateUserRateLimits(userId: string, rateLimitPerHour: number, rateLimitTokensPerDay: number): Promise<void>;
/**
 * Deactivate user
 */
export declare function deactivateUser(userId: string): Promise<void>;
/**
 * Cleanup expired sessions
 */
export declare function cleanupExpiredSessions(): Promise<void>;
declare const _default: {
    registerUser: typeof registerUser;
    loginUser: typeof loginUser;
    logoutUser: typeof logoutUser;
    refreshAccessToken: typeof refreshAccessToken;
    verifyAccessToken: typeof verifyAccessToken;
    getUserById: typeof getUserById;
    updateUserRateLimits: typeof updateUserRateLimits;
    deactivateUser: typeof deactivateUser;
    cleanupExpiredSessions: typeof cleanupExpiredSessions;
};
export default _default;
//# sourceMappingURL=authService.d.ts.map