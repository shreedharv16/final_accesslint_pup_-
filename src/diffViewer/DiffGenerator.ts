import * as fs from 'fs';
import * as path from 'path';

export interface DiffHunk {
  id: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  oldContent: string[];
  newContent: string[];
  context: string[];
  type: 'addition' | 'deletion' | 'modification';
}

export interface FileDiff {
  filePath: string;
  oldContent: string;
  newContent: string;
  hunks: DiffHunk[];
  isNewFile: boolean;
  isDeletedFile: boolean;
  language: string;
}

export interface EditOperation {
  old_string: string;
  new_string: string;
}

export class DiffGenerator {
  /**
   * Generate diff for file write operations (new file or full overwrite)
   */
  static generateWriteDiff(filePath: string, newContent: string, workspaceRoot: string): FileDiff {
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(workspaceRoot, filePath);
    
    const fileExists = fs.existsSync(absolutePath);
    const oldContent = fileExists ? fs.readFileSync(absolutePath, 'utf8') : '';
    
    const language = this.getLanguageFromFile(filePath);
    
    if (!fileExists) {
      // New file creation
      return {
        filePath,
        oldContent: '',
        newContent,
        hunks: [{
          id: 'new-file',
          oldStart: 0,
          oldLines: 0,
          newStart: 1,
          newLines: newContent.split('\n').length,
          oldContent: [],
          newContent: newContent.split('\n'),
          context: [],
          type: 'addition'
        }],
        isNewFile: true,
        isDeletedFile: false,
        language
      };
    }
    
    // File overwrite - generate unified diff
    return this.generateUnifiedDiff(filePath, oldContent, newContent, workspaceRoot);
  }

  /**
   * Generate diff for edit operations (targeted edits)
   */
  static generateEditDiff(filePath: string, edits: EditOperation[], workspaceRoot: string): FileDiff {
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(workspaceRoot, filePath);
    
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    
    const originalContent = fs.readFileSync(absolutePath, 'utf8');
    let modifiedContent = originalContent;
    
    // Apply edits sequentially to generate the final content
    for (const edit of edits) {
      if (!modifiedContent.includes(edit.old_string)) {
        throw new Error(`Old string not found in file: "${edit.old_string.substring(0, 50)}..."`);
      }
      modifiedContent = modifiedContent.replace(edit.old_string, edit.new_string);
    }
    
    return this.generateUnifiedDiff(filePath, originalContent, modifiedContent, workspaceRoot);
  }

  /**
   * Generate unified diff between old and new content
   */
  private static generateUnifiedDiff(filePath: string, oldContent: string, newContent: string, workspaceRoot: string): FileDiff {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const language = this.getLanguageFromFile(filePath);
    
    const hunks = this.computeDiffHunks(oldLines, newLines);
    
    return {
      filePath,
      oldContent,
      newContent,
      hunks,
      isNewFile: false,
      isDeletedFile: newContent.trim() === '',
      language
    };
  }

  /**
   * Compute diff hunks using a simple LCS-based algorithm
   */
  private static computeDiffHunks(oldLines: string[], newLines: string[]): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    let hunkId = 0;
    
    // Simple line-by-line comparison for now
    // This could be enhanced with more sophisticated diff algorithms
    const maxLines = Math.max(oldLines.length, newLines.length);
    let currentHunk: Partial<DiffHunk> | null = null;
    
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];
      
      if (oldLine !== newLine) {
        // Start a new hunk if needed
        if (!currentHunk) {
          currentHunk = {
            id: `hunk-${hunkId++}`,
            oldStart: i + 1,
            newStart: i + 1,
            oldContent: [],
            newContent: [],
            context: []
          };
        }
        
        // Add lines to current hunk
        if (oldLine !== undefined) {
          currentHunk.oldContent!.push(oldLine);
        }
        if (newLine !== undefined) {
          currentHunk.newContent!.push(newLine);
        }
      } else {
        // Lines are the same - finalize current hunk if exists
        if (currentHunk) {
          currentHunk.oldLines = currentHunk.oldContent!.length;
          currentHunk.newLines = currentHunk.newContent!.length;
          
          // Determine hunk type
          if (currentHunk.oldLines === 0) {
            currentHunk.type = 'addition';
          } else if (currentHunk.newLines === 0) {
            currentHunk.type = 'deletion';
          } else {
            currentHunk.type = 'modification';
          }
          
          hunks.push(currentHunk as DiffHunk);
          currentHunk = null;
        }
      }
    }
    
    // Finalize last hunk if exists
    if (currentHunk) {
      currentHunk.oldLines = currentHunk.oldContent!.length;
      currentHunk.newLines = currentHunk.newContent!.length;
      
      if (currentHunk.oldLines === 0) {
        currentHunk.type = 'addition';
      } else if (currentHunk.newLines === 0) {
        currentHunk.type = 'deletion';
      } else {
        currentHunk.type = 'modification';
      }
      
      hunks.push(currentHunk as DiffHunk);
    }
    
    return hunks;
  }

  /**
   * Get programming language from file extension
   */
  private static getLanguageFromFile(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: { [key: string]: string } = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.kt': 'kotlin',
      '.swift': 'swift',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.less': 'less',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
      '.sql': 'sql',
      '.sh': 'bash',
      '.bat': 'batch',
      '.ps1': 'powershell'
    };
    
    return languageMap[ext] || 'text';
  }

  /**
   * Format diff hunk for display
   */
  static formatHunkForDisplay(hunk: DiffHunk): string {
    const lines: string[] = [];
    
    // Add hunk header
    lines.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);
    
    // Add removed lines
    hunk.oldContent.forEach(line => {
      lines.push(`-${line}`);
    });
    
    // Add added lines
    hunk.newContent.forEach(line => {
      lines.push(`+${line}`);
    });
    
    return lines.join('\n');
  }
}
