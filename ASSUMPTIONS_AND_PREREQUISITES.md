# AccessLint: Assumptions and Prerequisites

This document outlines all the assumptions, prerequisites, and constraints that underlie the AccessLint application architecture and deployment.

---

## 🎯 Core Architectural Assumptions

### 1. **Sequential Tool Call Execution**

**Assumption:** Agent operations execute tool calls **sequentially** (one at a time) rather than in parallel.

**Rationale:**
- Prevents exceeding Azure OpenAI **Requests Per Minute (RPM)** limits
- Avoids race conditions in file operations and browser automation
- Ensures deterministic execution order for debugging

**Implication:**
- Agent iterations may take longer for complex queries
- Trade-off: **Reliability over speed**
- Current limit: ~60 RPM for GPT-5 deployment

**Configuration:**
```typescript
// In agentLLMOrchestrator.ts
const toolResults = [];
for (const toolCall of toolCalls) {
    const result = await executeToolSequentially(toolCall);
    toolResults.push(result);
}
```

---

### 2. **GPT-Focused Architecture**

**Assumption:** System is **optimized for OpenAI GPT-5** on Azure OpenAI Service.

**Current Status:**
- ✅ Fully tested with: **GPT-5** (Azure OpenAI)
- ⚠️ Partially tested with: **Gemini Pro**, **Claude Sonnet** (basic chat only)
- ❌ Not tested with: Other models (Llama, Mistral, etc.)

**Known Limitations:**
- **Agent mode** requires GPT-5 specific features (function calling, structured outputs)
- **Prompt engineering** tuned for GPT-5 behavior
- **Token limits** and parameters (`max_completion_tokens`) are GPT-5 specific
- Other models may produce different quality results for accessibility validation

**Recommendation:**
- Extensive testing and prompt re-engineering required for non-GPT models
- Agent tool definitions may need adjustment for other models
- Validation prompts should be benchmarked against GPT-5 outputs

---

### 3. **Azure Environment Dependency**

**Assumption:** Application is **designed to run exclusively on Microsoft Azure** infrastructure.

**Azure Services Required:**
- **Azure Web Apps** (Node.js backend hosting)
- **Azure PostgreSQL Flexible Server** (database)
- **Azure Blob Storage** (VSIX files, reports, uploads)
- **Azure OpenAI Service** (GPT-5 deployment)
- **Azure Virtual Network** (VNet integration for secure communication)

**Non-Azure Alternatives Not Supported:**
- AWS, GCP, or on-premises deployments require significant refactoring
- Azure-specific SDKs used: `@azure/storage-blob`, `@azure/openai`
- Environment variables assume Azure App Service structure

**Migration Effort:**
- Estimated **40+ hours** to adapt for AWS (S3, RDS, Bedrock)
- Database migrations needed for schema differences
- Authentication/authorization logic changes

---

## 🖥️ Platform and Runtime Assumptions

### 4. **Windows Operating System Requirement**

**Assumption:** Screen reader validation **only works on Windows**.

**Dependencies:**
- **NVDA (NonVisual Desktop Access)** screen reader (Windows-only)
- **@guidepup/guidepup** library (Windows-specific NVDA control)
- Windows-specific paths and process management

**Implication:**
- macOS and Linux users **cannot run accessibility testing mode**
- Chat mode and agent mode work on all platforms
- Extension will detect OS and disable testing features on non-Windows

**Workaround:**
- Use Windows VM or container for testing (not currently implemented)
- Future: Support for macOS VoiceOver (requires separate implementation)

---

### 5. **Node.js and TypeScript Runtime**

**Assumption:** Application requires specific runtime versions.

**Required Versions:**
- **Node.js:** 16.x or higher (tested on 18.x)
- **TypeScript:** 4.9+ (for compilation)
- **VS Code:** 1.85.0 or higher
- **VS Code Engine:** `^1.85.0`

**Build Requirements:**
- `npm` or `yarn` for package management
- TypeScript compiler (`tsc`) for backend/extension
- Vite for frontend (React) bundling

---

### 6. **Chromium Browser via Playwright**

**Assumption:** All web page testing uses **Playwright with Chromium**.

**Configuration:**
```typescript
// In testService.ts
const browser = await chromium.launch({
    headless: false,  // Visible for NVDA interaction
    args: ['--force-renderer-accessibility']
});
```

