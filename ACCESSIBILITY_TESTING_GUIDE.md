# Accessibility Testing Guide

## Overview

AccessLint now includes an **Accessibility Testing** panel that uses Guidepup and Playwright to automatically test websites for WCAG compliance. This feature launches a real browser and checks your website against 12 important accessibility criteria.

## Features

- 🚀 **Automated Testing**: Tests websites automatically using Playwright browser automation
- 📊 **Comprehensive Checks**: Validates 12 WCAG criteria
- 🎯 **Visual Results**: Beautiful, categorized display of issues (Errors, Warnings, Info)
- 🔍 **Detailed Reports**: Shows specific elements and locations of accessibility issues
- ⚡ **Quick Links**: One-click testing for common localhost ports

## Setup

### 1. Install Guidepup (Already Done)

The extension already includes Guidepup and Playwright dependencies. If you need to set up screen reader automation on your system, run:

```bash
npx @guidepup/setup
```

This command configures your operating system to allow screen reader automation.

### 2. Activate the Extension

1. Open VSCode
2. Press `F5` to run the extension in development mode
3. Look for the AccessLint icon in the Activity Bar (left sidebar)
4. Click it to open the AccessLint panel

## Using the Testing Panel

### Opening the Panel

1. Click the **AccessLint** icon in the Activity Bar
2. You'll see two panels:
   - **AI Chat** (existing feature)
   - **Accessibility Testing** (NEW!)

### Testing a Website

1. **Enter a URL** in the input field:
   - `localhost:3000`
   - `http://localhost:8080`
   - `https://example.com`
   
2. **Quick Links**: Click one of the quick link buttons for common localhost ports:
   - `localhost:3000`
   - `localhost:8080`
   - `localhost:5173`

3. **Start Test**: Click the "▶ Start Test" button

4. **View Progress**: Watch real-time progress messages as the test runs

5. **Review Results**: See a summary card showing:
   - Number of Errors (❌)
   - Number of Warnings (⚠️)
   - Number of Info items (ℹ️)

6. **Filter Results**: Use the filter buttons to see:
   - All issues
   - Only errors
   - Only warnings
   - Only info

### Understanding Results

Each issue shows:
- **Criterion**: The WCAG criterion (e.g., "1.1.1 Non-text Content")
- **Severity**: Error, Warning, or Info
- **Description**: What the issue is and how to fix it
- **Element** (when available): The specific HTML element
- **Location** (when available): Where to find it (URL or selector)

## WCAG Criteria Checked

The testing panel checks the following accessibility criteria:

### 1.1.1 Non-text Content
- ✅ Images have alt text
- ✅ Decorative images have empty alt attributes
- ✅ Non-text content has text alternatives

### 1.3.2 Meaningful Sequence
- ✅ Proper heading hierarchy (h1, h2, h3, etc.)
- ✅ Logical reading order
- ✅ No positive tabindex values

### 1.3.3 Sensory Characteristics
- ✅ Information not conveyed by sensory characteristics alone
- ✅ Color, shape, size, or position supplemented with text

### 1.4.1 Use of Color
- ✅ Color not the only method to convey information
- ✅ Required fields have text indicators
- ✅ Error states have textual descriptions

### 1.4.13 Content on Hover or Focus
- ✅ Hover content is keyboard accessible
- ✅ Title attributes have ARIA alternatives
- ✅ Tooltips are dismissible

### 2.4.11 Focus Not Obscured (Minimum)
- ✅ Focus indicators are visible
- ✅ Focused elements not hidden by overlapping content
- ✅ Outline styles present

### 3.2.3 Consistent Navigation
- ✅ Navigation landmarks present
- ✅ Navigation elements labeled consistently
- ✅ Navigation structure consistent across pages

### 3.2.4 Consistent Identification
- ✅ Similar components labeled consistently
- ✅ Icons and buttons have consistent labels
- ✅ Predictable interactions

### 3.2.6 Consistent Help
- ✅ Help/support links present
- ✅ Help features consistently accessible
- ✅ Help labeling consistent across pages

