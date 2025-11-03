/**
 * Context Manager for AccessLint Agent
 * Inspired by Cline's sophisticated context management
 */

import * as vscode from 'vscode';
import {
  getContextWindowInfo,
  estimateTokenCount,
  shouldTruncateProactively,
  getTruncationStrategy
} from './contextWindowUtils';



export interface MessageContent {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{
    type: 'text';
    text: string;
    cache_control?: {
      type: 'ephemeral';
    };
  }>;
  timestamp?: number;
  tokens?: number;
  cache_control?: {
    type: 'ephemeral';
  };
}

export interface ContextStats {
  totalMessages: number;
  totalTokens: number;
  truncatedMessages: number;
  tokensSaved: number;
}

export interface TruncationResult {
  messages: MessageContent[];
  stats: ContextStats;
  wasModified: boolean;
}

export class ContextManager {
  private outputChannel: vscode.OutputChannel;
  private currentModelId: string;
  
  // Context optimization settings
  private readonly MAX_DUPLICATE_CONTENT_LENGTH = 1000;
  private readonly MIN_CONTENT_LENGTH_TO_OPTIMIZE = 200;
  
  constructor(modelId: string = 'claude-sonnet-4-20250514') {
    this.outputChannel = vscode.window.createOutputChannel('AccessLint Context Manager');
    this.currentModelId = modelId;
  }

  /**
   * Update the model ID for context window calculations
   */
  updateModel(modelId: string): void {
    this.currentModelId = modelId;
    this.outputChannel.appendLine(`📋 Context manager updated for model: ${modelId}`);
  }

  /**
   * Main entry point for context management
   */
  async manageContext(
    messages: MessageContent[],
    aggressiveness: 'conservative' | 'moderate' | 'aggressive' = 'moderate'
  ): Promise<TruncationResult> {
    if (messages.length === 0) {
      return {
        messages: [],
        stats: { totalMessages: 0, totalTokens: 0, truncatedMessages: 0, tokensSaved: 0 },
        wasModified: false
      };
    }

    // Add token counts to messages if not present
    const messagesWithTokens = this.addTokenCounts(messages);
    
    // Calculate current usage
    const currentTokens = this.calculateTotalTokens(messagesWithTokens);
    const { contextWindow, maxAllowedSize } = getContextWindowInfo(this.currentModelId);
    
    this.outputChannel.appendLine(
      `📊 Context analysis: ${messagesWithTokens.length} messages, ${currentTokens} tokens (${Math.round((currentTokens / contextWindow) * 100)}% of ${contextWindow})`
    );

    // Step 1: Content optimization (remove duplicates, compress tool results)
    const optimizedMessages = this.optimizeContent(messagesWithTokens);
    const optimizedTokens = this.calculateTotalTokens(optimizedMessages);

    // Step 1.5: Apply duplicate file read optimization
    const fileReadMap = new Map<string, { firstIndex: number; content: string; timestamp: number }>();
    const [hasFileOptimizations, messagesToOptimize, updatedFileReadMap] = this.findAndPotentiallySaveFileReadContextHistoryUpdates(
      optimizedMessages,
      0,
      Date.now(),
      fileReadMap
    );

    let finalMessages = optimizedMessages;
    if (hasFileOptimizations) {
      finalMessages = this.applyFileReadOptimizations(optimizedMessages, messagesToOptimize, updatedFileReadMap);
      this.outputChannel.appendLine(`💾 Applied ${messagesToOptimize.size} file read optimizations`);
    }

    let wasModified = optimizedMessages.length !== messagesWithTokens.length ||
                     optimizedTokens !== currentTokens ||
                     hasFileOptimizations;
    
    // Step 2: Check if we need truncation
    if (shouldTruncateProactively(optimizedTokens, this.currentModelId, aggressiveness)) {
      const truncationStrategy = getTruncationStrategy(optimizedTokens, this.currentModelId);
      
      if (truncationStrategy !== 'none') {
        const truncated = this.truncateMessages(optimizedMessages, truncationStrategy);
        finalMessages = truncated.messages;
        wasModified = true;
        
        this.outputChannel.appendLine(
          `🗜️ Applied ${truncationStrategy} truncation: ${optimizedMessages.length} → ${finalMessages.length} messages`
        );
      }
    }

    // Step 3: Emergency truncation if still too large
    const finalTokens = this.calculateTotalTokens(finalMessages);
    if (finalTokens >= maxAllowedSize) {
      this.outputChannel.appendLine(`🚨 Emergency truncation needed: ${finalTokens} >= ${maxAllowedSize}`);
      const emergencyTruncated = this.emergencyTruncate(finalMessages);
      finalMessages = emergencyTruncated.messages;
      wasModified = true;
    }

    const stats: ContextStats = {
      totalMessages: messages.length,
      totalTokens: currentTokens,
      truncatedMessages: messages.length - finalMessages.length,
      tokensSaved: currentTokens - this.calculateTotalTokens(finalMessages)
    };

    return {
      messages: finalMessages,
      stats,
      wasModified
    };
  }

