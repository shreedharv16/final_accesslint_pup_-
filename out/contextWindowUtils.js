"use strict";
/**
 * Context window utilities for AccessLint Agent
 * Inspired by Cline's context management approach
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTruncationStrategy = exports.shouldTruncateProactively = exports.estimateTokenCount = exports.getContextWindowInfo = void 0;
/**
 * Gets context window information for different models
 */
function getContextWindowInfo(modelId) {
    let contextWindow = 200000; // Default for Claude models
    // Handle different model types
    if (modelId.toLowerCase().includes('claude-sonnet-4') || modelId.toLowerCase().includes('claude-4')) {
        contextWindow = 200000; // Claude Sonnet 4 has same context window as 3.5
    }
    else if (modelId.toLowerCase().includes('claude-3-5-sonnet')) {
        contextWindow = 200000;
    }
    else if (modelId.toLowerCase().includes('claude-3-haiku')) {
        contextWindow = 200000;
    }
    else if (modelId.toLowerCase().includes('claude-2')) {
        contextWindow = 100000;
    }
    else if (modelId.toLowerCase().includes('gemini')) {
        contextWindow = 128000;
    }
    else if (modelId.toLowerCase().includes('gpt-4')) {
        contextWindow = 128000;
    }
    else if (modelId.toLowerCase().includes('deepseek')) {
        contextWindow = 64000;
    }
    let maxAllowedSize;
    let recommendedTruncationThreshold;
    switch (contextWindow) {
        case 64000: // DeepSeek models
            maxAllowedSize = contextWindow - 20000; // 44k
            recommendedTruncationThreshold = contextWindow - 30000; // 34k
            break;
        case 100000: // Claude 2
            maxAllowedSize = contextWindow - 25000; // 75k
            recommendedTruncationThreshold = contextWindow - 35000; // 65k
            break;
        case 128000: // GPT-4, Gemini
            maxAllowedSize = contextWindow - 30000; // 98k
            recommendedTruncationThreshold = contextWindow - 40000; // 88k
            break;
        case 200000: // Claude 3.5 Sonnet
            maxAllowedSize = contextWindow - 40000; // 160k
            recommendedTruncationThreshold = contextWindow - 60000; // 140k
            break;
        default:
            // Safe fallback for unknown models
            maxAllowedSize = Math.max(contextWindow - 40000, contextWindow * 0.75);
            recommendedTruncationThreshold = Math.max(contextWindow - 60000, contextWindow * 0.65);
    }
    return {
        contextWindow,
        maxAllowedSize,
        recommendedTruncationThreshold
    };
}
exports.getContextWindowInfo = getContextWindowInfo;
/**
 * Estimates token count for text (more accurate than simple character division)
 */
function estimateTokenCount(text) {
    // More sophisticated token estimation
    // Account for different types of content
    // Tool calls and structured content tend to be more token-dense
    const toolCallPattern = /TOOL_CALL:|INPUT:|Result:/g;
    const isToolHeavy = (text.match(toolCallPattern) || []).length > 0;
    // Code tends to be more token-dense than natural language
    const codePattern = /```[\s\S]*?```|function\s+\w+|class\s+\w+|import\s+|export\s+/g;
    const isCodeHeavy = (text.match(codePattern) || []).length > 0;
    // File paths and technical content
    const technicalPattern = /\/[^\/\s]+|\.js|\.ts|\.py|\.java|src\/|node_modules/g;
    const isTechnical = (text.match(technicalPattern) || []).length > 3;
    let divisor = 4; // Default ~4 chars per token
    if (isToolHeavy) {
        divisor = 3; // Tools are token-dense
    }
    else if (isCodeHeavy) {
        divisor = 3.2; // Code is moderately token-dense
    }
    else if (isTechnical) {
        divisor = 3.5; // Technical content is somewhat token-dense
    }
    else {
        divisor = 4.2; // Natural language is less token-dense
    }
    return Math.ceil(text.length / divisor);
}
exports.estimateTokenCount = estimateTokenCount;
/**
 * Check if we're approaching token limits for proactive management
 */
function shouldTruncateProactively(currentTokens, modelId, aggressiveness = 'moderate') {
    const { recommendedTruncationThreshold } = getContextWindowInfo(modelId);
    let threshold = recommendedTruncationThreshold;
    // Adjust threshold based on aggressiveness
    switch (aggressiveness) {
        case 'conservative':
            threshold = recommendedTruncationThreshold * 0.7; // Truncate earlier
            break;
        case 'aggressive':
            threshold = recommendedTruncationThreshold * 1.2; // Truncate later
            break;
        // 'moderate' uses the default threshold
    }
    return currentTokens >= threshold;
}
exports.shouldTruncateProactively = shouldTruncateProactively;
/**
 * Calculate how much to truncate based on current usage
 */
function getTruncationStrategy(currentTokens, modelId) {
    const { maxAllowedSize, recommendedTruncationThreshold } = getContextWindowInfo(modelId);
    if (currentTokens >= maxAllowedSize) {
        return 'quarter'; // Emergency truncation
    }
    else if (currentTokens >= recommendedTruncationThreshold * 1.5) {
        return 'half'; // Aggressive truncation
    }
    else if (currentTokens >= recommendedTruncationThreshold) {
        return 'lastTwo'; // Moderate truncation
    }
    return 'none'; // No truncation needed
}
exports.getTruncationStrategy = getTruncationStrategy;
//# sourceMappingURL=contextWindowUtils.js.map