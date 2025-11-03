import * as vscode from 'vscode';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
}

/**
 * Enhanced error class for Azure OpenAI rate limiting
 * Based on Cline's RetriableError implementation
 */
export class RetriableError extends Error {
  status: number = 429;
  retryAfter?: number;
  headers?: Record<string, string>;

  constructor(message: string, retryAfter?: number, headers?: Record<string, string>) {
    super(message);
    this.name = "RetriableError";
    this.retryAfter = retryAfter;
    this.headers = headers;
  }

  /**
   * Create RetriableError from Azure OpenAI response
   */
  static fromAzureOpenAIError(status: number, errorText: string, response?: any): RetriableError {
    // Parse the error message to extract retry-after information
    let retryAfter: number | undefined;
    let headers: Record<string, string> = {};

    if (response) {
      // Extract headers from response
      response.headers.forEach((value: string, key: string) => {
        headers[key.toLowerCase()] = value;
      });

      // Try to get retry-after from headers
      const retryAfterHeader = headers['retry-after'] || headers['x-ratelimit-reset'] || headers['ratelimit-reset'];
      if (retryAfterHeader) {
        const retryValue = parseInt(retryAfterHeader, 10);
        if (!isNaN(retryValue)) {
          // Handle both delta-seconds and Unix timestamp formats
          if (retryValue > Date.now() / 1000) {
            // Unix timestamp
            retryAfter = Math.ceil((retryValue * 1000 - Date.now()) / 1000);
          } else {
            // Delta seconds
            retryAfter = retryValue;
          }
        }
      }
    }

    // Parse retry time from error message if not in headers
    if (!retryAfter && errorText) {
      const retryMatch = errorText.match(/retry after (\d+) seconds?/i);
      if (retryMatch) {
        retryAfter = parseInt(retryMatch[1], 10);
      }
    }

    const error = new RetriableError(
      `Azure OpenAI rate limit exceeded (${status}): ${errorText}`,
      retryAfter,
      headers
    );
    error.status = status;
    
    return error;
  }
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
}

export interface RetryAttempt {
  attempt: number;
  error: Error;
  delay: number;
  timestamp: number;
}

export interface RetryEventListener {
  onRetryAttempt: (operationName: string, attempt: number, maxRetries: number, delay: number, error: Error) => void;
}

/**
 * Sophisticated retry utility inspired by Cline's implementation
 * Includes exponential backoff, jitter, and rate limit awareness
 */
export class RetryUtils {
  private static outputChannel = vscode.window.createOutputChannel('AccessLint Retry Manager');
  private static retryEventListeners: RetryEventListener[] = [];

