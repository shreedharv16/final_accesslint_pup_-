# NVDA Screen Reader Testing Setup Guide

## 🎯 Overview

Your AccessLint extension now uses **real NVDA screen reader automation** to test how screen readers actually interact with your website. This is a major upgrade from static analysis - you'll see exactly what NVDA announces to users!

---

## 🖥️ **Requirements**

### Platform
- **Windows OS Required**: NVDA automation only works on Windows
- Windows 10 or Windows 11 recommended
- Administrator privileges needed for initial setup

### Software
- NVDA screen reader (will be automated)
- Node.js and npm (already installed)
- VSCode (already have it)

---

## 🚀 **Setup Instructions**

### Step 1: Run Guidepup Setup

This configures NVDA for automation on your system:

```bash
npx @guidepup/setup
```

**What this does:**
- Configures NVDA for API access
- Sets up necessary permissions
- Enables automation capabilities

**Follow the prompts carefully!**

### Step 2: Grant Permissions

During setup, you may need to:
1. Allow NVDA to be controlled by other applications
2. Grant administrator access
3. Restart NVDA

**Important Security Note:**
> Granting automation access to NVDA allows programs to control it. Only do this on development machines, not production systems. Check with your security team if on a company computer.

### Step 3: Test NVDA is Working

Run a simple test:

```bash
npm run compile
# Then press F5 in VSCode to launch extension
```

---

## 🧪 **How It Works**

### What Happens When You Test

1. **NVDA Launches**: Real NVDA process starts (silently)
2. **Browser Opens**: Playwright opens Chromium
3. **Page Loads**: Your website loads in the browser
4. **NVDA Navigates**: NVDA navigates through your page using keyboard commands
5. **Speech Captured**: NVDA's announcements are captured programmatically
6. **Results Generated**: You see what NVDA actually announces

### NVDA Navigation Methods Used

The extension tests using these NVDA keyboard commands:

| Command | What It Does |
|---------|-------------|
| **H** | Navigate to next heading |
| **K** | Navigate to next link |
| **F** | Navigate to next form field |
| **D** | Navigate to next landmark |
| **B** | Navigate to next button |
| **Down Arrow** | Read next item sequentially |

### What Gets Captured

For each interaction, you'll see:
- **Action**: What NVDA command was used
- **Announcement**: What NVDA actually said
- **Element**: The text content
- **Timestamp**: When it happened

---

## 📊 **Understanding Test Results**

### NVDA Announcements

Each issue now shows **what NVDA actually announced**:

```
❌ 1.1.1 Non-text Content
Image has no alt text - NVDA announces it as unlabeled
📢 NVDA Announced: "unlabeled graphic"
Element: [no text content]
```

vs. with good alt text:

```
ℹ️ 1.1.1 Non-text Content  
Image properly labeled
📢 NVDA Announced: "Company logo, graphic"
Element: Company logo
```

### Types of Issues Detected

#### Errors (Must Fix)
- **Empty alt text**: "unlabeled graphic"
- **Unlabeled forms**: "edit, blank"
- **Missing button text**: "button"
- **No landmarks**: Can't navigate by structure

#### Warnings (Should Fix)
- **Heading skips**: h1 → h3 (skip h2)
- **Poor link text**: "click here link"
- **Unclear roles**: "clickable" without button/link role

#### Info (Good to Know)
- **Landmarks found**: "main landmark"
- **Required fields**: Announced correctly
- **Help text**: Associated with inputs

---

## 🎯 **Testing Your Website**

### Basic Workflow

1. **Start your development server**
   ```bash
   npm start  # or whatever starts your app
   ```

2. **Open AccessLint Testing Panel**
   - Press F5 in VSCode
   - Click AccessLint icon in sidebar
   - Open "Accessibility Testing" panel

3. **Enter your URL**
   ```
   localhost:3000
   ```

