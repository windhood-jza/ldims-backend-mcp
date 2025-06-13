# LDIMS MCP 服务开发者指南

> **面向开发者的完整技术指南**

## 📋 目录

- [开发环境搭建](#开发环境搭建)
- [项目架构](#项目架构)
- [核心概念](#核心概念)
- [开发流程](#开发流程)
- [代码规范](#代码规范)
- [测试指南](#测试指南)
- [调试技巧](#调试技巧)
- [性能优化](#性能优化)
- [部署指南](#部署指南)

## 🚀 开发环境搭建

### 系统要求

- **操作系统**: Windows 10+, macOS 10.15+, Ubuntu 18.04+
- **Node.js**: >= 18.0.0 (推荐使用 LTS 版本)
- **npm**: >= 8.0.0
- **Git**: >= 2.20.0
- **编辑器**: VS Code (推荐) 或其他支持 TypeScript 的编辑器

### 环境配置

1. **安装 Node.js**
   ```bash
   # 使用 nvm 管理 Node.js 版本（推荐）
   nvm install 18
   nvm use 18
   
   # 验证安装
   node --version
   npm --version
   ```

2. **全局工具安装**
   ```bash
   # TypeScript 编译器
   npm install -g typescript
   
   # 开发工具
   npm install -g tsx nodemon
   ```

3. **VS Code 扩展推荐**
   - TypeScript Importer
   - ESLint
   - Prettier
   - GitLens
   - Thunder Client (API 测试)

### 项目初始化

```bash
# 克隆项目
git clone <repository-url>
cd backend_mcp

# 安装依赖
npm install

# 复制环境配置
cp .env.example .env

# 构建项目
npm run build

# 启动开发服务器
npm run dev
```

## 🏗️ 项目架构

### 目录结构详解

```
backend_mcp/
├── src/                    # 源代码目录
│   ├── config/            # 配置管理模块
│   │   ├── index.ts       # 基础配置管理器
│   │   └── enhanced-config.ts # 增强配置管理器
│   ├── services/          # 业务服务层
│   │   └── ldims-api.ts   # LDIMS API 服务
│   ├── types/             # TypeScript 类型定义
│   │   └── mcp.ts         # MCP 相关类型
│   ├── utils/             # 工具函数
│   │   └── error-handler.ts # 错误处理工具
│   └── index.ts           # 应用入口文件
├── tests/                 # 测试文件目录
│   ├── unit/              # 单元测试
│   ├── integration/       # 集成测试
│   └── fixtures/          # 测试数据
├── docs/                  # 文档目录
├── scripts/               # 构建和工具脚本
├── dist/                  # 编译输出目录
├── config/                # 配置文件
├── package.json           # 项目配置
├── tsconfig.json          # TypeScript 配置
├── eslint.config.js       # ESLint 配置
└── .prettierrc.json       # Prettier 配置
```

### 架构设计原则

1. **分层架构**: 清晰的分层结构，职责分离
2. **依赖注入**: 使用依赖注入模式，便于测试和维护
3. **类型安全**: 完整的 TypeScript 类型定义
4. **错误处理**: 统一的错误处理机制
5. **配置管理**: 灵活的配置管理系统

## 🧠 核心概念

### MCP 协议基础

Model Context Protocol (MCP) 是一个标准化协议，用于 AI 模型与外部系统的交互。

#### 核心组件

1. **Tools (工具)**
   - 可被 AI 模型调用的函数
   - 需要用户批准才能执行
   - 支持参数验证和错误处理

2. **Resources (资源)**
   - 类似文件的数据源
   - 可被客户端读取
   - 支持 URI 模式访问

3. **Prompts (提示)**
   - 预写的模板
   - 帮助用户完成特定任务
   - 本项目暂未实现

#### 传输协议

- **STDIO**: 标准输入输出（当前使用）
- **SSE**: Server-Sent Events
- **HTTP**: HTTP 协议

### 类型系统

项目使用 TypeScript 提供完整的类型安全：

```typescript
// MCP 工具定义
interface McpTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}

// 搜索参数类型
interface SearchDocumentsParams {
  query: string;
  maxResults?: number;
  filters?: SearchFilters;
}

// 响应类型
interface SearchDocumentsResponse {
  results: DocumentSearchResult[];
  totalMatches: number;
  searchMetadata: SearchMetadata;
}
```

## 🔄 开发流程

### 功能开发流程

1. **需求分析**
   - 理解功能需求
   - 设计 API 接口
   - 确定数据结构

2. **类型定义**
   ```typescript
   // 在 src/types/mcp.ts 中定义类型
   export interface NewFeatureParams {
     // 参数定义
   }
   
   export interface NewFeatureResponse {
     // 响应定义
   }
   ```

3. **实现服务层**
   ```typescript
   // 在 src/services/ 中实现业务逻辑
   export class NewFeatureService {
     async processRequest(params: NewFeatureParams): Promise<NewFeatureResponse> {
       // 业务逻辑实现
     }
   }
   ```

4. **集成到 MCP 服务器**
   ```typescript
   // 在 src/index.ts 中注册工具
   server.setRequestHandler(CallToolRequestSchema, async (request) => {
     switch (request.params.name) {
       case "newFeature":
         // 处理新功能
         break;
     }
   });
   ```

5. **编写测试**
   ```typescript
   // 在 tests/ 中编写测试
   describe("NewFeature", () => {
     it("should work correctly", async () => {
       // 测试逻辑
     });
   });
   ```

### Git 工作流

```bash
# 创建功能分支
git checkout -b feature/new-feature

# 开发过程中频繁提交
git add .
git commit -m "feat: implement new feature"

# 推送到远程
git push origin feature/new-feature

# 创建 Pull Request
# 代码审查通过后合并到主分支
```

## 📏 代码规范

### TypeScript 规范

1. **类型定义**
   ```typescript
   // ✅ 好的做法
   interface User {
     id: string;
     name: string;
     email?: string;
   }
   
   // ❌ 避免使用 any
   function process(data: any) { }
   
   // ✅ 使用具体类型
   function process(data: User) { }
   ```

2. **函数定义**
   ```typescript
   // ✅ 明确的返回类型
   async function fetchUser(id: string): Promise<User | null> {
     // 实现
   }
   
   // ✅ 使用箭头函数处理简单逻辑
   const formatName = (user: User): string => `${user.name}`;
   ```

3. **错误处理**
   ```typescript
   // ✅ 使用自定义错误类型
   try {
     const result = await apiCall();
     return result;
   } catch (error) {
     throw new McpError(McpErrorCode.API_ERROR, "API call failed", { error });
   }
   ```

### 命名规范

- **文件名**: kebab-case (`ldims-api.ts`)
- **类名**: PascalCase (`LdimsApiService`)
- **函数名**: camelCase (`searchDocuments`)
- **常量**: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- **接口**: PascalCase with Interface suffix (`SearchDocumentsParams`)

### 注释规范

```typescript
/**
 * 搜索文档的服务类
 * 
 * 提供与 LDIMS 后端 API 的集成，支持文档搜索和内容提取功能
 */
export class LdimsApiService {
  /**
   * 搜索文档
   * 
   * @param params 搜索参数
   * @returns 搜索结果
   * @throws {McpError} 当 API 调用失败时抛出错误
   */
  async searchDocuments(params: SearchDocumentsParams): Promise<SearchDocumentsResponse> {
    // 实现
  }
}
```

## 🧪 测试指南

### 测试策略

1. **单元测试**: 测试独立的函数和类
2. **集成测试**: 测试组件间的交互
3. **端到端测试**: 测试完整的用户场景

### 测试工具

- **Jest**: 测试框架
- **Supertest**: HTTP 测试
- **Nock**: HTTP 请求模拟

### 测试示例

```typescript
// 单元测试示例
describe("LdimsApiService", () => {
  let service: LdimsApiService;
  
  beforeEach(() => {
    service = new LdimsApiService(mockConfig);
  });
  
  it("should search documents successfully", async () => {
    // 模拟 API 响应
    nock("http://localhost:3000")
      .get("/api/documents/search")
      .reply(200, mockSearchResponse);
    
    const result = await service.searchDocuments({
      query: "test query"
    });
    
    expect(result.results).toHaveLength(2);
    expect(result.totalMatches).toBe(2);
  });
});
```

### 测试命令

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- --testPathPattern=ldims-api

# 生成覆盖率报告
npm run test:coverage

# 监听模式
npm run test:watch
```

## 🐛 调试技巧

### 日志调试

```typescript
// 使用结构化日志
console.log("Processing search request", {
  query: params.query,
  maxResults: params.maxResults,
  timestamp: new Date().toISOString()
});
```

### VS Code 调试配置

创建 `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug MCP Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/index.ts",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development",
        "LOG_LEVEL": "debug"
      },
      "runtimeArgs": ["-r", "tsx/cjs"]
    }
  ]
}
```

### 常用调试技巧

1. **断点调试**: 在 VS Code 中设置断点
2. **日志输出**: 使用 console.log 输出关键信息
3. **错误追踪**: 查看完整的错误堆栈
4. **网络调试**: 使用 Thunder Client 测试 API

## ⚡ 性能优化

### 代码优化

1. **避免不必要的计算**
   ```typescript
   // ❌ 每次都重新计算
   function processData(items: Item[]) {
     return items.map(item => expensiveOperation(item));
   }
   
   // ✅ 使用缓存
   const cache = new Map();
   function processData(items: Item[]) {
     return items.map(item => {
       if (!cache.has(item.id)) {
         cache.set(item.id, expensiveOperation(item));
       }
       return cache.get(item.id);
     });
   }
   ```

2. **异步操作优化**
   ```typescript
   // ❌ 串行执行
   const result1 = await operation1();
   const result2 = await operation2();
   
   // ✅ 并行执行
   const [result1, result2] = await Promise.all([
     operation1(),
     operation2()
   ]);
   ```

### 内存管理

1. **及时清理资源**
2. **避免内存泄漏**
3. **使用流处理大文件**

### 监控指标

- **响应时间**: 监控 API 调用时间
- **内存使用**: 监控内存占用
- **错误率**: 跟踪错误发生频率

## 🚀 部署指南

### 构建生产版本

```bash
# 安装生产依赖
npm ci --only=production

# 构建项目
npm run build

# 启动生产服务
npm start
```

### 环境配置

```bash
# 生产环境变量
export NODE_ENV=production
export LOG_LEVEL=info
export LDIMS_API_BASE_URL=https://api.ldims.com
```

### Docker 部署

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY config ./config

EXPOSE 3000

CMD ["npm", "start"]
```

### 健康检查

实现健康检查端点：

```typescript
// 健康检查逻辑
export function healthCheck(): HealthStatus {
  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    uptime: process.uptime()
  };
}
```

## 📚 参考资源

### 官方文档

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [TypeScript 文档](https://www.typescriptlang.org/docs/)
- [Node.js 文档](https://nodejs.org/docs/)

### 开发工具

- [VS Code](https://code.visualstudio.com/)
- [Postman](https://www.postman.com/)
- [Git](https://git-scm.com/)

### 学习资源

- [TypeScript 深入理解](https://basarat.gitbook.io/typescript/)
- [Node.js 最佳实践](https://github.com/goldbergyoni/nodebestpractices)
- [Jest 测试指南](https://jestjs.io/docs/getting-started)

---

**维护者**: LDIMS 开发团队  
**最后更新**: 2024年12月  
**文档版本**: 1.0.0