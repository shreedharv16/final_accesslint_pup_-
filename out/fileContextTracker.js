"use strict";
/**
 * File Context Tracker for AccessLint Agent
 * Prevents redundant file reads and tracks file state efficiently
 * Based on successful patterns from high-performing agent implementations
 */
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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileContextTracker = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class FileContextTracker {
    constructor(workspaceRoot) {
        this.fileCache = new Map();
        // Configuration
        this.MAX_CACHE_SIZE = 50; // Maximum files to keep in cache
        this.MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB max file size to cache
        this.CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache TTL
        this.MIN_TIME_BETWEEN_READS = 30 * 1000; // 30 seconds minimum between same file reads
        this.workspaceRoot = workspaceRoot;
        this.outputChannel = vscode.window.createOutputChannel('AccessLint File Tracker');
    }
    /**
     * Check if a file should be read or if we can use cached content
     */
    shouldReadFile(request) {
        const { filePath, limit, offset } = request;
        const fullPath = this.resolveFilePath(filePath);
        const cacheKey = this.getCacheKey(filePath, limit, offset);
        // Check if file exists
        if (!this.fileExists(fullPath)) {
            return {
                shouldRead: true,
                reason: 'File does not exist - need to attempt read for proper error handling'
            };
        }
        const cached = this.fileCache.get(cacheKey);
        const now = Date.now();
        // No cache entry - should read
        if (!cached) {
            this.outputChannel.appendLine(`📖 No cache for ${filePath} - will read`);
            return {
                shouldRead: true,
                reason: 'No cached content available'
            };
        }
        // Check if cache is expired
        if (now - cached.timestamp > this.CACHE_TTL) {
            this.outputChannel.appendLine(`⏰ Cache expired for ${filePath} - will re-read`);
            return {
                shouldRead: true,
                reason: 'Cache expired'
            };
        }
        // Check if file has been modified since cache
        try {
            const stats = fs.statSync(fullPath);
            const currentHash = this.calculateFileHash(fullPath);
            if (currentHash !== cached.hash) {
                this.outputChannel.appendLine(`🔄 File ${filePath} modified - will re-read`);
                return {
                    shouldRead: true,
                    reason: 'File has been modified'
                };
            }
        }
        catch (error) {
            // If we can't check file stats, better to re-read
            return {
                shouldRead: true,
                reason: 'Unable to verify file state'
            };
        }
        // Check minimum time between reads (prevents rapid re-reads)
        if (now - cached.timestamp < this.MIN_TIME_BETWEEN_READS) {
            this.outputChannel.appendLine(`💾 CACHE HIT: ${filePath} (recent read, ${Math.round((now - cached.timestamp) / 1000)}s ago)`);
            return {
                shouldRead: false,
                reason: 'Recently read - using cached content',
                cachedContent: cached.content,
                isPartialRead: !!(limit || offset)
            };
        }
        // For full file reads, check if we have any cached version (even partial)
        if (!limit && !offset && this.hasAnyCachedContent(filePath)) {
            const fullFileKey = this.normalizeFilePath(filePath);
            const fullFileCached = this.fileCache.get(fullFileKey);
            if (fullFileCached && (now - fullFileCached.timestamp) < this.CACHE_TTL) {
                this.outputChannel.appendLine(`💾 CACHE HIT: ${filePath} (full file cached)`);
                return {
                    shouldRead: false,
                    reason: 'Full file cached',
                    cachedContent: fullFileCached.content,
                    isPartialRead: false
                };
            }
        }
        // Cache is valid and sufficient time has passed
        this.outputChannel.appendLine(`💾 CACHE HIT: ${filePath} (valid cache)`);
        return {
            shouldRead: false,
            reason: 'Valid cached content available',
            cachedContent: cached.content,
            isPartialRead: !!(limit || offset)
        };
    }
    /**
     * Cache file content after successful read
     */
    cacheFileContent(filePath, content, limit, offset) {
        const fullPath = this.resolveFilePath(filePath);
        // Don't cache very large files
        if (content.length > this.MAX_FILE_SIZE) {
            this.outputChannel.appendLine(`📊 Skipping cache for large file ${filePath} (${content.length} bytes)`);
            return;
        }
        const cacheKey = this.getCacheKey(filePath, limit, offset);
        const hash = this.calculateContentHash(content);
        const lineCount = content.split('\n').length;
        const fileContext = {
            content,
            timestamp: Date.now(),
            hash,
            size: content.length,
            lineCount
        };
        // Manage cache size
        if (this.fileCache.size >= this.MAX_CACHE_SIZE) {
            this.evictOldestEntries();
        }
        this.fileCache.set(cacheKey, fileContext);
        this.outputChannel.appendLine(`💾 Cached ${filePath} (${lineCount} lines, ${content.length} bytes)`);
    }
    /**
     * Get cached content if available
     */
    getCachedContent(filePath, limit, offset) {
        const cacheKey = this.getCacheKey(filePath, limit, offset);
        const cached = this.fileCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
            return cached.content;
        }
        return null;
    }
    /**
     * Check if we have any cached content for a file (any variant)
     */
    hasAnyCachedContent(filePath) {
        const normalizedPath = this.normalizeFilePath(filePath);
        for (const [key, cached] of this.fileCache.entries()) {
            if (key.startsWith(normalizedPath + '::')) {
                if ((Date.now() - cached.timestamp) < this.CACHE_TTL) {
                    return true;
                }
            }
        }
        return false;
    }
    /**
     * Get cache statistics for monitoring
     */
    getCacheStats() {
        const now = Date.now();
        let totalSize = 0;
        let totalAge = 0;
        let oldest = now;
        let newest = 0;
        for (const cached of this.fileCache.values()) {
            totalSize += cached.size;
            totalAge += (now - cached.timestamp);
            oldest = Math.min(oldest, cached.timestamp);
            newest = Math.max(newest, cached.timestamp);
        }
        return {
            totalFiles: this.fileCache.size,
            totalSize,
            averageAge: this.fileCache.size > 0 ? totalAge / this.fileCache.size : 0,
            oldestEntry: oldest,
            newestEntry: newest
        };
    }
    /**
     * Clear cache for specific file or all files
     */
    clearCache(filePath) {
        if (filePath) {
            const normalizedPath = this.normalizeFilePath(filePath);
            const keysToDelete = Array.from(this.fileCache.keys())
                .filter(key => key.startsWith(normalizedPath + '::'));
            keysToDelete.forEach(key => this.fileCache.delete(key));
            this.outputChannel.appendLine(`🗑️ Cleared cache for ${filePath} (${keysToDelete.length} entries)`);
        }
        else {
            this.fileCache.clear();
            this.outputChannel.appendLine(`🗑️ Cleared entire file cache`);
        }
    }
    /**
     * Get list of cached files for debugging
     */
    getCachedFiles() {
        return Array.from(this.fileCache.keys())
            .map(key => key.split('::')[0])
            .filter((path, index, arr) => arr.indexOf(path) === index);
    }
    // Private helper methods
    getCacheKey(filePath, limit, offset) {
        const normalizedPath = this.normalizeFilePath(filePath);
        // For full file reads (no limit/offset), use simple key for maximum cache hits
        if (!limit && !offset) {
            return normalizedPath;
        }
        const params = `::limit=${limit || 'none'}::offset=${offset || 0}`;
        return `${normalizedPath}${params}`;
    }
    normalizeFilePath(filePath) {
        // Convert to absolute path and normalize
        const absolutePath = path.isAbsolute(filePath)
            ? filePath
            : path.resolve(this.workspaceRoot, filePath);
        return path.normalize(absolutePath);
    }
    resolveFilePath(filePath) {
        return path.isAbsolute(filePath)
            ? filePath
            : path.resolve(this.workspaceRoot, filePath);
    }
    fileExists(fullPath) {
        try {
            return fs.existsSync(fullPath);
        }
        catch {
            return false;
        }
    }
    calculateFileHash(fullPath) {
        try {
            const stats = fs.statSync(fullPath);
            // Use modification time + size as a simple hash
            return `${stats.mtime.getTime()}-${stats.size}`;
        }
        catch {
            return `error-${Date.now()}`;
        }
    }
    calculateContentHash(content) {
        // Simple hash based on content length and first/last characters
        if (content.length === 0)
            return 'empty';
        const first = content.charCodeAt(0);
        const last = content.charCodeAt(content.length - 1);
        const middle = content.length > 2 ? content.charCodeAt(Math.floor(content.length / 2)) : 0;
        return `${content.length}-${first}-${middle}-${last}`;
    }
    evictOldestEntries() {
        // Remove oldest 25% of entries to make room
        const entriesToRemove = Math.ceil(this.fileCache.size * 0.25);
        const sortedEntries = Array.from(this.fileCache.entries())
            .sort(([, a], [, b]) => a.timestamp - b.timestamp);
        for (let i = 0; i < entriesToRemove; i++) {
            this.fileCache.delete(sortedEntries[i][0]);
        }
        this.outputChannel.appendLine(`🧹 Evicted ${entriesToRemove} old cache entries`);
    }
    dispose() {
        this.fileCache.clear();
        this.outputChannel.dispose();
    }
}
exports.FileContextTracker = FileContextTracker;
//# sourceMappingURL=fileContextTracker.js.map