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
exports.AgentOrchestrator = void 0;
const vscode = __importStar(require("vscode"));
const agentTaskPlanner_1 = require("./agentTaskPlanner");
const agentTerminalExecutor_1 = require("./agentTerminalExecutor");
const agentDecisionManager_1 = require("./agentDecisionManager");
class AgentOrchestrator {
    constructor(context, geminiChat, accessibilityConverter, fileScanner, chatProvider) {
        this.context = context;
        this.geminiChat = geminiChat;
        this.accessibilityConverter = accessibilityConverter;
        this.fileScanner = fileScanner;
        this.chatProvider = chatProvider;
        this.outputChannel = vscode.window.createOutputChannel('AccessLint Agent');
        // Initialize agent components
        this.taskPlanner = new agentTaskPlanner_1.AgentTaskPlanner(this.geminiChat);
        this.terminalExecutor = new agentTerminalExecutor_1.AgentTerminalExecutor();
        this.decisionManager = new agentDecisionManager_1.AgentDecisionManager(this.chatProvider);
        // Initialize state
        this.state = {
            isRunning: false,
            isPaused: false,
            progress: 0,
            statusMessage: 'Agent ready',
            logs: []
        };
        // Default config
        this.config = {
            maxAiCalls: 5,
            maxDuration: 30,
            maxFilesModified: 50,
            autoApproveCommands: false,
            autoApproveFileChanges: false,
            riskLevel: 'moderate'
        };
        // Create status bar item for agent
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.text = "$(robot) Agent: Ready";
        this.statusBarItem.tooltip = "AccessLint Agent Status";
        this.statusBarItem.command = 'accesslint.showAgentStatus';
        this.statusBarItem.show();
        this.log('info', '🤖 Agent Orchestrator initialized');
    }
    async startAgent(goal, scope, targetPath) {
        if (this.state.isRunning) {
            throw new Error('Agent is already running. Please stop the current task first.');
        }
        this.log('info', `🚀 Starting agent with goal: "${goal}"`);
        this.log('info', `📍 Scope: ${scope}, Target: ${targetPath || 'auto-detect'}`);
        try {
            // Update state
            this.state.isRunning = true;
            this.state.isPaused = false;
            this.state.progress = 0;
            this.state.statusMessage = 'Planning...';
            this.updateStatusBar();
            this.notifyUI();
            // Create execution plan
            this.log('info', '🧠 Creating execution plan...');
            const plan = await this.taskPlanner.createPlan(goal, scope, targetPath);
            this.state.currentPlan = plan;
            this.log('success', `📋 Plan created with ${plan.tasks.length} tasks`);
            this.log('info', `⚡ AI calls budget: ${plan.aiCallsUsed}/${plan.aiCallsLimit}`);
            // Send plan to UI for user review
            await this.showPlanToUser(plan);
            // Execute the plan
            await this.executePlan(plan);
        }
        catch (error) {
            this.log('error', `❌ Agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            this.stopAgent();
            throw error;
        }
    }
    async pauseAgent() {
        if (!this.state.isRunning) {
            return;
        }
        this.state.isPaused = true;
        this.state.statusMessage = 'Paused by user';
        this.log('warning', '⏸️ Agent paused by user');
        this.updateStatusBar();
        this.notifyUI();
    }
    async resumeAgent() {
        if (!this.state.isPaused || !this.state.currentPlan) {
            return;
        }
        this.state.isPaused = false;
        this.state.statusMessage = 'Resuming...';
        this.log('info', '▶️ Agent resumed');
        this.updateStatusBar();
        this.notifyUI();
        // Continue execution
        await this.executePlan(this.state.currentPlan);
    }
    async stopAgent() {
        this.state.isRunning = false;
        this.state.isPaused = false;
        this.state.statusMessage = 'Stopped';
        this.state.currentTask = undefined;
        if (this.state.currentPlan) {
            this.state.currentPlan.status = 'cancelled';
            this.state.currentPlan.endTime = new Date();
        }
        this.log('warning', '🛑 Agent stopped');
        this.updateStatusBar();
        this.notifyUI();
    }
    async executePlan(plan) {
        plan.status = 'executing';
        plan.startTime = new Date();
        this.log('info', '🎯 Starting plan execution...');
        for (let i = 0; i < plan.tasks.length; i++) {
            if (!this.state.isRunning) {
                this.log('warning', '🛑 Execution stopped by user');
                break;
            }
            // Wait if paused
            while (this.state.isPaused && this.state.isRunning) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            const task = plan.tasks[i];
            this.state.currentTask = task;
            this.state.progress = (i / plan.tasks.length) * 100;
            this.state.statusMessage = `Executing: ${task.title}`;
            this.updateStatusBar();
            this.notifyUI();
            this.log('info', `🔧 Executing task ${i + 1}/${plan.tasks.length}: ${task.title}`);
            try {
                await this.executeTask(task);
                task.status = 'completed';
                plan.completedTasks++;
                this.log('success', `✅ Task completed: ${task.title}`);
            }
            catch (error) {
                task.status = 'failed';
                task.error = error instanceof Error ? error.message : 'Unknown error';
                this.log('error', `❌ Task failed: ${task.title} - ${task.error}`);
                // Ask user if they want to continue despite the error
                const continueExecution = await this.askUserToContinue(task, error);
                if (!continueExecution) {
                    this.log('warning', '🛑 Execution stopped due to task failure');
                    break;
                }
            }
        }
        // Complete execution
        plan.status = plan.completedTasks === plan.totalTasks ? 'completed' : 'failed';
        plan.endTime = new Date();
        this.state.isRunning = false;
        this.state.progress = 100;
        this.state.statusMessage = `Completed: ${plan.completedTasks}/${plan.totalTasks} tasks`;
        this.log('success', `🎉 Plan execution finished: ${plan.completedTasks}/${plan.totalTasks} tasks completed`);
        this.updateStatusBar();
        this.notifyUI();
        // Show final summary
        await this.showExecutionSummary(plan);
    }
    async executeTask(task) {
        task.status = 'in_progress';
        switch (task.type) {
            case 'file_conversion':
                await this.executeFileConversion(task);
                break;
            case 'module_conversion':
                await this.executeModuleConversion(task);
                break;
            case 'terminal_command':
                await this.executeTerminalCommand(task);
                break;
            case 'analysis':
                await this.executeAnalysis(task);
                break;
            default:
                throw new Error(`Unknown task type: ${task.type}`);
        }
    }
    async executeFileConversion(task) {
        // Get user approval if required
        if (task.userApprovalRequired) {
            const approved = await this.decisionManager.requestFileChangeApproval(task);
            if (!approved) {
                task.status = 'user_rejected';
                return;
            }
        }
        // Execute file conversion
        const result = await this.accessibilityConverter.convertFile(task.target);
        if (result.success) {
            // Ask user to approve the changes
            const changesApproved = await this.decisionManager.requestChangeApproval({
                id: `changes-${task.id}`,
                taskId: task.id,
                type: 'file_changes',
                description: `Apply accessibility improvements to ${task.target}`,
                target: task.target,
                changes: result,
                timestamp: new Date()
            });
            if (changesApproved) {
                // Apply the changes (they're already shown in diff view)
                task.result = result;
            }
            else {
                task.status = 'user_rejected';
            }
        }
        else {
            throw new Error(result.error || 'File conversion failed');
        }
    }
    async executeModuleConversion(task) {
        // Similar to file conversion but for entire modules
        if (task.userApprovalRequired) {
            const approved = await this.decisionManager.requestModuleChangeApproval(task);
            if (!approved) {
                task.status = 'user_rejected';
                return;
            }
        }
        // Get module from file scanner
        const scanResult = await this.fileScanner.scanWorkspace();
        if (!scanResult.success || !scanResult.stats) {
            throw new Error('Failed to scan workspace for module');
        }
        const module = scanResult.stats.modules?.find(m => m.directory === task.target);
        if (!module) {
            throw new Error(`Module not found: ${task.target}`);
        }
        const result = await this.accessibilityConverter.convertModule(module);
        if (result.success) {
            const changesApproved = await this.decisionManager.requestChangeApproval({
                id: `changes-${task.id}`,
                taskId: task.id,
                type: 'module_changes',
                description: `Apply accessibility improvements to module ${module.name}`,
                target: task.target,
                changes: result,
                timestamp: new Date()
            });
            if (changesApproved) {
                task.result = result;
            }
            else {
                task.status = 'user_rejected';
            }
        }
        else {
            throw new Error(result.error || 'Module conversion failed');
        }
    }
    async executeTerminalCommand(task) {
        const command = {
            id: task.id,
            command: task.description,
            workingDirectory: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
            description: task.title,
            riskLevel: 'medium',
            userApprovalRequired: true,
            executed: false
        };
        const approved = await this.decisionManager.requestTerminalCommandApproval(command);
        if (!approved) {
            task.status = 'user_rejected';
            return;
        }
        const result = await this.terminalExecutor.executeCommand(command);
        task.result = result;
        if (!result.success) {
            throw new Error(`Command failed: ${result.error}`);
        }
    }
    async executeAnalysis(task) {
        // Increment AI calls counter
        if (this.state.currentPlan) {
            this.state.currentPlan.aiCallsUsed++;
            if (this.state.currentPlan.aiCallsUsed > this.config.maxAiCalls) {
                throw new Error('AI calls limit exceeded');
            }
        }
        // Perform analysis using Gemini
        const prompt = `Analyze the accessibility of ${task.target} and provide specific recommendations. Focus on WCAG 2.1 compliance.`;
        const response = await this.geminiChat.sendMessage(prompt);
        task.result = response;
        this.log('info', `📊 Analysis completed for ${task.target}`);
    }
    async showPlanToUser(plan) {
        // Send plan to chat UI for user review
        this.chatProvider.postMessage({
            type: 'agentPlan',
            plan: plan
        });
    }
    async showExecutionSummary(plan) {
        const summary = {
            goal: plan.goal,
            totalTasks: plan.totalTasks,
            completedTasks: plan.completedTasks,
            duration: plan.endTime && plan.startTime ?
                Math.round((plan.endTime.getTime() - plan.startTime.getTime()) / 1000) : 0,
            aiCallsUsed: plan.aiCallsUsed,
            status: plan.status
        };
        this.chatProvider.postMessage({
            type: 'agentSummary',
            summary: summary
        });
    }
    async askUserToContinue(task, error) {
        return new Promise((resolve) => {
            vscode.window.showWarningMessage(`Task "${task.title}" failed: ${error.message}. Continue with remaining tasks?`, 'Continue', 'Stop').then(choice => {
                resolve(choice === 'Continue');
            });
        });
    }
    log(level, message, taskId) {
        const entry = {
            id: Date.now().toString(),
            timestamp: new Date(),
            level,
            message,
            taskId
        };
        this.state.logs.push(entry);
        this.outputChannel.appendLine(`[${level.toUpperCase()}] ${message}`);
        // Send to UI
        this.chatProvider.postMessage({
            type: 'agentLog',
            log: entry
        });
    }
    updateStatusBar() {
        if (this.state.isRunning) {
            const icon = this.state.isPaused ? '$(debug-pause)' : '$(loading~spin)';
            this.statusBarItem.text = `${icon} Agent: ${this.state.statusMessage}`;
        }
        else {
            this.statusBarItem.text = "$(robot) Agent: Ready";
        }
    }
    notifyUI() {
        this.chatProvider.postMessage({
            type: 'agentState',
            state: this.state
        });
    }
    // Getters for external access
    getState() {
        return { ...this.state };
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.log('info', '⚙️ Agent configuration updated');
    }
    dispose() {
        this.statusBarItem.dispose();
        this.outputChannel.dispose();
    }
}
exports.AgentOrchestrator = AgentOrchestrator;
//# sourceMappingURL=agentOrchestrator.js.map