# AccessLint Accessibility Testing - Complete Workflow Documentation

## 📋 Table of Contents

1. [Overview](#overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Testing Flow Diagram](#testing-flow-diagram)
4. [Step-by-Step Workflow](#step-by-step-workflow)
5. [NVDA & Guidepup Integration](#nvda--guidepup-integration)
6. [Screen Reader Validation Logic](#screen-reader-validation-logic)
7. [AI-Powered Analysis](#ai-powered-analysis)
8. [Results & Reporting](#results--reporting)
9. [Code Deep Dive](#code-deep-dive)
10. [Current Limitations](#current-limitations)
11. [Room for Improvements](#room-for-improvements)
12. [Future Roadmap](#future-roadmap)

---

## 🎯 Overview

The AccessLint Testing feature performs **automated accessibility audits** using:

1. **NVDA Screen Reader** (via Guidepup library)
2. **Playwright Browser Automation**
3. **AI-Powered WCAG Analysis** (GPT-5)

It navigates through web pages like a screen reader user would, capturing announcements and identifying WCAG 2.1 Level AA compliance issues.

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        USER'S WINDOWS MACHINE                               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  VS Code Extension                                                   │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │  Testing Webview UI                                          │    │   │
│  │  │  • URL Input                                                 │    │   │
│  │  │  • Test Type Selection                                       │    │   │
│  │  │  • Results Display                                           │    │   │
│  │  │  • AI Fix Suggestions                                        │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │                              ↓                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │  AccessibilityTester Class                                   │    │   │
│  │  │  • Orchestrates entire test flow                             │    │   │
│  │  │  • Manages NVDA lifecycle                                    │    │   │
│  │  │  • Collects and analyzes results                             │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Playwright (Chromium Browser)                                       │   │
│  │  • Launches headless/headed browser                                  │   │
│  │  • Navigates to target URL                                           │   │
│  │  • Provides page for NVDA to read                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  NVDA Screen Reader (Guidepup)                                       │   │
│  │  • Reads page content aloud                                          │   │
│  │  • Navigates via keyboard commands                                   │   │
│  │  • Captures spoken phrases                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ↓                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  AI Analysis (GPT-5)                                                 │   │
│  │  • Analyzes NVDA output                                              │   │
│  │  • Identifies WCAG violations                                        │   │
│  │  • Provides fix recommendations                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Testing Flow Diagram

```
User Enters URL
       │
       ▼
┌──────────────────┐
│  Initialize      │
│  Playwright      │
│  Browser         │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Start NVDA      │
│  Screen Reader   │
│  (via Guidepup)  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Navigate to     │
│  Target URL      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Focus Browser   │
│  Window for NVDA │
└────────┬─────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 1: Basic NVDA Validation               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │Test Headings│  │ Test Links  │  │ Test Forms  │             │
│  │   (H key)   │  │   (K key)   │  │   (F key)   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │Test Landmrks│  │ Test Arrow  │  │Test Buttons │             │
│  │   (D key)   │  │  Navigation │  │   (B key)   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 2: AI Validation                       │
│  • Send NVDA interactions to GPT-5                              │
│  • Comprehensive WCAG 2.1 AA analysis                           │
│  • Identify issues not caught by basic validation               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌──────────────────┐
│  Compile Results │
│  & Generate      │
│  Report          │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Display in UI   │
│  with Fix        │
│  Suggestions     │
└──────────────────┘
```

---

## 📝 Step-by-Step Workflow

### **Step 1: User Initiates Test**

**File:** `src/testingWebviewProvider.ts`

```typescript
// User clicks "Run Test" in Testing webview
webviewView.webview.onDidReceiveMessage(async (message) => {
    switch (message.type) {
        case 'runTest':
            await this.runAccessibilityTest(message.url, message.testType);
            break;
    }
});
```

**UI Input:**
```
┌────────────────────────────────────────────┐
│  🔍 Accessibility Testing                   │
│                                            │
│  URL: [https://example.com          ]      │
│                                            │
│  Test Type: [▼ Full NVDA + AI Analysis ]   │
│                                            │
│  [🚀 Run Accessibility Test]               │
└────────────────────────────────────────────┘
```

---

### **Step 2: Initialize Testing Components**

**File:** `src/accessibilityTester.ts`

```typescript
async initialize(): Promise<void> {
    // Step 2a: Check platform
    if (process.platform !== 'win32') {
        throw new Error('NVDA is only available on Windows');
    }

    // Step 2b: Check if NVDA is already running
    try {
        const result = execSync('tasklist /FI "IMAGENAME eq nvda.exe"', { encoding: 'utf-8' });
        if (result.includes('nvda.exe')) {
            this.outputChannel.appendLine('⚠️ WARNING: NVDA is already running!');
        }
    } catch (e) {
        // Ignore
    }

    // Step 2c: Start NVDA via Guidepup
    this.outputChannel.appendLine('📢 Starting NVDA...');
    
    const nvdaStartPromise = nvda.start();
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('NVDA start timeout after 30 seconds')), 30000);
    });

    await Promise.race([nvdaStartPromise, timeoutPromise]);
    this.nvdaRunning = true;
    this.outputChannel.appendLine('✅ NVDA started successfully');

    // Step 2d: Launch Playwright browser
    this.outputChannel.appendLine('🌐 Launching browser...');
    this.browser = await chromium.launch({
        headless: false,  // Must be visible for NVDA
        args: ['--disable-web-security']
    });
    
    this.page = await this.browser.newPage();
    this.outputChannel.appendLine('✅ Browser ready');
}
```

---

### **Step 3: Navigate to Target URL**

```typescript
async runTest(url: string, testType: string, progress: (msg: string) => void): Promise<TestResult> {
    // Navigate to URL
    progress(`🔍 Navigating to: ${url}`);
    await this.page?.goto(url, { waitUntil: 'networkidle' });
    
    // Wait for page to be fully loaded
    await this.page?.waitForTimeout(2000);
    
    progress('✅ Page loaded');
}
```

---

### **Step 4: Prepare Browser for NVDA**

```typescript
private async prepareBrowserForNVDA(): Promise<void> {
    // Exit NVDA focus mode to ensure we're in browse mode
    await nvda.perform(nvda.keyboardCommands.exitFocusMode);
    
    // Report window title to verify browser is focused
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

    // Clear NVDA logs to start fresh
    await nvda.clearItemTextLog();
    await nvda.clearSpokenPhraseLog();
}
```

---

### **Step 5: Phase 1 - Basic NVDA Validation**

#### **5a: Test Headings (H key)**

```typescript
private async testHeadings(): Promise<{ interactions: NVDAInteraction[], issues: AccessibilityIssue[] }> {
    const interactions: NVDAInteraction[] = [];
    const issues: AccessibilityIssue[] = [];

    // Navigate to first heading (H key in NVDA)
    await nvda.perform(nvda.keyboardCommands.moveToNextHeading);
    await this.page?.waitForTimeout(300);

    let headingCount = 0;
    let lastLevel = 0;
    const maxHeadings = 50;

    while (headingCount < maxHeadings) {
        // Capture what NVDA announced
        const announcement = await nvda.lastSpokenPhrase();
        const itemText = await nvda.itemText();

        if (!announcement || announcement === '') {
            break; // No more headings
        }

        // Log interaction
        interactions.push({
            action: 'Navigate to heading',
            announcement: announcement,
            element: itemText,
            timestamp: new Date()
        });

        // Parse heading level from announcement
        // Example: "heading level 1 Welcome to Our Site"
        const levelMatch = announcement.match(/heading[,\s]+level\s+(\d+)/i);
        
        if (levelMatch) {
            const level = parseInt(levelMatch[1]);

            // Rule: First heading should be h1
            if (headingCount === 0 && level !== 1) {
                issues.push({
                    criterion: '1.3.2 Meaningful Sequence',
                    severity: 'warning',
                    description: `First heading is h${level}, should be h1`,
                    nvdaAnnouncement: announcement
                });
            }

            // Rule: No heading level skips (h1 → h3 = bad)
            if (lastLevel > 0 && level - lastLevel > 1) {
                issues.push({
                    criterion: '1.3.2 Meaningful Sequence',
                    severity: 'warning',
                    description: `Heading hierarchy skip from h${lastLevel} to h${level}`,
                    nvdaAnnouncement: announcement
                });
            }

            lastLevel = level;
        }

        // Rule: Heading should have meaningful text
        if (!itemText || itemText.trim().length === 0) {
            issues.push({
                criterion: '1.1.1 Non-text Content',
                severity: 'error',
                description: 'Heading is empty or has no accessible text',
                nvdaAnnouncement: announcement
            });
        }

        headingCount++;

        // Move to next heading
        await nvda.perform(nvda.keyboardCommands.moveToNextHeading);
        await this.page?.waitForTimeout(300);
    }

    // Rule: Page should have at least one heading
    if (headingCount === 0) {
        issues.push({
            criterion: '1.3.2 Meaningful Sequence',
            severity: 'warning',
            description: 'No headings found on page'
        });
    }

    return { interactions, issues };
}
```

#### **5b: Test Links (K key)**

```typescript
private async testLinks(): Promise<{ interactions: NVDAInteraction[], issues: AccessibilityIssue[] }> {
    const interactions: NVDAInteraction[] = [];
    const issues: AccessibilityIssue[] = [];

    // Reset to top of page
    await this.page?.keyboard.press('Control+Home');
    await nvda.clearSpokenPhraseLog();

    // Navigate to first link (K key in NVDA)
    await nvda.perform(nvda.keyboardCommands.moveToNextLink);

    let linkCount = 0;
    const maxLinks = 30;
    const seenAnnouncements = new Set<string>();

    while (linkCount < maxLinks) {
        const announcement = await nvda.lastSpokenPhrase();
        const itemText = await nvda.itemText();

        if (!announcement || seenAnnouncements.has(announcement)) {
            break;
        }
        seenAnnouncements.add(announcement);

        interactions.push({
            action: 'Navigate to link',
            announcement: announcement,
            element: itemText,
            timestamp: new Date()
        });

        // Rule: Element should be announced as a link
        if (!announcement.toLowerCase().includes('link')) {
            issues.push({
                criterion: '4.1.2 Name, Role, Value',
                severity: 'error',
                description: 'Element not properly announced as link',
                nvdaAnnouncement: announcement
            });
        }

        // Rule: Links should have descriptive text
        const badLinkPatterns = [/^click here$/i, /^here$/i, /^link$/i, /^read more$/i, /^more$/i];
        if (badLinkPatterns.some(pattern => pattern.test(itemText))) {
            issues.push({
                criterion: '2.4.4 Link Purpose',
                severity: 'warning',
                description: `Link has non-descriptive text: "${itemText}"`,
                nvdaAnnouncement: announcement
            });
        }

        // Rule: Links should not be empty
        if (!itemText || itemText.trim().length === 0) {
            issues.push({
                criterion: '2.4.4 Link Purpose',
                severity: 'error',
                description: 'Link has no accessible text',
                nvdaAnnouncement: announcement
            });
        }

        linkCount++;
        await nvda.perform(nvda.keyboardCommands.moveToNextLink);
        await this.page?.waitForTimeout(300);
    }

    return { interactions, issues };
}
```

#### **5c: Test Form Elements (F key)**

```typescript
private async testFormElements(): Promise<{ interactions: NVDAInteraction[], issues: AccessibilityIssue[] }> {
    const interactions: NVDAInteraction[] = [];
    const issues: AccessibilityIssue[] = [];

    await this.page?.keyboard.press('Control+Home');
    await nvda.clearSpokenPhraseLog();

    // Navigate to first form field (F key)
    await nvda.perform(nvda.keyboardCommands.moveToNextFormField);

    let fieldCount = 0;
    const maxFields = 20;

    while (fieldCount < maxFields) {
        const announcement = await nvda.lastSpokenPhrase();
        const itemText = await nvda.itemText();

        if (!announcement) break;

        interactions.push({
            action: 'Navigate to form field',
            announcement: announcement,
            element: itemText,
            timestamp: new Date()
        });

        // Rule: Form field type should be announced
        const hasType = /edit|combo box|check box|radio button|button/i.test(announcement);
        if (!hasType) {
            issues.push({
                criterion: '4.1.2 Name, Role, Value',
                severity: 'warning',
                description: 'Form field type not clearly announced',
                nvdaAnnouncement: announcement
            });
        }

        // Rule: Form fields must have labels
        if (!itemText || itemText.trim().length === 0 || itemText === 'blank') {
            issues.push({
                criterion: '3.3.2 Labels or Instructions',
                severity: 'error',
                description: 'Form field has no accessible label',
                nvdaAnnouncement: announcement
            });
        }

        fieldCount++;
        await nvda.perform(nvda.keyboardCommands.moveToNextFormField);
        await this.page?.waitForTimeout(300);
    }

    return { interactions, issues };
}
```

#### **5d: Test Sequential Navigation (Down Arrow)**

```typescript
private async testSequentialNavigation(): Promise<{ interactions: NVDAInteraction[], issues: AccessibilityIssue[] }> {
    const interactions: NVDAInteraction[] = [];
    const issues: AccessibilityIssue[] = [];

    await this.page?.keyboard.press('Control+Home');
    await nvda.clearSpokenPhraseLog();

    // Navigate through page sequentially (Down Arrow)
    for (let i = 0; i < 15; i++) {
        await nvda.next();  // Down Arrow
        await this.page?.waitForTimeout(200);

        const announcement = await nvda.lastSpokenPhrase();
        const itemText = await nvda.itemText();

        if (!announcement) break;

        interactions.push({
            action: 'Sequential navigation (down arrow)',
            announcement: announcement,
            element: itemText,
            timestamp: new Date()
        });

        // Check for unlabeled images
        if (announcement.toLowerCase().includes('graphic') || 
            announcement.toLowerCase().includes('image')) {
            if (announcement.toLowerCase().includes('unlabeled') || 
                itemText.trim() === '') {
                issues.push({
                    criterion: '1.1.1 Non-text Content',
                    severity: 'error',
                    description: 'Image has no alt text',
                    nvdaAnnouncement: announcement
                });
            }
        }

        // Check for unclear clickable elements
        if (announcement.toLowerCase().includes('clickable')) {
            if (!announcement.toLowerCase().includes('link') && 
                !announcement.toLowerCase().includes('button')) {
                issues.push({
                    criterion: '4.1.2 Name, Role, Value',
                    severity: 'warning',
                    description: 'Clickable element role unclear',
                    nvdaAnnouncement: announcement
                });
            }
        }
    }

    return { interactions, issues };
}
```

#### **5e: Test Interactive Elements (B key for Buttons)**

```typescript
private async testInteractiveElements(): Promise<{ interactions: NVDAInteraction[], issues: AccessibilityIssue[] }> {
    const interactions: NVDAInteraction[] = [];
    const issues: AccessibilityIssue[] = [];

    await this.page?.keyboard.press('Control+Home');
    await nvda.clearSpokenPhraseLog();

    // Navigate to buttons (B key)
    for (let i = 0; i < 10; i++) {
        await this.page?.keyboard.press('b');  // B key for buttons
        await this.page?.waitForTimeout(300);

        const announcement = await nvda.lastSpokenPhrase();
        const itemText = await nvda.itemText();

        if (!announcement) break;

        if (announcement.toLowerCase().includes('button')) {
            interactions.push({
                action: 'Navigate to button',
                announcement: announcement,
                element: itemText,
                timestamp: new Date()
            });

            // Rule: Buttons must have accessible names
            if (!itemText || itemText.trim().length === 0) {
                issues.push({
                    criterion: '4.1.2 Name, Role, Value',
                    severity: 'error',
                    description: 'Button has no accessible text',
                    nvdaAnnouncement: announcement
                });
            }
        }
    }

    return { interactions, issues };
}
```

---

### **Step 6: Phase 2 - AI-Powered Validation**

**File:** `src/accessibilityTester.ts`

```typescript
private async aiValidation(
    url: string,
    interactions: NVDAInteraction[],
    basicIssues: AccessibilityIssue[]
): Promise<AccessibilityIssue[]> {
    
    // Build comprehensive prompt for AI
    const prompt = this.buildAIValidationPrompt(url, interactions, basicIssues);

    // Call GPT-5 for analysis
    const response = await this.callAI(prompt);

    // Parse AI response into structured issues
    return this.parseAIIssues(response);
}

private buildAIValidationPrompt(url: string, interactions: NVDAInteraction[], basicIssues: AccessibilityIssue[]): string {
    // Group interactions by type
    const headings = interactions.filter(i => i.action.includes('heading'));
    const links = interactions.filter(i => i.action.includes('link'));
    const forms = interactions.filter(i => i.action.includes('form'));

    return `You are an accessibility expert. Analyze this NVDA screen reader session for WCAG 2.1 Level AA compliance.

# URL Tested
${url}

# NVDA Interactions Summary
- Total interactions: ${interactions.length}
- Headings found: ${headings.length}
- Links found: ${links.length}
- Form fields found: ${forms.length}

# Detailed NVDA Announcements

## Headings (${headings.length})
${headings.map((i, idx) => `${idx + 1}. NVDA: "${i.announcement}" | Element: "${i.element}"`).join('\n')}

## Links (${links.length})
${links.map((i, idx) => `${idx + 1}. NVDA: "${i.announcement}" | Element: "${i.element}"`).join('\n')}

## Form Fields (${forms.length})
${forms.map((i, idx) => `${idx + 1}. NVDA: "${i.announcement}" | Element: "${i.element}"`).join('\n')}

# Basic Issues Already Found (${basicIssues.length})
${basicIssues.map((i, idx) => `${idx + 1}. [${i.severity}] ${i.criterion}: ${i.description}`).join('\n')}

# Your Task
Find WCAG 2.1 Level AA issues NOT caught by basic validation:

1. **Perceivable**
   - Alt text quality (not just presence)
   - Semantic structure issues
   - Reading order problems

2. **Operable**
   - Keyboard accessibility gaps
   - Skip link effectiveness
   - Focus order concerns

3. **Understandable**
   - Label quality
   - Consistent navigation
   - Error handling

4. **Robust**
   - ARIA usage problems
   - Custom widget accessibility

# Output Format (JSON only)
{
  "issues": [
    {
      "criterion": "WCAG criterion",
      "severity": "error|warning|info",
      "description": "Issue description",
      "recommendation": "How to fix",
      "evidence": "NVDA announcement as proof"
    }
  ]
}`;
}
```

---

### **Step 7: Compile Results**

```typescript
async runTest(url: string, testType: string, progress: (msg: string) => void): Promise<TestResult> {
    const interactions: NVDAInteraction[] = [];
    const issues: AccessibilityIssue[] = [];

    // Phase 1: Basic NVDA Testing
    progress('📋 Phase 1: Basic NVDA validation...');
    
    const headingResults = await this.testHeadings();
    interactions.push(...headingResults.interactions);
    issues.push(...headingResults.issues);

    const linkResults = await this.testLinks();
    interactions.push(...linkResults.interactions);
    issues.push(...linkResults.issues);

    const formResults = await this.testFormElements();
    interactions.push(...formResults.interactions);
    issues.push(...formResults.issues);

    const navResults = await this.testSequentialNavigation();
    interactions.push(...navResults.interactions);
    issues.push(...navResults.issues);

    const buttonResults = await this.testInteractiveElements();
    interactions.push(...buttonResults.interactions);
    issues.push(...buttonResults.issues);

    progress(`✅ Basic validation complete (${issues.length} issues)`);

    // Phase 2: AI Validation
    if (testType === 'full' || testType === 'ai') {
        progress('🤖 Phase 2: AI comprehensive validation...');
        
        const aiIssues = await this.aiValidation(url, interactions, issues);
        
        // Mark AI issues as from AI
        aiIssues.forEach(issue => issue.source = 'ai');
        issues.push(...aiIssues);
        
        progress(`✅ AI validation complete (+${aiIssues.length} issues)`);
    }

    // Compile final results
    return {
        url,
        timestamp: new Date(),
        interactions,
        issues,
        summary: {
            totalIssues: issues.length,
            errors: issues.filter(i => i.severity === 'error').length,
            warnings: issues.filter(i => i.severity === 'warning').length,
            info: issues.filter(i => i.severity === 'info').length,
            totalInteractions: interactions.length
        }
    };
}
```

---

### **Step 8: Display Results in UI**

**File:** `src/testingWebviewProvider.ts`

```typescript
private async displayResults(result: TestResult): void {
    // Send results to webview
    this._view?.webview.postMessage({
        type: 'testResults',
        data: {
            url: result.url,
            timestamp: result.timestamp,
            summary: result.summary,
            issues: result.issues.map(issue => ({
                criterion: issue.criterion,
                severity: issue.severity,
                description: issue.description,
                recommendation: issue.recommendation,
                nvdaAnnouncement: issue.nvdaAnnouncement,
                source: issue.source || 'basic'
            }))
        }
    });
}
```

**UI Display:**

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 Test Results for https://example.com                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                 │
│  Summary:                                                       │
│  • 12 Total Issues                                              │
│  • 🔴 3 Errors (Critical)                                       │
│  • 🟡 6 Warnings                                                │
│  • 🔵 3 Info                                                    │
│  • 45 NVDA Interactions                                         │
│                                                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                 │
│  🔴 ERROR: 1.1.1 Non-text Content                               │
│  Image has no alt text - NVDA announces as "unlabeled graphic"  │
│  📢 NVDA: "graphic unlabeled"                                   │
│  💡 Fix: Add descriptive alt text to the image                  │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ [🤖 Ask AI to Fix This]  [📋 Copy Issue]                   ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
│  🟡 WARNING: 2.4.4 Link Purpose                                 │
│  Link has non-descriptive text: "click here"                    │
│  📢 NVDA: "click here link"                                     │
│  💡 Fix: Use descriptive text like "Download our brochure"      │
│                                                                 │
│  ...more issues...                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 NVDA & Guidepup Integration

### **What is Guidepup?**

Guidepup is a Node.js library that programmatically controls screen readers:
- **NVDA** (Windows)
- **VoiceOver** (macOS)

### **How Guidepup Controls NVDA**

```
┌──────────────────────────────────────────────────────────────────┐
│                     Guidepup Architecture                        │
│                                                                  │
│  Your Code                Guidepup            NVDA               │
│     │                        │                  │                │
│     │  nvda.start()          │                  │                │
│     │ ─────────────────────> │                  │                │
│     │                        │  Launch Process  │                │
│     │                        │ ───────────────> │                │
│     │                        │                  │ ● NVDA Running │
│     │                        │                  │                │
│     │  nvda.next()           │                  │                │
│     │ ─────────────────────> │                  │                │
│     │                        │  Send ↓ key      │                │
│     │                        │ ───────────────> │                │
│     │                        │                  │ "heading..."   │
│     │                        │                  │                │
│     │  nvda.lastSpokenPhrase()                  │                │
│     │ ─────────────────────> │  Get speech log  │                │
│     │                        │ <─────────────── │                │
│     │ <───────────────────── │                  │                │
│     │  "heading level 1"     │                  │                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### **Key Guidepup Methods Used**

| Method | Action | NVDA Equivalent |
|--------|--------|-----------------|
| `nvda.start()` | Launch NVDA | Open NVDA.exe |
| `nvda.stop()` | Close NVDA | Exit NVDA |
| `nvda.next()` | Move to next element | ↓ Down Arrow |
| `nvda.previous()` | Move to previous | ↑ Up Arrow |
| `nvda.perform(cmd)` | Execute keyboard command | Various keys |
| `nvda.lastSpokenPhrase()` | Get last announcement | N/A (internal) |
| `nvda.itemText()` | Get current element text | N/A (internal) |
| `nvda.spokenPhraseLog()` | Get all announcements | N/A (internal) |
| `nvda.clearSpokenPhraseLog()` | Clear announcement log | N/A (internal) |

### **NVDA Keyboard Commands Used**

```typescript
// Available commands in nvda.keyboardCommands
nvda.keyboardCommands.moveToNextHeading       // H key
nvda.keyboardCommands.moveToPreviousHeading   // Shift+H
nvda.keyboardCommands.moveToNextLink          // K key
nvda.keyboardCommands.moveToNextFormField     // F key
nvda.keyboardCommands.exitFocusMode           // Escape
nvda.keyboardCommands.reportTitle             // NVDA+T

// Custom keys (via Playwright)
page.keyboard.press('b');           // B key (buttons)
page.keyboard.press('d');           // D key (landmarks)
page.keyboard.press('Control+Home'); // Go to top
```

---

## 🔍 Screen Reader Validation Logic

### **Validation Rules Implemented**

| WCAG Criterion | What We Check | How We Check |
|----------------|---------------|--------------|
| **1.1.1 Non-text Content** | Images have alt text | NVDA announces "graphic" without description |
| **1.3.1 Info and Relationships** | Proper semantic structure | Heading hierarchy, form labels |
| **1.3.2 Meaningful Sequence** | Logical reading order | Sequential navigation order |
| **2.4.4 Link Purpose** | Descriptive link text | Check for "click here", "more", etc. |
| **2.4.6 Headings and Labels** | Meaningful headings | Empty heading detection |
| **3.3.2 Labels or Instructions** | Form field labels | NVDA announces field without label |
| **4.1.2 Name, Role, Value** | Proper ARIA roles | Element type announced correctly |

### **Rule Engine Flow**

```typescript
// Example: Heading Validation Rule
function validateHeading(announcement: string, itemText: string, context: ValidationContext): Issue[] {
    const issues: Issue[] = [];
    
    // Rule 1: First heading should be h1
    if (context.headingCount === 0) {
        const level = extractLevel(announcement);
        if (level !== 1) {
            issues.push({
                criterion: '1.3.2',
                severity: 'warning',
                description: `First heading is h${level}, should be h1`
            });
        }
    }
    
    // Rule 2: No heading level skips
    if (context.lastLevel > 0) {
        const currentLevel = extractLevel(announcement);
        if (currentLevel - context.lastLevel > 1) {
            issues.push({
                criterion: '1.3.2',
                severity: 'warning',
                description: `Heading skip from h${context.lastLevel} to h${currentLevel}`
            });
        }
    }
    
    // Rule 3: Heading must have content
    if (!itemText || itemText.trim() === '') {
        issues.push({
            criterion: '1.1.1',
            severity: 'error',
            description: 'Empty heading'
        });
    }
    
    return issues;
}
```

---

## 🤖 AI-Powered Analysis

### **What AI Adds Beyond Basic Validation**

| Basic Validation | AI Validation |
|------------------|---------------|
| Checks if alt exists | Evaluates alt text quality |
| Detects "click here" | Understands link context |
| Finds missing labels | Assesses label clarity |
| Counts headings | Evaluates heading meaning |
| Detects empty elements | Identifies semantic issues |

### **AI Prompt Engineering**

The prompt sent to GPT-5 includes:
1. **URL tested**
2. **All NVDA interactions** (grouped by type)
3. **Basic issues already found** (to avoid duplicates)
4. **Specific WCAG criteria to check**
5. **Output format specification**

### **AI Response Processing**

```typescript
private parseAIIssues(aiResponse: string): AccessibilityIssue[] {
    // Clean markdown formatting
    let cleaned = aiResponse.replace(/```json\n?/g, '').replace(/```/g, '');
    
    // Parse JSON
    const parsed = JSON.parse(cleaned);
    
    // Map to our format
    return parsed.issues.map(issue => ({
        criterion: issue.criterion,
        severity: issue.severity,
        description: issue.description,
        recommendation: issue.recommendation,
        nvdaAnnouncement: issue.evidence,
        source: 'ai'
    }));
}
```

---

## ❌ Current Limitations

### **1. No Tab Key Navigation** ⚠️ CRITICAL

**Problem:**
- Uses NVDA single-letter navigation (H, K, F, B)
- Does NOT test actual Tab key focus order
- Keyboard-only users navigate with Tab, not H/K/F

**Impact:**
- Focus order issues not detected
- Keyboard traps not found
- Skip links not verified

---

### **2. Browse Mode Only**

**Problem:**
- Tests only NVDA Browse Mode
- Doesn't test Focus Mode (forms, applications)
- Arrow key behavior in forms not tested

**Impact:**
- Form interaction issues missed
- Custom widget navigation untested

---

### **3. Limited Element Coverage**

**Tested:**
- ✅ Headings
- ✅ Links
- ✅ Form fields
- ✅ Buttons
- ✅ Landmarks
- ✅ Images (basic)

**NOT Tested:**
- ❌ Dropdown menus
- ❌ Modal dialogs
- ❌ Tab panels
- ❌ Accordions
- ❌ Carousels
- ❌ Custom ARIA widgets
- ❌ Data tables

---

### **4. No Interaction Testing**

**Problem:**
- Doesn't click buttons
- Doesn't submit forms
- Doesn't open modals
- Doesn't trigger dynamic content

**Impact:**
- Dynamic accessibility issues missed
- JavaScript-dependent features untested
- ARIA live regions untested

---

### **5. No Focus Visibility Testing**

**Problem:**
- Can't verify focus indicators are visible
- Can't check focus ring color/contrast
- Visual testing not possible via NVDA

**Impact:**
- WCAG 2.4.7 Focus Visible not verifiable

---

### **6. Single Page Only**

**Problem:**
- Tests one page at a time
- Doesn't test navigation between pages
- Doesn't test browser back/forward

**Impact:**
- Multi-page flows untested
- Site-wide consistency not verified

---

### **7. Windows Only**

**Problem:**
- NVDA only works on Windows
- VoiceOver (macOS) not supported
- Mobile screen readers not supported

**Impact:**
- Limited to Windows users
- Cross-platform accessibility gaps

---

### **8. Timing Limitations**

**Problem:**
- Fixed 300ms delays between actions
- May miss slow-loading content
- Doesn't test timing-sensitive features

**Impact:**
- Race conditions possible
- Async content issues missed

---

## 🚀 Room for Improvements

### **Priority 1: Tab Key Navigation** 🔥

```typescript
// Proposed: Add Tab navigation testing
async testTabNavigation(): Promise<{ interactions: NVDAInteraction[], issues: AccessibilityIssue[] }> {
    const interactions: NVDAInteraction[] = [];
    const issues: AccessibilityIssue[] = [];
    const focusOrder: string[] = [];

    // Press Tab repeatedly to navigate through focusable elements
    for (let i = 0; i < 30; i++) {
        await this.page?.keyboard.press('Tab');
        await this.page?.waitForTimeout(200);
        
        const announcement = await nvda.lastSpokenPhrase();
        focusOrder.push(announcement);
        
        interactions.push({
            action: 'Tab navigation',
            announcement: announcement,
            timestamp: new Date()
        });
    }

    // Check for keyboard traps
    const uniqueFocused = new Set(focusOrder);
    if (uniqueFocused.size < 3 && focusOrder.length >= 10) {
        issues.push({
            criterion: '2.1.2 No Keyboard Trap',
            severity: 'error',
            description: 'Keyboard trap detected - focus stuck in loop'
        });
    }

    return { interactions, issues };
}
```

---

### **Priority 2: Skip Link Verification**

```typescript
// Proposed: Verify skip links work
async testSkipLinks(): Promise<AccessibilityIssue[]> {
    const issues: AccessibilityIssue[] = [];
    
    // Tab once - should focus skip link
    await this.page?.keyboard.press('Tab');
    const firstFocus = await nvda.lastSpokenPhrase();
    
    if (!firstFocus.toLowerCase().includes('skip') && 
        !firstFocus.toLowerCase().includes('main')) {
        issues.push({
            criterion: '2.4.1 Bypass Blocks',
            severity: 'warning',
            description: 'First focusable element is not a skip link'
        });
    }
    
    // Activate skip link and verify focus moved
    await this.page?.keyboard.press('Enter');
    await this.page?.waitForTimeout(500);
    
    const afterSkip = await nvda.lastSpokenPhrase();
    // Verify focus is now on main content landmark
    
    return issues;
}
```

---

### **Priority 3: Interactive Element Testing**

```typescript
// Proposed: Click and verify interactive elements
async testInteractiveElement(selector: string): Promise<AccessibilityIssue[]> {
    const issues: AccessibilityIssue[] = [];
    
    // Focus the element
    await this.page?.focus(selector);
    const beforeClick = await nvda.lastSpokenPhrase();
    
    // Verify it's announced properly
    if (!beforeClick.toLowerCase().includes('button')) {
        issues.push({
            criterion: '4.1.2 Name, Role, Value',
            severity: 'error',
            description: 'Interactive element not announced as button'
        });
    }
    
    // Click it
    await this.page?.click(selector);
    await this.page?.waitForTimeout(500);
    
    // Check if state changed
    const afterClick = await nvda.lastSpokenPhrase();
    // Verify state change announced (expanded, pressed, etc.)
    
    return issues;
}
```

---

### **Priority 4: Modal Dialog Testing**

```typescript
// Proposed: Test modal accessibility
async testModal(triggerSelector: string): Promise<AccessibilityIssue[]> {
    const issues: AccessibilityIssue[] = [];
    
    // Click trigger to open modal
    await this.page?.click(triggerSelector);
    await this.page?.waitForTimeout(500);
    
    // Verify focus moved to modal
    const modalFocus = await nvda.lastSpokenPhrase();
    if (!modalFocus.toLowerCase().includes('dialog')) {
        issues.push({
            criterion: '4.1.2 Name, Role, Value',
            severity: 'error',
            description: 'Modal not announced as dialog'
        });
    }
    
    // Verify focus is trapped in modal
    let tabCount = 0;
    const inModalElements: string[] = [];
    
    while (tabCount < 20) {
        await this.page?.keyboard.press('Tab');
        const current = await nvda.lastSpokenPhrase();
        
        if (inModalElements.includes(current)) {
            // Focus wrapped - good!
            break;
        }
        inModalElements.push(current);
        tabCount++;
    }
    
    // Verify Escape closes modal
    await this.page?.keyboard.press('Escape');
    const afterEscape = await nvda.lastSpokenPhrase();
    // Verify modal closed and focus returned to trigger
    
    return issues;
}
```

---

### **Priority 5: ARIA Live Region Testing**

```typescript
// Proposed: Test dynamic announcements
async testLiveRegions(): Promise<AccessibilityIssue[]> {
    const issues: AccessibilityIssue[] = [];
    
    // Clear log
    await nvda.clearSpokenPhraseLog();
    
    // Trigger action that updates live region (e.g., submit form)
    await this.page?.click('#submit-button');
    await this.page?.waitForTimeout(1000);
    
    // Check if announcement was made
    const log = await nvda.spokenPhraseLog();
    
    // Look for success/error message in log
    const hasAnnouncement = log.some(phrase => 
        phrase.includes('success') || 
        phrase.includes('error') ||
        phrase.includes('submitted')
    );
    
    if (!hasAnnouncement) {
        issues.push({
            criterion: '4.1.3 Status Messages',
            severity: 'warning',
            description: 'Form submission result not announced to screen reader'
        });
    }
    
    return issues;
}
```

---

### **Priority 6: Cross-Platform Support**

```typescript
// Proposed: Support VoiceOver on macOS
import { voiceOver } from '@guidepup/guidepup';

async initializeScreenReader(): Promise<ScreenReaderInterface> {
    if (process.platform === 'win32') {
        await nvda.start();
        return new NVDAAdapter(nvda);
    } else if (process.platform === 'darwin') {
        await voiceOver.start();
        return new VoiceOverAdapter(voiceOver);
    } else {
        throw new Error('No screen reader available for this platform');
    }
}
```

---

### **Priority 7: Color Contrast Testing (Visual)**

```typescript
// Proposed: Use axe-core for visual tests
import { AxeBuilder } from '@axe-core/playwright';

async testColorContrast(): Promise<AccessibilityIssue[]> {
    const issues: AccessibilityIssue[] = [];
    
    // Run axe-core for color contrast
    const axeResults = await new AxeBuilder({ page: this.page })
        .withRules(['color-contrast'])
        .analyze();
    
    // Convert axe violations to our format
    for (const violation of axeResults.violations) {
        issues.push({
            criterion: '1.4.3 Contrast (Minimum)',
            severity: 'error',
            description: violation.description,
            element: violation.nodes[0].html
        });
    }
    
    return issues;
}
```

---

## 🗺️ Future Roadmap

### **Phase 1: Core Improvements** (v0.2.0)
- [ ] Add Tab key navigation testing
- [ ] Implement skip link verification
- [ ] Add keyboard trap detection
- [ ] Improve timing handling

### **Phase 2: Interactive Testing** (v0.3.0)
- [ ] Button click testing
- [ ] Form submission testing
- [ ] Modal dialog testing
- [ ] Dropdown menu testing

### **Phase 3: Advanced Features** (v0.4.0)
- [ ] ARIA live region testing
- [ ] Custom widget testing
- [ ] Data table testing
- [ ] Carousel/slider testing

### **Phase 4: Cross-Platform** (v0.5.0)
- [ ] VoiceOver support (macOS)
- [ ] Mobile testing (future)
- [ ] Browser matrix testing

### **Phase 5: Reporting** (v1.0.0)
- [ ] PDF report generation
- [ ] Historical comparison
- [ ] Remediation tracking
- [ ] CI/CD integration

---

## 📚 Related Files

| File | Purpose |
|------|---------|
| `src/accessibilityTester.ts` | Main testing logic |
| `src/testingWebviewProvider.ts` | UI integration |
| `src/testingAgentOrchestrator.ts` | AI-powered fix generation |
| `webviews/testing.js` | Testing UI JavaScript |
| `webviews/testing.css` | Testing UI styles |

---

**Last Updated**: December 2024  
**Version**: 0.1.0

