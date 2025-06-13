# LDIMS MCP 服务

> **LDIMS (文档信息管理系统) Model Context Protocol 服务**  
> 为 AI 模型提供标准化的文档管理接口

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5%2B-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-1.12.2-orange.svg)](https://modelcontextprotocol.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📋 项目概述

LDIMS MCP 服务是基于 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
标准构建的文档管理服务，为 AI 模型提供：

- 🔍 **智能文档搜索**: 支持自然语言查询和语义搜索
- 📄 **文档内容提取**: 获取文档的完整文本内容
- 🔗 **标准化接口**: 符合 MCP 协议的工具和资源接口
- 🛡️ **类型安全**: 完整的 TypeScript 类型定义和参数验证

## 🚀 快速开始

### 环境要求

- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0
- **TypeScript**: >= 5.5.4

### 安装步骤

1. **克隆项目**

   ```bash
   git clone <repository-url>
   cd backend_mcp
   ```

2. **安装依赖**

   ```bash
   npm install
   ```

3. **环境配置**

   ```bash
   # 复制环境变量模板
   cp .env.example .env

   # 编辑配置文件
   nano .env
   ```

4. **构建项目**

   ```bash
   npm run build
   ```

5. **启动服务**

   ```bash
   # 开发模式
   npm run dev

   # 生产模式
   npm start
   ```

## ⚙️ 配置说明

### 环境变量配置

在 `.env` 文件中配置以下变量：

```env
# 服务器配置
MCP_SERVER_NAME=ldims-mcp-server
MCP_SERVER_VERSION=1.0.0

# LDIMS API 配置
LDIMS_API_BASE_URL=http://localhost:3000/api
LDIMS_API_VERSION=v1
LDIMS_AUTH_TOKEN=your-auth-token-here
LDIMS_API_TIMEOUT=30000
LDIMS_API_RETRY_COUNT=3

# 日志配置
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE=logs/mcp-service.log

# 错误处理配置
ERROR_DETAILED=true
ERROR_STACK_TRACE=true
ERROR_RETRY_DELAY=1000
ERROR_MAX_RETRIES=3

# 运行环境
NODE_ENV=development
```

### 配置验证

服务启动时会自动验证配置：

- ✅ **必需配置**: LDIMS_API_BASE_URL
- ⚠️ **可选配置**: 其他配置项有默认值
- 🔧 **配置错误**: 会显示详细的错误信息和修复建议

## 🛠️ MCP 功能

### 支持的工具 (Tools)

#### 1. `searchDocuments` - 文档搜索

**功能**: 在 LDIMS 系统中搜索文档，支持自然语言查询

**参数**:

```typescript
{
  query: string;           // 搜索查询（必需）
  maxResults?: number;     // 最大结果数量（默认: 5）
  filters?: {
    dateFrom?: string;     // 起始日期过滤
    dateTo?: string;       // 结束日期过滤
    documentType?: string; // 文档类型过滤
    submitter?: string;    // 提交人过滤
    searchMode?: "exact" | "semantic"; // 搜索模式
  };
}
```

**使用示例**:

```json
{
  "name": "searchDocuments",
  "arguments": {
    "query": "技术规范文档",
    "maxResults": 10,
    "filters": {
      "searchMode": "semantic",
      "documentType": "PDF"
    }
  }
}
```

#### 2. `get_document_file_content` - 获取文档内容

**功能**: 获取指定文档的原始文件内容

**参数**:

```typescript
{
  file_id: string; // 文档文件ID（必需）
}
```

**使用示例**:

```json
{
  "name": "get_document_file_content",
  "arguments": {
    "file_id": "doc-12345"
  }
}
```

### 支持的资源 (Resources)

#### 1. `ldims://docs/{document_id}/extracted_content` - 文档提取内容

**功能**: 获取文档的提取文本内容

**URI 格式**: `ldims://docs/{document_id}/extracted_content`

**使用示例**:

```
ldims://docs/doc-12345/extracted_content
```

## 🔧 开发指南

### 项目结构

```
backend_mcp/
├── src/                    # 源代码
│   ├── config/            # 配置管理
│   ├── services/          # 业务服务
│   ├── types/             # 类型定义
│   ├── utils/             # 工具函数
│   └── index.ts           # 入口文件
├── tests/                 # 测试文件
├── docs/                  # 文档目录
├── scripts/               # 构建脚本
└── dist/                  # 编译输出
```

### 开发命令

```bash
# 开发模式（热重载）
npm run dev

# 构建项目
npm run build

# 运行测试
npm test

# 代码检查
npm run lint

# 代码格式化
npm run format

# 代码质量检查
npm run quality

# 自动修复代码问题
npm run quality:fix
```

### 代码质量

项目使用以下工具确保代码质量：

- **ESLint**: 代码规范检查
- **Prettier**: 代码格式化
- **TypeScript**: 类型检查
- **Jest**: 单元测试

### 调试模式

启用调试模式查看详细日志：

```bash
# 设置调试级别
export LOG_LEVEL=debug

# 启动服务
npm run dev
```

## 🧪 测试

### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- --testPathPattern=config

# 生成覆盖率报告
npm run test:coverage
```

### 测试覆盖率

当前测试覆盖率目标：

- **语句覆盖率**: >= 85%
- **分支覆盖率**: >= 80%
- **函数覆盖率**: >= 90%
- **行覆盖率**: >= 85%

## 📊 性能监控

### 内置监控指标

- **请求响应时间**: 记录每个 MCP 工具调用的执行时间
- **内存使用情况**: 监控服务内存占用
- **错误率统计**: 跟踪错误发生频率
- **API 调用统计**: 记录 LDIMS API 调用次数和成功率

### 查看监控数据

```bash
# 查看实时日志
tail -f logs/mcp-service.log

# 查看性能报告
npm run analyze
```

## 🚨 故障排除

### 常见问题

#### 1. 服务启动失败

**问题**: `Cannot find module` 错误

**解决方案**:

```bash
# 重新安装依赖
rm -rf node_modules package-lock.json
npm install

# 重新构建
npm run build
```

#### 2. LDIMS API 连接失败

**问题**: `ECONNREFUSED` 或超时错误

**解决方案**:

1. 检查 `LDIMS_API_BASE_URL` 配置
2. 确认 LDIMS 后端服务正在运行
3. 检查网络连接和防火墙设置

#### 3. 配置验证失败

**问题**: 环境变量验证错误

**解决方案**:

1. 检查 `.env` 文件是否存在
2. 确认所有必需的环境变量已设置
3. 参考 `.env.example` 文件格式

#### 4. TypeScript 编译错误

**问题**: 类型检查失败

**解决方案**:

```bash
# 检查 TypeScript 配置
npx tsc --noEmit

# 更新类型定义
npm update @types/*
```

### 调试技巧

1. **启用详细日志**:

   ```bash
   export LOG_LEVEL=debug
   export ERROR_DETAILED=true
   ```

2. **使用开发模式**:

   ```bash
   export NODE_ENV=development
   npm run dev
   ```

3. **检查配置加载**:
   ```bash
   node -e "console.log(require('./dist/config').getConfig())"
   ```

## 📚 API 参考

详细的 API 文档请参考：

- [API 参考文档](docs/API_REFERENCE.md)
- [开发者指南](docs/DEVELOPER_GUIDE.md)
- [故障排除指南](docs/TROUBLESHOOTING.md)

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 代码规范

- 遵循 ESLint 配置
- 使用 Prettier 格式化代码
- 编写单元测试
- 更新相关文档

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🔗 相关链接

- [LDIMS 主项目](../README.md)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [TypeScript 文档](https://www.typescriptlang.org/docs/)
- [Node.js 文档](https://nodejs.org/docs/)

## 📞 支持

如有问题或建议，请：

1. 查看 [故障排除指南](docs/TROUBLESHOOTING.md)
2. 搜索现有的 [Issues](../../issues)
3. 创建新的 Issue 描述问题

---

**开发团队**: LDIMS Team  
**最后更新**: 2024年12月  
**版本**: 1.0.0