  /**
   * Execute function with exponential backoff retry (like Cline)
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    operationName: string = 'operation'
  ): Promise<RetryResult<T>> {
    const finalConfig: RetryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitterEnabled: true,
      ...config
    };

    const startTime = Date.now();
    const attempts: RetryAttempt[] = [];
    
    this.outputChannel.appendLine(`🔄 Starting retry operation: ${operationName}`);

    for (let attempt = 1; attempt <= finalConfig.maxRetries + 1; attempt++) {
      try {
        this.outputChannel.appendLine(`⏳ ${operationName} - Attempt ${attempt}/${finalConfig.maxRetries + 1}`);
        
        const result = await operation();
        const totalDuration = Date.now() - startTime;
        
        this.outputChannel.appendLine(`✅ ${operationName} succeeded on attempt ${attempt} (${totalDuration}ms)`);
        
        return {
          success: true,
          result,
          attempts: attempt,
          totalDuration
        };
      } catch (error) {
        const retryError = error instanceof Error ? error : new Error(String(error));
        const timestamp = Date.now();
        
        // Check if this is a retryable error
        const shouldRetry = this.isRetryableError(retryError) && attempt <= finalConfig.maxRetries;
        
        if (!shouldRetry) {
          const totalDuration = timestamp - startTime;
          this.outputChannel.appendLine(`❌ ${operationName} failed permanently: ${retryError.message}`);
          
          return {
            success: false,
            error: retryError,
            attempts: attempt,
            totalDuration
          };
        }

        // Calculate delay with exponential backoff and jitter (or use retry-after from error)
        const delay = this.calculateDelay(attempt - 1, finalConfig, retryError);
        
        attempts.push({
          attempt,
          error: retryError,
          delay,
          timestamp
        });

        this.outputChannel.appendLine(
          `⚠️ ${operationName} attempt ${attempt} failed: ${retryError.message}. ` +
          `Retrying in ${delay}ms...`
        );

        // Show user notification for longer delays
        if (delay > 5000) {
          vscode.window.showWarningMessage(
            `${operationName} failed, retrying in ${Math.ceil(delay / 1000)} seconds...`,
            'OK'
          );
        }

        // Emit retry event for UI components to listen to
        this.emitRetryEvent(operationName, attempt, finalConfig.maxRetries, delay, retryError);

        await this.sleep(delay);
      }
    }

    // This should never be reached due to the loop logic, but TypeScript needs it
    const totalDuration = Date.now() - startTime;
    return {
      success: false,
      error: new Error('Maximum retries exceeded'),
      attempts: finalConfig.maxRetries + 1,
      totalDuration
    };
  }

  /**
   * Check if an error is retryable
   */
  private static isRetryableError(error: Error): boolean {
    // RetriableError is always retryable
    if (error instanceof RetriableError) {
      return true;
    }

    const message = error.message.toLowerCase();
    
    // Rate limiting errors (always retryable)
    if (message.includes('rate limit') || 
        message.includes('429') || 
        message.includes('quota exceeded')) {
      return true;
    }

    // Network errors (retryable)
    if (message.includes('network') ||
        message.includes('timeout') ||
        message.includes('connection') ||
        message.includes('econnreset') ||
        message.includes('enotfound')) {
      return true;
    }

    // Server errors (retryable)
    if (message.includes('500') ||
        message.includes('502') ||
        message.includes('503') ||
        message.includes('504')) {
      return true;
    }

    // Anthropic specific errors
    if (message.includes('overloaded') ||
        message.includes('try again')) {
      return true;
    }

    // Authentication errors (not retryable)
    if (message.includes('unauthorized') ||
        message.includes('invalid api key') ||
        message.includes('401') ||
        message.includes('403')) {
      return false;
    }

    // Bad request errors (not retryable)
    if (message.includes('400') ||
        message.includes('bad request') ||
        message.includes('invalid')) {
      return false;
    }

    // Default to retryable for unknown errors
    return true;
  }

  /**
   * Calculate delay with exponential backoff and optional jitter
   * Enhanced to handle RetriableError with retry-after information
   */
  private static calculateDelay(attemptNumber: number, config: RetryConfig, error?: Error): number {
    // If we have a RetriableError with retry-after, use that (like Cline)
    if (error instanceof RetriableError && error.retryAfter) {
      const retryAfterMs = error.retryAfter * 1000;
      this.outputChannel.appendLine(`⏱️ Using retry-after from error: ${error.retryAfter} seconds`);
      return Math.min(retryAfterMs, config.maxDelay);
    }

    // Exponential backoff: baseDelay * (backoffMultiplier ^ attemptNumber)
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attemptNumber);
    
    // Cap at maximum delay
    delay = Math.min(delay, config.maxDelay);
    
    // Add jitter to prevent thundering herd
    if (config.jitterEnabled) {
      const jitterAmount = delay * 0.1; // 10% jitter
      const jitter = (Math.random() - 0.5) * 2 * jitterAmount;
      delay += jitter;
    }
    
