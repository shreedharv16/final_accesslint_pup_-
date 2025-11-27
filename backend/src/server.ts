import 'reflect-metadata'
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import dotenv from 'dotenv';
import logger from './utils/logger';
import sequelize, { testConnection } from './config/database';
import { initializeOpenAI } from './config/azureOpenAI';
import { initializeBlobStorage } from './config/azureBlobStorage';
import routes from './routes';
import { requestLogger, errorLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { API, CORS } from './config/constants';
import { cleanupExpiredSessions } from './services/authService';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = API.PORT;

/**
 * Initialize Azure services
 */
async function initializeAzureServices(): Promise<void> {
    try {
        logger.info('🔧 Initializing Azure services...');

        // Initialize OpenAI
        await initializeOpenAI();

        // Initialize Blob Storage
        await initializeBlobStorage();

        logger.info('✅ Azure services initialized successfully');
    } catch (error) {
        logger.error('❌ Failed to initialize Azure services:', error);
        throw error;
    }
}

/**
 * Initialize database
 */
async function initializeDatabase(): Promise<void> {
    try {
        logger.info('🔧 Initializing database...');

        // Test connection
        const connected = await testConnection();
        if (!connected) {
            throw new Error('Database connection failed');
        }

        // Sync models (development only)
        if (process.env.NODE_ENV === 'development') {
            await sequelize.sync({ alter: true });
            logger.info('✅ Database models synchronized');
        }

        logger.info('✅ Database initialized successfully');
    } catch (error) {
        logger.error('❌ Failed to initialize database:', error);
        throw error;
    }
}

/**
 * Setup Express middleware
 */
function setupMiddleware(app: Application): void {
    // Security middleware
    app.use(helmet({
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
    app.use(cors({
        origin: CORS.ORIGIN,
        credentials: CORS.CREDENTIALS,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Body parsing
    app.use(express.json({ limit: '50mb' })); // Large limit for workspace files
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Request logging
    app.use(requestLogger);

    logger.info('✅ Middleware configured');
}

/**
 * Setup routes
 */
function setupRoutes(app: Application): void {
    // API routes
    app.use(API.PREFIX, routes);

    // Serve frontend static files from /app folder
    app.use('/app', express.static(path.join(__dirname, 'app')));

    // 404 handler
    app.use(notFoundHandler);

    // Error handler (must be last)
    app.use(errorLogger);
    app.use(errorHandler);

    logger.info('✅ Routes configured');
}

/**
 * Setup scheduled tasks
 */
function setupScheduledTasks(): void {
    // Cleanup expired sessions every hour
    setInterval(async () => {
        try {
            await cleanupExpiredSessions();
        } catch (error) {
            logger.error('❌ Error in scheduled cleanup:', error);
        }
    }, 3600000); // 1 hour

    logger.info('✅ Scheduled tasks configured');
}

/**
 * Start the server
 */
async function startServer(): Promise<void> {
    try {
        logger.info('🚀 Starting AccessLint Backend Server...');
        logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);

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
            logger.info('🎉 ========================================');
            logger.info(`✅ Server running on port ${PORT}`);
            logger.info(`📡 API available at: http://localhost:${PORT}${API.PREFIX}`);
            logger.info(`🏥 Health check: http://localhost:${PORT}${API.PREFIX}/health`);
            logger.info('🎉 ========================================');
        });
    } catch (error) {
        logger.error('❌ Fatal error during server startup:', error);
        process.exit(1);
    }
}

/**
 * Graceful shutdown
 */
async function gracefulShutdown(): Promise<void> {
    logger.info('⏳ Graceful shutdown initiated...');

    try {
        // Close database connection
        await sequelize.close();
        logger.info('✅ Database connection closed');

        logger.info('✅ Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        logger.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
}

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Start the server
startServer();

export default app;

