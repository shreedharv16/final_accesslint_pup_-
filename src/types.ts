import * as vscode from 'vscode';

export interface FileStats {
  totalFiles: number;
  filesByExtension: Map<string, number>;
  fileList: string[];
  largestFiles: { path: string; size: number }[];
  scannedAt: Date;
  modules?: FileModule[];
}

export interface ScanResult {
  success: boolean;
  stats?: FileStats;
  error?: string;
  duration: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  messages: ChatMessage[];
  apiKeyConfigured: boolean;
}

export interface FileOperationResult {
  success: boolean;
  originalContent?: string;
  backupPath?: string;
  error?: string;
}

export interface AccessLintConfig {
  excludePatterns: string[];
  maxFiles: number;
  geminiApiKey?: string;
}

export interface TreeItem extends vscode.TreeItem {
  children?: TreeItem[];
  count?: number;
  size?: number;
}

export type FileExtensionGroup = {
  extension: string;
  count: number;
  files: string[];
};

// Module detection types
export interface ModuleFile {
  path: string;
  extension: string;
  type: 'script' | 'style' | 'markup' | 'config' | 'other';
  baseName: string;
  directory: string;
}

export interface FileModule {
  name: string;
  baseName: string;
  directory: string;
  files: ModuleFile[];
}

// Agent Mode Types
export interface AgentTask {
  id: string;
  type: 'file_conversion' | 'module_conversion' | 'terminal_command' | 'analysis';
  title: string;
  description: string;
  target: string; // file path or folder path
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'user_rejected';
  priority: number; // 1-10, higher = more important
  dependencies?: string[]; // task IDs that must complete first
  result?: any;
  error?: string;
  userApprovalRequired: boolean;
  estimatedDuration?: number; // in seconds
}

export interface AgentPlan {
  id: string;
  goal: string;
  tasks: AgentTask[];
  totalTasks: number;
  completedTasks: number;
  status: 'planning' | 'executing' | 'paused' | 'completed' | 'failed' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  aiCallsUsed: number;
  aiCallsLimit: number;
}

export interface AgentState {
  isRunning: boolean;
  isPaused: boolean;
  currentPlan?: AgentPlan;
  currentTask?: AgentTask;
  progress: number; // 0-100
  statusMessage: string;
  logs: AgentLogEntry[];
}

export interface AgentLogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  taskId?: string;
  details?: any;
}

// Todo List Types
export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: number; // 1-5, higher = more important
  createdAt: Date;
  completedAt?: Date;
  estimatedDuration?: number; // in minutes
}

export interface TodoList {
  id: string;
  sessionId: string;
  query: string;
  items: TodoItem[];
  status: 'active' | 'completed' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
  maxItems: number; // 4-5 max as requested
}

export interface AgentDecision {
  id: string;
  taskId: string;
  type: 'file_changes' | 'terminal_command' | 'module_changes';
  description: string;
  target: string;
  changes?: any; // file content changes, command details, etc.
  userResponse?: 'approved' | 'rejected' | 'pending';
  timestamp: Date;
}

export interface TerminalCommand {
  id: string;
  command: string;
  workingDirectory: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  userApprovalRequired: boolean;
  executed: boolean;
  result?: {
    success: boolean;
    output: string;
    error?: string;
    exitCode: number;
  };
}

export interface AgentConfig {
  maxAiCalls: number;
  maxDuration: number; // in minutes
  maxFilesModified: number;
  autoApproveCommands: boolean;
  autoApproveFileChanges: boolean;
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
} 