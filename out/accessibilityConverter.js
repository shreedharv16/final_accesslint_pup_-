"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessibilityConverter = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const anthropicChat_1 = require("./anthropicChat");
const fileOperations_1 = require("./fileOperations");
const bottomMenuProvider_1 = require("./bottomMenuProvider");
class AccessibilityConverter {
    constructor(context, sharedAnthropicProvider) {
        this.outputChannel = vscode.window.createOutputChannel('AccessLint Converter');
        // Use shared provider if available, otherwise create new instance
        this.anthropicChat = sharedAnthropicProvider || new anthropicChat_1.AnthropicChatProvider(context);
        this.fileOperations = new fileOperations_1.FileOperations();
        this.bottomMenu = new bottomMenuProvider_1.BottomMenuProvider();
    }
    async convertModule(module) {
        this.outputChannel.clear();
        this.outputChannel.appendLine('🔄 Starting module accessibility conversion...');
        this.outputChannel.appendLine(`📁 Converting module: ${module.name} (${module.files.length} files)`);
        this.outputChannel.appendLine('🎯 DEBUG: convertModule called - should show diff view for each file, not chat');
        try {
            // Debug: Check which provider is being used
            this.outputChannel.appendLine(`🔍 DEBUG: AccessibilityConverter using provider: ${this.anthropicChat.constructor.name}`);
            // Ensure Anthropic is properly initialized before checking configuration
            this.outputChannel.appendLine('⏳ DEBUG: Waiting for Anthropic initialization...');
            await this.anthropicChat.waitForInitialization();
            this.outputChannel.appendLine('✅ DEBUG: Anthropic initialization completed');
            // Check if Anthropic is configured
            const isConfigured = await this.anthropicChat.isConfigured();
            this.outputChannel.appendLine(`🔑 DEBUG: Anthropic isConfigured: ${isConfigured}`);
            if (!isConfigured) {
                this.outputChannel.appendLine('❌ DEBUG: Claude API key not configured - throwing error');
                throw new Error('Claude API key not configured. Please set up your API key first.');
            }
            this.outputChannel.appendLine('✅ DEBUG: Claude API key is configured and ready');
            // Read all files in the module
            const fileContents = [];
            for (const file of module.files) {
                try {
                    const content = await this.fileOperations.readFile(file.path);
                    fileContents.push({ file, content });
                    this.outputChannel.appendLine(`📖 Read ${content.length} characters from ${file.path}`);
                }
                catch (error) {
                    this.outputChannel.appendLine(`⚠️ Failed to read ${file.path}: ${error}`);
                }
            }
            if (fileContents.length === 0) {
                throw new Error('No files could be read from the module');
            }
            // Send all files to Claude for conversion as a cohesive module
            const prompt = this.buildModuleAccessibilityPrompt(fileContents, module);
            this.outputChannel.appendLine('🤖 Sending module to Claude AI...');
            this.outputChannel.appendLine(`📝 DEBUG: Prompt length: ${prompt.length} characters`);
            this.outputChannel.appendLine(`📋 DEBUG: File contents loaded: ${fileContents.length} files`);
            this.outputChannel.appendLine('🚀 DEBUG: Calling anthropicChat.sendMessage()...');
            const aiResponse = await this.anthropicChat.sendMessage(prompt);
            this.outputChannel.appendLine('📨 DEBUG: Received response from Claude AI');
            this.outputChannel.appendLine(`📄 DEBUG: Response length: ${aiResponse.length} characters`);
            this.outputChannel.appendLine(`📄 DEBUG: Response preview: ${aiResponse.substring(0, 200)}...`);
            const moduleConversionData = this.parseModuleResponse(aiResponse, fileContents);
            this.outputChannel.appendLine(`🔧 DEBUG: Parsed ${moduleConversionData.length} file conversions`);
            if (!moduleConversionData || moduleConversionData.length === 0) {
                throw new Error('AI could not generate improved code for the module');
            }
            this.outputChannel.appendLine('✅ AI module conversion completed');
            this.outputChannel.appendLine(`📊 Converted ${moduleConversionData.length} files with accessibility improvements`);
            return {
                success: true,
                moduleResults: moduleConversionData,
                moduleName: module.name
            };
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.outputChannel.appendLine(`❌ Module conversion failed: ${errorMsg}`);
            return {
                success: false,
                error: errorMsg,
                moduleName: module.name
            };
        }
    }
    async showModuleDiffAndApply(result, chatProvider) {
        this.outputChannel.appendLine('🎯 DEBUG: showModuleDiffAndApply called - showing diff views for each file with accept/reject options');
        if (!result.success || !result.moduleResults) {
            this.outputChannel.appendLine('❌ DEBUG: Invalid module result data, cannot show diffs');
            return false;
        }
        let allAccepted = true;
        // Process each file in the module
        for (const fileResult of result.moduleResults) {
            if (!fileResult.success || !fileResult.improvedCode) {
                continue;
            }
            try {
                // Create backup first
                const originalContent = await this.fileOperations.readFile(fileResult.filePath);
                const backupPath = await this.fileOperations.createBackup(fileResult.filePath, originalContent);
                this.outputChannel.appendLine(`💾 Backup created for ${fileResult.filePath}: ${backupPath}`);
                // Get the actual file URI using our workspace file resolution
                const originalUri = this.getWorkspaceFileUri(fileResult.filePath);
                // Create in-memory document for improved version (no temp file needed!)
                const fileName = path.basename(fileResult.filePath);
                // Create a virtual document for the diff view
                const improvedContent = fileResult.improvedCode;
                const scheme = 'accesslint-preview';
                const improvedUri = vscode.Uri.parse(`${scheme}:${fileName}.accessible${path.extname(fileName)}`);
                // Register a temporary document provider for this diff
                const disposable = vscode.workspace.registerTextDocumentContentProvider(scheme, {
                    provideTextDocumentContent(uri) {
                        return improvedContent;
                    }
                });
                // Show diff view between original file and virtual improved version
                this.outputChannel.appendLine(`📊 DEBUG: Opening diff view for ${result.moduleName} - ${fileName}`);
                await vscode.commands.executeCommand('vscode.diff', originalUri, improvedUri, `${result.moduleName} - ${fileName} ↔ Accessible Version`, { preview: false });
                this.outputChannel.appendLine(`✅ DEBUG: Diff view opened for ${result.moduleName} - ${fileName}`);
                // Show bottom menu for accept/reject
                this.outputChannel.appendLine(`🎛️ DEBUG: Showing accept/reject bottom menu for ${result.moduleName} - ${fileName}`);
                const accepted = await new Promise((resolve) => {
                    const changesCount = fileResult.changes?.length || 0;
                    this.bottomMenu.showMenu(
                    // Accept callback
                    async () => {
                        try {
                            // Apply the changes by overwriting the original file
                            await this.fileOperations.writeFile(fileResult.filePath, fileResult.improvedCode);
                            // Dispose of the virtual document provider
                            disposable.dispose();
                            // Close the diff view
                            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                            this.outputChannel.appendLine(`✅ Changes applied to ${fileName}`);
                            // Show explanation in chat after successful application
                            if (chatProvider && fileResult.explanation) {
                                this.outputChannel.appendLine(`💬 DEBUG: Showing explanation in chat for accepted changes to ${fileName}`);
                                setTimeout(() => {
                                    const moduleFileResult = {
                                        success: true,
                                        improvedCode: fileResult.improvedCode,
                                        explanation: fileResult.explanation,
                                        changes: fileResult.changes,
                                        originalFile: fileResult.filePath
                                    };
                                    chatProvider.showConversionExplanation(moduleFileResult);
                                }, 1000);
                            }
                            else {
                                this.outputChannel.appendLine(`⚠️ DEBUG: No chat provider or explanation available for ${fileName}`);
                            }
                            resolve(true);
                        }
                        catch (error) {
                            this.outputChannel.appendLine(`❌ Failed to apply changes to ${fileName}: ${error}`);
                            vscode.window.showErrorMessage(`Failed to apply changes to ${fileName}`);
                            resolve(false);
                        }
                    }, 
                    // Reject callback
                    async () => {
                        try {
                            // Dispose of the virtual document provider
                            disposable.dispose();
                            // Close the diff view
                            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                            this.outputChannel.appendLine(`❌ Changes rejected for ${fileName}`);
                            resolve(false);
                        }
                        catch (error) {
                            this.outputChannel.appendLine(`❌ Failed to cleanup ${fileName}: ${error}`);
                            resolve(false);
                        }
                    }, changesCount, `${result.moduleName} - ${fileName}`);
                });
                if (!accepted) {
                    allAccepted = false;
                }
                // Small delay between files to avoid overwhelming the user
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                this.outputChannel.appendLine(`❌ Failed to show diff for ${fileResult.filePath}: ${errorMsg}`);
                allAccepted = false;
            }
        }
        // Show final summary
        const appliedCount = result.moduleResults.filter(r => r.success).length;
        if (allAccepted && appliedCount > 0) {
            vscode.window.showInformationMessage(`🎉 Module "${result.moduleName}" successfully converted! ${appliedCount} files made accessible.`);
        }
        else if (appliedCount > 0) {
            vscode.window.showInformationMessage(`⚠️ Module "${result.moduleName}" partially converted. ${appliedCount} files processed.`);
        }
        return allAccepted;
    }
    async convertFile(filePath) {
        this.outputChannel.clear();
        this.outputChannel.appendLine('🔄 Starting accessibility conversion...');
        this.outputChannel.appendLine('🎯 DEBUG: convertFile called - should show diff view, not chat');
        try {
            // Debug: Check which provider is being used
            this.outputChannel.appendLine(`🔍 DEBUG: AccessibilityConverter using provider: ${this.anthropicChat.constructor.name}`);
            // Ensure Claude is properly initialized before checking configuration
            this.outputChannel.appendLine('⏳ DEBUG: Waiting for Claude initialization...');
            await this.anthropicChat.waitForInitialization();
            this.outputChannel.appendLine('✅ DEBUG: Claude initialization completed');
            // Auto-detect file if not provided
            const targetFile = filePath || this.getActiveFile();
            if (!targetFile) {
                throw new Error('No file selected. Please open a file in the editor.');
            }
            this.outputChannel.appendLine(`📁 Converting file: ${targetFile}`);
            // Check if file type is supported
            if (!this.isSupportedFileType(targetFile)) {
                throw new Error(`File type not supported: ${path.extname(targetFile)}`);
            }
            // Check if Claude is configured
            const isConfigured = await this.anthropicChat.isConfigured();
            this.outputChannel.appendLine(`🔑 DEBUG: Claude isConfigured: ${isConfigured}`);
            if (!isConfigured) {
                this.outputChannel.appendLine('❌ DEBUG: Claude API key not configured - throwing error');
                throw new Error('Claude API key not configured. Please set up your API key first.');
            }
            this.outputChannel.appendLine('✅ DEBUG: Claude API key is configured and ready');
            // Read original file content
            const originalContent = await this.fileOperations.readFile(targetFile);
            this.outputChannel.appendLine(`📖 Read ${originalContent.length} characters from file`);
            // Send to Claude for conversion
            const prompt = this.buildAccessibilityPrompt(originalContent, targetFile);
            this.outputChannel.appendLine('🤖 Sending to Claude AI...');
            this.outputChannel.appendLine(`📝 DEBUG: Prompt length: ${prompt.length} characters`);
            this.outputChannel.appendLine(`📄 DEBUG: Original file content length: ${originalContent.length} characters`);
            this.outputChannel.appendLine('🚀 DEBUG: Calling anthropicChat.sendMessage()...');
            const aiResponse = await this.anthropicChat.sendMessage(prompt);
            this.outputChannel.appendLine('📨 DEBUG: Received response from Claude AI');
            this.outputChannel.appendLine(`📄 DEBUG: Response length: ${aiResponse.length} characters`);
            this.outputChannel.appendLine(`📄 DEBUG: Response preview: ${aiResponse.substring(0, 200)}...`);
            const conversionData = this.parseResponse(aiResponse);
            this.outputChannel.appendLine(`🔧 DEBUG: Parsed conversion data with ${conversionData.changes?.length || 0} changes`);
            if (!conversionData.improvedCode) {
                throw new Error('AI could not generate improved code');
            }
            this.outputChannel.appendLine('✅ AI conversion completed');
            this.outputChannel.appendLine(`📊 Found ${conversionData.changes?.length || 0} accessibility improvements`);
            return {
                success: true,
                improvedCode: conversionData.improvedCode,
                explanation: conversionData.explanation,
                changes: conversionData.changes,
                originalFile: targetFile
            };
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.outputChannel.appendLine(`❌ Conversion failed: ${errorMsg}`);
            return {
                success: false,
                error: errorMsg
            };
        }
    }
    async showDiffAndApply(result, chatProvider) {
        this.outputChannel.appendLine('🎯 DEBUG: showDiffAndApply called - showing diff view with accept/reject options');
        if (!result.success || !result.improvedCode || !result.originalFile) {
            this.outputChannel.appendLine('❌ DEBUG: Invalid result data, cannot show diff');
            return false;
        }
        try {
            // Create backup first
            const originalContent = await this.fileOperations.readFile(result.originalFile);
            const backupPath = await this.fileOperations.createBackup(result.originalFile, originalContent);
            this.outputChannel.appendLine(`💾 Backup created: ${backupPath}`);
            // Get the original file URI using our workspace file resolution
            const originalUri = this.getWorkspaceFileUri(result.originalFile);
            // Create in-memory document for improved version (no temp file needed!)
            const fileName = path.basename(result.originalFile);
            // Create a virtual document for the diff view
            const improvedContent = result.improvedCode;
            const scheme = 'accesslint-preview';
            const improvedUri = vscode.Uri.parse(`${scheme}:${fileName}.accessible${path.extname(fileName)}`);
            // Register a temporary document provider for this diff
            const disposable = vscode.workspace.registerTextDocumentContentProvider(scheme, {
                provideTextDocumentContent(uri) {
                    return improvedContent;
                }
            });
            // Show diff view between original file and virtual improved version
            this.outputChannel.appendLine(`📊 DEBUG: Opening diff view for ${fileName}`);
            await vscode.commands.executeCommand('vscode.diff', originalUri, improvedUri, `${fileName} ↔ Accessible Version`, { preview: false });
            this.outputChannel.appendLine(`✅ DEBUG: Diff view opened for ${fileName}`);
            // Show bottom menu for accept/reject
            this.outputChannel.appendLine(`🎛️ DEBUG: Showing accept/reject bottom menu for ${fileName}`);
            return new Promise((resolve) => {
                const changesCount = result.changes?.length || 0;
                this.bottomMenu.showMenu(
                // Accept callback
                async () => {
                    try {
                        // Apply the changes by overwriting the original file
                        await this.fileOperations.writeFile(result.originalFile, result.improvedCode);
                        // Dispose of the virtual document provider
                        disposable.dispose();
                        // Close the diff view
                        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                        this.outputChannel.appendLine('✅ Changes applied successfully');
                        // Show explanation in chat after successful application
                        if (chatProvider && result.explanation) {
                            this.outputChannel.appendLine(`💬 DEBUG: Showing explanation in chat for accepted changes`);
                            setTimeout(() => {
                                chatProvider.showConversionExplanation(result);
                            }, 1000);
                        }
                        else {
                            this.outputChannel.appendLine(`⚠️ DEBUG: No chat provider or explanation available`);
                        }
                        vscode.window.showInformationMessage('🎉 File successfully converted to be more accessible!');
                        resolve(true);
                    }
                    catch (error) {
                        this.outputChannel.appendLine(`❌ Failed to apply changes: ${error}`);
                        vscode.window.showErrorMessage('Failed to apply changes');
                        resolve(false);
                    }
                }, 
                // Reject callback
                async () => {
                    try {
                        // Dispose of the virtual document provider
                        disposable.dispose();
                        // Close the diff view
                        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                        this.outputChannel.appendLine('❌ Changes rejected by user');
                        vscode.window.showInformationMessage('Changes rejected. Original file unchanged.');
                        resolve(false);
                    }
                    catch (error) {
                        this.outputChannel.appendLine(`❌ Failed to cleanup: ${error}`);
                        resolve(false);
                    }
                }, changesCount, fileName);
            });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            this.outputChannel.appendLine(`❌ Failed to show diff: ${errorMsg}`);
            vscode.window.showErrorMessage(`Failed to show changes: ${errorMsg}`);
            return false;
        }
    }
    buildModuleAccessibilityPrompt(fileContents, module) {
        const fileList = fileContents.map(fc => `${fc.file.path} (${fc.file.type})`).join(', ');
        // Determine if this is an Angular component/module
        const hasAngularFiles = fileContents.some(fc => fc.file.extension === '.ts' && fc.content.includes('@Component'));
        let prompt = `You are an expert Angular accessibility consultant with deep knowledge of WCAG 2.1 AA/AAA compliance and Angular best practices. Convert this complete ${hasAngularFiles ? 'Angular component/module' : 'web module'} to be fully accessible and inclusive.

**Module:** ${module.name}
**Directory:** ${module.directory}
**Files:** ${fileList}
**Task:** Transform this module into a completely accessible, WCAG 2.1 AA compliant Angular component with exceptional usability

**CRITICAL ACCESSIBILITY REQUIREMENTS:**

**1. WCAG 2.1 Compliance (MANDATORY):**
- **Perceivable:** Alt text, captions, color contrast ≥4.5:1, scalable text, meaningful headings
- **Operable:** Full keyboard navigation, no seizure triggers, sufficient click targets (44x44px min)
- **Understandable:** Clear language, consistent navigation, error prevention/handling
- **Robust:** Valid HTML, ARIA compliance, assistive technology compatibility

**2. Angular-Specific Accessibility:**
- Import and use Angular CDK A11y module (LiveAnnouncer, FocusTrap, etc.)
- Implement Angular Material accessibility features
- Use Angular Reactive Forms with proper validation and error announcements
- Add Angular animations with \`prefers-reduced-motion\` respect
- Implement Angular Router accessibility (focus management, announcements)
- Use Angular's built-in accessibility testing utilities

**3. Component Architecture:**
- Create accessible Angular directives and services
- Implement proper component lifecycle accessibility
- Use Angular's \`OnPush\` change detection with accessibility considerations
- Add accessibility-focused Angular pipes and services

**4. Template Accessibility (.html files):**
- Semantic HTML5 elements (header, nav, main, aside, footer, section, article)
- Proper heading hierarchy (h1-h6) without skipping levels
- ARIA landmarks: role="navigation", role="main", role="complementary", role="contentinfo"
- Form labels and fieldsets with legends
- Button vs link distinction (buttons for actions, links for navigation)
- Focus management and visual focus indicators
- Skip links for navigation
- Live regions for dynamic content (\`aria-live\`, \`aria-atomic\`)
- Progressive enhancement approach

**5. TypeScript Implementation (.ts files):**
- Angular CDK A11y imports: \`import { LiveAnnouncer, FocusTrap, A11yModule } from '@angular/cdk/a11y';\`
- Keyboard event handling (Enter, Space, Escape, Tab, Arrow keys)
- Focus management with ViewChild and ElementRef
- ARIA attribute management via Angular bindings
- Screen reader announcements using LiveAnnouncer
- Accessible component state management
- Input validation with accessibility feedback
- Error handling with proper announcements
- Angular services for accessibility utilities

**6. SCSS/CSS Styling (.scss files):**
- Color contrast ratios ≥4.5:1 (normal text), ≥3:1 (large text)
- Focus indicators: visible, high contrast, not just color-dependent
- Media queries: \`@media (prefers-reduced-motion: reduce)\`, \`@media (prefers-color-scheme: dark)\`
- Scalable typography (rem/em units)
- Touch targets ≥44x44px
- Visual hierarchy without relying solely on color
- High contrast mode support (\`@media (prefers-contrast: high)\`)
- Print accessibility styles

**Module Files Analysis:**\n`;
        // Add each file's content with enhanced context
        fileContents.forEach(({ file, content }, index) => {
            const fileType = file.extension.slice(1);
            const isComponent = content.includes('@Component');
            const isService = content.includes('@Injectable');
            const isTemplate = file.extension === '.html';
            const isStyle = ['.scss', '.css', '.sass'].includes(file.extension);
            prompt += `
**File ${index + 1}: ${file.path}**
**Type: ${file.type}** ${isComponent ? '(Angular Component)' : isService ? '(Angular Service)' : isTemplate ? '(Angular Template)' : isStyle ? '(Styles)' : ''}
\`\`\`${fileType}
${content}
\`\`\`

`;
        });
        prompt += `**COMPREHENSIVE ACCESSIBILITY IMPLEMENTATION GUIDE:**

**For Angular Components (.ts files):**
\`\`\`typescript
// Required imports for accessibility
import { Component, ViewChild, ElementRef, HostListener, inject } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  // Accessibility metadata
})
export class AccessibleComponent {
  private liveAnnouncer = inject(LiveAnnouncer);
  
  // Focus management
  @ViewChild('firstFocusable') firstFocusable!: ElementRef;
  
  // Keyboard navigation
  @HostListener('keydown', ['$event'])
  handleKeydown(event: KeyboardEvent) {
    // Implement keyboard shortcuts and navigation
  }
  
  // Screen reader announcements
  announceChange(message: string) {
    this.liveAnnouncer.announce(message);
  }
}
\`\`\`

**For Templates (.html files):**
\`\`\`html
<!-- Skip navigation -->
<a class="skip-link" href="#main-content">Skip to main content</a>

<!-- Semantic structure -->
<header role="banner">
  <nav role="navigation" [attr.aria-label]="navLabel">
    <!-- Navigation with proper ARIA -->
  </nav>
</header>

<main id="main-content" role="main">
  <!-- Forms with proper labeling -->
  <form [formGroup]="form" novalidate>
    <fieldset>
      <legend>Required Information</legend>
      <div class="form-group">
        <label for="email">Email Address *</label>
        <input 
          id="email" 
          type="email" 
          formControlName="email"
          [attr.aria-describedby]="emailError ? 'email-error' : null"
          [attr.aria-invalid]="emailError ? 'true' : 'false'"
          required>
        <div id="email-error" 
             *ngIf="emailError" 
             role="alert" 
             aria-live="polite">
          {{emailError}}
        </div>
      </div>
    </fieldset>
  </form>
  
  <!-- Dynamic content with live regions -->
  <div aria-live="polite" aria-atomic="true">
    <p *ngIf="statusMessage">{{statusMessage}}</p>
  </div>
</main>
\`\`\`

**For Styles (.scss files):**
\`\`\`scss
// Color contrast compliance
$primary-color: #0066cc; // Ensures 4.5:1 contrast
$focus-color: #005bb5;

// Focus indicators
.focus-visible {
  outline: 3px solid $focus-color;
  outline-offset: 2px;
}

// Reduced motion support
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

// High contrast mode
@media (prefers-contrast: high) {
  .button {
    border: 2px solid;
  }
}

// Touch targets
.clickable {
  min-height: 44px;
  min-width: 44px;
}
\`\`\`

**RESPONSE FORMAT:** Respond ONLY with valid JSON in this exact format:
{
  "files": [
    {
      "filePath": "${fileContents[0]?.file.path}",
      "improvedCode": "Complete production-ready Angular code with comprehensive accessibility implementation",
      "explanation": "Detailed explanation of all accessibility improvements, WCAG compliance measures, and Angular-specific enhancements implemented",
      "changes": [
        {"line": 1, "type": "angular-cdk-import", "reason": "Added Angular CDK A11y imports for LiveAnnouncer, FocusTrap, and accessibility utilities"},
        {"line": 5, "type": "aria-attributes", "reason": "Added comprehensive ARIA attributes for screen reader support"},
        {"line": 12, "type": "keyboard-navigation", "reason": "Implemented full keyboard navigation with Enter, Space, and Arrow key support"},
        {"line": 18, "type": "semantic-html", "reason": "Replaced div with semantic button element for proper accessibility"},
        {"line": 25, "type": "focus-management", "reason": "Added focus trap and proper focus indicators"},
        {"line": 30, "type": "color-contrast", "reason": "Enhanced color contrast to meet WCAG AA standards (4.5:1 ratio)"},
        {"line": 35, "type": "live-region", "reason": "Added live regions for dynamic content announcements"},
        {"line": 40, "type": "form-validation", "reason": "Implemented accessible form validation with proper error announcements"},
        {"line": 45, "type": "responsive-design", "reason": "Added responsive design with minimum touch target sizes"},
        {"line": 50, "type": "reduced-motion", "reason": "Added support for users who prefer reduced motion"}
      ]
    }${fileContents.length > 1 ? ',' : ''}
    ${fileContents.slice(1).map((fc, i) => `{
      "filePath": "${fc.file.path}",
      "improvedCode": "Complete accessible implementation for this ${fc.file.type} file",
      "explanation": "Comprehensive accessibility improvements and WCAG compliance measures",
      "changes": [
        {"line": 1, "type": "accessibility-enhancement", "reason": "Applied accessibility best practices specific to ${fc.file.extension} files"}
      ]
    }`).join(',\n    ')}
  ]
}

**CRITICAL SUCCESS CRITERIA:**
✅ All interactive elements are keyboard accessible
✅ Screen readers can navigate and understand all content
✅ Color contrast meets WCAG AA standards
✅ Focus indicators are clearly visible
✅ Forms have proper labels and error handling
✅ Dynamic content is announced to assistive technologies
✅ Angular CDK A11y utilities are properly integrated
✅ Semantic HTML structure is maintained
✅ Touch targets meet minimum size requirements
✅ Motion preferences are respected

Create production-ready, enterprise-grade accessible Angular code that serves as a best practice example for inclusive web development.`;
        return prompt;
    }
    parseModuleResponse(response, fileContents) {
        try {
            // Try to extract JSON from the response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            const parsed = JSON.parse(jsonMatch[0]);
            if (!parsed.files || !Array.isArray(parsed.files)) {
                throw new Error('Invalid response format - missing files array');
            }
            const results = [];
            for (const fileData of parsed.files) {
                // Find the corresponding file from our original list
                const originalFile = fileContents.find(fc => fc.file.path === fileData.filePath ||
                    path.basename(fc.file.path) === path.basename(fileData.filePath));
                if (originalFile && fileData.improvedCode) {
                    results.push({
                        filePath: originalFile.file.path,
                        success: true,
                        improvedCode: fileData.improvedCode,
                        explanation: fileData.explanation || 'Accessibility improvements applied',
                        changes: fileData.changes || []
                    });
                }
            }
            return results;
        }
        catch (error) {
            this.outputChannel.appendLine(`⚠️ Failed to parse module AI response as JSON: ${error}`);
            // Fallback: create basic results for each file
            return fileContents.map(fc => ({
                filePath: fc.file.path,
                success: false,
                error: 'Failed to parse AI response'
            }));
        }
    }
    getActiveFile() {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.uri.scheme === 'file') {
            return activeEditor.document.uri.fsPath;
        }
        // If no active editor, try to get from explorer selection
        return undefined;
    }
    isSupportedFileType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath).toLowerCase();
        // Angular and general web development file types
        const supportedTypes = [
            // TypeScript/JavaScript
            '.js', '.jsx', '.ts', '.tsx',
            // Templates
            '.html', '.htm',
            // Styles
            '.css', '.scss', '.sass', '.less',
            // Frameworks
            '.vue', '.svelte', '.angular.html',
            // Angular specific
            '.component.ts', '.component.html', '.component.scss',
            '.service.ts', '.directive.ts', '.pipe.ts', '.module.ts',
            // Other web files
            '.json' // For Angular configuration files
        ];
        // Check by extension
        if (supportedTypes.includes(ext)) {
            return true;
        }
        // Check Angular-specific patterns
        if (ext === '.ts' && (fileName.includes('.component.') ||
            fileName.includes('.service.') ||
            fileName.includes('.directive.') ||
            fileName.includes('.pipe.') ||
            fileName.includes('.module.') ||
            fileName.includes('.guard.') ||
            fileName.includes('.resolver.'))) {
            return true;
        }
        // Check Angular template patterns
        if (ext === '.html' && (fileName.includes('.component.') ||
            fileName.includes('template'))) {
            return true;
        }
        // Check Angular style patterns
        if (['.scss', '.css', '.sass'].includes(ext) && (fileName.includes('.component.') ||
            fileName.includes('styles'))) {
            return true;
        }
        return false;
    }
    buildAccessibilityPrompt(code, filePath) {
        const fileType = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath);
        // Detect if this is an Angular file
        const isAngularComponent = code.includes('@Component');
        const isAngularService = code.includes('@Injectable');
        const isAngularTemplate = fileType === '.html' && (code.includes('*ngFor') || code.includes('*ngIf') || code.includes('[attr.'));
        const isAngular = isAngularComponent || isAngularService || isAngularTemplate;
        return `You are an expert Angular accessibility consultant with deep knowledge of WCAG 2.1 AA/AAA compliance. Convert this ${isAngular ? 'Angular' : 'web'} ${fileType} file to be fully accessible and inclusive.

**File:** ${fileName}
**Type:** ${isAngularComponent ? 'Angular Component' : isAngularService ? 'Angular Service' : isAngularTemplate ? 'Angular Template' : fileType + ' file'}
**Task:** Transform this file into a completely accessible, WCAG 2.1 AA compliant implementation

**WCAG 2.1 COMPLIANCE REQUIREMENTS:**

**1. Perceivable:**
- Alt text for all images and meaningful graphics
- Color contrast ≥4.5:1 for normal text, ≥3:1 for large text
- Scalable text up to 200% without horizontal scrolling
- Multiple ways to identify content (not just color)

**2. Operable:**
- Full keyboard navigation (Tab, Enter, Space, Escape, Arrow keys)
- No seizure-inducing content
- Sufficient time limits with user control
- Touch targets ≥44x44px

**3. Understandable:**
- Clear, simple language
- Consistent navigation and interaction patterns
- Input assistance and error prevention
- Error identification and suggestions

**4. Robust:**
- Valid HTML markup
- Compatible with assistive technologies
- Future-proof accessibility implementation

**${isAngular ? 'ANGULAR-SPECIFIC' : 'WEB'} ACCESSIBILITY REQUIREMENTS:**

${isAngular ? `**Angular CDK A11y Integration:**
- Import and implement: \`LiveAnnouncer\`, \`FocusTrap\`, \`A11yModule\`
- Use Angular Material accessibility features
- Implement Angular Reactive Forms with validation announcements
- Add Angular Router accessibility (focus management)
- Respect \`prefers-reduced-motion\` in Angular animations

**Angular Component Best Practices:**
- Proper component lifecycle accessibility hooks
- ViewChild/ElementRef for focus management
- HostListener for keyboard events
- Angular services for accessibility utilities
- OnPush change detection considerations

**Angular Template Enhancements:**
- Angular structural directives with accessibility
- Property and attribute binding for ARIA
- Angular forms with proper validation feedback
- Dynamic content with live regions
- Angular CDK focus trap implementation` : `**Web Accessibility Standards:**
- Semantic HTML5 elements
- ARIA landmarks and attributes
- Focus management and indicators
- Keyboard event handling
- Screen reader compatibility`}

