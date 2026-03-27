/**
 * C# Parser for extracting attributes using Roslyn-like parsing logic
 * Handles complex attribute scenarios including:
 * - Attributes with arguments: [Serializable], [Obsolete("message")]
 * - Attributes with named parameters: [DataContract(Name = "MyClass")]
 * - Stacked attributes: [Attribute1][Attribute2]
 * - Attributes with namespaces: [System.Serializable]
 */

export interface AttributeInfo {
  name: string;
  fullName: string;
  arguments: string;
  line: number;
  column: number;
  targetElement?: string; // class, method, property, enum, etc.
}

export class CSharpParser {
  /**
   * Extracts namespace from C# source code
   */
  static extractNamespace(content: string): string | null {
    const namespaceRegex = /^\s*namespace\s+([\w\.]+)\s*[{;]/m;
    const match = content.match(namespaceRegex);
    return match ? match[1] : null;
  }

  /**
   * Parses C# source code and extracts all attributes
   */
  static parseAttributes(content: string): AttributeInfo[] {
    const lines = content.split('\n');
    const attributes: AttributeInfo[] = [];
    const attributeRegex = /\[\s*([\w\.]+)(?:\s*\(\s*([^)]*)\s*\))?\s*\]/g;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      let match: RegExpExecArray | null;

      // Reset regex lastIndex for each line
      attributeRegex.lastIndex = 0;

      // Find all attributes on this line
      while ((match = attributeRegex.exec(line)) !== null) {
        const fullMatch = match[0];
        const attributeName = match[1].trim();
        const attributeArgs = match[2] || '';
        const column = match.index;

        // Determine target element (class, method, property, etc.)
        const targetElement = this.findTargetElement(lines, lineIndex);

        attributes.push({
          name: this.extractSimpleName(attributeName),
          fullName: attributeName,
          arguments: attributeArgs.trim(),
          line: lineIndex + 1,
          column: column,
          targetElement: targetElement
        });
      }
    }

    return attributes;
  }

  /**
   * Extract simple name from fully qualified attribute name
   * Example: "System.Obsolete" -> "Obsolete"
   */
  private static extractSimpleName(fullName: string): string {
    const parts = fullName.split('.');
    return parts[parts.length - 1];
  }

  /**
   * Find what element this attribute is applied to (class, method, property, etc.)
   */
  private static findTargetElement(lines: string[], currentLineIndex: number): string {
    // Look at the next few non-empty lines for the target element
    for (let i = currentLineIndex + 1; i < Math.min(currentLineIndex + 10, lines.length); i++) {
      const line = lines[i].trim();

      if (line.startsWith('public class ') || line.startsWith('private class ') || line.startsWith('class ')) {
        return 'class';
      }
      if (line.startsWith('public interface ') || line.startsWith('interface ')) {
        return 'interface';
      }
      if (line.startsWith('public enum ') || line.startsWith('enum ')) {
        return 'enum';
      }
      if (line.startsWith('public struct ') || line.startsWith('struct ')) {
        return 'struct';
      }
      if (line.includes('public ') && (line.includes('(') || line.includes('{')) && !line.includes('class') && !line.includes('interface')) {
        return 'method';
      }
      if (line.includes('public ') && line.includes('{') && !line.includes('(')) {
        return 'property';
      }
      if (line.includes('public ') && line.includes(';') && !line.includes('{')) {
        return 'property';
      }

      // Stop if we hit another attribute or empty line beyond search range
      if ((line.startsWith('[') && !line.startsWith('[')) || (line === '' && i > currentLineIndex + 3)) {
        break;
      }
    }

    return 'unknown';
  }

  /**
   * Group attributes by their target element
   */
  static groupByTargetElement(
    attributes: AttributeInfo[]
  ): Map<string, AttributeInfo[]> {
    const grouped = new Map<string, AttributeInfo[]>();

    for (const attr of attributes) {
      const target = attr.targetElement || 'unknown';
      if (!grouped.has(target)) {
        grouped.set(target, []);
      }
      grouped.get(target)!.push(attr);
    }

    return grouped;
  }

  /**
   * Get unique attribute names used in the code
   */
  static getUniqueAttributeNames(attributes: AttributeInfo[]): string[] {
    const unique = new Set<string>();
    for (const attr of attributes) {
      unique.add(attr.name);
    }
    return Array.from(unique).sort();
  }
}
