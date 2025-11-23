/**
 * Comprehensive Accessibility Pattern Detection and Fix Recommendations
 * This module contains intelligence for detecting common accessibility issues
 * and providing smart fix suggestions for the AI agents.
 */

export interface AccessibilityPattern {
    id: string;
    category: string;
    name: string;
    description: string;
    detectionLogic: string;
    fixStrategy: string;
    wcagCriteria: string[];
    severity: 'critical' | 'high' | 'medium' | 'low';
    applicableFrameworks: string[];
}

/**
 * Comprehensive list of accessibility patterns that agents should detect and fix
 */
export const ACCESSIBILITY_PATTERNS: AccessibilityPattern[] = [
    // ============================================
    // IMAGES & MEDIA PATTERNS
    // ============================================
    {
        id: 'smart-alt-text-propagation',
        category: 'Images & Media',
        name: 'Smart Alt Text Propagation',
        description: 'When an alt text is added to an image, detect identical images across the project (by hash/path/visual similarity) and offer to apply the same alt text everywhere to avoid repetition.',
        detectionLogic: `
1. When fixing an image with alt text, search for all occurrences of the same image:
   - Same filename (e.g., "logo.png" used in multiple places)
   - Same path/import (e.g., import logo from './assets/logo.png')
   - Same src attribute value
2. Use grep to find: <img.*src=["'].*filename.*["']
3. Check for: <Image src={logo}, <img src="./logo.png", background-image: url()
4. Identify ALL files containing this image reference`,
        fixStrategy: `
When adding alt text to an image:
1. Search the entire project for the same image reference
2. Apply the SAME alt text to ALL occurrences
3. Report: "Applied alt text '{text}' to {filename} in {N} locations: {file1}, {file2}, etc."
4. For React/Vue components, update the shared Image component or props

Example fixes:
// Before: Multiple files with same image, no alt
<img src="./logo.png" />  // in header.html
<img src="./logo.png" />  // in footer.html

// After: Apply same alt text everywhere
<img src="./logo.png" alt="Company Logo" />  // in header.html
<img src="./logo.png" alt="Company Logo" />  // in footer.html`,
        wcagCriteria: ['1.1.1 Non-text Content'],
        severity: 'high',
        applicableFrameworks: ['html', 'react', 'vue', 'angular', 'svelte']
    },

    {
        id: 'component-aware-alt-suggestions',
        category: 'Images & Media',
        name: 'Component-Aware Alt Text Suggestions',
        description: 'Learn patterns for common components (Avatar, IconButton, ProductCard) and suggest context-aware alt text based on props and usage.',
        detectionLogic: `
1. Identify component types by name: Avatar, Icon, IconButton, ProductCard, UserPhoto, Thumbnail
2. Analyze component props to extract context:
   - Avatar with userName prop → alt="Photo of {userName}"
   - IconButton with action prop (delete, edit, close) → alt="{action} item"
   - ProductCard with productName → alt="{productName} product image"
   - CloseButton → alt="Close dialog"
3. Look for patterns:
   - Icons with semantic meaning (delete icon, edit icon, etc.)
   - Decorative icons (should have alt="" or role="presentation")`,
        fixStrategy: `
Smart alt text based on component type and props:

// Avatar Component
<Avatar src={user.photo} userName={user.name} />
Fix: <Avatar src={user.photo} userName={user.name} alt={\`Photo of \${user.name}\`} />

// IconButton (semantic action)
<IconButton icon="delete" onClick={handleDelete} />
Fix: <IconButton icon="delete" onClick={handleDelete} aria-label="Delete item" />

// ProductCard
<ProductCard image={product.image} name={product.name} />
Fix: <img src={product.image} alt={\`\${product.name} product image\`} />

// Decorative Icon (next to text)
<Icon name="checkmark" /> Success
Fix: <Icon name="checkmark" aria-hidden="true" role="presentation" /> Success

// Close/Cancel buttons
<button><Icon name="close" /></button>
Fix: <button aria-label="Close dialog"><Icon name="close" aria-hidden="true" /></button>`,
        wcagCriteria: ['1.1.1 Non-text Content', '4.1.2 Name, Role, Value'],
        severity: 'high',
        applicableFrameworks: ['react', 'vue', 'angular', 'svelte']
    },

    {
        id: 'decorative-image-classification',
        category: 'Images & Media',
        name: 'Decorative Image Auto-Classification',
        description: 'Detect likely decorative images (background flourishes, separators, icons with no semantic meaning) and offer one-click marking as alt="" / role="presentation" in bulk.',
        detectionLogic: `
1. Identify decorative images by context:
   - Images with class names containing: decoration, flourish, separator, divider, background, pattern
   - Images inside decorative containers (hero sections with text overlay)
   - Icons that are NEXT TO text describing the same action (redundant)
   - Spacer images, pixel gifs
   - Background images in CSS that are decorative
2. Small images (< 50x50px) that are stylistic elements
3. SVG patterns, gradients used for decoration
4. Icons that duplicate adjacent text meaning`,
        fixStrategy: `
Mark decorative images appropriately:

// Decorative background flourish
<img src="flourish.svg" class="decoration" />
Fix: <img src="flourish.svg" class="decoration" alt="" role="presentation" />

// Icon next to duplicate text (redundant)
<Icon name="search" /> Search
Fix: <Icon name="search" aria-hidden="true" /> Search

// Decorative separator
<img src="divider.png" class="separator" />
Fix: <img src="divider.png" class="separator" alt="" role="presentation" />

// SVG decorations
<svg class="background-pattern">...</svg>
Fix: <svg class="background-pattern" aria-hidden="true" role="presentation">...</svg>

// Hero section background (decorative)
<div style="background-image: url('hero-bg.jpg')">
  <h1>Welcome</h1>
</div>
Fix: Already decorative (background images are ignored by screen readers), ensure text has good contrast`,
        wcagCriteria: ['1.1.1 Non-text Content'],
        severity: 'medium',
        applicableFrameworks: ['html', 'react', 'vue', 'angular', 'svelte']
    },

    // ============================================
    // FORMS & LABELS PATTERNS
    // ============================================
    {
        id: 'auto-link-labels-inputs',
        category: 'Forms & Labels',
        name: 'Auto Link Labels to Inputs',
        description: 'Find unlabeled form fields (label text visually present but no for/id wiring) and offer auto-creation of matching id and for attributes. Support bulk "fix all similar" within a file or component.',
        detectionLogic: `
1. Find inputs without id attribute or without associated label
2. Look for nearby text that could be the label:
   - Text in previous sibling element
   - Text in parent element
   - Placeholder text (should be converted to label)
3. Detect patterns:
   - <div><span>Email</span><input type="email" /></div>
   - <label>Username<input /></label> (implicit, should be explicit)
   - <input placeholder="Password" /> (no label at all)
4. Scan entire file for similar unlabeled inputs`,
        fixStrategy: `
Create proper label-input associations:

// Pattern 1: Nearby text, no label
<div>
  <span>Email Address</span>
  <input type="email" />
</div>
Fix:
<div>
  <label for="email-input">Email Address</label>
  <input type="email" id="email-input" name="email" />
</div>

// Pattern 2: Implicit label (should be explicit)
<label>Username<input type="text" /></label>
Fix:
<label for="username-input">Username</label>
<input type="text" id="username-input" name="username" />

// Pattern 3: Multiple similar inputs in form
Apply same pattern to ALL similar inputs in the file

// React/Vue pattern
<div>
  <span>{label}</span>
  <input type="text" />
</div>
Fix:
<div>
  <label htmlFor={fieldId}>{label}</label>
  <input type="text" id={fieldId} name={name} />
</div>`,
        wcagCriteria: ['1.3.1 Info and Relationships', '3.3.2 Labels or Instructions'],
        severity: 'critical',
        applicableFrameworks: ['html', 'react', 'vue', 'angular', 'svelte']
    },

    {
        id: 'placeholder-to-label-conversion',
        category: 'Forms & Labels',
        name: 'Placeholder-to-Label Conversion',
        description: 'Detect inputs that only use placeholders ("Enter email") and suggest converting them into proper labels (<label> + input) and optional helper text. Apply this transformation pattern across the project.',
        detectionLogic: `
1. Find inputs with placeholder but no <label> element
2. Find inputs with placeholder but label has no text content
3. Check for: <input placeholder="..." /> without associated label
4. Search project-wide for this anti-pattern`,
        fixStrategy: `
Convert placeholders to proper labels:

// Before: Placeholder-only (WRONG)
<input type="email" placeholder="Enter your email address" />

// After: Proper label + optional helper text
<div class="form-group">
  <label for="email-input">Email Address</label>
  <input 
    type="email" 
    id="email-input"
    name="email"
    aria-describedby="email-hint" />
  <span id="email-hint" class="helper-text">We'll never share your email</span>
</div>

// React pattern
// Before:
<input placeholder="Enter username" />

// After:
<div className="form-group">
  <label htmlFor="username">Username</label>
  <input 
    id="username"
    name="username"
    placeholder="e.g., john_doe"
    aria-describedby="username-hint" />
  <small id="username-hint">Choose a unique username</small>
</div>

Note: Placeholder can remain as EXAMPLE text, not as the label replacement`,
        wcagCriteria: ['3.3.2 Labels or Instructions', '1.3.1 Info and Relationships'],
        severity: 'critical',
        applicableFrameworks: ['html', 'react', 'vue', 'angular', 'svelte']
    },

    {
        id: 'required-field-metadata-sync',
        category: 'Forms & Labels',
        name: 'Required Field Metadata Sync',
        description: 'Find fields visually marked as required (label with *, red border) but missing semantic markers (required, aria-required). Offer one-click semantic sync for all such fields.',
        detectionLogic: `
1. Find labels containing asterisk (*) or text "(required)"
2. Check if the associated input has:
   - required attribute
   - aria-required="true"
3. Find inputs with CSS classes like: required, error, invalid
4. Detect visual indicators without semantic markup`,
        fixStrategy: `
Sync visual required indicators with semantic markup:

// Pattern 1: Asterisk in label, no semantic required
<label for="name">Full Name *</label>
<input type="text" id="name" />
Fix:
<label for="name">Full Name *</label>
<input type="text" id="name" required aria-required="true" />

// Pattern 2: "(Required)" text
<label for="email">Email (Required)</label>
<input type="email" id="email" />
Fix:
<label for="email">Email (Required)</label>
<input type="email" id="email" required aria-required="true" />

// Pattern 3: CSS class indicating required
<input class="required-field" />
Fix:
<input class="required-field" required aria-required="true" />

// React pattern
<label>{label} *</label>
<input type="text" />
Fix:
<label>{label} *</label>
<input type="text" required aria-required="true" />

// Bulk fix: Find all fields with * or (required) in label and add semantic attributes`,
        wcagCriteria: ['3.3.2 Labels or Instructions', '4.1.2 Name, Role, Value'],
        severity: 'high',
        applicableFrameworks: ['html', 'react', 'vue', 'angular', 'svelte']
    },

    {
        id: 'error-message-binding',
        category: 'Forms & Labels',
        name: 'Error Message Binding Helper',
        description: 'Detect validation messages that aren\'t programmatically tied to their inputs. Auto-generate id for error elements and add aria-describedby to the corresponding fields, with "fix all similar errors" option.',
        detectionLogic: `
1. Find error message elements:
   - Elements with class: error, error-message, invalid-feedback, field-error
   - Elements with text like: "This field is required", "Invalid email"
2. Check if nearby input has aria-describedby linking to error message
3. Find validation message displays without ARIA connections
4. Look for form libraries' error display patterns`,
        fixStrategy: `
Bind error messages to inputs programmatically:

// Before: Error message not linked
<input type="email" id="email" />
<span class="error-message">Please enter a valid email</span>

// After: Error linked with aria-describedby
<input 
  type="email" 
  id="email"
  aria-describedby="email-error"
  aria-invalid="true" />
<span id="email-error" class="error-message" role="alert">
  Please enter a valid email
</span>

// Multiple helpers (hint + error)
<label for="password">Password</label>
<input 
  type="password"
  id="password"
  aria-describedby="password-hint password-error"
  aria-invalid="true" />
<span id="password-hint">Must be at least 8 characters</span>
<span id="password-error" role="alert">Password is too short</span>

// React pattern with conditional error
<input
  id="username"
  aria-describedby={error ? "username-error" : "username-hint"}
  aria-invalid={!!error}
/>
{error && (
  <span id="username-error" role="alert">{error}</span>
)}

// Bulk fix: Add aria-describedby and ids to all error message patterns`,
        wcagCriteria: ['3.3.1 Error Identification', '4.1.3 Status Messages'],
        severity: 'high',
        applicableFrameworks: ['html', 'react', 'vue', 'angular', 'svelte']
    },

    // ============================================
    // STRUCTURE & NAVIGATION PATTERNS
    // ============================================
    {
        id: 'skip-link-main-landmark',
        category: 'Structure & Navigation',
        name: 'Skip Link & Main Landmark Injector',
        description: 'Detect layouts missing "Skip to main content" link and <main> landmark. Inject a standard skip link and main region once into the shared layout, instantly fixing all pages using it.',
        detectionLogic: `
1. Search for <main> element or role="main"
2. Search for skip link: <a href="#main-content">Skip
3. Identify the main layout file:
   - App.jsx, App.tsx, Layout.jsx, _app.js, index.html
   - layout.component.html (Angular)
   - App.vue (Vue)
4. Check if skip link exists at the very beginning of <body> or root component`,
        fixStrategy: `
Inject skip link and main landmark into layout:

// HTML - Add to top of <body>
<!DOCTYPE html>
<html>
<head>...</head>
<body>
  <!-- Skip link (hidden until focused) -->
  <a href="#main-content" class="skip-link">Skip to main content</a>
  
  <header>...</header>
  <nav>...</nav>
  
  <main id="main-content" role="main">
    <!-- Page content -->
  </main>
  
  <footer>...</footer>
</body>
</html>

// CSS for skip link (add to main stylesheet)
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px;
  text-decoration: none;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}

// React App.jsx
function App() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Header />
      <Nav />
      <main id="main-content" role="main">
        {children}
      </main>
      <Footer />
    </>
  );
}

// Vue App.vue
<template>
  <div id="app">
    <a href="#main-content" class="skip-link">Skip to main content</a>
    <Header />
    <Nav />
    <main id="main-content" role="main">
      <router-view />
    </main>
    <Footer />
  </div>
</template>

// Angular app.component.html
<a href="#main-content" class="skip-link">Skip to main content</a>
<app-header></app-header>
<app-nav></app-nav>
<main id="main-content" role="main">
  <router-outlet></router-outlet>
</main>
<app-footer></app-footer>`,
        wcagCriteria: ['2.4.1 Bypass Blocks', '1.3.1 Info and Relationships'],
        severity: 'high',
        applicableFrameworks: ['html', 'react', 'vue', 'angular', 'svelte']
    },

    {
        id: 'semantic-layout-refactor',
        category: 'Structure & Navigation',
        name: 'Semantic Layout Refactor (Landmark Roles)',
        description: 'Recognize common layout wrappers (header, nav, content, footer classes) and suggest replacing generic <div>s with semantic elements (<header>, <nav>, <main>, <footer>) in one shot.',
        detectionLogic: `
1. Find divs with semantic class names or ids:
   - <div class="header">, <div id="header">
   - <div class="nav">, <div class="navigation">
   - <div class="main">, <div class="content">, <div id="main-content">
   - <div class="footer">
   - <div class="sidebar">
2. Find divs containing navigation lists
3. Find divs that wrap main page content
4. Search entire project for these patterns`,
        fixStrategy: `
Replace generic divs with semantic HTML5 elements:

// Before: Generic divs with semantic classes
<div class="header">
  <div class="logo">Logo</div>
  <div class="nav">
    <ul>
      <li><a href="/">Home</a></li>
      <li><a href="/about">About</a></li>
    </ul>
  </div>
</div>
<div class="main-content">
  <div class="sidebar">...</div>
  <div class="content">...</div>
</div>
<div class="footer">...</div>

// After: Semantic HTML5 elements with ARIA roles
<header role="banner">
  <div class="logo">Logo</div>
  <nav role="navigation" aria-label="Main navigation">
    <ul>
      <li><a href="/">Home</a></li>
      <li><a href="/about">About</a></li>
    </ul>
  </nav>
</header>

<main id="main-content" role="main">
  <aside role="complementary" aria-label="Sidebar">...</aside>
  <section class="content">...</section>
</main>

<footer role="contentinfo">...</footer>

// React pattern
// Before:
<div className="app-layout">
  <div className="header">...</div>
  <div className="main">...</div>
  <div className="footer">...</div>
</div>

// After:
<div className="app-layout">
  <header role="banner">...</header>
  <main role="main">...</main>
  <footer role="contentinfo">...</footer>
</div>

// Apply this refactor to ALL layout files in the project`,
        wcagCriteria: ['1.3.1 Info and Relationships', '2.4.1 Bypass Blocks'],
        severity: 'high',
        applicableFrameworks: ['html', 'react', 'vue', 'angular', 'svelte']
    },

    // ============================================
    // INTERACTIVE ELEMENTS & ARIA PATTERNS
    // ============================================
    {
        id: 'clickable-div-span-refactor',
        category: 'Interactive Elements',
        name: 'Clickable Div/Span Refactor to Buttons/Links',
        description: 'Identify non-semantic clickable elements (div/span with onClick) and suggest semantic replacements: Navigation → <a>/router Link, Actions → <button>',
        detectionLogic: `
1. Find clickable divs/spans:
   - <div onClick={...}>
   - <span onClick={...}>
   - Elements with cursor: pointer in CSS
   - Elements with class names containing: clickable, button, btn, link
2. Determine the semantic purpose:
   - If it navigates (changes URL/route) → should be <a> or <Link>
   - If it performs an action (submit, delete, open modal) → should be <button>
3. Check for proper keyboard support (onKeyDown, tabIndex)
4. Search entire codebase for these anti-patterns`,
        fixStrategy: `
Replace non-semantic clickable elements with proper HTML:

// Pattern 1: Clickable div for navigation
// Before:
<div className="nav-item" onClick={() => navigate('/about')}>
  About Us
</div>

// After (React Router):
<Link to="/about" className="nav-item">
  About Us
</Link>

// After (vanilla HTML):
<a href="/about" className="nav-item">
  About Us
</a>

// Pattern 2: Clickable div for action
// Before:
<div 
  className="delete-button" 
  onClick={handleDelete}
  style={{cursor: 'pointer'}}>
  Delete
</div>

// After:
<button 
  type="button"
  className="delete-button"
  onClick={handleDelete}>
  Delete
</button>

// Pattern 3: Span as button
// Before:
<span className="close-icon" onClick={onClose}>×</span>

// After:
<button 
  type="button"
  className="close-button"
  onClick={onClose}
  aria-label="Close dialog">
  <span aria-hidden="true">×</span>
</button>

// Pattern 4: Div with keyboard handlers (trying to fake a button)
// Before:
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}>
  Click me
</div>

// After (just use a button!):
<button type="button" onClick={handleClick}>
  Click me
</button>

// Vue pattern
// Before:
<div @click="handleAction" class="clickable">Action</div>

// After:
<button type="button" @click="handleAction">Action</button>

// Angular pattern
// Before:
<div (click)="performAction()" class="button-style">Action</div>

// After:
<button type="button" (click)="performAction()">Action</button>

// Search and replace ALL instances across the project`,
        wcagCriteria: ['4.1.2 Name, Role, Value', '2.1.1 Keyboard', '2.4.7 Focus Visible'],
        severity: 'critical',
        applicableFrameworks: ['html', 'react', 'vue', 'angular', 'svelte']
    }
];

