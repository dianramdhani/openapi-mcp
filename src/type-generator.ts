import { SchemaObject, OpenAPISpec, OperationObject } from './types.js';

export class TypeScriptTypeGenerator {
  private spec: OpenAPISpec;
  private forceRequired: boolean;

  constructor(spec: OpenAPISpec, forceRequired: boolean = true) {
    this.spec = spec;
    this.forceRequired = forceRequired;
  }

  private openAPITypeToTS(type: string | undefined, format?: string): string {
    if (!type) return 'unknown';

    switch (type) {
      case 'string':
        return 'string';
      case 'integer':
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'array':
        return 'unknown[]';
      case 'object':
        return 'Record<string, unknown>';
      default:
        return 'unknown';
    }
  }

  private getTsType(schema: SchemaObject, context: string[] = []): string {
    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop()!;
      if (context.includes(refName)) {
        return refName;
      }
      return refName;
    }

    if (schema.enum) {
      return schema.enum.map((v) => `'${v}'`).join(' | ');
    }

    if (schema.type === 'array' && schema.items) {
      const itemType = this.getTsType(schema.items, context);
      return `${itemType}[]`;
    }

    if (schema.type === 'object') {
      if (schema.additionalProperties) {
        if (schema.additionalProperties === true) {
          return 'Record<string, unknown>';
        }
        const valueType = this.getTsType(schema.additionalProperties, context);
        return `Record<string, ${valueType}>`;
      }

      if (schema.properties) {
        const props = Object.entries(schema.properties)
          .map(([propName, propSchema]) => {
            const isOptional = !schema.required?.includes(propName);
            const optionalMark = isOptional ? '?' : '';
            const tsType = this.getTsType(propSchema, context);
            return `${propName}${optionalMark}: ${tsType}`;
          })
          .join('; ');
        return `{ ${props} }`;
      }

      return 'Record<string, unknown>';
    }

    return this.openAPITypeToTS(schema.type, schema.format);
  }

  generateType(schemaName: string, schema: SchemaObject): string {
    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop()!;
      return `export type ${schemaName} = ${refName};\n`;
    }

    if (schema.enum) {
      const enumValues = schema.enum.map((v) => `'${v}'`).join(' | ');
      return `export type ${schemaName} = ${enumValues};\n`;
    }

    if (schema.type === 'object' && schema.properties) {
      const props = Object.entries(schema.properties)
        .map(([propName, propSchema]) => {
          const isOptional = this.forceRequired ? false : !schema.required?.includes(propName);
          const optionalMark = isOptional ? '?' : '';
          const tsType = this.getTsType(propSchema);
          return `  ${propName}${optionalMark}: ${tsType};`;
        })
        .join('\n');

      return `export type ${schemaName} = {\n${props}\n};\n`;
    }

    if (schema.type === 'array' && schema.items) {
      const itemType = this.getTsType(schema.items);
      return `export type ${schemaName} = ${itemType}[];\n`;
    }

    if (schema.type && !schema.properties) {
      const tsType = this.openAPITypeToTS(schema.type, schema.format);
      return `export type ${schemaName} = ${tsType};\n`;
    }

    return `export type ${schemaName} = unknown;\n`;
  }

  generateAllTypes(schemaNames: string[]): string {
    const schemas = this.spec.components?.schemas || {};
    const output: string[] = [];

    const sorted = this.topologicalSort(schemaNames, schemas);

    for (const schemaName of sorted) {
      const schema = schemas[schemaName];
      if (schema) {
        output.push(this.generateType(schemaName, schema));
      }
    }

    return output.join('\n');
  }

  private topologicalSort(schemaNames: string[], schemas: Record<string, SchemaObject>): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);

      const schema = schemas[name];
      if (!schema) {
        result.push(name);
        return;
      }

      const collectRefs = (s: SchemaObject) => {
        if (s.$ref) {
          const refName = s.$ref.split('/').pop()!;
          if (schemaNames.includes(refName) && !visited.has(refName)) {
            visit(refName);
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
      result.push(name);
    };

    for (const name of schemaNames) {
      visit(name);
    }

    return result;
  }

  getOperationTypeNames(operationId: string): { requestType: string; responseType: string } {
    const capOpId = operationId.charAt(0).toUpperCase() + operationId.slice(1);
    return {
      requestType: `${capOpId}Request`,
      responseType: `${capOpId}Response`,
    };
  }

  generateOperationTypes(operationId: string, operation: OperationObject): {
    types: string;
    requestTypeName?: string;
    responseTypeName?: string;
  } {
    const capOpId = operationId.charAt(0).toUpperCase() + operationId.slice(1);
    const types: string[] = [];
    let requestTypeName: string | undefined;
    let responseTypeName: string | undefined;

    // Request type
    if (operation.requestBody?.content) {
      const content = operation.requestBody.content;
      const jsonContent = content['application/json'] || content['text/plain'] || Object.values(content)[0];
      if (jsonContent?.schema) {
        const reqType = this.getTsType(jsonContent.schema);
        const requestTypeNameLocal = `${capOpId}Request`;
        types.push(`export type ${requestTypeNameLocal} = ${reqType};`);
        requestTypeName = requestTypeNameLocal;
      }
    }

    // Query parameters type
    if (operation.parameters?.some(p => p.in === 'query')) {
      const queryParams = operation.parameters.filter(p => p.in === 'query');
      const params = queryParams
        .map((p) => {
          const tsType = p.schema ? this.getTsType(p.schema) : 'string';
          return `${p.name}${p.required ? '' : '?'}: ${tsType}`;
        })
        .join('; ');
      const paramsTypeName = `${capOpId}Params`;
      types.push(`export type ${paramsTypeName} = { ${params} };`);
    }

    // Response type
    const successResponse = operation.responses?.['200'] || operation.responses?.['201'];
    if (successResponse?.content) {
      const content = successResponse.content;
      const jsonContent = content['application/json'] || Object.values(content)[0];
      if (jsonContent?.schema) {
        const resType = this.getTsType(jsonContent.schema);
        const responseTypeNameLocal = `${capOpId}Response`;
        types.push(`export type ${responseTypeNameLocal} = ${resType};`);
        responseTypeName = responseTypeNameLocal;
      }
    }

    return {
      types: types.join('\n'),
      requestTypeName,
      responseTypeName,
    };
  }
}
