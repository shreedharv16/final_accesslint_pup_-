# 🚀 Quick Reference: Accessibility Pattern Scenarios

## ✅ All 10 Scenarios Implemented (Excluding Video)

### 🖼️ Images & Media (3 patterns)

#### 1. Smart Alt Text Propagation ✅
**What it does:** When alt text is added to an image, automatically finds and fixes the SAME image across the entire project.

**Example:**
```
User: "Add alt text to logo.png"

Agent automatically:
1. Adds alt="Company Logo" to logo.png in current file
2. Searches entire project for logo.png
3. Finds it in header.tsx, footer.tsx, nav.tsx
4. Adds the SAME alt text to ALL 3 files
5. Reports: "Added alt='Company Logo' to logo.png in 4 locations"
```

#### 2. Component-Aware Alt Text Suggestions ✅
**What it does:** Provides context-aware alt text based on component type and props.

**Examples:**
- `<Avatar src={user.photo} userName="John" />` → Suggests `alt="Photo of John"`
- `<IconButton icon="delete" onClick={handleDelete} />` → Suggests `aria-label="Delete item"`
- `<ProductCard image={product.img} name="Widget" />` → Suggests `alt="Widget product image"`

#### 3. Decorative Image Auto-Classification ✅
**What it does:** Detects decorative images and marks them with `alt=""` and `role="presentation"`.

**Detected patterns:**
- Images with classes: `decoration`, `flourish`, `separator`, `background`
- Icons next to duplicate text (redundant)
- Small decorative elements

---

### 📝 Forms & Labels (4 patterns)

#### 4. Auto Link Labels to Inputs ✅
**What it does:** Finds unlabeled inputs and creates proper `for`/`id` associations.

**Example:**
```html
<!-- Before -->
<span>Email Address</span>
<input type="email" />

<!-- After (Auto-fixed) -->
<label for="email-input">Email Address</label>
<input type="email" id="email-input" name="email" />
```

#### 5. Placeholder-to-Label Conversion ✅
**What it does:** Converts placeholder-only inputs to proper label + input structure.

**Example:**
```html
<!-- Before (ANTI-PATTERN) -->
<input placeholder="Enter your email" />

<!-- After (Auto-fixed) -->
<label for="email">Email Address</label>
<input id="email" type="email" placeholder="e.g., user@example.com" />
```

#### 6. Required Field Metadata Sync ✅
**What it does:** Syncs visual required indicators (*) with semantic attributes.

**Example:**
```html
<!-- Before -->
<label>Full Name *</label>
<input type="text" />

<!-- After (Auto-fixed) -->
<label for="name">Full Name *</label>
<input type="text" id="name" required aria-required="true" />
```

#### 7. Error Message Binding Helper ✅
**What it does:** Links validation messages to inputs with `aria-describedby`.

**Example:**
```html
<!-- Before -->
<input type="email" />
<span class="error">Invalid email</span>

<!-- After (Auto-fixed) -->
<input type="email" id="email" aria-describedby="email-error" aria-invalid="true" />
<span id="email-error" role="alert">Invalid email</span>
```

---

### 🏗️ Structure & Navigation (2 patterns)

#### 8. Skip Link & Main Landmark Injector ✅
**What it does:** Adds skip link and main landmark to layouts.

**Auto-injected code:**
```html
<a href="#main-content" class="skip-link">Skip to main content</a>
<header role="banner">...</header>
<nav role="navigation">...</nav>
<main id="main-content" role="main">
  <!-- Page content -->
</main>
<footer role="contentinfo">...</footer>
```

**Plus CSS for skip link** (hidden until focused)

#### 9. Semantic Layout Refactor (Landmark Roles) ✅
**What it does:** Replaces generic divs with semantic HTML5 elements.

**Example:**
```html
<!-- Before -->
<div class="header">...</div>
<div class="nav">...</div>
<div class="content">...</div>
<div class="footer">...</div>

<!-- After (Auto-fixed) -->
<header role="banner">...</header>
<nav role="navigation">...</nav>
<main role="main">...</main>
<footer role="contentinfo">...</footer>
```

---

### 🎮 Interactive Elements (1 pattern)

#### 10. Clickable Div/Span Refactor to Buttons/Links ✅
**What it does:** Converts non-semantic clickable elements to proper buttons or links.

**Examples:**
```jsx
// Before (Navigation)
<div onClick={() => navigate('/about')}>About</div>

// After (Auto-fixed)
<Link to="/about">About</Link>
// or <a href="/about">About</a>

// Before (Action)
<div onClick={handleDelete}>Delete</div>

// After (Auto-fixed)
<button type="button" onClick={handleDelete}>Delete</button>

// Before (Icon button)
<span onClick={onClose}>×</span>

// After (Auto-fixed)
<button type="button" onClick={onClose} aria-label="Close dialog">
  <span aria-hidden="true">×</span>
</button>
```

---

## 🎯 How to Use These Patterns

