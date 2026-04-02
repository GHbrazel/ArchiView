import * as vscode from 'vscode';
import * as path from 'path';
import { AttributeItem } from './attributeProvider';
import { AttributeInfo, InterfaceMethodSignature } from './csharpParser';
import { ExpansionManager } from './expansionManager';

/**
 * Builds and formats tree items for display
 */
export class TreeItemBuilder {
  constructor(private expansionManager: ExpansionManager) {}

  buildNamespaceItem(namespace: string, occurrenceCount: number): AttributeItem {
    const nodeId = `namespace|${namespace}`;
    const collapsibleState = this.expansionManager.isExpanded(
      new AttributeItem('', vscode.TreeItemCollapsibleState.Collapsed, undefined, undefined, nodeId)
    )
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.Collapsed;

    return new AttributeItem(
      `${namespace} (${occurrenceCount})`,
      collapsibleState,
      undefined,
      undefined,
      nodeId
    );
  }

  /**
   * Build an attribute tree item (flat mode, root level)
   */
  buildAttributeItem(attributeName: string, occurrenceCount: number, namespace?: string): AttributeItem {
    const context = namespace ? `attribute|${attributeName}|${namespace}` : attributeName;
    
    const tempItem = new AttributeItem(
      `[${attributeName}] (${occurrenceCount})`,
      vscode.TreeItemCollapsibleState.Collapsed,
      undefined,
      undefined,
      context
    );

    const isExpanded = this.expansionManager.isExpanded(tempItem);

    return new AttributeItem(
      `[${attributeName}] (${occurrenceCount})`,
      isExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
      undefined,
      undefined,
      context
    );
  }

  /**
   * Build a file tree item
   */
  buildFileItem(filePath: string, attributeName: string): AttributeItem {
    const fileName = path.basename(filePath);
    const fileNodeId = `file:${filePath}:attr:${attributeName}`;
    
    const tempItem = new AttributeItem(
      fileName,
      vscode.TreeItemCollapsibleState.Collapsed,
      filePath,
      undefined,
      attributeName
    );

    const isExpanded = this.expansionManager.isExpanded(tempItem);

    return new AttributeItem(
      fileName,
      isExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
      filePath,
      undefined,
      attributeName
    );
  }

  /**
   * Build an attribute occurrence tree item (leaf level)
   */
  buildAttributeOccurrenceItem(filePath: string, attribute: AttributeInfo, tooltipText: string): AttributeItem {
    const label = this.buildAttributeOccurrenceLabel(attribute);

    return new AttributeItem(
      label,
      attribute.targetElement === 'interface' && attribute.targetName
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
      filePath,
      attribute.line,
      tooltipText
    );
  }

  /**
   * Build interface method tree item
   */
  buildInterfaceMethodItem(filePath: string, methodSignature: InterfaceMethodSignature): AttributeItem {
    return new AttributeItem(
      methodSignature.signature,
      vscode.TreeItemCollapsibleState.None,
      filePath,
      methodSignature.line,
      `Interface member: ${methodSignature.signature}`
    );
  }

  buildAttributeOccurrenceLabel(attr: AttributeInfo): string {
    if (attr.targetElement === 'interface' && attr.targetName) {
      return `interface '${attr.targetName}'`;
    }

    let label: string = attr.targetElement || 'attribute';
    if (attr.targetName) {
      label += ` '${attr.targetName}'`;
    }

    if (attr.arguments) {
      label += ` ${attr.arguments}`;
    }

    return label;
  }

  buildAttributeTooltip(attr: AttributeInfo): string {
    const lines: string[] = [];
    
    lines.push(`**Attribute:** ${(attr.fullName as string)}`);
    
    if (attr.arguments) {
      lines.push(`**Arguments:** ${(attr.arguments as string)}`);
    }
    
    if (attr.targetElement) {
      lines.push(`**Target:** ${(attr.targetElement as string)}`);
    }
    
    if (attr.targetName) {
      lines.push(`**Name:** ${(attr.targetName as string)}`);
    }
    
    return lines.join('\n');
  }
}
