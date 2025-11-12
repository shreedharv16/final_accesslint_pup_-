# 🐛 Browser Not Opening - Troubleshooting Guide

## 🔴 **Problem**

When you click "Start Test" in the Testing Menu:
- ✅ NVDA starts (you see NVDA Speech Viewer)
- ❌ Browser (Chromium) does NOT open
- ❌ No accessibility testing happens
- ❌ Error in logs or UI

---

## 🔍 **Root Cause**

**Playwright browsers are not installed!**

Playwright needs to download browser binaries (Chromium, Firefox, WebKit) before it can launch them. This is a one-time setup.

---

## ✅ **Solution 1: Install Chromium Only (Fastest)**

Run this command in your terminal (in the extension directory):

```bash
npx playwright install chromium
```

**What this does:**
- Downloads Chromium browser (~150MB)
- Takes 1-2 minutes depending on internet speed
- Only installs what you need for AccessLint testing

---

## ✅ **Solution 2: Install All Browsers (Recommended)**

Run this command if you want all Playwright browsers:

```bash
npx playwright install
```

**What this does:**
- Downloads Chromium, Firefox, and WebKit (~450MB total)
- Takes 3-5 minutes
- Useful if you want to test on multiple browsers later

---

## 🧪 **Test if It Works**

After installing, try this:

### **Step 1: Check logs**

Open **Output Panel** → Select **"AccessLint Testing"**

You should see:
```
🚀 Initializing NVDA screen reader...
📢 Starting NVDA...
✅ NVDA started successfully
🌐 Launching Chromium browser...
   This may take a moment on first launch...
✅ Browser launched successfully
   Browser visible: You should see a Chromium window
```

### **Step 2: Visual confirmation**

You should see **two windows**:
1. ✅ **NVDA Speech Viewer** (small window with NVDA text)
2. ✅ **Chromium Browser** (large window that opens your localhost URL)

---

## 🔧 **Improved Error Messages**

I've updated the code to show clearer error messages. If Playwright is not installed, you'll now see:

```
❌ Failed to launch browser: ...
❌ PLAYWRIGHT BROWSERS NOT INSTALLED!

🔧 To fix, run this command in your terminal:
   npx playwright install chromium

   OR install all browsers:
   npx playwright install
```

---

## 🚨 **Other Possible Issues**

### **Issue 1: NVDA Not Starting**

**Symptom:**
```
❌ Failed to start NVDA: ...
```

**Solution:**
```bash
npx @guidepup/setup
```

---

### **Issue 2: Port Already in Use**

**Symptom:**
- Browser opens but shows "Connection refused"
- Your localhost URL is not running

**Solution:**
- Make sure your dev server is running:
  ```bash
  npm start
  # or
  npm run dev
  ```
- Verify the port matches (e.g., localhost:3000, localhost:5173, etc.)

---

### **Issue 3: Permission Errors**

**Symptom:**
```
❌ Failed to launch browser: Permission denied
```

**Solution (Windows):**
- Run VSCode as Administrator
- Or add `--no-sandbox` flag (already added in updated code)

---

### **Issue 4: Timeout Error**

**Symptom:**
```
❌ Failed to launch browser: Timeout
```

**Solution:**
- Close any existing Chromium windows
- Restart VSCode
- Try again

---

## 📊 **Full Test Flow (What Should Happen)**

```
User clicks "Start Test"
  ↓
1. ✅ NVDA starts (NVDA Speech Viewer appears)
  ↓
2. ✅ Chromium browser launches (new window opens)
  ↓
3. ✅ Browser navigates to your URL (localhost:3000)
  ↓
4. ✅ NVDA navigates page with keyboard (H, K, F, D, B, ↓)
  ↓
5. ✅ Issues captured (headings, links, forms, etc.)
  ↓
6. ✅ AI validation runs (if enabled)
  ↓
7. ✅ Results displayed in UI
  ↓
8. ✅ Browser closes automatically
  ↓
9. ✅ NVDA stops
```

**If browser doesn't open at step 2, Playwright is not installed!**

---

## 🎯 **Quick Fix Command**

**Copy and paste this into your terminal:**

```bash
# Navigate to extension directory
cd C:\Users\2247463\Documents\accesslint_pup-main

# Install Chromium browser
npx playwright install chromium

# Compile the updated code
npm run compile

# Now test in VSCode (press F5)
```

---

## ✅ **After Running the Fix**

1. **Close** the Extension Development Host (if open)
2. **Recompile** the extension:
   ```bash
   npm run compile
   ```
3. **Press F5** in VSCode to launch extension
4. **Try testing again** → Browser should open now!

---

## 📝 **What Was Changed in the Code**

**File:** `src/accessibilityTester.ts`

### **Improved Error Handling:**

```typescript
// Before: Silent failure
this.browser = await chromium.launch({ headless: false });

// After: Detailed error messages
try {
    this.browser = await chromium.launch({ 
        headless: false,
        timeout: 60000,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    if (!this.browser) {
        throw new Error('Browser failed to launch');
    }
    
    this.outputChannel.appendLine('✅ Browser launched successfully');
    this.outputChannel.appendLine('   Browser visible: You should see a Chromium window');
} catch (browserError: any) {
    this.outputChannel.appendLine(`❌ Failed to launch browser: ${browserError}`);
    
    if (browserError.message.includes('Executable doesn\'t exist')) {
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine('❌ PLAYWRIGHT BROWSERS NOT INSTALLED!');
        this.outputChannel.appendLine('🔧 To fix: npx playwright install chromium');
    }
    
    throw browserError;
}
```

---

## 🎉 **Summary**

| Problem | Solution | Time |
|---------|----------|------|
| Browser not opening | `npx playwright install chromium` | 1-2 min |
| NVDA not starting | `npx @guidepup/setup` | 30 sec |
| Dev server not running | `npm start` or `npm run dev` | Instant |

---

**Most likely fix:** Run `npx playwright install chromium` in your terminal! 🚀

