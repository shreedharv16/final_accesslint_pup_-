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
exports.AgentTaskPlanner = void 0;
const vscode = __importStar(require("vscode"));
class AgentTaskPlanner {
    constructor(geminiChat) {
        this.geminiChat = geminiChat;
    }
    async createPlan(goal, scope, targetPath) {
        const planId = Date.now().toString();
        // Analyze the workspace/target to understand context
        const context = await this.analyzeContext(scope, targetPath);
        // Generate tasks using AI
        const tasks = await this.generateTasks(goal, scope, targetPath, context);
        // Create the plan
        const plan = {
            id: planId,
            goal,
            tasks,
            totalTasks: tasks.length,
            completedTasks: 0,
            status: 'planning',
            aiCallsUsed: 1,
            aiCallsLimit: 5
        };
        return plan;
    }
    async analyzeContext(scope, targetPath) {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            throw new Error('No workspace folder found');
        }
        const context = {
            workspaceRoot,
            scope,
            targetPath
        };
        if (scope === 'file' && targetPath) {
            // Analyze specific file
            try {
                const fileUri = vscode.Uri.file(targetPath);
                const fileContent = await vscode.workspace.fs.readFile(fileUri);
                context.fileContent = Buffer.from(fileContent).toString('utf8');
                context.fileExtension = targetPath.split('.').pop();
            }
            catch (error) {
                context.error = `Cannot read file: ${error}`;
            }
        }
        else if (scope === 'folder' && targetPath) {
            // Analyze folder structure
            try {
                const folderUri = vscode.Uri.file(targetPath);
                const entries = await vscode.workspace.fs.readDirectory(folderUri);
                context.folderContents = entries.map(([name, type]) => ({
                    name,
                    type: type === vscode.FileType.Directory ? 'directory' : 'file'
                }));
            }
            catch (error) {
                context.error = `Cannot read folder: ${error}`;
            }
        }
        else if (scope === 'repository') {
            // Analyze entire repository
            const packageJsonPath = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), 'package.json');
            try {
                const packageContent = await vscode.workspace.fs.readFile(packageJsonPath);
                const packageJson = JSON.parse(Buffer.from(packageContent).toString('utf8'));
                context.packageJson = packageJson;
                context.projectType = this.detectProjectType(packageJson);
            }
            catch (error) {
                context.packageJsonError = 'No package.json found';
            }
        }
        return context;
    }
    detectProjectType(packageJson) {
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        if (dependencies.react || dependencies['@types/react'])
            return 'React';
        if (dependencies.angular || dependencies['@angular/core'])
            return 'Angular';
        if (dependencies.vue || dependencies['@vue/cli'])
            return 'Vue';
        if (dependencies.svelte)
            return 'Svelte';
        if (dependencies.next)
            return 'Next.js';
        if (dependencies.nuxt)
            return 'Nuxt.js';
        if (dependencies.express)
            return 'Express';
        return 'Unknown';
    }
    async generateTasks(goal, scope, targetPath, context) {
        const prompt = this.buildTaskGenerationPrompt(goal, scope, targetPath, context);
        try {
            const response = await this.geminiChat.sendMessage(prompt);
            return this.parseTasksFromResponse(response);
        }
        catch (error) {
            // Fallback to predefined tasks if AI fails
            return this.generateFallbackTasks(goal, scope, targetPath);
        }
    }
    buildTaskGenerationPrompt(goal, scope, targetPath, context) {
        let prompt = `You are an accessibility expert AI agent. Create a specific, actionable task plan to achieve this goal: "${goal}"

CONTEXT:
- Scope: ${scope}
- Target: ${targetPath || 'auto-detect'}
- Project Type: ${context?.projectType || 'Unknown'}
${context?.fileExtension ? `- File Type: ${context.fileExtension}` : ''}

CONSTRAINTS:
- Maximum 5 AI calls total (including this one)
- Each task must be specific and actionable
- Tasks can be: file_conversion, module_conversion, terminal_command, or analysis
- Consider dependencies between tasks
- Focus on WCAG 2.1 compliance and accessibility best practices

RESPONSE FORMAT:
Respond with a JSON array of tasks. Each task should have:
{
  "type": "file_conversion|module_conversion|terminal_command|analysis",
  "title": "Brief descriptive title",
  "description": "Detailed description or command",
  "target": "file/folder path",
  "priority": 1-10,
  "userApprovalRequired": true/false,
  "estimatedDuration": seconds,
  "dependencies": ["task_index_array"]
}

EXAMPLES:
For "Make my React app accessible":
[
  {
    "type": "analysis",
    "title": "Scan repository for accessibility issues",
    "description": "Analyze all React components for WCAG violations",
    "target": "src/",
    "priority": 10,
    "userApprovalRequired": false,
    "estimatedDuration": 30,
    "dependencies": []
  },
  {
    "type": "terminal_command", 
    "title": "Install accessibility testing tools",
    "description": "npm install --save-dev @axe-core/react eslint-plugin-jsx-a11y",
    "target": ".",
    "priority": 8,
    "userApprovalRequired": true,
    "estimatedDuration": 60,
    "dependencies": []
  },
  {
    "type": "file_conversion",
    "title": "Fix navigation component accessibility",
    "description": "Add ARIA labels, keyboard navigation, and semantic HTML",
    "target": "src/components/Navigation.jsx",
    "priority": 9,
    "userApprovalRequired": true,
    "estimatedDuration": 120,
    "dependencies": [0]
  }
]

Generate tasks for the goal: "${goal}"`;
        return prompt;
    }
    parseTasksFromResponse(response) {
        try {
            // Try to extract JSON from the response
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('No JSON array found in response');
            }
            const tasksData = JSON.parse(jsonMatch[0]);
            if (!Array.isArray(tasksData)) {
                throw new Error('Response is not an array');
            }
            return tasksData.map((task, index) => ({
                id: `task_${Date.now()}_${index}`,
                type: task.type || 'analysis',
                title: task.title || `Task ${index + 1}`,
                description: task.description || '',
                target: task.target || '.',
                status: 'pending',
                priority: task.priority || 5,
                dependencies: task.dependencies?.map((depIndex) => `task_${Date.now()}_${depIndex}`) || [],
                userApprovalRequired: task.userApprovalRequired !== false,
                estimatedDuration: task.estimatedDuration || 60
            }));
        }
        catch (error) {
            throw new Error(`Failed to parse tasks from AI response: ${error}`);
        }
    }
    generateFallbackTasks(goal, scope, targetPath) {
        const baseId = Date.now();
        const tasks = [];
        if (scope === 'file' && targetPath) {
            tasks.push({
                id: `task_${baseId}_0`,
                type: 'file_conversion',
                title: `Make ${targetPath} accessible`,
                description: `Apply accessibility improvements to the file`,
                target: targetPath,
                status: 'pending',
                priority: 10,
                dependencies: [],
                userApprovalRequired: true,
                estimatedDuration: 120
            });
        }
        else if (scope === 'folder' && targetPath) {
            tasks.push({
                id: `task_${baseId}_0`,
                type: 'analysis',
                title: `Analyze folder for accessibility issues`,
                description: `Scan all files in the folder for WCAG violations`,
                target: targetPath,
                status: 'pending',
                priority: 9,
                dependencies: [],
                userApprovalRequired: false,
                estimatedDuration: 60
            });
            tasks.push({
                id: `task_${baseId}_1`,
                type: 'module_conversion',
                title: `Convert folder to accessible code`,
                description: `Apply accessibility improvements to all files in the folder`,
                target: targetPath,
                status: 'pending',
                priority: 8,
                dependencies: [`task_${baseId}_0`],
                userApprovalRequired: true,
                estimatedDuration: 300
            });
        }
        else if (scope === 'repository') {
            tasks.push({
                id: `task_${baseId}_0`,
                type: 'analysis',
                title: 'Repository accessibility audit',
                description: 'Comprehensive accessibility analysis of the entire repository',
                target: '.',
                status: 'pending',
                priority: 10,
                dependencies: [],
                userApprovalRequired: false,
                estimatedDuration: 90
            });
            tasks.push({
                id: `task_${baseId}_1`,
                type: 'terminal_command',
                title: 'Install accessibility tools',
                description: 'npm audit && npm install --save-dev @axe-core/react eslint-plugin-jsx-a11y',
                target: '.',
                status: 'pending',
                priority: 8,
                dependencies: [],
                userApprovalRequired: true,
                estimatedDuration: 120
            });
        }
        return tasks;
    }
    // Helper method to reorder tasks based on dependencies
    resolveDependencies(tasks) {
        const taskMap = new Map(tasks.map(task => [task.id, task]));
        const resolved = [];
        const resolving = new Set();
        const resolve = (taskId) => {
            if (resolved.find(t => t.id === taskId))
                return;
            if (resolving.has(taskId)) {
                throw new Error(`Circular dependency detected involving task ${taskId}`);
            }
            const task = taskMap.get(taskId);
            if (!task)
                return;
            resolving.add(taskId);
            // Resolve dependencies first
            for (const depId of task.dependencies || []) {
                resolve(depId);
            }
            resolving.delete(taskId);
            resolved.push(task);
        };
        for (const task of tasks) {
            resolve(task.id);
        }
        return resolved;
    }
}
exports.AgentTaskPlanner = AgentTaskPlanner;
//# sourceMappingURL=agentTaskPlanner.js.map