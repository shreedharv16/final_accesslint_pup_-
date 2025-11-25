/**
 * Application constants
 */
export declare const API: {
    PREFIX: string;
    VERSION: string;
    PORT: number;
};
export declare const JWT: {
    SECRET: string;
    EXPIRY: number;
    REFRESH_EXPIRY: number;
    ALGORITHM: "HS256";
};
export declare const RATE_LIMIT: {
    DEFAULT_PER_HOUR: number;
    DEFAULT_TOKENS_PER_DAY: number;
    WINDOW_MS: number;
};
export declare const OPENAI: {
    MAX_TOKENS: number;
    TEMPERATURE: number;
    MAX_CONTEXT_MESSAGES: number;
    TOKEN_ESTIMATION_RATIO: number;
};
export declare const DATABASE: {
    POOL_MAX: number;
    POOL_MIN: number;
    POOL_ACQUIRE: number;
    POOL_IDLE: number;
};
export declare const BLOB_STORAGE: {
    SAS_EXPIRY_MINUTES: number;
    MAX_FILE_SIZE: number;
};
export declare const SESSION: {
    MAX_CONCURRENT: number;
    CLEANUP_INTERVAL_MS: number;
};
export declare const AGENT: {
    MAX_ITERATIONS: number;
    TIMEOUT_MS: number;
    MAX_FILE_CONTEXT: number;
};
export declare const TESTING: {
    MAX_ISSUES_PER_SESSION: number;
    NVDA_TIMEOUT_MS: number;
    BROWSER_TIMEOUT_MS: number;
};
export declare const CORS: {
    ORIGIN: string[];
    CREDENTIALS: boolean;
};
export declare const FEATURES: {
    AI_VALIDATION: boolean;
    RATE_LIMITING: boolean;
    REQUEST_LOGGING: boolean;
};
export declare const HTTP_STATUS: {
    OK: number;
    CREATED: number;
    NO_CONTENT: number;
    BAD_REQUEST: number;
    UNAUTHORIZED: number;
    FORBIDDEN: number;
    NOT_FOUND: number;
    CONFLICT: number;
    TOO_MANY_REQUESTS: number;
    INTERNAL_SERVER_ERROR: number;
    SERVICE_UNAVAILABLE: number;
};
export declare const ERROR_MESSAGES: {
    INVALID_CREDENTIALS: string;
    UNAUTHORIZED: string;
    TOKEN_EXPIRED: string;
    TOKEN_INVALID: string;
    USER_NOT_FOUND: string;
    USER_INACTIVE: string;
    EMAIL_EXISTS: string;
    RATE_LIMIT_EXCEEDED: string;
    TOKEN_LIMIT_EXCEEDED: string;
    INTERNAL_ERROR: string;
    BAD_REQUEST: string;
    NOT_FOUND: string;
    VALIDATION_ERROR: string;
    AI_SERVICE_ERROR: string;
    AI_TIMEOUT: string;
    BLOB_NOT_FOUND: string;
    BLOB_UPLOAD_FAILED: string;
    DB_CONNECTION_ERROR: string;
    DB_QUERY_ERROR: string;
};
export declare const SUCCESS_MESSAGES: {
    USER_CREATED: string;
    LOGIN_SUCCESS: string;
    LOGOUT_SUCCESS: string;
    TOKEN_REFRESHED: string;
    FILE_UPLOADED: string;
    FILE_DOWNLOADED: string;
    AGENT_STARTED: string;
    AGENT_COMPLETED: string;
    TEST_COMPLETED: string;
};
export declare const LOG_LEVELS: {
    readonly ERROR: "ERROR";
    readonly WARN: "WARN";
    readonly INFO: "INFO";
    readonly DEBUG: "DEBUG";
};
export declare const SESSION_TYPES: {
    readonly CHAT_AGENT: "chat_agent";
    readonly TESTING_AGENT: "testing_agent";
};
export declare const CONVERSATION_TYPES: {
    readonly QUICK_MODE: "quick_mode";
    readonly AGENT_MODE: "agent_mode";
};
export declare const AGENT_STATUS: {
    readonly ACTIVE: "active";
    readonly COMPLETED: "completed";
    readonly ERROR: "error";
    readonly TIMEOUT: "timeout";
};
export declare const MESSAGE_ROLES: {
    readonly SYSTEM: "system";
    readonly USER: "user";
    readonly ASSISTANT: "assistant";
};
declare const _default: {
    API: {
        PREFIX: string;
        VERSION: string;
        PORT: number;
    };
    JWT: {
        SECRET: string;
        EXPIRY: number;
        REFRESH_EXPIRY: number;
        ALGORITHM: "HS256";
    };
    RATE_LIMIT: {
        DEFAULT_PER_HOUR: number;
        DEFAULT_TOKENS_PER_DAY: number;
        WINDOW_MS: number;
    };
    OPENAI: {
        MAX_TOKENS: number;
        TEMPERATURE: number;
        MAX_CONTEXT_MESSAGES: number;
        TOKEN_ESTIMATION_RATIO: number;
    };
    DATABASE: {
        POOL_MAX: number;
        POOL_MIN: number;
        POOL_ACQUIRE: number;
        POOL_IDLE: number;
    };
    BLOB_STORAGE: {
        SAS_EXPIRY_MINUTES: number;
        MAX_FILE_SIZE: number;
    };
    SESSION: {
        MAX_CONCURRENT: number;
        CLEANUP_INTERVAL_MS: number;
    };
    AGENT: {
        MAX_ITERATIONS: number;
        TIMEOUT_MS: number;
        MAX_FILE_CONTEXT: number;
    };
    TESTING: {
        MAX_ISSUES_PER_SESSION: number;
        NVDA_TIMEOUT_MS: number;
        BROWSER_TIMEOUT_MS: number;
    };
    CORS: {
        ORIGIN: string[];
        CREDENTIALS: boolean;
    };
    FEATURES: {
        AI_VALIDATION: boolean;
        RATE_LIMITING: boolean;
        REQUEST_LOGGING: boolean;
    };
    HTTP_STATUS: {
        OK: number;
        CREATED: number;
        NO_CONTENT: number;
        BAD_REQUEST: number;
        UNAUTHORIZED: number;
        FORBIDDEN: number;
        NOT_FOUND: number;
        CONFLICT: number;
        TOO_MANY_REQUESTS: number;
        INTERNAL_SERVER_ERROR: number;
        SERVICE_UNAVAILABLE: number;
    };
    ERROR_MESSAGES: {
        INVALID_CREDENTIALS: string;
        UNAUTHORIZED: string;
        TOKEN_EXPIRED: string;
        TOKEN_INVALID: string;
        USER_NOT_FOUND: string;
        USER_INACTIVE: string;
        EMAIL_EXISTS: string;
        RATE_LIMIT_EXCEEDED: string;
        TOKEN_LIMIT_EXCEEDED: string;
        INTERNAL_ERROR: string;
        BAD_REQUEST: string;
        NOT_FOUND: string;
        VALIDATION_ERROR: string;
        AI_SERVICE_ERROR: string;
        AI_TIMEOUT: string;
        BLOB_NOT_FOUND: string;
        BLOB_UPLOAD_FAILED: string;
        DB_CONNECTION_ERROR: string;
        DB_QUERY_ERROR: string;
    };
    SUCCESS_MESSAGES: {
        USER_CREATED: string;
        LOGIN_SUCCESS: string;
        LOGOUT_SUCCESS: string;
        TOKEN_REFRESHED: string;
        FILE_UPLOADED: string;
        FILE_DOWNLOADED: string;
        AGENT_STARTED: string;
        AGENT_COMPLETED: string;
        TEST_COMPLETED: string;
    };
    LOG_LEVELS: {
        readonly ERROR: "ERROR";
        readonly WARN: "WARN";
        readonly INFO: "INFO";
        readonly DEBUG: "DEBUG";
    };
    SESSION_TYPES: {
        readonly CHAT_AGENT: "chat_agent";
        readonly TESTING_AGENT: "testing_agent";
    };
    CONVERSATION_TYPES: {
        readonly QUICK_MODE: "quick_mode";
        readonly AGENT_MODE: "agent_mode";
    };
    AGENT_STATUS: {
        readonly ACTIVE: "active";
        readonly COMPLETED: "completed";
        readonly ERROR: "error";
        readonly TIMEOUT: "timeout";
    };
    MESSAGE_ROLES: {
        readonly SYSTEM: "system";
        readonly USER: "user";
        readonly ASSISTANT: "assistant";
    };
};
export default _default;
//# sourceMappingURL=constants.d.ts.map