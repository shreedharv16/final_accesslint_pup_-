import * as vscode from 'vscode';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  model: string;
  provider: 'anthropic' | 'gemini';
  timestamp: Date;
  sessionId?: string;
}

export interface ApiUsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  requestCount: number;
  sessionsCount: number;
  averageRequestTokens: number;
  lastReset: Date;
}

export interface RateLimitInfo {
  tokensPerMinute: number;
  currentMinuteTokens: number;
  minuteWindowStart: Date;
  isLimitExceeded: boolean;
  timeUntilReset: number; // seconds
}

export interface ContextTruncationOptions {
  strategy: 'none' | 'lastTwo' | 'half' | 'quarter';
  maxContextTokens: number;
  preserveSystemMessage: boolean;
  preserveFirstPair: boolean;
}

export interface StreamingTokenInfo {
  estimatedTokens: number;
  actualTokensSoFar: number;
  streamInterrupted: boolean;
  toolDetected: boolean;
  interruptionReason?: string;
}

// Anthropic pricing (as of 2024)
const ANTHROPIC_PRICING = {
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 }, // per 1M tokens - Claude Sonnet 4
  'claude-3-5-haiku-20241022': { input: 0.25, output: 1.25 },
  'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
  'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-3-7-sonnet-20250219': { input: 3.00, output: 15.00 }, // Legacy fallback
} as const;

