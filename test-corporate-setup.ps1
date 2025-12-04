# AccessLint Corporate Environment Setup Test
# Run this script to verify your environment is configured correctly

Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  AccessLint Corporate Setup Test" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$allPassed = $true

# Test 1: Node.js
Write-Host "[1/6] Checking Node.js version..." -NoNewline
try {
    $nodeVersion = node --version
    Write-Host " ✅ $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host " ❌ Not found - Install Node.js" -ForegroundColor Red
    $allPassed = $false
}

# Test 2: NVDA Path
Write-Host "[2/6] Checking NVDA path..." -NoNewline
if ($env:GUIDEPUP_NVDA_PATH) {
    if (Test-Path $env:GUIDEPUP_NVDA_PATH) {
        Write-Host " ✅ $env:GUIDEPUP_NVDA_PATH" -ForegroundColor Green
    } else {
        Write-Host " ❌ Path set but file doesn't exist: $env:GUIDEPUP_NVDA_PATH" -ForegroundColor Red
        $allPassed = $false
    }
} else {
    Write-Host " ⚠️  Not set - Searching for NVDA..." -ForegroundColor Yellow
    
    # Search common locations (including versioned folders)
    $nvdaLocations = @(
        "C:\temp\nvda_2022.4\nvda.exe",
        "C:\temp\nvda_2022.4\nvda_launcher.exe",
        "C:\temp\nvda\nvda.exe",
        "C:\temp\nvda.exe",
        "C:\Program Files (x86)\NVDA\nvda.exe",
        "C:\Program Files\NVDA\nvda.exe"
    )
    
    # Also search for any NVDA folder with version number
    if (Test-Path "C:\temp") {
        $nvdaFolders = Get-ChildItem "C:\temp" -Directory -Filter "nvda*" -ErrorAction SilentlyContinue
        foreach ($folder in $nvdaFolders) {
            $nvdaLocations += Join-Path $folder.FullName "nvda.exe"
            $nvdaLocations += Join-Path $folder.FullName "nvda_launcher.exe"
        }
    }
    
    $found = $false
    foreach ($loc in $nvdaLocations) {
        if (Test-Path $loc) {
            Write-Host ""
            Write-Host "     Found NVDA at: $loc" -ForegroundColor Green
            Write-Host "     Run this command to set it permanently:" -ForegroundColor Yellow
            Write-Host "     [System.Environment]::SetEnvironmentVariable('GUIDEPUP_NVDA_PATH', '$loc', 'User')" -ForegroundColor Yellow
            $found = $true
            break
        }
    }
    
    if (-not $found) {
        Write-Host ""
        Write-Host "     ❌ NVDA not found in common locations" -ForegroundColor Red
        Write-Host "     Search manually: Get-ChildItem C:\temp -Recurse -Filter 'nvda.exe'" -ForegroundColor Yellow
        $allPassed = $false
    }
}

# Test 3: NVDA Running Check
Write-Host "[3/6] Checking if NVDA is already running..." -NoNewline
$nvdaProcess = Get-Process nvda -ErrorAction SilentlyContinue
if ($nvdaProcess) {
    Write-Host " ⚠️  NVDA is running (PID: $($nvdaProcess.Id))" -ForegroundColor Yellow
    Write-Host "     This may cause issues. Close NVDA before testing." -ForegroundColor Yellow
    Write-Host "     To close: taskkill /IM nvda.exe /F" -ForegroundColor Yellow
} else {
    Write-Host " ✅ NVDA not running" -ForegroundColor Green
}

# Test 4: Playwright
Write-Host "[4/6] Checking Playwright installation..." -NoNewline
try {
    $playwrightCheck = npm list playwright 2>&1 | Out-String
    if ($playwrightCheck -like "*playwright*" -or $playwrightCheck -like "*playwright-core*") {
        Write-Host " ✅ Installed" -ForegroundColor Green
    } else {
        Write-Host " ❌ Not found" -ForegroundColor Red
        Write-Host "     Install from local: npm install C:\temp\playwright-1.48.2\playwright-1.48.2\packages\playwright-core" -ForegroundColor Yellow
        $allPassed = $false
    }
} catch {
    Write-Host " ❌ npm error" -ForegroundColor Red
    $allPassed = $false
}