**Implications:**
- Tests **only validate Chromium-based accessibility** (Chrome, Edge)
- Firefox and Safari behavior may differ
- Playwright must download Chromium binaries (~300MB)

**Cross-Browser Support:**
- Not currently implemented
- Adding Firefox/WebKit would require separate NVDA configurations

---

## 🔐 Authentication and Security Assumptions

### 7. **JWT-Based Authentication**

**Assumption:** User authentication uses **JWT tokens** stored in VS Code global state.

**Token Lifecycle:**
- Tokens issued on login (24-hour expiration)
- Stored in `context.globalState` (unencrypted, local to machine)
- No automatic refresh mechanism

**Security Implications:**
- Tokens are **not encrypted** in local storage
- If machine is compromised, tokens can be extracted
- Extension does not support OAuth/SSO (manual login only)

**Multi-Device:**
- Users must log in separately on each machine
- No token sync across VS Code instances

---

### 8. **Azure OpenAI API Key Hardcoded for Agent Mode**

**Assumption:** Azure OpenAI API key is **hardcoded in extension code** for agent mode.

**Current Implementation:**
```typescript
// In apiKeyManager.ts
const AZURE_API_KEY = 'BiG4E52GKPwmxv60QxNWxAmlUoKyUyUnDPGavAx5sWSE0MkcmjKDJQQJ99BKACHYHv6XJ3w3AAABACOGDm43';
```

**Rationale:**
- Allows agent to call Azure OpenAI directly from user's machine
- Bypasses corporate network restrictions that block backend API

**Security Risk:**
- ⚠️ **API key visible in compiled JavaScript** (can be extracted from VSIX)
- Anyone with the extension can make direct Azure OpenAI calls
- No rate limiting or monitoring per-user

**Mitigation Required:**
- Move all agent calls to backend (planned refactor)
- Use backend as proxy for Azure OpenAI
- Implement proper API key rotation

---

## 🗄️ Database Assumptions

### 9. **PostgreSQL Schema and Versioning**

**Assumption:** Database uses **specific PostgreSQL schema** with UUID extensions.

**Required Extensions:**
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

**Schema Requirements:**
- Tables: `users`, `conversations`, `messages`, `sessions`, `reports`, `file_uploads`, `usage_stats`
- All IDs are UUIDs (not auto-increment integers)
- Timestamps use `TIMESTAMPTZ` (timezone-aware)

**Migration:**
- No automated migration framework (Prisma, Knex, etc.)
- Schema changes require manual SQL execution
- Version control: Not implemented

---

### 10. **Single Database Connection Pool**

**Assumption:** Backend uses a **single shared connection pool** for all users.

**Configuration:**
```typescript
// In database.ts
const pool = new Pool({
    max: 20,  // Max 20 concurrent connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
```

**Scalability:**
- Works for **< 100 concurrent users**
- Beyond that, may require connection pooler (PgBouncer)
- No read replicas or sharding

---

## 🌐 Network and Connectivity Assumptions

### 11. **Public Internet Access or VNet Configuration**

**Assumption:** Application assumes **either**:
- **Public internet access** from user's machine (for extension to call backend), OR
- **Properly configured VNet integration** in corporate environment

**Extension Requirements:**
- Must reach: `https://ctonpsiotspocapp-gcfhduh3fdhab4h2.southindia-01.azurewebsites.net`
- HTTPS only (no HTTP fallback)

**Backend Requirements:**
- Must reach Azure OpenAI endpoint (via VNet or public)
- Must reach Azure Blob Storage (via VNet or public)
- Must reach Azure PostgreSQL (via VNet or public)

**Corporate Network:**
- Firewalls may block outbound HTTPS to Azure
- Proxy settings must be configured in VS Code settings
- Certificate pinning may cause TLS issues

---

### 12. **Synchronous HTTP Requests (No WebSockets)**

**Assumption:** All communication uses **REST APIs** with polling, not WebSockets.

**Chat Mode:**
- Extension sends message → Backend processes → Returns complete response
- Long responses may timeout (default: 60 seconds)

**Agent Mode:**
- Extension polls backend for session status every 2 seconds
- No server-sent events (SSE) or WebSocket streaming

**Implication:**
- High latency for long-running operations
- Increased server load from polling

**Alternative (Not Implemented):**
- WebSocket for real-time streaming
- SSE for agent progress updates

---

## 🧪 Accessibility Testing Assumptions

### 13. **NVDA Screen Reader Navigation Shortcuts**