// Gemini pricing (approximate)
const GEMINI_PRICING = {
  'gemini-pro': { input: 0.50, output: 1.50 },
  'gemini-pro-vision': { input: 0.50, output: 1.50 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
} as const;

export class TokenTracker {
  private context: vscode.ExtensionContext;
  private usageHistory: TokenUsage[] = [];
  private currentSessionId: string | null = null;
  private rateLimitInfo: RateLimitInfo;
  private outputChannel: vscode.OutputChannel;

  // Rate limiting for Anthropic (30k tokens per minute for Claude Sonnet 4)
  private readonly ANTHROPIC_RATE_LIMIT = 30000;
  private minuteTokensUsed = 0;
  private minuteWindowStart = new Date();

  // Context management settings
  private contextTruncationOptions: ContextTruncationOptions = {
    strategy: 'half',
    maxContextTokens: 150000, // Much higher limit with better management
    preserveSystemMessage: true,
    preserveFirstPair: true
  };

  // Streaming management
  private streamingInfo: StreamingTokenInfo | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.outputChannel = vscode.window.createOutputChannel('AccessLint Token Tracker');
    
    this.rateLimitInfo = {
      tokensPerMinute: this.ANTHROPIC_RATE_LIMIT,
      currentMinuteTokens: 0,
      minuteWindowStart: new Date(),
      isLimitExceeded: false,
      timeUntilReset: 0
    };

    // Load existing usage data
    this.loadUsageHistory();
    
    // Start new session
    this.startNewSession();

    // Set up periodic cleanup and rate limit reset
    setInterval(() => {
      this.cleanupOldData();
      this.updateRateLimitWindow();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Start a new chat session (clears session-specific tracking)
   */
  startNewSession(): string {
    this.currentSessionId = Date.now().toString();
    this.outputChannel.appendLine(`🆕 New chat session started: ${this.currentSessionId}`);
    return this.currentSessionId;
  }

  /**
   * Estimate token count for text (more accurate than basic character counting)
   */
  estimateTokenCount(text: string): number {
    if (!text) return 0;
    
    // More sophisticated token estimation
    // Based on OpenAI's tiktoken approach, adapted for general use
    
    // Split by common word boundaries and punctuation
    const words = text.split(/\s+/);
    const specialChars = text.match(/[^\w\s]/g) || [];
    
    // Rough estimation:
    // - Average word = ~1.3 tokens
    // - Special characters = ~0.5 tokens each
    // - Code blocks and technical content = higher density
    
    let tokenEstimate = words.length * 1.3 + specialChars.length * 0.5;
    
    // Adjust for code content (higher token density)
    if (text.includes('```') || text.includes('function') || text.includes('class')) {
      tokenEstimate *= 1.2;
    }
    
    // Adjust for JSON/structured data
    if (text.includes('{') && text.includes('}')) {
      tokenEstimate *= 1.1;
    }
    
    return Math.ceil(tokenEstimate);
  }

  /**
   * Track API usage from response (when actual tokens are available)
   */
  trackApiUsage(
    inputTokens: number,
    outputTokens: number,
    model: string,
    provider: 'anthropic' | 'gemini',
    sessionId?: string
  ): TokenUsage {
    const totalTokens = inputTokens + outputTokens;
    const cost = this.calculateCost(inputTokens, outputTokens, model, provider);
    
    const usage: TokenUsage = {
      inputTokens,
      outputTokens,
      totalTokens,
      cost,
      model,
      provider,
      timestamp: new Date(),
      sessionId: sessionId || this.currentSessionId || undefined
    };

    this.usageHistory.push(usage);
    this.saveUsageHistory();

    // Update rate limiting for Anthropic
    if (provider === 'anthropic') {
      this.updateRateLimit(totalTokens);
    }

    // Log the usage
    this.outputChannel.appendLine(
      `📊 API Usage Tracked: ${inputTokens} in + ${outputTokens} out = ${totalTokens} tokens, $${cost.toFixed(4)} (${provider}/${model})`
    );

    return usage;
  }

  /**
   * Track estimated usage when actual tokens aren't available
   */
  trackEstimatedUsage(
    inputText: string,
    outputText: string,
    model: string,
    provider: 'anthropic' | 'gemini',
    sessionId?: string
  ): TokenUsage {
    const inputTokens = this.estimateTokenCount(inputText);
    const outputTokens = this.estimateTokenCount(outputText);
    
    return this.trackApiUsage(inputTokens, outputTokens, model, provider, sessionId);
  }

  /**
   * Calculate cost based on provider and model
   */
  private calculateCost(
    inputTokens: number,
    outputTokens: number,
    model: string,
    provider: 'anthropic' | 'gemini'
  ): number {
    let pricing;
    
    if (provider === 'anthropic') {
      pricing = ANTHROPIC_PRICING[model as keyof typeof ANTHROPIC_PRICING] || 
                ANTHROPIC_PRICING['claude-sonnet-4-20250514'];
    } else {
      pricing = GEMINI_PRICING[model as keyof typeof GEMINI_PRICING] || 
                GEMINI_PRICING['gemini-pro'];
    }

    // Calculate cost per million tokens, then convert to actual cost
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    
    return inputCost + outputCost;
  }

  /**
   * Check if API call would exceed rate limits
   */
  checkRateLimit(estimatedTokens: number, provider: 'anthropic' | 'gemini'): {
    allowed: boolean;
    reason?: string;
    waitTime?: number;
  } {
    if (provider !== 'anthropic') {
      return { allowed: true }; // No rate limiting for other providers
    }

    this.updateRateLimitWindow();

    const wouldExceed = this.rateLimitInfo.currentMinuteTokens + estimatedTokens > this.ANTHROPIC_RATE_LIMIT;
    
    if (wouldExceed) {
      const waitTime = Math.ceil(this.rateLimitInfo.timeUntilReset);
      return {
        allowed: false,
        reason: `Would exceed Anthropic rate limit (${this.rateLimitInfo.currentMinuteTokens} + ${estimatedTokens} > ${this.ANTHROPIC_RATE_LIMIT} tokens/minute)`,
        waitTime
      };
    }

    return { allowed: true };
  }

  /**
   * Update rate limiting tracking
   */
  private updateRateLimit(tokensUsed: number): void {
    this.updateRateLimitWindow();
    this.rateLimitInfo.currentMinuteTokens += tokensUsed;
    this.rateLimitInfo.isLimitExceeded = this.rateLimitInfo.currentMinuteTokens > this.ANTHROPIC_RATE_LIMIT;
    
    if (this.rateLimitInfo.isLimitExceeded) {
      this.outputChannel.appendLine(
        `⚠️ Rate limit exceeded: ${this.rateLimitInfo.currentMinuteTokens}/${this.ANTHROPIC_RATE_LIMIT} tokens/minute`
      );
    }
  }

  /**
   * Update rate limiting window (reset every minute)
   */
  private updateRateLimitWindow(): void {
    const now = new Date();
    const timeSinceWindowStart = now.getTime() - this.rateLimitInfo.minuteWindowStart.getTime();
    
    if (timeSinceWindowStart >= 60000) { // 1 minute
      this.rateLimitInfo.currentMinuteTokens = 0;
      this.rateLimitInfo.minuteWindowStart = now;
      this.rateLimitInfo.isLimitExceeded = false;
    }
    
    this.rateLimitInfo.timeUntilReset = Math.max(0, 60 - Math.floor(timeSinceWindowStart / 1000));
  }

  /**
   * Get current session statistics
   */
  getCurrentSessionStats(): ApiUsageStats {
    const sessionUsage = this.usageHistory.filter(u => u.sessionId === this.currentSessionId);
    return this.calculateStats(sessionUsage);
  }

  /**
   * Get overall statistics (last 24 hours)
   */
  getOverallStats(): ApiUsageStats {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentUsage = this.usageHistory.filter(u => u.timestamp >= last24Hours);
    return this.calculateStats(recentUsage);
  }

  /**
   * Get statistics by provider
   */
  getStatsByProvider(provider: 'anthropic' | 'gemini'): ApiUsageStats {
    const providerUsage = this.usageHistory.filter(u => u.provider === provider);
    return this.calculateStats(providerUsage);
  }

  /**
   * Calculate statistics from usage data
   */
  private calculateStats(usageData: TokenUsage[]): ApiUsageStats {
    if (usageData.length === 0) {
      return {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        requestCount: 0,
        sessionsCount: 0,
        averageRequestTokens: 0,
        lastReset: new Date()
      };
    }

    const totalInputTokens = usageData.reduce((sum, u) => sum + u.inputTokens, 0);
    const totalOutputTokens = usageData.reduce((sum, u) => sum + u.outputTokens, 0);
    const totalTokens = totalInputTokens + totalOutputTokens;
    const totalCost = usageData.reduce((sum, u) => sum + u.cost, 0);
    const requestCount = usageData.length;
    const uniqueSessions = new Set(usageData.map(u => u.sessionId).filter(Boolean));
    
    return {
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      totalCost,
      requestCount,
      sessionsCount: uniqueSessions.size,
      averageRequestTokens: requestCount > 0 ? Math.round(totalTokens / requestCount) : 0,
      lastReset: usageData[0]?.timestamp || new Date()
    };
  }

  /**
   * Get rate limit information
   */
  getRateLimitInfo(): RateLimitInfo {
    this.updateRateLimitWindow();
    return { ...this.rateLimitInfo };
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    this.usageHistory = [];
    this.saveUsageHistory();
    this.outputChannel.appendLine('📊 Token usage statistics reset');
  }

  /**
   * Export usage data as CSV
   */
  exportUsageData(): string {
    const headers = ['Timestamp', 'Provider', 'Model', 'Input Tokens', 'Output Tokens', 'Total Tokens', 'Cost', 'Session ID'];
    const rows = this.usageHistory.map(usage => [
      usage.timestamp.toISOString(),
      usage.provider,
      usage.model,
      usage.inputTokens.toString(),
      usage.outputTokens.toString(),
      usage.totalTokens.toString(),
      usage.cost.toFixed(6),
      usage.sessionId || ''
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Load usage history from storage
   */
  private loadUsageHistory(): void {
    try {
      const stored = this.context.globalState.get<TokenUsage[]>('tokenUsageHistory', []);
      // Convert timestamp strings back to Date objects
      this.usageHistory = stored.map(usage => ({
        ...usage,
        timestamp: new Date(usage.timestamp)
      }));
      
      this.outputChannel.appendLine(`📈 Loaded ${this.usageHistory.length} usage records from storage`);
    } catch (error) {
      this.outputChannel.appendLine(`⚠️ Failed to load usage history: ${error}`);
      this.usageHistory = [];
    }
  }

  /**
   * Save usage history to storage
   */
  private saveUsageHistory(): void {
    try {
      this.context.globalState.update('tokenUsageHistory', this.usageHistory);
    } catch (error) {
      this.outputChannel.appendLine(`⚠️ Failed to save usage history: ${error}`);
    }
  }

  /**
   * Clean up old data (keep last 30 days)
   */
  private cleanupOldData(): void {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const originalLength = this.usageHistory.length;
    
    this.usageHistory = this.usageHistory.filter(usage => usage.timestamp >= thirtyDaysAgo);
    
    if (this.usageHistory.length < originalLength) {
      this.saveUsageHistory();
      this.outputChannel.appendLine(
        `🧹 Cleaned up ${originalLength - this.usageHistory.length} old usage records`
      );
    }
  }

  /**
   * Truncate conversation history based on strategy
   */
  truncateConversationHistory<T extends { role: string; content: string }>(
    messages: T[],
    strategy?: 'none' | 'lastTwo' | 'half' | 'quarter'
  ): { truncatedMessages: T[]; tokensSaved: number } {
    const truncationStrategy = strategy || this.contextTruncationOptions.strategy;
    const originalTokens = this.estimateTokenCount(messages.map(m => m.content).join('\n'));
    
    let truncatedMessages: T[] = [];
    
    if (truncationStrategy === 'none' || messages.length <= 2) {
      // Keep only first user-assistant pair
      truncatedMessages = messages.slice(0, 2);
    } else if (truncationStrategy === 'lastTwo') {
      // Keep first pair + last user-assistant pair
      const firstPair = messages.slice(0, 2);
      const lastPair = messages.slice(-2);
      truncatedMessages = [...firstPair, ...lastPair];
    } else if (truncationStrategy === 'half') {
      // Keep first pair + half of remaining pairs
      const firstPair = messages.slice(0, 2);
      const remaining = messages.slice(2);
      const halfRemaining = remaining.slice(-Math.floor(remaining.length / 2));
      truncatedMessages = [...firstPair, ...halfRemaining];
    } else if (truncationStrategy === 'quarter') {
      // Keep first pair + quarter of remaining pairs (most aggressive)
      const firstPair = messages.slice(0, 2);
      const remaining = messages.slice(2);
      const quarterRemaining = remaining.slice(-Math.floor(remaining.length / 4));
      truncatedMessages = [...firstPair, ...quarterRemaining];
    }
    
    const newTokens = this.estimateTokenCount(truncatedMessages.map(m => m.content).join('\n'));
    const tokensSaved = originalTokens - newTokens;
    
    this.outputChannel.appendLine(
      `🗜️ Context truncated (${truncationStrategy}): ${messages.length} → ${truncatedMessages.length} messages, saved ${tokensSaved} tokens`
    );
    
    return { truncatedMessages, tokensSaved };
  }

  /**
   * Check if conversation needs truncation
   */
  shouldTruncateConversation<T extends { role: string; content: string }>(
    messages: T[]
  ): boolean {
    const totalTokens = this.estimateTokenCount(messages.map(m => m.content).join('\n'));
    // Use a much more conservative threshold - we want proactive management
    return totalTokens > 50000; // Reduced from 150k to trigger earlier truncation
  }

  /**
   * Start streaming token tracking
   */
  startStreamTracking(estimatedTokens: number): void {
    this.streamingInfo = {
      estimatedTokens,
      actualTokensSoFar: 0,
      streamInterrupted: false,
      toolDetected: false
    };
  }

  /**
   * Handle stream interruption when tool is detected
   */
  interruptStreamForTool(reason: string = 'Tool use detected'): StreamingTokenInfo {
    if (this.streamingInfo) {
      this.streamingInfo.streamInterrupted = true;
      this.streamingInfo.toolDetected = true;
      this.streamingInfo.interruptionReason = reason;
      
      this.outputChannel.appendLine(`⚡ Stream interrupted: ${reason}`);
    }
    
    return this.streamingInfo || {
      estimatedTokens: 0,
      actualTokensSoFar: 0,
      streamInterrupted: true,
      toolDetected: true,
      interruptionReason: reason
    };
  }

  /**
   * Update streaming token count
   */
  updateStreamTokens(tokens: number): void {
    if (this.streamingInfo) {
      this.streamingInfo.actualTokensSoFar += tokens;
    }
  }

  /**
   * Complete streaming and get final info
   */
  completeStream(): StreamingTokenInfo | null {
    const info = this.streamingInfo;
    this.streamingInfo = null;
    return info;
  }

  /**
   * Update context truncation settings
   */
  updateContextSettings(options: Partial<ContextTruncationOptions>): void {
    this.contextTruncationOptions = { ...this.contextTruncationOptions, ...options };
    this.outputChannel.appendLine(
      `⚙️ Context settings updated: strategy=${this.contextTruncationOptions.strategy}, maxTokens=${this.contextTruncationOptions.maxContextTokens}`
    );
  }

  /**
   * Get current context settings
   */
  getContextSettings(): ContextTruncationOptions {
    return { ...this.contextTruncationOptions };
  }

  /**
   * Format tool result for minimal token usage (Cline-style optimization)
   */
  formatToolResult(toolName: string, result: any, isSuccess: boolean): string {
    // Compact headers like Cline
    const status = isSuccess ? '✓' : '✗';
    
    if (!isSuccess) {
      return `[${status}] ${toolName}: ${result.error || 'Failed'}`;
    }
    
    // Handle different result formats
    let output = '';
    let metadata = '';
    
    // Extract content and metadata
    if (result.content !== undefined) {
      output = result.content;
    } else if (result.output !== undefined) {
      output = result.output;
    } else if (result.result !== undefined) {
      output = result.result;
    }
    
    if (typeof output === 'object') {
      output = JSON.stringify(output);
    }
    
    // Add metadata information for file operations
    if (result.metadata) {
      const meta = result.metadata;
      if (meta.totalLines && meta.linesShown) {
        metadata = `\n[File info: ${meta.linesShown}/${meta.totalLines} lines shown`;
        if (meta.startLine && meta.endLine) {
          metadata += `, lines ${meta.startLine}-${meta.endLine}`;
        }
        if (meta.hasMoreContent) {
          metadata += `, more content available`;
        }
        metadata += `]`;
      }
    }
    
    // Intelligent truncation that preserves important information
    if (output.length > 800) {
      // For file content, try to preserve beginning and end
      if (toolName === 'read_file' || result.filePath) {
        const truncatePoint = 600;
        const head = output.substring(0, truncatePoint);
        const tail = output.substring(output.length - 100);
        output = head + '\n\n...[CONTENT TRUNCATED - Use limit/offset parameters to read specific sections]...\n\n' + tail;
      } else {
        output = output.substring(0, 800) + '...[truncated]';
      }
    }
    
    return `[${status}] ${toolName}:${metadata}\n${output}`;
  }

  /**
   * Get formatted summary for display
   */
  getFormattedSummary(): string {
    const currentSession = this.getCurrentSessionStats();
    const overall = this.getOverallStats();
    const rateLimit = this.getRateLimitInfo();

    return `📊 **Token Usage Summary**

**Current Session:**
• Input: ${currentSession.totalInputTokens.toLocaleString()} tokens
• Output: ${currentSession.totalOutputTokens.toLocaleString()} tokens  
• Total: ${currentSession.totalTokens.toLocaleString()} tokens
• Cost: $${currentSession.totalCost.toFixed(4)}
• Requests: ${currentSession.requestCount}

**Last 24 Hours:**
• Total: ${overall.totalTokens.toLocaleString()} tokens
• Cost: $${overall.totalCost.toFixed(4)}
• Requests: ${overall.requestCount}
• Sessions: ${overall.sessionsCount}
• Avg per request: ${overall.averageRequestTokens} tokens

**Rate Limiting (Anthropic):**
• Used this minute: ${rateLimit.currentMinuteTokens.toLocaleString()}/${rateLimit.tokensPerMinute.toLocaleString()}
• Status: ${rateLimit.isLimitExceeded ? '🔴 EXCEEDED' : '🟢 OK'}
• Reset in: ${rateLimit.timeUntilReset}s`;
  }



  dispose(): void {
    this.saveUsageHistory();
    this.outputChannel.dispose();
  }
}
