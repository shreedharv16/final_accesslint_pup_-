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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicChatProvider = void 0;
const vscode = __importStar(require("vscode"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const apiKeyManager_1 = require("./apiKeyManager");
const tokenTracker_1 = require("./tokenTracker");
const contextManager_1 = require("./contextManager");
const rateLimiter_1 = require("./rateLimiter");
const retryUtils_1 = require("./retryUtils");
class AnthropicChatProvider {
    constructor(context) {
        this.context = context;
        this.client = null;
        this.config = null;
        this.conversationHistory = [];
        this.currentSessionId = null;
        // Prompt caching state
        this.systemPromptHash = null;
        this.toolsHash = null;
        this.cacheBreakpoints = new Set();
        this.lastCachedMessageIndex = -1;
        this.apiKeyManager = new apiKeyManager_1.ApiKeyManager(context);
        this.tokenTracker = new tokenTracker_1.TokenTracker(context);
        this.contextManager = new contextManager_1.ContextManager('claude-sonnet-4-20250514');
        this.outputChannel = vscode.window.createOutputChannel('AccessLint Prompt Caching');
        this.rateLimiter = new rateLimiter_1.RateLimiter({
            tokensPerMinute: 30000,
            requestsPerMinute: 50,
            burstThreshold: 24000 // Allow bursts up to 80% of limit
        });
        this.initializeClient();
    }
    async initializeClient() {
        try {
            console.log('🔧 Initializing Anthropic client...');
            if (this.outputChannel) {
                this.outputChannel.appendLine('🔧 DEBUG: Initializing Anthropic client...');
            }
            this.config = await this.apiKeyManager.getAnthropicConfig();
            console.log(`🔑 Anthropic config loaded: ${this.config ? 'YES' : 'NO'}`);
            if (this.outputChannel) {
                this.outputChannel.appendLine(`🔑 DEBUG: Anthropic config loaded: ${this.config ? 'YES' : 'NO'}`);
            }
            if (this.config) {
                console.log(`🤖 Using Anthropic model: ${this.config.model}`);
                if (this.outputChannel) {
                    this.outputChannel.appendLine(`🤖 DEBUG: Using Anthropic model: ${this.config.model}`);
                    this.outputChannel.appendLine(`🔗 DEBUG: Using base URL: ${this.config.baseUrl}`);
                }
                this.client = new sdk_1.default({
                    apiKey: this.config.apiKey,
                    baseURL: this.config.baseUrl
                });
                console.log('✅ Anthropic client initialized successfully');
                if (this.outputChannel) {
                    this.outputChannel.appendLine('✅ DEBUG: Anthropic client initialized successfully');
                }
            }
            else {
                console.log('❌ No Anthropic config available');
                if (this.outputChannel) {
                    this.outputChannel.appendLine('❌ DEBUG: No Anthropic config available');
                }
            }
        }
        catch (error) {
            console.error('Failed to initialize Anthropic client:', error);
            if (this.outputChannel) {
                this.outputChannel.appendLine(`❌ DEBUG: Failed to initialize Anthropic client: ${error}`);
            }
        }
    }
    async isConfigured() {
        const configured = await this.apiKeyManager.isAnthropicConfigured();
        console.log(`🔑 AnthropicChatProvider.isConfigured(): ${configured}`);
        if (this.outputChannel) {
            this.outputChannel.appendLine(`🔑 DEBUG: AnthropicChatProvider.isConfigured(): ${configured}`);
        }
        return configured;
    }
    /**
     * Wait for initialization to complete (compatibility with GeminiChatProvider)
     */
    async waitForInitialization() {
        // Anthropic provider initializes synchronously in constructor
        // This method is here for compatibility with the interface
        return Promise.resolve();
    }
    /**
     * Generate hash for cache invalidation
     */
    generateHash(content) {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }
    /**
     * Determine optimal cache breakpoints for message history (max 4 blocks)
     */
    determineCacheBreakpoints(messages) {
        const breakpoints = [];
        const MAX_CACHE_BLOCKS = 4; // Anthropic API limit
        const MIN_CACHE_SIZE = 3; // Minimum messages to cache
        if (messages.length < MIN_CACHE_SIZE) {
            return breakpoints;
        }
        // Strategy: Cache at strategic points to maximize effectiveness with 4-block limit
        const messageCount = messages.length;
        // 1. Always cache system message if present (most important)
        if (messageCount > 0 && messages[0].role === 'system') {
            breakpoints.push(0);
        }
        // 2. Distribute remaining cache blocks strategically
        const remainingBlocks = MAX_CACHE_BLOCKS - breakpoints.length;
        if (remainingBlocks > 0 && messageCount > 4) {
            // Calculate optimal distribution of remaining cache blocks
            const cacheableRange = messageCount - 2; // Don't cache last 2 messages
            const interval = Math.floor(cacheableRange / (remainingBlocks + 1));
            for (let i = 1; i <= remainingBlocks && interval * i < cacheableRange; i++) {
                const breakpoint = Math.min(interval * i, cacheableRange - 1);
                if (breakpoint > 0 && !breakpoints.includes(breakpoint)) {
                    breakpoints.push(breakpoint);
                }
            }
        }
        // Ensure we don't exceed the limit
        return breakpoints.slice(0, MAX_CACHE_BLOCKS);
    }
    /**
     * Apply cache control to messages based on breakpoints (strict 4-block limit)
     */
    applyCacheControl(messages, tools) {
        const breakpoints = this.determineCacheBreakpoints(messages);
        const cachedMessages = [];
        let cacheBlocksUsed = 0;
        const MAX_CACHE_BLOCKS = 4;
        // Validate we don't exceed the limit before applying
        if (breakpoints.length > MAX_CACHE_BLOCKS) {
            this.outputChannel.appendLine(`⚠️ Warning: Too many cache breakpoints (${breakpoints.length}), limiting to ${MAX_CACHE_BLOCKS}`);
            breakpoints.splice(MAX_CACHE_BLOCKS);
        }
        for (let i = 0; i < messages.length; i++) {
            const message = { ...messages[i] };
            // Apply cache control to breakpoint messages (with strict limit)
            if (breakpoints.includes(i) && cacheBlocksUsed < MAX_CACHE_BLOCKS) {
                if (typeof message.content === 'string') {
                    message.content = [{
                            type: 'text',
                            text: message.content,
                            cache_control: { type: 'ephemeral' }
                        }];
                    cacheBlocksUsed++;
                }
                else if (Array.isArray(message.content)) {
                    // Add cache control to the last content block
                    const lastContent = message.content[message.content.length - 1];
                    if (lastContent) {
                        lastContent.cache_control = { type: 'ephemeral' };
                        cacheBlocksUsed++;
                    }
                }
            }
            cachedMessages.push(message);
        }
        // Log final cache usage
        this.outputChannel.appendLine(`📦 Cache blocks used: ${cacheBlocksUsed}/${MAX_CACHE_BLOCKS}`);
        return cachedMessages;
    }
    /**
     * Check if cache is still valid
     */
    isCacheValid(systemPrompt, tools) {
        const currentSystemHash = systemPrompt ? this.generateHash(systemPrompt) : null;
        const currentToolsHash = tools ? this.generateHash(JSON.stringify(tools)) : null;
        return this.systemPromptHash === currentSystemHash &&
            this.toolsHash === currentToolsHash;
    }
    /**
     * Update cache hashes
     */
    updateCacheHashes(systemPrompt, tools) {
        this.systemPromptHash = systemPrompt ? this.generateHash(systemPrompt) : null;
        this.toolsHash = tools ? this.generateHash(JSON.stringify(tools)) : null;
    }
    async configureApiKey() {
        const success = await this.apiKeyManager.configureAnthropicApiKey();
        if (success) {
            await this.initializeClient();
        }
        return success;
    }
    async sendMessage(message, useHistory = true) {
        console.log(`🚀 AnthropicChatProvider.sendMessage() called with message length: ${message.length}`);
        if (this.outputChannel) {
            this.outputChannel.appendLine(`🚀 DEBUG: AnthropicChatProvider.sendMessage() called`);
            this.outputChannel.appendLine(`📝 DEBUG: Message length: ${message.length} characters`);
            this.outputChannel.appendLine(`🤖 DEBUG: Using model: ${this.config?.model || 'unknown'}`);
        }
        if (!this.client || !this.config) {
            console.log('❌ Anthropic client not configured');
            if (this.outputChannel) {
                this.outputChannel.appendLine('❌ DEBUG: Anthropic client not configured');
            }
            throw new Error('Anthropic client not configured. Please set up your API key first.');
        }
        try {
            // Prepare messages for API call with advanced context management
            let messages = useHistory ? [...this.conversationHistory] : [];
            // Apply sophisticated context management
            if (useHistory && messages.length > 0) {
                const messageContent = messages.map(msg => ({
                    role: msg.role,
                    content: typeof msg.content === 'string' ? msg.content :
                        Array.isArray(msg.content) ? msg.content.map(c => c.text).join('') : '',
                    timestamp: Date.now()
                }));
                const contextResult = await this.contextManager.manageContext(messageContent, 'moderate');
                if (contextResult.wasModified) {
                    messages = contextResult.messages.map(msg => ({
                        role: msg.role,
                        content: msg.content
                    }));
                    // Update conversation history with optimized version
                    this.conversationHistory = messages;
                    const { stats } = contextResult;
                    vscode.window.showInformationMessage(`🗜️ Context optimized: ${stats.truncatedMessages} messages removed, ${stats.tokensSaved} tokens saved`);
                }
            }
            const fullMessageHistory = [...messages, { role: 'user', content: message }];
            // Estimate input tokens for tracking
            const inputText = fullMessageHistory.map(m => m.content).join('\n');
            const estimatedInputTokens = this.tokenTracker.estimateTokenCount(inputText);
            // Estimate total tokens (input + estimated output)
            const estimatedOutputTokens = Math.min(4096, Math.max(500, estimatedInputTokens * 0.5)); // Conservative estimate
            const totalEstimatedTokens = estimatedInputTokens + estimatedOutputTokens;
            // Check rate limit before making the API call
            const requestId = `anthropic_regular_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const rateLimitAllowed = await this.rateLimiter.checkRateLimit(totalEstimatedTokens, requestId);
            if (!rateLimitAllowed) {
                throw new Error('Rate limit exceeded and maximum wait attempts reached');
            }
            // Start streaming token tracking
            this.tokenTracker.startStreamTracking(estimatedInputTokens);
            // Add user message to history
            if (useHistory) {
                this.conversationHistory.push({ role: 'user', content: message });
            }
            // Filter out system messages and send them separately if needed
            const systemMessages = fullMessageHistory.filter(msg => msg.role === 'system');
            const userAssistantMessages = fullMessageHistory.filter(msg => msg.role !== 'system');
            // Prepare system prompt for caching
            const systemPrompt = systemMessages.length > 0 ?
                systemMessages.map(msg => typeof msg.content === 'string' ? msg.content :
                    Array.isArray(msg.content) ? msg.content.map(c => c.text).join('') : '').join('\n') : undefined;
            // Check cache validity and apply cache controls
            if (!this.isCacheValid(systemPrompt) || this.shouldInvalidateCache(userAssistantMessages)) {
                this.updateCacheHashes(systemPrompt);
                this.lastCachedMessageIndex = -1; // Reset cache index
            }
            // Apply cache control to messages for optimal token savings
            const cachedMessages = this.applyCacheControl(userAssistantMessages);
            // Log cache usage and update tracking with safety validation
            const cacheBreakpoints = this.determineCacheBreakpoints(userAssistantMessages);
            if (cacheBreakpoints.length > 0) {
                // Safety check: ensure we don't exceed Anthropic's 4-block limit
                const safeBreakpoints = cacheBreakpoints.slice(0, 4);
                this.lastCachedMessageIndex = Math.max(...safeBreakpoints);
                this.outputChannel.appendLine(`🚀 Prompt caching active: ${safeBreakpoints.length}/4 breakpoints at indices [${safeBreakpoints.join(', ')}]`);
                if (cacheBreakpoints.length > 4) {
                    this.outputChannel.appendLine(`⚠️ Truncated ${cacheBreakpoints.length - 4} excess cache breakpoints`);
                }
                vscode.window.showInformationMessage(`🚀 Using prompt caching: ${safeBreakpoints.length}/4 cache breakpoints set`);
            }
            else {
                this.outputChannel.appendLine('ℹ️ No cache breakpoints set (conversation too short)');
            }
            // Make API call with caching and retry logic
            const response = await retryUtils_1.RetryUtils.retryApiCall(() => this.client.messages.create({
                model: this.config.model,
                max_tokens: 4096,
                temperature: 0.7,
                system: systemPrompt,
                messages: cachedMessages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                }))
            }), 'Anthropic Chat API Call');
            // Extract response content
            let responseText = '';
            if (response.content && response.content.length > 0) {
                const firstContent = response.content[0];
                if (firstContent.type === 'text') {
                    responseText = firstContent.text;
                }
            }
            if (!responseText) {
                throw new Error('No response content received from Anthropic');
            }
            // Complete streaming
            const streamInfo = this.tokenTracker.completeStream();
            // Track token usage
            const inputTokens = response.usage?.input_tokens || estimatedInputTokens;
            const outputTokens = response.usage?.output_tokens || this.tokenTracker.estimateTokenCount(responseText);
            const actualTotalTokens = inputTokens + outputTokens;
            // Record actual usage in rate limiter
            this.rateLimiter.recordUsage(actualTotalTokens, requestId);
            this.tokenTracker.trackApiUsage(inputTokens, outputTokens, this.config.model, 'anthropic', this.currentSessionId || undefined);
            // Add assistant response to history
            if (useHistory) {
                this.conversationHistory.push({ role: 'assistant', content: responseText });
            }
            console.log(`📨 AnthropicChatProvider.sendMessage() returning response length: ${responseText.length}`);
            if (this.outputChannel) {
                this.outputChannel.appendLine(`📨 DEBUG: AnthropicChatProvider.sendMessage() completed`);
                this.outputChannel.appendLine(`📄 DEBUG: Response length: ${responseText.length} characters`);
                this.outputChannel.appendLine(`📄 DEBUG: Response preview: ${responseText.substring(0, 100)}...`);
            }
            return responseText;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            // Handle specific API errors
            if (errorMessage.includes('Invalid API Key')) {
                throw new Error('Invalid Anthropic API key. Please check your configuration.');
            }
            else if (errorMessage.includes('rate limit')) {
                // Note: Rate limiting has been disabled - this is for informational purposes only
                throw new Error(`Anthropic API error: ${errorMessage}`);
            }
            else if (errorMessage.includes('quota')) {
                throw new Error('API quota exceeded. Please check your Anthropic account.');
            }
            throw new Error(`Anthropic API error: ${errorMessage}`);
        }
    }
    async sendMessageWithTools(message, tools, useHistory = true) {
        if (!this.client || !this.config) {
            throw new Error('Anthropic client not configured. Please set up your API key first.');
        }
        try {
            // Prepare messages for API call with aggressive context management for tool calls
            let messages = useHistory ? [...this.conversationHistory] : [];
            // Apply aggressive context management for tool calls (more aggressive strategy)
            if (useHistory && messages.length > 0) {
                const messageContent = messages.map(msg => ({
                    role: msg.role,
                    content: typeof msg.content === 'string' ? msg.content :
                        Array.isArray(msg.content) ? msg.content.map(c => c.text).join('') : '',
                    timestamp: Date.now()
                }));
                const contextResult = await this.contextManager.manageContext(messageContent, 'aggressive');
                if (contextResult.wasModified) {
                    messages = contextResult.messages.map(msg => ({
                        role: msg.role,
                        content: msg.content
                    }));
                    // Update conversation history with optimized version
                    this.conversationHistory = messages;
                }
            }
            const fullMessageHistory = [...messages, { role: 'user', content: message }];
            // Estimate input tokens for tracking
            const inputText = fullMessageHistory.map(m => m.content).join('\n') + JSON.stringify(tools);
            const estimatedInputTokens = this.tokenTracker.estimateTokenCount(inputText);
            // Estimate total tokens (input + estimated output)
            const estimatedOutputTokens = Math.min(4096, Math.max(500, estimatedInputTokens * 0.5)); // Conservative estimate
            const totalEstimatedTokens = estimatedInputTokens + estimatedOutputTokens;
            // Check rate limit before making the API call
            const requestId = `anthropic_tools_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const rateLimitAllowed = await this.rateLimiter.checkRateLimit(totalEstimatedTokens, requestId);
            if (!rateLimitAllowed) {
                throw new Error('Rate limit exceeded and maximum wait attempts reached');
            }
            // Start streaming token tracking
            this.tokenTracker.startStreamTracking(estimatedInputTokens);
            // Add user message to history
            if (useHistory) {
                this.conversationHistory.push({ role: 'user', content: message });
            }
            // Filter out system messages and send them separately if needed
            const systemMessages = fullMessageHistory.filter(msg => msg.role === 'system');
            const userAssistantMessages = fullMessageHistory.filter(msg => msg.role !== 'system');
            // Prepare system prompt and tools for caching
            const systemPrompt = systemMessages.length > 0 ?
                systemMessages.map(msg => typeof msg.content === 'string' ? msg.content :
                    Array.isArray(msg.content) ? msg.content.map(c => c.text).join('') : '').join('\n') : undefined;
            // Check cache validity including tools
            if (!this.isCacheValid(systemPrompt, tools) || this.shouldInvalidateCache(userAssistantMessages)) {
                this.updateCacheHashes(systemPrompt, tools);
                this.lastCachedMessageIndex = -1; // Reset cache index
            }
            // Apply cache control to messages for optimal token savings
            const cachedMessages = this.applyCacheControl(userAssistantMessages, tools);
            // Log cache usage for tools calls with safety validation
            const cacheBreakpoints = this.determineCacheBreakpoints(userAssistantMessages);
            if (cacheBreakpoints.length > 0) {
                // Safety check: ensure we don't exceed Anthropic's 4-block limit
                const safeBreakpoints = cacheBreakpoints.slice(0, 4);
                this.lastCachedMessageIndex = Math.max(...safeBreakpoints);
                this.outputChannel.appendLine(`🚀 Tool call with caching: ${safeBreakpoints.length}/4 cache breakpoints at [${safeBreakpoints.join(', ')}], tools cached: ${!!tools}`);
                if (cacheBreakpoints.length > 4) {
                    this.outputChannel.appendLine(`⚠️ Truncated ${cacheBreakpoints.length - 4} excess cache breakpoints for tools call`);
                }
            }
            else {
                this.outputChannel.appendLine(`ℹ️ Tool call without message caching (tools cached: ${!!tools})`);
            }
            // Make API call with tools, caching, and retry logic
            const response = await retryUtils_1.RetryUtils.retryApiCall(() => this.client.messages.create({
                model: this.config.model,
                max_tokens: 4096,
                temperature: 0.7,
                tools: tools,
                system: systemPrompt,
                messages: cachedMessages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                }))
            }), 'Anthropic Tools API Call');
            // Extract response content and tool calls with streaming interruption
            let responseText = '';
            let toolCalls = [];
            let streamInterrupted = false;
            if (response.content && response.content.length > 0) {
                for (const content of response.content) {
                    if (content.type === 'text') {
                        responseText += content.text;
                    }
                    else if (content.type === 'tool_use') {
                        // Interrupt stream immediately when tool is detected (Cline strategy)
                        const streamInfo = this.tokenTracker.interruptStreamForTool(`Tool ${content.name} detected`);
                        streamInterrupted = streamInfo.streamInterrupted;
                        toolCalls.push({
                            id: content.id,
                            name: content.name,
                            input: content.input
                        });
                        // Stop processing further content to minimize tokens (single tool per message)
                        break;
                    }
                }
            }
            // Complete streaming if not already interrupted
            if (!streamInterrupted) {
                this.tokenTracker.completeStream();
            }
            // Track token usage
            const inputTokens = response.usage?.input_tokens || estimatedInputTokens;
            const outputTokens = response.usage?.output_tokens || this.tokenTracker.estimateTokenCount(responseText + JSON.stringify(toolCalls));
            const actualTotalTokens = inputTokens + outputTokens;
            // Record actual usage in rate limiter
            this.rateLimiter.recordUsage(actualTotalTokens, requestId);
            this.tokenTracker.trackApiUsage(inputTokens, outputTokens, this.config.model, 'anthropic', this.currentSessionId || undefined);
            // Add assistant response to history (minimal for tool calls)
            if (useHistory) {
                const historyContent = toolCalls.length > 0
                    ? `[Tool: ${toolCalls[0].name}]` // Minimal history entry for tool calls
                    : responseText;
                this.conversationHistory.push({ role: 'assistant', content: historyContent });
            }
            return {
                response: responseText,
                toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                streamInterrupted
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Anthropic API error: ${errorMessage}`);
        }
    }
    getConversationHistory() {
        return [...this.conversationHistory];
    }
    clearConversation() {
        this.conversationHistory = [];
        this.invalidateCache();
    }
    /**
     * Invalidate all caches (call when conversation is cleared or context changes significantly)
     */
    invalidateCache() {
        this.outputChannel.appendLine('🗑️ Cache invalidated - fresh caching will begin on next call');
        this.systemPromptHash = null;
        this.toolsHash = null;
        this.cacheBreakpoints.clear();
        this.lastCachedMessageIndex = -1;
    }
    /**
     * Smart cache invalidation based on conversation length and content changes
     */
    shouldInvalidateCache(messages) {
        const CONVERSATION_RESET_THRESHOLD = 20; // Reset cache every 20 messages to avoid stale data
        const currentMessageCount = messages.length;
        // Reset cache if conversation is getting very long
        if (currentMessageCount > CONVERSATION_RESET_THRESHOLD &&
            this.lastCachedMessageIndex > 0 &&
            (currentMessageCount - this.lastCachedMessageIndex) > CONVERSATION_RESET_THRESHOLD) {
            this.outputChannel.appendLine(`🔄 Auto-invalidating cache due to conversation length: ${currentMessageCount} messages`);
            return true;
        }
        return false;
    }
    /**
     * Get cache statistics for monitoring
     */
    getCacheStats() {
        return {
            systemPromptCached: this.systemPromptHash !== null,
            toolsCached: this.toolsHash !== null,
            messageBreakpoints: this.cacheBreakpoints.size,
            lastCachedIndex: this.lastCachedMessageIndex
        };
    }
    /**
     * Start a new chat session (clears history and starts fresh token tracking)
     */
    startNewSession() {
        this.conversationHistory = [];
        this.currentSessionId = this.tokenTracker.startNewSession();
        this.invalidateCache(); // Reset caching for new session
    }
    /**
     * Get token usage statistics
     */
    getTokenUsageStats() {
        return {
            currentSession: this.tokenTracker.getCurrentSessionStats(),
            overall: this.tokenTracker.getOverallStats(),
            anthropicOnly: this.tokenTracker.getStatsByProvider('anthropic'),
            rateLimitInfo: this.tokenTracker.getRateLimitInfo()
        };
    }
    /**
     * Get formatted token usage summary
     */
    getFormattedTokenSummary() {
        const tokenSummary = this.tokenTracker.getFormattedSummary();
        const cacheStats = this.getCacheStats();
        const cacheSummary = `\n\n**🚀 Prompt Caching Status:**
• System prompt cached: ${cacheStats.systemPromptCached ? '✅' : '❌'}
• Tools cached: ${cacheStats.toolsCached ? '✅' : '❌'}
• Message breakpoints: ${cacheStats.messageBreakpoints}
• Last cached index: ${cacheStats.lastCachedIndex >= 0 ? cacheStats.lastCachedIndex : 'None'}

*With prompt caching, you should see 60-80% token reduction on subsequent calls!*`;
        return tokenSummary + cacheSummary;
    }
    /**
     * Test caching effectiveness by simulating a conversation
     */
    async testCachingEffectiveness() {
        this.outputChannel.appendLine('🧪 Testing prompt caching effectiveness...');
        // Store original state
        const originalHistory = [...this.conversationHistory];
        try {
            // Test without caching (simulate by clearing cache)
            this.invalidateCache();
            const testMessage = "Please analyze this codebase structure and accessibility patterns.";
            // First call (no cache)
            const startTime1 = Date.now();
            this.invalidateCache(); // Force no caching
            const response1 = await this.sendMessage(testMessage, true);
            const time1 = Date.now() - startTime1;
            const tokens1 = this.tokenTracker.estimateTokenCount(response1);
            // Second call (with caching)
            const startTime2 = Date.now();
            const response2 = await this.sendMessage("Can you elaborate on the accessibility features?", true);
            const time2 = Date.now() - startTime2;
            const tokens2 = this.tokenTracker.estimateTokenCount(response2);
            const tokenSavings = tokens1 - tokens2;
            const percentageSavings = tokens1 > 0 ? (tokenSavings / tokens1) * 100 : 0;
            this.outputChannel.appendLine(`📊 Caching test results:`);
            this.outputChannel.appendLine(`  Without caching: ${tokens1} tokens, ${time1}ms`);
            this.outputChannel.appendLine(`  With caching: ${tokens2} tokens, ${time2}ms`);
            this.outputChannel.appendLine(`  Savings: ${tokenSavings} tokens (${percentageSavings.toFixed(1)}%)`);
            return {
                withoutCaching: { tokens: tokens1, time: time1 },
                withCaching: { tokens: tokens2, time: time2 },
                tokenSavings,
                percentageSavings
            };
        }
        finally {
            // Restore original state
            this.conversationHistory = originalHistory;
        }
    }
    /**
     * Reset token usage statistics
     */
    resetTokenStats() {
        this.tokenTracker.resetStats();
    }
    /**
     * Update context truncation settings
     */
    updateContextSettings(strategy, maxTokens) {
        this.tokenTracker.updateContextSettings({
            strategy,
            ...(maxTokens && { maxContextTokens: maxTokens })
        });
    }
    /**
     * Get current context settings
     */
    getContextSettings() {
        return this.tokenTracker.getContextSettings();
    }
    /**
     * Get the context manager instance
     */
    getContextManager() {
        return this.contextManager;
    }
    /**
     * Format tool result using Cline-style optimization
     */
    formatToolResult(toolName, result, isSuccess) {
        return this.tokenTracker.formatToolResult(toolName, result, isSuccess);
    }
    async getCurrentModel() {
        const model = this.config?.model || 'claude-sonnet-4-20250514';
        this.contextManager.updateModel(model);
        return model;
    }
    async updateConfiguration() {
        await this.initializeClient();
        this.invalidateCache(); // Reset cache when configuration changes
    }
    /**
     * Configure prompt caching settings
     */
    configureCaching(options) {
        // These could be made configurable if needed
        this.outputChannel.appendLine(`⚙️ Caching configuration updated: ${JSON.stringify(options)}`);
        // For now, these are constants in the methods, but this provides the interface
    }
    // Test the connection
    async testConnection() {
        try {
            const testResponse = await this.sendMessage('Hello, please respond with just "Hello"', false);
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    // Get usage statistics (if available from API)
    async getUsageStats() {
        // Anthropic doesn't provide usage stats in the same way as OpenAI
        // This could be expanded if they add such features
        return {
            tokensUsed: 'Not available',
            requestsToday: 'Not available'
        };
    }
    // Format conversation for export
    formatConversationForExport() {
        return this.conversationHistory
            .map(msg => `**${msg.role.toUpperCase()}**: ${msg.content}`)
            .join('\n\n');
    }
    // Estimate token count (rough approximation)
    estimateTokenCount(text) {
        // Rough estimation: ~4 characters per token for English text
        return Math.ceil(text.length / 4);
    }
    // Get conversation token count
    getConversationTokenCount() {
        const fullConversation = this.conversationHistory
            .map(msg => msg.content)
            .join(' ');
        return this.estimateTokenCount(fullConversation);
    }
    /**
     * Get current rate limiting status
     */
    getRateLimitStatus() {
        return this.rateLimiter.getCurrentUsage();
    }
    dispose() {
        this.clearConversation();
        this.tokenTracker.dispose();
        this.rateLimiter.dispose();
        this.outputChannel.dispose();
        this.client = null;
        this.config = null;
    }
}
exports.AnthropicChatProvider = AnthropicChatProvider;
//# sourceMappingURL=anthropicChat.js.map