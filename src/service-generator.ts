import { OperationObject } from './types.js';

export class ServiceGenerator {
  private tagToFeatureName(tagName: string): string {
    // Remove '-controller' suffix and convert to lowercase
    const cleanName = tagName.replace(/-controller$/i, '');
    return cleanName.toLowerCase();
  }

  /**
   * Convert tag name to PascalCase for service object name
   * e.g., 'reporting-controller' -> 'Reporting'
   *       'dashboard-device-performance-controller' -> 'DashboardDevicePerformance'
   */
  private tagToServiceObjectName(tagName: string): string {
    const cleanName = tagName.replace(/-controller$/i, '');
    return cleanName
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  private operationToFunctionName(operationId: string): string {
    // Convert PascalCase to camelCase
    return operationId.charAt(0).toLowerCase() + operationId.slice(1);
  }

  generateService(
    tagName: string,
    operations: Array<{ path: string; method: string; operation: OperationObject }>
  ): string {
    const imports: string[] = [];
    const methods: string[] = [];

    for (const { path, method, operation } of operations) {
      if (!operation.operationId) continue;

      const result = this.generateMethod(path, method, operation);
      methods.push(result.code);

      // Collect imports
      if (result.imports.length > 0) {
        imports.push(...result.imports);
      }
    }

    const importStatement = imports.length > 0
      ? `import type { ${[...new Set(imports)].join(', ')} } from '../types';`
      : '';

    const serviceName = this.tagToServiceObjectName(tagName);

    return `import { axiosInstance } from '@/lib/axios';

${importStatement}

export const ${serviceName} = {
${methods.join(',\n')}
};
`;
  }

  private generateMethod(
    path: string,
    method: string,
    operation: OperationObject
  ): { code: string; imports: string[] } {
    const functionName = this.operationToFunctionName(operation.operationId!);
    const capOpId = operation.operationId!.charAt(0).toUpperCase() + operation.operationId!.slice(1);
    const imports: string[] = [];

    // Build parameters
    const params: string[] = [];

    // Path parameters
    const pathParams = operation.parameters?.filter((p) => p.in === 'path') || [];
    for (const param of pathParams) {
      const required = param.required ? '' : '?';
      params.push(`${param.name}${required}: string`);
    }

    // Query parameters - as single object
    const queryParams = operation.parameters?.filter((p) => p.in === 'query') || [];
    let queryParamsName: string | undefined;
    if (queryParams.length > 0) {
      queryParamsName = `${capOpId}Params`;
      params.push(`params: ${queryParamsName}`);
      imports.push(queryParamsName);
    }

    // Request body
    const hasBody = ['post', 'put', 'patch'].includes(method.toLowerCase());
    let requestTypeName: string | undefined;
    if (hasBody && operation.requestBody) {
      requestTypeName = `${capOpId}Request`;
      params.push(`request: ${requestTypeName}`);
      imports.push(requestTypeName);
    }

    const paramsStr = params.join(', ');

    // Build URL with path params
    let urlPath = path;
    for (const param of pathParams) {
      urlPath = urlPath.replace(`{${param.name}}`, `\${${param.name}}`);
    }

    // Build axios call
    const httpMethod = method.toUpperCase();
    
    // Build params object for axios
    const axiosParams: string[] = [];
    
    if (queryParams.length > 0) {
      axiosParams.push('params');
    }

    const axiosParamsStr = axiosParams.length > 0 
      ? `{ ${axiosParams.join(', ')} }` 
      : 'undefined';

    // Response type
    const responseTypeName = operation.responses['200'] || operation.responses['201']
      ? `${capOpId}Response`
      : 'void';

    if (responseTypeName !== 'void') {
      imports.push(responseTypeName);
    }

    // Build function body based on method
    let axiosCall: string;

    if (hasBody && operation.requestBody) {
      axiosCall = `axiosInstance.${method.toLowerCase()}(\`${urlPath}\`, request, ${axiosParamsStr})`;
    } else {
      axiosCall = `axiosInstance.${method.toLowerCase()}(\`${urlPath}\`, ${axiosParamsStr})`;
    }

    // Generate JSDoc
    const jsdoc = this.generateJSDoc(operation, path, method, params, responseTypeName);

    const code = `${jsdoc}  ${functionName}: async (${paramsStr}): Promise<${responseTypeName}> => {
    const { data } = await ${axiosCall};
    return data;
  }`;

    return { code, imports };
  }

  /**
   * Generate JSDoc comment for operation
   */
  private generateJSDoc(
    operation: OperationObject,
    path: string,
    method: string,
    params: string[],
    responseTypeName: string
  ): string {
    const lines: string[] = [];
    
    // Summary
    if (operation.summary) {
      lines.push(` * ${operation.summary}`);
    } else if (operation.operationId) {
      // Convert operationId to readable format
      const readableOpId = operation.operationId
        .replace(/([A-Z])/g, ' $1')
        .replace(/-/g, ' ')
        .trim();
      lines.push(` * ${readableOpId}`);
    }

    // Description
    if (operation.description) {
      lines.push(` *`);
      const descLines = operation.description.split('\n').map(l => ` * ${l.trim()}`);
      lines.push(...descLines);
    }

    // Parameters
    if (params.length > 0) {
      lines.push(` *`);
      for (const param of params) {
        const paramName = param.split(':')[0].trim();
        const paramType = param.split(':')[1]?.trim() || 'any';
        lines.push(` * @param ${paramName} - ${paramType}`);
      }
    }

    // Returns
    lines.push(` * @returns Promise<${responseTypeName}>`);

    // Method and path info
    lines.push(` * @method ${method.toUpperCase()} ${path}`);

    // Build JSDoc comment
    if (lines.length === 0) {
      return '';
    }

    return `/**
${lines.join('\n')}
 */
`;
  }
}
