# 🎯 Accessibility Patterns Implementation

## Overview

This document describes the comprehensive accessibility pattern detection and fixing system implemented in AccessLint. The system provides intelligent, project-wide accessibility fixes based on proven patterns for WCAG 2.1 AA/AAA compliance.

## What Was Implemented

### 1. Core Pattern Intelligence System

**File:** `src/accessibilityPatterns.ts`

A comprehensive pattern library containing 10 major accessibility fix patterns:

#### 🖼️ Images & Media Patterns

1. **Smart Alt Text Propagation**
   - Detects identical images across the entire project (by filename, path, import)
   - When alt text is added to one image, automatically finds and fixes ALL occurrences
   - Example: Adding `alt="Company Logo"` to `logo.png` in one file triggers a project-wide search and applies the same alt text to ALL instances of `logo.png`

2. **Component-Aware Alt Text Suggestions**
   - Learns patterns for common components (Avatar, IconButton, ProductCard)
   - Provides context-aware suggestions:
     - `<Avatar src={user.photo} />` → `<Avatar src={user.photo} alt="Photo of {user.name}" />`
     - `<IconButton icon="delete" />` → `<IconButton icon="delete" aria-label="Delete item" />`
     - `<ProductCard image={...} name={...} />` → Add `alt="{product.name} product image"`

3. **Decorative Image Auto-Classification**
   - Detects decorative images (background flourishes, separators, icons with no semantic meaning)
   - Marks them with `alt=""` and `role="presentation"`
   - Examples:
     - Images with classes like `decoration`, `flourish`, `separator`
     - Icons next to duplicate text (redundant icons)
     - Small stylistic elements (< 50x50px)

#### 📝 Forms & Labels Patterns

4. **Auto Link Labels to Inputs**
   - Finds unlabeled form fields (visual label present but no `for`/`id` wiring)
   - Creates proper label-input associations
   - Supports bulk "fix all similar" within a file or project
   - Example:
     ```html
     <!-- Before -->
     <span>Email</span>
     <input type="email" />
     
     <!-- After -->
     <label for="email-input">Email</label>
     <input type="email" id="email-input" name="email" />
     ```

5. **Placeholder-to-Label Conversion**
   - Detects inputs that only use placeholders as labels (anti-pattern)
   - Converts to proper `<label>` + input structure
   - Retains placeholder as example text (optional)
   - Example:
     ```html
     <!-- Before (WRONG) -->
     <input placeholder="Enter your email" />
     
     <!-- After (CORRECT) -->
     <label for="email">Email Address</label>
     <input id="email" type="email" placeholder="e.g., user@example.com" />
     ```

6. **Required Field Metadata Sync**
   - Finds fields visually marked as required (label with `*`, red border)
   - Adds semantic markers: `required` attribute and `aria-required="true"`
   - Example:
     ```html
     <!-- Before -->
     <label>Name *</label>
     <input type="text" />
     
     <!-- After -->
     <label for="name">Name *</label>
     <input type="text" id="name" required aria-required="true" />
     ```

7. **Error Message Binding Helper**
   - Detects validation messages not programmatically tied to inputs
   - Auto-generates IDs for error elements
   - Adds `aria-describedby` to link errors to inputs
   - Adds `aria-invalid="true"` when errors are present
   - Example:
     ```html
     <!-- Before -->
     <input type="email" />
     <span class="error">Invalid email</span>
     
     <!-- After -->
     <input type="email" id="email" aria-describedby="email-error" aria-invalid="true" />
     <span id="email-error" role="alert">Invalid email</span>
     ```

#### 🏗️ Structure & Navigation Patterns

8. **Skip Link & Main Landmark Injector**
   - Detects layouts missing "Skip to main content" link and `<main>` landmark
   - Injects standard skip link at the beginning of the page
   - Adds `<main id="main-content" role="main">` landmark
   - Fixes layout files once, improving ALL pages using that layout
   - Includes CSS for skip link (hidden until focused)