**Code to improve:**
\`\`\`${fileType.slice(1)}
${code}
\`\`\`

**COMPREHENSIVE IMPLEMENTATION GUIDELINES:**

**For TypeScript/Component Files (.ts):**
\`\`\`typescript
import { Component, ViewChild, ElementRef, HostListener, inject } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { FormBuilder, Validators } from '@angular/forms';

@Component({
  selector: 'app-accessible',
  templateUrl: './accessible.component.html',
  styleUrls: ['./accessible.component.scss']
})
export class AccessibleComponent {
  private liveAnnouncer = inject(LiveAnnouncer);
  
  @ViewChild('primaryButton') primaryButton!: ElementRef;
  
  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    switch(event.key) {
      case 'Enter':
      case ' ':
        if (event.target === this.primaryButton.nativeElement) {
          this.handleAction();
          event.preventDefault();
        }
        break;
      case 'Escape':
        this.handleEscape();
        break;
    }
  }
  
  handleAction() {
    this.liveAnnouncer.announce('Action completed successfully');
  }
}
\`\`\`

**For Template Files (.html):**
\`\`\`html
<!-- Skip navigation -->
<a class="skip-link" href="#main-content">Skip to main content</a>

<!-- Semantic structure with ARIA landmarks -->
<header role="banner">
  <h1>Page Title</h1>
  <nav role="navigation" aria-label="Main navigation">
    <!-- Navigation items -->
  </nav>
</header>

<main id="main-content" role="main">
  <!-- Content with proper headings hierarchy -->
  <h2>Section Title</h2>
  
  <!-- Forms with comprehensive accessibility -->
  <form [formGroup]="myForm" novalidate>
    <fieldset>
      <legend>User Information</legend>
      
      <div class="form-group">
        <label for="email-input">Email Address *</label>
        <input 
          id="email-input"
          type="email"
          formControlName="email"
          [attr.aria-describedby]="getAriaDescribedBy('email')"
          [attr.aria-invalid]="isFieldInvalid('email')"
          aria-required="true">
        
        <div *ngIf="getFieldError('email')" 
             id="email-error" 
             role="alert" 
             aria-live="polite"
             class="error-message">
          {{ getFieldError('email') }}
        </div>
        
        <div id="email-hint" class="hint">
          We'll never share your email address
        </div>
      </div>
    </fieldset>
    
    <button type="submit" 
            [disabled]="myForm.invalid"
            [attr.aria-describedby]="myForm.invalid ? 'submit-error' : null">
      Submit Form
    </button>
    
    <div *ngIf="myForm.invalid && submitAttempted" 
         id="submit-error" 
         role="alert" 
         aria-live="assertive">
      Please correct the errors above before submitting
    </div>
  </form>
  
  <!-- Dynamic content with live regions -->
  <div aria-live="polite" aria-atomic="true">
    <p *ngIf="statusMessage" [attr.aria-label]="statusMessage">
      {{ statusMessage }}
    </p>
  </div>
  
  <!-- Interactive elements -->
  <button type="button"
          #primaryButton
          class="primary-action"
          [attr.aria-pressed]="isPressed"
          [attr.aria-expanded]="isExpanded"
          (click)="handleAction()"
          (keydown.enter)="handleAction()"
          (keydown.space)="handleAction()">
    {{ buttonText }}
  </button>
</main>

<footer role="contentinfo">
  <!-- Footer content -->
</footer>
\`\`\`

**For Style Files (.scss/.css):**
\`\`\`scss
// Accessibility color variables
$text-color: #212529;           // 4.5:1 contrast ratio
$background-color: #ffffff;
$focus-color: #005fcc;          // High contrast focus
$error-color: #dc3545;          // Sufficient contrast
$success-color: #28a745;

// Focus indicators
.focus-visible,
*:focus-visible {
  outline: 3px solid $focus-color;
  outline-offset: 2px;
  box-shadow: 0 0 0 1px rgba($focus-color, 0.3);
}

// Skip link
.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: $text-color;
  color: $background-color;
  padding: 8px;
  text-decoration: none;
  z-index: 1000;
  
  &:focus {
    top: 6px;
  }
}

// Responsive and accessible touch targets
.clickable,
button,
a,
[role="button"] {
  min-height: 44px;
  min-width: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

// Error states
.error-message {
  color: $error-color;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

// High contrast mode support
@media (prefers-contrast: high) {
  button,
  input,
  select,
  textarea {
    border: 2px solid;
  }
}

// Reduced motion support
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

// Dark mode support
@media (prefers-color-scheme: dark) {
  :root {
    --background-color: #121212;
    --text-color: #e0e0e0;
  }
}

// Print accessibility
@media print {
  .skip-link,
  .screen-reader-only {
    position: static !important;
    clip: auto !important;
  }
}
\`\`\`

**Response Format:** Please respond ONLY with valid JSON in this exact format:
{
  "improvedCode": "Complete production-ready accessible code with comprehensive WCAG 2.1 AA compliance",
  "explanation": "Detailed explanation of all accessibility improvements including WCAG principles addressed, Angular-specific enhancements, keyboard navigation, screen reader support, color contrast improvements, and usability enhancements",
  "changes": [
    {"line": 1, "type": "angular-imports", "reason": "Added Angular CDK A11y imports for comprehensive accessibility support"},
    {"line": 5, "type": "semantic-html", "reason": "Replaced generic divs with semantic HTML5 elements (header, nav, main, footer)"},
    {"line": 10, "type": "aria-attributes", "reason": "Added ARIA landmarks, labels, and states for screen reader navigation"},
    {"line": 15, "type": "keyboard-navigation", "reason": "Implemented full keyboard support with Enter, Space, Tab, and Escape key handling"},
    {"line": 20, "type": "focus-management", "reason": "Added visible focus indicators and focus trap functionality"},
    {"line": 25, "type": "form-accessibility", "reason": "Enhanced form with proper labels, fieldsets, validation, and error announcements"},
    {"line": 30, "type": "color-contrast", "reason": "Improved color contrast ratios to meet WCAG AA standards (minimum 4.5:1)"},
    {"line": 35, "type": "live-regions", "reason": "Added live regions for dynamic content announcements to screen readers"},
    {"line": 40, "type": "touch-targets", "reason": "Ensured all interactive elements meet minimum 44x44px touch target size"},
    {"line": 45, "type": "reduced-motion", "reason": "Added support for users who prefer reduced motion"},
    {"line": 50, "type": "responsive-design", "reason": "Implemented responsive design that maintains accessibility across all device sizes"}
  ]
}

**SUCCESS CRITERIA CHECKLIST:**
✅ Keyboard navigation: All interactive elements accessible via keyboard
✅ Screen reader support: Proper semantic markup and ARIA attributes
✅ Color contrast: Minimum 4.5:1 ratio for normal text, 3:1 for large text
✅ Focus indicators: Visible and high-contrast focus indicators
✅ Form accessibility: Labels, fieldsets, validation, error handling
✅ Live regions: Dynamic content announced to assistive technologies
✅ Touch targets: Minimum 44x44px for all interactive elements
✅ Motion preferences: Respects prefers-reduced-motion setting
✅ Semantic HTML: Proper heading hierarchy and landmark structure
✅ Angular integration: CDK A11y modules and best practices implemented

Transform this code into an exemplary model of accessible web development that exceeds WCAG 2.1 AA standards.`;
    }
    parseResponse(response) {
        try {
            // Try to extract JSON from the response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                improvedCode: parsed.improvedCode,
                explanation: parsed.explanation,
                changes: parsed.changes || []
            };
        }
        catch (error) {
            this.outputChannel.appendLine(`⚠️ Failed to parse AI response as JSON: ${error}`);
            // Fallback: treat entire response as explanation
            return {
                explanation: response,
                changes: []
            };
        }
    }
    getWorkspaceFileUri(relativePath) {
        // Use the same logic as the tree provider for consistent path resolution
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            throw new Error('No workspace folder available');
        }
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri;
        // Handle workspace path resolution (same logic from scannerTreeProvider)
        const workspacePath = decodeURIComponent(workspaceRoot.path);
        const workspaceBaseName = workspacePath.split('/').pop();
        const pathParts = relativePath.split(/[/\\]/).filter(part => part.length > 0);
        let resultUri;
        if (pathParts.length > 0 && pathParts[0] !== workspaceBaseName) {
            // Sibling component - go up to components directory
            if (workspacePath.includes('/components/')) {
                const componentsUri = vscode.Uri.joinPath(workspaceRoot, '..');
                resultUri = vscode.Uri.joinPath(componentsUri, relativePath);
            }
            else {
                resultUri = vscode.Uri.joinPath(workspaceRoot, relativePath);
            }
        }
        else if (pathParts.length > 1 && pathParts[0] === workspaceBaseName) {
            // Remove duplicate folder name
            const adjustedPath = pathParts.slice(1).join('/');
            resultUri = vscode.Uri.joinPath(workspaceRoot, adjustedPath);
        }
        else {
            // Direct path within current component
            resultUri = vscode.Uri.joinPath(workspaceRoot, relativePath);
        }
        return resultUri;
    }
    getLanguageFromExtension(ext) {
        const languageMap = {
            '.js': 'javascript',
            '.jsx': 'javascriptreact',
            '.ts': 'typescript',
            '.tsx': 'typescriptreact',
            '.html': 'html',
            '.htm': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.sass': 'sass',
            '.less': 'less',
            '.vue': 'vue',
            '.svelte': 'svelte',
            '.json': 'json',
            // Angular specific extensions
            '.component.ts': 'typescript',
            '.component.html': 'html',
            '.component.scss': 'scss',
            '.component.css': 'css',
            '.service.ts': 'typescript',
            '.directive.ts': 'typescript',
            '.pipe.ts': 'typescript',
            '.module.ts': 'typescript',
            '.guard.ts': 'typescript',
            '.resolver.ts': 'typescript',
            '.angular.html': 'html'
        };
        // Check for Angular-specific patterns first
        for (const pattern of ['.component.ts', '.component.html', '.component.scss', '.component.css', '.service.ts', '.directive.ts', '.pipe.ts', '.module.ts', '.guard.ts', '.resolver.ts']) {
            if (ext.endsWith(pattern)) {
                return languageMap[pattern];
            }
        }
        return languageMap[ext] || 'plaintext';
    }
    dispose() {
        this.outputChannel.dispose();
        this.fileOperations.dispose();
        this.bottomMenu.dispose();
    }
}
exports.AccessibilityConverter = AccessibilityConverter;
//# sourceMappingURL=accessibilityConverter.js.map