# 🏗️ AccessLint Testing Architecture - Complete Explanation

## 📋 **Table of Contents**

1. [How Guidepup + NVDA Testing Works](#1-how-guidepup--nvda-testing-works)
2. [Who Validates & How](#2-who-validates--how)
3. [Where the Orchestrator Fits In](#3-where-the-orchestrator-fits-in)
4. [Testing Menu vs Chat Agent Mode](#4-testing-menu-vs-chat-agent-mode)
5. [How They Benefit Each Other](#5-how-they-benefit-each-other)
6. [Complete Flow Diagram](#6-complete-flow-diagram)

---

## 1. How Guidepup + NVDA Testing Works

### **The Players**

| Component | Role | File |
|-----------|------|------|
| **Guidepup** | Library that controls NVDA programmatically | `@guidepup/guidepup` (npm package) |
| **NVDA** | Real Windows screen reader | Installed on system |
| **Playwright** | Browser automation (Chromium) | `playwright` (npm package) |
| **AccessibilityTester** | Orchestrates the testing process | `src/accessibilityTester.ts` |
| **TestingWebviewProvider** | UI for testing menu | `src/testingWebviewProvider.ts` |

---

### **Step-by-Step Flow**

#### **Phase 1: Initialization (When you click "Start Test")**

```typescript
// File: src/accessibilityTester.ts (line 46-77)

async initialize(): Promise<void> {
    // 1. Start NVDA screen reader
    await nvda.start();  // ← Guidepup launches NVDA.exe
    this.nvdaRunning = true;
    
    // 2. Launch Chromium browser
    this.browser = await chromium.launch({ headless: false });
    this.page = await this.browser.newPage();
}
```

**What Happens:**
- ✅ **NVDA.exe** launches (Windows screen reader process)
- ✅ **Chromium browser** opens (headless: false means you see it)
- ✅ They're now ready to communicate via Guidepup's API

---

#### **Phase 2: Testing Execution (Actual Screen Reader Testing)**

```typescript
// File: src/accessibilityTester.ts (line 79-180)

async testUrl(url: string): Promise<TestResult> {
    // 1. Navigate to your website
    await this.page.goto(url);
    
    // 2. Clear NVDA's speech logs
    await nvda.clearItemTextLog();
    await nvda.clearSpokenPhraseLog();
    
    // 3. Run 6 different tests
    const headingResults = await this.testHeadings();     // Test 1: Headings (H key)
    const linkResults = await this.testLinks();           // Test 2: Links (K key)
    const formResults = await this.testFormElements();    // Test 3: Forms (F key)
    const landmarkResults = await this.testLandmarks();   // Test 4: Landmarks (D key)
    const sequentialResults = await this.testSequentialNavigation(); // Test 5: Sequential (↓)
    const interactiveResults = await this.testInteractiveElements(); // Test 6: Buttons (B key)
    
    // 4. Aggregate all issues and interactions
    return {
        url,
        issues: [...headingResults.issues, ...linkResults.issues, ...],
        interactions: [...headingResults.interactions, ...],
        summary: { errors, warnings, info }
    };
}
```

**What Happens:**
1. **Browser loads your website** (`localhost:3000/quiz`)
2. **NVDA receives keyboard commands** from Guidepup:
   - `nvda.perform(nvda.keyboardCommands.moveToNextHeading)` → Presses **H** key
   - `nvda.perform(nvda.keyboardCommands.moveToNextLink)` → Presses **K** key
   - `nvda.perform(nvda.keyboardCommands.moveToNextFormField)` → Presses **F** key
   - etc.
3. **NVDA reads the page** and announces what it "sees"
4. **Guidepup captures the speech** using:
   - `await nvda.lastSpokenPhrase()` → Returns "heading level 2, Quiz"
   - `await nvda.itemText()` → Returns "Quiz"

---

#### **Phase 3: Validation (Who Checks? How?)**

**Answer: `AccessibilityTester.ts` does ALL the validation!**

Here's an example from **`testHeadings()`** (lines 216-320):

```typescript
private async testHeadings(): Promise<{ interactions, issues }> {
    const issues = [];
    
    // Navigate to first heading using NVDA's H key
    await nvda.perform(nvda.keyboardCommands.moveToNextHeading);
    
    while (headingCount < maxHeadings) {
        // CAPTURE what NVDA announced
        const announcement = await nvda.lastSpokenPhrase();
        // Example: "heading level 3, Quiz Questions"
        
        const itemText = await nvda.itemText();
        // Example: "Quiz Questions"
        
        // VALIDATION #1: Parse the heading level
        const levelMatch = announcement.match(/heading[,\s]+level\s+(\d+)/i);
        if (levelMatch) {
            const level = parseInt(levelMatch[1]); // e.g., 3
            
            // VALIDATION #2: First heading should be h1
            if (headingCount === 0 && level !== 1) {
                issues.push({
                    criterion: '1.3.2 Meaningful Sequence',
                    severity: 'warning',  // ← SEVERITY DETERMINED HERE
                    description: `First heading is h${level}, should be h1`,
                    nvdaAnnouncement: announcement,
                    element: itemText
                });
            }
            
            // VALIDATION #3: No skipped heading levels
            if (lastLevel > 0 && level - lastLevel > 1) {
                issues.push({
                    criterion: '1.3.2 Meaningful Sequence',
                    severity: 'warning',  // ← SEVERITY DETERMINED HERE
                    description: `Heading hierarchy skip from h${lastLevel} to h${level}`,
                    nvdaAnnouncement: announcement,
                    element: itemText
                });
            }
        }
        
        // VALIDATION #4: Heading must have text
        if (!itemText || itemText.trim().length === 0) {
            issues.push({
                criterion: '1.1.1 Non-text Content',
                severity: 'error',  // ← SEVERITY: ERROR (critical!)
                description: 'Heading is empty or has no accessible text',
                nvdaAnnouncement: announcement
            });
        }
        
        // Move to next heading
        await nvda.perform(nvda.keyboardCommands.moveToNextHeading);
    }
    
    return { interactions, issues };
}
```

---

### **How Severity is Determined**

**Hardcoded Rules in `accessibilityTester.ts`:**

| Severity | When It's Used | Example |
|----------|----------------|---------|
| **`error`** | Critical failures (WCAG Level A/AA violations) | Empty heading, button with no text, form field with no label, image with no alt |
| **`warning`** | Important issues but not blockers | Heading hierarchy skip (h1→h3), first heading not h1, link text is "click here" |
| **`info`** | Best practices or minor concerns | NVDA announcement unclear, potential improvement |

**Example from `testLinks()` (lines 322-420):**

```typescript
// ERROR severity - Link not properly announced
if (!announcement.toLowerCase().includes('link')) {
    issues.push({
        criterion: '4.1.2 Name, Role, Value',
        severity: 'error',  // ← CRITICAL: Element role broken
        description: 'Element not properly announced as link by NVDA',
        nvdaAnnouncement: announcement,
        element: itemText
    });
}

// WARNING severity - Non-descriptive link text
if (linkTextPatterns.some(pattern => pattern.test(itemText))) {
    issues.push({
        criterion: '2.4.4 Link Purpose',
        severity: 'warning',  // ← IMPORTANT but not critical
        description: 'Link text is not descriptive (e.g., "click here")',
        nvdaAnnouncement: announcement,
        element: itemText
    });
}
```

---

### **Why Guidepup is Powerful**

**Traditional Static Analysis (Old Way):**
```javascript
// Just checks HTML attributes
if (!element.alt) {
    issues.push({ error: 'Missing alt attribute' });
}
```

**Guidepup + NVDA (New Way):**
```javascript
// Actually HEARS what NVDA announces
await nvda.perform(nvda.keyboardCommands.moveToNextGraphic);
const announcement = await nvda.lastSpokenPhrase();

if (announcement.includes('unlabeled graphic')) {
    issues.push({ 
        error: 'Image has no alt text',
        nvdaAnnouncement: announcement  // ← Real user experience!
    });
}
```

**Result:** You see **exactly** what a blind user hears!

---

## 2. Who Validates & How?

### **Q: Who is checking the screen reader validation?**
**A: `AccessibilityTester.ts` is the validator.**

It's like a **QA tester** that:
1. Uses NVDA to navigate your page (keyboard commands)
2. Captures what NVDA announces (speech output)
3. Applies **hardcoded accessibility rules** (WCAG 2.1 Level AA)
4. Generates issues with severity levels

---

### **Q: Where are the WCAG rules defined?**
**A: Hardcoded in `AccessibilityTester.ts` across 6 test methods.**

| Method | NVDA Command | WCAG Criteria Checked |
|--------|--------------|------------------------|
| `testHeadings()` | H key (next heading) | 1.3.2 (Meaningful Sequence), 1.1.1 (Non-text Content) |
| `testLinks()` | K key (next link) | 2.4.4 (Link Purpose), 4.1.2 (Name, Role, Value) |
| `testFormElements()` | F key (next form field) | 3.3.2 (Labels or Instructions), 4.1.2 (Name, Role, Value) |
| `testLandmarks()` | D key (next landmark) | 3.2.3 (Consistent Navigation), 1.3.1 (Info and Relationships) |
| `testSequentialNavigation()` | ↓ (next line) | 1.1.1 (Non-text Content), reading order |
| `testInteractiveElements()` | B key (next button) | 4.1.2 (Name, Role, Value), 1.1.1 (Non-text Content) |

---

### **Q: Where does the UI get the "Critical, Warning, Info" labels?**
**A: From the `severity` field in each issue object.**

**Flow:**
```
AccessibilityTester.testHeadings()
  ↓ creates issue with severity: 'error'
TestResult.issues[]
  ↓ sent to TestingWebviewProvider
UI (webviews/testing.js)
  ↓ displays with ❌ (error), ⚠️ (warning), ℹ️ (info)
```

---

## 3. Where the Orchestrator Fits In

### **Q: When does the Orchestrator come into play?**
**A: ONLY when you click "Fix Accessibility Issues" button!**

---

### **The Flow**

#### **BEFORE Fix Button (No Orchestrator)**

```
User clicks "Start Test"
  ↓
TestingWebviewProvider.startTest()
  ↓
AccessibilityTester.initialize() → Starts NVDA + Browser
  ↓
AccessibilityTester.testUrl() → NVDA navigates, captures speech
  ↓
AccessibilityTester.testHeadings/Links/Forms/etc. → Validates and generates issues
  ↓
TestResult { issues[], interactions[], summary }
  ↓
UI displays results (❌ 5 errors, ⚠️ 3 warnings, ℹ️ 2 info)
```

**No AI, no orchestrator, just real NVDA testing!**

---

#### **AFTER Fix Button (Orchestrator Activates)**

```
User clicks "Fix Accessibility Issues"
  ↓
TestingWebviewProvider._handleFixIssues()
  ↓
1. Explore workspace → Find relevant files (Quiz.jsx, QuizPage.jsx, etc.)
  ↓
2. Build ultra-directive prompt:
   "🎯 URGENT FIX REQUIRED for /quiz route
    📁 TARGET FILES: src/Quiz.jsx, src/QuizPage.jsx
    🐛 ISSUES: 
       1. Heading hierarchy skip from h1 to h3
       2. Button has no accessible text
       3. Form field missing label
    ⚡ MANDATORY PLAN: Read file → Fix → Call attempt_completion"
  ↓
3. Start TestingAgentOrchestrator session
  ↓
TestingAgentOrchestrator.startSession(prompt)
  ↓
Agent Loop:
  Iteration 1: read_file(Quiz.jsx) → Sees code
  Iteration 1: write_file(Quiz.jsx) → Fixes:
    - Adds <h2> instead of <h3>
    - Adds aria-label to button
    - Adds <label> to form field
  Iteration 1: attempt_completion("Fixed 3 issues in Quiz.jsx")
  ↓
TestingWebviewProvider._waitForAgentCompletion()
  ↓ detects attempt_completion was called
  ↓
TestingWebviewProvider._extractCompletionDetails()
  ↓
UI shows success card:
  "✅ Fixed 3 issues
   📝 Modified: Quiz.jsx
   Summary: Added proper heading hierarchy, button labels, and form labels"
```

---

### **Key Insight: Two Separate Systems**

| Phase | System | Purpose | Tools Used |
|-------|--------|---------|------------|
| **Testing** | Guidepup + NVDA | Identify issues | NVDA keyboard commands, speech capture |
| **Fixing** | TestingAgentOrchestrator + LLM | Fix code | read_file, write_file, edit_file |

They're **connected** by the test results (issues list), but **operate independently**.

---

## 4. Testing Menu vs Chat Agent Mode

### **Key Differences**

| Aspect | Testing Menu ("Fix" Button) | Chat Agent Mode |
|--------|----------------------------|-----------------|
| **Trigger** | Click "Fix Accessibility Issues" button | Type in chat: "Fix accessibility issues" |
| **Input Source** | **Real NVDA test results** (actual screen reader announcements) | **Your text description** (or file analysis) |
| **Scope** | **Specific to tested URL/route** (e.g., `/quiz`) | **Broad** (entire repo or whatever you describe) |
| **Precision** | **High** - knows exact issues from NVDA | **Low** - guesses based on static analysis |
| **Prompt** | **Ultra-directive** with exact files, issues, and NVDA announcements | **Generic** - "analyze and fix accessibility" |
| **Files Targeted** | **Pre-discovered** based on route (/quiz → Quiz.jsx, QuizPage.jsx) | **Self-discovery** (agent explores entire repo) |
| **Orchestrator** | **TestingAgentOrchestrator** (isolated, null-safe) | **AgentLLMOrchestrator** (main chat agent) |
| **Context** | `testResult.issues[]` with NVDA data | Just your chat message |
| **Validation** | **Before & After** (run test again to verify) | **Only before** (hope it works) |

---

### **Example: Same Task, Different Approaches**

#### **Testing Menu Approach (Guided by NVDA)**

**User Action:** 
1. Tests `localhost:3000/quiz` 
2. NVDA finds: 
   - "Heading skip from h1 to h3"
   - "Button announced as 'button' (no text)"
   - "Form field has no label"
3. Clicks "Fix Accessibility Issues"

**Agent Receives:**
```
🎯 URGENT FIX REQUIRED for /quiz route
📁 TARGET FILES: src/Quiz.jsx, src/QuizPage.jsx
🐛 ACCESSIBILITY ISSUES (3 total):
1. 1.3.2 - Heading hierarchy skip from h1 to h3
   NVDA Announced: "heading level 3, Quiz Questions"
   
2. 4.1.2 - Button has no accessible text
   NVDA Announced: "button"
   Element: <button></button>
   
3. 3.3.2 - Form field missing label
   NVDA Announced: "edit, blank"
   Element: <input type="text">

⚡ MANDATORY PLAN:
1️⃣ Read Quiz.jsx
2️⃣ Fix: Add <h2>, add button text, add <label>
3️⃣ Call attempt_completion
```

**Result:** 
- ✅ **Precise fixes** (knows exact issues from NVDA)
- ✅ **Knows exact files** (route-based discovery)
- ✅ **Can verify** (run test again)

---

#### **Chat Agent Mode Approach (No NVDA Data)**

**User Types in Chat:**
```
"Analyze my repo and fix accessibility issues. Make sure it's screen reader compliant."
```

**Agent Receives:**
```
Task: "Analyze my repo and fix accessibility issues. Make sure it's screen reader compliant."
```

**What Agent Does:**
1. `list_directory` → Finds all files
2. `read_file(App.jsx)` → Reads file
3. `read_file(Quiz.jsx)` → Reads file
4. `read_file(QuizPage.jsx)` → Reads file
5. **Guesses** based on static analysis:
   - "Hmm, this button has no text, might be an issue"
   - "This form field has no label, probably needs one"
6. `write_file` → Makes changes
7. `attempt_completion` → "Fixed potential accessibility issues"

**Result:**
- ⚠️ **Generic fixes** (no real screen reader data)
- ⚠️ **Exploratory** (wastes time reading many files)
- ⚠️ **Can't verify** (no NVDA to test)
- ⚠️ **Might miss issues** NVDA would catch

---

### **Visual Comparison**

```
TESTING MENU (NVDA-Driven)
==========================
NVDA Tests Page
  ↓ [Actual announcements: "button", "edit blank", "heading level 3"]
Issues Generated with NVDA data
  ↓
Agent gets EXACT problems to fix
  ↓
Fixes 3 specific issues
  ↓
Run test again to verify ✅


CHAT AGENT (Text-Driven)
=========================
User types: "Fix accessibility"
  ↓ [No real screen reader data]
Agent explores entire repo
  ↓ [Static analysis: looks for missing alt, labels, etc.]
Agent GUESSES what might be wrong
  ↓
Fixes potential issues
  ↓
Hope it works 🤞 (no verification)
```

---

## 5. How They Benefit Each Other

### **Synergy: Testing Menu → Chat Agent**

1. **Testing Menu finds real issues** (with NVDA)
2. **User understands patterns** (oh, I always forget form labels!)
3. **User asks Chat Agent proactively:** "Check all forms in my repo for missing labels"
4. **Chat Agent fixes** based on learned patterns

---

### **Synergy: Chat Agent → Testing Menu**

1. **Chat Agent makes changes** (adds features, refactors)
2. **User worries:** "Did I break accessibility?"
3. **User runs Testing Menu** → NVDA verifies
4. **If issues found:** Click "Fix" to auto-correct

---

### **Complementary Workflow**

```
Development Cycle
=================

1. BUILD (Chat Agent Mode)
   User: "Add a new quiz feature with multiple choice questions"
   Agent: Builds feature (Quiz.jsx, QuizPage.jsx)
   
2. TEST (Testing Menu)
   User: Clicks "Start Test" on localhost:3000/quiz
   NVDA: Finds 5 accessibility issues
   
3. FIX (Testing Menu → Agent)
   User: Clicks "Fix Accessibility Issues"
   TestingAgentOrchestrator: Fixes 5 issues using NVDA data
   
4. VERIFY (Testing Menu)
   User: Clicks "Start Test" again
   NVDA: 0 issues found ✅
   
5. ITERATE (Chat Agent Mode)
   User: "Add a timer to the quiz"
   Agent: Adds timer feature
   
6. REPEAT (Testing Menu)
   User: Re-test to ensure timer is accessible
```

---

### **Why Testing Menu is Better for Accessibility**

| Aspect | Testing Menu | Chat Agent |
|--------|-------------|------------|
| **Accuracy** | ✅ Real NVDA announcements | ⚠️ Static analysis guesses |
| **Context** | ✅ Knows exact route/page | ⚠️ Repo-wide (vague) |
| **Verification** | ✅ Re-run test to confirm | ❌ Can't verify |
| **User Experience** | ✅ Sees what blind users hear | ❌ No UX data |
| **Targeted Fixes** | ✅ Precise (3 issues in Quiz.jsx) | ⚠️ Broad (entire repo) |

---

### **Why Chat Agent is Better for General Tasks**

| Aspect | Chat Agent | Testing Menu |
|--------|------------|--------------|
| **Flexibility** | ✅ Any coding task | ❌ Only accessibility fixes |
| **Proactive** | ✅ "Add feature", "refactor code" | ❌ Only reactive (after testing) |
| **Exploration** | ✅ Can discover issues across repo | ❌ Only tested page |
| **General Purpose** | ✅ Refactoring, features, bug fixes | ❌ Accessibility only |

---

## 6. Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER OPENS EXTENSION                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
        ┌───────▼─────────┐   ┌────────▼────────┐
        │  CHAT INTERFACE │   │ TESTING MENU    │
        │  (Agent Mode)   │   │ (NVDA Testing)  │
        └───────┬─────────┘   └────────┬────────┘
                │                      │
                │                      │
    ┌───────────▼──────────┐  ┌────────▼───────────────────┐
    │  AgentLLMOrchestrator│  │ AccessibilityTester        │
    │  (Main Chat Agent)   │  │ (NVDA + Guidepup)          │
    └───────────┬──────────┘  └────────┬───────────────────┘
                │                      │
                │                      │
    USER TYPES: "Fix                   USER CLICKS:
    accessibility"                     "Start Test"
                │                      │
                ▼                      ▼
    ┌─────────────────────────┐   ┌──────────────────────┐
    │ Generic Task            │   │ 1. Start NVDA        │
    │ - List all files        │   │ 2. Launch Browser    │
    │ - Read files            │   │ 3. Navigate to URL   │
    │ - Guess issues          │   └──────────┬───────────┘
    │ - Make changes          │              │
    │ - Hope it works         │              ▼
    └─────────────────────────┘   ┌──────────────────────┐
                                  │ NVDA Testing         │
                                  │ - Press H (headings) │
                                  │ - Press K (links)    │
                                  │ - Press F (forms)    │
                                  │ - Capture speech     │
                                  └──────────┬───────────┘
                                             │
                                             ▼
                                  ┌──────────────────────────────┐
                                  │ Validation & Issue Generation│
                                  │ - Check heading hierarchy    │
                                  │ - Check button text          │
                                  │ - Check form labels          │
                                  │ - Assign severity            │
                                  └──────────┬───────────────────┘
                                             │
                                             ▼
                                  ┌──────────────────────────────┐
                                  │ TestResult                   │
                                  │ { issues: [                  │
                                  │    { criterion: "1.3.2",     │
                                  │      severity: "warning",    │
                                  │      description: "...",     │
                                  │      nvdaAnnouncement: "..." │
                                  │    }                         │
                                  │  ],                          │
                                  │  interactions: [...],        │
                                  │  summary: {...}              │
                                  │ }                            │
                                  └──────────┬───────────────────┘
                                             │
                                             ▼
                                  ┌──────────────────────────────┐
                                  │ UI Displays Results          │
                                  │ ❌ 5 Errors                  │
                                  │ ⚠️ 3 Warnings                │
                                  │ ℹ️ 2 Info                    │
                                  │ [Fix Accessibility Issues]   │
                                  └──────────┬───────────────────┘
                                             │
                              USER CLICKS "FIX" BUTTON
                                             │
                                             ▼
                                  ┌──────────────────────────────┐
                                  │ TestingWebviewProvider       │
                                  │ 1. Explore workspace         │
                                  │    (find Quiz.jsx, etc.)     │
                                  │ 2. Build ultra-directive     │
                                  │    prompt with NVDA data     │
                                  │ 3. Start orchestrator        │
                                  └──────────┬───────────────────┘
                                             │
                                             ▼
                                  ┌──────────────────────────────┐
                                  │ TestingAgentOrchestrator     │
                                  │ (Separate from chat agent)   │
                                  └──────────┬───────────────────┘
                                             │
                                             ▼
                                  ┌──────────────────────────────┐
                                  │ Agent Loop (LLM)             │
                                  │ Iteration 1:                 │
                                  │   - read_file(Quiz.jsx)      │
                                  │   - write_file(Quiz.jsx)     │
                                  │     [fixes: h2, labels, etc.]│
                                  │   - attempt_completion(...)  │
                                  │     [exits immediately]       │
                                  └──────────┬───────────────────┘
                                             │
                                             ▼
                                  ┌──────────────────────────────┐
                                  │ Completion Detection         │
                                  │ - Polls session status       │
                                  │ - Detects attempt_completion │
                                  │ - Extracts summary & files   │
                                  └──────────┬───────────────────┘
                                             │
                                             ▼
                                  ┌──────────────────────────────┐
                                  │ UI Shows Success Card        │
                                  │ ✅ Fixed 3 issues            │
                                  │ 📝 Modified: Quiz.jsx        │
                                  │ Summary: Added h2, labels... │
                                  └──────────────────────────────┘
```

---

## 📚 **Summary**

### **How Guidepup Enables Testing**
1. **Guidepup** is the bridge between your code and NVDA
2. It sends **keyboard commands** to NVDA (`H`, `K`, `F`, `D`, `B`, `↓`)
3. It **captures NVDA's speech** output (what a blind user hears)
4. **`AccessibilityTester.ts`** uses this data to validate against **WCAG rules**

### **Who Does Validation**
- **`AccessibilityTester.ts`** is the validator
- It has **6 test methods** (headings, links, forms, landmarks, sequential, interactive)
- Each method has **hardcoded WCAG rules** that determine severity (error/warning/info)

### **Where Orchestrator Fits**
- **ONLY activates when you click "Fix Accessibility Issues"**
- Uses **TestingAgentOrchestrator** (separate from chat agent)
- Receives **ultra-directive prompt** with exact issues from NVDA
- Fixes code using **read_file**, **write_file**, **attempt_completion**

### **Testing Menu vs Chat Agent**
- **Testing Menu**: Precise, NVDA-driven, route-specific, verifiable
- **Chat Agent**: Flexible, text-driven, repo-wide, exploratory

### **How They Benefit Each Other**
- **Testing Menu** finds real issues → **Chat Agent** learns patterns
- **Chat Agent** builds features → **Testing Menu** verifies accessibility
- **Complementary workflow**: Build → Test → Fix → Verify → Iterate

---

**🎉 The power is in the combination: Real screen reader testing (NVDA) + AI-powered fixing (LLM orchestrator)!**