# Test 5: System Browsers
Write-Host "[5/6] Checking system browsers..." -NoNewline
$chrome = Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe"
$edge86 = Test-Path "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$edge = Test-Path "C:\Program Files\Microsoft\Edge\Application\msedge.exe"

$hasBrowser = $chrome -or $edge86 -or $edge

if ($hasBrowser) {
    $browserList = @()
    if ($chrome) { $browserList += "Chrome" }
    if ($edge -or $edge86) { $browserList += "Edge" }
    Write-Host " ✅ $($browserList -join ', ') found" -ForegroundColor Green
    
    if ($chrome) {
        Write-Host "     To use Chrome: `$env:ACCESSLINT_USE_SYSTEM_BROWSER='chrome'" -ForegroundColor Cyan
    }
    if ($edge -or $edge86) {
        Write-Host "     To use Edge:   `$env:ACCESSLINT_USE_SYSTEM_BROWSER='msedge'" -ForegroundColor Cyan
    }
} else {
    Write-Host " ⚠️  Neither Chrome nor Edge found" -ForegroundColor Yellow
    Write-Host "     Playwright will try to use its own Chromium" -ForegroundColor Yellow
}

# Test 6: Project Dependencies
Write-Host "[6/6] Checking project dependencies..." -NoNewline
if (Test-Path "node_modules") {
    Write-Host " ✅ node_modules exists" -ForegroundColor Green
} else {
    Write-Host " ❌ node_modules missing - Run: npm install" -ForegroundColor Red
    $allPassed = $false
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan

if ($allPassed) {
    Write-Host "✅ ALL CHECKS PASSED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Restart VS Code (to load environment variables)" -ForegroundColor White
    Write-Host "2. Press F5 to launch extension" -ForegroundColor White
    Write-Host "3. Test accessibility features" -ForegroundColor White
} else {
    Write-Host "⚠️  SOME CHECKS FAILED" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Fix the issues above, then run this script again." -ForegroundColor Yellow
}

Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Ask if user wants to set environment variables now
if (-not $env:GUIDEPUP_NVDA_PATH) {
    Write-Host "Would you like to search for NVDA and set GUIDEPUP_NVDA_PATH now? (Y/N): " -NoNewline -ForegroundColor Yellow
    $response = Read-Host
    
    if ($response -eq "Y" -or $response -eq "y") {
        Write-Host ""
        Write-Host "Searching for NVDA..." -ForegroundColor Cyan
        
        $nvdaPath = $null
        
        # Search C:\temp first
        if (Test-Path "C:\temp") {
            $nvdaFiles = Get-ChildItem "C:\temp" -Recurse -Filter "nvda.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($nvdaFiles) {
                $nvdaPath = $nvdaFiles.FullName
            }
        }
        
        if ($nvdaPath) {
            Write-Host "Found NVDA at: $nvdaPath" -ForegroundColor Green
            Write-Host ""
            Write-Host "Setting GUIDEPUP_NVDA_PATH permanently..." -ForegroundColor Cyan
            
            try {
                [System.Environment]::SetEnvironmentVariable('GUIDEPUP_NVDA_PATH', $nvdaPath, 'User')
                Write-Host "✅ Environment variable set successfully!" -ForegroundColor Green
                Write-Host ""
                Write-Host "⚠️  IMPORTANT: Restart VS Code for changes to take effect!" -ForegroundColor Yellow
            } catch {
                Write-Host "❌ Failed to set environment variable: $_" -ForegroundColor Red
                Write-Host "Try running PowerShell as Administrator" -ForegroundColor Yellow
            }
        } else {
            Write-Host "❌ Could not find nvda.exe in C:\temp" -ForegroundColor Red
            Write-Host "Please locate it manually and run:" -ForegroundColor Yellow
            Write-Host "[System.Environment]::SetEnvironmentVariable('GUIDEPUP_NVDA_PATH', 'C:\path\to\nvda.exe', 'User')" -ForegroundColor Yellow
        }
    }
}