### 3.3.7 Redundant Entry
- ✅ Autocomplete attributes on form fields
- ✅ Previously entered information retained
- ✅ No unnecessary re-entry of data

### 3.3.8 Accessible Authentication (Minimum)
- ✅ Login forms have accessible labels
- ✅ Error messages clear and accessible
- ✅ Password fields properly labeled

### 4.1.3 Status Messages
- ✅ Status messages use ARIA live regions
- ✅ Dynamic content updates announced
- ✅ Role="status" or role="alert" present

## Example Workflow

### Testing a Local React App

1. Start your React app: `npm start` (usually runs on localhost:3000)
2. Open AccessLint Testing panel
3. Click "localhost:3000" quick link
4. Wait for browser to open and tests to run
5. Review accessibility issues
6. Fix issues in your code
7. Re-run test to verify fixes

### Testing a Production Website

1. Open AccessLint Testing panel
2. Enter URL: `https://your-website.com`
3. Click "Start Test"
4. Review the comprehensive accessibility report
5. Document issues for your development team

## Tips for Best Results

1. **Test Early, Test Often**: Run tests during development, not just at the end
2. **Fix Errors First**: Address errors before warnings
3. **Test Multiple Pages**: Different pages may have different issues
4. **Combine with Manual Testing**: Automated testing doesn't catch everything
5. **Check the Output Channel**: View "AccessLint Testing" in the Output panel for detailed logs

## Troubleshooting

### Browser Won't Launch

**Problem**: "Failed to initialize browser"

**Solution**:
1. Ensure Playwright browsers are installed: `npx playwright install`
2. Check that no other instances are running
3. Restart VSCode

### No Results Returned

**Problem**: Test completes but shows no issues

**Solution**:
1. Check that the URL is correct and accessible
2. Ensure the website loaded properly
3. Check the Output panel for errors
4. Try a different URL to verify the tool is working

### Too Many Issues

**Problem**: Hundreds of issues reported

**Solution**:
1. Use filters to focus on errors first
2. Address systematic issues (like all images missing alt text)
3. Fix one criterion at a time
4. Re-test to see progress

### Screen Reader Not Working

**Problem**: Want to use actual screen readers (NVDA/VoiceOver)

**Solution**:
1. Run `npx @guidepup/setup` in terminal
2. Follow OS-specific instructions
3. For Windows: Grant NVDA API access
4. For macOS: Grant accessibility permissions

## Architecture

The testing feature consists of:

1. **AccessibilityTester** (`src/accessibilityTester.ts`):
   - Core testing logic
   - Playwright browser automation
   - WCAG criterion checks
   - Issue detection and reporting

2. **TestingWebviewProvider** (`src/testingWebviewProvider.ts`):
   - VSCode webview integration
   - Message passing between UI and backend
   - Progress tracking

3. **Testing UI** (`webviews/testing.js` + `testing.css`):
   - Beautiful, responsive interface
   - Real-time progress updates
   - Filterable results display
   - Summary cards

## Future Enhancements

Possible future improvements:

- [ ] Export results to HTML/PDF reports
- [ ] Historical testing data and trends
- [ ] Compare results between test runs
- [ ] Integration with CI/CD pipelines
- [ ] Additional WCAG 2.1 and 2.2 criteria
- [ ] Custom rule configuration
- [ ] Screen reader integration (NVDA/VoiceOver)
- [ ] Bulk testing of multiple pages
- [ ] Screenshot annotations of issues

## Commands

Use these commands from the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):

- **AccessLint: Open Accessibility Testing** - Opens the testing panel
- **AccessLint: Open Chat** - Opens the AI chat panel
- **AccessLint: Configure API Keys** - Set up AI provider keys

## Keyboard Shortcuts

- `Enter` in URL input: Start test
- `Escape` during test: Cancel test (via Cancel button)

## Resources

- [Guidepup Documentation](https://www.guidepup.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [AccessLint Extension](https://github.com/your-repo/accesslint)

## Support

If you encounter issues:
1. Check the Output panel: "AccessLint Testing"
2. Review this guide
3. Open an issue on GitHub
4. Contact the development team

---

Happy testing! 🎉 Make the web more accessible for everyone.
