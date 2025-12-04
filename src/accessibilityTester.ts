import * as vscode from 'vscode';
import { chromium, Browser, Page } from 'playwright';
import { nvda } from '@guidepup/guidepup';
import { AiProviderManager } from './aiProviderManager';
import { execSync } from 'child_process';

export interface NVDAInteraction {
    action: string;
    announcement: string;
    element?: string;
    timestamp: Date;
}

export interface AccessibilityIssue {
    criterion: string;
    severity: 'error' | 'warning' | 'info';
    description: string;
    nvdaAnnouncement?: string;
    expectedAnnouncement?: string;
    element?: string;
    location?: string;
    source?: 'basic' | 'ai'; // Track whether issue came from basic or AI validation
    recommendation?: string; // AI can provide fix recommendations
}

export interface TestResult {
    url: string;
    timestamp: Date;
    issues: AccessibilityIssue[];
    interactions: NVDAInteraction[];
    summary: {
        errors: number;
        warnings: number;
        info: number;
        totalInteractions: number;
    };
    nvdaLog: string[];
}

export class AccessibilityTester {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private outputChannel: vscode.OutputChannel;
    private nvdaRunning: boolean = false;
    private aiProviderManager: AiProviderManager | null = null;
    private enableAIValidation: boolean = true; // Toggle for AI validation

    constructor(outputChannel: vscode.OutputChannel, aiProviderManager?: AiProviderManager) {
        this.outputChannel = outputChannel;
        this.aiProviderManager = aiProviderManager || null;
    }

