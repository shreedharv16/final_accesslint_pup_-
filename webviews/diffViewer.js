// Diff Viewer JavaScript
class DiffViewer {
    constructor() {
        this.currentRequest = null;
        this.selectedHunks = new Set();
        this.viewMode = 'unified';
        this.showWhitespace = false;
        
        // Get VS Code API
        this.vscode = acquireVsCodeApi();
        
        this.initializeEventListeners();
        this.initializeUI();
    }

    initializeEventListeners() {
        // Listen for messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            this.handleMessage(message);
        });

        // Button event listeners
        document.getElementById('approve-all').addEventListener('click', () => {
            this.approveAll();
        });

        document.getElementById('reject-all').addEventListener('click', () => {
            this.rejectAll();
        });

        document.getElementById('approve-selected').addEventListener('click', () => {
            this.approveSelected();
        });

        document.getElementById('preview').addEventListener('click', () => {
            this.showPreview();
        });

        // View mode change
        document.querySelectorAll('input[name="view-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.viewMode = e.target.value;
                this.renderDiff();
            });
        });

        // Show whitespace toggle
        document.getElementById('show-whitespace').addEventListener('change', (e) => {
            this.showWhitespace = e.target.checked;
            this.renderDiff();
        });

        // Modal close
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close-modal') || e.target.classList.contains('modal')) {
                this.closeModal();
            }
        });
    }

    initializeUI() {
        // Show ready state
        this.vscode.postMessage({ type: 'ready' });
    }

    handleMessage(message) {
        switch (message.type) {
            case 'showDiff':
                this.showDiff(message.request);
                break;
            case 'previewResult':
                this.showPreviewResult(message.previewContent);
                break;
            default:
                console.warn('Unknown message type:', message.type);
        }
    }

    showDiff(request) {
        this.currentRequest = request;
        this.selectedHunks.clear();
        
        // Hide loading and show diff container
        document.getElementById('loading').style.display = 'none';
        document.getElementById('diff-container').style.display = 'flex';
        
        // Update file info
        document.getElementById('file-path').textContent = request.filePath;
        
        // Calculate stats
        const diff = request.diff;
        let additions = 0;
        let deletions = 0;
        
        diff.hunks.forEach(hunk => {
            additions += hunk.newLines;
            deletions += hunk.oldLines;
        });
        
        document.getElementById('additions').textContent = `+${additions}`;
        document.getElementById('deletions').textContent = `-${deletions}`;
        
        // Render diff
        this.renderDiff();
    }

    renderDiff() {
        if (!this.currentRequest) return;
        
        const diffContent = document.getElementById('diff-content');
        const diff = this.currentRequest.diff;
        
        if (diff.isNewFile) {
            diffContent.innerHTML = this.renderNewFile(diff);
        } else if (diff.isDeletedFile) {
            diffContent.innerHTML = this.renderDeletedFile(diff);
        } else {
            diffContent.innerHTML = this.renderHunks(diff.hunks);
        }
        
        // Apply syntax highlighting
        this.applySyntaxHighlighting();
        
        // Update button states
        this.updateButtonStates();
    }

    renderNewFile(diff) {
        const lines = diff.newContent.split('\n');
        return `
            <div class="hunk new-file" data-hunk-id="new-file">
                <div class="hunk-header">
                    <div class="hunk-info">New file: ${diff.filePath}</div>
                    <div class="hunk-actions">
                        <span class="hunk-type addition">New File</span>
                        <input type="checkbox" onchange="diffViewer.toggleHunk('new-file')">
                    </div>
                </div>
                <div class="hunk-content unified-view">
                    ${lines.map((line, index) => `
                        <div class="code-line line-added">
                            <div class="line-number">${index + 1}</div>
                            <div class="line-content">${this.escapeHtml(line)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderDeletedFile(diff) {
        const lines = diff.oldContent.split('\n');
        return `
            <div class="hunk deleted-file" data-hunk-id="deleted-file">
                <div class="hunk-header">
                    <div class="hunk-info">Deleted file: ${diff.filePath}</div>
                    <div class="hunk-actions">
                        <span class="hunk-type deletion">Deleted File</span>
                        <input type="checkbox" onchange="diffViewer.toggleHunk('deleted-file')">
                    </div>
                </div>
                <div class="hunk-content unified-view">
                    ${lines.map((line, index) => `
                        <div class="code-line line-removed">
                            <div class="line-number">${index + 1}</div>
                            <div class="line-content">${this.escapeHtml(line)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderHunks(hunks) {
        return hunks.map(hunk => {
            if (this.viewMode === 'unified') {
                return this.renderUnifiedHunk(hunk);
            } else {
                return this.renderSplitHunk(hunk);
            }
        }).join('');
    }

    renderUnifiedHunk(hunk) {
        const hunkContent = [];
        
        // Render removed lines
        hunk.oldContent.forEach((line, index) => {
            hunkContent.push(`
                <div class="code-line line-removed">
                    <div class="line-number">${hunk.oldStart + index}</div>
                    <div class="line-content">-${this.escapeHtml(line)}</div>
                </div>
            `);
        });
        
        // Render added lines
        hunk.newContent.forEach((line, index) => {
            hunkContent.push(`
                <div class="code-line line-added">
                    <div class="line-number">${hunk.newStart + index}</div>
                    <div class="line-content">+${this.escapeHtml(line)}</div>
                </div>
            `);
        });
        
        return `
            <div class="hunk" data-hunk-id="${hunk.id}">
                <div class="hunk-header">
                    <div class="hunk-info">@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@</div>
                    <div class="hunk-actions">
                        <span class="hunk-type ${hunk.type}">${hunk.type}</span>
                        <input type="checkbox" onchange="diffViewer.toggleHunk('${hunk.id}')">
                    </div>
                </div>
                <div class="hunk-content unified-view">
                    ${hunkContent.join('')}
                </div>
            </div>
        `;
    }

    renderSplitHunk(hunk) {
        const maxLines = Math.max(hunk.oldContent.length, hunk.newContent.length);
        const oldLines = [];
        const newLines = [];
        
        for (let i = 0; i < maxLines; i++) {
            const oldLine = hunk.oldContent[i] || '';
            const newLine = hunk.newContent[i] || '';
            
            oldLines.push(`
                <div class="code-line ${oldLine ? 'line-removed' : ''}">
                    <div class="line-number">${oldLine ? hunk.oldStart + i : ''}</div>
                    <div class="line-content">${oldLine ? '-' + this.escapeHtml(oldLine) : ''}</div>
                </div>
            `);
            
            newLines.push(`
                <div class="code-line ${newLine ? 'line-added' : ''}">
                    <div class="line-number">${newLine ? hunk.newStart + i : ''}</div>
                    <div class="line-content">${newLine ? '+' + this.escapeHtml(newLine) : ''}</div>
                </div>
            `);
        }
        
        return `
            <div class="hunk" data-hunk-id="${hunk.id}">
                <div class="hunk-header">
                    <div class="hunk-info">@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@</div>
                    <div class="hunk-actions">
                        <span class="hunk-type ${hunk.type}">${hunk.type}</span>
                        <input type="checkbox" onchange="diffViewer.toggleHunk('${hunk.id}')">
                    </div>
                </div>
                <div class="hunk-content split-view">
                    <div class="old-content">${oldLines.join('')}</div>
                    <div class="new-content">${newLines.join('')}</div>
                </div>
            </div>
        `;
    }

    toggleHunk(hunkId) {
        if (this.selectedHunks.has(hunkId)) {
            this.selectedHunks.delete(hunkId);
        } else {
            this.selectedHunks.add(hunkId);
        }
        
        // Update visual selection
        const hunkElement = document.querySelector(`[data-hunk-id="${hunkId}"]`);
        if (hunkElement) {
            hunkElement.classList.toggle('selected', this.selectedHunks.has(hunkId));
        }
        
        this.updateButtonStates();
    }

    updateButtonStates() {
        const approveSelectedBtn = document.getElementById('approve-selected');
        approveSelectedBtn.disabled = this.selectedHunks.size === 0;
    }

    approveAll() {
        this.sendApprovalResponse(true, Array.from(this.getAllHunkIds()));
    }

    rejectAll() {
        this.sendApprovalResponse(false, [], 'User rejected all changes');
    }

    approveSelected() {
        if (this.selectedHunks.size === 0) return;
        this.sendApprovalResponse(true, Array.from(this.selectedHunks));
    }

    showPreview() {
        this.vscode.postMessage({
            type: 'requestPreview',
            requestId: this.currentRequest.id,
            approvedHunks: Array.from(this.selectedHunks)
        });
    }

    showPreviewResult(previewContent) {
        const modal = document.getElementById('preview-modal');
        const codeElement = modal.querySelector('code');
        
        codeElement.textContent = previewContent;
        
        // Apply syntax highlighting
        if (window.hljs && this.currentRequest) {
            const language = this.currentRequest.diff.language;
            if (hljs.getLanguage(language)) {
                hljs.highlightElement(codeElement);
            }
        }
        
        modal.style.display = 'flex';
    }

    closeModal() {
        document.getElementById('preview-modal').style.display = 'none';
    }

    sendApprovalResponse(approved, approvedHunks = [], rejectReason = '') {
        this.vscode.postMessage({
            type: 'approvalResponse',
            response: {
                requestId: this.currentRequest.id,
                approved,
                approvedHunks: approved ? approvedHunks : undefined,
                rejectReason: !approved ? rejectReason : undefined
            }
        });
    }

    getAllHunkIds() {
        if (!this.currentRequest) return [];
        
        if (this.currentRequest.diff.isNewFile) {
            return ['new-file'];
        } else if (this.currentRequest.diff.isDeletedFile) {
            return ['deleted-file'];
        } else {
            return this.currentRequest.diff.hunks.map(hunk => hunk.id);
        }
    }

    applySyntaxHighlighting() {
        if (window.hljs && this.currentRequest) {
            const language = this.currentRequest.diff.language;
            if (hljs.getLanguage(language)) {
                document.querySelectorAll('.line-content').forEach(element => {
                    // Skip if already highlighted
                    if (!element.classList.contains('hljs')) {
                        const code = element.textContent.substring(1); // Remove +/- prefix
                        element.innerHTML = hljs.highlight(code, { language }).value;
                    }
                });
            }
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize diff viewer when page loads
let diffViewer;
document.addEventListener('DOMContentLoaded', () => {
    diffViewer = new DiffViewer();
});

// Make diffViewer globally accessible for onclick handlers
window.diffViewer = diffViewer;
