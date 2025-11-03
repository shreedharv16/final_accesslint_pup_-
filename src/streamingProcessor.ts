import * as vscode from 'vscode';
import { LLMToolCallParser } from './llmToolCallParser';
import { ToolDefinition } from './tools-accesslint/types';

export interface StreamingConfig {
  chunkSize: number;
  maxBufferSize: number;
  toolDetectionEnabled: boolean;
  earlyInterruptionEnabled: boolean;
}

export interface StreamingState {
  buffer: string;
  totalTokens: number;
  chunksProcessed: number;
  toolDetected: boolean;
  interrupted: boolean;
  detectedToolName?: string;
}

export interface StreamingResult {
  content: string;
  toolCalls: any[];
  wasInterrupted: boolean;
  tokensSaved: number;
  metadata: {
    chunksProcessed: number;
    interruptionPoint?: number;
    detectedTools: string[];
  };
}

/**
 * Streaming response processor inspired by Cline's token-efficient approach
 * Key features:
 * - Early tool detection and interruption
 * - Incremental parsing to reduce memory usage
 * - Token-aware processing to minimize waste
 */
export class StreamingProcessor {
  private parser: LLMToolCallParser;
  private outputChannel: vscode.OutputChannel;
  private config: StreamingConfig;

  constructor(tools: ToolDefinition[], config?: Partial<StreamingConfig>) {
    this.parser = new LLMToolCallParser(tools);
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
  async processStream(
    streamSource: AsyncIterable<string> | AsyncIterator<string>,
    onToolDetected?: (toolName: string) => void,
    onInterrupted?: (reason: string) => void
  ): Promise<StreamingResult> {
    const state: StreamingState = {
      buffer: '',
      totalTokens: 0,
      chunksProcessed: 0,
      toolDetected: false,
      interrupted: false
    };

    const detectedTools: string[] = [];
    let interruptionPoint: number | undefined;

    this.outputChannel.appendLine('🌊 Starting streaming processing...');

    try {
      const iterator = Symbol.asyncIterator in streamSource 
        ? streamSource[Symbol.asyncIterator]() 
        : streamSource as AsyncIterator<string>;

      while (true) {
        const { value: chunk, done } = await iterator.next();
        
        if (done) break;

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
            
            this.outputChannel.appendLine(
              `🔧 Tool detected: ${streamingResult.toolCallDetected} at chunk ${state.chunksProcessed}`
            );

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
          
          this.outputChannel.appendLine(
            `📏 Buffer trimmed: removed ${excess} characters to stay under limit`
          );
        }

        // Yield control periodically
        if (state.chunksProcessed % 10 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }

    } catch (error) {
      this.outputChannel.appendLine(`❌ Streaming error: ${error}`);
      throw error;
    }

    // Final parsing
    const parseResult = this.parser.parseResponse(state.buffer);
    
    // Calculate tokens saved through early interruption
    const tokensSaved = state.interrupted ? 
      this.estimateTokensSaved(state.buffer, interruptionPoint) : 0;

    const result: StreamingResult = {
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

    this.outputChannel.appendLine(
      `✅ Streaming complete: ${state.chunksProcessed} chunks, ` +
      `${state.totalTokens} tokens, ${parseResult.toolCalls.length} tools, ` +
      `interrupted: ${state.interrupted}, tokens saved: ${tokensSaved}`
    );

    return result;
  }

  /**
   * Process response chunk by chunk for large responses
   */
  async processChunked(
    content: string,
    onChunkProcessed?: (chunk: string, progress: number) => void
  ): Promise<StreamingResult> {
    const chunks = this.splitIntoChunks(content, this.config.chunkSize);
    const totalChunks = chunks.length;
    
    this.outputChannel.appendLine(`📦 Processing ${totalChunks} chunks...`);

    const state: StreamingState = {
      buffer: '',
      totalTokens: 0,
      chunksProcessed: 0,
      toolDetected: false,
      interrupted: false
    };

    const detectedTools: string[] = [];
    let interruptionPoint: number | undefined;

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
  quickToolDetection(content: string): {
    hasTools: boolean;
    toolNames: string[];
    confidence: number;
  } {
    const quickPatterns = [
      /<tool_use[^>]*name="([^"]+)"/g,
      /(\w+)\s*\(\s*\{/g,
      /TOOL_CALL:\s*(\w+)/g
    ];

    const detectedTools = new Set<string>();
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
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate tokens saved through early interruption
   */
  private estimateTokensSaved(fullContent: string, interruptionPoint?: number): number {
    if (!interruptionPoint) return 0;
    
    const chunks = this.splitIntoChunks(fullContent, this.config.chunkSize);
    const remainingChunks = chunks.slice(interruptionPoint);
    const remainingContent = remainingChunks.join('');
    
    return this.estimateTokens(remainingContent);
  }

  /**
   * Split content into manageable chunks
   */
  private splitIntoChunks(content: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.substring(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<StreamingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.outputChannel.appendLine(`⚙️ Streaming config updated: ${JSON.stringify(this.config)}`);
  }

  /**
   * Get current configuration
   */
  getConfig(): StreamingConfig {
    return { ...this.config };
  }

  /**
   * Get streaming statistics
   */
  getStats(): {
    config: StreamingConfig;
    parserStats: any;
    recommendedSettings: Partial<StreamingConfig>;
  } {
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
  dispose(): void {
    this.outputChannel.dispose();
  }
}

/**
 * Create a mock stream for testing
 */
export async function* createMockStream(content: string, chunkSize: number = 10, delay: number = 10): AsyncGenerator<string> {
  for (let i = 0; i < content.length; i += chunkSize) {
    const chunk = content.substring(i, i + chunkSize);
    yield chunk;
    
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
