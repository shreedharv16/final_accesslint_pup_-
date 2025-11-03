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
exports.AgentTerminalExecutor = void 0;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class AgentTerminalExecutor {
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('AccessLint Terminal');
    }
    async executeCommand(command) {
        this.outputChannel.appendLine(`🔧 Executing: ${command.command}`);
        this.outputChannel.appendLine(`📁 Working directory: ${command.workingDirectory}`);
        try {
            const result = await execAsync(command.command, {
                cwd: command.workingDirectory,
                timeout: 60000,
                maxBuffer: 1024 * 1024 // 1MB buffer
            });
            command.executed = true;
            command.result = {
                success: true,
                output: result.stdout,
                exitCode: 0
            };
            this.outputChannel.appendLine(`✅ Command completed successfully`);
            this.outputChannel.appendLine(`📤 Output: ${result.stdout}`);
            return command.result;
        }
        catch (error) {
            const errorMessage = error.message || 'Unknown error';
            const exitCode = error.code || 1;
            const output = error.stdout || '';
            const stderr = error.stderr || '';
            command.executed = true;
            command.result = {
                success: false,
                output: output,
                error: `${errorMessage}\n${stderr}`,
                exitCode: exitCode
            };
            this.outputChannel.appendLine(`❌ Command failed with exit code ${exitCode}`);
            this.outputChannel.appendLine(`📤 Output: ${output}`);
            this.outputChannel.appendLine(`🚨 Error: ${stderr}`);
            return command.result;
        }
    }
    assessCommandRisk(command) {
        const commandLower = command.toLowerCase().trim();
        // High risk commands
        const highRiskPatterns = [
            /rm\s+-rf/,
            /del\s+\/[sq]/,
            /format\s+/,
            /fdisk/,
            /dd\s+if=/,
            /sudo\s+/,
            /su\s+/,
            /chmod\s+777/,
            />(>|\|)\s*\/dev\/null/,
            /mkfs\./,
            /shutdown/,
            /reboot/,
            /halt/,
            /poweroff/
        ];
        // Medium risk commands
        const mediumRiskPatterns = [
            /npm\s+install\s+-g/,
            /yarn\s+global/,
            /pip\s+install/,
            /gem\s+install/,
            /docker\s+/,
            /git\s+reset\s+--hard/,
            /git\s+clean\s+-fd/,
            /rm\s+/,
            /del\s+/,
            /rmdir/,
            /chmod/,
            /chown/,
            /mv\s+.*\.\*/,
            /cp\s+.*\.\*/
        ];
        for (const pattern of highRiskPatterns) {
            if (pattern.test(commandLower)) {
                return 'high';
            }
        }
        for (const pattern of mediumRiskPatterns) {
            if (pattern.test(commandLower)) {
                return 'medium';
            }
        }
        return 'low';
    }
    getCommandDescription(command) {
        const commandLower = command.toLowerCase().trim();
        // Common command descriptions
        const descriptions = {
            'npm install': 'Install project dependencies',
            'npm ci': 'Clean install of dependencies',
            'npm run build': 'Build the project',
            'npm run dev': 'Start development server',
            'npm run start': 'Start the application',
            'npm run test': 'Run tests',
            'npm audit': 'Check for security vulnerabilities',
            'npm update': 'Update dependencies',
            'yarn install': 'Install project dependencies with Yarn',
            'yarn build': 'Build the project with Yarn',
            'yarn dev': 'Start development server with Yarn',
            'yarn test': 'Run tests with Yarn',
            'git status': 'Check repository status',
            'git add': 'Stage files for commit',
            'git commit': 'Commit changes',
            'git push': 'Push changes to remote repository',
            'git pull': 'Pull changes from remote repository'
        };
        // Check for exact matches first
        for (const [cmd, desc] of Object.entries(descriptions)) {
            if (commandLower.startsWith(cmd)) {
                return desc;
            }
        }
        // Extract base command for generic description
        const baseCommand = commandLower.split(' ')[0];
        switch (baseCommand) {
            case 'npm':
                return 'Run npm command';
            case 'yarn':
                return 'Run Yarn command';
            case 'git':
                return 'Run Git command';
            case 'docker':
                return 'Run Docker command';
            case 'node':
                return 'Execute Node.js script';
            case 'python':
                return 'Execute Python script';
            case 'pip':
                return 'Install Python package';
            case 'curl':
                return 'Make HTTP request';
            case 'wget':
                return 'Download file';
            case 'ls':
            case 'dir':
                return 'List directory contents';
            case 'cd':
                return 'Change directory';
            case 'mkdir':
                return 'Create directory';
            case 'cp':
            case 'copy':
                return 'Copy files';
            case 'mv':
            case 'move':
                return 'Move/rename files';
            case 'rm':
            case 'del':
                return 'Delete files';
            default:
                return `Execute: ${command}`;
        }
    }
    validateCommand(command) {
        if (!command || command.trim().length === 0) {
            return { valid: false, reason: 'Command cannot be empty' };
        }
        // Check for extremely dangerous commands
        const bannedPatterns = [
            /rm\s+-rf\s+\/$/,
            /rm\s+-rf\s+\*$/,
            /format\s+c:/i,
            /del\s+\/[sq]\s+\*\.\*$/i,
            /dd\s+if=.*of=\/dev\/sd[a-z]/,
            /mkfs\./,
            /:(){ :|:& };:/ // Fork bomb
        ];
        for (const pattern of bannedPatterns) {
            if (pattern.test(command)) {
                return { valid: false, reason: 'Command is too dangerous and has been blocked' };
            }
        }
        // Check command length
        if (command.length > 500) {
            return { valid: false, reason: 'Command is too long' };
        }
        // Check for shell injection patterns
        const injectionPatterns = [
            /[;&|`$(){}[\]]/,
            /\$\(/,
            /`.*`/,
            /\$\{.*\}/
        ];
        for (const pattern of injectionPatterns) {
            if (pattern.test(command)) {
                return { valid: false, reason: 'Command contains potentially unsafe characters' };
            }
        }
        return { valid: true };
    }
    createSafeCommand(originalCommand) {
        const command = {
            id: Date.now().toString(),
            command: originalCommand.trim(),
            workingDirectory: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
            description: this.getCommandDescription(originalCommand),
            riskLevel: this.assessCommandRisk(originalCommand),
            userApprovalRequired: true,
            executed: false
        };
        // Auto-approve only very safe commands
        const autoApproveSafeCommands = [
            'npm --version',
            'node --version',
            'git --version',
            'git status',
            'ls',
            'dir',
            'pwd',
            'whoami'
        ];
        if (autoApproveSafeCommands.includes(command.command.toLowerCase())) {
            command.userApprovalRequired = false;
            command.riskLevel = 'low';
        }
        return command;
    }
    dispose() {
        this.outputChannel.dispose();
    }
}
exports.AgentTerminalExecutor = AgentTerminalExecutor;
//# sourceMappingURL=agentTerminalExecutor.js.map