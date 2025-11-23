import { Sequelize } from 'sequelize-typescript';
import dotenv from 'dotenv';
import path from 'path';
import logger from '../utils/logger';

dotenv.config();

const {
    POSTGRES_HOST = 'localhost',
    POSTGRES_PORT = '5432',
    POSTGRES_DB = 'accesslint',
    POSTGRES_USER = 'postgres',
    POSTGRES_PASSWORD = '',
    POSTGRES_SSL = 'false',
    NODE_ENV = 'development'
} = process.env;

// Database configuration
export const databaseConfig = {
    host: POSTGRES_HOST,
    port: parseInt(POSTGRES_PORT, 10),
    database: POSTGRES_DB,
    username: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    dialect: 'postgres' as const,
    ssl: POSTGRES_SSL === 'true',
    logging: NODE_ENV === 'development' ? (msg: string) => logger.debug(msg) : false,
    pool: {
        max: 20,
        min: 5,
        acquire: 30000,
        idle: 10000
    },
    define: {
        timestamps: false,
        underscored: true
    }
};

// Initialize Sequelize
const sequelize = new Sequelize({
    ...databaseConfig,
    models: [path.join(__dirname, '..', 'models')],
    modelMatch: (filename, member) => {
        return filename.substring(0, filename.indexOf('.model')) === member.toLowerCase();
    }
});

// Test connection
export async function testConnection(): Promise<boolean> {
    try {
        await sequelize.authenticate();
        logger.info('✅ Database connection established successfully');
        logger.info(`📊 Connected to: ${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`);
        return true;
    } catch (error) {
        logger.error('❌ Unable to connect to the database:', error);
        return false;
    }
}

// Sync database (development only)
export async function syncDatabase(force: boolean = false): Promise<void> {
    if (NODE_ENV === 'production' && force) {
        throw new Error('Cannot force sync database in production!');
    }

    try {
        await sequelize.sync({ force, alter: !force });
        logger.info(`✅ Database synchronized (force: ${force})`);
    } catch (error) {
        logger.error('❌ Error synchronizing database:', error);
        throw error;
    }
}

// Close connection
export async function closeConnection(): Promise<void> {
    try {
        await sequelize.close();
        logger.info('✅ Database connection closed');
    } catch (error) {
        logger.error('❌ Error closing database connection:', error);
        throw error;
    }
}

export default sequelize;

