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
exports.BottomMenuProvider = void 0;
const vscode = __importStar(require("vscode"));
class BottomMenuProvider {
    constructor() {
        this.currentDisposables = [];
        this.commandId = '';
    }
    showMenu(onAccept, onReject, changesCount, fileName) {
        // Clean up any existing menu first
        this.hideMenu();
        this.onAcceptCallback = onAccept;
        this.onRejectCallback = onReject;
        // Create unique command IDs for this file
        const timestamp = Date.now();
        this.commandId = `_${timestamp}`;
        const acceptCommandId = `accesslint.acceptChanges${this.commandId}`;
        const rejectCommandId = `accesslint.rejectChanges${this.commandId}`;
        // Create status bar items
        this.statusBarAccept = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 200);
        this.statusBarReject = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 199);
        // Configure Accept button
        this.statusBarAccept.text = `$(check) Accept Changes (${fileName})`;
        this.statusBarAccept.tooltip = `Accept ${changesCount} accessibility improvements for ${fileName}`;
        this.statusBarAccept.command = acceptCommandId;
        this.statusBarAccept.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        // Configure Reject button  
        this.statusBarReject.text = "$(x) Reject";
        this.statusBarReject.tooltip = `Reject changes for ${fileName} and keep original`;
        this.statusBarReject.command = rejectCommandId;
        // Show both buttons
        this.statusBarAccept.show();
        this.statusBarReject.show();
        // Register unique commands for this file
        const acceptDisposable = vscode.commands.registerCommand(acceptCommandId, async () => {
            if (this.onAcceptCallback) {
                await this.onAcceptCallback();
            }
            this.hideMenu();
        });
        const rejectDisposable = vscode.commands.registerCommand(rejectCommandId, async () => {
            if (this.onRejectCallback) {
                await this.onRejectCallback();
            }
            this.hideMenu();
        });
        // Store disposables for cleanup
        this.currentDisposables.push(acceptDisposable, rejectDisposable);
        // Auto-hide after 5 minutes as a fallback
        const timeoutDisposable = setTimeout(() => {
            this.hideMenu();
        }, 300000);
        this.currentDisposables.push({
            dispose: () => clearTimeout(timeoutDisposable)
        });
    }
    hideMenu() {
        // Dispose of status bar items
        if (this.statusBarAccept) {
            this.statusBarAccept.hide();
            this.statusBarAccept.dispose();
            this.statusBarAccept = undefined;
        }
        if (this.statusBarReject) {
            this.statusBarReject.hide();
            this.statusBarReject.dispose();
            this.statusBarReject = undefined;
        }
        // Dispose of commands and other disposables
        this.currentDisposables.forEach(disposable => {
            try {
                disposable.dispose();
            }
            catch (error) {
                // Ignore disposal errors
            }
        });
        this.currentDisposables = [];
        // Clear callbacks
        this.onAcceptCallback = undefined;
        this.onRejectCallback = undefined;
        this.commandId = '';
    }
    dispose() {
        this.hideMenu();
    }
}
exports.BottomMenuProvider = BottomMenuProvider;
//# sourceMappingURL=bottomMenuProvider.js.map