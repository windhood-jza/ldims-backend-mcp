#!/usr/bin/env node

/**
 * LDIMS MCP Service - 入口文件
 *
 * 提供LDIMS文档管理系统的Model Context Protocol (MCP) 接口
 * 支持AI助手通过标准化协议访问LDIMS功能
 *
 * @author LDIMS MCP Team
 * @version 1.0.0
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

import { getConfig, ConfigError } from "./config/index.js";
import { LdimsApiService, LdimsApiError } from "./services/ldims-api.js";
import { GetDocumentFileContentSchema } from "./types/mcp.js";

// 全局变量
let configManager: ReturnType<typeof getConfig>;
let ldimsApi: LdimsApiService;

/**
 * MCP服务器实例
 */
let server: Server;

/**
 * 错误处理 - 将内部错误转换为MCP标准错误
 */
function handleError(error: unknown): McpError {
  if (error instanceof McpError) {
    return error;
  }

  if (error instanceof LdimsApiError) {
    // 将LDIMS API错误转换为MCP错误
    switch (error.code) {
      case "HTTP_404":
        return new McpError(
          ErrorCode.InvalidRequest,
          `文件未找到: ${error.message}`
        );
      case "HTTP_401":
        return new McpError(
          ErrorCode.InvalidRequest,
          `认证失败: ${error.message}`
        );
      case "HTTP_403":
        return new McpError(
          ErrorCode.InvalidRequest,
          `权限不足: ${error.message}`
        );
      case "TIMEOUT":
        return new McpError(
          ErrorCode.InternalError,
          `请求超时: ${error.message}`
        );
      case "NETWORK_ERROR":
        return new McpError(
          ErrorCode.InternalError,
          `网络错误: ${error.message}`
        );
      default:
        return new McpError(
          ErrorCode.InternalError,
          `LDIMS API错误: ${error.message}`
        );
    }
  }

  if (error instanceof ConfigError) {
    return new McpError(ErrorCode.InternalError, `配置错误: ${error.message}`);
  }

  if (error instanceof z.ZodError) {
    const issues = error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    return new McpError(ErrorCode.InvalidParams, `参数验证失败: ${issues}`);
  }

  if (error instanceof Error) {
    return new McpError(
      ErrorCode.InternalError,
      `Internal server error: ${error.message}`
    );
  }

  return new McpError(ErrorCode.InternalError, "An unknown error occurred");
}

/**
 * 初始化服务器和依赖
 */
function initializeServer(): void {
  // 加载配置
  configManager = getConfig();
  const serverConfig = configManager.getServerConfig();
  const ldimsConfig = configManager.getLdimsConfig();

  console.log(
    `[MCP Server] 初始化 ${serverConfig.name} v${serverConfig.version}`
  );
  console.log(`[MCP Server] ${serverConfig.description}`);

  // 创建LDIMS API服务
  ldimsApi = new LdimsApiService(ldimsConfig);

  // 创建MCP服务器实例
  server = new Server(
    {
      name: serverConfig.name,
      version: serverConfig.version,
    },
    {
      capabilities: {
        tools: {}, // 工具能力 - 可被LLM调用的函数
        resources: {}, // 资源能力 - 可读取的数据内容
        prompts: {}, // 提示能力 - 预定义的提示模板
      },
    }
  );
}

/**
 * 设置MCP请求处理器
 */
function setupRequestHandlers(): void {
  /**
   * 工具列表处理器
   */
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "get_document_file_content",
          description: "获取LDIMS系统中指定文档文件的内容和元数据信息",
          inputSchema: zodToJsonSchema(GetDocumentFileContentSchema),
        },
      ],
    };
  });

  /**
   * 工具调用处理器
   */
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "get_document_file_content": {
          console.log(`[MCP Tool] 调用工具: ${name}`, args);

          // 验证参数
          const params = GetDocumentFileContentSchema.parse(args);

          try {
            // 调用LDIMS API获取文档内容
            const result = await ldimsApi.getDocumentFileContent(
              params.file_id,
              params.include_metadata,
              params.format
            );

            console.log(`[MCP Tool] 成功获取文档内容: ${params.file_id}`);

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          } catch (error) {
            console.error(
              `[MCP Tool] 获取文档内容失败: ${params.file_id}`,
              error
            );

            // 如果是开发模式且LDIMS API不可用，返回模拟数据
            if (
              configManager.isDevelopment() &&
              error instanceof LdimsApiError &&
              (error.code === "NETWORK_ERROR" || error.code === "TIMEOUT")
            ) {
              console.warn(`[MCP Tool] LDIMS API不可用，返回模拟数据`);

              const mockResponse = {
                file_id: params.file_id,
                content: `模拟文档内容 (文件ID: ${params.file_id})\n\n这是开发模式下的模拟数据，因为LDIMS API暂时不可用。\n生成时间: ${new Date().toISOString()}`,
                format: params.format,
                ...(params.include_metadata && {
                  metadata: {
                    filename: `mock_document_${params.file_id}.txt`,
                    size: 256,
                    created_at: new Date().toISOString(),
                    mime_type: "text/plain",
                    updated_at: new Date().toISOString(),
                    hash: `mock_hash_${params.file_id}`,
                  },
                }),
              };

              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(mockResponse, null, 2),
                  },
                ],
              };
            }

            // 其他错误正常抛出
            throw error;
          }
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (error) {
      throw handleError(error);
    }
  });
}

/**
 * 设置全局错误处理和进程信号处理
 */
function setupGlobalHandlers(): void {
  /**
   * 全局错误处理
   */
  server.onerror = (error) => {
    console.error("[MCP Server Error]", error);
  };

  /**
   * 优雅关闭处理
   */
  process.on("SIGINT", async () => {
    console.log("\n[MCP Server] 正在关闭服务器...");
    if (server) {
      await server.close();
    }
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n[MCP Server] 收到终止信号，正在关闭服务器...");
    if (server) {
      await server.close();
    }
    process.exit(0);
  });
}

/**
 * 启动MCP服务器
 */
async function main() {
  try {
    console.log("[MCP Server] 正在启动LDIMS MCP服务...");

    // 初始化服务器和依赖
    initializeServer();

    // 设置请求处理器
    setupRequestHandlers();

    // 设置全局错误处理和进程信号处理
    setupGlobalHandlers();

    // 检查LDIMS API连接（非阻塞）
    console.log("[MCP Server] 检查LDIMS API连接状态...");
    const apiHealthy = await ldimsApi.checkHealth();

    if (apiHealthy) {
      console.log("[MCP Server] ✅ LDIMS API连接正常");
    } else {
      console.warn(
        "[MCP Server] ⚠️  LDIMS API暂时不可用，将在开发模式下使用模拟数据"
      );
    }

    // 创建STDIO传输协议
    const transport = new StdioServerTransport();

    // 连接服务器到传输协议
    await server.connect(transport);

    console.log("[MCP Server] ✅ 服务器已启动，等待连接...");
    console.log("[MCP Server] 🔗 使用STDIO传输协议");
    console.log("[MCP Server] 🛠️  可用工具: get_document_file_content");
  } catch (error) {
    console.error("[MCP Server] ❌ 启动失败:", error);

    if (error instanceof ConfigError) {
      console.error("[MCP Server] 配置错误详情:", error.cause);
    }

    process.exit(1);
  }
}

// 启动服务器
if (require.main === module) {
  main().catch((error) => {
    console.error("[MCP Server] 致命错误:", error);
    process.exit(1);
  });
}
