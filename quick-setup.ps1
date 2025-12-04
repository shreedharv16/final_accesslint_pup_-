# Quick Setup for Corporate Environment
# Run this script to configure AccessLint with NVDA from C:\temp\nvda_2022.4

Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  AccessLint Quick Setup" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check if NVDA folder exists
$nvdaFolder = "C:\temp\nvda_2022.4"

if (-not (Test-Path $nvdaFolder)) {
    Write-Host "❌ NVDA folder not found: $nvdaFolder" -ForegroundColor Red
    Write-Host ""
    Write-Host "Searching for NVDA in C:\temp..." -ForegroundColor Yellow
    
    $nvdaFolders = Get-ChildItem "C:\temp" -Directory -Filter "nvda*" -ErrorAction SilentlyContinue
    
    if ($nvdaFolders) {
        Write-Host "Found these NVDA folders:" -ForegroundColor Green
        $nvdaFolders | ForEach-Object { Write-Host "  - $($_.FullName)" -ForegroundColor Cyan }
        Write-Host ""
        Write-Host "Update the `$nvdaFolder variable in this script and run again." -ForegroundColor Yellow
    } else {
        Write-Host "No NVDA folders found in C:\temp" -ForegroundColor Red
    }
    exit
}

Write-Host "✅ Found NVDA folder: $nvdaFolder" -ForegroundColor Green

# Find NVDA executable
$nvdaExe = $null
$possibleExes = @("nvda.exe", "nvda_launcher.exe", "nvda_2022.4.exe")

foreach ($exe in $possibleExes) {
    $fullPath = Join-Path $nvdaFolder $exe
    if (Test-Path $fullPath) {
        $nvdaExe = $fullPath
        break
    }
}

if (-not $nvdaExe) {
    Write-Host "❌ Could not find NVDA executable in folder" -ForegroundColor Red
    Write-Host "Files in folder:" -ForegroundColor Yellow
    Get-ChildItem $nvdaFolder -Filter "*.exe" | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor Cyan }
    exit
}

Write-Host "✅ Found NVDA executable: $nvdaExe" -ForegroundColor Green
Write-Host ""

# Set environment variable
Write-Host "Setting GUIDEPUP_NVDA_PATH..." -NoNewline
try {
    [System.Environment]::SetEnvironmentVariable('GUIDEPUP_NVDA_PATH', $nvdaExe, 'User')
    $env:GUIDEPUP_NVDA_PATH = $nvdaExe  # Set for current session too
    Write-Host " ✅ Done!" -ForegroundColor Green
} catch {
    Write-Host " ❌ Failed!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host "Try running PowerShell as Administrator" -ForegroundColor Yellow
    exit
}

# Install @guidepup/guidepup if not installed
Write-Host "Checking @guidepup/guidepup installation..." -NoNewline
$guidepupInstalled = Test-Path "node_modules/@guidepup/guidepup"

if ($guidepupInstalled) {
    Write-Host " ✅ Already installed" -ForegroundColor Green
} else {
    Write-Host " Installing..." -ForegroundColor Yellow
    npm install @guidepup/guidepup
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ @guidepup/guidepup installed successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Installation failed" -ForegroundColor Red
    }
}

# Check for Playwright
Write-Host "Checking Playwright..." -NoNewline
$playwrightInstalled = Test-Path "node_modules/playwright-core"

if (-not $playwrightInstalled) {
    Write-Host " ⚠️  Not installed" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Install Playwright from local folder:" -ForegroundColor Cyan
    Write-Host "  npm install C:\temp\playwright-1.48.2\playwright-1.48.2\packages\playwright-core" -ForegroundColor Yellow
} else {
    Write-Host " ✅ Installed" -ForegroundColor Green
}

# Set system browser environment variable
Write-Host ""
Write-Host "Setting system browser to Chrome..." -NoNewline
try {
    [System.Environment]::SetEnvironmentVariable('ACCESSLINT_USE_SYSTEM_BROWSER', 'chrome', 'User')
    $env:ACCESSLINT_USE_SYSTEM_BROWSER = 'chrome'
    Write-Host " ✅ Done!" -ForegroundColor Green
} catch {
    Write-Host " ⚠️  Warning (non-critical)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ SETUP COMPLETE!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Environment variables set:" -ForegroundColor Cyan
Write-Host "  GUIDEPUP_NVDA_PATH = $env:GUIDEPUP_NVDA_PATH" -ForegroundColor White
Write-Host "  ACCESSLINT_USE_SYSTEM_BROWSER = $env:ACCESSLINT_USE_SYSTEM_BROWSER" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  IMPORTANT: Restart VS Code for changes to take effect!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Close VS Code completely" -ForegroundColor White
Write-Host "  2. Reopen: code ." -ForegroundColor White
Write-Host "  3. Press F5 to launch extension" -ForegroundColor White
Write-Host "  4. Test accessibility features" -ForegroundColor White
Write-Host ""

