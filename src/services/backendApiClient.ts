/**
 * Backend API Client for VSCode Extension
 * 
 * This service handles all communication between the VSCode extension and the backend server.
 * It manages authentication, request/response handling, and error management.
 */

import * as vscode from 'vscode';
import axios, { AxiosInstance, AxiosError } from 'axios';

export interface BackendConfig {
  apiUrl: string;
  accessToken?: string;
  refreshToken?: string;
}

export class BackendApiClient {
  private axiosInstance: AxiosInstance;
  private context: vscode.ExtensionContext;
  private config: BackendConfig;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    
    // Load configuration
    const vsConfig = vscode.workspace.getConfiguration('accesslint');
    this.config = {
      apiUrl: vsConfig.get('backendApiUrl') || 'http://localhost:3000/api',
      accessToken: context.globalState.get('accessToken'),
      refreshToken: context.globalState.get('refreshToken')
    };

    // Create axios instance
    this.axiosInstance = axios.create({
      baseURL: this.config.apiUrl,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  /**
   * Setup request and response interceptors
   */
  private setupInterceptors() {
    // Request interceptor - add token
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = this.config.accessToken;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle token refresh
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest: any = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = this.config.refreshToken;
            if (refreshToken) {
              const response = await axios.post(`${this.config.apiUrl}/auth/refresh`, {
                refreshToken
              });

              const { accessToken } = response.data.data;
              
              // Update tokens
              await this.setTokens(accessToken, refreshToken);

              // Retry original request
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              return this.axiosInstance(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, prompt user to login
            await this.clearTokens();
            await this.promptLogin();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Set authentication tokens
   */
  async setTokens(accessToken: string, refreshToken: string) {
    this.config.accessToken = accessToken;
    this.config.refreshToken = refreshToken;
    await this.context.globalState.update('accessToken', accessToken);
    await this.context.globalState.update('refreshToken', refreshToken);
  }

  /**
   * Clear authentication tokens
   */
  async clearTokens() {
    this.config.accessToken = undefined;
    this.config.refreshToken = undefined;
    await this.context.globalState.update('accessToken', undefined);
    await this.context.globalState.update('refreshToken', undefined);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.config.accessToken;
  }

  /**
   * Prompt user to login
   */
  private async promptLogin() {
    const result = await vscode.window.showInformationMessage(
      'AccessLint: Please login to continue',
      'Open Login Page'
    );

    if (result === 'Open Login Page') {
      const webConfig = vscode.workspace.getConfiguration('accesslint');
      const webUrl = webConfig.get('webAppUrl') || 'http://localhost:3001';
      vscode.env.openExternal(vscode.Uri.parse(`${webUrl}/login`));
    }
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string) {
    const response = await this.axiosInstance.post('/auth/login', {
      email,
      password
    });

    const { accessToken, refreshToken } = response.data.data;
    await this.setTokens(accessToken, refreshToken);

    return response.data.data;
  }

  /**
   * Logout
   */
  async logout() {
    try {
      await this.axiosInstance.post('/auth/logout');
    } finally {
      await this.clearTokens();
    }
  }

  // ========== Chat API Methods ==========

  /**
   * Create a new chat conversation
   */
  async createChatConversation(type: 'chat' | 'agent' = 'chat', title?: string) {
    const response = await this.axiosInstance.post('/chat/conversations', {
      type,
      title
    });
    return response.data.data;
  }

  /**
   * Send a message in a conversation
   */
  async sendChatMessage(conversationId: string, content: string) {
    const response = await this.axiosInstance.post(`/chat/conversations/${conversationId}/messages`, {
      content
    });
    return response.data.data;
  }

  /**
   * Get conversation messages
   */
  async getChatMessages(conversationId: string) {
    const response = await this.axiosInstance.get(`/chat/conversations/${conversationId}/messages`);
    return response.data.data.messages;
  }

  /**
   * Get user conversations
   */
  async getUserConversations(type?: 'chat' | 'agent') {
    const params = type ? { type } : {};
    const response = await this.axiosInstance.get('/chat/conversations', { params });
    return response.data.data.conversations;
  }

  // ========== Agent API Methods ==========

  /**
   * Start an agent session
   */
  async startAgentSession(goal: string, sessionType: 'chat' | 'testing' = 'chat') {
    const response = await this.axiosInstance.post('/agent/sessions', {
      goal,
      sessionType
    });
    return response.data.data;
  }

  /**
   * Execute agent iteration
   */
  async executeAgentIteration(
    sessionId: string,
    iterationNumber: number,
    llmRequest: any,
    llmResponse: any,
    toolCalls?: any[],
    toolResults?: any[]
  ) {
    const response = await this.axiosInstance.post(`/agent/sessions/${sessionId}/iterations`, {
      iterationNumber,
      llmRequest,
      llmResponse,
      toolCalls,
      toolResults
    });
    return response.data.data;
  }

  /**
   * Complete agent session
   */
  async completeAgentSession(
    sessionId: string,
    fileChanges: string[],
    completionSummary: string
  ) {
    const response = await this.axiosInstance.post(`/agent/sessions/${sessionId}/complete`, {
      fileChanges,
      completionSummary
    });
    return response.data.data;
  }

  /**
   * Fail agent session
   */
  async failAgentSession(sessionId: string, errorMessage: string) {
    const response = await this.axiosInstance.post(`/agent/sessions/${sessionId}/fail`, {
      errorMessage
    });
    return response.data.data;
  }

  // ========== Testing API Methods ==========

  /**
   * Start a testing session
   */
  async startTestingSession(url: string) {
    const response = await this.axiosInstance.post('/testing/sessions', {
      url
    });
    return response.data.data;
  }

  /**
   * Save testing results
   */
  async saveTestingResults(
    sessionId: string,
    nvdaInteractions: string,
    testResults: any,
    aiValidationResults?: any
  ) {
    const response = await this.axiosInstance.post(`/testing/sessions/${sessionId}/results`, {
      nvdaInteractions,
      testResults,
      aiValidationResults
    });
    return response.data.data;
  }

  /**
   * Save testing fix results
   */
  async saveTestingFix(
    testingSessionId: string,
    agentSessionId: string,
    filesModified: string[],
    fixSummary: string,
    success: boolean
  ) {
    const response = await this.axiosInstance.post('/testing/fixes', {
      testingSessionId,
      agentSessionId,
      filesModified,
      fixSummary,
      success
    });
    return response.data.data;
  }

  // ========== Tool API Methods ==========

  /**
   * Execute a tool
   */
  async executeTool(toolName: string, parameters: any) {
    const response = await this.axiosInstance.post('/tools/execute', {
      toolName,
      parameters
    });
    return response.data.data;
  }

  // ========== Debug Logging ==========

  /**
   * Send debug log to backend
   */
  async sendDebugLog(
    sessionId: string | null,
    sessionType: 'chat' | 'agent' | 'testing',
    logLevel: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: any
  ) {
    try {
      await this.axiosInstance.post('/debug/log', {
        sessionId,
        sessionType,
        logLevel,
        message,
        context
      });
    } catch (error) {
      // Silently fail debug logs to avoid interrupting main flow
      console.error('Failed to send debug log:', error);
    }
  }

  // ========== User Info ==========

  /**
   * Get current user info
   */
  async getCurrentUser() {
    const response = await this.axiosInstance.get('/auth/me');
    return response.data.data.user;
  }

  /**
   * Get user usage statistics
   */
  async getUserUsage() {
    const response = await this.axiosInstance.get('/user/usage');
    return response.data.data;
  }
}

