# AccessLint - Technical Architecture Documentation

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Project Structure](#project-structure)
4. [Backend Architecture](#backend-architecture)
5. [Frontend (React Portal)](#frontend-react-portal)
6. [VS Code Extension](#vs-code-extension)
7. [Database Schema](#database-schema)
8. [Authentication & Authorization](#authentication--authorization)
9. [Data Flow & Communication](#data-flow--communication)
10. [Azure Services & Deployment](#azure-services--deployment)
11. [Build & Compilation Process](#build--compilation-process)
12. [Development Workflow](#development-workflow)
13. [Testing & Debugging](#testing--debugging)
14. [Security Considerations](#security-considerations)

---

## 🎯 Project Overview

**AccessLint** is an AI-powered VS Code extension that helps developers fix accessibility issues in their code. It consists of three main components:

1. **Backend API** (Node.js + Express + PostgreSQL)
2. **Frontend Portal** (React + Vite + Tailwind CSS)
3. **VS Code Extension** (TypeScript + VS Code API)

### Key Features

- **Quick Mode Chat**: Fast AI responses for accessibility questions
- **Agent Mode**: Autonomous AI agent that reads/writes code using tools
- **Accessibility Testing**: Automated testing with NVDA screen reader
- **Diff Viewer**: Visual code change approval system
- **User Management**: Login, rate limiting, usage tracking

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER'S COMPUTER                         │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │         VS Code Extension (Installed as .vsix)           │ │
│  │                                                           │ │
│  │  • Chat Interface (Quick Mode)                          │ │
│  │  • Agent Mode (Tool Execution)                          │ │
│  │  • Testing Interface                                    │ │
│  │  • Local Tool Execution:                                │ │
│  │    - Read/Write Files                                   │ │
│  │    - Run Bash Commands                                  │ │
│  │    - NVDA Screen Reader                                 │ │
│  │    - Playwright Browser Automation                      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                            ↕ HTTPS                              │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                      AZURE CLOUD (South India)                  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │    Azure Web App (ctonpsiotspocapp)                      │  │
│  │    ┌────────────────────┐  ┌────────────────────────┐   │  │
│  │    │  Backend API       │  │  Frontend Static Files │   │  │
│  │    │  (Node.js/Express) │  │  (React SPA @ /app)    │   │  │
│  │    │  Port 8080         │  │  Served by Express     │   │  │
│  │    └────────────────────┘  └────────────────────────┘   │  │
│  │                ↕                                          │  │
│  │    ┌────────────────────────────────────────────┐        │  │
│  │    │  PostgreSQL Database                       │        │  │
│  │    │  (ctonpsiotspoc-pgserver)                  │        │  │
│  │    │  • Users, Conversations, Messages          │        │  │
│  │    │  • Agent Sessions, Iterations              │        │  │
│  │    │  • Logs, Rate Limits                       │        │  │
│  │    └────────────────────────────────────────────┘        │  │
│  │                ↕                                          │  │
│  │    ┌────────────────────────────────────────────┐        │  │
│  │    │  Azure Blob Storage (ctonpsiotspocstracc)  │        │  │
│  │    │  • VSIX Files (versioned)                  │        │  │
│  │    │  • Test Reports (PDF/HTML)                 │        │  │
│  │    │  • User Uploads                            │        │  │
│  │    └────────────────────────────────────────────┘        │  │
│  │                ↕                                          │  │
│  │    ┌────────────────────────────────────────────┐        │  │
│  │    │  Azure OpenAI (ctonpsiotspocopenai)        │        │  │
│  │    │  • GPT-5 Model                             │        │  │
│  │    │  • Private Endpoint Access                 │        │  │
│  │    │  • Token-based Billing                     │        │  │
│  │    └────────────────────────────────────────────┘        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │    Azure Key Vault (ctonpsiotspockv)                     │  │
│  │    • JWT Secret                                          │  │
│  │    • Database Password                                   │  │
│  │    • OpenAI API Key                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
accesslint_pup-main/
│
├── backend/                      # Backend API (Node.js + Express)
│   ├── src/
│   │   ├── config/              # Configuration files
│   │   │   ├── azureBlobStorage.ts    # Blob storage client
│   │   │   ├── azureKeyVault.ts       # Key Vault client
│   │   │   ├── azureOpenAI.ts         # OpenAI client (GPT-5)
│   │   │   ├── constants.ts           # App constants
│   │   │   └── database.ts            # Sequelize config
│   │   │
│   │   ├── controllers/         # Request handlers
│   │   │   ├── agentController.ts     # Agent mode endpoints
│   │   │   ├── authController.ts      # Login/Register
│   │   │   ├── chatController.ts      # Chat endpoints
│   │   │   ├── downloadController.ts  # VSIX download
│   │   │   ├── testingController.ts   # Testing endpoints
│   │   │   └── userController.ts      # User management
│   │   │
│   │   ├── middleware/          # Express middleware
│   │   │   ├── authMiddleware.ts      # JWT verification
│   │   │   ├── errorHandler.ts        # Error handling
│   │   │   └── rateLimitMiddleware.ts # Rate limiting
│   │   │
│   │   ├── models/              # Database models (Sequelize)
│   │   │   ├── user.model.ts          # User table
│   │   │   ├── conversation.model.ts  # Conversations
│   │   │   ├── message.model.ts       # Chat messages
│   │   │   ├── agentSession.model.ts  # Agent sessions
│   │   │   ├── agentIteration.model.ts# Agent iterations
│   │   │   ├── debugLog.model.ts      # Debug logs
│   │   │   ├── download.model.ts      # VSIX downloads
│   │   │   ├── rateLimit.model.ts     # Rate limit tracking
│   │   │   ├── testSession.model.ts   # Test sessions
│   │   │   ├── testResult.model.ts    # Test results
│   │   │   └── index.ts               # Model exports
│   │   │
│   │   ├── routes/              # API route definitions
│   │   │   ├── agent.routes.ts        # /api/agent/*
│   │   │   ├── auth.routes.ts         # /api/auth/*
│   │   │   ├── chat.routes.ts         # /api/chat/*
│   │   │   ├── download.routes.ts     # /api/download/*
│   │   │   ├── testing.routes.ts      # /api/testing/*
│   │   │   ├── user.routes.ts         # /api/user/*
│   │   │   └── index.ts               # Route aggregation
│   │   │
│   │   ├── services/            # Business logic
│   │   │   ├── agentSystemPrompt.ts   # Agent AI prompts
│   │   │   ├── aiService.ts           # AI chat logic
│   │   │   ├── authService.ts         # JWT generation
│   │   │   ├── loggingService.ts      # Logging utilities
│   │   │   ├── orchestratorService.ts # Agent orchestration
│   │   │   └── tools/                 # Agent tools
│   │   │       ├── toolManager.ts
│   │   │       ├── readTool.ts
│   │   │       ├── writeTool.ts
│   │   │       └── types.ts
│   │   │
│   │   ├── utils/               # Utility functions
│   │   │   ├── logger.ts              # Winston logger
│   │   │   └── validation.ts          # Input validation
│   │   │
│   │   └── server.ts            # Main Express app
│   │
│   ├── database/                # Database scripts
│   │   └── schema.sql           # PostgreSQL schema
│   │
│   ├── deploy/                  # Deployment build
│   │   └── (compiled JS files for Azure)
│   │
│   ├── deploy-package.json      # Production dependencies
│   ├── package.json             # Dev + production dependencies
│   ├── tsconfig.json            # TypeScript config
│   └── env.template             # Environment variables template
│
├── frontend/                    # React Portal (User downloads VSIX)
│   ├── src/
│   │   ├── components/          # React components
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── DashboardPage.tsx
│   │   │
│   │   ├── services/            # API client
│   │   │   └── api.ts           # Axios instance
│   │   │
│   │   ├── App.tsx              # Main app component
│   │   ├── main.tsx             # React entry point
│   │   └── vite-env.d.ts        # Vite types
│   │
│   ├── dist/                    # Built static files (after npm run build)
│   │   ├── index.html
│   │   ├── assets/
│   │   │   ├── index-[hash].js  # Bundled React app
│   │   │   └── index-[hash].css # Bundled styles
│   │   └── ...
│   │
│   ├── index.html               # HTML template
│   ├── package.json             # Frontend dependencies
│   ├── vite.config.ts           # Vite bundler config
│   ├── tailwind.config.js       # Tailwind CSS config
│   ├── tsconfig.json            # TypeScript config
│   └── .env.production          # Production API URL
│
├── src/                         # VS Code Extension Source
│   ├── agentLLMOrchestrator.ts  # Agent mode logic
│   ├── aiProviderManager.ts     # AI provider abstraction
│   ├── apiKeyManager.ts         # API key storage (hardcoded GPT-5)
│   ├── anthropicChat.ts         # Anthropic provider
│   ├── geminiChat.ts            # Gemini provider
│   ├── openaiChat.ts            # OpenAI/GPT-5 provider
│   ├── chatWebviewProvider.ts   # Chat UI (Quick Mode)
│   ├── testingWebviewProvider.ts# Testing UI
│   ├── extension.ts             # Extension entry point
│   ├── fileContextTracker.ts    # Track file reads for context
│   ├── llmToolCallParser.ts     # Parse AI tool calls
│   ├── retryUtils.ts            # Retry logic for API calls
│   ├── todoListManager.ts       # Todo list generation
│   │
│   ├── diffViewer/              # Diff approval system
│   │   ├── DiffGenerator.ts     # Generate file diffs
│   │   ├── DiffViewerManager.ts # Manage diff requests
│   │   └── DiffViewerProvider.ts# Webview UI provider
│   │
│   ├── services/                # Extension services
│   │   └── backendApiClient.ts  # API client (Axios)
│   │
│   ├── tools-accesslint/        # Agent tools (file ops)
│   │   ├── toolManager.ts       # Tool execution
│   │   ├── readTool.ts          # Read files locally
│   │   ├── writeTool.ts         # Write files locally
│   │   ├── editTool.ts          # Edit files locally
│   │   ├── grepTool.ts          # Search files
│   │   ├── listDirTool.ts       # List directories
│   │   ├── bashTool.ts          # Run bash commands
│   │   └── types.ts             # Tool types
│   │
│   └── types.ts                 # Shared types
│
├── out/                         # Compiled Extension (after npm run compile)
│   ├── extension.js             # Compiled entry point
│   ├── agentLLMOrchestrator.js
│   ├── chatWebviewProvider.js
│   ├── diffViewer/
│   ├── services/
│   ├── tools-accesslint/
│   └── ...
│
├── webviews/                    # Webview UI (HTML/CSS/JS)
│   ├── chat.html                # Chat UI (not used, inline)
│   ├── chat.js                  # Chat JavaScript
│   ├── chat.css                 # Chat styles
│   ├── testing.html             # Testing UI (not used, inline)
│   ├── testing.js               # Testing JavaScript
│   ├── testing.css              # Testing styles
│   ├── diffViewer.js            # Diff viewer JavaScript
│   └── diffViewer.css           # Diff viewer styles
│
├── icons/                       # Extension icons
│   └── accessibility-white.svg
│
├── node_modules/                # Extension dependencies
│   └── (installed packages)
│
├── .vscodeignore                # Files excluded from VSIX
├── package.json                 # Extension manifest
├── tsconfig.json                # TypeScript config (extension)
├── accesslint-0.1.0.vsix        # Packaged extension (after vsce package)
│
└── ARCHITECTURE.md              # This file!
```

---

## 🖥️ Backend Architecture

### Technology Stack

- **Runtime**: Node.js 22.x
- **Framework**: Express.js 4.x
- **Language**: TypeScript 5.x
- **Database ORM**: Sequelize 6.x with `sequelize-typescript`
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **Logging**: Winston
- **API Client**: Axios
- **Cloud SDK**: Azure SDK for Node.js

### Folder Breakdown

#### `backend/src/config/`

Configuration files for external services:

- **`azureBlobStorage.ts`**: 
  - Connects to Azure Blob Storage
  - Methods: `uploadBlob()`, `downloadBlob()`, `listBlobs()`, `deleteBlob()`
  - Containers: `vsix`, `reports`, `uploads`

- **`azureOpenAI.ts`**: 
  - Azure OpenAI client initialization
  - **Hardcoded**: Endpoint, API key, deployment (`gpt-5`)
  - API Version: `2025-01-01-preview`
  - Methods: `chatCompletion()`, `buildContextFromHistory()`

- **`database.ts`**: 
  - Sequelize initialization
  - Connects to PostgreSQL
  - Loads all models from `models/index.ts`
  - SSL configuration for Azure PostgreSQL

#### `backend/src/controllers/`

Express route handlers (business logic):

- **Request** → **Controller** → **Service** → **Database**
- Each controller handles one resource (users, chat, agent, etc.)
- Returns standardized JSON responses

Example: `chatController.ts`

```typescript
export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId, message, mode } = req.body;
    const userId = req.user!.id;

    // Create or get conversation
    let conversation = conversationId 
        ? await ChatConversation.findByPk(conversationId)
        : await createConversation(userId, mode);

    // Get AI response with context
    const aiResponse = await getAIResponse(conversation.id, message, systemPrompt);

    // Save messages to database
    await ChatMessage.create({ conversationId: conversation.id, role: 'user', content: message });
    await ChatMessage.create({ conversationId: conversation.id, role: 'assistant', content: aiResponse.response });

    res.status(200).json({ data: { response: aiResponse.response, conversationId: conversation.id }});
});
```

#### `backend/src/middleware/`

Express middleware (runs before controllers):

- **`authMiddleware.ts`**: 
  - Verifies JWT tokens
  - Attaches `req.user` to request
  - Returns 401 if token invalid

- **`rateLimitMiddleware.ts`**: 
  - Checks user's request count (hourly)
  - Checks token usage (daily)
  - Returns 429 if limit exceeded

- **`errorHandler.ts`**: 
  - Catches all errors
  - Returns standardized error responses

#### `backend/src/models/`

Database models using Sequelize ORM:

- Each file defines a table structure
- Uses TypeScript decorators (`@Table`, `@Column`, `@BelongsTo`)
- Relationships: `User` → `Conversations` → `Messages`

Example: `user.model.ts`

```typescript
@Table({ tableName: 'users' })
export class User extends Model {
    @Column({ type: DataType.UUID, defaultValue: DataType.UUIDV4, primaryKey: true })
    id!: string;

    @Column({ type: DataType.STRING, allowNull: false, unique: true })
    email!: string;

    @Column({ type: DataType.STRING, allowNull: false })
    passwordHash!: string;

    @Column({ type: DataType.ENUM('active', 'suspended'), defaultValue: 'active' })
    status!: string;
}
```

#### `backend/src/routes/`

API route definitions:

- Maps HTTP methods to controllers
- Applies middleware (auth, rate limit)
- Mounted on `/api/*`

Example: `chat.routes.ts`

```typescript
const router = Router();

router.use(authenticate);        // All routes require auth
router.use(requireActive);        // User must be active
router.use(rateLimit);            // Check rate limits
router.use(usageTracker);         // Track usage

router.post('/message', sendMessage);                    // POST /api/chat/message
router.post('/conversations', createConv);               // POST /api/chat/conversations
router.get('/conversations', getConversations);          // GET /api/chat/conversations
router.get('/conversations/:id/messages', getMessages);  // GET /api/chat/conversations/:id/messages

export default router;
```

#### `backend/src/services/`

Business logic layer:

- **`aiService.ts`**: Handles AI chat logic
  - Manages conversation context (last 3 messages)
  - Calls Azure OpenAI API
  - Estimates token usage

- **`authService.ts`**: JWT generation and verification
  - `generateAccessToken(user)` → JWT string
  - `verifyAccessToken(token)` → User object

- **`orchestratorService.ts`**: Agent mode orchestration
  - Manages agent loop (max 15 iterations)
  - Parses tool calls from AI response
  - Stores iterations in database

#### `backend/src/server.ts`

Main Express application:

```typescript
import 'reflect-metadata'; // Required for sequelize-typescript
import express from 'express';
import { sequelize } from './config/database';
import routes from './routes';

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Serve frontend static files
app.use('/app', express.static(path.join(__dirname, '..', 'app')));
app.use('/app/assets', express.static(path.join(__dirname, '..', 'app', 'assets')));

// SPA fallback for React routing
app.get('/app/*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'app', 'index.html'));
});

// API routes
app.use('/api', routes);

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});

// Connect to database
sequelize.authenticate().then(() => {
    console.log('✅ Database connected');
});
```

### Deployment Structure

After building for production:

```
backend/deploy/
├── config/
├── controllers/
├── middleware/
├── models/
├── routes/
├── services/
├── utils/
├── server.js              # Compiled entry point
├── package.json           # Production dependencies only
└── app/                   # Frontend static files
    ├── index.html
    └── assets/
        ├── index-[hash].js
        └── index-[hash].css
```

---

## 🌐 Frontend (React Portal)

### Purpose

- Users log in to download the VSIX extension
- Simple, professional UI
- No complex features (just auth + download)

### Technology Stack

- **Framework**: React 18.x
- **Build Tool**: Vite 5.x
- **Styling**: Tailwind CSS 3.x
- **HTTP Client**: Axios
- **Language**: TypeScript

### Folder Breakdown

#### `frontend/src/components/`

React components:

- **`LoginForm.tsx`**: Login UI with email/password
- **`RegisterForm.tsx`**: Registration UI
- **`DashboardPage.tsx`**: Post-login page with VSIX download button

#### `frontend/src/services/`

- **`api.ts`**: Axios instance with base URL configuration
  ```typescript
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  const api = axios.create({ baseURL: API_URL });
  ```

#### `frontend/dist/`

Production build output (after `npm run build`):

- Single-page application (SPA)
- All assets bundled and minified
- Copied to `backend/deploy/app/` for deployment

### Build Process

```bash
# Development
npm run dev          # Runs Vite dev server on port 5173

# Production
npm run build        # Compiles to frontend/dist/
# Output:
#   dist/index.html
#   dist/assets/index-[hash].js
#   dist/assets/index-[hash].css
```

### Deployment

Frontend is served by the **backend Express server** at `/app/*`:

- `https://ctonpsiotspocapp-gcfhduh3fdhab4h2.southindia-01.azurewebsites.net/app/`
- Static files: `backend/deploy/app/`
- Express serves `index.html` for all `/app/*` routes (SPA routing)

---

## 🧩 VS Code Extension

### Purpose

- Provides Chat UI (Quick Mode)
- Runs Agent Mode (autonomous file operations)
- Executes accessibility tests with NVDA
- Communicates with backend API

### Technology Stack

- **Language**: TypeScript
- **API**: VS Code Extension API
- **HTTP Client**: Axios (node-fetch for agent mode)
- **UI**: Webviews (HTML/CSS/JS)
- **Tools**: Playwright, guidepup (NVDA automation)

### Folder Breakdown

#### `src/extension.ts`

Extension entry point:

```typescript
export async function activate(context: vscode.ExtensionContext) {
    // Initialize backend API client
    const backendApiClient = new BackendApiClient(context);

    // Check authentication
    if (!backendApiClient.isAuthenticated()) {
        vscode.window.showWarningMessage('Please login to AccessLint');
        vscode.commands.executeCommand('accesslint.login');
    }

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('accesslint.login', async () => { /* ... */ }),
        vscode.commands.registerCommand('accesslint.openChat', () => { /* ... */ }),
        vscode.commands.registerCommand('accesslint.startAgent', () => { /* ... */ })
    );

    // Register webview providers
    const chatProvider = new ChatWebviewProvider(context, backendApiClient);
    vscode.window.registerWebviewViewProvider('accesslint-chat', chatProvider);
}
```

#### `src/chatWebviewProvider.ts`

Manages the chat UI (Quick Mode):

- **Webview**: HTML/CSS/JS rendered in VS Code panel
- **Message Handler**: Receives messages from webview
- **API Calls**: Sends user messages to backend
- **History**: Loads previous conversations from backend

Key methods:
- `resolveWebviewView()`: Initialize webview
- `_handleUserMessage()`: Send message to backend API
- `_loadPreviousMessages()`: Load chat history from DB

#### `src/agentLLMOrchestrator.ts`

Agent Mode orchestration:

- **Tool Execution**: Runs file operations locally
- **AI Calls**: Sends prompts to GPT-5 (currently direct, will migrate to backend)
- **Loop Management**: Iterates until task complete
- **Loop Detection**: Prevents infinite loops

Flow:
1. User provides goal: "Create a React component"
2. Orchestrator sends prompt to AI
3. AI responds with tool calls (XML format)
4. Orchestrator executes tools locally (read_file, write_file, etc.)
5. Results sent back to AI
6. Loop continues until AI calls `attempt_completion`

#### `src/services/backendApiClient.ts`

Backend API client:

```typescript
export class BackendApiClient {
    private axiosInstance: AxiosInstance;
    private authToken: string | null;

    // Authentication
    async login(email: string, password: string): Promise<void>
    async register(email: string, password: string, name: string): Promise<void>
    
    // Chat
    async sendChatMessageWithResponse(conversationId: string | null, content: string, mode: string)
    async getUserConversations(type: string)
    async getChatMessages(conversationId: string)
    
    // Agent
    async startAgentSession(goal: string, sessionType: string)
    async executeAgentIteration(sessionId: string, iterationNumber: number, llmRequest: any, llmResponse: any, toolResults: any[])
    
    // Testing
    async startTestingSession(url: string, testType: string)
    async getTestingResults(sessionId: string)
}
```

#### `src/tools-accesslint/`

Agent tools (file operations):

- **`readTool.ts`**: Read file contents
- **`writeTool.ts`**: Write file contents (with diff approval)
- **`editTool.ts`**: Apply edits to file (with diff approval)
- **`grepTool.ts`**: Search files using regex
- **`listDirTool.ts`**: List directory contents
- **`bashTool.ts`**: Execute bash commands

All tools execute **locally on user's machine**, not on the backend!

#### `src/diffViewer/`

Visual diff approval system:

- **`DiffGenerator.ts`**: Generates unified diffs for file changes
- **`DiffViewerManager.ts`**: Manages diff approval requests
- **`DiffViewerProvider.ts`**: Webview UI for approving/rejecting changes

Flow:
1. Agent wants to write/edit file
2. Diff generated
3. Webview panel opens showing changes
4. User approves/rejects
5. If approved, file is written

#### `webviews/`

HTML/CSS/JS for extension webviews:

- **`chat.js`**: Chat interface logic
- **`testing.js`**: Testing interface logic
- **`diffViewer.js`**: Diff viewer logic

These are loaded into webviews using `webview.asWebviewUri()`.

### Compilation & Packaging

#### Compilation

```bash
npm run compile
# Output: src/**/*.ts → out/**/*.js
```

The `out/` folder contains compiled JavaScript that VS Code executes.

#### Packaging

```bash
npx vsce package
# Output: accesslint-0.1.0.vsix
```

VSIX structure:
```
accesslint-0.1.0.vsix (ZIP file)
├── extension/
│   ├── out/                    # Compiled TypeScript
│   ├── node_modules/           # Dependencies (included!)
│   ├── webviews/               # Webview assets
│   ├── icons/                  # Extension icons
│   └── package.json            # Extension manifest
└── [Content_Types].xml         # VSIX metadata
```

**Note**: `.vscodeignore` controls what's excluded from VSIX.

---

## 🗄️ Database Schema

### PostgreSQL Database: `accesslint`

#### Users Table

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Conversations Table

```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    conversation_type VARCHAR(50) NOT NULL, -- 'quick_mode', 'agent_mode', 'testing'
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Messages Table

```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    timestamp TIMESTAMP DEFAULT NOW()
);
```

#### Agent Sessions Table

```sql
CREATE TABLE agent_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_type VARCHAR(50) NOT NULL, -- 'chat_agent', 'testing_agent'
    goal TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'error', 'timeout'
    result TEXT,
    error_message TEXT,
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP
);
```

#### Agent Iterations Table

```sql
CREATE TABLE agent_iterations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES agent_sessions(id) ON DELETE CASCADE,
    iteration_number INTEGER NOT NULL,
    llm_request TEXT,
    llm_response TEXT,
    tool_calls JSONB,
    tool_results JSONB,
    error_message TEXT,
    timestamp TIMESTAMP DEFAULT NOW()
);
```

#### Rate Limits Table

```sql
CREATE TABLE rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    requests_count INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    reset_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Debug Logs Table

```sql
CREATE TABLE debug_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID,
    level VARCHAR(20), -- 'info', 'warn', 'error', 'debug'
    message TEXT NOT NULL,
    metadata JSONB,
    timestamp TIMESTAMP DEFAULT NOW()
);
```

#### Downloads Table

```sql
CREATE TABLE downloads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    downloaded_at TIMESTAMP DEFAULT NOW()
);
```

### Relationships

```
users (1) ----< (N) conversations
conversations (1) ----< (N) messages
users (1) ----< (N) agent_sessions
agent_sessions (1) ----< (N) agent_iterations
users (1) ----< (N) rate_limits
users (1) ----< (N) downloads
users (1) ----< (N) debug_logs
```

---

## 🔐 Authentication & Authorization

### Flow

1. **User Registration**:
   ```
   Frontend → POST /api/auth/register { email, password, name }
   Backend → Hash password (bcrypt) → Save to DB → Return success
   ```

2. **User Login**:
   ```
   Frontend → POST /api/auth/login { email, password }
   Backend → Verify password → Generate JWT → Return token
   Frontend → Store token in localStorage
   ```

3. **JWT Structure**:
   ```json
   {
     "userId": "uuid-here",
     "email": "user@example.com",
     "iat": 1234567890,
     "exp": 1234567890
   }
   ```

4. **Authenticated Requests**:
   ```
   Extension → Request with header: Authorization: Bearer <token>
   Backend → authMiddleware → Verify JWT → Attach user to req.user
   Backend → Controller → Access req.user.id
   ```

5. **Token Expiration**:
   - Access tokens expire after 7 days
   - User must re-login
   - No refresh tokens (simplified architecture)

### Authorization Middleware

```typescript
export async function authenticate(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const user = await verifyAccessToken(token);
    
    if (!user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
}
```

---

## 🔄 Data Flow & Communication

### Quick Mode Chat

```
1. User types in Chat UI (extension webview)
   ↓
2. Webview sends message to extension (postMessage)
   ↓
3. Extension calls backendApiClient.sendChatMessageWithResponse()
   ↓
4. Backend API:
   - authMiddleware → Verify JWT
   - rateLimitMiddleware → Check limits
   - chatController.sendMessage()
       ↓
       - Create/get conversation from DB
       - Get last 3 messages for context
       - Call Azure OpenAI API (aiService.getAIResponse())
       - Save user message to DB
       - Save AI response to DB
       - Return response
   ↓
5. Extension receives response
   ↓
6. Extension sends response to webview (postMessage)
   ↓
7. Webview displays AI response
```

### Agent Mode

```
1. User provides goal: "Create a React component"
   ↓
2. agentLLMOrchestrator.startSession()
   ↓
3. Agent Loop:
   a. Build conversation history
   b. Call openaiChat.sendMessage() (DIRECT to Azure OpenAI, not backend)
      → Sends system prompt + conversation + goal
   c. Parse AI response for tool calls (XML format)
   d. Execute tools LOCALLY:
      - read_file → Read from user's filesystem
      - write_file → Show diff viewer → Write to user's filesystem
      - bash_command → Execute on user's machine
   e. Add tool results to conversation
   f. Repeat until AI calls attempt_completion or max iterations
   ↓
4. Session stored in backend (if backend mode enabled)
```

**Note**: Agent mode currently calls Azure OpenAI **directly** from extension (requires public access enabled). Backend orchestration is planned.

### Accessibility Testing

```
1. User provides URL to test
   ↓
2. testingWebviewProvider → POST /api/testing/start
   ↓
3. Backend creates test session in DB
   ↓
4. Extension starts local testing:
   - Launch Playwright browser
   - Start NVDA screen reader (guidepup)
   - Navigate to URL
   - Capture screen reader output
   - Run accessibility checks
   ↓
5. Extension sends results to backend
   ↓
6. Backend saves results to DB
   ↓
7. Extension displays results in UI
```

---

## ☁️ Azure Services & Deployment

### Azure Resources

| Resource Name | Service Type | Purpose | Location |
|---------------|-------------|---------|----------|
| `ctonpsiotspocapp` | Azure Web App | Hosts backend API + frontend | South India |
| `ots-poc-asp` | App Service Plan | Compute for Web App | South India |
| `ctonpsiotspoc-pgserver` | PostgreSQL Flexible Server | Database | South India |
| `ctonpsiotspocstracc` | Storage Account | Blob storage (VSIX, reports) | South India |
| `ctonpsiotspocopenai` | Azure OpenAI Service | GPT-5 model | East US 2 |
| `ctonpsiotspockv` | Key Vault | Secrets storage | South India |
| `ctonpsiotspocvnet1` | Virtual Network | Private networking | South India |
| Various Private Endpoints | Private Endpoint | Secure connections | South India |

### Networking Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Azure Virtual Network                     │
│                  (ctonpsiotspocvnet1)                       │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  Subnet: vnet-int-subnet                              │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │  │  Web App    │  │  PostgreSQL  │  │  Key Vault   │ │ │
│  │  │  (VNet Integ│  │  (Private    │  │  (Private    │ │ │
│  │  │   ration)   │  │   Endpoint)  │  │   Endpoint)  │ │ │
│  │  └─────────────┘  └──────────────┘  └──────────────┘ │ │
│  │                                                        │ │
│  │  ┌──────────────┐  ┌──────────────┐                  │ │
│  │  │  Blob Storage│  │  OpenAI      │                  │ │
│  │  │  (Private    │  │  (Private    │                  │ │
│  │  │   Endpoint)  │  │   Endpoint)  │                  │ │
│  │  └──────────────┘  └──────────────┘                  │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          ↕
                   Public Internet
                     (HTTPS)
                          ↕
              ┌───────────────────────┐
              │  Users / Extensions   │
              └───────────────────────┘
```

### Deployment Process

#### Backend Deployment

1. **Build for Production**:
   ```bash
   cd backend
   npm run build
   # Compiles src/**/*.ts → dist/**/*.js
   ```

2. **Prepare Deployment Package**:
   ```bash
   mkdir deploy
   cp -r dist/* deploy/
   cp deploy-package.json deploy/package.json
   ```

3. **Deploy to Azure**:
   - **Option A**: VS Code Azure Extension
     - Right-click `deploy` folder
     - Select "Deploy to Web App"
     - Choose `ctonpsiotspocapp`

   - **Option B**: Azure CLI
     ```bash
     cd deploy
     zip -r deploy.zip .
     az webapp deployment source config-zip \
       --resource-group CTO-NP-SI-OTS-POC-RG \
       --name ctonpsiotspocapp \
       --src deploy.zip
     ```

4. **Azure Startup**:
   - Azure runs: `npm install --production`
   - Then starts: `node server.js`
   - Environment variables from App Settings

#### Frontend Deployment

1. **Build Frontend**:
   ```bash
   cd frontend
   npm run build
   # Output: dist/
   ```

2. **Copy to Backend**:
   ```bash
   cp -r dist/* ../backend/deploy/app/
   ```

3. **Deploy with Backend** (see above)

4. **Access**:
   - URL: `https://ctonpsiotspocapp-gcfhduh3fdhab4h2.southindia-01.azurewebsites.net/app/`
   - Express serves static files from `/app/` route

#### VSIX Upload

1. **Package Extension**:
   ```bash
   npx vsce package
   # Output: accesslint-0.1.0.vsix
   ```

2. **Upload to Blob Storage**:
   - **Option A**: Azure Portal
     - Navigate to Storage Account → `vsix` container
     - Upload `accesslint-0.1.0.vsix`

   - **Option B**: Azure CLI
     ```bash
     az storage blob upload \
       --account-name ctonpsiotspocstracc \
       --container-name vsix \
       --name accesslint-0.1.0.vsix \
       --file accesslint-0.1.0.vsix
     ```

#### Database Setup

1. **Connect to PostgreSQL**:
   ```bash
   # From Azure Cloud Shell or Kudu console
   psql "host=ctonpsiotspoc-pgserver.postgres.database.azure.com port=5432 dbname=accesslint user=pgadmin password=PASSWORD sslmode=require"
   ```

2. **Run Schema**:
   ```sql
   -- Enable UUID extension
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

   -- Run schema.sql
   \i database/schema.sql
   ```

3. **Verify**:
   ```sql
   \dt  -- List tables
   SELECT * FROM users;
   ```

### Environment Variables (Azure App Settings)

```
NODE_ENV=production
PORT=8080

# Database
POSTGRES_HOST=ctonpsiotspoc-pgserver.postgres.database.azure.com
POSTGRES_PORT=5432
POSTGRES_DB=accesslint
POSTGRES_USER=pgadmin
POSTGRES_PASSWORD=<from Key Vault>
POSTGRES_SSL=true

# JWT
JWT_SECRET=<from Key Vault>
JWT_EXPIRES_IN=7d

# Azure Blob Storage
AZURE_STORAGE_ACCOUNT_NAME=ctonpsiotspocstracc
AZURE_STORAGE_ACCOUNT_KEY=<from Key Vault>
AZURE_STORAGE_CONTAINER_VSIX=vsix
AZURE_STORAGE_CONTAINER_REPORTS=reports
AZURE_STORAGE_CONTAINER_UPLOADS=uploads

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_HOUR=100
RATE_LIMIT_TOKENS_PER_DAY=50000
```

**Note**: OpenAI API key is **hardcoded** in `backend/src/config/azureOpenAI.ts` (not an env variable).

---

## 🛠️ Build & Compilation Process

### Backend Build

```bash
cd backend

# Install dependencies
npm install

# Compile TypeScript
npm run build
# Uses tsconfig.json
# Input:  src/**/*.ts
# Output: dist/**/*.js

# Start development
npm run dev
# Uses nodemon to auto-restart on changes

# Start production
npm start
# Runs: node dist/server.js
```

**`tsconfig.json` (backend)**:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "experimentalDecorators": true,  // For Sequelize
    "emitDecoratorMetadata": true     // For Sequelize
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Frontend Build

```bash
cd frontend

# Install dependencies
npm install

# Development server
npm run dev
# Runs Vite dev server on http://localhost:5173

# Production build
npm run build
# Uses Vite to bundle React app
# Input:  src/**/*.tsx, index.html
# Output: dist/
#   ├── index.html
#   └── assets/
#       ├── index-[hash].js
#       └── index-[hash].css

# Preview production build
npm run preview
```

**`vite.config.ts`**:
```typescript
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
});
```

### Extension Build

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile
# Uses tsconfig.json
# Input:  src/**/*.ts
# Output: out/**/*.js

# Watch mode (auto-compile on changes)
npm run watch

# Package as VSIX
npx vsce package
# Creates: accesslint-0.1.0.vsix
# Includes: out/, node_modules/, webviews/, icons/, package.json
# Excludes: src/, .git/, backend/, frontend/ (from .vscodeignore)
```

**`tsconfig.json` (extension)**:
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "out",
    "lib": ["ES2020"],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true
  },
  "exclude": ["node_modules", ".vscode-test", "backend", "frontend"]
}
```

**`.vscodeignore`**:
```
.vscode/**
src/**
tsconfig.json
backend/**
frontend/**
*.md
.git/**
node_modules/**/*.test.js
node_modules/**/test/**
```

### Build Dependencies

- **Backend**: 
  - `typescript` (compiler)
  - `ts-node` (development)
  - `nodemon` (auto-restart)

- **Frontend**:
  - `vite` (bundler)
  - `@vitejs/plugin-react` (React support)
  - TypeScript (type checking)

- **Extension**:
  - `typescript` (compiler)
  - `@types/vscode` (VS Code API types)
  - `@vscode/vsce` (packaging tool)

---

## 💻 Development Workflow

### Local Development Setup

1. **Clone Repository**:
   ```bash
   git clone <repo-url>
   cd accesslint_pup-main
   ```

2. **Backend Setup**:
   ```bash
   cd backend
   npm install
   cp env.template .env
   # Edit .env with local PostgreSQL credentials
   npm run dev  # Starts on http://localhost:3000
   ```

3. **Frontend Setup**:
   ```bash
   cd frontend
   npm install
   # Create .env.local
   echo "VITE_API_URL=http://localhost:3000/api" > .env.local
   npm run dev  # Starts on http://localhost:5173
   ```

4. **Extension Setup**:
   ```bash
   cd ../  # Back to root
   npm install
   npm run compile
   # Press F5 in VS Code to launch extension development host
   ```

### Database Local Setup

```bash
# Install PostgreSQL locally
brew install postgresql  # macOS
sudo apt install postgresql  # Linux

# Create database
createdb accesslint

# Connect
psql -d accesslint

# Run schema
\i backend/database/schema.sql
```

### Common Development Tasks

#### Add New Backend Endpoint

1. Create controller in `backend/src/controllers/`:
   ```typescript
   export const myNewEndpoint = asyncHandler(async (req, res) => {
       // Logic here
       res.json({ data: 'response' });
   });
   ```

2. Add route in `backend/src/routes/`:
   ```typescript
   router.get('/my-endpoint', myNewEndpoint);
   ```

3. Test:
   ```bash
   curl http://localhost:3000/api/my-endpoint \
     -H "Authorization: Bearer <token>"
   ```

#### Add New Database Model

1. Create model in `backend/src/models/`:
   ```typescript
   @Table({ tableName: 'my_table' })
   export class MyModel extends Model {
       @Column({ type: DataType.UUID, primaryKey: true })
       id!: string;
   }
   export default MyModel;
   ```

2. Add to `backend/src/models/index.ts`:
   ```typescript
   export { MyModel } from './myModel.model';
   ```

3. Update `database/schema.sql`:
   ```sql
   CREATE TABLE my_table (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
   );
   ```

#### Add New Extension Command

1. Register in `src/extension.ts`:
   ```typescript
   context.subscriptions.push(
       vscode.commands.registerCommand('accesslint.myCommand', () => {
           vscode.window.showInformationMessage('My command!');
       })
   );
   ```

2. Add to `package.json`:
   ```json
   {
     "contributes": {
       "commands": [
         {
           "command": "accesslint.myCommand",
           "title": "My Command",
           "category": "AccessLint"
         }
       ]
     }
   }
   ```

3. Test: Press `Ctrl+Shift+P` → "AccessLint: My Command"

---

## 🧪 Testing & Debugging

### Backend Debugging

1. **VS Code Launch Config** (`.vscode/launch.json`):
   ```json
   {
     "type": "node",
     "request": "launch",
     "name": "Debug Backend",
     "program": "${workspaceFolder}/backend/src/server.ts",
     "preLaunchTask": "npm: build",
     "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"],
     "env": {
       "NODE_ENV": "development"
     }
   }
   ```

2. **Set Breakpoints** in `backend/src/**/*.ts`

3. **Press F5** to start debugging

### Extension Debugging

1. **Press F5** in VS Code
   - Launches Extension Development Host (new VS Code window)
   - Extension is loaded and running

2. **View Logs**:
   - Output panel → "AccessLint"
   - Output panel → "AccessLint Debug"
   - Output panel → "AccessLint Test Agent"

3. **Debug Console**:
   - Set breakpoints in `src/**/*.ts`
   - Use `console.log()` or `debugger;`

### Database Queries

```bash
# Connect to Azure PostgreSQL
psql "host=ctonpsiotspoc-pgserver.postgres.database.azure.com port=5432 dbname=accesslint user=pgadmin sslmode=require"

# Useful queries
SELECT * FROM users;
SELECT * FROM conversations WHERE user_id = '<uuid>';
SELECT * FROM messages WHERE conversation_id = '<uuid>' ORDER BY timestamp DESC LIMIT 10;
SELECT * FROM agent_sessions WHERE status = 'active';
SELECT * FROM rate_limits WHERE user_id = '<uuid>';
```

### API Testing

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Get token from response, then:
TOKEN="<jwt-token-here>"

# Chat message
curl -X POST http://localhost:3000/api/chat/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"conversationId":null,"message":"Hello","mode":"quick_mode"}'

# Get conversations
curl http://localhost:3000/api/chat/conversations \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔒 Security Considerations

### Current Security Measures

1. **Password Hashing**: bcrypt with salt rounds
2. **JWT Authentication**: Signed tokens, 7-day expiration
3. **Rate Limiting**: Per-user request and token limits
4. **SQL Injection Protection**: Sequelize ORM parameterized queries
5. **CORS**: Configured to allow only specific origins
6. **HTTPS**: All Azure services use HTTPS
7. **Private Endpoints**: Database, Key Vault, OpenAI not publicly accessible
8. **Environment Variables**: Secrets in Azure App Settings

### Known Security Issues ⚠️

1. **Hardcoded API Key in Extension**:
   - OpenAI API key is in `src/apiKeyManager.ts`
   - Exposed in VSIX file (anyone can extract)
   - **Solution**: Move agent mode to backend (planned)

2. **No Refresh Tokens**:
   - Users must re-login after 7 days
   - **Solution**: Implement refresh token rotation

3. **Agent Mode Runs Bash Commands**:
   - Potentially dangerous if AI is compromised
   - **Solution**: Sandbox execution, whitelist commands

4. **No Input Sanitization for AI**:
   - User input sent directly to AI
   - **Solution**: Add input validation and sanitization

### Recommendations for Production

1. ✅ Rotate API keys regularly
2. ✅ Implement refresh tokens
3. ✅ Add input validation middleware
4. ✅ Enable Azure DDoS Protection
5. ✅ Set up Azure Application Insights for monitoring
6. ✅ Implement audit logging for all actions
7. ✅ Add rate limiting per IP (not just per user)
8. ✅ Move agent orchestration to backend

---

## 📊 Monitoring & Observability

### Application Insights

- **Enabled**: Yes (Azure Application Insights)
- **Metrics Tracked**:
  - Request rate, duration, failures
  - Exception tracking
  - Custom events (logins, downloads, agent sessions)
  - Performance metrics

### Logging

- **Backend**: Winston logger
  - Levels: `error`, `warn`, `info`, `debug`
  - Output: Console + File + Azure Application Insights

- **Extension**: `outputChannel.appendLine()`
  - Visible in VS Code Output panel
  - Sent to backend via `debugLog` endpoint

### Health Check

```
GET /api/health

Response:
{
  "status": "healthy",
  "timestamp": "2025-12-01T10:00:00.000Z",
  "uptime": 3600
}
```

---

## 🚀 Deployment Checklist

### Pre-Deployment

- [ ] Update version in `package.json` (backend, frontend, extension)
- [ ] Run linters and fix errors
- [ ] Test locally (all modes: quick, agent, testing)
- [ ] Review environment variables
- [ ] Update `CHANGELOG.md`

### Backend Deployment

- [ ] `cd backend && npm run build`
- [ ] Copy to `deploy/` folder
- [ ] Deploy to Azure Web App
- [ ] Verify health check: `GET /api/health`
- [ ] Test API endpoints with Postman/curl

### Frontend Deployment

- [ ] `cd frontend && npm run build`
- [ ] Copy `dist/` to `backend/deploy/app/`
- [ ] Deploy with backend
- [ ] Verify URL: `https://<app>.azurewebsites.net/app/`

### Extension Packaging

- [ ] `npm run compile`
- [ ] `npx vsce package`
- [ ] Upload to Azure Blob Storage (`vsix` container)
- [ ] Update version in backend `downloadController.ts`
- [ ] Test download from frontend portal

### Post-Deployment

- [ ] Monitor Azure Application Insights for errors
- [ ] Check database for new user registrations
- [ ] Test full user flow:
  - Register → Login → Download → Install → Use Extension
- [ ] Monitor rate limits and token usage

---

## 📝 Glossary

- **VSIX**: Visual Studio Code Extension Package (ZIP file with `.vsix` extension)
- **JWT**: JSON Web Token (authentication token)
- **ORM**: Object-Relational Mapping (Sequelize maps JS objects to SQL tables)
- **SPA**: Single-Page Application (React app loads once, routes client-side)
- **Webview**: VS Code UI panel that renders HTML/CSS/JS
- **Tool**: Agent action (read_file, write_file, bash_command, etc.)
- **Orchestrator**: Component that manages agent loop (iterations, tool execution)
- **Diff**: Difference between two versions of a file (unified diff format)
- **VNet**: Azure Virtual Network (private network for resources)
- **Private Endpoint**: Secure connection to Azure service within VNet

---

## 📞 Support & Contact

For questions or issues:

1. Check this documentation
2. Review code comments
3. Check Azure Portal logs
4. Contact: [Your Team]

---

## 📜 License

Internal use only. Not for public distribution.

---

**Last Updated**: December 1, 2025  
**Version**: 0.1.0  
**Author**: AccessLint Team

