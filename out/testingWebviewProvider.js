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
exports.TestingWebviewProvider = void 0;
const vscode = __importStar(require("vscode"));
const accessibilityTester_1 = require("./accessibilityTester");
class TestingWebviewProvider {
    constructor(_extensionUri, context, agentOrchestrator) {
        this._extensionUri = _extensionUri;
        this.context = context;
        this.tester = null;
        this.agentOrchestrator = null;
        this.outputChannel = vscode.window.createOutputChannel('AccessLint Testing');
        this.agentOrchestrator = agentOrchestrator || null;
    }
    setAgentOrchestrator(orchestrator) {
        this.agentOrchestrator = orchestrator;
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        // Listen for messages from the webview
        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.type) {
                case 'startTest':
                    this._handleStartTest(message.url);
                    break;
                case 'cancelTest':
                    this._handleCancelTest();
                    break;
                case 'fixIssues':
                    this._handleFixIssues(message.result);
                    break;
            }
        }, undefined, this.context.subscriptions);
    }
    async _handleStartTest(url) {
        if (!this._view) {
            return;
        }
        try {
            // Validate URL
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'http://' + url;
            }
            // Send testing started message
            this._view.webview.postMessage({
                type: 'testingStarted',
                url: url
            });
            this.outputChannel.show();
            this.outputChannel.appendLine('='.repeat(80));
            this.outputChannel.appendLine(`🧪 Starting Accessibility Test for: ${url}`);
            this.outputChannel.appendLine('='.repeat(80));
            // Initialize tester
            this.tester = new accessibilityTester_1.AccessibilityTester(this.outputChannel);
            await this.tester.initialize();
            // Run the test with progress updates
            const result = await this.tester.testUrl(url, (progressMessage) => {
                if (this._view) {
                    this._view.webview.postMessage({
                        type: 'testingProgress',
                        message: progressMessage
                    });
                }
            });
            // Close the browser
            await this.tester.close();
            this.tester = null;
            // Send results to webview
            this._view.webview.postMessage({
                type: 'testingComplete',
                result: result
            });
            this.outputChannel.appendLine('\n' + '='.repeat(80));
            this.outputChannel.appendLine('✅ Testing Complete');
            this.outputChannel.appendLine(`Total Issues: ${result.issues.length}`);
            this.outputChannel.appendLine(`  - Errors: ${result.summary.errors}`);
            this.outputChannel.appendLine(`  - Warnings: ${result.summary.warnings}`);
            this.outputChannel.appendLine(`  - Info: ${result.summary.info}`);
            this.outputChannel.appendLine('='.repeat(80));
        }
        catch (error) {
            this.outputChannel.appendLine(`\n❌ Error during testing: ${error}`);
            if (this.tester) {
                await this.tester.close();
                this.tester = null;
            }
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'testingError',
                    error: error instanceof Error ? error.message : String(error)
                });
            }
            vscode.window.showErrorMessage(`Accessibility testing failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async _handleCancelTest() {
        if (this.tester) {
            this.outputChannel.appendLine('🛑 Test cancelled by user');
            await this.tester.close();
            this.tester = null;
        }
        if (this._view) {
            this._view.webview.postMessage({
                type: 'testingCancelled'
            });
        }
    }
    async _handleFixIssues(testResult) {
        if (!this._view) {
            return;
        }
        if (!this.agentOrchestrator) {
            vscode.window.showErrorMessage('Agent orchestrator not available. Please ensure the extension is properly initialized.');
            return;
        }
        try {
            // Send fixing started message
            this._view.webview.postMessage({
                type: 'fixingStarted'
            });
            this.outputChannel.appendLine('='.repeat(80));
            this.outputChannel.appendLine(`🔧 Starting Automated Accessibility Fixes`);
            this.outputChannel.appendLine('='.repeat(80));
            // Convert test results to agent prompt
            const fixPrompt = this._createFixPrompt(testResult);
            // Start agent session with the fix prompt
            const sessionId = await this.agentOrchestrator.startSession(fixPrompt, 'anthropic');
            // Wait for agent to complete (poll session status)
            await this._waitForAgentCompletion(sessionId);
            // Send completion message
            this._view.webview.postMessage({
                type: 'fixingComplete',
                summary: {
                    message: 'Agent has completed fixing accessibility issues. Check the output channel for details.'
                }
            });
            this.outputChannel.appendLine('\n' + '='.repeat(80));
            this.outputChannel.appendLine('✅ Accessibility Fixes Complete');
            this.outputChannel.appendLine('='.repeat(80));
        }
        catch (error) {
            this.outputChannel.appendLine(`\n❌ Error during fixing: ${error}`);
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'fixingError',
                    error: error instanceof Error ? error.message : String(error)
                });
            }
            vscode.window.showErrorMessage(`Accessibility fixing failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    _createFixPrompt(testResult) {
        let prompt = `Fix the following accessibility issues found by NVDA screen reader testing on ${testResult.url}:\n\n`;
        prompt += `## Issues Found (${testResult.issues.length} total)\n\n`;
        // Group issues by severity
        const errors = testResult.issues.filter(i => i.severity === 'error');
        const warnings = testResult.issues.filter(i => i.severity === 'warning');
        const info = testResult.issues.filter(i => i.severity === 'info');
        if (errors.length > 0) {
            prompt += `### ❌ Errors (${errors.length}):\n`;
            errors.forEach((issue, index) => {
                prompt += `${index + 1}. **${issue.criterion}**: ${issue.description}\n`;
                if (issue.nvdaAnnouncement) {
                    prompt += `   - NVDA announced: "${issue.nvdaAnnouncement}"\n`;
                }
                if (issue.expectedAnnouncement) {
                    prompt += `   - Expected: "${issue.expectedAnnouncement}"\n`;
                }
                if (issue.element) {
                    prompt += `   - Element: ${issue.element}\n`;
                }
                if (issue.location) {
                    prompt += `   - Location: ${issue.location}\n`;
                }
                prompt += '\n';
            });
        }
        if (warnings.length > 0) {
            prompt += `### ⚠️ Warnings (${warnings.length}):\n`;
            warnings.forEach((issue, index) => {
                prompt += `${index + 1}. **${issue.criterion}**: ${issue.description}\n`;
                if (issue.nvdaAnnouncement) {
                    prompt += `   - NVDA announced: "${issue.nvdaAnnouncement}"\n`;
                }
                if (issue.element) {
                    prompt += `   - Element: ${issue.element}\n`;
                }
                prompt += '\n';
            });
        }
        if (info.length > 0) {
            prompt += `### ℹ️ Info (${info.length}):\n`;
            info.forEach((issue, index) => {
                prompt += `${index + 1}. **${issue.criterion}**: ${issue.description}\n`;
                if (issue.nvdaAnnouncement) {
                    prompt += `   - NVDA announced: "${issue.nvdaAnnouncement}"\n`;
                }
                prompt += '\n';
            });
        }
        prompt += `\n## Your Task:\n`;
        prompt += `1. Analyze the workspace to find the HTML/React/Vue files for this website\n`;
        prompt += `2. Fix each accessibility issue by:\n`;
        prompt += `   - Adding proper semantic HTML elements\n`;
        prompt += `   - Adding ARIA labels and roles where needed\n`;
        prompt += `   - Fixing heading hierarchy\n`;
        prompt += `   - Adding alt text to images\n`;
        prompt += `   - Ensuring proper reading order\n`;
        prompt += `   - Making interactive elements keyboard accessible\n`;
        prompt += `3. Use write_file or edit_file tools to make the changes\n`;
        prompt += `4. Focus on fixing the errors first, then warnings\n\n`;
        prompt += `Please start by exploring the workspace structure to understand the project, then fix the issues systematically.`;
        return prompt;
    }
    async _waitForAgentCompletion(sessionId) {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                const session = this.agentOrchestrator?.getSessionStatus();
                if (!session || session.id !== sessionId) {
                    clearInterval(checkInterval);
                    resolve();
                    return;
                }
                if (session.status !== 'active') {
                    clearInterval(checkInterval);
                    resolve();
                }
                // Send progress update to webview
                if (this._view) {
                    this._view.webview.postMessage({
                        type: 'fixingProgress',
                        message: `Agent working... (iteration ${session.iterations})`
                    });
                }
            }, 1000); // Check every second
        });
    }
    _getHtmlForWebview(webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webviews', 'testing.js'));
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webviews', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webviews', 'vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webviews', 'testing.css'));
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleResetUri}" rel="stylesheet">
    <link href="${styleVSCodeUri}" rel="stylesheet">
    <link href="${styleMainUri}" rel="stylesheet">
    <title>Accessibility Testing</title>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Accessibility Testing</h1>
            <p class="subtitle">Test your website for WCAG compliance</p>
        </div>

        <div class="input-section">
            <div class="url-input-group">
                <input 
                    type="text" 
                    id="urlInput" 
                    class="url-input" 
                    placeholder="Enter URL (e.g., localhost:3000 or https://example.com)"
                    aria-label="Website URL to test"
                />
                <button id="startTestBtn" class="primary-button" aria-label="Start accessibility test">
                    <span class="button-icon">▶</span> Start Test
                </button>
            </div>
            <div class="quick-links">
                <button class="quick-link-btn" data-url="http://localhost:3000">localhost:3000</button>
                <button class="quick-link-btn" data-url="http://localhost:8080">localhost:8080</button>
                <button class="quick-link-btn" data-url="http://localhost:5173">localhost:5173</button>
            </div>
        </div>

        <div id="testingStatus" class="testing-status hidden">
            <div class="status-header">
                <div class="spinner"></div>
                <span id="statusText">Initializing test...</span>
            </div>
            <button id="cancelTestBtn" class="secondary-button">Cancel Test</button>
            <div id="progressLog" class="progress-log"></div>
        </div>

        <div id="results" class="results-section hidden">
            <div class="results-header">
                <h2>Test Results</h2>
                <div class="results-meta">
                    <span id="testedUrl"></span>
                    <span id="timestamp"></span>
                </div>
            </div>

            <div class="summary-cards">
                <div class="summary-card error-card">
                    <div class="card-icon">❌</div>
                    <div class="card-content">
                        <div class="card-count" id="errorCount">0</div>
                        <div class="card-label">Errors</div>
                    </div>
                </div>
                <div class="summary-card warning-card">
                    <div class="card-icon">⚠️</div>
                    <div class="card-content">
                        <div class="card-count" id="warningCount">0</div>
                        <div class="card-label">Warnings</div>
                    </div>
                </div>
                <div class="summary-card info-card">
                    <div class="card-icon">ℹ️</div>
                    <div class="card-content">
                        <div class="card-count" id="infoCount">0</div>
                        <div class="card-label">Info</div>
                    </div>
                </div>
            </div>

            <div class="filter-section">
                <button class="filter-btn active" data-filter="all">All</button>
                <button class="filter-btn" data-filter="error">Errors</button>
                <button class="filter-btn" data-filter="warning">Warnings</button>
                <button class="filter-btn" data-filter="info">Info</button>
            </div>

            <div id="fixSection" class="fix-section hidden">
                <button id="fixIssuesBtn" class="fix-issues-button">
                    <span class="button-icon">🔧</span> Fix Accessibility Issues
                </button>
                <div id="fixProgress" class="fix-progress hidden">
                    <div class="fix-status">
                        <div class="spinner"></div>
                        <span id="fixStatusText">Analyzing issues...</span>
                    </div>
                </div>
                <div id="fixSummary" class="fix-summary hidden"></div>
            </div>

            <div id="issuesList" class="issues-list"></div>
        </div>

        <div id="emptyState" class="empty-state">
            <div class="empty-icon">🔍</div>
            <h3>No tests run yet</h3>
            <p>Enter a URL above to start testing for accessibility issues</p>
        </div>
    </div>

    <script src="${scriptUri}"></script>
</body>
</html>`;
    }
    dispose() {
        if (this.tester) {
            this.tester.close();
        }
    }
}
exports.TestingWebviewProvider = TestingWebviewProvider;
TestingWebviewProvider.viewType = 'accesslint.testingView';
//# sourceMappingURL=testingWebviewProvider.js.map