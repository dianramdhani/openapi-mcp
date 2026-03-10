# OpenAPI MCP Server

MCP server untuk menggenerate TypeScript code dari OpenAPI spec dengan format feature-based, auto-imports, duplicate type handling, dan TypeScript validation.

## Features

- **list-tags**: List semua tag yang tersedia di OpenAPI spec
- **find-tag-by-path**: Cari tag berdasarkan path URL
- **generate-typescript**: Generate TypeScript types dan service files (simple output)
- **generate-with-config**: Generate dengan config file, auto-imports, duplicate handling, dan TypeScript validation

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Test with TypeScript validation
npm run test
```

## Configuration

Buat file `openapi-mcp.config.json`:

```json
{
  "typesOutputDir": "./src/types",
  "servicesOutputDir": "./src/services"
}
```

## Usage

### Sebagai MCP Server

Tambahkan ke konfigurasi MCP client Anda (Claude Desktop, dll):

```json
{
  "mcpServers": {
    "openapi": {
      "command": "node",
      "args": ["/path/to/openapi-mcp/dist/index.js"],
      "cwd": "/path/to/openapi-mcp"
    }
  }
}
```

### Tools

#### 1. list-tags

List semua tag yang tersedia dengan jumlah endpoint.

**Input:**
```json
{
  "specPath": "/path/to/openapi.json"
}
```

**Output:**
```json
{
  "tags": [
    {
      "name": "reporting-controller",
      "endpointCount": 12,
      "operationIds": ["modifySLaCustomers", "getSLACustomers", ...]
    }
  ]
}
```

#### 2. find-tag-by-path

Cari tag berdasarkan path URL.

**Input:**
```json
{
  "specPath": "/path/to/openapi.json",
  "pathQuery": "/reporting"
}
```

**Output:**
```json
{
  "matches": [
    {
      "path": "/v1/reporting/sla-customers",
      "method": "post",
      "tag": "reporting-controller",
      "operationId": "modifySLaCustomers"
    }
  ],
  "count": 12
}
```

#### 3. generate-typescript

Generate TypeScript types dan service files (output langsung).

**Input:**
```json
{
  "specPath": "/path/to/openapi.json",
  "tag": "reporting-controller"
}
```

#### 4. generate-with-config ⭐

Generate files menggunakan config, dengan fitur:
- Auto-generate `index.ts` untuk re-export
- Auto-import untuk duplicate types
- Auto-import untuk types yang direferensi
- TypeScript compilation check

**Input:**
```json
{
  "specPath": "/path/to/openapi.json",
  "configPath": "./openapi-mcp.config.json",
  "tag": "reporting-controller"
}
```

## Generated Output Structure

```
project/
├── openapi-mcp.config.json    # Config file
├── types/
│   ├── index.ts               ← Auto-generated exports
│   ├── dashboard-device-performance.types.ts
│   ├── dashboard-device-with-issue.types.ts  (auto-import dari dashboard-device-performance)
│   └── reporting.types.ts                      (auto-import dari dashboard-device-performance)
│
└── services/
    ├── index.ts               ← Auto-generated exports
    ├── dashboard-device-performance.services.ts
    ├── dashboard-device-with-issue.services.ts
    └── reporting.services.ts
```

### Example Generated Files

**types/index.ts:**
```typescript
// Auto-generated types index
export * from './dashboard-device-performance.types';
export * from './dashboard-device-with-issue.types';
export * from './reporting.types';
```

**types/reporting.types.ts:**
```typescript
// Auto-import untuk duplicate types
import type { ChartDataSet, ChartModel, ResponseResultChartModel } from './dashboard-device-performance.types';

export type SLACustomerDto = {
  customerId: number;
  customerName: string;
  slaPercentage: number;
};

// ... other types
```

**services/reporting.services.ts:**
```typescript
import { axiosInstance } from '@/lib/axios';
import type { ModifySLaCustomersRequest, ... } from '../types';

export const Reporting = {
  modifySLaCustomers: async (request: ModifySLaCustomersRequest): Promise<ModifySLaCustomersResponse> => {
    const { data } = await axiosInstance.post(`/v1/reporting/sla-customers`, request, undefined);
    return data;
  },
  getSLACustomers: async (request: GetSLACustomersRequest): Promise<GetSLACustomersResponse> => {
    const { data } = await axiosInstance.post(`/v1/reporting/sla-customers/list`, request, undefined);
    return data;
  },
  // ... other methods
};
```

**services/index.ts:**
```typescript
// Auto-generated services index
export * from './dashboard-device-performance.services';
export * from './dashboard-device-with-issue.services';
export * from './reporting.services';
```

## Duplicate Type Handling

Jika ada type yang sama di beberapa feature (misalnya `ChartModel`), MCP server akan:

1. **Detect** - Deteksi types yang sama di multiple files
2. **Keep** - Keep type di file pertama yang memilikinya
3. **Remove** - Remove duplikat dari file lain
4. **Auto-import** - Add import otomatis di file yang butuh type tersebut

**Report:**
```
Found 3 duplicate type(s):

  - ChartDataSet
    ✓ Kept in: dashboard-device-performance
    ✗ Removed from: dashboard-device-with-issue, reporting
  - ChartModel
    ✓ Kept in: dashboard-device-performance
    ✗ Removed from: dashboard-device-with-issue, reporting
```

## Usage in Your Code

```typescript
// Import dari index (recommended)
import { Reporting, DashboardDevicePerformance } from '@/services';
import type { SLACustomerDto, ChartModel } from '@/types';

// Usage - no naming conflicts!
const report = await Reporting.getSLACustomers(request);
const perf = await DashboardDevicePerformance.getAverageRTT(params);

// Or import directly from files
import { Reporting } from '@/services/reporting.services';
import type { SLACustomerDto } from '@/types/reporting.types';
```

## CLI Testing

```bash
# Test dengan TypeScript validation
npm run test

# Test dengan TypeScript validation (explicit)
npm run test:tsc

# Test skip TypeScript validation
npm run test:skip-tsc

# Test specific tag
node dist/test-generate.js ../report.json reporting-controller
```

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run MCP server
npm start

# Development mode
npm run dev
```

## Requirements

- Node.js >= 18
- TypeScript >= 5.0
- @modelcontextprotocol/sdk

## Project Structure

```
openapi-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── parser.ts             # OpenAPI spec parser
│   ├── type-generator.ts     # TypeScript type generator
│   ├── service-generator.ts  # Service function generator
│   ├── output-manager.ts     # Output manager with duplicate handling
│   ├── test-generate.ts      # Test CLI
│   └── lib/
│       └── axios.ts          # Mock axios for type checking
├── output/                   # Generated output (gitignored)
├── openapi-mcp.config.json   # Configuration file
├── tsconfig.json             # TypeScript config
├── tsconfig.test.json        # TypeScript test config
├── package.json
└── README.md
```

## Features Summary

| Feature | Status |
|---------|--------|
| Config-based output directories | ✅ |
| Auto-generate index.ts | ✅ |
| Duplicate type detection | ✅ |
| Auto-imports for duplicates | ✅ |
| Auto-imports for referenced types | ✅ |
| Object-based services | ✅ |
| Clean file names (no -controller) | ✅ |
| Services import from ../types | ✅ |
| TypeScript compilation check | ✅ |
| All properties required by default | ✅ |

## License

ISC
