"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveLog = saveLog;
exports.saveLogs = saveLogs;
exports.getUserLogs = getUserLogs;
exports.getSessionLogs = getSessionLogs;
exports.deleteOldLogs = deleteOldLogs;
exports.logInfo = logInfo;
exports.logWarn = logWarn;
exports.logError = logError;
exports.logDebug = logDebug;
const models_1 = require("../models");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Save a log entry to the database
 * This replaces outputChannel.appendLine from the VSCode extension
 */
async function saveLog(entry) {
    try {
        await models_1.DebugLog.create({
            userId: entry.userId,
            sessionId: entry.sessionId,
            sessionType: entry.sessionType,
            logLevel: entry.logLevel,
            message: entry.message,
            context: entry.context
        });
        // Also log to Winston for immediate visibility
        const logMessage = `[${entry.sessionType || 'general'}] ${entry.message}`;
        switch (entry.logLevel) {
            case 'ERROR':
                logger_1.default.error(logMessage, entry.context);
                break;
            case 'WARN':
                logger_1.default.warn(logMessage, entry.context);
                break;
            case 'DEBUG':
                logger_1.default.debug(logMessage, entry.context);
                break;
            case 'INFO':
            default:
                logger_1.default.info(logMessage, entry.context);
                break;
        }
    }
    catch (error) {
        // Don't throw - logging failures shouldn't break the application
        logger_1.default.error('❌ Failed to save log to database:', error);
    }
}
/**
 * Save multiple log entries in bulk
 */
async function saveLogs(entries) {
    try {
        await models_1.DebugLog.bulkCreate(entries.map(entry => ({
            userId: entry.userId,
            sessionId: entry.sessionId,
            sessionType: entry.sessionType,
            logLevel: entry.logLevel,
            message: entry.message,
            context: entry.context
        })));
        logger_1.default.info(`✅ Saved ${entries.length} log entries to database`);
    }
    catch (error) {
        logger_1.default.error('❌ Failed to save logs to database:', error);
    }
}
/**
 * Get logs for a specific user
 */
async function getUserLogs(userId, options) {
    try {
        const where = { userId };
        if (options?.logLevel) {
            where.logLevel = options.logLevel;
        }
        if (options?.sessionType) {
            where.sessionType = options.sessionType;
        }
        if (options?.startDate || options?.endDate) {
            where.timestamp = {};
            if (options.startDate) {
                where.timestamp[require('sequelize').Op.gte] = options.startDate;
            }
            if (options.endDate) {
                where.timestamp[require('sequelize').Op.lte] = options.endDate;
            }
        }
        const logs = await models_1.DebugLog.findAll({
            where,
            limit: options?.limit || 100,
            offset: options?.offset || 0,
            order: [['timestamp', 'DESC']]
        });
        return logs;
    }
    catch (error) {
        logger_1.default.error(`❌ Error fetching logs for user ${userId}:`, error);
        return [];
    }
}
/**
 * Get logs for a specific session
 */
async function getSessionLogs(sessionId, options) {
    try {
        const where = { sessionId };
        if (options?.logLevel) {
            where.logLevel = options.logLevel;
        }
        const logs = await models_1.DebugLog.findAll({
            where,
            limit: options?.limit || 100,
            offset: options?.offset || 0,
            order: [['timestamp', 'ASC']]
        });
        return logs;
    }
    catch (error) {
        logger_1.default.error(`❌ Error fetching logs for session ${sessionId}:`, error);
        return [];
    }
}
/**
 * Delete old logs (cleanup)
 */
async function deleteOldLogs(daysToKeep = 30) {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        const result = await models_1.DebugLog.destroy({
            where: {
                timestamp: {
                    [require('sequelize').Op.lt]: cutoffDate
                }
            }
        });
        logger_1.default.info(`✅ Deleted ${result} old log entries (older than ${daysToKeep} days)`);
        return result;
    }
    catch (error) {
        logger_1.default.error('❌ Error deleting old logs:', error);
        return 0;
    }
}
/**
 * Helper functions that mimic outputChannel.appendLine behavior
 */
function logInfo(message, userId, sessionId, sessionType, context) {
    saveLog({ userId, sessionId, sessionType, logLevel: 'INFO', message, context });
}
function logWarn(message, userId, sessionId, sessionType, context) {
    saveLog({ userId, sessionId, sessionType, logLevel: 'WARN', message, context });
}
function logError(message, userId, sessionId, sessionType, context) {
    saveLog({ userId, sessionId, sessionType, logLevel: 'ERROR', message, context });
}
function logDebug(message, userId, sessionId, sessionType, context) {
    saveLog({ userId, sessionId, sessionType, logLevel: 'DEBUG', message, context });
}
exports.default = {
    saveLog,
    saveLogs,
    getUserLogs,
    getSessionLogs,
    deleteOldLogs,
    logInfo,
    logWarn,
    logError,
    logDebug
};
//# sourceMappingURL=loggingService.js.map