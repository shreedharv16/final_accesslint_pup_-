"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessibilityTester = void 0;
const playwright_1 = require("playwright");
const guidepup_1 = require("@guidepup/guidepup");
class AccessibilityTester {
    constructor(outputChannel) {
        this.browser = null;
        this.page = null;
        this.nvdaRunning = false;
        this.outputChannel = outputChannel;
    }
    async initialize() {
        try {
            this.outputChannel.appendLine('🚀 Initializing NVDA screen reader...');
            // Check if we're on Windows
            if (process.platform !== 'win32') {
                throw new Error('NVDA is only available on Windows. Current platform: ' + process.platform);
            }
            // Start NVDA
            this.outputChannel.appendLine('📢 Starting NVDA...');
            await guidepup_1.nvda.start();
            this.nvdaRunning = true;
            this.outputChannel.appendLine('✅ NVDA started successfully');
            // Initialize browser
            this.outputChannel.appendLine('🌐 Launching browser...');
            this.browser = await playwright_1.chromium.launch({
                headless: false,
                timeout: 60000
            });
            this.page = await this.browser.newPage();
            this.outputChannel.appendLine('✅ Browser launched successfully');
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Failed to initialize: ${error}`);
            if (this.nvdaRunning) {
                await this.stopNVDA();
            }
            throw error;
        }
    }
    async testUrl(url, onProgress) {
        const issues = [];
        const interactions = [];
        const nvdaLog = [];
        const startTime = new Date();
        try {
            if (!this.page) {
                throw new Error('Browser not initialized. Call initialize() first.');
            }
            if (!this.nvdaRunning) {
                throw new Error('NVDA not started. Call initialize() first.');
            }
            const progress = (msg) => {
                this.outputChannel.appendLine(msg);
                if (onProgress)
                    onProgress(msg);
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
            await guidepup_1.nvda.clearItemTextLog();
            await guidepup_1.nvda.clearSpokenPhraseLog();
            progress('📢 Starting NVDA navigation and testing...');
            // Test 1: Navigate through headings
            progress('Testing headings navigation...');
            const headingResults = await this.testHeadings();
            interactions.push(...headingResults.interactions);
            issues.push(...headingResults.issues);
            // Test 2: Navigate through links
            progress('Testing links navigation...');
            const linkResults = await this.testLinks();
            interactions.push(...linkResults.interactions);
            issues.push(...linkResults.issues);
            // Test 3: Navigate through form elements
            progress('Testing form elements...');
            const formResults = await this.testFormElements();
            interactions.push(...formResults.interactions);
            issues.push(...formResults.issues);
            // Test 4: Navigate through landmarks
            progress('Testing landmarks...');
            const landmarkResults = await this.testLandmarks();
            interactions.push(...landmarkResults.interactions);
            issues.push(...landmarkResults.issues);
            // Test 5: Test sequential navigation
            progress('Testing sequential navigation...');
            const sequentialResults = await this.testSequentialNavigation();
            interactions.push(...sequentialResults.interactions);
            issues.push(...sequentialResults.issues);
            // Test 6: Test interactive elements
            progress('Testing interactive elements...');
            const interactiveResults = await this.testInteractiveElements();
            interactions.push(...interactiveResults.interactions);
            issues.push(...interactiveResults.issues);
            // Capture full NVDA log
            const spokenLog = await guidepup_1.nvda.spokenPhraseLog();
            nvdaLog.push(...spokenLog);
            progress(`✅ NVDA testing completed`);
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
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error during testing: ${error}`);
            throw error;
        }
    }
    async prepareBrowser() {
        try {
            // Exit focus mode if in it
            await guidepup_1.nvda.perform(guidepup_1.nvda.keyboardCommands.exitFocusMode);
            // Report title to ensure browser is focused
            await guidepup_1.nvda.perform(guidepup_1.nvda.keyboardCommands.reportTitle);
            let windowTitle = await guidepup_1.nvda.lastSpokenPhrase();
            let retryCount = 0;
            // Try to focus Chromium window
            while (!windowTitle.includes('Chromium') && retryCount < 10) {
                retryCount++;
                await this.page?.bringToFront();
                await this.page?.waitForTimeout(500);
                await guidepup_1.nvda.perform(guidepup_1.nvda.keyboardCommands.reportTitle);
                windowTitle = await guidepup_1.nvda.lastSpokenPhrase();
            }
            if (!windowTitle.includes('Chromium')) {
                this.outputChannel.appendLine('⚠️ Warning: Could not focus browser window');
            }
            // Clear logs after setup
            await guidepup_1.nvda.clearItemTextLog();
            await guidepup_1.nvda.clearSpokenPhraseLog();
        }
        catch (error) {
            this.outputChannel.appendLine(`⚠️ Error preparing browser: ${error}`);
        }
    }
    async testHeadings() {
        const interactions = [];
        const issues = [];
        try {
            // Navigate to first heading
            await guidepup_1.nvda.perform(guidepup_1.nvda.keyboardCommands.moveToNextHeading);
            await this.page?.waitForTimeout(300);
            let headingCount = 0;
            let lastLevel = 0;
            const maxHeadings = 50;
            while (headingCount < maxHeadings) {
                const announcement = await guidepup_1.nvda.lastSpokenPhrase();
                const itemText = await guidepup_1.nvda.itemText();
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
                }
                else if (announcement.toLowerCase().includes('heading')) {
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
                await guidepup_1.nvda.perform(guidepup_1.nvda.keyboardCommands.moveToNextHeading);
                await this.page?.waitForTimeout(300);
            }
            if (headingCount === 0) {
                issues.push({
                    criterion: '1.3.2 Meaningful Sequence',
                    severity: 'warning',
                    description: 'No headings found on page. Headings help screen reader users navigate.'
                });
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`Error testing headings: ${error}`);
        }
        return { interactions, issues };
    }
    async testLinks() {
        const interactions = [];
        const issues = [];
        try {
            // Reset to top of page
            await this.page?.keyboard.press('Control+Home');
            await this.page?.waitForTimeout(500);
            await guidepup_1.nvda.clearSpokenPhraseLog();
            // Navigate to first link
            await guidepup_1.nvda.perform(guidepup_1.nvda.keyboardCommands.moveToNextLink);
            await this.page?.waitForTimeout(300);
            let linkCount = 0;
            const maxLinks = 30;
            const seenAnnouncements = new Set();
            while (linkCount < maxLinks) {
                const announcement = await guidepup_1.nvda.lastSpokenPhrase();
                const itemText = await guidepup_1.nvda.itemText();
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
                await guidepup_1.nvda.perform(guidepup_1.nvda.keyboardCommands.moveToNextLink);
                await this.page?.waitForTimeout(300);
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`Error testing links: ${error}`);
        }
        return { interactions, issues };
    }
    async testFormElements() {
        const interactions = [];
        const issues = [];
        try {
            // Reset to top of page
            await this.page?.keyboard.press('Control+Home');
            await this.page?.waitForTimeout(500);
            await guidepup_1.nvda.clearSpokenPhraseLog();
            // Navigate to first form field
            await guidepup_1.nvda.perform(guidepup_1.nvda.keyboardCommands.moveToNextFormField);
            await this.page?.waitForTimeout(300);
            let formFieldCount = 0;
            const maxFields = 20;
            const seenAnnouncements = new Set();
            while (formFieldCount < maxFields) {
                const announcement = await guidepup_1.nvda.lastSpokenPhrase();
                const itemText = await guidepup_1.nvda.itemText();
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
                await guidepup_1.nvda.perform(guidepup_1.nvda.keyboardCommands.moveToNextFormField);
                await this.page?.waitForTimeout(300);
            }
            if (formFieldCount === 0) {
                issues.push({
                    criterion: 'General',
                    severity: 'info',
                    description: 'No form fields found on page'
                });
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`Error testing form elements: ${error}`);
        }
        return { interactions, issues };
    }
    async testLandmarks() {
        const interactions = [];
        const issues = [];
        try {
            // Reset to top of page
            await this.page?.keyboard.press('Control+Home');
            await this.page?.waitForTimeout(500);
            await guidepup_1.nvda.clearSpokenPhraseLog();
            // Navigate through landmarks (D key in NVDA)
            let landmarkCount = 0;
            const maxLandmarks = 10;
            for (let i = 0; i < maxLandmarks; i++) {
                await this.page?.keyboard.press('d');
                await this.page?.waitForTimeout(300);
                const announcement = await guidepup_1.nvda.lastSpokenPhrase();
                const itemText = await guidepup_1.nvda.itemText();
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
        }
        catch (error) {
            this.outputChannel.appendLine(`Error testing landmarks: ${error}`);
        }
        return { interactions, issues };
    }
    async testSequentialNavigation() {
        const interactions = [];
        const issues = [];
        try {
            // Reset to top of page
            await this.page?.keyboard.press('Control+Home');
            await this.page?.waitForTimeout(500);
            await guidepup_1.nvda.clearSpokenPhraseLog();
            // Navigate through page sequentially
            let navigationCount = 0;
            const maxNavigations = 15;
            for (let i = 0; i < maxNavigations; i++) {
                await guidepup_1.nvda.next();
                await this.page?.waitForTimeout(200);
                const announcement = await guidepup_1.nvda.lastSpokenPhrase();
                const itemText = await guidepup_1.nvda.itemText();
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
        }
        catch (error) {
            this.outputChannel.appendLine(`Error testing sequential navigation: ${error}`);
        }
        return { interactions, issues };
    }
    async testInteractiveElements() {
        const interactions = [];
        const issues = [];
        try {
            // Test buttons
            await this.page?.keyboard.press('Control+Home');
            await this.page?.waitForTimeout(500);
            await guidepup_1.nvda.clearSpokenPhraseLog();
            // Navigate to buttons (B key in NVDA)
            let buttonCount = 0;
            const maxButtons = 10;
            for (let i = 0; i < maxButtons; i++) {
                await this.page?.keyboard.press('b');
                await this.page?.waitForTimeout(300);
                const announcement = await guidepup_1.nvda.lastSpokenPhrase();
                const itemText = await guidepup_1.nvda.itemText();
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
        }
        catch (error) {
            this.outputChannel.appendLine(`Error testing interactive elements: ${error}`);
        }
        return { interactions, issues };
    }
    async getPreviousAnnouncement() {
        try {
            const log = await guidepup_1.nvda.spokenPhraseLog();
            return log.length > 1 ? log[log.length - 2] : '';
        }
        catch {
            return '';
        }
    }
    async stopNVDA() {
        try {
            if (this.nvdaRunning) {
                this.outputChannel.appendLine('🛑 Stopping NVDA...');
                await guidepup_1.nvda.stop();
                this.nvdaRunning = false;
                this.outputChannel.appendLine('✅ NVDA stopped');
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`⚠️ Error stopping NVDA: ${error}`);
        }
    }
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
        await this.stopNVDA();
    }
}
exports.AccessibilityTester = AccessibilityTester;
//# sourceMappingURL=accessibilityTester.js.map