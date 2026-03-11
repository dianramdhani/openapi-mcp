# OpenAPI MCP Server

> **Transform your OpenAPI specs into production-ready TypeScript code instantly**

OpenAPI MCP Server adalah Model Context Protocol (MCP) server yang mengubah OpenAPI specification menjadi TypeScript code yang type-safe, siap produksi, dan terstruktur dengan baik. Cukup berikan OpenAPI spec Anda, dan biarkan MCP server ini melakukan sisanya.

## ✨ Kenapa OpenAPI MCP Server?

```mermaid
flowchart LR
    A[OpenAPI Spec] --> B[OpenAPI MCP Server]
    B --> C[Type-Safe TypeScript Code]
    B --> D[Auto-Generated Services]
    B --> E[Smart Duplicate Handling]
    B --> F[Ready to Use]
    
    style A fill:#f9f,stroke:#333
    style C fill:#9f9,stroke:#333
    style D fill:#9f9,stroke:#333
    style E fill:#9f9,stroke:#333
    style F fill:#9f9,stroke:#333
```

### 🚀 Manfaat Utama

| Sebelum | Sesudah |
|---------|---------|
| ❌ Manual write types dari OpenAPI | ✅ Auto-generate dalam detik |
| ❌ Duplicate types di multiple files | ✅ Smart deduplication dengan auto-imports |
| ❌ Inconsistent naming conventions | ✅ Clean, consistent naming |
| ❌ No TypeScript validation | ✅ Compiled & validated |
| ❌ Manual index.ts updates | ✅ Auto-generated exports |

## 🎯 Use Cases

```mermaid
graph TD
    subgraph Users["Siapa yang Cocok Pakai Ini?"]
        A1[Frontend Developers]
        A2[Backend Developers]
        A3[Full Stack Teams]
        A4[DevOps Engineers]
    end

    subgraph Scenarios["Kapan Pakai?"]
        B1[New API Project]
        B2[API Version Upgrade]
        B3[Microservices Architecture]
        B4[CI/CD Pipeline]
    end

    A1 --> B1
    A2 --> B2
    A3 --> B3
    A4 --> B4
```

### 👥 Untuk Siapa?

- **Frontend Developers**: Dapatkan type-safe API client tanpa manual coding
- **Backend Developers**: Generate consistent types dari OpenAPI spec Anda
- **Full Stack Teams**: Maintain single source of truth dengan OpenAPI
- **DevOps Engineers**: Integrate ke CI/CD pipeline untuk auto-generation

## 🛠️ Fitur Unggulan

### 1. Smart Tag Discovery

Temukan endpoint yang Anda butuhkan dengan cepat:

```mermaid
flowchart LR
    A[List All Tags] --> B[Find by Path]
    B --> C[Generate Code]
    
    style A fill:#ff9,stroke:#333
    style B fill:#ff9,stroke:#333
    style C fill:#9f9,stroke:#333
```

- **list-tags**: Lihat semua available tags dengan jumlah endpoint
- **find-tag-by-path**: Cari endpoint berdasarkan URL pattern

### 2. Intelligent Code Generation

```mermaid
graph LR
    subgraph Input["Input"]
        A[OpenAPI Spec]
    end

    subgraph Process["Smart Processing"]
        B[Parse OpenAPI]
        C[Detect Duplicates]
        D[Resolve Dependencies]
    end

    subgraph Output["Output"]
        E[TypeScript Types]
        F[API Services]
        G[Auto Index Files]
    end

    A --> B --> C --> D --> E
    D --> F
    D --> G
```

- **generate-typescript**: Quick generation untuk satu feature
- **generate-with-config** ⭐: Full-featured generation dengan smart features

### 3. Automatic Duplicate Handling

Tidak perlu khawatir dengan duplicate types! MCP server akan:

