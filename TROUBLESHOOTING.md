# AccessLint Troubleshooting Guide

## 🔧 Message Not Processing in Quick Mode

### What I Fixed:
1. **Updated ChatWebviewProvider** to use `AiProviderManager` instead of individual providers
2. **Added provider switching** support for all three AI models (Gemini, Anthropic, OpenAI)
3. **Enhanced error handling** with loading states and debugging
4. **Fixed message routing** between webview and extension

### Debugging Steps:

#### 1. Check API Keys
```
1. Click "⚙️ API Keys" button in chat header
2. Configure at least one provider:
   - Gemini: Get key from https://makersuite.google.com/app/apikey
   - Anthropic: Get key from https://console.anthropic.com/
   - OpenAI: Get key from https://platform.openai.com/api-keys
```

#### 2. Open Developer Console
```
1. In VS Code: Help > Toggle Developer Tools
2. Go to Console tab
3. Look for these debug messages:
   - "📨 Webview message received"
   - "🚀 Processing message"
   - "🔍 ChatWebview: Sending message"
   - "✅ Response received"
```

#### 3. Check Output Panel
```
1. View > Output
2. Select "AccessLint Debug" from dropdown
3. Look for initialization messages
4. Check for any error messages
```

### Expected Behavior:

#### Quick Mode:
1. Type message → Press Enter
2. See "🤔 Thinking..." loading message
3. Loading message disappears
4. AI response appears

#### Agent Mode:
1. Switch to Agent mode
2. Type task → Press Enter  
3. See "🤖 Agent Mode Activated" message
4. Check "AccessLint Agent" output panel for tool usage

### Common Issues:

#### Issue: No response after sending message
**Solution:**
1. Check if API key is configured
2. Try switching AI provider
3. Check Developer Console for errors
4. Restart VS Code

#### Issue: "Error: No AI provider is configured"
**Solution:**
1. Click "⚙️ API Keys" button
2. Configure at least one provider
3. Restart extension if needed

#### Issue: Loading message never disappears
**Solution:**
1. Check internet connection
2. Verify API key is valid
3. Check rate limits on AI provider
4. Try different provider

### Manual Testing:

#### Test Quick Mode:
```
1. Select "Quick" mode
2. Choose "Google Gemini" provider
3. Type: "Hello, can you help me?"
4. Should get friendly AI response
```

#### Test Agent Mode:
```
1. Select "Agent" mode  
2. Choose any provider
3. Type: "List all files in this workspace"
4. Should trigger autonomous agent
5. Check output panel for file listing
```

### Debug Console Commands:

```javascript
// In Developer Tools Console:
console.log('Testing AccessLint...');

// Check if webview is loaded
document.getElementById('messageInput');

// Test message sending
document.getElementById('sendButton').click();
```

## 🆘 Still Having Issues?

1. **Restart VS Code** completely
2. **Clear extension cache**: Reload Window (Ctrl+Shift+P → "Developer: Reload Window")
3. **Check VS Code version**: Ensure you're on VS Code 1.74.0+
4. **Verify workspace**: Open a folder/workspace (extension needs workspace access)

The extension should now work perfectly in Quick Mode! 🚀
