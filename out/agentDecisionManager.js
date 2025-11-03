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
exports.AgentDecisionManager = void 0;
const vscode = __importStar(require("vscode"));
class AgentDecisionManager {
    constructor(chatProvider) {
        this.pendingDecisions = new Map();
        this.decisionPromises = new Map();
        this.chatProvider = chatProvider;
        this.setupMessageHandlers();
    }
    setupMessageHandlers() {
        // Note: This would be integrated into the existing chat message handler
        // For now, we'll assume the chat provider can forward agent-related messages
    }
    async requestFileChangeApproval(task) {
        const decision = {
            id: `decision_${Date.now()}`,
            taskId: task.id,
            type: 'file_changes',
            description: `Apply accessibility improvements to ${task.target}`,
            target: task.target,
            timestamp: new Date()
        };
        return this.requestApproval(decision, {
            title: 'File Change Approval Required',
            message: `The agent wants to modify "${task.target}" to improve accessibility. Do you approve this change?`,
            details: {
                taskTitle: task.title,
                taskDescription: task.description,
                target: task.target,
                type: 'file'
            }
        });
    }
    async requestModuleChangeApproval(task) {
        const decision = {
            id: `decision_${Date.now()}`,
            taskId: task.id,
            type: 'module_changes',
            description: `Apply accessibility improvements to module at ${task.target}`,
            target: task.target,
            timestamp: new Date()
        };
        return this.requestApproval(decision, {
            title: 'Module Change Approval Required',
            message: `The agent wants to modify multiple files in "${task.target}" to improve accessibility. Do you approve these changes?`,
            details: {
                taskTitle: task.title,
                taskDescription: task.description,
                target: task.target,
                type: 'module'
            }
        });
    }
    async requestTerminalCommandApproval(command) {
        const decision = {
            id: `decision_${Date.now()}`,
            taskId: command.id,
            type: 'terminal_command',
            description: command.description,
            target: command.workingDirectory,
            changes: command,
            timestamp: new Date()
        };
        const riskColor = this.getRiskColor(command.riskLevel);
        const riskIcon = this.getRiskIcon(command.riskLevel);
        return this.requestApproval(decision, {
            title: 'Terminal Command Approval Required',
            message: `The agent wants to execute a ${command.riskLevel} risk command. Do you approve?`,
            details: {
                command: command.command,
                description: command.description,
                workingDirectory: command.workingDirectory,
                riskLevel: command.riskLevel,
                riskColor,
                riskIcon,
                type: 'command'
            }
        });
    }
    async requestChangeApproval(decision) {
        return this.requestApproval(decision, {
            title: 'Changes Approval Required',
            message: `The agent has prepared changes for "${decision.target}". Do you want to apply them?`,
            details: {
                description: decision.description,
                target: decision.target,
                type: decision.type,
                changes: decision.changes
            }
        });
    }
    async requestApproval(decision, uiData) {
        return new Promise((resolve, reject) => {
            // Store the decision and promise
            this.pendingDecisions.set(decision.id, decision);
            this.decisionPromises.set(decision.id, { resolve, reject });
            // Send approval request to UI via message passing
            // Note: This will be handled through the existing message system
            console.log('Agent approval request:', { decision, uiData });
            // Set timeout for approval (5 minutes)
            setTimeout(() => {
                if (this.decisionPromises.has(decision.id)) {
                    this.handleDecisionResponse(decision.id, false);
                    reject(new Error('Approval request timed out'));
                }
            }, 5 * 60 * 1000); // 5 minutes
        });
    }
    handleDecisionResponse(decisionId, approved) {
        const decision = this.pendingDecisions.get(decisionId);
        const promise = this.decisionPromises.get(decisionId);
        if (decision && promise) {
            decision.userResponse = approved ? 'approved' : 'rejected';
            // Clean up
            this.pendingDecisions.delete(decisionId);
            this.decisionPromises.delete(decisionId);
            // Resolve the promise
            promise.resolve(approved);
            // Log the decision
            console.log(`Decision ${decisionId}: ${approved ? 'APPROVED' : 'REJECTED'}`);
        }
    }
    // Bulk approval methods for power users
    async requestBulkFileApproval(tasks) {
        const results = new Map();
        // Show bulk approval UI
        const bulkDecision = await this.showBulkApprovalDialog(tasks, 'file');
        if (bulkDecision.approveAll) {
            tasks.forEach(task => results.set(task.id, true));
        }
        else if (bulkDecision.rejectAll) {
            tasks.forEach(task => results.set(task.id, false));
        }
        else {
            // Individual approvals
            for (const task of tasks) {
                const approved = await this.requestFileChangeApproval(task);
                results.set(task.id, approved);
            }
        }
        return results;
    }
    async showBulkApprovalDialog(tasks, type) {
        return new Promise((resolve) => {
            vscode.window.showInformationMessage(`The agent wants to modify ${tasks.length} ${type}s. How would you like to proceed?`, 'Approve All', 'Reject All', 'Review Individually').then(choice => {
                switch (choice) {
                    case 'Approve All':
                        resolve({ approveAll: true, rejectAll: false, individual: false });
                        break;
                    case 'Reject All':
                        resolve({ approveAll: false, rejectAll: true, individual: false });
                        break;
                    default:
                        resolve({ approveAll: false, rejectAll: false, individual: true });
                        break;
                }
            });
        });
    }
    getRiskColor(riskLevel) {
        switch (riskLevel) {
            case 'low': return '#28a745'; // Green
            case 'medium': return '#ffc107'; // Yellow
            case 'high': return '#dc3545'; // Red
            default: return '#6c757d'; // Gray
        }
    }
    getRiskIcon(riskLevel) {
        switch (riskLevel) {
            case 'low': return '✅';
            case 'medium': return '⚠️';
            case 'high': return '🚨';
            default: return 'ℹ️';
        }
    }
    // Quick approval patterns for trusted commands
    async isQuickApprovable(command) {
        const trustedCommands = [
            'npm --version',
            'node --version',
            'git --version',
            'git status',
            'npm audit',
            'npm run build',
            'npm run test',
            'npm run dev',
            'yarn --version',
            'yarn build',
            'yarn test',
            'yarn dev'
        ];
        return trustedCommands.some(trusted => command.command.toLowerCase().startsWith(trusted.toLowerCase()));
    }
    // Get pending decisions for UI display
    getPendingDecisions() {
        return Array.from(this.pendingDecisions.values());
    }
    // Cancel all pending decisions
    cancelAllPendingDecisions() {
        for (const [decisionId, promise] of this.decisionPromises.entries()) {
            promise.reject(new Error('Decision cancelled'));
        }
        this.pendingDecisions.clear();
        this.decisionPromises.clear();
    }
}
exports.AgentDecisionManager = AgentDecisionManager;
//# sourceMappingURL=agentDecisionManager.js.map