    return Math.round(Math.max(delay, 0));
  }

  /**
   * Sleep utility
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry specifically for API calls with rate limit awareness
   */
  static async retryApiCall<T>(
    apiCall: () => Promise<T>,
    operationName: string = 'API call'
  ): Promise<T> {
    const result = await this.withRetry(
      apiCall,
      {
        maxRetries: 5,
        baseDelay: 2000,
        maxDelay: 60000,
        backoffMultiplier: 2.5,
        jitterEnabled: true
      },
      operationName
    );

    if (!result.success) {
      throw result.error || new Error('API call failed after retries');
    }

    return result.result!;
  }

  /**
   * Specialized retry for Azure OpenAI with better user feedback
   */
  static async retryAzureOpenAI<T>(
    apiCall: () => Promise<T>,
    operationName: string = 'Azure OpenAI API call',
    onRetryAttempt?: (attempt: number, maxRetries: number, delay: number, error: Error) => void
  ): Promise<T> {
    const result = await this.withRetry(
      async () => {
        try {
          return await apiCall();
        } catch (error: any) {
          // Convert Azure OpenAI errors to RetriableError for better handling
          if (error.message && error.message.includes('rate limit') && !error.retryAfter) {
            // Try to extract retry time from the error message
            const retryMatch = error.message.match(/retry after (\d+) seconds?/i);
            if (retryMatch) {
              const retryAfter = parseInt(retryMatch[1], 10);
              throw new RetriableError(error.message, retryAfter);
            }
          }
          throw error;
        }
      },
      {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000, // 30 seconds max
        backoffMultiplier: 2,
        jitterEnabled: true
      },
      operationName
    );

    if (!result.success) {
      throw result.error || new Error('Azure OpenAI call failed after retries');
    }

    return result.result!;
  }

  /**
   * Retry for file operations
   */
  static async retryFileOperation<T>(
    fileOperation: () => Promise<T>,
    operationName: string = 'File operation'
  ): Promise<T> {
    const result = await this.withRetry(
      fileOperation,
      {
        maxRetries: 3,
        baseDelay: 500,
        maxDelay: 5000,
        backoffMultiplier: 2,
        jitterEnabled: false // File operations don't need jitter
      },
      operationName
    );

    if (!result.success) {
      throw result.error || new Error('File operation failed after retries');
    }

    return result.result!;
  }

  /**
   * Get retry statistics for monitoring
   */
  static getRetryStats(): {
    recommendedConfig: RetryConfig;
    commonRetryableErrors: string[];
    nonRetryableErrors: string[];
  } {
    return {
      recommendedConfig: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        jitterEnabled: true
      },
      commonRetryableErrors: [
        'rate_limit_exceeded',
        'network_timeout',
        'connection_reset',
        'server_overloaded',
        '429_too_many_requests',
        '500_internal_server_error',
        '502_bad_gateway',
        '503_service_unavailable',
        '504_gateway_timeout'
      ],
      nonRetryableErrors: [
        'invalid_api_key',
        'unauthorized_access',
        'bad_request',
        'malformed_input',
        'permission_denied'
      ]
    };
  }

  /**
   * Add a retry event listener for UI feedback
   */
  static addRetryEventListener(listener: RetryEventListener): void {
    this.retryEventListeners.push(listener);
  }

  /**
   * Remove a retry event listener
   */
  static removeRetryEventListener(listener: RetryEventListener): void {
    const index = this.retryEventListeners.indexOf(listener);
    if (index > -1) {
      this.retryEventListeners.splice(index, 1);
    }
  }

  /**
   * Emit retry event to all listeners
   */
  private static emitRetryEvent(operationName: string, attempt: number, maxRetries: number, delay: number, error: Error): void {
    this.retryEventListeners.forEach(listener => {
      try {
        listener.onRetryAttempt(operationName, attempt, maxRetries, delay, error);
      } catch (e) {
        console.error('Error in retry event listener:', e);
      }
    });
  }

  /**
   * Dispose resources
   */
  static dispose(): void {
    this.outputChannel.dispose();
    this.retryEventListeners.length = 0;
  }
}

/**
 * Decorator for automatic retry on methods
 */
export function withRetry(config?: Partial<RetryConfig>) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args: any[]) {
      const result = await RetryUtils.withRetry(
        () => originalMethod.apply(this, args),
        config,
        `${target.constructor.name}.${propertyKey}`
      );

      if (!result.success) {
        throw result.error || new Error('Method failed after retries');
      }

      return result.result;
    };

    return descriptor;
  };
}
