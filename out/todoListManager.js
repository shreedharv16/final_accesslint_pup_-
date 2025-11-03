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
exports.TodoListManager = void 0;
const vscode = __importStar(require("vscode"));
class TodoListManager {
    constructor(aiProviderManager) {
        this.currentTodoList = null;
        this.aiProviderManager = aiProviderManager;
        this.outputChannel = vscode.window.createOutputChannel('AccessLint Todo');
    }
    /**
     * Create a new todo list for a user query using LLM
     */
    async createTodoList(query, sessionId, provider = 'anthropic') {
        this.outputChannel.appendLine(`📝 Creating todo list for: ${query}`);
        try {
            // Generate todo items using AI
            const todoItems = await this.generateTodoItems(query, provider);
            const todoList = {
                id: `todo_${Date.now()}`,
                sessionId,
                query,
                items: todoItems,
                status: 'active',
                createdAt: new Date(),
                maxItems: 5 // As requested: 4-5 max
            };
            this.currentTodoList = todoList;
            this.outputChannel.appendLine(`✅ Todo list created with ${todoItems.length} items`);
            return todoList;
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Failed to create todo list: ${error}`);
            throw error;
        }
    }
    /**
     * Generate todo items using LLM
     */
    async generateTodoItems(query, provider) {
        const prompt = `You are an AI assistant that creates simple, actionable todo lists for coding tasks. 

User Query: "${query}"

Create a simple todo list with 4-5 maximum items that break down this task into clear, actionable steps. Each item should be specific and achievable.

IMPORTANT CONSTRAINTS:
- Maximum 4-5 items only
- Each item should be a single, clear action
- Items should be ordered logically (dependencies first)
- Keep titles concise (under 50 characters)
- Estimate duration in minutes (5-60 minutes per item)

RESPONSE FORMAT (JSON only):
{
  "items": [
    {
      "title": "Brief action title",
      "description": "Optional detailed description",
      "priority": 1-5,
      "estimatedDuration": 15
    }
  ]
}

Generate the todo list now:`;
        try {
            const response = await this.aiProviderManager.sendMessage(prompt, provider);
            return this.parseTodoItemsFromResponse(response.text || '');
        }
        catch (error) {
            this.outputChannel.appendLine(`⚠️ AI generation failed, using fallback: ${error}`);
            return this.generateFallbackTodoItems(query);
        }
    }
    /**
     * Parse todo items from AI response
     */
    parseTodoItemsFromResponse(response) {
        try {
            // Extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            const data = JSON.parse(jsonMatch[0]);
            if (!data.items || !Array.isArray(data.items)) {
                throw new Error('Invalid response format - no items array');
            }
            // Limit to 5 items maximum
            const limitedItems = data.items.slice(0, 5);
            return limitedItems.map((item, index) => ({
                id: `todo_item_${Date.now()}_${index}`,
                title: item.title || `Task ${index + 1}`,
                description: item.description || '',
                status: 'pending',
                priority: Math.min(Math.max(item.priority || 3, 1), 5),
                createdAt: new Date(),
                estimatedDuration: Math.min(Math.max(item.estimatedDuration || 15, 5), 60) // Clamp between 5-60 minutes
            }));
        }
        catch (error) {
            throw new Error(`Failed to parse todo items: ${error}`);
        }
    }
    /**
     * Generate fallback todo items when AI fails
     */
    generateFallbackTodoItems(query) {
        const baseId = Date.now();
        const items = [];
        // Create generic todo items based on query keywords
        if (query.toLowerCase().includes('fix') || query.toLowerCase().includes('bug')) {
            items.push({
                id: `todo_item_${baseId}_0`,
                title: 'Analyze the issue',
                description: 'Identify the root cause of the problem',
                status: 'pending',
                priority: 5,
                createdAt: new Date(),
                estimatedDuration: 15
            }, {
                id: `todo_item_${baseId}_1`,
                title: 'Implement solution',
                description: 'Apply the fix to resolve the issue',
                status: 'pending',
                priority: 4,
                createdAt: new Date(),
                estimatedDuration: 30
            }, {
                id: `todo_item_${baseId}_2`,
                title: 'Test the fix',
                description: 'Verify that the issue is resolved',
                status: 'pending',
                priority: 3,
                createdAt: new Date(),
                estimatedDuration: 10
            });
        }
        else if (query.toLowerCase().includes('create') || query.toLowerCase().includes('add')) {
            items.push({
                id: `todo_item_${baseId}_0`,
                title: 'Plan the implementation',
                description: 'Design the structure and approach',
                status: 'pending',
                priority: 5,
                createdAt: new Date(),
                estimatedDuration: 20
            }, {
                id: `todo_item_${baseId}_1`,
                title: 'Create the feature',
                description: 'Implement the new functionality',
                status: 'pending',
                priority: 4,
                createdAt: new Date(),
                estimatedDuration: 45
            }, {
                id: `todo_item_${baseId}_2`,
                title: 'Test and validate',
                description: 'Ensure the feature works correctly',
                status: 'pending',
                priority: 3,
                createdAt: new Date(),
                estimatedDuration: 15
            });
        }
        else {
            // Generic fallback
            items.push({
                id: `todo_item_${baseId}_0`,
                title: 'Analyze requirements',
                description: 'Understand what needs to be done',
                status: 'pending',
                priority: 5,
                createdAt: new Date(),
                estimatedDuration: 15
            }, {
                id: `todo_item_${baseId}_1`,
                title: 'Execute the task',
                description: 'Complete the main work',
                status: 'pending',
                priority: 4,
                createdAt: new Date(),
                estimatedDuration: 30
            }, {
                id: `todo_item_${baseId}_2`,
                title: 'Review and finalize',
                description: 'Check the results and make adjustments',
                status: 'pending',
                priority: 3,
                createdAt: new Date(),
                estimatedDuration: 10
            });
        }
        return items;
    }
    /**
     * Update todo item status
     */
    updateTodoItem(itemId, status) {
        if (!this.currentTodoList) {
            return;
        }
        const item = this.currentTodoList.items.find(item => item.id === itemId);
        if (!item) {
            return;
        }
        const oldStatus = item.status;
        item.status = status;
        if (status === 'completed') {
            item.completedAt = new Date();
        }
        this.outputChannel.appendLine(`📋 Todo item "${item.title}" changed from ${oldStatus} to ${status}`);
        // Check if all items are completed
        if (this.areAllItemsCompleted()) {
            this.completeTodoList();
        }
    }
    /**
     * Mark current todo item as in progress
     */
    markCurrentItemInProgress(itemId) {
        this.updateTodoItem(itemId, 'in_progress');
    }
    /**
     * Mark current todo item as completed
     */
    markCurrentItemCompleted(itemId) {
        this.updateTodoItem(itemId, 'completed');
    }
    /**
     * Get next pending todo item
     */
    getNextPendingItem() {
        if (!this.currentTodoList) {
            return null;
        }
        return this.currentTodoList.items
            .filter(item => item.status === 'pending')
            .sort((a, b) => b.priority - a.priority)[0] || null;
    }
    /**
     * Check if all items are completed
     */
    areAllItemsCompleted() {
        if (!this.currentTodoList) {
            return false;
        }
        return this.currentTodoList.items.every(item => item.status === 'completed' || item.status === 'cancelled');
    }
    /**
     * Complete the current todo list
     */
    completeTodoList() {
        if (!this.currentTodoList) {
            return;
        }
        this.currentTodoList.status = 'completed';
        this.currentTodoList.completedAt = new Date();
        const completedCount = this.currentTodoList.items.filter(item => item.status === 'completed').length;
        const totalCount = this.currentTodoList.items.length;
        this.outputChannel.appendLine(`🎉 Todo list completed! ${completedCount}/${totalCount} items finished`);
    }
    /**
     * Get current todo list
     */
    getCurrentTodoList() {
        return this.currentTodoList;
    }
    /**
     * Cancel current todo list
     */
    cancelTodoList() {
        if (!this.currentTodoList) {
            return;
        }
        this.currentTodoList.status = 'cancelled';
        this.outputChannel.appendLine('❌ Todo list cancelled');
    }
    /**
     * Get todo list summary for UI display
     */
    getTodoListSummary() {
        if (!this.currentTodoList) {
            return null;
        }
        const completedCount = this.currentTodoList.items.filter(item => item.status === 'completed').length;
        const inProgressCount = this.currentTodoList.items.filter(item => item.status === 'in_progress').length;
        const pendingCount = this.currentTodoList.items.filter(item => item.status === 'pending').length;
        return {
            id: this.currentTodoList.id,
            query: this.currentTodoList.query,
            status: this.currentTodoList.status,
            progress: Math.round((completedCount / this.currentTodoList.items.length) * 100),
            items: this.currentTodoList.items,
            stats: {
                total: this.currentTodoList.items.length,
                completed: completedCount,
                inProgress: inProgressCount,
                pending: pendingCount
            },
            createdAt: this.currentTodoList.createdAt,
            completedAt: this.currentTodoList.completedAt
        };
    }
    /**
     * Dispose resources
     */
    dispose() {
        this.outputChannel.dispose();
    }
}
exports.TodoListManager = TodoListManager;
//# sourceMappingURL=todoListManager.js.map