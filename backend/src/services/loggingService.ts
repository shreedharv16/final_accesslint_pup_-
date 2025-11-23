import { DebugLog } from '../models';
import logger from '../utils/logger';

export interface LogEntry {
    userId?: string;
    sessionId?: string;
    sessionType?: 'agent' | 'testing' | 'chat' | 'general';
    logLevel: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
    message: string;
    context?: any;
}

/**
 * Save a log entry to the database
 * This replaces outputChannel.appendLine from the VSCode extension
 */
export async function saveLog(entry: LogEntry): Promise<void> {
    try {
        await DebugLog.create({
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
                logger.error(logMessage, entry.context);
                break;
            case 'WARN':
                logger.warn(logMessage, entry.context);
                break;
            case 'DEBUG':
                logger.debug(logMessage, entry.context);
                break;
            case 'INFO':
            default:
                logger.info(logMessage, entry.context);
                break;
        }
    } catch (error) {
        // Don't throw - logging failures shouldn't break the application
        logger.error('❌ Failed to save log to database:', error);
    }
}

/**
 * Save multiple log entries in bulk
 */
export async function saveLogs(entries: LogEntry[]): Promise<void> {
    try {
        await DebugLog.bulkCreate(
            entries.map(entry => ({
                userId: entry.userId,
                sessionId: entry.sessionId,
                sessionType: entry.sessionType,
                logLevel: entry.logLevel,
                message: entry.message,
                context: entry.context
            }))
        );

        logger.info(`✅ Saved ${entries.length} log entries to database`);
    } catch (error) {
        logger.error('❌ Failed to save logs to database:', error);
    }
}

/**
 * Get logs for a specific user
 */
export async function getUserLogs(
    userId: string,
    options?: {
        limit?: number;
        offset?: number;
        logLevel?: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
        sessionType?: 'agent' | 'testing' | 'chat' | 'general';
        startDate?: Date;
        endDate?: Date;
    }
): Promise<DebugLog[]> {
    try {
        const where: any = { userId };

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

        const logs = await DebugLog.findAll({
            where,
            limit: options?.limit || 100,
            offset: options?.offset || 0,
            order: [['timestamp', 'DESC']]
        });

        return logs;
    } catch (error) {
        logger.error(`❌ Error fetching logs for user ${userId}:`, error);
        return [];
    }
}

/**
 * Get logs for a specific session
 */
export async function getSessionLogs(
    sessionId: string,
    options?: {
        limit?: number;
        offset?: number;
        logLevel?: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
    }
): Promise<DebugLog[]> {
    try {
        const where: any = { sessionId };

        if (options?.logLevel) {
            where.logLevel = options.logLevel;
        }

        const logs = await DebugLog.findAll({
            where,
            limit: options?.limit || 100,
            offset: options?.offset || 0,
            order: [['timestamp', 'ASC']]
        });

        return logs;
    } catch (error) {
        logger.error(`❌ Error fetching logs for session ${sessionId}:`, error);
        return [];
    }
}

/**
 * Delete old logs (cleanup)
 */
export async function deleteOldLogs(daysToKeep: number = 30): Promise<number> {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const result = await DebugLog.destroy({
            where: {
                timestamp: {
                    [require('sequelize').Op.lt]: cutoffDate
                }
            }
        });

        logger.info(`✅ Deleted ${result} old log entries (older than ${daysToKeep} days)`);
        return result;
    } catch (error) {
        logger.error('❌ Error deleting old logs:', error);
        return 0;
    }
}

/**
 * Helper functions that mimic outputChannel.appendLine behavior
 */

export function logInfo(message: string, userId?: string, sessionId?: string, sessionType?: 'agent' | 'testing' | 'chat' | 'general', context?: any) {
    saveLog({ userId, sessionId, sessionType, logLevel: 'INFO', message, context });
}

export function logWarn(message: string, userId?: string, sessionId?: string, sessionType?: 'agent' | 'testing' | 'chat' | 'general', context?: any) {
    saveLog({ userId, sessionId, sessionType, logLevel: 'WARN', message, context });
}

export function logError(message: string, userId?: string, sessionId?: string, sessionType?: 'agent' | 'testing' | 'chat' | 'general', context?: any) {
    saveLog({ userId, sessionId, sessionType, logLevel: 'ERROR', message, context });
}

export function logDebug(message: string, userId?: string, sessionId?: string, sessionType?: 'agent' | 'testing' | 'chat' | 'general', context?: any) {
    saveLog({ userId, sessionId, sessionType, logLevel: 'DEBUG', message, context });
}

export default {
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

