(function() {
    const vscode = acquireVsCodeApi();

    // Get DOM elements
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const messagesDiv = document.getElementById('chatContainer');
    const configureApiBtn = document.getElementById('configure-api-btn');
    const clearBtn = document.getElementById('clear-btn');
    const newSessionBtn = document.getElementById('new-session-btn');
    const tokenStatsBtn = document.getElementById('token-stats-btn');
    
    // File-related elements (simplified)
    const addFilesBtn = document.getElementById('add-files-btn');
    const clearFilesBtn = document.getElementById('clear-files-btn');
    const selectedFilesDiv = document.getElementById('selected-files');
    const fileSelector = document.getElementById('file-selector');
    const fileSearchInput = document.getElementById('file-search');
    const fileDropdown = document.getElementById('file-list');

    // Agent mode elements
    const agentControls = document.getElementById('agentControls');
    const startAgentBtn = document.getElementById('startAgentBtn');
    const pauseAgentBtn = document.getElementById('pauseAgentBtn');
    const resumeAgentBtn = document.getElementById('resumeAgentBtn');
    const stopAgentBtn = document.getElementById('stopAgentBtn');
    const agentStatus = document.getElementById('agentStatus');
    const agentProgress = document.getElementById('agentProgress');
    const agentTaskList = document.getElementById('agentTaskList');

    // State
    let apiKeyConfigured = false;
    let selectedFiles = [];
    let allFiles = [];
    let filteredFiles = [];
    let currentMode = 'quick'; // Track current mode
    let agentState = {
        isRunning: false,
        isPaused: false,
        progress: 0,
        statusMessage: 'Ready',
        currentTask: null
    };
    let currentTodoList = null;

    // Initialize
    function init() {
        setupEventListeners();
        updateUI();
    }

    function setupEventListeners() {
        // Send message on button click
        sendBtn.addEventListener('click', sendMessage);

        // Send message on Enter key (Shift+Enter for new line)
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Configure API key
        configureApiBtn.addEventListener('click', () => {
            vscode.postMessage({
                type: 'configureApiKey'
            });
        });

        // Clear conversation
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                vscode.postMessage({
                    type: 'clearConversation'
                });
            });
        }

        // New session
        if (newSessionBtn) {
            newSessionBtn.addEventListener('click', () => {
                vscode.postMessage({
                    type: 'newChatSession'
                });
            });
        }

        // Token stats
        if (tokenStatsBtn) {
            tokenStatsBtn.addEventListener('click', () => {
                vscode.postMessage({
                    type: 'getTokenStats'
                });
            });
        }

        // Auto-resize textarea
        messageInput.addEventListener('input', autoResize);

        // Simplified file selection
        if (addFilesBtn) {
            addFilesBtn.addEventListener('click', toggleFileSelector);
        }
        if (clearFilesBtn) {
            clearFilesBtn.addEventListener('click', clearSelectedFiles);
        }
        if (fileSearchInput) {
            fileSearchInput.addEventListener('input', filterFiles);
        }
        
        // Mode selector
        const modeSelector = document.getElementById('mode-selector');
        if (modeSelector) {
            modeSelector.addEventListener('change', (e) => {
                setMode(e.target.value);
                vscode.postMessage({
                    type: 'setMode',
                    mode: e.target.value
                });
            });
        }

        // Agent mode event listeners
        if (startAgentBtn) {
            startAgentBtn.addEventListener('click', startAgent);
        }
        if (pauseAgentBtn) {
            pauseAgentBtn.addEventListener('click', pauseAgent);
        }
        if (resumeAgentBtn) {
            resumeAgentBtn.addEventListener('click', resumeAgent);
        }
        if (stopAgentBtn) {
            stopAgentBtn.addEventListener('click', stopAgent);
        }

        // Close file selector when clicking outside
        document.addEventListener('click', (e) => {
            if (fileSelector && !fileSelector.contains(e.target) && (!addFilesBtn || !addFilesBtn.contains(e.target))) {
                fileSelector.style.display = 'none';
            }
        });
    }

    function sendMessage() {
        const message = messageInput.value.trim();
        if (!message || !apiKeyConfigured) {
            return;
        }

        // Get current mode from selector
        const modeSelector = document.getElementById('mode-selector');
        const currentMode = modeSelector ? modeSelector.value : 'quick';
        
        // Get current provider from selector  
        // Always use GPT-5 (hardcoded)
        const currentProvider = 'openai';

        vscode.postMessage({
            type: 'sendMessage',
            message: message,
            mode: currentMode,
            provider: currentProvider,
            contextFiles: selectedFiles
        });

        messageInput.value = '';
        autoResize();
    }

    function addMessage(content, type = 'assistant', timestamp = new Date(), isLoading = false) {
        console.log('✏️ addMessage called:', { content, type, timestamp, isLoading });
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type === 'user' ? 'user' : type === 'error' ? 'error' : 'assistant'}`;

        const headerDiv = document.createElement('div');
        headerDiv.className = 'message-header';
        
        // Set header text based on type
        if (type === 'user') {
            headerDiv.textContent = '👤 You';
        } else if (type === 'error') {
            headerDiv.textContent = '❌ Error';
        } else {
            headerDiv.textContent = '🤖 AccessLint AI';
        }

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Handle loading state
        if (isLoading) {
            contentDiv.innerHTML = '<div class="loading">🤔 Thinking...</div>';
        } else {
            // Simple markdown parsing for basic formatting
            contentDiv.innerHTML = parseMarkdown(content);
        }

        messageDiv.appendChild(headerDiv);
        messageDiv.appendChild(contentDiv);

        // Remove welcome message if it exists
        const welcomeMessage = messagesDiv.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function addErrorMessage(errorMsg) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = `❌ Error: ${errorMsg}`;
        
        messagesDiv.appendChild(errorDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function addRetryMessage(content, attempt, maxRetries, delay, isRateLimit) {
        const retryDiv = document.createElement('div');
        retryDiv.className = isRateLimit ? 'retry-message rate-limit' : 'retry-message';
        
        // Create progress bar for the delay
        const progressBar = document.createElement('div');
        progressBar.className = 'retry-progress-bar';
        const progressFill = document.createElement('div');
        progressFill.className = 'retry-progress-fill';
        progressBar.appendChild(progressFill);
        
        retryDiv.innerHTML = `
            <div class="retry-content">
                ${content}
            </div>
        `;
        retryDiv.appendChild(progressBar);
        
        messagesDiv.appendChild(retryDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
        // Animate the progress bar
        let progress = 0;
        const interval = 100; // Update every 100ms
        const totalSteps = (delay * 1000) / interval;
        
        const progressInterval = setInterval(() => {
            progress += 1;
            const percentage = (progress / totalSteps) * 100;
            progressFill.style.width = `${Math.min(percentage, 100)}%`;
            
            if (progress >= totalSteps) {
                clearInterval(progressInterval);
                // Auto-remove the retry message after completion
                setTimeout(() => {
                    if (retryDiv.parentNode) {
                        retryDiv.remove();
                    }
                }, 1000);
            }
        }, interval);
    }

    function clearMessages() {
        messagesDiv.innerHTML = `
            <div class="welcome-message">
                <p>👋 Hello! I'm your accessibility AI assistant.</p>
                <p>I can help you with:</p>
                <ul>
                    <li>WCAG guidelines and best practices</li>
                    <li>Code accessibility improvements</li>
                    <li>ARIA attributes and semantic HTML</li>
                    <li>Color contrast and visual design</li>
                    <li>Screen reader compatibility</li>
                </ul>
                <p>Ask me anything about accessibility!</p>
            </div>
        `;
    }



    function updateUI() {
        const enabled = apiKeyConfigured;
        
        messageInput.disabled = !enabled;
        sendBtn.disabled = !enabled;
        if (clearBtn) clearBtn.disabled = !enabled;
        if (newSessionBtn) newSessionBtn.disabled = !enabled;
        if (tokenStatsBtn) tokenStatsBtn.disabled = !enabled;
        if (addFilesBtn) addFilesBtn.disabled = !enabled;
        
        // Enable/disable mode selector
        const modeSelector = document.getElementById('mode-selector');
        if (modeSelector) modeSelector.disabled = !enabled;
        
        const apiStatusText = document.getElementById('api-status-text');
        if (apiStatusText) {
            apiStatusText.textContent = enabled ? 'API Key Configured ✅' : 'API Key Not Configured';
            configureApiBtn.textContent = enabled ? 'Reconfigure' : 'Configure';
        }
        
        if (enabled) {
            messageInput.placeholder = 'Ask about accessibility...';
        } else {
            messageInput.placeholder = 'Configure API key to start chatting...';
        }

        // Update selected files display
        updateSelectedFilesDisplay();
    }

    function autoResize() {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
    }

    function parseMarkdown(text) {
        // Simple markdown parsing for common elements
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/\n/g, '<br>');
    }

    // File-related functions
    function toggleFileSelector() {
        if (!fileSelector) return;
        
        if (fileSelector.style.display === 'none') {
            // Load files and show selector
            vscode.postMessage({ type: 'requestFiles' });
            fileSelector.style.display = 'block';
        } else {
            fileSelector.style.display = 'none';
        }
    }

    function filterFiles() {
        const searchTerm = fileSearchInput.value.toLowerCase();
        filteredFiles = allFiles.filter(file => 
            file.toLowerCase().includes(searchTerm)
        );
        displayFiles();
    }

    function displayFiles() {
        if (!fileDropdown) return;
        
        fileDropdown.innerHTML = '';
        
        if (filteredFiles.length === 0) {
            fileDropdown.innerHTML = '<div class="no-files">No files found</div>';
            return;
        }

        filteredFiles.slice(0, 20).forEach(file => { // Limit to 20 files
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.textContent = file;
            fileItem.addEventListener('click', () => selectFile(file));
            fileDropdown.appendChild(fileItem);
        });
    }

    function selectFile(file) {
        if (!selectedFiles.includes(file)) {
            selectedFiles.push(file);
            updateSelectedFilesDisplay();
        }
        fileSelector.style.display = 'none';
    }

    function clearSelectedFiles() {
        selectedFiles = [];
        updateSelectedFilesDisplay();
    }

    function updateSelectedFilesDisplay() {
        if (!selectedFilesDiv) return;
        
        if (selectedFiles.length === 0) {
            selectedFilesDiv.style.display = 'none';
        } else {
            selectedFilesDiv.style.display = 'block';
            const filesList = selectedFilesDiv.querySelector('#selected-files-list');
            if (filesList) {
                filesList.innerHTML = selectedFiles.map(file => 
                    `<span class="selected-file">${getFileName(file)} <button onclick="removeFile('${file}')">✕</button></span>`
                ).join('');
            }
        }
    }

    function setMode(mode) {
        currentMode = mode;
        // Update todo dropdown visibility based on mode
        updateTodoDropdownVisibility(mode);
    }

    function removeFile(file) {
        selectedFiles = selectedFiles.filter(f => f !== file);
        updateSelectedFilesDisplay();
    }

    // Make removeFile global for onclick handlers
    window.removeFile = removeFile;

    function loadFiles(files) {
        allFiles = files;
        filteredFiles = files;
        displayFiles();
    }

    function getFileIcon(filePath) {
        const ext = filePath.split('.').pop().toLowerCase();
        const iconMap = {
            'js': '📄',
            'jsx': '⚛️',
            'ts': '📘',
            'tsx': '⚛️',
            'html': '🌐',
            'css': '🎨',
            'scss': '🎨',
            'sass': '🎨',
            'less': '🎨',
            'json': '📋',
            'md': '📝',
            'txt': '📄',
            'vue': '💚',
            'svelte': '🧡',
            'py': '🐍',
            'java': '☕',
            'xml': '📄',
            'svg': '🖼️',
            'png': '🖼️',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'gif': '🖼️'
        };
        return iconMap[ext] || '📄';
    }

    function getFileName(filePath) {
        return filePath.split('/').pop();
    }

    // Agent mode functions
    function startAgent() {
        const goal = prompt('What accessibility goal would you like the agent to achieve?', 
                          'Make this code fully accessible and WCAG 2.1 compliant');
        if (goal) {
            vscode.postMessage({
                type: 'startAgent',
                goal: goal
            });
        }
    }

    function pauseAgent() {
        vscode.postMessage({
            type: 'pauseAgent'
        });
    }

    function resumeAgent() {
        vscode.postMessage({
            type: 'resumeAgent'
        });
    }

    function stopAgent() {
        if (confirm('Are you sure you want to stop the agent?')) {
            vscode.postMessage({
                type: 'stopAgent'
            });
        }
    }

    function updateAgentUI() {
        if (!agentControls) return;

        // Update button states
        if (startAgentBtn) {
            startAgentBtn.style.display = agentState.isRunning ? 'none' : 'inline-block';
        }
        if (pauseAgentBtn) {
            pauseAgentBtn.style.display = (agentState.isRunning && !agentState.isPaused) ? 'inline-block' : 'none';
        }
        if (resumeAgentBtn) {
            resumeAgentBtn.style.display = (agentState.isRunning && agentState.isPaused) ? 'inline-block' : 'none';
        }
        if (stopAgentBtn) {
            stopAgentBtn.style.display = agentState.isRunning ? 'inline-block' : 'none';
        }

        // Update status
        if (agentStatus) {
            agentStatus.textContent = agentState.statusMessage;
            agentStatus.className = agentState.isRunning ? 
                (agentState.isPaused ? 'agent-paused' : 'agent-running') : 'agent-ready';
        }

        // Update progress
        if (agentProgress) {
            agentProgress.style.width = `${agentState.progress}%`;
            agentProgress.setAttribute('aria-valuenow', agentState.progress);
        }

        // Update current task
        if (agentTaskList && agentState.currentTask) {
            agentTaskList.innerHTML = `
                <div class="current-task">
                    <strong>Current Task:</strong> ${agentState.currentTask.title}
                    <div class="task-description">${agentState.currentTask.description}</div>
                </div>
            `;
        }
    }

    function handleAgentPlan(plan) {
        if (agentTaskList) {
            let tasksHtml = '<div class="agent-plan"><h4>Agent Plan:</h4><ul>';
            plan.tasks.forEach((task, index) => {
                const statusIcon = task.status === 'completed' ? '✅' : 
                                 task.status === 'failed' ? '❌' : 
                                 task.status === 'in_progress' ? '🔄' : '⏳';
                tasksHtml += `<li class="task-item task-${task.status}">
                    ${statusIcon} ${task.title} (${task.type})
                </li>`;
            });
            tasksHtml += '</ul></div>';
            agentTaskList.innerHTML = tasksHtml;
        }
        
        addMessage(`📋 Agent created a plan with ${plan.tasks.length} tasks. Starting execution...`, false);
    }

    function handleAgentLog(log) {
        const icon = log.level === 'error' ? '❌' : 
                    log.level === 'warning' ? '⚠️' : 
                    log.level === 'success' ? '✅' : 'ℹ️';
        addMessage(`${icon} ${log.message}`, false);
    }

    function handleAgentApprovalRequest(data) {
        const decision = data.decision;
        const uiData = data.uiData;
        
        const approvalHtml = `
            <div class="approval-request" id="approval-${decision.id}">
                <h4>${uiData.title}</h4>
                <p>${uiData.message}</p>
                <div class="approval-details">
                    <strong>Target:</strong> ${uiData.details.target}<br>
                    <strong>Type:</strong> ${uiData.details.type}
                    ${uiData.details.command ? `<br><strong>Command:</strong> <code>${uiData.details.command}</code>` : ''}
                    ${uiData.details.riskLevel ? `<br><strong>Risk Level:</strong> <span style="color: ${uiData.details.riskColor}">${uiData.details.riskIcon} ${uiData.details.riskLevel}</span>` : ''}
                </div>
                <div class="approval-buttons">
                    <button onclick="respondToApproval('${decision.id}', true)" class="approve-btn">✅ Approve</button>
                    <button onclick="respondToApproval('${decision.id}', false)" class="reject-btn">❌ Reject</button>
                </div>
            </div>
        `;
        
        addMessage(approvalHtml, false, true); // true for raw HTML
    }

    function respondToApproval(decisionId, approved) {
        vscode.postMessage({
            type: 'agentDecisionResponse',
            decisionId: decisionId,
            approved: approved
        });
        
        // Update the UI to show the decision
        const approvalElement = document.getElementById(`approval-${decisionId}`);
        if (approvalElement) {
            approvalElement.innerHTML = `<div class="approval-decided">
                Decision: ${approved ? '✅ Approved' : '❌ Rejected'}
            </div>`;
        }
    }

    // Make this global so it can be called from onclick handlers
    window.respondToApproval = respondToApproval;

    // Listen for messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;

        switch (message.type) {
            case 'updateState':
                apiKeyConfigured = message.apiKeyConfigured;
                updateUI();
                break;

            case 'userMessage':
                addMessage(message.message, 'user', message.timestamp);
                break;

            case 'assistantMessage':
                addMessage(message.message, 'assistant', message.timestamp);
                break;

            case 'error':
                addErrorMessage(message.message);
                break;

            case 'retryAttempt':
                addRetryMessage(message.message, message.attempt, message.maxRetries, message.delay, message.isRateLimit);
                break;

            case 'todoList':
                displayTodoList(message.todoList);
                break;



            case 'clearMessages':
                clearMessages();
                break;

            case 'filesList':
                loadFiles(message.files);
                break;

            // Agent-related message handlers
            case 'agentState':
                agentState = { ...agentState, ...message.state };
                updateAgentUI();
                break;

            case 'agentPlan':
                handleAgentPlan(message.plan);
                break;

            case 'agentLog':
                handleAgentLog(message.log);
                break;

            case 'agentApprovalRequest':
                handleAgentApprovalRequest(message);
                break;

            case 'agentSummary':
                const summary = message.summary;
                addMessage(`🎉 Agent completed! 
                Goal: ${summary.goal}
                Tasks: ${summary.completedTasks}/${summary.totalTasks} completed
                Duration: ${summary.duration} seconds
                AI calls used: ${summary.aiCallsUsed}/5`, 'assistant', message.timestamp);
                break;
                
            case 'modeChanged':
                // Update mode selector
                const modeSelector = document.getElementById('mode-selector');
                if (modeSelector && message.mode) {
                    modeSelector.value = message.mode;
                    setMode(message.mode);
                }
                break;
                
            case 'toolExecution':
                // Show tool execution in chat only in agent mode
                if ((message.execution || message.tool) && currentMode === 'agent') {
                    appendToolExecution(message);
                }
                break;

            case 'taskCompletion':
                // Handle task completion from agent
                if (message.result) {
                    addMessage(message.result, 'assistant', message.timestamp);
                    if (message.command) {
                        addMessage(`💡 Suggested command: \`${message.command}\``, 'assistant', message.timestamp);
                    }
                }
                break;

            case 'historyCleared':
                // Handle history cleared from tool manager
                clearMessages();
                break;
        }
    });

    // Add tool execution display function
    function appendToolExecution(data) {
        try {
            // The data structure is: { type: 'toolExecution', execution: { toolName, result, duration, ... } }
            const execution = data.execution || data;
            const toolName = execution.toolName;
            const result = execution.result;
            const duration = execution.duration;
            
            // Validate required data
            if (!toolName) {
                console.warn('appendToolExecution: No tool name found in data:', data);
                return;
            }
            
            // Create a simple status message like "✅ list_directory SUCCESS (254ms)"
            const statusIcon = result?.success ? '✅' : '❌';
            const statusText = result?.success ? 'SUCCESS' : 'ERROR';
            const durationText = duration ? ` (${duration}ms)` : '';
            const statusMessage = `${statusIcon} ${toolName} ${statusText}${durationText}`;
            
            // Add as a simple message in the chat
            addMessage(statusMessage, 'assistant', new Date());
        } catch (error) {
            console.error('Error in appendToolExecution:', error);
        }
    }

    // Todo List Functions
    function displayTodoList(todoList) {
        currentTodoList = todoList;
        
        if (!todoList || !todoList.items) {
            console.log('❌ displayTodoList: todoList is invalid', todoList);
            return;
        }

        console.log('📋 displayTodoList: Received todo list with', todoList.items.length, 'items');
        console.log('📋 displayTodoList: Stats:', todoList.stats);
        
        // Only update the dropdown in the header - don't show a chat message
        updateTodoDropdown(todoList);
        
        // Show dropdown if in agent mode
        updateTodoDropdownVisibility(currentMode);
    }

    function updateTodoDropdown(todoList) {
        console.log('🔍 updateTodoDropdown: Called with todoList:', todoList);
        
        let dropdown = document.getElementById('todo-dropdown');
        console.log('🔍 updateTodoDropdown: dropdown exists:', !!dropdown);
        
        if (!dropdown) {
            // Create the dropdown if it doesn't exist
            console.log('🔍 updateTodoDropdown: Creating new dropdown');
            createTodoDropdown();
            dropdown = document.getElementById('todo-dropdown');
            console.log('🔍 updateTodoDropdown: dropdown created:', !!dropdown);
        }
        
        if (!dropdown) {
            console.log('❌ updateTodoDropdown: Failed to create dropdown');
            return;
        }
        
        console.log('🔍 updateTodoDropdown: Updating with', todoList.items.length, 'items');
        
        // Update dropdown button - simplified
        const dropdownBtn = dropdown.querySelector('.todo-dropdown-btn');
        if (dropdownBtn) {
            dropdownBtn.innerHTML = `📋 Todo List Created (${todoList.items.length} items) <span class="dropdown-arrow">▼</span>`;
            console.log('✅ updateTodoDropdown: Button updated');
        }
        
        // Update dropdown content - simplified, no status tracking
        const dropdownContent = dropdown.querySelector('.todo-dropdown-content');
        if (dropdownContent) {
            dropdownContent.innerHTML = `
                <div class="todo-dropdown-header">
                    <div class="todo-query-mini">"${todoList.query}"</div>
                </div>
                <div class="todo-items-mini">
                    ${todoList.items.map((item, index) => `
                        <div class="todo-item-mini">
                            <div class="todo-number">${index + 1}.</div>
                            <div class="todo-content-mini">
                                <div class="todo-title-mini">${item.title}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            console.log('✅ updateTodoDropdown: Content updated');
        }
        
        // Auto-open the dropdown to show the todo list
        const dropdownContentEl = document.getElementById('todo-dropdown-content');
        const arrow = document.querySelector('.dropdown-arrow');
        if (dropdownContentEl) {
            dropdownContentEl.style.display = 'block';
            if (arrow) {
                arrow.textContent = '▲';
            }
            console.log('✅ updateTodoDropdown: Dropdown opened automatically');
        }
    }

    function createTodoDropdown() {
        console.log('🔍 createTodoDropdown: Starting creation');
        
        const inputContainer = document.querySelector('.input-container');
        console.log('🔍 createTodoDropdown: inputContainer found:', !!inputContainer);
        
        if (!inputContainer) {
            console.log('❌ createTodoDropdown: inputContainer not found');
            return;
        }
        
        const dropdown = document.createElement('div');
        dropdown.id = 'todo-dropdown';
        dropdown.className = 'todo-dropdown';
        dropdown.style.display = 'none'; // Initially hidden
        dropdown.innerHTML = `
            <button class="todo-dropdown-btn" onclick="toggleTodoDropdown()">
                📋 Todos (0/0) <span class="dropdown-arrow">▼</span>
            </button>
            <div class="todo-dropdown-content" id="todo-dropdown-content">
                <div class="todo-dropdown-empty">No active todos</div>
            </div>
        `;
        
        // Insert before the input container
        inputContainer.parentNode.insertBefore(dropdown, inputContainer);
        console.log('✅ createTodoDropdown: Dropdown created and inserted');
    }
    
    function updateTodoDropdownVisibility(mode) {
        const dropdown = document.getElementById('todo-dropdown');
        if (dropdown) {
            if (mode === 'agent' && currentTodoList) {
                // Show dropdown only in agent mode when todo list exists
                dropdown.style.display = 'block';
            } else {
                // Hide dropdown in quick mode or when no todo list
                dropdown.style.display = 'none';
            }
        }
    }

    function toggleTodoDropdown() {
        const dropdown = document.getElementById('todo-dropdown-content');
        const arrow = document.querySelector('.dropdown-arrow');
        if (dropdown) {
            const isVisible = dropdown.style.display === 'block';
            dropdown.style.display = isVisible ? 'none' : 'block';
            if (arrow) {
                arrow.textContent = isVisible ? '▼' : '▲';
            }
        }
    }

    function getStatusIcon(status) {
        switch (status) {
            case 'completed':
                return '✅';
            case 'in_progress':
                return '🔄';
            case 'pending':
                return '⏳';
            case 'cancelled':
                return '❌';
            case 'active':
                return '📋';
            default:
                return '📝';
        }
    }

    function toggleTodoItem(itemId, currentStatus) {
        let newStatus;
        
        // Cycle through statuses: pending -> in_progress -> completed
        switch (currentStatus) {
            case 'pending':
                newStatus = 'in_progress';
                break;
            case 'in_progress':
                newStatus = 'completed';
                break;
            case 'completed':
                newStatus = 'pending'; // Allow unchecking
                break;
            default:
                newStatus = 'in_progress';
        }

        // Send message to backend
        vscode.postMessage({
            type: 'toggleTodoItem',
            itemId: itemId,
            status: newStatus
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', function(event) {
        const dropdown = document.getElementById('todo-dropdown');
        if (dropdown && !dropdown.contains(event.target)) {
            const dropdownContent = document.getElementById('todo-dropdown-content');
            const arrow = document.querySelector('.dropdown-arrow');
            if (dropdownContent) {
                dropdownContent.style.display = 'none';
            }
            if (arrow) {
                arrow.textContent = '▼';
            }
        }
    });

    // Initialize todo dropdown when DOM is ready
    function initTodoDropdown() {
        console.log('🔍 Initializing todo dropdown on page load');
        createTodoDropdown();
        // Start with dropdown hidden (will show when needed)
        updateTodoDropdownVisibility(currentMode);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            init();
            initTodoDropdown();
        });
    } else {
        init();
        initTodoDropdown();
    }
})(); 