**Assumption:** Validation uses NVDA **single-letter navigation** (H, K, F, B) rather than Tab key.

**Current Approach:**
```typescript
// Press H repeatedly to find all headings
for (let i = 0; i < maxIterations; i++) {
    await nvda.press('h');
}
```

**Limitations:**
- ⚠️ **Does not test Tab key navigation** (most common user behavior)
- ⚠️ **Does not detect focus order issues**
- ⚠️ **Does not detect keyboard traps**
- ⚠️ **Does not test skip links**
- ⚠️ **Potential false positives**: Element announced ≠ Element usable

**WCAG Coverage:**
- ✅ Tests: 1.1.1 (Alt text), 1.3.1 (Headings structure), 2.4.4 (Link purpose)
- ❌ Misses: 2.1.1 (Keyboard), 2.1.2 (No keyboard trap), 2.4.1 (Skip links), 2.4.3 (Focus order)

**Improvement Needed:**
- Add Tab key sequential navigation testing
- Add interactive element usability verification
- Add keyboard trap detection

---

### 14. **WCAG 2.1 Level AA Focus**

**Assumption:** Validation prioritizes **WCAG 2.1 Level AA** (not AAA, not WCAG 2.2).

**Not Covered:**
- WCAG 2.2 new criteria (2.4.11 Focus Appearance, 3.3.7 Redundant Entry, etc.)
- WCAG Level AAA criteria (1.4.6 Contrast Enhanced, 2.4.9 Link Purpose)

**Manual Testing Still Required:**
- Visual design review
- Color contrast for non-text elements
- Complex interactions (drag-and-drop, etc.)

---

### 15. **Publicly Accessible or Localhost URLs Only**

