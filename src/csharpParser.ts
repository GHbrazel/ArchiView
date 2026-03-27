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
  static extractNamespace(content: string): string {
    const namespaceRegex = /^\s*namespace\s+([\w\.]+)\s*[{;]/m;
    const match = content.match(namespaceRegex);
    return match ? match[1] : '';
  }

  /**
   * Parses C# source code and extracts all attributes
   * Key distinction: Attributes ALWAYS appear at the start of a line (after whitespace)
   * Array indexing and similar patterns like array[0], dict[key] appear in the middle of code
   */
  static parseAttributes(content: string): AttributeInfo[] {
    const lines = content.split('\n');
    const attributes: AttributeInfo[] = [];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      
      // Attributes must start at the beginning of a line (after optional whitespace)
      const lineStartMatch = line.match(/^\s*/);
      if (!lineStartMatch) {
        continue;
      }

      const leadingWhitespace = lineStartMatch[0];
      const restOfLine = line.substring(leadingWhitespace.length);

      // Check if line starts with an attribute pattern
      if (!restOfLine.startsWith('[')) {
        continue;
      }

      // Handle potentially multi-line attributes
      let fullAttributeText = restOfLine;
      let currentLineIdx = lineIndex;
      
      // Keep appending lines until we find the closing bracket
      let bracketCount = 0;
      for (let i = 0; i < fullAttributeText.length; i++) {
        if (fullAttributeText[i] === '[') {bracketCount++;}
        if (fullAttributeText[i] === ']') {bracketCount--;}
      }

      // If we didn't find matching brackets, try next lines
      while (bracketCount > 0 && currentLineIdx + 1 < lines.length) {
        currentLineIdx++;
        const nextLine = lines[currentLineIdx];
        fullAttributeText += ' ' + nextLine.trim();
        
        for (let i = 0; i < nextLine.length; i++) {
          if (nextLine[i] === '[') {bracketCount++;}
          if (nextLine[i] === ']') {bracketCount--;}
        }
      }

      // Extract all stacked attributes from the beginning
      let currentPos = 0;

      while (currentPos < fullAttributeText.length) {
        if (fullAttributeText[currentPos] !== '[') {
          break;
        }

        // Extract attribute name
        const nameMatch = fullAttributeText.substring(currentPos + 1).match(/^(\s*)([A-Za-z_][A-Za-z0-9_\.]*)/);
        if (!nameMatch) {
          break;
        }

        const attributeName = nameMatch[2];
        let searchPos = currentPos + 1 + nameMatch[0].length;

        // Skip whitespace after name
        const wsMatch = fullAttributeText.substring(searchPos).match(/^(\s*)/);
        if (wsMatch) {
          searchPos += wsMatch[0].length;
        }

        let attributeArgs = '';
        let attributeEnd = -1;

        // Check if there are arguments
        if (fullAttributeText[searchPos] === '(') {
          // Find matching closing parenthesis, handling nested parens and angle brackets
          let parenDepth = 1;
          let angleDepth = 0;
          let i = searchPos + 1;

          while (i < fullAttributeText.length && parenDepth > 0) {
            const char = fullAttributeText[i];
            if (char === '<') {
              angleDepth++;
            } else if (char === '>') {
              angleDepth--;
            } else if (char === '(' && angleDepth === 0) {
              parenDepth++;
            } else if (char === ')' && angleDepth === 0) {
              parenDepth--;
            }
            i++;
          }

          if (parenDepth === 0) {
            attributeArgs = fullAttributeText.substring(searchPos + 1, i - 1).trim();
            searchPos = i;
          } else {
            break; // Unmatched parenthesis
          }
        }

        // Skip whitespace before closing bracket
        const wsMatch2 = fullAttributeText.substring(searchPos).match(/^(\s*)/);
        if (wsMatch2) {
          searchPos += wsMatch2[0].length;
        }

        // Expect closing bracket
        if (fullAttributeText[searchPos] === ']') {
          attributeEnd = searchPos + 1;

          // Determine target element (class, method, property, etc.)
          const targetElement = this.findTargetElement(lines, currentLineIdx);

          attributes.push({
            name: this.extractSimpleName(attributeName),
            fullName: attributeName,
            arguments: attributeArgs,
            line: lineIndex + 1,
            column: currentPos,
            targetElement: targetElement
          });

          currentPos = attributeEnd;

          // Skip whitespace between stacked attributes
          const nextWsMatch = fullAttributeText.substring(currentPos).match(/^(\s*)/);
          if (nextWsMatch) {
            currentPos += nextWsMatch[0].length;
          }
        } else {
          break; // No closing bracket found
        }
      }

      // Skip lines we've already processed
      if (currentLineIdx > lineIndex) {
        lineIndex = currentLineIdx;
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
      
      // Property detection: look for get/set keywords
      if ((line.includes('public ') || line.includes('private ')) && (line.includes('get;') || line.includes('set;') || line.includes('{ get') || line.includes('{ set'))) {
        return 'property';
      }
      
      // Method detection: look for parentheses (method parameters)
      if (line.includes('public ') && line.includes('(') && !line.includes('class') && !line.includes('interface') && !line.includes('struct')) {
        return 'method';
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