9. **Semantic Layout Refactor**
   - Recognizes layout wrappers with semantic class names (`header`, `nav`, `content`, `footer`)
   - Replaces generic `<div>`s with semantic HTML5 elements
   - Example:
     ```html
     <!-- Before -->
     <div class="header">...</div>
     <div class="nav">...</div>
     <div class="content">...</div>
     <div class="footer">...</div>
     
     <!-- After -->
     <header role="banner">...</header>
     <nav role="navigation">...</nav>
     <main role="main">...</main>
     <footer role="contentinfo">...</footer>
     ```

#### 🎮 Interactive Elements Patterns

10. **Clickable Div/Span Refactor to Buttons/Links**
    - Identifies non-semantic clickable elements (`div`/`span` with `onClick`)
    - Determines semantic purpose:
      - **Navigation** (changes URL) → `<a>` or `<Link>` (React Router)
      - **Actions** (submit, delete, open modal) → `<button>`
    - Example:
      ```jsx
      // Before (WRONG)
      <div onClick={handleClick}>Click me</div>
      
      // After - For navigation:
      <Link to="/page">Link text</Link>
      
      // After - For actions:
      <button type="button" onClick={handleClick}>Click me</button>
      ```

### 2. Enhanced Agent System Prompt

**File:** `src/agentSystemPrompt.ts`

Added a comprehensive "ACCESSIBILITY EXPERTISE & PATTERN RECOGNITION" section that:

- Teaches the AI agent about all 10 accessibility patterns
- Provides clear examples for each pattern
- Includes a smart workflow for applying patterns
- Emphasizes project-wide fixes (not just single-file fixes)
- Includes bulk operation strategies

**Key Features:**
- Pattern-based fix strategies with code examples
- Auto-search logic: "When adding alt text to logo.png, search the entire project for logo.png"
- Priority rules: Critical → High → Medium
- Framework-specific examples (React, Vue, Angular, HTML)

### 3. Enhanced Testing Agent Integration

**File:** `src/testingWebviewProvider.ts`

Updated to use the pattern intelligence system:

**Changes:**
1. Import pattern intelligence: `generateEnhancedAccessibilityPrompt`, `getPatternRecommendations`
2. Enhanced `_createEnhancedFixPrompt()` - Now includes:
   - Full pattern-based guidance
   - Project-wide fix strategies
   - Search instructions for similar issues
   - Comprehensive execution plan
3. Enhanced `_createFixPrompt()` - Now includes:
   - Pattern recommendations based on detected issues
   - Bulk operation instructions
   - Project-wide fix goals

**Result:** When users click "Fix Accessibility Issues" in the testing panel, the AI agent:
1. Receives detected issues from NVDA testing
2. Gets pattern-based fix strategies
3. Applies fixes not just to the tested page, but searches for similar issues project-wide
4. Reports all files modified and patterns applied

### 4. Chat Agent Integration

**How it works:**
- Chat agent uses `agentSystemPrompt.ts` which now includes all patterns
- When users ask "make my code accessible" or "fix accessibility issues" in chat:
  - Agent has full pattern knowledge
  - Applies smart, project-wide fixes
  - Searches for similar issues
  - Uses semantic HTML and proper ARIA attributes

## How It Works

### Workflow Example: User Requests Accessibility Fix

#### Scenario 1: Testing Panel
1. User runs NVDA screen reader test on their website
2. AccessLint detects issues (e.g., unlabeled images, missing form labels)
3. User clicks "Fix Accessibility Issues"
4. AI agent receives:
   - List of detected issues
   - Pattern-based fix strategies for each issue type
   - Instructions to search project-wide for similar issues
5. Agent executes:
   - Reads relevant files
   - Applies pattern fixes (e.g., adds alt text to images)
   - Searches project with `grep_search` for similar issues
   - Fixes ALL occurrences (e.g., same image in 5 different files)
   - Reports: "Fixed logo alt text in 5 files: header.tsx, footer.tsx, ..."