**Assumption:** Testing only works with:
- **Public URLs** (https://example.com)
- **Localhost URLs** (http://localhost:3000)

**Not Supported:**
- Internal corporate URLs behind VPN (extension runs on user's machine, not on Azure)
- URLs requiring authentication/login
- Single-page apps (SPAs) with complex client-side routing (may require manual navigation)

**Workaround:**
- Use VPN/proxy to access internal sites from user's machine
- Deploy test version to public staging environment

---

### 16. **Browser Must Be Visible for NVDA**

**Assumption:** Playwright browser runs in **non-headless mode** for NVDA to capture speech.

**Requirement:**
```typescript
headless: false,  // NVDA requires visible UI
```

**Implication:**
- Testing cannot run on headless servers
- User must see browser window during test
- Slower than headless mode

---

## 📦 Storage and File Handling Assumptions

### 17. **Azure Blob Storage Container Structure**

**Assumption:** Blob Storage uses **three predefined containers**:

```
ctonpsiotspocstracc/
├── vsix/           (VSIX extension files)
│   └── accesslint-0.1.0.vsix
├── reports/        (PDF accessibility reports)
│   └── {reportId}.pdf
└── uploads/        (User-uploaded files for testing)
    └── {userId}/{filename}
```

**Access:**
- Containers are **private** (no public access)
- Access via SAS tokens or private endpoints
- VNet integration required for backend access

---

### 18. **File Upload Size Limits**

**Assumption:** File uploads limited to **10MB** per file.

**Configuration:**
```typescript
// In server.ts
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
```

**Rationale:**
- Prevents abuse and storage costs
- Sufficient for HTML/CSS/JS files
- PDF reports typically < 5MB

---

## 🤖 AI Model Assumptions

### 19. **GPT-5 Specific API Parameters**

**Assumption:** Code uses GPT-5 specific parameters (not compatible with GPT-4).

**Current Configuration:**
```typescript
{
    model: 'gpt-5',
    max_completion_tokens: 4000,  // Not 'max_tokens'
    // temperature: 1 (default, cannot be changed)
}
```

**Breaking Changes from GPT-4:**
- `max_tokens` → `max_completion_tokens`
- `temperature` fixed at 1 (cannot override)
- API version: `2025-01-01-preview` (not `2024-02-15-preview`)

**Fallback:**
- No automatic fallback to GPT-4 if GPT-5 unavailable

---

### 20. **Context Window and Token Limits**

**Assumption:** Chat history limited to **last 3 conversations** to stay within context window.

**Configuration:**
```typescript
// In chatController.ts
const recentMessages = await getRecentMessages(conversationId, 3);
```

**GPT-5 Limits:**
- Input: 128K tokens
- Output: 4K tokens (max_completion_tokens)

**Long Conversations:**
- Older messages truncated
- No automatic summarization
- User must start new conversation for fresh context

---

### 21. **AI Validation as Ground Truth**

**Assumption:** GPT-5's accessibility analysis is treated as **"ground truth"** for validation.

**Reality:**
- ⚠️ AI can hallucinate issues (false positives)
- ⚠️ AI can miss subtle issues (false negatives)
- ⚠️ AI's WCAG interpretation may differ from WCAG WG's intent

**Mitigation:**
- Results should be reviewed by human accessibility expert
- Use as "first-pass screening," not certification
- Combine with automated tools (Axe, WAVE) for validation

---

## 🚀 Deployment Assumptions

### 22. **Single Web App for Backend + Frontend**

**Assumption:** Backend and frontend hosted together on **single Azure Web App**.

**Structure:**
```
/home/site/wwwroot/
├── server.js          (Backend entry point)
├── config/            (Backend config)
├── controllers/       (Backend controllers)
├── app/               (Frontend static files)
│   ├── index.html
│   └── assets/
```

**Routing:**
- `/api/*` → Backend API
- `/app/*` → Frontend static files
- `/*` (non-API) → SPA fallback to `index.html`

**Alternative (Not Implemented):**
- Separate Azure Web App for backend
- Azure Static Web Apps for frontend
- Would require CORS configuration

---

### 23. **No CI/CD for Backend**

**Assumption:** Backend deployment is **manual** (no automated CI/CD).

**Current Process:**
1. Build locally: `npm run build`
2. Upload `backend/dist/*` to Azure via Kudu
3. Restart Web App

**GitLab CI/CD:**
- ✅ Configured for frontend (tags: `build`)
- ❌ Disabled for backend (`when: manual`)

**Reason:**
- Backend changes are infrequent
- Manual deployment reduces risk of breaking production

---

### 24. **Extension Distribution via Private Blob**

**Assumption:** Extension distributed as **VSIX file from Azure Blob**, not VS Code Marketplace.

**Rationale:**
- Corporate/internal use only
- Prevents public access to IP-protected logic
- Avoids Microsoft Marketplace approval process

**Download Flow:**
1. User logs into web portal
2. Downloads VSIX from `/api/download/vsix?version=0.1.0`
3. Installs manually: `code --install-extension accesslint-0.1.0.vsix`

**Updating:**
- No automatic updates
- Users must manually download new versions

---

## 🔄 Session and State Management Assumptions

### 25. **Single Agent Session Per User**

**Assumption:** Each user can have **only one active agent session** at a time.

**Enforcement:**
- Starting new session cancels previous session
- Session state stored in backend database
- No concurrent agent runs for same user

**Rationale:**
- Prevents resource exhaustion
- Simplifies state management
- Avoids conflicting tool executions

---

### 26. **VS Code Global State for Persistence**

**Assumption:** Extension uses VS Code's `globalState` for persistent storage (unencrypted).

**What's Stored:**
```typescript
await context.globalState.update('authToken', token);
await context.globalState.update('currentUser', user);
await context.globalState.update('currentConversationId', conversationId);
```

**Location:**
- Windows: `%APPDATA%\Code\User\globalStorage\<extension-id>`
- macOS: `~/Library/Application Support/Code/User/globalStorage/`

**Security:**
- ⚠️ Not encrypted
- ⚠️ Visible to other extensions (if they know the key)
- ⚠️ Not backed up across machines

---

## 📊 Monitoring and Logging Assumptions

### 27. **Winston File Logging Only**

**Assumption:** Logs written to **local files** only (no centralized logging).

**Configuration:**
```typescript
// In logger.ts
new winston.transports.File({ filename: 'error.log' })
```

**Limitations:**
- No Application Insights integration
- No real-time log aggregation
- Logs must be accessed via Kudu SSH

**Production Monitoring:**
- Manual log review required
- No alerting for errors

---

### 28. **No User Analytics or Telemetry**

**Assumption:** No analytics tracking for user behavior (GDPR-friendly).

**What's NOT Tracked:**
- Extension usage patterns
- Feature adoption rates
- Error frequency per user

**What IS Tracked:**
- Usage stats (API calls, token usage) in PostgreSQL
- Individual user session logs (for billing/quota)

---

## ⚡ Performance Assumptions

### 29. **Agent Timeout: 5 Minutes**

**Assumption:** Agent sessions timeout after **5 minutes** if no completion.

**Configuration:**
```typescript
const MAX_ITERATIONS = 10;
const TIMEOUT_MS = 5 * 60 * 1000;  // 5 minutes
```

**Exceeded When:**
- Complex queries requiring > 10 tool iterations
- Slow API responses from external sites
- Infinite loops (detected separately)

---

### 30. **Database Query Performance**

**Assumption:** No database query optimization or caching implemented.

**Current State:**
- No indexes on frequently queried columns (except primary keys)
- No query result caching (Redis, etc.)
- All queries hit database directly

**Scalability:**
- Works for < 100 users
- May require optimization for higher load

---

## 🎓 Summary: Critical Assumptions to Remember

| **Category** | **Assumption** | **Impact if Violated** |
|-------------|---------------|----------------------|
| **Architecture** | Sequential tool execution | Rate limit errors, inconsistent state |
| **AI Model** | GPT-5 optimized | Poor results with other models |
| **Platform** | Windows only for testing | Cannot run screen reader tests on Mac/Linux |
| **Azure** | Azure services required | Cannot deploy on AWS/GCP without refactor |
| **Authentication** | JWT in global state | Token theft if machine compromised |
| **Navigation** | NVDA shortcuts (not Tab) | Misses keyboard accessibility issues |
| **Network** | Public/VNet access | Extension unusable in restricted networks |
| **Deployment** | Single Web App | Frontend/backend tightly coupled |
| **Distribution** | Private VSIX only | No marketplace discoverability |

---

## 🔮 Future Improvements to Reduce Assumptions

1. **Multi-Cloud Support:** Abstract Azure dependencies behind interfaces
2. **Cross-Platform Testing:** Support macOS VoiceOver
3. **Tab Key Navigation:** Add comprehensive keyboard accessibility testing
4. **WebSocket Streaming:** Reduce latency and polling overhead
5. **Automated CI/CD:** Full GitLab pipeline for backend + frontend
6. **Token Encryption:** Secure credential storage in VS Code
7. **Database Migrations:** Automated schema versioning (Prisma/Knex)
8. **Application Insights:** Centralized logging and monitoring
9. **Multi-Model Support:** Test and optimize for Gemini, Claude, Llama

---

## 🏢 Corporate Environment Considerations

### **31. Non-Standard Installation Paths**

**Assumption:** Software installed in standard Windows locations.

**Corporate Reality:**
- NVDA may be in `C:\temp\nvda\` instead of `C:\Program Files (x86)\NVDA\`
- Playwright may be extracted to `C:\temp\playwright-1.48.2\` from GitHub
- Limited admin permissions prevent standard installations

**Workaround:**
```powershell
# Set NVDA path
[System.Environment]::SetEnvironmentVariable('GUIDEPUP_NVDA_PATH', 'C:\temp\nvda\nvda.exe', 'User')

# Install Playwright from local folder
npm install C:\temp\playwright-1.48.2\playwright-1.48.2\packages\playwright-core

# Use system Chrome/Edge
$env:ACCESSLINT_USE_SYSTEM_BROWSER='chrome'  # or 'msedge'
```

**See:** `CORPORATE_SETUP.md` for complete guide

---

### **32. Corporate Network Restrictions**

**Assumption:** Unrestricted internet access for npm and browser downloads.

**Corporate Reality:**
- Firewalls block Playwright browser downloads
- SSL certificates cause npm install failures
- Proxy authentication required
- Some npm packages need manual installation

**Workaround:**
- Install from local folders (provided by IT)
- Use system browsers instead of Playwright Chromium
- Configure corporate proxy: `npm config set proxy http://proxy:8080`
- Temporarily bypass SSL (installation only): `$env:NODE_TLS_REJECT_UNAUTHORIZED="0"`

---

### **33. Limited Admin Permissions**

**Assumption:** User has admin rights to install software and set environment variables.

**Corporate Reality:**
- Cannot install to `Program Files`
- May need IT approval for environment variables
- Cannot run PowerShell scripts without execution policy changes

**Workaround:**
- Use User-level environment variables (don't require admin)
- Request IT to install NVDA and Playwright
- Use `test-corporate-setup.ps1` to verify setup

---

**Document Version:** 1.1  
**Last Updated:** 2025-12-04  
**Maintained By:** AccessLint Development Team

