#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { OpenAPIParser } from './parser.js';
import { TypeScriptTypeGenerator } from './type-generator.js';
import { ServiceGenerator } from './service-generator.js';
import { MockGenerator } from './mock-generator.js';
import { OutputManager } from './output-manager.js';

const server = new Server(
  {
    name: 'openapi-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const tools = [
  {
    name: 'list-tags',
    description: 'List all available tags from an OpenAPI spec file with endpoint counts',
    inputSchema: {
      type: 'object',
      properties: {
        specPath: {
          type: 'string',
          description: 'Path to the OpenAPI spec JSON file',
        },
      },
      required: ['specPath'],
    },
  },
  {
    name: 'find-tag-by-path',
    description: 'Find tags and operations matching a path pattern',
    inputSchema: {
      type: 'object',
      properties: {
        specPath: {
          type: 'string',
          description: 'Path to the OpenAPI spec JSON file',
        },
        pathQuery: {
          type: 'string',
          description: 'Path pattern to search for (partial or full path)',
        },
      },
      required: ['specPath', 'pathQuery'],
    },
  },
  {
    name: 'generate-typescript',
    description: 'Generate TypeScript types and service files from an OpenAPI spec for a specific tag (feature-based output)',
    inputSchema: {
      type: 'object',
      properties: {
        specPath: {
          type: 'string',
          description: 'Path to the OpenAPI spec JSON file',
        },
        tag: {
          type: 'string',
          description: 'Tag to filter operations (optional, generates all if not specified)',
        },
        forceRequired: {
          type: 'boolean',
          description: 'Make all properties required (ignore spec required field)',
          default: true,
        },
      },
      required: ['specPath'],
    },
  },
  {
    name: 'generate-with-config',
    description: 'Generate TypeScript types and services using config file, with index.ts exports and duplicate type handling',
    inputSchema: {
      type: 'object',
      properties: {
        specPath: {
          type: 'string',
          description: 'Path to the OpenAPI spec JSON file',
        },
        configPath: {
          type: 'string',
          description: 'Path to openapi-mcp.config.json',
          default: './openapi-mcp.config.json',
        },
        tag: {
          type: 'string',
          description: 'Tag to filter operations (optional, generates all if not specified)',
        },
      },
      required: ['specPath'],
    },
  },
  {
    name: 'generate-mocks',
    description: 'Generate MSW mock handlers from an OpenAPI spec for a specific tag',
    inputSchema: {
      type: 'object',
      properties: {
        specPath: {
          type: 'string',
          description: 'Path to the OpenAPI spec JSON file',
        },
        configPath: {
          type: 'string',
          description: 'Path to openapi-mcp.config.json',
          default: './openapi-mcp.config.json',
        },
        tag: {
          type: 'string',
          description: 'Tag to filter operations (optional, generates all if not specified)',
        },
      },
      required: ['specPath'],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list-tags': {
        const { specPath } = args as { specPath: string };
        const parser = new OpenAPIParser(specPath);
        const tags = parser.getAllTags();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  tags: tags.map((t) => ({
                    name: t.name,
                    endpointCount: t.count,
                    operationIds: t.operationIds,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'find-tag-by-path': {
        const { specPath, pathQuery } = args as { specPath: string; pathQuery: string };
        const parser = new OpenAPIParser(specPath);
        const matches = parser.findTagsByPath(pathQuery);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  matches,
                  count: matches.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'generate-typescript': {
        const { specPath, tag, forceRequired } = args as {
          specPath: string;
          tag?: string;
          forceRequired?: boolean;
        };

        const parser = new OpenAPIParser(specPath);
        const spec = parser.getSpec();

        // Determine which tags to generate
        const tagsToGenerate = tag ? [tag] : parser.getAllTags().map((t) => t.name);

        const output: string[] = [];

        for (const tagName of tagsToGenerate) {
          const schemaNames = Array.from(parser.getSchemaNamesByTag(tagName));
          const operations = parser.getOperationsByTag(tagName);

          if (operations.length === 0) continue;

          // Remove '-controller' suffix for feature name
          const featureName = tagName.replace(/-controller$/i, '').toLowerCase();

          // Generate types
          const typeGenerator = new TypeScriptTypeGenerator(spec, forceRequired);
          const schemaTypes = typeGenerator.generateAllTypes(schemaNames);

          // Generate operation types
          const operationTypes: string[] = [];
          for (const { operation } of operations) {
            if (operation.operationId) {
              const { types } = typeGenerator.generateOperationTypes(
                operation.operationId,
                operation
              );
              if (types) operationTypes.push(types);
            }
          }

          const fullTypes = [schemaTypes, ...operationTypes].filter(Boolean).join('\n');

          // Generate services
          const serviceGenerator = new ServiceGenerator();
          const services = serviceGenerator.generateService(tagName, operations);

          output.push(
            `// File: features/${featureName}/${featureName}.types.ts`,
            fullTypes,
            '',
            `// File: features/${featureName}/${featureName}.services.ts`,
            services,
            ''
          );
        }

        return {
          content: [
            {
              type: 'text',
              text: output.join('\n'),
            },
          ],
        };
      }

      case 'generate-with-config': {
        const { specPath, configPath, tag } = args as {
          specPath: string;
          configPath?: string;
          tag?: string;
        };

        const parser = new OpenAPIParser(specPath);
        const spec = parser.getSpec();
        const outputManager = new OutputManager(configPath || './openapi-mcp.config.json');
        
        // Get output directories (uses config if exists, otherwise default)
        const typesOutputDir = outputManager.getTypesOutputDir();
        const servicesOutputDir = outputManager.getServicesOutputDir();
        const mocksOutputDir = outputManager.getMocksOutputDir();
        const handlersOutputDir = `${mocksOutputDir}/handlers`;
        const hasMocksConfig = outputManager.getConfig()?.mocksOutputDir !== undefined;

        const tagsToGenerate = tag ? [tag] : parser.getAllTags().map((t) => t.name);

        const typesFiles: string[] = [];
        const servicesFiles: string[] = [];
        const mockFiles: string[] = [];
        const output: string[] = [];
        const mockGenerator = new MockGenerator(spec);

        for (const tagName of tagsToGenerate) {
          const schemaNames = Array.from(parser.getSchemaNamesByTag(tagName));
          const operations = parser.getOperationsByTag(tagName);

          if (operations.length === 0) continue;

          const featureName = tagName.replace(/-controller$/i, '').toLowerCase();

          const typeGenerator = new TypeScriptTypeGenerator(spec, true);
          const schemaTypes = typeGenerator.generateAllTypes(schemaNames);

          const operationTypes: string[] = [];
          for (const { operation } of operations) {
            if (operation.operationId) {
              const { types } = typeGenerator.generateOperationTypes(
                operation.operationId,
                operation
              );
              if (types) operationTypes.push(types);
            }
          }

          const fullTypes = [schemaTypes, ...operationTypes].filter(Boolean).join('\n');
          const deduplicatedTypes = outputManager.registerTypes(featureName, fullTypes);

          const serviceGenerator = new ServiceGenerator();
          const services = serviceGenerator.generateService(tagName, operations);

          const typesPath = `${typesOutputDir}/${featureName}.types.ts`;
          const servicesPath = `${servicesOutputDir}/${featureName}.services.ts`;

          outputManager.writeFile(typesPath, deduplicatedTypes);
          outputManager.writeFile(servicesPath, services);

          if (hasMocksConfig) {
            const handlers = mockGenerator.generateMockHandlers(tagName, operations);
            const mockPath = `${handlersOutputDir}/${featureName}.ts`;
            outputManager.writeFile(mockPath, handlers);
            mockFiles.push(`${featureName}.ts`);
          }

          typesFiles.push(`${featureName}.types.ts`);
          servicesFiles.push(`${featureName}.services.ts`);
        }

        // Generate index.ts files
        const typesIndex = outputManager.generateTypesIndex(typesFiles);
        const servicesIndex = outputManager.generateServicesIndex(servicesFiles);

        const typesIndexPath = `${typesOutputDir}/index.ts`;
        const servicesIndexPath = `${servicesOutputDir}/index.ts`;

        outputManager.writeFile(typesIndexPath, typesIndex);
        outputManager.writeFile(servicesIndexPath, servicesIndex);

        if (hasMocksConfig && mockFiles.length > 0) {
          const mocksIndex = outputManager.generateMocksIndex(mockFiles);
          const mocksIndexPath = `${handlersOutputDir}/index.ts`;
          outputManager.writeFile(mocksIndexPath, mocksIndex);
        }

        output.push(
          `✓ Generated ${typesFiles.length} types files in ${typesOutputDir}`,
          `✓ Generated ${servicesFiles.length} services files in ${servicesOutputDir}`
        );

        if (hasMocksConfig) {
          output.push(`✓ Generated ${mockFiles.length} mock files in ${handlersOutputDir}`);
        }

        output.push(
          `✓ Generated index.ts files`,
          '',
          outputManager.getDuplicatesReport()
        );

        return {
          content: [
            {
              type: 'text',
              text: output.join('\n'),
            },
          ],
        };
      }

      case 'generate-mocks': {
        const { specPath, configPath, tag } = args as {
          specPath: string;
          configPath?: string;
          tag?: string;
        };

        const parser = new OpenAPIParser(specPath);
        const spec = parser.getSpec();
        const outputManager = new OutputManager(configPath || './openapi-mcp.config.json');
        
        const mocksOutputDir = outputManager.getMocksOutputDir();
        const handlersOutputDir = `${mocksOutputDir}/handlers`;

        const tagsToGenerate = tag ? [tag] : parser.getAllTags().map((t) => t.name);

        const mockFiles: string[] = [];
        const output: string[] = [];

        for (const tagName of tagsToGenerate) {
          const operations = parser.getOperationsByTag(tagName);

          if (operations.length === 0) continue;

          const featureName = tagName.replace(/-controller$/i, '').toLowerCase();

          const mockGenerator = new MockGenerator(spec);
          const handlers = mockGenerator.generateMockHandlers(tagName, operations);

          const mockPath = `${handlersOutputDir}/${featureName}.ts`;
          outputManager.writeFile(mockPath, handlers);

          mockFiles.push(`${featureName}.ts`);
        }

        // Generate index.ts for handlers
        if (mockFiles.length > 0) {
          const mocksIndex = outputManager.generateMocksIndex(mockFiles);
          const mocksIndexPath = `${handlersOutputDir}/index.ts`;
          outputManager.writeFile(mocksIndexPath, mocksIndex);
        }

        output.push(
          `✓ Generated ${mockFiles.length} mock files in ${handlersOutputDir}`,
          `✓ Generated handlers/index.ts`
        );

        return {
          content: [
            {
              type: 'text',
              text: output.join('\n'),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: errorMessage }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('OpenAPI MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
