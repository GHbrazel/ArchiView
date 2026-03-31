import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CSharpParser, AttributeInfo, InterfaceMethodSignature } from './csharpParser';
import { FilterManager } from './filterManager';

export class AttributeItem extends vscode.TreeItem {
  constructor(
    public label: string,
    public collapsibleState: vscode.TreeItemCollapsibleState,
    public file?: string,
    public line?: number,
    public context?: string
  ) {
    super(label, collapsibleState);
    this.tooltip = context;
    
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

interface AttributeLocation {
  file: string;
  attribute: AttributeInfo;
  namespace: string | null;
}

export class AttributeProvider implements vscode.TreeDataProvider<AttributeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AttributeItem | undefined>();
  onDidChangeTreeData = this._onDidChangeTreeData.event;

  private attributeMap: Map<string, AttributeLocation[]> = new Map();
  private showNamespaceHierarchy: boolean = true;
  private filterManager: FilterManager;

  constructor(filterManager?: FilterManager) {
    this.filterManager = filterManager || new FilterManager();
    this.loadSettings();
    this.refresh();
    this.setupWatchers();
    this.setupConfigListener();
  }

  private loadSettings() {
    const config = vscode.workspace.getConfiguration('MetaLens');
    this.showNamespaceHierarchy = config.get('showNamespaceHierarchy', true);
  }

  private setupConfigListener() {
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('MetaLens.showNamespaceHierarchy')) {
        this.loadSettings();
        this._onDidChangeTreeData.fire(undefined);
      }
    });
  }

  private setupWatchers() {
    // Watch for C# file changes
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.cs');
    watcher.onDidCreate(() => this.refresh());
    watcher.onDidDelete(() => this.refresh());
    watcher.onDidChange((uri) => {
      this.parseFile(uri);
      this._onDidChangeTreeData.fire(undefined);
    });
  }

  async refresh() {
    console.log('Refreshing C# attributes...');
    this.attributeMap.clear();
    await this.findAttributesInWorkspace();
    this._onDidChangeTreeData.fire(undefined);
  }

  private async findAttributesInWorkspace() {
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

  private parseFile(uri: vscode.Uri) {
    try {
      const filePath = uri.fsPath;
      
      // First, remove all old entries for this file from the attribute map
      for (const locations of this.attributeMap.values()) {
        // Filter out entries that belong to this file
        const filtered = locations.filter(loc => loc.file !== filePath);
        
        // Keep only the non-empty arrays to avoid empty entries
        if (filtered.length === 0) {
          // If no locations left for this attribute, we'll remove it during cleanup
          continue;
        }
      }
      
      // Clean up empty attribute entries
      const keysToRemove: string[] = [];
      for (const [key, locations] of this.attributeMap.entries()) {
        const filtered = locations.filter(loc => loc.file !== filePath);
        if (filtered.length === 0) {
          keysToRemove.push(key);
        } else {
          // Update with filtered array (without the current file)
          this.attributeMap.set(key, filtered);
        }
      }
      
      // Remove empty attribute entries
      for (const key of keysToRemove) {
        this.attributeMap.delete(key);
      }
      
      // Now parse and add the new content
      const content = fs.readFileSync(filePath, 'utf-8');
      const attributes = CSharpParser.parseAttributes(content);
      const namespace = CSharpParser.extractNamespace(content);

      if (attributes.length > 0) {
        // Add each attribute to the map
        for (const attr of attributes) {
          const key = attr.fullName;
          if (!this.attributeMap.has(key)) {
            this.attributeMap.set(key, []);
          }
          this.attributeMap.get(key)!.push({
            file: filePath,
            attribute: attr,
            namespace: namespace
          });
        }

        console.log(`Found ${attributes.length} attributes in ${path.basename(filePath)}`);
      } else {
        console.log(`No attributes found in ${path.basename(filePath)}`);
      }
    } catch (error) {
      console.error(`Error parsing ${uri.fsPath}:`, error);
    }
  }

  private extractNamespacePart(fullNamespace: string | null): string {
    if (!fullNamespace) {return 'No Namespace';}
    // Extract the second part of the namespace (e.g., "Models" from "CsAttributeExampleProject.Models")
    const parts = fullNamespace.split('.');
    return parts[0];
  }

  /**
   * Get all attribute names in the workspace
   */
  getAllAttributeNames(): Set<string> {
    return new Set(this.attributeMap.keys());
  }

  /**
   * Get the total count of attributes across all files
   * @returns Total number of attribute occurrences
   */
  getTotalAttributeCount(): number {
    let count = 0;
    for (const locations of this.attributeMap.values()) {
      count += locations.length;
    }
    return count;
  }

  /**
   * Check if an attribute should be shown based on current filters
   */
  private shouldShowAttribute(attributeName: string): boolean {
    // If no filters selected, show all
    if (!this.filterManager.hasFilters()) {
      return true;
    }
    // If filters are active, only show selected attributes
    return this.filterManager.isAttributeSelected(attributeName);
  }

  getTreeItem(element: AttributeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: AttributeItem): AttributeItem[] {
    if (!element) {
      // Root level
      return this.showNamespaceHierarchy
        ? this.getRootNamespaceChildren()
        : this.getRootFlatChildren();
    }

    // Handle interface method signatures
    if (element.file && element.label?.includes("interface '")) {
      return this.getInterfaceMethodChildren(element);
    }

    // Handle namespace level (hierarchy mode)
    if (element.context?.startsWith('namespace|') && !element.file) {
      return this.getNamespaceAttributeChildren(element);
    }

    // Handle attribute in flat mode (root level)
    if (element.label?.startsWith('[') && !element.file && element.context && !element.context.includes('|')) {
      return this.getFlatModeFileChildren(element);
    }

    // Handle attribute in hierarchy mode (under namespace)
    if (element.context?.startsWith('attribute|')) {
      return this.getHierarchyModeFileChildren(element);
    }

    // Handle attribute occurrences in a file
    if (element.file && element.context && !element.context.includes('|')) {
      return this.getAttributeOccurrenceChildren(element);
    }

    return [];
  }

  /**
   * Gets root-level namespace nodes (hierarchy mode)
   */
  private getRootNamespaceChildren(): AttributeItem[] {
    const namespaceMap = new Map<string, AttributeLocation[]>();

    // Collect all locations by namespace, respecting filters
    for (const [attrName, locations] of this.attributeMap.entries()) {
      if (!this.shouldShowAttribute(attrName)) {
        continue;
      }

      for (const location of locations) {
        const ns = this.extractNamespacePart(location.namespace);
        if (!namespaceMap.has(ns)) {
          namespaceMap.set(ns, []);
        }
        namespaceMap.get(ns)!.push(location);
      }
    }

    // Return namespaces as root
    return Array.from(namespaceMap.keys())
      .sort()
      .map(
        (ns) => {
          const nsLocations = namespaceMap.get(ns) || [];
          return new AttributeItem(
            `${ns} (${nsLocations.length})`,
            vscode.TreeItemCollapsibleState.Collapsed,
            undefined,
            undefined,
            `namespace|${ns}`
          );
        }
      );
  }

  /**
   * Gets root-level attribute nodes (flat mode)
   */
  private getRootFlatChildren(): AttributeItem[] {
    return Array.from(this.attributeMap.keys())
      .filter(attributeName => this.shouldShowAttribute(attributeName))
      .sort()
      .map(
        (attributeName) => {
          const locations = this.attributeMap.get(attributeName) || [];
          return new AttributeItem(
            `[${attributeName}] (${locations.length})`,
            vscode.TreeItemCollapsibleState.Collapsed,
            undefined,
            undefined,
            attributeName
          );
        }
      );
  }

  /**
   * Gets attributes within a specific namespace (hierarchy mode, level 2)
   */
  private getNamespaceAttributeChildren(element: AttributeItem): AttributeItem[] {
    const ns = element.context!.replace('namespace|', '');
    const attributeMap = new Map<string, AttributeLocation[]>();

    // Collect attributes for this namespace, respecting filters
    for (const [attrName, locations] of this.attributeMap.entries()) {
      if (!this.shouldShowAttribute(attrName)) {
        continue;
      }

      const nsLocations = locations.filter(loc => this.extractNamespacePart(loc.namespace) === ns);
      if (nsLocations.length > 0) {
        attributeMap.set(attrName, nsLocations);
      }
    }

    // Return attributes in this namespace
    return Array.from(attributeMap.keys())
      .sort()
      .map(
        (attributeName) => {
          const locations = attributeMap.get(attributeName) || [];
          return new AttributeItem(
            `[${attributeName}] (${locations.length})`,
            vscode.TreeItemCollapsibleState.Collapsed,
            undefined,
            undefined,
            `attribute|${attributeName}|${ns}`
          );
        }
      );
  }

  /**
   * Gets files for an attribute in flat mode (flat mode, level 2)
   */
  private getFlatModeFileChildren(element: AttributeItem): AttributeItem[] {
    const attributeName = element.context!;
    const locations = this.attributeMap.get(attributeName) || [];
    const uniqueFiles = new Map<string, AttributeLocation[]>();

    for (const location of locations) {
      if (!uniqueFiles.has(location.file)) {
        uniqueFiles.set(location.file, []);
      }
      uniqueFiles.get(location.file)!.push(location);
    }

    return Array.from(uniqueFiles.keys())
      .sort()
      .map(
        (file) => {
          const fileName = path.basename(file);
          return new AttributeItem(
            fileName,
            vscode.TreeItemCollapsibleState.Collapsed,
            file,
            undefined,
            attributeName
          );
        }
      );
  }

  /**
   * Gets files for an attribute within a namespace (hierarchy mode, level 3)
   */
  private getHierarchyModeFileChildren(element: AttributeItem): AttributeItem[] {
    const parts = element.context!.replace('attribute|', '').split('|');
    const attributeName = parts[0];
    const ns = parts[1];

    const locations = this.attributeMap.get(attributeName) || [];
    const fileMap = new Map<string, AttributeLocation[]>();

    // Filter by namespace and group by file
    for (const location of locations) {
      if (this.extractNamespacePart(location.namespace) === ns) {
        if (!fileMap.has(location.file)) {
          fileMap.set(location.file, []);
        }
        fileMap.get(location.file)!.push(location);
      }
    }

    return Array.from(fileMap.keys())
      .sort()
      .map(
        (file) => {
          const fileName = path.basename(file);
          return new AttributeItem(
            fileName,
            vscode.TreeItemCollapsibleState.Collapsed,
            file,
            undefined,
            attributeName
          );
        }
      );
  }

  /**
   * Gets method signatures for an interface attribute
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
        return new AttributeItem(
          sig.signature,
          vscode.TreeItemCollapsibleState.None,
          element.file,
          sig.line,
          `Interface member: ${sig.signature}`
        );
      });
    } catch (error) {
      console.error(`Error extracting interface methods from ${element.file}:`, error);
      return [];
    }
  }

  /**
   * Gets attribute occurrences in a file (leaf level)
   */
  private getAttributeOccurrenceChildren(element: AttributeItem): AttributeItem[] {
    const attributeName = element.context!;
    const locations = this.attributeMap.get(attributeName) || [];

    // Filter locations to this file and sort by line number
    const fileLocations = locations
      .filter(loc => loc.file === element.file)
      .sort((a, b) => a.attribute.line - b.attribute.line);

    return fileLocations.map((location) => {
      const attr = location.attribute;

      // Build descriptive label
      const label = this.buildAttributeOccurrenceLabel(attr);

      // Build comprehensive tooltip
      const tooltipText = this.buildAttributeTooltip(attr);

      // Interface attributes are collapsible
      const isCollapsible =
        attr.targetElement === 'interface' && attr.targetName;

      return new AttributeItem(
        label,
        isCollapsible
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
        element.file,
        attr.line,
        tooltipText
      );
    });
  }

  /**
   * Builds the display label for an attribute occurrence
   */
  private buildAttributeOccurrenceLabel(attr: AttributeInfo): string {
    if (attr.targetElement === 'parameter' && attr.parameterName) {
      return `parameter '${attr.parameterName}'`;
    }

    if (attr.targetElement === 'return') {
      return `return value`;
    }

    if (attr.targetName && attr.targetElement && attr.targetElement !== 'unknown') {
      return `${attr.targetElement} '${attr.targetName}'`;
    }

    if (attr.targetElement && attr.targetElement !== 'unknown') {
      return attr.targetElement;
    }

    return attr.arguments ? `${attr.name}(${attr.arguments})` : attr.name;
  }

  /**
   * Builds the tooltip text for an attribute occurrence
   */
  private buildAttributeTooltip(attr: AttributeInfo): string {
    let tooltipText = `Attribute: ${attr.fullName}`;

    if (attr.arguments) {
      tooltipText += `\nArguments: ${attr.arguments}`;
    }

    tooltipText += `\nTarget: ${this.getTargetDescription(attr)}`;

    if (attr.targetName) {
      tooltipText += `\nName: ${attr.targetName}`;
    }

    if (attr.targetElement === 'parameter') {
      tooltipText += `\nParameter: ${attr.parameterType} ${attr.parameterName}`;
    }

    tooltipText += `\nLine: ${attr.line}`;

    return tooltipText;
  }

  private getTargetDescription(attr: AttributeInfo): string {
    switch (attr.targetElement) {
      case 'class':
        return 'class';
      case 'interface':
        return 'interface';
      case 'struct':
        return 'struct';
      case 'enum':
        return 'enum';
      case 'property':
        return 'property';
      case 'field':
        return 'field';
      case 'method':
        return 'method';
      case 'parameter':
        return attr.parameterName ? `parameter "${attr.parameterName}"` : 'parameter';
      case 'event':
        return 'event';
      case 'return':
        return 'return value';
      case 'delegate':
        return 'delegate';
      case 'assembly':
        return 'assembly';
      case 'module':
        return 'module';
      case 'typevar':
        return 'type parameter';
      default:
        return attr.targetElement || 'unknown';
    }
  }
}
