#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListResourcesRequestSchema
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
  type McpErrorResponse
} from "./types/mcp.js";

// 全局配置和服务实例
let configManager: ConfigManager;
let ldimsApi: LdimsApiService;

// MCP服务器实例
const server = new Server(
  {
    name: "ldims-mcp-server",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

/**
 * 检查响应是否为错误
 */
function isErrorResponse(response: any): response is McpErrorResponse {
  return response && response.isError === true;
}

/**
 * P3-T2: 增强的Mock数据生成器
 * 更智能地根据查询内容生成相关的模拟搜索结果
 *
 * 注意：此功能已被禁用，系统现在直接返回API错误而不是Mock数据
 */
/*
function createMockSearchResults(query: string): SearchDocumentsResponse {
  console.log(`[P3-T2] 生成Mock搜索结果，查询: "${query}"`);

  // 根据查询内容智能生成相关的文档类型和内容
  const queryLower = query.toLowerCase();
  const isAPIRelated = queryLower.includes("api") || queryLower.includes("接口");
  const isSystemRelated = queryLower.includes("系统") || queryLower.includes("配置");
  const isDocumentRelated = queryLower.includes("文档") || queryLower.includes("说明");
  const isTestRelated = queryLower.includes("测试") || queryLower.includes("test");

  const mockResults = [];

  // 生成第一个高相关度文档
  if (isAPIRelated) {
    mockResults.push({
      documentId: "mock-api-doc-001",
      documentName: `${query} API技术规范文档.pdf`,
      relevanceScore: 0.94,
      matchedContext: `本文档详细描述了${query}相关的API接口设计、调用方法和最佳实践。包含完整的接口定义、参数说明、响应格式和错误处理机制...`,
      metadata: {
        createdAt: "2024-01-15T10:30:00Z",
        submitter: "API架构师",
        documentType: "PDF",
        departmentName: "技术架构部",
        handoverDate: "2024-01-10T00:00:00Z"
      }
    });
  } else if (isSystemRelated) {
    mockResults.push({
      documentId: "mock-sys-doc-001",
      documentName: `${query}系统配置指南.docx`,
      relevanceScore: 0.91,
      matchedContext: `${query}系统的完整配置指南，包含环境搭建、参数调优、监控配置等关键信息，适用于系统管理员和运维人员...`,
      metadata: {
        createdAt: "2024-01-12T14:20:00Z",
        submitter: "系统管理员",
        documentType: "Word",
        departmentName: "运维部",
        handoverDate: "2024-01-08T00:00:00Z"
      }
    });
  } else {
    mockResults.push({
      documentId: "mock-general-doc-001",
      documentName: `关于"${query}"的重要文档.pdf`,
      relevanceScore: 0.89,
      matchedContext: `这是一个关于${query}的综合性文档，涵盖了相关的概念、实施方案、注意事项和最佳实践，为团队提供全面的指导...`,
      metadata: {
        createdAt: "2024-01-20T09:15:00Z",
        submitter: "项目经理",
        documentType: "PDF",
        departmentName: "项目管理部",
        handoverDate: "2024-01-18T00:00:00Z"
      }
    });
  }

  // 生成第二个中等相关度文档
  if (isTestRelated) {
    mockResults.push({
      documentId: "mock-test-doc-002",
      documentName: `${query}测试用例和验证方案.xlsx`,
      relevanceScore: 0.82,
      matchedContext: `${query}相关功能的测试用例设计文档，包含功能测试、性能测试、安全测试等多个维度的验证方案和预期结果...`,
      metadata: {
        createdAt: "2024-01-18T16:45:00Z",
        submitter: "测试工程师",
        documentType: "Excel",
        departmentName: "质量保证部",
        handoverDate: "2024-01-15T00:00:00Z"
      }
    });
  } else if (isDocumentRelated) {
    mockResults.push({
      documentId: "mock-doc-handbook-002",
      documentName: `${query}操作手册和培训资料.pptx`,
      relevanceScore: 0.85,
      matchedContext: `${query}的操作手册，包含详细的操作流程、常见问题解答和培训课件，适用于新员工培训和日常操作参考...`,
      metadata: {
        createdAt: "2024-01-14T11:30:00Z",
        submitter: "培训专员",
        documentType: "PowerPoint",
        departmentName: "人力资源部"
      }
    });
  } else {
    mockResults.push({
      documentId: "mock-ref-doc-002",
      documentName: `${query}参考资料汇编.docx`,
      relevanceScore: 0.78,
      matchedContext: `${query}相关的参考资料和案例分析，包含行业最佳实践、经验总结和常见问题的解决方案，为团队提供参考...`,
      metadata: {
        createdAt: "2024-01-16T13:20:00Z",
        submitter: "业务分析师",
        documentType: "Word",
        departmentName: "业务发展部",
        handoverDate: "2024-01-12T00:00:00Z"
      }
    });
  }

  // 根据查询复杂度可能添加第三个文档
  if (query.length > 5) {
    mockResults.push({
      documentId: "mock-related-doc-003",
      documentName: `${query}相关技术调研报告.pdf`,
      relevanceScore: 0.73,
      matchedContext: `针对${query}进行的技术调研和可行性分析报告，包含技术选型建议、实施方案对比和风险评估...`,
      metadata: {
        createdAt: "2024-01-10T08:45:00Z",
        submitter: "技术顾问",
        documentType: "PDF",
        departmentName: "技术研发部",
        handoverDate: "2024-01-08T00:00:00Z"
      }
    });
  }

  const totalResults = mockResults.length;
  console.log(`[P3-T2] ✅ 生成了 ${totalResults} 个Mock搜索结果`);

  return {
    results: mockResults,
    totalMatches: totalResults,
    searchMetadata: {
      executionTime: `${Math.floor(Math.random() * 50 + 30)}ms`, // 模拟真实的响应时间
      searchMode: "semantic",
      queryProcessed: query
    }
  };
}
*/

/*
function createMockExtractedContent(documentId: string): DocumentExtractedContentResponse {
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
- 依赖项安装和配置  
- 性能优化设置
- 安全配置要求

操作流程：
1. 环境准备和初始化
2. 系统配置和参数调优
3. 功能测试和验证
4. 部署上线和监控

注意事项：
- 严格按照操作流程执行
- 及时备份重要数据
- 监控系统运行状态
- 定期进行安全检查

常见问题：
Q: 如何解决配置错误？
A: 检查配置文件格式和参数设置，确保符合规范要求。

Q: 性能优化有哪些方法？
A: 可以通过调整系统参数、优化数据库配置、使用缓存等方式提升性能。

更多详细信息请参考相关技术文档和操作手册。`,
    metadata: {
      documentName: `Mock文档-${documentId}`,
      extractedAt: new Date().toISOString(),
      format: "text/plain",
      documentId,
      fileSize: 2048,
      processingStatus: "completed" as const
    }
  };
}
*/

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
              description: "文档的唯一标识符"
            }
          },
          required: ["file_id"]
        }
      },
      {
        name: "searchDocuments",
        description: "在LDIMS系统中搜索文档。支持自然语言查询和语义搜索，帮助用户快速找到相关文档。",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "自然语言或关键词搜索查询。请具体描述您要查找的信息内容。"
            },
            maxResults: {
              type: "number",
              description: "返回结果的最大数量。如需更全面的结果可使用更大的数值。",
              minimum: 1,
              maximum: 50,
              default: 5
            },
            filters: {
              type: "object",
              properties: {
                dateFrom: {
                  type: "string",
                  description: "文档创建/修改起始日期过滤（ISO格式）"
                },
                dateTo: {
                  type: "string",
                  description: "文档创建/修改结束日期过滤（ISO格式）"
                },
                documentType: {
                  type: "string",
                  description: "按文档类型/格式过滤"
                },
                submitter: {
                  type: "string",
                  description: "按文档提交人过滤"
                },
                searchMode: {
                  type: "string",
                  enum: ["exact", "semantic"],
                  description: "搜索模式：'exact'精确匹配，'semantic'语义匹配",
                  default: "semantic"
                }
              }
            }
          },
          required: ["query"]
        }
      }
    ]
  };
});

