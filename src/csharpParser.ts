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
  targetElement?: string; // class, method, property, parameter, enum, return, event, field, etc.
  targetSpecifier?: string; // Explicit target: type, method, field, property, param, event, return, assembly, module
  targetName?: string; // The name of the targeted element (e.g., "UserId" for property, "CreateProduct" for method)
  parameterType?: string; // For parameter attributes: the type of the parameter
  parameterName?: string; // For parameter attributes: the name of the parameter
}

export interface InterfaceMethodSignature {
  signature: string;
  line: number;
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
   * Also detects parameter attributes inside method signatures
   */
  static parseAttributes(content: string): AttributeInfo[] {
    const lines = content.split('\n');
    const attributes: AttributeInfo[] = [];

    // First, extract line-based attributes (class, method, property attributes)
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

      // Find the target name once for all stacked attributes
      const targetName = this.findTargetName(lines, currentLineIdx);

      // Extract all stacked attributes from the beginning
      let currentPos = 0;

      while (currentPos < fullAttributeText.length) {
        if (fullAttributeText[currentPos] !== '[') {
          break;
        }

        // First check for explicit target specifier: [target: ...]
        let targetSpecifier = '';
        const targetSpecifierMatch = fullAttributeText.substring(currentPos + 1).match(/^(\s*)(assembly|module|return|type|method|field|property|param|event|typevar)(\s*:\s*)/);
        let nameStartPos = currentPos + 1;
        
        if (targetSpecifierMatch) {
          targetSpecifier = targetSpecifierMatch[2];
          nameStartPos = currentPos + 1 + targetSpecifierMatch[0].length;
        }

        // Extract attribute name
        const nameMatch = fullAttributeText.substring(nameStartPos).match(/^(\s*)([A-Za-z_][A-Za-z0-9_\.]*)/);
        if (!nameMatch) {
          break;
        }

        const attributeName = nameMatch[2];
        let searchPos = nameStartPos + nameMatch[0].length;

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
          // If we have an explicit target specifier, use it to determine targetElement
          let targetElement = '';
          if (targetSpecifier) {
            // Map explicit targets to target elements
            if (targetSpecifier === 'return') {
              targetElement = 'return';
            } else if (targetSpecifier === 'type') {
              targetElement = 'class'; // or could be interface, struct, etc.
            } else if (targetSpecifier === 'method') {
              targetElement = 'method';
            } else if (targetSpecifier === 'field') {
              targetElement = 'field';
            } else if (targetSpecifier === 'property') {
              targetElement = 'property';
            } else if (targetSpecifier === 'param') {
              targetElement = 'parameter';
            } else if (targetSpecifier === 'event') {
              targetElement = 'event';
            } else if (targetSpecifier === 'assembly' || targetSpecifier === 'module') {
              targetElement = targetSpecifier;
            } else if (targetSpecifier === 'typevar') {
              targetElement = 'typevar';
            }
          } else {
            // No explicit target specifier, infer from context
            targetElement = this.findTargetElement(lines, currentLineIdx);
          }

          attributes.push({
            name: this.extractSimpleName(attributeName),
            fullName: attributeName,
            arguments: attributeArgs,
            line: lineIndex + 1,
            column: currentPos,
            targetElement: targetElement,
            targetSpecifier: targetSpecifier || undefined,
            targetName: targetName
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

    // Second, extract parameter attributes inside method signatures
    const paramAttributes = this.extractParameterAttributes(lines);
    attributes.push(...paramAttributes);

    return attributes;
  }

  /**
   * Extracts attributes applied to method parameters
   * Pattern 1: [Attribute] Type ParameterName (implicit parameter attribute)
   * Pattern 2: [param: Attribute] Type ParameterName (explicit param target)
   * Example: [NotNull] object value or [param: Required] string value
   */
  private static extractParameterAttributes(lines: string[]): AttributeInfo[] {
    const attributes: AttributeInfo[] = [];
    const content = lines.join('\n');

    // Find method signatures - look for patterns with parentheses
    // This regex looks for opening parentheses that could contain parameters
    let currentPos = 0;
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      
      // Look for opening parenthesis (method parameter list)
      const parenMatch = line.match(/\(/);
      if (!parenMatch) {
        continue;
      }

      // Get the full method signature (may span multiple lines)
      let fullSignature = line;
      let endLineIdx = lineIndex;
      let parenCount = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;

      // Collect lines until we find the closing parenthesis
      while (parenCount > 0 && endLineIdx + 1 < lines.length) {
        endLineIdx++;
        fullSignature += '\n' + lines[endLineIdx];
        parenCount += (lines[endLineIdx].match(/\(/g) || []).length - (lines[endLineIdx].match(/\)/g) || []).length;
      }

      // Extract parameter list
      const startParen = fullSignature.indexOf('(');
      const endParen = fullSignature.lastIndexOf(')');
      
      if (startParen !== -1 && endParen !== -1) {
        const paramList = fullSignature.substring(startParen + 1, endParen);
        
        // Pattern 1: Look for implicit parameter attributes: [Attribute] Type Name
        // Must start with '[' to ensure it's an actual attribute
        // Type can include: generic parameters <>, nullable marker ?, and namespace dots
        const implicitParamAttrRegex = /\[\s*([A-Za-z_][A-Za-z0-9_\.]*)\s*(?:\(\s*([^)]*)\s*\))?\s*\]\s+([A-Za-z_][A-Za-z0-9_<>?\.]*)\s+([A-Za-z_][A-Za-z0-9_]*?)(?:\s*[,=]|$)/g;
        
        let match;
        while ((match = implicitParamAttrRegex.exec(paramList)) !== null) {
          const attributeName = match[1];
          const attributeArgs = match[2] || '';
          const paramType = match[3];
          const paramName = match[4];
          
          // Calculate the actual line where this attribute appears
          const relativePos = fullSignature.indexOf(match[0]);
          let attrLineIdx = lineIndex;
          let tempPos = 0;
          
          for (let i = lineIndex; i <= endLineIdx; i++) {
            tempPos += lines[i].length + 1; // +1 for newline
            if (tempPos >= relativePos) {
              attrLineIdx = i;
              break;
            }
          }

          attributes.push({
            name: this.extractSimpleName(attributeName),
            fullName: attributeName,
            arguments: attributeArgs,
            line: attrLineIdx + 1,
            column: line.indexOf('[' + attributeName),
            targetElement: 'parameter',
            targetName: paramName,
            parameterType: paramType,
            parameterName: paramName
          });
        }

        // Pattern 2: Look for explicit param target attributes: [param: Attribute] or other targets
        // Format: [target: AttributeName(args)] Type ParamName
        const explicitTargetRegex = /\[\s*(param|return|type|method|field|property|event)\s*:\s*([A-Za-z_][A-Za-z0-9_\.]*)\s*(?:\(\s*([^)]*)\s*\))?\s*\]\s+([A-Za-z_][A-Za-z0-9_<>?\.]*)\s+([A-Za-z_][A-Za-z0-9_]*?)(?:\s*[,=]|$)/g;
        
        while ((match = explicitTargetRegex.exec(paramList)) !== null) {
          const targetSpecifier = match[1];
          
          // Only process param and return targets in parameter context
          if (targetSpecifier !== 'param' && targetSpecifier !== 'return') {
            continue;
          }
          
          const attributeName = match[2];
          const attributeArgs = match[3] || '';
          const paramType = match[4];
          const paramName = match[5];
          
          // Calculate the actual line where this attribute appears
          const relativePos = fullSignature.indexOf(match[0]);
          let attrLineIdx = lineIndex;
          let tempPos = 0;
          
          for (let i = lineIndex; i <= endLineIdx; i++) {
            tempPos += lines[i].length + 1; // +1 for newline
            if (tempPos >= relativePos) {
              attrLineIdx = i;
              break;
            }
          }

          attributes.push({
            name: this.extractSimpleName(attributeName),
            fullName: attributeName,
            arguments: attributeArgs,
            line: attrLineIdx + 1,
            column: line.indexOf('['),
            targetElement: targetSpecifier === 'param' ? 'parameter' : 'return',
            targetSpecifier: targetSpecifier,
            targetName: targetSpecifier === 'param' ? paramName : undefined,
            parameterType: paramType,
            parameterName: paramName
          });
        }
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

      if (line.startsWith('public class ') || line.startsWith('private class ') || line.startsWith('class ') ||
          line.startsWith('internal class ') || line.startsWith('protected class ')) {
        return 'class';
      }
      if (line.startsWith('public interface ') || line.startsWith('private interface ') || line.startsWith('interface ')) {
        return 'interface';
      }
      if (line.startsWith('public enum ') || line.startsWith('private enum ') || line.startsWith('enum ')) {
        return 'enum';
      }
      if (line.startsWith('public struct ') || line.startsWith('private struct ') || line.startsWith('struct ')) {
        return 'struct';
      }
      
      // Event detection: look for 'event' keyword
      if (line.includes(' event ')) {
        return 'event';
      }

      // Field detection: look for semicolon (;) which indicates a field or property
      // But not if it has getter/setter which would make it a property
      if ((line.includes('public ') || line.includes('private ') || line.includes('protected ')) && 
          line.includes(';') && !line.includes('{')) {
        return 'field';
      }
      
      // Property detection: look for get/set keywords or braces
      if ((line.includes('public ') || line.includes('private ') || line.includes('protected ')) && 
          (line.includes('get;') || line.includes('set;') || line.includes('{ get') || line.includes('{ set') ||
           (line.includes('{') && (line.includes('get') || line.includes('set'))))) {
        return 'property';
      }
      
      // Method detection: look for parentheses (method parameters)
      if ((line.includes('public ') || line.includes('private ') || line.includes('protected ') || 
           line.includes('internal ')) && 
          line.includes('(') && !line.includes('class') && !line.includes('interface') && 
          !line.includes('struct') && !line.includes('delegate')) {
        return 'method';
      }

      // Delegate detection
      if (line.includes('public delegate ') || line.includes('private delegate ')) {
        return 'delegate';
      }

      // Stop if we hit another attribute or empty line beyond search range
      if ((line.startsWith('[') && !line.startsWith('[')) || (line === '' && i > currentLineIndex + 3)) {
        break;
      }
    }

    return 'unknown';
  }

  /**
   * Extract the name of the target element (property name, method name, class name, etc.)
   */
  private static findTargetName(lines: string[], currentLineIndex: number): string | undefined {
    // Look at the next few non-empty lines for the target element name
    for (let i = currentLineIndex + 1; i < Math.min(currentLineIndex + 10, lines.length); i++) {
      const line = lines[i].trim();

      if (line === '') {
        continue;
      }

      // Skip attribute lines (they start with '[')
      if (line.startsWith('[')) {
        continue;
      }

      // Class/Interface/Struct/Enum/Delegate - extract the name
      const typeMatch = line.match(/^(public |private |protected |internal )?(partial |abstract |sealed )?(class|interface|struct|enum|delegate)\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (typeMatch) {
        return typeMatch[4]; // Return the type name
      }

      // Event - extract the name (handles generic types like EventHandler<EventArgs>)
      // Pattern: event Type EventName or event Type<Generic> EventName
      const eventMatch = line.match(/event\s+[\w<>,\s]+?\s+([A-Za-z_][A-Za-z0-9_]*)\s*[;={]/);
      if (eventMatch) {
        return eventMatch[1];
      }

      // Property/Field - handle various patterns
      // Matches: access_modifier type name { or ; or = 
      // Handles: generic types, nullable, arrays, with/without initialization
      // Pattern: modifier+ (optional static/readonly) type identifier (followed by { ; or =)
      const propMatch = line.match(/(?:public|private|protected|internal)\s+(?:static\s+)?(?:readonly\s+)?[\w<>?,\[\]\s]+?\s+([A-Za-z_][A-Za-z0-9_]*)\s*[\{;=]/);
      if (propMatch) {
        return propMatch[1];
      }

      // Method - extract the method name (look for identifier before opening paren or bracket)
      // Pattern: access_modifier return_type methodName (or methodName[)
      // Handles nullable types (?) and complex return types (arrays, generics)
      const methodMatch = line.match(/^(?:public|private|protected|internal)\s+(?:static\s+)?(?:async\s+)?[\w<>?,\[\]\s]+?\s+([A-Za-z_][A-Za-z0-9_]*)\s*[\(\[]/);
      if (methodMatch) {
        return methodMatch[1];
      }

      // If we found a declaration line but couldn't parse the name, stop searching
      if (line.includes('{') || line.includes('(') || line.includes(';')) {
        break;
      }
    }

    return undefined;
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

  /**
   * Extracts method signatures from an interface with their line numbers
   * Used for display purposes when an attribute targets an interface
   */
  static extractInterfaceMethodSignatures(content: string, interfaceName: string): InterfaceMethodSignature[] {
    const methodSignatures: InterfaceMethodSignature[] = [];
    const lines = content.split('\n');
    
    // Find the interface declaration first
    let interfaceLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      // Match: "interface InterfaceName" with opening brace
      if (trimmed.match(new RegExp(`\\binterface\\s+${interfaceName}\\b`))) {
        interfaceLineIdx = i;
        break;
      }
    }
    
    if (interfaceLineIdx === -1) {
      return []; // Interface not found
    }
    
    // Count braces to find interface bounds
    let braceCount = 0;
    let inInterface = false;
    
    for (let i = interfaceLineIdx; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Count braces
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;
      
      // Mark that we're in the interface once we hit the opening brace
      if (braceCount > 0) {
        inInterface = true;
      }
      
      // Exit the interface when braces close
      if (inInterface && braceCount === 0) {
        break;
      }
      
      // Skip lines before we find the opening brace
      if (!inInterface) {
        continue;
      }
      
      // Skip the interface declaration line, empty lines, comments, attributes
      if (i === interfaceLineIdx || !trimmed || trimmed.startsWith('//') || trimmed.startsWith('[') || trimmed.startsWith('}')) {
        continue;
      }
      
      // Match method or property signatures
      // This includes: return_type method_name(...) or type property_name { ... }
      // Allow for: public, async, generics, arrays, nullable types
      
      // Match anything that looks like a member declaration
      // Pattern: optional modifiers + return type + name + either () or {}
      const memberMatch = trimmed.match(/^(public\s+)?(async\s+)?([\w<>\[\],\?\s]+)\s+([A-Za-z_][A-Za-z0-9_]*)\s*[({]/);
      
      if (memberMatch) {
        // Extract the signature up to the first ( or { or ;
        let signature = trimmed;
        
        // Find where the actual declaration ends
        const openParen = trimmed.indexOf('(');
        const openBrace = trimmed.indexOf('{');
        const semicolon = trimmed.indexOf(';');
        
        // Get the earliest position
        let endPos = trimmed.length;
        if (openParen !== -1) {endPos = Math.min(endPos, openParen);}
        if (openBrace !== -1) {endPos = Math.min(endPos, openBrace);}
        if (semicolon !== -1) {endPos = Math.min(endPos, semicolon);}
        
        // For properties with getters/setters on same line, capture the full line
        if (openBrace !== -1 && trimmed.includes('}')) {
          endPos = trimmed.length;
        } else if (openParen !== -1) {
          // For methods, capture up to (and including) closing paren
          let parenCount = 1;
          let endParen = trimmed.indexOf(')', openParen);
          if (endParen !== -1) {
            endPos = endParen + 1;
          }
        }
        
        signature = trimmed.substring(0, endPos).trim();
        
        // Only add if it's a valid signature and not a duplicate
        if (signature && !methodSignatures.some(m => m.signature === signature) && signature.length > 5) {
          // Line numbers are 1-based for VS Code
          methodSignatures.push({
            signature,
            line: i + 1
          });
        }
      }
    }
    
    return methodSignatures;
  }
}
