(function() {
    const vscode = acquireVsCodeApi();

    // DOM Elements
    const urlInput = document.getElementById('urlInput');
    const startTestBtn = document.getElementById('startTestBtn');
    const cancelTestBtn = document.getElementById('cancelTestBtn');
    const quickLinkBtns = document.querySelectorAll('.quick-link-btn');
    const testingStatus = document.getElementById('testingStatus');
    const statusText = document.getElementById('statusText');
    const progressLog = document.getElementById('progressLog');
    const results = document.getElementById('results');
    const emptyState = document.getElementById('emptyState');
    const issuesList = document.getElementById('issuesList');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const testedUrl = document.getElementById('testedUrl');
    const timestamp = document.getElementById('timestamp');
    const errorCount = document.getElementById('errorCount');
    const warningCount = document.getElementById('warningCount');
    const infoCount = document.getElementById('infoCount');
    const fixSection = document.getElementById('fixSection');
    const fixIssuesBtn = document.getElementById('fixIssuesBtn');
    const fixProgress = document.getElementById('fixProgress');
    const fixStatusText = document.getElementById('fixStatusText');
    const fixSummary = document.getElementById('fixSummary');

    let currentFilter = 'all';
    let currentResults = null;

    // Event Listeners
    startTestBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (url) {
            startTest(url);
        }
    });

    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const url = urlInput.value.trim();
            if (url) {
                startTest(url);
            }
        }
    });

    cancelTestBtn.addEventListener('click', () => {
        vscode.postMessage({
            type: 'cancelTest'
        });
    });

    quickLinkBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const url = btn.getAttribute('data-url');
            urlInput.value = url;
            startTest(url);
        });
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            if (currentResults) {
                displayResults(currentResults);
            }
        });
    });

    fixIssuesBtn.addEventListener('click', () => {
        if (currentResults) {
            startFixing(currentResults);
        }
    });

    // Functions
    function startTest(url) {
        // Hide empty state and results
        emptyState.classList.add('hidden');
        results.classList.add('hidden');
        
        // Show testing status
        testingStatus.classList.remove('hidden');
        statusText.textContent = 'Initializing browser...';
        progressLog.innerHTML = '';
        
        // Disable input and button
        urlInput.disabled = true;
        startTestBtn.disabled = true;

        // Send message to extension
        vscode.postMessage({
            type: 'startTest',
            url: url
        });
    }

    function addProgressMessage(message) {
        const item = document.createElement('div');
        item.className = 'progress-log-item';
        item.textContent = message;
        progressLog.appendChild(item);
        progressLog.scrollTop = progressLog.scrollHeight;
    }

    function displayResults(result) {
        currentResults = result;

        // Update metadata
        testedUrl.textContent = `URL: ${result.url}`;
        const interactionInfo = result.summary.totalInteractions 
            ? ` | ${result.summary.totalInteractions} NVDA interactions`
            : '';
        timestamp.textContent = `Tested: ${new Date(result.timestamp).toLocaleString()}${interactionInfo}`;

        // Update summary counts
        errorCount.textContent = result.summary.errors;
        warningCount.textContent = result.summary.warnings;
        infoCount.textContent = result.summary.info;

        // Show fix button if there are issues
        const totalIssues = result.summary.errors + result.summary.warnings;
        if (totalIssues > 0) {
            fixSection.classList.remove('hidden');
            fixIssuesBtn.disabled = false;
            fixProgress.classList.add('hidden');
            fixSummary.classList.add('hidden');
        } else {
            fixSection.classList.add('hidden');
        }

        // Filter issues
        let filteredIssues = result.issues;
        if (currentFilter !== 'all') {
            filteredIssues = result.issues.filter(issue => issue.severity === currentFilter);
        }

        // Display issues
        issuesList.innerHTML = '';
        
        if (filteredIssues.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-state';
            emptyMessage.innerHTML = `
                <div class="empty-icon">✅</div>
                <h3>No ${currentFilter === 'all' ? '' : currentFilter} issues found</h3>
                <p>Great job! Your site looks accessible.</p>
            `;
            issuesList.appendChild(emptyMessage);
        } else {
            filteredIssues.forEach(issue => {
                const issueElement = createIssueElement(issue);
                issuesList.appendChild(issueElement);
            });
        }

        // Show results, hide testing status
        testingStatus.classList.add('hidden');
        results.classList.remove('hidden');
        
        // Re-enable input and button
        urlInput.disabled = false;
        startTestBtn.disabled = false;
    }

    function startFixing(result) {
        // Hide fix button, show progress
        fixIssuesBtn.disabled = true;
        fixProgress.classList.remove('hidden');
        fixSummary.classList.add('hidden');
        fixStatusText.textContent = 'Starting agent...';

        // Send message to extension
        vscode.postMessage({
            type: 'fixIssues',
            result: result
        });
    }

    function createIssueElement(issue) {
        const div = document.createElement('div');
        div.className = `issue-item ${issue.severity}`;

        let detailsHtml = '';
        
        // Show NVDA announcement if available
        if (issue.nvdaAnnouncement) {
            detailsHtml += `
                <div class="issue-nvda-announcement">
                    <span class="issue-label">📢 NVDA Announced:</span> 
                    <span class="nvda-text">"${escapeHtml(issue.nvdaAnnouncement)}"</span>
                </div>
            `;
        }
        
        // Show expected announcement if different
        if (issue.expectedAnnouncement) {
            detailsHtml += `
                <div class="issue-expected">
                    <span class="issue-label">✅ Expected:</span> 
                    <span class="expected-text">"${escapeHtml(issue.expectedAnnouncement)}"</span>
                </div>
            `;
        }
        
        if (issue.element) {
            detailsHtml += `
                <div class="issue-element">
                    <span class="issue-label">Element:</span> ${escapeHtml(issue.element)}
                </div>
            `;
        }
        if (issue.location) {
            detailsHtml += `
                <div class="issue-location">
                    <span class="issue-label">Location:</span> ${escapeHtml(issue.location)}
                </div>
            `;
        }

        div.innerHTML = `
            <div class="issue-header">
                <div class="issue-criterion">${escapeHtml(issue.criterion)}</div>
                <div class="issue-severity ${issue.severity}">${issue.severity}</div>
            </div>
            <div class="issue-description">${escapeHtml(issue.description)}</div>
            ${detailsHtml ? `<div class="issue-details">${detailsHtml}</div>` : ''}
        `;

        return div;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Message handler
    window.addEventListener('message', event => {
        const message = event.data;

        switch (message.type) {
            case 'testingStarted':
                addProgressMessage(`🚀 Starting test for: ${message.url}`);
                break;

            case 'testingProgress':
                addProgressMessage(message.message);
                statusText.textContent = message.message;
                break;

            case 'testingComplete':
                addProgressMessage('✅ Testing complete!');
                displayResults(message.result);
                break;

            case 'testingError':
                testingStatus.classList.add('hidden');
                urlInput.disabled = false;
                startTestBtn.disabled = false;
                emptyState.classList.remove('hidden');
                emptyState.innerHTML = `
                    <div class="empty-icon">❌</div>
                    <h3>Testing Failed</h3>
                    <p>${escapeHtml(message.error)}</p>
                `;
                break;

            case 'testingCancelled':
                testingStatus.classList.add('hidden');
                urlInput.disabled = false;
                startTestBtn.disabled = false;
                emptyState.classList.remove('hidden');
                break;

            case 'fixingStarted':
                fixStatusText.textContent = 'Agent analyzing issues...';
                break;

            case 'fixingProgress':
                fixStatusText.textContent = message.message;
                break;

            case 'fixingComplete':
                fixProgress.classList.add('hidden');
                fixSummary.classList.remove('hidden');
                
                // Build detailed summary HTML
                let summaryHTML = `
                    <div class="fix-success">
                        <div class="fix-icon">✅</div>
                        <h3>Accessibility Fixes Applied Successfully!</h3>
                        
                        <div class="fix-stats">
                            <div class="fix-stat">
                                <span class="stat-number">${message.summary.issuesFixed || 0}</span>
                                <span class="stat-label">Issues Addressed</span>
                            </div>
                            <div class="fix-stat">
                                <span class="stat-number">${message.summary.totalFiles || 0}</span>
                                <span class="stat-label">Files Modified</span>
                            </div>
                        </div>
                `;

                // Add files changed list if available
                if (message.summary.filesChanged && message.summary.filesChanged.length > 0) {
                    summaryHTML += `
                        <div class="files-changed-section">
                            <h4>📁 Files Modified:</h4>
                            <ul class="files-list">
                                ${message.summary.filesChanged.map(file => `
                                    <li class="file-item">
                                        <span class="file-icon">📝</span>
                                        <code>${escapeHtml(file)}</code>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    `;
                }

                // Add detailed summary if available
                if (message.summary.message) {
                    // Parse the summary into sections for better readability
                    const summaryText = message.summary.message;
                    const sections = summaryText.split(/\n\n+/);
                    
                    summaryHTML += `
                        <div class="fix-details">
                            <h4>🔧 What Was Fixed:</h4>
                            <div class="fix-details-content">
                                ${sections.map(section => {
                                    // Check if section is a list
                                    if (section.includes('\n-') || section.includes('\n•')) {
                                        const lines = section.split('\n').filter(l => l.trim());
                                        const title = lines[0];
                                        const items = lines.slice(1).filter(l => l.trim().startsWith('-') || l.trim().startsWith('•'));
                                        
                                        return `
                                            <div class="fix-section">
                                                <strong>${escapeHtml(title)}</strong>
                                                <ul class="fix-list">
                                                    ${items.map(item => `<li>${escapeHtml(item.replace(/^[-•]\s*/, ''))}</li>`).join('')}
                                                </ul>
                                            </div>
                                        `;
                                    } else {
                                        return `<p class="fix-paragraph">${escapeHtml(section)}</p>`;
                                    }
                                }).join('')}
                            </div>
                        </div>
                    `;
                }

                summaryHTML += `
                        <div class="fix-actions">
                            <p class="fix-note">
                                <strong>Next Steps:</strong><br>
                                • Review changes in the Diff Viewer<br>
                                • Accept or reject each change<br>
                                • Re-run the test to verify fixes
                            </p>
                        </div>
                    </div>
                `;
                
                fixSummary.innerHTML = summaryHTML;
                fixIssuesBtn.disabled = false;
                
                // Scroll to show the summary
                fixSummary.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                break;

            case 'fixingError':
                fixProgress.classList.add('hidden');
                fixSummary.classList.remove('hidden');
                fixSummary.innerHTML = `
                    <div class="fix-error">
                        <div class="fix-icon">❌</div>
                        <h3>Fixing Failed</h3>
                        <p>${escapeHtml(message.error)}</p>
                    </div>
                `;
                fixIssuesBtn.disabled = false;
                break;
        }
    });
})();