### Method 1: Testing Menu (NVDA Screen Reader Tests)
1. Open AccessLint Testing panel
2. Enter your website URL (e.g., localhost:3000)
3. Click "Start Test"
4. Wait for NVDA to test your site
5. Click "Fix Accessibility Issues"
6. Select AI provider (GPT, Claude, or Gemini)
7. **Agent automatically applies ALL relevant patterns project-wide**

### Method 2: Chat Agent Mode
In the chat panel, ask questions like:
- "Make my form accessible"
- "Fix my navigation accessibility"
- "Add alt text to my images"
- "Convert my code to be WCAG compliant"
- "Create an accessibility report for my project"

**The agent will:**
1. Analyze your code
2. Identify which patterns apply
3. Search project-wide for similar issues
4. Apply fixes to ALL occurrences
5. Report what was changed

### Method 3: Quick Mode (Single Questions)
For specific questions:
- "How do I make this button accessible?"
- "What's wrong with this form?"
- Agent will reference patterns in its response

---

## 🔍 Project-Wide Fix Examples

### Example: Image Alt Text Across Repository

**Scenario:** You have `logo.png` used in 5 different files.

**Traditional approach:** Manually add alt text to each file (tedious!)

**AccessLint approach:**
1. Agent detects missing alt text on logo.png
2. Adds alt="Company Logo" to first instance
3. **Automatically searches project** with `grep_search` for "logo.png"
4. **Finds 4 more files** with the same image
5. **Applies the SAME alt text** to all 4 files
6. **Reports:** "Added alt='Company Logo' to logo.png in 5 locations: header.tsx, footer.tsx, nav.tsx, hero.tsx, about.tsx"

### Example: Clickable Divs Across Project

**Scenario:** Your project has 12 clickable divs that should be buttons.

**Traditional approach:** Manually refactor each div (time-consuming!)

**AccessLint approach:**
1. Agent detects one clickable div
2. Recognizes the pattern (onClick without semantic element)
3. **Searches project** for similar patterns: `<div.*onClick`
4. **Finds 11 more instances**
5. **Converts ALL 12** to proper buttons or links based on their purpose
6. **Reports:** "Converted 12 clickable divs to semantic elements across 8 files"

### Example: Form Labels Across Project

**Scenario:** Multiple forms with unlabeled inputs.

**Traditional approach:** Manually link labels in each form.

**AccessLint approach:**
1. Agent analyzes one form
2. Detects unlabeled inputs
3. **Searches for similar forms** across the project
4. **Applies label-linking pattern** to ALL forms
5. **Also searches for** placeholder-only inputs
6. **Converts them ALL** to proper labels
7. **Reports:** "Fixed 3 forms across the project: added labels to 15 inputs, converted 6 placeholder-only inputs"

---

## ✨ Key Benefits

### 1. Project-Wide Fixes
- Not just one file, but ALL files with the same issue
- Ensures consistency across your entire project

### 2. Smart Pattern Recognition
- Understands context (navigation vs action = link vs button)
- Component-aware (Avatar vs IconButton vs ProductCard)
- Decorator detection (flourish vs meaningful image)

### 3. Bulk Operations
- Fix dozens of similar issues at once
- Save hours of manual work

### 4. WCAG Compliance
- All patterns follow WCAG 2.1 AA/AAA guidelines
- Covers all 4 principles: Perceivable, Operable, Understandable, Robust

### 5. Framework Support
- Works with React, Vue, Angular, HTML, Svelte
- Adapts to your project's framework

---

## 📚 Detailed Documentation

For complete technical details, see:
- **ACCESSIBILITY_PATTERNS_IMPLEMENTATION.md** - Full implementation guide
- **src/accessibilityPatterns.ts** - Pattern definitions and detection logic
- **src/agentSystemPrompt.ts** - AI agent instructions

---

## 🎓 Learning Mode

The patterns serve as a **learning tool** - when the agent fixes issues, you can:
1. See the before/after code
2. Understand WHY the change was made
3. Learn accessibility best practices
4. Apply the same patterns in future code

---

## 🚫 Not Yet Implemented

**Video Captions (as requested):**
- Video caption reuse & draft generation
- Detecting same video on multiple pages
- Reusing approved caption files

This will be added in a future update.

---

## 💡 Pro Tips

1. **Use Testing Mode first** - Run NVDA tests to get comprehensive issue detection
2. **Chat Mode for exploration** - Ask "What accessibility issues might my project have?"
3. **Review changes** - Agent shows you all changes before applying
4. **Consistent patterns** - Once a pattern is applied, it's applied everywhere
5. **Save time** - Let the agent find and fix project-wide issues while you focus on features

---

## 📞 Support

If a pattern doesn't work as expected:
1. Check the detailed documentation in `ACCESSIBILITY_PATTERNS_IMPLEMENTATION.md`
2. Look at the pattern definition in `src/accessibilityPatterns.ts`
3. Review the AI agent's system prompt in `src/agentSystemPrompt.ts`

All patterns are designed to work across the entire project automatically! 🎉

