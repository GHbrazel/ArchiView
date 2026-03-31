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
   * Orchestrates extraction of both line-based and parameter attributes
   */
  static parseAttributes(content: string): AttributeInfo[] {
    const lines = content.split('\n');
    
    // Extract both line-based attributes and parameter attributes
    const lineBasedAttributes = this.extractLineBasedAttributes(lines);
    const paramAttributes = this.extractParameterAttributes(lines);
    
    return [...lineBasedAttributes, ...paramAttributes];
  }

  /**
   * Extracts attributes that appear at the start of lines
   * Handles stacked attributes, multi-line attributes, and determines target elements
   */
  private static extractLineBasedAttributes(lines: string[]): AttributeInfo[] {
    const attributes: AttributeInfo[] = [];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      
      // Check if line starts with an attribute
      if (!this.isAttributeStartLine(line)) {
        continue;
      }

      // Assemble attribute text, handling multi-line cases
      const { attributeText, endLineIndex } = this.assembleMultiLineAttribute(lines, lineIndex);
      
      // Find the target once for all stacked attributes on this block
      const targetName = this.findTargetName(lines, endLineIndex);

      // Extract all stacked attributes
      const stackedAttributes = this.extractStackedAttributes(attributeText, lineIndex, targetName, lines);
      attributes.push(...stackedAttributes);

      // Skip lines we've already processed
      if (endLineIndex > lineIndex) {
        lineIndex = endLineIndex;
      }
    }

    return attributes;
  }

  /**
   * Checks if a line begins with an attribute (after optional whitespace)
   */
  private static isAttributeStartLine(line: string): boolean {
    const lineStartMatch = line.match(/^\s*/);
    if (!lineStartMatch) {
      return false;
    }
    const restOfLine = line.substring(lineStartMatch[0].length);
    return restOfLine.startsWith('[');
  }

  /**
   * Assembles a complete attribute block, handling multi-line attributes
   * Returns the full attribute text and the index of the last line used
   */
  private static assembleMultiLineAttribute(
    lines: string[],
    startLineIndex: number
  ): { attributeText: string; endLineIndex: number } {
    const startLine = lines[startLineIndex];
    const leadingWhitespace = startLine.match(/^\s*/)![0];
    let attributeText = startLine.substring(leadingWhitespace.length);
    let currentLineIdx = startLineIndex;

    // Count brackets to find when attribute block is complete
    let bracketBalance = this.countBracketBalance(attributeText);

    // If incomplete, append next lines
    while (bracketBalance > 0 && currentLineIdx + 1 < lines.length) {
      currentLineIdx++;
      const nextLine = lines[currentLineIdx];
      attributeText += ' ' + nextLine.trim();
      bracketBalance = this.countBracketBalance(attributeText);
    }

    return { attributeText, endLineIndex: currentLineIdx };
  }

  /**
   * Counts the net balance of brackets in text
   * Positive = unmatched opening brackets
   */
  private static countBracketBalance(text: string): number {
    let balance = 0;
    for (const char of text) {
      if (char === '[') {balance++;}
      if (char === ']') {balance--;}
    }
    return balance;
  }

  /**
   * Extracts all stacked attributes from an attribute block
   * Example: [Attribute1][Attribute2] → two separate attributes
   */
  private static extractStackedAttributes(
    attributeText: string,
    lineIndex: number,
    targetName: string | undefined,
    lines: string[]
  ): AttributeInfo[] {
    const attributes: AttributeInfo[] = [];
    let currentPos = 0;

    while (currentPos < attributeText.length && attributeText[currentPos] === '[') {
      const result = this.extractSingleAttribute(attributeText, currentPos, lineIndex, targetName, lines);
      
      if (result.attribute) {
        attributes.push(result.attribute);
        currentPos = result.nextPos;
      } else {
        break;
      }
    }

    return attributes;
  }

  /**
   * Extracts a single attribute from an attribute block
   * Handles: [AttributeName(args)], [target: AttributeName(args)]
   */
  private static extractSingleAttribute(
    attributeText: string,
    startPos: number,
    lineIndex: number,
    targetName: string | undefined,
    lines: string[]
  ): { attribute: AttributeInfo | null; nextPos: number } {
    // Parse target specifier if present: [target: ...]
    let pos = startPos + 1; // Skip opening '['
    const targetSpecifier = this.parseTargetSpecifier(attributeText, pos);
    
    if (targetSpecifier.specifier) {
      pos = targetSpecifier.nextPos;
    }

    // Extract attribute name
    const nameResult = this.parseAttributeName(attributeText, pos);
    if (!nameResult.name) {
      return { attribute: null, nextPos: startPos + 1 };
    }

    pos = nameResult.nextPos;

    // Extract attribute arguments if present
    const argsResult = this.parseAttributeArguments(attributeText, pos);
    pos = argsResult.nextPos;

    // Expect closing bracket
    const wsBeforeClosing = attributeText.substring(pos).match(/^(\s*)/)![0].length;
    pos += wsBeforeClosing;

    if (attributeText[pos] !== ']') {
      return { attribute: null, nextPos: startPos + 1 };
    }

    pos++; // Skip closing ']'

    // Determine target element from specifier or context
    const targetElement = targetSpecifier.specifier
      ? this.mapTargetSpecifierToElement(targetSpecifier.specifier)
      : this.findTargetElement(lines, lineIndex);

    const attribute: AttributeInfo = {
      name: this.extractSimpleName(nameResult.name),
      fullName: nameResult.name,
      arguments: argsResult.arguments,
      line: lineIndex + 1,
      column: startPos,
      targetElement: targetElement,
      targetSpecifier: targetSpecifier.specifier || undefined,
      targetName: targetName
    };

    // Skip whitespace to next attribute
    const wsAfterClosing = attributeText.substring(pos).match(/^(\s*)/)![0].length;
    pos += wsAfterClosing;

    return { attribute, nextPos: pos };
  }

  /**
   * Parses optional target specifier: [target: ...] → 'target'
   * Examples: [assembly: ...], [return: ...], [param: ...]
   */
  private static parseTargetSpecifier(
    attributeText: string,
    pos: number
  ): { specifier: string | null; nextPos: number } {
    const match = attributeText.substring(pos).match(
      /^(\s*)(assembly|module|return|type|method|field|property|param|event|typevar)(\s*:\s*)/
    );

    if (match) {
      return {
        specifier: match[2],
        nextPos: pos + match[0].length
      };
    }

    return { specifier: null, nextPos: pos };
  }

  /**
   * Parses attribute name with optional namespace
   * Examples: 'Serializable', 'System.Serializable'
   */
  private static parseAttributeName(
    attributeText: string,
    pos: number
  ): { name: string | null; nextPos: number } {
    const match = attributeText.substring(pos).match(/^(\s*)([A-Za-z_][A-Za-z0-9_\.]*)/);

    if (!match) {
      return { name: null, nextPos: pos };
    }

    return {
      name: match[2],
      nextPos: pos + match[0].length
    };
  }

  /**
   * Parses attribute arguments: (arg1, arg2, ...)
   * Handles nested parentheses and angle brackets for generics
   */
  private static parseAttributeArguments(
    attributeText: string,
    pos: number
  ): { arguments: string; nextPos: number } {
    if (attributeText[pos] !== '(') {
      return { arguments: '', nextPos: pos };
    }

    let parenDepth = 1;
    let angleDepth = 0;
    let i = pos + 1;

    while (i < attributeText.length && parenDepth > 0) {
      const char = attributeText[i];
      if (char === '<') {angleDepth++;}
      else if (char === '>') {angleDepth--;}
      else if (char === '(' && angleDepth === 0) {parenDepth++;}
      else if (char === ')' && angleDepth === 0) {parenDepth--;}
      i++;
    }

    if (parenDepth === 0) {
      const args = attributeText.substring(pos + 1, i - 1).trim();
      return { arguments: args, nextPos: i };
    }

    return { arguments: '', nextPos: pos };
  }

  /**
   * Maps explicit target specifiers to target element types
   * Example: 'return' → 'return', 'param' → 'parameter'
   */
  private static mapTargetSpecifierToElement(specifier: string): string {
    const specifierMap: { [key: string]: string } = {
      'return': 'return',
      'type': 'class',
      'method': 'method',
      'field': 'field',
      'property': 'property',
      'param': 'parameter',
      'event': 'event',
      'assembly': 'assembly',
      'module': 'module',
      'typevar': 'typevar'
    };

    return specifierMap[specifier] || specifier;
  }

  /**
   * Extracts attributes applied to method parameters
   * Orchestrates extraction of both implicit and explicit parameter attribute patterns
   */
  private static extractParameterAttributes(lines: string[]): AttributeInfo[] {
    const attributes: AttributeInfo[] = [];

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];

      // Skip lines without opening parenthesis
      if (!line.match(/\(/)) {
        continue;
      }

      // Assemble full method signature (may span multiple lines)
      const { fullSignature, endLineIdx } = this.assembleMethodSignature(lines, lineIndex);

      // Extract parameter list from signature
      const startParen = fullSignature.indexOf('(');
      const endParen = fullSignature.lastIndexOf(')');

      if (startParen !== -1 && endParen !== -1) {
        const paramList = fullSignature.substring(startParen + 1, endParen);

        // Extract both implicit and explicit parameter attributes
        const implicitAttrs = this.extractImplicitParameterAttributes(
          paramList,
          fullSignature,
          lines,
          lineIndex
        );
        const explicitAttrs = this.extractExplicitParameterAttributes(
          paramList,
          fullSignature,
          lines,
          lineIndex
        );

        attributes.push(...implicitAttrs, ...explicitAttrs);

        // Skip lines we've processed in the signature
        if (endLineIdx > lineIndex) {
          lineIndex = endLineIdx;
        }
      }
    }

    return attributes;
  }

  /**
   * Assembles a complete method signature, handling multi-line cases
   */
  private static assembleMethodSignature(
    lines: string[],
    startLineIndex: number
  ): { fullSignature: string; endLineIdx: number } {
    const line = lines[startLineIndex];
    let fullSignature = line;
    let endLineIdx = startLineIndex;

    // Count parentheses to find closing paren
    let parenCount =
      (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;

    // Append lines until parentheses are balanced
    while (parenCount > 0 && endLineIdx + 1 < lines.length) {
      endLineIdx++;
      fullSignature += '\n' + lines[endLineIdx];
      parenCount +=
        (lines[endLineIdx].match(/\(/g) || []).length -
        (lines[endLineIdx].match(/\)/g) || []).length;
    }

    return { fullSignature, endLineIdx };
  }

  /**
   * Extracts implicit parameter attributes: [Attribute] Type Name
   */
  private static extractImplicitParameterAttributes(
    paramList: string,
    fullSignature: string,
    lines: string[],
    startLineIndex: number
  ): AttributeInfo[] {
    const attributes: AttributeInfo[] = [];
    const regex =
      /\[\s*([A-Za-z_][A-Za-z0-9_\.]*)\s*(?:\(\s*([^)]*)\s*\))?\s*\]\s+([A-Za-z_][A-Za-z0-9_<>?\.]*)\s+([A-Za-z_][A-Za-z0-9_]*?)(?:\s*[,=]|$)/g;

    let match;
    while ((match = regex.exec(paramList)) !== null) {
      const attributeName = match[1];
      const attributeArgs = match[2] || '';
      const paramType = match[3];
      const paramName = match[4];

      const relativePos = fullSignature.indexOf(match[0]);
      const attrLineIdx = this.calculateAttributeLineIndex(
        lines,
        startLineIndex,
        relativePos
      );

      attributes.push({
        name: this.extractSimpleName(attributeName),
        fullName: attributeName,
        arguments: attributeArgs,
        line: attrLineIdx + 1,
        column: lines[startLineIndex].indexOf('[' + attributeName),
        targetElement: 'parameter',
        targetName: paramName,
        parameterType: paramType,
        parameterName: paramName
      });
    }

    return attributes;
  }

  /**
   * Extracts explicit parameter attributes with target specifiers
   */
  private static extractExplicitParameterAttributes(
    paramList: string,
    fullSignature: string,
    lines: string[],
    startLineIndex: number
  ): AttributeInfo[] {
    const attributes: AttributeInfo[] = [];
    const regex =
      /\[\s*(param|return|type|method|field|property|event)\s*:\s*([A-Za-z_][A-Za-z0-9_\.]*)\s*(?:\(\s*([^)]*)\s*\))?\s*\]\s+([A-Za-z_][A-Za-z0-9_<>?\.]*)\s+([A-Za-z_][A-Za-z0-9_]*?)(?:\s*[,=]|$)/g;

    let match;
    while ((match = regex.exec(paramList)) !== null) {
      const targetSpecifier = match[1];

      // Only process param and return targets
      if (targetSpecifier !== 'param' && targetSpecifier !== 'return') {
        continue;
      }

      const attributeName = match[2];
      const attributeArgs = match[3] || '';
      const paramType = match[4];
      const paramName = match[5];

      const relativePos = fullSignature.indexOf(match[0]);
      const attrLineIdx = this.calculateAttributeLineIndex(
        lines,
        startLineIndex,
        relativePos
      );

      attributes.push({
        name: this.extractSimpleName(attributeName),
        fullName: attributeName,
        arguments: attributeArgs,
        line: attrLineIdx + 1,
        column: lines[startLineIndex].indexOf('['),
        targetElement: targetSpecifier === 'param' ? 'parameter' : 'return',
        targetSpecifier: targetSpecifier,
        targetName: targetSpecifier === 'param' ? paramName : undefined,
        parameterType: paramType,
        parameterName: paramName
      });
    }

    return attributes;
  }

  /**
   * Calculates the actual line index where an attribute appears in a multi-line signature
   */
  private static calculateAttributeLineIndex(
    lines: string[],
    startLineIndex: number,
    relativePos: number
  ): number {
    let lineIdx = startLineIndex;
    let tempPos = 0;

    for (let i = startLineIndex; i < lines.length; i++) {
      tempPos += lines[i].length + 1; // +1 for newline
      if (tempPos >= relativePos) {
        lineIdx = i;
        break;
      }
    }

    return lineIdx;
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
