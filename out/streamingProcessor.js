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
exports.createMockStream = exports.StreamingProcessor = void 0;
const vscode = __importStar(require("vscode"));
const llmToolCallParser_1 = require("./llmToolCallParser");
/**
 * Streaming response processor inspired by Cline's token-efficient approach
 * Key features:
 * - Early tool detection and interruption
 * - Incremental parsing to reduce memory usage
 * - Token-aware processing to minimize waste
 */
class StreamingProcessor {
    constructor(tools, config) {
        this.parser = new llmToolCallParser_1.LLMToolCallParser(tools);
        this.outputChannel = vscode.window.createOutputChannel('AccessLint Streaming');
        this.config = {
            chunkSize: 50,
            maxBufferSize: 8192,
            toolDetectionEnabled: true,
            earlyInterruptionEnabled: true,
            ...config
        };
    }
    /**
     * Process streaming response with early tool detection (Cline-style)
     */
    async processStream(streamSource, onToolDetected, onInterrupted) {
        const state = {
            buffer: '',
            totalTokens: 0,
            chunksProcessed: 0,
            toolDetected: false,
            interrupted: false
        };
        const detectedTools = [];
        let interruptionPoint;
        this.outputChannel.appendLine('🌊 Starting streaming processing...');
        try {
            const iterator = Symbol.asyncIterator in streamSource
                ? streamSource[Symbol.asyncIterator]()
                : streamSource;
            while (true) {
                const { value: chunk, done } = await iterator.next();
                if (done)
                    break;
                state.chunksProcessed++;
                state.buffer += chunk;
                state.totalTokens += this.estimateTokens(chunk);
                // Tool detection on every chunk (early interruption strategy)
                if (this.config.toolDetectionEnabled && !state.toolDetected) {
                    const streamingResult = this.parser.parseStreamingChunk(chunk);
                    if (streamingResult.hasCompleteToolCall && streamingResult.toolCallDetected) {
                        state.toolDetected = true;
                        state.detectedToolName = streamingResult.toolCallDetected;
                        detectedTools.push(streamingResult.toolCallDetected);
                        this.outputChannel.appendLine(`🔧 Tool detected: ${streamingResult.toolCallDetected} at chunk ${state.chunksProcessed}`);
                        if (onToolDetected) {
                            onToolDetected(streamingResult.toolCallDetected);
                        }
                        // Early interruption if enabled (Cline strategy) - interrupt when complete tool is detected
                        if (this.config.earlyInterruptionEnabled && streamingResult.hasCompleteToolCall) {
                            state.interrupted = true;
                            interruptionPoint = state.chunksProcessed;
                            const reason = `Tool ${streamingResult.toolCallDetected} detected, interrupting stream`;
                            this.outputChannel.appendLine(`⏹️ ${reason}`);
                            if (onInterrupted) {
                                onInterrupted(reason);
                            }
                            break;
                        }
                    }
                }
                // Buffer management - prevent memory issues
                if (state.buffer.length > this.config.maxBufferSize) {
                    const excess = state.buffer.length - this.config.maxBufferSize;
                    state.buffer = state.buffer.substring(excess);
                    this.outputChannel.appendLine(`📏 Buffer trimmed: removed ${excess} characters to stay under limit`);
                }
                // Yield control periodically
                if (state.chunksProcessed % 10 === 0) {
                    await new Promise(resolve => setImmediate(resolve));
                }
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Streaming error: ${error}`);
            throw error;
        }
        // Final parsing
        const parseResult = this.parser.parseResponse(state.buffer);
        // Calculate tokens saved through early interruption
        const tokensSaved = state.interrupted ?
            this.estimateTokensSaved(state.buffer, interruptionPoint) : 0;
        const result = {
            content: parseResult.text,
            toolCalls: parseResult.toolCalls,
            wasInterrupted: state.interrupted,
            tokensSaved,
            metadata: {
                chunksProcessed: state.chunksProcessed,
                interruptionPoint,
                detectedTools
            }
        };
        this.outputChannel.appendLine(`✅ Streaming complete: ${state.chunksProcessed} chunks, ` +
            `${state.totalTokens} tokens, ${parseResult.toolCalls.length} tools, ` +
            `interrupted: ${state.interrupted}, tokens saved: ${tokensSaved}`);
        return result;
    }
    /**
     * Process response chunk by chunk for large responses
     */
    async processChunked(content, onChunkProcessed) {
        const chunks = this.splitIntoChunks(content, this.config.chunkSize);
        const totalChunks = chunks.length;
        this.outputChannel.appendLine(`📦 Processing ${totalChunks} chunks...`);
        const state = {
            buffer: '',
            totalTokens: 0,
            chunksProcessed: 0,
            toolDetected: false,
            interrupted: false
        };
        const detectedTools = [];
        let interruptionPoint;
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            state.buffer += chunk;
            state.chunksProcessed++;
            state.totalTokens += this.estimateTokens(chunk);
            // Tool detection
            if (this.config.toolDetectionEnabled && !state.toolDetected) {
                const streamingResult = this.parser.parseStreamingChunk(chunk);
                if (streamingResult.hasCompleteToolCall && streamingResult.toolCallDetected) {
                    state.toolDetected = true;
                    state.detectedToolName = streamingResult.toolCallDetected;
                    detectedTools.push(streamingResult.toolCallDetected);
                    // Early interruption when complete tool is detected
                    if (this.config.earlyInterruptionEnabled && streamingResult.hasCompleteToolCall) {
                        state.interrupted = true;
                        interruptionPoint = i;
                        break;
                    }
                }
            }
            // Progress callback
            if (onChunkProcessed) {
                const progress = ((i + 1) / totalChunks) * 100;
                onChunkProcessed(chunk, progress);
            }
            // Yield control
            if (i % 5 === 0) {
                await new Promise(resolve => setImmediate(resolve));
            }
        }
        // Final parsing
        const parseResult = this.parser.parseResponse(state.buffer);
        const tokensSaved = state.interrupted ?
            this.estimateTokensSaved(content, interruptionPoint) : 0;
        return {
            content: parseResult.text,
            toolCalls: parseResult.toolCalls,
            wasInterrupted: state.interrupted,
            tokensSaved,
            metadata: {
                chunksProcessed: state.chunksProcessed,
                interruptionPoint,
                detectedTools
            }
        };
    }
    /**
     * Check if content contains tool calls without full parsing
     */
    quickToolDetection(content) {
        const quickPatterns = [
            /<tool_use[^>]*name="([^"]+)"/g,
            /(\w+)\s*\(\s*\{/g,
            /TOOL_CALL:\s*(\w+)/g
        ];
        const detectedTools = new Set();
        let totalMatches = 0;
        for (const pattern of quickPatterns) {
            const matches = [...content.matchAll(pattern)];
            totalMatches += matches.length;
            for (const match of matches) {
                const toolName = match[1];
                if (this.parser.getAvailableTools().includes(toolName)) {
                    detectedTools.add(toolName);
                }
            }
        }
        const confidence = totalMatches > 0 ? Math.min(1, detectedTools.size / totalMatches) : 0;
        return {
            hasTools: detectedTools.size > 0,
            toolNames: Array.from(detectedTools),
            confidence
        };
    }
    /**
     * Estimate tokens in text (rough approximation)
     */
    estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }
    /**
     * Estimate tokens saved through early interruption
     */
    estimateTokensSaved(fullContent, interruptionPoint) {
        if (!interruptionPoint)
            return 0;
        const chunks = this.splitIntoChunks(fullContent, this.config.chunkSize);
        const remainingChunks = chunks.slice(interruptionPoint);
        const remainingContent = remainingChunks.join('');
        return this.estimateTokens(remainingContent);
    }
    /**
     * Split content into manageable chunks
     */
    splitIntoChunks(content, chunkSize) {
        const chunks = [];
        for (let i = 0; i < content.length; i += chunkSize) {
            chunks.push(content.substring(i, i + chunkSize));
        }
        return chunks;
    }
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.outputChannel.appendLine(`⚙️ Streaming config updated: ${JSON.stringify(this.config)}`);
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Get streaming statistics
     */
    getStats() {
        return {
            config: this.config,
            parserStats: this.parser.getParserStats(),
            recommendedSettings: {
                chunkSize: 50,
                maxBufferSize: 8192,
                toolDetectionEnabled: true,
                earlyInterruptionEnabled: true
            }
        };
    }
    /**
     * Dispose resources
     */
    dispose() {
        this.outputChannel.dispose();
    }
}
exports.StreamingProcessor = StreamingProcessor;
/**
 * Create a mock stream for testing
 */
async function* createMockStream(content, chunkSize = 10, delay = 10) {
    for (let i = 0; i < content.length; i += chunkSize) {
        const chunk = content.substring(i, i + chunkSize);
        yield chunk;
        if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}
exports.createMockStream = createMockStream;
//# sourceMappingURL=streamingProcessor.js.map