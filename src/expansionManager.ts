import * as vscode from 'vscode';
import { AttributeItem } from './attributeProvider';

/**
 * Tracks which nodes are expanded/collapsed
 */
export class ExpansionManager {
  private expandedNodeIds: Set<string> = new Set();

  /**
   * Generate a unique, stable ID for a tree node
   * For file nodes: file:{filepath}:attr:{attributeName}
   * For namespace nodes: namespace|{name}
   * For attribute nodes: context value
   */
  getNodeId(element: AttributeItem): string {
    // For file nodes, create a unique ID combining attribute and file
    if (element.file && element.context && !element.context.includes('|')) {
      return `file:${element.file}:attr:${element.context}`;
    }
    
    // Use context as the primary stable identifier
    if (element.context) {
      return element.context;
    }
    
    // Fallback to label+file if no context
    const parts = [element.label, element.file || ''];
    return parts.join('::');
  }

  markNodeAsExpanded(element: AttributeItem | string): void {
    const nodeId = typeof element === 'string' ? element : this.getNodeId(element);
    this.expandedNodeIds.add(nodeId);
  }

  markNodeAsCollapsed(element: AttributeItem | string): void {
    const nodeId = typeof element === 'string' ? element : this.getNodeId(element);
    this.expandedNodeIds.delete(nodeId);
  }

  isExpanded(element: AttributeItem | string): boolean {
    const nodeId = typeof element === 'string' ? element : this.getNodeId(element);
    return this.expandedNodeIds.has(nodeId);
  }

  getCollapsibleState(element: AttributeItem, hasChildren: boolean): vscode.TreeItemCollapsibleState {
    if (!hasChildren) {
      return vscode.TreeItemCollapsibleState.None;
    }

    return this.isExpanded(element)
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.Collapsed;
  }

  setupTreeViewListeners(treeView: vscode.TreeView<AttributeItem>): void {
    treeView.onDidExpandElement((event) => {
      this.markNodeAsExpanded(event.element);
    });

    treeView.onDidCollapseElement((event) => {
      this.markNodeAsCollapsed(event.element);
    });
  }

  clearExpansionState(): void {
    this.expandedNodeIds.clear();
  }

  getAllExpandedNodeIds(): Set<string> {
    return new Set(this.expandedNodeIds);
  }
}