```mermaid
flowchart TD
    A[Multiple Features] --> B{Same Type Name?}
    B -->|Yes| C[Keep in First File]
    B -->|No| D[Create New]
    C --> E[Auto-Import to Others]
    D --> F[Use Normally]
    
    style C fill:#9f9,stroke:#333
    style E fill:#9f9,stroke:#333
```

1. **Detect** duplicate types across features
2. **Keep** type di file pertama
3. **Remove** duplicates dari file lain
4. **Auto-import** type yang dibutuhkan

### 4. Production-Ready Output

Generated code yang langsung bisa dipakai:

```mermaid
graph TD
    A[Generated Files] --> B[types/index.ts]
    A --> C[types/*.types.ts]
    A --> D[services/index.ts]
    A --> E[services/*.services.ts]
    
    B --> F[Clean Exports]
    C --> G[Type Definitions]
    D --> H[Service Exports]
    E --> I[API Methods]
    
    style F fill:#9f9,stroke:#333
    style G fill:#9f9,stroke:#333
    style H fill:#9f9,stroke:#333
    style I fill:#9f9,stroke:#333
```

- ✅ Type-safe dengan TypeScript validation
- ✅ Clean imports & exports
- ✅ JSDoc comments untuk IntelliSense
- ✅ Consistent naming conventions
- ✅ Axios-based API calls

## 🎮 Cara Pakai

### ⚠️ Required Files

Sebelum menggunakan MCP server ini, pastikan **2 file ini ada**:

| File | Purpose | Cara Dapatkan |
|------|---------|---------------|
| `openapi-spec.json` | OpenAPI specification dari API Anda | Export dari Swagger UI via DevTools Network tab |
| `openapi-mcp.config.json` | Config output directories untuk generated code | Buat manual di project root |

> 💡 **Penting:** Agent/MCP client tidak akan otomatis cek file-file ini. **Selalu mention di prompt** untuk memastikan code generation berjalan benar.

### Setup dalam 4 Langkah

```mermaid
flowchart LR
    A[1. Export Swagger] --> B[2. Install]
    B --> C[3. Configure MCP]
    C --> D[4. Generate Code]
    
    style A fill:#f9f,stroke:#333
    style B fill:#9cf,stroke:#333
    style C fill:#9cf,stroke:#333
    style D fill:#9f9,stroke:#333
```

**1. Export OpenAPI Spec dari Swagger:**

Pertama, dapatkan OpenAPI spec dari Swagger UI Anda. Cara paling reliable:

```bash
# Cara 1: Via Browser DevTools (Recommended - Works for all Swagger setups)
# 1. Buka Swagger UI API Anda di browser
# 2. Buka DevTools (F12) → Tab Network
# 3. Refresh page atau akses endpoint swagger
# 4. Cari request yang return OpenAPI spec (biasanya .json)
# 5. Klik kanan → Copy → Copy response
# 6. Save sebagai openapi-spec.json di project root

# Cara 2: Via Swagger UI direct link (jika tersedia)
# Buka http://your-api.com/swagger → Klik "Swagger JSON" → Save as openapi-spec.json

# Cara 3: Via curl (jika endpoint diketahui)
curl http://your-api.com/v3/api-docs -o openapi-spec.json
# atau
curl http://your-api.com/swagger/v1/swagger.json -o openapi-spec.json
```

> 💡 **Tip:** Setiap Swagger setup bisa beda endpoint. Cara paling aman adalah lewat **DevTools Network tab** untuk melihat response yang sebenarnya.

File `openapi-spec.json` ini adalah sumber truth untuk code generation.

**2. Install dependencies:**
```bash
npm install
```

**3. Buat 2 file konfigurasi:**

a. **openapi-mcp.config.json** - Konfigurasi output directories:
```json
{
  "typesOutputDir": "./src/types",
  "servicesOutputDir": "./src/services"
}
```

b. **openapi-spec.json** - OpenAPI spec dari Swagger (langkah 1)

**4. Add ke MCP client Anda (Claude Desktop, dll):**

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

### Contoh Penggunaan

#### Scenario 1: Explore API Structure

