# Accessibility Testing with NVDA - Quick Start

## 🎉 What's New

Your AccessLint extension now uses **REAL NVDA SCREEN READER AUTOMATION**! This means you'll see exactly what NVDA announces to users, not just static code analysis.

---

## ⚡ Quick Start (4 steps)

### 1. Setup NVDA Automation (One-Time)

**Windows only** - run this command once:

```bash
npx @guidepup/setup
```

Follow the prompts to grant NVDA automation permissions.

### 2. Run the Extension

Press `F5` in VSCode to launch the extension in debug mode.

### 3. Open the Testing Panel

- Click the **AccessLint** icon in the left sidebar (Activity Bar)
- You'll see **"Accessibility Testing"** panel

### 4. Test Your Website

- Start your dev server: `npm start` (or whatever you use)
- Enter URL: `localhost:3000`
- Click **"▶ Start Test"**
- **Watch NVDA navigate your site automatically!**

---

## 📢 **What's Different Now?**

### Before (Static Analysis):
```
❌ Image missing alt attribute
Element: <img src="logo.png">
```

### Now (Real NVDA Testing):
```
❌ Image has no alt text - NVDA announces it as unlabeled
📢 NVDA Announced: "unlabeled graphic"
Element: [image with no text]
```

**You see exactly what screen reader users hear!**

---

## 🧪 **What Happens During Testing**

1. **NVDA Starts** (silently - no sound)
2. **Browser Opens** (Chromium window appears)
3. **Page Loads** (your website)
4. **NVDA Navigates** using keyboard commands:
   - **H** key → Navigate through headings
   - **K** key → Navigate through links
   - **F** key → Navigate through forms
   - **D** key → Navigate through landmarks
   - **Down arrow** → Read sequentially

5. **Speech Captured** (what NVDA announces)
6. **Results Displayed** (issues with actual NVDA announcements)

---

## 📊 **Understanding Results**

### Three Types of Issues:

#### ❌ **Errors** (Must Fix)
- Images with no alt text
- Form fields with no labels
- Buttons with no text
- Links with no purpose

**Example**:
```
❌ 3.3.2 Labels or Instructions
Form field has no accessible label
📢 NVDA Announced: "edit, blank"
```

#### ⚠️ **Warnings** (Should Fix)
- Heading hierarchy skips
- Poor link text ("click here")
- Missing landmarks
- Unclear roles

**Example**:
```
⚠️ 1.3.2 Meaningful Sequence
Heading hierarchy skip from h1 to h3
📢 NVDA Announced: "heading level 3, Services"
```

#### ℹ️ **Info** (Good to Know)
- Landmarks detected
- Required fields marked
- Good practices found

**Example**:
```
ℹ️ General
Found 3 landmarks on page
📢 NVDA Announced: "main landmark"
```

---

## 🎯 **Real Examples**

### Testing a Form

**Bad (NVDA finds issues)**:
```html
<input type="text" />
<button>→</button>
```

**NVDA announces**: 
- "edit, blank" (no label!)
- "button" (no text!)

**Good (NVDA approves)**:
```html
<label for="email">Email address</label>
<input type="text" id="email" />
<button>Subscribe</button>
```

**NVDA announces**:
- "Email address, edit, blank"
- "Subscribe, button"

### Testing Images

**Bad**:
```html
<img src="logo.png">
```

**NVDA announces**: "unlabeled graphic" ❌

**Good**:
```html
<img src="logo.png" alt="Company logo">
```

**NVDA announces**: "Company logo, graphic" ✅

---

## 🚀 **Your First Test**

### Step-by-Step Example

1. **Open Terminal**, start your app:
   ```bash
   npm start
   # Runs on http://localhost:3000
   ```

2. **In VSCode**, press `F5`
   - Extension Development Host opens

3. **Click AccessLint icon** (left sidebar)

4. **Enter URL**: `localhost:3000`

5. **Click "Start Test"**
   - Browser opens
   - NVDA starts (no sound)
   - Watch automatic navigation!
   - See progress updates

6. **View Results**:
   ```
   ❌ 5 Errors    | Must fix
   ⚠️ 12 Warnings | Should fix  
   ℹ️ 3 Info      | Good to know
   
   20 NVDA interactions captured
   ```

