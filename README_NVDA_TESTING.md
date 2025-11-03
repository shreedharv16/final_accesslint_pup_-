# 📢 AccessLint - Real NVDA Screen Reader Testing

## 🎯 **What This Does**

Your VSCode extension now **launches real NVDA screen reader** and tests your website by actually navigating it with keyboard commands, capturing what NVDA announces to users.

**This is not static analysis.** This is **real screen reader automation.**

---

## ⚡ **Quick Start**

```bash
# 1. Setup NVDA automation (one-time, Windows only)
npx @guidepup/setup

# 2. Compile the extension
npm run compile

# 3. Launch (in VSCode)
Press F5

# 4. Test your website
# - Click AccessLint icon (sidebar)
# - Open "Accessibility Testing"
# - Enter "localhost:3000"
# - Click "Start Test"
# - Watch NVDA test automatically!
```

---

## 🎬 **What Happens**

1. **NVDA Launches** (Windows screen reader, runs silently)
2. **Browser Opens** (Chromium via Playwright)
3. **Page Loads** (your website)
4. **NVDA Navigates** using keyboard:
   - **H** = Navigate headings
   - **K** = Navigate links  
   - **F** = Navigate forms
   - **D** = Navigate landmarks
   - **B** = Navigate buttons
   - **↓** = Read sequentially

5. **Speech Captured** (what NVDA announces)
6. **Issues Reported** with real announcements!

---

## 📊 **Real Output Examples**

### Before (Static Analysis)
```
❌ Image missing alt attribute
```

### Now (Real NVDA)
```
❌ Image has no alt text - NVDA announces it as unlabeled
📢 NVDA Announced: "unlabeled graphic"
Element: [no accessible text]
Criterion: 1.1.1 Non-text Content
```

**You see exactly what screen reader users experience!**

---

## 🎯 **Test Coverage**

| Test | NVDA Key | What It Checks |
|------|----------|----------------|
| **Headings** | H | Hierarchy (h1→h2→h3), meaningful text |
| **Links** | K | Clear purpose, not "click here" |
| **Forms** | F | Labels, field types, required markers |
| **Landmarks** | D | main, nav, header, footer |
| **Sequential** | ↓ | Reading order, alt text, flow |
| **Buttons** | B | Button text, roles, accessibility |

---

## 📁 **Key Files**

### Core Implementation
- `src/accessibilityTester.ts` (825 lines) - Real NVDA automation
- `src/testingWebviewProvider.ts` - VSCode integration
- `webviews/testing.js` - UI with NVDA announcements
- `webviews/testing.css` - Styled results

### Documentation
- **`NVDA_UPGRADE_SUMMARY.md`** ← **START HERE** for what changed
- **`NVDA_SETUP_GUIDE.md`** - Complete setup & troubleshooting
- **`TESTING_QUICKSTART.md`** - Quick start guide
- **`SETUP_COMPLETE.md`** - Verification & examples

---

## ⚠️ **Requirements**

### Platform
**Windows Only** - NVDA is Windows-specific screen reader

### Setup
```bash
npx @guidepup/setup
```

Must run this once to enable NVDA automation.

### Dependencies
- `@guidepup/guidepup` v0.24.0 ✅ Installed
- `playwright` v1.56.0 ✅ Installed

---

## 💡 **Understanding Results**

### Three Severity Levels

#### ❌ **Errors** (Must Fix)
Blocks users from accessing content:
- Images with no alt text → "unlabeled graphic"
- Forms with no labels → "edit, blank"
- Buttons with no text → "button"

#### ⚠️ **Warnings** (Should Fix)
Causes difficulty for users:
- Heading skips (h1 → h3)
- Poor link text ("click here")
- Missing landmarks

#### ℹ️ **Info** (Good to Know)
Suggestions and observations:
- Landmarks found
- Good practices detected
- Required fields marked correctly

---

## 🧪 **Real Testing Example**

### Test a Contact Form

```html
<!-- Your HTML -->
<form>
  <input type="text" />
  <button>→</button>
</form>
```

### NVDA Test Results

```
❌ Error: Form field has no accessible label
📢 NVDA Announced: "edit, blank"
Criterion: 3.3.2 Labels or Instructions

❌ Error: Button has no accessible text
📢 NVDA Announced: "button"
Criterion: 4.1.2 Name, Role, Value
```

### Fix It

```html
<form>
  <label for="email">Email address</label>
  <input type="text" id="email" />
  <button>Subscribe</button>
</form>
```

### Re-test Results

```
✅ Form field properly labeled
📢 NVDA Announced: "Email address, edit, blank"

✅ Button has clear purpose
📢 NVDA Announced: "Subscribe, button"
```

---

## 🎓 **Key Concepts**

### Real vs. Static Analysis

