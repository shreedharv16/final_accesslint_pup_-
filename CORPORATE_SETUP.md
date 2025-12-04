# AccessLint: Corporate Environment Setup Guide

This guide is specifically for setting up AccessLint in **corporate/restricted environments** where:
- Standard installation paths are restricted
- Network firewalls block package downloads
- Admin permissions are limited
- SSL/TLS certificates cause issues

---

## ❓ What Does Installing `@guidepup/guidepup` Actually Do?

Installing the npm package `@guidepup/guidepup` gives you:
- ✅ **Node.js library** to control NVDA programmatically
- ✅ **Functions like** `nvda.start()`, `nvda.stop()`, `nvda.next()`, etc.
- ✅ **Installed in** `node_modules/@guidepup/guidepup/`

**What it does NOT do:**
- ❌ Does **NOT** install NVDA itself (you need NVDA separately)
- ❌ Does **NOT** configure where NVDA is located
- ❌ Does **NOT** set environment variables

**Analogy:**
- Installing `@guidepup/guidepup` = Installing the **remote control app** 📱
- You still need the **actual NVDA software** 📺
- And you need to tell the app **where to find NVDA** (via `GUIDEPUP_NVDA_PATH`) 🔗

---

## 🚨 Common Corporate Environment Issues

### Issue 1: NVDA in Non-Standard Location
**Problem:** NVDA installed in `C:\temp\nvda_2022.4\` (or similar versioned folder) instead of `C:\Program Files (x86)\NVDA\`

**Solution:**

```powershell
# Find your NVDA executable (check versioned folders like nvda_2022.4)
dir C:\temp\nvda*\*.exe

# Common locations:
# C:\temp\nvda_2022.4\nvda.exe
# C:\temp\nvda_2022.4\nvda_launcher.exe

# OR search recursively:
Get-ChildItem C:\temp -Recurse -Filter "nvda*.exe" | Select-Object FullName

# Set environment variable (replace path with YOUR ACTUAL PATH)
$env:GUIDEPUP_NVDA_PATH = "C:\temp\nvda_2022.4\nvda.exe"

# Make it permanent (run PowerShell as Admin if needed)
[System.Environment]::SetEnvironmentVariable('GUIDEPUP_NVDA_PATH', 'C:\temp\nvda_2022.4\nvda.exe', 'User')

# Verify it's set
echo $env:GUIDEPUP_NVDA_PATH
```

**Note:** If the executable is called `nvda_launcher.exe`, use that path instead.

**Alternative: Add to System PATH**

1. Press `Win + X` → **System**
2. **Advanced system settings** → **Environment Variables**
3. Under **User variables**, find `Path` → **Edit**
4. **New** → Add: `C:\temp\nvda` (the folder containing nvda.exe)
5. Click **OK** → **Restart VS Code**

---

### Issue 2: Playwright in Local Folder (Not npm Installed)
**Problem:** Playwright downloaded from GitHub to `C:\temp\playwright-1.48.2\`

**Solution:**

```powershell
cd C:\Users\2247463\Documents\accesslint_pup-main

# Install from local directory
npm install C:\temp\playwright-1.48.2\playwright-1.48.2\packages\playwright-core

# Verify installation
npm list playwright
```

---

### Issue 3: Playwright Browsers Not Downloading (SSL/Firewall)
**Problem:** `npx playwright install` fails due to corporate firewall

**Solution A: Use System Chrome/Edge**

Edit `src/accessibilityTester.ts`:

```typescript
// OLD (line 109):
this.browser = await chromium.launch({ 
    headless: false,
    timeout: 60000,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
});

// NEW (use system Chrome):
this.browser = await chromium.launch({ 
    headless: false,
    timeout: 60000,
    channel: 'chrome',  // Use system Chrome
    args: ['--no-sandbox', '--disable-setuid-sandbox']
});

// OR use system Edge:
this.browser = await chromium.launch({ 
    headless: false,
    timeout: 60000,
    channel: 'msedge',  // Use system Edge
    args: ['--no-sandbox', '--disable-setuid-sandbox']
});
```

**Solution B: Manual Browser Download**

Ask your IT team to download and extract Chromium to:
```
%USERPROFILE%\AppData\Local\ms-playwright\chromium-<version>
```

Or set custom path:
```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = "C:\temp\playwright-browsers"
```

---

### Issue 4: `@guidepup/setup` Fails with EPERM
**Problem:** Permission errors when running `npx @guidepup/setup`

**Solution:**

```powershell
# Run PowerShell as Administrator
# Then navigate to your project
cd C:\Users\2247463\Documents\accesslint_pup-main

