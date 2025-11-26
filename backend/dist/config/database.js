"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseConfig = void 0;
exports.testConnection = testConnection;
exports.syncDatabase = syncDatabase;
exports.closeConnection = closeConnection;
require("reflect-metadata"); // MUST be first for sequelize-typescript decorators
const sequelize_typescript_1 = require("sequelize-typescript");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const logger_1 = __importDefault(require("../utils/logger"));
dotenv_1.default.config();
const { POSTGRES_HOST = 'localhost', POSTGRES_PORT = '5432', POSTGRES_DB = 'accesslint', POSTGRES_USER = 'postgres', POSTGRES_PASSWORD = '', POSTGRES_SSL = 'false', NODE_ENV = 'development' } = process.env;
// Database configuration
exports.databaseConfig = {
    host: POSTGRES_HOST,
    port: parseInt(POSTGRES_PORT, 10),
    database: POSTGRES_DB,
    username: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    dialect: 'postgres',
    ssl: POSTGRES_SSL === 'true',
    logging: NODE_ENV === 'development' ? (msg) => logger_1.default.debug(msg) : false,
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
const sequelize = new sequelize_typescript_1.Sequelize({
    ...exports.databaseConfig,
    models: [path_1.default.join(__dirname, '..', 'models')],
    modelMatch: (filename, member) => {
        return filename.substring(0, filename.indexOf('.model')) === member.toLowerCase();
    }
});
// Test connection
async function testConnection() {
    try {
        await sequelize.authenticate();
        logger_1.default.info('✅ Database connection established successfully');
        logger_1.default.info(`📊 Connected to: ${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`);
        return true;
    }
    catch (error) {
        logger_1.default.error('❌ Unable to connect to the database:', error);
        return false;
    }
}
// Sync database (development only)
async function syncDatabase(force = false) {
    if (NODE_ENV === 'production' && force) {
        throw new Error('Cannot force sync database in production!');
    }
    try {
        await sequelize.sync({ force, alter: !force });
        logger_1.default.info(`✅ Database synchronized (force: ${force})`);
    }
    catch (error) {
        logger_1.default.error('❌ Error synchronizing database:', error);
        throw error;
    }
}
// Close connection
async function closeConnection() {
    try {
        await sequelize.close();
        logger_1.default.info('✅ Database connection closed');
    }
    catch (error) {
        logger_1.default.error('❌ Error closing database connection:', error);
        throw error;
    }
}
exports.default = sequelize;
//# sourceMappingURL=database.js.map