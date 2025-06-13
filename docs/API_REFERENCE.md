# LDIMS MCP 服务 API 参考

> **完整的 MCP 工具和资源 API 文档**

## 📋 概述

LDIMS MCP 服务提供符合 [Model Context Protocol](https://modelcontextprotocol.io/)
标准的 API 接口，包括：

- **2 个 MCP 工具 (Tools)**: 可被 AI 模型调用的函数
- **1 个 MCP 资源 (Resources)**: 可被客户端读取的数据源

## 🛠️ MCP 工具 (Tools)

### 1. searchDocuments

在 LDIMS 系统中搜索文档，支持自然语言查询和语义搜索。

#### 基本信息

- **工具名称**: `searchDocuments`
- **描述**: 在LDIMS系统中搜索文档。支持自然语言查询和语义搜索，帮助用户快速找到相关文档。
- **类型**: MCP Tool

#### 输入参数

```typescript
interface SearchDocumentsInput {
  query: string; // 必需：搜索查询字符串
  maxResults?: number; // 可选：返回结果的最大数量
  filters?: SearchFilters; // 可选：搜索过滤条件
}

interface SearchFilters {
  dateFrom?: string; // 可选：文档创建/修改起始日期过滤（ISO格式）
  dateTo?: string; // 可选：文档创建/修改结束日期过滤（ISO格式）
  documentType?: string; // 可选：按文档类型/格式过滤
  submitter?: string; // 可选：按文档提交人过滤
  searchMode?: "exact" | "semantic"; // 可选：搜索模式
}
```

#### 参数详细说明

| 参数                   | 类型   | 必需 | 默认值     | 描述                                                                 |
| ---------------------- | ------ | ---- | ---------- | -------------------------------------------------------------------- |
| `query`                | string | ✅   | -          | 自然语言或关键词搜索查询。请具体描述您要查找的信息内容。             |
| `maxResults`           | number | ❌   | 5          | 返回结果的最大数量。范围：1-50。如需更全面的结果可使用更大的数值。   |
| `filters.dateFrom`     | string | ❌   | -          | 文档创建/修改起始日期过滤，ISO 8601 格式（如：2024-01-01T00:00:00Z） |
| `filters.dateTo`       | string | ❌   | -          | 文档创建/修改结束日期过滤，ISO 8601 格式                             |
| `filters.documentType` | string | ❌   | -          | 按文档类型/格式过滤（如：PDF、Word、Excel）                          |
| `filters.submitter`    | string | ❌   | -          | 按文档提交人过滤                                                     |
| `filters.searchMode`   | enum   | ❌   | "semantic" | 搜索模式：'exact'精确匹配，'semantic'语义匹配                        |

#### 使用示例

**基本搜索**:

```json
{
  "name": "searchDocuments",
  "arguments": {
    "query": "技术规范文档"
  }
}
```

**高级搜索**:

```json
{
  "name": "searchDocuments",
  "arguments": {
    "query": "项目管理相关的文档",
    "maxResults": 10,
    "filters": {
      "searchMode": "semantic",
      "documentType": "PDF",
      "dateFrom": "2024-01-01T00:00:00Z",
      "dateTo": "2024-12-31T23:59:59Z",
      "submitter": "张三"
    }
  }
}
```

### 2. get_document_file_content

获取 LDIMS 系统中指定文档的原始文件内容。

#### 基本信息

- **工具名称**: `get_document_file_content`
- **描述**: 获取LDIMS系统中指定文档的原始文件内容
- **类型**: MCP Tool

#### 输入参数

```typescript
interface GetDocumentFileContentInput {
  file_id: string; // 必需：文档的唯一标识符
}
```

#### 参数详细说明

| 参数      | 类型   | 必需 | 描述                                              |
| --------- | ------ | ---- | ------------------------------------------------- |
| `file_id` | string | ✅   | 文档的唯一标识符，用于在 LDIMS 系统中定位特定文档 |

#### 使用示例

```json
{
  "name": "get_document_file_content",
  "arguments": {
    "file_id": "doc-12345"
  }
}
```

## 📄 MCP 资源 (Resources)

### 1. ldims://docs/{document_id}/extracted_content

获取 LDIMS 系统中文档的提取文本内容。

#### 基本信息

- **资源名称**: `LDIMS文档提取内容`
- **URI 模式**: `ldims://docs/{document_id}/extracted_content`
- **描述**: 获取LDIMS系统中文档的提取文本内容，支持各种文档格式的内容提取
- **MIME 类型**: `text/plain`

#### URI 参数

| 参数          | 类型   | 必需 | 描述             |
| ------------- | ------ | ---- | ---------------- |
| `document_id` | string | ✅   | 文档的唯一标识符 |

#### 使用示例

**URI**: `ldims://docs/doc-12345/extracted_content`

## 🔧 通用错误处理

### 错误响应格式

所有错误都遵循统一的响应格式：

```typescript
interface McpErrorResponse {
  isError: true;
  errorCode: string;
  errorMessage: string;
  userMessage?: string;
  details?: Record<string, any>;
  timestamp: string;
}
```

### 常见错误码

| 错误码               | 描述         | 常见原因                   |
| -------------------- | ------------ | -------------------------- |
| `INVALID_PARAMS`     | 参数验证失败 | 参数类型错误、缺少必需参数 |
| `TOOL_NOT_FOUND`     | 工具不存在   | 调用了不存在的工具名称     |
| `RESOURCE_NOT_FOUND` | 资源不存在   | 请求了不存在的资源         |
| `API_ERROR`          | API 调用失败 | LDIMS 后端 API 不可用      |
| `TIMEOUT`            | 请求超时     | 网络延迟或服务器响应慢     |
| `INTERNAL_ERROR`     | 内部错误     | 服务器内部异常             |

---

**最后更新**: 2024年12月  
**API 版本**: 1.0.0
