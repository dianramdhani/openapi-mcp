import { readFileSync } from 'fs';
import {
  OpenAPISpec,
  TagInfo,
  PathMatch,
  OperationObject,
  SchemaObject,
} from './types.js';

export class OpenAPIParser {
  private spec: OpenAPISpec;
  private baseUrl: string;

  constructor(specPath: string) {
    const content = readFileSync(specPath, 'utf-8');
    this.spec = JSON.parse(content);
    this.baseUrl = this.spec.servers?.[0]?.url || '';
  }

  getSpec(): OpenAPISpec {
    return this.spec;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Get all unique tags with their endpoint counts
   */
  getAllTags(): TagInfo[] {
    const tagMap = new Map<string, { count: number; operationIds: string[] }>();

    for (const [path, pathItem] of Object.entries(this.spec.paths)) {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'] as const;
      
      for (const method of methods) {
        const operation = pathItem[method] as OperationObject | undefined;
        if (operation?.tags) {
          for (const tag of operation.tags) {
            if (!tagMap.has(tag)) {
              tagMap.set(tag, { count: 0, operationIds: [] });
            }
            const tagInfo = tagMap.get(tag)!;
            tagInfo.count++;
            if (operation.operationId) {
              tagInfo.operationIds.push(operation.operationId);
            }
          }
        }
      }
    }

    return Array.from(tagMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Find tags by path pattern
   */
  findTagsByPath(pathQuery: string): PathMatch[] {
    const results: PathMatch[] = [];
    const normalizedQuery = pathQuery.toLowerCase();

    for (const [path, pathItem] of Object.entries(this.spec.paths)) {
      if (!path.toLowerCase().includes(normalizedQuery)) {
        continue;
      }

      const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'] as const;
      
      for (const method of methods) {
        const operation = pathItem[method] as OperationObject | undefined;
        if (operation) {
          const tags = operation.tags || ['untagged'];
          for (const tag of tags) {
            results.push({
              path,
              method,
              tag,
              operationId: operation.operationId,
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Get operations by tag
   */
  getOperationsByTag(tagName: string): Array<{ path: string; method: string; operation: OperationObject }> {
    const results: Array<{ path: string; method: string; operation: OperationObject }> = [];

    for (const [path, pathItem] of Object.entries(this.spec.paths)) {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'] as const;
      
      for (const method of methods) {
        const operation = pathItem[method] as OperationObject | undefined;
        if (operation?.tags?.includes(tagName)) {
          results.push({ path, method, operation });
        }
      }
    }

    return results;
  }

  /**
   * Get all schemas from components
   */
  getAllSchemas(): Record<string, SchemaObject> {
    return this.spec.components?.schemas || {};
  }

  /**
   * Get schema by name, resolving $ref if needed
   */
  getSchema(schemaName: string): SchemaObject | undefined {
    const schemas = this.getAllSchemas();
    return schemas[schemaName];
  }

  /**
   * Resolve $ref to schema
   */
  resolveRef(ref: string): SchemaObject | undefined {
    // Handle local refs like #/components/schemas/SchemaName
    if (ref.startsWith('#/components/schemas/')) {
      const schemaName = ref.split('/').pop()!;
      return this.getSchema(schemaName);
    }
    return undefined;
  }

  /**
   * Get all schema names that are used by a specific tag
   */
  getSchemaNamesByTag(tagName: string): Set<string> {
    const schemaNames = new Set<string>();
    const operations = this.getOperationsByTag(tagName);

    const collectSchemaRefs = (schema: SchemaObject) => {
      if (schema.$ref) {
        const schemaName = schema.$ref.split('/').pop()!;
        schemaNames.add(schemaName);
      }
      if (schema.properties) {
        for (const prop of Object.values(schema.properties)) {
          collectSchemaRefs(prop);
        }
      }
      if (schema.items) {
        collectSchemaRefs(schema.items);
      }
    };

    for (const { operation } of operations) {
      // Collect from parameters
      if (operation.parameters) {
        for (const param of operation.parameters) {
          if (param.schema) {
            collectSchemaRefs(param.schema);
          }
        }
      }

      // Collect from requestBody
      if (operation.requestBody?.content) {
        for (const mediaType of Object.values(operation.requestBody.content)) {
          if (mediaType.schema) {
            collectSchemaRefs(mediaType.schema);
          }
        }
      }

      // Collect from responses
      for (const response of Object.values(operation.responses)) {
        if (response.content) {
          for (const mediaType of Object.values(response.content)) {
            if (mediaType.schema) {
              collectSchemaRefs(mediaType.schema);
            }
          }
        }
      }
    }

    // Recursively find all dependent schemas
    const allSchemas = this.getAllSchemas();
    const visited = new Set<string>();
    
    const collectDependencies = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);
      
      const schema = allSchemas[name];
      if (!schema) return;

      const collectRefs = (s: SchemaObject) => {
        if (s.$ref) {
          const refName = s.$ref.split('/').pop()!;
          if (!visited.has(refName)) {
            schemaNames.add(refName);
            collectDependencies(refName);
          }
        }
        if (s.properties) {
          for (const prop of Object.values(s.properties)) {
            collectRefs(prop);
          }
        }
        if (s.items) {
          collectRefs(s.items);
        }
      };

      collectRefs(schema);
    };

    for (const name of schemaNames) {
      collectDependencies(name);
    }

    return schemaNames;
  }
}