| Static Analysis | Real NVDA Testing |
|----------------|-------------------|
| Checks attributes exist | Tests what users hear |
| Fast but limited | Slower but comprehensive |
| Finds syntax errors | Finds UX problems |
| "Has alt attribute?" | "What does NVDA say?" |

### What Makes This Different

**Other tools check IF things exist.**  
**This tool checks WHAT screen readers announce.**

**Example:**
```html
<button aria-label="Submit">
  <span class="sr-only">Send</span>
</button>
```

**Static check:** ✅ Has aria-label  
**NVDA test:** 📢 "Submit, button"

If `sr-only` class isn't working, NVDA might say "button" with no text. **You'll catch this!**

---

## 🔧 **Technical Details**

### NVDA API Usage

```typescript
// Start NVDA
await nvda.start();

// Navigate
await nvda.perform(nvda.keyboardCommands.moveToNextHeading);
await nvda.perform(nvda.keyboardCommands.moveToNextLink);
await nvda.next();  // Down arrow

// Capture speech
const announcement = await nvda.lastSpokenPhrase();
const itemText = await nvda.itemText();
const fullLog = await nvda.spokenPhraseLog();

// Stop NVDA
await nvda.stop();
```

### Result Structure

```typescript
interface TestResult {
    url: string;
    timestamp: Date;
    issues: AccessibilityIssue[];
    interactions: NVDAInteraction[];  // NEW!
    nvdaLog: string[];                // NEW!
    summary: {
        errors: number;
        warnings: number;
        info: number;
        totalInteractions: number;     // NEW!
    };
}

interface AccessibilityIssue {
    criterion: string;
    severity: 'error' | 'warning' | 'info';
    description: string;
    nvdaAnnouncement?: string;         // NEW!
    expectedAnnouncement?: string;     // NEW!
    element?: string;
}
```

---

## 📚 **Documentation Guide**

### Which Doc to Read?

1. **First time?** → `NVDA_UPGRADE_SUMMARY.md`
2. **Need setup help?** → `NVDA_SETUP_GUIDE.md`
3. **Quick reference?** → `TESTING_QUICKSTART.md`
4. **Want examples?** → `SETUP_COMPLETE.md`
5. **Overview?** → This file!

---

## 🐛 **Quick Troubleshooting**

| Problem | Solution |
|---------|----------|
| "NVDA failed to start" | Run `npx @guidepup/setup` |
| "Platform not supported" | Windows only (NVDA) |
| Browser opens, nothing happens | Check Output panel for errors |
| Tests are slow | Normal - real testing takes time |
| No interactions | NVDA didn't start - check logs |

**Full troubleshooting:** See `NVDA_SETUP_GUIDE.md`

---

## 🎯 **Best Practices**

### When to Use This

✅ **Good for:**
- Final validation before release
- Testing complex interactions
- Understanding user experience
- Catching ARIA problems
- Learning how screen readers work

❌ **Not ideal for:**
- Every code change (too slow)
- CI/CD pipelines (not stable enough)
- Quick syntax checks (use linters)
- Non-Windows environments

### Testing Strategy

1. **During dev:** Quick linters (fast feedback)
2. **Before PR:** NVDA test critical flows
3. **Before release:** Full NVDA test
4. **After issues:** Re-test to verify fixes

---

## 🌟 **Why This is Amazing**

### Traditional Testing
```
✅ Alt attribute exists
✅ Label attribute exists  
✅ ARIA valid

Deploy → Users complain → Fix → Repeat
```

### With Real NVDA Testing
```
📢 NVDA says: "unlabeled graphic"
📢 NVDA says: "button" (no text!)
📢 NVDA says: "edit, blank" (no label!)

Fix before deploy → Users happy → Win! 🎉
```

---

## 🚀 **Get Started Now**

```bash
# Windows? Let's go!
npx @guidepup/setup
npm run compile
# Press F5 in VSCode
# Test your site!

# macOS/Linux? 
# Sorry, NVDA is Windows-only
# (VoiceOver support could be added later)
```

---

## 📖 **Learn More**

### Resources
- [Guidepup Documentation](https://www.guidepup.dev/)
- [NVDA User Guide](https://www.nvaccess.org/files/nvda/documentation/userGuide.html)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

### Article That Inspired This
- [Automating Screen Readers for Accessibility Testing](https://assistivlabs.com/articles/automating-screen-readers-for-accessibility-testing)

---

## ✅ **Ready to Test?**

```bash
npx @guidepup/setup  # Setup NVDA
npm run compile      # Build extension
# Press F5            # Launch
# Test!              # Make web accessible!
```

---

**You're not just checking code anymore.**  
**You're testing with real screen readers.**  
**You're seeing what users actually experience.**

**That's powerful.** 🎉

---

*AccessLint v0.2.0*  
*Real NVDA Screen Reader Automation*  
*Windows | Guidepup | Playwright*

**Make the web accessible for everyone!** 🌟
