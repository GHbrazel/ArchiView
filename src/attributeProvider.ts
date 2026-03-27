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
}

export class AttributeProvider implements vscode.TreeDataProvider<AttributeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AttributeItem | undefined>();
  onDidChangeTreeData = this._onDidChangeTreeData.event;

  private attributeMap: Map<string, AttributeLocation[]> = new Map();

  constructor() {
    this.refresh();
    this.setupWatchers();
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

      if (attributes.length > 0) {
        // Add each attribute to the map
        for (const attr of attributes) {
          const key = attr.fullName;
          if (!this.attributeMap.has(key)) {
            this.attributeMap.set(key, []);
          }
          this.attributeMap.get(key)!.push({
            file: uri.fsPath,
            attribute: attr
          });
        }

        console.log(`Found ${attributes.length} attributes in ${path.basename(uri.fsPath)}`);
      }
    } catch (error) {
      console.error(`Error parsing ${uri.fsPath}:`, error);
    }
  }

  getTreeItem(element: AttributeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: AttributeItem): AttributeItem[] {
    if (!element) {
      // Root level: show all unique attributes, sorted alphabetically
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
              attributeName // Store attribute name in context
            );
          }
        );
    }

    // Level 2: show files that contain this attribute
    if (element.label?.startsWith('[') && !element.file && element.context) {
      const attributeName = element.context;
      const locations = this.attributeMap.get(attributeName) || [];
      const uniqueFiles = new Map<string, AttributeLocation[]>();

      // Group locations by file
      for (const location of locations) {
        if (!uniqueFiles.has(location.file)) {
          uniqueFiles.set(location.file, []);
        }
        uniqueFiles.get(location.file)!.push(location);
      }

      // Create tree items for each file
      return Array.from(uniqueFiles.keys())
        .sort()
        .map(
          (file) => {
            const fileLocations = uniqueFiles.get(file) || [];
            return new AttributeItem(
              path.basename(file),
              vscode.TreeItemCollapsibleState.Collapsed,
              file,
              undefined,
              attributeName // Pass attribute name to file level
            );
          }
        );
    }

    // Level 3: show individual attribute occurrences in a file
    if (element.file && element.context) {
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
