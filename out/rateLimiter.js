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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeRateLimiter = exports.RateLimiter = void 0;
const vscode = __importStar(require("vscode"));
class RateLimiter {
    constructor(config) {
        this.usage = [];
        this.waitingPromises = new Map();
        this.config = {
            tokensPerMinute: config.tokensPerMinute,
            requestsPerMinute: config.requestsPerMinute || 50,
            burstThreshold: config.burstThreshold || Math.floor(config.tokensPerMinute * 0.8) // 80% of limit for burst
        };
        this.outputChannel = vscode.window.createOutputChannel('AccessLint Rate Limiter');
        this.outputChannel.appendLine(`🚦 Rate Limiter initialized: ${this.config.tokensPerMinute} tokens/min`);
    }
    /**
     * Check if we can make a request with the estimated token count
     * Returns true if allowed, false if rate limited
     */
    async checkRateLimit(estimatedTokens, requestId = this.generateRequestId()) {
        // Prevent infinite loops by limiting recursion
        let attempts = 0;
        const maxAttempts = 3;
        while (attempts < maxAttempts) {
            this.cleanupOldUsage();
            const currentUsage = this.getCurrentMinuteUsage();
            const wouldExceedLimit = (currentUsage.tokens + estimatedTokens) > this.config.tokensPerMinute;
            const wouldExceedRequests = currentUsage.requests >= (this.config.requestsPerMinute || 50);
            this.outputChannel.appendLine(`🔍 Rate check: ${estimatedTokens} tokens requested, ` +
                `current usage: ${currentUsage.tokens}/${this.config.tokensPerMinute} tokens, ` +
                `${currentUsage.requests}/${this.config.requestsPerMinute} requests (attempt ${attempts + 1})`);
            if (wouldExceedLimit || wouldExceedRequests) {
                const waitTime = this.calculateWaitTime(estimatedTokens);
                // If wait time is 0 or very small, just allow the request to prevent loops
                if (waitTime <= 1000) { // Less than 1 second
                    this.outputChannel.appendLine(`🟢 Wait time minimal (${waitTime}ms), allowing request`);
                    return true;
                }
                this.outputChannel.appendLine(`⏸️ Rate limit reached! Need to wait ${Math.ceil(waitTime / 1000)}s for ${estimatedTokens} tokens`);
                // Show user-friendly notification only on first attempt
                if (attempts === 0) {
                    vscode.window.showWarningMessage(`Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds to continue...`, 'OK');
                }
                await this.waitForRateLimit(waitTime, requestId);
                attempts++;
            }
            else {
                return true;
            }
        }
        // If we've tried too many times, just allow the request to prevent infinite loops
        this.outputChannel.appendLine(`⚠️ Max rate limit attempts reached, allowing request to prevent infinite loop`);
        return true;
    }
    /**
     * Record actual token usage after a request
     */
    recordUsage(actualTokens, requestId = this.generateRequestId()) {
        const usage = {
            tokens: actualTokens,
            timestamp: Date.now(),
            requestId
        };
        this.usage.push(usage);
        this.outputChannel.appendLine(`📊 Recorded usage: ${actualTokens} tokens (ID: ${requestId})`);
        // Log current status
        const currentUsage = this.getCurrentMinuteUsage();
        const percentUsed = Math.round((currentUsage.tokens / this.config.tokensPerMinute) * 100);
        this.outputChannel.appendLine(`📈 Current usage: ${currentUsage.tokens}/${this.config.tokensPerMinute} tokens (${percentUsed}%), ` +
            `${currentUsage.requests} requests`);
        // Warn if approaching limit
        if (percentUsed >= 80) {
            this.outputChannel.appendLine(`⚠️ Warning: Approaching rate limit (${percentUsed}% used)`);
        }
    }
    /**
     * Get current usage statistics
     */
    getCurrentUsage() {
        this.cleanupOldUsage();
        const currentUsage = this.getCurrentMinuteUsage();
        // Find the oldest usage entry to determine when the window resets
        const oldestUsage = this.usage.length > 0 ? Math.min(...this.usage.map(u => u.timestamp)) : Date.now();
        const timeUntilReset = Math.max(0, 60000 - (Date.now() - oldestUsage));
        return {
            tokens: currentUsage.tokens,
            requests: currentUsage.requests,
            percentUsed: Math.round((currentUsage.tokens / this.config.tokensPerMinute) * 100),
            timeUntilReset
        };
    }
    /**
     * Wait for rate limit to reset
     */
    async waitForRateLimit(waitTimeMs, requestId) {
        return new Promise((resolve) => {
            this.waitingPromises.set(requestId, { resolve, requestId });
            const startTime = Date.now();
            const checkInterval = 1000; // Check every second
            const checkAndWait = () => {
                const elapsed = Date.now() - startTime;
                const remaining = Math.max(0, waitTimeMs - elapsed);
                if (remaining <= 0) {
                    this.outputChannel.appendLine(`✅ Wait complete for request ${requestId}`);
                    this.waitingPromises.delete(requestId);
                    resolve();
                }
                else {
                    this.outputChannel.appendLine(`⏳ Still waiting... ${Math.ceil(remaining / 1000)}s remaining`);
                    setTimeout(checkAndWait, Math.min(checkInterval, remaining));
                }
            };
            setTimeout(checkAndWait, checkInterval);
        });
    }
    /**
     * Calculate how long to wait before making the next request
     */
    calculateWaitTime(estimatedTokens) {
        if (this.usage.length === 0)
            return 0;
        // Find the oldest usage that would need to expire for us to have enough tokens
        const currentUsage = this.getCurrentMinuteUsage();
        const needed = (currentUsage.tokens + estimatedTokens) - this.config.tokensPerMinute;
        if (needed <= 0)
            return 0;
        // Sort usage by timestamp and find how much we need to free up
        const sortedUsage = [...this.usage].sort((a, b) => a.timestamp - b.timestamp);
        let tokensToFree = needed;
        let oldestRelevantTimestamp = Date.now();
        for (const usage of sortedUsage) {
            tokensToFree -= usage.tokens;
            oldestRelevantTimestamp = usage.timestamp;
            if (tokensToFree <= 0)
                break;
        }
        // Calculate when the oldest relevant usage will expire (60 seconds after it was made)
        const expirationTime = oldestRelevantTimestamp + 60000;
        return Math.max(0, expirationTime - Date.now());
    }
    /**
     * Get usage within the current minute window
     */
    getCurrentMinuteUsage() {
        const oneMinuteAgo = Date.now() - 60000;
        const recentUsage = this.usage.filter(u => u.timestamp > oneMinuteAgo);
        return {
            tokens: recentUsage.reduce((sum, u) => sum + u.tokens, 0),
            requests: recentUsage.length
        };
    }
    /**
     * Remove usage entries older than 1 minute
     */
    cleanupOldUsage() {
        const oneMinuteAgo = Date.now() - 60000;
        const originalLength = this.usage.length;
        this.usage = this.usage.filter(u => u.timestamp > oneMinuteAgo);
        if (this.usage.length < originalLength) {
            this.outputChannel.appendLine(`🧹 Cleaned up ${originalLength - this.usage.length} old usage entries`);
        }
    }
    /**
     * Generate a unique request ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Cancel any waiting requests (for cleanup)
     */
    cancelWaitingRequests() {
        for (const [requestId, waiting] of this.waitingPromises) {
            this.outputChannel.appendLine(`❌ Cancelling waiting request: ${requestId}`);
            waiting.resolve();
        }
        this.waitingPromises.clear();
    }
    /**
     * Reset all usage tracking (for testing or emergencies)
     */
    reset() {
        this.usage = [];
        this.cancelWaitingRequests();
        this.outputChannel.appendLine(`🔄 Rate limiter reset`);
    }
    /**
     * Get configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.outputChannel.appendLine(`⚙️ Rate limiter config updated: ${this.config.tokensPerMinute} tokens/min, ` +
            `${this.config.requestsPerMinute} requests/min`);
    }
    /**
     * Dispose resources
     */
    dispose() {
        this.cancelWaitingRequests();
        this.outputChannel.dispose();
    }
}
exports.RateLimiter = RateLimiter;
// Export a default rate limiter for Anthropic Claude
exports.ClaudeRateLimiter = new RateLimiter({
    tokensPerMinute: 30000,
    requestsPerMinute: 50,
    burstThreshold: 24000 // Allow bursts up to 80% of limit
});
//# sourceMappingURL=rateLimiter.js.map