# Try with elevated permissions
npx @guidepup/setup

# If SSL issues occur:
$env:NODE_TLS_REJECT_UNAUTHORIZED="0"
npx @guidepup/setup

# If it still fails, skip this step and just set GUIDEPUP_NVDA_PATH manually
```

**Alternative: Manual Setup**

1. Ensure NVDA is in PATH or `GUIDEPUP_NVDA_PATH` is set
2. Guidepup will use your system NVDA installation
3. Skip `@guidepup/setup` entirely

---

### Issue 5: npm Install Fails with SSL Errors
**Problem:** Corporate proxy/firewall blocks npm downloads

**Solution:**

```powershell
# Check if proxy is configured
npm config get proxy
npm config get https-proxy

# If needed, set your corporate proxy:
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080

# Or ask IT team for npm registry mirror
npm config set registry https://internal-npm-mirror.company.com/

# Temporarily bypass SSL (NOT RECOMMENDED for production):
$env:NODE_TLS_REJECT_UNAUTHORIZED="0"
npm install
```

---

## ✅ Complete Setup Steps for Corporate Environment

### **Step 1: Verify NVDA Installation**

```powershell
# Find NVDA
Get-ChildItem C:\temp -Recurse -Filter "nvda.exe"

# Test if it runs
& "C:\temp\nvda\nvda.exe"  # Replace with actual path
# You should hear NVDA startup sound
# Press Insert+Q (or CapsLock+Q) to quit
```

### **Step 2: Set Environment Variables**

```powershell
# Set NVDA path (permanent - run as Admin)
[System.Environment]::SetEnvironmentVariable('GUIDEPUP_NVDA_PATH', 'C:\temp\nvda\nvda.exe', 'User')

# Verify
echo $env:GUIDEPUP_NVDA_PATH

# RESTART VS Code after setting environment variables!
```

### **Step 3: Install Dependencies**

```powershell
cd C:\Users\2247463\Documents\accesslint_pup-main

# Install from local playwright folder
npm install C:\temp\playwright-1.48.2\playwright-1.48.2\packages\playwright-core

# Install other dependencies
npm install

# If SSL errors occur:
$env:NODE_TLS_REJECT_UNAUTHORIZED="0"
npm install
```

### **Step 4: Configure to Use System Browser**

Edit `src/accessibilityTester.ts` line 109:

```typescript
this.browser = await chromium.launch({ 
    headless: false,
    timeout: 60000,
    channel: 'chrome',  // or 'msedge'
    args: ['--no-sandbox', '--disable-setuid-sandbox']
});
```

### **Step 5: Compile Extension**

```powershell
npm run compile
```

### **Step 6: Test NVDA Integration**

```powershell
# Create test script: test-nvda.js
node -e "const { nvda } = require('@guidepup/guidepup'); (async () => { try { await nvda.start(); console.log('✅ NVDA started!'); await nvda.stop(); } catch(e) { console.error('❌ Error:', e.message); } })();"
```

Expected output:
```
✅ NVDA started!
```

If error:
```
❌ Error: NVDA not supported
```
→ Go back to Step 2 and verify `GUIDEPUP_NVDA_PATH`

### **Step 7: Test Full Extension**

1. Press `F5` in VS Code to launch Extension Development Host
2. In new VS Code window, press `Ctrl+Shift+P`
3. Type: "AccessLint: Login"
4. Login with your credentials
5. Press `Ctrl+Shift+P` → "AccessLint: Start Accessibility Test"
6. Enter URL: `http://localhost:5173` (or any test page)
7. Watch output channel for progress

---

## 🔍 Troubleshooting

### Error: "NVDA not supported"

```powershell
# Check environment variable
echo $env:GUIDEPUP_NVDA_PATH

# Check if NVDA is running (should NOT be running)
tasklist | findstr nvda.exe

# If running, close it:
taskkill /IM nvda.exe /F

# Check if NVDA executable exists
Test-Path $env:GUIDEPUP_NVDA_PATH

# Try running NVDA manually
& $env:GUIDEPUP_NVDA_PATH
```

### Error: "Executable doesn't exist" (Playwright)

```powershell
# Use system browser instead
# Edit src/accessibilityTester.ts line 109:
channel: 'chrome'  # or 'msedge'

# Verify system Chrome exists
Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe"
Test-Path "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
```

### Error: "Cannot find module 'playwright'"