  /**
   * Add token counts to messages that don't have them
   */
  private addTokenCounts(messages: MessageContent[]): MessageContent[] {
    return messages.map(msg => {
      const contentText = this.extractTextFromContent(msg.content);
      return {
        ...msg,
        tokens: msg.tokens || estimateTokenCount(contentText),
        timestamp: msg.timestamp || Date.now()
      };
    });
  }

  /**
   * Extract text content from either string or array format
   */
  private extractTextFromContent(content: string | Array<{type: 'text'; text: string; cache_control?: {type: 'ephemeral'}}>): string {
    if (typeof content === 'string') {
      return content;
    }
    return content.map(block => block.text).join('');
  }

  /**
   * Calculate total tokens across all messages
   */
  private calculateTotalTokens(messages: MessageContent[]): number {
    return messages.reduce((total, msg) => {
      const contentText = this.extractTextFromContent(msg.content);
      return total + (msg.tokens || estimateTokenCount(contentText));
    }, 0);
  }

  /**
   * Optimize content by removing duplicates and compressing tool results
   */
  private optimizeContent(messages: MessageContent[]): MessageContent[] {
    const optimized: MessageContent[] = [];
    const seenContent = new Set<string>();
    const fileReadCache = new Map<string, number>(); // filename -> first occurrence index
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      let content = this.extractTextFromContent(msg.content);
      let shouldInclude = true;

      // Always keep system messages and the first user-assistant pair
      if (msg.role === 'system' || i < 2) {
        optimized.push(msg);
        continue;
      }

      // Detect and handle duplicate file reads
      const fileReadMatch = content.match(/(?:read_file|TOOL_CALL: read_file)[\s\S]*?(?:Result:|OUTPUT:)([\s\S]*?)(?=\n\n|\n[A-Z]|$)/);
      if (fileReadMatch) {
        const filePathMatch = content.match(/(?:file_path|path)["']?\s*:\s*["']?([^"',\s}]+)/);
        if (filePathMatch) {
          const filePath = filePathMatch[1];
          
          if (fileReadCache.has(filePath)) {
            // This is a duplicate file read - replace with reference
            content = this.createFileReadReference(filePath, fileReadCache.get(filePath)!);
            this.outputChannel.appendLine(`🔄 Optimized duplicate file read: ${filePath}`);
          } else {
            fileReadCache.set(filePath, i);
          }
        }
      }

      // Check for other types of duplicate content
      if (content.length > this.MIN_CONTENT_LENGTH_TO_OPTIMIZE) {
        const contentHash = this.hashContent(content);
        if (seenContent.has(contentHash)) {
          // Skip duplicate content
          this.outputChannel.appendLine(`🔄 Skipped duplicate content (${content.length} chars)`);
          shouldInclude = false;
        } else {
          seenContent.add(contentHash);
        }
      }

      // Compress tool results that are very long
      if (content.length > this.MAX_DUPLICATE_CONTENT_LENGTH) {
        content = this.compressToolResult(content);
      }

      if (shouldInclude) {
        optimized.push({
          ...msg,
          content: content, // Keep as string after optimization
          tokens: estimateTokenCount(content)
        });
      }
    }

    return optimized;
  }

  /**
   * Create a reference to a previously read file instead of duplicating content
   */
  private createFileReadReference(filePath: string, originalIndex: number): string {
    return `[FILE READ REFERENCE] ${filePath}

This file was previously read in message ${originalIndex}. Content has been optimized to save context space.

To see the full content, refer to the earlier message or re-read the file if needed.`;
  }

  /**
   * Create a simple hash of content for duplicate detection
   */
  private hashContent(content: string): string {
    // Simple hash function for duplicate detection
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }



  /**
   * Truncate messages based on strategy using intelligent truncation
   */
  private truncateMessages(
    messages: MessageContent[],
    strategy: 'quarter' | 'half' | 'lastTwo'
  ): { messages: MessageContent[]; tokensSaved: number } {
    const originalTokens = this.calculateTotalTokens(messages);

    if (messages.length <= 2) {
      return { messages, tokensSaved: 0 };
    }

    // Use intelligent truncation to determine the range to remove
    const truncationRange = this.getNextTruncationRange(messages, undefined, strategy);
    const [removeStart, removeEnd] = truncationRange;

    // If no truncation needed, return original messages
    if (removeStart >= messages.length || removeEnd < removeStart) {
      return { messages, tokensSaved: 0 };
    }

    // Create truncated messages array
    let result: MessageContent[] = [];

    // Keep messages before the truncation range
    if (removeStart > 0) {
      result = result.concat(messages.slice(0, removeStart));
    }

    // Keep messages after the truncation range
    if (removeEnd + 1 < messages.length) {
      result = result.concat(messages.slice(removeEnd + 1));
    }

    // Add truncation notice to the first assistant message if it exists
    if (result.length >= 2 && result[1].role === 'assistant') {
      const contentText = this.extractTextFromContent(result[1].content);
      const truncatedCount = messages.length - result.length;
      const newContent = `[CONTEXT TRUNCATED] ${truncatedCount} previous messages have been removed to manage context size.\n\n${contentText}`;
      result[1] = {
        ...result[1],
        content: newContent,
        tokens: estimateTokenCount(newContent)
      };
    }

    const newTokens = this.calculateTotalTokens(result);
    return {
      messages: result,
      tokensSaved: originalTokens - newTokens
    };
  }

  /**
   * Emergency truncation when still over limits after regular truncation
   */
  private emergencyTruncate(messages: MessageContent[]): { messages: MessageContent[]; tokensSaved: number } {
    const originalTokens = this.calculateTotalTokens(messages);
    
    // Keep only the system message (if any) and last 2 messages
    const systemMessages = messages.filter(msg => msg.role === 'system');
    const nonSystemMessages = messages.filter(msg => msg.role !== 'system');
    const lastTwo = nonSystemMessages.slice(-2);
    
    const result = [...systemMessages, ...lastTwo];
    
    // Add emergency truncation notice
    if (result.length > 0) {
      const firstMessage = result[0];
      const contentText = this.extractTextFromContent(firstMessage.content);
      const newContent = `[EMERGENCY CONTEXT TRUNCATION] Context size exceeded safe limits. Most conversation history has been removed.\n\n${contentText}`;
      result[0] = {
        ...firstMessage,
        content: newContent,
        tokens: estimateTokenCount(newContent)
      };
    }

    const newTokens = this.calculateTotalTokens(result);
    return { 
      messages: result, 
      tokensSaved: originalTokens - newTokens 
    };
  }

  /**
   * Get context statistics
   */
  getContextStats(messages: MessageContent[]): ContextStats {
    const totalMessages = messages.length;
    const totalTokens = this.calculateTotalTokens(messages);
    
    return {
      totalMessages,
      totalTokens,
      truncatedMessages: 0,
      tokensSaved: 0
    };
  }

  /**
   * Check if context needs management
   */
  needsManagement(messages: MessageContent[]): boolean {
    const totalTokens = this.calculateTotalTokens(messages);
    return shouldTruncateProactively(totalTokens, this.currentModelId, 'conservative');
  }

  /**
   * Public method to apply duplicate file read optimization
   * Can be used externally to optimize conversation history
   */
  public optimizeDuplicateFileReads(
    messages: MessageContent[],
    startFromIndex: number = 0
  ): { optimizedMessages: MessageContent[]; optimizationsApplied: number; tokensSaved: number } {
    const originalTokens = this.calculateTotalTokens(messages);

    // Find and apply optimizations
    const [hasOptimizations, messagesToOptimize, fileReadMap] = this.findAndPotentiallySaveFileReadContextHistoryUpdates(
      messages,
      startFromIndex,
      Date.now()
    );

    let optimizedMessages = messages;
    let optimizationsApplied = 0;

    if (hasOptimizations) {
      optimizedMessages = this.applyFileReadOptimizations(messages, messagesToOptimize, fileReadMap);
      optimizationsApplied = messagesToOptimize.size;
    }

    const newTokens = this.calculateTotalTokens(optimizedMessages);
    const tokensSaved = originalTokens - newTokens;

    return {
      optimizedMessages,
      optimizationsApplied,
      tokensSaved
    };
  }

  /**
   * Public method to get intelligent truncation range for external use
   */
  public getIntelligentTruncationRange(
    messages: MessageContent[],
    currentDeletedRange: [number, number] | undefined,
    strategy: "none" | "lastTwo" | "half" | "quarter"
  ): [number, number] {
    return this.getNextTruncationRange(messages, currentDeletedRange, strategy);
  }

  /**
   * Cline-style intelligent context compression
   * Preserves important context while aggressively reducing tokens
   */
  async compressContext(messages: MessageContent[]): Promise<{
    messages: MessageContent[];
    compressionRatio: number;
    preservedElements: string[];
  }> {
    const originalTokens = this.calculateTotalTokens(messages);
    let compressedMessages = [...messages];
    const preservedElements: string[] = [];

    // 1. Preserve system messages and last user message
    const systemMessages = compressedMessages.filter(msg => msg.role === 'system');
    const lastUserMessage = compressedMessages.filter(msg => msg.role === 'user').pop();
    
    if (systemMessages.length > 0) {
      preservedElements.push('system_messages');
    }
    if (lastUserMessage) {
      preservedElements.push('last_user_message');
    }

    // 2. Compress tool results (most token-heavy)
    compressedMessages = compressedMessages.map(msg => {
      if (msg.role === 'assistant' && this.isToolResult(this.extractTextFromContent(msg.content))) {
        const compressed = this.compressToolResult(this.extractTextFromContent(msg.content));
        return {
          ...msg,
          content: compressed,
          tokens: estimateTokenCount(compressed)
        };
      }
      return msg;
    });

    // 3. Remove redundant messages (similar consecutive messages)
    compressedMessages = this.removeRedundantMessages(compressedMessages);
    preservedElements.push('redundancy_removal');

    // 4. Summarize long conversations in middle
    if (compressedMessages.length > 10) {
      const { messages: summarized, hadSummary } = this.summarizeMiddleMessages(compressedMessages);
      compressedMessages = summarized;
      if (hadSummary) {
        preservedElements.push('middle_summarization');
      }
    }

    const finalTokens = this.calculateTotalTokens(compressedMessages);
    const compressionRatio = originalTokens > 0 ? finalTokens / originalTokens : 1;

    return {
      messages: compressedMessages,
      compressionRatio,
      preservedElements
    };
  }

  /**
   * Check if content is a tool result
   */
  private isToolResult(content: string): boolean {
    const toolPatterns = [
      /✓.*?:/,  // Success format
      /✗.*?:/,  // Error format
      /<function_results>/,  // Function results format
      /\[.*?\].*?:/  // Bracketed format
    ];
    
    return toolPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Compress tool result content
   */
  private compressToolResult(content: string): string {
    // Extract the essential information from tool results
    if (content.includes('✓')) {
      // Success - just keep the tool name and brief result
      const match = content.match(/✓\s*(\w+):\s*(.{0,50})/);
      if (match) {
        return `✓ ${match[1]}: ${match[2]}${match[2].length >= 50 ? '...' : ''}`;
      }
    }
    
    if (content.includes('✗')) {
      // Error - keep error message but truncate
      const match = content.match(/✗\s*(\w+):\s*(.{0,100})/);
      if (match) {
        return `✗ ${match[1]}: ${match[2]}${match[2].length >= 100 ? '...' : ''}`;
      }
    }

    if (content.includes('<function_results>')) {
      // Function results - extract just the essential content
      const match = content.match(/<function_results>\s*([\s\S]{0,100})/);
      if (match) {
        return `<function_results>\n${match[1]}${match[1].length >= 100 ? '...' : ''}\n</function_results>`;
      }
    }

    // Generic compression - keep first 100 chars
    return content.length > 100 ? content.substring(0, 100) + '...' : content;
  }

  /**
   * Remove redundant consecutive messages
   */
  private removeRedundantMessages(messages: MessageContent[]): MessageContent[] {
    const result: MessageContent[] = [];
    let lastMessage: MessageContent | null = null;

    for (const message of messages) {
      if (!lastMessage) {
        result.push(message);
        lastMessage = message;
        continue;
      }

      // Check for similarity with previous message
      const similarity = this.calculateSimilarity(
        this.extractTextFromContent(lastMessage.content), 
        this.extractTextFromContent(message.content)
      );
      
      if (similarity > 0.8 && lastMessage.role === message.role) {
        // Skip very similar consecutive messages from same role
        continue;
      }

      result.push(message);
      lastMessage = message;
    }

    return result;
  }

  /**
   * Calculate content similarity (simple approach)
   */
  private calculateSimilarity(content1: string, content2: string): number {
    const words1 = content1.toLowerCase().split(/\s+/);
    const words2 = content2.toLowerCase().split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return union.length > 0 ? intersection.length / union.length : 0;
  }

  /**
   * Summarize middle messages to reduce context
   */
  private summarizeMiddleMessages(messages: MessageContent[]): {
    messages: MessageContent[];
    hadSummary: boolean;
  } {
    if (messages.length <= 6) {
      return { messages, hadSummary: false };
    }

    // Keep first 2 and last 2 messages, summarize the middle
    const start = messages.slice(0, 2);
    const middle = messages.slice(2, -2);
    const end = messages.slice(-2);

    if (middle.length === 0) {
      return { messages, hadSummary: false };
    }

    // Create a summary of the middle conversation
    const middleTokens = this.calculateTotalTokens(middle);
    const summary = this.createConversationSummary(middle);
    
    const summaryMessage: MessageContent = {
      role: 'system',
      content: `[CONVERSATION SUMMARY] ${summary}`,
      timestamp: Date.now(),
      tokens: estimateTokenCount(summary)
    };

    return {
      messages: [...start, summaryMessage, ...end],
      hadSummary: true
    };
  }

  /**
   * Create a brief conversation summary
   */
  private createConversationSummary(messages: MessageContent[]): string {
    const toolCalls = messages.filter(msg => this.isToolResult(this.extractTextFromContent(msg.content))).length;
    const userMessages = messages.filter(msg => msg.role === 'user').length;
    const assistantMessages = messages.filter(msg => msg.role === 'assistant').length;

    let summary = `Previous conversation: ${userMessages} user messages, ${assistantMessages} assistant responses`;

    if (toolCalls > 0) {
      summary += `, ${toolCalls} tool executions`;
    }

    // Add some context about topics if possible
    const allContent = messages.map(m => this.extractTextFromContent(m.content)).join(' ').toLowerCase();
    const topics: string[] = [];

    if (allContent.includes('file') || allContent.includes('read') || allContent.includes('write')) {
      topics.push('file operations');
    }
    if (allContent.includes('search') || allContent.includes('grep')) {
      topics.push('code search');
    }
    if (allContent.includes('error') || allContent.includes('fix')) {
      topics.push('debugging');
    }

    if (topics.length > 0) {
      summary += `. Topics: ${topics.join(', ')}`;
    }

    return summary + '.';
  }

  /**
   * Intelligent truncation: Get next truncation range based on strategy
   * Always keeps first user-assistant pair, truncates strategically
   */
  public getNextTruncationRange(
    apiMessages: MessageContent[],
    currentDeletedRange: [number, number] | undefined,
    keep: "none" | "lastTwo" | "half" | "quarter",
  ): [number, number] {
    // Always keeps first user-assistant pair
    const rangeStartIndex = 2
    const startOfRest = currentDeletedRange ? currentDeletedRange[1] + 1 : 2

    // Dynamic truncation based on token usage
    if (keep === "half") {
      const messagesToRemove = Math.floor((apiMessages.length - startOfRest) / 4) * 2
      const removeStart = Math.max(rangeStartIndex, apiMessages.length - messagesToRemove)
      const removeEnd = apiMessages.length - 1
      return [removeStart, removeEnd]
    } else if (keep === "quarter") {
      const messagesToRemove = Math.floor(((apiMessages.length - startOfRest) * 3) / 4 / 2) * 2
      const removeStart = Math.max(rangeStartIndex, apiMessages.length - messagesToRemove)
      const removeEnd = apiMessages.length - 1
      return [removeStart, removeEnd]
    } else if (keep === "lastTwo") {
      // Keep only first pair + last two messages
      const removeStart = Math.max(rangeStartIndex, apiMessages.length - 2)
      const removeEnd = apiMessages.length - 1
      return [removeStart, removeEnd]
    }

    // Default: no truncation
    return [apiMessages.length, apiMessages.length]
  }

  /**
   * Duplicate file read optimization: Finds duplicate file reads and replaces them with notices
   * Saves significant tokens by avoiding repeated file content
   */
  private findAndPotentiallySaveFileReadContextHistoryUpdates(
    apiMessages: MessageContent[],
    startFromIndex: number,
    timestamp: number,
    fileReadMap?: Map<string, { firstIndex: number; content: string; timestamp: number }>
  ): [boolean, Set<number>, Map<string, { firstIndex: number; content: string; timestamp: number }>] {
    // Finds duplicate file reads and replaces them with notices
    // Saves significant tokens by avoiding repeated file content

    const workingFileReadMap = fileReadMap || new Map<string, { firstIndex: number; content: string; timestamp: number }>();
    const messagesToOptimize = new Set<number>();
    let hasOptimizations = false;

    // First pass: identify all file reads and their first occurrences
    for (let i = startFromIndex; i < apiMessages.length; i++) {
      const message = apiMessages[i];
      const content = this.extractTextFromContent(message.content);

      // Look for file read patterns
      const fileReadPatterns = [
        /(?:read_file|TOOL_CALL: read_file)[\s\S]*?(?:Result:|OUTPUT:)([\s\S]*?)(?=\n\n|\n[A-Z]|$)/,
        /Successfully read file: ([^\n]+)/,
        /File content for ([^\n:]+)/
      ];

      for (const pattern of fileReadPatterns) {
        const match = content.match(pattern);
        if (match) {
          const fileContent = match[1] || match[0];
          const filePathMatch = content.match(/(?:file_path|path)["']?\s*:\s*["']?([^"',\s}]+)/);

          if (filePathMatch) {
            const filePath = filePathMatch[1];

            if (workingFileReadMap.has(filePath)) {
              // This is a duplicate file read
              const firstOccurrence = workingFileReadMap.get(filePath)!;

              // Check if content is similar (avoid replacing if content has changed significantly)
              const contentSimilarity = this.calculateContentSimilarity(fileContent, firstOccurrence.content);

              if (contentSimilarity > 0.9) { // 90% similar - consider it a duplicate
                messagesToOptimize.add(i);
                hasOptimizations = true;

                this.outputChannel.appendLine(
                  `🔄 Detected duplicate file read: ${filePath} (first at message ${firstOccurrence.firstIndex}, duplicate at ${i})`
                );
              } else {
                // Content has changed, update the map
                workingFileReadMap.set(filePath, {
                  firstIndex: i,
                  content: fileContent,
                  timestamp: timestamp
                });
              }
            } else {
              // First occurrence of this file
              workingFileReadMap.set(filePath, {
                firstIndex: i,
                content: fileContent,
                timestamp: timestamp
              });
            }
          }
          break; // Found a match, no need to check other patterns
        }
      }
    }

    return [hasOptimizations, messagesToOptimize, workingFileReadMap];
  }

  /**
   * Calculate similarity between two content strings
   */
  private calculateContentSimilarity(content1: string, content2: string): number {
    if (content1 === content2) return 1.0;

    const words1 = content1.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const words2 = content2.toLowerCase().split(/\s+/).filter(word => word.length > 2);

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter(word => set2.has(word)));
    const union = new Set([...set1, ...set2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Apply duplicate file read optimizations to messages
   */
  private applyFileReadOptimizations(
    messages: MessageContent[],
    messagesToOptimize: Set<number>,
    fileReadMap: Map<string, { firstIndex: number; content: string; timestamp: number }>
  ): MessageContent[] {
    return messages.map((message, index) => {
      if (messagesToOptimize.has(index)) {
        const content = this.extractTextFromContent(message.content);
        const filePathMatch = content.match(/(?:file_path|path)["']?\s*:\s*["']?([^"',\s}]+)/);

        if (filePathMatch) {
          const filePath = filePathMatch[1];
          const firstOccurrence = fileReadMap.get(filePath);

          if (firstOccurrence) {
            // Replace with optimized notice
            const optimizedContent = this.createFileReadOptimizationNotice(filePath, firstOccurrence.firstIndex, index);

            this.outputChannel.appendLine(
              `💾 Optimized duplicate file read: ${filePath} (saved ~${estimateTokenCount(content) - estimateTokenCount(optimizedContent)} tokens)`
            );

            return {
              ...message,
              content: optimizedContent,
              tokens: estimateTokenCount(optimizedContent)
            };
          }
        }
      }

      return message;
    });
  }

  /**
   * Create an optimized notice for duplicate file reads
   */
  private createFileReadOptimizationNotice(filePath: string, originalIndex: number, duplicateIndex: number): string {
    return `[DUPLICATE FILE READ OPTIMIZED]
File: ${filePath}
Original read at message ${originalIndex}, this duplicate at message ${duplicateIndex} has been optimized.
To see the full content, refer to the original message or re-read the file if needed.

This optimization saves context space while preserving conversation flow.`;
  }
}