/**
 * Get pattern recommendations based on detected issues
 */
export function getPatternRecommendations(issues: string[]): string {
    let recommendations = `
# 🎯 ACCESSIBILITY PATTERN INTELLIGENCE

Apply these proven accessibility patterns when fixing issues:

`;

    // Check which patterns are relevant based on issues
    const relevantPatterns = ACCESSIBILITY_PATTERNS.filter(pattern => {
        const issueText = issues.join(' ').toLowerCase();
        const patternKey = pattern.name.toLowerCase();
        
        // Match patterns to issues
        if (patternKey.includes('alt') && issueText.includes('image')) return true;
        if (patternKey.includes('label') && issueText.includes('label')) return true;
        if (patternKey.includes('form') && issueText.includes('form')) return true;
        if (patternKey.includes('landmark') && issueText.includes('landmark')) return true;
        if (patternKey.includes('button') && issueText.includes('button')) return true;
        if (patternKey.includes('clickable') && issueText.includes('click')) return true;
        
        return false;
    });

    // If specific patterns match, show those
    if (relevantPatterns.length > 0) {
        relevantPatterns.forEach(pattern => {
            recommendations += `
## ${pattern.name} (${pattern.severity.toUpperCase()} priority)
${pattern.description}

**Fix Strategy:**
${pattern.fixStrategy}

**WCAG:** ${pattern.wcagCriteria.join(', ')}

---
`;
        });
    } else {
        // Show all patterns as general guidance
        ACCESSIBILITY_PATTERNS.forEach(pattern => {
            recommendations += `
## ${pattern.name} (${pattern.category})
${pattern.description}

**Quick Fix Guide:**
${pattern.fixStrategy.split('\n').slice(0, 10).join('\n')}
...

---
`;
        });
    }

    recommendations += `
# 🔄 BULK OPERATION STRATEGIES

When fixing issues across the project:

1. **Search Phase**: Use grep_search to find ALL occurrences of the same issue pattern
2. **Fix Phase**: Apply the SAME fix to all instances you find
3. **Report Phase**: List all files you modified

Example: If you add alt text to "logo.png" in one file:
- Search: grep_search for "logo.png" across entire project
- Fix: Add the SAME alt text to ALL files containing logo.png
- Report: "Added alt='Company Logo' to logo.png in 5 files: header.tsx, footer.tsx, ..."

# ⚡ PRIORITY RULES

1. **CRITICAL**: Fix keyboard/screen reader blockers first
   - Unlabeled form inputs
   - Clickable divs without button/link semantics
   - Missing form field associations

2. **HIGH**: Fix content accessibility
   - Missing alt text on meaningful images
   - Missing skip links and landmarks
   - Missing semantic HTML structure

3. **MEDIUM**: Enhance user experience
   - Mark decorative images as decorative
   - Improve error message bindings
   - Add helper text to forms

`;

    return recommendations;
}

/**
 * Generate a comprehensive accessibility fix prompt with pattern intelligence
 */
export function generateEnhancedAccessibilityPrompt(issues: any[], context: any = {}): string {
    const issueDescriptions = issues.map(i => i.description || i.criterion || '').filter(Boolean);
    const patternGuidance = getPatternRecommendations(issueDescriptions);
    
    return `${patternGuidance}

# 🎯 YOUR SPECIFIC ISSUES TO FIX

${issues.map((issue, i) => `${i + 1}. **${issue.criterion}** (${issue.severity}): ${issue.description}`).join('\n')}

# 📋 EXECUTION CHECKLIST

- [ ] Read the relevant file(s)
- [ ] Apply pattern-based fixes from the guide above
- [ ] Search for similar issues across project (use grep_search)
- [ ] Fix ALL similar instances, not just one
- [ ] Ensure keyboard accessibility
- [ ] Ensure screen reader compatibility
- [ ] Use semantic HTML elements
- [ ] Add proper ARIA attributes where needed
- [ ] Test your changes make sense

Remember: Use the pattern strategies above to fix not just this instance, but ALL similar issues across the project!
`;
}

