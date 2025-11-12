# 🐛 NVDA Start Hanging - Diagnostic & Fix

## 🔴 **Problem**

When you click "Start Test", the logs show:
```
🚀 Initializing NVDA screen reader...
📢 Starting NVDA...
```

Then it **hangs** and never continues. No error message, no browser, nothing.

---

## 🔍 **Root Cause**

`await nvda.start()` is **hanging indefinitely** because:

1. ❌ **Guidepup not configured** - Run `npx @guidepup/setup`
2. ❌ **NVDA already running** - Close NVDA and try again
3. ❌ **NVDA not installed** - Guidepup will download it
4. ❌ **Permission issues** - NVDA needs API access enabled

---

## ✅ **Solution 1: Run Guidepup Setup (Most Likely Fix)**

### **Step 1: Run setup command**

```bash
npx @guidepup/setup
```

**What this does:**
- Downloads NVDA (if not installed)
- Configures NVDA for API access
- Sets up permissions
- Enables automation

**Follow the prompts carefully!**

### **Step 2: Recompile**

```bash
npm run compile
```

### **Step 3: Test again**

Press **F5** and try "Start Test" again.

---

## ✅ **Solution 2: Close Existing NVDA**

If NVDA is already running, it might prevent guidepup from starting a new instance.

### **Check if NVDA is running:**

1. Press **Ctrl + Shift + Esc** (Task Manager)
2. Look for **nvda.exe** in processes
3. If found, **End Task**
4. Try testing again

**OR** run this in terminal:

```bash
tasklist | findstr nvda.exe
```

If you see output, NVDA is running. Kill it:

```bash
taskkill /F /IM nvda.exe
```

---

## ✅ **Solution 3: Check NVDA Installation**

### **Verify NVDA is installed:**

```bash
where nvda
```

**If it returns a path:** ✅ NVDA is installed

**If it says "INFO: Could not find..."**: ❌ NVDA not found

**Fix:** Run `npx @guidepup/setup` to install it.

---

## 🔧 **Improved Code (Already Applied)**

I've updated the code to:

### **1. Add Timeout (30 seconds)**

Before:
```typescript
await nvda.start(); // Hangs forever if it fails
```

After:
```typescript
const nvdaStartPromise = nvda.start();
const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('NVDA start timeout after 30 seconds')), 30000);
});

await Promise.race([nvdaStartPromise, timeoutPromise]);
```

### **2. Add Diagnostics**

Now shows:
```
🚀 Initializing NVDA screen reader...
   Platform: win32
   Node version: v18.20.5
   ✓ NVDA not currently running
📢 Starting NVDA...
   This may take 10-15 seconds...
```

### **3. Better Error Messages**

If it fails:
```
❌ Failed to start NVDA: Error message

🔧 TROUBLESHOOTING:
   1. Have you run: npx @guidepup/setup
   2. Is NVDA already running? (Close it and try again)
   3. Is this Windows 10/11? (NVDA only works on Windows)
   4. Check if NVDA.exe is in your PATH
```

---

## 🧪 **Testing the Fix**

### **Step 1: Compile**

```bash
npm run compile
```

### **Step 2: Launch extension**

Press **F5** in VSCode

### **Step 3: Check logs**

Open **Output** → Select **"AccessLint Testing"**

**You should see NEW diagnostics:**
```
🚀 Initializing NVDA screen reader...
   Platform: win32
   Node version: v18.20.5
   ✓ NVDA not currently running
📢 Starting NVDA...
   This may take 10-15 seconds...
```

**If it hangs for 30 seconds, you'll see:**
```
❌ Failed to start NVDA: NVDA start timeout after 30 seconds

🔧 TROUBLESHOOTING:
   1. Have you run: npx @guidepup/setup
   ...
```

---

## 📊 **Expected Timeline**

```
Start Test
  ↓ (2-3 seconds) - Diagnostics
Platform check, NVDA running check
  ↓ (10-15 seconds) - NVDA starting
NVDA.exe launches (you might see NVDA window briefly)
  ↓ (1-2 seconds) - Browser launching
✅ Chromium opens
  ↓
Testing begins
```

**If it hangs at "Starting NVDA..." for more than 30 seconds:**
→ Timeout triggers
→ Error message shown
→ **Run:** `npx @guidepup/setup`

---

## 🎯 **Quick Fix Commands (Run These)**

```bash
# 1. Setup guidepup (MOST IMPORTANT)
npx @guidepup/setup

# 2. Kill any existing NVDA
taskkill /F /IM nvda.exe

# 3. Verify NVDA is accessible
where nvda

# 4. Recompile extension
npm run compile

# 5. Test again (press F5 in VSCode)
```

---

## 📝 **What Changed in the Code**

**File:** `src/accessibilityTester.ts`

1. ✅ Added timeout (30 seconds) to `nvda.start()`
2. ✅ Added diagnostics (platform, node version, NVDA check)
3. ✅ Better error messages with troubleshooting steps
4. ✅ Warning if NVDA already running

---

## 🚨 **Common Errors & Fixes**

| Error | Fix |
|-------|-----|
| Hangs at "Starting NVDA..." | Run `npx @guidepup/setup` |
| "NVDA start timeout after 30 seconds" | Run `npx @guidepup/setup` |
| "NVDA is already running" | Close NVDA: `taskkill /F /IM nvda.exe` |
| "NVDA not found" | Run `npx @guidepup/setup` |

---

## 🎉 **After Running npx @guidepup/setup**

You should see:
```
Setting up NVDA...
Downloading NVDA portable...
Configuring NVDA for automation...
✅ Setup complete!
```

**Then test again!** NVDA should start properly. 🚀

---

## 📞 **Still Not Working?**

If NVDA still won't start after running setup:

1. **Check Windows version**: Windows 10 or 11 required
2. **Check antivirus**: Might be blocking NVDA automation
3. **Check permissions**: Run VSCode as Administrator
4. **Check logs**: Look for specific error messages in "AccessLint Testing" output

---

**Most likely fix:** Run `npx @guidepup/setup` 🎯

