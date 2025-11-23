/**
 * Application constants
 */

// API Configuration
export const API = {
    PREFIX: process.env.API_PREFIX || '/api',
    VERSION: 'v1',
    PORT: parseInt(process.env.PORT || '3000', 10)
};

// JWT Configuration
export const JWT = {
    SECRET: process.env.JWT_SECRET || 'your-secret-key-change-this',
    EXPIRY: parseInt(process.env.JWT_EXPIRY || '3600', 10), // 1 hour
    REFRESH_EXPIRY: parseInt(process.env.JWT_REFRESH_EXPIRY || '2592000', 10), // 30 days
    ALGORITHM: 'HS256' as const
};

// Rate Limiting
export const RATE_LIMIT = {
    DEFAULT_PER_HOUR: parseInt(process.env.RATE_LIMIT_DEFAULT_PER_HOUR || '100', 10),
    DEFAULT_TOKENS_PER_DAY: parseInt(process.env.RATE_LIMIT_DEFAULT_TOKENS_PER_DAY || '100000', 10),
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000', 10) // 1 hour
};

// OpenAI Configuration
export const OPENAI = {
    MAX_TOKENS: 4000,
    TEMPERATURE: 0.7,
    MAX_CONTEXT_MESSAGES: 6, // Last 3 conversation pairs
    TOKEN_ESTIMATION_RATIO: 4 // 1 token ≈ 4 characters
};

// Database Configuration
export const DATABASE = {
    POOL_MAX: 20,
    POOL_MIN: 5,
    POOL_ACQUIRE: 30000,
    POOL_IDLE: 10000
};

// Blob Storage Configuration
export const BLOB_STORAGE = {
    SAS_EXPIRY_MINUTES: 60,
    MAX_FILE_SIZE: 200 * 1024 * 1024 // 200 MB
};

// Session Configuration
export const SESSION = {
    MAX_CONCURRENT: 5,
    CLEANUP_INTERVAL_MS: 3600000 // 1 hour
};

// Agent Configuration
export const AGENT = {
    MAX_ITERATIONS: 15,
    TIMEOUT_MS: 120000, // 2 minutes
    MAX_FILE_CONTEXT: 10
};

// Testing Configuration
export const TESTING = {
    MAX_ISSUES_PER_SESSION: 100,
    NVDA_TIMEOUT_MS: 30000,
    BROWSER_TIMEOUT_MS: 60000
};

// CORS Configuration
export const CORS = {
    ORIGIN: (process.env.CORS_ORIGIN || 'http://localhost:3001').split(','),
    CREDENTIALS: process.env.CORS_CREDENTIALS === 'true'
};

// Feature Flags
export const FEATURES = {
    AI_VALIDATION: process.env.ENABLE_AI_VALIDATION === 'true',
    RATE_LIMITING: process.env.ENABLE_RATE_LIMITING !== 'false', // Enabled by default
    REQUEST_LOGGING: process.env.ENABLE_REQUEST_LOGGING !== 'false' // Enabled by default
};

// HTTP Status Codes
export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
};

// Error Messages
export const ERROR_MESSAGES = {
    // Authentication
    INVALID_CREDENTIALS: 'Invalid email or password',
    UNAUTHORIZED: 'Unauthorized access',
    TOKEN_EXPIRED: 'Token has expired',
    TOKEN_INVALID: 'Invalid token',
    USER_NOT_FOUND: 'User not found',
    USER_INACTIVE: 'User account is inactive',
    EMAIL_EXISTS: 'Email already registered',

    // Rate Limiting
    RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
    TOKEN_LIMIT_EXCEEDED: 'Daily token limit exceeded',

    // General
    INTERNAL_ERROR: 'Internal server error',
    BAD_REQUEST: 'Bad request',
    NOT_FOUND: 'Resource not found',
    VALIDATION_ERROR: 'Validation error',

    // AI
    AI_SERVICE_ERROR: 'AI service unavailable',
    AI_TIMEOUT: 'AI request timed out',

    // Storage
    BLOB_NOT_FOUND: 'File not found',
    BLOB_UPLOAD_FAILED: 'File upload failed',

    // Database
    DB_CONNECTION_ERROR: 'Database connection error',
    DB_QUERY_ERROR: 'Database query error'
};

// Success Messages
export const SUCCESS_MESSAGES = {
    USER_CREATED: 'User created successfully',
    LOGIN_SUCCESS: 'Login successful',
    LOGOUT_SUCCESS: 'Logout successful',
    TOKEN_REFRESHED: 'Token refreshed successfully',
    FILE_UPLOADED: 'File uploaded successfully',
    FILE_DOWNLOADED: 'File downloaded successfully',
    AGENT_STARTED: 'Agent session started',
    AGENT_COMPLETED: 'Agent session completed',
    TEST_COMPLETED: 'Accessibility test completed'
};

// Log Levels
export const LOG_LEVELS = {
    ERROR: 'ERROR',
    WARN: 'WARN',
    INFO: 'INFO',
    DEBUG: 'DEBUG'
} as const;

// Session Types
export const SESSION_TYPES = {
    CHAT_AGENT: 'chat_agent',
    TESTING_AGENT: 'testing_agent'
} as const;

// Conversation Types
export const CONVERSATION_TYPES = {
    QUICK_MODE: 'quick_mode',
    AGENT_MODE: 'agent_mode'
} as const;

// Agent Status
export const AGENT_STATUS = {
    ACTIVE: 'active',
    COMPLETED: 'completed',
    ERROR: 'error',
    TIMEOUT: 'timeout'
} as const;

// Message Roles
export const MESSAGE_ROLES = {
    SYSTEM: 'system',
    USER: 'user',
    ASSISTANT: 'assistant'
} as const;

export default {
    API,
    JWT,
    RATE_LIMIT,
    OPENAI,
    DATABASE,
    BLOB_STORAGE,
    SESSION,
    AGENT,
    TESTING,
    CORS,
    FEATURES,
    HTTP_STATUS,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    LOG_LEVELS,
    SESSION_TYPES,
    CONVERSATION_TYPES,
    AGENT_STATUS,
    MESSAGE_ROLES
};

