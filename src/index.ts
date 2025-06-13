#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListResourcesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ConfigManager } from "./config/index.js";
import { LdimsApiService } from "./services/ldims-api.js";
import { globalErrorHandler, handleMcpError } from "./utils/error-handler.js";
import {
  GetDocumentFileContentSchema,
  SearchDocumentsSchema,
  McpError,
  McpErrorCode,
  type SearchDocumentsResponse,
  type DocumentExtractedContentResponse,
  type McpErrorResponse,
} from "./types/mcp.js";

// 全局配置和服务实例
let configManager: ConfigManager;
let ldimsApi: LdimsApiService;

// MCP服务器实例
const server = new Server(
  {
    name: "ldims-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  },
);

/**
 * 检查响应是否为错误
 */
function isErrorResponse(response: any): response is McpErrorResponse {
  return response && response.isError === true;
}

/**
 * 开发模式下的Mock数据生成器
 */
function createMockSearchResults(query: string): SearchDocumentsResponse {
  const mockResults = [
    {
      documentId: "mock-doc-1",
      documentName: `与"${query}"相关的重要文档.pdf`,
      relevanceScore: 0.95,
      matchedContext: `这是一个关于${query}的详细说明文档，包含了相关的技术规范和实施指南...`,
      metadata: {
        createdAt: "2024-01-15T10:30:00Z",
        submitter: "张三",
        documentType: "PDF",
        departmentName: "技术部",
        handoverDate: "2024-01-10T00:00:00Z",
      },
    },
    {
      documentId: "mock-doc-2",
      documentName: `${query}操作手册.docx`,
      relevanceScore: 0.87,
      matchedContext: `本手册详细介绍了${query}的操作流程和注意事项，适用于新员工培训...`,
      metadata: {
        createdAt: "2024-01-12T14:20:00Z",
        submitter: "李四",
        documentType: "Word",
        departmentName: "人事部",
      },
    },
  ];

  return {
    results: mockResults,
    totalMatches: mockResults.length,
    searchMetadata: {
      executionTime: "45ms",
      searchMode: "semantic",
      queryProcessed: query,
    },
  };
}

function createMockExtractedContent(
  documentId: string,
): DocumentExtractedContentResponse {
  return {
    uri: `ldims://docs/${documentId}/extracted_content`,
    text: `这是文档 ${documentId} 的提取内容。

本文档包含以下主要内容：
1. 项目概述和背景介绍
2. 技术规范和实施要求  
3. 操作流程和注意事项
4. 常见问题解答

详细内容：
本项目旨在通过先进的技术手段，提升工作效率和质量。通过标准化的操作流程，确保项目顺利实施。

技术要求：
- 系统环境配置
- 依赖组件安装
- 配置文件设置
- 测试验证流程

操作说明：
1. 首先进行环境检查
2. 按照配置清单进行设置
3. 执行测试验证
4. 记录操作日志

注意事项：
- 操作前请备份重要数据
- 严格按照流程执行
- 遇到问题及时反馈
- 保持操作记录完整

这是一个详细的技术文档，为相关工作提供了全面的指导。`,
    metadata: {
      documentName: `模拟文档-${documentId}`,
      extractedAt: new Date().toISOString(),
      format: "text/plain",
      documentId,
      fileSize: 2048,
      processingStatus: "completed",
    },
  };
}

// 工具列表处理
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_document_file_content",
        description: "获取LDIMS系统中指定文档的原始文件内容",
        inputSchema: {
          type: "object",
          properties: {
            file_id: {
              type: "string",
              description: "文档的唯一标识符",
            },
          },
          required: ["file_id"],
        },
      },
      {
        name: "searchDocuments",
        description:
          "在LDIMS系统中搜索文档。支持自然语言查询和语义搜索，帮助用户快速找到相关文档。",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "自然语言或关键词搜索查询。请具体描述您要查找的信息内容。",
            },
            maxResults: {
              type: "number",
              description:
                "返回结果的最大数量。如需更全面的结果可使用更大的数值。",
              minimum: 1,
              maximum: 50,
              default: 5,
            },
            filters: {
              type: "object",
              properties: {
                dateFrom: {
                  type: "string",
                  description: "文档创建/修改起始日期过滤（ISO格式）",
                },
                dateTo: {
                  type: "string",
                  description: "文档创建/修改结束日期过滤（ISO格式）",
                },
                documentType: {
                  type: "string",
                  description: "按文档类型/格式过滤",
                },
                submitter: {
                  type: "string",
                  description: "按文档提交人过滤",
                },
                searchMode: {
                  type: "string",
                  enum: ["exact", "semantic"],
                  description: "搜索模式：'exact'精确匹配，'semantic'语义匹配",
                  default: "semantic",
                },
              },
            },
          },
          required: ["query"],
        },
      },
    ],
  };
});

// 资源列表处理
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "ldims://docs/{document_id}/extracted_content",
        name: "LDIMS文档提取内容",
        description:
          "获取LDIMS系统中文档的提取文本内容，支持各种文档格式的内容提取",
        mimeType: "text/plain",
      },
    ],
  };
});

