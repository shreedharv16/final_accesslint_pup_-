# AccessLint - VS Code AI Assistant Extension

AccessLint is a powerful VS Code extension that provides AI-powered coding assistance through two simple modes: Quick Chat and Autonomous Agent.

## ✨ Features

### 🤖 Two Powerful Modes
- **Quick Mode**: Direct AI chat with manual tool selection for fast assistance
- **Agent Mode**: Autonomous AI that automatically uses tools to complete complex tasks

### 🔑 Three AI Providers Supported
- **Google Gemini** - Fast and efficient AI responses
- **Anthropic Claude** - Advanced reasoning and code analysis  
- **OpenAI GPT** - Industry-leading language models

### 🛠️ Robust Tool System
- **File Operations**: Read, write, and edit files in your workspace
- **Search & Analysis**: Grep search across your codebase
- **Terminal Access**: Execute bash commands safely
- **Directory Navigation**: List and explore workspace structure
- **Task Completion**: Structured completion with results

## 🚀 Quick Start

1. **Install the Extension** (when published)
2. **Configure API Keys**: 
   - Open Command Palette (`Ctrl+Shift+P`)
   - Run `AccessLint: Configure API Keys`
   - Choose your preferred AI provider(s)
3. **Start Using**:
   - Click the AccessLint icon in the sidebar
   - Choose Quick Mode for chat or Agent Mode for autonomous assistance

## 🔧 Configuration

### API Keys
Configure one or more AI providers:

```json
{
  "accesslint.defaultAiProvider": "anthropic", // or "gemini" or "openai"
  "accesslint.anthropicModel": "claude-3-7-sonnet-20250219",
  "accesslint.openaiModel": "gpt-4"
}
```

### Commands Available
- `AccessLint: Configure API Keys` - Set up AI provider credentials
- `AccessLint: Open Chat` - Start Quick Mode chat
- `AccessLint: Start LLM Agent` - Launch autonomous agent
- `AccessLint: Stop LLM Agent` - Stop running agent
- `AccessLint: Show LLM Agent Status` - Check agent progress

## 🎯 Use Cases

### Quick Mode
Perfect for:
- Code explanations and questions
- Quick refactoring suggestions  
- Debug assistance
- Documentation generation

### Agent Mode  
Ideal for:
- Complex multi-file refactoring
- Automated code analysis and fixes
- Large-scale pattern implementations
- Comprehensive accessibility improvements

## 🛡️ Safety Features

- **Automatic workspace detection** - Works with any opened VS Code folder
- **Safe tool execution** - User approval for potentially destructive operations
- **Rate limiting** - Prevents API abuse
- **Error handling** - Graceful failure recovery

## 🔒 Privacy & Security

- API keys stored securely in VS Code's encrypted storage
- No data sent to external servers except configured AI providers
- All file operations respect VS Code's file system permissions
- Terminal commands require user approval for safety

## 🚧 Development

This extension is built with:
- TypeScript for type safety
- VS Code Extension API
- Modular tool architecture
- Comprehensive error handling

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines and submit pull requests to our repository.

---

**AccessLint** - Empowering developers with AI-powered coding assistance 🚀