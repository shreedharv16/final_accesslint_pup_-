# 🚀 AccessLint Backend Migration & Deployment Plan

## 📋 **Table of Contents**
1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Azure Services Required](#azure-services-required)
4. [Backend Architecture](#backend-architecture)
5. [Frontend Architecture](#frontend-architecture)
6. [VSIX Packaging](#vsix-packaging)
7. [Authentication Flow](#authentication-flow)
8. [CI/CD Pipeline](#cicd-pipeline)
9. [Cost Estimation](#cost-estimation)
10. [Implementation Phases](#implementation-phases)

---

## 🎯 **Architecture Overview**

### **High-Level Flow**

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER JOURNEY                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User visits: https://accesslint.azurewebsites.net          │
│     └─> React SPA (Tailwind CSS)                               │
│                                                                  │
│  2. Register/Login                                              │
│     └─> Email + Password                                        │
│     └─> Backend validates → Returns JWT                         │
│                                                                  │
│  3. Dashboard                                                    │
│     └─> Shows usage stats                                       │
│     └─> "Download Extension" button                             │
│                                                                  │
│  4. Download VSIX                                                │
│     └─> Fetches from Azure Blob Storage                         │
│     └─> ~150-200 MB download                                    │
│                                                                  │
│  5. Install VSIX in VSCode                                       │
│     └─> Extension activates                                     │
│     └─> Auto-authenticates with backend                         │
│                                                                  │
│  6. Use Extension                                                │
│     └─> All AI calls → Backend (hardcoded Azure OpenAI key)    │
│     └─> All logs saved to PostgreSQL                            │
│     └─> Rate limiting enforced per user                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### **System Architecture Diagram**

```
┌──────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  React SPA (Tailwind CSS)                                  │ │
│  │  - Login/Register Page                                     │ │
│  │  - Dashboard (Download + Usage Stats)                      │ │
│  │  Hosted: Azure Static Web Apps or Web App                  │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────┬─────────────────────────────────────────┘
                         │ HTTPS (JWT)
┌────────────────────────▼─────────────────────────────────────────┐
│                       BACKEND API                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Express + TypeScript (Node.js 18)                         │ │
│  │  Hosted: Azure Web App (P1V3)                              │ │
│  │                                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │ Routes:                                               │ │ │
│  │  │  POST   /api/auth/register                           │ │ │
│  │  │  POST   /api/auth/login                              │ │ │
│  │  │  POST   /api/auth/refresh                            │ │ │
│  │  │  GET    /api/auth/me                                 │ │ │
│  │  │  GET    /api/download/vsix                           │ │ │
│  │  │  POST   /api/chat/message                            │ │ │
│  │  │  POST   /api/testing/run                             │ │ │
│  │  │  POST   /api/testing/fix                             │ │ │
│  │  │  GET    /api/user/usage                              │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                                             │ │
│  │  Middleware:                                                │ │
│  │  - JWT Authentication                                       │ │
│  │  - Rate Limiting (check PostgreSQL)                        │ │
│  │  - Request Logging                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────┬───────────────────┬──────────────────┬─────────────┘
             │                   │                  │
    ┌────────▼────────┐ ┌───────▼──────┐  ┌───────▼─────────┐
    │ Azure OpenAI    │ │ PostgreSQL   │  │  Blob Storage   │
    │ (Hardcoded Key) │ │ (All Data)   │  │  (VSIX Files)   │
    └─────────────────┘ └──────────────┘  └─────────────────┘
             │                   │                  │
    ┌────────▼────────┐ ┌───────▼──────┐  ┌───────▼─────────┐
    │  Azure Key      │ │ Application  │  │  Azure CDN      │
    │  Vault          │ │ Insights     │  │  (Optional)     │
    │  (Secrets)      │ │ (Monitoring) │  │                 │
    └─────────────────┘ └──────────────┘  └─────────────────┘
```

### **VSCode Extension Architecture (Client-Side)**

```
┌──────────────────────────────────────────────────────────────────┐
│                    VSCODE EXTENSION (VSIX)                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Frontend (Stays Client-Side)                              │ │
│  │  - Chat Webview UI                                         │ │
│  │  - Testing Webview UI                                      │ │
│  │  - Diff Viewer                                             │ │
│  │  - NVDA Testing (Guidepup + Playwright)                    │ │
│  │  - File System Access (VSCode APIs)                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  All AI Calls → Backend API (with JWT)                           │
│  All Logs → Backend (saved to PostgreSQL)                        │
└───────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ **Database Schema (PostgreSQL)**

### **Design Principles:**
- ✅ **No subscription tiers** - All users get equal access
- ✅ **Rate limiting per user** - Configurable limits (decided later)
- ✅ **Complete audit trail** - Every action logged
- ✅ **Agent footprint tracking** - All iterations, tool calls, results
- ✅ **Chat history** - Full conversation storage
- ✅ **Debug logs** - All outputChannel.appendLine logs

### **Complete Schema**

```sql
-- =============================================================================
-- USERS & AUTHENTICATION
-- =============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    rate_limit_per_hour INTEGER DEFAULT 100, -- Configurable per user
    rate_limit_tokens_per_day INTEGER DEFAULT 100000, -- Configurable per user
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);

-- =============================================================================
-- SESSION MANAGEMENT
-- =============================================================================

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token VARCHAR(500) NOT NULL,
    refresh_token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_access_token ON sessions(access_token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- =============================================================================
-- CHAT SYSTEM
-- =============================================================================

CREATE TABLE chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_type VARCHAR(50) NOT NULL, -- 'quick_mode', 'agent_mode'
    title VARCHAR(255), -- Auto-generated or user-provided
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_archived BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX idx_chat_conversations_type ON chat_conversations(conversation_type);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    tool_calls JSONB, -- Store tool execution details
    tokens_used INTEGER DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_timestamp ON chat_messages(timestamp);

-- =============================================================================
-- AGENT EXECUTION (Chat Agent & Testing Agent)
-- =============================================================================

CREATE TABLE agent_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_type VARCHAR(50) NOT NULL, -- 'chat_agent', 'testing_agent'
    goal TEXT NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'active', 'completed', 'error', 'timeout'
    total_iterations INTEGER DEFAULT 0,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    file_changes JSONB, -- { "src/App.jsx": "modified", "src/utils.ts": "created" }
    completion_summary TEXT,
    error_message TEXT
);

CREATE INDEX idx_agent_sessions_user_id ON agent_sessions(user_id);
CREATE INDEX idx_agent_sessions_type ON agent_sessions(session_type);
CREATE INDEX idx_agent_sessions_status ON agent_sessions(status);

CREATE TABLE agent_iterations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
    iteration_number INTEGER NOT NULL,
    llm_request JSONB NOT NULL, -- Full prompt sent to AI
    llm_response JSONB NOT NULL, -- Full AI response
    tool_calls JSONB, -- Array of tool calls: [{ name: 'read_file', params: {...}, result: {...} }]
    tool_results JSONB, -- Results of all tool executions
    tokens_used INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agent_iterations_session_id ON agent_iterations(session_id);
CREATE INDEX idx_agent_iterations_number ON agent_iterations(iteration_number);

-- =============================================================================
-- ACCESSIBILITY TESTING
-- =============================================================================

CREATE TABLE testing_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tested_url VARCHAR(500) NOT NULL,
    nvda_interactions JSONB NOT NULL, -- All NVDA announcements and navigation
    test_results JSONB NOT NULL, -- All issues found
    ai_validation_results JSONB, -- AI comprehensive validation
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    total_issues INTEGER DEFAULT 0,
    severity_breakdown JSONB -- { "errors": 5, "warnings": 10, "info": 3 }
);

CREATE INDEX idx_testing_sessions_user_id ON testing_sessions(user_id);
CREATE INDEX idx_testing_sessions_url ON testing_sessions(tested_url);
CREATE INDEX idx_testing_sessions_start_time ON testing_sessions(start_time);

CREATE TABLE testing_fixes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    testing_session_id UUID NOT NULL REFERENCES testing_sessions(id) ON DELETE CASCADE,
    agent_session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
    files_modified JSONB NOT NULL, -- Array of modified files with changes
    fix_summary TEXT,
    success BOOLEAN DEFAULT TRUE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_testing_fixes_testing_session_id ON testing_fixes(testing_session_id);
CREATE INDEX idx_testing_fixes_agent_session_id ON testing_fixes(agent_session_id);

-- =============================================================================
-- DEBUG LOGS (All outputChannel.appendLine logs)
-- =============================================================================

CREATE TABLE debug_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID, -- Can reference agent_session or testing_session
    session_type VARCHAR(50), -- 'agent', 'testing', 'chat', 'general'
    log_level VARCHAR(20) NOT NULL, -- 'INFO', 'WARN', 'ERROR', 'DEBUG'
    message TEXT NOT NULL,
    context JSONB, -- Additional structured data
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_debug_logs_user_id ON debug_logs(user_id);
CREATE INDEX idx_debug_logs_session_id ON debug_logs(session_id);
CREATE INDEX idx_debug_logs_level ON debug_logs(log_level);
CREATE INDEX idx_debug_logs_timestamp ON debug_logs(timestamp);

-- =============================================================================
-- USAGE TRACKING (For Rate Limiting & Analytics)
-- =============================================================================

CREATE TABLE usage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint VARCHAR(100) NOT NULL, -- '/chat/message', '/testing/run', etc.
    method VARCHAR(10) NOT NULL, -- 'GET', 'POST', etc.
    status_code INTEGER,
    tokens_used INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usage_stats_user_id ON usage_stats(user_id);
CREATE INDEX idx_usage_stats_timestamp ON usage_stats(timestamp);
CREATE INDEX idx_usage_stats_endpoint ON usage_stats(endpoint);

-- =============================================================================
-- VSIX DOWNLOADS
-- =============================================================================

CREATE TABLE vsix_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vsix_version VARCHAR(20) NOT NULL,
    download_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT
);

CREATE INDEX idx_vsix_downloads_user_id ON vsix_downloads(user_id);
CREATE INDEX idx_vsix_downloads_timestamp ON vsix_downloads(download_timestamp);

-- =============================================================================
-- HELPER FUNCTIONS & TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chat_conversations_updated_at
    BEFORE UPDATE ON chat_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- VIEWS FOR ANALYTICS
-- =============================================================================

-- User usage summary view
CREATE VIEW user_usage_summary AS
SELECT 
    u.id,
    u.email,
    u.created_at,
    u.last_login,
    COUNT(DISTINCT cs.id) AS total_chat_sessions,
    COUNT(DISTINCT ts.id) AS total_test_sessions,
    COUNT(DISTINCT ags.id) AS total_agent_sessions,
    COALESCE(SUM(us.tokens_used), 0) AS total_tokens_used,
    COUNT(DISTINCT vd.id) AS total_downloads
FROM users u
LEFT JOIN chat_conversations cs ON u.id = cs.user_id
LEFT JOIN testing_sessions ts ON u.id = ts.user_id
LEFT JOIN agent_sessions ags ON u.id = ags.user_id
LEFT JOIN usage_stats us ON u.id = us.user_id
LEFT JOIN vsix_downloads vd ON u.id = vd.user_id
GROUP BY u.id, u.email, u.created_at, u.last_login;

-- Rate limiting check (requests in last hour)
CREATE VIEW user_hourly_requests AS
SELECT 
    user_id,
    COUNT(*) AS requests_last_hour
FROM usage_stats
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY user_id;

-- Daily token usage
CREATE VIEW user_daily_tokens AS
SELECT 
    user_id,
    DATE(timestamp) AS usage_date,
    SUM(tokens_used) AS tokens_used
FROM usage_stats
WHERE timestamp > NOW() - INTERVAL '1 day'
GROUP BY user_id, DATE(timestamp);
```

---

## ☁️ **Azure Services Required**

### **Request this from your Infra Team:**

```
┌─────────────────────────────────────────────────────────────────┐
│              AZURE SERVICES CHECKLIST                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ☐ 1. Azure Web App (Backend API)                                │
│      Resource Name: accesslint-backend                           │
│      Plan: P1V3 (or B2 for testing)                             │
│      Runtime: Node.js 18 LTS                                     │
│      Region: East US (or company preferred)                      │
│      Features:                                                   │
│        - Deployment slots: 2 (production + staging)             │
│        - Always On: Enabled                                      │
│        - HTTPS Only: Enabled                                     │
│        - Managed Identity: Enabled (for Key Vault access)       │
│                                                                  │
│ ☐ 2. Azure Static Web Apps OR Web App (Frontend)                │
│      Resource Name: accesslint-frontend                          │
│      Option A: Static Web Apps (Free tier OK)                   │
│      Option B: Same Web App as backend                           │
│      Runtime: Static HTML/JS/CSS                                 │
│                                                                  │
│ ☐ 3. Azure Database for PostgreSQL                              │
│      Resource Name: accesslint-db                                │
│      Tier: Basic (1-2 vCores) or General Purpose                │
│      Version: PostgreSQL 14 or 15                                │
│      Storage: 32 GB (auto-expand enabled)                        │
│      Backup: 7 days retention                                    │
│      Features:                                                   │
│        - SSL Enforcement: Enabled                                │
│        - Public network access: Enabled (with firewall rules)   │
│        - Allow Azure services access: Yes                        │
│                                                                  │
│ ☐ 4. Azure Blob Storage                                         │
│      Storage Account Name: accesslintstorage                     │
│      Account Type: StorageV2 (General Purpose v2)               │
│      Performance: Standard                                       │
│      Replication: LRS (Locally Redundant Storage)               │
│      Containers:                                                 │
│        - vsix-files (Hot tier, public read access)              │
│        - test-reports (Cool tier, private)                      │
│        - user-uploads (Hot tier, private)                       │
│      Features:                                                   │
│        - Blob versioning: Enabled                                │
│        - Soft delete: 7 days                                     │
│                                                                  │
│ ☐ 5. Azure Key Vault                                            │
│      Resource Name: accesslint-keyvault                          │
│      Secrets to store:                                           │
│        - AZURE-OPENAI-ENDPOINT                                  │
│        - AZURE-OPENAI-KEY                                       │
│        - JWT-SECRET (for token signing)                         │
│        - POSTGRES-CONNECTION-STRING                             │
│        - POSTGRES-PASSWORD                                       │
│      Access Policies:                                            │
│        - Web App Managed Identity: Get Secrets                   │
│                                                                  │
│ ☐ 6. Azure OpenAI Service                                       │
│      Resource Name: accesslint-openai                            │
│      Model Deployment:                                           │
│        - gpt-4o OR gpt-4-turbo OR gpt-35-turbo                  │
│        - Tokens per Minute (TPM): 10K minimum                   │
│      Region: East US or Sweden Central                           │
│      Features:                                                   │
│        - Content filtering: Default                              │
│        - Managed Identity: Enabled                               │
│                                                                  │
│ ☐ 7. Azure Application Insights                                 │
│      Resource Name: accesslint-insights                          │
│      Log retention: 90 days                                      │
│      Features:                                                   │
│        - Custom metrics: Enabled                                 │
│        - Alerting: Enabled                                       │
│        - Daily cap: 5 GB                                         │
│      Alerts to configure:                                        │
│        - Error rate > 5%                                         │
│        - Response time > 3 seconds                               │
│        - Dependency failures                                     │
│                                                                  │
│ ☐ 8. Azure DevOps / GitLab Integration                          │
│      Service Connections:                                        │
│        - Web App (for deployment)                                │
│        - Container Registry (if using Docker)                    │
│      Permissions:                                                │
│        - Deploy to Web App                                       │
│        - Read/Write to Blob Storage                              │
│                                                                  │
│ ☐ 9. Azure CDN (Optional - for faster VSIX downloads)           │
│      Profile Name: accesslint-cdn                                │
│      Origin: Blob Storage (vsix-files container)                │
│      Caching: Standard                                           │
│                                                                  │
│ ☐ 10. Azure Redis Cache (Optional - for session storage)        │
│      Resource Name: accesslint-redis                             │
│      Tier: Basic C0 (250 MB)                                     │
│      Use: Session storage, rate limit counters                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### **Network & Security Configuration**

```
Firewall Rules:
- PostgreSQL: Allow Azure services + Your IP for dev
- Blob Storage: Allow public read for VSIX, private for others
- Web App: HTTPS only, CORS enabled for frontend domain

Managed Identities:
- Web App → Key Vault (read secrets)
- Web App → Blob Storage (read/write)
- Web App → PostgreSQL (connect)
- Web App → Azure OpenAI (API calls)
```

---

## 🏗️ **Backend Architecture (Express + TypeScript)**

### **Project Structure**

```
backend/
├── src/
│   ├── controllers/           # Request handlers
│   │   ├── authController.ts       # Register, login, logout, refresh
│   │   ├── chatController.ts       # Chat message handling
│   │   ├── testingController.ts    # Test execution, results
│   │   ├── agentController.ts      # Agent session management
│   │   ├── downloadController.ts   # VSIX download with SAS token
│   │   └── userController.ts       # User profile, usage stats
│   │
│   ├── services/              # Business logic
│   │   ├── aiService.ts            # Azure OpenAI integration (hardcoded key)
│   │   ├── orchestratorService.ts  # Agent orchestration (migrated)
│   │   ├── toolService.ts          # Tool execution (read, write, edit, etc.)
│   │   ├── loggingService.ts       # Save logs to PostgreSQL
│   │   ├── authService.ts          # JWT generation, validation
│   │   └── rateLimitService.ts     # Check rate limits from DB
│   │
│   ├── middleware/            # Express middleware
│   │   ├── authMiddleware.ts       # Validate JWT on protected routes
│   │   ├── rateLimitMiddleware.ts  # Enforce rate limits
│   │   ├── errorHandler.ts         # Global error handling
│   │   ├── requestLogger.ts        # Log all requests to DB
│   │   └── validateRequest.ts      # Input validation (Joi/Zod)
│   │
│   ├── models/                # Database models (Sequelize or TypeORM)
│   │   ├── User.ts
│   │   ├── Session.ts
│   │   ├── ChatConversation.ts
│   │   ├── ChatMessage.ts
│   │   ├── AgentSession.ts
│   │   ├── AgentIteration.ts
│   │   ├── TestingSession.ts
│   │   ├── TestingFix.ts
│   │   ├── DebugLog.ts
│   │   ├── UsageStat.ts
│   │   └── VsixDownload.ts
│   │
│   ├── routes/                # API endpoints
│   │   ├── auth.routes.ts          # /api/auth/*
│   │   ├── chat.routes.ts          # /api/chat/*
│   │   ├── testing.routes.ts       # /api/testing/*
│   │   ├── agent.routes.ts         # /api/agent/*
│   │   ├── download.routes.ts      # /api/download/*
│   │   └── user.routes.ts          # /api/user/*
│   │
│   ├── config/                # Configuration
│   │   ├── database.ts             # PostgreSQL connection
│   │   ├── azureKeyVault.ts        # Fetch secrets from Key Vault
│   │   ├── azureBlobStorage.ts     # Blob client setup
│   │   ├── azureOpenAI.ts          # OpenAI client (hardcoded key from vault)
│   │   └── constants.ts            # Rate limits, token limits, etc.
│   │
│   ├── utils/                 # Utility functions
│   │   ├── jwt.ts                  # JWT sign/verify
│   │   ├── password.ts             # bcrypt hash/compare
│   │   ├── sasToken.ts             # Generate SAS for Blob
│   │   └── validators.ts           # Input validation schemas
│   │
│   ├── types/                 # TypeScript types
│   │   ├── index.ts
│   │   └── express.d.ts            # Extend Express Request type
│   │
│   └── server.ts              # Express app entry point
│
├── tests/                     # Unit & integration tests
│   ├── unit/
│   └── integration/
│
├── .env.example               # Environment variables template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

### **Key API Endpoints**

```typescript
// Authentication
POST   /api/auth/register      { email, password } → { user, tokens }
POST   /api/auth/login         { email, password } → { user, tokens }
POST   /api/auth/refresh       { refresh_token } → { access_token }
POST   /api/auth/logout        { } → { success }
GET    /api/auth/me            → { user, usage }

// Chat
POST   /api/chat/message       { message, mode } → { response, tools }
GET    /api/chat/conversations → { conversations[] }
GET    /api/chat/:id/messages  → { messages[] }

// Testing
POST   /api/testing/run        { url, nvda_logs } → { issues, session_id }
POST   /api/testing/fix        { session_id, issues } → { agent_session_id }
GET    /api/testing/:id        → { results }

// Agent
POST   /api/agent/start        { goal, context } → { session_id }
GET    /api/agent/:id/status   → { status, iterations, file_changes }
GET    /api/agent/:id/logs     → { iterations[] }

// Download
GET    /api/download/vsix      → { download_url (SAS), version }

// User
GET    /api/user/usage         → { requests, tokens, rate_limits }
GET    /api/user/sessions      → { agent_sessions[], testing_sessions[] }
```

### **Rate Limiting Logic**

```typescript
// middleware/rateLimitMiddleware.ts
export async function checkRateLimit(req: Request, res: Response, next: NextFunction) {
    const userId = req.user.id;
    
    // Get user's configured limits
    const user = await User.findByPk(userId);
    const hourlyLimit = user.rate_limit_per_hour;
    const dailyTokenLimit = user.rate_limit_tokens_per_day;
    
    // Check hourly request count
    const hourlyRequests = await UsageStat.count({
        where: {
            user_id: userId,
            timestamp: { [Op.gte]: new Date(Date.now() - 3600000) } // Last hour
        }
    });
    
    if (hourlyRequests >= hourlyLimit) {
        return res.status(429).json({
            error: 'Rate limit exceeded',
            limit: hourlyLimit,
            reset_at: new Date(Date.now() + 3600000)
        });
    }
    
    // Check daily token usage
    const dailyTokens = await UsageStat.sum('tokens_used', {
        where: {
            user_id: userId,
            timestamp: { [Op.gte]: new Date(Date.now() - 86400000) } // Last 24h
        }
    });
    
    if (dailyTokens >= dailyTokenLimit) {
        return res.status(429).json({
            error: 'Daily token limit exceeded',
            limit: dailyTokenLimit,
            reset_at: new Date(Date.now() + 86400000)
        });
    }
    
    next();
}
```

---

## 🎨 **Frontend Architecture (React + Tailwind CSS)**

### **Project Structure**

```
frontend/
├── src/
│   ├── pages/
│   │   ├── LoginPage.tsx          # Email + password login
│   │   ├── RegisterPage.tsx       # New user registration
│   │   ├── DashboardPage.tsx      # Main page after login
│   │   └── NotFoundPage.tsx       # 404 page
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.tsx         # Header with logo + logout
│   │   │   └── Footer.tsx         # Footer with links
│   │   │
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx      # Login form component
│   │   │   └── RegisterForm.tsx   # Register form component
│   │   │
│   │   └── dashboard/
│   │       ├── DownloadButton.tsx # VSIX download button
│   │       ├── UsageStats.tsx     # Display usage metrics
│   │       └── QuickStart.tsx     # Installation instructions
│   │
│   ├── services/
│   │   ├── api.ts                 # Axios instance with interceptors
│   │   ├── authService.ts         # Login, register, logout
│   │   ├── downloadService.ts     # VSIX download
│   │   └── userService.ts         # Get usage stats
│   │
│   ├── hooks/
│   │   ├── useAuth.ts             # Authentication hook
│   │   └── useUsage.ts            # Usage stats hook
│   │
│   ├── utils/
│   │   ├── tokenManager.ts        # JWT storage/retrieval
│   │   └── formatters.ts          # Date, number formatting
│   │
│   ├── types/
│   │   └── index.ts               # TypeScript types
│   │
│   ├── App.tsx                    # Main app component
│   ├── index.tsx                  # Entry point
│   └── index.css                  # Tailwind imports
│
├── public/
│   ├── index.html
│   └── favicon.ico
│
├── tailwind.config.js
├── package.json
├── tsconfig.json
└── README.md
```

### **UI Design (Tailwind CSS)**

#### **Login Page**
```tsx
// Simple, professional, centered login form
// Features:
// - Email input
// - Password input (with show/hide toggle)
// - "Remember me" checkbox
// - "Login" button (primary blue)
// - "Don't have an account? Register" link
// - Clean gradient background
```

#### **Dashboard Page**
```tsx
// After login, user sees:
// 1. Welcome message with user email
// 2. Large "Download Extension" button (primary action)
// 3. Version info (e.g., "v1.0.0 - Latest")
// 4. Usage stats card:
//    - Requests this hour: 15/100
//    - Tokens today: 45,000/100,000
//    - Last download: 2 days ago
// 5. Quick start guide:
//    - Step 1: Download VSIX
//    - Step 2: Install in VSCode
//    - Step 3: Login in extension
// 6. Logout button in navbar
```

### **Key Features**

```typescript
// Auto-refresh token before expiry
// Redirect to login if unauthorized
// Show loading states during downloads
// Error handling with toast notifications
// Responsive design (mobile-friendly)
```

---

## 📦 **VSIX Packaging Strategy**

### **What's Included in VSIX**

```
accesslint.vsix (~150-200 MB)
├── extension.js (compiled TypeScript)
├── node_modules/
│   ├── @guidepup/guidepup
│   ├── playwright
│   ├── axios
│   ├── jsonwebtoken
│   └── ... (all npm dependencies)
├── webviews/
│   ├── chat.html, chat.js, chat.css
│   ├── testing.html, testing.js, testing.css
│   └── diffViewer.html, diffViewer.js, diffViewer.css
├── icons/
└── package.json (with engines: node >= 18)
```

### **User Installation Requirements**

**Pre-requisites (users MUST have):**
1. **Node.js 18+** - For VSCode extension runtime
2. **NVDA** - For screen reader testing (Windows only)
3. **Internet connection** - For Playwright browser download

**First-Time Setup (automatic in extension):**
```typescript
// On first activation
async function setupExtension() {
    // 1. Check Node.js version
    const nodeVersion = process.version;
    if (!nodeVersion.startsWith('v18') && !nodeVersion.startsWith('v20')) {
        showError('Node.js 18+ required');
        return;
    }
    
    // 2. Install Playwright browsers (only once)
    const browsersInstalled = existsSync('~/.cache/ms-playwright');
    if (!browsersInstalled) {
        showInstallPrompt('Chromium browser required. Install now?');
        execSync('npx playwright install chromium --with-deps');
    }
    
    // 3. Check NVDA (Windows only)
    if (platform === 'win32') {
        const nvdaPath = 'C:\\Program Files (x86)\\NVDA\\nvda.exe';
        if (!existsSync(nvdaPath)) {
            showWarning('NVDA not found. Download from nvaccess.org');
        }
    }
    
    // 4. Authenticate with backend
    await authenticateExtension();
}
```

### **VSIX Build Process**

```bash
# In your extension directory
npm install
npm run compile
vsce package --out accesslint-v1.0.0.vsix

# Upload to Azure Blob Storage
az storage blob upload \
  --account-name accesslintstorage \
  --container-name vsix-files \
  --name accesslint-v1.0.0.vsix \
  --file accesslint-v1.0.0.vsix
```

---

## 🔐 **Authentication Flow (Detailed)**

### **Registration Flow**

```
1. User fills form on React app
   ↓
2. POST /api/auth/register { email, password }
   ↓
3. Backend validates:
   - Email format
   - Password strength (min 8 chars, 1 uppercase, 1 number)
   - Email not already registered
   ↓
4. Hash password with bcrypt
   ↓
5. Insert into users table
   ↓
6. Generate JWT tokens (access + refresh)
   ↓
7. Return { user, access_token, refresh_token }
   ↓
8. Frontend stores tokens in localStorage
   ↓
9. Redirect to dashboard
```

### **Login Flow**

```
1. User enters email + password
   ↓
2. POST /api/auth/login { email, password }
   ↓
3. Backend validates:
   - User exists
   - Password matches hash
   - Account is active
   ↓
4. Update last_login timestamp
   ↓
5. Generate JWT tokens
   ↓
6. Save session to sessions table
   ↓
7. Return { user, access_token, refresh_token }
   ↓
8. Frontend stores tokens
   ↓
9. Redirect to dashboard
```

### **VSCode Extension Authentication**

```
1. Extension activates
   ↓
2. Check for stored JWT in VSCode secrets
   ↓
3. If no token:
   a. Show login prompt in VSCode
   b. User enters email + password
   c. POST /api/auth/login
   d. Store JWT in secrets.store('accesslint_token', token)
   ↓
4. If token exists:
   a. Validate with GET /api/auth/me
   b. If expired, refresh with POST /api/auth/refresh
   ↓
5. Include JWT in all API calls:
   headers: { 'Authorization': 'Bearer <token>' }
```

### **JWT Structure**

```json
{
  "header": {
    "alg": "RS256",
    "typ": "JWT"
  },
  "payload": {
    "user_id": "uuid",
    "email": "user@example.com",
    "iat": 1234567890,
    "exp": 1234571490
  },
  "signature": "..."
}
```

**Token Expiry:**
- Access token: 1 hour
- Refresh token: 30 days

---

## 🔄 **CI/CD Pipeline (Azure GitLab)**

### **GitLab CI Configuration**

```yaml
# .gitlab-ci.yml (backend)

stages:
  - build
  - test
  - deploy

variables:
  AZURE_WEB_APP_NAME: "accesslint-backend"
  RESOURCE_GROUP: "accesslint-rg"
  NODE_VERSION: "18"

# =====================================
# BUILD STAGE
# =====================================
build:
  stage: build
  image: node:18
  script:
    - npm ci
    - npm run build
    - npm run lint
  artifacts:
    paths:
      - dist/
      - node_modules/
    expire_in: 1 hour
  only:
    - main
    - develop

# =====================================
# TEST STAGE
# =====================================
test:
  stage: test
  image: node:18
  script:
    - npm ci
    - npm run test:unit
    - npm run test:integration
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
  only:
    - main
    - develop

# =====================================
# DEPLOY TO STAGING
# =====================================
deploy_staging:
  stage: deploy
  image: mcr.microsoft.com/azure-cli
  script:
    - az login --service-principal -u $AZURE_CLIENT_ID -p $AZURE_CLIENT_SECRET --tenant $AZURE_TENANT_ID
    - zip -r deploy.zip dist/ node_modules/ package.json
    - az webapp deployment source config-zip 
        --resource-group $RESOURCE_GROUP 
        --name $AZURE_WEB_APP_NAME 
        --slot staging 
        --src deploy.zip
    - echo "Deployed to https://${AZURE_WEB_APP_NAME}-staging.azurewebsites.net"
  only:
    - develop
  environment:
    name: staging
    url: https://accesslint-backend-staging.azurewebsites.net

# =====================================
# DEPLOY TO PRODUCTION
# =====================================
deploy_production:
  stage: deploy
  image: mcr.microsoft.com/azure-cli
  script:
    - az login --service-principal -u $AZURE_CLIENT_ID -p $AZURE_CLIENT_SECRET --tenant $AZURE_TENANT_ID
    - zip -r deploy.zip dist/ node_modules/ package.json
    - az webapp deployment source config-zip 
        --resource-group $RESOURCE_GROUP 
        --name $AZURE_WEB_APP_NAME 
        --src deploy.zip
    - echo "Deployed to https://${AZURE_WEB_APP_NAME}.azurewebsites.net"
  only:
    - main
  when: manual
  environment:
    name: production
    url: https://accesslint-backend.azurewebsites.net
```

### **Git Configuration for RnlAzure-GitLab**

```bash
# Configure Git
git config --global user.name "Your Name"
git config --global user.email "your.email@company.com"
git config --global http.sslVerify false  # If self-signed cert

# Add remote
git remote add origin https://10.221.0.74/gitlab/your-username/accesslint-backend.git

# Push to GitLab
git add .
git commit -m "Initial backend setup"
git push -u origin main
```

### **Environment Variables in Azure Web App**

```bash
# Set via Azure Portal or CLI
az webapp config appsettings set \
  --name accesslint-backend \
  --resource-group accesslint-rg \
  --settings \
    NODE_ENV=production \
    KEY_VAULT_URL=https://accesslint-keyvault.vault.azure.net/ \
    POSTGRES_HOST=accesslint-db.postgres.database.azure.com \
    POSTGRES_DB=accesslint \
    POSTGRES_USER=adminuser \
    BLOB_STORAGE_ACCOUNT=accesslintstorage \
    BLOB_CONTAINER_VSIX=vsix-files \
    JWT_EXPIRY=3600 \
    RATE_LIMIT_DEFAULT=100
```

---

## 💰 **Cost Estimation**

### **Monthly Azure Costs**

| Service | Tier | Estimated Cost |
|---------|------|----------------|
| **Web App (Backend)** | P1V3 (2 vCPU, 8 GB RAM) | $130/month |
| **Web App (Frontend)** | Static Web Apps Free | $0 |
| **PostgreSQL** | Basic (1 vCore, 50 GB) | $35/month |
| **Blob Storage** | Standard (100 GB) | $5/month |
| **Azure OpenAI** | Pay-per-token | $50-500/month* |
| **Key Vault** | Standard | $5/month |
| **Application Insights** | Basic (5 GB) | $10/month |
| **Azure CDN** | Standard | $10/month |
| **Redis Cache (Optional)** | Basic C0 | $15/month |
| **Total** | | **$260-710/month** |

*Azure OpenAI costs depend heavily on usage:
- GPT-4o: $2.50/1M input tokens, $10/1M output tokens
- GPT-4-turbo: $5/1M input tokens, $15/1M output tokens
- GPT-3.5-turbo: $0.50/1M input tokens, $1.50/1M output tokens

**Example usage calculation:**
- 100 users
- 10 requests/day per user
- 1000 tokens/request average
- Total: 100 × 10 × 1000 = 1M tokens/day = 30M tokens/month
- Cost (GPT-4o): ~$75-150/month

---

## 📈 **Implementation Phases**

### **Phase 1: Infrastructure Setup (Week 1)**

**Tasks:**
- ✅ Request Azure services from infra team
- ✅ Create resource group
- ✅ Deploy PostgreSQL database
- ✅ Set up Blob Storage with containers
- ✅ Configure Key Vault with secrets
- ✅ Deploy Azure OpenAI
- ✅ Set up Application Insights
- ✅ Create Web App (backend + frontend)
- ✅ Configure managed identities
- ✅ Set up firewall rules

**Deliverable:** All Azure services running and accessible

---

### **Phase 2: Database Setup (Week 1)**

**Tasks:**
- ✅ Connect to PostgreSQL
- ✅ Run schema creation scripts
- ✅ Create indexes
- ✅ Set up views
- ✅ Test connections from Web App
- ✅ Create backup policies

**Deliverable:** Database ready with all tables

---

### **Phase 3: Backend Development (Week 2-3)**

**Tasks:**
- ✅ Set up Express + TypeScript project
- ✅ Implement authentication (register, login, JWT)
- ✅ Migrate AI providers (OpenAI, Anthropic, Gemini)
- ✅ Migrate orchestrators (chat agent, testing agent)
- ✅ Migrate tool manager and all tools
- ✅ Implement rate limiting middleware
- ✅ Implement logging service (PostgreSQL)
- ✅ Create all API endpoints
- ✅ Implement VSIX download with SAS tokens
- ✅ Write unit tests
- ✅ Write integration tests

**Deliverable:** Fully functional backend API

---

### **Phase 4: Frontend Development (Week 3-4)**

**Tasks:**
- ✅ Set up React + Tailwind CSS project
- ✅ Create login page
- ✅ Create register page
- ✅ Create dashboard page
- ✅ Implement authentication hooks
- ✅ Implement download functionality
- ✅ Add usage stats display
- ✅ Make responsive for mobile
- ✅ Test on all browsers

**Deliverable:** Professional React SPA

---

### **Phase 5: VSCode Extension Updates (Week 4-5)**

**Tasks:**
- ✅ Replace direct AI calls with backend API calls
- ✅ Implement authentication in extension
- ✅ Store JWT in VSCode secrets
- ✅ Update chat webview (still works but calls backend)
- ✅ Update testing webview (NVDA runs locally, sends logs to backend)
- ✅ Update agent orchestrator to use backend
- ✅ Add error handling for network failures
- ✅ Add offline mode detection
- ✅ Update first-time setup flow
- ✅ Test with real users

**Deliverable:** Updated VSIX that works with backend

---

### **Phase 6: CI/CD Setup (Week 5)**

**Tasks:**
- ✅ Configure GitLab with company's instance
- ✅ Create .gitlab-ci.yml for backend
- ✅ Create .gitlab-ci.yml for frontend
- ✅ Set up staging + production slots
- ✅ Configure environment variables
- ✅ Test deployments
- ✅ Set up monitoring alerts

**Deliverable:** Automated deployment pipeline

---

### **Phase 7: Testing & Launch (Week 6)**

**Tasks:**
- ✅ Load testing (simulate 100+ users)
- ✅ Security testing (OWASP ZAP)
- ✅ Penetration testing
- ✅ Rate limiting verification
- ✅ VSIX download testing
- ✅ End-to-end testing with real users
- ✅ Documentation (user guide, admin guide)
- ✅ Beta launch to 10 users
- ✅ Collect feedback
- ✅ Fix issues
- ✅ Full launch

**Deliverable:** Production-ready system

---

## 🎯 **Success Criteria**

### **Performance**
- ✅ API response time < 2 seconds (95th percentile)
- ✅ VSIX download time < 30 seconds on average connection
- ✅ Chat response time < 5 seconds
- ✅ Testing session completion < 60 seconds

### **Reliability**
- ✅ 99.5% uptime
- ✅ < 0.1% error rate
- ✅ Automatic failover for database
- ✅ Backup and restore tested

### **Security**
- ✅ All API keys stored in Key Vault
- ✅ JWT with RSA signing
- ✅ HTTPS only
- ✅ Rate limiting enforced
- ✅ No PII in logs

### **Scalability**
- ✅ Support 100 concurrent users initially
- ✅ Auto-scale to 10 instances
- ✅ Database can handle 1000 requests/second

---

## 📚 **Additional Notes**

### **Rate Limiting Configuration (To Be Decided)**

```typescript
// Default rate limits per user (adjustable per user in DB)
const DEFAULT_RATE_LIMITS = {
    requests_per_hour: 100,         // Adjust based on usage patterns
    requests_per_day: 1000,         // Adjust based on usage patterns
    tokens_per_day: 100000,         // Adjust based on OpenAI costs
    concurrent_sessions: 5          // Max parallel agent sessions
};

// Can be updated per user:
UPDATE users SET 
    rate_limit_per_hour = 200,
    rate_limit_tokens_per_day = 200000
WHERE email = 'power-user@example.com';
```

### **Monitoring & Alerts**

```yaml
Alerts to configure in Application Insights:
  - Error rate > 5% for 5 minutes → Email admin
  - Response time > 3 seconds (95th percentile) → Email admin
  - OpenAI API calls failing > 10% → Email admin
  - Database connection failures → Email admin immediately
  - Disk space > 80% → Email admin
  - Memory usage > 90% → Email admin
```

### **Backup Strategy**

```
PostgreSQL:
  - Automated daily backups (7-day retention)
  - Weekly full backup archived to Blob Storage
  - Test restore monthly

Blob Storage:
  - Soft delete enabled (7 days)
  - Versioning enabled
  - Geo-redundant for VSIX files

Web App:
  - Source code in GitLab
  - Configuration backed up via ARM templates
```

---

## ✅ **Ready for Implementation**

Once Azure services are provisioned, we'll proceed with:
1. Database schema creation
2. Backend API development
3. Frontend React app
4. VSCode extension updates
5. CI/CD pipeline setup
6. Testing & deployment

**Total Timeline: 6 weeks**

**Next Step:** Share this plan with your infra team and request the Azure services listed above.