7. **Review Issues**:
   - Each shows NVDA's actual announcement
   - Fix errors in your code
   - Re-run test to verify

---

## 💡 **Pro Tips**

### Effective Testing

✅ **DO**:
- Test during development (catch issues early)
- Focus on errors first
- Read what NVDA announces (learn from it)
- Fix systematic issues together
- Re-test after fixes

❌ **DON'T**:
- Test every tiny change (too slow)
- Ignore warnings (they matter!)
- Close the browser during testing
- Test without starting dev server

### Reading NVDA Announcements

When you see:
```
📢 NVDA Announced: "heading level 1, Welcome"
```

This means a screen reader user hears:
> "heading level 1, Welcome"

If it sounds confusing to you, it's confusing to them!

### Common Patterns

**Good Heading Announcement**:
```
📢 "heading level 1, Contact Us"
```

**Good Link Announcement**:
```
📢 "link, Read our blog"
```

**Good Form Announcement**:
```
📢 "Email address, edit, required, blank"
```

**Good Button Announcement**:
```
📢 "Submit form, button"
```

---

## 🐛 **Quick Troubleshooting**

### "NVDA failed to start"
```bash
# Run setup again
npx @guidepup/setup
```

### "Platform not supported"
- **NVDA only works on Windows**
- macOS: VoiceOver not implemented yet
- Linux: Not available

### Browser opens but nothing happens
- Check Output panel: View → Output → "AccessLint Testing"
- Make sure NVDA isn't already running
- Restart VSCode

### Page doesn't load
- Is your dev server running?
- Is the URL correct?
- Can you access it in regular browser?

---

## 📚 **What Gets Tested**

### 6 Test Categories:

1. **Headings** (H key navigation)
   - Hierarchy check (h1 → h2 → h3)
   - Meaningful text
   - No empty headings

2. **Links** (K key navigation)
   - Clear link purpose
   - Descriptive text (not "click here")
   - No empty links

3. **Forms** (F key navigation)
   - All fields have labels
   - Required fields marked
   - Field types clear

4. **Landmarks** (D key navigation)
   - Main, nav, header, footer
   - Proper semantic structure

5. **Sequential Reading** (Down arrow)
   - Natural reading order
   - Images have alt text
   - Content makes sense

6. **Interactive Elements** (B key for buttons)
   - Buttons have text
   - Roles are clear
   - Activation works

---

## 🎓 **Learn More**

**Full Guides**:
- `NVDA_SETUP_GUIDE.md` - Complete setup instructions
- `ACCESSIBILITY_TESTING_GUIDE.md` - Detailed testing guide

**NVDA Commands**:
- H = Next heading
- K = Next link
- F = Next form field
- D = Next landmark
- B = Next button

**Output Channels** (View → Output):
- "AccessLint Testing" - Testing logs
- "AccessLint Debug" - Debug info

---

## ✅ **Checklist Before First Test**

- [ ] Windows OS (NVDA only works on Windows)
- [ ] Ran `npx @guidepup/setup`
- [ ] Granted NVDA automation permissions
- [ ] Compiled extension (`npm run compile`)
- [ ] Pressed F5 to launch
- [ ] Dev server running
- [ ] Testing panel open

**Ready? Let's test!** 🚀

---

## 🎯 **Quick Command Reference**

```bash
# Setup (one-time)
npx @guidepup/setup

# Compile
npm run compile

# Launch extension
Press F5 in VSCode

# Start your site
npm start  # (or your command)

# Test!
1. Click AccessLint icon
2. Open "Accessibility Testing"
3. Enter "localhost:3000"
4. Click "Start Test"
5. Watch the magic! ✨
```

---

## 🌟 **What You'll Learn**

By using this tool, you'll:

- 📢 Hear what screen reader users hear
- 🔍 Find issues static analysis misses
- 🧠 Learn WCAG guidelines practically
- ⚡ Catch problems early
- ✅ Build accessible sites from the start

---

**Start testing now and make the web accessible!** 🎉

*Last Updated: 2025*  
*Powered by NVDA + Guidepup + Playwright*