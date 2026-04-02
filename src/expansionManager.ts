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

  /**
   * Mark a node as expanded
   */
  markExpanded(element: AttributeItem | string): void {
    const nodeId = typeof element === 'string' ? element : this.getNodeId(element);
    this.expandedNodeIds.add(nodeId);
  }

  /**
   * Mark a node as collapsed
   */
  markCollapsed(element: AttributeItem | string): void {
    const nodeId = typeof element === 'string' ? element : this.getNodeId(element);
    this.expandedNodeIds.delete(nodeId);
  }

  /**
   * Check if a node should be expanded
   */
  isExpanded(element: AttributeItem | string): boolean {
    const nodeId = typeof element === 'string' ? element : this.getNodeId(element);
    return this.expandedNodeIds.has(nodeId);
  }

  /**
   * Get the collapsible state for a tree item
   */
  getCollapsibleState(element: AttributeItem, hasChildren: boolean): vscode.TreeItemCollapsibleState {
    // If it can't have children, it's not collapsible
    if (!hasChildren) {
      return vscode.TreeItemCollapsibleState.None;
    }

    // Return Expanded or Collapsed based on tracking
    return this.isExpanded(element)
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.Collapsed;
  }

  /**
   * Setup listeners for tree view expand/collapse events
   */
  setupTreeViewListeners(treeView: vscode.TreeView<AttributeItem>): void {
    treeView.onDidExpandElement((event) => {
      this.markExpanded(event.element);
    });

    treeView.onDidCollapseElement((event) => {
      this.markCollapsed(event.element);
    });
  }

  /**
   * Clear all expansion state
   */
  clear(): void {
    this.expandedNodeIds.clear();
  }

  /**
   * Get all expanded node IDs (for testing/debugging)
   */
  getExpandedNodeIds(): Set<string> {
    return new Set(this.expandedNodeIds);
  }
}
