import * as vscode from 'vscode';
import { FilterManager } from './filterManager';

/**
 * Provides a simple webview with just a search input field
 */
export class SearchInputProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'meta-lens-search';
  private webviewView?: vscode.WebviewView;
  private searchInputDebounceTimer: NodeJS.Timeout | undefined;
  
  constructor(
    private context: vscode.ExtensionContext,
    private filterManager: FilterManager
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    webviewView.webview.html = this.getWebviewContent();

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage((message) => {
      if (message.command === 'search') {
        if (this.searchInputDebounceTimer) {
          clearTimeout(this.searchInputDebounceTimer);
        }
        this.searchInputDebounceTimer = setTimeout(() => {
          const query = message.query as string;
          this.filterManager.setSearchQuery(query);
        }, 150);
      } else if (message.command === 'clearSearch') {
        if (this.searchInputDebounceTimer) {
          clearTimeout(this.searchInputDebounceTimer);
        }
        this.filterManager.setSearchQuery('');
      }
    });

    // Listen for filter changes
    this.filterManager.onFilterChanged(() => {
      const currentQuery = this.filterManager.getSearchQuery();
      webviewView.webview.postMessage({
        command: 'updateSearch',
        query: currentQuery
      });
    });
  }

  private getWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MetaLens Search</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-sideBar-background);
            color: var(--vscode-sideBar-foreground);
            padding: 8px;
        }

        .search-container {
            display: flex;
            gap: 6px;
            align-items: center;
        }

        .search-input {
            flex: 1;
            padding: 6px 10px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-size: 13px;
            font-family: inherit;
            outline: none;
        }

        .search-input:focus {
            border-color: var(--vscode-focusBorder);
        }

        .search-input::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }

        .clear-btn {
            padding: 4px 8px;
            background-color: transparent;
            border: none;
            color: var(--vscode-icon-foreground);
            cursor: pointer;
            font-size: 14px;
            display: none;
            border-radius: 2px;
        }

        .search-input:not(:placeholder-shown) ~ .clear-btn {
            display: block;
        }

        .clear-btn:hover {
            background-color: var(--vscode-toolbar-hoverBackground);
        }

        .tip {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-top: 6px;
        }
    </style>
</head>
<body>
    <div class="search-container">
        <input 
            type="text" 
            class="search-input" 
            id="searchInput" 
            placeholder="Search attributes..."
            spellcheck="false"
        />
        <button class="clear-btn" id="clearBtn" title="Clear">✕</button>
    </div>
    <div class="tip">Type without brackets: "Serializable" instead of "[Serializable]"</div>

    <script>
        const vscode = acquireVsCodeApi();
        const input = document.getElementById('searchInput');
        const clearBtn = document.getElementById('clearBtn');

        input.addEventListener('input', (e) => {
            vscode.postMessage({
                command: 'search',
                query: e.target.value
            });
        });

        clearBtn.addEventListener('click', () => {
            input.value = '';
            input.focus();
            vscode.postMessage({
                command: 'clearSearch'
            });
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && input.value) {
                input.value = '';
                vscode.postMessage({
                    command: 'clearSearch'
                });
            }
        });

        window.addEventListener('message', (e) => {
            const msg = e.data;
            if (msg.command === 'updateSearch') {
                input.value = msg.query;
            }
        });

        input.focus();
    </script>
</body>
</html>`;
  }
}