    async initialize(): Promise<void> {
        try {
            this.outputChannel.appendLine('🚀 Initializing NVDA screen reader...');
            
            // Check if we're on Windows
            if (process.platform !== 'win32') {
                throw new Error('NVDA is only available on Windows. Current platform: ' + process.platform);
            }

            // Diagnostics
            this.outputChannel.appendLine(`   Platform: ${process.platform}`);
            this.outputChannel.appendLine(`   Node version: ${process.version}`);
            
            // Check if NVDA is already running
            try {
                const result = execSync('tasklist /FI "IMAGENAME eq nvda.exe"', { encoding: 'utf-8' });
                if (result.includes('nvda.exe')) {
                    this.outputChannel.appendLine('   ⚠️ WARNING: NVDA is already running!');
                    this.outputChannel.appendLine('   ⚠️ This may cause issues. Consider closing NVDA first.');
                } else {
                    this.outputChannel.appendLine('   ✓ NVDA not currently running');
                }
            } catch (e) {
                this.outputChannel.appendLine('   Could not check if NVDA is running');
            }

            // Start NVDA with timeout
            this.outputChannel.appendLine('📢 Starting NVDA...');
            this.outputChannel.appendLine('   This may take 10-15 seconds...');
            try {
                // Add timeout wrapper (30 seconds max)
                const nvdaStartPromise = nvda.start();
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('NVDA start timeout after 30 seconds')), 30000);
                });
                
                await Promise.race([nvdaStartPromise, timeoutPromise]);
                this.nvdaRunning = true;
                this.outputChannel.appendLine('✅ NVDA started successfully');
            } catch (nvdaError: any) {
                this.outputChannel.appendLine(`❌ Failed to start NVDA: ${nvdaError}`);
                this.outputChannel.appendLine('');
                this.outputChannel.appendLine('🔧 TROUBLESHOOTING:');
                this.outputChannel.appendLine('   1. Have you run: npx @guidepup/setup');
                this.outputChannel.appendLine('   2. Is NVDA already running? (Close it and try again)');
                this.outputChannel.appendLine('   3. Is this Windows 10/11? (NVDA only works on Windows)');
                this.outputChannel.appendLine('   4. Check if NVDA.exe is in your PATH');
                this.outputChannel.appendLine('');
                throw nvdaError;
            }

            // Initialize browser
            this.outputChannel.appendLine('🌐 Launching Chromium browser...');
            this.outputChannel.appendLine('   This may take a moment on first launch...');
            
            try {
                // Try to use system Chrome/Edge if Playwright browsers not installed
                // This helps in corporate environments where browser downloads are blocked
                const launchOptions: any = {
                    headless: false,
                    timeout: 60000,
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                };
                
                // Check if we should use system browser (for corporate environments)
                // Set environment variable: ACCESSLINT_USE_SYSTEM_BROWSER=chrome or edge
                const useSystemBrowser = process.env.ACCESSLINT_USE_SYSTEM_BROWSER;
                if (useSystemBrowser) {
                    launchOptions.channel = useSystemBrowser; // 'chrome' or 'msedge'
                    this.outputChannel.appendLine(`   Using system browser: ${useSystemBrowser}`);
                }
                
                this.browser = await chromium.launch(launchOptions);
                
                if (!this.browser) {
                    throw new Error('Browser failed to launch (returned null)');
                }
                
                this.page = await this.browser.newPage();
                
                if (!this.page) {
                    throw new Error('Failed to create browser page');
                }
                
                this.outputChannel.appendLine('✅ Browser launched successfully');
                this.outputChannel.appendLine(`   Browser visible: You should see a Chromium window`);
            } catch (browserError: any) {
                this.outputChannel.appendLine(`❌ Failed to launch browser: ${browserError}`);
                
                // Check if it's a Playwright installation issue
                if (browserError.message && browserError.message.includes('Executable doesn\'t exist')) {
                    this.outputChannel.appendLine('');
                    this.outputChannel.appendLine('❌ PLAYWRIGHT BROWSERS NOT INSTALLED!');
                    this.outputChannel.appendLine('');
                    this.outputChannel.appendLine('🔧 To fix, run this command in your terminal:');
                    this.outputChannel.appendLine('   npx playwright install chromium');
                    this.outputChannel.appendLine('');
                    this.outputChannel.appendLine('   OR install all browsers:');
                    this.outputChannel.appendLine('   npx playwright install');
                    this.outputChannel.appendLine('');
                }
                
                throw browserError;
            }

        } catch (error) {
            this.outputChannel.appendLine(`❌ Failed to initialize: ${error}`);
            if (this.nvdaRunning) {
                await this.stopNVDA();
            }
            throw error;
        }
    }

    async testUrl(url: string, onProgress?: (message: string) => void): Promise<TestResult> {
        const issues: AccessibilityIssue[] = [];
        const interactions: NVDAInteraction[] = [];
        const nvdaLog: string[] = [];
        const startTime = new Date();

        try {
            if (!this.page) {
                throw new Error('Browser not initialized. Call initialize() first.');
            }

            if (!this.nvdaRunning) {
                throw new Error('NVDA not started. Call initialize() first.');
            }

            const progress = (msg: string) => {
                this.outputChannel.appendLine(msg);
                if (onProgress) onProgress(msg);
            };

            progress(`🔍 Testing URL with NVDA: ${url}`);
            
            // Navigate to the page
            progress('📄 Loading page...');
            await this.page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
            
            // Wait for page to be ready
            await this.page.waitForTimeout(2000);
            progress('✅ Page loaded');

            // Focus the browser and prepare NVDA
            progress('🎯 Focusing browser and preparing NVDA...');
            await this.prepareBrowser();

            // Clear NVDA logs to start fresh
            await nvda.clearItemTextLog();
            await nvda.clearSpokenPhraseLog();

            progress('📢 Starting NVDA navigation and testing...');

            // PHASE 1: Basic NVDA Testing (Hardcoded Rules)
            progress('📋 Phase 1: Running basic NVDA validation...');
            
            // Test 1: Navigate through headings
            progress('Testing headings navigation...');
            const headingResults = await this.testHeadings();
            interactions.push(...headingResults.interactions);
            issues.push(...headingResults.issues.map(i => ({ ...i, source: 'basic' as const })));

            // Test 2: Navigate through links
            progress('Testing links navigation...');
            const linkResults = await this.testLinks();
            interactions.push(...linkResults.interactions);
            issues.push(...linkResults.issues.map(i => ({ ...i, source: 'basic' as const })));

            // Test 3: Navigate through form elements
            progress('Testing form elements...');
            const formResults = await this.testFormElements();
            interactions.push(...formResults.interactions);
            issues.push(...formResults.issues.map(i => ({ ...i, source: 'basic' as const })));

            // Test 4: Navigate through landmarks
            progress('Testing landmarks...');
            const landmarkResults = await this.testLandmarks();
            interactions.push(...landmarkResults.interactions);
            issues.push(...landmarkResults.issues.map(i => ({ ...i, source: 'basic' as const })));

            // Test 5: Test sequential navigation
            progress('Testing sequential navigation...');
            const sequentialResults = await this.testSequentialNavigation();
            interactions.push(...sequentialResults.interactions);
            issues.push(...sequentialResults.issues.map(i => ({ ...i, source: 'basic' as const })));

            // Test 6: Test interactive elements
            progress('Testing interactive elements...');
            const interactiveResults = await this.testInteractiveElements();
            interactions.push(...interactiveResults.interactions);
            issues.push(...interactiveResults.issues.map(i => ({ ...i, source: 'basic' as const })));

            // Capture full NVDA log
            const spokenLog = await nvda.spokenPhraseLog();
            nvdaLog.push(...spokenLog);

            progress(`✅ Basic NVDA testing completed (${issues.length} issues found)`);

            // PHASE 2: AI Comprehensive Validation (if enabled)
            if (this.enableAIValidation && this.aiProviderManager) {
                progress('🤖 Phase 2: Running AI comprehensive validation...');
                try {
                    const aiIssues = await this.aiValidation(url, interactions, issues);
                    issues.push(...aiIssues);
                    progress(`✅ AI validation completed (${aiIssues.length} additional issues found)`);
                } catch (error) {
                    progress(`⚠️ AI validation failed: ${error}`);
                    this.outputChannel.appendLine(`AI validation error: ${error}`);
                }
            } else if (!this.aiProviderManager) {
                progress('ℹ️ AI validation skipped (no AI provider configured)');
            }

            const summary = {
                errors: issues.filter(i => i.severity === 'error').length,
                warnings: issues.filter(i => i.severity === 'warning').length,
                info: issues.filter(i => i.severity === 'info').length,
                totalInteractions: interactions.length
            };

            return {
                url,
                timestamp: startTime,
                issues,
                interactions,
                summary,
                nvdaLog
            };

        } catch (error) {
            this.outputChannel.appendLine(`❌ Error during testing: ${error}`);
            throw error;
        }
    }

    private async prepareBrowser(): Promise<void> {
        try {
            // Exit focus mode if in it
            await nvda.perform(nvda.keyboardCommands.exitFocusMode);
            
            // Report title to ensure browser is focused
            await nvda.perform(nvda.keyboardCommands.reportTitle);
            
            let windowTitle = await nvda.lastSpokenPhrase();
            let retryCount = 0;

            // Try to focus Chromium window
            while (!windowTitle.includes('Chromium') && retryCount < 10) {
                retryCount++;
                await this.page?.bringToFront();
                await this.page?.waitForTimeout(500);
                await nvda.perform(nvda.keyboardCommands.reportTitle);
                windowTitle = await nvda.lastSpokenPhrase();
            }

            if (!windowTitle.includes('Chromium')) {
                this.outputChannel.appendLine('⚠️ Warning: Could not focus browser window');
            }

            // Clear logs after setup
            await nvda.clearItemTextLog();
            await nvda.clearSpokenPhraseLog();

        } catch (error) {
            this.outputChannel.appendLine(`⚠️ Error preparing browser: ${error}`);
        }
    }

    private async testHeadings(): Promise<{ interactions: NVDAInteraction[], issues: AccessibilityIssue[] }> {
        const interactions: NVDAInteraction[] = [];
        const issues: AccessibilityIssue[] = [];

        try {
            // Navigate to first heading
            await nvda.perform(nvda.keyboardCommands.moveToNextHeading);
            await this.page?.waitForTimeout(300);

            let headingCount = 0;
            let lastLevel = 0;
            const maxHeadings = 50;

            while (headingCount < maxHeadings) {
                const announcement = await nvda.lastSpokenPhrase();
                const itemText = await nvda.itemText();

                if (!announcement || announcement === '') {
                    break; // No more headings
                }

                // Check if we're seeing the same announcement again (no more headings)
                if (headingCount > 0) {
                    const previousAnnouncement = await this.getPreviousAnnouncement();
                    if (announcement === previousAnnouncement) {
                        break;
                    }
                }

                interactions.push({
                    action: 'Navigate to heading',
                    announcement: announcement,
                    element: itemText,
                    timestamp: new Date()
                });

                // Parse heading level from announcement
                const levelMatch = announcement.match(/heading[,\s]+level\s+(\d+)/i);
                if (levelMatch) {
                    const level = parseInt(levelMatch[1]);

                    // Check for proper heading hierarchy
                    if (headingCount === 0 && level !== 1) {
                        issues.push({
                            criterion: '1.3.2 Meaningful Sequence',
                            severity: 'warning',
                            description: `First heading is h${level}, should be h1`,
                            nvdaAnnouncement: announcement,
                            element: itemText
                        });
                    }

                    if (lastLevel > 0 && level - lastLevel > 1) {
                        issues.push({
                            criterion: '1.3.2 Meaningful Sequence',
                            severity: 'warning',
                            description: `Heading hierarchy skip from h${lastLevel} to h${level}`,
                            nvdaAnnouncement: announcement,
                            element: itemText
                        });
                    }

                    lastLevel = level;
                } else if (announcement.toLowerCase().includes('heading')) {
                    // Heading without clear level
                    issues.push({
                        criterion: '1.3.2 Meaningful Sequence',
                        severity: 'info',
                        description: 'NVDA announced heading but level unclear',
                        nvdaAnnouncement: announcement,
                        element: itemText
                    });
                }

                // Check if heading has meaningful text
                if (!itemText || itemText.trim().length === 0) {
                    issues.push({
                        criterion: '1.1.1 Non-text Content',
                        severity: 'error',
                        description: 'Heading is empty or has no accessible text',
                        nvdaAnnouncement: announcement
                    });
                }

                headingCount++;

                // Try to move to next heading
                await nvda.perform(nvda.keyboardCommands.moveToNextHeading);
                await this.page?.waitForTimeout(300);
            }

            if (headingCount === 0) {
                issues.push({
                    criterion: '1.3.2 Meaningful Sequence',
                    severity: 'warning',
                    description: 'No headings found on page. Headings help screen reader users navigate.'
                });
            }

        } catch (error) {
            this.outputChannel.appendLine(`Error testing headings: ${error}`);
        }

        return { interactions, issues };
    }

    private async testLinks(): Promise<{ interactions: NVDAInteraction[], issues: AccessibilityIssue[] }> {
        const interactions: NVDAInteraction[] = [];
        const issues: AccessibilityIssue[] = [];

        try {
            // Reset to top of page
            await this.page?.keyboard.press('Control+Home');
            await this.page?.waitForTimeout(500);
            await nvda.clearSpokenPhraseLog();

            // Navigate to first link
            await nvda.perform(nvda.keyboardCommands.moveToNextLink);
            await this.page?.waitForTimeout(300);

            let linkCount = 0;
            const maxLinks = 30;
            const seenAnnouncements = new Set<string>();

            while (linkCount < maxLinks) {
                const announcement = await nvda.lastSpokenPhrase();
                const itemText = await nvda.itemText();

                if (!announcement || announcement === '' || seenAnnouncements.has(announcement)) {
                    break;
                }

                seenAnnouncements.add(announcement);

                interactions.push({
                    action: 'Navigate to link',
                    announcement: announcement,
                    element: itemText,
                    timestamp: new Date()
                });

                // Check if NVDA identifies it as a link
                if (!announcement.toLowerCase().includes('link')) {
                    issues.push({
                        criterion: '4.1.2 Name, Role, Value',
                        severity: 'error',
                        description: 'Element not properly announced as link by NVDA',
                        nvdaAnnouncement: announcement,
                        element: itemText
                    });
                }

                // Check for meaningful link text
                const linkTextPatterns = [
                    /^click here$/i,
                    /^here$/i,
                    /^link$/i,
                    /^read more$/i,
                    /^more$/i
                ];

                if (linkTextPatterns.some(pattern => pattern.test(itemText))) {
                    issues.push({
                        criterion: '2.4.4 Link Purpose',
                        severity: 'warning',
                        description: `Link has non-descriptive text: "${itemText}"`,
                        nvdaAnnouncement: announcement,
                        element: itemText
                    });
                }

                // Check for empty links
                if (!itemText || itemText.trim().length === 0) {
                    issues.push({
                        criterion: '2.4.4 Link Purpose',
                        severity: 'error',
                        description: 'Link has no accessible text',
                        nvdaAnnouncement: announcement
                    });
                }

                linkCount++;

                // Move to next link
                await nvda.perform(nvda.keyboardCommands.moveToNextLink);
                await this.page?.waitForTimeout(300);
            }

        } catch (error) {
            this.outputChannel.appendLine(`Error testing links: ${error}`);
        }

        return { interactions, issues };
    }

    private async testFormElements(): Promise<{ interactions: NVDAInteraction[], issues: AccessibilityIssue[] }> {
        const interactions: NVDAInteraction[] = [];
        const issues: AccessibilityIssue[] = [];

        try {
            // Reset to top of page
            await this.page?.keyboard.press('Control+Home');
            await this.page?.waitForTimeout(500);
            await nvda.clearSpokenPhraseLog();

            // Navigate to first form field
            await nvda.perform(nvda.keyboardCommands.moveToNextFormField);
            await this.page?.waitForTimeout(300);

            let formFieldCount = 0;
            const maxFields = 20;
            const seenAnnouncements = new Set<string>();

            while (formFieldCount < maxFields) {
                const announcement = await nvda.lastSpokenPhrase();
                const itemText = await nvda.itemText();

                if (!announcement || announcement === '' || seenAnnouncements.has(announcement)) {
                    break;
                }

                seenAnnouncements.add(announcement);

                interactions.push({
                    action: 'Navigate to form field',
                    announcement: announcement,
                    element: itemText,
                    timestamp: new Date()
                });

                // Check for form field types
                const hasType = /edit|combo box|check box|radio button|button/i.test(announcement);
                if (!hasType) {
                    issues.push({
                        criterion: '4.1.2 Name, Role, Value',
                        severity: 'warning',
                        description: 'Form field type not clearly announced by NVDA',
                        nvdaAnnouncement: announcement,
                        element: itemText
                    });
                }

                // Check for labels
                if (!itemText || itemText.trim().length === 0 || itemText === 'blank') {
                    issues.push({
                        criterion: '3.3.2 Labels or Instructions',
                        severity: 'error',
                        description: 'Form field has no accessible label',
                        nvdaAnnouncement: announcement
                    });
                }

                // Check for required fields
                if (announcement.toLowerCase().includes('required')) {
                    // Good - required is announced
                    interactions[interactions.length - 1].announcement += ' [Required field detected]';
                }

                // Check for invalid state
                if (announcement.toLowerCase().includes('invalid')) {
                    issues.push({
                        criterion: '3.3.1 Error Identification',
                        severity: 'info',
                        description: 'Form field marked as invalid - ensure error message is clear',
                        nvdaAnnouncement: announcement,
                        element: itemText
                    });
                }

                formFieldCount++;

                // Move to next form field
                await nvda.perform(nvda.keyboardCommands.moveToNextFormField);
                await this.page?.waitForTimeout(300);
            }

            if (formFieldCount === 0) {
                issues.push({
                    criterion: 'General',
                    severity: 'info',
                    description: 'No form fields found on page'
                });
            }

        } catch (error) {
            this.outputChannel.appendLine(`Error testing form elements: ${error}`);
        }

        return { interactions, issues };
    }

    private async testLandmarks(): Promise<{ interactions: NVDAInteraction[], issues: AccessibilityIssue[] }> {
        const interactions: NVDAInteraction[] = [];
        const issues: AccessibilityIssue[] = [];

        try {
            // Reset to top of page
            await this.page?.keyboard.press('Control+Home');
            await this.page?.waitForTimeout(500);
            await nvda.clearSpokenPhraseLog();

            // Navigate through landmarks (D key in NVDA)
            let landmarkCount = 0;
            const maxLandmarks = 10;

            for (let i = 0; i < maxLandmarks; i++) {
                await this.page?.keyboard.press('d');
                await this.page?.waitForTimeout(300);

                const announcement = await nvda.lastSpokenPhrase();
                const itemText = await nvda.itemText();

                if (!announcement || announcement === '') {
                    break;
                }

                if (announcement.toLowerCase().includes('landmark')) {
                    interactions.push({
                        action: 'Navigate to landmark',
                        announcement: announcement,
                        element: itemText,
                        timestamp: new Date()
                    });
                    landmarkCount++;
                }
            }

            if (landmarkCount === 0) {
                issues.push({
                    criterion: '1.3.1 Info and Relationships',
                    severity: 'warning',
                    description: 'No landmarks found. Consider using <nav>, <main>, <header>, <footer>, etc.'
                });
            }

        } catch (error) {
            this.outputChannel.appendLine(`Error testing landmarks: ${error}`);
        }

        return { interactions, issues };
    }

    private async testSequentialNavigation(): Promise<{ interactions: NVDAInteraction[], issues: AccessibilityIssue[] }> {
        const interactions: NVDAInteraction[] = [];
        const issues: AccessibilityIssue[] = [];

        try {
            // Reset to top of page
            await this.page?.keyboard.press('Control+Home');
            await this.page?.waitForTimeout(500);
            await nvda.clearSpokenPhraseLog();

            // Navigate through page sequentially
            let navigationCount = 0;
            const maxNavigations = 15;

            for (let i = 0; i < maxNavigations; i++) {
                await nvda.next();
                await this.page?.waitForTimeout(200);

                const announcement = await nvda.lastSpokenPhrase();
                const itemText = await nvda.itemText();

                if (!announcement || announcement === '') {
                    break;
                }

                interactions.push({
                    action: 'Sequential navigation (down arrow)',
                    announcement: announcement,
                    element: itemText,
                    timestamp: new Date()
                });

                // Check for images
                if (announcement.toLowerCase().includes('graphic') || announcement.toLowerCase().includes('image')) {
                    if (announcement.toLowerCase().includes('unlabeled') || itemText.trim() === '') {
                        issues.push({
                            criterion: '1.1.1 Non-text Content',
                            severity: 'error',
                            description: 'Image has no alt text - NVDA announces it as unlabeled',
                            nvdaAnnouncement: announcement,
                            element: itemText
                        });
                    }
                }

                // Check for clickable elements
                if (announcement.toLowerCase().includes('clickable')) {
                    if (!announcement.toLowerCase().includes('link') && 
                        !announcement.toLowerCase().includes('button')) {
                        issues.push({
                            criterion: '4.1.2 Name, Role, Value',
                            severity: 'warning',
                            description: 'Clickable element role unclear - consider using button or link',
                            nvdaAnnouncement: announcement,
                            element: itemText
                        });
                    }
                }

                navigationCount++;
            }

        } catch (error) {
            this.outputChannel.appendLine(`Error testing sequential navigation: ${error}`);
        }

        return { interactions, issues };
    }

    private async testInteractiveElements(): Promise<{ interactions: NVDAInteraction[], issues: AccessibilityIssue[] }> {
        const interactions: NVDAInteraction[] = [];
        const issues: AccessibilityIssue[] = [];

        try {
            // Test buttons
            await this.page?.keyboard.press('Control+Home');
            await this.page?.waitForTimeout(500);
            await nvda.clearSpokenPhraseLog();

            // Navigate to buttons (B key in NVDA)
            let buttonCount = 0;
            const maxButtons = 10;

            for (let i = 0; i < maxButtons; i++) {
                await this.page?.keyboard.press('b');
                await this.page?.waitForTimeout(300);

                const announcement = await nvda.lastSpokenPhrase();
                const itemText = await nvda.itemText();

                if (!announcement || announcement === '') {
                    break;
                }

                if (announcement.toLowerCase().includes('button')) {
                    interactions.push({
                        action: 'Navigate to button',
                        announcement: announcement,
                        element: itemText,
                        timestamp: new Date()
                    });

                    // Check for empty buttons
                    if (!itemText || itemText.trim().length === 0) {
                        issues.push({
                            criterion: '4.1.2 Name, Role, Value',
                            severity: 'error',
                            description: 'Button has no accessible text',
                            nvdaAnnouncement: announcement
                        });
                    }

                    buttonCount++;
                }
            }

        } catch (error) {
            this.outputChannel.appendLine(`Error testing interactive elements: ${error}`);
        }

        return { interactions, issues };
    }

    private async getPreviousAnnouncement(): Promise<string> {
        try {
            const log = await nvda.spokenPhraseLog();
            return log.length > 1 ? log[log.length - 2] : '';
        } catch {
            return '';
        }
    }

    // ==================== AI VALIDATION METHODS ====================

    /**
     * AI-powered comprehensive WCAG validation
     */
    private async aiValidation(
        url: string,
        interactions: NVDAInteraction[],
        basicIssues: AccessibilityIssue[]
    ): Promise<AccessibilityIssue[]> {
        if (!this.aiProviderManager) {
            return [];
        }

        try {
            // Build comprehensive prompt
            const prompt = this.buildAIValidationPrompt(url, interactions, basicIssues);

            // Call AI provider
            const response = await this.callAI(prompt);

            // Parse response into issues
            return this.parseAIIssues(response);
        } catch (error) {
            this.outputChannel.appendLine(`❌ AI validation error: ${error}`);
            return [];
        }
    }

    /**
     * Build comprehensive WCAG validation prompt
     */
    private buildAIValidationPrompt(
        url: string,
        interactions: NVDAInteraction[],
        basicIssues: AccessibilityIssue[]
    ): string {
        // Group interactions by type
        const headings = interactions.filter(i => i.action.toLowerCase().includes('heading'));
        const links = interactions.filter(i => i.action.toLowerCase().includes('link'));
        const forms = interactions.filter(i => i.action.toLowerCase().includes('form'));
        const landmarks = interactions.filter(i => i.action.toLowerCase().includes('landmark'));
        const buttons = interactions.filter(i => i.action.toLowerCase().includes('button'));

        return `You are an accessibility expert. Analyze this NVDA screen reader session for WCAG 2.1 Level AA compliance.

# URL Tested
${url}

# NVDA Interactions Summary
- Total interactions: ${interactions.length}
- Headings found: ${headings.length}
- Links found: ${links.length}
- Form fields found: ${forms.length}
- Landmarks found: ${landmarks.length}
- Buttons found: ${buttons.length}

# Detailed NVDA Announcements

## Headings (${headings.length})
${headings.length > 0 ? headings.slice(0, 20).map((i, idx) => 
    `${idx + 1}. NVDA: "${i.announcement}" | Element: "${i.element || 'N/A'}"`
).join('\n') : 'No headings found'}

## Links (${links.length})
${links.length > 0 ? links.slice(0, 15).map((i, idx) => 
    `${idx + 1}. NVDA: "${i.announcement}" | Element: "${i.element || 'N/A'}"`
).join('\n') : 'No links found'}

## Form Fields (${forms.length})
${forms.length > 0 ? forms.slice(0, 15).map((i, idx) => 
    `${idx + 1}. NVDA: "${i.announcement}" | Element: "${i.element || 'N/A'}"`
).join('\n') : 'No form fields found'}

## Landmarks (${landmarks.length})
${landmarks.length > 0 ? landmarks.map((i, idx) => 
    `${idx + 1}. NVDA: "${i.announcement}" | Element: "${i.element || 'N/A'}"`
).join('\n') : 'No landmarks found'}

## Buttons (${buttons.length})
${buttons.length > 0 ? buttons.slice(0, 15).map((i, idx) => 
    `${idx + 1}. NVDA: "${i.announcement}" | Element: "${i.element || 'N/A'}"`
).join('\n') : 'No buttons found'}

# Basic Issues Found (${basicIssues.length})
${basicIssues.length > 0 ? basicIssues.map((i, idx) => 
    `${idx + 1}. [${i.severity.toUpperCase()}] ${i.criterion}: ${i.description}`
).join('\n') : 'No basic issues found'}

# Your Task
Perform comprehensive WCAG 2.1 Level AA analysis. Find issues that basic validation might miss:

## WCAG Principles to Check:
1. **Perceivable**
   - 1.1.1 Non-text Content (alt text quality, decorative images)
   - 1.3.1 Info and Relationships (semantic structure, ARIA usage)
   - 1.3.2 Meaningful Sequence (reading order, focus order)
   - 1.4.3 Contrast (Minimum) - note if cannot verify from NVDA data
   - 1.4.11 Non-text Contrast

2. **Operable**
   - 2.1.1 Keyboard (keyboard accessibility)
   - 2.4.1 Bypass Blocks (skip links)
   - 2.4.3 Focus Order
   - 2.4.4 Link Purpose (Context)
   - 2.4.6 Headings and Labels (quality)
   - 2.4.7 Focus Visible

3. **Understandable**
   - 3.1.1 Language of Page
   - 3.2.3 Consistent Navigation
   - 3.2.4 Consistent Identification
   - 3.3.2 Labels or Instructions

4. **Robust**
   - 4.1.2 Name, Role, Value (proper ARIA)
   - 4.1.3 Status Messages

## Important:
- Focus on issues NOT already found by basic validation
- Use NVDA announcements as evidence
- If you cannot determine something from NVDA data alone, note it as "info" severity
- Provide actionable recommendations

# Output Format (JSON only, no markdown)
{
  "issues": [
    {
      "criterion": "WCAG criterion (e.g., 1.3.1 Info and Relationships)",
      "severity": "error|warning|info",
      "description": "Clear description of the issue",
      "recommendation": "How to fix it with code examples if helpful",
      "evidence": "NVDA announcement or element that proves the issue"
    }
  ]
}

Return ONLY valid JSON, no markdown, no code blocks, just the raw JSON object.`;
    }

    /**
     * Call AI provider with prompt (bypassing tool parsing)
     */
    private async callAI(prompt: string): Promise<string> {
        if (!this.aiProviderManager) {
            throw new Error('AI provider not configured');
        }

        try {
            // Build complete prompt with system message
            const fullPrompt = `You are an accessibility expert specializing in WCAG 2.1 Level AA compliance analysis. You analyze NVDA screen reader output and provide detailed accessibility insights.

${prompt}`;

            // Get the provider directly and call without tool parsing
            const provider = (this.aiProviderManager as any).openaiProvider || 
                           (this.aiProviderManager as any).anthropicProvider || 
                           (this.aiProviderManager as any).geminiProvider;

            if (!provider) {
                throw new Error('No AI provider available');
            }

            // Call provider's sendMessage directly (bypasses tool parsing)
            let response: string;
            if (provider.sendMessage) {
                response = await provider.sendMessage(fullPrompt, false); // false = don't use history
            } else {
                throw new Error('Provider does not support sendMessage');
            }

            return response;
        } catch (error) {
            this.outputChannel.appendLine(`❌ AI call failed: ${error}`);
            throw error;
        }
    }

    /**
     * Parse AI response into AccessibilityIssue array
     */
    private parseAIIssues(aiResponse: string): AccessibilityIssue[] {
        try {
            // Clean response (remove markdown code blocks if present)
            let cleaned = aiResponse.trim();
            if (cleaned.startsWith('```json')) {
                cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            } else if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/```\n?/g, '').trim();
            }

            const parsed = JSON.parse(cleaned);

            if (!parsed.issues || !Array.isArray(parsed.issues)) {
                this.outputChannel.appendLine('⚠️ AI response missing issues array');
                return [];
            }

            // Map to AccessibilityIssue format
            return parsed.issues.map((issue: any) => ({
                criterion: issue.criterion || 'Unknown',
                severity: (issue.severity as 'error' | 'warning' | 'info') || 'info',
                description: issue.description || 'No description provided',
                recommendation: issue.recommendation,
                nvdaAnnouncement: issue.evidence,
                source: 'ai' as const
            }));
        } catch (error) {
            this.outputChannel.appendLine(`❌ Failed to parse AI response: ${error}`);
            this.outputChannel.appendLine(`Response was: ${aiResponse.substring(0, 500)}...`);
            return [];
        }
    }

    // ==================== UTILITY METHODS ====================

    private async stopNVDA(): Promise<void> {
        try {
            if (this.nvdaRunning) {
                this.outputChannel.appendLine('🛑 Stopping NVDA...');
                await nvda.stop();
                this.nvdaRunning = false;
                this.outputChannel.appendLine('✅ NVDA stopped');
            }
        } catch (error) {
            this.outputChannel.appendLine(`⚠️ Error stopping NVDA: ${error}`);
        }
    }

    async close(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }

        await this.stopNVDA();
    }
}