// 资源列表处理
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "ldims://docs/{document_id}/extracted_content",
        name: "LDIMS文档提取内容",
        description: "获取LDIMS系统中文档的提取文本内容，支持各种文档格式的内容提取",
        mimeType: "text/plain"
      }
    ]
  };
});

// 工具调用处理
server.setRequestHandler(CallToolRequestSchema, async request => {
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
              return await ldimsApi.getDocumentFileContent(validatedArgs.file_id);
            },
            { tool: name, fileId: validatedArgs.file_id }
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
${result.content}`
              }
            ]
          };
        } catch (_error) {
          const mcpError = handleMcpError(_error);
          return {
            content: [
              {
                type: "text",
                text: mcpError.userMessage ?? mcpError.message
              }
            ],
            isError: true
          };
        }
      }

      case "searchDocuments": {
        // 验证参数
        const validatedArgs = SearchDocumentsSchema.parse(args);

        console.log(`[P3-T2] 开始文档搜索: "${validatedArgs.query}"`);
        console.log(
          `[P3-T2] 搜索参数: maxResults=${validatedArgs.maxResults}, filters=${JSON.stringify(validatedArgs.filters || {})}`
        );

        // 尝试调用真实API
        let result: SearchDocumentsResponse | McpErrorResponse;

        try {
          console.log("[P3-T2] 尝试调用真实LDIMS API...");

          result = await globalErrorHandler.executeWithRetry(
            async () => {
              return await ldimsApi.searchDocuments(validatedArgs);
            },
            {
              tool: "searchDocuments",
              query: validatedArgs.query,
              maxResults: validatedArgs.maxResults
            }
          );

          if (isErrorResponse(result)) {
            // 直接返回API错误，不使用Mock数据
            throw new McpError(McpErrorCode.API_SERVER_ERROR, `LDIMS API搜索失败: ${result.errorMessage}`, {
              userMessage: `文档搜索失败: ${result.errorMessage}`,
              details: {
                query: validatedArgs.query,
                errorCode: result.errorCode,
                errorDetails: result.errorDetails
              }
            });
          } else {
            console.log(`[P3-T2] ✅ 真实API调用成功！找到 ${result.results.length} 个文档`);
          }
        } catch (_error) {
          // 直接抛出错误，不使用Mock数据
          if (_error instanceof McpError) {
            throw _error;
          }

          const errorMessage = _error instanceof Error ? _error.message : String(_error);
          console.error(`[P3-T2] API连接失败: ${errorMessage}`);

          throw new McpError(McpErrorCode.API_CONNECTION_FAILED, `LDIMS API连接失败: ${errorMessage}`, {
            userMessage: `无法连接到LDIMS服务，请检查网络连接和服务状态。错误: ${errorMessage}`,
            details: {
              query: validatedArgs.query,
              endpoint: "searchDocuments"
            }
          });
        }

        const searchResult = result;

        // 生成正常的搜索结果输出
        return {
          content: [
            {
              type: "text",
              text: `🔍 文档搜索结果

📊 数据源: LDIMS API
查询: "${searchResult.searchMetadata.queryProcessed}"
搜索模式: ${searchResult.searchMetadata.searchMode}
执行时间: ${searchResult.searchMetadata.executionTime}
总匹配数: ${searchResult.totalMatches}

找到 ${searchResult.results.length} 个相关文档：

${searchResult.results
  .map(
    (doc, index) => `📄 ${index + 1}. ${doc.documentName}
   🆔 文档ID: ${doc.documentId}
   📈 相关度: ${(doc.relevanceScore * 100).toFixed(1)}%
   👤 提交人: ${doc.metadata.submitter}
   📅 创建时间: ${new Date(doc.metadata.createdAt).toLocaleString("zh-CN")}
   📋 文档类型: ${doc.metadata.documentType}
   ${doc.metadata.departmentName ? `🏢 部门: ${doc.metadata.departmentName}` : ""}
   📁 文件数量: ${doc.metadata.fileCount || 0}
   ${
     doc.metadata.fileDetails && doc.metadata.fileDetails.length > 0
       ? `📎 文件列表:\n${doc.metadata.fileDetails.map(file => `     • 文件ID: ${file.fileId} | 文件名: ${file.fileName} | 内容长度: ${file.contentLength}字符`).join("\n")}`
       : ""
   }
   
   📝 匹配内容预览:
   ${doc.matchedContext}
`
  )
  .join("\n")}

💡 下一步操作:
• 使用 ldims://docs/{document_id}/extracted_content 资源获取完整文档内容
• 通过文档ID调用 get_document_file_content 工具获取原始文件`
            }
          ]
        };
      }

      default:
        throw new McpError(McpErrorCode.TOOL_NOT_FOUND, `未知工具: ${name}`, {
          userMessage: `工具 "${name}" 不存在，请检查工具名称是否正确`,
          details: {
            requestedTool: name,
            availableTools: ["get_document_file_content", "searchDocuments"]
          }
        });
    }
  } catch (_error) {
    const mcpError = handleMcpError(_error);
    return {
      content: [
        {
          type: "text",
          text: mcpError.userMessage ?? mcpError.message
        }
      ],
      isError: true
    };
  }
});

// 资源读取处理
server.setRequestHandler(ReadResourceRequestSchema, async request => {
  const { uri } = request.params;

  try {
    // 解析资源URI
    const uriPattern = /^ldims:\/\/docs\/([^/]+)\/extracted_content$/;
    const match = uri.match(uriPattern);

    if (!match?.[1]) {
      throw McpError.resourceNotFound(uri, {
        reason: "URI格式不正确",
        expectedFormat: "ldims://docs/{document_id}/extracted_content"
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
        { resource: "extracted_content", documentId }
      );

      if (isErrorResponse(result)) {
        // 直接返回API错误，不使用Mock数据
        throw new McpError(McpErrorCode.API_SERVER_ERROR, `文档内容提取失败: ${result.errorMessage}`, {
          userMessage: `无法获取文档内容: ${result.errorMessage}`,
          details: {
            documentId,
            errorCode: result.errorCode,
            errorDetails: result.errorDetails
          }
        });
      }
    } catch (_error) {
      // 直接抛出错误，不使用Mock数据
      if (_error instanceof McpError) {
        throw _error;
      }

      const errorMessage = _error instanceof Error ? _error.message : String(_error);
      console.error("文档内容提取API调用失败:", errorMessage);

      throw new McpError(McpErrorCode.API_CONNECTION_FAILED, `文档内容提取API连接失败: ${errorMessage}`, {
        userMessage: `无法连接到LDIMS服务获取文档内容，请检查网络连接和服务状态。错误: ${errorMessage}`,
        details: {
          documentId,
          operation: "getDocumentExtractedContent"
        }
      });
    }

    const content = result;

    return {
      contents: [
        {
          uri: content.uri,
          text: content.text,
          metadata: content.metadata
        }
      ]
    };
  } catch (_error) {
    const mcpError = handleMcpError(_error, {
      uri,
      operation: "resource_read"
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
startServer().catch(error => {
  console.error("❌ 服务器启动失败:", error);
  process.exit(1);
});
