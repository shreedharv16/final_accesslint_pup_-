"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.comparePassword = comparePassword;
exports.validatePasswordStrength = validatePasswordStrength;
exports.generateRandomPassword = generateRandomPassword;
const bcrypt_1 = __importDefault(require("bcrypt"));
const logger_1 = __importDefault(require("./logger"));
const SALT_ROUNDS = 12;
/**
 * Hash a password using bcrypt
 */
async function hashPassword(password) {
    try {
        const hash = await bcrypt_1.default.hash(password, SALT_ROUNDS);
        logger_1.default.debug('✅ Password hashed successfully');
        return hash;
    }
    catch (error) {
        logger_1.default.error('❌ Error hashing password:', error);
        throw new Error('Failed to hash password');
    }
}
/**
 * Compare a plain text password with a hash
 */
async function comparePassword(password, hash) {
    try {
        const isMatch = await bcrypt_1.default.compare(password, hash);
        logger_1.default.debug(`🔐 Password comparison: ${isMatch ? 'match' : 'no match'}`);
        return isMatch;
    }
    catch (error) {
        logger_1.default.error('❌ Error comparing password:', error);
        throw new Error('Failed to compare password');
    }
}
/**
 * Validate password strength
 */
function validatePasswordStrength(password) {
    const errors = [];
    // Minimum length
    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }
    // Maximum length
    if (password.length > 128) {
        errors.push('Password must be less than 128 characters');
    }
    // At least one uppercase letter
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    // At least one lowercase letter
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    // At least one number
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    // At least one special character (optional but recommended)
    // if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    //     errors.push('Password should contain at least one special character');
    // }
    return {
        valid: errors.length === 0,
        errors
    };
}
/**
 * Generate a random password
 */
function generateRandomPassword(length = 16) {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const all = uppercase + lowercase + numbers + special;
    let password = '';
    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
        password += all[Math.floor(Math.random() * all.length)];
    }
    // Shuffle the password
    return password
        .split('')
        .sort(() => Math.random() - 0.5)
        .join('');
}
exports.default = {
    hashPassword,
    comparePassword,
    validatePasswordStrength,
    generateRandomPassword
};
//# sourceMappingURL=password.js.map