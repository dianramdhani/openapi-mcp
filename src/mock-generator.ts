import { OpenAPISpec,OperationObject, SchemaObject } from './types.js';

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
    const response200 = operation.responses['200'] || operation.responses[200];
    const response201 = operation.responses['201'] || operation.responses[201];
    const response204 = operation.responses['204'] || operation.responses[204];
    const responseDefault = operation.responses['default'];
    const response = response200 || response201 || response204 || responseDefault;
    
    const summary = operation.summary || operation.operationId;
    
    // Determine the status code from the response definition (default to 200 if not clear)
    let statusCode = 200;
    if (response201) statusCode = 201;
    if (response204) statusCode = 204;

    // Cases with strictly no content
    if (statusCode === 204 || (response && !response.content)) {
      return `  // ${summary}
  http.${method.toLowerCase()}('${fullPath}', () => {
    return new HttpResponse(null, { status: ${statusCode} });
  })`;
    }

    let mockData: any = {};
    
    if (response?.content) {
      const mediaType = response.content['application/json'] || response.content['*/*'] || Object.values(response.content)[0];
      if (mediaType) {
        if (mediaType.example !== undefined) {
          mockData = mediaType.example;
        } else if (mediaType.examples && Object.keys(mediaType.examples).length > 0) {
          const firstExample = Object.values(mediaType.examples)[0] as any;
          mockData = firstExample.value !== undefined ? firstExample.value : firstExample;
        } else if (mediaType.schema) {
          mockData = this.generateMockValue(mediaType.schema);
        }
      }
    }

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

    // Use example or default if available
    if (schema.example !== undefined) return schema.example;
    if (schema.default !== undefined) return schema.default;

    if (schema.enum && schema.enum.length > 0) {
      return schema.enum[0];
    }

    // Handle allOf (merged properties)
    if (schema.allOf && schema.allOf.length > 0) {
        const combined: any = {};
        for (const s of schema.allOf) {
            const val = this.generateMockValue(s, depth + 1);
            if (typeof val === 'object' && val !== null) Object.assign(combined, val);
        }
        return combined;
    }

    // Handle oneOf/anyOf (pick first)
    if (schema.oneOf && schema.oneOf.length > 0) return this.generateMockValue(schema.oneOf[0], depth + 1);
    if (schema.anyOf && schema.anyOf.length > 0) return this.generateMockValue(schema.anyOf[0], depth + 1);

    switch (schema.type) {
      case 'string':
        if (schema.format === 'date-time') return new Date().toISOString();
        if (schema.format === 'date') return new Date().toISOString().split('T')[0];
        if (schema.format === 'email') return 'user@example.com';
        if (schema.format === 'uuid') return '00000000-0000-0000-0000-000000000000';
        return 'mock-string';
      case 'number':
      case 'integer':
        return 123;
      case 'boolean':
        return true;
      case 'array':
        return [this.generateMockValue(schema.items || {}, depth + 1)];
      case 'object':
      default:
        // Try to handle as object even if type is missing but properties exist
        if (schema.properties || schema.additionalProperties || schema.type === 'object') {
          const obj: any = {};
          if (schema.properties) {
            for (const [propName, propSchema] of Object.entries(schema.properties)) {
              obj[propName] = this.generateMockValue(propSchema, depth + 1);
            }
          }
          // If no properties but additionalProperties exist, add one sample entry
          if (Object.keys(obj).length === 0 && schema.additionalProperties) {
            const propSchema = typeof schema.additionalProperties === 'boolean' ? {} : schema.additionalProperties;
            obj['exampleKey'] = this.generateMockValue(propSchema, depth + 1);
          }
          return obj;
        }
        return {};
    }
  }
}
