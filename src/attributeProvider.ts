import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CSharpParser,  InterfaceMethodSignature } from './csharpParser';
import { FilterManager } from './filterManager';
import { ExpansionManager } from './expansionManager';
import { AttributeRepository, AttributeLocation } from './attributeRepository';
import { SettingsManager } from './settingsManager';
import { TreeItemBuilder } from './treeItemBuilder';

/**
 * Represents a node in the attribute tree view
 */
export class AttributeItem extends vscode.TreeItem {
  constructor(
    public label: string,
    public collapsibleState: vscode.TreeItemCollapsibleState,
    public file?: string,
    public line?: number,
    public context?: string,
    public tooltip?: vscode.MarkdownString
  ) {
    super(label, collapsibleState);
    this.tooltip = tooltip ?? context ? new vscode.MarkdownString(context) : undefined;
    
    if (file && line !== undefined) {
      this.description = `${path.basename(file)}:${line}`;
      this.command = {
        command: 'vscode.open',
        title: 'Open',
        arguments: [vscode.Uri.file(file), { selection: new vscode.Range(line - 1, 0, line - 1, 0) }]
      };
    }
  }
}

/**
 * Delegates specific functionality to focused manager classes
 */
export class AttributeProvider implements vscode.TreeDataProvider<AttributeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AttributeItem | undefined>();
  onDidChangeTreeData = this._onDidChangeTreeData.event;

  // Composed managers
  private repository: AttributeRepository;
  private expansionManager: ExpansionManager;
  private settingsManager: SettingsManager;
  private treeItemBuilder: TreeItemBuilder;
  private filterManager: FilterManager;
  private treeView: vscode.TreeView<AttributeItem> | undefined;

  constructor(filterManager?: FilterManager) {
    this.filterManager = filterManager || new FilterManager();
    this.repository = new AttributeRepository();
    this.expansionManager = new ExpansionManager();
    this.settingsManager = new SettingsManager();
    this.treeItemBuilder = new TreeItemBuilder(this.expansionManager);

    this.refresh();
    this.setupFileWatchers();
    this.setupSettingsListener();
  }

  /**
   * Sets the TreeView reference and hooks up expand/collapse event listeners
   */
  setTreeView(treeView: vscode.TreeView<AttributeItem>): void {
    this.treeView = treeView;
    this.expansionManager.setupTreeViewListeners(treeView);
  }

  /**
   * Required by TreeDataProvider interface
   */
  getTreeItem(element: AttributeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Required by TreeDataProvider interface - returns children of a node
   */
  getChildren(element?: AttributeItem): AttributeItem[] {
    if (!element) {
      // Root level - choose hierarchy based on settings
      return this.settingsManager.isNamespaceHierarchyEnabled()
        ? this.getRootNamespaceChildren()
        : this.getRootFlatChildren();
    }

    // Delegate to appropriate children getter based on node type
    if (element.file && element.label?.includes("interface '")) {
      return this.getInterfaceMethodChildren(element);
    }

    if (element.context?.startsWith('namespace|') && !element.file) {
      return this.getNamespaceAttributeChildren(element);
    }

    if (element.label?.startsWith('[') && !element.file && element.context && !element.context.includes('|')) {
      return this.getFlatModeFileChildren(element);
    }

    if (element.context?.startsWith('attribute|')) {
      return this.getHierarchyModeFileChildren(element);
    }

    if (element.file && element.context && !element.context.includes('|')) {
      return this.getAttributeOccurrenceChildren(element);
    }

    return [];
  }

  /**
   * Get all attribute names in the workspace
   */
  getAllAttributeNames(): Set<string> {
    return this.repository.getAllAttributeNames();
  }

  // ========================
  // Testing/Debugging Accessors
  // ========================

  /**
   * Get the expansion manager (for testing)
   */
  getExpansionManager(): ExpansionManager {
    return this.expansionManager;
  }

  /**
   * Get the attribute repository (for testing)
   */
  getRepository(): AttributeRepository {
    return this.repository;
  }

  /**
   * Get the settings manager (for testing)
   */
  getSettingsManager(): SettingsManager {
    return this.settingsManager;
  }

  // ========================
  // Private Methods
  // ========================

  /**
   * Refresh all attributes in the workspace
   */
  async refresh(): Promise<void> {
    console.log('Refreshing C# attributes...');
    this.repository.clearAllData();
    await this.findAttributesInWorkspace();
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Setup file system watchers for C# files
   */
  private setupFileWatchers(): void {
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.cs');
    
    watcher.onDidCreate(() => this.refresh());
    
    watcher.onDidDelete(() => this.refresh());
    
    // Incremental update on changes (preserves expansion)
    watcher.onDidChange((uri) => {
      this.parseFileAndUpdateTree(uri);
    });
  }

  private setupSettingsListener(): void {
    this.settingsManager.onSettingsChangedEvent(() => {
      this._onDidChangeTreeData.fire(undefined);
    });
  }

  private parseFileAndUpdateTree(uri: vscode.Uri): void {
    this.parseFile(uri);
    this._onDidChangeTreeData.fire(undefined);
  }

  private async findAttributesInWorkspace(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      console.log('No workspace folders found');
      return;
    }

    for (const folder of workspaceFolders) {
      try {
        const files = await vscode.workspace.findFiles(
          new vscode.RelativePattern(folder, '**/*.cs'),
          '**/bin/**'
        );

        console.log(`Found ${files.length} C# files in ${folder.name}`);

        for (const file of files) {
          this.parseFile(file);
        }
      } catch (error) {
        console.error(`Error finding files in ${folder.name}:`, error);
      }
    }
  }

  /**
   * Parse a C# file and extract attributes
   */
  private parseFile(uri: vscode.Uri): void {
    try {
      const filePath = uri.fsPath;
      
      // Remove old entries for this file
      this.repository.removeLocationsFromFile(filePath);
      
      // Parse the file
      const content = fs.readFileSync(filePath, 'utf-8');
      const attributes = CSharpParser.parseAttributes(content);
      const namespace = CSharpParser.extractNamespace(content);

      // Add new entries to repository
      for (const attr of attributes) {
        const locations = this.repository.getAttributeLocations(attr.fullName);
        locations.push({
          file: filePath,
          attribute: attr,
          namespace: namespace
        });
        this.repository.setAttributeLocations(attr.fullName, locations);
      }

      const fileCount = attributes.length;
      console.log(`${fileCount > 0 ? 'Found' : 'No'} ${fileCount} attribute${fileCount !== 1 ? 's' : ''} in ${path.basename(filePath)}`);
    } catch (error) {
      console.error(`Error parsing ${uri.fsPath}:`, error);
    }
  }

  private extractInitialNamespacePart(fullNamespace: string | null): string {
    if (!fullNamespace) {
      return 'No Namespace';
    }
    const parts = fullNamespace.split('.');
    return parts[0];
  }

  private shouldShowAttribute(attributeName: string): boolean {
    if (!this.filterManager.hasActiveFilters()) {
      return true;
    }
    return this.filterManager.isAttributeSelected(attributeName);
  }

  private getRootNamespaceChildren(): AttributeItem[] {
    const namespaceMap = new Map<string, AttributeLocation[]>();

    // Group all locations by namespace
    for (const [attrName, locations] of this.repository.getAllLocations()) {
      if (!this.shouldShowAttribute(attrName)) {
        continue;
      }

      for (const location of locations) {
        const ns = this.extractInitialNamespacePart(location.namespace);
        if (!namespaceMap.has(ns)) {
          namespaceMap.set(ns, []);
        }
        namespaceMap.get(ns)!.push(location);
      }
    }

    // Return namespace nodes
    return Array.from(namespaceMap.keys())
      .sort()
      .map((ns) => {
        const nsLocations = namespaceMap.get(ns) || [];
        return this.treeItemBuilder.buildNamespaceItem(ns, nsLocations.length);
      });
  }


  private getRootFlatChildren(): AttributeItem[] {
    return Array.from(this.repository.getAllAttributeNames())
      .filter(attr => this.shouldShowAttribute(attr))
      .sort()
      .map((attributeName) => {
        const count = this.repository.getAttributeOccurrenceCount(attributeName);
        return this.treeItemBuilder.buildAttributeItem(attributeName, count);
      });
  }

  private getNamespaceAttributeChildren(element: AttributeItem): AttributeItem[] {
    const ns = element.context!.replace('namespace|', '');
    const attributeMap = new Map<string, AttributeLocation[]>();

    // Collect attributes in this namespace
    for (const [attrName, locations] of this.repository.getAllLocations()) {
      if (!this.shouldShowAttribute(attrName)) {
        continue;
      }

      const nsLocations = locations.filter(loc => this.extractInitialNamespacePart(loc.namespace) === ns);
      if (nsLocations.length > 0) {
        attributeMap.set(attrName, nsLocations);
      }
    }

    // Return attributes in this namespace
    return Array.from(attributeMap.keys())
      .sort()
      .map((attributeName) => {
        const count = attributeMap.get(attributeName)?.length || 0;
        return this.treeItemBuilder.buildAttributeItem(attributeName, count, ns);
      });
  }

  private getFlatModeFileChildren(element: AttributeItem): AttributeItem[] {
    const attributeName = element.context!;
    const locations = this.repository.getAttributeLocations(attributeName);
    const fileMap = new Map<string, AttributeLocation[]>();

    // Group by file
    for (const location of locations) {
      if (!fileMap.has(location.file)) {
        fileMap.set(location.file, []);
      }
      fileMap.get(location.file)!.push(location);
    }

    // Return file nodes
    return Array.from(fileMap.keys())
      .sort()
      .map((file) => this.treeItemBuilder.buildFileItem(file, attributeName));
  }

  private getHierarchyModeFileChildren(element: AttributeItem): AttributeItem[] {
    const parts = element.context!.replace('attribute|', '').split('|');
    const attributeName = parts[0];
    const ns = parts[1];

    const locations = this.repository.getAttributeLocations(attributeName);
    const fileMap = new Map<string, AttributeLocation[]>();

    // Filter by namespace and group by file
    for (const location of locations) {
      if (this.extractInitialNamespacePart(location.namespace) === ns) {
        if (!fileMap.has(location.file)) {
          fileMap.set(location.file, []);
        }
        fileMap.get(location.file)!.push(location);
      }
    }

    // Return file nodes
    return Array.from(fileMap.keys())
      .sort()
      .map((file) => this.treeItemBuilder.buildFileItem(file, attributeName));
  }

  /**
   * Build method signature nodes for an interface attribute
   */
  private getInterfaceMethodChildren(element: AttributeItem): AttributeItem[] {
    const interfaceMatch = element.label!.match(/interface\s+'([^']+)'/);
    if (!interfaceMatch) {
      return [];
    }

    const interfaceName = interfaceMatch[1];

    try {
      const content = fs.readFileSync(element.file!, 'utf-8');
      const methodSignatures = CSharpParser.extractInterfaceMethodSignatures(
        content,
        interfaceName
      );

      return methodSignatures.map((sig: InterfaceMethodSignature) => {
        return this.treeItemBuilder.buildInterfaceMethodItem(element.file!, sig);
      });
    } catch (error) {
      console.error(`Error extracting interface methods from ${element.file}:`, error);
      return [];
    }
  }

  private getAttributeOccurrenceChildren(element: AttributeItem): AttributeItem[] {
    // Extract attribute name from context
    // Context can be in two formats:
    // - Hierarchy mode: "attribute|AttributeName|Namespace"
    // - Flat mode: "file:/path/to/file.cs:attr:AttributeName"
    let attributeName = element.context!;
    
    if (attributeName.startsWith('attribute|')) {
      // Hierarchy mode: extract first part after 'attribute|'
      attributeName = attributeName.replace('attribute|', '').split('|')[0];
    } else if (attributeName.startsWith('file:') && attributeName.includes(':attr:')) {
      // Flat mode: extract part after ':attr:'
      attributeName = attributeName.split(':attr:')[1];
    }

    const locations = this.repository.getAttributeLocations(attributeName);

    const fileLocations = locations
      .filter(loc => loc.file === element.file)
      .sort((a, b) => a.attribute.line - b.attribute.line);

    return fileLocations.map((location) => {
      const tooltip = this.treeItemBuilder.buildAttributeTooltip(location.attribute);
      return this.treeItemBuilder.buildAttributeOccurrenceItem(element.file!, location.attribute, tooltip);
    });
  }
}