```
User: "Show me all available API endpoints"
MCP: [list-tags] → Returns all tags with endpoint counts

Input yang MCP butuhkan:
- specPath: "/path/to/openapi-spec.json" ⚠️ Required
```

#### Scenario 2: Find Specific Endpoint

```
User: "Find endpoints related to /reporting"
MCP: [find-tag-by-path] → Returns matching paths and operations

Input yang MCP butuhkan:
- specPath: "/path/to/openapi-spec.json" ⚠️ Required
- pathQuery: "/reporting" ⚠️ Required
```

#### Scenario 3: Generate Production Code ⭐

```
User: "Generate TypeScript code for reporting feature"
MCP: [generate-with-config] → Creates types & services files

Input yang MCP butuhkan:
- specPath: "/path/to/openapi-spec.json" ⚠️ Required - OpenAPI spec dari Swagger
- configPath: "./openapi-mcp.config.json" ⚠️ Required - Config output directories
- tag: "reporting-controller" (Optional - generate all if not specified)
```

> ⚠️ **Penting:** Selalu mention **kedua file** (`openapi-spec.json` dan `openapi-mcp.config.json`) di setiap prompt. Jangan skip config file karena MCP server butuh ini untuk menentukan output directories.

### File Structure yang Dibutuhkan

```
your-project/
├── openapi-mcp/              # MCP server
│   ├── dist/
│   └── package.json
│
├── openapi-spec.json         ← OpenAPI spec dari Swagger
├── openapi-mcp.config.json   ← Config output directories
│
└── your-app/
    ├── src/
    │   ├── types/            ← Generated types
    │   └── services/         ← Generated services
    └── package.json
```

## 📊 Hasil Generated Code

### Struktur File

```mermaid
graph TD
    subgraph Input["Input Files"]
        A[openapi-spec.json<br/>from Swagger]
        B[openapi-mcp.config.json<br/>output directories]
    end

    subgraph MCP["OpenAPI MCP Server"]
        C[Parse & Generate]
    end

    subgraph Output["Generated Output"]
        D[types/index.ts]
        E[types/*.types.ts]
        F[services/index.ts]
        G[services/*.services.ts]
    end

    A --> C
    B -.->|configures| C
    C --> D
    C --> E
    C --> F
    C --> G
    
    style A fill:#f9f,stroke:#333
    style B fill:#ff9,stroke:#333
    style D fill:#9f9,stroke:#333
    style E fill:#9f9,stroke:#333
    style F fill:#9f9,stroke:#333
    style G fill:#9f9,stroke:#333
```

### Contoh Usage di Code Anda

```typescript
// Import services & types
import { Reporting } from '@/services';
import type { SLACustomerDto } from '@/types';

// Use with full type safety! 🎉
const customers = await Reporting.getSLACustomers({ page: 1, limit: 10 });

// TypeScript will autocomplete and type-check everything
customers.forEach((customer: SLACustomerDto) => {
  console.log(customer.customerName); // ✅ Type-safe
});
```

## 🔧 Testing

Test generation dengan TypeScript validation:

```bash
# Full test dengan validation
npm run test

# Test specific feature
node dist/test-generate.js ../your-spec.json reporting-controller
```

## 📚 Dokumentasi Lengkap

Untuk technical details, architecture diagrams, dan development guide, lihat:

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture, class diagrams, data flow

## 🚀 Ready to Start?

```bash
# Clone & Install
git clone <repository>
cd openapi-mcp
npm install

# Build
npm run build

# Test
npm run test

# Start generating! 🎉
```

## 📋 Requirements

- Node.js >= 18
- TypeScript >= 5.0
- MCP-compatible client (Claude Desktop, dll)

## 🤝 Contributing

OpenAPI MCP Server adalah open source. Kontribusi selalu welcome!

## 📄 License

ISC

---

**Made with ❤️ for developers who love type-safe code**

*Stop writing boilerplate. Start building features.*
