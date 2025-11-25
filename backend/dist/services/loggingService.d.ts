import { DebugLog } from '../models';
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
export declare function saveLog(entry: LogEntry): Promise<void>;
/**
 * Save multiple log entries in bulk
 */
export declare function saveLogs(entries: LogEntry[]): Promise<void>;
/**
 * Get logs for a specific user
 */
export declare function getUserLogs(userId: string, options?: {
    limit?: number;
    offset?: number;
    logLevel?: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
    sessionType?: 'agent' | 'testing' | 'chat' | 'general';
    startDate?: Date;
    endDate?: Date;
}): Promise<DebugLog[]>;
/**
 * Get logs for a specific session
 */
export declare function getSessionLogs(sessionId: string, options?: {
    limit?: number;
    offset?: number;
    logLevel?: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
}): Promise<DebugLog[]>;
/**
 * Delete old logs (cleanup)
 */
export declare function deleteOldLogs(daysToKeep?: number): Promise<number>;
/**
 * Helper functions that mimic outputChannel.appendLine behavior
 */
export declare function logInfo(message: string, userId?: string, sessionId?: string, sessionType?: 'agent' | 'testing' | 'chat' | 'general', context?: any): void;
export declare function logWarn(message: string, userId?: string, sessionId?: string, sessionType?: 'agent' | 'testing' | 'chat' | 'general', context?: any): void;
export declare function logError(message: string, userId?: string, sessionId?: string, sessionType?: 'agent' | 'testing' | 'chat' | 'general', context?: any): void;
export declare function logDebug(message: string, userId?: string, sessionId?: string, sessionType?: 'agent' | 'testing' | 'chat' | 'general', context?: any): void;
declare const _default: {
    saveLog: typeof saveLog;
    saveLogs: typeof saveLogs;
    getUserLogs: typeof getUserLogs;
    getSessionLogs: typeof getSessionLogs;
    deleteOldLogs: typeof deleteOldLogs;
    logInfo: typeof logInfo;
    logWarn: typeof logWarn;
    logError: typeof logError;
    logDebug: typeof logDebug;
};
export default _default;
//# sourceMappingURL=loggingService.d.ts.map