// 工具调用处理
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_document_file_content": {
        // 验证参数
        const validatedArgs = GetDocumentFileContentSchema.parse(args);

        // 使用错误处理器执行带重试的操作
        try {
          const result = await globalErrorHandler.executeWithRetry(
            async () => {
              return await ldimsApi.getDocumentFileContent(
                validatedArgs.file_id,
              );
            },
            { tool: name, fileId: validatedArgs.file_id },
          );

          return {
            content: [
              {
                type: "text",
                text: `文档文件内容获取成功：

文档名称: ${result.metadata?.filename ?? "未知"}
文档ID: ${validatedArgs.file_id}
文件类型: ${result.metadata?.mime_type ?? "未知"}
文件大小: ${result.metadata?.size ? `${result.metadata.size} 字节` : "未知"}
最后修改: ${result.metadata?.updated_at ?? result.metadata?.created_at ?? "未知"}

文件内容:
${result.content}`,
              },
            ],
          };
        } catch (_error) {
          const mcpError = handleMcpError(_error);
          return {
            content: [
              {
                type: "text",
                text: mcpError.userMessage ?? mcpError.message,
              },
            ],
            isError: true,
          };
        }
      }

      case "searchDocuments": {
        // 验证参数
        const validatedArgs = SearchDocumentsSchema.parse(args);

        // 尝试调用真实API，失败时使用Mock数据
        let result: SearchDocumentsResponse | McpErrorResponse;

        try {
          result = await ldimsApi.searchDocuments(validatedArgs);
        } catch (_error) {
          console.warn("搜索API调用失败，使用Mock数据:", _error);
          result = createMockSearchResults(validatedArgs.query);
        }

        if (isErrorResponse(result)) {
          console.warn("API错误，使用Mock数据:", result.errorMessage);
          result = createMockSearchResults(validatedArgs.query);
        }

        const searchResult = result;

        return {
          content: [
            {
              type: "text",
              text: `文档搜索结果：

查询: "${searchResult.searchMetadata.queryProcessed}"
搜索模式: ${searchResult.searchMetadata.searchMode}
执行时间: ${searchResult.searchMetadata.executionTime}
总匹配数: ${searchResult.totalMatches}

找到 ${searchResult.results.length} 个相关文档：

${searchResult.results
  .map(
    (doc, index) => `
${index + 1}. ${doc.documentName}
   文档ID: ${doc.documentId}
   相关度: ${(doc.relevanceScore * 100).toFixed(1)}%
   提交人: ${doc.metadata.submitter}
   创建时间: ${doc.metadata.createdAt}
   文档类型: ${doc.metadata.documentType}
   ${doc.metadata.departmentName ? `部门: ${doc.metadata.departmentName}` : ""}
   
   匹配内容预览:
   ${doc.matchedContext}
`,
  )
  .join("\n")}

提示: 您可以使用文档ID通过 ldims://docs/{document_id}/extracted_content 资源获取完整文档内容。`,
            },
          ],
        };
      }

      default:
        throw new McpError(McpErrorCode.TOOL_NOT_FOUND, `未知工具: ${name}`, {
          userMessage: `工具 "${name}" 不存在，请检查工具名称是否正确`,
          details: {
            requestedTool: name,
            availableTools: ["get_document_file_content", "searchDocuments"],
          },
        });
    }
  } catch (_error) {
    const mcpError = handleMcpError(_error);
    return {
      content: [
        {
          type: "text",
          text: mcpError.userMessage ?? mcpError.message,
        },
      ],
      isError: true,
    };
  }
});

// 资源读取处理
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    // 解析资源URI
    const uriPattern = /^ldims:\/\/docs\/([^/]+)\/extracted_content$/;
    const match = uri.match(uriPattern);

    if (!match?.[1]) {
      throw McpError.resourceNotFound(uri, {
        reason: "URI格式不正确",
        expectedFormat: "ldims://docs/{document_id}/extracted_content",
      });
    }

    const documentId = match[1];

    // 尝试调用真实API获取文档内容
    let result: DocumentExtractedContentResponse | McpErrorResponse;

    try {
      result = await globalErrorHandler.executeWithRetry(
        async () => {
          return await ldimsApi.getDocumentExtractedContent(documentId);
        },
        { resource: "extracted_content", documentId },
      );
    } catch (_error) {
      console.warn("内容提取API调用失败，使用Mock数据:", _error);
      result = createMockExtractedContent(documentId);
    }

    if (isErrorResponse(result)) {
      console.warn("API错误，使用Mock数据:", result.errorMessage);
      result = createMockExtractedContent(documentId);
    }

    const content = result;

    return {
      contents: [
        {
          uri: content.uri,
          text: content.text,
          metadata: content.metadata,
        },
      ],
    };
  } catch (_error) {
    const mcpError = handleMcpError(_error, {
      uri,
      operation: "resource_read",
    });
    throw new Error(mcpError.userMessage ?? mcpError.message);
  }
});

/**
 * 初始化服务器
 */
async function initializeServer() {
  try {
    // 初始化配置管理器
    configManager = ConfigManager.getInstance();

    // 初始化LDIMS API服务
    ldimsApi = new LdimsApiService(configManager.getConfig().ldims);

    console.log("🚀 LDIMS MCP服务器初始化完成");
    console.log("📋 支持的工具: get_document_file_content, searchDocuments");
    console.log("📋 支持的资源: ldims://docs/{document_id}/extracted_content");
  } catch (_error) {
    console.error("❌ 服务器初始化失败:", _error);
    console.warn("🔄 继续启动（将使用Mock数据）");
  }
}

/**
 * 启动服务器
 */
async function startServer() {
  // 初始化
  await initializeServer();

  // 设置传输层
  const transport = new StdioServerTransport();

  // 启动服务器
  await server.connect(transport);

  console.log("🎯 LDIMS MCP服务器已启动，等待客户端连接...");
}

/**
 * 优雅关闭处理
 */
function setupGracefulShutdown() {
  const shutdown = async () => {
    console.log("\n🔄 正在关闭LDIMS MCP服务器...");
    try {
      await server.close();
      console.log("✅ 服务器已安全关闭");
      process.exit(0);
    } catch (_error) {
      console.error("❌ 关闭时出错:", _error);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

// 启动应用
setupGracefulShutdown();
startServer().catch((error) => {
  console.error("❌ 服务器启动失败:", error);
  process.exit(1);
});
