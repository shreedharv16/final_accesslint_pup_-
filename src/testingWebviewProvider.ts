import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AccessibilityTester, TestResult, NVDAInteraction } from './accessibilityTester';
import { TestingAgentOrchestrator } from './testingAgentOrchestrator';

export class TestingWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'accesslint.testingView';

    private _view?: vscode.WebviewView;
    private outputChannel: vscode.OutputChannel;
    private tester: AccessibilityTester | null = null;
    private agentOrchestrator: TestingAgentOrchestrator | null = null;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        protected readonly context: vscode.ExtensionContext,
        agentOrchestrator?: TestingAgentOrchestrator
    ) {
        this.outputChannel = vscode.window.createOutputChannel('AccessLint Testing');
        this.agentOrchestrator = agentOrchestrator || null;
    }

    public setAgentOrchestrator(orchestrator: TestingAgentOrchestrator): void {
        this.agentOrchestrator = orchestrator;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Listen for messages from the webview
        webviewView.webview.onDidReceiveMessage(
            message => {
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
                    case 'downloadReport':
                        this._handleDownloadReport(message.result);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    private async _handleStartTest(url: string) {
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

            // Initialize tester with AI provider for comprehensive validation
            const aiProvider = this.agentOrchestrator ? (this.agentOrchestrator as any).aiProviderManager : null;
            this.tester = new AccessibilityTester(this.outputChannel, aiProvider);
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

        } catch (error) {
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

    private async _handleCancelTest() {
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

    private async _handleFixIssues(testResult: TestResult) {
        if (!this._view) {
            return;
        }

        if (!this.agentOrchestrator) {
            vscode.window.showErrorMessage('Agent orchestrator not available. Please ensure the extension is properly initialized.');
            return;
        }

        try {
            // Ask user which provider to use
            const providerChoice = await vscode.window.showQuickPick([
                { label: 'Azure OpenAI (GPT)', value: 'openai' as const, description: 'Uses Azure OpenAI GPT model' },
                { label: 'Anthropic (Claude)', value: 'anthropic' as const, description: 'Uses Claude Sonnet' },
                { label: 'Gemini', value: 'gemini' as const, description: 'Uses Google Gemini' }
            ], {
                placeHolder: 'Select AI provider to fix accessibility issues',
                title: '🔧 Choose AI Provider for Fixing'
            });

            if (!providerChoice) {
                // User cancelled
                if (this._view) {
                    this._view.webview.postMessage({
                        type: 'fixingError',
                        error: 'Provider selection cancelled'
                    });
                }
                return;
            }

            // Send fixing started message
            this._view.webview.postMessage({
                type: 'fixingStarted'
            });

            this.outputChannel.appendLine('='.repeat(80));
            this.outputChannel.appendLine(`🔧 Starting Automated Accessibility Fixes`);
            this.outputChannel.appendLine(`🤖 Using provider: ${providerChoice.label}`);
            this.outputChannel.appendLine('='.repeat(80));

            // Pre-explore workspace to find relevant files
            this.outputChannel.appendLine('🔍 Pre-analyzing workspace structure...');
            const workspaceInfo = await this._exploreWorkspace(testResult.url);
            
            // Convert test results to agent prompt with workspace context
            const fixPrompt = this._createEnhancedFixPrompt(testResult, workspaceInfo);

            // Start agent session with the fix prompt using selected provider
            const sessionId = await this.agentOrchestrator.startSession(fixPrompt, providerChoice.value);
            
            // CRITICAL: Store session start time for timeout detection
            const sessionStartTime = Date.now();

            // Wait for agent to complete (poll session status with hard limits)
            const completionDetails = await this._waitForAgentCompletion(sessionId, sessionStartTime);

            if (completionDetails.success) {
                // Send detailed completion message
                this._view.webview.postMessage({
                    type: 'fixingComplete',
                    summary: {
                        message: completionDetails.summary || 'Agent has completed fixing accessibility issues.',
                        filesChanged: completionDetails.filesChanged || [],
                        totalFiles: completionDetails.filesChanged?.length || 0,
                        issuesFixed: testResult.issues.length
                    }
                });

                this.outputChannel.appendLine('\n' + '='.repeat(80));
                this.outputChannel.appendLine('✅ Accessibility Fixes Complete');
                if (completionDetails.filesChanged && completionDetails.filesChanged.length > 0) {
                    this.outputChannel.appendLine(`📁 Files modified: ${completionDetails.filesChanged.length}`);
                    completionDetails.filesChanged.forEach(file => {
                        this.outputChannel.appendLine(`   - ${file}`);
                    });
                }
                this.outputChannel.appendLine('='.repeat(80));
            } else {
                // Provide more detailed error information
                const statusInfo = completionDetails.status ? ` (Status: ${completionDetails.status})` : '';
                const errorMsg = `Agent session ended without successful completion${statusInfo}. Check the Output panel for details.`;
                
                this.outputChannel.appendLine(`\n⚠️ ${errorMsg}`);
                throw new Error(errorMsg);
            }

        } catch (error) {
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

    private async _exploreWorkspace(testedUrl: string): Promise<{ 
        srcPath: string; 
        files: string[]; 
        routePath?: string;
        framework?: string;
    }> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return { srcPath: 'src', files: [], framework: 'unknown' };
        }

        const workspaceRoot = workspaceFolder.uri.fsPath;
        const srcPath = path.join(workspaceRoot, 'src');
        
        // Extract route from URL properly (e.g., /quiz, /calculator from http://localhost:5173/quiz)
        let routePath = '';
        try {
            const url = new URL(testedUrl);
            // Get the first path segment (e.g., 'quiz' from '/quiz' or '/quiz/something')
            const pathSegments = url.pathname.split('/').filter(p => p.trim() !== '');
            routePath = pathSegments[0] || '';
        } catch {
            // Fallback to simple parsing if URL constructor fails
            const pathMatch = testedUrl.match(/\/([a-zA-Z0-9_-]+)(?:[/?#]|$)/);
            routePath = pathMatch ? pathMatch[1] : '';
        }
        
        this.outputChannel.appendLine(`   Detected route: /${routePath || 'home'}`);

        // Find relevant files (framework-agnostic)
        const relevantFiles: string[] = [];
        let framework = 'Unknown';
        
        try {
            // Detect framework/technology first
            const packageJsonPath = path.join(workspaceRoot, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                try {
                    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                    if (packageJson.dependencies) {
                        // Detect various frameworks
                        if (packageJson.dependencies['react-native']) framework = 'React Native';
                        else if (packageJson.dependencies['@angular/core']) framework = 'Angular';
                        else if (packageJson.dependencies['vue']) framework = 'Vue';
                        else if (packageJson.dependencies['react']) framework = 'React';
                        else if (packageJson.dependencies['@sveltejs/kit']) framework = 'Svelte';
                        else if (packageJson.dependencies['next']) framework = 'Next.js';
                        else if (packageJson.dependencies['nuxt']) framework = 'Nuxt';
                        else if (packageJson.dependencies['express']) framework = 'Express/Node.js';
                    }
                } catch {}
            }

            // Check for mobile/native frameworks
            if (fs.existsSync(path.join(workspaceRoot, 'ios'))) framework = framework === 'Unknown' ? 'iOS/Swift' : framework;
            if (fs.existsSync(path.join(workspaceRoot, 'android'))) framework = framework === 'Unknown' ? 'Android/Kotlin' : framework;
            if (fs.existsSync(path.join(workspaceRoot, 'pubspec.yaml'))) framework = 'Flutter';

            // Search for ANY code files (framework-agnostic)
            if (fs.existsSync(srcPath)) {
                // Look for main/app files (any extension)
                const appFilePatterns = [
                    'App', 'app', 'Main', 'main', 'Index', 'index', 
                    'Application', 'application', 'Root', 'root'
                ];
                const extensions = ['.jsx', '.js', '.tsx', '.ts', '.vue', '.svelte', '.html', '.swift', '.kt', '.dart'];
                
                for (const pattern of appFilePatterns) {
                    for (const ext of extensions) {
                        const appPath = path.join(srcPath, pattern + ext);
                        if (fs.existsSync(appPath)) {
                            relevantFiles.push(`src/${pattern}${ext}`);
                            this.outputChannel.appendLine(`   ✓ Found: src/${pattern}${ext}`);
                        }
                    }
                }

                // Look for route-specific files (any structure)
                if (routePath) {
                    const possiblePaths = [
                        path.join(srcPath, 'features', routePath),
                        path.join(srcPath, 'pages', routePath),
                        path.join(srcPath, 'components', routePath),
                        path.join(srcPath, 'views', routePath),
                        path.join(srcPath, 'screens', routePath),
                        path.join(srcPath, 'modules', routePath),
                        path.join(srcPath, routePath),
                    ];

                    for (const dirPath of possiblePaths) {
                        if (fs.existsSync(dirPath)) {
                            this._findFilesRecursive(dirPath, relevantFiles, srcPath, routePath);
                        }
                    }

                    // Look for files matching the route name (any extension)
                    const componentPatterns = [
                        routePath.toLowerCase(),
                        routePath.toUpperCase(),
                        routePath[0].toUpperCase() + routePath.slice(1).toLowerCase()
                    ];

                    this._findMatchingFiles(srcPath, componentPatterns, relevantFiles, srcPath);
                }
            }

            // Search in common directories beyond src/
            const otherDirs = ['public', 'www', 'dist', 'views', 'templates'];
            for (const dir of otherDirs) {
                const dirPath = path.join(workspaceRoot, dir);
                if (fs.existsSync(dirPath) && routePath) {
                    this._findMatchingFiles(dirPath, [routePath], relevantFiles, workspaceRoot);
                }
            }

            this.outputChannel.appendLine(`   Technology: ${framework}`);
            this.outputChannel.appendLine(`   Found ${relevantFiles.length} relevant files`);

        } catch (error) {
            this.outputChannel.appendLine(`   ⚠️ Error exploring workspace: ${error}`);
        }

        return {
            srcPath: 'src',
            files: relevantFiles,
            routePath: routePath,
            framework: framework
        };
    }

    private _findFilesRecursive(dirPath: string, results: string[], srcPath: string, routePath: string): void {
        try {
            const items = fs.readdirSync(dirPath);
            for (const item of items) {
                const fullPath = path.join(dirPath, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    this._findFilesRecursive(fullPath, results, srcPath, routePath);
                } else if (stat.isFile() && /\.(jsx?|tsx?|vue|svelte|html?|swift|kt|dart)$/.test(item)) {
                    const relativePath = path.relative(path.dirname(srcPath), fullPath).replace(/\\/g, '/');
                    if (!results.includes(relativePath)) {
                        results.push(relativePath);
                        this.outputChannel.appendLine(`   ✓ Found: ${relativePath}`);
                    }
                }
            }
        } catch (error) {
            // Ignore errors in recursive search
        }
    }

    private _findMatchingFiles(dirPath: string, patterns: string[], results: string[], srcPath: string): void {
        try {
            const items = fs.readdirSync(dirPath);
            for (const item of items) {
                const fullPath = path.join(dirPath, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    this._findMatchingFiles(fullPath, patterns, results, srcPath);
                } else if (stat.isFile() && patterns.some(p => item.toLowerCase().includes(p.toLowerCase()))) {
                    const relativePath = path.relative(path.dirname(srcPath), fullPath).replace(/\\/g, '/');
                    if (!results.includes(relativePath)) {
                        results.push(relativePath);
                        this.outputChannel.appendLine(`   ✓ Found: ${relativePath}`);
                    }
                }
            }
        } catch (error) {
            // Ignore errors
        }
    }

    private _createEnhancedFixPrompt(testResult: TestResult, workspaceInfo: any): string {
        // ULTRA-DIRECTIVE PROMPT - Forces immediate implementation, no exploration loops
        const route = workspaceInfo.routePath || 'home';
        const framework = workspaceInfo.framework || 'this';
        
        let prompt = `🎯 URGENT FIX REQUIRED for /${route} route in ${framework} project.\n\n`;
        
        // List files compactly
        if (workspaceInfo.files && workspaceInfo.files.length > 0) {
            const fileList = workspaceInfo.files.slice(0, 4).join(', ');
            prompt += `📁 TARGET FILES: ${fileList}\n\n`;
        }

        // List issues compactly
        const errors = testResult.issues.filter(i => i.severity === 'error');
        const warnings = testResult.issues.filter(i => i.severity === 'warning');
        const info = testResult.issues.filter(i => i.severity === 'info');
        
        const allIssues = [...errors, ...warnings, ...info];
        prompt += `🐛 ACCESSIBILITY ISSUES (${allIssues.length} total):\n`;
        allIssues.forEach((issue, i) => {
            const shortDesc = issue.description.substring(0, 60).replace(/\n/g, ' ');
            prompt += `${i+1}. ${issue.criterion.split(' ')[0]} - ${shortDesc}...\n`;
        });
        prompt += `\n`;

        // ULTRA-DIRECTIVE INSTRUCTIONS - NO ambiguity
        prompt += `⚡ MANDATORY EXECUTION PLAN (FOLLOW EXACTLY):\n`;
        prompt += `1️⃣ Read the FIRST file listed above using read_file\n`;
        prompt += `2️⃣ In THE SAME RESPONSE, call write_file or edit_file to fix ALL issues:\n`;
        prompt += `   • Add semantic landmarks: <header role="banner">, <nav aria-label="Primary">, <main role="main">, <footer role="contentinfo">\n`;
        prompt += `   • Fix heading hierarchy: Ensure first heading is <h1>, then <h2>, <h3> in order\n`;
        prompt += `   • Add ARIA labels: aria-label, aria-labelledby for interactive elements\n`;
        prompt += `   • Label ALL form inputs: <label htmlFor="..."> or aria-label\n`;
        prompt += `3️⃣ IMMEDIATELY after write_file/edit_file, call attempt_completion with a summary\n\n`;
        
        prompt += `⛔ FORBIDDEN:\n`;
        prompt += `• NO list_directory or grep_search - files are already listed above\n`;
        prompt += `• NO reading multiple files in separate responses\n`;
        prompt += `• NO "exploring" or "analyzing" - implement fixes NOW\n`;
        prompt += `• MAXIMUM 2 tool calls: (1) read_file, (2) write_file/edit_file + attempt_completion\n\n`;
        
        prompt += `✅ EXPECTED RESPONSE FORMAT:\n`;
        prompt += `Call read_file → Call write_file with fixed code → Call attempt_completion\n`;
        prompt += `ALL THREE TOOLS IN ONE RESPONSE. START IMMEDIATELY.`;

        return prompt;
    }

    private _createFixPrompt(testResult: TestResult): string {
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

    private async _waitForAgentCompletion(sessionId: string, startTime: number): Promise<{ success: boolean; summary?: any; filesChanged?: string[]; status?: string }> {
        return new Promise((resolve) => {
            let lastKnownSession: any = null;
            const MAX_ITERATIONS = 15; // Hard limit to prevent infinite loops
            const MAX_DURATION_MS = 2 * 60 * 1000; // 2 minutes timeout
            
            const checkInterval = setInterval(() => {
                const session = this.agentOrchestrator?.getSessionStatus();
                const elapsed = Date.now() - startTime;
                
                // Store the last known session data
                if (session && session.id === sessionId) {
                    lastKnownSession = session;
                }
                
                // CRITICAL: Check for hard limits FIRST
                const currentIterations = session?.iterations || lastKnownSession?.iterations || 0;
                
                // 1. TIMEOUT - Force stop after 2 minutes
                if (elapsed > MAX_DURATION_MS) {
                    clearInterval(checkInterval);
                    this.outputChannel.appendLine(`⏱️ TIMEOUT: Agent exceeded 2 minutes, forcing stop`);
                    
                    // Extract completion details BEFORE stopping session (to avoid null)
                    const sessionToExtract = lastKnownSession || session;
                    const completionResult = sessionToExtract 
                        ? this._extractCompletionDetails(sessionToExtract)
                        : { summary: 'Agent timed out.', filesChanged: [] };
                    
                    // Now safely stop the session
                    if (this.agentOrchestrator) {
                        this.agentOrchestrator.stopSession();
                    }
                    
                    const hasChanges = completionResult.filesChanged.length > 0;
                    
                    resolve({
                        success: hasChanges, // Success if we made some changes
                        summary: hasChanges ? completionResult.summary : 'Agent timed out after 2 minutes. Some changes may have been made.',
                        filesChanged: completionResult.filesChanged,
                        status: 'timeout'
                    });
                    return;
                }
                
                // 2. ITERATION LIMIT - Force stop after 15 iterations
                if (currentIterations >= MAX_ITERATIONS) {
                    clearInterval(checkInterval);
                    this.outputChannel.appendLine(`🛑 MAX ITERATIONS: Agent reached ${MAX_ITERATIONS} iterations, forcing stop`);
                    
                    // Extract completion details BEFORE stopping session (to avoid null)
                    const sessionToExtract = lastKnownSession || session;
                    const completionResult = sessionToExtract 
                        ? this._extractCompletionDetails(sessionToExtract)
                        : { summary: `Agent stopped after ${MAX_ITERATIONS} iterations.`, filesChanged: [] };
                    
                    // Now safely stop the session
                    if (this.agentOrchestrator) {
                        this.agentOrchestrator.stopSession();
                    }
                    
                    const hasChanges = completionResult.filesChanged.length > 0;
                    
                    resolve({
                        success: hasChanges, // Success if we made some changes
                        summary: hasChanges ? completionResult.summary : `Agent stopped after ${MAX_ITERATIONS} iterations. Some changes may have been made.`,
                        filesChanged: completionResult.filesChanged,
                        status: 'max_iterations'
                    });
                    return;
                }
                
                // 3. CHECK FOR ATTEMPT_COMPLETION - Direct detection
                if (session || lastKnownSession) {
                    const currentSession = session || lastKnownSession;
                    const completionResult = this._extractCompletionDetails(currentSession);
                    
                    // If attempt_completion was called, consider it done
                    if (this._hasAttemptCompletion(currentSession)) {
                        clearInterval(checkInterval);
                        this.outputChannel.appendLine(`✅ DETECTED: attempt_completion tool called, stopping agent`);
                        
                        if (this.agentOrchestrator && session?.status === 'active') {
                            this.agentOrchestrator.stopSession();
                        }
                        
                        resolve({
                            success: true,
                            summary: completionResult.summary,
                            filesChanged: completionResult.filesChanged,
                            status: 'completed'
                        });
                        return;
                    }
                }
                
                // 4. If session is gone or belongs to different ID
                if (!session || session.id !== sessionId) {
                    clearInterval(checkInterval);
                    
                    // Use last known session data if available
                    if (lastKnownSession) {
                        const completionResult = this._extractCompletionDetails(lastKnownSession);
                        resolve({ 
                            success: true, // Session completed (even if status is not exactly 'completed')
                            summary: completionResult.summary,
                            filesChanged: completionResult.filesChanged,
                            status: lastKnownSession.status
                        });
                    } else {
                        resolve({ success: false, status: 'unknown' });
                    }
                    return;
                }

                // 5. Normal completion detection
                if (session.status !== 'active') {
                    clearInterval(checkInterval);
                    
                    // Extract completion details from session messages
                    const completionResult = this._extractCompletionDetails(session);
                    
                    // Consider it successful if status is 'completed' or if we have completion details
                    const isSuccess = session.status === 'completed' || 
                                    (completionResult.filesChanged.length > 0 && !!completionResult.summary);
                    
                    resolve({ 
                        success: isSuccess,
                        summary: completionResult.summary,
                        filesChanged: completionResult.filesChanged,
                        status: session.status
                    });
                    return;
                }

                // Send progress update to webview with iteration count
                if (this._view) {
                    this._view.webview.postMessage({
                        type: 'fixingProgress',
                        message: `Agent working... (iteration ${session.iterations}/${MAX_ITERATIONS}, ${Math.round(elapsed/1000)}s)`
                    });
                }
            }, 200); // Check every 200ms for faster completion detection
        });
    }
    
    /**
     * Check if attempt_completion was called in the session
     */
    private _hasAttemptCompletion(session: any): boolean {
        if (!session || !session.messages || !Array.isArray(session.messages)) {
            return false;
        }
        
        for (const message of session.messages) {
            if (message.toolCalls && Array.isArray(message.toolCalls)) {
                for (const toolCall of message.toolCalls) {
                    if (toolCall.name === 'attempt_completion') {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }

    private _extractCompletionDetails(session: any): { summary: string; filesChanged: string[] } {
        // Look for attempt_completion tool calls in the session messages
        const filesChanged: Set<string> = new Set();
        let completionSummary = 'Agent completed accessibility fixes.';

        // Safety check for null/undefined session
        if (!session) {
            return { summary: 'No session data available.', filesChanged: [] };
        }

        if (session.messages && Array.isArray(session.messages)) {
            for (const message of session.messages) {
                // Check for tool calls in assistant messages
                if (message.toolCalls && Array.isArray(message.toolCalls)) {
                    for (const toolCall of message.toolCalls) {
                        // Track file changes from write_file and edit_file
                        if (toolCall.name === 'write_file' || toolCall.name === 'edit_file') {
                            const filePath = toolCall.input?.file_path || toolCall.input?.path;
                            if (filePath) {
                                filesChanged.add(filePath);
                            }
                        }

                        // Get completion summary from attempt_completion
                        if (toolCall.name === 'attempt_completion') {
                            const result = toolCall.input?.result;
                            if (result && typeof result === 'string') {
                                completionSummary = result;
                            }
                        }
                    }
                }
            }
        }

        return {
            summary: completionSummary,
            filesChanged: Array.from(filesChanged)
        };
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
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
                <div class="action-buttons">
                    <button id="fixIssuesBtn" class="fix-issues-button">
                        <span class="button-icon">🔧</span> Fix Accessibility Issues
                    </button>
                    <button id="downloadReportBtn" class="download-report-button">
                        <span class="button-icon">📄</span> Download Report (PDF)
                    </button>
                </div>
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

    private async _handleDownloadReport(testResult: any) {
        try {
            this.outputChannel.appendLine('📄 Generating PDF report...');
            
            // Generate PDF content
            const pdfContent = this._generatePDFContent(testResult);
            
            // Ask user where to save
            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(`accessibility-report-${new Date().toISOString().split('T')[0]}.html`),
                filters: {
                    'HTML Files': ['html'],
                    'All Files': ['*']
                }
            });

            if (saveUri) {
                // Write HTML file (can be opened in browser and printed to PDF)
                await vscode.workspace.fs.writeFile(saveUri, Buffer.from(pdfContent, 'utf8'));
                
                this.outputChannel.appendLine(`✅ Report saved to: ${saveUri.fsPath}`);
                
                // Ask if user wants to open the report
                const openReport = await vscode.window.showInformationMessage(
                    'Report saved successfully! Open in browser?',
                    'Open',
                    'Close'
                );
                
                if (openReport === 'Open') {
                    await vscode.env.openExternal(saveUri);
                }
            }
        } catch (error) {
            this.outputChannel.appendLine(`❌ Error generating report: ${error}`);
            vscode.window.showErrorMessage(`Failed to generate report: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private _generatePDFContent(testResult: any): string {
        const date = new Date(testResult.timestamp).toLocaleString();
        const errors = testResult.issues.filter((i: any) => i.severity === 'error');
        const warnings = testResult.issues.filter((i: any) => i.severity === 'warning');
        const info = testResult.issues.filter((i: any) => i.severity === 'info');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accessibility Test Report - ${testResult.url}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #fff;
        }
        .header {
            border-bottom: 3px solid #0078d4;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        h1 {
            color: #0078d4;
            font-size: 32px;
            margin-bottom: 10px;
        }
        .meta {
            color: #666;
            font-size: 14px;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .summary-card {
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid;
        }
        .summary-card.errors {
            background: #fff4f4;
            border-color: #d32f2f;
        }
        .summary-card.warnings {
            background: #fff8e1;
            border-color: #f57c00;
        }
        .summary-card.info {
            background: #e3f2fd;
            border-color: #1976d2;
        }
        .summary-card .count {
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .summary-card.errors .count { color: #d32f2f; }
        .summary-card.warnings .count { color: #f57c00; }
        .summary-card.info .count { color: #1976d2; }
        .summary-card .label {
            font-size: 14px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .section {
            margin: 40px 0;
        }
        .section-title {
            font-size: 24px;
            color: #333;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e0e0e0;
        }
        .issue {
            background: #f9f9f9;
            border: 1px solid #e0e0e0;
            border-left: 4px solid;
            border-radius: 4px;
            padding: 20px;
            margin-bottom: 20px;
            page-break-inside: avoid;
        }
        .issue.error { border-left-color: #d32f2f; }
        .issue.warning { border-left-color: #f57c00; }
        .issue.info { border-left-color: #1976d2; }
        .issue-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .issue-criterion {
            font-weight: 600;
            font-size: 16px;
            color: #333;
        }
        .issue-severity {
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .issue-severity.error {
            background: #d32f2f;
            color: white;
        }
        .issue-severity.warning {
            background: #f57c00;
            color: white;
        }
        .issue-severity.info {
            background: #1976d2;
            color: white;
        }
        .issue-description {
            color: #444;
            margin: 15px 0;
            line-height: 1.7;
        }
        .issue-details {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #e0e0e0;
            font-size: 14px;
        }
        .issue-detail {
            margin: 8px 0;
            color: #666;
        }
        .issue-detail strong {
            color: #333;
            font-weight: 600;
        }
        .nvda-text {
            font-style: italic;
            color: #0078d4;
            background: #e3f2fd;
            padding: 2px 6px;
            border-radius: 3px;
        }
        .footer {
            margin-top: 60px;
            padding-top: 20px;
            border-top: 2px solid #e0e0e0;
            text-align: center;
            color: #666;
            font-size: 14px;
        }
        @media print {
            body { padding: 0; }
            .summary { page-break-after: avoid; }
            .issue { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔍 Accessibility Test Report</h1>
        <div class="meta">
            <div><strong>URL:</strong> ${testResult.url}</div>
            <div><strong>Tested:</strong> ${date}</div>
            <div><strong>Interactions:</strong> ${testResult.summary.totalInteractions} NVDA interactions</div>
        </div>
    </div>

    <div class="summary">
        <div class="summary-card errors">
            <div class="count">${errors.length}</div>
            <div class="label">Errors</div>
        </div>
        <div class="summary-card warnings">
            <div class="count">${warnings.length}</div>
            <div class="label">Warnings</div>
        </div>
        <div class="summary-card info">
            <div class="count">${info.length}</div>
            <div class="label">Info</div>
        </div>
    </div>

    ${errors.length > 0 ? `
    <div class="section">
        <h2 class="section-title">❌ Errors (${errors.length})</h2>
        ${errors.map((issue: any) => this._generateIssueHTML(issue)).join('')}
    </div>
    ` : ''}

    ${warnings.length > 0 ? `
    <div class="section">
        <h2 class="section-title">⚠️ Warnings (${warnings.length})</h2>
        ${warnings.map((issue: any) => this._generateIssueHTML(issue)).join('')}
    </div>
    ` : ''}

    ${info.length > 0 ? `
    <div class="section">
        <h2 class="section-title">ℹ️ Info (${info.length})</h2>
        ${info.map((issue: any) => this._generateIssueHTML(issue)).join('')}
    </div>
    ` : ''}

    <div class="footer">
        <p>Generated by AccessLint - VSCode Extension</p>
        <p>Report generated on ${new Date().toLocaleString()}</p>
        <p style="margin-top: 10px; font-size: 12px;">
            To save as PDF: Print this page (Ctrl+P / Cmd+P) and select "Save as PDF"
        </p>
    </div>
</body>
</html>`;
    }

    private _generateIssueHTML(issue: any): string {
        const escapeHtml = (text: string) => {
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        let detailsHTML = '';
        
        if (issue.nvdaAnnouncement) {
            detailsHTML += `
                <div class="issue-detail">
                    <strong>📢 NVDA Announced:</strong> <span class="nvda-text">"${escapeHtml(issue.nvdaAnnouncement)}"</span>
                </div>
            `;
        }
        
        if (issue.expectedAnnouncement) {
            detailsHTML += `
                <div class="issue-detail">
                    <strong>✅ Expected:</strong> "${escapeHtml(issue.expectedAnnouncement)}"
                </div>
            `;
        }
        
        if (issue.element) {
            detailsHTML += `
                <div class="issue-detail">
                    <strong>Element:</strong> ${escapeHtml(issue.element)}
                </div>
            `;
        }
        
        if (issue.location) {
            detailsHTML += `
                <div class="issue-detail">
                    <strong>Location:</strong> ${escapeHtml(issue.location)}
                </div>
            `;
        }

        if (issue.recommendation) {
            detailsHTML += `
                <div class="issue-detail">
                    <strong>💡 Recommendation:</strong> ${escapeHtml(issue.recommendation)}
                </div>
            `;
        }

        if (issue.source) {
            detailsHTML += `
                <div class="issue-detail">
                    <strong>Source:</strong> ${issue.source === 'basic' ? 'Basic NVDA Validation' : 'AI Comprehensive Validation'}
                </div>
            `;
        }

        return `
            <div class="issue ${issue.severity}">
                <div class="issue-header">
                    <div class="issue-criterion">${escapeHtml(issue.criterion)}</div>
                    <span class="issue-severity ${issue.severity}">${issue.severity}</span>
                </div>
                <div class="issue-description">${escapeHtml(issue.description)}</div>
                ${detailsHTML ? `<div class="issue-details">${detailsHTML}</div>` : ''}
            </div>
        `;
    }

    public dispose() {
        if (this.tester) {
            this.tester.close();
        }
    }
}
