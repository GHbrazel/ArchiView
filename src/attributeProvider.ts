import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CSharpParser, AttributeInfo } from './csharpParser';

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

  constructor() {
    this.loadSettings();
    this.refresh();
    this.setupWatchers();
    this.setupConfigListener();
  }

  private loadSettings() {
    const config = vscode.workspace.getConfiguration('ArchiView');
    this.showNamespaceHierarchy = config.get('showNamespaceHierarchy', true);
  }

  private setupConfigListener() {
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('ArchiView.showNamespaceHierarchy')) {
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
      const content = fs.readFileSync(uri.fsPath, 'utf-8');
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
            file: uri.fsPath,
            attribute: attr,
            namespace: namespace
          });
        }

        console.log(`Found ${attributes.length} attributes in ${path.basename(uri.fsPath)}`);
      }
    } catch (error) {
      console.error(`Error parsing ${uri.fsPath}:`, error);
    }
  }

  private extractNamespacePart(fullNamespace: string | null): string {
    if (!fullNamespace) return 'No Namespace';
    // Extract the second part of the namespace (e.g., "Models" from "CsAttributeExampleProject.Models")
    const parts = fullNamespace.split('.');
    return parts[0];
  }

  getTreeItem(element: AttributeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: AttributeItem): AttributeItem[] {
    if (!element) {
      // Root level: show hierarchically organized data
      if (this.showNamespaceHierarchy) {
        // Hierarchy mode: show namespaces first
        const namespaceMap = new Map<string, AttributeLocation[]>();
        
        // Collect all locations by namespace
        for (const locations of this.attributeMap.values()) {
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
                `namespace|${ns}` // Mark as namespace node
              );
            }
          );
      } else {
        // Flat mode: show attributes directly
        return Array.from(this.attributeMap.keys())
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
    }

    // Level 2 in hierarchy mode: show attributes within a namespace
    if (element.context && element.context.startsWith('namespace|') && !element.file) {
      const ns = element.context.replace('namespace|', '');
      const attributeMap = new Map<string, AttributeLocation[]>();

      // Collect attributes for this namespace
      for (const [attrName, locations] of this.attributeMap.entries()) {
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
              `attribute|${attributeName}|${ns}` // Mark as attribute within namespace
            );
          }
        );
    }

    // Level 2 in flat mode: show files for this attribute
    if (element.label?.startsWith('[') && !element.file && element.context && !element.context.includes('|')) {
      const attributeName = element.context;
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
            const fileLocations = uniqueFiles.get(file) || [];
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

    // Level 3 in hierarchy mode: show files for this attribute within a namespace
    if (element.context && element.context.startsWith('attribute|')) {
      const parts = element.context.replace('attribute|', '').split('|');
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

    // Level 4 in hierarchy mode: show attribute occurrences in a file
    // Level 3 in flat mode: show attribute occurrences in a file
    if (element.file && element.context && !element.context.includes('|')) {
      const attributeName = element.context;
      const locations = this.attributeMap.get(attributeName) || [];
      
      // Filter locations to this file and sort by line number
      const fileLocations = locations
        .filter(loc => loc.file === element.file)
        .sort((a, b) => a.attribute.line - b.attribute.line);

      return fileLocations.map(
        (location) => {
          const attr = location.attribute;
          const label = attr.arguments
            ? `${attr.name}(${attr.arguments})`
            : attr.name;
          
          return new AttributeItem(
            label,
            vscode.TreeItemCollapsibleState.None,
            element.file,
            attr.line,
            `${attr.targetElement} at line ${attr.line}`
          );
        }
      );
    }

    return [];
  }
}
