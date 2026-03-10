import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { dirname, resolve, join } from 'path';

export interface OpenApiMcpConfig {
  typesOutputDir: string;
  servicesOutputDir: string;
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
    } else {
      // No config file - use feature-based structure (types/ and services/ in current dir)
      this.config = null;
      this.configDir = process.cwd();
    }
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
      // Get the type definition from the source file
      const sourceFeature = dup.resolvedFile;
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
}
