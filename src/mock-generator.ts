import { OperationObject, SchemaObject, OpenAPISpec } from './types.js';

export class MockGenerator {
  private spec: OpenAPISpec;

  constructor(spec: OpenAPISpec) {
    this.spec = spec;
  }

  private tagToFeatureName(tagName: string): string {
    // Remove '-controller' suffix and convert to lowercase
    const cleanName = tagName.replace(/-controller$/i, '');
    return cleanName.toLowerCase();
  }

  /**
   * Convert tag name to camelCase for handler array name
   * e.g., 'reporting-controller' -> 'reportingHandlers'
   */
  private tagToHandlersName(tagName: string): string {
    const cleanName = tagName.replace(/-controller$/i, '');
    const parts = cleanName.split('-');
    const camelCase = parts[0] + parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    return `${camelCase}Handlers`;
  }

  generateMockHandlers(
    tagName: string,
    operations: Array<{ path: string; method: string; operation: OperationObject }>
  ): string {
    const handlers: string[] = [];

    for (const { path, method, operation } of operations) {
      if (!operation.operationId) continue;
      handlers.push(this.generateHandler(path, method, operation));
    }

    const handlersName = this.tagToHandlersName(tagName);

    return `/* eslint-disable @typescript-eslint/no-explicit-any */
import { http, HttpResponse } from 'msw';

export const ${handlersName} = [
${handlers.join(',\n\n')}
];
`;
  }

  private generateHandler(
    path: string,
    method: string,
    operation: OperationObject
  ): string {
    // Convert OpenAPI path {id} to MSW :id
    const mswPath = path.replace(/{([^}]+)}/g, ':$1');
    const fullPath = `*/${mswPath.startsWith('/') ? mswPath.slice(1) : mswPath}`;
    
    // Get response schema for 200 or 201
    const response200 = operation.responses['200'];
    const response201 = operation.responses['201'];
    const response = response200 || response201;
    
    let mockData: any = { message: 'Success' };
    
    if (response?.content?.['application/json']?.schema) {
      mockData = this.generateMockValue(response.content['application/json'].schema);
    } else if (response?.content?.['*/*']?.schema) {
      mockData = this.generateMockValue(response.content['*/*'].schema);
    }

    const summary = operation.summary || operation.operationId;
    
    return `  // ${summary}
  http.${method.toLowerCase()}('${fullPath}', () => {
    return HttpResponse.json(${JSON.stringify(mockData, null, 4).replace(/\n/g, '\n    ')});
  })`;
  }

  private resolveRef(ref: string): SchemaObject | undefined {
    if (ref.startsWith('#/components/schemas/')) {
      const schemaName = ref.split('/').pop()!;
      return this.spec.components?.schemas?.[schemaName];
    }
    return undefined;
  }

  private generateMockValue(schema: SchemaObject, depth: number = 0): any {
    // Avoid infinite recursion
    if (depth > 5) return {};

    if (schema.$ref) {
      const resolved = this.resolveRef(schema.$ref);
      return resolved ? this.generateMockValue(resolved, depth + 1) : {};
    }

    if (schema.enum && schema.enum.length > 0) {
      return schema.enum[0];
    }

    switch (schema.type) {
      case 'string':
        if (schema.format === 'date-time') return new Date().toISOString();
        if (schema.format === 'date') return new Date().toISOString().split('T')[0];
        return 'mock-string';
      case 'number':
      case 'integer':
        return 123;
      case 'boolean':
        return true;
      case 'array':
        return [this.generateMockValue(schema.items || {}, depth + 1)];
      case 'object':
        const obj: any = {};
        if (schema.properties) {
          for (const [propName, propSchema] of Object.entries(schema.properties)) {
            obj[propName] = this.generateMockValue(propSchema, depth + 1);
          }
        }
        return obj;
      default:
        // Try to handle oneOf, anyOf, allOf if needed
        if (schema.oneOf && schema.oneOf.length > 0) return this.generateMockValue(schema.oneOf[0], depth + 1);
        if (schema.anyOf && schema.anyOf.length > 0) return this.generateMockValue(schema.anyOf[0], depth + 1);
        if (schema.allOf && schema.allOf.length > 0) {
            const combined: any = {};
            for (const s of schema.allOf) {
                const val = this.generateMockValue(s, depth + 1);
                if (typeof val === 'object') Object.assign(combined, val);
            }
            return combined;
        }
        return {};
    }
  }
}
