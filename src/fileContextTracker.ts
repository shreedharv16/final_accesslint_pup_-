/**
 * File Context Tracker for AccessLint Agent
 * Prevents redundant file reads and tracks file state efficiently
 * Based on successful patterns from high-performing agent implementations
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface FileContext {
  content: string;
  timestamp: number;
  hash: string;
  size: number;
  lineCount: number;
}

export interface FileReadRequest {
  filePath: string;
  limit?: number;
  offset?: number;
}

export interface FileTrackingResult {
  shouldRead: boolean;
  reason: string;
  cachedContent?: string;
  isPartialRead?: boolean;
}

export class FileContextTracker {
  private fileCache = new Map<string, FileContext>();
  private outputChannel: vscode.OutputChannel;
  private workspaceRoot: string;
  
  // Configuration
  private readonly MAX_CACHE_SIZE = 50; // Maximum files to keep in cache
  private readonly MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB max file size to cache
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache TTL
  private readonly MIN_TIME_BETWEEN_READS = 30 * 1000; // 30 seconds minimum between same file reads

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.outputChannel = vscode.window.createOutputChannel('AccessLint File Tracker');
  }

  /**
   * Check if a file should be read or if we can use cached content
   */
  shouldReadFile(request: FileReadRequest): FileTrackingResult {
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
    } catch (error) {
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
  cacheFileContent(filePath: string, content: string, limit?: number, offset?: number): void {
    const fullPath = this.resolveFilePath(filePath);
    
    // Don't cache very large files
    if (content.length > this.MAX_FILE_SIZE) {
      this.outputChannel.appendLine(`📊 Skipping cache for large file ${filePath} (${content.length} bytes)`);
      return;
    }

    const cacheKey = this.getCacheKey(filePath, limit, offset);
    const hash = this.calculateContentHash(content);
    const lineCount = content.split('\n').length;

    const fileContext: FileContext = {
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
  getCachedContent(filePath: string, limit?: number, offset?: number): string | null {
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
  hasAnyCachedContent(filePath: string): boolean {
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
  getCacheStats(): {
    totalFiles: number;
    totalSize: number;
    averageAge: number;
    oldestEntry: number;
    newestEntry: number;
  } {
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
  clearCache(filePath?: string): void {
    if (filePath) {
      const normalizedPath = this.normalizeFilePath(filePath);
      const keysToDelete = Array.from(this.fileCache.keys())
        .filter(key => key.startsWith(normalizedPath + '::'));
      
      keysToDelete.forEach(key => this.fileCache.delete(key));
      this.outputChannel.appendLine(`🗑️ Cleared cache for ${filePath} (${keysToDelete.length} entries)`);
    } else {
      this.fileCache.clear();
      this.outputChannel.appendLine(`🗑️ Cleared entire file cache`);
    }
  }

  /**
   * Get list of cached files for debugging
   */
  getCachedFiles(): string[] {
    return Array.from(this.fileCache.keys())
      .map(key => key.split('::')[0])
      .filter((path, index, arr) => arr.indexOf(path) === index);
  }

  // Private helper methods

  private getCacheKey(filePath: string, limit?: number, offset?: number): string {
    const normalizedPath = this.normalizeFilePath(filePath);
    // For full file reads (no limit/offset), use simple key for maximum cache hits
    if (!limit && !offset) {
      return normalizedPath;
    }
    const params = `::limit=${limit || 'none'}::offset=${offset || 0}`;
    return `${normalizedPath}${params}`;
  }

  private normalizeFilePath(filePath: string): string {
    // Convert to absolute path and normalize
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.resolve(this.workspaceRoot, filePath);
    
    return path.normalize(absolutePath);
  }

  private resolveFilePath(filePath: string): string {
    return path.isAbsolute(filePath) 
      ? filePath 
      : path.resolve(this.workspaceRoot, filePath);
  }

  private fileExists(fullPath: string): boolean {
    try {
      return fs.existsSync(fullPath);
    } catch {
      return false;
    }
  }

  private calculateFileHash(fullPath: string): string {
    try {
      const stats = fs.statSync(fullPath);
      // Use modification time + size as a simple hash
      return `${stats.mtime.getTime()}-${stats.size}`;
    } catch {
      return `error-${Date.now()}`;
    }
  }

  private calculateContentHash(content: string): string {
    // Simple hash based on content length and first/last characters
    if (content.length === 0) return 'empty';
    
    const first = content.charCodeAt(0);
    const last = content.charCodeAt(content.length - 1);
    const middle = content.length > 2 ? content.charCodeAt(Math.floor(content.length / 2)) : 0;
    
    return `${content.length}-${first}-${middle}-${last}`;
  }

  private evictOldestEntries(): void {
    // Remove oldest 25% of entries to make room
    const entriesToRemove = Math.ceil(this.fileCache.size * 0.25);
    const sortedEntries = Array.from(this.fileCache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);
    
    for (let i = 0; i < entriesToRemove; i++) {
      this.fileCache.delete(sortedEntries[i][0]);
    }
    
    this.outputChannel.appendLine(`🧹 Evicted ${entriesToRemove} old cache entries`);
  }

  dispose(): void {
    this.fileCache.clear();
    this.outputChannel.dispose();
  }
}
