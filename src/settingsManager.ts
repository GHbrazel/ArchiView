import * as vscode from 'vscode';

/**
 * Manages extension settings and configuration
 * Load and listen to settings changes
 */
export class SettingsManager {
  private showNamespaceHierarchy: boolean = true;
  private onSettingsChanged: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  readonly onSettingsChangedEvent = this.onSettingsChanged.event;

  constructor() {
    this.loadSettings();
    this.setupConfigListener();
  }

  /**
   * Load settings from VS Code configuration
   */
  private loadSettings(): void {
    const config = vscode.workspace.getConfiguration('archiview');
    this.showNamespaceHierarchy = config.get('showNamespaceHierarchy', true);
  }

  /**
   * Setup listener for configuration changes
   */
  private setupConfigListener(): void {
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('archiview')) {
        this.loadSettings();
        this.onSettingsChanged.fire();
      }
    });
  }

  /**
   * Get whether to show namespace hierarchy
   */
  isNamespaceHierarchyEnabled(): boolean {
    return this.showNamespaceHierarchy;
  }

  /**
   * Set whether to show namespace hierarchy
   */
  setNamespaceHierarchyEnabled(enabled: boolean): void {
    this.showNamespaceHierarchy = enabled;
  }
}
