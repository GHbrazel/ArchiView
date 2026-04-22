import * as vscode from 'vscode';

/**
 * Manages extension settings and configuration
 * Load and listen to settings changes
 */
export class SettingsManager {
  private showNamespaceHierarchy: boolean = false;
  private onSettingsChanged: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  readonly onSettingsChangedEvent = this.onSettingsChanged.event;

  constructor() {
    this.loadVsCodeConfigurationSettings();
    this.setupConfigListener();
  }

  private loadVsCodeConfigurationSettings(): void {
    const config = vscode.workspace.getConfiguration('MetaLens');
    this.showNamespaceHierarchy = config.get('showNamespaceHierarchy', false);
  }

  private setupConfigListener(): void {
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('MetaLens')) {
        this.loadVsCodeConfigurationSettings();
        this.onSettingsChanged.fire();
      }
    });
  }

  isNamespaceHierarchyEnabled(): boolean {
    return this.showNamespaceHierarchy;
  }

  setNamespaceHierarchyEnabled(enabled: boolean): void {
    this.showNamespaceHierarchy = enabled;
    this.onSettingsChanged.fire();
  }
}