#### Scenario 2: Chat Agent Mode
1. User types: "Make my React app accessible"
2. Agent (with pattern knowledge) executes:
   - Explores project structure
   - Identifies accessibility issues using patterns
   - Applies all 10 patterns systematically:
     - Converts clickable divs to buttons
     - Links all form labels to inputs
     - Adds skip links and landmarks
     - Fixes heading hierarchy
     - Adds proper alt text to images (project-wide)
   - Reports comprehensive changes

### Smart Features

#### 1. Project-Wide Fix Propagation
```
Issue detected: <img src="logo.png" /> has no alt text

Agent's process:
1. Add alt text to current file: alt="Company Logo"
2. Search project: grep_search for "logo.png"
3. Find 5 more files with logo.png
4. Apply SAME alt text to all 5 files
5. Report: "Added alt='Company Logo' to logo.png in 6 files total"
```

#### 2. Pattern Recognition
```
Issue detected: Form field has no label

Agent recognizes pattern:
- Nearby text: "Email Address"
- Input type: email
- Missing: for/id association

Agent applies pattern:
- Generate unique ID: "email-input"
- Convert text to <label for="email-input">
- Add id="email-input" to input
- Search for similar unlabeled inputs in file
- Fix all of them in one pass
```

#### 3. Component-Aware Intelligence
```
Code detected: <Avatar src={user.photo} userName="John" />

Agent recognizes:
- Component type: Avatar
- Available prop: userName
- Pattern: Avatar should have alt with user's name

Agent applies:
<Avatar 
  src={user.photo} 
  userName="John"
  alt="Photo of John" />
```

## Benefits

### For Users:
1. **Comprehensive Fixes**: Not just single-file fixes, but project-wide improvements
2. **Intelligent Pattern Matching**: AI understands context and applies appropriate patterns
3. **Time Savings**: Bulk operations fix dozens of similar issues at once
4. **Best Practices**: All fixes follow WCAG 2.1 AA/AAA guidelines
5. **Framework Aware**: Works with React, Vue, Angular, HTML, and more

### For Developers:
1. **Maintainable Code**: Semantic HTML and proper ARIA attributes
2. **Consistency**: Same issues fixed the same way across the project
3. **Learning Tool**: See examples of accessibility best practices
4. **Testing Integration**: Fixes based on actual screen reader testing results

## Pattern Priority System

### Critical Priority (Fix First):
- Unlabeled form inputs
- Clickable divs without proper semantics
- Missing keyboard accessibility
- Images without alt text (on meaningful images)

### High Priority:
- Missing skip links and landmarks
- Improper heading hierarchy
- Missing semantic HTML structure
- Required field visual/semantic mismatch

### Medium Priority:
- Decorative images not marked as decorative
- Error messages not programmatically linked
- Enhanced form helper text

## Supported Frameworks

All patterns work across:
- **HTML** (vanilla)
- **React** (including React Router, Next.js)
- **Vue** (Vue 2 & 3)
- **Angular** (all versions)
- **Svelte**
- **Any modern web framework**

## Usage Examples

### Example 1: User asks "Add alt text to my images"

**Agent Response:**
```
1. Reading project files...
2. Found 12 images without alt text
3. Analyzing images:
   - logo.png (found in 3 files) → "Company Logo"
   - hero-bg.jpg (decorative) → alt="" role="presentation"
   - avatar-{user}.jpg (Avatar component) → "Photo of {userName}"
   - product-*.jpg (ProductCard) → "{productName} product image"
4. Applying fixes across project...
5. ✅ Fixed 12 images in 8 files:
   - Added alt="Company Logo" to logo.png in header.tsx, footer.tsx, navbar.tsx
   - Marked hero-bg.jpg as decorative in Home.tsx
   - Updated Avatar component to use userName prop for alt text
   - Updated ProductCard to generate alt text from product name
```

### Example 2: User asks "Fix my form accessibility"

**Agent Response:**
```
1. Analyzing form structure...
2. Detected issues:
   - 5 inputs with placeholder-only labels
   - 3 inputs marked with * but no required attribute
   - 2 error messages not linked to inputs
3. Applying form accessibility patterns:
   - Converting placeholders to proper labels
   - Adding required + aria-required to visually marked fields
   - Linking error messages with aria-describedby
   - Ensuring all inputs have unique IDs
4. ✅ Fixed ContactForm.tsx:
   - Added proper labels to 5 inputs
   - Added required semantics to 3 fields
   - Linked 2 error messages with aria-describedby
   - All form fields now properly labeled and accessible
```

