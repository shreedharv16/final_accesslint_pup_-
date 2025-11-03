# What's New in AccessLint v0.2.0

## 🎉 New Feature: Accessibility Testing Panel

We've added a complete automated accessibility testing system to AccessLint!

### Key Features

#### 🤖 Automated Browser Testing
- Uses Playwright to launch a real browser
- Automatically navigates and tests your website
- No manual clicking required!

#### 📋 12 WCAG Compliance Checks
Tests against these accessibility criteria:
- 1.1.1 Non-text Content (alt text)
- 1.3.2 Meaningful Sequence (heading hierarchy)
- 1.3.3 Sensory Characteristics
- 1.4.1 Use of Color
- 1.4.13 Content on Hover or Focus
- 2.4.11 Focus Not Obscured
- 3.2.3 Consistent Navigation
- 3.2.4 Consistent Identification
- 3.2.6 Consistent Help
- 3.3.7 Redundant Entry
- 3.3.8 Accessible Authentication
- 4.1.3 Status Messages

#### 🎨 Beautiful UI
- Clean, modern interface
- Real-time progress updates
- Summary cards showing errors, warnings, and info
- Filterable results
- Detailed issue descriptions

#### ⚡ Quick Testing
- One-click localhost testing
- Quick link buttons for common ports
- Test any URL (local or remote)
- Fast, efficient checks

### How to Use

**Step 1**: Press `F5` to run the extension

**Step 2**: Click the AccessLint icon in the sidebar

**Step 3**: Open the "Accessibility Testing" panel

**Step 4**: Enter a URL and click "Start Test"

**Step 5**: Review your results!

### Technical Details

**Technology Stack:**
- **Guidepup**: Screen reader automation library
- **Playwright**: Browser automation framework
- **TypeScript**: Type-safe implementation
- **VSCode Webview API**: Beautiful, integrated UI

**Architecture:**
- `AccessibilityTester`: Core testing engine with 12 WCAG checks
- `TestingWebviewProvider`: VSCode integration layer
- Custom webview with real-time updates

### Installation

All dependencies are already installed! Just run:

```bash
npm run compile
```

For advanced features (screen reader automation):

```bash
npx @guidepup/setup
```

### Documentation

- **Quick Start**: See `TESTING_QUICKSTART.md`
- **Full Guide**: See `ACCESSIBILITY_TESTING_GUIDE.md`
- **Usage Instructions**: In the README

### Screenshots

```
┌─────────────────────────────────────────┐
│  🧪 Accessibility Testing               │
├─────────────────────────────────────────┤
│  Enter URL:                             │
│  ┌───────────────────────┐  ┌────────┐ │
│  │ localhost:3000        │  │ ▶ Start│ │
│  └───────────────────────┘  └────────┘ │
│                                         │
│  [localhost:3000] [localhost:8080]     │
│                                         │
│  Test Results:                          │
│  ┌─────┐  ┌─────┐  ┌─────┐            │
│  │ ❌ 5│  │ ⚠️ 12│  │ ℹ️ 3│            │
│  │Error│  │ Warn│  │ Info│            │
│  └─────┘  └─────┘  └─────┘            │
│                                         │
│  Filters: [All] [Errors] [Warnings]    │
│                                         │
│  📄 Issues:                             │
│  ┌─────────────────────────────────┐   │
│  │ 1.1.1 Non-text Content    [❌] │   │
│  │ Image missing alt: logo.png     │   │
│  │ Element: <img src="logo.png">   │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ 1.3.2 Meaningful Sequence [⚠️] │   │
│  │ Heading skipped from h1 to h3   │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Benefits

✅ **Save Time**: Automate manual accessibility testing  
✅ **Catch Issues Early**: Test during development  
✅ **Learn WCAG**: Each issue explains the criterion  
✅ **Better Code**: Write more accessible HTML from the start  
✅ **Comprehensive**: Covers 12 essential WCAG criteria  
✅ **Easy to Use**: No configuration needed  

### Roadmap

Future enhancements planned:
- Export reports to HTML/PDF
- Historical data tracking
- CI/CD integration
- More WCAG criteria
- Custom rule configuration
- Multi-page crawling

### Feedback

We'd love to hear from you!
- Found a bug? Open an issue
- Have a suggestion? Let us know
- Want to contribute? PRs welcome!

---

## Getting Started Right Now

Run this in your terminal:

```bash
# Compile the extension
npm run compile

# Press F5 in VSCode to launch

# Open AccessLint sidebar
# Click "Accessibility Testing"
# Enter URL and test!
```

That's it! You're ready to make the web more accessible! 🌟

---

## Previous Features

All existing features are still available:
- ✅ AI Chat Assistant (Gemini, Anthropic, OpenAI)
- ✅ Code analysis and suggestions
- ✅ WCAG compliance guidance
- ✅ Context-aware recommendations
- ✅ File scanning and analysis

---

**Version**: 0.2.0  
**Release Date**: 2025  
**Compatibility**: VSCode 1.74.0+  
**License**: MIT  

Made with ❤️ for accessibility