```powershell
# Install from local folder
npm install C:\temp\playwright-1.48.2\playwright-1.48.2\packages\playwright-core

# Or install from npm (if network allows)
npm install playwright-core
```

### Error: "EPERM: operation not permitted"

```powershell
# Run PowerShell as Administrator
# Right-click PowerShell → "Run as Administrator"

# Navigate to project
cd C:\Users\2247463\Documents\accesslint_pup-main

# Retry command
```

---

## 📝 Environment Variables Checklist

After setup, verify these are set:

```powershell
# Check all required variables
echo "GUIDEPUP_NVDA_PATH: $env:GUIDEPUP_NVDA_PATH"
echo "NODE_VERSION: $env:NODE_VERSION"
echo "PATH contains temp: $(if ($env:PATH -like '*temp*') {'YES'} else {'NO'})"

# Should output:
# GUIDEPUP_NVDA_PATH: C:\temp\nvda\nvda.exe
# NODE_VERSION: v20.14.0 (or similar)
```

---

## 🎯 Quick Test Script

Save as `test-setup.ps1`:

```powershell
Write-Host "AccessLint Corporate Setup Test" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Node.js
Write-Host "[1/5] Checking Node.js..." -NoNewline
try {
    $nodeVersion = node --version
    Write-Host " ✅ $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host " ❌ Not found" -ForegroundColor Red
}

# Test 2: NVDA Path
Write-Host "[2/5] Checking NVDA path..." -NoNewline
if ($env:GUIDEPUP_NVDA_PATH -and (Test-Path $env:GUIDEPUP_NVDA_PATH)) {
    Write-Host " ✅ $env:GUIDEPUP_NVDA_PATH" -ForegroundColor Green
} else {
    Write-Host " ❌ Not set or invalid" -ForegroundColor Red
}

# Test 3: NVDA Running
Write-Host "[3/5] Checking if NVDA is running..." -NoNewline
$nvdaProcess = Get-Process nvda -ErrorAction SilentlyContinue
if ($nvdaProcess) {
    Write-Host " ⚠️ NVDA is running (may cause issues)" -ForegroundColor Yellow
} else {
    Write-Host " ✅ NVDA not running" -ForegroundColor Green
}

# Test 4: Playwright
Write-Host "[4/5] Checking Playwright..." -NoNewline
$playwright = npm list playwright 2>&1 | Out-String
if ($playwright -like "*playwright*") {
    Write-Host " ✅ Installed" -ForegroundColor Green
} else {
    Write-Host " ❌ Not found" -ForegroundColor Red
}

# Test 5: Chrome/Edge
Write-Host "[5/5] Checking system browsers..." -NoNewline
$chrome = Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe"
$edge = Test-Path "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if ($chrome -or $edge) {
    Write-Host " ✅ Chrome: $chrome, Edge: $edge" -ForegroundColor Green
} else {
    Write-Host " ❌ Neither found" -ForegroundColor Red
}

Write-Host ""
Write-Host "Setup test complete!" -ForegroundColor Cyan
```

Run it:
```powershell
.\test-setup.ps1
```

---

## 🚀 Ready to Test?

Once all checks pass, run:

```powershell
# Start VS Code
code .

# In VS Code:
# 1. Press F5 to launch extension
# 2. In new window, Ctrl+Shift+P → "AccessLint: Login"
# 3. Login with test account
# 4. Ctrl+Shift+P → "AccessLint: Start Accessibility Test"
# 5. Enter test URL
```

---

## 📋 Corporate Environment Notes for Assumptions Doc

Add these to `ASSUMPTIONS_AND_PREREQUISITES.md`:

### **31. Corporate Environment Adaptations**

**Assumption:** Standard installation paths and network access are available.

**Corporate Reality:**
- NVDA may be in non-standard locations (`C:\temp\`)
- npm packages may need to be installed from local folders
- Playwright browsers may require manual download
- SSL certificates may cause installation failures
- Admin permissions may be restricted

**Required Workarounds:**
- Set `GUIDEPUP_NVDA_PATH` environment variable
- Install dependencies from local folders
- Use system Chrome/Edge instead of Playwright Chromium
- Configure corporate proxy settings
- Use `NODE_TLS_REJECT_UNAUTHORIZED=0` for installation only

**Setup Time:**
- Standard environment: ~5 minutes
- Corporate environment: ~30-60 minutes (with IT support)

---

**Last Updated:** 2025-12-04  
**Maintained By:** AccessLint Development Team