### Example 3: User asks "Make my navigation accessible"

**Agent Response:**
```
1. Analyzing navigation structure...
2. Detected issues:
   - Navigation using divs instead of semantic elements
   - Clickable divs instead of links
   - No skip link present
   - No landmark roles
3. Applying navigation accessibility patterns:
   - Adding skip link: <a href="#main-content">Skip to main content</a>
   - Converting <div class="header"> to <header role="banner">
   - Converting <div class="nav"> to <nav role="navigation">
   - Converting clickable divs to proper <a> links
   - Adding <main id="main-content" role="main"> landmark
4. ✅ Fixed App.tsx and Layout.tsx:
   - Added skip link with CSS (hidden until focused)
   - Converted 4 divs to semantic elements
   - Converted 6 clickable divs to proper links
   - Added main landmark
   - All pages using this layout are now accessible
```

## Technical Implementation Details

### Pattern Detection Logic

Each pattern includes:
- **Detection Logic**: How to identify the issue in code
- **Fix Strategy**: Step-by-step fix instructions with code examples
- **WCAG Criteria**: Which WCAG success criteria are addressed
- **Severity**: Critical, High, Medium, or Low
- **Applicable Frameworks**: Which frameworks this pattern applies to

### Pattern Recommendation Engine

Function: `getPatternRecommendations(issues: string[]): string`

- Takes detected issues as input
- Matches issues to relevant patterns
- Returns formatted guidance with:
  - Pattern name and description
  - Fix strategy with code examples
  - WCAG criteria
  - Bulk operation strategies
  - Priority rules

### Enhanced Prompt Generator

Function: `generateEnhancedAccessibilityPrompt(issues: any[], context: any): string`

- Takes detected issues and context
- Generates comprehensive fix prompt including:
  - Pattern-based guidance
  - Issue list with details
  - Execution checklist
  - Project-wide fix instructions

## Future Enhancements

Potential additions (not yet implemented):
1. **Video Caption Reuse**: Detect the same video on multiple pages and reuse approved caption files
2. **Pattern Learning**: Learn from user's own component patterns over time
3. **Accessibility Score**: Calculate accessibility score before/after fixes
4. **Custom Patterns**: Allow users to define their own accessibility patterns
5. **Integration with ESLint**: Suggest ESLint rules based on detected patterns

## Testing

To test the implementation:

1. **Test Smart Alt Text Propagation:**
   - Use the same image in multiple files
   - Run NVDA test or ask "fix image alt text"
   - Verify alt text is added to ALL instances

2. **Test Form Pattern:**
   - Create a form with unlabeled inputs
   - Ask "make my form accessible"
   - Verify labels are properly linked

3. **Test Clickable Div Refactor:**
   - Create clickable divs with onClick
   - Ask "fix accessibility issues"
   - Verify divs are converted to proper buttons/links

4. **Test Semantic Layout:**
   - Use divs with semantic class names
   - Ask "improve my page structure"
   - Verify divs are converted to semantic elements

5. **Test Project-Wide Fixes:**
   - Create multiple files with the same issue
   - Fix one instance via chat/testing
   - Verify ALL instances are fixed

## Conclusion

This implementation provides AccessLint with comprehensive, intelligent, and project-wide accessibility fixing capabilities. The pattern-based approach ensures:

- **Consistency**: Same issues fixed the same way
- **Completeness**: Project-wide fixes, not just single files
- **Intelligence**: Context-aware suggestions based on component types
- **Best Practices**: All fixes follow WCAG 2.1 AA/AAA guidelines
- **Efficiency**: Bulk operations save significant time

The system works seamlessly in both testing mode (fix issues found by NVDA) and chat mode (proactive accessibility improvements), making AccessLint a powerful tool for building accessible web applications.

