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
      if (!this.isAttributeStartLine(line, lineIndex, lines)) {
        continue;
      }

      // Assemble attribute text, handling multi-line cases
      const { attributeText, endLineIndex } = this.assembleMultiLineAttribute(lines, lineIndex);
      
      // Find the target once for all stacked attributes on this block
      const targetName = this.findTargetName(lines, endLineIndex);

      // Extract all stacked attributes
      const stackedAttributes = this.extractStackedAttributes(attributeText, lineIndex, targetName, lines);
      attributes.push(...stackedAttributes);

      // Skip lines already processed
      if (endLineIndex > lineIndex) {
        lineIndex = endLineIndex;
      }
    }

    return attributes;
  }

  /**
   * Checks if a line begins with an attribute (after optional whitespace)
   * Excludes attributes that are part of method parameter lists
   */
  private static isAttributeStartLine(line: string, lineIndex: number, lines: string[]): boolean {
    const lineStartMatch = line.match(/^\s*/);
    if (!lineStartMatch) {
      return false;
    }
    const restOfLine = line.substring(lineStartMatch[0].length);
    
    if (!restOfLine.startsWith('[')) {
      return false;
    }

    // Check if this line is part of a method parameter list
    // Count opening and closing parens from the current line backwards
    let openParens = 0;
    let closeParens = 0;
    
    // Count parens on current line up to the attribute
    for (let i = 0; i < line.indexOf('['); i++) {
      if (line[i] === '(') {openParens++;}
      if (line[i] === ')') {closeParens++;}
    }
    
    // Count parens on all previous lines
    for (let i = lineIndex - 1; i >= 0; i--) {
      const prevLine = lines[i];
      for (const char of prevLine) {
        if (char === '(') {openParens++;}
        if (char === ')') {closeParens++;}
      }
    }

    // If there are more opening parens than closing parens, inside a method signature
    if (openParens > closeParens) {
      return false;
    }

    return true;
  }

  /**
   * Assembles a complete attribute block, handling multi-line attributes
   * Continues collecting consecutive attributes even if separated by newlines
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

    // Count brackets to find when current attribute is complete
    let bracketBalance = this.countBracketBalance(attributeText);

    // Continue appending lines while brackets are unbalanced
    while (bracketBalance > 0 && currentLineIdx + 1 < lines.length) {
      currentLineIdx++;
      const nextLine = lines[currentLineIdx];
      attributeText += ' ' + nextLine.trim();
      bracketBalance = this.countBracketBalance(attributeText);
    }

    // After first attribute is complete, continue looking for stacked attributes on following lines
    // Skip empty lines and pragmas, and collect consecutive attributes
    while (currentLineIdx + 1 < lines.length) {
      const nextLineIdx = currentLineIdx + 1;
      const nextLine = lines[nextLineIdx];
      const trimmedNext = nextLine.trim();

      // Skip empty lines and pragma directives
      if (trimmedNext === '' || trimmedNext.startsWith('#pragma') || trimmedNext.startsWith('#')) {
        currentLineIdx = nextLineIdx;
        continue;
      }

      // If we find another attribute, append it
      if (trimmedNext.startsWith('[')) {
        attributeText += ' ' + trimmedNext;
        currentLineIdx = nextLineIdx;
        
        // If this attribute has incomplete brackets, continue assembling
        bracketBalance = this.countBracketBalance(attributeText);
        while (bracketBalance > 0 && currentLineIdx + 1 < lines.length) {
          currentLineIdx++;
          const continuationLine = lines[currentLineIdx];
          attributeText += ' ' + continuationLine.trim();
          bracketBalance = this.countBracketBalance(attributeText);
        }
      } else {
        // Found a non-attribute line, stop collecting
        break;
      }
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
   * Counts the balance of parentheses in text
   * Returns positive if more opening parens, negative if more closing parens
   */
  private static countParenBalance(text: string): number {
    let balance = 0;
    for (const char of text) {
      if (char === '(') {balance++;}
      if (char === ')') {balance--;}
    }
    return balance;
  }

  /**
   * Extracts all stacked attributes from an attribute block
   * Example: [Attribute1][Attribute2] → two separate attributes
   * Correctly calculates line numbers for attributes spanning multiple lines
   */
  private static extractStackedAttributes(
    attributeText: string,
    lineIndex: number,
    targetName: string | undefined,
    lines: string[]
  ): AttributeInfo[] {
    const attributes: AttributeInfo[] = [];
    let currentPos = 0;
    let searchFromLine = lineIndex; // Track where to search for the next attribute

    while (currentPos < attributeText.length && attributeText[currentPos] === '[') {
      const result = this.extractSingleAttribute(attributeText, currentPos, lineIndex, targetName, lines);
      
      if (result.attribute) {
        // Determine the actual line this attribute appears on by searching source lines
        // Start searching from the last found line or the starting line
        const actualLineIndex = this.findAttributeLineInSource(result.attribute.name, searchFromLine, lines);
        result.attribute.line = actualLineIndex + 1;
        
        // For the next attribute, search from the next line after this one
        searchFromLine = actualLineIndex + 1;
        
        attributes.push(result.attribute);
        currentPos = result.nextPos;
      } else {
        break;
      }
    }

    return attributes;
  }

  /**
   * Finds the actual source line where an attribute with a given name appears
   * by searching from startLineIndex onwards
   */
  private static findAttributeLineInSource(attributeName: string, startLineIndex: number, lines: string[]): number {
    // Search from startLineIndex onwards to find this attribute
    for (let i = startLineIndex; i < lines.length; i++) {
      const line = lines[i];
      // Check if this line contains an attribute with the target name
      if (line.includes(`[${attributeName}`) || line.includes(`[${attributeName} `) || line.includes(`[${attributeName}(`)) {
        return i;
      }
      // Also check for return: prefix
      if (line.includes(`[return: ${attributeName}`) || line.includes(`[return:${attributeName}`)) {
        return i;
      }
      // Check for other target specifiers
      if (line.match(new RegExp(`\\[[a-z]+:\\s*${attributeName}`))) {
        return i;
      }
    }
    // Fallback to startLineIndex if not found
    return startLineIndex;
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
        const explicitAttrs = this.extractExplicitParameterAttributesWithTargetSpecifier(
          paramList,
          fullSignature,
          lines,
          lineIndex
        );

        attributes.push(...implicitAttrs, ...explicitAttrs);

        // Skip lines processed in the signature
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

  private static extractImplicitParameterAttributes(
    paramList: string,
    fullSignature: string,
    lines: string[],
    startLineIndex: number
  ): AttributeInfo[] {
    const attributes: AttributeInfo[] = [];
    
    // Normalize whitespace: replace newlines and multiple spaces with single space
    const normalizedParamList = paramList.replace(/\s+/g, ' ');
    
    // Regex to match: [AttributeName(args)] Type ParamName
    // Works with normalized (single-space) parameter list
    const regex =
      /\[\s*([A-Za-z_][A-Za-z0-9_\.]*)\s*(?:\(\s*([^)]*)\s*\))?\s*\]\s+([A-Za-z_][A-Za-z0-9_<>?\.]*)\s+([A-Za-z_][A-Za-z0-9_]*?)(?:\s*[,]|$)/g;

    let match;
    while ((match = regex.exec(normalizedParamList)) !== null) {
      const attributeName = match[1];
      const attributeArgs = match[2] || '';
      const paramType = match[3];
      const paramName = match[4];

      // Find the position in the original paramList for line number calculation
      const relativePos = paramList.indexOf('[' + attributeName);
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
        column: relativePos >= 0 ? relativePos : 0,
        targetElement: 'parameter',
        targetName: paramName,
        parameterType: paramType,
        parameterName: paramName
      });
    }

    return attributes;
  }

  private static extractExplicitParameterAttributesWithTargetSpecifier(
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
    for (let i = currentLineIndex + 1; i < Math.min(currentLineIndex + 15, lines.length); i++) {
      const line = lines[i].trim();

      // Skip empty lines and pragmas
      if (line === '' || line.startsWith('#pragma') || line.startsWith('#')) {
        continue;
      }

      // Skip additional attributes
      if (line.startsWith('[')) {
        continue;
      }

      // Class declaration
      if (line.match(/^(public\s+)?(partial\s+)?(abstract\s+)?(sealed\s+)?class\s+/)) {
        return 'class';
      }

      // Interface declaration
      if (line.match(/^(public\s+)?interface\s+/)) {
        return 'interface';
      }

      // Enum declaration
      if (line.match(/^(public\s+)?(partial\s+)?enum\s+/)) {
        return 'enum';
      }

      // Record struct or record class declaration
      if (line.match(/^(public\s+)?(partial\s+)?(readonly\s+)?(abstract\s+)?(sealed\s+)?record\s+(struct|class)\s+/)) {
        return 'recordStruct';
      }

      // Struct declaration (including readonly structs)
      if (line.match(/^(public\s+)?(partial\s+)?(readonly\s+)?struct\s+/)) {
        return 'struct';
      }

      // Delegate declaration
      if (line.match(/^(public\s+)?delegate\s+/)) {
        return 'delegate';
      }

      // Indexer - look for 'this[' pattern
      if (line.includes('this[') && line.includes(']')) {
        return 'property'; // Indexers are treated as properties for UI purposes
      }

      // Event - look for 'event' keyword
      if (line.includes(' event ')) {
        return 'event';
      }

      // Method - has parentheses for parameters
      // Pattern: (modifiers) return_type method_name (
      if (line.match(/^(public|private|protected|internal)\s+/) && 
          line.includes('(') &&
          !line.includes('class') && !line.includes('interface') && 
          !line.includes('struct') && !line.includes('delegate') &&
          !line.includes('enum')) {
        return 'method';
      }

      // Method without visibility modifier (interface methods, or methods without explicit visibility)
      // Pattern: return_type method_name ( ... )
      // Match anything that looks like: TypeName MethodName(
      if (line.match(/^\w+[\w<>?,\[\]?\s]*\s+[A-Za-z_][A-Za-z0-9_]*\s*\(/) &&
          !line.includes('class') && !line.includes('interface') && 
          !line.includes('struct') && !line.includes('delegate') &&
          !line.includes('enum') && !line.includes('get;') && !line.includes('set;')) {
        return 'method';
      }

      // Method with return type target [return: ...]
      // If the line before was [return: ...], this is likely a method
      if (i > currentLineIndex + 1) {
        const prevLine = lines[i - 1].trim();
        if (prevLine.includes('[return:') && line.includes('(')) {
          return 'method';
        }
      }

      // Property - has get/set or opening brace
      // Pattern: type name { get; set; } or { get; }
      if (line.match(/^(public|private|protected|internal)\s+/) &&
          (line.includes(' { ') || line.includes('{') || 
           line.includes('get;') || line.includes('set;') ||
           line.includes('get {') || line.includes('set {'))) {
        return 'property';
      }

      // Property without visibility modifier (e.g., in interface or auto-property)
      // Pattern: type name { ... }
      if (line.match(/^\w+[\w<>\[\],\s]*\s+\w+[\w_]*\s*\{/) && !line.includes('(')) {
        return 'property';
      }

      // Property where the opening brace is on the next line
      // Pattern: type name (without brace, just followed by end of line or whitespace)
      if (!line.includes('(') && !line.includes('{') && !line.includes(';')) {
        // Check if next line starts with a brace (property with brace on next line)
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine.startsWith('{')) {
            // Looks like a property with brace on next line
            if (line.match(/^(public|private|protected|internal)?\s*[\w<>\[\],\s]+?\s+\w+[\w_]*\s*$/)) {
              return 'property';
            }
          }
        }
      }

      // Field - has semicolon, no getter/setter
      if (line.match(/^(public|private|protected|internal)\s+/) &&
          line.includes(';') &&
          !line.includes('(') &&
          !line.includes('{')) {
        return 'field';
      }

      // Enum member - simple identifier optionally followed by = or ,
      // No access modifiers, no parentheses or braces
      if (!line.includes('(') && !line.includes('{') &&
          (line.match(/^[A-Za-z_][A-Za-z0-9_]*\s*[=,]/) ||
           line.match(/^[A-Za-z_][A-Za-z0-9_]*\s*$/))) {
        // Verify in an enum context by looking backwards
        let foundEnumDecl = false;
        let foundOpenBrace = false;
        for (let j = i - 1; j >= Math.max(i - 30, 0); j--) {
          const prevLine = lines[j].trim();
          // Check for opening brace of enum
          if (prevLine === '{' || prevLine.endsWith('{')) {
            foundOpenBrace = true;
          }
          // Check for enum declaration
          if (prevLine.match(/^(public\s+)?(partial\s+)?enum\s+/)) {
            foundEnumDecl = true;
            // If found the enum decl AND saw an opening brace after it, we're good
            if (foundOpenBrace) {
              return 'enumMember';
            }
            // Or if just found enum decl by itself (brace might be inline or right after)
            return 'enumMember';
          }
          // Stop if hit a closing brace or other structure end
          if (prevLine === '}' || prevLine.match(/^(class|interface|struct)\s+/)) {
            break;
          }
        }
      }

      // If declaration line that didn't match, stop
      if (line.includes('{') || line.includes(';')) {
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
    for (let i = currentLineIndex + 1; i < Math.min(currentLineIndex + 15, lines.length); i++) {
      const line = lines[i].trim();

      if (line === '') {
        continue;
      }

      // Skip attribute lines and pragmas (they start with '[' or '#')
      if (line.startsWith('[') || line.startsWith('#pragma') || line.startsWith('#')) {
        continue;
      }

      // Class/Interface/Struct/Enum/Delegate - extract the name
      const typeMatch = line.match(/^(public |private |protected |internal )?(partial |abstract |sealed )?(class|interface|struct|enum|delegate)\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (typeMatch) {
        return typeMatch[4]; // Return the type name
      }

      // Record struct or record class - extract the name
      const recordMatch = line.match(/^(public |private |protected |internal )?(partial |readonly |abstract |sealed )?record\s+(struct|class)\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (recordMatch) {
        return recordMatch[4]; // Return the record name
      }

      // Event - extract the name (handles generic types like EventHandler<EventArgs>)
      // Pattern: event Type EventName or event Type<Generic> EventName
      const eventMatch = line.match(/event\s+[\w<>,\s]+?\s+([A-Za-z_][A-Za-z0-9_]*)\s*[;={]/);
      if (eventMatch) {
        return eventMatch[1];
      }

      // Property/Field with explicit access modifier
      // Handles: generic types, nullable, arrays, with/without initialization
      // Pattern: modifier+ (optional static/readonly) type identifier (followed by { ; or =)
      const propMatch = line.match(/(?:public|private|protected|internal)\s+(?:static\s+)?(?:readonly\s+)?[\w<>?,\[\]\s]+?\s+([A-Za-z_][A-Za-z0-9_]*)\s*[\{;=]/);
      if (propMatch) {
        return propMatch[1];
      }

      // Property/Field without explicit access modifier (e.g., in interface)
      // Pattern: type name { ... } or type name;
      const implicitPropMatch = line.match(/^[\w<>?,\[\]\s]+?\s+([A-Za-z_][A-Za-z0-9_]*)\s*[\{;=]/);
      if (implicitPropMatch && !line.includes('(')) {
        return implicitPropMatch[1];
      }

      // Property where brace is on next line - extract name without requiring {
      // Pattern: (modifier)? type name (end of line)
      if (!line.includes('(') && !line.includes(';') && !line.includes('{')) {
        // Check if next line starts with a brace
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine.startsWith('{')) {
            // This looks like a property with brace on next line
            // Extract the property name (last identifier before end of line)
            const propNameMatch = line.match(/[\w<>?,\[\]\s]+?\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/);
            if (propNameMatch) {
              return propNameMatch[1];
            }
          }
        }
      }

      // Enum member - no access modifiers, just: Name or Name = value or Name,
      // Pattern: identifier followed by = or , or optional whitespace
      const enumMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(?:[=,]|$)/);
      if (enumMatch && !line.includes('(')) {
        // Verify if likely in an enum context by looking back
        let foundEnumDecl = false;
        let foundOpenBrace = false;
        for (let j = currentLineIndex; j >= Math.max(currentLineIndex - 30, 0); j--) {
          const prevLine = lines[j].trim();
          // Check for opening brace of enum
          if (prevLine === '{' || prevLine.endsWith('{')) {
            foundOpenBrace = true;
          }
          // Check for enum declaration
          if (prevLine.match(/^(public\s+)?(partial\s+)?enum\s+/)) {
            return enumMatch[1];
          }
          // Stop if hit a closing brace or other structure
          if (prevLine === '}' || prevLine.match(/^(class\s+|interface\s+|struct\s+)/)) {
            break;
          }
        }
      }

      // Method - extract the method name (look for identifier before opening paren)
      // Pattern: access_modifier return_type methodName (
      // Handles nullable types (?) and complex return types (arrays, generics)
      const methodMatch = line.match(/^(?:public|private|protected|internal)\s+(?:static\s+)?(?:async\s+)?[\w<>?,\[\]?\s]+?\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
      if (methodMatch) {
        return methodMatch[1];
      }

      // Method without visibility modifier (interface methods)
      // Pattern: return_type methodName (
      const implicitMethodMatch = line.match(/^[\w<>?,\[\]?\s]+?\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
      if (implicitMethodMatch && !line.includes('class') && !line.includes('interface') && 
          !line.includes('struct') && !line.includes('delegate') && !line.includes('enum')) {
        return implicitMethodMatch[1];
      }

      // Parameter - if [Validate(...)] type pattern, extract parameter name
      // Look for: type paramName or type paramName,
      const paramMatch = line.match(/^[\w<>?,\[\]\s]+?\s+([A-Za-z_][A-Za-z0-9_]*)\s*[,)]/);
      if (paramMatch && line.includes(',') && !line.includes('class') && !line.includes('interface')) {
        return paramMatch[1];
      }

      // Parameter in method signature (last parameter before closing paren)
      // Look for: type paramName within parentheses context
      if (line.includes(')') && !line.includes('{')) {
        const lastParamMatch = line.match(/^[\w<>?,\[\]?\s]+?\s+([A-Za-z_][A-Za-z0-9_]*)\s*\)/);
        if (lastParamMatch) {
          return lastParamMatch[1];
        }
      }

      // If declaration line found but name parsing did not work, stop searching
      if (line.includes('{') || (line.includes('(') && line.includes(')')) || line.includes(';')) {
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
      
      // Mark interface once opening brace appears
      if (braceCount > 0) {
        inInterface = true;
      }
      
      // Exit the interface when braces close
      if (inInterface && braceCount <= 0) {
        break;
      }
      
      // Skip lines before finding the opening brace
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
      // Pattern: optional modifiers + return type + name + optionally generics + either () or {}
      // The key is method names can be followed by generics < ... > before the opening paren
      const memberMatch = trimmed.match(/^(public\s+)?(async\s+)?([\w<>\[\],\?\s]+?)\s+([A-Za-z_][A-Za-z0-9_]*)([\w<>\[\]]*)\s*[({]/);
      
      if (memberMatch) {
        // Extract the signature, handling multiline method signatures
        let signature = trimmed;
        let currentLineIdx = i;
        
        // Find where the actual declaration ends
        const openParen = trimmed.indexOf('(');
        const openBrace = trimmed.indexOf('{');
        const semicolon = trimmed.indexOf(';');
        
        if (openParen !== -1) {
          // For methods, we need to find the closing paren (potentially on next lines)
          let closingParenIdx = trimmed.indexOf(')', openParen);
          
          // If no closing paren on this line, collect lines until we find it
          if (closingParenIdx === -1) {
            let signatureParts = [trimmed];
            let parenBalance = this.countParenBalance(trimmed);
            
            // Collect lines until parens are balanced
            while (parenBalance > 0 && currentLineIdx + 1 < lines.length) {
              currentLineIdx++;
              const nextLine = lines[currentLineIdx].trim();
              if (nextLine && !nextLine.startsWith('//')) {
                signatureParts.push(nextLine);
                parenBalance += this.countParenBalance(nextLine);
              }
            }
            
            // Assemble the full signature, removing excessive whitespace
            signature = signatureParts.join(' ').trim();
            
            // Find the end position (up to first ; or { after completing parens)
            let methodEndPos = signature.indexOf(';');
            if (methodEndPos === -1) {
              methodEndPos = signature.indexOf('{');
            }
            if (methodEndPos !== -1) {
              signature = signature.substring(0, methodEndPos).trim();
            }
          } else {
            // Closing paren is on the same line
            let methodEndPos = signature.indexOf(';', closingParenIdx);
            if (methodEndPos === -1) {
              methodEndPos = signature.indexOf('{', closingParenIdx);
            }
            if (methodEndPos !== -1) {
              signature = signature.substring(0, methodEndPos).trim();
            } else {
              signature = signature.substring(0, closingParenIdx + 1).trim();
            }
          }
        } else if (openBrace !== -1) {
          // For properties with getters/setters
          let propertyEndPos = signature.indexOf(';', openBrace);
          if (propertyEndPos === -1) {
            propertyEndPos = signature.length;
          }
          signature = signature.substring(0, propertyEndPos).trim();
        }
        
        // Only add if it's a valid signature and not a duplicate
        if (signature && !methodSignatures.some(m => m.signature === signature) && signature.length > 5) {
          methodSignatures.push({
            signature,
            line: i + 1
          });
        }
        
        // Skip the lines we just processed for multiline signatures
        if (currentLineIdx > i) {
          i = currentLineIdx;
        }
      } else {
        // Try to detect multiline signatures where the method name is on a different line
        // or where the return type has complex structure (like tuples in generics)
        // Pattern: might look like an incomplete return type or partial signature
        
        // Check if line likely contains a return type or method declaration start
        // This includes: lines with generics, lowercase return types (void, int, etc), or async keyword
        const looksLikeReturnType = trimmed.includes('<') || 
                                    trimmed.match(/^[a-z]+\s+/) ||  // void, int, string, etc.
                                    trimmed.match(/^[A-Z]\w+/) ||   // Task, List, etc.
                                    trimmed.match(/^async\s+/);
        
        if (looksLikeReturnType && !trimmed.includes(';') && !trimmed.includes('{') && 
            !trimmed.includes('class') && !trimmed.includes('interface') &&
            !trimmed.includes('enum') && !trimmed.includes('delegate')) {
          
          let signatureParts = [trimmed];
          let currentLineIdx = i;
          let foundMethodSignature = false;
          
          // Look ahead to find the method name and opening paren
          while (currentLineIdx + 1 < lines.length && signatureParts.length < 20) {
            currentLineIdx++;
            const nextLine = lines[currentLineIdx].trim();
            
            // Stop if we hit another member or end of interface
            if (nextLine.startsWith('}') || nextLine === '' && signatureParts.length > 5) {// TODO:Signature.length check is major dumb and must be replaced with something robust!
              break;
            }
            
            // Skip attributes - they indicate a new member
            if (nextLine.startsWith('[')) {
              break;
            }
            
            // Skip comments
            if (nextLine.startsWith('//')) {
              continue;
            }
            
            signatureParts.push(nextLine);
            
            // Check if this line has a method name followed by opening paren
            // Pattern: identifier followed by ( or )> or ) followed by more content
            if (nextLine.match(/[A-Za-z_][A-Za-z0-9_]*\s*\(/) && nextLine.includes('(')) {
              foundMethodSignature = true;
              
              // Now collect until we have balanced parens
              let parenBalance = this.countParenBalance(signatureParts.join(' '));
              
              while (parenBalance > 0 && currentLineIdx + 1 < lines.length) {
                currentLineIdx++;
                const continueLine = lines[currentLineIdx].trim();
                if (!continueLine.startsWith('//') && continueLine !== '' && !continueLine.startsWith('}')) {
                  signatureParts.push(continueLine);
                  parenBalance += this.countParenBalance(continueLine);
                } else if (continueLine === '') {
                  // Stop on empty line if parens are balanced elsewhere
                  break;
                }
              }
              
              break;
            }
          }
          
          if (foundMethodSignature) {
            // Assemble the signature
            let signature = signatureParts.join(' ').trim();
            
            // Find the end position (up to first ; or { after the opening paren)
            const openParen = signature.indexOf('(');
            if (openParen !== -1) {
              let methodEndPos = signature.indexOf(';', openParen);
              if (methodEndPos === -1) {
                methodEndPos = signature.indexOf('{', openParen);
              }
              if (methodEndPos !== -1) {
                signature = signature.substring(0, methodEndPos).trim();
              } else {
                // Try to find the closing paren
                const closingParen = signature.lastIndexOf(')');
                if (closingParen !== -1) {
                  signature = signature.substring(0, closingParen + 1).trim();
                }
              }
            }
            
            // Only add if it's a valid signature and not a duplicate
            if (signature && !methodSignatures.some(m => m.signature === signature) && signature.length > 5 && 
                signature.includes('(') && signature.includes(')')) {
              methodSignatures.push({
                signature,
                line: i + 1
              });
            }
            
            // Skip the lines we processed
            if (currentLineIdx > i) {
              i = currentLineIdx;
            }
          }
        }
      }
    }
    
    return methodSignatures;
  }
}
