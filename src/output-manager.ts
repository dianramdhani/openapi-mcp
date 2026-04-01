import { existsSync, mkdirSync, readdirSync,readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

export interface OpenApiMcpConfig {
  typesOutputDir: string;
  servicesOutputDir: string;
  mocksOutputDir?: string;
}

export interface DuplicateTypeInfo {
  typeName: string;
  files: string[];
  resolvedFile: string;
}

export class OutputManager {
  private config: OpenApiMcpConfig | null;
  private configDir: string; // Directory where config file is located
  private definedTypes = new Map<string, string>(); // typeName -> featureName where it's defined
  private duplicates: DuplicateTypeInfo[] = [];
  private neededImports = new Map<string, string[]>(); // featureName -> [types needed from other files]

  constructor(configPath: string) {
    // Check if config file exists
    if (existsSync(configPath)) {
      const configContent = readFileSync(configPath, 'utf-8');
      this.config = JSON.parse(configContent);
      // Resolve all paths relative to config file directory
      this.configDir = dirname(configPath);

      // Convert relative paths to absolute paths based on config directory
      if (this.config && !this.config.typesOutputDir.startsWith('/')) {
        this.config.typesOutputDir = resolve(this.configDir, this.config.typesOutputDir);
      }
      if (this.config && !this.config.servicesOutputDir.startsWith('/')) {
        this.config.servicesOutputDir = resolve(this.configDir, this.config.servicesOutputDir);
      }
      if (this.config && this.config.mocksOutputDir && !this.config.mocksOutputDir.startsWith('/')) {
        this.config.mocksOutputDir = resolve(this.configDir, this.config.mocksOutputDir);
      }
    } else {
      // No config file - use feature-based structure (types/ and services/ in current dir)
      this.config = null;
      this.configDir = process.cwd();
    }
  }

  /**
   * Seed the type registry from existing generated type files on disk.
   * This lets subsequent sync runs detect duplicates against prior output.
   */
  seedExistingTypesFromDir(typesDir: string): void {
    if (!existsSync(typesDir)) {
      return;
    }

    for (const file of this.listGeneratedFiles(typesDir, '.types.ts', {
      exclude: ['index.ts'],
    })) {
      const filePath = resolve(typesDir, file);
      const content = readFileSync(filePath, 'utf-8');
      const featureName = file.replace('.types.ts', '');

      for (const { name } of this.parseTypeDefinitions(content)) {
        if (!this.definedTypes.has(name)) {
          this.definedTypes.set(name, featureName);
        }
      }
    }
  }

  /**
   * List generated files in a directory, optionally filtering by suffix and exclusions.
   */
  listGeneratedFiles(
    dirPath: string,
    suffix?: string,
    options?: { exclude?: string[] }
  ): string[] {
    if (!existsSync(dirPath)) {
      return [];
    }

    const excluded = new Set(options?.exclude ?? []);

    return readdirSync(dirPath)
      .filter((file) => !excluded.has(file))
      .filter((file) => (suffix ? file.endsWith(suffix) : true))
      .sort();
  }

  getConfig(): OpenApiMcpConfig | null {
    return this.config;
  }

  /**
   * Get output directory for types
   * If no config, returns default types/ directory
   */
  getTypesOutputDir(): string {
    if (this.config) {
      return this.config.typesOutputDir;
    }
    return resolve(this.configDir, 'types');
  }

  /**
   * Get output directory for services
   * If no config, returns default services/ directory
   */
  getServicesOutputDir(): string {
    if (this.config) {
      return this.config.servicesOutputDir;
    }
    return resolve(this.configDir, 'services');
  }

  /**
   * Get output directory for mocks
   * If no config, returns default mocks/ directory
   */
  getMocksOutputDir(): string {
    if (this.config && this.config.mocksOutputDir) {
      return this.config.mocksOutputDir;
    }
    return resolve(this.configDir, 'mocks');
  }

  /**
   * Register types from a file and remove duplicates
   * Returns deduplicated types content with imports for duplicate types
   */
  registerTypes(featureName: string, typesContent: string): string {
    // Parse all type definitions from content
    const typeDefs = this.parseTypeDefinitions(typesContent);
    
    const outputTypes: string[] = [];
    const typesNeededFromOthers: string[] = [];
    const typesDefinedHere: string[] = [];
    
    for (const { name, fullDefinition } of typeDefs) {
      if (this.definedTypes.has(name)) {
        // Duplicate found
        const existingFile = this.definedTypes.get(name)!;
        if (existingFile !== featureName) {
          // Track duplicate
          const existingDup = this.duplicates.find(d => d.typeName === name);
          if (!existingDup) {
            this.duplicates.push({
              typeName: name,
              files: [existingFile, featureName],
              resolvedFile: existingFile,
            });
          } else if (!existingDup.files.includes(featureName)) {
            existingDup.files.push(featureName);
          }
          // This type is needed from another file
          typesNeededFromOthers.push(name);
          // Skip this duplicate - don't add to output
          continue;
        }
      } else {
        // New type - register it
        this.definedTypes.set(name, featureName);
        typesDefinedHere.push(name);
      }
      
      // Add to output
      outputTypes.push(fullDefinition);
    }
    
    let result = outputTypes.join('\n\n');

    // Add import for needed types (from files processed earlier)
    if (typesNeededFromOthers.length > 0) {
      const importSource = this.duplicates.find(d => d.typeName === typesNeededFromOthers[0])?.resolvedFile;
      if (importSource) {
        const importStatement = `import type { ${typesNeededFromOthers.join(', ')} } from './${importSource}.types';`;
        result = `${importStatement}\n\n${result}`;
      }
    }

    return result;
  }

  /**
   * Parse type definitions from content
   * Returns array of { name, fullDefinition }
   */
  private parseTypeDefinitions(content: string): Array<{ name: string; fullDefinition: string }> {
    const typeDefs: Array<{ name: string; fullDefinition: string }> = [];
    
    // Match export type declarations (including multi-line)
    const typeRegex = /export type (\w+)\s*=\s*(?:\{[^}]*\}|[^;]+);/gs;
    let match: RegExpExecArray | null;
    
    while ((match = typeRegex.exec(content)) !== null) {
      typeDefs.push({
        name: match[1],
        fullDefinition: match[0].trim(),
      });
    }
    
    return typeDefs;
  }

  /**
   * Write file to disk
   */
  writeFile(filePath: string, content: string): void {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content + '\n');
  }

  /**
   * Merge generated mock handlers with an existing mock file.
   * Existing handler bodies win when the route already exists, while new fields
   * from the generated payload are filled in to keep the mock aligned with the spec.
   */
  mergeMockFile(filePath: string, generatedContent: string): string {
    if (!existsSync(filePath)) {
      return generatedContent;
    }

    const existingContent = readFileSync(filePath, 'utf-8');
    const existingParts = this.splitMockFile(existingContent);
    const generatedParts = this.splitMockFile(generatedContent);

    if (!existingParts || !generatedParts) {
      return generatedContent;
    }

    const existingHandlers = this.splitTopLevelArrayItems(existingParts.arrayContent);
    const generatedHandlers = this.splitTopLevelArrayItems(generatedParts.arrayContent);

    if (generatedHandlers.length === 0) {
      return generatedContent;
    }

    const existingBySignature = new Map<string, string>();
    for (const handler of existingHandlers) {
      const signature = this.getHandlerSignature(handler);
      if (signature) {
        existingBySignature.set(signature, handler);
      }
    }

    const usedExisting = new Set<string>();
    const mergedHandlers = generatedHandlers.map((generatedHandler) => {
      const signature = this.getHandlerSignature(generatedHandler);
      if (!signature) {
        return generatedHandler;
      }

      const existingHandler = existingBySignature.get(signature);
      if (!existingHandler) {
        return generatedHandler;
      }

      usedExisting.add(signature);
      return this.mergeMockHandler(existingHandler, generatedHandler);
    });

    for (const handler of existingHandlers) {
      const signature = this.getHandlerSignature(handler);
      if (signature && !usedExisting.has(signature)) {
        mergedHandlers.push(handler);
      }
    }

    const mergedArray = mergedHandlers.map((handler) => this.indentBlock(handler)).join(',\n\n');
    return `${generatedParts.beforeArray}\n${mergedArray}\n${generatedParts.afterArray}`;
  }

  /**
   * Generate index.ts for types directory
   */
  generateTypesIndex(files: string[]): string {
    const exports = files
      .map((file) => {
        const basename = file.replace('.types.ts', '');
        return `export * from './${basename}.types';`;
      })
      .join('\n');

    return `// Auto-generated types index\n${exports}\n`;
  }

  /**
   * Generate index.ts for services directory
   */
  generateServicesIndex(files: string[]): string {
    const exports = files
      .map((file) => {
        const basename = file.replace('.services.ts', '');
        return `export * from './${basename}.services';`;
      })
      .join('\n');

    return `// Auto-generated services index\n${exports}\n`;
  }

  /**
   * Generate index.ts for mocks/handlers directory
   */
  generateMocksIndex(files: string[]): string {
    const imports = files
      .map((file) => {
        const basename = file.replace('.ts', '');
        const varName = basename + 'Handlers';
        return `import { ${varName} } from './${basename}';`;
      })
      .join('\n');

    const combined = files
      .map((file) => {
        const basename = file.replace('.ts', '');
        return `...${basename}Handlers`;
      })
      .join(',\n  ');

    return `// Auto-generated mocks index
${imports}

export const handlers = [
  ${combined}
];
`;
  }

  /**
   * Get duplicate types report
   */
  getDuplicatesReport(): string {
    if (this.duplicates.length === 0) {
      return 'No duplicate types found.';
    }

    let report = `Found ${this.duplicates.length} duplicate type(s):\n\n`;
    for (const dup of this.duplicates) {
      report += `  - ${dup.typeName}\n`;
      report += `    ✓ Kept in: ${dup.resolvedFile}\n`;
      report += `    ✗ Removed from: ${dup.files.filter(f => f !== dup.resolvedFile).join(', ')}\n`;
    }
    return report;
  }

  /**
   * Generate common.types.ts for shared types
   */
  generateCommonTypes(): string | null {
    if (this.duplicates.length === 0) {
      return null;
    }

    const commonTypes: string[] = [];

    for (const dup of this.duplicates) {
      // The type is already defined in the source file, we just need to re-export it
      commonTypes.push(dup.typeName);
    }

    if (commonTypes.length === 0) {
      return null;
    }

    // Create re-exports from the first file that defines them
    const firstSource = this.duplicates[0].resolvedFile;
    const exports = commonTypes
      .map((type) => `export type { ${type} } from './${firstSource}.types';`)
      .join('\n');

    return `// Auto-generated common types\n// These types are shared across multiple features\n\n${exports}\n`;
  }

  /**
   * Add imports for types that are referenced but not defined in this file
   */
  addMissingImports(featureName: string, content: string): string {
    // Find all type references in the content (types that are used but not defined here)
    const definedTypesInFile = new Set<string>();
    const typeRegex = /export type (\w+)/g;
    let match: RegExpExecArray | null;
    
    while ((match = typeRegex.exec(content)) !== null) {
      definedTypesInFile.add(match[1]);
    }
    
    // Find all type references (used in other type definitions)
    const referencedTypes = new Set<string>();
    const refRegex = /:\s*(\w+)(?:\[\]|<[^>]*>)?(?:;|\n)/g;
    while ((match = refRegex.exec(content)) !== null) {
      const typeName = match[1];
      // Skip primitive types
      if (!['string', 'number', 'boolean', 'unknown', 'void', 'any', 'Array', 'Record'].includes(typeName)) {
        referencedTypes.add(typeName);
      }
    }
    
    // Find types that are referenced but not defined here
    const missingTypes: string[] = [];
    for (const refType of referencedTypes) {
      if (!definedTypesInFile.has(refType) && this.definedTypes.has(refType)) {
        const definedIn = this.definedTypes.get(refType);
        if (definedIn !== featureName) {
          missingTypes.push(refType);
        }
      }
    }
    
    if (missingTypes.length === 0) {
      return content;
    }
    
    // Group missing types by source file
    const typesBySource = new Map<string, string[]>();
    for (const typeName of missingTypes) {
      const source = this.definedTypes.get(typeName)!;
      if (!typesBySource.has(source)) {
        typesBySource.set(source, []);
      }
      typesBySource.get(source)!.push(typeName);
    }
    
    // Add imports
    let result = content;
    for (const [source, types] of typesBySource.entries()) {
      const importStatement = `import type { ${types.join(', ')} } from './${source}.types';`;
      result = `${importStatement}\n${result}`;
    }
    
    return result;
  }

  /**
   * Get all defined types
   */
  getAllDefinedTypes(): Map<string, string> {
    return this.definedTypes;
  }

  private splitMockFile(content: string): { beforeArray: string; arrayContent: string; afterArray: string } | null {
    const exportMatch = content.match(/export const \w+ = \[/s);
    if (!exportMatch || exportMatch.index === undefined) {
      return null;
    }

    const arrayStart = content.indexOf('[', exportMatch.index);
    const arrayEnd = content.lastIndexOf('];');
    if (arrayStart === -1 || arrayEnd === -1 || arrayEnd < arrayStart) {
      return null;
    }

    return {
      beforeArray: content.slice(0, arrayStart + 1),
      arrayContent: content.slice(arrayStart + 1, arrayEnd),
      afterArray: content.slice(arrayEnd),
    };
  }

  private splitTopLevelArrayItems(content: string): string[] {
    const items: string[] = [];
    let start = 0;
    let parenDepth = 0;
    let braceDepth = 0;
    let bracketDepth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inTemplate = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < content.length; i += 1) {
      const char = content[i];
      const next = content[i + 1];

      if (inLineComment) {
        if (char === '\n') {
          inLineComment = false;
        }
        continue;
      }

      if (inBlockComment) {
        if (char === '*' && next === '/') {
          inBlockComment = false;
          i += 1;
        }
        continue;
      }

      if (inSingleQuote) {
        if (char === '\\') {
          i += 1;
        } else if (char === '\'') {
          inSingleQuote = false;
        }
        continue;
      }

      if (inDoubleQuote) {
        if (char === '\\') {
          i += 1;
        } else if (char === '"') {
          inDoubleQuote = false;
        }
        continue;
      }

      if (inTemplate) {
        if (char === '\\') {
          i += 1;
        } else if (char === '`') {
          inTemplate = false;
        }
        continue;
      }

      if (char === '/' && next === '/') {
        inLineComment = true;
        i += 1;
        continue;
      }

      if (char === '/' && next === '*') {
        inBlockComment = true;
        i += 1;
        continue;
      }

      if (char === '\'') {
        inSingleQuote = true;
        continue;
      }

      if (char === '"') {
        inDoubleQuote = true;
        continue;
      }

      if (char === '`') {
        inTemplate = true;
        continue;
      }

      if (char === '(') {
        parenDepth += 1;
      } else if (char === ')') {
        parenDepth = Math.max(0, parenDepth - 1);
      } else if (char === '{') {
        braceDepth += 1;
      } else if (char === '}') {
        braceDepth = Math.max(0, braceDepth - 1);
      } else if (char === '[') {
        bracketDepth += 1;
      } else if (char === ']') {
        bracketDepth = Math.max(0, bracketDepth - 1);
      }

      if (char === ',' && parenDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
        const item = content.slice(start, i).replace(/^\n+|\n+$/g, '');
        if (item) {
          items.push(item);
        }
        start = i + 1;
      }
    }

    const lastItem = content.slice(start).replace(/^\n+|\n+$/g, '');
    if (lastItem) {
      items.push(lastItem);
    }

    return items;
  }

  private getHandlerSignature(handler: string): string | null {
    const match = handler.match(/http\.(get|post|put|patch|delete|options|head|trace)\s*\(\s*(['"])(.*?)\2/s);
    if (!match) {
      return null;
    }

    return `${match[1].toLowerCase()} ${match[3]}`;
  }

  private mergeMockHandler(existingHandler: string, generatedHandler: string): string {
    const existingPayload = this.extractHttpResponsePayload(existingHandler);
    const generatedPayload = this.extractHttpResponsePayload(generatedHandler);

    if (existingPayload === null || generatedPayload === null) {
      return existingHandler;
    }

    const mergedPayload = this.deepMergeMockPayload(existingPayload, generatedPayload);
    return this.replaceHttpResponsePayload(generatedHandler, mergedPayload);
  }

  private extractHttpResponsePayload(handler: string): unknown | null {
    const responseStart = handler.indexOf('HttpResponse.json(');
    if (responseStart === -1) {
      return null;
    }

    const openParenIndex = handler.indexOf('(', responseStart);
    const closeParenIndex = this.findMatchingParen(handler, openParenIndex);
    if (openParenIndex === -1 || closeParenIndex === -1) {
      return null;
    }

    const payloadText = handler.slice(openParenIndex + 1, closeParenIndex).trim();
    if (!payloadText) {
      return null;
    }

    return this.parseMockPayloadLiteral(payloadText);
  }

  private parseMockPayloadLiteral(payloadText: string): unknown | null {
    try {
      return JSON.parse(payloadText);
    } catch {
      try {
        return new Function(`return (${payloadText});`)();
      } catch {
        return null;
      }
    }
  }

  private replaceHttpResponsePayload(handler: string, payload: unknown): string {
    const responseStart = handler.indexOf('HttpResponse.json(');
    if (responseStart === -1) {
      return handler;
    }

    const openParenIndex = handler.indexOf('(', responseStart);
    const closeParenIndex = this.findMatchingParen(handler, openParenIndex);
    if (openParenIndex === -1 || closeParenIndex === -1) {
      return handler;
    }

    const payloadText = JSON.stringify(payload, null, 4).replace(/\n/g, '\n    ');
    return `${handler.slice(0, openParenIndex + 1)}${payloadText}${handler.slice(closeParenIndex)}`;
  }

  private deepMergeMockPayload(existingPayload: unknown, generatedPayload: unknown): unknown {
    if (Array.isArray(existingPayload) && Array.isArray(generatedPayload)) {
      const merged = [...existingPayload];
      generatedPayload.forEach((item, index) => {
        if (index in merged) {
          merged[index] = this.deepMergeMockPayload(merged[index], item);
        } else {
          merged.push(item);
        }
      });
      return merged;
    }

    if (this.isPlainObject(existingPayload) && this.isPlainObject(generatedPayload)) {
      const merged: Record<string, unknown> = { ...generatedPayload };
      for (const [key, value] of Object.entries(existingPayload)) {
        if (key in merged) {
          merged[key] = this.deepMergeMockPayload(value, merged[key]);
        } else {
          merged[key] = value;
        }
      }
      return merged;
    }

    return existingPayload;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private indentBlock(content: string, indent = '  '): string {
    const lines = content.split('\n');
    while (lines.length > 0 && lines[0].trim().length === 0) {
      lines.shift();
    }
    while (lines.length > 0 && lines[lines.length - 1].trim().length === 0) {
      lines.pop();
    }

    const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
    const minIndent = nonEmptyLines.length === 0
      ? 0
      : Math.min(
          ...nonEmptyLines.map((line) => {
            const match = line.match(/^[ \t]*/);
            return match ? match[0].length : 0;
          })
        );

    return lines
      .map((line) => {
        if (line.trim().length === 0) {
          return line;
        }
        return `${indent}${line.slice(minIndent)}`;
      })
      .join('\n');
  }

  private findMatchingParen(content: string, openIndex: number): number {
    if (openIndex < 0 || content[openIndex] !== '(') {
      return -1;
    }

    let depth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inTemplate = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = openIndex; i < content.length; i += 1) {
      const char = content[i];
      const next = content[i + 1];

      if (inLineComment) {
        if (char === '\n') {
          inLineComment = false;
        }
        continue;
      }

      if (inBlockComment) {
        if (char === '*' && next === '/') {
          inBlockComment = false;
          i += 1;
        }
        continue;
      }

      if (inSingleQuote) {
        if (char === '\\') {
          i += 1;
        } else if (char === '\'') {
          inSingleQuote = false;
        }
        continue;
      }

      if (inDoubleQuote) {
        if (char === '\\') {
          i += 1;
        } else if (char === '"') {
          inDoubleQuote = false;
        }
        continue;
      }

      if (inTemplate) {
        if (char === '\\') {
          i += 1;
        } else if (char === '`') {
          inTemplate = false;
        }
        continue;
      }

      if (char === '/' && next === '/') {
        inLineComment = true;
        i += 1;
        continue;
      }

      if (char === '/' && next === '*') {
        inBlockComment = true;
        i += 1;
        continue;
      }

      if (char === '\'') {
        inSingleQuote = true;
        continue;
      }

      if (char === '"') {
        inDoubleQuote = true;
        continue;
      }

      if (char === '`') {
        inTemplate = true;
        continue;
      }

      if (char === '(') {
        depth += 1;
      } else if (char === ')') {
        depth -= 1;
        if (depth === 0) {
          return i;
        }
      }
    }

    return -1;
  }
}