4. **Watch NVDA Test**
   - Browser opens (don't close it!)
   - NVDA navigates automatically
   - Progress updates in real-time

5. **Review Results**
   - See what NVDA announced
   - Understand where issues are
   - Fix problems in your code
   - Re-test to verify

---

## 🔍 **What Each Test Does**

### Heading Navigation Test
- Navigates through all headings (H key)
- Checks hierarchy (h1 → h2 → h3, no skips)
- Validates heading text is meaningful
- Reports what NVDA announces for each

**NVDA announces**: "Heading level 1, Welcome to our site"

### Link Navigation Test
- Navigates through all links (K key)
- Checks link purpose is clear
- Validates link has accessible text
- Detects "click here" and other poor patterns

**NVDA announces**: "link, Read our blog" ✅  
**NVDA announces**: "link, click here" ❌

### Form Testing
- Navigates through form fields (F key)
- Checks all inputs have labels
- Validates field types announced correctly
- Detects required fields

**NVDA announces**: "Email address, edit, blank" ✅  
**NVDA announces**: "edit, blank" ❌ (no label)

### Landmark Testing
- Navigates by landmarks (D key)
- Checks for main, nav, header, footer
- Validates semantic structure
- Reports if no landmarks found

**NVDA announces**: "main landmark"

### Sequential Navigation
- Reads page top to bottom (Down arrow)
- Checks natural reading order
- Validates images have alt text
- Tests overall flow

### Interactive Elements
- Finds all buttons (B key)
- Validates button text
- Checks button roles
- Tests activation

---

## ⚠️ **Troubleshooting**

### NVDA Won't Start

**Error**: "NVDA failed to start"

**Solutions**:
1. Run `npx @guidepup/setup` again
2. Make sure NVDA is not already running
3. Restart computer
4. Check NVDA is installed correctly

### Browser Opens But Nothing Happens

**Problem**: Browser opens, page loads, but no testing occurs

**Solutions**:
1. Make sure NVDA setup completed successfully
2. Check Output panel for error messages
3. Try closing all NVDA instances and retry
4. Ensure browser can be automated (not already controlled)

### "Platform not supported" Error

**Problem**: Extension says NVDA not available

**Solution**:
- NVDA only works on Windows
- If on macOS, VoiceOver support would need separate implementation
- If on Linux, only static analysis available currently

### Tests Run But No Issues Found

**Problem**: Test completes with 0 issues on clearly problematic site

**Solutions**:
1. Check Output panel - NVDA may not have started
2. Verify page actually loaded (check browser)
3. Try a different URL to verify tool works
4. Check NVDA logs in results

### Too Many Interactions, Slow Testing

**Problem**: Testing takes a long time

**Why**: Real screen reader testing is slower than static analysis

**Tips**:
- Test specific pages, not entire sites
- Focus on critical user journeys
- Use for final validation, not every change
- Consider static analysis for quick checks

---

## 💡 **Best Practices**

### When to Use NVDA Testing

✅ **Use NVDA testing for:**
- Final validation before deployment
- Testing complex interactions
- Validating ARIA implementations
- Understanding real user experience
- Catching issues static analysis misses

❌ **Don't use NVDA testing for:**
- Every code change (too slow)
- CI/CD pipeline (not reliable enough yet)
- Non-Windows environments
- Quick syntax checks

### Testing Strategy

1. **During Development**: Static analysis (fast feedback)
2. **Before PR**: NVDA test critical flows
3. **Before Release**: Full NVDA test suite
4. **After Deployment**: Verify in staging

### Reading NVDA Results

Focus on:
1. **Errors first**: Block users completely
2. **Frequent warnings**: Apply systematically
3. **Info items**: Learn about good practices
4. **Interactions log**: Understand navigation flow

---

## 📚 **NVDA Commands Reference**

### Navigation Commands (What Extension Uses)

| Key | Command | Purpose |
|-----|---------|---------|
| **H** | Next heading | Find all headings |
| **Shift+H** | Previous heading | Go back |
| **K** | Next link | Find all links |
| **F** | Next form field | Find inputs |
| **B** | Next button | Find buttons |
| **D** | Next landmark | Find regions |
| **Down** | Next item | Sequential read |
| **Up** | Previous item | Go back |

### What NVDA Announces

**Headings**: "heading level 1, Page Title"  
**Links**: "link, About Us"  
**Buttons**: "button, Submit"  
**Inputs**: "Email, edit, blank"  
**Images**: "Company logo, graphic"  
**Landmarks**: "main landmark"

---

## 🔐 **Security Considerations**

### Permissions Required

NVDA automation requires:
- API access to NVDA
- Ability to send keyboard commands
- Read NVDA speech output

### Safe Practices

✅ **DO**:
- Set up on development machines only
- Review what `npx @guidepup/setup` does
- Keep NVDA updated
- Use on local networks only

❌ **DON'T**:
- Enable on production servers
- Share machines with automation enabled
- Use on shared company computers without approval
- Grant unnecessary permissions

### Corporate Environments

If using on a company computer:
1. Check with IT/Security team first
2. Document what permissions are needed
3. Only use on approved development machines
4. Disable automation when not testing

---

## 🎓 **Learning Resources**

### NVDA Documentation
- [NVDA User Guide](https://www.nvaccess.org/files/nvda/documentation/userGuide.html)
- [NVDA Keyboard Commands](https://dequeuniversity.com/screenreaders/nvda-keyboard-shortcuts)

### Guidepup Documentation
- [Guidepup Docs](https://www.guidepup.dev/)
- [NVDA API Reference](https://www.guidepup.dev/docs/api/class-nvda)

### Accessibility Standards
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Screen Reader Testing Guide](https://webaim.org/articles/screenreader_testing/)

---

## 🆘 **Getting Help**

### Check These First

1. **Output Panel**: View → Output → "AccessLint Testing"
2. **Error Messages**: Read what the extension says
3. **This Guide**: Search for your issue above
4. **Guidepup Docs**: Check official documentation

### Common Questions

**Q: Can I use VoiceOver instead (macOS)?**  
A: Not yet - currently Windows/NVDA only. VoiceOver support could be added.

**Q: Does NVDA make sound during testing?**  
A: No - speech is captured programmatically, not vocalized.

**Q: How long does a test take?**  
A: 1-3 minutes typically, depending on page complexity.

**Q: Can I test authenticated pages?**  
A: Yes, but you'll need to modify the code to handle login.

---

## ✅ **Verification Checklist**

Before running your first test:

- [ ] Windows OS (10 or 11)
- [ ] NVDA installed
- [ ] Ran `npx @guidepup/setup`
- [ ] Granted necessary permissions
- [ ] Compiled extension (`npm run compile`)
- [ ] Pressed F5 to launch extension
- [ ] Testing panel visible in AccessLint sidebar
- [ ] Development server running (for localhost testing)

**If all checked, you're ready to test!** 🎉

---

## 🎯 **Quick Start Reminder**

```bash
# 1. Setup NVDA automation
npx @guidepup/setup

# 2. Compile extension
npm run compile

# 3. Launch extension (in VSCode)
Press F5

# 4. Start your website
npm start  # or your command

# 5. Test!
AccessLint icon → Accessibility Testing → Enter URL → Start Test
```

---

**Now go make your websites accessible!** 🌟

*Last Updated: 2025*  
*AccessLint v0.2.0 - Real NVDA Automation*
