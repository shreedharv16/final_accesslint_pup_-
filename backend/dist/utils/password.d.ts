/**
 * Hash a password using bcrypt
 */
export declare function hashPassword(password: string): Promise<string>;
/**
 * Compare a plain text password with a hash
 */
export declare function comparePassword(password: string, hash: string): Promise<boolean>;
/**
 * Validate password strength
 */
export declare function validatePasswordStrength(password: string): {
    valid: boolean;
    errors: string[];
};
/**
 * Generate a random password
 */
export declare function generateRandomPassword(length?: number): string;
declare const _default: {
    hashPassword: typeof hashPassword;
    comparePassword: typeof comparePassword;
    validatePasswordStrength: typeof validatePasswordStrength;
    generateRandomPassword: typeof generateRandomPassword;
};
export default _default;
//# sourceMappingURL=password.d.ts.map