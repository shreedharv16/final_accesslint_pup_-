"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = __importDefault(require("./utils/logger"));
const database_1 = __importStar(require("./config/database"));
const azureOpenAI_1 = require("./config/azureOpenAI");
const azureBlobStorage_1 = require("./config/azureBlobStorage");
const routes_1 = __importDefault(require("./routes"));
const requestLogger_1 = require("./middleware/requestLogger");
const errorHandler_1 = require("./middleware/errorHandler");
const constants_1 = require("./config/constants");
const authService_1 = require("./services/authService");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = constants_1.API.PORT;
/**
 * Initialize Azure services
 */
async function initializeAzureServices() {
    try {
        logger_1.default.info('🔧 Initializing Azure services...');
        // Initialize OpenAI
        await (0, azureOpenAI_1.initializeOpenAI)();
        // Initialize Blob Storage
        await (0, azureBlobStorage_1.initializeBlobStorage)();
        logger_1.default.info('✅ Azure services initialized successfully');
    }
    catch (error) {
        logger_1.default.error('❌ Failed to initialize Azure services:', error);
        throw error;
    }
}
/**
 * Initialize database
 */
async function initializeDatabase() {
    try {
        logger_1.default.info('🔧 Initializing database...');
        // Test connection
        const connected = await (0, database_1.testConnection)();
        if (!connected) {
            throw new Error('Database connection failed');
        }
        // Sync models (development only)
        if (process.env.NODE_ENV === 'development') {
            await database_1.default.sync({ alter: true });
            logger_1.default.info('✅ Database models synchronized');
        }
        logger_1.default.info('✅ Database initialized successfully');
    }
    catch (error) {
        logger_1.default.error('❌ Failed to initialize database:', error);
        throw error;
    }
}
/**
 * Setup Express middleware
 */
function setupMiddleware(app) {
    // Security middleware
    app.use((0, helmet_1.default)({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", 'data:', 'https:']
            }
        }
    }));
    // CORS
    app.use((0, cors_1.default)({
        origin: constants_1.CORS.ORIGIN,
        credentials: constants_1.CORS.CREDENTIALS,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }));
    // Body parsing
    app.use(express_1.default.json({ limit: '50mb' })); // Large limit for workspace files
    app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
    // Request logging
    app.use(requestLogger_1.requestLogger);
    logger_1.default.info('✅ Middleware configured');
}
/**
 * Setup routes
 */
function setupRoutes(app) {
    // API routes
    app.use(constants_1.API.PREFIX, routes_1.default);
    // Serve frontend static files from /app folder
    app.use('/app', express_1.default.static(path_1.default.join(__dirname, 'app')));
    // Serve frontend assets directly (for absolute paths in HTML)
    app.use('/assets', express_1.default.static(path_1.default.join(__dirname, 'app', 'assets')));
    // 404 handler
    app.use(errorHandler_1.notFoundHandler);
    // Error handler (must be last)
    app.use(requestLogger_1.errorLogger);
    app.use(errorHandler_1.errorHandler);
    logger_1.default.info('✅ Routes configured');
}
/**
 * Setup scheduled tasks
 */
function setupScheduledTasks() {
    // Cleanup expired sessions every hour
    setInterval(async () => {
        try {
            await (0, authService_1.cleanupExpiredSessions)();
        }
        catch (error) {
            logger_1.default.error('❌ Error in scheduled cleanup:', error);
        }
    }, 3600000); // 1 hour
    logger_1.default.info('✅ Scheduled tasks configured');
}
/**
 * Start the server
 */
async function startServer() {
    try {
        logger_1.default.info('🚀 Starting AccessLint Backend Server...');
        logger_1.default.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
        // Initialize database
        await initializeDatabase();
        // Initialize Azure services
        await initializeAzureServices();
        // Setup middleware
        setupMiddleware(app);
        // Setup routes
        setupRoutes(app);
        // Setup scheduled tasks
        setupScheduledTasks();
        // Start listening
        app.listen(PORT, () => {
            logger_1.default.info('🎉 ========================================');
            logger_1.default.info(`✅ Server running on port ${PORT}`);
            logger_1.default.info(`📡 API available at: http://localhost:${PORT}${constants_1.API.PREFIX}`);
            logger_1.default.info(`🏥 Health check: http://localhost:${PORT}${constants_1.API.PREFIX}/health`);
            logger_1.default.info('🎉 ========================================');
        });
    }
    catch (error) {
        logger_1.default.error('❌ Fatal error during server startup:', error);
        process.exit(1);
    }
}
/**
 * Graceful shutdown
 */
async function gracefulShutdown() {
    logger_1.default.info('⏳ Graceful shutdown initiated...');
    try {
        // Close database connection
        await database_1.default.close();
        logger_1.default.info('✅ Database connection closed');
        logger_1.default.info('✅ Graceful shutdown completed');
        process.exit(0);
    }
    catch (error) {
        logger_1.default.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
}
// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    logger_1.default.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger_1.default.error('❌ Uncaught Exception:', error);
    process.exit(1);
});
// Start the server
startServer();
exports.default = app;
//# sourceMappingURL=server.js.map